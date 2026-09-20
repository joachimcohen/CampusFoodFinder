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

  const session = await findOrCreateTodaySession(supabase, listingId);
  if ("error" in session) return NextResponse.json({ error: session.error }, { status: 400 });

  const { error } = await supabase.from("queue_sessions").update({ status: "closed" }).eq("id", session.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
