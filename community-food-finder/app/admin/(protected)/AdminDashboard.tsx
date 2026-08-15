"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/slugify";
import type { Listing, OrgType, PublicOrganisation, Suburb } from "@/lib/types";
import { LISTING_TYPE_LABELS, ORG_TYPE_LABELS } from "@/lib/types";

type Tab = "suburbs" | "organisations" | "listings";
type RevealedCode = { orgName: string; code: string };

export default function AdminDashboard({
  regionId,
  initialSuburbs,
  initialOrganisations,
  initialListings,
}: {
  regionId: string | null;
  initialSuburbs: Suburb[];
  initialOrganisations: PublicOrganisation[];
  initialListings: Listing[];
}) {
  const [tab, setTab] = useState<Tab>("organisations");

  return (
    <div>
      <div className="mb-6 flex gap-2 border-b border-[var(--color-border)]">
        {(["suburbs", "organisations", "listings"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`min-h-11 cursor-pointer border-b-2 px-4 text-sm font-semibold capitalize ${
              tab === t
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-foreground)]/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "suburbs" && <SuburbsTab regionId={regionId} suburbs={initialSuburbs} />}
      {tab === "organisations" && <OrganisationsTab organisations={initialOrganisations} suburbs={initialSuburbs} />}
      {tab === "listings" && (
        <ListingsTab listings={initialListings} organisations={initialOrganisations} suburbs={initialSuburbs} />
      )}
    </div>
  );
}

// ============ Suburbs ============

function SuburbsTab({ regionId, suburbs }: { regionId: string | null; suburbs: Suburb[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addSuburb(e: React.FormEvent) {
    e.preventDefault();
    if (!regionId) {
      setError("No region is seeded for this instance yet — run the migration's seed data first.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("suburbs")
      .insert({ region_id: regionId, name: name.trim(), slug: slugify(name) });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName("");
    router.refresh();
  }

  async function deleteSuburb(id: string) {
    if (!confirm("Delete this suburb? This fails if organisations/listings are still assigned to it.")) return;
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("suburbs").delete().eq("id", id);
    if (deleteError) alert(deleteError.message);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={addSuburb} className="flex gap-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New suburb name"
          className="min-h-11 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3"
        />
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 cursor-pointer rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
      <ul className="flex flex-col gap-2">
        {suburbs.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-white px-4 py-3"
          >
            <span>
              {s.name} <span className="text-xs text-[var(--color-foreground)]/50">/{s.slug}</span>
            </span>
            <button
              onClick={() => deleteSuburb(s.id)}
              className="cursor-pointer text-sm font-medium text-[var(--color-destructive)]"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============ Organisations ============

function OrganisationsTab({ organisations, suburbs }: { organisations: PublicOrganisation[]; suburbs: Suburb[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState<OrgType>("vendor");
  const [suburbId, setSuburbId] = useState(suburbs[0]?.id ?? "");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revealedCode, setRevealedCode] = useState<RevealedCode | null>(null);
  const [nowMs] = useState(() => Date.now());

  const suburbName = (id: string) => suburbs.find((s) => s.id === id)?.name ?? "—";

  async function addOrganisation(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/organisations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        org_type: orgType,
        suburb_id: suburbId,
        location: location.trim() || null,
      }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Could not add organisation.");
      return;
    }
    setRevealedCode({ orgName: name.trim(), code: body.code });
    setName("");
    setLocation("");
    router.refresh();
  }

  async function toggleActive(id: string, is_active: boolean) {
    const supabase = createClient();
    await supabase.from("organisations").update({ is_active }).eq("id", id);
    router.refresh();
  }

  async function deleteOrganisation(id: string, orgName: string) {
    if (
      !confirm(
        `Permanently delete ${orgName}? This also permanently deletes all of their listings — this can't be ` +
          `undone. Consider "Disable" instead if you just want to hide them without losing history.`
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.from("organisations").delete().eq("id", id);
    if (error) alert(error.message);
    router.refresh();
  }

  async function resetCode(id: string, orgName: string) {
    if (!confirm(`Generate a new code for ${orgName}? Their current code will stop working.`)) return;
    const res = await fetch(`/api/admin/organisations/${id}/reset-code`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) {
      alert(body.error ?? "Could not reset code.");
      return;
    }
    setRevealedCode({ orgName, code: body.code });
    router.refresh();
  }

  async function saveContactNote(id: string, currentNote: string | null) {
    const note = prompt("Internal contact note (not shown publicly):", currentNote ?? "");
    if (note === null) return;
    const supabase = createClient();
    await supabase.from("organisations").update({ contact_note: note }).eq("id", id);
    router.refresh();
  }

  async function saveLocation(id: string, currentLocation: string | null) {
    const value = prompt("Location (shown publicly on the feed):", currentLocation ?? "");
    if (value === null) return;
    const supabase = createClient();
    await supabase.from("organisations").update({ location: value.trim() || null }).eq("id", id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--color-foreground)]/60">
        Add an organisation here once it&apos;s been vetted — creating it here is the approval step. The code
        shown afterwards is theirs to log in and manage listings; it&apos;s only ever shown once.
      </p>

      {revealedCode && (
        <div className="rounded-xl border border-[var(--color-primary)] bg-white p-4">
          <p className="text-sm">
            Code for <strong>{revealedCode.orgName}</strong> — share this with them now, it won&apos;t be shown
            again:
          </p>
          <p className="mt-1 text-3xl font-black tracking-widest">{revealedCode.code}</p>
          <button
            onClick={() => setRevealedCode(null)}
            className="mt-2 cursor-pointer text-sm font-medium text-[var(--color-primary)]"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={addOrganisation} className="flex flex-wrap gap-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Organisation / vendor name"
          className="min-h-11 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3"
        />
        <select
          value={orgType}
          onChange={(e) => setOrgType(e.target.value as OrgType)}
          className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
        >
          {(Object.keys(ORG_TYPE_LABELS) as OrgType[]).map((t) => (
            <option key={t} value={t}>
              {ORG_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={suburbId}
          onChange={(e) => setSuburbId(e.target.value)}
          className="min-h-11 rounded-lg border border-[var(--color-border)] bg-white px-3"
        >
          {suburbs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (optional, e.g. 123 Main St)"
          className="min-h-11 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3"
        />
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 cursor-pointer rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Add organisation
        </button>
      </form>
      {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}

      <ul className="flex flex-col gap-2">
        {organisations.map((o) => {
          const locked = o.locked_until && new Date(o.locked_until).getTime() > nowMs;
          return (
            <li key={o.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {o.name}{" "}
                    <span className="text-xs font-normal text-[var(--color-foreground)]/50">
                      /org/{o.slug} · {ORG_TYPE_LABELS[o.org_type]} · {suburbName(o.suburb_id)}
                      {o.location ? ` · ${o.location}` : ""}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--color-foreground)]/60">
                    {o.is_active ? "Active" : "Disabled"}
                    {locked ? " · Locked (too many failed code attempts)" : ""}
                    {o.contact_note ? ` · Note: ${o.contact_note}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleActive(o.id, !o.is_active)}
                    className="min-h-11 cursor-pointer rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium"
                  >
                    {o.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => resetCode(o.id, o.name)}
                    className="min-h-11 cursor-pointer rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium"
                  >
                    Reset code
                  </button>
                  <button
                    onClick={() => saveLocation(o.id, o.location)}
                    className="min-h-11 cursor-pointer rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium"
                  >
                    Edit location
                  </button>
                  <button
                    onClick={() => saveContactNote(o.id, o.contact_note)}
                    className="min-h-11 cursor-pointer rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium"
                  >
                    Edit note
                  </button>
                  <button
                    onClick={() => deleteOrganisation(o.id, o.name)}
                    className="min-h-11 cursor-pointer rounded-lg border border-[var(--color-destructive)] px-3 text-sm font-medium text-[var(--color-destructive)]"
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
  organisations,
  suburbs,
}: {
  listings: Listing[];
  organisations: PublicOrganisation[];
  suburbs: Suburb[];
}) {
  const router = useRouter();

  const orgName = (id: string) => organisations.find((o) => o.id === id)?.name ?? "—";
  const suburbName = (id: string) => suburbs.find((s) => s.id === id)?.name ?? "—";

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
    return (
      <p className="text-sm text-[var(--color-foreground)]/60">
        No listings yet — organisations create these from their own page.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--color-foreground)]/60">
        New listings are created by organisations from their own code-gated page. This view is the admin fallback
        for deactivating or removing anything that needs it.
      </p>
      <ul className="flex flex-col gap-2">
        {listings.map((l) => (
          <li key={l.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{l.title}</p>
                <p className="text-xs text-[var(--color-foreground)]/60">
                  {LISTING_TYPE_LABELS[l.listing_type]} · {orgName(l.organisation_id)} · {suburbName(l.suburb_id)} ·{" "}
                  {l.is_active ? "Active" : "Inactive"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleActive(l.id, !l.is_active)}
                  className="min-h-11 cursor-pointer rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium"
                >
                  {l.is_active ? "Deactivate" : "Reactivate"}
                </button>
                <button
                  onClick={() => deleteListing(l.id)}
                  className="min-h-11 cursor-pointer rounded-lg border border-[var(--color-destructive)] px-3 text-sm font-medium text-[var(--color-destructive)]"
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
