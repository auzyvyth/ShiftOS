-- Premium lapse: what happens when a standalone Premium seller stops paying.
--
-- Entitlement already ends on its own: is_salesman_premium() stops counting a
-- seller once plan_expires_at passes, and the panels route them to Lite. What
-- was missing (audit 2026-10-19):
--   1. Cars over the Lite cap stayed live. Owner's call: lock them. A seller
--      with 15 live cars keeps the 10 newest; the other 5 are hidden from
--      buyers and shown to the seller blacked out until they renew.
--   2. enforce_listing_cap_on_publish read the cap off profiles.plan, so an
--      expired 'salesman_full' row still got the Premium cap (30) when it
--      republished a car. It now uses the same entitlement rule as
--      enforce_listing_cap, so a locked car cannot simply be switched back on.
--   3. No warning. One push 3 days before the date, one on the day it lapses.
--      That is all: two messages per lapse, never a daily nag.
--   4. One standalone seller had payment_status='received' with no date, which
--      never expires. Moved onto a paid-through date like everyone else.
--
-- Unlocking is a trigger on profiles, so whatever restores Premium (a logged
-- payment, the free month, linking to a dealer) brings the cars back at once.

alter table public.car_listings
  add column if not exists plan_locked_at     timestamptz,
  add column if not exists plan_locked_status text;

comment on column public.car_listings.plan_locked_at is
  'Set when a lapsed Premium seller is over the Lite cap and this car was hidden (status unpublished). Cleared on renewal or when the seller moves the car themselves.';
comment on column public.car_listings.plan_locked_status is
  'The status the car had before it was locked, restored on renewal.';

-- 2. Republish cap follows entitlement, not the self-writable plan column.
create or replace function public.enforce_listing_cap_on_publish()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_cap    int;
  v_active int;
begin
  if new.new_car_model_id is not null then return new; end if;
  if old.status not in ('unpublished', 'archived') then return new; end if;
  if new.status in ('unpublished', 'sold', 'archived') then return new; end if;

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

  select count(*) into v_active
    from car_listings
   where dealer_id = new.dealer_id
     and status not in ('sold', 'archived', 'unpublished')
     and new_car_model_id is null
     and id != new.id;

  if v_active >= v_cap then
    raise exception 'listing_cap_exceeded'
      using hint = 'Upgrade your plan to add more listings',
            detail = format('active=%s cap=%s', v_active, v_cap);
  end if;

  return new;
end;
$function$;

-- A seller who moves a locked car themselves (archives it, or republishes it
-- within the Lite cap) takes it out of the lock.
create or replace function public.clear_plan_lock_on_move()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if old.plan_locked_at is not null and new.status is distinct from 'unpublished' then
    new.plan_locked_at := null;
    new.plan_locked_status := null;
  end if;
  return new;
end;
$function$;

create or replace trigger trg_clear_plan_lock
  before update of status on public.car_listings
  for each row execute function public.clear_plan_lock_on_move();

-- 1 + 3. Hourly sweep: lock cars over the cap, send the two reminders.
create or replace function public.sweep_premium_lapses()
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_cap    int := (select listing_cap from plan_config where plan = 'salesman_lite');
  r        record;
  v_locked int;
begin
  -- Ending soon: one push, 3 days out, once per paid-through date.
  insert into salesman_notifications (salesman_id, type, title, body)
  select p.id, 'premium_ending',
         'Your Premium ends in ' ||
           greatest(1, ceil(extract(epoch from (p.plan_expires_at - now())) / 86400))::int ||
           case when p.plan_expires_at - now() <= interval '1 day' then ' day' else ' days' end,
         'Renew to keep reminders, Performance and every car live. Nothing is deleted if you do not.'
    from profiles p
   where p.role = 'salesman' and p.plan::text = 'salesman_full'
     and p.dealer_id is null and coalesce(p.is_active, true)
     and p.payment_status is distinct from 'received'
     and p.plan_expires_at > now()
     and p.plan_expires_at <= now() + interval '3 days'
     and not exists (
       select 1 from salesman_notifications n
        where n.salesman_id = p.id and n.type = 'premium_ending'
          and n.created_at > p.plan_expires_at - interval '4 days');

  -- Lapsed: lock what is over the cap, then one push saying so.
  for r in
    select p.id, p.plan_expires_at
      from profiles p
     where p.role = 'salesman' and p.plan::text = 'salesman_full'
       and p.dealer_id is null and coalesce(p.is_active, true)
       and coalesce(p.account_status, '') <> 'deleted'
       and p.payment_status is distinct from 'received'
       and p.plan_expires_at is not null
       and p.plan_expires_at <= now()
  loop
    -- Keep reserved cars first (a buyer has put money down), then the newest.
    -- Only available/active cars are ever locked.
    with ranked as (
      select c.id, c.status,
             row_number() over (order by (c.status = 'reserved') desc, c.created_at desc) as rn
        from car_listings c
       where c.dealer_id = r.id
         and c.status not in ('sold', 'archived', 'unpublished')
         and c.new_car_model_id is null
    )
    update car_listings c
       set plan_locked_status = c.status,
           plan_locked_at     = now(),
           status             = 'unpublished'
      from ranked
     where ranked.id = c.id
       and ranked.rn > v_cap
       and ranked.status in ('available', 'active');
    get diagnostics v_locked = row_count;

    -- One "ended" push per lapse, sent within 30 days of it.
    if r.plan_expires_at > now() - interval '30 days'
       and not exists (
         select 1 from salesman_notifications n
          where n.salesman_id = r.id and n.type = 'premium_ended'
            and n.created_at > r.plan_expires_at) then
      select count(*) into v_locked
        from car_listings where dealer_id = r.id and plan_locked_at is not null;
      insert into salesman_notifications (salesman_id, type, title, body)
      values (r.id, 'premium_ended', 'Your Premium has ended',
              case when v_locked > 0
                then v_locked || case when v_locked = 1 then ' car is' else ' cars are' end
                     || ' hidden from buyers until you renew. Nothing is deleted.'
                else 'You are on Lite now. Renew any time and everything comes back.' end);
    end if;
  end loop;
end;
$function$;

revoke all on function public.sweep_premium_lapses() from public, anon, authenticated;

-- Renewal brings the locked cars back, whatever restored Premium.
create or replace function public.unlock_plan_cars_on_renew()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.role = 'salesman'
     and (new.dealer_id is not null
          or (new.plan::text = 'salesman_full'
              and (coalesce(new.plan_expires_at > now(), false)
                   or new.payment_status = 'received'))) then
    update car_listings
       set status = coalesce(plan_locked_status, 'available'),
           plan_locked_at = null,
           plan_locked_status = null
     where dealer_id = new.id
       and plan_locked_at is not null
       and status = 'unpublished';
  end if;
  return new;
end;
$function$;

create or replace trigger trg_zz_unlock_plan_cars
  after update of plan_expires_at, payment_status, dealer_id, plan on public.profiles
  for each row execute function public.unlock_plan_cars_on_renew();

-- The seller's own locked car ids, for the blacked-out cards.
create or replace function public.get_my_locked_listings()
returns setof uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select id from car_listings
   where dealer_id = auth.uid() and plan_locked_at is not null;
$function$;

revoke all on function public.get_my_locked_listings() from public, anon;
grant execute on function public.get_my_locked_listings() to authenticated;

-- 4. No standalone seller is Premium forever. Give them a month from today on
--    a real date, the same shape record_subscription_payment writes.
update public.profiles
   set plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + interval '30 days',
       payment_status  = null
 where role = 'salesman' and plan::text = 'salesman_full'
   and dealer_id is null and payment_status = 'received';

select cron.schedule('sweep-premium-lapses', '41 * * * *', 'select public.sweep_premium_lapses();');
