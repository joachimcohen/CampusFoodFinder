import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAndClaim, recordAck, undoClaim } from "@/lib/claims";
import type { Listing } from "@/lib/types";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Walk-up collection (no virtual queue). The student ticks the food safety
 * label (and/or is within the weekly limit) and gets a "show this screen"
 * pass with the food, today's date and a live clock. No login and nothing
 * personal stored; see lib/claims.ts.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: listing, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  const typed = listing as Listing;
  if (typed.queue_enabled) {
    return NextResponse.json({ error: "This one uses the virtual queue. Please join the queue instead." }, { status: 400 });
  }

  const claim = await checkAndClaim(supabase, typed, { deviceId: body.deviceId, labelVersion: body.labelVersion });
  if ("error" in claim) {
    return NextResponse.json({ error: claim.error, code: claim.code }, { status: claim.status });
  }

  if (typed.food_safety_enabled) {
    const ack = await recordAck(supabase, typed);
    if (!ack) {
      await undoClaim(supabase, claim.claimId);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ...ack, labelVersion: typed.food_label_version }, { status: 201 });
  }

  // Weekly limit only, no label: still give a pass, nothing to record.
  return NextResponse.json({ acknowledgedAt: new Date().toISOString(), labelVersion: null }, { status: 201 });
}
