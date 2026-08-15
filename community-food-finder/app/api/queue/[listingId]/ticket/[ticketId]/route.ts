import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateWaitMinutes, isTicketExpired } from "@/lib/queue";
import type { QueueTicket } from "@/lib/types";

type Params = { params: Promise<{ listingId: string; ticketId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { listingId, ticketId } = await params;
  const supabase = createAdminClient();

  const [{ data: ticket, error: ticketError }, { data: listing, error: listingError }] = await Promise.all([
    supabase
      .from("queue_tickets")
      .select("id, listing_id, queue_run_id, position, status, joined_at, called_at, expires_at")
      .eq("id", ticketId)
      .eq("listing_id", listingId)
      .maybeSingle(),
    supabase.from("listings").select("queue_status, queue_run_id, queue_next_position").eq("id", listingId).maybeSingle(),
  ]);

  if (ticketError || listingError || !ticket || !listing) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  let current = ticket as QueueTicket;

  if (isTicketExpired(current)) {
    const { data: updated } = await supabase
      .from("queue_tickets")
      .update({ status: "expired" })
      .eq("id", ticketId)
      .select("id, listing_id, queue_run_id, position, status, joined_at, called_at, expires_at")
      .single();
    if (updated) current = updated as QueueTicket;
  }

  const [{ data: calls }, { data: lastCalled }] = await Promise.all([
    supabase
      .from("queue_calls")
      .select("batch_size, called_at")
      .eq("listing_id", listingId)
      .eq("queue_run_id", current.queue_run_id)
      .order("called_at", { ascending: true }),
    supabase
      .from("queue_tickets")
      .select("position")
      .eq("listing_id", listingId)
      .eq("queue_run_id", current.queue_run_id)
      .in("status", ["called", "served", "expired"])
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Highest position reached by the queue so far — the actual number of
  // *positions* processed, which can differ from the sum of batch sizes if
  // some positions were skipped (cancelled tickets). Used for "people
  // ahead"; the batch-size sum below is used separately for the calling
  // *rate*, where it's the right measure regardless of gaps.
  const lastCalledPosition = lastCalled?.position ?? 0;

  const peopleAhead = Math.max(0, current.position - lastCalledPosition);
  const estimatedWaitMinutes =
    current.status === "waiting" ? estimateWaitMinutes(current.position, lastCalledPosition, calls ?? []) : null;

  return NextResponse.json({
    ticket: current,
    peopleAhead,
    estimatedWaitMinutes,
    queueOpen: listing.queue_status === "open" && listing.queue_run_id === current.queue_run_id,
  });
}
