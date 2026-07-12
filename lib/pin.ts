import "server-only";
import bcrypt from "bcryptjs";
import { slugify } from "@/lib/slugify";

const BCRYPT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export function generatePin(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export { slugify, MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES };
