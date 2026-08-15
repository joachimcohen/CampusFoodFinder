import { NextResponse } from "next/server";
import { ORG_SESSION_COOKIE } from "@/lib/org-session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ORG_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
