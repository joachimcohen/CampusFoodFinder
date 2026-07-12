import { createClient } from "@/lib/supabase/server";
import type { Campus, Listing, PublicVendor } from "@/lib/types";
import AdminDashboard from "./AdminDashboard";

export const revalidate = 0;

// Never select pin_hash here — this data is serialized into the client
// bundle for the (client-side) AdminDashboard component, and a vendor's
// bcrypt hash has no reason to ever reach the browser.
const VENDOR_ADMIN_COLUMNS =
  "id, campus_id, name, slug, failed_attempts, locked_until, contact_note, is_active, created_at";

export default async function AdminPage() {
  const supabase = await createClient();

  const [{ data: campuses }, { data: vendors }, { data: listings }] = await Promise.all([
    supabase.from("campuses").select("*").order("name"),
    supabase.from("vendors").select(VENDOR_ADMIN_COLUMNS).order("name"),
    supabase.from("listings").select("*").order("created_at", { ascending: false }),
  ]);

  return (
    <AdminDashboard
      initialCampuses={(campuses ?? []) as Campus[]}
      initialVendors={(vendors ?? []) as PublicVendor[]}
      initialListings={(listings ?? []) as Listing[]}
    />
  );
}
