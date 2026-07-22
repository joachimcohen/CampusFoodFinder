import "server-only";
import { NextRequest } from "next/server";
import { verifyVendorSession, VENDOR_SESSION_COOKIE } from "@/lib/vendor-session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Returns the authenticated vendor's id from the session cookie, or null.
 *
 * `expectedSlug` should be the vendor slug the request is acting on (sent by
 * the client as the `x-vendor-slug` header) — the session is bound to the
 * slug it was created for at login, so a session for vendor A visiting
 * vendor B's page is rejected here rather than silently acting as vendor A.
 *
 * The session cookie is a stateless signed JWT, so it stays cryptographically
 * valid until it expires regardless of what happens to the vendor row in the
 * meantime. This only confirms the *signature and slug binding* — callers
 * that need to also revoke access the moment an admin disables or deletes a
 * vendor must additionally call `isVendorActive` below.
 */
export async function getSessionVendorId(req: NextRequest, expectedSlug?: string): Promise<string | null> {
  const token = req.cookies.get(VENDOR_SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifyVendorSession(token);
  if (!session) return null;
  if (expectedSlug !== undefined && session.slug !== expectedSlug) return null;
  return session.vendorId;
}

/**
 * Confirms the vendor still exists and hasn't been disabled or deleted by an
 * admin since this session was issued. Since the session cookie itself can't
 * be revoked early, this DB check is what actually cuts off access on the
 * vendor's very next request after an admin disables/deletes them, instead
 * of waiting out the rest of the session's lifetime.
 */
export async function isVendorActive(vendorId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("vendors").select("is_active").eq("id", vendorId).maybeSingle();
  return data?.is_active === true;
}
