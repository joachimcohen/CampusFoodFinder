"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/slugify";
import type { Campus, Listing, PublicVendor } from "@/lib/types";
import { FOOD_TYPE_LABELS } from "@/lib/types";

type Tab = "campuses" | "vendors" | "listings";
type RevealedPin = { vendorName: string; pin: string };

export default function AdminDashboard({
  initialCampuses,
  initialVendors,
  initialListings,
}: {
  initialCampuses: Campus[];
  initialVendors: PublicVendor[];
  initialListings: Listing[];
}) {
  const [tab, setTab] = useState<Tab>("vendors");

  return (
    <div>
      <div className="mb-6 flex gap-2 border-b border-[var(--color-border)]">
        {(["campuses", "vendors", "listings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`min-h-11 border-b-2 px-4 text-sm font-semibold capitalize ${
              tab === t
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-foreground)]/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "campuses" && <CampusesTab campuses={initialCampuses} />}
      {tab === "vendors" && <VendorsTab vendors={initialVendors} campuses={initialCampuses} />}
      {tab === "listings" && (
        <ListingsTab listings={initialListings} vendors={initialVendors} campuses={initialCampuses} />
      )}
    </div>
  );
}

// ============ Campuses ============

function CampusesTab({ campuses }: { campuses: Campus[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addCampus(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("campuses")
      .insert({ name: name.trim(), slug: slugify(name) });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName("");
    router.refresh();
  }

  async function deleteCampus(id: string) {
    if (!confirm("Delete this campus? This fails if vendors are still assigned to it.")) return;
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("campuses").delete().eq("id", id);
    if (deleteError) alert(deleteError.message);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={addCampus} className="flex gap-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New campus name"
          className="min-h-11 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3"
        />
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
      <ul className="flex flex-col gap-2">
        {campuses.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-white px-4 py-3"
          >
            <span>
              {c.name} <span className="text-xs text-[var(--color-foreground)]/50">/{c.slug}</span>
            </span>
            <button onClick={() => deleteCampus(c.id)} className="text-sm font-medium text-[var(--color-destructive)]">
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============ Vendors ============

function VendorsTab({ vendors, campuses }: { vendors: PublicVendor[]; campuses: Campus[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? "");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revealedPin, setRevealedPin] = useState<RevealedPin | null>(null);
  const [nowMs] = useState(() => Date.now());

  const campusName = (id: string) => campuses.find((c) => c.id === id)?.name ?? "—";

  async function addVendor(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), campus_id: campusId, location: location.trim() || null }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Could not add vendor.");
      return;
    }
    setRevealedPin({ vendorName: name.trim(), pin: body.pin });
    setName("");
    setLocation("");
    router.refresh();
  }

  async function toggleActive(id: string, is_active: boolean) {
    const supabase = createClient();
    await supabase.from("vendors").update({ is_active }).eq("id", id);
    router.refresh();
  }

  async function deleteVendor(id: string, vendorName: string) {
    if (
      !confirm(
        `Permanently delete ${vendorName}? This also permanently deletes all of their listings ` +
          `(active and expired) — this can't be undone. Consider "Disable" instead if you just want ` +
          `to hide them without losing history.`
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) alert(error.message);
    router.refresh();
  }

  async function resetPin(id: string, vendorName: string) {
    if (!confirm(`Generate a new PIN for ${vendorName}? Their current PIN will stop working.`)) return;
    const res = await fetch(`/api/admin/vendors/${id}/reset-pin`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) {
      alert(body.error ?? "Could not reset PIN.");
      return;
    }
    setRevealedPin({ vendorName, pin: body.pin });
    router.refresh();
  }

  async function saveContactNote(id: string, currentNote: string | null) {
    const note = prompt("Internal contact note (not shown publicly):", currentNote ?? "");
    if (note === null) return;
    const supabase = createClient();
    await supabase.from("vendors").update({ contact_note: note }).eq("id", id);
    router.refresh();
  }

  async function saveLocation(id: string, currentLocation: string | null) {
    const value = prompt("Location on campus (shown publicly on the feed):", currentLocation ?? "");
    if (value === null) return;
    const supabase = createClient();
    await supabase.from("vendors").update({ location: value.trim() || null }).eq("id", id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {revealedPin && (
        <div className="rounded-xl border border-[var(--color-accent)] bg-white p-4">
          <p className="text-sm">
            PIN for <strong>{revealedPin.vendorName}</strong> — share this with them now, it won&apos;t be
            shown again:
          </p>
          <p className="mt-1 text-3xl font-extrabold tracking-widest">{revealedPin.pin}</p>
          <button onClick={() => setRevealedPin(null)} className="mt-2 text-sm font-medium text-[var(--color-accent)]">
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={addVendor} className="flex flex-wrap gap-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Vendor name"
          className="min-h-11 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3"
        />
        <select
          value={campusId}
          onChange={(e) => setCampusId(e.target.value)}
          className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
        >
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location on campus (optional, e.g. Building 4, Level 2)"
          className="min-h-11 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3"
        />
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-50"
        >
          Add vendor
        </button>
      </form>
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}

      <ul className="flex flex-col gap-2">
        {vendors.map((v) => {
          const locked = v.locked_until && new Date(v.locked_until).getTime() > nowMs;
          return (
            <li key={v.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {v.name}{" "}
                    <span className="text-xs font-normal text-[var(--color-foreground)]/50">
                      /vendor/{v.slug} · {campusName(v.campus_id)}
                      {v.location ? ` · ${v.location}` : ""}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--color-foreground)]/60">
                    {v.is_active ? "Active" : "Disabled"}
                    {locked ? " · Locked (too many failed PIN attempts)" : ""}
                    {v.contact_note ? ` · Note: ${v.contact_note}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleActive(v.id, !v.is_active)}
                    className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium"
                  >
                    {v.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => resetPin(v.id, v.name)}
                    className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium"
                  >
                    Reset PIN
                  </button>
                  <button
                    onClick={() => saveLocation(v.id, v.location)}
                    className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium"
                  >
                    Edit location
                  </button>
                  <button
                    onClick={() => saveContactNote(v.id, v.contact_note)}
                    className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium"
                  >
                    Edit note
                  </button>
                  <button
                    onClick={() => deleteVendor(v.id, v.name)}
                    className="min-h-11 rounded-lg border border-[var(--color-destructive)] px-3 text-sm font-medium text-[var(--color-destructive)]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============ Listings ============

function ListingsTab({
  listings,
  vendors,
  campuses,
}: {
  listings: Listing[];
  vendors: PublicVendor[];
  campuses: Campus[];
}) {
  const router = useRouter();

  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? "—";
  const campusName = (id: string) => campuses.find((c) => c.id === id)?.name ?? "—";

  async function toggleActive(id: string, is_active: boolean) {
    const supabase = createClient();
    await supabase.from("listings").update({ is_active }).eq("id", id);
    router.refresh();
  }

  async function deleteListing(id: string) {
    if (!confirm("Delete this listing permanently?")) return;
    const supabase = createClient();
    await supabase.from("listings").delete().eq("id", id);
    router.refresh();
  }

  if (listings.length === 0) {
    return <p className="text-sm text-[var(--color-foreground)]/60">No listings yet — vendors create these from their own page.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--color-foreground)]/60">
        New listings are created by vendors from their own PIN-gated page. This view is the admin fallback for
        deactivating or removing anything that needs it.
      </p>
      <ul className="flex flex-col gap-2">
        {listings.map((l) => (
          <li key={l.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{l.title}</p>
                <p className="text-xs text-[var(--color-foreground)]/60">
                  {FOOD_TYPE_LABELS[l.food_type]} · {vendorName(l.vendor_id)} · {campusName(l.campus_id)} ·{" "}
                  {l.is_active ? "Active" : "Inactive"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleActive(l.id, !l.is_active)}
                  className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium"
                >
                  {l.is_active ? "Deactivate" : "Reactivate"}
                </button>
                <button
                  onClick={() => deleteListing(l.id)}
                  className="min-h-11 rounded-lg border border-[var(--color-destructive)] px-3 text-sm font-medium text-[var(--color-destructive)]"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
