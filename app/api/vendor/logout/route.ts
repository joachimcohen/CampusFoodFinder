import { NextResponse } from "next/server";
import { VENDOR_SESSION_COOKIE } from "@/lib/vendor-session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(VENDOR_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
