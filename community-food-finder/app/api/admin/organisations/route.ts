import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { generateAccessCode, hashAccessCode, slugify } from "@/lib/code";
import type { OrgType } from "@/lib/types";

const ORG_TYPES: OrgType[] = ["vendor", "community_org"];

/**
 * Admin creates the organisation/vendor record here after vetting them
 * off-platform — creation IS the approval step (Section 5). The generated
 * access code is the one time it's shown; the admin passes it to the org
 * directly, mirroring Campus Food Finder's vendor PIN issuance.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const suburb_id = typeof body?.suburb_id === "string" ? body.suburb_id : "";
  const org_type = typeof body?.org_type === "string" ? (body.org_type as OrgType) : null;
  const location = typeof body?.location === "string" && body.location.trim() ? body.location.trim() : null;

  if (!name || !suburb_id || !org_type || !ORG_TYPES.includes(org_type)) {
    return NextResponse.json({ error: "Name, suburb, and organisation type are required." }, { status: 400 });
  }

  const code = generateAccessCode();
  const access_code_hash = await hashAccessCode(code);
  const baseSlug = slugify(name);

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.floor(Math.random() * 1000)}`;
    const { data, error } = await admin.supabase
      .from("organisations")
      .insert({ name, suburb_id, org_type, slug, location, access_code_hash })
      .select("id, name, slug, org_type, suburb_id, location, is_active, created_at")
      .single();

    if (!error) return NextResponse.json({ organisation: data, code }, { status: 201 });
    if (error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: "Could not generate a unique organisation slug." }, { status: 500 });
}
