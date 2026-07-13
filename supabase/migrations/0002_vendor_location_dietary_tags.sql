-- Adds vendor location (e.g. building/room, distinct from campus) and
-- per-listing dietary tags. Run after 0001_init.sql.

-- =========================================================
-- Vendor location
-- =========================================================

alter table vendors add column if not exists location text;

-- vendors' anon column grant is additive — this widens the existing
-- (id, name, slug, campus_id, is_active) allowlist from 0001_init.sql to
-- also expose location, so the public feed can show "where" a vendor is
-- without opening any other column (pin_hash, contact_note, etc. stay hidden).
grant select (location) on vendors to anon;

-- =========================================================
-- Listing dietary tags
-- =========================================================

alter table listings add column if not exists dietary_tags text[];

alter table listings drop constraint if exists dietary_tags_valid;
alter table listings add constraint dietary_tags_valid check (
  dietary_tags is null or dietary_tags <@ array[
    'vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'halal', 'kosher'
  ]
);

-- No RLS change needed for listings: the existing "listings_public_select"
-- policy from 0001_init.sql already grants row-level access to every column
-- for active/non-expired listings, and dietary_tags carries no sensitive data.
