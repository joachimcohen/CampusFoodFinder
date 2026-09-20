import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionVendorId, isVendorActive } from "@/lib/vendor-auth";
import { validateQueueConfig } from "@/lib/listing-input";

const QUEUE_FIELD_NAMES = [
  "queue_enabled",
  "queue_batch_size",
  "queue_no_show_minutes",
  "queue_capacity_cap",
  "queue_waiting_message",
  "queue_served_message",
  "queue_waiting_message_url",
  "queue_served_message_url",
];

type RouteParams = { params: Promise<{ id: string }> };

async function assertOwnsListing(supabase: ReturnType<typeof createAdminClient>, id: string, vendorId: string) {
  const { data } = await supabase.from("listings").select("vendor_id").eq("id", id).maybeSingle();
  return !!data && data.vendor_id === vendorId;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const vendorId = await getSessionVendorId(req, req.headers.get("x-vendor-slug") ?? undefined);
  if (!vendorId || !(await isVendorActive(vendorId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!(await assertOwnsListing(supabase, id, vendorId))) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Only is_active and the virtual-queue config fields can be patched here —
  // everything else about a listing requires recreating it (see
  // app/vendor/[vendorSlug]/page.tsx, which has no "edit" flow beyond these).
  const update: Record<string, unknown> = {};

  if ("is_active" in body) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json({ error: "is_active must be true or false." }, { status: 400 });
    }
    update.is_active = body.is_active;
  }

  if (QUEUE_FIELD_NAMES.some((name) => name in body)) {
    const queueConfig = validateQueueConfig(body as Record<string, unknown>);
    if ("error" in queueConfig) {
      return NextResponse.json({ error: queueConfig.error }, { status: 400 });
    }
    Object.assign(update, queueConfig);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("listings")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listing: data });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const vendorId = await getSessionVendorId(req, req.headers.get("x-vendor-slug") ?? undefined);
  if (!vendorId || !(await isVendorActive(vendorId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!(await assertOwnsListing(supabase, id, vendorId))) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
