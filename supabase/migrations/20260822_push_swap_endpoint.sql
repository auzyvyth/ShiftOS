-- Lets a service worker move a push subscription onto a new endpoint after the
-- browser rotates it (the `pushsubscriptionchange` event). Without this the old
-- endpoint stays in the table, dies, and the user has to re-enable push by hand
-- from Settings -- which is exactly what was happening (4 rows, 4 endpoints, one
-- device).
--
-- Callable by anon ON PURPOSE: a service worker has no Supabase session. The
-- credential here is p_old_endpoint itself -- the caller must already know a
-- real, stored endpoint string. Those live only in push_subscriptions, whose RLS
-- is owner-only (auth.uid() = user_id), so they are not obtainable by anyone who
-- could not already receive that user's pushes. The function never accepts a
-- user_id from the caller; it derives it from the matched row, so it cannot be
-- used to attach a device to somebody else's account.
create or replace function public.push_swap_endpoint(
  p_old_endpoint text,
  p_subscription jsonb
) returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_new  text := p_subscription->>'endpoint';
  v_user uuid;
begin
  if coalesce(p_old_endpoint, '') = '' or coalesce(v_new, '') = '' then
    return false;
  end if;

  -- A subscription with no keys cannot be encrypted to, so refuse to store one.
  if p_subscription->'keys'->>'auth' is null
     or p_subscription->'keys'->>'p256dh' is null then
    return false;
  end if;

  if v_new !~ '^https://[A-Za-z0-9._-]+/' then
    return false;
  end if;

  select user_id into v_user
  from public.push_subscriptions
  where endpoint = p_old_endpoint;

  if v_user is null then
    return false;
  end if;

  -- Same endpoint, refreshed keys: just replace the payload.
  if v_new = p_old_endpoint then
    update public.push_subscriptions
       set subscription = p_subscription
     where endpoint = p_old_endpoint;
    return true;
  end if;

  -- The app's heal-on-open can register the new endpoint before the service
  -- worker gets here. Drop that duplicate first so UNIQUE (user_id, endpoint)
  -- cannot reject the move.
  delete from public.push_subscriptions
   where user_id = v_user and endpoint = v_new;

  update public.push_subscriptions
     set endpoint = v_new, subscription = p_subscription
   where endpoint = p_old_endpoint;

  return true;
end;
$$;

revoke all on function public.push_swap_endpoint(text, jsonb) from public;
grant execute on function public.push_swap_endpoint(text, jsonb) to anon, authenticated;
