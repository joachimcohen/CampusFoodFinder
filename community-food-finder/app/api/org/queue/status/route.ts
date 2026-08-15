import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionOrgId, isOrgActive } from "@/lib/org-auth";

export async function GET(req: NextRequest) {
  const orgId = await getSessionOrgId(req, req.headers.get("x-org-slug") ?? undefined);
  if (!orgId || !(await isOrgActive(orgId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const listingId = req.nextUrl.searchParams.get("listing_id");
  if (!listingId) return NextResponse.json({ error: "listing_id is required." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("organisation_id, queue_status, queue_run_id")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing || listing.organisation_id !== orgId) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  if (!listing.queue_run_id) {
    return NextResponse.json({ queueStatus: listing.queue_status, waitingCount: 0, calledCount: 0 });
  }

  const [{ count: waitingCount }, { count: calledCount }] = await Promise.all([
    supabase
      .from("queue_tickets")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId)
      .eq("queue_run_id", listing.queue_run_id)
      .eq("status", "waiting"),
    supabase
      .from("queue_tickets")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId)
      .eq("queue_run_id", listing.queue_run_id)
      .eq("status", "called"),
  ]);

  return NextResponse.json({
    queueStatus: listing.queue_status,
    waitingCount: waitingCount ?? 0,
    calledCount: calledCount ?? 0,
  });
}
