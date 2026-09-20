import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionVendorId, isVendorActive } from "@/lib/vendor-auth";

type RouteParams = { params: Promise<{ entryId: string }> };

/** Confirms this entry's session's listing belongs to the calling vendor — same app-layer ownership shape as assertOwnsListing, one join deeper. */
async function assertOwnsEntry(
  supabase: ReturnType<typeof createAdminClient>,
  entryId: string,
  vendorId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("queue_entries")
    .select("session_id, queue_sessions!inner(listing_id, listings!inner(vendor_id))")
    .eq("id", entryId)
    .maybeSingle();

  const row = data as unknown as { queue_sessions: { listings: { vendor_id: string } } } | null;
  return !!row && row.queue_sessions.listings.vendor_id === vendorId;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { entryId } = await params;
  const vendorId = await getSessionVendorId(req, req.headers.get("x-vendor-slug") ?? undefined);
  if (!vendorId || !(await isVendorActive(vendorId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!(await assertOwnsEntry(supabase, entryId, vendorId))) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (body?.status !== "served") {
    return NextResponse.json({ error: "Only marking a ticket as served is supported here." }, { status: 400 });
  }

  const { error } = await supabase.from("queue_entries").update({ status: "served" }).eq("id", entryId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
