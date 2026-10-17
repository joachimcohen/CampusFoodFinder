import "server-only";
import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Listing } from "@/lib/types";
import { melbourneWeekStart, soldOutState } from "@/lib/listings";

type AdminClient = ReturnType<typeof createAdminClient>;

export type ClaimRequest = {
  deviceId: unknown;
  labelVersion: unknown;
};

type Fail = { error: string; status: number; code?: string };

const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

/** The phone's code is random and made up by the app, so hashing it just avoids storing it as-is. */
function hashDevice(deviceId: string): string {
  return createHash("sha256").update(`cff-device:${deviceId}`).digest("hex");
}

/**
 * Checks everything that must be true before a student can join a queue or
 * collect walk-up food: the listing is open, the label they ticked is the
 * current one, and (if limited) this phone hasn't already collected it this
 * week. Records the weekly claim when one applies, and returns its id so a
 * caller can undo it if a later step fails.
 *
 * No student data is involved: the student number is only ever checked on
 * the phone (see components/StudentGate.tsx).
 */
export async function checkAndClaim(
  supabase: AdminClient,
  listing: Listing,
  req: ClaimRequest
): Promise<Fail | { claimId: string | null }> {
  if (!listing.is_active || soldOutState(listing) !== "none") {
    return { error: "Sorry, this one has sold out.", status: 409, code: "sold_out" };
  }

  if (listing.food_safety_enabled && (req.labelVersion === null || req.labelVersion === undefined)) {
    return { error: "Please read and tick the food safety details first.", status: 409, code: "label_required" };
  }

  if (listing.food_safety_enabled && Number(req.labelVersion) !== listing.food_label_version) {
    return {
      error: "The food safety details have just been updated. Please read them again.",
      status: 409,
      code: "label_changed",
    };
  }

  if (!listing.limit_one_per_week) return { claimId: null };

  const deviceId = typeof req.deviceId === "string" && DEVICE_ID_PATTERN.test(req.deviceId) ? req.deviceId : null;
  if (!deviceId) {
    return { error: "We couldn't check this phone. Please refresh and try again.", status: 400 };
  }

  const { data, error } = await supabase
    .from("listing_claims")
    .insert({ listing_id: listing.id, week_start: melbourneWeekStart(), device_hash: hashDevice(deviceId) })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        error: "You've already collected this one this week. It resets on Monday.",
        status: 409,
        code: "already_claimed",
      };
    }
    console.error("listing claim insert failed", error);
    return { error: "Something went wrong. Please try again.", status: 500 };
  }

  return { claimId: data.id };
}

export async function undoClaim(supabase: AdminClient, claimId: string | null) {
  if (claimId) await supabase.from("listing_claims").delete().eq("id", claimId);
}

/** Records that the label was shown and ticked. Holds no device or student identifier. */
export async function recordAck(
  supabase: AdminClient,
  listing: Listing,
  queueEntryId: string | null = null
): Promise<{ acknowledgedAt: string } | null> {
  const { data, error } = await supabase
    .from("food_label_acks")
    .insert({ listing_id: listing.id, label_version: listing.food_label_version, queue_entry_id: queueEntryId })
    .select("acknowledged_at")
    .single();

  if (error) {
    console.error("food label ack insert failed", error);
    return null;
  }
  return { acknowledgedAt: data.acknowledged_at };
}
