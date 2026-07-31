import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionVendorId, isVendorActive } from "@/lib/vendor-auth";
import { assertVendorOwnsListing, findOrCreateTodaySession } from "@/lib/queue";

type RouteParams = { params: Promise<{ listingId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { listingId } = await params;
  const vendorId = await getSessionVendorId(req, req.headers.get("x-vendor-slug") ?? undefined);
  if (!vendorId || !(await isVendorActive(vendorId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!(await assertVendorOwnsListing(supabase, listingId, vendorId))) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  // findOrCreateTodaySession returns the existing (now closed) session for
  // today rather than creating a new one — closing never deletes it, so
  // reopening is just flipping the same row's status back.
  const session = await findOrCreateTodaySession(supabase, listingId);
  if ("error" in session) return NextResponse.json({ error: session.error }, { status: 400 });

  const { error } = await supabase.from("queue_sessions").update({ status: "open" }).eq("id", session.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
