-- Only ID-checked sellers appear on XDrive (owner decision pending, 2026-10-11).
-- profiles.is_verified is set only by a person (superadmin) after the IC check,
-- so this is what makes "every seller is a real, checked person" true. Same
-- column list as before, so CREATE OR REPLACE keeps every grant and the
-- get_salesman_featured_listings dependency. Only the WHERE clause changes.
--
-- Built from the LIVE definition rather than a retyped copy: the view is ~100
-- lines and a transcription slip here would change what every buyer sees. The
-- guard refuses to run if the live WHERE clause is not the one this was written
-- against (20261009 state), so a later edit to the view cannot be silently mangled.
begin;
do $$
declare
  v_def  text := pg_get_viewdef('public.public_car_listings'::regclass, true);
  v_tail text := 'pr.is_active = false OR pr.account_status = ''deleted''::text)));';
begin
  if right(rtrim(v_def), length(v_tail)) <> v_tail then
    raise exception 'public_car_listings WHERE clause changed since 2026-10-11; update this migration';
  end if;
  v_def := left(rtrim(v_def), length(rtrim(v_def)) - 1)  -- drop the trailing ;
        || E'\n  AND (EXISTS ( SELECT 1 FROM profiles pv WHERE pv.id = cl.dealer_id AND pv.is_verified = true))';
  execute 'create or replace view public.public_car_listings as ' || v_def;
end $$;
commit;

-- Check afterwards (should list only verified sellers):
--   select distinct dealer_id from public_car_listings;
