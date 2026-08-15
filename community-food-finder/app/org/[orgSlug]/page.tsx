"use client";

import { use, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Listing, ListingType, Weekday } from "@/lib/types";
import { LISTING_TYPE_LABELS, WEEKDAYS } from "@/lib/types";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), { ssr: false });

type Props = { params: Promise<{ orgSlug: string }> };

const LISTING_TYPES = Object.keys(LISTING_TYPE_LABELS) as ListingType[];

const emptyForm = {
  listing_type: "special_event" as ListingType,
  title: "",
  description: "",
  pickup_location: "",
  price: "",
  lat: null as number | null,
  lng: null as number | null,
  starts_at: "",
  expires_at: "",
  recurrence_days: [] as Weekday[],
  recurrence_time_start: "",
  recurrence_time_end: "",
  recurrence_valid_until: "",
  queue_enabled: false,
};

export default function OrgPage({ params }: Props) {
  const { orgSlug } = use(params);
  const [status, setStatus] = useState<"checking" | "locked-out" | "needs-code" | "authed">("checking");
  const [code, setCode] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [listings, setListings] = useState<Listing[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadListings() {
    const res = await fetch("/api/org/listings", { headers: { "x-org-slug": orgSlug } });
    if (res.status === 401) {
      setStatus("needs-code");
      return;
    }
    const body = await res.json();
    setListings(body.listings ?? []);
    setStatus("authed");
  }

  useEffect(() => {
    // Initial auth-check + data fetch on mount; loadListings is also called
    // imperatively after each mutation below. orgSlug never changes for the
    // life of this component.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial bootstrap fetch, not a derived-state sync
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- orgSlug is a route param, never changes for this component's lifetime
  }, []);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    const res = await fetch("/api/org/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: orgSlug, code }),
    });
    const body = await res.json();
    setLoggingIn(false);
    if (!res.ok) {
      setLoginError(body.error ?? "Something went wrong.");
      return;
    }
    setCode("");
    loadListings();
  }

  function toggleDay(day: Weekday) {
    setForm((f) => ({
      ...f,
      recurrence_days: f.recurrence_days.includes(day)
        ? f.recurrence_days.filter((d) => d !== day)
        : [...f.recurrence_days, day],
    }));
  }

  async function submitListing(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    let photo_url: string | null = null;
    if (photoFile) {
      const fd = new FormData();
      fd.append("file", photoFile);
      const photoRes = await fetch("/api/org/photo", {
        method: "POST",
        headers: { "x-org-slug": orgSlug },
        body: fd,
      });
      const photoBody = await photoRes.json();
      if (!photoRes.ok) {
        setSaving(false);
        setFormError(photoBody.error ?? "Photo upload failed.");
        return;
      }
      photo_url = photoBody.photo_url;
    }

    const payload = {
      listing_type: form.listing_type,
      title: form.title,
      description: form.description || null,
      pickup_location: form.pickup_location || null,
      price: form.price === "" ? null : Math.round(Number(form.price) * 100) / 100,
      photo_url,
      lat: form.lat,
      lng: form.lng,
      starts_at: form.listing_type === "special_event" ? new Date(form.starts_at).toISOString() : null,
      expires_at: form.listing_type === "special_event" ? new Date(form.expires_at).toISOString() : null,
      recurrence_days: form.listing_type === "every_week" ? form.recurrence_days : null,
      recurrence_time_start: form.listing_type === "every_week" ? form.recurrence_time_start : null,
      recurrence_time_end: form.listing_type === "every_week" ? form.recurrence_time_end : null,
      recurrence_valid_until:
        form.listing_type === "every_week" && form.recurrence_valid_until ? form.recurrence_valid_until : null,
      queue_enabled: form.queue_enabled,
    };

    const res = await fetch("/api/org/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-org-slug": orgSlug },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setFormError(body.error ?? "Could not save listing.");
      return;
    }
    setForm(emptyForm);
    setPhotoFile(null);
    loadListings();
  }

  async function toggleActive(id: string, is_active: boolean) {
    await fetch(`/api/org/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-org-slug": orgSlug },
      body: JSON.stringify({ is_active }),
    });
    loadListings();
  }

  async function removeListing(id: string) {
    if (!confirm("Delete this listing permanently?")) return;
    await fetch(`/api/org/listings/${id}`, { method: "DELETE", headers: { "x-org-slug": orgSlug } });
    loadListings();
  }

  if (status === "checking") {
    return <div className="p-8 text-center text-[var(--color-foreground)]/60">Loading…</div>;
  }

  if (status === "needs-code") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-black">Sign in</h1>
          <p className="mt-1 text-sm text-[var(--color-foreground)]/60">
            Enter the code your council admin gave you to manage listings for <strong>{orgSlug}</strong>.
          </p>
        </div>
        <form onSubmit={submitCode} className="flex flex-col gap-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter code"
            className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            autoFocus
          />
          {loginError && <p className="text-center text-sm text-[var(--color-destructive)]">{loginError}</p>}
          <button
            type="submit"
            disabled={loggingIn || code.length < 4}
            className="min-h-11 cursor-pointer rounded-xl bg-[var(--color-primary)] font-semibold text-white disabled:opacity-50"
          >
            {loggingIn ? "Checking…" : "Unlock"}
          </button>
        </form>
      </main>
    );
  }

  const activeListings = listings.filter((l) => l.is_active);
  const inactiveListings = listings.filter((l) => !l.is_active);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-black">Manage Listings</h1>
      <p className="text-sm text-[var(--color-foreground)]/60">Organisation: {orgSlug}</p>

      <form onSubmit={submitListing} className="mt-6 flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
        <h2 className="font-bold">Add a new listing</h2>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Title
          <input
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
            placeholder="e.g. Free fruit and veg giveaway"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Description (optional)
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
            rows={2}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Pickup location / instructions (optional)
          <textarea
            value={form.pickup_location}
            onChange={(e) => setForm((f) => ({ ...f, pickup_location: e.target.value }))}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2"
            rows={2}
            placeholder="e.g. Meet at the community centre side entrance"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Map location (optional — tap to set)</span>
          <LocationPicker lat={form.lat} lng={form.lng} onChange={(lat, lng) => setForm((f) => ({ ...f, lat, lng }))} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Listing type
            <select
              value={form.listing_type}
              onChange={(e) => setForm((f) => ({ ...f, listing_type: e.target.value as ListingType }))}
              className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
            >
              {LISTING_TYPES.map((lt) => (
                <option key={lt} value={lt}>
                  {LISTING_TYPE_LABELS[lt]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Price ($, blank = free)
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={form.price}
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d*\.?\d{0,2}$/.test(v)) {
                  setForm((f) => ({ ...f, price: v }));
                }
              }}
              className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Photo (optional)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {form.listing_type === "special_event" ? (
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Starts
              <input
                type="datetime-local"
                required
                value={form.starts_at}
                onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Ends
              <input
                type="datetime-local"
                required
                value={form.expires_at}
                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
              />
            </label>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`min-h-11 cursor-pointer rounded-full border px-3 text-sm capitalize ${
                    form.recurrence_days.includes(day)
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                      : "border-[var(--color-border)] bg-white"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Start time
                <input
                  type="time"
                  required
                  value={form.recurrence_time_start}
                  onChange={(e) => setForm((f) => ({ ...f, recurrence_time_start: e.target.value }))}
                  className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                End time
                <input
                  type="time"
                  required
                  value={form.recurrence_time_end}
                  onChange={(e) => setForm((f) => ({ ...f, recurrence_time_end: e.target.value }))}
                  className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Valid until (optional, e.g. end of program)
              <input
                type="date"
                value={form.recurrence_valid_until}
                onChange={(e) => setForm((f) => ({ ...f, recurrence_valid_until: e.target.value }))}
                className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
              />
            </label>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.queue_enabled}
            onChange={(e) => setForm((f) => ({ ...f, queue_enabled: e.target.checked }))}
          />
          Enable &quot;Secure your place&quot; virtual queue for this listing
        </label>

        {formError && <p className="text-sm text-[var(--color-destructive)]">{formError}</p>}

        <button
          type="submit"
          disabled={saving}
          className="min-h-11 cursor-pointer rounded-xl bg-[var(--color-primary)] font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add listing"}
        </button>
      </form>

      <section className="mt-8">
        <h2 className="mb-2 font-bold">Active ({activeListings.length})</h2>
        <ListingRows listings={activeListings} orgSlug={orgSlug} onToggle={toggleActive} onDelete={removeListing} />
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-bold text-[var(--color-foreground)]/60">Inactive / expired ({inactiveListings.length})</h2>
        <ListingRows listings={inactiveListings} orgSlug={orgSlug} onToggle={toggleActive} onDelete={removeListing} />
      </section>
    </main>
  );
}

function ListingRows({
  listings,
  orgSlug,
  onToggle,
  onDelete,
}: {
  listings: Listing[];
  orgSlug: string;
  onToggle: (id: string, is_active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  if (listings.length === 0) {
    return <p className="text-sm text-[var(--color-foreground)]/50">Nothing here yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {listings.map((l) => (
        <li key={l.id} className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{l.title}</p>
              <p className="text-xs text-[var(--color-foreground)]/60">{LISTING_TYPE_LABELS[l.listing_type]}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onToggle(l.id, !l.is_active)}
                className="min-h-11 cursor-pointer rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium"
              >
                {l.is_active ? "Deactivate" : "Reactivate"}
              </button>
              <button
                onClick={() => onDelete(l.id)}
                className="min-h-11 cursor-pointer rounded-lg border border-[var(--color-destructive)] px-3 text-sm font-medium text-[var(--color-destructive)]"
              >
                Delete
              </button>
            </div>
          </div>
          {l.queue_enabled && l.is_active && <QueuePanel listingId={l.id} orgSlug={orgSlug} />}
        </li>
      ))}
    </ul>
  );
}

function QueuePanel({ listingId, orgSlug }: { listingId: string; orgSlug: string }) {
  const [queueStatus, setQueueStatus] = useState<"closed" | "open">("closed");
  const [waitingCount, setWaitingCount] = useState(0);
  const [calledCount, setCalledCount] = useState(0);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/org/queue/status?listing_id=${listingId}`, {
      headers: { "x-org-slug": orgSlug },
    });
    if (!res.ok) return;
    const body = await res.json();
    setQueueStatus(body.queueStatus);
    setWaitingCount(body.waitingCount);
    setCalledCount(body.calledCount);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial bootstrap fetch, not a derived-state sync
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listingId/orgSlug never change for this component's lifetime
  }, []);

  async function call(path: string) {
    setBusy(true);
    await fetch(`/api/org/queue/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-org-slug": orgSlug },
      body: JSON.stringify({ listing_id: listingId }),
    });
    setBusy(false);
    refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--color-muted)] px-3 py-2 text-sm">
      <span className="font-semibold">
        Secure your place: {queueStatus === "open" ? "Open" : "Closed"}
      </span>
      <span className="text-[var(--color-foreground)]/60">
        {waitingCount} waiting · {calledCount} called
      </span>
      {queueStatus === "closed" ? (
        <button
          onClick={() => call("open")}
          disabled={busy}
          className="min-h-9 cursor-pointer rounded-lg bg-[var(--color-primary)] px-3 text-xs font-semibold text-white disabled:opacity-50"
        >
          Open queue
        </button>
      ) : (
        <>
          <button
            onClick={() => call("call-next")}
            disabled={busy}
            className="min-h-9 cursor-pointer rounded-lg bg-[var(--color-primary)] px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            Call next batch
          </button>
          <button
            onClick={() => call("close")}
            disabled={busy}
            className="min-h-9 cursor-pointer rounded-lg border border-[var(--color-border)] px-3 text-xs font-semibold disabled:opacity-50"
          >
            Close queue
          </button>
        </>
      )}
    </div>
  );
}
