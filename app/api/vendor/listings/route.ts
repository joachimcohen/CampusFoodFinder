import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionVendorId, isVendorActive } from "@/lib/vendor-auth";
import { validateListingInput } from "@/lib/listing-input";

export async function GET(req: NextRequest) {
  const vendorId = await getSessionVendorId(req, req.headers.get("x-vendor-slug") ?? undefined);
  if (!vendorId || !(await isVendorActive(vendorId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listings: data });
}

export async function POST(req: NextRequest) {
  const vendorId = await getSessionVendorId(req, req.headers.get("x-vendor-slug") ?? undefined);
  if (!vendorId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const result = validateListingInput(body);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const supabase = createAdminClient();
  const { data: vendor, error: fetchError } = await supabase
    .from("vendors")
    .select("campus_id, is_active")
    .eq("id", vendorId)
    .maybeSingle();

  if (fetchError) {
    console.error("vendor listing create: failed to fetch vendor", fetchError);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  if (!vendor || !vendor.is_active) {
    return NextResponse.json({ error: "Vendor account is inactive." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("listings")
    .insert({ ...result.input, vendor_id: vendorId, campus_id: vendor.campus_id })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listing: data }, { status: 201 });
}
