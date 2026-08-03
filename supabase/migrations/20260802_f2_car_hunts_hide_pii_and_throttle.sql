-- F2: car_hunts exposed hunter_name/phone/email/budget to anyone (anon SELECT on
-- status='active') and accepted unthrottled, unvalidated inserts. Lock down the
-- PII read behind a non-PII RPC + role-scoped policies, and rate-limit/validate
-- the insert.

-- 1) Public "wanted board" browse: non-PII fields only, never contact details.
create or replace function public.get_active_hunts()
returns table (
  id uuid, brand text, model text, variant text,
  year_from int, year_to int,
  budget_min numeric, budget_max numeric,
  condition text, transmission text, urgency text,
  financing_needed boolean, is_verified boolean,
  created_at timestamptz
)
language sql stable security definer set search_path to 'public'
as $$
  select id, brand, model, variant, year_from, year_to,
         budget_min, budget_max, condition, transmission, urgency,
         financing_needed, is_verified, created_at
  from car_hunts
  where status = 'active'
  order by created_at desc
  limit 200;
$$;
grant execute on function public.get_active_hunts() to anon, authenticated;

-- 2) Remove the PII-leaking public SELECT policy.
drop policy if exists "Public can view active hunts" on car_hunts;

-- 3) Contact-bearing reads: the hunter sees their own; fulfillment roles
--    (dealers/salesmen/managers) see active hunts so they can respond. Buyers
--    and anonymous visitors get only the non-PII RPC above.
create policy car_hunts_owner_select on car_hunts
  for select to authenticated
  using (auth.uid() = user_id);

create policy car_hunts_fulfiller_select on car_hunts
  for select to authenticated
  using (
    status = 'active' and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('dealer','owner','salesman','manager','superadmin')
    )
  );

-- 4) Least privilege: anon only ever needs INSERT here.
revoke select, update on car_hunts from anon;

-- 5) Throttle + validate the public insert. hunter_phone is NOT NULL, so keying
--    the limit on it cannot be null-bypassed.
create or replace function public.car_hunts_rate_ok(p_phone text)
returns boolean language plpgsql security definer set search_path to 'public'
as $$
declare cnt int;
begin
  if p_phone is null or p_phone = '' then return false; end if;
  select count(*) into cnt from car_hunts
   where hunter_phone = p_phone and created_at > now() - interval '1 hour';
  return cnt < 3;
end; $$;

drop policy if exists "Anyone can create a hunt" on car_hunts;
create policy car_hunts_insert on car_hunts
  for insert to anon, authenticated
  with check (
    public.car_hunts_rate_ok(hunter_phone)
    and length(btrim(hunter_name)) between 2 and 80
    and hunter_phone ~ '^\+?[0-9]{9,15}$'
    and (hunter_email is null or hunter_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    and length(btrim(brand)) between 1 and 60
    and length(btrim(model)) between 1 and 60
    and budget_max > 0 and budget_max <= 100000000
    and (budget_min is null or (budget_min >= 0 and budget_min <= budget_max))
    and (notes is null or length(notes) <= 1000)
    and coalesce(is_verified, false) = false
    and coalesce(status, 'active') = 'active'
  );
