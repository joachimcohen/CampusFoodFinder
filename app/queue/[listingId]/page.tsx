import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ListingWithRelations } from "@/lib/types";
import QueueStatus from "@/components/QueueStatus";

export const revalidate = 0;

type Props = { params: Promise<{ listingId: string }> };

export default async function QueuePage({ params }: Props) {
  const { listingId } = await params;
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("*, vendor:vendors!inner(id,name,slug,location), campus:campuses!inner(id,name,slug)")
    .eq("id", listingId)
    .maybeSingle();

  const typedListing = listing as unknown as ListingWithRelations | null;
  if (!typedListing || !typedListing.queue_enabled) notFound();

  return <QueueStatus listing={typedListing} />;
}
