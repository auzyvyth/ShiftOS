-- SEC-11 (2026-10-28): close the holes found in the dealer-side audit.
--
-- 1. A sign-up request chose its own role and dealer. handle_new_user copied
--    raw_user_meta_data->>'role' and ->>'dealer_id' (both client-supplied in
--    supabase.auth.signUp options.data), and every role guard skips the signup
--    insert because auth.uid() is null there. So signUp({data:{role:'superadmin'}})
--    made a platform admin (console, every ID photo in kyc-docs), and
--    data:{role:'manager', dealer_id:<any dealer>} joined that dealer's team
--    (its customers, ICs, car docs). Now a signup can only be a buyer, salesman
--    or dealer, never linked. The two trusted paths (edge functions invites +
--    create-salesman, service role) already re-set role and dealer_id in a
--    follow-up UPDATE; guard_profile_approval_cols now lets that service-role
--    UPDATE through and approves the account the way handle_new_user used to.
-- 2. Any account that signed up as a dealer, approved or not, could make an
--    invite code (create_dealer_invite, or a direct insert into dealer_invites).
--    A salesman who redeemed it moved their leads (buyer names, phones) under
--    that "dealer" and got Premium free. Invites now need a dealer the platform
--    approved, checked again when the code is redeemed; direct inserts are gone.
-- 3. Small: waitlist inserts by a signed-in (incl. guest) user skipped the anon
--    validation; two internal helpers were callable by the public.
--
-- No existing account is changed. Verified 2026-10-28: the only superadmin and
-- the only signup carrying role metadata 'superadmin' are the owner's own.

begin;

-- ---------- helper: a dealer the platform approved and has not switched off ----------
create or replace function public._dealer_in_good_standing(p_dealer uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $f$
  select exists (
    select 1 from public.profiles
     where id = p_dealer
       and role in ('dealer', 'owner')
       and approval_status = 'approved'
       and coalesce(is_active, false)
       and account_status is distinct from 'deleted'
       and suspended_at is null
  );
$f$;
revoke all on function public._dealer_in_good_standing(uuid) from public, anon, authenticated;

-- ---------- 1. signup can no longer pick its role or dealer ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $f$
declare
  v_role text;
  v_name text;
  v_avatar text;
  v_plan account_plan;
begin
  -- An anonymous session can never be a seller account.
  if coalesce(new.is_anonymous, false) then
    v_role := 'buyer';
  else
    -- Only the three self-serve roles. Anything else in the request (superadmin,
    -- manager, ...) falls back to account_type. Staff roles and dealer links are
    -- set afterwards by the service-role edge functions, never by the request.
    v_role := case
      when new.raw_user_meta_data->>'role' in ('buyer', 'salesman', 'dealer')
        then new.raw_user_meta_data->>'role'
      else case new.raw_user_meta_data->>'account_type'
        when 'buyer'    then 'buyer'
        when 'salesman' then 'salesman'
        else 'dealer'
      end
    end;
  end if;

  v_name := nullif(trim(coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name', '')), '');
  v_avatar := nullif(trim(coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture', '')), '');

  -- Plan only within the role's own pair; entitlement is plan_expires_at anyway.
  v_plan := case
    when v_role = 'salesman' and new.raw_user_meta_data->>'plan' = 'salesman_full'
      then 'salesman_full'::account_plan
    when v_role = 'salesman' then 'salesman_lite'::account_plan
    else null
  end;

  insert into public.profiles (id, email, role, plan, is_active, full_name, avatar_url, dealer_id, approval_status)
  values (
    new.id, new.email, v_role, v_plan,
    (v_role = 'buyer'),
    v_name,
    v_avatar,
    null,
    case when v_role in ('dealer', 'salesman') then 'pending' else 'approved' end
  )
  on conflict (id) do nothing;
  return new;
end;
$f$;

-- The trusted follow-up UPDATE (service role) may set approval, and an account
-- it links to a dealer or makes staff is approved, as handle_new_user did when it
-- trusted the request.
create or replace function public.guard_profile_approval_cols()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $f$
begin
  if public.is_superadmin() then
    return new;
  end if;

  if auth.role() = 'service_role' then
    if tg_op = 'UPDATE'
       and coalesce(new.approval_status, 'pending') = 'pending'
       and new.approval_status is not distinct from old.approval_status
       and (new.role in ('manager', 'admin', 'accountant', 'fi_officer')
            or (new.role = 'salesman' and new.dealer_id is not null and old.dealer_id is null)) then
      new.approval_status := 'approved';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.role,'') = 'dealer'
       or (coalesce(new.role,'') = 'salesman' and new.dealer_id is null) then
      new.approval_status := 'pending';
    end if;
    new.is_verified      := false;
    new.verified_at      := null;
    new.verified_by      := null;
    new.approved_by      := null;
    new.approved_at      := null;
    new.rejection_reason := null;
    return new;
  end if;

  -- Only the owner re-entering the queue after a rejection may change status.
  if not (old.approval_status = 'rejected'
          and new.approval_status = 'pending'
          and auth.uid() = new.id) then
    new.approval_status := old.approval_status;
  end if;
  -- These are never client-writable, resubmission or not.
  new.is_verified      := old.is_verified;
  new.verified_at      := old.verified_at;
  new.verified_by      := old.verified_by;
  new.approved_by      := old.approved_by;
  new.approved_at      := old.approved_at;
  new.rejection_reason := old.rejection_reason;
  return new;
end;
$f$;

-- ---------- 2. invites only from an approved dealer ----------
create or replace function public.create_dealer_invite(p_email text default null::text, p_invited_name text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $f$
declare
  v_dealer_id uuid;
  v_code text;
  v_invite_id uuid;
begin
  -- The invite links to the DEALER, also when a manager/admin makes it
  -- (it used to link the salesman to the manager's own profile).
  select case when role in ('dealer', 'owner') then id else dealer_id end
    into v_dealer_id
    from profiles
   where id = auth.uid()
     and role in ('dealer', 'owner', 'manager', 'admin');

  if v_dealer_id is null or not public._dealer_in_good_standing(v_dealer_id) then
    return jsonb_build_object('success', false, 'error', 'Only an approved dealer account can create invites');
  end if;

  v_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into dealer_invites (dealer_id, code, email, invited_name)
  values (v_dealer_id, v_code, p_email, p_invited_name)
  returning id into v_invite_id;

  return jsonb_build_object(
    'success', true,
    'code', v_code,
    'invite_id', v_invite_id,
    'expires_at', (now() + interval '7 days')
  );
end;
$f$;

-- Checked again at redemption: covers codes made before this migration and a
-- dealer suspended after making one. Same error text, so the screen is unchanged.
create or replace function public.use_dealer_invite(invite_code text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_invite dealer_invites%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  select * into v_invite from dealer_invites
   where code = upper(trim(invite_code)) and used = false and expires_at > now();
  if not found or not public._dealer_in_good_standing(v_invite.dealer_id) then
    raise exception 'invalid_or_expired_invite';
  end if;

  perform set_config('app.allow_tenant_move', 'on', true);

  update profiles set dealer_id = v_invite.dealer_id, plan = 'salesman_full'
   where id = v_user_id and role = 'salesman';
  if not found then raise exception 'profile_not_found'; end if;

  update leads set dealer_id = v_invite.dealer_id
   where salesman_id = v_user_id and dealer_id is null;
  update car_listings set dealer_id = v_invite.dealer_id
   where assigned_to = v_user_id;

  update dealer_invites set used = true, accepted_by = v_user_id, accepted_at = now()
   where id = v_invite.id;
end;
$f$;

create or replace function public.redeem_invite(p_code text)
returns table(dealer_id uuid)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $f$
  select d.dealer_id from public.dealer_invites d
   where d.code = upper(btrim(p_code)) and d.used = false and d.expires_at > now()
     and public._dealer_in_good_standing(d.dealer_id)
   limit 1;
$f$;

create or replace function public.dealer_grant_premium(p_salesman_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $f$
declare
  v_dealer_id uuid := auth.uid();
begin
  if not exists (
    select 1 from profiles
     where id = v_dealer_id
       and role in ('dealer', 'owner', 'manager', 'admin')
  ) or not public._dealer_in_good_standing(public.get_my_dealer_id()) then
    return jsonb_build_object('success', false, 'error', 'Only an approved dealer account can grant premium');
  end if;

  if not exists (
    select 1 from profiles
     where id = p_salesman_id
       and dealer_id = v_dealer_id
       and role = 'salesman'
  ) then
    return jsonb_build_object('success', false, 'error', 'Salesman is not linked to your account');
  end if;

  update profiles
     set plan = 'salesman_full',
         plan_granted_by = v_dealer_id,
         plan_granted_at = now(),
         plan_expires_at = null  -- null = active until dealer revokes
   where id = p_salesman_id;

  return jsonb_build_object('success', true, 'salesman_id', p_salesman_id, 'granted_by', v_dealer_id);
end;
$f$;

-- No direct writes to invites: codes come only from create_dealer_invite.
drop policy if exists dealer_invites_owner_all on public.dealer_invites;
create policy dealer_invites_owner_select on public.dealer_invites
  for select using (dealer_id = (select auth.uid()));
create policy dealer_invites_owner_delete on public.dealer_invites
  for delete using (dealer_id = (select auth.uid()));

-- ---------- 3. small ones ----------
-- Signed-in (incl. guest) waitlist inserts get the same checks as anon ones.
alter policy auth_insert on public.waitlist_signups
  with check (((length(btrim(name)) >= 2) and (length(btrim(name)) <= 100))
    and (phone ~ '^\+?[0-9]{9,15}$'::text)
    and ((referral_code is null) or (length(referral_code) <= 40))
    and ((referred_by is null) or (length(referred_by) <= 40))
    and waitlist_rate_ok(phone));

-- Internal helpers: only other SECURITY DEFINER functions call these.
revoke execute on function public.resolve_lead_salesman(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.resolve_lead_salesman(uuid, uuid, text, uuid) to service_role;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

commit;
