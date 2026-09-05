-- Supabase's default privileges grant EXECUTE to anon+authenticated at CREATE
-- time, so the earlier "revoke from public" left an explicit anon grant behind.
-- reg_load_response is SECURITY DEFINER and deletes a whole year before
-- reloading it, so an anon caller could have wiped the rollup by guessing a
-- pg_net request id (they are sequential). Ingestion is service-role only.
revoke all on function public.reg_load_response(bigint, integer) from anon, authenticated, public;

-- Read side: harmless to anon (RLS returns nothing) but keep the grant honest.
revoke all on function public.get_market_summary()                                    from anon;
revoke all on function public.get_market_models(integer, integer, text, text, text[])  from anon;
revoke all on function public.get_market_model_detail(text, integer)                   from anon;
revoke all on function public.get_market_makers()                                      from anon;
