-- Platform console audit, 2026-10-13. One migration, one schema reload.
--
-- 1. set_listing_admin_note / set_listing_docs_verified / approve_listing /
--    reject_listing guarded with `(select role ...) != 'superadmin'`. For a caller
--    with no profiles row (anon: auth.uid() is null) that comparison is NULL, an
--    IF on NULL does not raise, and the function carried on. The first two were
--    granted to anon: anyone with the public key could overwrite admin notes on
--    every listing and forge "Documents verified" rows in activity_log.
-- 2. kyc_documents had an owner ALL policy, so a seller could write their own
--    row directly and point it at ANOTHER seller's photos (the reviewer can open
--    any path). Writes go through submit_kyc (SECURITY DEFINER) only.
-- 3. kyc-docs storage: owners could overwrite a photo after submitting (it can
--    change between review and approval), and guest buyers could upload.
-- 4. _bk_airy_* backup tables hold buyer personal data and still carried API
--    grants (RLS with no policy was the only thing in the way).

begin;

create or replace function public.set_listing_admin_note(p_listing_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then
    raise exception 'Unauthorized';
  end if;
  update car_listings set admin_notes = nullif(btrim(p_note), '') where id = p_listing_id;
end; $$;

create or replace function public.set_listing_docs_verified(p_listing_id uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_dealer_id uuid;
begin
  if not public.is_superadmin() then
    raise exception 'Unauthorized';
  end if;
  select full_name into v_actor_name from profiles where id = v_actor_id;

  update car_listings
     set docs_verified = p_verified,
         docs_verified_at = case when p_verified then now() else null end,
         docs_verified_by = case when p_verified then v_actor_id else null end
   where id = p_listing_id
  returning dealer_id into v_dealer_id;

  if v_dealer_id is null then
    return;
  end if;

  insert into activity_log (dealer_id, actor_id, actor_name, actor_role, table_name, record_id, action, summary)
  values (v_dealer_id, v_actor_id, v_actor_name, 'superadmin', 'car_listings', p_listing_id,
    case when p_verified then 'docs_verified' else 'docs_unverified' end,
    case when p_verified then 'Documents verified' else 'Document verification removed' end);
end; $$;

create or replace function public.approve_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_dealer_id uuid;
  v_summary text;
begin
  if not public.is_superadmin() then
    raise exception 'Unauthorized';
  end if;
  select full_name into v_actor_name from profiles where id = v_actor_id;

  update car_listings set status = 'available', rejection_reason = null
  where id = p_listing_id and status = 'pending_approval'
  returning dealer_id into v_dealer_id;

  if v_dealer_id is null then
    return;
  end if;

  select 'Approved ' || coalesce(year::text || ' ', '') || coalesce(brand, '') || ' ' || coalesce(model, '') ||
    ' by ' || coalesce((select full_name from profiles where id = v_dealer_id), 'salesman')
  into v_summary
  from car_listings where id = p_listing_id;

  insert into salesman_notifications (salesman_id, type, title, body, ref_id)
  values (v_dealer_id, 'listing_approved', 'Listing approved', 'Your listing has been approved and is now live.', p_listing_id);

  insert into activity_log (dealer_id, actor_id, actor_name, actor_role, table_name, record_id, action, field_changes, summary)
  values (v_dealer_id, v_actor_id, v_actor_name, 'superadmin', 'car_listings', p_listing_id, 'approved',
    jsonb_build_object('status', jsonb_build_object('from', 'pending_approval', 'to', 'available')), v_summary);
end; $$;

create or replace function public.reject_listing(p_listing_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_dealer_id uuid;
  v_summary text;
begin
  if not public.is_superadmin() then
    raise exception 'Unauthorized';
  end if;
  select full_name into v_actor_name from profiles where id = v_actor_id;

  update car_listings set status = 'rejected', rejection_reason = p_reason
  where id = p_listing_id and status = 'pending_approval'
  returning dealer_id into v_dealer_id;

  if v_dealer_id is null then
    return;
  end if;

  select 'Rejected ' || coalesce(year::text || ' ', '') || coalesce(brand, '') || ' ' || coalesce(model, '') ||
    ' by ' || coalesce((select full_name from profiles where id = v_dealer_id), 'salesman')
  into v_summary
  from car_listings where id = p_listing_id;

  insert into salesman_notifications (salesman_id, type, title, body, ref_id)
  values (v_dealer_id, 'listing_rejected', 'Listing rejected', p_reason, p_listing_id);

  insert into activity_log (dealer_id, actor_id, actor_name, actor_role, table_name, record_id, action, field_changes, summary)
  values (v_dealer_id, v_actor_id, v_actor_name, 'superadmin', 'car_listings', p_listing_id, 'rejected',
    jsonb_build_object('status', jsonb_build_object('from', 'pending_approval', 'to', 'rejected')), v_summary);
end; $$;

revoke execute on function public.set_listing_admin_note(uuid, text) from public, anon;
revoke execute on function public.set_listing_docs_verified(uuid, boolean) from public, anon;
revoke execute on function public.approve_listing(uuid) from public, anon;
revoke execute on function public.reject_listing(uuid, text) from public, anon;
grant execute on function public.set_listing_admin_note(uuid, text) to authenticated;
grant execute on function public.set_listing_docs_verified(uuid, boolean) to authenticated;
grant execute on function public.approve_listing(uuid) to authenticated;
grant execute on function public.reject_listing(uuid, text) to authenticated;

drop policy if exists kyc_docs_owner_write on public.kyc_documents;

drop policy if exists kyc_obj_owner_update on storage.objects;
drop policy if exists kyc_obj_owner_insert on storage.objects;
create policy kyc_obj_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kyc-docs'
    and (storage.foldername(name))[1] = (auth.uid())::text
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  );

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like '\_bk\_airy\_%' loop
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

commit;
