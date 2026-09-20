"use client";

import type { ListingWithRelations } from "@/lib/types";
import QueueTicketPanel from "./QueueTicketPanel";

/**
 * Standalone full-page queue view at /queue/[listingId] — kept for a
 * vendor's QR code or a directly shared link. The feed's own listing card
 * shows the same live ticket status inline (see ListingCard), so this page
 * is a secondary entry point, not the primary one.
 */
export default function QueueStatus({ listing }: { listing: ListingWithRelations }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-10 text-center">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--color-foreground)]">{listing.title}</h1>
        <p className="mt-1 text-sm text-[var(--color-foreground)]/60">
          {listing.vendor.name} · {listing.campus.name}
        </p>
      </div>

      <QueueTicketPanel listing={listing} />
    </main>
  );
}
