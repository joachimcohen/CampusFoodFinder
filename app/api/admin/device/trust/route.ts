import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { signAdminDeviceToken, ADMIN_DEVICE_COOKIE, ADMIN_DEVICE_MAX_AGE } from "@/lib/admin-device";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const token = await signAdminDeviceToken(admin.user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_DEVICE_MAX_AGE,
  });
  return res;
}
