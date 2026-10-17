"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, X } from "lucide-react";
import type { ListingWithRelations } from "@/lib/types";
import { eatWithinLabel, melbourneWeekStart } from "@/lib/listings";
import { getCardPhoto, getDeviceId, savePass, setCardPhoto, type SavedPass } from "@/lib/collect-client";
import { isValidStudentNumber } from "@/lib/student-number";
import FoodSafetyLabel from "./FoodSafetyLabel";

export type DialogMode = "view" | "queue" | "collect" | "pass";

export type GateAnswers = { labelVersion: number | null; studentNumber: string | null };

/**
 * One pop-up for every step of the flow:
 * - "view": re-read the label any time (no buttons but Close)
 * - "queue": label + tick (+ ID check) before joining the virtual queue
 * - "collect": label + tick (+ ID check) for walk-up food, then the pass
 * - "pass": the "show this screen" pass, reopened later
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
  /** Queue mode: joins the queue with the answers; resolves to an error message, or null on success. */
  onJoinQueue?: (answers: GateAnswers) => Promise<string | null>;
  onCollected?: (pass: SavedPass) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<DialogMode>(initialMode);
  const [pass, setPass] = useState<SavedPass | null>(initialPass);
  const [acknowledged, setAcknowledged] = useState(false);
  const [studentNumber, setStudentNumber] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(() => getCardPhoto(listing.id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const needsLabel = listing.food_safety_enabled;
  const needsId = listing.require_student_number;
  const gating = mode === "queue" || mode === "collect";
  const numberOk = !needsId || isValidStudentNumber(studentNumber);
  const photoOk = !needsId || mode === "queue" || !!photoUrl;
  const canSubmit = (!needsLabel || acknowledged) && numberOk && photoOk && !submitting;

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoUrl(setCardPhoto(listing.id, e.target.files?.[0] ?? null));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    const answers: GateAnswers = {
      labelVersion: needsLabel ? listing.food_label_version : null,
      studentNumber: needsId ? studentNumber.trim() : null,
    };

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
      ackCode: body.ackCode,
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
    mode === "pass" ? "Show this to staff" : mode === "view" ? listing.title : `Before you ${mode === "queue" ? "join" : "collect"}`;

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
          <CollectPass listing={listing} pass={pass} photoUrl={photoUrl} />
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

            {gating && needsId && (
              <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-3">
                <p className="text-sm font-semibold">Deakin student check</p>
                <label className="flex flex-col gap-1 text-sm">
                  Student number
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    value={studentNumber}
                    onChange={(e) => setStudentNumber(e.target.value.replace(/\s/g, ""))}
                    className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 text-base"
                  />
                </label>
                {studentNumber && !numberOk && (
                  <p className="text-xs text-[var(--color-destructive)]">That doesn&apos;t look like a Deakin student number.</p>
                )}
                {mode === "collect" && (
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-full border border-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary)]">
                      <Camera size={16} aria-hidden="true" />
                      {photoUrl ? "Retake card photo" : "Take a photo of your student card"}
                      <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="sr-only" />
                    </label>
                    {photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- local object URL, never a remote image
                      <img src={photoUrl} alt="Your student card" className="h-24 w-fit rounded-lg object-cover" />
                    )}
                  </div>
                )}
                <p className="text-xs text-[var(--color-foreground)]/70">
                  {mode === "collect"
                    ? "Your card photo stays on this phone only and disappears when you close this page. "
                    : ""}
                  Your student number is only checked, never stored
                  {listing.limit_one_per_week ? " (just a scrambled code until Monday, to apply the one-per-week limit)" : ""}.
                </p>
              </div>
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

/** The "show this screen" pass. A ticking clock makes an old screenshot easy for staff to spot. */
function CollectPass({
  listing,
  pass,
  photoUrl,
}: {
  listing: ListingWithRelations;
  pass: SavedPass;
  photoUrl: string | null;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = now.toLocaleTimeString("en-AU", { timeZone: "Australia/Melbourne", hour: "numeric", minute: "2-digit", second: "2-digit" });
  const at = new Date(pass.acknowledgedAt).toLocaleTimeString("en-AU", { timeZone: "Australia/Melbourne", hour: "numeric", minute: "2-digit" });
  const eatWithin = eatWithinLabel(listing.food_eat_within_hours);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,white)] p-6 text-center">
        <CheckCircle2 size={48} className="text-[var(--color-accent)]" aria-hidden="true" />
        <p className="text-lg font-extrabold">{listing.title}</p>
        <p className="font-mono text-4xl font-extrabold tracking-[0.2em]" aria-label={`Pass code ${pass.ackCode.split("").join(" ")}`}>
          {pass.ackCode}
        </p>
        <p className="text-sm font-semibold tabular-nums" aria-live="off">
          Live time {clock}
        </p>
        <p className="text-xs text-[var(--color-foreground)]/70">
          {listing.food_safety_enabled ? `Food safety label acknowledged at ${at}` : `Pass created at ${at}`}
        </p>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL, never a remote image
          <img src={photoUrl} alt="Student card photo" className="mt-2 max-h-40 w-full rounded-xl object-contain" />
        )}
      </div>
      {listing.food_safety_enabled && (
        <p className="text-sm">
          <strong>Remember:</strong>{" "}
          {[eatWithin, listing.food_reheat_instructions].filter(Boolean).join(". ") || "store it as the label says."}
        </p>
      )}
    </div>
  );
}
