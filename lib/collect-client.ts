"use client";

/**
 * Browser-side helpers for the food safety / collection flow. Everything
 * here lives in this phone's localStorage only. Every access is wrapped in
 * try/catch because private browsing and some in-app browsers throw.
 */

const DEVICE_KEY = "cff_device_id";

/** A random code identifying this browser, used only for "one per week" limits. Not linked to the student. */
export function getDeviceId(): string | null {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export type SavedPass = {
  acknowledgedAt: string;
  labelVersion: number | null;
  weekStart: string;
};

function passKey(listingId: string) {
  return `cff_pass_${listingId}`;
}

export function loadPass(listingId: string): SavedPass | null {
  try {
    const raw = localStorage.getItem(passKey(listingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.acknowledgedAt === "string" ? (parsed as SavedPass) : null;
  } catch {
    return null;
  }
}

export function savePass(listingId: string, pass: SavedPass) {
  try {
    localStorage.setItem(passKey(listingId), JSON.stringify(pass));
  } catch {
    // Not fatal: the pass still shows for this visit.
  }
}
