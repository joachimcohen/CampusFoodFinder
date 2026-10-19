import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteParams = { params: Promise<{ voucherId: string }> };

/**
 * A student's own voucher, proven by the token their device holds. Polled
 * by the voucher screen so it can show "used" (and the vendor's message)
 * as soon as staff tick it off at the counter.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { voucherId } = await params;
  const token = req.headers.get("x-voucher-token");
  if (!token) return NextResponse.json({ error: "Missing voucher token." }, { status: 401 });

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vouchers")
    .select("id, token, number, claimed_at, used_at")
    .eq("id", voucherId)
    .maybeSingle();

  if (!data || data.token !== token) {
    return NextResponse.json({ error: "Voucher not found." }, { status: 404 });
  }
  return NextResponse.json({ number: data.number, claimedAt: data.claimed_at, usedAt: data.used_at });
}
