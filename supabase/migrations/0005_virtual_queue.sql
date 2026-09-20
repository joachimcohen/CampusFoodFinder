-- Virtual Queue + Admin Alerts — purely additive, no existing table is
-- altered or restructured (see virtualqueuespec.md §9.2). Everything here
-- is invisible to real users until a vendor explicitly enables the queue on
-- a listing (queue_enabled defaults to false).
--
-- Design note: queue_sessions, queue_entries, and batch_calls are never
-- read or written directly by anon or authenticated Supabase clients — the
-- app always goes through a Next.js API route using the service-role key,
-- scoped in application code (mirroring assertOwnsListing's pattern for
-- listings). RLS is enabled on all three with zero policies as a
-- defense-in-depth default-deny, since nothing is meant to reach them any
-- other way. admin_alerts is the one exception: students' browsers read it
-- directly for the public feed banner, so it gets a real public-select
-- policy plus the aal2-gated admin policy (matching 0004's pattern).

-- =========================================================
-- Per-listing queue configuration
-- =========================================================

alter table listings add column if not exists queue_enabled boolean not null default false;
alter table listings add column if not exists queue_batch_size integer not null default 10;
alter table listings add column if not exists queue_no_show_minutes integer not null default 5;
alter table listings add column if not exists queue_capacity_cap integer;

-- No RLS/grant change needed — the existing "listings_public_select" policy
-- from 0001_init.sql already exposes all columns of qualifying rows, and
-- none of these carry sensitive data (same precedent as pickup_location in
-- 0003 and dietary_tags in 0002).

-- =========================================================
-- Queue tables
-- =========================================================

create table if not exists queue_sessions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  date date not null default current_date,
  status text not null default 'open' check (status in ('open', 'closed')),
  batch_size integer not null,
  no_show_window_minutes integer not null,
  capacity_cap integer,
  created_at timestamptz not null default now(),
  unique (listing_id, date)
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists queue_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references queue_sessions(id) on delete cascade,
  anonymous_token text not null,
  status text not null default 'waiting' check (status in ('waiting', 'called', 'expired', 'served')),
  joined_at timestamptz not null default now(),
  called_at timestamptz,
  push_subscription_id uuid references push_subscriptions(id) on delete set null,
  unique (session_id, anonymous_token)
);

create index if not exists idx_queue_entries_session_status_joined
  on queue_entries(session_id, status, joined_at);

create table if not exists batch_calls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references queue_sessions(id) on delete cascade,
  called_at timestamptz not null default now(),
  batch_size_called integer not null
);

create index if not exists idx_batch_calls_session_called
  on batch_calls(session_id, called_at desc);

alter table queue_sessions enable row level security;
alter table queue_entries enable row level security;
alter table batch_calls enable row level security;
alter table push_subscriptions enable row level security;
-- Deliberately no policies on any of the four tables above — see the note
-- at the top of this file. Only the service-role key (which bypasses RLS
-- entirely) ever touches them, from Next.js API routes.

-- =========================================================
-- Admin alerts (recalls & advisories)
-- =========================================================

create table if not exists admin_alerts (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  severity text not null check (severity in ('recall', 'advisory', 'general')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  active boolean not null default true
);

alter table admin_alerts enable row level security;

-- Students (and anyone else) read only active alerts, directly from the
-- browser — this drives the public feed banner.
create policy "admin_alerts_public_select" on admin_alerts
  for select to anon, authenticated
  using (active = true);

-- Same aal2-required pattern as 0004_require_aal2_for_admin_writes.sql:
-- a password alone (aal1) is not enough to post or manage alerts.
create policy "admin_alerts_admin_all" on admin_alerts
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');
