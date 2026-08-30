-- Advisor "materialized_view_in_api": public.market_price_stats was directly
-- selectable by anon/authenticated over PostgREST.
--
-- Nothing in src/, api/ or supabase/functions/ queries it directly (grepped).
-- The marketplace consumes it only through the market_avg_price /
-- market_sample_count columns of public.public_car_listings, and that view is
-- owned by postgres and runs with the owner's privileges, so the join is
-- unaffected by these role grants.
--
-- Keeping it out of the API stops anyone from scraping the whole aggregated
-- price table (every brand/model/year bucket and its sample counts) in one
-- request -- that is competitive pricing data, and it is derived from other
-- dealers' listings.

revoke select on public.market_price_stats from anon, authenticated, public;
