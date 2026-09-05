-- get_market_makers() lists maker_canon ("Mercedes") but this filtered and
-- returned the raw source maker ("Mercedes Benz"), so picking that brand in the
-- dropdown matched nothing. One vocabulary: maker_canon everywhere the UI sees.
--
-- One row per model with a zero-filled monthly series. The caller derives MoM
-- (spark[n] vs spark[n-1]) and YoY (spark[n] vs spark[1] at the default 13
-- months) so there is exactly one place volumes are counted.
create or replace function public.get_market_models(
  p_months integer default 13,
  p_limit  integer default 150,
  p_maker  text    default null,
  p_body   text    default null,
  p_keys   text[]  default null
)
returns table (
  maker      text,
  model      text,
  model_key  text,
  last_month date,
  spark      bigint[],
  n_12m      bigint
)
language sql stable security invoker
set search_path = public
as $$
  with b as (select max(month) as lm from public.reg_car_month),
  win as (
    select r.maker_canon as maker, r.model, r.model_key, r.month, sum(r.n)::bigint as n
      from public.reg_car_month r, b
     where r.month > (b.lm - (greatest(p_months, 1) || ' months')::interval)::date
       and (p_maker is null or r.maker_canon = p_maker)
       and (p_body  is null or r.body_type = p_body)
       and (p_keys  is null or r.model_key = any (p_keys))
     group by 1, 2, 3, 4
  ),
  k as (
    select w.model_key,
           min(w.maker) as maker,
           min(w.model) as model,
           coalesce(sum(w.n) filter (
             where w.month > ((select lm from b) - interval '12 months')::date), 0)::bigint as n_12m
      from win w group by 1
  ),
  months as (
    select generate_series(
             ((select lm from b) - ((greatest(p_months, 1) - 1) || ' months')::interval)::date,
             (select lm from b),
             interval '1 month')::date as m
  )
  select k.maker, k.model, k.model_key,
         (select lm from b),
         array_agg(coalesce(w.n, 0) order by m.m),
         k.n_12m
    from k
    cross join months m
    left join win w on w.model_key = k.model_key and w.month = m.m
   group by k.model_key, k.maker, k.model, k.n_12m
   order by k.n_12m desc
   limit greatest(p_limit, 1);
$$;

create or replace function public.get_market_model_detail(
  p_model_key text,
  p_months    integer default 12
)
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  with b as (select max(month) as lm from public.reg_car_month),
  w as (
    select r.* from public.reg_car_month r, b
     where r.model_key = p_model_key
       and r.month > (b.lm - (greatest(p_months, 1) || ' months')::interval)::date
  )
  select jsonb_build_object(
    'model_key',  p_model_key,
    'maker',      (select min(maker_canon) from w),
    'model',      (select min(model) from w),
    'last_month', (select lm from b),
    'months',     greatest(p_months, 1),
    'total',      coalesce((select sum(n) from w), 0),
    'colours', coalesce((select jsonb_agg(x order by x.n desc) from
                 (select colour, sum(n)::bigint as n from w group by 1) x), '[]'::jsonb),
    'fuels',   coalesce((select jsonb_agg(x order by x.n desc) from
                 (select fuel, sum(n)::bigint as n from w group by 1) x), '[]'::jsonb),
    'bodies',  coalesce((select jsonb_agg(x order by x.n desc) from
                 (select body_type, sum(n)::bigint as n from w group by 1) x), '[]'::jsonb),
    'series',  coalesce((select jsonb_agg(x order by x.month) from
                 (select month, sum(n)::bigint as n from w group by 1) x), '[]'::jsonb)
  );
$$;

revoke all on function public.get_market_models(integer, integer, text, text, text[]) from public;
revoke all on function public.get_market_model_detail(text, integer) from public;
grant execute on function public.get_market_models(integer, integer, text, text, text[]) to authenticated;
grant execute on function public.get_market_model_detail(text, integer) to authenticated;
