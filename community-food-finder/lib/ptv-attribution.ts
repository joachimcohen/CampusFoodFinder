/**
 * Required attribution wherever PTV data is displayed (CC BY 4.0 licence,
 * Section 7.2). Split out from lib/ptv.ts (which is server-only, since it
 * signs and makes the actual API calls) so client components like
 * TransitInfo can show this string without pulling `server-only` into the
 * browser bundle.
 */
export const PTV_ATTRIBUTION =
  "Source: Licensed from Public Transport Victoria under a Creative Commons Attribution 4.0 International Licence";
