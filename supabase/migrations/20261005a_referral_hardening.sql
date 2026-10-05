-- Referral hardening for Lite + Premium (REFER-1 follow-up, 2026-10-05).
-- Apply AFTER 20261004a + 20261004b, in the same sitting.
--
-- 1. Rate limit on claim_referral: 10 tries per seller per 24h, every try
--    logged. The new "Invited by" box lets a seller type a code, so the
--    function is now reachable by hand, not only from a stored link.
-- 2. slug is locked once onboarding is done. The invite code IS the slug:
--    a changed slug broke every shared link, and whoever took the old slug
--    next collected the pending invites.
-- 3. A payment can be VOIDED (superadmin). Voided rows stop counting, the
--    months they added come off, and a reward that no longer holds is taken
--    back from the referrer.
-- 4. A referrer who was suspended when the reward fell due gets it once
--    they are active again (was: lost forever as 'ineligible').
-- 5. Two payments logged at once no longer roll each other back.
-- 6. get_my_referrals also returns 'pending' (paid once, one to go) and
--    'invited_by' (the slug of whoever invited me, if anyone).

-- 0. Rate-limit log ---------------------------------------------------------
create table if not exists public.referral_claim_attempts (
  id      bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  code    text,
  result  text,
  at      timestamptz not null default now()
);
create index if not exists referral_claim_attempts_user_idx
  on public.referral_claim_attempts (user_id, at);
alter table public.referral_claim_attempts enable row level security;
-- Platform owner reads; nobody writes except claim_referral().
create policy referral_claim_attempts_read on public.referral_claim_attempts
  for select to authenticated using ((select is_superadmin()));
revoke all on public.referral_claim_attempts from anon;
revoke insert, update, delete, truncate on public.referral_claim_attempts from authenticated;

-- 1. claim_referral with a rate limit ----------------------------------------
-- Errors are RETURNED, never raised: a raise would roll back the attempt row
-- and the limit would count nothing.
create or replace function public.claim_referral(p_code text)
returns text language plpgsql security definer
set search_path = public, pg_temp
as $$
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
    end if;
  end if;

  -- 'not_eligible' is not logged: dealers and linked reps never reach the
  -- box, and logging them would only grow the table.
  if v_res <> 'not_eligible' then
    insert into public.referral_claim_attempts (user_id, code, result)
    values (auth.uid(), left(v_code, 64), v_res);
  end if;
  return v_res;
end;
$$;

-- 2. Slug lock ---------------------------------------------------------------
create or replace function public.guard_profile_slug()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or is_superadmin() then return new; end if;
  -- Only a SETTLED slug is locked: onboarding may still be choosing one.
  -- Sellers only: the invite code is a SALESMAN slug. Dealers keep editing theirs.
  if old.role = 'salesman' and old.slug is not null
     and coalesce(old.onboarding_complete, false)
     and new.slug is distinct from old.slug then
    new.slug := old.slug;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_profile_slug on public.profiles;
create trigger trg_guard_profile_slug
  before update of slug on public.profiles
  for each row execute function public.guard_profile_slug();

-- 3. Void a payment ----------------------------------------------------------
alter table public.subscription_payments
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles(id) on delete set null,
  add column if not exists void_reason text;

-- 4 + 5. The reward, re-stated ------------------------------------------------
-- Changes from 20261004a: voided payments do not count; a referrer who is not
-- active writes NO row (so the reward can still land once they are restored);
-- the insert tolerates a concurrent one for the same seller.
create or replace function public.grant_referral_reward(p_referred uuid, p_payment uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  me    public.profiles%rowtype;
  ref   public.profiles%rowtype;
  paid  int;
  given int;
  v_id  uuid;
begin
  select * into me from public.profiles where id = p_referred;
  if not found or me.referred_by is null
     or me.role <> 'salesman' or me.dealer_id is not null then
    return;
  end if;
  if exists (select 1 from public.referral_rewards where referred_id = p_referred) then
    return;
  end if;
  select count(*) into paid from public.subscription_payments
   where user_id = p_referred and amount_myr > 0 and voided_at is null;
  if paid < 2 then return; end if;

  select * into ref from public.profiles where id = me.referred_by for update;
  if not found or ref.role <> 'salesman' or ref.dealer_id is not null then
    insert into public.referral_rewards (referrer_id, referred_id, payment_id, status)
    values (me.referred_by, p_referred, p_payment, 'ineligible')
    on conflict (referred_id) do nothing;
    return;
  end if;
  -- Suspended or deleted right now: decide later (trg_referral_on_restore).
  if not coalesce(ref.is_active, true)
     or coalesce(ref.account_status, 'active') <> 'active' then
    return;
  end if;

  select count(*) into given from public.referral_rewards
   where referrer_id = ref.id and status = 'granted'
     and created_at > now() - interval '365 days';
  if given >= 12 then
    insert into public.referral_rewards (referrer_id, referred_id, payment_id, status)
    values (ref.id, p_referred, p_payment, 'capped')
    on conflict (referred_id) do nothing;
    return;
  end if;

  insert into public.referral_rewards (referrer_id, referred_id, payment_id, status, days)
  values (ref.id, p_referred, p_payment, 'granted', 30)
  on conflict (referred_id) do nothing
  returning id into v_id;
  if v_id is null then return; end if;  -- a concurrent call already decided

  update public.profiles
     set plan = 'salesman_full',
         plan_expires_at = greatest(now(), coalesce(plan_expires_at, now())) + interval '30 days'
   where id = ref.id;

  insert into public.salesman_notifications (salesman_id, type, title, body)
  values (ref.id, 'referral_reward', 'You earned a free Premium month',
          'A seller you invited has now paid for Premium twice, so 30 days were added to your Premium.');
end;
$$;

create or replace function public.void_subscription_payment(p_payment uuid, p_reason text default null)
returns public.subscription_payments
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  pay    public.subscription_payments%rowtype;
  target public.profiles%rowtype;
  rew    public.referral_rewards%rowtype;
  paid   int;
begin
  if not is_superadmin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into pay from public.subscription_payments where id = p_payment for update;
  if not found then raise exception 'payment not found' using errcode = 'P0002'; end if;
  if pay.voided_at is not null then return pay; end if;  -- idempotent

  update public.subscription_payments
     set voided_at = now(), voided_by = auth.uid(),
         void_reason = nullif(trim(coalesce(p_reason, '')), '')
   where id = p_payment
  returning * into pay;

  select * into target from public.profiles where id = pay.user_id for update;
  if found and target.role = 'salesman' and target.dealer_id is null then
    update public.profiles
       set plan_expires_at = plan_expires_at - make_interval(months => pay.months)
     where id = pay.user_id and plan_expires_at is not null;
  end if;

  -- Take back a reward this seller no longer qualifies for.
  select * into rew from public.referral_rewards where referred_id = pay.user_id;
  if found then
    select count(*) into paid from public.subscription_payments
     where user_id = pay.user_id and amount_myr > 0 and voided_at is null;
    if paid < 2 then
      if rew.status = 'granted' then
        update public.profiles
           set plan_expires_at = plan_expires_at - make_interval(days => rew.days)
         where id = rew.referrer_id and plan_expires_at is not null;
        insert into public.salesman_notifications (salesman_id, type, title, body)
        values (rew.referrer_id, 'referral_reversed', 'A free Premium month was removed',
                'A payment from a seller you invited was cancelled, so the 30 days it earned you were taken back.');
      end if;
      -- Deleted, not marked: if they pay twice again the reward can land again.
      delete from public.referral_rewards where id = rew.id;
    end if;
  end if;
  return pay;
end;
$$;

-- 4. Restored referrer: decide the rewards that waited on them ----------------
create or replace function public.referral_on_restore()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare r record;
begin
  -- Only a platform restore (console / set_account_suspended). A seller's own
  -- self-restore runs as that seller, and trg_prevent_profile_privilege_escalation
  -- would silently undo the plan_expires_at change while the reward row still
  -- said 'granted'. Their reward is decided at the invited seller's next payment.
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
  end if;
  return new;
exception when others then
  raise warning 'referral_on_restore: %', sqlerrm;  -- never block a restore
  return new;
end;
$$;
drop trigger if exists trg_referral_on_restore on public.profiles;
create trigger trg_referral_on_restore
  after update of is_active, account_status on public.profiles
  for each row execute function public.referral_on_restore();

-- 6. What a seller sees about their own invites -------------------------------
create or replace function public.get_my_referrals()
returns json language sql stable security definer
set search_path = public, pg_temp
as $$
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
    'can_claim', (select me.referred_by is null
                     and me.role = 'salesman' and me.dealer_id is null
                     and me.created_at > now() - interval '14 days'
                     and not exists (select 1 from public.subscription_payments s
                                      where s.user_id = me.id and s.voided_at is null)
                    from public.profiles me where me.id = auth.uid())
  )
  where auth.uid() is not null;
$$;

-- Grants ----------------------------------------------------------------------
revoke all on function public.guard_profile_slug() from public, anon, authenticated;
revoke all on function public.referral_on_restore() from public, anon, authenticated;
revoke all on function public.grant_referral_reward(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_referral(text) from public, anon;
revoke all on function public.void_subscription_payment(uuid, text) from public, anon;
revoke all on function public.get_my_referrals() from public, anon;
grant execute on function public.claim_referral(text) to authenticated;
grant execute on function public.void_subscription_payment(uuid, text) to authenticated;
grant execute on function public.get_my_referrals() to authenticated;
