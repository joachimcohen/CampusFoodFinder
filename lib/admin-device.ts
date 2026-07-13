import "server-only";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "cff_admin_device";
const DEVICE_TRUST_SECONDS = 60 * 60 * 24 * 180; // 180 days

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_DEVICE_SECRET;
  if (!secret) throw new Error("ADMIN_DEVICE_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** Signs a long-lived "trusted device" token for an admin user, set as an HttpOnly cookie. */
export async function signAdminDeviceToken(userId: string): Promise<string> {
  return new SignJWT({ user_id: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DEVICE_TRUST_SECONDS}s`)
    .sign(getSecret());
}

/** Verifies a device token belongs to the given admin user. */
export async function verifyAdminDeviceToken(token: string, userId: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.user_id === userId;
  } catch {
    return false;
  }
}

export const ADMIN_DEVICE_COOKIE = COOKIE_NAME;
export const ADMIN_DEVICE_MAX_AGE = DEVICE_TRUST_SECONDS;
