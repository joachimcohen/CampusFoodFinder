import "server-only";
import { createHash, createHmac, randomInt } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Listing } from "@/lib/types";
import { melbourneWeekStart, soldOutState } from "@/lib/listings";
import { isValidStudentNumber } from "@/lib/student-number";

type AdminClient = ReturnType<typeof createAdminClient>;

export type ClaimRequest = {
  deviceId: unknown;
  studentNumber: unknown;
  labelVersion: unknown;
};

type Fail = { error: string; status: number; code?: string };

const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;
// No 0/O or 1/I/L, so staff can read it back without confusion.
const ACK_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateAckCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += ACK_ALPHABET[randomInt(ACK_ALPHABET.length)];
  return code;
}

/** The device code is already random, so a plain hash is enough to avoid storing it as-is. */
function hashDevice(deviceId: string): string {
  return createHash("sha256").update(`cff-device:${deviceId}`).digest("hex");
}

/**
 * Keyed hash (HMAC) so the stored value can't be reversed by trying every
 * possible student number, which a plain hash would allow. Without the
 * secret the database rows are meaningless.
 */
function hashStudentNumber(studentNumber: string): string | null {
  const secret = process.env.STUDENT_ID_HASH_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(studentNumber).digest("hex");
}

/**
 * Checks everything that must be true before a student can join a queue or
 * collect walk-up food: the listing is open, the label they saw is the
 * current one, a student number (if required) is valid, and they haven't
 * already collected this listing this week (if limited). Records the weekly
 * claim when one applies. Returns the claim row id so a caller can undo it
 * if a later step fails.
 */
export async function checkAndClaim(
  supabase: AdminClient,
  listing: Listing,
  req: ClaimRequest
): Promise<Fail | { claimId: string | null }> {
  if (!listing.is_active || soldOutState(listing) !== "none") {
    return { error: "Sorry, this one has sold out.", status: 409, code: "sold_out" };
  }

  if (listing.food_safety_enabled && Number(req.labelVersion) !== listing.food_label_version) {
    return {
      error: "The food safety details have just been updated. Please read them again.",
      status: 409,
      code: "label_changed",
    };
  }

  let studentHash: string | null = null;
  if (listing.require_student_number) {
    const raw = typeof req.studentNumber === "string" ? req.studentNumber.trim() : "";
    if (!isValidStudentNumber(raw)) {
      return { error: "Please enter a valid Deakin student number.", status: 400, code: "student_number" };
    }
    studentHash = hashStudentNumber(raw);
    if (!studentHash) {
      console.error("STUDENT_ID_HASH_SECRET is not set; refusing student-number listing");
      return { error: "Student number checks aren't set up yet. Please let the vendor know.", status: 500 };
    }
  }

  if (!listing.limit_one_per_week) return { claimId: null };

  const deviceId = typeof req.deviceId === "string" && DEVICE_ID_PATTERN.test(req.deviceId) ? req.deviceId : null;
  if (!deviceId && !studentHash) {
    return { error: "We couldn't check this device. Please refresh and try again.", status: 400 };
  }

  const { data, error } = await supabase
    .from("listing_claims")
    .insert({
      listing_id: listing.id,
      week_start: melbourneWeekStart(),
      // With a student number, limit by student (works across devices);
      // otherwise by device.
      student_hash: studentHash,
      device_hash: studentHash ? null : hashDevice(deviceId!),
    })
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

/** Records that the label was shown and acknowledged. Holds no device or student identifier. */
export async function recordAck(
  supabase: AdminClient,
  listing: Listing,
  queueEntryId: string | null = null
): Promise<{ ackCode: string; acknowledgedAt: string } | null> {
  const ackCode = generateAckCode();
  const { data, error } = await supabase
    .from("food_label_acks")
    .insert({
      listing_id: listing.id,
      label_version: listing.food_label_version,
      ack_code: ackCode,
      queue_entry_id: queueEntryId,
    })
    .select("acknowledged_at")
    .single();

  if (error) {
    console.error("food label ack insert failed", error);
    return null;
  }
  return { ackCode, acknowledgedAt: data.acknowledged_at };
}
