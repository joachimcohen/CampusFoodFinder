-- Catch-up for 0008. The 0008 file changed twice before launch (student
-- numbers were removed, then clean-up indexes added), so a database may
-- have any of three versions of it. This brings every version into line
-- with the final one. Safe on any of them, and safe to run more than once.
-- Run it after 0008.

-- Early drafts stored a student-number option and a scrambled student number.
alter table listings drop column if exists require_student_number;
alter table listing_claims drop constraint if exists listing_claims_has_identifier;
drop index if exists uq_listing_claims_student;
alter table listing_claims drop column if exists student_hash;

-- Weekly claims are now matched to the device code only.
delete from listing_claims where device_hash is null;
alter table listing_claims alter column device_hash set not null;
-- One claim per device, per listing, per week. Drafts used a partial
-- unique index; the final version uses a unique constraint. Keep exactly one.
drop index if exists uq_listing_claims_device;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'listing_claims'::regclass and contype = 'u'
  ) then
    alter table listing_claims
      add constraint listing_claims_listing_id_week_start_device_hash_key
      unique (listing_id, week_start, device_hash);
  end if;
end $$;

-- Early drafts required a short code on every label tick; the app no longer
-- sends one, so without this, walk-up passes for labelled food can't save.
alter table food_label_acks drop column if exists ack_code;

-- Indexes for the daily clean-up (added to 0008 in its final version).
create index if not exists idx_listing_claims_week on listing_claims(week_start);
create index if not exists idx_food_label_acks_time on food_label_acks(acknowledged_at);
create index if not exists idx_queue_sessions_date on queue_sessions(date);
create index if not exists idx_listings_expires_at on listings(expires_at) where schedule_type = 'one_time';
