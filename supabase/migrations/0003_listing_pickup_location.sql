-- Per-listing pickup location/instructions, for vendors without a fixed spot
-- (e.g. a mobile stall) who need to specify where a given listing can be
-- collected. Takes priority over the vendor's general `location` on display
-- when set; the app falls back to vendor.location otherwise.

alter table listings add column if not exists pickup_location text;

-- No RLS/grant change needed — the existing "listings_public_select" policy
-- from 0001_init.sql already exposes all columns of qualifying rows, and
-- this field carries no sensitive data.
