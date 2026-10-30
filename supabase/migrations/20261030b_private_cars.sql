-- PRIVATE-1 (2026-10-30): a seller can keep up to 4 cars PRIVATE (only they see them).
--
-- Asked for by seller `iskandar` on his first day: he lists cars to work out his
-- cost and margin, and did not want them public. Owner's call: 4 private cars
-- per seller, on top of (not inside) the live-car limit.
--
-- A private car is status = 'private'. A new STATUS rather than a flag column,
-- because every public surface already WHITELISTS statuses (public_car_listings:
-- active/available/reserved/sold; marketplace stats, search, booking, live and
-- agent slugs: available/reserved), so a private car is invisible to buyers with
-- no change to any of them. A flag would need every public query to remember it.
--
-- What changes here:
--  1. update_listing_status() accepts 'private'. Publishing a private car
--     (private -> available/reserved) sends a salesman's car to
--     'pending_approval', the same review a new car gets (CarForm), so going
--     private and back cannot skip review.
--  2. trg_private_car_rules: at most 4 private cars per seller; never a new-car
--     model card; never from sold / pending / rejected / archived.
--  3. The live-car limit ignores private cars: enforce_listing_cap,
--     enforce_listing_cap_on_publish (private -> public IS checked against the
--     limit), salesman_under_listing_limit and the insert policy (a seller at
--     their live limit can still add a private car).
--  4. sweep_premium_lapses() leaves private cars out of the "which cars stay
--     live" ranking, patched in place so nothing else in it changes.

-- 1 ─ the one status write the seller panels use
create or replace function public.update_listing_status(p_listing_id uuid, p_status text, p_dealer_id uuid)
returns void
language sql
set search_path to 'public'
as $$
  update car_listings
     set status = case
                    when status = 'private' and p_status in ('available', 'reserved')
                         and exists (select 1 from profiles where id = auth.uid() and role = 'salesman')
                    then 'pending_approval'
                    else p_status
                  end
   where id = p_listing_id
     and dealer_id = p_dealer_id
     and status not in ('pending_approval', 'rejected')
     and p_status = any (array['available', 'reserved', 'sold', 'private']);
$$;

-- 2 ─ the rules for going private
create or replace function public.enforce_private_car_rules()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare n int;
begin
  if new.status is distinct from 'private' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'private' then return new; end if;
  if new.new_car_model_id is not null then
    raise exception 'private_not_for_model_cards' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and old.status in ('sold', 'pending_approval', 'rejected', 'archived') then
    raise exception 'private_not_allowed' using errcode = 'check_violation';
  end if;
  select count(*) into n from car_listings
   where dealer_id = new.dealer_id and status = 'private' and id <> new.id;
  if n >= 4 then
    raise exception 'private_car_limit' using errcode = 'check_violation', detail = 'max 4 private cars';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_private_car_rules on public.car_listings;
create trigger trg_private_car_rules
  before insert or update of status on public.car_listings
  for each row execute function public.enforce_private_car_rules();

-- 3 ─ the live-car limit ignores private cars
create or replace function public.enforce_listing_cap()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_cap    int;
  v_active int;
begin
  if new.new_car_model_id is not null then return new; end if;

  select case
           when p.role = 'salesman' and p.plan::text = 'salesman_full'
                and p.dealer_id is null
                and not (coalesce(p.plan_expires_at > now(), false)
                         or p.payment_status = 'received')
           then (select listing_cap from plan_config where plan = 'salesman_lite')
           else pc.listing_cap
         end
    into v_cap
    from profiles p
    join plan_config pc on pc.plan = p.plan::text
   where p.id = new.dealer_id;

  if v_cap is null then return new; end if;
  if new.status in ('unpublished', 'private') then return new; end if;

  select count(*) into v_active
    from car_listings
   where dealer_id = new.dealer_id
     and status not in ('sold', 'archived', 'unpublished', 'private')
     and new_car_model_id is null;

  if v_active >= v_cap then
    raise exception 'listing_cap_exceeded'
      using hint = 'Upgrade your plan to add more listings',
            detail = format('active=%s cap=%s', v_active, v_cap);
  end if;

  return new;
end;
$$;

create or replace function public.enforce_listing_cap_on_publish()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare v_cap int; v_active int;
begin
  if new.new_car_model_id is not null then return new; end if;
  if old.status not in ('unpublished', 'archived', 'private') then return new; end if;
  if new.status in ('unpublished', 'sold', 'archived', 'private') then return new; end if;
  select case
           when p.role = 'salesman' and p.plan::text = 'salesman_full'
                and p.dealer_id is null
                and not (coalesce(p.plan_expires_at > now(), false)
                         or p.payment_status = 'received')
           then (select listing_cap from plan_config where plan = 'salesman_lite')
           else pc.listing_cap
         end
    into v_cap
    from profiles p join plan_config pc on pc.plan = p.plan::text
   where p.id = new.dealer_id;
  if v_cap is null then return new; end if;
  select count(*) into v_active from car_listings
   where dealer_id = new.dealer_id
     and status not in ('sold', 'archived', 'unpublished', 'private')
     and new_car_model_id is null and id != new.id;
  if v_active >= v_cap then
    raise exception 'listing_cap_exceeded'
      using hint = 'Upgrade your plan to add more listings',
            detail = format('active=%s cap=%s', v_active, v_cap);
  end if;
  return new;
end;
$$;

create or replace function public.salesman_under_listing_limit()
returns boolean
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $$
  with cap as (
    select pc.listing_cap as c
      from profiles p
      join plan_config pc on pc.plan = p.plan::text
     where p.id = auth.uid()
  )
  select (select c from cap) is null
      or (
           select count(*)
             from car_listings
            where dealer_id = auth.uid()
              and status not in ('sold', 'archived', 'unpublished', 'private')
         ) < (select c from cap);
$$;

-- A private car can be added at the live limit; trg_private_car_rules caps it at 4.
alter policy salesman_inserts_own_listings on public.car_listings
  with check (
    dealer_id = (select auth.uid())
    and salesman_can_manage_listings()
    and (status = 'private' or salesman_under_listing_limit())
  );

-- 4 ─ the Premium-lapse sweep: patch the one status list in place. The live
-- function differs from the repo copies in whitespace, so a full rewrite here
-- would risk dropping something; refuse if the list is not there exactly once.
do $$
declare
  d text := pg_get_functiondef('public.sweep_premium_lapses()'::regprocedure);
  old_list text := $q$('sold', 'archived', 'unpublished')$q$;
  new_list text := $q$('sold', 'archived', 'unpublished', 'private')$q$;
begin
  if (length(d) - length(replace(d, old_list, ''))) / length(old_list) <> 1 then
    raise exception 'sweep_premium_lapses changed: expected the status list once';
  end if;
  execute replace(d, old_list, new_list);
end $$;
