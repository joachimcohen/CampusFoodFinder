import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMelbourneParts } from "@/lib/melbourne-time";
import type { QueueEntry, QueueEntryStatus, QueueSession, QueueStaffSnapshot } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Mirrors assertOwnsListing in app/api/vendor/listings/[id]/route.ts — the same app-layer ownership check, scoped to a listing rather than a listing's id being passed directly. */
export async function assertVendorOwnsListing(
  supabase: AdminClient,
  listingId: string,
  vendorId: string
): Promise<boolean> {
  const { data } = await supabase.from("listings").select("vendor_id").eq("id", listingId).maybeSingle();
  return !!data && data.vendor_id === vendorId;
}

/**
 * Finds today's (Melbourne date) open session for a listing, or creates one
 * by snapshotting the listing's currently configured batch size / no-show
 * window / capacity cap. A session's rules stay fixed for the rest of the
 * day even if the vendor changes the listing's defaults afterward — capacity
 * is the one exception, deliberately left live-editable via
 * updateSessionCapacity below, per the vendor's request to be able to raise
 * it mid-session.
 */
export async function findOrCreateTodaySession(
  supabase: AdminClient,
  listingId: string
): Promise<QueueSession | { error: string }> {
  const today = getMelbourneParts(new Date()).dateStr;

  const { data: existing, error: fetchError } = await supabase
    .from("queue_sessions")
    .select("*")
    .eq("listing_id", listingId)
    .eq("date", today)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (existing) return existing as QueueSession;

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("queue_enabled, queue_batch_size, queue_no_show_minutes, queue_capacity_cap")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError) return { error: listingError.message };
  if (!listing || !listing.queue_enabled) return { error: "Queue is not enabled for this listing." };

  const { data: created, error: insertError } = await supabase
    .from("queue_sessions")
    .insert({
      listing_id: listingId,
      date: today,
      batch_size: listing.queue_batch_size,
      no_show_window_minutes: listing.queue_no_show_minutes,
      capacity_cap: listing.queue_capacity_cap,
    })
    .select("*")
    .single();

  if (insertError) return { error: insertError.message };
  return created as QueueSession;
}

/** Derives the *effective* status, flipping a stale "called" ticket to "expired" purely from timestamps — no background job needed (same philosophy as isHappeningNow in lib/listings.ts). */
export function computeEffectiveStatus(
  status: QueueEntryStatus,
  calledAt: string | null,
  noShowWindowMinutes: number,
  now: Date = new Date()
): QueueEntryStatus {
  if (status !== "called" || !calledAt) return status;
  const minutesSinceCalled = (now.getTime() - new Date(calledAt).getTime()) / 60000;
  return minutesSinceCalled > noShowWindowMinutes ? "expired" : "called";
}

async function countJoinedBefore(
  supabase: AdminClient,
  sessionId: string,
  joinedAt: string,
  onlyWaiting: boolean
): Promise<number> {
  let query = supabase
    .from("queue_entries")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .lt("joined_at", joinedAt);
  if (onlyWaiting) query = query.eq("status", "waiting");

  const { count } = await query;
  return count ?? 0;
}

/** Position among still-waiting entries, 1-indexed by join order. Always computed live — never stored — so it can't drift out of sync as people are served or expire. */
export async function computePosition(supabase: AdminClient, sessionId: string, joinedAt: string): Promise<number> {
  return (await countJoinedBefore(supabase, sessionId, joinedAt, true)) + 1;
}

/**
 * A stable "Nth to join today" number — the queue equivalent of a deli
 * ticket. Unlike position, this never changes once assigned (join order
 * never changes and entries are never deleted), so it's what a student
 * shows staff at the counter and what staff see next to each called
 * student, letting the two sides be matched up without guesswork.
 */
export async function computeTicketNumber(
  supabase: AdminClient,
  sessionId: string,
  joinedAt: string
): Promise<number> {
  return (await countJoinedBefore(supabase, sessionId, joinedAt, false)) + 1;
}

/**
 * Dynamic wait estimate: (position ÷ current batch size) × the average gap
 * between the last few batch calls. Returns null before the session's first
 * call, so the UI can show "Calculating your wait…" instead of a guess.
 */
export async function computeWaitEstimate(
  supabase: AdminClient,
  sessionId: string,
  position: number,
  batchSize: number
): Promise<number | null> {
  const { data: recentCalls } = await supabase
    .from("batch_calls")
    .select("called_at")
    .eq("session_id", sessionId)
    .order("called_at", { ascending: false })
    .limit(5);

  // A gap needs two calls to measure; with only one, there's genuinely no
  // pace data yet — same "Calculating your wait…" case as zero calls.
  if (!recentCalls || recentCalls.length < 2) return null;

  const times = recentCalls.map((c) => new Date(c.called_at).getTime());
  let totalGapMs = 0;
  for (let i = 0; i < times.length - 1; i++) {
    totalGapMs += times[i] - times[i + 1];
  }
  const avgGapMinutes = totalGapMs / (times.length - 1) / 60000;

  return Math.max(0, Math.round((position / batchSize) * avgGapMinutes));
}

export function formatWaitLabel(minutes: number | null): string | null {
  if (minutes === null) return "Calculating your wait…";
  if (minutes <= 0) return "Any moment now";
  return `~${minutes} min`;
}

/**
 * Raises or lowers today's already-open session's capacity live — separate
 * from the listing's own default, and independent of it, per the vendor's
 * request to be able to open up more spots mid-session (e.g. 300 -> 350)
 * without that affecting future days' defaults.
 */
export async function updateSessionCapacity(
  supabase: AdminClient,
  listingId: string,
  capacityCap: number | null
): Promise<QueueSession | { error: string }> {
  const session = await findOrCreateTodaySession(supabase, listingId);
  if ("error" in session) return session;

  const { data, error } = await supabase
    .from("queue_sessions")
    .update({ capacity_cap: capacityCap })
    .eq("id", session.id)
    .select("*")
    .single();

  if (error) return { error: error.message };
  return data as QueueSession;
}

/**
 * Full snapshot for the staff screen: today's session, the ordered waiting
 * list, who's currently called (awaiting being marked served or expiring),
 * and running counts. Fetches every entry for the session once and derives
 * each one's ticket number (join order, 1-indexed, never changes) and
 * position (rank among only those still waiting) from that single list,
 * rather than a separate query per entry.
 */
export async function getStaffSnapshot(
  supabase: AdminClient,
  listingId: string
): Promise<QueueStaffSnapshot | { error: string }> {
  const session = await findOrCreateTodaySession(supabase, listingId);
  if ("error" in session) return session;

  const { data: rows } = await supabase
    .from("queue_entries")
    .select("id, session_id, status, joined_at, called_at")
    .eq("session_id", session.id)
    .order("joined_at", { ascending: true });

  const now = new Date();
  const waiting: QueueEntry[] = [];
  const called: QueueEntry[] = [];
  let servedCount = 0;
  let waitingSeen = 0;

  for (const [index, row] of ((rows ?? []) as QueueEntry[]).entries()) {
    const ticket_number = index + 1;
    const effective = computeEffectiveStatus(row.status, row.called_at, session.no_show_window_minutes, now);

    if (effective === "waiting") {
      waitingSeen += 1;
      waiting.push({ ...row, ticket_number, position: waitingSeen });
    } else if (effective === "called") {
      called.push({ ...row, ticket_number });
    } else if (row.status === "served") {
      servedCount += 1;
    }
  }

  return { session, waiting, called, waitingCount: waiting.length, servedCount };
}
