# Campus Food Finder — Project Spec Sheet

**Status:** v1 draft
**Purpose of this document:** Hand this directly to Claude Code (or any dev) to scaffold the Next.js + Supabase + Vercel build.

---

## 1. Project Overview

A single-page, mobile-first Progressive Web App (PWA) that shows university students where they can find free, discounted, or specially-priced food on their campus, updated in real time by the vendors/organisers running each offer.

- **Audience:** University students, ~18–25 (plus mature-age and international students). Assume varying levels of digital literacy — keep it dead simple, visual, and fast.
- **Core promise:** Open the site (no login, no signup) → instantly see what free/cheap food is available near you right now.
- **Visual tone:** Clean, card-based, appetite-friendly — think Too Good To Go / Uber Eats, not a university notice board.
- **Working title:** none yet (placeholder: "Campus Food Finder" — happy to workshop names later).

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | **Next.js** (App Router) | Best-supported path for Vercel + Supabase, free tier friendly |
| Hosting | **Vercel** (free/Hobby tier) | Auto-deploys from GitHub |
| Database + Storage | **Supabase** (free tier) | Postgres DB, Storage bucket for photos, built-in Auth for admin |
| Styling | Tailwind CSS | Fast to build, easy to keep mobile-first |
| PWA | `next-pwa` or manual manifest + service worker | Installable, offline app-shell caching |
| Notifications (Phase 2) | Resend or Supabase's email integration | Not in v1 |

No payments, no student accounts, no email sending required for v1.

---

## 3. Information Architecture

**Single page app** — one main screen, no navigation between pages.

```
/                       → Main listings feed (public, no login)
/admin                  → Admin dashboard (Supabase Auth login required)
/vendor/[vendorSlug]    → Vendor's own listing management (PIN-gated)
```

### Main page (`/`) layout
1. Header: app name/logo + tagline
2. **Campus filter** — horizontal chip/pill selector ("All", "Burwood", "Waterfront", "Waurn Ponds" etc. — replace with real campus names once added)
3. **Food type filter** (secondary, optional toggle) — Free Giveaway / Discounted / Daily Special / Recurring Event / One-off Event
4. **Feed of listing cards**, split into two lightweight groups reusing the same fetched data (no extra backend calls):
   - **Happening Now** — one-time listings currently within their window, plus recurring listings whose day/time window is active right now
   - **Weekly & Recurring** — all active recurring listings regardless of current day/time, so students can plan ahead (e.g. see Wednesday's Brekky on a Monday)

   Sort each group soonest-expiring/soonest-upcoming first. Each card shows:
   - Food type badge (colour-coded)
   - Vendor/location name
   - What's on offer
   - Price (or "FREE")
   - Time remaining / expiry ("Ends in 40 min", "Today until 6pm")
   - Optional photo thumbnail (graceful fallback to a food-type icon if no photo)
5. Empty state: friendly message if no listings match the filter ("No food on offer right now — check back soon!")

### Vendor page (`/vendor/[vendorSlug]`)
- PIN entry screen (4–6 digit PIN)
- Once unlocked: simple form to add a new listing, and a list of their own active/expired listings with delete/deactivate buttons
- Vendors can **only** see and edit their own listings

### Admin page (`/admin`)
- Supabase Auth email/password login (single admin account, or a few trusted staff accounts)
- Full CRUD over: campuses, vendors (incl. resetting a vendor's PIN), and all listings
- This is the "master control" fallback for anything vendors get stuck on

---

## 4. Feature Scope

### v1 (build now)
- Public read-only feed, no login
- Campus filter
- Food type filter
- Vendor PIN-based add/edit/remove of their own listings
- Admin full control panel
- Optional photo upload per listing
- Auto-expiry: listings hide themselves once `expires_at` passes (handled by query, not a cron job)
- PWA installable on mobile home screen
- Fully responsive/mobile-first

### Phase 2 (later)
- Email notifications to subscribed students when a new listing goes up
- Push notifications (PWA)
- Multiple photos per listing
- Analytics on which offers get the most views/clicks

---

## 5. Data Model (Supabase / Postgres)

### `campuses`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | default `gen_random_uuid()` |
| name | text | e.g. "Burwood" |
| slug | text, unique | for URLs/filters |
| created_at | timestamptz | default `now()` |

### `vendors`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| campus_id | uuid, FK → campuses.id | |
| name | text | e.g. "Student Association Café" |
| slug | text, unique | used in `/vendor/[slug]` URL |
| pin_hash | text | bcrypt hash of vendor's 6-digit PIN — never store plain text |
| failed_attempts | integer | default 0 — resets to 0 on successful login |
| locked_until | timestamptz, nullable | set when failed_attempts hits 5; blocks login attempts until this time passes |
| contact_note | text, nullable | admin-only internal note (not shown publicly) |
| is_active | boolean | default true — admin can disable a vendor |
| created_at | timestamptz | default `now()` |

### `listings`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| vendor_id | uuid, FK → vendors.id | |
| campus_id | uuid, FK → campuses.id | denormalised for fast filtering |
| food_type | text (enum-like) | `free_giveaway` \| `discounted` \| `daily_special` \| `recurring_event` \| `one_off_event` |
| schedule_type | text (enum-like) | `one_time` \| `recurring` — determines which timing fields below apply |
| title | text | e.g. "Leftover sandwiches" or "Free Brekky Wednesdays" |
| description | text, nullable | free-text detail, e.g. "vegetarian options available" |
| price | numeric, nullable | null = free |
| photo_url | text, nullable | Supabase Storage public URL |
| **One-time fields** (used when `schedule_type = 'one_time'`) | | for `free_giveaway`, `discounted`, `daily_special`, `one_off_event` |
| starts_at | timestamptz, nullable | when the offer begins |
| expires_at | timestamptz, nullable | when it disappears from the feed |
| **Recurring fields** (used when `schedule_type = 'recurring'`) | | for ongoing weekly things like "Free Brekky Wednesdays" |
| recurrence_days | text[], nullable | e.g. `['wednesday']` — supports multiple days if needed |
| recurrence_time_start | time, nullable | e.g. `07:30` |
| recurrence_time_end | time, nullable | e.g. `09:30` |
| recurrence_valid_until | date, nullable | optional — e.g. end of semester, so it doesn't run forever unattended |
| is_active | boolean | default true — lets vendor manually pull a listing early, or pause a recurring one over break |
| created_at | timestamptz | default `now()` |
| updated_at | timestamptz | default `now()` |

**Feed display logic** differs by `schedule_type`:
- `one_time` listings show while `now()` is between `starts_at` and `expires_at`.
- `recurring` listings show whenever today's weekday is in `recurrence_days` **and** the current time falls within `recurrence_time_start`–`recurrence_time_end` (and, if set, before `recurrence_valid_until`). Outside that window, they simply don't appear — no need to recreate them weekly. Consider a secondary "Recurring / Always Check" section on the feed listing *all* active recurring offers regardless of current time, so students can plan ahead (e.g. see Wednesday's Brekky on a Monday), separate from the "happening right now" section.

### `admins`
Handled by **Supabase Auth** directly (no custom table needed for v1) — admin accounts are just Supabase Auth users. If you want role distinctions later, add a `profiles` table keyed to `auth.users.id`.

### Storage
- Bucket: `listing-photos` — public read, restricted write (only via server-side API route after PIN check, not direct client upload).

---

## 6. Auth & Permissions Model

This app has **three access levels**, none of which require students to log in:

1. **Public (students):** read-only access to active listings. No auth at all.
2. **Vendor:** authenticates via a PIN specific to their vendor record. This is **not** Supabase Auth — it's a lightweight custom check:
   - Vendor enters a **6-digit** PIN on `/vendor/[slug]`
   - PIN is sent to a Next.js **API route** (server-side), which compares it against `pin_hash` using bcrypt
   - **Rate limiting:** the API route tracks failed attempts (e.g. a `failed_attempts` counter + `locked_until` timestamp on the `vendors` row, or a lightweight in-memory/edge store keyed by vendor + IP). After 5 failed attempts, lock further attempts for 15 minutes. This is the main defence against PIN brute-forcing, since the vendor slug itself may be guessable/public.
   - On success, issue a short-lived signed session token (e.g. HTTP-only cookie or JWT) scoped to that one `vendor_id`
   - All create/update/delete requests for listings go through server-side API routes that check this token — the Supabase **anon key is never given direct write access** to the `listings` table
3. **Admin:** real Supabase Auth login (email/password). Has a Postgres role/claim allowing full read/write on all tables directly via RLS.

### Row Level Security (RLS) summary
| Table | Public (anon) | Vendor (via API route only) | Admin (Supabase Auth) |
|---|---|---|---|
| campuses | SELECT only | — | full CRUD |
| vendors | no direct access | no direct access (PIN check happens server-side against service role) | full CRUD |
| listings | SELECT where `is_active = true`, and (for `one_time`) `expires_at > now()`, or (for `recurring`) not yet past `recurrence_valid_until` — "is it happening right now" is computed client-side/in the query using the logic in Section 5 | INSERT/UPDATE/DELETE only own `vendor_id`, enforced in API route logic using the Supabase **service role key** (server-side only, never exposed to browser) | full CRUD |

This keeps the anon (public) key locked to read-only, and keeps the PIN system secure without needing full vendor accounts.

---

## 7. Design/UX Brief

- **Reference apps:** Too Good To Go, Uber Eats — card-based feeds, big touch targets, colour-coded categories, appetite appeal.
- **Layout:** Mobile-first single column of cards; expand to a responsive grid on tablet/desktop.
- **Typography:** Clean, rounded sans-serif (e.g. Inter or similar), large legible type for scanning quickly.
- **Colour coding by food type** (suggested starting palette, adjust to taste):
  - Free Giveaway → green
  - Discounted → orange
  - Daily Special → purple
  - Recurring Event → blue
  - One-off Event → pink/red
- **Filters:** Chip/pill style, horizontally scrollable on mobile, always visible (sticky under header).
- **Urgency cues:** Show live countdown or "ends soon" tag for listings expiring within the hour to nudge action.
- **Imagery:** Optional per listing — if no photo, use a simple food-type icon/illustration rather than a broken image or empty space.

### Design system generation — UI UX Pro Max skill
This project should use the **UI UX Pro Max** Claude Code skill (github.com/nextlevelbuilder/ui-ux-pro-max-skill) to generate the actual design system before any component code is written, rather than hand-picking colours/fonts ad hoc.

- Install it inside the project repo once the Next.js app is scaffolded:
  ```
  /plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
  /plugin install ui-ux-pro-max@ui-ux-pro-max-skill
  ```
  (or via the CLI: `npm install -g ui-ux-pro-max-cli` then `uipro init --ai claude`)
- It auto-activates on UI/UX build requests in Claude Code — no need to invoke it manually, it should trigger from a prompt like "Build the main food listings page for this app."
- Best-matching category for this project is **Food Delivery** (under its E-commerce reasoning rules), with **Booking & Appointment** as a secondary reference for the vendor management screens.
- It will output a recommended pattern, colour palette, typography pairing, key effects, and — importantly — a list of **anti-patterns to avoid**, plus a pre-delivery accessibility/consistency checklist. Treat that output as the source of truth for Section 7's palette/typography above; the notes here are a starting brief, not a hard override.
- Optional: persist the generated system to `design-system/MASTER.md` in the repo (using its `--persist` flag) so every page built afterward — main feed, vendor page, admin page — stays visually consistent rather than drifting.

---

## 8. PWA Requirements

- `manifest.json` with app name, icons (multiple sizes), theme colour, `display: standalone`
- Service worker caching the app shell for fast repeat loads (data itself should stay live/fresh, not aggressively cached)
- "Add to Home Screen" prompt support on mobile
- Works fully on mobile Safari and Chrome (test both — iOS PWA support has quirks)

---

## 9. Deployment Plan

1. **Supabase:** create free-tier project → run schema migration (tables above) → create `listing-photos` storage bucket → grab project URL + anon key + service role key
2. **Vercel:** connect GitHub repo → set environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — service role kept server-side only) → deploy
3. Both Supabase and Vercel free tiers should comfortably cover this use case (low traffic, small dataset, no heavy compute)

---

## 10. Initial Setup Data

- **Campuses** are known upfront and should be seeded directly into the `campuses` table as part of the initial database setup (not added manually through the admin panel): **Waterfront, Burwood, Waurn Ponds, Warrnambool**.
- **Vendors** are not yet known — the admin will add these manually through the `/admin` panel after launch, as each vendor comes on board. So the admin panel still needs a simple "Add Vendor" form (with auto-generated PIN shown once, and slug generation) as part of v1.

---

## 11. Open Questions / Assumptions to Confirm Before Build

- ~~Vendor PIN format~~ — resolved: 6-digit numeric, hashed, with rate limiting (Section 6).
- ~~Expiry cap on recurring listings~~ — resolved: recurring listings (e.g. "Free Brekky Wednesdays") use a day/time-window model with no forced expiry, distinct from one-time listings (Section 5).
- ~~Recurring/Always Check section~~ — resolved: yes, include it (Section 3) — low cost since it reuses data already being fetched, just a second filter/section rather than new backend work.
- ~~Campus list~~ — resolved: **Waterfront, Burwood, Waurn Ponds, Warrnambool**. These four should be seeded into the `campuses` table as part of initial setup (Section 5), so the admin doesn't have to manually add them via the panel before the first vendor can be onboarded.

---

## 12. Build Instructions Summary (for Claude Code)

> Build a Next.js (App Router) + Tailwind CSS PWA deployed on Vercel, backed by Supabase (Postgres + Storage + Auth). Implement the schema, RLS policies, and three access tiers (public read-only, PIN-gated vendor write access via server-side API routes, and Supabase Auth admin access) exactly as specified in Sections 5–6. Build the single main feed page with campus and food-type filtering per Section 3, the vendor management page, and the admin dashboard.
>
> Before writing UI code, install and run the UI UX Pro Max skill (Section 7) to generate the design system for a "Food Delivery" product — use its output (colours, typography, layout pattern, anti-patterns, checklist) as the visual source of truth instead of hand-picking styles. Persist it to `design-system/MASTER.md` and reference it consistently across the feed, vendor, and admin pages.
