import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionVendorId } from "@/lib/vendor-auth";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  const vendorId = await getSessionVendorId(req, req.headers.get("x-vendor-slug") ?? undefined);
  if (!vendorId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 5MB." }, { status: 400 });
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${vendorId}/${crypto.randomUUID()}.${extension}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from("listing-photos")
    .upload(path, await file.arrayBuffer(), { contentType: file.type });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from("listing-photos").getPublicUrl(path);
  return NextResponse.json({ photo_url: data.publicUrl });
}
