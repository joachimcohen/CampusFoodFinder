# Campus Food Finder

A mobile-first PWA showing university students where to find free, discounted, or
specially-priced food on campus in real time. See `campus-food-finder-spec.md` for the
full product spec and `design-system/MASTER.md` for the design system this build follows.

Stack: Next.js (App Router) + Tailwind CSS + Supabase (Postgres, Storage, Auth) + Vercel.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values from the steps below
npm run dev
```

Open http://localhost:3000.

## Deploying from scratch

You said Supabase and Vercel are already created and linked to this GitHub repo — here's
what's left to wire up.

### 1. Supabase — run the schema migration

1. Open your Supabase project → **SQL Editor**.
2. Paste the contents of `supabase/migrations/0001_init.sql` and run it. This creates the
   `campuses`, `vendors`, and `listings` tables, all RLS policies, the `listing-photos`
   storage bucket, and seeds the four campuses (Waterfront, Burwood, Waurn Ponds,
   Warrnambool).
3. Go to **Project Settings → API** and note down:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — server-side only)
4. Go to **Authentication → Users** and create your first admin account (email + password).
   This is the account you'll use to sign in at `/admin` — there's no self-serve admin
   sign-up by design.

### 2. Generate a vendor session secret

```bash
openssl rand -base64 32
```

This becomes `VENDOR_SESSION_SECRET` — it signs the short-lived cookie issued after a
vendor enters their PIN. Any long random string works; just don't reuse a secret from
another project.

### 3. Vercel — set environment variables and deploy

In your Vercel project → **Settings → Environment Variables**, add all four:

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase API settings | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase API settings | public |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase API settings | **secret — do not expose client-side** |
| `VENDOR_SESSION_SECRET` | output of the `openssl` command above | secret |

Since Vercel is already linked to this GitHub repo, pushing to the branch it's configured
to deploy from (or merging into your production branch) triggers a build automatically —
nothing else to do.

### 4. Onboard your first vendor

Once deployed, sign in at `/admin`, go to the **Vendors** tab, add a vendor (pick their
campus), and copy the 6-digit PIN shown — it's only ever shown once. Give that PIN and
their vendor URL (`/vendor/<their-slug>`) to the vendor directly.

## How auth works (three tiers, no student login)

- **Public feed (`/`)** — read-only, anon Supabase key, no login.
- **Vendor (`/vendor/[slug]`)** — a 6-digit PIN checked server-side against a bcrypt hash;
  5 failed attempts locks that vendor out for 15 minutes. On success, a signed HTTP-only
  cookie scopes all their listing writes to their own `vendor_id`. The anon key never gets
  write access to `listings` or any access to `vendors` — vendor writes go through
  server-side API routes using the Supabase service role key.
- **Admin (`/admin`)** — real Supabase Auth (email/password), full CRUD via RLS.

Full schema and RLS details are in `supabase/migrations/0001_init.sql`.

## Project structure

```
app/
  page.tsx                     Main feed (server component, fetches campuses + listings)
  vendor/[vendorSlug]/         PIN-gated vendor listing management
  admin/login/                 Admin sign-in
  admin/(protected)/           Admin dashboard (campuses, vendors, listings tabs)
  api/vendor/                  PIN login/logout, listing CRUD, photo upload
  api/admin/                   Vendor creation + PIN reset (need admin session)
components/                    Feed, ListingCard, FoodTypeBadge, service worker registration
lib/                           Supabase clients, listing time-window logic, session/PIN helpers
supabase/migrations/           SQL schema + RLS + seed data
design-system/MASTER.md        Design system (colours, type, patterns) — source of truth for UI
public/manifest.json, sw.js    PWA manifest + hand-rolled service worker (app-shell caching only)
```

## Known v1 scope notes

- Admin's **Listings** tab covers view / activate-deactivate / delete (the "fallback for
  anything vendors get stuck on" from the spec). Creating new listings happens on each
  vendor's own page, matching how vendors are meant to self-serve day to day.
- The service worker caches only static assets (`/_next/static`, icons, manifest) — never
  the feed data or HTML — so "happening now" listings are always fetched live.
