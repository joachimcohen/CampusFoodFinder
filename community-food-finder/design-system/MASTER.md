# Community Food Finder — Design System (MASTER)

Adapted from Campus Food Finder's Filter-Heavy Grid pattern (sticky filters + card feed), with a
new colour and type direction driven by spec Section 2's explicit brief: **black and red,
inspired by the old Woolworths home-brand product packaging — bold, high-contrast, no-frills,
utilitarian.**

## Pattern

- **Shape:** Black sticky header (product name + locality, list/map toggle) → sticky
  horizontally-scrollable filter chips (suburb, then listing type, then a distance-sort toggle) →
  single-column card feed on mobile, responsive grid from tablet up. A map toggle swaps the same
  filtered results into pin view (Section 7.1 — list-first, not map-first).
- **Sections:** 1. Header, 2. Filters, 3. "Happening Now" card group, 4. "Coming Up" card group,
  5. "Every Week" card group, 6. Empty state when a filter yields nothing.

## Colours

Two colours doing all the brand work, per the brief — no gradient, no secondary hue family (a
deliberate contrast with Campus Food Finder's teal/purple system).

| Role | Hex | CSS Variable | Usage |
|---|---|---|---|
| Primary (red) | `#C8102E` | `--color-primary` | CTAs, active filter chips, "Special event" badge, focus ring |
| Primary (hover) | `#A30D26` | `--color-primary-hover` | Hover/pressed state |
| On Primary | `#FFFFFF` | `--color-on-primary` | Text/icons on red surfaces |
| Header background | `#0A0A0A` | `--color-header-bg` | Black "base" surface — header/nav, "Every week" badge |
| Background | `#FFFFFF` | `--color-background` | Card/page background — kept white for scan-speed and print-style contrast, matching the packaging reference |
| Foreground | `#0A0A0A` | `--color-foreground` | Body text |
| Muted | `#F2F2F2` | `--color-muted` | Card icon backgrounds, form field fill |
| Border | `#E0E0E0` | `--color-border` | Card/chip borders |
| Destructive | `#C8102E` | `--color-destructive` | Delete/lockout actions — reuses brand red rather than a third colour, consistent with the "black and red only" brief |

Contrast check: white text on `#C8102E` measures ~5.9:1 (WCAG AA, verified via relative-luminance
calculation), comfortably clearing the 4.5:1 minimum. White text on `#0A0A0A` clears easily as
near-black-on-white's inverse.

### Listing-type badges (Section 4)

Two listing types, two colours — "Every week" gets the black badge, "Special event" gets red.
No third colour needed since there are only two categories (unlike Campus Food Finder's five
food types, which needed a computed gradient).

### Queue status colour (Section 6 — one deliberate exception)

The "screen turns green when called" requirement is a named, specific UX affordance in the spec,
not brand territory — so `--color-status-called: #1B8A3D` is the one departure from black/red,
scoped entirely to the "Secure your place" ticket screen.

## Typography

- **Family:** Archivo (`next/font/google`), weights 400/500/700/900 — a bold grotesk that reads
  as utilitarian/packaging-style at the 900 weight used for the product name and prices, while
  staying legible at body weights.
- **Weight scale:** Black 900 for the product name and section headers, Bold 700 for card titles
  and buttons, Medium 500 for filter chips, Regular 400 for body copy.

## Key Effects

- Card hover: subtle lift + border tint, 150–300ms
- Large touch targets (min 44px)
- `prefers-reduced-motion` respected
- Urgency label ("Ends in 40 min") pulses subtly only when < 60 min remain

## Anti-patterns (avoid)

- No emojis as icons — SVG (Lucide) only
- No third brand colour introduced for "just one more category" — extend the black/red badge
  pair with pattern (border style, icon) before reaching for a new hue
- Stale "happening now" data — feed logic re-derives "now" client-side every 60s

## Pre-delivery checklist

- [ ] No emojis as icons — SVG (Lucide) only
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth 150–300ms transitions
- [ ] Text contrast ≥ 4.5:1
- [ ] Visible focus states for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive at 375px, 768px, 1024px, 1440px
- [ ] Every filter chip and card meets the 44px minimum touch target
