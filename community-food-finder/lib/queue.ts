import type { TicketStatus } from "@/lib/types";

/** Batch calling, ~8-10 at a time (Section 6). */
export const QUEUE_BATCH_SIZE = 10;

/** Called status expires after ~5 minutes to manage expectations (Section 6). */
export const QUEUE_CALL_EXPIRY_MINUTES = 5;

export interface QueueCallEvent {
  batch_size: number;
  called_at: string;
}

/**
 * Dynamic estimated wait time based on the actual calling rate observed so
 * far this queue run — not a fixed estimate (Section 6). Returns null when
 * there isn't enough history yet to estimate (shown as "Calculating..." in
 * the UI), or 0 once the ticket's position has already been called.
 */
export function estimateWaitMinutes(
  ticketPosition: number,
  lastCalledPosition: number,
  callHistory: QueueCallEvent[],
  now: Date = new Date()
): number | null {
  const peopleAhead = Math.max(0, ticketPosition - lastCalledPosition);
  if (peopleAhead === 0) return 0;
  if (callHistory.length === 0) return null;

  const firstCallMs = new Date(callHistory[0].called_at).getTime();
  const elapsedMinutes = (now.getTime() - firstCallMs) / 60000;
  const totalCalled = callHistory.reduce((sum, c) => sum + c.batch_size, 0);
  if (elapsedMinutes <= 0 || totalCalled === 0) return null;

  const ratePerMinute = totalCalled / elapsedMinutes;
  if (ratePerMinute <= 0) return null;
  return Math.max(1, Math.round(peopleAhead / ratePerMinute));
}

/** Lazy expiry check — no cron needed, just re-evaluated whenever a ticket's status is read. */
export function isTicketExpired(
  ticket: { status: TicketStatus; expires_at: string | null },
  now: Date = new Date()
): boolean {
  if (ticket.status !== "called" || !ticket.expires_at) return false;
  return new Date(ticket.expires_at).getTime() < now.getTime();
}

/** Simple visual status the public ticket page keys off (Section 6: "screen turns green when called"). */
export function ticketVisualStatus(status: TicketStatus): "waiting" | "called" | "done" {
  if (status === "called") return "called";
  if (status === "waiting") return "waiting";
  return "done"; // expired, served, or cancelled
}
