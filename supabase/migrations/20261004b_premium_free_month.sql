-- Lite -> Premium upgrade + the first free month (owner decision 2026-10-04:
-- "Keep free month").
--
-- What was broken: Premium signup set subscription_status='trial', but
-- is_salesman_premium() only accepts dealer_id / plan_expires_at /
-- payment_status='received'. A trial is none of those, so a Premium signup
-- landed on Lite with no explanation, and a logged-in Lite seller had no way
-- to upgrade at all.
--
-- The free month is now a paid-through date: plan_expires_at = now() + 30 days.
-- plan_expires_at is already pinned against self-edits and already counted by
-- is_salesman_premium() and isPremiumSalesman() (src/utils/salesmanPlan.js),
-- so neither check changes and the two cannot drift. A logged payment
-- (record_subscription_payment) then extends from the end of the free month.
-- premium_trial_started_at records that the one free month has been used.
--
-- Also: enforce_listing_cap read the self-writable `plan` column, so a Lite
-- seller who flipped plan to salesman_full got the 30-listing cap unpaid.

alter table public.profiles
  add column if not exists premium_trial_started_at timestamptz;

-- Runs AFTER trg_prevent_profile_privilege_escalation (BEFORE triggers fire
-- in name order), so it sees the row that guard has already cleaned.
create or replace function public.apply_premium_free_month()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  completing boolean;
  used_before timestamptz;
begin
  if auth.uid() is null or is_superadmin() then
    return new;
  end if;

  -- start_premium_trial() sets this flag for its own transaction only.
  if coalesce(current_setting('app.premium_trial', true), '') = 'on' then
    new.plan := 'salesman_full';
    new.plan_expires_at := now() + interval '30 days';
    new.premium_trial_started_at := now();
    new.payment_status := null;   -- the escalation guard set 'pending'
    return new;
  end if;

  -- Nobody writes the marker by hand.
  used_before := case when tg_op = 'UPDATE' then old.premium_trial_started_at end;
  new.premium_trial_started_at := used_before;

  -- A Premium signup finishing onboarding starts its free month here.
  completing := new.onboarding_complete = true
    and (tg_op = 'INSERT' or coalesce(old.onboarding_complete, false) = false);
  if completing and used_before is null
     and new.role = 'salesman' and new.dealer_id is null
     and new.plan::text = 'salesman_full' then
    new.plan_expires_at := now() + interval '30 days';
    new.premium_trial_started_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists trg_zz_premium_free_month on public.profiles;
create trigger trg_zz_premium_free_month
  before insert or update on public.profiles
  for each row execute function public.apply_premium_free_month();

-- The Lite "Try Premium free" button. One free month per account, never for
-- someone who has already had Premium time.
create or replace function public.start_premium_trial()
returns text language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  me public.profiles%rowtype;
begin
  if auth.uid() is null then return 'not_signed_in'; end if;
  select * into me from public.profiles where id = auth.uid();
  if not found or me.role <> 'salesman' or me.dealer_id is not null
     or not coalesce(me.is_active, true)
     or coalesce(me.account_status, 'active') <> 'active'
     or coalesce(me.onboarding_complete, false) = false then
    return 'not_eligible';
  end if;
  if exists (select 1 from auth.users u
              where u.id = me.id and coalesce(u.is_anonymous, false)) then
    return 'not_eligible';
  end if;
  if me.plan::text = 'salesman_full'
     and (me.plan_expires_at > now() or me.payment_status = 'received') then
    return 'already_premium';
  end if;
  if me.premium_trial_started_at is not null or me.plan_expires_at is not null
     or me.payment_status = 'received' then
    return 'used';
  end if;

  perform set_config('app.premium_trial', 'on', true);
  update public.profiles set plan = 'salesman_full' where id = me.id;
  perform set_config('app.premium_trial', 'off', true);
  return 'ok';
end;
$$;

-- What the Lite Premium section needs to know about the signed-in seller.
create or replace function public.get_my_premium_offer()
returns json language sql stable security definer
set search_path = public, pg_temp
as $$
  select json_build_object(
    'trial_available', p.premium_trial_started_at is null
                       and p.plan_expires_at is null
                       and coalesce(p.payment_status, '') <> 'received',
    'trial_used',      p.premium_trial_started_at is not null,
    'premium_until',   p.plan_expires_at
  )
  from public.profiles p
  where p.id = auth.uid() and p.role = 'salesman' and p.dealer_id is null;
$$;

-- Listing cap follows what the seller is ENTITLED to, not the `plan` column.
create or replace function public.enforce_listing_cap()
returns trigger language plpgsql
set search_path to 'pg_catalog', 'public'
as $$
DECLARE
  v_cap    int;
  v_active int;
BEGIN
  SELECT CASE
           WHEN p.role = 'salesman' AND p.plan::text = 'salesman_full'
                AND p.dealer_id IS NULL
                AND NOT (COALESCE(p.plan_expires_at > now(), false)
                         OR p.payment_status = 'received')
           THEN (SELECT listing_cap FROM plan_config WHERE plan = 'salesman_lite')
           ELSE pc.listing_cap
         END
    INTO v_cap
  FROM profiles p
  JOIN plan_config pc ON pc.plan = p.plan::text
  WHERE p.id = NEW.dealer_id;

  -- NULL cap = unlimited (dealer_group)
  IF v_cap IS NULL THEN RETURN NEW; END IF;

  -- Unpublished cars are private stock, not public listings — never gate them.
  IF NEW.status = 'unpublished' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_active
  FROM car_listings
  WHERE dealer_id = NEW.dealer_id
  AND status NOT IN ('sold', 'archived', 'unpublished');

  IF v_active >= v_cap THEN
    RAISE EXCEPTION 'listing_cap_exceeded'
      USING HINT = 'Upgrade your plan to add more listings',
            DETAIL = format('active=%s cap=%s', v_active, v_cap);
  END IF;

  RETURN NEW;
END;
$$;

revoke all on function public.apply_premium_free_month() from public, anon, authenticated;
revoke all on function public.start_premium_trial() from public, anon;
revoke all on function public.get_my_premium_offer() from public, anon;
grant execute on function public.start_premium_trial() to authenticated;
grant execute on function public.get_my_premium_offer() to authenticated;
