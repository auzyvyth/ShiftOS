-- seller_public_stats carried INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER
-- for anon AND authenticated -- Supabase's blanket default-privileges grant,
-- not a decision anyone made. The view is an aggregate over car_listings and is
-- not auto-updatable, so none of those could function; they are noise that
-- reads as intent on an anon-facing object. It is a public trust signal, so
-- SELECT for anon stays, deliberately.
revoke all on public.seller_public_stats from public, anon, authenticated, service_role;
grant select on public.seller_public_stats to anon, authenticated, service_role;
