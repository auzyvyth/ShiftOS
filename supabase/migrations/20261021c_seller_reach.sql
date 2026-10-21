-- REACH-1 (2026-10-21): the platform console could not tell which sellers
-- can actually be reached -- who has notifications switched on, and who has
-- added the app to their home screen.
--
-- Notifications were already knowable (push_subscriptions), but owner-only RLS
-- means a superadmin .from() returns an EMPTY ARRAY WITH NO ERROR, so it has to
-- come through a SECURITY DEFINER function (same as get_buyer_accounts).
--
-- "Added to home screen" was NOT knowable per account: the only record was the
-- anonymous, consent-gated, once-per-device `pwa_installed` analytics event.
-- New: app_home_screen, one row per account, stamped by the signed-in app when
-- it is running from the home screen (src/hooks/useHomeScreenMark.js). It only
-- fills from the next time each seller opens the app that way -- an install
-- made before this shipped reads "not seen yet" until then.
--
-- Additive on purpose: a new function rather than more columns on
-- get_account_activity, whose RETURNS TABLE cannot grow without a DROP.

create table if not exists public.app_home_screen (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  first_at  timestamptz not null default now(),
  last_at   timestamptz not null default now(),
  platform  text check (platform in ('ios', 'android', 'desktop', 'other'))
);

-- No policies: written only by mark_home_screen_app, read only by
-- get_account_reach. RLS on with no policy = nobody reads it directly.
alter table public.app_home_screen enable row level security;
revoke all on table public.app_home_screen from public, anon, authenticated;

-- The subject is the SESSION, never an argument: a caller can only ever stamp
-- their own account. Anonymous guests (role 'authenticated' too) are skipped.
create or replace function public.mark_home_screen_app(p_platform text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return;
  end if;
  insert into app_home_screen as h (user_id, platform)
  values (
    auth.uid(),
    case when p_platform in ('ios', 'android', 'desktop') then p_platform else 'other' end
  )
  on conflict (user_id) do update
    set last_at = now(),
        platform = excluded.platform;
end;
$$;

revoke all on function public.mark_home_screen_app(text) from public;
revoke all on function public.mark_home_screen_app(text) from anon;
grant execute on function public.mark_home_screen_app(text) to authenticated;

-- Counts and dates only: never an endpoint or subscription keys.
create or replace function public.get_account_reach(p_ids uuid[])
returns table (
  id uuid,
  push_devices integer,
  push_last_at timestamptz,
  home_screen_first_at timestamptz,
  home_screen_last_at timestamptz,
  home_screen_platform text
)
language sql
security definer
set search_path to 'public'
as $$
  select
    i.id,
    (select count(*) from push_subscriptions ps where ps.user_id = i.id and not ps.admin_slot)::int,
    (select max(ps.created_at) from push_subscriptions ps where ps.user_id = i.id and not ps.admin_slot),
    h.first_at,
    h.last_at,
    h.platform
  from unnest(p_ids) as i(id)
  left join app_home_screen h on h.user_id = i.id
  where is_superadmin();
$$;

revoke all on function public.get_account_reach(uuid[]) from public;
revoke all on function public.get_account_reach(uuid[]) from anon;
grant execute on function public.get_account_reach(uuid[]) to authenticated;
