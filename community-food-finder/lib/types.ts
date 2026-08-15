export type ListingType = "every_week" | "special_event";

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type OrgType = "vendor" | "community_org";

export type QueueStatus = "closed" | "open";
export type TicketStatus = "waiting" | "called" | "expired" | "served" | "cancelled";

export interface Region {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Suburb {
  id: string;
  region_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Organisation {
  id: string;
  suburb_id: string;
  org_type: OrgType;
  name: string;
  slug: string;
  location: string | null;
  access_code_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  contact_note: string | null;
  is_active: boolean;
  created_at: string;
}

export type PublicOrganisation = Omit<Organisation, "access_code_hash">;

export interface Listing {
  id: string;
  organisation_id: string;
  suburb_id: string;
  listing_type: ListingType;
  title: string;
  description: string | null;
  pickup_location: string | null;
  price: number | null;
  photo_url: string | null;
  lat: number | null;
  lng: number | null;
  starts_at: string | null;
  expires_at: string | null;
  recurrence_days: Weekday[] | null;
  recurrence_time_start: string | null;
  recurrence_time_end: string | null;
  recurrence_valid_until: string | null;
  transit_stop_name: string | null;
  transit_stop_distance_m: number | null;
  transit_stop_walk_min: number | null;
  transit_cached_at: string | null;
  queue_enabled: boolean;
  queue_status: QueueStatus;
  queue_run_id: string | null;
  queue_next_position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListingWithRelations extends Listing {
  organisation: Pick<Organisation, "id" | "name" | "slug" | "org_type" | "location">;
  suburb: Pick<Suburb, "id" | "name" | "slug">;
}

export interface QueueTicket {
  id: string;
  listing_id: string;
  queue_run_id: string;
  position: number;
  status: TicketStatus;
  joined_at: string;
  called_at: string | null;
  expires_at: string | null;
  push_subscription: PushSubscriptionJSON | null;
}

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  every_week: "Every week",
  special_event: "Special event",
};

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  vendor: "Vendor",
  community_org: "Community organisation",
};

export const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
