-- Discount vouchers: a listing type where students reserve a numbered,
-- single-use voucher (e.g. "$5 off" or "20% off"), up to a fixed total.
-- Staff mark each voucher used at the counter.
--
-- Additive: existing listings are unaffected. No student data is stored;
-- a voucher is tied only to a random token held on the student's device,
-- and the optional one-per-week limit reuses listing_claims (0008).

-- =========================================================
-- New listing type
-- =========================================================

alter table listings drop constraint if exists listings_food_type_check;
alter table listings add constraint listings_food_type_check check (
  food_type in ('free_giveaway', 'discounted', 'daily_special', 'recurring_event', 'one_off_event', 'discount_voucher')
);

-- =========================================================
-- Voucher settings on the listing
-- =========================================================

alter table listings add column if not exists voucher_discount_type text
  check (voucher_discount_type is null or voucher_discount_type in ('amount', 'percent'));
alter table listings add column if not exists voucher_discount_value numeric(10, 2)
  check (voucher_discount_value is null or voucher_discount_value > 0);
alter table listings add column if not exists voucher_total integer
  check (voucher_total is null or voucher_total between 1 and 100000);
-- Kept up to date by claim_voucher() so the public feed can show "214 of
-- 300 left" without reading the vouchers table.
alter table listings add column if not exists voucher_claimed_count integer not null default 0;
alter table listings add column if not exists voucher_conditions text;
alter table listings add column if not exists voucher_reserved_message text;
alter table listings add column if not exists voucher_used_message text;

-- No RLS change needed: these are listing details anyone can already read.

-- =========================================================
-- Vouchers
-- =========================================================

create table if not exists vouchers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  number integer not null,
  -- Random secret held on the student's device to prove the voucher is
  -- theirs (same idea as a queue ticket's token). Never shown to staff.
  token text not null,
  claimed_at timestamptz not null default now(),
  used_at timestamptz,
  unique (listing_id, number)
);

create index if not exists idx_vouchers_listing_number on vouchers(listing_id, number desc);

alter table vouchers enable row level security;
-- No policies: only the app's server (service role) reads or writes vouchers.

-- =========================================================
-- Claiming: numbered, never over the total, safe under load
-- =========================================================

-- Locks the listing row while it hands out the next number, so two
-- students tapping at the same moment can't both get #300 or go past the
-- total. Returns the new voucher, or nothing when all are claimed.
create or replace function claim_voucher(p_listing_id uuid, p_token text)
returns table (voucher_id uuid, voucher_number integer, voucher_total integer, claimed_at timestamptz)
language plpgsql
as $$
declare
  v_total integer;
  v_claimed integer;
begin
  select l.voucher_total, l.voucher_claimed_count
    into v_total, v_claimed
    from listings l
   where l.id = p_listing_id and l.food_type = 'discount_voucher'
   for update;

  if v_total is null or v_claimed >= v_total then
    return;
  end if;

  update listings set voucher_claimed_count = v_claimed + 1 where id = p_listing_id;

  return query
    insert into vouchers (listing_id, number, token)
    values (p_listing_id, v_claimed + 1, p_token)
    returning vouchers.id, vouchers.number, v_total, vouchers.claimed_at;
end;
$$;

revoke all on function claim_voucher(uuid, text) from public, anon, authenticated;
grant execute on function claim_voucher(uuid, text) to service_role;
