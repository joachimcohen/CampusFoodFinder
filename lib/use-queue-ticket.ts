"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QueueEntryStatus } from "@/lib/types";
import { subscribeToPush } from "@/lib/push-client";
import { getDeviceId } from "@/lib/collect-client";

export type Ticket = { ticketId: string; token: string };

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
  try {
    localStorage.setItem(storageKey(listingId), JSON.stringify(ticket));
  } catch {
    // Private browsing: the ticket still works until the page is closed.
  }
}

/**
 * Tracks one student's ticket for one listing's queue, keyed by listingId in
 * localStorage. Every caller (a feed card, the standalone /queue page) gets
 * its own independent instance, so a student can hold tickets in several
 * listings' queues at once with no shared or global "active ticket" state.
 */
export function useQueueTicket(listingId: string) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [status, setStatus] = useState<QueueEntryStatus | null>(null);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [waitLabel, setWaitLabel] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(
    async (current: Ticket) => {
      const res = await fetch(`/api/queue/ticket/${current.ticketId}`, {
        headers: { "x-queue-token": current.token },
      });
      if (res.status === 404) {
        // Ticket no longer exists (e.g. session ended) — treat as needing to rejoin.
        localStorage.removeItem(storageKey(listingId));
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
    },
    [listingId]
  );

  useEffect(() => {
    const existing = loadTicket(listingId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage read on mount, not a derived-state sync
    if (existing) setTicket(existing);
  }, [listingId]);

  useEffect(() => {
    if (!ticket) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial poll on ticket change, then re-polled on an interval below
    poll(ticket);
    pollRef.current = setInterval(() => poll(ticket), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [ticket, poll]);

  /**
   * Joins the queue. `answers` carries the acknowledged label version when
   * the listing has a food safety label. Resolves to an error
   * message, or null on success, so the food safety pop-up can show it.
   */
  const join = useCallback(
    async (answers?: { labelVersion: number | null }): Promise<string | null> => {
      setJoining(true);
      setError(null);
      // Best-effort — if permission is denied or push isn't supported, this
      // resolves to null and the student still joins normally, falling back
      // to the on-page polling to see their status update.
      const pushSubscriptionId = await subscribeToPush();
      const res = await fetch("/api/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          pushSubscriptionId,
          deviceId: getDeviceId(),
          labelVersion: answers?.labelVersion ?? null,
        }),
      }).catch(() => null);
      const body = res ? await res.json().catch(() => ({})) : {};
      setJoining(false);
      if (!res || !res.ok) {
        const message = body.error ?? "Could not join the queue. Please try again.";
        setError(message);
        return message;
      }
      const newTicket = { ticketId: body.ticketId, token: body.token };
      saveTicket(listingId, newTicket);
      setStatus(null);
      setTicketNumber(null);
      setPosition(null);
      setWaitLabel(null);
      setTicket(newTicket);
      return null;
    },
    [listingId]
  );

  return { ticket, status, ticketNumber, position, waitLabel, joining, error, join };
}
