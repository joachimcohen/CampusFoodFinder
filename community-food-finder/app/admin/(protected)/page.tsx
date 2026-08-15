import { createClient } from "@/lib/supabase/server";
import type { Listing, PublicOrganisation, Suburb } from "@/lib/types";
import { instanceConfig } from "@/lib/config";
import AdminDashboard from "./AdminDashboard";

export const revalidate = 0;

// Never select access_code_hash here — this data is serialized into the
// client bundle for the (client-side) AdminDashboard component, and an
// organisation's bcrypt hash has no reason to ever reach the browser.
const ORG_ADMIN_COLUMNS =
  "id, suburb_id, org_type, name, slug, location, failed_attempts, locked_until, contact_note, is_active, created_at";

export default async function AdminPage() {
  const supabase = await createClient();

  const [{ data: region }, { data: suburbs }, { data: organisations }, { data: listings }] = await Promise.all([
    supabase.from("regions").select("id").eq("slug", instanceConfig.regionSlug).maybeSingle(),
    supabase.from("suburbs").select("*").order("name"),
    supabase.from("organisations").select(ORG_ADMIN_COLUMNS).order("name"),
    supabase.from("listings").select("*").order("created_at", { ascending: false }),
  ]);

  return (
    <AdminDashboard
      regionId={region?.id ?? null}
      initialSuburbs={(suburbs ?? []) as Suburb[]}
      initialOrganisations={(organisations ?? []) as PublicOrganisation[]}
      initialListings={(listings ?? []) as Listing[]}
    />
  );
}
