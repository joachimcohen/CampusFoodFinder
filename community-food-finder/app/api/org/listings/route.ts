import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionOrgId, isOrgActive } from "@/lib/org-auth";
import { validateListingInput } from "@/lib/listing-input";
import { fetchNearestStop } from "@/lib/ptv";
import { checkRateLimit } from "@/lib/rate-limit";

const CREATE_LIMIT = 30;
const CREATE_WINDOW_SECONDS = 3600;

export async function GET(req: NextRequest) {
  const orgId = await getSessionOrgId(req, req.headers.get("x-org-slug") ?? undefined);
  if (!orgId || !(await isOrgActive(orgId))) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listings: data });
}

export async function POST(req: NextRequest) {
  const orgId = await getSessionOrgId(req, req.headers.get("x-org-slug") ?? undefined);
  if (!orgId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const result = validateListingInput(body);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const supabase = createAdminClient();

  const allowed = await checkRateLimit(supabase, `listing-create:${orgId}`, CREATE_LIMIT, CREATE_WINDOW_SECONDS);
  if (!allowed) {
    return NextResponse.json({ error: "Too many listings created recently. Please try again later." }, { status: 429 });
  }

  const { data: org, error: fetchError } = await supabase
    .from("organisations")
    .select("suburb_id, is_active")
    .eq("id", orgId)
    .maybeSingle();

  if (fetchError) {
    console.error("org listing create: failed to fetch organisation", fetchError);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
  if (!org || !org.is_active) {
    return NextResponse.json({ error: "Organisation account is inactive." }, { status: 403 });
  }

  // Nearest-stop lookup is fetched and cached here (create time), not live
  // on every page view (Section 7.2). Silently skipped if PTV isn't
  // configured yet or the org didn't set a map location.
  let transitFields: Record<string, unknown> = {};
  if (result.input.lat !== null && result.input.lng !== null) {
    const stop = await fetchNearestStop(result.input.lat, result.input.lng);
    if (stop) {
      transitFields = {
        transit_stop_name: stop.name,
        transit_stop_distance_m: stop.distanceMeters,
        transit_stop_walk_min: stop.walkMinutes,
        transit_cached_at: new Date().toISOString(),
      };
    }
  }

  const { data, error } = await supabase
    .from("listings")
    .insert({ ...result.input, ...transitFields, organisation_id: orgId, suburb_id: org.suburb_id })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listing: data }, { status: 201 });
}
