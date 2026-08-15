import "server-only";
import crypto from "crypto";

/**
 * PTV Timetable API v3 client — Section 7.2 "Nearest-stop info". Free, but
 * requires a developer ID + API key requested by email from PTV
 * (APIKeyRequest@ptv.vic.gov.au) before this does anything; see Section 9's
 * open item. Every request is HMAC-SHA1 signed: the signature covers the
 * request path+query (including devid) and is computed with the API key as
 * the HMAC secret, uppercase hex, appended as a final `signature` param.
 *
 * The exact endpoint below (`/v3/stops/location/{lat},{lng}`) matches PTV's
 * published v3 API — worth a quick sanity check against the Swagger UI at
 * timetableapi.ptv.vic.gov.au/swagger/ui/index once a real dev key is in
 * hand, before this goes live.
 */

const BASE_URL = "https://timetableapi.ptv.vic.gov.au";
const MAX_RESULTS = 1;

function signedUrl(pathWithQuery: string, devId: string, apiKey: string): string {
  const withDevId = `${pathWithQuery}${pathWithQuery.includes("?") ? "&" : "?"}devid=${devId}`;
  const signature = crypto.createHmac("sha1", apiKey).update(withDevId).digest("hex").toUpperCase();
  return `${BASE_URL}${withDevId}&signature=${signature}`;
}

export interface NearestStop {
  name: string;
  distanceMeters: number;
  walkMinutes: number;
}

const AVERAGE_WALK_SPEED_M_PER_MIN = 80; // ~4.8km/h — a simple, rounded estimate

interface PtvStopsNearbyResponse {
  stops?: { stop_name: string; stop_distance: number }[];
}

/** Fetches the single nearest PT stop to a listing's coordinates. Returns null if PTV isn't configured yet, or on any API error. */
export async function fetchNearestStop(lat: number, lng: number): Promise<NearestStop | null> {
  const devId = process.env.PTV_DEV_ID;
  const apiKey = process.env.PTV_API_KEY;
  if (!devId || !apiKey) return null;

  try {
    const path = `/v3/stops/location/${lat},${lng}?max_results=${MAX_RESULTS}`;
    const url = signedUrl(path, devId, apiKey);
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const data = (await res.json()) as PtvStopsNearbyResponse;
    const stop = data.stops?.[0];
    if (!stop) return null;

    const distanceMeters = Math.round(stop.stop_distance ?? 0);
    return {
      name: stop.stop_name,
      distanceMeters,
      walkMinutes: Math.max(1, Math.round(distanceMeters / AVERAGE_WALK_SPEED_M_PER_MIN)),
    };
  } catch (err) {
    console.error("PTV stops-nearby lookup failed", err);
    return null;
  }
}
