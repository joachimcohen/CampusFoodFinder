-- Community Food Finder — initial schema, RLS policies, storage bucket, seed data.
-- Run this once in the Supabase SQL Editor (or via `supabase db push`) on a
-- FRESH, standalone Supabase project — this must never point at the Campus
-- Food Finder project (spec Section 1: 100% separate infrastructure).

create extension if not exists pgcrypto;

-- =========================================================
-- Geography: region (council) -> suburbs
-- =========================================================
-- Section 3: suburbs are the "campus" equivalent, and belong to a
-- council/region so a future fork can seed a different region/suburb list
-- without any schema change.

create table if not exists regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists suburbs (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references regions(id) on delete restrict,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_suburbs_region_id on suburbs(region_id);

-- =========================================================
-- Organisations: vendors + community organisations (Section 5)
-- =========================================================
-- One account type covers both, since they share the identical
-- admin-approval + code-issuance + PIN-style login pattern from Campus Food
-- Finder's vendor model. `org_type` distinguishes them for display only.

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  suburb_id uuid not null references suburbs(id) on delete restrict,
  org_type text not null check (org_type in ('vendor', 'community_org')),
  name text not null,
  slug text not null unique,
  location text,
  access_code_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  contact_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_organisations_suburb_id on organisations(suburb_id);

-- =========================================================
-- Listings
-- =========================================================
-- Section 4: the prior build's "recurring" / "one-off" schedule types are
-- relabelled "every_week" / "special_event" throughout. Section 7.2: lat/lng
-- + a small PTV nearest-stop cache, fetched/refreshed at create/update time
-- rather than live on every page view.

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  suburb_id uuid not null references suburbs(id) on delete restrict,

  listing_type text not null check (listing_type in ('every_week', 'special_event')),

  title text not null,
  description text,
  pickup_location text,
  price numeric(10, 2),
  photo_url text,

  lat double precision,
  lng double precision,

  -- special_event fields
  starts_at timestamptz,
  expires_at timestamptz,

  -- every_week fields
  recurrence_days text[],
  recurrence_time_start time,
  recurrence_time_end time,
  recurrence_valid_until date,

  -- PTV "Stops Nearby" cache (Section 7.2) — null until first fetched, or if
  -- PTV_DEV_ID/PTV_API_KEY aren't configured yet
  transit_stop_name text,
  transit_stop_distance_m integer,
  transit_stop_walk_min integer,
  transit_cached_at timestamptz,

  -- Virtual queue ("Secure your place", Section 6) — opt-in per listing
  queue_enabled boolean not null default false,
  queue_status text not null default 'closed' check (queue_status in ('closed', 'open')),
  queue_run_id uuid,
  queue_next_position integer not null default 1,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint special_event_fields_present check (
    listing_type <> 'special_event' or (starts_at is not null and expires_at is not null)
  ),
  constraint every_week_fields_present check (
    listing_type <> 'every_week' or (
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

create index if not exists idx_listings_suburb_id on listings(suburb_id);
create index if not exists idx_listings_organisation_id on listings(organisation_id);
create index if not exists idx_listings_active on listings(is_active);

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
-- Virtual queue — "Secure your place" (Section 6)
-- =========================================================
-- No queue_sessions table: a listing's own queue_status/queue_run_id/
-- queue_next_position columns above ARE the current queue's state, kept
-- deliberately simple per the spec's repeated "keep it simple" guidance.
-- queue_run_id changes each time an organisation opens a fresh queue, so
-- tickets/calls from a previous run never leak into the current one.

create table if not exists queue_tickets (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  queue_run_id uuid not null,
  position integer not null,
  status text not null default 'waiting' check (
    status in ('waiting', 'called', 'expired', 'served', 'cancelled')
  ),
  joined_at timestamptz not null default now(),
  called_at timestamptz,
  expires_at timestamptz,
  push_subscription jsonb
);

create index if not exists idx_queue_tickets_run on queue_tickets(listing_id, queue_run_id, status, position);

create table if not exists queue_calls (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  queue_run_id uuid not null,
  batch_size integer not null,
  called_at timestamptz not null default now()
);

create index if not exists idx_queue_calls_run on queue_calls(listing_id, queue_run_id, called_at);

-- Atomically claims the next position and inserts the ticket, so concurrent
-- "Secure your place" requests from different phones never race on
-- queue_next_position (a plain read-then-write from application code would).
create or replace function join_queue_ticket(p_listing_id uuid)
returns queue_tickets
language plpgsql
as $$
declare
  v_run_id uuid;
  v_position integer;
  v_ticket queue_tickets;
begin
  update listings
  set queue_next_position = queue_next_position + 1
  where id = p_listing_id and queue_status = 'open'
  returning queue_run_id, queue_next_position - 1 into v_run_id, v_position;

  if v_run_id is null then
    raise exception 'queue_not_open';
  end if;

  insert into queue_tickets (listing_id, queue_run_id, position, status, joined_at)
  values (p_listing_id, v_run_id, v_position, 'waiting', now())
  returning * into v_ticket;

  return v_ticket;
end;
$$;

-- =========================================================
-- Rate limiting (Section 8 — write endpoints have no pre-approval gate)
-- =========================================================
-- A tiny Postgres-backed sliding-window counter. Serverless functions can't
-- share in-memory state across invocations, so this table is the shared
-- state; api/cron/keep-alive prunes rows older than a day so it never grows
-- unbounded.

create table if not exists rate_limit_events (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_key_created on rate_limit_events(key, created_at);

-- =========================================================
-- Row Level Security
-- =========================================================

alter table regions enable row level security;
alter table suburbs enable row level security;
alter table organisations enable row level security;
alter table listings enable row level security;
alter table queue_tickets enable row level security;
alter table queue_calls enable row level security;
alter table rate_limit_events enable row level security;

-- regions / suburbs: public read, admin full CRUD (aal2 — see 0002)
create policy "regions_public_select" on regions
  for select to anon, authenticated
  using (true);

create policy "regions_admin_all" on regions
  for all to authenticated
  using (true)
  with check (true);

create policy "suburbs_public_select" on suburbs
  for select to anon, authenticated
  using (true);

create policy "suburbs_admin_all" on suburbs
  for all to authenticated
  using (true)
  with check (true);

-- organisations: admins get full CRUD. Access-code checks and org-scoped
-- writes happen server-side via the service role key (bypasses RLS) — the
-- anon key never touches access_code_hash, failed_attempts, locked_until,
-- or contact_note. The public feed needs each listing's organisation name,
-- so anon gets a narrow column allowlist, same technique as Campus Food
-- Finder's vendors table.
create policy "organisations_admin_all" on organisations
  for all to authenticated
  using (true)
  with check (true);

create policy "organisations_public_select_safe_columns" on organisations
  for select to anon
  using (is_active = true);

revoke select on organisations from anon;
grant select (id, name, slug, org_type, suburb_id, location, is_active) on organisations to anon;

-- listings: public read of active, non-expired listings only. Organisation
-- writes go through server-side API routes using the service role key
-- (scoped to organisation_id in application code). Admins get full CRUD.
create policy "listings_public_select" on listings
  for select to anon, authenticated
  using (
    is_active = true
    and (
      (listing_type = 'special_event' and expires_at > now())
      or (
        listing_type = 'every_week'
        and (recurrence_valid_until is null or recurrence_valid_until >= current_date)
      )
    )
  );

create policy "listings_admin_all" on listings
  for all to authenticated
  using (true)
  with check (true);

-- queue_tickets / queue_calls / rate_limit_events: no anon or authenticated
-- policies for writes or reads from the browser at all. Every access path —
-- joining a queue, polling ticket status, calling a batch, rate-limit
-- checks — goes through a server API route using the service role key. This
-- keeps "no login required" for the public queue UI without opening direct
-- table access (Section 6's "no scanning, no login" is a UX property, not a
-- reason to relax the data layer). Admins can still query them directly for
-- support via the SQL editor (aal2-gated, matching every other admin policy).
create policy "queue_tickets_admin_all" on queue_tickets
  for all to authenticated
  using (true)
  with check (true);

create policy "queue_calls_admin_all" on queue_calls
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

-- Writes to listing-photos happen server-side (service role key, after
-- access-code check) or via an authenticated admin session — never directly
-- from an anon client.
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
-- Seed data — Whitehorse City Council launch suburbs (Section 3)
-- =========================================================

insert into regions (name, slug) values
  ('Whitehorse City Council', 'whitehorse')
on conflict (slug) do nothing;

insert into suburbs (region_id, name, slug)
select r.id, s.name, s.slug
from regions r
cross join (values
  ('Box Hill', 'box-hill'),
  ('Burwood', 'burwood'),
  ('Burwood East', 'burwood-east'),
  ('Blackburn', 'blackburn'),
  ('Forest Hill', 'forest-hill'),
  ('Mitcham', 'mitcham'),
  ('Mont Albert', 'mont-albert'),
  ('Nunawading', 'nunawading'),
  ('Vermont', 'vermont'),
  ('Vermont South', 'vermont-south')
) as s(name, slug)
where r.slug = 'whitehorse'
on conflict (slug) do nothing;
