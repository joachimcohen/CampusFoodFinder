import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeEffectiveStatus, computePosition, computeWaitEstimate, formatWaitLabel } from "@/lib/queue";

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

  if (effectiveStatus !== "waiting") {
    return NextResponse.json({ status: effectiveStatus, position: null, waitMinutesLabel: null });
  }

  const position = await computePosition(supabase, entry.session_id, entry.joined_at);
  const waitMinutes = await computeWaitEstimate(supabase, entry.session_id, position, session.batch_size);

  return NextResponse.json({
    status: effectiveStatus,
    position,
    waitMinutesLabel: formatWaitLabel(waitMinutes),
  });
}
