import "server-only";
import { NextRequest } from "next/server";
import { verifyVendorSession, VENDOR_SESSION_COOKIE } from "@/lib/vendor-session";

/** Returns the authenticated vendor's id from the session cookie, or null. */
export async function getSessionVendorId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(VENDOR_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyVendorSession(token);
}
