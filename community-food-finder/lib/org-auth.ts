import "server-only";
import { NextRequest } from "next/server";
import { verifyOrgSession, ORG_SESSION_COOKIE } from "@/lib/org-session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Returns the authenticated organisation's id from the session cookie, or
 * null. `expectedSlug` should be the org slug the request is acting on (sent
 * by the client as the `x-org-slug` header) — the session is bound to the
 * slug it was created for at login, so a session for org A visiting org B's
 * page is rejected here rather than silently acting as org A.
 *
 * The cookie is a stateless signed JWT, so it stays valid until it expires
 * regardless of what happens to the organisation row in the meantime — see
 * `isOrgActive` below for the DB-backed revocation check.
 */
export async function getSessionOrgId(req: NextRequest, expectedSlug?: string): Promise<string | null> {
  const token = req.cookies.get(ORG_SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifyOrgSession(token);
  if (!session) return null;
  if (expectedSlug !== undefined && session.slug !== expectedSlug) return null;
  return session.organisationId;
}

/**
 * Confirms the organisation still exists and hasn't been disabled/revoked by
 * an admin since this session was issued — this is what actually cuts off
 * access on the org's very next request after an admin disables them.
 */
export async function isOrgActive(organisationId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("organisations")
    .select("is_active")
    .eq("id", organisationId)
    .maybeSingle();
  return data?.is_active === true;
}
