"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { ListingWithRelations } from "@/lib/types";
import { eatWithinLabel, melbourneWeekStart } from "@/lib/listings";
import { getDeviceId, savePass, type SavedPass } from "@/lib/collect-client";
import FoodSafetyLabel from "./FoodSafetyLabel";

export type DialogMode = "view" | "queue" | "collect" | "pass";

export type GateAnswers = { labelVersion: number | null };

const TZ = "Australia/Melbourne";

/**
 * One pop-up for every step of the flow:
 * - "view": re-read the label any time (no buttons but Close)
 * - "queue": label + tick before joining the virtual queue
 * - "collect": label + tick for walk-up food, then the pass
 * - "pass": the "show this to staff" pass, reopened later
 */
export default function FoodSafetyDialog({
  listing,
  mode: initialMode,
  initialPass = null,
  onClose,
  onJoinQueue,
  onCollected,
}: {
  listing: ListingWithRelations;
  mode: DialogMode;
  initialPass?: SavedPass | null;
  onClose: () => void;
  /** Queue mode: joins the queue; resolves to an error message, or null on success. */
  onJoinQueue?: (answers: GateAnswers) => Promise<string | null>;
  onCollected?: (pass: SavedPass) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<DialogMode>(initialMode);
  const [pass, setPass] = useState<SavedPass | null>(initialPass);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No close() in a cleanup: React's dev double-mount would fire the
    // dialog's close event and dismiss it straight away. Unmounting removes
    // the element, which ends the modal anyway.
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const needsLabel = listing.food_safety_enabled;
  const gating = mode === "queue" || mode === "collect";
  const canSubmit = (!needsLabel || acknowledged) && !submitting;

  async function submit() {
    setSubmitting(true);
    setError(null);
    const answers: GateAnswers = { labelVersion: needsLabel ? listing.food_label_version : null };

    if (mode === "queue" && onJoinQueue) {
      const joinError = await onJoinQueue(answers);
      setSubmitting(false);
      if (joinError) {
        setError(joinError);
        return;
      }
      onClose();
      return;
    }

    const res = await fetch(`/api/listings/${listing.id}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...answers, deviceId: getDeviceId() }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setSubmitting(false);
    if (!res || !res.ok) {
      setError(body.error ?? "Couldn't connect. Please check your internet and try again.");
      return;
    }
    const newPass: SavedPass = {
      acknowledgedAt: body.acknowledgedAt,
      labelVersion: body.labelVersion,
      weekStart: melbourneWeekStart(),
    };
    savePass(listing.id, newPass);
    setPass(newPass);
    setMode("pass");
    onCollected?.(newPass);
  }

  const title =
    mode === "pass"
      ? "Show this to staff"
      : mode === "view"
        ? listing.title
        : `Before you ${mode === "queue" ? "join" : "collect"}`;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={`fsd-title-${listing.id}`}
      className="m-auto max-h-[92dvh] w-[min(100vw-24px,440px)] overflow-y-auto rounded-3xl p-0 backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`fsd-title-${listing.id}`} className="text-xl font-extrabold leading-tight">
            {title}
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

        {mode === "pass" && pass ? (
          <CollectPass listing={listing} pass={pass} />
        ) : (
          <>
            {needsLabel && <FoodSafetyLabel listing={listing} vendorName={listing.vendor.name} />}

            {gating && needsLabel && (
              <label className="flex items-start gap-3 rounded-xl bg-[var(--color-muted)] p-3 text-sm">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
                />
                <span>I&apos;ve read how to store and reheat this food, and when to eat it by.</span>
              </label>
            )}

            {error && (
              <p role="alert" className="text-sm text-[var(--color-destructive)]">
                {error}
              </p>
            )}

            {gating ? (
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="min-h-12 rounded-xl bg-[var(--color-primary)] font-semibold text-[var(--color-on-primary)] disabled:opacity-40"
              >
                {submitting ? "Just a moment…" : mode === "queue" ? "Join queue" : "Get my pass"}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="min-h-12 rounded-xl border border-[var(--color-border)] font-semibold"
              >
                Close
              </button>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}

/**
 * The "show this to staff" pass: what's being collected, today's date and a
 * live clock ticking in seconds. An old date or a frozen clock gives away a
 * screenshot, with nothing for staff to scan or write down.
 */
function CollectPass({ listing, pass }: { listing: ListingWithRelations; pass: SavedPass }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const date = now.toLocaleDateString("en-AU", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const clock = now.toLocaleTimeString("en-AU", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  const openedAt = new Date(pass.acknowledgedAt).toLocaleTimeString("en-AU", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });
  const where = [listing.vendor.name, listing.pickup_location ?? listing.vendor.location, listing.campus.name]
    .filter(Boolean)
    .join(" · ");
  const eatWithin = eatWithinLabel(listing.food_eat_within_hours);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-[3px] border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,white)] p-6 text-center">
        <CheckCircle2 size={44} className="text-[var(--color-accent)]" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-foreground)]/80">Collecting</p>
        <p className="text-2xl font-extrabold leading-tight">{listing.title}</p>
        <p className="text-sm">{where}</p>
        <div className="my-1 w-full border-t border-[var(--color-accent)]/30" />
        <p className="text-xl font-bold">{date}</p>
        <div className="flex flex-col items-center">
          <span className="text-xs text-[var(--color-foreground)]/80">Live time</span>
          <span className="text-4xl font-extrabold tabular-nums" aria-live="off">
            {clock}
          </span>
        </div>
        <p className="text-xs text-[var(--color-foreground)]/80">
          Pass opened at {openedAt}
          {listing.food_safety_enabled ? " · Food safety label ticked" : ""}
        </p>
      </div>
      {listing.food_safety_enabled && (eatWithin || listing.food_reheat_instructions) && (
        <p className="text-sm">
          <strong>Remember:</strong> {[eatWithin, listing.food_reheat_instructions].filter(Boolean).join(". ")}
        </p>
      )}
      <p className="rounded-xl bg-[var(--color-muted)] p-3 text-xs leading-relaxed">
        For staff: check it&apos;s today&apos;s date, the right food, and the seconds are ticking.
      </p>
    </div>
  );
}
