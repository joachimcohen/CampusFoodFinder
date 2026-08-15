"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { List, MapIcon, LocateFixed } from "lucide-react";
import type { ListingType, ListingWithRelations, Suburb } from "@/lib/types";
import { LISTING_TYPE_LABELS } from "@/lib/types";
import {
  comingUpSortKey,
  distanceKm,
  everyWeekSortKey,
  happeningNowSortKey,
  isComingUp,
  isEveryWeekInScope,
  isHappeningNow,
} from "@/lib/listings";
import { instanceConfig, pageTitle } from "@/lib/config";
import ListingCard from "./ListingCard";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const LISTING_TYPES = Object.keys(LISTING_TYPE_LABELS) as ListingType[];
const REFRESH_INTERVAL_MS = 60_000; // re-evaluate "happening now" every minute

export default function Feed({
  suburbs,
  initialListings,
}: {
  suburbs: Suburb[];
  initialListings: ListingWithRelations[];
}) {
  const [suburbSlug, setSuburbSlug] = useState<string>("all");
  const [listingType, setListingType] = useState<ListingType | "all">("all");
  const [view, setView] = useState<"list" | "map">("list");
  const [now, setNow] = useState(() => new Date());
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  function useMyLocation() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  }

  const filtered = useMemo(() => {
    const list = initialListings.filter((l) => {
      if (suburbSlug !== "all" && l.suburb.slug !== suburbSlug) return false;
      if (listingType !== "all" && l.listing_type !== listingType) return false;
      return true;
    });
    if (!userLocation) return list;
    return [...list].sort((a, b) => {
      if (a.lat === null || a.lng === null) return 1;
      if (b.lat === null || b.lng === null) return -1;
      return (
        distanceKm(userLocation, { lat: a.lat, lng: a.lng }) -
        distanceKm(userLocation, { lat: b.lat, lng: b.lng })
      );
    });
  }, [initialListings, suburbSlug, listingType, userLocation]);

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

  const everyWeek = useMemo(
    () =>
      filtered
        .filter((l) => isEveryWeekInScope(l, now))
        .sort((a, b) => everyWeekSortKey(a, now) - everyWeekSortKey(b, now)),
    [filtered, now]
  );

  const isEmpty = happeningNow.length === 0 && comingUp.length === 0 && everyWeek.length === 0;
  const mapListings = [...happeningNow, ...comingUp, ...everyWeek];

  return (
    <div className="min-h-dvh pb-12">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-header-bg)] text-[var(--color-on-header)]">
        <div className="mx-auto max-w-2xl px-4 pt-5 md:max-w-4xl xl:max-w-6xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight">{pageTitle()}</h1>
              <p className="mb-3 text-sm text-[var(--color-on-header)]/70">
                Free &amp; discounted food near you — right now.
              </p>
            </div>
            <div className="flex shrink-0 gap-1 rounded-lg bg-white/10 p-1">
              <button
                onClick={() => setView("list")}
                aria-label="List view"
                className={`min-h-9 cursor-pointer rounded-md px-2.5 transition-colors duration-200 ${
                  view === "list" ? "bg-[var(--color-primary)] text-white" : "text-white/70"
                }`}
              >
                <List size={18} />
              </button>
              <button
                onClick={() => setView("map")}
                aria-label="Map view"
                className={`min-h-9 cursor-pointer rounded-md px-2.5 transition-colors duration-200 ${
                  view === "map" ? "bg-[var(--color-primary)] text-white" : "text-white/70"
                }`}
              >
                <MapIcon size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-2xl overflow-x-auto px-4 pb-3 [mask-image:linear-gradient(to_right,black_92%,transparent)] md:max-w-4xl xl:max-w-6xl">
          <div className="flex w-max gap-2">
            <Chip active={suburbSlug === "all"} onClick={() => setSuburbSlug("all")}>
              All suburbs
            </Chip>
            {suburbs.map((s) => (
              <Chip key={s.id} active={suburbSlug === s.slug} onClick={() => setSuburbSlug(s.slug)}>
                {s.name}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mx-auto flex max-w-2xl items-center gap-2 overflow-x-auto px-4 pb-3 [mask-image:linear-gradient(to_right,black_92%,transparent)] md:max-w-4xl xl:max-w-6xl">
          <div className="flex w-max gap-2">
            <Chip active={listingType === "all"} onClick={() => setListingType("all")} variant="secondary">
              All types
            </Chip>
            {LISTING_TYPES.map((lt) => (
              <Chip key={lt} active={listingType === lt} onClick={() => setListingType(lt)} variant="secondary">
                {LISTING_TYPE_LABELS[lt]}
              </Chip>
            ))}
          </div>
          <button
            onClick={useMyLocation}
            disabled={locating}
            className={`ml-1 flex min-h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors duration-200 disabled:opacity-50 ${
              userLocation
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                : "border-white/30 text-white/80"
            }`}
          >
            <LocateFixed size={14} />
            {userLocation ? "Nearest first" : locating ? "Locating…" : "Sort by distance"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4 md:max-w-4xl xl:max-w-6xl">
        {isEmpty ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--color-border)] py-16 text-center">
            <p className="text-lg font-bold">No food on offer right now</p>
            <p className="text-sm text-[var(--color-foreground)]/60">Check back soon!</p>
          </div>
        ) : view === "map" ? (
          <MapView listings={mapListings} />
        ) : (
          <>
            {happeningNow.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-lg font-black">Happening Now</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {happeningNow.map((l) => (
                    <ListingCard key={l.id} listing={l} mode="happening-now" />
                  ))}
                </div>
              </section>
            )}

            {comingUp.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-lg font-black">Coming Up</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {comingUp.map((l) => (
                    <ListingCard key={l.id} listing={l} mode="coming-up" />
                  ))}
                </div>
              </section>
            )}

            {everyWeek.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-black">Every Week</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {everyWeek.map((l) => (
                    <ListingCard key={l.id} listing={l} mode="every-week" />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <p className="mt-10 text-center text-xs text-[var(--color-foreground)]/50">
          Some listings may run out before you arrive — organisations do their best to remove them as soon as
          they&apos;re gone.
        </p>
        <p className="mt-1 text-center text-xs text-[var(--color-foreground)]/50">
          No responsibility is taken for the quality of food or experience, and no vendor or organisation has
          our endorsement, approval, or assessment beyond the onboarding check described in our policies.
        </p>
        <p className="mt-3 text-center text-xs text-[var(--color-foreground)]/50">
          Brought to you by {instanceConfig.localityFullName}.
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
      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
      : "bg-white text-[var(--color-foreground)] border-white";

  return (
    <button
      onClick={onClick}
      className={`min-h-9 shrink-0 cursor-pointer rounded-full border px-4 text-sm font-semibold transition-colors duration-200 ${
        active ? activeClasses : "border-white/30 bg-transparent text-white/80"
      }`}
    >
      {children}
    </button>
  );
}
