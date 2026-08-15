# Community Food Finder — Build Spec for Claude Code

## 1. Project Overview

**What it is:** A mobile-first web app (PWA) that helps people find free and discounted food near them — run by local councils and community organisations, starting with suburbs around Box Hill in the Whitehorse council area (Victoria, Australia).

**Relationship to prior work:** This is a **standalone, separate project** — its own repo, deployment, and database. It is *not* connected to, and does not share infrastructure with, the existing "Campus Food Finder" app built for Deakin University students. It reuses proven patterns and design decisions from that build (see Section 6 — Virtual Queue) but must be built and run entirely independently.

**Replicability requirement:** This is intended to be a **template**, not a one-off. The branding, locality data, and council-specific config must be structured so the whole app can be forked/re-deployed for a different council or region with minimal changes (new locality name, new suburb list, new admin users) — not a rebuild.

---

## 2. Branding & Naming

- **Product name:** "Community Food Finder"
- **Branding style:** Generic — not council-branded, not DUSA-branded. The product is a neutral, reusable tool.
- **Locality slot:** Every deployment/instance must display a configurable locality name alongside the product name (e.g. "Community Food Finder — Whitehorse", or an instance-specific short form). This should be a config value, not hardcoded, so future instances (e.g. a different council/region) can relabel without code changes.
- **Colour scheme:** Black and red — inspired by the old Woolworths home-brand product packaging look (bold, high-contrast, no-frills utilitarian design language). Use this as the visual direction: black as the dominant/base colour, red as the accent/CTA colour, minimal decoration.

---

## 3. Geographic Structure

- Replace the "campus" concept from the prior build with **suburbs**.
- Initial launch scope: suburbs around **Box Hill**, within the **Whitehorse City Council** area, Victoria.
- **Launch suburb list:** Box Hill, Burwood, Burwood East, Blackburn, Forest Hill, Mitcham, Mont Albert, Nunawading, Vermont, Vermont South.
- Suburb should be a first-class filterable field on every listing (equivalent to how "campus" worked previously).
- Data model should anticipate multiple councils/regions in future (i.e. suburbs belong to a council/region entity), even though v1 only needs Whitehorse.

---

## 4. Listing Categories

Two listing types (renamed from the prior build's "recurring" / "one-off"):

| Old label | New label |
|---|---|
| Recurring | **Every week** |
| One-off | **Special event** |

Keep the underlying scheduling logic equivalent to the prior build (recurring listings repeat on a schedule; special event listings are single-date/time), just relabelled in all user-facing copy.

---

## 5. Listings & Content Moderation Model

This follows the same account-level vetting model as the prior Campus Food Finder build, applied to vendors and community organisations rather than individual posts:

- **Who can add listings:** Two account types, both requiring admin approval before they can post at all:
  - **Community organisations**
  - **Vendors** (including vetted vendors from the council's business division)
- **Onboarding/approval workflow:**
  - An admin (council staff) reviews and approves each vendor or community organisation before they can use the platform
  - Once approved, the admin issues that organisation/vendor a **code** (equivalent to the PIN-based vendor auth in the prior build) which they use to log in and manage their listings
  - There is **no individual submission from the public** — only approved, code-holding organisations/vendors can create listings
- **Per-listing moderation:** **No vetting needed at the individual post level** — since the organisation/vendor has already been vetted at onboarding, their listings go live immediately without further review.
- **Ongoing moderation:** Admins can still edit or remove any individual listing after the fact, and can revoke or reissue an organisation's/vendor's code if needed.
- **Implication for build:** This removes the abuse-mitigation burden from the public-facing submission flow (there isn't one) and shifts it to the admin's vendor/organisation approval and code-issuance flow — which can reuse the PIN-based auth pattern (bcrypt-hashed code, lockout on repeated failures) from Campus Food Finder.

---

## 6. Virtual Queue — "Secure your place"

Retain the virtual queue feature from the prior build, relabelled:

- **Queue** → **"Secure your place"**

Reuse the proven design from Campus Food Finder:
- No login, no scanning required
- Students/residents get a live ticket with position counter and countdown timer
- Simple visual status indicator (e.g. screen turns green when called) rather than complex scan-based verification
- Batch calling (groups of ~8–10) rather than one-by-one
- Called status expires after a set window (~5 minutes) to manage expectations
- Staff can manually open more spaces at the end if there are no-shows (no automatic skip-and-refill logic — keep it simple)
- Dynamic estimated wait time based on actual calling rate, not a fixed estimate
- Free push notifications with a live status page as the zero-cost fallback for people without push enabled

Any vendor/community organisation running a listing should be able to opt into this feature, not just council-run ones.

---

## 7. Discovery: Map & Public Transport

### 7.1 Browsing model
**List-first, with a map toggle** (not map-first).

- Default view: a fast-loading list of listings, filterable/sortable by suburb and distance.
- A toggle lets users switch to a map view showing the same filtered results as pins.
- Rationale: list views are far cheaper to render at scale than a live interactive map for every visitor — important given the high-traffic requirement. The map remains available as an option, not the default load.

### 7.2 Public transport integration (v1 scope)
Two features, deliberately scoped to avoid the cost/complexity of a full live transit overlay:

1. **"Get directions" deep link** on every listing — opens the user's native maps app (Google Maps / Apple Maps) or the PTV Journey Planner, with the destination and transit mode pre-filled. No API integration required beyond building the correct URL scheme.
2. **Nearest-stop info** — display the nearest public transport stop(s) and approximate walk time on each listing (e.g. "6 min walk to Box Hill Station"). Source this from the **PTV Timetable API** (Victoria's public transport data API):
   - Free, but requires requesting a developer key from PTV via email (`APIKeyRequest@ptv.vic.gov.au`)
   - Data is licensed under Creative Commons Attribution 4.0 — an attribution line is required wherever this data is displayed ("Source: Licensed from Public Transport Victoria under a Creative Commons Attribution 4.0 International Licence")
   - Use the "Stops Nearby" endpoint to find stops close to a listing's coordinates
   - This data can be fetched and cached at listing-creation/update time rather than live on every page view, to reduce load

**Explicitly out of scope for v1:** a live overlay of tram/bus/train routes on the map. This is significantly more complex (ongoing GTFS data syncing, map rendering performance) and can be revisited as a v2 feature if there's demand.

---

## 8. Technical Architecture & Scaling

This is a **standalone build**, not sharing infrastructure with Campus Food Finder, but reusing the same general stack given the team's familiarity with it, adapted for high public traffic:

- **Frontend/framework:** Next.js (App Router), deployed on Vercel
  - Use **ISR (Incremental Static Regeneration) or edge caching** for listing/browse pages — most traffic is read-only browsing, so cached edge responses avoid hitting the database on every request
- **Database:** Supabase (Postgres)
  - Configure **connection pooling (Supavisor)** for high concurrent load
  - Separate project/instance from Campus Food Finder — no shared data
- **Abuse mitigation:** Rate limiting on write endpoints (listing submissions) given there's no pre-approval gate
- **Hosting/CDN:** Vercel's edge network as the primary CDN; consider Cloudflare in front if traffic scale exceeds what Vercel's caching handles comfortably
- **Repo/deployment:** New, separate GitHub repo and Vercel project

Design the config layer (branding, locality name, colour tokens, council/admin identity) so that spinning up a new instance for a different council is a configuration change, not a code change — supporting the replicability goal in Section 1.

---

## 9. Open Items / Things Claude Code Should Flag Back

- Confirm PTV API developer key request timeline (external dependency — email-based, may take time to process) before committing to the nearest-stop feature for launch
- Design of the admin approval/code-issuance flow for new vendors/organisations (equivalent to the vendor onboarding flow in Campus Food Finder) — confirm whether it should reuse the same bcrypt-hashed PIN pattern as-is or needs adjustment for this context
