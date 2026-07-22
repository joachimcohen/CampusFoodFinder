-- Require completed TOTP MFA (Authenticator Assurance Level 2) for all
-- authenticated admin access to vendors/campuses/listings.
--
-- Previously these policies only checked `to authenticated` — i.e. any
-- logged-in Supabase user, regardless of whether they'd completed their TOTP
-- challenge. Admin MFA is "required" by the app's page layout (which
-- redirects to /admin/mfa/verify until aal2 is reached), but that's a UI
-- gate, not a data gate: anyone with just the admin's password (not the
-- TOTP secret) could call the Supabase client or the admin API routes
-- directly and read/write this data at aal1, bypassing MFA entirely.
--
-- auth.jwt()->>'aal' reflects the assurance level of the current session's
-- JWT, so this closes the gap at the database layer for every access path
-- (browser Supabase client, and the API routes that use the cookie-scoped
-- server client, e.g. app/api/admin/vendors/route.ts and
-- app/api/admin/vendors/[id]/reset-pin/route.ts) at once.

drop policy if exists "vendors_admin_all" on vendors;
create policy "vendors_admin_all" on vendors
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "campuses_admin_all" on campuses;
create policy "campuses_admin_all" on campuses
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');

drop policy if exists "listings_admin_all" on listings;
create policy "listings_admin_all" on listings
  for all to authenticated
  using ((auth.jwt() ->> 'aal') = 'aal2')
  with check ((auth.jwt() ->> 'aal') = 'aal2');
