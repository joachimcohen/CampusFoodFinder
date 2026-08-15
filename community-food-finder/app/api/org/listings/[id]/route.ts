import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionOrgId, isOrgActive } from "@/lib/org-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const orgId = await getSessionOrgId(req, req.headers.get("x-org-slug") ?? undefined);
  if (!orgId || !(await isOrgActive(orgId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.is_active !== "boolean") {
    return NextResponse.json({ error: "is_active must be a boolean." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listings")
    .update({ is_active: body.is_active })
    .eq("id", id)
    .eq("organisation_id", orgId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  return NextResponse.json({ listing: data });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const orgId = await getSessionOrgId(req, req.headers.get("x-org-slug") ?? undefined);
  if (!orgId || !(await isOrgActive(orgId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from("listings")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("organisation_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
