import "server-only";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "cofi_org_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function getSecret(): Uint8Array {
  const secret = process.env.ORG_SESSION_SECRET;
  if (!secret) throw new Error("ORG_SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signOrgSession(organisationId: string, slug: string): Promise<string> {
  return new SignJWT({ organisation_id: organisationId, slug })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyOrgSession(
  token: string
): Promise<{ organisationId: string; slug: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.organisation_id !== "string" || typeof payload.slug !== "string") return null;
    return { organisationId: payload.organisation_id, slug: payload.slug };
  } catch {
    return null;
  }
}

export const ORG_SESSION_COOKIE = COOKIE_NAME;
export const ORG_SESSION_MAX_AGE = SESSION_TTL_SECONDS;
