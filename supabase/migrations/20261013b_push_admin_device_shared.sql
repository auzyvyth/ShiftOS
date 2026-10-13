-- One phone, two of the owner's accounts: the platform admin AND a seller.
--
-- 20261013a stopped a seller on the admin's browser from taking the device's
-- push slot (so the ops alerts kept arriving). But a browser has ONE push
-- endpoint per site, and the owner runs /platform and their own seller account
-- in the same Chrome, so their seller account could never turn notifications
-- on ("Could not save this device").
--
-- Fix: a device may carry at most TWO rows: one admin row (admin_slot = true,
-- only a superadmin can hold it) and one ordinary account row. Everyone else
-- keeps "one device, one identity" exactly as before: the ordinary slot still
-- goes to whoever registered last.

begin;

alter table public.push_subscriptions
  add column if not exists admin_slot boolean not null default false;

update public.push_subscriptions s set admin_slot = true
  from public.profiles p
 where p.id = s.user_id and p.role = 'superadmin';

alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_key;
create unique index if not exists push_subscriptions_endpoint_slot_key
  on public.push_subscriptions (endpoint, admin_slot);

create or replace function public.push_register_device(p_subscription jsonb)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user     uuid := auth.uid();
  v_endpoint text := p_subscription->>'endpoint';
  v_admin    boolean;
begin
  if v_user is null then return false; end if;
  if coalesce(v_endpoint, '') = '' or not public.push_endpoint_allowed(v_endpoint) then
    return false;
  end if;
  if p_subscription->'keys'->>'auth' is null or p_subscription->'keys'->>'p256dh' is null then
    return false;
  end if;

  v_admin := public.is_superadmin();

  -- Clear this slot of the device (whoever held it), then claim it.
  delete from public.push_subscriptions
   where endpoint = v_endpoint and admin_slot = v_admin;
  -- An account sits in one slot only (an old row from before it changed role).
  delete from public.push_subscriptions
   where endpoint = v_endpoint and user_id = v_user;
  insert into public.push_subscriptions (user_id, endpoint, subscription, admin_slot)
  values (v_user, v_endpoint, p_subscription, v_admin);
  return true;
end; $function$;

create or replace function public.push_forget_device(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_deleted int;
begin
  if coalesce(p_endpoint, '') = '' or not public.push_endpoint_allowed(p_endpoint) then
    return false;
  end if;
  -- Signed in (the console signs out this way): drop only your own row.
  -- Signed out (a seller's sign-out runs after the session is gone): drop the
  -- ordinary slot only; the admin's ops alerts stay on the device.
  delete from public.push_subscriptions s
   where s.endpoint = p_endpoint
     and (s.user_id = auth.uid() or (auth.uid() is null and not s.admin_slot));
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end; $function$;

revoke all on function public.push_register_device(jsonb) from public, anon;
grant execute on function public.push_register_device(jsonb) to authenticated;
revoke all on function public.push_forget_device(text) from public;
grant execute on function public.push_forget_device(text) to anon, authenticated;

commit;
