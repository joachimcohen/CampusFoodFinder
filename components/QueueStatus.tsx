"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ListingWithRelations, QueueEntryStatus } from "@/lib/types";
import { subscribeToPush } from "@/lib/push-client";

type Ticket = { ticketId: string; token: string };

const POLL_INTERVAL_MS = 5000;

function storageKey(listingId: string): string {
  return `cff_queue_ticket_${listingId}`;
}

function loadTicket(listingId: string): Ticket | null {
  try {
    const raw = localStorage.getItem(storageKey(listingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.ticketId === "string" && typeof parsed?.token === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveTicket(listingId: string, ticket: Ticket) {
  localStorage.setItem(storageKey(listingId), JSON.stringify(ticket));
}

const STATUS_COPY: Record<QueueEntryStatus, { heading: string; sub: string }> = {
  waiting: { heading: "You're in the queue", sub: "We'll let you know when it's your turn." },
  called: { heading: "You're up!", sub: "Come to the counter now and show this number." },
  expired: { heading: "Your window's closed", sub: "Please rejoin the queue if you'd still like to be served." },
  served: { heading: "You've been served", sub: "Thanks for using the virtual queue!" },
};

export default function QueueStatus({ listing }: { listing: ListingWithRelations }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [status, setStatus] = useState<QueueEntryStatus | null>(null);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [waitLabel, setWaitLabel] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async (current: Ticket) => {
    const res = await fetch(`/api/queue/ticket/${current.ticketId}`, {
      headers: { "x-queue-token": current.token },
    });
    if (res.status === 404) {
      // Ticket no longer exists (e.g. session ended) — treat as needing to rejoin.
      localStorage.removeItem(storageKey(listing.id));
      setTicket(null);
      setStatus(null);
      return;
    }
    if (!res.ok) return;
    const body = await res.json();
    setStatus(body.status);
    setTicketNumber(body.ticketNumber);
    setPosition(body.position);
    setWaitLabel(body.waitMinutesLabel);
  }, [listing.id]);

  useEffect(() => {
    const existing = loadTicket(listing.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage read on mount, not a derived-state sync
    if (existing) setTicket(existing);
  }, [listing.id]);

  useEffect(() => {
    if (!ticket) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial poll on ticket change, then re-polled on an interval below
    poll(ticket);
    pollRef.current = setInterval(() => poll(ticket), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [ticket, poll]);

  async function join() {
    setJoining(true);
    setError(null);
    // Best-effort — if permission is denied or push isn't supported, this
    // resolves to null and the student still joins normally, falling back
    // to the on-page polling to see their status update.
    const pushSubscriptionId = await subscribeToPush();
    const res = await fetch("/api/queue/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: listing.id, pushSubscriptionId }),
    });
    const body = await res.json();
    setJoining(false);
    if (!res.ok) {
      setError(body.error ?? "Could not join the queue. Please try again.");
      return;
    }
    const newTicket = { ticketId: body.ticketId, token: body.token };
    saveTicket(listing.id, newTicket);
    setStatus(null);
    setTicketNumber(null);
    setPosition(null);
    setWaitLabel(null);
    setTicket(newTicket);
  }

  const colorFor: Record<QueueEntryStatus, string> = {
    waiting: "var(--color-foreground)",
    called: "var(--color-food-free-badge)",
    expired: "var(--color-destructive)",
    served: "var(--color-foreground)",
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-10 text-center">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--color-foreground)]">{listing.title}</h1>
        <p className="mt-1 text-sm text-[var(--color-foreground)]/60">
          {listing.vendor.name} · {listing.campus.name}
        </p>
      </div>

      {!ticket ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-foreground)]/70">
            Join the queue remotely — no login, no scanning. We&apos;ll show your live position and turn green
            when it&apos;s your turn.
          </p>
          {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
          <button
            onClick={join}
            disabled={joining}
            className="min-h-11 rounded-xl bg-[var(--color-primary)] font-semibold text-[var(--color-on-primary)] disabled:opacity-50"
          >
            {joining ? "Joining…" : "Join queue"}
          </button>
        </div>
      ) : status === null ? (
        <p className="text-sm text-[var(--color-foreground)]/60">Loading your ticket…</p>
      ) : (
        <div
          className="flex flex-col items-center gap-2 rounded-2xl border-2 p-8"
          style={{ borderColor: colorFor[status], backgroundColor: `color-mix(in srgb, ${colorFor[status]} 8%, white)` }}
        >
          {ticketNumber !== null && (
            <div className="mb-1 flex flex-col items-center">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-foreground)]/50">
                Ticket number
              </span>
              <span className="text-5xl font-extrabold" style={{ color: colorFor[status] }}>
                #{ticketNumber}
              </span>
            </div>
          )}

          <h2 className="text-xl font-extrabold" style={{ color: colorFor[status] }}>
            {STATUS_COPY[status].heading}
          </h2>
          <p className="text-sm text-[var(--color-foreground)]/70">{STATUS_COPY[status].sub}</p>

          {status === "waiting" && (
            <div className="mt-2 flex flex-col items-center gap-1 border-t border-[var(--color-border)] pt-3">
              {position !== null && (
                <p className="text-sm text-[var(--color-foreground)]/70">
                  You&apos;re <strong>#{position}</strong> in line
                </p>
              )}
              <p className="text-sm text-[var(--color-foreground)]/60">{waitLabel}</p>
            </div>
          )}

          {status === "expired" && (
            <button
              onClick={join}
              disabled={joining}
              className="mt-3 min-h-11 rounded-xl bg-[var(--color-primary)] font-semibold text-[var(--color-on-primary)] disabled:opacity-50"
            >
              {joining ? "Rejoining…" : "Rejoin queue"}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
