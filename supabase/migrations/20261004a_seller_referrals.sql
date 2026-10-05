-- Seller referrals (REFER-1, owner decision 2026-10-04)
--
-- A seller who invites another seller earns 30 days of Premium once the
-- invited seller has made TWO real Premium payments. One level only (a
-- referral of a referral earns nothing), no fee to join, capped at 12
-- rewards per 365 days, never cash. Act 500 (anti-pyramid): the reward only
-- ever comes from a real paid subscription, never from the recruiting.
--
-- Prerequisite this also fixes: there was no record of payments at all.
-- "Mark payment received" flipped profiles.payment_status to 'received',
-- which is_salesman_premium() honours with NO end date, so a paid seller
-- stayed Premium forever. Payments are now rows, and logging one moves
-- plan_expires_at forward instead.

-- 1. Payment log ---------------------------------------------------------
create table if not exists public.subscription_payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  plan        text not null,
  amount_myr  numeric(10,2) not null check (amount_myr >= 0),
  months      int not null default 1 check (months between 1 and 12),
  paid_on     date not null default ((now() at time zone 'Asia/Kuala_Lumpur')::date),
  note        text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists subscription_payments_user_idx
  on public.subscription_payments (user_id, created_at);
alter table public.subscription_payments enable row level security;
-- Read: your own payments, or the platform owner. Writes: only through
-- record_subscription_payment() below, so there is no write policy.
create policy subscription_payments_read on public.subscription_payments
  for select to authenticated
  using (user_id = (select auth.uid()) or (select is_superadmin()));
revoke insert, update, delete, truncate on public.subscription_payments from anon, authenticated;
revoke all on public.subscription_payments from anon;

-- 2. Who invited whom ----------------------------------------------------
alter table public.profiles
  add column if not exists referred_by uuid references public.profiles(id) on delete set null,
  add column if not exists referred_at timestamptz;
create index if not exists profiles_referred_by_idx on public.profiles (referred_by)
  where referred_by is not null;

-- The browser can never write these two columns: only claim_referral()
-- (which sets app.referral_claim for its own transaction) or the platform
-- owner. Without this, a seller could point referred_by at a friend.
create or replace function public.guard_profile_referral()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or is_superadmin()
     or coalesce(current_setting('app.referral_claim', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.referred_by := null;
    new.referred_at := null;
  else
    new.referred_by := old.referred_by;
    new.referred_at := old.referred_at;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_profile_referral on public.profiles;
create trigger trg_guard_profile_referral
  before insert or update of referred_by, referred_at on public.profiles
  for each row execute function public.guard_profile_referral();

-- 3. Rewards (one row per invited seller, at most) ------------------------
create table if not exists public.referral_rewards (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  payment_id  uuid references public.subscription_payments(id) on delete set null,
  status      text not null check (status in ('granted', 'capped', 'ineligible')),
  days        int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists referral_rewards_referrer_idx
  on public.referral_rewards (referrer_id, created_at);
alter table public.referral_rewards enable row level security;
create policy referral_rewards_read on public.referral_rewards
  for select to authenticated
  using ((select is_superadmin()));
revoke insert, update, delete, truncate on public.referral_rewards from anon, authenticated;
revoke all on public.referral_rewards from anon;

-- 4. Attach an invite to the signed-in seller ------------------------------
-- The code is the inviter's public slug (xdrive.my/s/<slug>), so there is
-- no second code to keep in sync. Set once, within 14 days of signing up,
-- before any payment, never to yourself.
create or replace function public.claim_referral(p_code text)
returns text language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  me     public.profiles%rowtype;
  ref_id uuid;
begin
  if auth.uid() is null then return 'not_signed_in'; end if;
  select * into me from public.profiles where id = auth.uid();
  if not found or me.role <> 'salesman' or me.dealer_id is not null then
    return 'not_eligible';
  end if;
  if exists (select 1 from auth.users u
              where u.id = me.id and coalesce(u.is_anonymous, false)) then
    return 'not_eligible';
  end if;
  if me.referred_by is not null then return 'already_set'; end if;
  if me.created_at < now() - interval '14 days'
     or exists (select 1 from public.subscription_payments where user_id = me.id) then
    return 'too_late';
  end if;

  select id into ref_id from public.profiles
   where lower(slug) = lower(trim(coalesce(p_code, '')))
     and role = 'salesman' and dealer_id is null
     and coalesce(is_active, true)
     and coalesce(account_status, 'active') = 'active'
   limit 1;
  if ref_id is null then return 'unknown_code'; end if;
  if ref_id = me.id then return 'self'; end if;

  perform set_config('app.referral_claim', 'on', true);
  update public.profiles set referred_by = ref_id, referred_at = now() where id = me.id;
  perform set_config('app.referral_claim', 'off', true);
  return 'ok';
end;
$$;

-- 5. The reward, fired by a payment ---------------------------------------
create or replace function public.grant_referral_reward(p_referred uuid, p_payment uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  me    public.profiles%rowtype;
  ref   public.profiles%rowtype;
  paid  int;
  given int;
begin
  select * into me from public.profiles where id = p_referred;
  if not found or me.referred_by is null
     or me.role <> 'salesman' or me.dealer_id is not null then
    return;
  end if;
  if exists (select 1 from public.referral_rewards where referred_id = p_referred) then
    return;  -- already decided for this seller
  end if;
  -- Comped (RM0) rows are not payments.
  select count(*) into paid from public.subscription_payments
   where user_id = p_referred and amount_myr > 0;
  if paid < 2 then return; end if;

  select * into ref from public.profiles where id = me.referred_by for update;
  if not found or ref.role <> 'salesman' or ref.dealer_id is not null
     or not coalesce(ref.is_active, true)
     or coalesce(ref.account_status, 'active') <> 'active' then
    insert into public.referral_rewards (referrer_id, referred_id, payment_id, status)
    values (me.referred_by, p_referred, p_payment, 'ineligible');
    return;
  end if;

  select count(*) into given from public.referral_rewards
   where referrer_id = ref.id and status = 'granted'
     and created_at > now() - interval '365 days';
  if given >= 12 then
    insert into public.referral_rewards (referrer_id, referred_id, payment_id, status)
    values (ref.id, p_referred, p_payment, 'capped');
    return;
  end if;

  insert into public.referral_rewards (referrer_id, referred_id, payment_id, status, days)
  values (ref.id, p_referred, p_payment, 'granted', 30);

  update public.profiles
     set plan = 'salesman_full',
         plan_expires_at = greatest(now(), coalesce(plan_expires_at, now())) + interval '30 days'
   where id = ref.id;

  -- This row IS the push (trg_push_on_salesman_notification).
  insert into public.salesman_notifications (salesman_id, type, title, body)
  values (ref.id, 'referral_reward', 'You earned a free Premium month',
          'A seller you invited has now paid for Premium twice, so 30 days were added to your Premium.');
end;
$$;

-- 6. Logging a payment (platform owner only) ------------------------------
create or replace function public.record_subscription_payment(
  p_user    uuid,
  p_amount  numeric default null,
  p_months  int     default 1,
  p_paid_on date    default null,
  p_note    text    default null
) returns public.subscription_payments
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  target public.profiles%rowtype;
  v_plan text;
  pay    public.subscription_payments%rowtype;
  solo   boolean;
begin
  if not is_superadmin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_months is null or p_months < 1 or p_months > 12 then
    raise exception 'months must be 1 to 12' using errcode = '22023';
  end if;
  select * into target from public.profiles where id = p_user for update;
  if not found then raise exception 'account not found' using errcode = 'P0002'; end if;

  solo   := target.role = 'salesman' and target.dealer_id is null;
  v_plan := case when target.role = 'salesman' then 'salesman_full'
                 else coalesce(target.plan::text, 'dealer_starter') end;

  insert into public.subscription_payments
    (user_id, plan, amount_myr, months, paid_on, note, recorded_by)
  values (
    p_user, v_plan,
    coalesce(p_amount, (select price_myr from public.plan_config where plan = v_plan) * p_months, 0),
    p_months,
    coalesce(p_paid_on, (now() at time zone 'Asia/Kuala_Lumpur')::date),
    nullif(trim(coalesce(p_note, '')), ''),
    auth.uid()
  ) returning * into pay;

  if solo then
    -- Paid THROUGH a date, not paid forever: payment_status goes back to
    -- NULL so is_salesman_premium() runs on plan_expires_at alone.
    update public.profiles
       set plan = 'salesman_full',
           plan_expires_at = greatest(now(), coalesce(plan_expires_at, now()))
                             + make_interval(months => p_months),
           payment_status = null,
           subscription_status = 'active'
     where id = p_user;
  else
    update public.profiles
       set payment_status = 'received', subscription_status = 'active'
     where id = p_user;
  end if;

  perform public.grant_referral_reward(p_user, pay.id);
  return pay;
end;
$$;

-- 7. What a seller sees about their own invites ---------------------------
create or replace function public.get_my_referrals()
returns json language sql stable security definer
set search_path = public, pg_temp
as $$
  select json_build_object(
    'joined',  (select count(*) from public.profiles where referred_by = auth.uid()),
    'earned',  (select count(*) from public.referral_rewards
                 where referrer_id = auth.uid() and status = 'granted'),
    'capped',  (select count(*) from public.referral_rewards
                 where referrer_id = auth.uid() and status = 'capped')
  )
  where auth.uid() is not null;
$$;

-- Grants: Supabase grants new functions to anon directly, so revoke from
-- anon as well as public.
revoke all on function public.guard_profile_referral() from public, anon, authenticated;
revoke all on function public.grant_referral_reward(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_referral(text) from public, anon;
revoke all on function public.record_subscription_payment(uuid, numeric, int, date, text) from public, anon;
revoke all on function public.get_my_referrals() from public, anon;
grant execute on function public.claim_referral(text) to authenticated;
grant execute on function public.record_subscription_payment(uuid, numeric, int, date, text) to authenticated;
grant execute on function public.get_my_referrals() to authenticated;
