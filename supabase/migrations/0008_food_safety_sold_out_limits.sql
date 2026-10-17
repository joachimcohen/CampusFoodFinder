-- Food safety labels, "sold out but still visible", and optional per-listing
-- collection limits (one per device or one per student number per week).
--
-- Purely additive: every new listing column defaults to "off", so existing
-- listings behave exactly as before until a vendor opts in.
--
-- Privacy design: no student names, emails or raw student numbers are ever
-- stored. A device is identified by a random code the browser generates; a
-- student number (only when a listing requires one) is reduced server-side
-- to a keyed hash (HMAC with STUDENT_ID_HASH_SECRET) before it touches the
-- database. Both are deleted after 14 days by the daily cron.

-- =========================================================
-- Listing columns
-- =========================================================

-- Food safety label (vendor-supplied)
alter table listings add column if not exists food_safety_enabled boolean not null default false;
alter table listings add column if not exists food_storage text
  check (food_storage is null or food_storage in ('fridge', 'freezer', 'shelf_stable'));
alter table listings add column if not exists food_eat_within_hours integer
  check (food_eat_within_hours is null or food_eat_within_hours between 1 and 168);
alter table listings add column if not exists food_reheat_instructions text;
alter table listings add column if not exists food_allergens text;
alter table listings add column if not exists food_donor_declared_at timestamptz;
-- Bumped automatically whenever any label field changes, so an
-- acknowledgement always records exactly which wording the student saw.
alter table listings add column if not exists food_label_version integer not null default 1;

-- Sold out: closed to new claims but still shown (greyed) for a while.
alter table listings add column if not exists sold_out_at timestamptz;
alter table listings add column if not exists sold_out_visible_hours integer not null default 12
  check (sold_out_visible_hours between 1 and 72);

-- Collection limits
alter table listings add column if not exists limit_one_per_week boolean not null default false;
alter table listings add column if not exists require_student_number boolean not null default false;

-- =========================================================
-- Label version trigger
-- =========================================================

create or replace function bump_food_label_version()
returns trigger as $$
begin
  if (new.food_storage, new.food_eat_within_hours, new.food_reheat_instructions, new.food_allergens)
     is distinct from
     (old.food_storage, old.food_eat_within_hours, old.food_reheat_instructions, old.food_allergens) then
    new.food_label_version = old.food_label_version + 1;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_listings_food_label_version on listings;
create trigger trg_listings_food_label_version
  before update on listings
  for each row
  execute function bump_food_label_version();

-- =========================================================
-- Public read: also show listings that sold out recently, even if their
-- one-time window has since ended. Replaces the 0001 policy.
-- =========================================================

drop policy if exists "listings_public_select" on listings;
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
      or (sold_out_at is not null and sold_out_at > now() - make_interval(hours => sold_out_visible_hours))
    )
  );

-- =========================================================
-- Acknowledgements and claims (service role only)
-- =========================================================

-- Proof that the label was shown and acknowledged. Deliberately holds no
-- device or student identifier: just which label version, when, and the
-- short code shown on the student's screen.
create table if not exists food_label_acks (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  label_version integer not null,
  ack_code text not null,
  queue_entry_id uuid references queue_entries(id) on delete set null,
  acknowledged_at timestamptz not null default now()
);

create index if not exists idx_food_label_acks_listing on food_label_acks(listing_id, acknowledged_at desc);

-- One row per collection on a limited listing. week_start is the Monday
-- (Melbourne date) the claim falls in, so the limit resets every Monday.
create table if not exists listing_claims (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  week_start date not null,
  device_hash text,
  student_hash text,
  claimed_at timestamptz not null default now(),
  constraint listing_claims_has_identifier check (device_hash is not null or student_hash is not null)
);

create unique index if not exists uq_listing_claims_device
  on listing_claims(listing_id, week_start, device_hash) where device_hash is not null;
create unique index if not exists uq_listing_claims_student
  on listing_claims(listing_id, week_start, student_hash) where student_hash is not null;

alter table food_label_acks enable row level security;
alter table listing_claims enable row level security;
-- No policies: only the service-role key (API routes) touches these, the
-- same default-deny pattern as the queue tables in 0005.
