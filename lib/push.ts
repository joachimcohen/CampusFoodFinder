import "server-only";
import webpush from "web-push";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("VAPID keys are not set.");
  webpush.setVapidDetails("mailto:support@dusa.org.au", publicKey, privateKey);
  configured = true;
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Sends one push notification. Failures are logged and swallowed rather than
 * thrown — a single dead subscription (e.g. the student uninstalled the app)
 * should never break the batch-call or alert-broadcast it's part of. A
 * permanently-gone subscription (410/404) is deleted so it stops being
 * retried on every future send.
 */
export async function sendPush(
  supabase: AdminClient,
  subscription: PushSubscriptionRow,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    } else {
      console.error("push send failed", err);
    }
  }
}

/** Sends the same notification to every subscribed device — used for admin alert broadcasts. */
export async function broadcastPush(
  supabase: AdminClient,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  const { data: subscriptions } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (!subscriptions || subscriptions.length === 0) return;

  await Promise.all(subscriptions.map((sub) => sendPush(supabase, sub, payload)));
}
