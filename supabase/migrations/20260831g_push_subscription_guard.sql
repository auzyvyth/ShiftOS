-- Guard every write to push_subscriptions.
--
-- Why: send-push runs as the service role and calls
-- webpush.sendNotification(row.subscription, ...) — it POSTs to whatever URL
-- sits in subscription->>'endpoint'. Nothing checked that host. The RLS policy
-- is `auth.uid() = user_id` and nothing else, and anonymous sign-in is open, so
-- anybody could mint a guest account and aim the push sender at any URL they
-- liked, as many times as they liked.
--
-- The check lives in a BEFORE trigger, not in the policy, because three
-- different writers reach this table: the browser (upsert), the service worker
-- via push_swap_endpoint (SECURITY DEFINER, bypasses RLS), and send-push's
-- own prune. A trigger binds all of them.

create or replace function public.push_endpoint_allowed(p_endpoint text)
returns boolean language sql immutable
set search_path to 'pg_catalog', 'public'
as $function$
  -- The real web-push services, and nothing else. A new browser vendor is a
  -- one-line addition here; an open host list is a server-side request forgery.
  select coalesce(p_endpoint, '') ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com|[a-z0-9-]+\.push\.apple\.com)/'
$function$;

create or replace function public.push_subscription_guard()
returns trigger language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_total int;
  v_recent int;
begin
  -- send-push reads the JSON, not the column, so validating only the column
  -- would be theatre: they must agree.
  if new.subscription->>'endpoint' is distinct from new.endpoint then
    raise exception 'push_subscriptions: endpoint does not match subscription payload'
      using errcode = '22023';
  end if;

  if not public.push_endpoint_allowed(new.endpoint) then
    raise exception 'push_subscriptions: endpoint host not allowed'
      using errcode = '22023';
  end if;

  -- A subscription with no keys cannot be encrypted to; storing one only
  -- guarantees a failed send later.
  if new.subscription->'keys'->>'auth' is null
     or new.subscription->'keys'->>'p256dh' is null then
    raise exception 'push_subscriptions: subscription is missing its keys'
      using errcode = '22023';
  end if;

  if TG_OP = 'INSERT' then
    select count(*) into v_total
      from public.push_subscriptions where user_id = new.user_id;
    if v_total >= 10 then
      raise exception 'push_subscriptions: device limit reached'
        using errcode = '54000';
    end if;

    select count(*) into v_recent
      from public.push_subscriptions
     where user_id = new.user_id and created_at > now() - interval '1 hour';
    if v_recent >= 20 then
      raise exception 'push_subscriptions: too many devices registered recently'
        using errcode = '54000';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_push_subscription_guard on public.push_subscriptions;
create trigger trg_push_subscription_guard
  before insert or update on public.push_subscriptions
  for each row execute function public.push_subscription_guard();

-- Same host rule for the service worker's rotation path, which is SECURITY
-- DEFINER and so never saw the RLS policy in the first place. The trigger above
-- already covers it; this makes the function return false cleanly instead of
-- raising through the SW's fetch.
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

  delete from public.push_subscriptions
   where user_id = v_user and endpoint = v_new;

  update public.push_subscriptions
     set endpoint = v_new, subscription = p_subscription
   where endpoint = p_old_endpoint;

  return true;
end;
$function$;
