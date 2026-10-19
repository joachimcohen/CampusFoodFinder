import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionVendorId, isVendorActive } from "@/lib/vendor-auth";
import { assertVendorOwnsListing } from "@/lib/queue";

type RouteParams = { params: Promise<{ voucherId: string }> };

/** Staff tick a voucher off as used at the counter (or undo a mistaken tick). */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { voucherId } = await params;
  const vendorId = await getSessionVendorId(req, req.headers.get("x-vendor-slug") ?? undefined);
  if (!vendorId || !(await isVendorActive(vendorId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.used !== "boolean") {
    return NextResponse.json({ error: "used must be true or false." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: voucher } = await supabase
    .from("vouchers")
    .select("id, listing_id, used_at")
    .eq("id", voucherId)
    .maybeSingle();
  if (!voucher || !(await assertVendorOwnsListing(supabase, voucher.listing_id, vendorId))) {
    return NextResponse.json({ error: "Voucher not found." }, { status: 404 });
  }

  if (body.used && voucher.used_at) {
    return NextResponse.json(
      { error: "This voucher has already been used.", usedAt: voucher.used_at, code: "already_used" },
      { status: 409 }
    );
  }

  let query = supabase
    .from("vouchers")
    .update({ used_at: body.used ? new Date().toISOString() : null })
    .eq("id", voucherId);
  // Marking used only succeeds if it's still unused, so two staff can't both tick it.
  if (body.used) query = query.is("used_at", null);
  const { data, error } = await query.select("id, number, claimed_at, used_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not update the voucher." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "This voucher has already been used.", code: "already_used" }, { status: 409 });
  return NextResponse.json({ voucher: data });
}
