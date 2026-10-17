import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getMelbourneParts } from "@/lib/melbourne-time";
import { melbourneWeekStart } from "@/lib/listings";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * How long things are kept. Run daily by the cron (vercel.json). Every rule
 * only removes what is already past its date, so running it twice, or
 * missing a day, does no harm.
 */
export const RETENTION = {
  /** One-time listings, this many days after they ended. */
  endedListingDays: 30,
  /** Recurring listings, this many days after their "valid until" date. */
  expiredRecurringDays: 30,
  /** Deactivated listings nobody has touched for this many days. */
  inactiveListingDays: 180,
  /** Queue sessions (and their anonymous tickets), this many days after the day they ran. */
  queueSessionDays: 7,
  /** Food safety label ticks. */
  labelTickDays: 14,
  /** Uploaded photos no listing uses, once they're at least this old. */
  orphanPhotoHours: 24,
} as const;

const PHOTO_BUCKET = "listing-photos";
const DAY_MS = 86_400_000;

function melbourneDateDaysAgo(days: number): string {
  return getMelbourneParts(new Date(Date.now() - days * DAY_MS)).dateStr;
}

/** The path inside the photo bucket for a listing's public photo URL, or null if it isn't one of ours. */
export function photoPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${PHOTO_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  return path && !path.includes("..") ? path : null;
}

/** Removes a listing photo from storage. Best-effort: a failure is logged, never thrown. */
export async function removeListingPhoto(supabase: AdminClient, photoUrl: string | null) {
  const path = photoPathFromUrl(photoUrl);
  if (!path) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) console.error("photo removal failed", path, error.message);
}

async function deleteOldListings(supabase: AdminClient): Promise<{ count: number; photoUrls: (string | null)[] }> {
  const endedBefore = new Date(Date.now() - RETENTION.endedListingDays * DAY_MS).toISOString();
  const recurringBefore = melbourneDateDaysAgo(RETENTION.expiredRecurringDays);
  const inactiveBefore = new Date(Date.now() - RETENTION.inactiveListingDays * DAY_MS).toISOString();

  // Three simple queries rather than one complex filter: easier to read and check.
  const [ended, recurring, inactive] = await Promise.all([
    supabase.from("listings").select("id, photo_url").eq("schedule_type", "one_time").lt("expires_at", endedBefore),
    supabase
      .from("listings")
      .select("id, photo_url")
      .eq("schedule_type", "recurring")
      .lt("recurrence_valid_until", recurringBefore),
    supabase.from("listings").select("id, photo_url").eq("is_active", false).lt("updated_at", inactiveBefore),
  ]);
  for (const r of [ended, recurring, inactive]) if (r.error) throw new Error(r.error.message);

  const byId = new Map<string, string | null>();
  for (const row of [...ended.data!, ...recurring.data!, ...inactive.data!]) byId.set(row.id, row.photo_url);
  if (byId.size === 0) return { count: 0, photoUrls: [] };

  // Deleting a listing also deletes its queue sessions, tickets, label ticks
  // and weekly claims (the tables reference it with "on delete cascade").
  const { error } = await supabase.from("listings").delete().in("id", [...byId.keys()]);
  if (error) throw new Error(error.message);
  return { count: byId.size, photoUrls: [...byId.values()] };
}

/** Photos uploaded but never attached to a listing, or left behind by one that's gone. */
async function deleteOrphanPhotos(supabase: AdminClient): Promise<number> {
  const { data: rows, error } = await supabase.from("listings").select("photo_url").not("photo_url", "is", null);
  if (error) throw new Error(error.message);
  const inUse = new Set(rows.map((r) => photoPathFromUrl(r.photo_url)).filter(Boolean));
  // Safety stop: if any photo address can't be read, we can't tell which
  // photos are in use, so delete nothing rather than risk live photos.
  if (inUse.size < rows.length) throw new Error("unrecognised photo address; skipping orphan photo clean-up");

  const bucket = supabase.storage.from(PHOTO_BUCKET);
  const { data: folders, error: listError } = await bucket.list("", { limit: 1000 });
  if (listError) throw new Error(listError.message);

  const cutoff = Date.now() - RETENTION.orphanPhotoHours * 3_600_000;
  const toRemove: string[] = [];
  for (const folder of folders ?? []) {
    // Photos live at <vendor id>/<random>.jpg; a folder has no id of its own.
    if (folder.id) continue;
    const { data: files, error: filesError } = await bucket.list(folder.name, { limit: 1000 });
    if (filesError) throw new Error(filesError.message);
    for (const f of files ?? []) {
      const path = `${folder.name}/${f.name}`;
      const created = f.created_at ? new Date(f.created_at).getTime() : Date.now();
      if (!inUse.has(path) && created < cutoff) toRemove.push(path);
    }
  }

  if (toRemove.length > 0) {
    const { error: removeError } = await bucket.remove(toRemove);
    if (removeError) throw new Error(removeError.message);
  }
  return toRemove.length;
}

export type CleanupSummary = Record<string, number | string>;

/**
 * Runs every clean-up rule. Each rule runs on its own, so one failing (for
 * example storage being briefly unavailable) doesn't stop the rest. Returns
 * counts only, never any record contents.
 */
export async function runCleanup(supabase: AdminClient): Promise<CleanupSummary> {
  const summary: CleanupSummary = {};

  async function step(name: string, fn: () => Promise<number>) {
    try {
      summary[name] = await fn();
    } catch (e) {
      console.error(`clean-up step "${name}" failed`, e);
      summary[name] = "failed";
    }
  }

  await step("weeklyClaims", async () => {
    const { count, error } = await supabase
      .from("listing_claims")
      .delete({ count: "exact" })
      .lt("week_start", melbourneWeekStart());
    if (error) throw new Error(error.message);
    return count ?? 0;
  });

  await step("labelTicks", async () => {
    const { count, error } = await supabase
      .from("food_label_acks")
      .delete({ count: "exact" })
      .lt("acknowledged_at", new Date(Date.now() - RETENTION.labelTickDays * DAY_MS).toISOString());
    if (error) throw new Error(error.message);
    return count ?? 0;
  });

  await step("queueSessions", async () => {
    const { count, error } = await supabase
      .from("queue_sessions")
      .delete({ count: "exact" })
      .lt("date", melbourneDateDaysAgo(RETENTION.queueSessionDays));
    if (error) throw new Error(error.message);
    return count ?? 0;
  });

  let oldListingPhotos: (string | null)[] = [];
  await step("oldListings", async () => {
    const result = await deleteOldListings(supabase);
    oldListingPhotos = result.photoUrls;
    return result.count;
  });

  await step("oldListingPhotos", async () => {
    const paths = oldListingPhotos.map(photoPathFromUrl).filter((p): p is string => !!p);
    if (paths.length === 0) return 0;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
    if (error) throw new Error(error.message);
    return paths.length;
  });

  await step("orphanPhotos", () => deleteOrphanPhotos(supabase));

  return summary;
}
