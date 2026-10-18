import { createClient } from "@/lib/supabase/server";
import type { AdminAlert, Campus, ListingWithRelations } from "@/lib/types";
import Feed from "@/components/Feed";
import StudentGate from "@/components/StudentGate";

export const revalidate = 0;

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: campuses }, { data: listings }, { data: alerts }] = await Promise.all([
    supabase.from("campuses").select("id,name,slug,created_at").order("name"),
    supabase
      .from("listings")
      .select("*, vendor:vendors!inner(id,name,slug,location), campus:campuses!inner(id,name,slug)")
      .order("created_at", { ascending: false }),
    supabase.from("admin_alerts").select("*").eq("active", true).order("created_at", { ascending: false }),
  ]);

  return (
    <StudentGate>
      <Feed
        campuses={(campuses ?? []) as Campus[]}
        initialListings={(listings ?? []) as unknown as ListingWithRelations[]}
        alerts={(alerts ?? []) as AdminAlert[]}
      />
    </StudentGate>
  );
}
