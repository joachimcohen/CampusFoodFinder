/**
 * Instance/branding config — the single place that has to change to
 * re-deploy this template for a different council/region. Everything here
 * comes from env vars with the Whitehorse (Box Hill area) launch as the
 * default, so forking to a new council is "set new env vars + reseed
 * regions/suburbs in Supabase", not a code change (spec Section 1 & 8).
 *
 * The suburb list itself lives in the database (regions/suburbs tables,
 * seeded per-instance in supabase/migrations/0001_init.sql), not here.
 */

export const instanceConfig = {
  /** Generic product name — never council-branded (spec Section 2). */
  productName: "Community Food Finder",

  /** Short locality label shown next to the product name, e.g. "Whitehorse". */
  localityName: process.env.NEXT_PUBLIC_LOCALITY_NAME ?? "Whitehorse",

  /** Full council/region name, used in footers and admin copy. */
  localityFullName: process.env.NEXT_PUBLIC_LOCALITY_FULL_NAME ?? "Whitehorse City Council",

  /** IANA timezone for this instance's region — assumes a single-timezone deployment. */
  timezone: process.env.NEXT_PUBLIC_TIMEZONE ?? "Australia/Melbourne",

  /** Slug of the seeded region row this instance serves (see regions table). */
  regionSlug: process.env.NEXT_PUBLIC_REGION_SLUG ?? "whitehorse",

  /** Default map center when no listings/suburb filter narrows it — Box Hill. */
  mapDefaultCenter: {
    lat: Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_LAT ?? "-37.8199"),
    lng: Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_LNG ?? "145.1226"),
  },
} as const;

export function pageTitle(): string {
  return `${instanceConfig.productName} — ${instanceConfig.localityName}`;
}
