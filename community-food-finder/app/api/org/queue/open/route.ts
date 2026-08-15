import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionOrgId, isOrgActive } from "@/lib/org-auth";

export async function POST(req: NextRequest) {
  const orgId = await getSessionOrgId(req, req.headers.get("x-org-slug") ?? undefined);
  if (!orgId || !(await isOrgActive(orgId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const listingId = typeof body?.listing_id === "string" ? body.listing_id : null;
  if (!listingId) return NextResponse.json({ error: "listing_id is required." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("organisation_id, queue_enabled")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing || listing.organisation_id !== orgId) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }
  if (!listing.queue_enabled) {
    return NextResponse.json({ error: "This listing doesn't have the queue enabled." }, { status: 400 });
  }

  const { error } = await supabase
    .from("listings")
    .update({ queue_status: "open", queue_run_id: crypto.randomUUID(), queue_next_position: 1 })
    .eq("id", listingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
