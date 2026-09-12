-- PUSH-5: "ID verification submitted" never arrived as a phone push, on
-- either end of the flow.
--
-- submit_kyc() only wrote kyc_documents + profiles -- no notification row, so
-- the superadmin queue (`get_pending_kyc`) could sit unopened indefinitely
-- with no signal a submission was waiting. decide_kyc_verification() had the
-- same gap in the other direction: once decided, the seller had no way to
-- know except reloading the page and noticing the badge (or the rejection
-- reason) had changed.
--
-- Both fixed the same way as everywhere else in this codebase: a row in
-- dealer_notifications / salesman_notifications (or notify_ops for the
-- superadmin) IS the push -- no send-push call needed here.

-- 1) Seller submits -> superadmin gets pushed, same channel as new-signup /
--    pending-listing alerts. Keyed per-user so a resubmission inside the
--    15-minute notify_ops throttle window doesn't re-alert, but a genuinely
--    different seller always does.
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
  v_seller text;
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

  select coalesce(full_name, email, 'A seller') into v_seller
  from public.profiles where id = v_uid;

  perform public.notify_ops(
    'kyc_submitted:' || v_uid::text,
    '🆔 ID verification submitted' || E'\n' ||
    coalesce(v_seller, '-') || ' (' || p_tier || ') is waiting for review.'
  );
end;
$function$;

revoke all on function public.submit_kyc(text, text, text, text) from public;
grant execute on function public.submit_kyc(text, text, text, text) to authenticated;

-- 2) Superadmin decides -> the seller gets pushed. Same dealer/salesman
--    branch set_account_suspended already uses, so a solo Lite account
--    (role='salesman', dealer_id null) still lands in salesman_notifications
--    and gets routed home correctly by push_home_path.
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
declare
  v_admin uuid := auth.uid();
  v_role text;
  v_reason text;
begin
  if not public.is_superadmin() then raise exception 'not_authorized'; end if;

  select role into v_role from public.profiles where id = p_user_id;

  if p_approve then
    update public.profiles
      set is_verified = true, verified_at = now(), verified_by = v_admin
    where id = p_user_id;
  else
    v_reason := nullif(btrim(coalesce(p_reason,'')), '');
    update public.profiles
      set is_verified = false, verified_at = null, verified_by = null,
          rejection_reason = v_reason
    where id = p_user_id;
  end if;

  if v_role in ('dealer', 'owner') then
    insert into public.dealer_notifications (dealer_id, type, title, body)
    values (
      p_user_id,
      case when p_approve then 'kyc_approved' else 'kyc_rejected' end,
      case when p_approve then 'Identity verified' else 'ID verification wasn''t accepted' end,
      case when p_approve
           then 'Your listings now carry the Verified badge on the marketplace.'
           else coalesce(v_reason, 'Please resubmit clearer photos.') end
    );
  elsif v_role = 'salesman' then
    insert into public.salesman_notifications (salesman_id, type, title, body)
    values (
      p_user_id,
      case when p_approve then 'kyc_approved' else 'kyc_rejected' end,
      case when p_approve then 'Identity verified' else 'ID verification wasn''t accepted' end,
      case when p_approve
           then 'Your listings now carry the Verified badge on the marketplace.'
           else coalesce(v_reason, 'Please resubmit clearer photos.') end
    );
  end if;

  -- Path record goes either way; the image bytes are purged by the caller
  -- through the Storage API, and without this row the app cannot locate them.
  delete from public.kyc_documents where user_id = p_user_id;
end;
$function$;

revoke all on function public.decide_kyc_verification(uuid, boolean, text) from public;
grant execute on function public.decide_kyc_verification(uuid, boolean, text) to authenticated;
