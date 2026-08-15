import "server-only";
import bcrypt from "bcryptjs";
import { slugify } from "@/lib/slugify";

const BCRYPT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/** Generates a 6-digit access code — the same PIN-style pattern proven by Campus Food Finder's vendor auth (spec Section 5). */
export function generateAccessCode(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}

export function hashAccessCode(code: string): Promise<string> {
  return bcrypt.hash(code, BCRYPT_ROUNDS);
}

export function verifyAccessCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export { slugify, MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES };
