create or replace function public.get_market_makers()
returns table (maker text, n_12m bigint)
language sql stable security invoker
set search_path = public
as $$
  with b as (select max(month) as lm from public.reg_car_month)
  select r.maker_canon, sum(r.n)::bigint
    from public.reg_car_month r, b
   where r.month > (b.lm - interval '12 months')::date
   group by 1
   having sum(r.n) > 0
   order by 2 desc;
$$;

revoke all on function public.get_market_makers() from public;
grant execute on function public.get_market_makers() to authenticated;
