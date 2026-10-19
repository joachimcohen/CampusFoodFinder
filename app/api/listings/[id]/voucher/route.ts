import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAndClaim, undoClaim } from "@/lib/claims";
import type { Listing } from "@/lib/types";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Reserves the next numbered voucher on a discount voucher listing. No
 * queue: the student gets a voucher straight away, or is told they're all
 * claimed. The one-per-week limit (when ticked) and any food safety label
 * are checked the same way as walk-up collection (lib/claims.ts).
 *
 * The voucher is tied only to a random token returned here and kept on the
 * student's device. No student details are stored.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: listing } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  const typed = listing as Listing;

  if (typed.food_type !== "discount_voucher") {
    return NextResponse.json({ error: "This listing doesn't offer vouchers." }, { status: 400 });
  }
  if (typed.schedule_type === "one_time" && typed.expires_at && new Date(typed.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This voucher offer has ended.", code: "ended" }, { status: 409 });
  }
  if ((typed.voucher_claimed_count ?? 0) >= (typed.voucher_total ?? 0)) {
    return NextResponse.json({ error: "Sorry, all the vouchers have been claimed.", code: "all_claimed" }, { status: 409 });
  }

  const claim = await checkAndClaim(supabase, typed, { deviceId: body.deviceId, labelVersion: body.labelVersion });
  if ("error" in claim) {
    return NextResponse.json({ error: claim.error, code: claim.code }, { status: claim.status });
  }

  const token = randomBytes(24).toString("base64url");
  const { data, error } = await supabase.rpc("claim_voucher", { p_listing_id: id, p_token: token });
  if (error) {
    await undoClaim(supabase, claim.claimId);
    console.error("claim_voucher failed", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    // Someone else took the last one a moment ago.
    await undoClaim(supabase, claim.claimId);
    return NextResponse.json({ error: "Sorry, all the vouchers have been claimed.", code: "all_claimed" }, { status: 409 });
  }

  return NextResponse.json(
    {
      voucherId: row.voucher_id,
      token,
      number: row.voucher_number,
      total: row.voucher_total,
      claimedAt: row.claimed_at,
    },
    { status: 201 }
  );
}
