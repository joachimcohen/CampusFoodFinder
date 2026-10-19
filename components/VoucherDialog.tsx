"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, X } from "lucide-react";
import type { ListingWithRelations } from "@/lib/types";
import { voucherDiscountLabel, vouchersLeft } from "@/lib/listings";
import { getDeviceId } from "@/lib/collect-client";
import { saveVoucher, type SavedVoucher } from "@/lib/voucher-client";
import FoodSafetyLabel from "./FoodSafetyLabel";

const TZ = "Australia/Melbourne";
const POLL_MS = 8000;

function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-AU", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

/**
 * The discount voucher pop-up:
 * - "reserve": what the voucher is, how many are left, then "Reserve my voucher"
 * - "voucher": the student's voucher to show at the counter. It checks back
 *   every few seconds so it switches to "Used" as soon as staff tick it off.
 */
export default function VoucherDialog({
  listing,
  initialVoucher,
  onClose,
  onChange,
}: {
  listing: ListingWithRelations;
  initialVoucher: SavedVoucher | null;
  onClose: () => void;
  onChange: (voucher: SavedVoucher) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [voucher, setVoucher] = useState<SavedVoucher | null>(initialVoucher);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // While the voucher is on screen and not yet used, check for the staff tick.
  useEffect(() => {
    if (!voucher || voucher.usedAt) return;
    const check = async () => {
      const res = await fetch(`/api/vouchers/${voucher.voucherId}`, {
        headers: { "x-voucher-token": voucher.token },
      }).catch(() => null);
      if (!res?.ok) return;
      const body = await res.json();
      if (body.usedAt) {
        const updated = { ...voucher, usedAt: body.usedAt as string };
        saveVoucher(listing.id, updated);
        setVoucher(updated);
        onChange(updated);
      }
    };
    void check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [voucher, listing.id, onChange]);

  const needsLabel = listing.food_safety_enabled;
  const discount = voucherDiscountLabel(listing);
  const where = [listing.vendor.name, listing.pickup_location ?? listing.vendor.location, listing.campus.name]
    .filter(Boolean)
    .join(" · ");
  const validUntil = listing.schedule_type === "one_time" ? shortDate(listing.expires_at) : null;

  async function reserve() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/listings/${listing.id}/voucher`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        labelVersion: needsLabel ? listing.food_label_version : null,
      }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setSubmitting(false);
    if (!res || !res.ok) {
      setError(body.error ?? "Couldn't connect. Please check your internet and try again.");
      return;
    }
    const saved: SavedVoucher = {
      voucherId: body.voucherId,
      token: body.token,
      number: body.number,
      total: body.total,
      claimedAt: body.claimedAt,
      usedAt: null,
    };
    saveVoucher(listing.id, saved);
    setVoucher(saved);
    onChange(saved);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={`vd-title-${listing.id}`}
      className="m-auto max-h-[92dvh] w-[min(100vw-24px,440px)] overflow-y-auto rounded-3xl p-0 backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`vd-title-${listing.id}`} className="text-xl font-extrabold leading-tight">
            {voucher ? (voucher.usedAt ? "Voucher used" : "Show this at the counter") : "Get this voucher?"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {voucher ? (
          <VoucherView listing={listing} voucher={voucher} discount={discount} where={where} validUntil={validUntil} />
        ) : (
          <>
            <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-[var(--color-food-voucher-badge)] bg-[color-mix(in_srgb,var(--color-food-voucher)_10%,white)] p-5 text-center">
              <p className="text-4xl font-extrabold text-[var(--color-food-voucher-badge)]">{discount}</p>
              <p className="font-semibold">{listing.voucher_conditions ?? listing.title}</p>
              <p className="text-sm text-[var(--color-foreground)]/80">{where}</p>
            </div>
            <dl className="flex flex-col gap-2 text-sm">
              {validUntil && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--color-foreground)]/70">Valid until</dt>
                  <dd className="font-semibold">{validUntil}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--color-foreground)]/70">Vouchers left</dt>
                <dd className="font-semibold">
                  {vouchersLeft(listing)} of {listing.voucher_total}
                </dd>
              </div>
              {listing.limit_one_per_week && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--color-foreground)]/70">Limit</dt>
                  <dd className="font-semibold">One per week (resets Monday)</dd>
                </div>
              )}
            </dl>

            {needsLabel && (
              <>
                <FoodSafetyLabel listing={listing} vendorName={listing.vendor.name} />
                <label className="flex items-start gap-3 rounded-xl bg-[var(--color-muted)] p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
                  />
                  <span>I&apos;ve read how to store and reheat this food, and when to eat it by.</span>
                </label>
              </>
            )}

            <p className="text-sm text-[var(--color-foreground)]/80">
              Your voucher is saved on this device. Each voucher can be used once. Show it at the counter when you
              buy.
            </p>

            {error && (
              <p role="alert" className="text-sm text-[var(--color-destructive)]">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={reserve}
              disabled={submitting || (needsLabel && !acknowledged)}
              className="min-h-12 rounded-xl bg-[var(--color-primary)] font-semibold text-[var(--color-on-primary)] disabled:opacity-40"
            >
              {submitting ? "Just a moment…" : "Reserve my voucher"}
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}

/** The voucher itself: discount, number, today's date and a live clock, or a clear "Used" state. */
function VoucherView({
  listing,
  voucher,
  discount,
  where,
  validUntil,
}: {
  listing: ListingWithRelations;
  voucher: SavedVoucher;
  discount: string;
  where: string;
  validUntil: string | null;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (voucher.usedAt) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [voucher.usedAt]);

  const used = !!voucher.usedAt;
  const date = now.toLocaleDateString("en-AU", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const clock = now.toLocaleTimeString("en-AU", { timeZone: TZ, hour: "numeric", minute: "2-digit", second: "2-digit" });

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`flex flex-col items-center gap-2 rounded-2xl border-[3px] p-5 text-center ${
          used
            ? "border-[var(--color-border)] bg-[var(--color-muted)]"
            : "border-[var(--color-food-voucher-badge)] bg-[color-mix(in_srgb,var(--color-food-voucher)_10%,white)]"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-foreground)]/80">Discount voucher</p>
        <p
          className={`text-5xl font-extrabold leading-none ${
            used ? "text-[var(--color-foreground)]/50 line-through" : "text-[var(--color-food-voucher-badge)]"
          }`}
        >
          {discount}
        </p>
        <p className="font-semibold">{listing.voucher_conditions ?? listing.title}</p>
        <p className="text-sm">{where}</p>
        <div className="my-1 w-full border-t border-dashed border-[var(--color-border)]" />
        <p className="text-xs text-[var(--color-foreground)]/80">Voucher number</p>
        <p className="text-3xl font-extrabold tabular-nums">
          #{voucher.number} <span className="text-base font-semibold text-[var(--color-foreground)]/70">of {voucher.total}</span>
        </p>
        {used ? (
          <p className="text-lg font-bold">
            <BadgeCheck size={20} aria-hidden="true" className="mr-1.5 inline-block align-[-3px]" />
            Used at {clockTime(voucher.usedAt!)}, {shortDate(voucher.usedAt)}
          </p>
        ) : (
          <>
            <p className="text-lg font-bold">{date}</p>
            <div className="flex flex-col items-center">
              <span className="text-xs text-[var(--color-foreground)]/80">Live time</span>
              <span className="text-3xl font-extrabold tabular-nums" aria-live="off">
                {clock}
              </span>
            </div>
            <p className="text-xs text-[var(--color-foreground)]/80">
              {validUntil ? `Valid until ${validUntil} · ` : ""}Reserved {clockTime(voucher.claimedAt)}
            </p>
          </>
        )}
      </div>

      {used
        ? listing.voucher_used_message && <p className="text-sm">{listing.voucher_used_message}</p>
        : listing.voucher_reserved_message && <p className="text-sm">{listing.voucher_reserved_message}</p>}

      {!used && (
        <p className="rounded-xl bg-[var(--color-muted)] p-3 text-xs leading-relaxed">
          For staff: check the date is today and the seconds are ticking, then mark voucher #{voucher.number} as used.
        </p>
      )}
    </div>
  );
}
