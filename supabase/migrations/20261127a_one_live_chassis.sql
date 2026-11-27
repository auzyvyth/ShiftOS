-- DMS-ID-1: one live car per chassis per dealer, and ONE chassis column.
-- QUEUED, not applied (DDL after midnight MYT, nobody live; see CLAUDE.md).
--
-- Why: the form only WARNED about a repeated chassis (CarForm checkDuplicate), nothing in the
-- database stopped it, and the CSV import wrote `vin` while the form writes `vin_number`
-- (6 live cars have a chassis only in `vin`). Rule: per dealer, a chassis can be on ONE car
-- that is not archived / sold / rejected. Not global: a car one dealer sold can be listed by
-- the next dealer (live data has exactly that case). Probed before writing: 0 live repeats.
begin;

-- 1. One column. `vin` stays as a mirror for old writers; `vin_number` is the one the app reads.
update public.car_listings
   set vin_number = btrim(vin)
 where coalesce(btrim(vin_number), '') = '' and coalesce(btrim(vin), '') <> '';

create or replace function public.car_chassis_sync() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.vin_number is not distinct from old.vin_number
     and new.vin is distinct from old.vin then
    new.vin_number := new.vin;            -- a legacy writer changed only `vin`
  end if;
  new.vin_number := nullif(btrim(coalesce(new.vin_number, new.vin, '')), '');
  new.vin := new.vin_number;
  return new;
end $$;

drop trigger if exists trg_car_chassis_sync on public.car_listings;
create trigger trg_car_chassis_sync before insert or update on public.car_listings
  for each row execute function public.car_chassis_sync();

-- 2. The rule. Same chassis = letters and digits only, any case (mirrored in src/utils/chassisDup.js).
-- Stop with a clear message if two live cars of one dealer still share a chassis (the index would
-- fail anyway, but with no names). Found 2026-11-27: one Toyota GR86 entered twice by one dealer.
do $$
declare n int;
begin
  select count(*) into n from (
    select 1 from public.car_listings
     where vin_number is not null and status not in ('archived', 'sold', 'rejected')
       and upper(regexp_replace(vin_number, '[^A-Za-z0-9]', '', 'g')) <> ''
     group by dealer_id, upper(regexp_replace(vin_number, '[^A-Za-z0-9]', '', 'g')) having count(*) > 1) x;
  if n > 0 then raise exception 'one_live_chassis: % duplicate chassis group(s) still live; archive the extra copy first', n; end if;
end $$;

create unique index car_listings_one_live_chassis
  on public.car_listings (dealer_id, upper(regexp_replace(vin_number, '[^A-Za-z0-9]', '', 'g')))
  where vin_number is not null
    and upper(regexp_replace(vin_number, '[^A-Za-z0-9]', '', 'g')) <> ''
    and status not in ('archived', 'sold', 'rejected');

-- 3. The form's warning. Subject = the caller's own dealer (never an argument); returns a label
--    of the car already holding that chassis, or null. Its own cars only, so nothing leaks.
create or replace function public.my_chassis_in_use(p_value text, p_exclude uuid default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare d uuid := public.get_my_dealer_id(); k text; r text;
begin
  if auth.uid() is null or d is null then return null; end if;
  k := upper(regexp_replace(coalesce(p_value, ''), '[^A-Za-z0-9]', '', 'g'));
  if k = '' then return null; end if;
  select concat_ws(' ', year::text, brand, model) into r
    from car_listings
   where dealer_id = d
     and status not in ('archived', 'sold', 'rejected')
     and upper(regexp_replace(coalesce(vin_number, ''), '[^A-Za-z0-9]', '', 'g')) = k
     and (p_exclude is null or id <> p_exclude)
   limit 1;
  return r;
end $$;
revoke all on function public.my_chassis_in_use(text, uuid) from public, anon;
grant execute on function public.my_chassis_in_use(text, uuid) to authenticated;

commit;
-- After applying: select oid::regprocedure from pg_proc where proname in ('car_chassis_sync','my_chassis_in_use');
-- (one row each), has_function_privilege('anon','public.my_chassis_in_use(text,uuid)','execute') = false,
-- then probe in a rolled-back transaction: a second live car with the same chassis is refused,
-- an archived one is not, and an update that sets only `vin` lands in `vin_number`.
