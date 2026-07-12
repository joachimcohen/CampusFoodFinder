# Campus Food Finder — Design System (MASTER)

Generated with the **UI UX Pro Max** skill (`nextlevelbuilder/ui-ux-pro-max-skill`), category
**Food Delivery** (primary) / **Booking & Appointment** (secondary, for vendor screens), per
spec Section 7. This file is the single source of truth for colour, type, and interaction
rules across the feed, vendor, and admin pages.

## How this was generated

```
python3 scripts/search.py "food delivery listing feed cards booking appointment" --domain product
python3 scripts/search.py "mobile utility app fast scanning clean legible students PWA" --domain typography
```

Two deliberate overrides were made to the raw tool output, both consistent with Section 7's
own brief ("notes here are a starting brief, not a hard override" cuts both ways — the tool's
suggestions aren't a hard override either when they conflict with the product's actual shape):

1. **Layout pattern** — the Food Delivery category's top match is "Hero-Centric Design +
   Feature-Rich" (marketing landing page with video hero). Campus Food Finder has **no
   marketing page**; `/` is the app itself. We instead use the **Filter-Heavy Grid** pattern
   from the tool's Directory/Listing-Site match, which is built for exactly this shape:
   sticky filter chips + card grid, no hero.
2. **Typography** — the Food Delivery category's default pairing (Playfair Display SC +
   Karla) is tuned for restaurant/menu branding elegance. Section 7 explicitly asks for
   "clean, rounded sans-serif... large legible type for scanning quickly" for an audience with
   varying digital literacy. We used the tool's typography search instead and picked
   **Plus Jakarta Sans** (single family) — its own notes call out mobile approachability,
   iOS Dynamic Type / Android scaling, which matches the brief better than the category
   default.

Colour palette, key effects, anti-patterns, and the accessibility checklist below are taken
directly from the tool's Food Delivery output.

### Rebrand (v2)

The client supplied an explicit brand palette and typeface after the initial build, which
supersedes the tool-generated colours/type below: **white background, teal `#62C7CE` and
purple `#922580` doing all the colour work, Poppins typography**. The layout pattern (Filter-
Heavy Grid) and structural decisions above are unaffected — this is a colour/type reskin, not
a re-architecture. See the "Colours" and "Typography" sections below for the current values;
the tool-generated originals are struck through history in git if ever needed again.

---

## Pattern

- **Name:** Filter-Heavy Grid (Directory/Listing-Site match, adapted — see override #1 above)
- **Shape:** Sticky header → sticky horizontally-scrollable filter chips (campus, then food
  type) → single-column card feed on mobile, responsive grid from tablet up
- **Sections:** 1. Header (name + tagline), 2. Filters (sticky under header), 3. "Happening
  Now" card group, 4. "Weekly & Recurring" card group, 5. Empty state when a filter yields
  nothing

## Colours

**v2 brand palette** — white background, teal + purple doing all the colour work (client
brief). Purple carries every solid-background/white-text surface (buttons, active chips,
focus ring) because raw teal only measures ~2:1 contrast against white text — far below the
4.5:1 minimum in the checklist below — so it's unusable there. Teal instead drives tints,
icons, and secondary surfaces where that rule doesn't apply. A darkened teal (`#2A8187`,
4.6:1) fills the one spot that still needs teal-with-white-text (the secondary "food type"
filter chips' active state).

| Role | Hex | CSS Variable | Usage |
|---|---|---|---|
| Primary | `#922580` | `--color-primary` | Primary buttons, active campus chip, links, focus ring |
| Primary (hover) | `#7A1F6B` | `--color-primary-hover` | Hover/pressed state for primary actions |
| On Primary | `#FFFFFF` | `--color-on-primary` | Text/icons on primary surfaces |
| Secondary (brand teal) | `#62C7CE` | `--color-secondary` | Tints, icons, decorative accents — not for white text |
| Accent (dark teal) | `#2A8187` | `--color-accent` | Active "food type" chip, secondary CTAs needing white text |
| Background | `#FFFFFF` | `--color-background` | App background |
| Foreground | `#1A1A1A` | `--color-foreground` | Body text |
| Muted | `#EFF9FA` | `--color-muted` | Card icon backgrounds, inactive chip fill (light teal tint) |
| Border | `#ECE4EA` | `--color-border` | Card/chip borders — kept quiet/neutral so it doesn't compete with badges |
| Destructive | `#DC2626` | `--color-destructive` | Delete/deactivate actions, lockout warnings — universal red, not brand-colour territory |
| Ring | `#922580` | `--color-ring` | Focus ring |

### Food-type badge colours (Section 7 requirement — colour-coded by category)

Since the brief asks for teal and purple to do *all* the colour work, the five badges are a
computed 5-stop gradient interpolated in HSL space between the brand teal (184° hue) and
brand purple (310° hue) — rather than the previous unrelated green/orange/purple/blue/pink
set. This trades away the "green = free, discount = orange" convention some users read
instinctively, in exchange for the requested two-tone brand consistency. Each badge stop was
individually darkened only as far as needed to clear 4.5:1 contrast with white text (computed,
not eyeballed):

| Food type | Icon/tint hex (lighter) | Badge background (white text) | Contrast |
|---|---|---|---|
| Free Giveaway | `#5CC5CC` | `#2A8187` | 4.60:1 |
| Discounted | `#5A89CE` | `#3D75C5` | 4.61:1 |
| Daily Special | `#6658D0` | `#4536BE` | 8.34:1 |
| Recurring Event | `#A556D2` | `#7C2DA8` | 7.51:1 |
| One-off Event | `#D454BF` | `#922580` | 7.50:1 (exact brand purple) |

## Typography

- **Family (single):** Poppins — heading and body, per client brief ("rounded, friendly")
- **Weight scale:** ExtraBold 800 for the app title, Bold 700 for section headers ("Happening
  Now" / "Weekly & Recurring"), SemiBold 600 for card titles/vendor names and buttons, Regular
  400 for body copy (line-height 1.4–1.5)
- **Loaded via `next/font/google`** (`app/layout.tsx`) rather than a CSS `@import`, so it's
  self-hosted/optimised by Next.js instead of fetched from Google Fonts at runtime.
- **Tailwind:** `fontFamily: { sans: ['Poppins', 'sans-serif'] }` (applied via the `--font-sans`
  variable next/font injects)

## Vendor & Admin screens (Booking & Appointment secondary reference)

Vendor PIN entry and the admin dashboard borrow the **Booking & Appointment** category's
palette logic for status/state colours, since those screens are about managing state
(active/expired/locked) rather than appetite appeal — remapped to the v2 brand palette:

- Purple (`--color-primary` `#922580`) — primary actions (save, add vendor, sign in)
- Active/unlocked state — dark teal (`--color-status-active` `#2A8187`)
- Booked/expired grey (`#94A3B8`) — expired or inactive listing
- Confirm accent — reuse `--color-primary` for confirmation actions

## Key Effects

- Card hover: subtle colour-shift + 1px lift, 150–300ms
- Large touch targets (min 44px) — Section 1 calls out "varying digital literacy," keep every
  tap target generous
- `prefers-reduced-motion` respected — no motion-heavy transitions by default
- Countdown/urgency badge ("Ends in 40 min") pulses subtly only when < 60 min remain

## Anti-patterns (avoid)

- Low-quality imagery — fall back to a clean food-type icon (Heroicons/Lucide) rather than a
  broken image or blank space, never a low-res placeholder
- Outdated hours / stale "happening now" data — the feed logic must be timezone-correct and
  re-derive "now" client-side, not just at fetch time
- No emojis as icons — use SVG icon sets (Heroicons/Lucide) throughout

## Pre-delivery checklist

- [ ] No emojis as icons — SVG (Heroicons/Lucide) only
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth 150–300ms transitions
- [ ] Text contrast ≥ 4.5:1 in light mode (this app is light-mode-first per Section 7)
- [ ] Visible focus states for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive at 375px, 768px, 1024px, 1440px
- [ ] Every filter chip and card meets the 44px minimum touch target
