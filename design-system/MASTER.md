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

---

## Pattern

- **Name:** Filter-Heavy Grid (Directory/Listing-Site match, adapted — see override #1 above)
- **Shape:** Sticky header → sticky horizontally-scrollable filter chips (campus, then food
  type) → single-column card feed on mobile, responsive grid from tablet up
- **Sections:** 1. Header (name + tagline), 2. Filters (sticky under header), 3. "Happening
  Now" card group, 4. "Weekly & Recurring" card group, 5. Empty state when a filter yields
  nothing

## Colours

Sourced from the Food Delivery palette match — "Appetizing orange + trust blue".

| Role | Hex | CSS Variable | Usage |
|---|---|---|---|
| Primary | `#EA580C` | `--color-primary` | Primary buttons, active filter chip, links |
| On Primary | `#FFFFFF` | `--color-on-primary` | Text/icons on primary surfaces |
| Secondary | `#F97316` | `--color-secondary` | Secondary accents, hover states |
| Accent/CTA | `#2563EB` | `--color-accent` | "Add listing" CTA, admin/vendor action buttons |
| Background | `#FFF7ED` | `--color-background` | App background |
| Foreground | `#0F172A` | `--color-foreground` | Body text |
| Muted | `#FDF4F0` | `--color-muted` | Card backgrounds, inactive chip fill |
| Border | `#FCEAE1` | `--color-border` | Card/chip borders |
| Destructive | `#DC2626` | `--color-destructive` | Delete/deactivate actions, lockout warnings |
| Ring | `#EA580C` | `--color-ring` | Focus ring |

### Food-type badge colours (Section 7 requirement — colour-coded by category)

| Food type | Colour | Icon/tint hex | Badge background (white text) |
|---|---|---|---|
| Free Giveaway | Green | `#16A34A` | `#15803D` |
| Discounted | Orange | `#F97316` | `#C2410C` |
| Daily Special | Purple | `#9333EA` | `#9333EA` |
| Recurring Event | Blue | `#2563EB` | `#2563EB` |
| One-off Event | Pink/Red | `#E11D48` | `#E11D48` |

Free Giveaway and Discounted needed a darker badge-only variant: at their base hue,
white text on the pill measures ~3.3:1 and ~2.8:1 respectively — both fail the 4.5:1
minimum in the checklist below. The darker variants measure ~5.0:1 and ~5.2:1. The base
hue is unchanged for icons/tints elsewhere, which aren't held to text-contrast rules.

## Typography

- **Family (single):** Plus Jakarta Sans — heading and body, per override #2 above
- **Weight scale:** ExtraBold 800 for the app title, Bold 700 for section headers ("Happening
  Now" / "Weekly & Recurring"), SemiBold 600 for card titles/vendor names and buttons, Regular
  400 for body copy (line-height 1.4–1.5)
- **Google Fonts import:**
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
  ```
- **Tailwind:** `fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] }`

## Vendor & Admin screens (Booking & Appointment secondary reference)

Vendor PIN entry and the admin dashboard borrow the **Booking & Appointment** category's
palette logic for status/state colours, since those screens are about managing state
(active/expired/locked) rather than appetite appeal:

- Trust blue (`--color-accent` `#2563EB`) — primary actions (save, add vendor)
- Available/active green (`#16A34A`) — active listing / unlocked state
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
