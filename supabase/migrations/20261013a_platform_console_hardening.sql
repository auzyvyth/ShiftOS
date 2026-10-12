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

-- 5. A seller could write their own ID-status columns (ic_verified_at,
--    kyc_submitted_at, ...) straight through the API, faking "IC provided" or
--    pushing themselves into / out of the ID queue.
-- 6. Deleting an account now drops its pending ID check (the photos are
--    deleted by the delete paths through the Storage API).
-- 7. One browser = one push slot. A seller signed in next to the admin could
--    take the admin's slot (ops alerts silently stopped) and a seller's sign-out
--    deleted it. A superadmin's slot is now kept for that superadmin.
-- 8. Car documents (geran, loan letter) get a PRIVATE bucket, car-docs, opened
--    by signed link. They were in the public car-images bucket.

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

-- 5 ─ ID-status columns: server functions only ──────────────────────────────
-- SECURITY INVOKER on purpose: current_user is then the role that ran the
-- statement. A direct client write runs as authenticated; set_my_ic,
-- submit_kyc and the decide_* functions are SECURITY DEFINER and run as the
-- owner, so they pass.
create or replace function public.guard_profile_identity_cols()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_superadmin() then
    return new;
  end if;
  new.kyc_submitted_at := old.kyc_submitted_at;
  new.kyc_tier         := old.kyc_tier;
  new.ic_verified_at   := old.ic_verified_at;
  new.ic_hash          := old.ic_hash;
  new.ic_last4         := old.ic_last4;
  new.ic_submitted     := old.ic_submitted;
  -- A plaintext IC is never stored; clearing it is the only allowed write.
  if new.ic_number is not null then
    new.ic_number := old.ic_number;
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_profile_identity on public.profiles;
create trigger trg_guard_profile_identity
  before update on public.profiles
  for each row execute function public.guard_profile_identity_cols();

-- 6 ─ Deleted account: no pending ID check ──────────────────────────────────
-- Runs after trg_guard_profile_identity (alphabetical), so its clears win.
create or replace function public.profile_deleted_drop_kyc()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.account_status = 'deleted' and old.account_status is distinct from 'deleted' then
    delete from public.kyc_documents where user_id = new.id;
    new.kyc_submitted_at := null;
    new.kyc_tier := null;
  end if;
  return new;
end; $$;
revoke execute on function public.profile_deleted_drop_kyc() from public, anon, authenticated;

drop trigger if exists trg_profile_deleted_drop_kyc on public.profiles;
create trigger trg_profile_deleted_drop_kyc
  before update of account_status on public.profiles
  for each row execute function public.profile_deleted_drop_kyc();

-- 7 ─ Push: a superadmin's device slot belongs to that superadmin ───────────
create or replace function public.push_register_device(p_subscription jsonb)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_user     uuid := auth.uid();
  v_endpoint text := p_subscription->>'endpoint';
begin
  if v_user is null then
    return false;
  end if;
  if coalesce(v_endpoint, '') = '' or not public.push_endpoint_allowed(v_endpoint) then
    return false;
  end if;
  if p_subscription->'keys'->>'auth' is null
     or p_subscription->'keys'->>'p256dh' is null then
    return false;
  end if;

  if exists (select 1 from public.push_subscriptions
              where endpoint = v_endpoint and user_id = v_user) then
    update public.push_subscriptions
       set subscription = p_subscription
     where endpoint = v_endpoint;
    return true;
  end if;

  -- The platform admin's browser keeps its ops alerts: another account signed
  -- in on the same browser does not take the slot. The admin's own console
  -- sign-out releases it (push_forget_device).
  if exists (select 1 from public.push_subscriptions s
               join public.profiles p on p.id = s.user_id
              where s.endpoint = v_endpoint and p.role = 'superadmin') then
    return false;
  end if;

  delete from public.push_subscriptions where endpoint = v_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, subscription)
  values (v_user, v_endpoint, p_subscription);
  return true;
end; $$;

create or replace function public.push_forget_device(p_endpoint text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_deleted int;
begin
  if coalesce(p_endpoint, '') = '' or not public.push_endpoint_allowed(p_endpoint) then
    return false;
  end if;
  -- A seller signing out on the admin's browser must not delete the admin's
  -- slot; only that superadmin (still signed in) can release it.
  delete from public.push_subscriptions s
   where s.endpoint = p_endpoint
     and (s.user_id = auth.uid()
          or not exists (select 1 from public.profiles p
                          where p.id = s.user_id and p.role = 'superadmin'));
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end; $$;

-- 8 ─ Private bucket for car documents ──────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('car-docs', 'car-docs', false, 10485760)
on conflict (id) do update set public = false;

drop policy if exists car_docs_owner_insert on storage.objects;
create policy car_docs_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'car-docs'
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and ((storage.foldername(name))[1] = (auth.uid())::text or public.is_superadmin())
  );

-- The uploader, their dealership (dealer + team), and the platform admin.
-- SECURITY DEFINER so the team lookup is not filtered by profiles RLS.
create or replace function public.car_doc_folder_visible(p_folder text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    p_folder = auth.uid()::text
    or public.is_superadmin()
    or exists (select 1 from public.profiles p
                where p.id::text = p_folder
                  and public.get_my_dealer_id() is not null
                  and (p.id = public.get_my_dealer_id() or p.dealer_id = public.get_my_dealer_id()))
  );
$$;
revoke execute on function public.car_doc_folder_visible(text) from public, anon;
grant execute on function public.car_doc_folder_visible(text) to authenticated;

drop policy if exists car_docs_read on storage.objects;
create policy car_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'car-docs' and public.car_doc_folder_visible((storage.foldername(name))[1]));

drop policy if exists car_docs_delete on storage.objects;
create policy car_docs_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'car-docs'
    and ((storage.foldername(name))[1] = (auth.uid())::text or public.is_superadmin())
  );

-- The console's one-time move deletes the public copies.
drop policy if exists car_images_superadmin_delete on storage.objects;
create policy car_images_superadmin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'car-images' and public.is_superadmin());

commit;
