-- Campus Food Finder — initial schema, RLS policies, storage bucket, seed data
-- Run this once in the Supabase SQL Editor (or via `supabase db push`) on a fresh project.

create extension if not exists pgcrypto;

-- =========================================================
-- Tables
-- =========================================================

create table if not exists campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references campuses(id) on delete restrict,
  name text not null,
  slug text not null unique,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  contact_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  campus_id uuid not null references campuses(id) on delete restrict,

  food_type text not null check (
    food_type in ('free_giveaway', 'discounted', 'daily_special', 'recurring_event', 'one_off_event')
  ),
  schedule_type text not null check (schedule_type in ('one_time', 'recurring')),

  title text not null,
  description text,
  price numeric(10, 2),
  photo_url text,

  -- one_time fields
  starts_at timestamptz,
  expires_at timestamptz,

  -- recurring fields
  recurrence_days text[],
  recurrence_time_start time,
  recurrence_time_end time,
  recurrence_valid_until date,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint one_time_fields_present check (
    schedule_type <> 'one_time' or (starts_at is not null and expires_at is not null)
  ),
  constraint recurring_fields_present check (
    schedule_type <> 'recurring' or (
      recurrence_days is not null and array_length(recurrence_days, 1) > 0
      and recurrence_time_start is not null and recurrence_time_end is not null
    )
  ),
  constraint recurrence_days_valid check (
    recurrence_days is null or recurrence_days <@ array[
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
    ]
  )
);

create index if not exists idx_listings_campus_id on listings(campus_id);
create index if not exists idx_listings_vendor_id on listings(vendor_id);
create index if not exists idx_listings_active on listings(is_active);
create index if not exists idx_vendors_campus_id on vendors(campus_id);

-- =========================================================
-- updated_at trigger for listings
-- =========================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_listings_updated_at on listings;
create trigger trg_listings_updated_at
  before update on listings
  for each row
  execute function set_updated_at();

-- =========================================================
-- Row Level Security
-- =========================================================

alter table campuses enable row level security;
alter table vendors enable row level security;
alter table listings enable row level security;

-- campuses: public read, admin full CRUD
create policy "campuses_public_select" on campuses
  for select to anon, authenticated
  using (true);

create policy "campuses_admin_all" on campuses
  for all to authenticated
  using (true)
  with check (true);

-- vendors: admins (Supabase Auth) get full CRUD. PIN checks and vendor-scoped
-- writes happen server-side via the service role key, which bypasses RLS —
-- the anon key never touches pin_hash, failed_attempts, locked_until, or
-- contact_note.
--
-- Exception, deliberately narrow: the public feed (Section 3) must show each
-- listing's vendor name, which means *some* anon read access to `vendors` is
-- unavoidable. Rather than opening the whole row, we restrict anon to a
-- column allowlist (id, name, slug, campus_id, is_active) below — the same
-- "no direct access to sensitive vendor data" guarantee Section 6 asks for,
-- just scoped to columns instead of the whole table.
create policy "vendors_admin_all" on vendors
  for all to authenticated
  using (true)
  with check (true);

create policy "vendors_public_select_safe_columns" on vendors
  for select to anon
  using (is_active = true);

revoke select on vendors from anon;
grant select (id, name, slug, campus_id, is_active) on vendors to anon;

-- listings: public read of active, non-expired listings only.
-- Vendor writes go through server-side API routes using the service role
-- key (bypasses RLS, scoped to vendor_id in application code). Admins get
-- full CRUD directly.
create policy "listings_public_select" on listings
  for select to anon, authenticated
  using (
    is_active = true
    and (
      (schedule_type = 'one_time' and expires_at > now())
      or (
        schedule_type = 'recurring'
        and (recurrence_valid_until is null or recurrence_valid_until >= current_date)
      )
    )
  );

create policy "listings_admin_all" on listings
  for all to authenticated
  using (true)
  with check (true);

-- =========================================================
-- Storage: listing-photos bucket
-- =========================================================

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

create policy "listing_photos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'listing-photos');

-- Writes to listing-photos happen server-side (service role key, after PIN
-- check) or via an authenticated admin session — never directly from an
-- anon client.
create policy "listing_photos_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-photos');

create policy "listing_photos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'listing-photos');

create policy "listing_photos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-photos');

-- =========================================================
-- Seed data — the four known campuses (Section 10 of the spec)
-- =========================================================

insert into campuses (name, slug) values
  ('Waterfront', 'waterfront'),
  ('Burwood', 'burwood'),
  ('Waurn Ponds', 'waurn-ponds'),
  ('Warrnambool', 'warrnambool')
on conflict (slug) do nothing;
