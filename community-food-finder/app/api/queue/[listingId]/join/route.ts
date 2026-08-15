import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

type Params = { params: Promise<{ listingId: string }> };

// Generous but bounded — the queue has no login, so this is the only abuse
// guard against one device spamming tickets (Section 8).
const JOIN_LIMIT = 20;
const JOIN_WINDOW_SECONDS = 600;

export async function POST(req: NextRequest, { params }: Params) {
  const { listingId } = await params;
  const supabase = createAdminClient();

  const allowed = await checkRateLimit(supabase, `queue-join:${clientIp(req)}`, JOIN_LIMIT, JOIN_WINDOW_SECONDS);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  const { data: ticket, error } = await supabase.rpc("join_queue_ticket", { p_listing_id: listingId }).single();

  if (error) {
    if (error.message.includes("queue_not_open")) {
      return NextResponse.json({ error: "This queue isn't open right now." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not join the queue. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ticket }, { status: 201 });
}
