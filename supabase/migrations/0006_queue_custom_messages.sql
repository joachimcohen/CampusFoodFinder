-- Lets a vendor set optional custom text shown on the student's queue
-- screen: one message while waiting (e.g. "Grab a coffee from the market
-- while you wait!") and one after being served (e.g. "Take a look at these
-- recipes!"). Purely additive, nullable, defaults to nothing shown.

alter table listings add column if not exists queue_waiting_message text;
alter table listings add column if not exists queue_served_message text;

-- No RLS/grant change needed — same as queue_enabled etc. in 0005, the
-- existing "listings_public_select" policy already exposes all columns of
-- qualifying rows.
