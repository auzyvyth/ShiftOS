-- The ID check is for the Verified badge, not a gate on listings (owner,
-- 2026-10-17). Undoes 20261011b: public_car_listings stops hiding cars whose
-- seller has no profiles.is_verified. dealer_is_verified stays a column, so the
-- badge still reads from it.
--
-- Same column list, so CREATE OR REPLACE keeps every grant and the
-- get_salesman_featured_listings dependency. Built from the LIVE definition;
-- refuses to run if the clause is not there exactly as 20261011b wrote it.
-- One statement, one schema reload. Apply after 22:00 MYT unless the owner
-- says now.
begin;
do $$
declare
  v_def text := pg_get_viewdef('public.public_car_listings'::regclass, true);
  v_new text;
begin
  v_new := regexp_replace(
    v_def,
    '\s+AND \(EXISTS \( SELECT 1\s+FROM profiles pv\s+WHERE pv\.id = cl\.dealer_id AND pv\.is_verified = true\)\);\s*$',
    ';');
  if v_new = v_def then
    raise exception 'public_car_listings: is_verified gate not found as expected; check the live view';
  end if;
  execute 'create or replace view public.public_car_listings as ' || v_new;
end $$;
commit;

-- Check afterwards: unverified sellers' live cars are back.
--   select count(*) filter (where not coalesce(dealer_is_verified, false)) from public_car_listings;
