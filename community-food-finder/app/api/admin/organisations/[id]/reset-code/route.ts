import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { generateAccessCode, hashAccessCode } from "@/lib/code";

type RouteParams = { params: Promise<{ id: string }> };

/** Reissues a new access code — also how an admin revokes a compromised one (Section 5: "revoke or reissue"). */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const code = generateAccessCode();
  const access_code_hash = await hashAccessCode(code);

  const { error } = await admin.supabase
    .from("organisations")
    .update({ access_code_hash, failed_attempts: 0, locked_until: null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ code });
}
