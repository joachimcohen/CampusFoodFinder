"use client";

import { use, useEffect, useState } from "react";
import type { DietaryTag, FoodType, Listing, ScheduleType, Weekday } from "@/lib/types";
import { DIETARY_TAGS, DIETARY_TAG_LABELS, FOOD_TYPE_LABELS, WEEKDAYS } from "@/lib/types";

type Props = { params: Promise<{ vendorSlug: string }> };

const FOOD_TYPES = Object.keys(FOOD_TYPE_LABELS) as FoodType[];

const emptyForm = {
  food_type: "daily_special" as FoodType,
  schedule_type: "one_time" as ScheduleType,
  title: "",
  description: "",
  pickup_location: "",
  price: "",
  starts_at: "",
  expires_at: "",
  recurrence_days: [] as Weekday[],
  recurrence_time_start: "",
  recurrence_time_end: "",
  recurrence_valid_until: "",
  dietary_tags: [] as DietaryTag[],
};

export default function VendorPage({ params }: Props) {
  const { vendorSlug } = use(params);
  const [status, setStatus] = useState<"checking" | "locked-out" | "needs-pin" | "authed">("checking");
  const [pin, setPin] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [listings, setListings] = useState<Listing[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadListings() {
    const res = await fetch("/api/vendor/listings", { headers: { "x-vendor-slug": vendorSlug } });
    if (res.status === 401) {
      setStatus("needs-pin");
      return;
    }
    const body = await res.json();
    setListings(body.listings ?? []);
    setStatus("authed");
  }

  useEffect(() => {
    // Initial auth-check + data fetch on mount; loadListings is also called
    // imperatively after each mutation below. vendorSlug (from the route
    // param) never changes for the life of this component, so it's safe to
    // omit from the dependency array here.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial bootstrap fetch, not a derived-state sync
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vendorSlug is a route param, never changes for this component's lifetime
  }, []);

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    const res = await fetch("/api/vendor/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: vendorSlug, pin }),
    });
    const body = await res.json();
    setLoggingIn(false);
    if (!res.ok) {
      setLoginError(body.error ?? "Something went wrong.");
      return;
    }
    setPin("");
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

  function toggleDietaryTag(tag: DietaryTag) {
    setForm((f) => ({
      ...f,
      dietary_tags: f.dietary_tags.includes(tag)
        ? f.dietary_tags.filter((t) => t !== tag)
        : [...f.dietary_tags, tag],
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
      const photoRes = await fetch("/api/vendor/photo", {
        method: "POST",
        headers: { "x-vendor-slug": vendorSlug },
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
      food_type: form.food_type,
      schedule_type: form.schedule_type,
      title: form.title,
      description: form.description || null,
      pickup_location: form.pickup_location || null,
      price: form.price === "" ? null : Math.round(Number(form.price) * 100) / 100,
      photo_url,
      starts_at: form.schedule_type === "one_time" ? new Date(form.starts_at).toISOString() : null,
      expires_at: form.schedule_type === "one_time" ? new Date(form.expires_at).toISOString() : null,
      recurrence_days: form.schedule_type === "recurring" ? form.recurrence_days : null,
      recurrence_time_start: form.schedule_type === "recurring" ? form.recurrence_time_start : null,
      recurrence_time_end: form.schedule_type === "recurring" ? form.recurrence_time_end : null,
      recurrence_valid_until:
        form.schedule_type === "recurring" && form.recurrence_valid_until ? form.recurrence_valid_until : null,
      dietary_tags: form.dietary_tags.length > 0 ? form.dietary_tags : null,
    };

    const res = await fetch("/api/vendor/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vendor-slug": vendorSlug },
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
    await fetch(`/api/vendor/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-vendor-slug": vendorSlug },
      body: JSON.stringify({ is_active }),
    });
    loadListings();
  }

  async function removeListing(id: string) {
    if (!confirm("Delete this listing permanently?")) return;
    await fetch(`/api/vendor/listings/${id}`, { method: "DELETE", headers: { "x-vendor-slug": vendorSlug } });
    loadListings();
  }

  if (status === "checking") {
    return <div className="p-8 text-center text-[var(--color-foreground)]/60">Loading…</div>;
  }

  if (status === "needs-pin") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold">Vendor Sign-In</h1>
          <p className="mt-1 text-sm text-[var(--color-foreground)]/60">
            Enter your 6-digit PIN to manage listings for <strong>{vendorSlug}</strong>.
          </p>
        </div>
        <form onSubmit={submitPin} className="flex flex-col gap-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter PIN"
            className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            autoFocus
          />
          {loginError && <p className="text-center text-sm text-[var(--color-destructive)]">{loginError}</p>}
          <button
            type="submit"
            disabled={loggingIn || pin.length < 4}
            className="min-h-11 rounded-xl bg-[var(--color-primary)] font-semibold text-[var(--color-on-primary)] disabled:opacity-50"
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
      <h1 className="text-2xl font-extrabold">Manage Listings</h1>
      <p className="text-sm text-[var(--color-foreground)]/60">Vendor: {vendorSlug}</p>

      <form onSubmit={submitListing} className="mt-6 flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
        <h2 className="font-bold">Add a new listing</h2>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Title
          <input
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
            placeholder="e.g. Leftover sandwiches"
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
            placeholder="e.g. Meet at the Student Union entrance — if you don't have a fixed spot"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Food type
            <select
              value={form.food_type}
              onChange={(e) => setForm((f) => ({ ...f, food_type: e.target.value as FoodType }))}
              className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
            >
              {FOOD_TYPES.map((ft) => (
                <option key={ft} value={ft}>
                  {FOOD_TYPE_LABELS[ft]}
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

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Dietary options (optional)</span>
          <div className="flex flex-wrap gap-2">
            {DIETARY_TAGS.map((tag) => (
              <button
                type="button"
                key={tag}
                onClick={() => toggleDietaryTag(tag)}
                className={`min-h-11 rounded-full border px-3 text-sm ${
                  form.dietary_tags.includes(tag)
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "border-[var(--color-border)] bg-white"
                }`}
              >
                {DIETARY_TAG_LABELS[tag]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4 text-sm font-medium">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={form.schedule_type === "one_time"}
              onChange={() => setForm((f) => ({ ...f, schedule_type: "one_time" }))}
            />
            One-time
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={form.schedule_type === "recurring"}
              onChange={() => setForm((f) => ({ ...f, schedule_type: "recurring" }))}
            />
            Recurring (weekly)
          </label>
        </div>

        {form.schedule_type === "one_time" ? (
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
                  className={`min-h-11 rounded-full border px-3 text-sm capitalize ${
                    form.recurrence_days.includes(day)
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
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
              Valid until (optional, e.g. end of semester)
              <input
                type="date"
                value={form.recurrence_valid_until}
                onChange={(e) => setForm((f) => ({ ...f, recurrence_valid_until: e.target.value }))}
                className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
              />
            </label>
          </div>
        )}

        {formError && <p className="text-sm text-[var(--color-destructive)]">{formError}</p>}

        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-xl bg-[var(--color-accent)] font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add listing"}
        </button>
      </form>

      <section className="mt-8">
        <h2 className="mb-2 font-bold">Active ({activeListings.length})</h2>
        <ListingRows listings={activeListings} onToggle={toggleActive} onDelete={removeListing} />
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-bold text-[var(--color-foreground)]/60">Inactive / expired ({inactiveListings.length})</h2>
        <ListingRows listings={inactiveListings} onToggle={toggleActive} onDelete={removeListing} />
      </section>
    </main>
  );
}

function ListingRows({
  listings,
  onToggle,
  onDelete,
}: {
  listings: Listing[];
  onToggle: (id: string, is_active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  if (listings.length === 0) {
    return <p className="text-sm text-[var(--color-foreground)]/50">Nothing here yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {listings.map((l) => (
        <li
          key={l.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3"
        >
          <div>
            <p className="font-semibold">{l.title}</p>
            <p className="text-xs text-[var(--color-foreground)]/60">{FOOD_TYPE_LABELS[l.food_type]}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onToggle(l.id, !l.is_active)}
              className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium"
            >
              {l.is_active ? "Deactivate" : "Reactivate"}
            </button>
            <button
              onClick={() => onDelete(l.id)}
              className="min-h-11 rounded-lg border border-[var(--color-destructive)] px-3 text-sm font-medium text-[var(--color-destructive)]"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
