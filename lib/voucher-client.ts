"use client";

/**
 * A student's voucher for one listing, kept in this device's browser only.
 * The token proves the voucher is theirs; nothing identifies the student.
 * Every access is wrapped in try/catch for private browsing.
 */
export type SavedVoucher = {
  voucherId: string;
  token: string;
  number: number;
  total: number;
  claimedAt: string;
  usedAt: string | null;
};

function key(listingId: string) {
  return `cff_voucher_${listingId}`;
}

export function loadVoucher(listingId: string): SavedVoucher | null {
  try {
    const raw = localStorage.getItem(key(listingId));
    if (!raw) return null;
    const v = JSON.parse(raw);
    return typeof v?.voucherId === "string" && typeof v?.token === "string" ? (v as SavedVoucher) : null;
  } catch {
    return null;
  }
}

export function saveVoucher(listingId: string, voucher: SavedVoucher) {
  try {
    localStorage.setItem(key(listingId), JSON.stringify(voucher));
  } catch {
    // Private browsing: the voucher still shows for this visit.
  }
}
