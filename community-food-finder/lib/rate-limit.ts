import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Postgres-backed sliding-window rate limiter (Section 8: "rate limiting on
 * write endpoints given there's no pre-approval gate"). Serverless functions
 * can't share in-memory state across invocations, so `rate_limit_events` is
 * the shared counter. `api/cron/keep-alive` prunes rows older than a day.
 *
 * Returns true if the request is allowed (and records it), false if the
 * caller has exceeded `limit` events for `key` within `windowSeconds`.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error } = await supabase
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("key", key)
    .gte("created_at", windowStart);

  if (error) {
    // Fail open — a broken rate-limit check shouldn't take down writes.
    console.error("rate limit check failed", error);
    return true;
  }

  if ((count ?? 0) >= limit) return false;

  await supabase.from("rate_limit_events").insert({ key });
  return true;
}

/** Best-effort client identifier for rate-limit keys — no auth on these endpoints to key by instead. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}
