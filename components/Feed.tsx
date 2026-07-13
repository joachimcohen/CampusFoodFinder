"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { Campus, FoodType, ListingWithRelations } from "@/lib/types";
import { FOOD_TYPE_LABELS } from "@/lib/types";
import {
  happeningNowSortKey,
  isHappeningNow,
  isRecurringInScope,
  weeklyRecurringSortKey,
} from "@/lib/listings";
import ListingCard from "./ListingCard";

const FOOD_TYPES = Object.keys(FOOD_TYPE_LABELS) as FoodType[];
const REFRESH_INTERVAL_MS = 60_000; // re-evaluate "happening now" every minute

export default function Feed({
  campuses,
  initialListings,
}: {
  campuses: Campus[];
  initialListings: ListingWithRelations[];
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

  const weeklyRecurring = useMemo(
    () =>
      filtered
        .filter((l) => isRecurringInScope(l, now))
        .sort((a, b) => weeklyRecurringSortKey(a, now) - weeklyRecurringSortKey(b, now)),
    [filtered, now]
  );

  const isEmpty = happeningNow.length === 0 && weeklyRecurring.length === 0;

  return (
    <div className="min-h-dvh pb-12">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-background)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-5 md:max-w-4xl xl:max-w-6xl">
          <Image
            src="/branding/logo-food-finder.jpg"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-xl object-cover"
            priority
          />
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--color-foreground)]">Campus Food Finder</h1>
            <p className="mb-3 text-sm text-[var(--color-foreground)]/60">
              Free, discounted &amp; special food on campus — right now.
            </p>
          </div>
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

        <p className="mt-10 text-center text-xs text-[var(--color-foreground)]/50">
          Please note some of the specials on this page may have sold out by the time you arrive,
          however every effort is made by vendors to remove the specials as soon as sold out!
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
