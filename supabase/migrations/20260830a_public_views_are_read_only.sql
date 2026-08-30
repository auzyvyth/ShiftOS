-- SEC-3: public_dealer_profiles / public_car_listings were WRITABLE by anon.
--
-- Both views are owned by postgres and profiles/car_listings do NOT force RLS,
-- so every statement through them runs with the owner's privileges (the
-- "security_definer_view" advisor ERROR). public_dealer_profiles is a plain
-- single-table view => Postgres auto-updatable => PostgREST exposes INSERT,
-- UPDATE and DELETE on it. The grants said anon=arwxtm / authenticated=arwdDxtm.
--
-- Proven live before this migration (both probes rolled back):
--   * role anon        : UPDATE rewrote the XDRIVE dealer's whatsapp_number.
--   * role authenticated: DELETE removed the underlying public.profiles row.
-- Guest buyers hold `authenticated` (anonymous sign-in for in-app chat), so any
-- visitor could repoint a dealer's enquiry number or delete the account outright.
--
-- 20260427 already revoked these once (see
-- 20260427_add_email_phone_to_public_dealer_profiles.sql). 20260815b recreated
-- the view with CREATE OR REPLACE and re-granted SELECT only, and the write
-- grants came back out-of-band. This migration re-revokes and is the tracked
-- record so the next CREATE OR REPLACE does not silently reopen it.
--
-- These views must stay SECURITY DEFINER: flipping them to security_invoker
-- would make anon read profiles/car_listings under RLS directly, and no anon
-- SELECT policy on profiles exists -> the footer, storefront and slug redirect
-- would go blank. Read-only + definer is the correct shape here.

revoke insert, update, delete, truncate, references, trigger
  on public.public_dealer_profiles from anon, authenticated, public;

revoke insert, update, delete, truncate, references, trigger
  on public.public_car_listings from anon, authenticated, public;

grant select on public.public_dealer_profiles to anon, authenticated;
grant select on public.public_car_listings  to anon, authenticated;
