-- Daily traffic buckets become real Malaysian calendar days.
--
-- get_salesman_analytics and get_salesman_minipage_daily both bucketed d0..d6
-- as ROLLING 24-HOUR WINDOWS anchored on now() -- d6 was "the last 24 hours",
-- not "today". The Premium dashboard already labels that last bucket "Today"
-- (DashboardTab.jsx trafficTrend), so at 9am the "Today" column was counting
-- from 9am YESTERDAY. Every number was up to a day wrong, in a direction that
-- changed through the day, and two visits on the same afternoon could land in
-- different columns depending on when the page was opened.
--
-- Fixing it here rather than in the client is what lets the dashboard state a
-- daily figure at all: d6 now IS today, so the "+N today" badges read the
-- bucket the chart already loads and the two cannot disagree.
--
-- Asia/Kuala_Lumpur, not the browser's timezone: the seller, the buyer and the
-- business day are all in Malaysia, and a server-side bucket must not depend on
-- where the viewer happens to be.
--
-- Signatures are unchanged (same arg types, same column list), so CREATE OR
-- REPLACE really replaces -- no overload is left behind.

create or replace function public.get_salesman_analytics(
  p_dealer_id uuid,
  p_cutoff timestamptz default (now() - '30 days'::interval)
)
returns table(
  car_id uuid, views bigint, enquiries bigint,
  d0 integer, d1 integer, d2 integer, d3 integer, d4 integer, d5 integer, d6 integer,
  w0 integer, w1 integer, w2 integer, w3 integer, w4 integer, w5 integer, w6 integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  -- Day 0 of the window: 6 calendar days before today, in KL.
  with bounds as (
    select ((now() at time zone 'Asia/Kuala_Lumpur')::date - 6) as day0
  ),
  deduped_views as (
    select distinct on (car_id, coalesce(session_id, id::text))
      car_id, created_at
    from analytics_events
    where dealer_id = p_dealer_id
      and auth.uid() is not null
      and (auth.uid() = p_dealer_id or get_my_dealer_id() = p_dealer_id or is_superadmin())
      and created_at >= p_cutoff
      and car_id is not null
      and event_type in ('car_view', 'link_visit')
    order by car_id, coalesce(session_id, id::text), created_at
  ),
  view_agg as (
    select
      v.car_id,
      count(*)::bigint as views,
      count(*) filter (where (v.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 0)::int as d0,
      count(*) filter (where (v.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 1)::int as d1,
      count(*) filter (where (v.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 2)::int as d2,
      count(*) filter (where (v.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 3)::int as d3,
      count(*) filter (where (v.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 4)::int as d4,
      count(*) filter (where (v.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 5)::int as d5,
      count(*) filter (where (v.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 6)::int as d6
    from deduped_views v cross join bounds b
    group by v.car_id
  ),
  deduped_enq as (
    select distinct on (car_id, coalesce(session_id, id::text))
      car_id, created_at
    from analytics_events
    where dealer_id = p_dealer_id
      and auth.uid() is not null
      and (auth.uid() = p_dealer_id or get_my_dealer_id() = p_dealer_id or is_superadmin())
      and created_at >= p_cutoff
      and car_id is not null
      and event_type in ('whatsapp_click', 'call_click')
    order by car_id, coalesce(session_id, id::text), created_at
  ),
  enq_agg as (
    select
      e.car_id,
      count(*)::bigint as enquiries,
      count(*) filter (where (e.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 0)::int as w0,
      count(*) filter (where (e.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 1)::int as w1,
      count(*) filter (where (e.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 2)::int as w2,
      count(*) filter (where (e.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 3)::int as w3,
      count(*) filter (where (e.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 4)::int as w4,
      count(*) filter (where (e.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 5)::int as w5,
      count(*) filter (where (e.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 6)::int as w6
    from deduped_enq e cross join bounds b
    group by e.car_id
  )
  select
    va.car_id, va.views, coalesce(ea.enquiries, 0) as enquiries,
    va.d0, va.d1, va.d2, va.d3, va.d4, va.d5, va.d6,
    coalesce(ea.w0,0), coalesce(ea.w1,0), coalesce(ea.w2,0), coalesce(ea.w3,0),
    coalesce(ea.w4,0), coalesce(ea.w5,0), coalesce(ea.w6,0)
  from view_agg va
  left join enq_agg ea on ea.car_id = va.car_id;
$function$;

create or replace function public.get_salesman_minipage_daily(p_slug text)
returns table(d0 integer, d1 integer, d2 integer, d3 integer, d4 integer, d5 integer, d6 integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with bounds as (
    select ((now() at time zone 'Asia/Kuala_Lumpur')::date - 6) as day0
  ),
  visits as (
    select distinct on (coalesce(session_id, id::text))
      created_at
    from analytics_events
    where salesman_slug = p_slug
      and event_type = 'minipage_view'
      -- Start of KL day 0, converted back to an instant. The old bound was a
      -- rolling `now() - 7 days`, which clipped the earliest calendar day.
      and created_at >= (((now() at time zone 'Asia/Kuala_Lumpur')::date - 6)::timestamp at time zone 'Asia/Kuala_Lumpur')
      and exists (
        select 1 from profiles pr where pr.slug = p_slug and pr.role = 'salesman'
          and (pr.id = auth.uid() or pr.dealer_id = get_my_dealer_id() or is_superadmin())
      )
    order by coalesce(session_id, id::text), created_at
  )
  select
    count(*) filter (where (v.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 0)::int as d0,
    count(*) filter (where (v.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 1)::int as d1,
    count(*) filter (where (v.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 2)::int as d2,
    count(*) filter (where (v.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 3)::int as d3,
    count(*) filter (where (v.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 4)::int as d4,
    count(*) filter (where (v.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 5)::int as d5,
    count(*) filter (where (v.created_at at time zone 'Asia/Kuala_Lumpur')::date - b.day0 = 6)::int as d6
  from visits v cross join bounds b;
$function$;
