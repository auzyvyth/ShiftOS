-- Read side for the dealer Market Demand tab. All three are SECURITY INVOKER:
-- reg_car_month is public government data with a plain "authenticated can read"
-- policy, so there is nothing here to elevate.
-- NOTE: get_market_models / get_market_model_detail superseded by 20260905h.
create or replace function public.get_market_summary()
returns table (
  last_month      date,
  n_last          bigint,
  n_prev          bigint,
  n_year_ago      bigint,
  n_12m           bigint,
  ev_last_pct     numeric,
  ev_year_ago_pct numeric,
  models_tracked  bigint,
  refreshed_at    timestamptz
)
language sql stable security invoker
set search_path = public
as $$
  with b as (select max(month) as lm from public.reg_car_month),
  s as (
    select
      sum(n) filter (where month = (select lm from b))                                        as n_last,
      sum(n) filter (where month = ((select lm from b) - interval '1 month')::date)            as n_prev,
      sum(n) filter (where month = ((select lm from b) - interval '12 months')::date)          as n_year_ago,
      sum(n) filter (where month > ((select lm from b) - interval '12 months')::date)          as n_12m,
      sum(n) filter (where month = (select lm from b) and fuel = 'electric')                   as ev_last,
      sum(n) filter (where month = ((select lm from b) - interval '12 months')::date
                       and fuel = 'electric')                                                  as ev_year_ago
    from public.reg_car_month
  )
  select
    (select lm from b),
    coalesce(s.n_last, 0)::bigint,
    coalesce(s.n_prev, 0)::bigint,
    coalesce(s.n_year_ago, 0)::bigint,
    coalesce(s.n_12m, 0)::bigint,
    case when coalesce(s.n_last, 0) > 0
         then round(100.0 * coalesce(s.ev_last, 0) / s.n_last, 2) else 0 end,
    case when coalesce(s.n_year_ago, 0) > 0
         then round(100.0 * coalesce(s.ev_year_ago, 0) / s.n_year_ago, 2) else 0 end,
    (select count(distinct model_key) from public.reg_car_month
      where month > ((select lm from b) - interval '12 months')::date),
    (select max(ran_at) from public.reg_ingest_log where ok)
  from s;
$$;

revoke all on function public.get_market_summary() from public;
grant execute on function public.get_market_summary() to authenticated;
