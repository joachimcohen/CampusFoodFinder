import { createClient } from "@/lib/supabase/server";
import type { ListingWithRelations, Suburb } from "@/lib/types";
import Feed from "@/components/Feed";

export const revalidate = 0;

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: suburbs }, { data: listings }] = await Promise.all([
    supabase.from("suburbs").select("id,region_id,name,slug,created_at").order("name"),
    supabase
      .from("listings")
      .select(
        "*, organisation:organisations!inner(id,name,slug,org_type,location), suburb:suburbs!inner(id,name,slug)"
      )
      .order("created_at", { ascending: false }),
  ]);

  return (
    <Feed
      suburbs={(suburbs ?? []) as Suburb[]}
      initialListings={(listings ?? []) as unknown as ListingWithRelations[]}
    />
  );
}
