import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateTodaySession } from "@/lib/queue";

/**
 * No student accounts — anyone can call this. A random token is generated
 * here (never trusted from the client) and returned once; the browser is
 * responsible for holding onto it (localStorage) to prove ownership of the
 * ticket on every later request, the same way a vendor's session cookie
 * proves ownership of their listings.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const listingId = typeof body?.listingId === "string" ? body.listingId : null;
  const pushSubscriptionId = typeof body?.pushSubscriptionId === "string" ? body.pushSubscriptionId : null;

  if (!listingId) {
    return NextResponse.json({ error: "listingId is required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const session = await findOrCreateTodaySession(supabase, listingId);
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: 400 });
  }

  if (session.status === "closed") {
    return NextResponse.json({ error: "This queue is closed right now. Please check back later." }, { status: 409 });
  }

  if (session.capacity_cap !== null) {
    const { count } = await supabase
      .from("queue_entries")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id);

    if ((count ?? 0) >= session.capacity_cap) {
      return NextResponse.json(
        { error: "This queue is full right now. Please check back shortly." },
        { status: 409 }
      );
    }
  }

  const token = crypto.randomUUID();
  const { data: entry, error } = await supabase
    .from("queue_entries")
    .insert({
      session_id: session.id,
      anonymous_token: token,
      push_subscription_id: pushSubscriptionId,
    })
    .select("id, joined_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ticketId: entry.id, token, sessionId: session.id }, { status: 201 });
}
