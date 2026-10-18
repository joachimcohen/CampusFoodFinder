import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateTodaySession } from "@/lib/queue";
import { checkAndClaim, recordAck, undoClaim } from "@/lib/claims";
import type { Listing } from "@/lib/types";

/**
 * No student accounts — anyone can call this. A random token is generated
 * here (never trusted from the client) and returned once; the browser is
 * responsible for holding onto it (localStorage) to prove ownership of the
 * ticket on every later request, the same way a vendor's session cookie
 * proves ownership of their listings.
 *
 * When the listing has a food safety label, the student must have
 * acknowledged the current version of it (labelVersion) before joining.
 * The one-per-week limit is applied here too (lib/claims.ts).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const listingId = typeof body?.listingId === "string" ? body.listingId : null;
  const pushSubscriptionId = typeof body?.pushSubscriptionId === "string" ? body.pushSubscriptionId : null;

  if (!listingId) {
    return NextResponse.json({ error: "listingId is required." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Independent look-ups, so run them at the same time rather than one
  // after the other: each trip to the database adds a little wait.
  const [{ data: listing }, session] = await Promise.all([
    supabase.from("listings").select("*").eq("id", listingId).maybeSingle(),
    findOrCreateTodaySession(supabase, listingId),
  ]);
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  const typed = listing as Listing;

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

  const claim = await checkAndClaim(supabase, typed, {
    deviceId: body?.deviceId,
    labelVersion: body?.labelVersion,
  });
  if ("error" in claim) {
    return NextResponse.json({ error: claim.error, code: claim.code }, { status: claim.status });
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

  if (error) {
    await undoClaim(supabase, claim.claimId);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let ack: { acknowledgedAt: string } | null = null;
  if (typed.food_safety_enabled) {
    ack = await recordAck(supabase, typed, entry.id);
  }

  return NextResponse.json(
    {
      ticketId: entry.id,
      token,
      sessionId: session.id,
      acknowledgedAt: ack?.acknowledgedAt ?? null,
    },
    { status: 201 }
  );
}
