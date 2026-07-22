import "server-only";
import { NextRequest } from "next/server";
import { verifyVendorSession, VENDOR_SESSION_COOKIE } from "@/lib/vendor-session";

/**
 * Returns the authenticated vendor's id from the session cookie, or null.
 *
 * `expectedSlug` should be the vendor slug the request is acting on (sent by
 * the client as the `x-vendor-slug` header) — the session is bound to the
 * slug it was created for at login, so a session for vendor A visiting
 * vendor B's page is rejected here rather than silently acting as vendor A.
 */
export async function getSessionVendorId(req: NextRequest, expectedSlug?: string): Promise<string | null> {
  const token = req.cookies.get(VENDOR_SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifyVendorSession(token);
  if (!session) return null;
  if (expectedSlug !== undefined && session.slug !== expectedSlug) return null;
  return session.vendorId;
}
