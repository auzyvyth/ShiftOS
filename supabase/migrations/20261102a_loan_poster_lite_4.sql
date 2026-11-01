-- Loan poster: Lite sellers get 4 cars a month, down from 10 (owner, 2026-11-01:
-- "10 is too generous"). Same signatures as 20261016b/20261018b, so CREATE OR
-- REPLACE replaces in place (no new overloads). The number must match
-- LITE_POSTERS_PER_MONTH in src/utils/loanPoster.js.
-- A seller already past 4 this month keeps the posters they made (re-downloading
-- the same car stays free); they just cannot start a new car until next month.

create or replace function public.loan_poster_quota()
 returns json
 language sql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select json_build_object(
    'unlimited', public.salesman_has_full_page(auth.uid()),
    'used', (select count(*) from public.loan_poster_uses
              where user_id = auth.uid() and month = public.loan_poster_month()),
    'limit', 4
  )
  where auth.uid() is not null;
$function$;

create or replace function public.claim_loan_poster(p_listing uuid)
 returns json
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  uid uuid := auth.uid();
  m date := public.loan_poster_month();
  unlimited boolean;
  used int;
begin
  if uid is null then
    return json_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  if not exists (
    select 1 from public.car_listings c
     where c.id = p_listing
       and (c.dealer_id = uid
            or c.dealer_id = public.get_my_dealer_id()
            or exists (select 1 from public.salesman_listings sl
                        where sl.listing_id = c.id and sl.salesman_id = uid))
  ) then
    return json_build_object('ok', false, 'error', 'not_your_car');
  end if;

  perform pg_advisory_xact_lock(hashtext('loan_poster:' || uid::text));

  if exists (select 1 from public.loan_poster_uses
              where user_id = uid and listing_id = p_listing and month = m) then
    return json_build_object('ok', true, 'reused', true);
  end if;

  unlimited := public.salesman_has_full_page(uid);
  select count(*) into used from public.loan_poster_uses
   where user_id = uid and month = m;

  if not unlimited and used >= 4 then
    return json_build_object('ok', false, 'error', 'limit', 'used', used, 'limit', 4);
  end if;

  insert into public.loan_poster_uses (user_id, listing_id, month)
  values (uid, p_listing, m) on conflict do nothing;
  return json_build_object('ok', true, 'used', used + 1, 'limit', 4, 'unlimited', unlimited);
end;
$function$;
