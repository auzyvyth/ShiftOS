-- ONE DEVICE, ONE IDENTITY.
--
-- push_subscriptions was UNIQUE (user_id, endpoint), so the same physical
-- device could be registered under several accounts at once and nothing ever
-- removed the old rows -- the only cleanup in the whole system was send-push
-- deleting a row after the push service answered 410.
--
-- Live before this migration: 13 rows across 9 devices, and 3 devices carrying
-- more than one identity -- one of them a salesman, a buyer AND the superadmin.
-- That phone received all three accounts' pushes. Another carried two different
-- anonymous guest buyers a day apart: the browser lost its anon session, got a
-- new uid, and healPushSubscription registered the device again alongside the
-- old row -- so a seller replying to guest #1 rang a browser that had since
-- become guest #2.
--
-- The right key is the ENDPOINT: it identifies the browser install, and a
-- browser install belongs to whoever is signed in on it right now. Whoever
-- registers last owns it.

-- 1. Collapse the duplicates, keeping the most recently registered row per
--    endpoint -- i.e. the account that used the device last. The accounts that
--    lose a row here get it back automatically the next time they open the app
--    (usePushHeal re-registers a granted device with no prompt).
delete from public.push_subscriptions ps
using public.push_subscriptions keep
where ps.endpoint = keep.endpoint
  and (ps.created_at, ps.id) < (keep.created_at, keep.id);

-- 2. Swap the key.
alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_user_id_endpoint_key;
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_key unique (endpoint);

-- 3. (user_id, endpoint) was ALSO the only index whose leading column served
--    send-push's `.in("user_id", ...)` lookup -- the one query this table
--    exists for. Dropping it without this turns every push into a seq scan.
create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

-- 4. The service worker's rotation path assumed endpoints were effectively
--    unique already: it derived the owner with a bare
--    `select user_id where endpoint = p_old_endpoint` (no limit), which picked
--    an arbitrary owner on a shared device, and then deleted the colliding new
--    endpoint only for THAT user -- which would now raise a unique violation
--    when the endpoint belonged to someone else. Both fixed.
create or replace function public.push_swap_endpoint(p_old_endpoint text, p_subscription jsonb)
returns boolean language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_new  text := p_subscription->>'endpoint';
  v_user uuid;
begin
  if coalesce(p_old_endpoint, '') = '' or coalesce(v_new, '') = '' then
    return false;
  end if;

  if p_subscription->'keys'->>'auth' is null
     or p_subscription->'keys'->>'p256dh' is null then
    return false;
  end if;

  -- Was `^https://[A-Za-z0-9._-]+/` — a shape check, which allowed any host.
  if not public.push_endpoint_allowed(v_new) then
    return false;
  end if;

  select user_id into v_user
  from public.push_subscriptions
  where endpoint = p_old_endpoint;

  if v_user is null then
    return false;
  end if;

  if v_new = p_old_endpoint then
    update public.push_subscriptions
       set subscription = p_subscription
     where endpoint = p_old_endpoint;
    return true;
  end if;

  -- Whoever held the new endpoint before, they are not on this browser any
  -- more -- the browser just told us it replaced it. Scoping this delete to
  -- v_user was what left a colliding row behind.
  delete from public.push_subscriptions where endpoint = v_new;

  update public.push_subscriptions
     set endpoint = v_new, subscription = p_subscription
   where endpoint = p_old_endpoint;

  return true;
end;
$function$;

-- 5. Sign-out has to be able to unregister the device, and at that moment the
--    client has NO session -- auth.uid() is null, so an RLS delete cannot work.
--    The endpoint is the credential, held only by that browser and the push
--    service, and taken as an ARGUMENT rather than matched by shape. Same
--    pattern as push_swap_endpoint above, and the same rule as share tokens:
--    a bearer secret belongs in a SECURITY DEFINER function that requires the
--    caller to present it.
create or replace function public.push_forget_device(p_endpoint text)
returns boolean language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_deleted int;
begin
  if coalesce(p_endpoint, '') = '' or not public.push_endpoint_allowed(p_endpoint) then
    return false;
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$function$;

-- A signed-out browser is `anon`, which is the whole point of this function.
-- Revoke from PUBLIC first: a grant held by PUBLIC is inherited by anon, so
-- revoking from anon alone silently no-ops (see CLAUDE.md).
revoke all on function public.push_forget_device(text) from public;
grant execute on function public.push_forget_device(text) to anon, authenticated;

-- 6. Registering a device has to be able to TAKE IT OVER from whoever had it
--    before, and a client upsert cannot: the RLS policy is `auth.uid() =
--    user_id` for all commands, so the UPDATE half of an upsert is checked
--    against the EXISTING row. User B upserting onto user A's endpoint is
--    rejected -- which, with UNIQUE (endpoint), would leave B unable to enable
--    notifications at all on a phone someone else had used.
--
--    So the takeover lives here, in one place, atomically. Still requires a
--    real session: the row is written for auth.uid(), never for a user id the
--    caller names. The push_subscription_guard trigger still runs on the
--    insert, so the host allowlist, the keys check and the per-user device and
--    rate limits all still apply.
create or replace function public.push_register_device(p_subscription jsonb)
returns boolean language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $function$
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

  -- Already ours: refresh the payload in place and leave created_at alone, so
  -- the console's "since" date stays honest across every app open (heal runs
  -- on each one).
  if exists (select 1 from public.push_subscriptions
              where endpoint = v_endpoint and user_id = v_user) then
    update public.push_subscriptions
       set subscription = p_subscription
     where endpoint = v_endpoint;
    return true;
  end if;

  delete from public.push_subscriptions where endpoint = v_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, subscription)
  values (v_user, v_endpoint, p_subscription);
  return true;
end;
$function$;

revoke all on function public.push_register_device(jsonb) from public;
grant execute on function public.push_register_device(jsonb) to authenticated;

-- 7. push_home_path had no 'buyer' branch, so a buyer fell through to the
--    `else '/dashboard'` -- the dealer dashboard, which a buyer cannot use.
--    It does not bite chat today (chat_after_message passes /account/messages
--    explicitly), but any future buyer push using the default would have.
create or replace function public.push_home_path(p_user_id uuid)
returns text
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select case
    -- The platform console, not the dealer dashboard. Only 'superadmin' — the
    -- 'owner' role is a real dealer account with its own dashboard.
    when p.role = 'superadmin' then '/platform'
    when p.role = 'buyer' then '/account/messages'
    when p.role = 'salesman' and p.dealer_id is not null then '/salesman'
    when p.role = 'salesman' and p.plan = 'salesman_full' then '/salesman-premium'
    when p.role = 'salesman' then '/salesman-lite'
    else '/dashboard'
  end
  from profiles p where p.id = p_user_id;
$function$;
