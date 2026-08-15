import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionOrgId, isOrgActive } from "@/lib/org-auth";
import { QUEUE_BATCH_SIZE, QUEUE_CALL_EXPIRY_MINUTES } from "@/lib/queue";
import { sendQueuePush } from "@/lib/push";
import { instanceConfig } from "@/lib/config";

/**
 * Calls the next batch of ~8-10 waiting tickets (Section 6). Staff use this
 * both for the normal cadence and to "manually open more spaces" for
 * no-shows — since it always just grabs the next N still-`waiting` tickets
 * by position, a re-call after no-shows naturally serves the next people in
 * line with no separate skip/refill logic needed.
 */
export async function POST(req: NextRequest) {
  const orgId = await getSessionOrgId(req, req.headers.get("x-org-slug") ?? undefined);
  if (!orgId || !(await isOrgActive(orgId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const listingId = typeof body?.listing_id === "string" ? body.listing_id : null;
  if (!listingId) return NextResponse.json({ error: "listing_id is required." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("organisation_id, queue_status, queue_run_id, title")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing || listing.organisation_id !== orgId) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }
  if (listing.queue_status !== "open" || !listing.queue_run_id) {
    return NextResponse.json({ error: "This queue isn't open." }, { status: 409 });
  }

  const { data: nextTickets, error: selectError } = await supabase
    .from("queue_tickets")
    .select("id, push_subscription")
    .eq("listing_id", listingId)
    .eq("queue_run_id", listing.queue_run_id)
    .eq("status", "waiting")
    .order("position", { ascending: true })
    .limit(QUEUE_BATCH_SIZE);

  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });
  if (!nextTickets || nextTickets.length === 0) {
    return NextResponse.json({ calledCount: 0 });
  }

  const calledAt = new Date();
  const expiresAt = new Date(calledAt.getTime() + QUEUE_CALL_EXPIRY_MINUTES * 60_000);
  const ids = nextTickets.map((t) => t.id);

  const { error: updateError } = await supabase
    .from("queue_tickets")
    .update({ status: "called", called_at: calledAt.toISOString(), expires_at: expiresAt.toISOString() })
    .in("id", ids);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await supabase.from("queue_calls").insert({
    listing_id: listingId,
    queue_run_id: listing.queue_run_id,
    batch_size: nextTickets.length,
    called_at: calledAt.toISOString(),
  });

  await Promise.allSettled(
    nextTickets
      .filter((t) => t.push_subscription)
      .map((t) =>
        sendQueuePush(t.push_subscription, {
          title: `${instanceConfig.productName}: You've been called!`,
          body: `${listing.title} — head over now, you have ${QUEUE_CALL_EXPIRY_MINUTES} minutes.`,
          url: `/queue/${listingId}`,
        })
      )
  );

  return NextResponse.json({ calledCount: nextTickets.length });
}
