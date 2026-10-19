"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type VoucherRow = { id: string; number: number; claimed_at: string; used_at: string | null };
type Tally = { total: number; claimed: number; used: number; thisWeek: number; vouchers: VoucherRow[] };

const POLL_MS = 10000;
const TZ = "Australia/Melbourne";

function time(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { timeZone: TZ, weekday: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * The vendor's voucher panel on a listing: claimed / left / used / this
 * week, a quick "find voucher #" box to tick one off at the counter, the
 * latest vouchers with Mark used / Undo, and "Add more vouchers".
 */
export default function VendorVoucherManager({ listingId, vendorSlug }: { listingId: string; vendorSlug: string }) {
  const [expanded, setExpanded] = useState(false);
  const [tally, setTally] = useState<Tally | null>(null);
  const [find, setFind] = useState("");
  const [newTotal, setNewTotal] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/vendor/vouchers/${listingId}`, { headers: { "x-vendor-slug": vendorSlug } });
    if (res.ok) setTally(await res.json());
  }, [listingId, vendorSlug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load, then refreshed on an interval
    void load();
    if (!expanded) return;
    pollRef.current = setInterval(load, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [expanded, load]);

  async function setUsed(v: VoucherRow, used: boolean) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/vendor/vouchers/entries/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-vendor-slug": vendorSlug },
      body: JSON.stringify({ used }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({
        text:
          body.code === "already_used"
            ? `Voucher #${v.number} was already used (${time(body.usedAt)}).`
            : body.error ?? "Could not update the voucher.",
        ok: false,
      });
    } else {
      setMessage({ text: used ? `Voucher #${v.number} marked used.` : `Voucher #${v.number} set back to unused.`, ok: true });
    }
    void load();
  }

  async function markByNumber(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/vendor/vouchers/${listingId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vendor-slug": vendorSlug },
      body: JSON.stringify({ number: Number(find) }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMessage({ text: `Voucher #${find} marked used.`, ok: true });
      setFind("");
    } else {
      setMessage({
        text: body.code === "already_used" && body.usedAt ? `${body.error} (${time(body.usedAt)})` : body.error,
        ok: false,
      });
    }
    void load();
  }

  async function addMore(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/vendor/listings/${listingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-vendor-slug": vendorSlug },
      body: JSON.stringify({ voucher_total: Number(newTotal) }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(res.ok ? { text: `Total is now ${newTotal} vouchers.`, ok: true } : { text: body.error, ok: false });
    if (res.ok) setNewTotal("");
    void load();
  }

  const left = tally ? Math.max(0, tally.total - tally.claimed) : 0;

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-[var(--color-border)] pt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-11 items-center justify-between gap-2 text-left text-sm font-semibold"
      >
        <span>
          Vouchers{tally ? `: ${tally.claimed} of ${tally.total} claimed · ${tally.used} used` : ""}
        </span>
        <span className="text-[var(--color-accent)]">{expanded ? "Hide" : "Manage"}</span>
      </button>

      {expanded && tally && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[
              ["Claimed", tally.claimed],
              ["Left", left],
              ["Used", tally.used],
              ["This week", tally.thisWeek],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-[var(--color-muted)] px-2 py-2">
                <div className="text-xl font-extrabold tabular-nums">{value}</div>
                <div className="text-xs text-[var(--color-foreground)]/70">{label}</div>
              </div>
            ))}
          </div>

          <form onSubmit={markByNumber} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
              Voucher number to mark used
              <input
                inputMode="numeric"
                value={find}
                onChange={(e) => setFind(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 87"
                className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
              />
            </label>
            <button
              type="submit"
              disabled={!find || busy}
              className="min-h-11 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-40"
            >
              Mark used
            </button>
          </form>

          {message && (
            <p role="status" className={`text-sm ${message.ok ? "text-[var(--color-accent)]" : "text-[var(--color-destructive)]"}`}>
              {message.text}
            </p>
          )}

          {tally.vouchers.length > 0 ? (
            <ul className="flex max-h-80 flex-col overflow-y-auto rounded-lg border border-[var(--color-border)]">
              {tally.vouchers.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-3 py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="font-bold tabular-nums">#{v.number}</p>
                    <p className="text-xs text-[var(--color-foreground)]/70">
                      Reserved {time(v.claimed_at)}
                      {v.used_at ? ` · Used ${time(v.used_at)}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setUsed(v, !v.used_at)}
                    className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium ${
                      v.used_at
                        ? "border border-[var(--color-border)]"
                        : "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    }`}
                  >
                    {v.used_at ? "Undo" : "Mark used"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-foreground)]/70">No vouchers claimed yet.</p>
          )}

          <form onSubmit={addMore} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
              Change total vouchers (now {tally.total})
              <input
                type="number"
                min={tally.claimed}
                value={newTotal}
                onChange={(e) => setNewTotal(e.target.value)}
                placeholder={`At least ${tally.claimed}`}
                className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
              />
            </label>
            <button
              type="submit"
              disabled={!newTotal || busy}
              className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 text-sm font-medium disabled:opacity-40"
            >
              Update total
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
