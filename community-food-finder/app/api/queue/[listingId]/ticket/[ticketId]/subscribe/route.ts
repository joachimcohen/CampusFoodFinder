import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ listingId: string; ticketId: string }> };

/** Stores a ticket-holder's push subscription for the "called" notification (Section 6). Best-effort — the live status page works without it. */
export async function POST(req: NextRequest, { params }: Params) {
  const { listingId, ticketId } = await params;
  const subscription = await req.json().catch(() => null);
  if (!subscription || typeof subscription !== "object") {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("queue_tickets")
    .update({ push_subscription: subscription })
    .eq("id", ticketId)
    .eq("listing_id", listingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
