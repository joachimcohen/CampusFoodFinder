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

  const { data, error } = await admin.supabase
    .from("vendors")
    .update({ pin_hash, failed_attempts: 0, locked_until: null })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // A vendor row that RLS silently excluded (e.g. an aal1 session, or a
  // stale/deleted id) updates zero rows without ever raising `error` — check
  // for that explicitly so the admin never sees a "new PIN" that was never
  // actually saved.
  if (!data) return NextResponse.json({ error: "Vendor not found or update was blocked." }, { status: 404 });
  return NextResponse.json({ pin });
}
