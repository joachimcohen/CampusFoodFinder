import "server-only";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "cff_vendor_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function getSecret(): Uint8Array {
  const secret = process.env.VENDOR_SESSION_SECRET;
  if (!secret) throw new Error("VENDOR_SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signVendorSession(vendorId: string): Promise<string> {
  return new SignJWT({ vendor_id: vendorId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyVendorSession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.vendor_id === "string" ? payload.vendor_id : null;
  } catch {
    return null;
  }
}

export const VENDOR_SESSION_COOKIE = COOKIE_NAME;
export const VENDOR_SESSION_MAX_AGE = SESSION_TTL_SECONDS;
