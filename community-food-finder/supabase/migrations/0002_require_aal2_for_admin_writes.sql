-- Require completed TOTP MFA (Authenticator Assurance Level 2) for all
-- authenticated admin access to regions/suburbs/organisations/listings/
-- queue tables. Mirrors Campus Food Finder's 0004 migration: without this,
-- any logged-in Supabase user at aal1 (password only, no TOTP) could call
-- the Supabase client or the admin API routes directly and read/write this
-- data, bypassing the MFA the app's page layout enforces as a UI gate.
--
-- auth.jwt()->>'aal' reflects the assurance level of the current session's
-- JWT, so this closes the gap at the database layer for every access path
-- at once.

drop policy if exists "regions_admin_all" on regions;
create policy "regions_admin_all" on regions
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "suburbs_admin_all" on suburbs;
create policy "suburbs_admin_all" on suburbs
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "organisations_admin_all" on organisations;
create policy "organisations_admin_all" on organisations
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "listings_admin_all" on listings;
create policy "listings_admin_all" on listings
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "queue_tickets_admin_all" on queue_tickets;
create policy "queue_tickets_admin_all" on queue_tickets
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "queue_calls_admin_all" on queue_calls;
create policy "queue_calls_admin_all" on queue_calls
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');
