-- e-KYC identity verification: make the public "Verified" badge mean "a human
-- checked this seller's ID", and give sellers a way to actually submit one.
--
-- Before this, kyc_documents had ZERO rows and the kyc-docs bucket was empty:
-- the admin REVIEW screen (platform/UserApprovalsTab) and the buyer-facing
-- badge (CarCard, CarDetailPage) both already existed, but nothing in the app
-- let a seller upload an ID. So is_verified only ever meant "a superadmin
-- clicked Approve" -- which for free Lite accounts reviews typed details and
-- no ID at all. The badge was simultaneously unearnable and untruthful.
--
-- Two decisions stay separate on purpose:
--   approval_status / is_active  -> may this account use the product
--   is_verified                  -> did a human check their ID (drives badge)
--
-- Product decision (owner, 2026-08-28): verification is a CARROT, not a stick.
-- An unverified seller is simply un-badged -- never labelled "unsafe". Nothing
-- here gates listing; the manual per-listing approval remains the only gate.
--
-- Applied live via MCP apply_migration on 2026-08-28 (migrations
-- ekyc_identity_verification_flow + ekyc_reuse_existing_submit_kyc);
-- committed here so the repo carries the source.

-- 1) Seller submits ID.
--
-- NOTE: submit_kyc(p_tier, p_front, p_back, p_selfie) ALREADY EXISTED, built in
-- the Supabase dashboard and never committed (exactly the drift CLAUDE.md warns
-- about). It is extended here rather than duplicated -- a second overload made
-- every call ambiguous ("function submit_kyc(unknown,unknown,unknown) is not
-- unique"). It previously DISCARDED paths unless tier='premium', which left
-- Lite sellers with no way to ever earn the badge. Premium still REQUIRES all
-- three; free may attach them; any supplied path is validated to sit under the
-- caller's own uid folder so nobody can register someone else's storage object
-- as their ID.
create or replace function public.submit_kyc(
  p_tier text,
  p_front text default null,
  p_back text default null,
  p_selfie text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_prefix text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_tier not in ('free','premium') then raise exception 'invalid_tier'; end if;
  v_prefix := v_uid::text || '/';

  if p_tier = 'premium' and (p_front is null or p_back is null or p_selfie is null) then
    raise exception 'missing_documents';
  end if;

  if (p_front  is not null and left(p_front,  length(v_prefix)) <> v_prefix)
  or (p_back   is not null and left(p_back,   length(v_prefix)) <> v_prefix)
  or (p_selfie is not null and left(p_selfie, length(v_prefix)) <> v_prefix) then
    raise exception 'invalid_path';
  end if;

  insert into public.kyc_documents (user_id, tier, front_path, back_path, selfie_path, submitted_at)
  values (v_uid, p_tier, p_front, p_back, p_selfie, now())
  on conflict (user_id) do update
    set tier = excluded.tier,
        front_path = excluded.front_path,
        back_path = excluded.back_path,
        selfie_path = excluded.selfie_path,
        submitted_at = now();

  update public.profiles
    set kyc_tier = p_tier,
        kyc_submitted_at = now(),
        approval_status = case when approval_status = 'rejected' then 'pending' else approval_status end
  where id = v_uid;
end;
$function$;

drop function if exists public.submit_kyc(text, text, text);
revoke all on function public.submit_kyc(text, text, text, text) from public;
grant execute on function public.submit_kyc(text, text, text, text) to authenticated;

-- 2) Superadmin decides the IDENTITY question on its own, so a seller approved
--    earlier can still become verified later by submitting ID.
create or replace function public.decide_kyc_verification(
  p_user_id uuid,
  p_approve boolean,
  p_reason  text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_admin uuid := auth.uid();
begin
  if not public.is_superadmin() then raise exception 'not_authorized'; end if;

  if p_approve then
    update public.profiles
      set is_verified = true, verified_at = now(), verified_by = v_admin
    where id = p_user_id;
  else
    update public.profiles
      set is_verified = false, verified_at = null, verified_by = null,
          rejection_reason = nullif(btrim(coalesce(p_reason,'')), '')
    where id = p_user_id;
  end if;

  -- Path record goes either way; the image bytes are purged by the caller
  -- through the Storage API, and without this row the app cannot locate them.
  delete from public.kyc_documents where user_id = p_user_id;
end;
$function$;

revoke all on function public.decide_kyc_verification(uuid, boolean, text) from public;
grant execute on function public.decide_kyc_verification(uuid, boolean, text) to authenticated;

-- 3) Queue of sellers who submitted ID and await an identity decision.
create or replace function public.get_pending_kyc()
returns table(
  id uuid, full_name text, email text, phone text, role text, plan text,
  dealership text, avatar_url text, approval_status text, is_verified boolean,
  kyc_tier text, submitted_at timestamptz,
  front_path text, back_path text, selfie_path text
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.is_superadmin() then raise exception 'not_authorized'; end if;
  return query
    select p.id, p.full_name, p.email, p.phone, p.role, p.plan::text,
           p.dealership, p.avatar_url, p.approval_status, p.is_verified,
           k.tier, k.submitted_at, k.front_path, k.back_path, k.selfie_path
    from public.kyc_documents k
    join public.profiles p on p.id = k.user_id
    order by k.submitted_at asc;
end;
$function$;

revoke all on function public.get_pending_kyc() from public;
grant execute on function public.get_pending_kyc() to authenticated;

-- 4) Account approval no longer hands out the trust badge by itself. It still
--    grants it in the one case where the admin genuinely looked at an ID: the
--    signup queue with documents attached. (is_active is set here too -- see
--    20260828_fix_decide_user_approval_activates_account.sql.)
create or replace function public.decide_user_approval(p_user_id uuid, p_approve boolean, p_reason text default null::text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_admin uuid := auth.uid();
  v_had_docs boolean;
begin
  if not public.is_superadmin() then raise exception 'not_authorized'; end if;

  select exists(select 1 from public.kyc_documents where user_id = p_user_id)
    into v_had_docs;

  if p_approve then
    update public.profiles
      set approval_status = 'approved',
          approved_by = v_admin,
          approved_at = now(),
          rejection_reason = null,
          is_active = true,
          is_verified = case when v_had_docs then true else is_verified end,
          verified_at = case when v_had_docs then now() else verified_at end,
          verified_by = case when v_had_docs then v_admin else verified_by end
    where id = p_user_id;
  else
    update public.profiles
      set approval_status = 'rejected',
          is_verified = false,
          rejection_reason = nullif(btrim(coalesce(p_reason,'')), '')
    where id = p_user_id;
  end if;

  delete from public.kyc_documents where user_id = p_user_id;
end;
$function$;

-- 5) One-off: clear badges granted before the rule above existed, i.e. accounts
--    marked verified with no ID ever reviewed. They can re-earn it through the
--    new flow. (protect_dealer_verification reverts is_verified unless
--    is_superadmin(), so this ran with the superadmin's JWT claims presented.)
--    Left here as documentation of the live backfill; re-running is a no-op.
-- update profiles set is_verified = false, verified_at = null, verified_by = null
-- where is_verified = true and not exists (select 1 from kyc_documents k where k.user_id = profiles.id);
