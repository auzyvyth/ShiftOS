-- Loan poster (IDEA-18 / POSTER-1, 2026-10-16): Lite sellers get 3 a month,
-- Premium and dealer-linked salesmen unlimited.
--
-- A credit is per CAR per calendar month (Malaysia time): remaking the poster
-- for the same car with a new deposit is free, a fourth car is not. Entitlement
-- reuses salesman_has_full_page(), the same "is this seller Premium" answer the
-- public page uses, so the two cannot disagree.
--
-- No client policies on the table: every read and write goes through the two
-- functions below, which derive the user from auth.uid().

create table if not exists public.loan_poster_uses (
  user_id    uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.car_listings(id) on delete cascade,
  month      date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id, month)
);
alter table public.loan_poster_uses enable row level security;
revoke all on public.loan_poster_uses from public, anon, authenticated;

create or replace function public.loan_poster_month()
returns date language sql stable set search_path = pg_catalog, public as $$
  select date_trunc('month', now() at time zone 'Asia/Kuala_Lumpur')::date;
$$;

create or replace function public.loan_poster_quota()
returns json language sql stable security definer
set search_path = pg_catalog, public as $$
  select json_build_object(
    'unlimited', public.salesman_has_full_page(auth.uid()),
    'used', (select count(*) from public.loan_poster_uses
              where user_id = auth.uid() and month = public.loan_poster_month()),
    'limit', 3
  )
  where auth.uid() is not null;
$$;

create or replace function public.claim_loan_poster(p_listing uuid)
returns json language plpgsql volatile security definer
set search_path = pg_catalog, public as $$
declare
  uid uuid := auth.uid();
  m date := public.loan_poster_month();
  unlimited boolean;
  used int;
begin
  if uid is null then
    return json_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  -- Only a car this seller can actually sell: their own, their dealer's, or
  -- one they feature. Naming a listing id proves nothing on its own.
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

  if not unlimited and used >= 3 then
    return json_build_object('ok', false, 'error', 'limit', 'used', used, 'limit', 3);
  end if;

  insert into public.loan_poster_uses (user_id, listing_id, month)
  values (uid, p_listing, m) on conflict do nothing;
  return json_build_object('ok', true, 'used', used + 1, 'limit', 3, 'unlimited', unlimited);
end;
$$;

revoke all on function public.loan_poster_month() from public, anon;
revoke all on function public.loan_poster_quota() from public, anon;
revoke all on function public.claim_loan_poster(uuid) from public, anon;
grant execute on function public.loan_poster_month() to authenticated;
grant execute on function public.loan_poster_quota() to authenticated;
grant execute on function public.claim_loan_poster(uuid) to authenticated;
