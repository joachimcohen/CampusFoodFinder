import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionVendorId, isVendorActive } from "@/lib/vendor-auth";
import { validateQueueConfig } from "@/lib/listing-input";
import { removeListingPhoto } from "@/lib/cleanup";

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

  // Only is_active, sold-out state and the virtual-queue config fields can be patched here —
  // everything else about a listing requires recreating it (see
  // app/vendor/[vendorSlug]/page.tsx, which has no "edit" flow beyond these).
  const update: Record<string, unknown> = {};

  if ("is_active" in body) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json({ error: "is_active must be true or false." }, { status: 400 });
    }
    update.is_active = body.is_active;
  }

  // Sold out: closes the listing to new claims but keeps it visible (greyed)
  // for sold_out_visible_hours (default 12). Undo clears it; extend adds 12h.
  if ("sold_out" in body) {
    if (typeof body.sold_out !== "boolean") {
      return NextResponse.json({ error: "sold_out must be true or false." }, { status: 400 });
    }
    update.sold_out_at = body.sold_out ? new Date().toISOString() : null;
    if (!body.sold_out) update.sold_out_visible_hours = 12;
  }

  if ("extend_sold_out" in body) {
    const { data: current } = await supabase
      .from("listings")
      .select("sold_out_at, sold_out_visible_hours")
      .eq("id", id)
      .maybeSingle();
    if (!current?.sold_out_at) {
      return NextResponse.json({ error: "This listing isn't marked sold out." }, { status: 400 });
    }
    const extended = (current.sold_out_visible_hours ?? 12) + 12;
    if (extended > 72) {
      return NextResponse.json({ error: "Sold-out listings can stay visible for up to 72 hours." }, { status: 400 });
    }
    update.sold_out_visible_hours = extended;
  }

  // "Add more vouchers": raise the total. It can't go below what's already claimed.
  if ("voucher_total" in body) {
    const total = Number(body.voucher_total);
    const { data: current } = await supabase
      .from("listings")
      .select("food_type, voucher_claimed_count")
      .eq("id", id)
      .maybeSingle();
    if (current?.food_type !== "discount_voucher") {
      return NextResponse.json({ error: "Only voucher listings have a voucher total." }, { status: 400 });
    }
    if (!Number.isInteger(total) || total < (current.voucher_claimed_count ?? 0) || total > 100000) {
      return NextResponse.json(
        { error: `The total must be a whole number, at least the ${current.voucher_claimed_count} already claimed.` },
        { status: 400 }
      );
    }
    update.voucher_total = total;
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

  const { data: deleted, error } = await supabase.from("listings").delete().eq("id", id).select("photo_url").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Remove the photo too, so it isn't left in storage. If this fails, the
  // daily clean-up catches it as an unused photo.
  await removeListingPhoto(supabase, deleted?.photo_url ?? null);
  return NextResponse.json({ ok: true });
}
