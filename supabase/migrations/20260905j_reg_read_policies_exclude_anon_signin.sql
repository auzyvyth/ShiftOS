-- This project uses Supabase anonymous sign-in for guest buyers, so "authenticated"
-- includes every guest on the marketplace. Market Demand is a seller-account
-- feature; a signed-out browser should not be able to pull the whole table
-- through PostgREST. Public data, but not a scrape endpoint.
drop policy if exists reg_car_month_read on public.reg_car_month;
create policy reg_car_month_read on public.reg_car_month
  for select to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

drop policy if exists reg_maker_alias_read on public.reg_maker_alias;
create policy reg_maker_alias_read on public.reg_maker_alias
  for select to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

-- get_market_summary() is SECURITY INVOKER and reads reg_ingest_log for the
-- "last refreshed" line. With RLS on and no policy that subquery returned NULL
-- silently. The log holds a year, byte counts and timestamps - no tenant data.
drop policy if exists reg_ingest_log_read on public.reg_ingest_log;
create policy reg_ingest_log_read on public.reg_ingest_log
  for select to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);
