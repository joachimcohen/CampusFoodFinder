-- Optional link to go with each custom queue message (0006), e.g. "Take a
-- look at these recipes" pointing at an actual recipes page. Rendered as a
-- tappable link/button on the student's screen — never an auto-redirect,
-- so a student can still see the "you've been served" confirmation first.

alter table listings add column if not exists queue_waiting_message_url text;
alter table listings add column if not exists queue_served_message_url text;

-- No RLS/grant change needed — same as the other queue_* columns, already
-- exposed by the existing "listings_public_select" policy.
