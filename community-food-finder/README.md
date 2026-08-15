# Community Food Finder

A mobile-first PWA that helps people find free and discounted food near them — run by local
councils and community organisations. Launch scope: suburbs around Box Hill in the Whitehorse
City Council area (Victoria, Australia). See `community-food-finder-spec.md` for the full product
spec and `design-system/MASTER.md` for the design system this build follows.

Stack: Next.js (App Router) + Tailwind CSS + Supabase (Postgres, Storage, Auth) + Vercel — the
same stack as Campus Food Finder, but **entirely separate infrastructure**: its own repo (see
below), its own Supabase project, its own Vercel project. No shared data, code imports, or
credentials between the two.

> **This directory currently lives inside the CampusFoodFinder repo as a temporary staging
> location.** The product spec requires Community Food Finder to be a 100% separate project —
> its own GitHub repo and deployment — since ownership is expected to split from Campus Food
> Finder in future. Before real launch, split this directory out into its own repo (e.g. `git
> subtree split` or a fresh `git init` + copy), then follow the deploy steps below there. Nothing
> in this directory imports from or depends on the rest of the CampusFoodFinder repo.

## Local development

```bash
cd community-food-finder
npm install
cp .env.example .env.local   # fill in the values from the steps below
npm run dev
```

Open http://localhost:3000.

## Deploying from scratch

### 1. Create a fresh Supabase project

Must be a **new** Supabase project — never the one Campus Food Finder uses.

1. Open your new Supabase project → **SQL Editor**.
2. Paste the contents of `supabase/migrations/0001_init.sql` and run it. This creates the
   `regions`, `suburbs`, `organisations`, `listings`, `queue_tickets`, `queue_calls`, and
   `rate_limit_events` tables, all RLS policies, the `listing-photos` storage bucket, and seeds
   the Whitehorse region with its ten launch suburbs (Box Hill, Burwood, Burwood East, Blackburn,
   Forest Hill, Mitcham, Mont Albert, Nunawading, Vermont, Vermont South).
3. Then run `supabase/migrations/0002_require_aal2_for_admin_writes.sql` the same way.
4. Go to **Project Settings → API** and note down:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — server-side only)
5. Go to **Authentication → Users** and create your first admin account (email + password). This
   is the account you'll use to sign in at `/admin` — there's no self-serve admin sign-up by
   design.

### 2. Generate session secrets

```bash
openssl rand -base64 32
```

Run this **twice**, once for `ORG_SESSION_SECRET` (signs the short-lived cookie issued after an
organisation enters their access code) and once for `ADMIN_DEVICE_SECRET` (signs the admin
"trusted device" cookie) — two different values, don't reuse either from Campus Food Finder.

### 3. (Optional) PTV Timetable API — nearest-stop info

Section 7.2 of the spec: displaying "6 min walk to Box Hill Station" on each listing. Free, but
requires a developer ID + key requested by email from PTV — **this can take some time to arrive,
so request it early and don't block launch on it.** Without it, the app works fine; the
nearest-stop line just doesn't show.

1. Email `APIKeyRequest@ptv.vic.gov.au` to request access.
2. Once you have credentials, set `PTV_DEV_ID` and `PTV_API_KEY`.
3. Wherever nearest-stop data is shown, the required attribution line is already wired in
   (`lib/ptv-attribution.ts` → `PTV_ATTRIBUTION`): *"Source: Licensed from Public Transport Victoria under a
   Creative Commons Attribution 4.0 International Licence."*

### 4. (Optional) Web push for the virtual queue

Section 6's "Secure your place" queue can notify people the moment they're called, on top of the
always-available live status page.

```bash
npx web-push generate-vapid-keys
```

Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (a `mailto:` address)
from the output. Without these, the queue still works — people just rely on the live status page
instead of a push alert.

### 5. Vercel — set environment variables and deploy

Create a **new, separate** Vercel project (not the Campus Food Finder one) pointed at this
directory. In **Settings → Environment Variables**, add everything from `.env.example` that you
filled in above, plus optionally `CRON_SECRET` (any random string) to authenticate the keep-alive
cron job.

Since Vercel is linked to the repo, pushing to its configured deploy branch triggers a build
automatically.

### Keeping the Supabase project awake

Free-tier Supabase projects pause after 7 days with no activity. `vercel.json` schedules a daily
request to `/api/cron/keep-alive`, which also prunes old rate-limit tracking rows so that table
never grows unbounded.

### 6. Onboard your first organisation

Sign in at `/admin`, go to the **Organisations** tab, add an organisation (pick a suburb and
whether it's a vendor or community organisation), and copy the 6-digit code shown — it's only
ever shown once. Give that code and their URL (`/org/<their-slug>`) to the organisation directly.
Creating the record here **is** the approval step (spec Section 5) — there's no public
self-signup, and no per-listing review after that: once an organisation is in, their listings go
live immediately.

### 7. First admin sign-in — set up two-factor authentication

Required, not optional, the first time you sign in at `/admin` — walks you through an
authenticator app (Google Authenticator, Authy, etc.). New-device email verification
(`app/admin/verify-device`) exists but is off by default (see the comment in
`app/admin/(protected)/layout.tsx`) until you've confirmed Supabase's built-in email sender is
delivering for your project.

## How auth works (three tiers, no public login)

- **Public feed (`/`)** — read-only, anon Supabase key, no login.
- **Organisation (`/org/[orgSlug]`)** — a 6-digit code checked server-side against a bcrypt hash;
  5 failed attempts locks that organisation out for 15 minutes. On success, a signed HTTP-only
  cookie scopes all their listing writes to their own `organisation_id`. The anon key never gets
  write access to `listings`/`organisations` or any access to `queue_tickets` — those writes go
  through server-side API routes using the Supabase service role key.
- **Admin (`/admin`)** — real Supabase Auth (email/password) plus required TOTP MFA, full CRUD
  via RLS (gated to `aal2` sessions at the database layer, not just the UI).
- **Public queue (`/queue/[listingId]`)** — no login of any kind. A ticket is an unguessable UUID
  held client-side (`localStorage`); every read/write still routes through a server API using the
  service role key, so the queue tables have no direct anon access despite needing no login.

Full schema and RLS details are in `supabase/migrations/0001_init.sql`.

## Replicability — forking for a different council

Spec Section 1: this is meant to be a template, not a one-off. To stand up a new instance for a
different council/region:

1. New Supabase project, new Vercel project, new repo checkout — run the migrations as above.
2. In the seed section of `supabase/migrations/0001_init.sql`, replace the `regions`/`suburbs`
   insert with the new council's name and suburb list (or just run the equivalent SQL by hand
   once the schema's in place).
3. Set the `NEXT_PUBLIC_LOCALITY_*` / `NEXT_PUBLIC_REGION_SLUG` / `NEXT_PUBLIC_TIMEZONE` /
   `NEXT_PUBLIC_MAP_DEFAULT_*` env vars in `.env.example` to the new locality (see
   `lib/config.ts` — this is the single file that reads them).
4. Onboard the new region's admin + organisations from `/admin` as above.

No code changes required for any of the above — branding, locality, and suburb data are all
config/database, not hardcoded (see `lib/config.ts`).

## Project structure

```
app/
  page.tsx                       Main feed (server component, fetches suburbs + listings)
  queue/[listingId]/             Public "Secure your place" ticket page — no login
  org/[orgSlug]/                 Code-gated organisation listing + queue management
  admin/login/                   Admin sign-in
  admin/(protected)/             Admin dashboard (suburbs, organisations, listings tabs)
  api/queue/                     Public: join queue, poll ticket status, subscribe to push
  api/org/                       Code login/logout, listing CRUD, photo upload, queue control
  api/admin/                     Organisation creation/code-reset, device trust (need admin session)
components/                      Feed, ListingCard, MapView (Leaflet/OSM), LocationPicker, TransitInfo
lib/                             Supabase clients, scheduling logic, queue engine, PTV client,
                                  directions deep links, rate limiting, web push, instance config
supabase/migrations/             SQL schema + RLS + seed data
design-system/MASTER.md          Design system (black/red, per Section 2) — source of truth for UI
public/manifest.json, sw.js      PWA manifest + service worker (app-shell caching + push handling)
```

## Known v1 scope notes (flagged per spec Section 9)

- **PTV nearest-stop endpoint**: `lib/ptv.ts` targets PTV's published `/v3/stops/location/{lat},
  {lng}` endpoint with HMAC-SHA1 request signing. Worth a quick sanity check against
  `timetableapi.ptv.vic.gov.au/swagger/ui/index` once a real dev key is in hand, before relying on
  it for launch.
- **PTV Journey Planner deep link** (`lib/directions.ts` → `ptvJourneyPlannerUrl`) is best-effort;
  PTV's JP primarily expects place names/stop IDs rather than raw coordinates. The Google/Apple
  Maps "Get directions" links are the reliable primary option and need no verification.
- **Live transit route overlay on the map** is explicitly out of scope for v1 per the spec — the
  map only shows listing pins, not tram/bus/train routes.
- **Admin code-issuance flow** reuses Campus Food Finder's bcrypt-hashed PIN/lockout pattern
  as-is (Section 9 asked this to be confirmed) — same 6-digit code, same 5-attempt/15-minute
  lockout, applied to both vendors and community organisations via one `organisations` table.
