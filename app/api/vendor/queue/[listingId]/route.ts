import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionVendorId, isVendorActive } from "@/lib/vendor-auth";
import { assertVendorOwnsListing, getStaffSnapshot } from "@/lib/queue";

type RouteParams = { params: Promise<{ listingId: string }> };

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

  const snapshot = await getStaffSnapshot(supabase, listingId);
  if ("error" in snapshot) return NextResponse.json({ error: snapshot.error }, { status: 400 });

  return NextResponse.json(snapshot);
}
