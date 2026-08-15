"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import type { QueueTicket } from "@/lib/types";
import { QUEUE_CALL_EXPIRY_MINUTES, ticketVisualStatus } from "@/lib/queue";
import { instanceConfig } from "@/lib/config";

type Props = { params: Promise<{ listingId: string }> };

const POLL_INTERVAL_MS = 5000;
const TICKET_STORAGE_PREFIX = "cofi_queue_ticket_";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export default function QueueTicketPage({ params }: Props) {
  const { listingId } = use(params);
  const storageKey = `${TICKET_STORAGE_PREFIX}${listingId}`;

  const [ticket, setTicket] = useState<QueueTicket | null>(null);
  const [peopleAhead, setPeopleAhead] = useState<number | null>(null);
  const [estimatedWaitMinutes, setEstimatedWaitMinutes] = useState<number | null>(null);
  const [queueOpen, setQueueOpen] = useState(true);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [notifState, setNotifState] = useState<"idle" | "asking" | "on" | "unsupported">("idle");
  const joiningRef = useRef(false);

  const poll = useCallback(
    async (ticketId: string) => {
      const res = await fetch(`/api/queue/${listingId}/ticket/${ticketId}`);
      if (!res.ok) {
        setError("This ticket could not be found.");
        setStatus("error");
        return;
      }
      const body = await res.json();
      setTicket(body.ticket);
      setPeopleAhead(body.peopleAhead);
      setEstimatedWaitMinutes(body.estimatedWaitMinutes);
      setQueueOpen(body.queueOpen);
      setStatus("ready");
    },
    [listingId]
  );

  useEffect(() => {
    const existingTicketId = localStorage.getItem(storageKey);

    async function bootstrap() {
      if (existingTicketId) {
        await poll(existingTicketId);
        return;
      }
      if (joiningRef.current) return;
      joiningRef.current = true;
      const res = await fetch(`/api/queue/${listingId}/join`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not join the queue.");
        setStatus("error");
        return;
      }
      localStorage.setItem(storageKey, body.ticket.id);
      await poll(body.ticket.id);
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per listingId, which never changes for this component's lifetime
  }, []);

  useEffect(() => {
    if (!ticket || ticket.status === "served" || ticket.status === "cancelled") return;
    const id = setInterval(() => poll(ticket.id), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [ticket, poll]);

  async function enableNotifications() {
    if (!ticket) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotifState("unsupported");
      return;
    }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      setNotifState("unsupported");
      return;
    }
    setNotifState("asking");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await fetch(`/api/queue/${listingId}/ticket/${ticket.id}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      setNotifState("on");
    } catch {
      setNotifState("unsupported");
    }
  }

  if (status === "loading") {
    return <Centered>Getting your place in the queue…</Centered>;
  }

  if (status === "error" || !ticket) {
    return <Centered>{error ?? "Something went wrong."}</Centered>;
  }

  const visual = ticketVisualStatus(ticket.status);
  const bg =
    visual === "called"
      ? "bg-[var(--color-status-called)]"
      : visual === "done"
        ? "bg-[var(--color-status-done)]"
        : "bg-[var(--color-status-waiting)]";

  return (
    <main className={`flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12 text-center text-white transition-colors duration-500 ${bg}`}>
      <p className="text-sm font-semibold uppercase tracking-widest text-white/70">{instanceConfig.productName}</p>

      {visual === "called" ? (
        <>
          <CheckCircle2 size={64} strokeWidth={1.5} />
          <h1 className="text-3xl font-black">You&apos;re up!</h1>
          <p className="max-w-xs text-white/90">
            Head over now — this call expires in about {QUEUE_CALL_EXPIRY_MINUTES} minutes.
          </p>
        </>
      ) : visual === "waiting" ? (
        <>
          <p className="text-sm text-white/70">Your position</p>
          <p className="text-7xl font-black tabular-nums">{ticket.position}</p>
          {!queueOpen ? (
            <p className="text-white/80">This organisation has paused the queue for now — hang tight.</p>
          ) : (
            <>
              {peopleAhead !== null && (
                <p className="text-white/80">
                  {peopleAhead === 0 ? "You're next!" : `${peopleAhead} ${peopleAhead === 1 ? "person" : "people"} ahead of you`}
                </p>
              )}
              <p className="text-sm text-white/60">
                {estimatedWaitMinutes === null
                  ? "Estimated wait: calculating…"
                  : estimatedWaitMinutes === 0
                    ? "Estimated wait: any moment now"
                    : `Estimated wait: ~${estimatedWaitMinutes} min`}
              </p>
            </>
          )}
          {notifState !== "on" ? (
            <button
              onClick={enableNotifications}
              disabled={notifState === "asking"}
              className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/40 px-4 text-sm font-semibold disabled:opacity-50"
            >
              <Bell size={16} /> {notifState === "unsupported" ? "Keep this page open for updates" : "Notify me when it's my turn"}
            </button>
          ) : (
            <p className="flex items-center gap-2 text-sm text-white/80">
              <Bell size={14} /> Notifications on — we&apos;ll ping you when it&apos;s your turn
            </p>
          )}
        </>
      ) : (
        <>
          <h1 className="text-2xl font-black">
            {ticket.status === "expired" ? "Your call window has passed" : "Ticket closed"}
          </h1>
          <p className="max-w-xs text-white/80">
            {ticket.status === "expired"
              ? "If you're still here, let staff know — they can call the next batch."
              : "Thanks for stopping by!"}
          </p>
        </>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center text-[var(--color-foreground)]">
      {children}
    </main>
  );
}
