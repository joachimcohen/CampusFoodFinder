"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminAlert, Campus, FoodType, ListingWithRelations } from "@/lib/types";
import { FOOD_TYPE_LABELS } from "@/lib/types";
import {
  comingUpSortKey,
  happeningNowSortKey,
  isComingUp,
  isHappeningNow,
  isRecurringInScope,
  weeklyRecurringSortKey,
} from "@/lib/listings";
import { subscribeToPush } from "@/lib/push-client";
import ListingCard from "./ListingCard";

const FOOD_TYPES = Object.keys(FOOD_TYPE_LABELS) as FoodType[];
const REFRESH_INTERVAL_MS = 60_000; // re-evaluate "happening now" every minute

const ALERT_STYLES: Record<AdminAlert["severity"], string> = {
  recall: "border-[var(--color-destructive)] bg-[var(--color-destructive)]/10 text-[var(--color-destructive)]",
  advisory: "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  general: "border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-foreground)]",
};

export default function Feed({
  campuses,
  initialListings,
  alerts,
}: {
  campuses: Campus[];
  initialListings: ListingWithRelations[];
  alerts: AdminAlert[];
}) {
  const [campusSlug, setCampusSlug] = useState<string>("all");
  const [foodType, setFoodType] = useState<FoodType | "all">("all");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    return initialListings.filter((l) => {
      if (campusSlug !== "all" && l.campus.slug !== campusSlug) return false;
      if (foodType !== "all" && l.food_type !== foodType) return false;
      return true;
    });
  }, [initialListings, campusSlug, foodType]);

  const happeningNow = useMemo(
    () =>
      filtered
        .filter((l) => isHappeningNow(l, now))
        .sort((a, b) => happeningNowSortKey(a, now) - happeningNowSortKey(b, now)),
    [filtered, now]
  );

  const comingUp = useMemo(
    () =>
      filtered
        .filter((l) => isComingUp(l, now))
        .sort((a, b) => comingUpSortKey(a, now) - comingUpSortKey(b, now)),
    [filtered, now]
  );

  const weeklyRecurring = useMemo(
    () =>
      filtered
        .filter((l) => isRecurringInScope(l, now))
        .sort((a, b) => weeklyRecurringSortKey(a, now) - weeklyRecurringSortKey(b, now)),
    [filtered, now]
  );

  const isEmpty = happeningNow.length === 0 && comingUp.length === 0 && weeklyRecurring.length === 0;
  const [notifStatus, setNotifStatus] = useState<"idle" | "requesting" | "enabled" | "unavailable">("idle");

  async function enableNotifications() {
    setNotifStatus("requesting");
    const subscriptionId = await subscribeToPush();
    setNotifStatus(subscriptionId ? "enabled" : "unavailable");
  }

  return (
    <div className="min-h-dvh pb-12">
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2 px-4 pt-3">
          {alerts.map((a) => (
            <div key={a.id} className={`mx-auto w-full max-w-2xl rounded-xl border px-4 py-2 text-sm md:max-w-4xl xl:max-w-6xl ${ALERT_STYLES[a.severity]}`}>
              <strong className="font-semibold">
                {a.severity === "recall" ? "Recall: " : a.severity === "advisory" ? "Advisory: " : ""}
              </strong>
              {a.message}
            </div>
          ))}
        </div>
      )}
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-background)]/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 pt-5 md:max-w-4xl xl:max-w-6xl">
          <h1 className="text-2xl font-extrabold text-[var(--color-foreground)]">Campus Food Finder</h1>
          <p className="mb-3 text-sm text-[var(--color-foreground)]/60">
            Free, discounted &amp; special food on campus — right now.
          </p>
        </div>

        <div className="mx-auto max-w-2xl overflow-x-auto px-4 pb-3 [mask-image:linear-gradient(to_right,black_92%,transparent)] md:max-w-4xl xl:max-w-6xl">
          <div className="flex w-max gap-2">
            <Chip active={campusSlug === "all"} onClick={() => setCampusSlug("all")}>
              All campuses
            </Chip>
            {campuses.map((c) => (
              <Chip key={c.id} active={campusSlug === c.slug} onClick={() => setCampusSlug(c.slug)}>
                {c.name}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-2xl overflow-x-auto px-4 pb-3 [mask-image:linear-gradient(to_right,black_92%,transparent)] md:max-w-4xl xl:max-w-6xl">
          <div className="flex w-max gap-2">
            <Chip active={foodType === "all"} onClick={() => setFoodType("all")} variant="secondary">
              All types
            </Chip>
            {FOOD_TYPES.map((ft) => (
              <Chip
                key={ft}
                active={foodType === ft}
                onClick={() => setFoodType(ft)}
                variant="secondary"
              >
                {FOOD_TYPE_LABELS[ft]}
              </Chip>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4 md:max-w-4xl xl:max-w-6xl">
        {isEmpty ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] py-16 text-center">
            <p className="text-lg font-semibold">No food on offer right now</p>
            <p className="text-sm text-[var(--color-foreground)]/60">Check back soon!</p>
          </div>
        ) : (
          <>
            {happeningNow.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-lg font-bold">Happening Now</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {happeningNow.map((l) => (
                    <ListingCard key={l.id} listing={l} mode="happening-now" />
                  ))}
                </div>
              </section>
            )}

            {comingUp.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-lg font-bold">Coming Up</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {comingUp.map((l) => (
                    <ListingCard key={l.id} listing={l} mode="coming-up" />
                  ))}
                </div>
              </section>
            )}

            {weeklyRecurring.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold">Weekly &amp; Recurring</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {weeklyRecurring.map((l) => (
                    <ListingCard key={l.id} listing={l} mode="weekly" />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <div className="mt-10 flex justify-center">
          {notifStatus === "enabled" ? (
            <p className="text-xs text-[var(--color-foreground)]/50">Notifications enabled — you&apos;ll hear about recalls and advisories.</p>
          ) : notifStatus === "unavailable" ? (
            <p className="text-xs text-[var(--color-foreground)]/50">
              Notifications aren&apos;t available in this browser — add this app to your Home Screen and try again.
            </p>
          ) : (
            <button
              onClick={enableNotifications}
              disabled={notifStatus === "requesting"}
              className="min-h-9 rounded-full border border-[var(--color-border)] px-3 text-xs font-medium text-[var(--color-foreground)]/70 disabled:opacity-50"
            >
              {notifStatus === "requesting" ? "Requesting…" : "Enable notifications for recalls & advisories"}
            </button>
          )}
        </div>

        <p className="mt-3 text-center text-xs text-[var(--color-foreground)]/50">
          Please note some of the specials on this page may have sold out by the time you arrive,
          however every effort is made by vendors to remove the specials as soon as sold out!
        </p>
        <p className="mt-1 text-center text-xs text-[var(--color-foreground)]/50">
          No responsibility is taken for the quality of food or experience, and no service has our
          endorsement nor received our approval or assessment.
        </p>

        <p className="mt-3 text-center text-xs text-[var(--color-foreground)]/50">
          Brought to you by the{" "}
          <a
            href="https://www.dusa.org.au/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--color-primary)]"
          >
            Deakin University Student Association
          </a>
          .
        </p>
      </main>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  variant = "primary",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const activeClasses =
    variant === "primary"
      ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]"
      : "bg-[var(--color-accent)] text-white border-[var(--color-accent)]";

  return (
    <button
      onClick={onClick}
      className={`min-h-11 shrink-0 cursor-pointer rounded-full border px-4 text-sm font-medium transition-colors duration-200 ${
        active ? activeClasses : "border-[var(--color-border)] bg-white text-[var(--color-foreground)]"
      }`}
    >
      {children}
    </button>
  );
}
