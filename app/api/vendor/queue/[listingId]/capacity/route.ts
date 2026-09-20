import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionVendorId, isVendorActive } from "@/lib/vendor-auth";
import { assertVendorOwnsListing, updateSessionCapacity } from "@/lib/queue";

type RouteParams = { params: Promise<{ listingId: string }> };

/** Raises or lowers today's live session capacity — separate from PATCH /api/vendor/listings/[id], which only changes the listing's future default. */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { listingId } = await params;
  const vendorId = await getSessionVendorId(req, req.headers.get("x-vendor-slug") ?? undefined);
  if (!vendorId || !(await isVendorActive(vendorId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!(await assertVendorOwnsListing(supabase, listingId, vendorId))) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  let capacityCap: number | null = null;
  if (body?.capacity_cap !== null && body?.capacity_cap !== undefined) {
    capacityCap = Number(body.capacity_cap);
    if (!Number.isInteger(capacityCap) || capacityCap < 0) {
      return NextResponse.json({ error: "Capacity must be a whole number, or null for no cap." }, { status: 400 });
    }
  }

  const result = await updateSessionCapacity(supabase, listingId, capacityCap);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ session: result });
}
