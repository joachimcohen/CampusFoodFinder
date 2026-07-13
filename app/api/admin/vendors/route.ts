import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { generatePin, hashPin, slugify } from "@/lib/pin";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const campus_id = typeof body?.campus_id === "string" ? body.campus_id : "";
  const location = typeof body?.location === "string" && body.location.trim() ? body.location.trim() : null;
  if (!name || !campus_id) {
    return NextResponse.json({ error: "Vendor name and campus are required." }, { status: 400 });
  }

  const pin = generatePin();
  const pin_hash = await hashPin(pin);
  const baseSlug = slugify(name);

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.floor(Math.random() * 1000)}`;
    const { data, error } = await admin.supabase
      .from("vendors")
      .insert({ name, campus_id, slug, location, pin_hash })
      .select("id, name, slug, campus_id, location, is_active, created_at")
      .single();

    if (!error) return NextResponse.json({ vendor: data, pin }, { status: 201 });
    if (error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: "Could not generate a unique vendor slug." }, { status: 500 });
}
