"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QueueStaffSnapshot } from "@/lib/types";

const POLL_INTERVAL_MS = 5000;

export default function VendorQueueManager({ listingId, vendorSlug }: { listingId: string; vendorSlug: string }) {
  const [expanded, setExpanded] = useState(false);
  const [snapshot, setSnapshot] = useState<QueueStaffSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callMoreSize, setCallMoreSize] = useState("");
  const [capacityInput, setCapacityInput] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/vendor/queue/${listingId}`, { headers: { "x-vendor-slug": vendorSlug } });
    if (!res.ok) return;
    const body: QueueStaffSnapshot = await res.json();
    setSnapshot(body);
    setCapacityInput(body.session.capacity_cap === null ? "" : String(body.session.capacity_cap));
  }, [listingId, vendorSlug]);

  useEffect(() => {
    if (!expanded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load on expand, then re-polled on an interval below
    load();
    pollRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [expanded, load]);

  async function callBatch(size?: number) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/vendor/queue/${listingId}/call-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vendor-slug": vendorSlug },
      body: JSON.stringify(size ? { size } : {}),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not call the next batch.");
      return;
    }
    setSnapshot(body);
    setCallMoreSize("");
  }

  async function markServed(entryId: string) {
    await fetch(`/api/vendor/queue/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-vendor-slug": vendorSlug },
      body: JSON.stringify({ status: "served" }),
    });
    load();
  }

  async function updateCapacity() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/vendor/queue/${listingId}/capacity`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-vendor-slug": vendorSlug },
      body: JSON.stringify({ capacity_cap: capacityInput === "" ? null : Number(capacityInput) }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not update capacity.");
      return;
    }
    load();
  }

  async function closeQueue() {
    if (!confirm("Close today's queue? Students already waiting won't be able to check in again after this.")) {
      return;
    }
    await fetch(`/api/vendor/queue/${listingId}/close`, {
      method: "POST",
      headers: { "x-vendor-slug": vendorSlug },
    });
    load();
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--color-border)]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="min-h-11 w-full rounded-lg px-3 text-left text-sm font-medium text-[var(--color-accent)]"
      >
        {expanded ? "Hide queue" : "Manage queue"}
      </button>

      {expanded && snapshot && (
        <div className="flex flex-col gap-4 border-t border-[var(--color-border)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <strong>{snapshot.servedCount}</strong> served ·{" "}
              <strong>{snapshot.waitingCount}</strong> waiting ·{" "}
              <strong>{snapshot.called.length}</strong> currently up
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                snapshot.session.status === "open"
                  ? "bg-[var(--color-muted)] text-[var(--color-accent)]"
                  : "bg-[var(--color-border)] text-[var(--color-foreground)]/60"
              }`}
            >
              {snapshot.session.status === "open" ? "Open" : "Closed"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => callBatch()}
              disabled={busy || snapshot.waitingCount === 0}
              className="min-h-11 rounded-lg bg-[var(--color-primary)] px-3 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-50"
            >
              Call next batch ({snapshot.session.batch_size})
            </button>
            <input
              type="number"
              min={1}
              placeholder="Call more…"
              value={callMoreSize}
              onChange={(e) => setCallMoreSize(e.target.value)}
              className="min-h-11 w-28 rounded-lg border border-[var(--color-border)] bg-white px-2 text-sm"
            />
            <button
              onClick={() => callBatch(callMoreSize ? Number(callMoreSize) : undefined)}
              disabled={busy || !callMoreSize || snapshot.waitingCount === 0}
              className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium disabled:opacity-50"
            >
              Call more
            </button>
            <button
              onClick={closeQueue}
              disabled={snapshot.session.status === "closed"}
              className="min-h-11 rounded-lg border border-[var(--color-destructive)] px-3 text-sm font-medium text-[var(--color-destructive)] disabled:opacity-50"
            >
              Close queue
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              Capacity cap:
              <input
                type="number"
                min={0}
                placeholder="No limit"
                value={capacityInput}
                onChange={(e) => setCapacityInput(e.target.value)}
                className="min-h-9 w-28 rounded-lg border border-[var(--color-border)] bg-white px-2"
              />
            </label>
            <button
              onClick={updateCapacity}
              disabled={busy}
              className="min-h-9 rounded-lg border border-[var(--color-border)] px-3 text-xs font-medium disabled:opacity-50"
            >
              Update
            </button>
          </div>

          {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}

          {snapshot.called.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-foreground)]/50">
                Currently called
              </p>
              <ul className="flex flex-col gap-1">
                {snapshot.called.map((entry, i) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg bg-[var(--color-muted)] px-3 py-2 text-sm"
                  >
                    <span>Ticket #{i + 1}</span>
                    <button
                      onClick={() => markServed(entry.id)}
                      className="min-h-8 rounded-lg bg-[var(--color-accent)] px-2 text-xs font-semibold text-white"
                    >
                      Mark served
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-[var(--color-foreground)]/50">
            {snapshot.waitingCount} student{snapshot.waitingCount === 1 ? "" : "s"} currently waiting
            {snapshot.session.capacity_cap !== null
              ? ` (capacity ${snapshot.servedCount + snapshot.waitingCount + snapshot.called.length}/${snapshot.session.capacity_cap})`
              : ""}
            .
          </p>
        </div>
      )}
    </div>
  );
}
