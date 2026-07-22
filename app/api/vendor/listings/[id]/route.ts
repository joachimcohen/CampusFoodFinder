import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionVendorId } from "@/lib/vendor-auth";

type RouteParams = { params: Promise<{ id: string }> };

async function assertOwnsListing(supabase: ReturnType<typeof createAdminClient>, id: string, vendorId: string) {
  const { data } = await supabase.from("listings").select("vendor_id").eq("id", id).maybeSingle();
  return !!data && data.vendor_id === vendorId;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const vendorId = await getSessionVendorId(req, req.headers.get("x-vendor-slug") ?? undefined);
  if (!vendorId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const supabase = createAdminClient();
  if (!(await assertOwnsListing(supabase, id, vendorId))) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.is_active !== "boolean") {
    return NextResponse.json({ error: "Only is_active can be toggled here." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("listings")
    .update({ is_active: body.is_active })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listing: data });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const vendorId = await getSessionVendorId(req, req.headers.get("x-vendor-slug") ?? undefined);
  if (!vendorId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const supabase = createAdminClient();
  if (!(await assertOwnsListing(supabase, id, vendorId))) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
