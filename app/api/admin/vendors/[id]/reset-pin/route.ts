import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { generatePin, hashPin } from "@/lib/pin";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const pin = generatePin();
  const pin_hash = await hashPin(pin);

  const { error } = await admin.supabase
    .from("vendors")
    .update({ pin_hash, failed_attempts: 0, locked_until: null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pin });
}
