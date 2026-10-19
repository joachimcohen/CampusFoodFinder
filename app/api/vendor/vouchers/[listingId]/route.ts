import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionVendorId, isVendorActive } from "@/lib/vendor-auth";
import { assertVendorOwnsListing } from "@/lib/queue";
import { melbourneWeekStart } from "@/lib/listings";

type RouteParams = { params: Promise<{ listingId: string }> };

/** The vendor's tally for one voucher listing: totals plus the latest vouchers, newest first. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { listingId } = await params;
  const vendorId = await getSessionVendorId(req, req.headers.get("x-vendor-slug") ?? undefined);
  if (!vendorId || !(await isVendorActive(vendorId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!(await assertVendorOwnsListing(supabase, listingId, vendorId))) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  // "This week" = claimed since Monday 12am Melbourne time. Fetch the last
  // 8 days and check each claim's Melbourne week, which handles daylight
  // saving correctly.
  const thisWeekStart = melbourneWeekStart();
  const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000).toISOString();

  const [{ data: listing }, { data: recent }, used, thisWeek] = await Promise.all([
    supabase.from("listings").select("voucher_total, voucher_claimed_count").eq("id", listingId).maybeSingle(),
    supabase
      .from("vouchers")
      .select("id, number, claimed_at, used_at")
      .eq("listing_id", listingId)
      .order("number", { ascending: false })
      .limit(50),
    supabase
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId)
      .not("used_at", "is", null),
    supabase.from("vouchers").select("claimed_at").eq("listing_id", listingId).gte("claimed_at", eightDaysAgo),
  ]);
  const thisWeekCount = (thisWeek.data ?? []).filter(
    (v) => melbourneWeekStart(new Date(v.claimed_at)) === thisWeekStart
  ).length;

  return NextResponse.json({
    total: listing?.voucher_total ?? 0,
    claimed: listing?.voucher_claimed_count ?? 0,
    used: used.count ?? 0,
    thisWeek: thisWeekCount,
    vouchers: recent ?? [],
  });
}

/** Marks a voucher used by its number, as read off the student's screen at the counter. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { listingId } = await params;
  const vendorId = await getSessionVendorId(req, req.headers.get("x-vendor-slug") ?? undefined);
  if (!vendorId || !(await isVendorActive(vendorId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const number = Number(body?.number);
  if (!Number.isInteger(number) || number < 1) {
    return NextResponse.json({ error: "Enter a voucher number." }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!(await assertVendorOwnsListing(supabase, listingId, vendorId))) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const { data: voucher } = await supabase
    .from("vouchers")
    .select("id, number, used_at")
    .eq("listing_id", listingId)
    .eq("number", number)
    .maybeSingle();
  if (!voucher) {
    return NextResponse.json({ error: `There's no voucher #${number} for this listing.` }, { status: 404 });
  }
  if (voucher.used_at) {
    return NextResponse.json(
      { error: `Voucher #${number} was already used.`, usedAt: voucher.used_at, code: "already_used" },
      { status: 409 }
    );
  }

  // Only update if still unused, so two staff ticking at once can't both succeed.
  const { data, error } = await supabase
    .from("vouchers")
    .update({ used_at: new Date().toISOString() })
    .eq("id", voucher.id)
    .is("used_at", null)
    .select("id, number, claimed_at, used_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not update the voucher." }, { status: 500 });
  if (!data) return NextResponse.json({ error: `Voucher #${number} was already used.`, code: "already_used" }, { status: 409 });
  return NextResponse.json({ voucher: data });
}
