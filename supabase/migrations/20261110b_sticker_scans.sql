-- Window sticker scans per car (INV-STICKER, owner 2026-11-10).
-- A buyer who scans the QR lands on /showroom/<slug>?src=sticker; the page stamps
-- metadata.channel = 'sticker' on every event of that visit (refTracking.js,
-- analytics.js). A "scan" = one visit (distinct session_id) carrying that tag.
-- The dealer dashboard cannot read analytics_events for the public car page (those
-- rows often have dealer_id NULL), so this follows get_dealer_car_analytics: a
-- SECURITY DEFINER function that derives the caller's scope and refuses anything else.
create or replace function public.get_dealer_sticker_scans(p_dealer_id uuid, p_days integer default 30)
returns table (car_id uuid, scans bigint)
language sql
stable
security definer
set search_path = public
as $$
  with guard as (
    select auth.uid() is not null
       and (auth.uid() = p_dealer_id or get_my_dealer_id() = p_dealer_id or is_superadmin()) as ok
  )
  select ae.car_id, count(distinct ae.session_id) as scans
  from analytics_events ae, guard
  where guard.ok
    and ae.car_id is not null
    and ae.metadata ->> 'channel' = 'sticker'
    and ae.created_at >= now() - (greatest(1, least(coalesce(p_days, 30), 365)) || ' days')::interval
    and (
      ae.dealer_id = p_dealer_id
      or (ae.dealer_id is null and ae.car_id in (select id from car_listings where dealer_id = p_dealer_id))
    )
  group by ae.car_id;
$$;

revoke all on function public.get_dealer_sticker_scans(uuid, integer) from public, anon;
grant execute on function public.get_dealer_sticker_scans(uuid, integer) to authenticated;
