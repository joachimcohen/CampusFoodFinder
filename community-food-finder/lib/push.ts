import "server-only";
import webpush from "web-push";

// PushSubscriptionJSON is a global ambient type from the "dom" lib.
let configured = false;

function ensureConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT; // e.g. "mailto:admin@example.org"
  if (!publicKey || !privateKey || !subject) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

/**
 * Free push notifications for called queue tickets (Section 6). Uses the
 * Web Push standard (browser vendors' own push services — no third-party
 * cost). Best-effort: a subscription that's expired or unreachable just
 * fails silently, since the live status page (Section 6's "zero-cost
 * fallback") still works for that person either way.
 */
export async function sendQueuePush(
  subscription: PushSubscriptionJSON,
  payload: { title: string; body: string; url: string }
): Promise<void> {
  if (!ensureConfigured()) return;
  try {
    await webpush.sendNotification(
      // web-push's types predate the DOM's PushSubscriptionJSON keys typing; the shape matches at runtime.
      subscription as unknown as webpush.PushSubscription,
      JSON.stringify(payload)
    );
  } catch (err) {
    console.error("push notification failed (non-fatal — live status page is the fallback)", err);
  }
}
