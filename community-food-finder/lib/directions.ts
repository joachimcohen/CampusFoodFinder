/**
 * "Get directions" deep links (Section 7.2) — no API integration needed
 * beyond building the right URL. Google Maps' URL scheme opens the native
 * app on iOS/Android when installed and falls back to the web on desktop;
 * Apple Maps is offered as a second option for iOS users who prefer it.
 */

export function googleMapsDirectionsUrl(lat: number, lng: number, label?: string): string {
  const destination = label ? `${lat},${lng}(${encodeURIComponent(label)})` : `${lat},${lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=transit`;
}

export function appleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=r`;
}

/**
 * PTV Journey Planner deep link. PTV's JP primarily expects place names or
 * stop IDs rather than raw coordinates — this lat/lng form is a best-effort
 * link that PTV's site will attempt to resolve. Verify against
 * ptv.vic.gov.au/journey before relying on it for launch (Section 9 flags
 * the PTV integration generally as needing confirmation).
 */
export function ptvJourneyPlannerUrl(lat: number, lng: number): string {
  return `https://www.ptv.vic.gov.au/journey/?to=${lat},${lng}`;
}
