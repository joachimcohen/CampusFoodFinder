"use client";

import type { ListingWithRelations, QueueEntryStatus } from "@/lib/types";
import { useQueueTicket } from "@/lib/use-queue-ticket";

const STATUS_COPY: Record<QueueEntryStatus, { heading: string; sub: string }> = {
  waiting: { heading: "You're in the queue", sub: "We'll let you know when it's your turn." },
  called: { heading: "You're up!", sub: "Come to the counter now and show this number." },
  expired: { heading: "Your window's closed", sub: "Please rejoin the queue if you'd still like to be served." },
  served: { heading: "You've been served", sub: "Thanks for using the virtual queue!" },
};

const COLOR_FOR: Record<QueueEntryStatus, string> = {
  waiting: "var(--color-foreground)",
  called: "var(--color-food-free-badge)",
  expired: "var(--color-destructive)",
  served: "var(--color-foreground)",
};

/**
 * The join-button / live-ticket-status view for one listing's queue. Used
 * both inline in a feed card (compact) and on the standalone /queue page
 * (full-size, for a vendor's QR code or a shared link) so the two never
 * drift apart.
 */
export default function QueueTicketPanel({
  listing,
  compact = false,
}: {
  listing: ListingWithRelations;
  compact?: boolean;
}) {
  const { ticket, status, ticketNumber, position, waitLabel, joining, error, join } = useQueueTicket(listing.id);

  if (!ticket) {
    return (
      <div className={compact ? "mt-1 flex flex-col items-start gap-1" : "flex flex-col gap-4"}>
        {!compact && (
          <p className="text-sm text-[var(--color-foreground)]/70">
            Join the queue remotely — no login, no scanning. We&apos;ll show your live position and turn green
            when it&apos;s your turn.
          </p>
        )}
        {error && <p className="text-xs text-[var(--color-destructive)]">{error}</p>}
        <button
          onClick={join}
          disabled={joining}
          className={
            compact
              ? "inline-flex min-h-8 w-fit items-center rounded-full bg-[var(--color-accent)] px-3 text-xs font-semibold text-white disabled:opacity-50"
              : "min-h-11 rounded-xl bg-[var(--color-primary)] font-semibold text-[var(--color-on-primary)] disabled:opacity-50"
          }
        >
          {joining ? "Joining…" : "Join queue"}
        </button>
      </div>
    );
  }

  if (status === null) {
    return <p className="mt-1 text-xs text-[var(--color-foreground)]/60">Loading your ticket…</p>;
  }

  // Compact: a couple of lines that read as part of the card's own metadata
  // (same type scale as the price/time-remaining text), not a separate
  // full-screen-style panel — only the ticket number, wait info and any
  // link stand out, via weight and status color.
  if (compact) {
    return (
      <div className="mt-1 flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5">
          {ticketNumber !== null && (
            <span className="text-base font-extrabold leading-none" style={{ color: COLOR_FOR[status] }}>
              #{ticketNumber}
            </span>
          )}
          <span className="text-xs font-bold" style={{ color: COLOR_FOR[status] }}>
            {STATUS_COPY[status].heading}
          </span>
        </div>

        {status === "waiting" ? (
          (position !== null || waitLabel) && (
            <p className="text-xs font-medium text-[var(--color-foreground)]/60">
              {position !== null && `#${position} in line`}
              {position !== null && waitLabel ? " · " : ""}
              {waitLabel}
            </p>
          )
        ) : (
          <p className="text-xs text-[var(--color-foreground)]/60">{STATUS_COPY[status].sub}</p>
        )}

        {status === "waiting" && listing.queue_waiting_message && (
          <QueueMessage text={listing.queue_waiting_message} url={listing.queue_waiting_message_url} />
        )}
        {status === "served" && listing.queue_served_message && (
          <QueueMessage text={listing.queue_served_message} url={listing.queue_served_message_url} />
        )}

        {status === "expired" && (
          <button
            onClick={join}
            disabled={joining}
            className="mt-1 inline-flex min-h-8 w-fit items-center rounded-full bg-[var(--color-accent)] px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            {joining ? "Rejoining…" : "Rejoin queue"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="mt-1 flex flex-col items-center gap-2 rounded-2xl border-2 p-8"
      style={{ borderColor: COLOR_FOR[status], backgroundColor: `color-mix(in srgb, ${COLOR_FOR[status]} 8%, white)` }}
    >
      {ticketNumber !== null && (
        <div className="mb-1 flex flex-col items-center">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-foreground)]/50">
            Ticket number
          </span>
          <span className="text-5xl font-extrabold" style={{ color: COLOR_FOR[status] }}>
            #{ticketNumber}
          </span>
        </div>
      )}

      <h2 className="text-xl font-extrabold" style={{ color: COLOR_FOR[status] }}>
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
          {listing.queue_waiting_message && (
            <QueueMessage text={listing.queue_waiting_message} url={listing.queue_waiting_message_url} />
          )}
        </div>
      )}

      {status === "served" && listing.queue_served_message && (
        <div className="mt-2 border-t border-[var(--color-border)] pt-3">
          <QueueMessage text={listing.queue_served_message} url={listing.queue_served_message_url} />
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
  );
}

/** A vendor's custom waiting/served message, rendered as a tappable link when they've set one — never an auto-redirect, so the student stays in control of when they leave this screen. */
function QueueMessage({ text, url }: { text: string; url: string | null }) {
  if (!url) return <p className="text-sm text-[var(--color-foreground)]/70">{text}</p>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-bold underline"
      style={{ color: "var(--color-accent)" }}
    >
      {text} →
    </a>
  );
}
