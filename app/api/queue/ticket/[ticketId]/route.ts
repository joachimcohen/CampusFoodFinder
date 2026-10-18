import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeEffectiveStatus,
  computePosition,
  computeTicketNumber,
  computeWaitEstimate,
  formatWaitLabel,
} from "@/lib/queue";

type RouteParams = { params: Promise<{ ticketId: string }> };

/**
 * Polled every few seconds by the student's status page instead of a
 * Postgres Realtime subscription — see the plan's rationale: identical UX
 * for a queue that only changes every few minutes, without needing to
 * invent a new anonymous-write trust boundary. Ownership is proven by
 * `x-queue-token` matching the row's anonymous_token, the same
 * app-layer-scoping pattern used for vendor listings (assertOwnsListing).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { ticketId } = await params;
  const token = req.headers.get("x-queue-token");
  if (!token) return NextResponse.json({ error: "Missing ticket token." }, { status: 401 });

  const supabase = createAdminClient();
  const { data: entry, error } = await supabase
    .from("queue_entries")
    .select("id, session_id, anonymous_token, status, joined_at, called_at")
    .eq("id", ticketId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!entry || entry.anonymous_token !== token) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const { data: session } = await supabase
    .from("queue_sessions")
    .select("no_show_window_minutes, batch_size")
    .eq("id", entry.session_id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Queue session not found." }, { status: 404 });

  const effectiveStatus = computeEffectiveStatus(entry.status, entry.called_at, session.no_show_window_minutes);
  const ticketNumber = await computeTicketNumber(supabase, entry.session_id, entry.joined_at);

  if (effectiveStatus !== "waiting") {
    return NextResponse.json({ status: effectiveStatus, ticketNumber, position: null, waitMinutesLabel: null });
  }

  const position = await computePosition(supabase, entry.session_id, entry.joined_at);
  const waitMinutes = await computeWaitEstimate(supabase, entry.session_id, position, session.batch_size);

  return NextResponse.json({
    status: effectiveStatus,
    ticketNumber,
    position,
    waitMinutesLabel: formatWaitLabel(waitMinutes),
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Links a ticket to the device's push subscription after joining, so the
 * "you're up" notification can reach it. Joining no longer waits on push
 * set-up, which could take several seconds or sit on a permission prompt.
 * Same ownership proof as GET: the ticket's own token.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { ticketId } = await params;
  const token = req.headers.get("x-queue-token");
  if (!token) return NextResponse.json({ error: "Missing ticket token." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const pushSubscriptionId = typeof body?.pushSubscriptionId === "string" ? body.pushSubscriptionId : null;
  if (!pushSubscriptionId || !UUID.test(pushSubscriptionId)) {
    return NextResponse.json({ error: "Invalid notification subscription." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: entry } = await supabase
    .from("queue_entries")
    .select("id, anonymous_token")
    .eq("id", ticketId)
    .maybeSingle();
  if (!entry || entry.anonymous_token !== token) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const { error } = await supabase
    .from("queue_entries")
    .update({ push_subscription_id: pushSubscriptionId })
    .eq("id", ticketId);
  // A bad subscription id fails the foreign key check; treat that as invalid input.
  if (error) return NextResponse.json({ error: "Could not turn on notifications." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
