-- Two-sided invite reward (IDEA-30 -> REFER-2, owner 2026-11-01: "like Dropbox").
--
-- Before: only the INVITER earned, and only once the invited seller had paid
-- for Premium twice (grant_referral_reward). 1 invite ever claimed, 0 rewards.
-- Now, when an invited seller's FIRST CAR IS APPROVED by the platform (a person
-- in the console, approve_listing), BOTH sides get:
--   * 7 days of Premium (added to any Premium time they have; a Lite seller
--     gets Premium for 7 days, then is back on Lite, nothing lost)
--   * 2 extra car slots, kept for good (max +10 per seller, i.e. 5 invites)
-- The inviter's side is capped at 12 rewards per 365 days (as before); the
-- invited seller always gets theirs. The old 30-days-after-two-payments bonus
-- for the inviter stays on top, unchanged.
--
-- Why "first car approved" and not signup: a fake account costs nothing; a car
-- a person reviewed does. Only a SUPERADMIN moving pending_approval -> live
-- counts (sellers can write their own car's status, so a seller-side flip is
-- never the trigger). Same WhatsApp/phone on both accounts = not eligible.
-- Never cash (Act 500: free to join, no purchase, the reward is product time).
--
-- Single source for slots: referral_bonus_slots(id), read by every cap
-- (enforce_listing_cap, enforce_listing_cap_on_publish,
-- salesman_under_listing_limit, _apply_premium_lapse). Never a profiles
-- column: the client can write profiles.

-- 1. Rows ---------------------------------------------------------------------
create table if not exists public.referral_bonuses (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.profiles(id) on delete cascade,  -- who receives
  referred_id  uuid not null references public.profiles(id) on delete cascade,  -- the invited seller
  side         text not null check (side in ('inviter', 'invitee')),
  status       text not null check (status in ('granted', 'capped', 'ineligible')),
  premium_days int  not null default 0,
  slots        int  not null default 0,
  created_at   timestamptz not null default now(),
  unique (referred_id, side)
);
create index if not exists referral_bonuses_seller_idx
  on public.referral_bonuses (seller_id, created_at);
alter table public.referral_bonuses enable row level security;
drop policy if exists referral_bonuses_read on public.referral_bonuses;
create policy referral_bonuses_read on public.referral_bonuses
  for select to authenticated
  using (seller_id = (select auth.uid()) or (select is_superadmin()));
revoke all on public.referral_bonuses from anon;
revoke insert, update, delete, truncate on public.referral_bonuses from authenticated;

-- 2. Extra slots for one seller. Callers: the cap triggers (seller's own
-- insert), the lapse sweep (cron, no uid), the console. Anyone else asking
-- about someone else gets 0.
create or replace function public.referral_bonus_slots(p_id uuid)
returns int language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when auth.uid() is null or auth.uid() = p_id or is_superadmin() then
      least(10, coalesce((select sum(slots)::int from public.referral_bonuses
                           where seller_id = p_id and status = 'granted'), 0))
    else 0 end;
$$;

-- 3. Caps read it -------------------------------------------------------------
create or replace function public.enforce_listing_cap()
returns trigger language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
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
  v_cap := v_cap + public.referral_bonus_slots(new.dealer_id);

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
$function$;

create or replace function public.enforce_listing_cap_on_publish()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $function$
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
  v_cap := v_cap + public.referral_bonus_slots(new.dealer_id);
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
$function$;

-- Also fixes: new-car model cards were counted here (they skip every other
-- cap), so an advisor at the cap with cards could not add a used car.
create or replace function public.salesman_under_listing_limit()
returns boolean language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  with cap as (
    select pc.listing_cap + public.referral_bonus_slots(p.id) as c
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
              and new_car_model_id is null
         ) < (select c from cap);
$function$;

create or replace function public._apply_premium_lapse(p_id uuid, p_expires timestamptz)
returns void language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_cap    int := (select listing_cap from plan_config where plan = 'salesman_lite')
                  + public.referral_bonus_slots(p_id);
  v_locked int;
begin
  with ranked as (
    select c.id, c.status,
           row_number() over (order by (c.status = 'reserved') desc, c.created_at desc) as rn
      from car_listings c
     where c.dealer_id = p_id
       and c.status not in ('sold', 'archived', 'unpublished', 'private')
       and c.new_car_model_id is null
  )
  update car_listings c
     set plan_locked_status = c.status, plan_locked_at = now(), status = 'unpublished'
    from ranked
   where ranked.id = c.id and ranked.rn > v_cap
     and ranked.status in ('available', 'active');

  update appointments
     set remind_at = null
   where salesman_id = p_id
     and remind_at is not null
     and remind_sent is not true;

  if p_expires > now() - interval '30 days'
     and not exists (
       select 1 from salesman_notifications n
        where n.salesman_id = p_id and n.type = 'premium_ended'
          and n.created_at > p_expires) then
    select count(*) into v_locked
      from car_listings where dealer_id = p_id and plan_locked_at is not null;
    insert into salesman_notifications (salesman_id, type, title, body)
    values (p_id, 'premium_ended', 'Your Premium has ended',
            case when v_locked > 0
              then v_locked || case when v_locked = 1 then ' car is' else ' cars are' end
                   || ' hidden from buyers until you renew. Nothing is deleted.'
              else 'You are on Lite now. Renew any time and everything comes back.' end);
  end if;
end;
$function$;

-- 4. Let the reward move plan / plan_expires_at even inside the seller's own
-- transaction (claim_referral). Same pattern as app.allow_tenant_move: only a
-- SECURITY DEFINER function sets the flag, for its own statement. The rest of
-- this function is unchanged from the live version.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  paid_plans CONSTANT text[] := ARRAY['dealer_starter','dealer_growth','dealer_pro','dealer_group','salesman_full'];
  gated boolean;
  plan_ok boolean;
  onboarding_completing boolean;
  self_restoring boolean;
BEGIN
  IF auth.uid() IS NULL OR is_superadmin()
     OR COALESCE(current_setting('app.referral_bonus', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.role, 'buyer') <> 'buyer'
     AND (TG_OP = 'INSERT' OR NEW.role IS DISTINCT FROM OLD.role)
     AND EXISTS (
       SELECT 1 FROM auth.users u
        WHERE u.id = NEW.id AND COALESCE(u.is_anonymous, false)
     ) THEN
    RAISE EXCEPTION 'guest accounts cannot become sellers: add an email and password to this account first'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.role IN ('manager','admin','accountant','fi_officer','superadmin')
     AND (TG_OP = 'INSERT' OR NEW.role IS DISTINCT FROM OLD.role) THEN
    RAISE EXCEPTION 'not allowed to assign role: %', NEW.role
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.role IN ('dealer','owner')
     AND NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE(OLD.role,'') NOT IN ('dealer','owner') THEN
    RAISE EXCEPTION 'not allowed to change role to %', NEW.role
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.dealer_id IS NOT NULL AND NEW.dealer_id <> NEW.id
     AND (TG_OP = 'INSERT' OR NEW.dealer_id IS DISTINCT FROM OLD.dealer_id) THEN
    IF NOT (
      TG_OP = 'UPDATE'
      AND OLD.dealer_id IS NULL
      AND NEW.role = 'salesman'
      AND COALESCE(current_setting('app.allow_tenant_move', true), '') = 'on'
    ) THEN
      RAISE EXCEPTION 'not allowed to change tenant (dealer_id)'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  plan_ok := NEW.plan IS NULL
    OR (NEW.role IN ('dealer','owner') AND NEW.plan::text IN ('dealer_starter','dealer_growth','dealer_pro'))
    OR (NEW.role = 'salesman'          AND NEW.plan::text IN ('salesman_lite','salesman_full'));

  IF TG_OP = 'INSERT' THEN
    IF NOT plan_ok THEN NEW.plan := NULL; END IF;
  ELSE
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      IF NOT plan_ok THEN
        NEW.plan := OLD.plan;
      ELSIF OLD.plan IS NULL THEN
        NULL;
      ELSIF NEW.role = 'salesman'
            AND OLD.plan::text IN ('salesman_lite','salesman_full')
            AND NEW.plan::text IN ('salesman_lite','salesman_full') THEN
        NULL;
      ELSE
        NEW.plan := OLD.plan;
      END IF;
    END IF;
  END IF;

  IF NEW.payment_status IS NOT NULL AND NEW.payment_status <> 'pending' THEN
    IF TG_OP = 'UPDATE' AND NEW.payment_status = OLD.payment_status THEN
      NULL;
    ELSE
      NEW.payment_status := CASE WHEN TG_OP = 'UPDATE' THEN OLD.payment_status ELSE NULL END;
    END IF;
  END IF;

  onboarding_completing := TG_OP = 'UPDATE'
    AND COALESCE(OLD.onboarding_complete, false) = false
    AND NEW.onboarding_complete = true;

  gated := NEW.plan::text = 'salesman_full' AND NEW.dealer_id IS NULL;
  IF gated THEN
    IF TG_OP = 'UPDATE'
       AND COALESCE(OLD.payment_status,'') = 'received'
       AND NEW.plan IS NOT DISTINCT FROM OLD.plan
       AND NEW.role IS NOT DISTINCT FROM OLD.role THEN
      NEW.payment_status := 'received';
    ELSIF TG_OP = 'INSERT' OR onboarding_completing THEN
      NEW.payment_status := NULL;
    ELSIF TG_OP = 'UPDATE'
          AND (NEW.plan IS DISTINCT FROM OLD.plan OR NEW.role IS DISTINCT FROM OLD.role) THEN
      NEW.payment_status := 'pending';
    END IF;
  END IF;

  self_restoring := TG_OP = 'UPDATE'
    AND COALESCE(current_setting('app.allow_self_restore', true), '') = 'on'
    AND OLD.account_status = 'deleted'
    AND NEW.account_status = 'active'
    AND auth.uid() = NEW.id;

  IF TG_OP = 'INSERT' OR (gated AND onboarding_completing) THEN
    IF NEW.plan::text = 'salesman_lite' THEN
      -- Free forever -- there is no billing cycle for a countdown to describe.
      NEW.subscription_status := 'active';
      NEW.trial_ends_at := NULL;
    ELSE
      NEW.subscription_status := 'trial';
      IF gated THEN
        NEW.trial_ends_at := now() + interval '30 days';
      ELSIF NEW.trial_ends_at IS NULL OR NEW.trial_ends_at > (now() + interval '15 days') THEN
        NEW.trial_ends_at := now() + interval '14 days';
      END IF;
    END IF;
    NEW.plan_expires_at := NULL;
    NEW.account_status := 'active';
    IF TG_OP = 'INSERT' THEN
      NEW.deleted_at        := NULL;
      NEW.suspended_at      := NULL;
      NEW.suspension_reason := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
      NEW.subscription_status := OLD.subscription_status;
    END IF;
    IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
       AND (OLD.trial_ends_at IS NULL OR NEW.trial_ends_at > OLD.trial_ends_at) THEN
      NEW.trial_ends_at := OLD.trial_ends_at;
    END IF;
    IF NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at THEN
      NEW.plan_expires_at := OLD.plan_expires_at;
    END IF;
    IF NOT self_restoring AND NEW.account_status IS DISTINCT FROM OLD.account_status THEN
      NEW.account_status := OLD.account_status;
    END IF;
    IF NOT self_restoring AND NEW.is_active = true AND OLD.is_active = false THEN
      NEW.is_active := false;
    END IF;
    IF NOT self_restoring AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      NEW.deleted_at := OLD.deleted_at;
    END IF;
    IF NEW.suspended_at IS DISTINCT FROM OLD.suspended_at THEN
      NEW.suspended_at := OLD.suspended_at;
    END IF;
    IF NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason THEN
      NEW.suspension_reason := OLD.suspension_reason;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 5. Add Premium days (helper, definer-only) ----------------------------------
create or replace function public._referral_add_premium(p_id uuid, p_days int)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('app.referral_bonus', 'on', true);
  update public.profiles
     set plan = 'salesman_full',
         payment_status = case when payment_status = 'received' then payment_status else null end,
         plan_expires_at = case
           when payment_status = 'received' then plan_expires_at  -- legacy paid-forever row: leave it
           else greatest(now(), coalesce(plan_expires_at, now())) + make_interval(days => p_days) end
   where id = p_id and role = 'salesman' and dealer_id is null;
  perform set_config('app.referral_bonus', 'off', true);
end;
$$;

-- 6. The reward ---------------------------------------------------------------
-- Idempotent per side (unique referred_id + side). Call once the invited
-- seller has an approved car; it re-checks that itself.
create or replace function public.referral_grant_bonus(p_referred uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  me      public.profiles%rowtype;
  ref     public.profiles%rowtype;
  v_days  constant int := 7;
  v_slots constant int := 2;
  v_lite  int := (select listing_cap from public.plan_config where plan = 'salesman_lite');
  v_given int;
  v_have  int;
  v_add   int;
  v_id    uuid;
  me_name text;
  ref_name text;
  me_prem boolean;
  ref_prem boolean;
begin
  select * into me from public.profiles where id = p_referred;
  if not found or me.referred_by is null or me.role <> 'salesman' or me.dealer_id is not null
     or not coalesce(me.is_active, true) or coalesce(me.account_status, 'active') <> 'active' then
    return;
  end if;
  if not exists (select 1 from public.car_listings c
                  where c.dealer_id = me.id and c.new_car_model_id is null
                    and c.status in ('available', 'active', 'reserved', 'sold')) then
    return;
  end if;
  select * into ref from public.profiles where id = me.referred_by for update;
  if not found then return; end if;

  me_name  := coalesce(nullif(trim(me.full_name), ''), me.slug, 'A seller');
  ref_name := coalesce(nullif(trim(ref.full_name), ''), ref.slug, 'the seller who invited you');

  -- Two accounts on one number = one person inviting themselves.
  if public.normalize_my_phone(coalesce(nullif(me.whatsapp_number, ''), me.phone)) is not null
     and public.normalize_my_phone(coalesce(nullif(me.whatsapp_number, ''), me.phone))
         = public.normalize_my_phone(coalesce(nullif(ref.whatsapp_number, ''), ref.phone)) then
    insert into public.referral_bonuses (seller_id, referred_id, side, status)
    values (me.id, me.id, 'invitee', 'ineligible'), (ref.id, me.id, 'inviter', 'ineligible')
    on conflict (referred_id, side) do nothing;
    return;
  end if;

  -- Invited seller: always, once.
  me_prem := me.plan::text = 'salesman_full'
             and (coalesce(me.plan_expires_at > now(), false) or me.payment_status = 'received');
  v_have := public.referral_bonus_slots(me.id);
  v_add  := greatest(0, least(v_slots, 10 - v_have));
  insert into public.referral_bonuses (seller_id, referred_id, side, status, premium_days, slots)
  values (me.id, me.id, 'invitee', 'granted', v_days, v_add)
  on conflict (referred_id, side) do nothing
  returning id into v_id;
  if v_id is not null then
    perform public._referral_add_premium(me.id, v_days);
    insert into public.salesman_notifications (salesman_id, type, title, body)
    values (me.id, 'referral_bonus', 'Your invite reward is here',
      'Your first car is live, so you and ' || ref_name || ' both got a reward. '
      || case when me_prem then '7 days were added to your Premium'
              else 'You have Premium free for 7 days, starting now' end
      || case when v_add > 0 then ', and 2 extra car slots that stay for good (Lite now holds '
                                  || (v_lite + v_have + v_add) || ' cars).'
              else '.' end);
  end if;

  -- Inviter: needs an active standalone seller account, 12 a year.
  if ref.role <> 'salesman' or ref.dealer_id is not null then
    insert into public.referral_bonuses (seller_id, referred_id, side, status)
    values (ref.id, me.id, 'inviter', 'ineligible') on conflict (referred_id, side) do nothing;
    return;
  end if;
  if not coalesce(ref.is_active, true) or coalesce(ref.account_status, 'active') <> 'active' then
    return;  -- decided when they are restored (referral_on_restore)
  end if;
  select count(*) into v_given from public.referral_bonuses
   where seller_id = ref.id and side = 'inviter' and status = 'granted'
     and created_at > now() - interval '365 days';
  if v_given >= 12 then
    insert into public.referral_bonuses (seller_id, referred_id, side, status)
    values (ref.id, me.id, 'inviter', 'capped') on conflict (referred_id, side) do nothing
    returning id into v_id;
    if v_id is not null then
      insert into public.salesman_notifications (salesman_id, type, title, body)
      values (ref.id, 'referral_bonus', me_name || '''s first car is live',
        'They got their invite reward. You have had 12 invite rewards in the last year, the most there is, so this one did not add to yours.');
    end if;
    return;
  end if;

  ref_prem := ref.plan::text = 'salesman_full'
              and (coalesce(ref.plan_expires_at > now(), false) or ref.payment_status = 'received');
  v_have := public.referral_bonus_slots(ref.id);
  v_add  := greatest(0, least(v_slots, 10 - v_have));
  v_id := null;
  insert into public.referral_bonuses (seller_id, referred_id, side, status, premium_days, slots)
  values (ref.id, me.id, 'inviter', 'granted', v_days, v_add)
  on conflict (referred_id, side) do nothing
  returning id into v_id;
  if v_id is null then return; end if;
  perform public._referral_add_premium(ref.id, v_days);
  insert into public.salesman_notifications (salesman_id, type, title, body)
  values (ref.id, 'referral_bonus', 'You earned an invite reward',
    me_name || '''s first car is live. '
    || case when ref_prem then '7 days were added to your Premium'
            else 'You have Premium free for 7 days, starting now' end
    || case when v_add > 0 then ', and 2 extra car slots that stay for good (Lite now holds '
                                || (v_lite + v_have + v_add) || ' cars).'
            else '. You already have the most extra car slots (10).' end);
end;
$$;

-- 7. Fire it on approval --------------------------------------------------------
create or replace function public.referral_on_car_approved()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not is_superadmin() then return new; end if;  -- only a person's review counts
  if exists (select 1 from public.profiles p where p.id = new.dealer_id and p.referred_by is not null)
     and not exists (select 1 from public.referral_bonuses b
                      where b.referred_id = new.dealer_id and b.side = 'invitee') then
    perform public.referral_grant_bonus(new.dealer_id);
  end if;
  return new;
exception when others then
  raise warning 'referral_on_car_approved: %', sqlerrm;  -- never block an approval
  return new;
end;
$$;
drop trigger if exists trg_referral_on_car_approved on public.car_listings;
create trigger trg_referral_on_car_approved
  after update of status on public.car_listings
  for each row
  when (old.status = 'pending_approval' and new.status in ('available', 'reserved')
        and new.new_car_model_id is null)
  execute function public.referral_on_car_approved();

-- 8. A seller who types the invite AFTER their car was approved still gets it.
create or replace function public.claim_referral(p_code text)
returns text language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  me     public.profiles%rowtype;
  ref_id uuid;
  v_code text := lower(trim(coalesce(p_code, '')));
  v_res  text;
begin
  if auth.uid() is null then return 'not_signed_in'; end if;

  if (select count(*) from public.referral_claim_attempts
       where user_id = auth.uid() and at > now() - interval '24 hours') >= 10 then
    return 'rate_limited';
  end if;

  select * into me from public.profiles where id = auth.uid();
  if not found or me.role <> 'salesman' or me.dealer_id is not null then
    v_res := 'not_eligible';
  elsif exists (select 1 from auth.users u
                 where u.id = me.id and coalesce(u.is_anonymous, false)) then
    v_res := 'not_eligible';
  elsif me.referred_by is not null then
    v_res := 'already_set';
  elsif me.created_at < now() - interval '14 days'
     or exists (select 1 from public.subscription_payments
                 where user_id = me.id and voided_at is null) then
    v_res := 'too_late';
  elsif v_code = '' or length(v_code) > 64 or v_code !~ '^[a-z0-9-]+$' then
    v_res := 'unknown_code';
  else
    select id into ref_id from public.profiles
     where lower(slug) = v_code
       and role = 'salesman' and dealer_id is null
       and coalesce(is_active, true)
       and coalesce(account_status, 'active') = 'active'
     limit 1;
    if ref_id is null then
      v_res := 'unknown_code';
    elsif ref_id = me.id then
      v_res := 'self';
    else
      perform set_config('app.referral_claim', 'on', true);
      update public.profiles set referred_by = ref_id, referred_at = now() where id = me.id;
      perform set_config('app.referral_claim', 'off', true);
      v_res := 'ok';
      begin
        perform public.referral_grant_bonus(me.id);
      exception when others then
        raise warning 'claim_referral bonus: %', sqlerrm;  -- the claim itself stands
      end;
    end if;
  end if;

  if v_res <> 'not_eligible' then
    insert into public.referral_claim_attempts (user_id, code, result)
    values (auth.uid(), left(v_code, 64), v_res);
  end if;
  return v_res;
end;
$function$;

-- 9. Restored inviter: decide both kinds of reward that waited on them.
create or replace function public.referral_on_restore()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
declare r record;
begin
  if not (auth.uid() is null or is_superadmin()) then return new; end if;
  if coalesce(new.is_active, true) and coalesce(new.account_status, 'active') = 'active'
     and not (coalesce(old.is_active, true) and coalesce(old.account_status, 'active') = 'active') then
    for r in
      select p.id from public.profiles p
       where p.referred_by = new.id
         and not exists (select 1 from public.referral_rewards w where w.referred_id = p.id)
    loop
      perform public.grant_referral_reward(r.id, null);
    end loop;
    for r in
      select p.id from public.profiles p
       where p.referred_by = new.id
         and not exists (select 1 from public.referral_bonuses b
                          where b.referred_id = p.id and b.side = 'inviter')
    loop
      perform public.referral_grant_bonus(r.id);
    end loop;
  end if;
  return new;
exception when others then
  raise warning 'referral_on_restore: %', sqlerrm;  -- never block a restore
  return new;
end;
$function$;

-- 10. Reward days must not use up a Lite seller's own free trial. It used to
-- count ANY plan_expires_at as "used"; now: the trial marker, a payment, the
-- legacy paid flag, or Premium time that did not come from invite rewards.
create or replace function public.start_premium_trial()
returns text language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
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
  if me.premium_trial_started_at is not null or me.payment_status = 'received'
     or exists (select 1 from public.subscription_payments s
                 where s.user_id = me.id and s.voided_at is null)
     or (me.plan_expires_at is not null
         and not exists (select 1 from public.referral_bonuses b
                          where b.seller_id = me.id and b.status = 'granted' and b.premium_days > 0)) then
    return 'used';
  end if;

  perform set_config('app.premium_trial', 'on', true);
  update public.profiles set plan = 'salesman_full' where id = me.id;
  perform set_config('app.premium_trial', 'off', true);
  return 'ok';
end;
$function$;

-- 11. What a seller sees. Old keys kept (an open tab with the old card still works).
create or replace function public.get_my_referrals()
returns json language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select json_build_object(
    'joined',  (select count(*) from public.profiles where referred_by = auth.uid()),
    'pending', (select count(*) from public.profiles p
                 where p.referred_by = auth.uid()
                   and not exists (select 1 from public.referral_rewards w where w.referred_id = p.id)
                   and (select count(*) from public.subscription_payments s
                         where s.user_id = p.id and s.amount_myr > 0 and s.voided_at is null) = 1),
    'earned',  (select count(*) from public.referral_rewards
                 where referrer_id = auth.uid() and status = 'granted'),
    'capped',  (select count(*) from public.referral_rewards
                 where referrer_id = auth.uid() and status = 'capped'),
    'invited_by', (select r.slug from public.profiles me
                     join public.profiles r on r.id = me.referred_by
                    where me.id = auth.uid()),
    'invited_by_name', (select coalesce(nullif(trim(r.full_name), ''), r.slug) from public.profiles me
                     join public.profiles r on r.id = me.referred_by
                    where me.id = auth.uid()),
    'can_claim', (select me.referred_by is null
                     and me.role = 'salesman' and me.dealer_id is null
                     and me.created_at > now() - interval '14 days'
                     and not exists (select 1 from public.subscription_payments s
                                      where s.user_id = me.id and s.voided_at is null)
                    from public.profiles me where me.id = auth.uid()),
    -- REFER-2
    'bonus_slots', public.referral_bonus_slots(auth.uid()),
    'bonus_days',  (select coalesce(sum(premium_days), 0) from public.referral_bonuses
                     where seller_id = auth.uid() and status = 'granted'),
    'lite_cap',    (select listing_cap from public.plan_config where plan = 'salesman_lite'),
    'my_reward',   (select b.status from public.referral_bonuses b
                     where b.referred_id = auth.uid() and b.side = 'invitee'),
    'people', coalesce((
      select json_agg(x order by x.joined_at desc) from (
        select coalesce(nullif(trim(p.full_name), ''), p.slug) as name,
               p.referred_at as joined_at,
               coalesce(b.status, 'waiting') as state
          from public.profiles p
          left join public.referral_bonuses b on b.referred_id = p.id and b.side = 'inviter'
         where p.referred_by = auth.uid()
         order by p.referred_at desc
         limit 50) x), '[]'::json)
  )
  where auth.uid() is not null;
$function$;

-- 12. Anyone already invited with an approved car gets it now.
do $$
declare r record;
begin
  for r in
    select p.id from public.profiles p
     where p.referred_by is not null
       and not exists (select 1 from public.referral_bonuses b where b.referred_id = p.id and b.side = 'invitee')
  loop
    perform public.referral_grant_bonus(r.id);
  end loop;
end $$;

-- Grants ------------------------------------------------------------------------
revoke all on function public.referral_bonus_slots(uuid) from public, anon;
grant execute on function public.referral_bonus_slots(uuid) to authenticated;
revoke all on function public._referral_add_premium(uuid, int) from public, anon, authenticated;
revoke all on function public.referral_grant_bonus(uuid) from public, anon, authenticated;
revoke all on function public.referral_on_car_approved() from public, anon, authenticated;
revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;
revoke all on function public.start_premium_trial() from public, anon;
grant execute on function public.start_premium_trial() to authenticated;
revoke all on function public.get_my_referrals() from public, anon;
grant execute on function public.get_my_referrals() to authenticated;

-- Verify after applying:
--   select oid::regprocedure from pg_proc where proname in
--     ('referral_grant_bonus','referral_bonus_slots','claim_referral','get_my_referrals','start_premium_trial');  -- one row each
--   select has_function_privilege('authenticated','public.referral_grant_bonus(uuid)','execute');  -- false
--   select has_function_privilege('anon','public.get_my_referrals()','execute');  -- false
