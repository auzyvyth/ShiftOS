-- Marketplace "cars listed" count leaves out new-car model cards (owner, 2026-10-23).
-- Every advisor has one card per model, so ten Proton advisors added ~90 "cars"
-- that are one price list. Same test as public_car_listings.is_model_card.
-- Signature unchanged, so CREATE OR REPLACE replaces it in place.
create or replace function public.get_marketplace_stats()
returns table(listings bigint, dealers bigint, hot_deals bigint)
language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  SELECT
    COUNT(*) AS listings,
    COUNT(DISTINCT dealer_id) AS dealers,
    COUNT(*) FILTER (
      WHERE original_price IS NOT NULL AND original_price > 0
        AND selling_price  IS NOT NULL AND selling_price  > 0
        AND selling_price <= original_price * 0.97
    ) AS hot_deals
  FROM car_listings
  WHERE status IN ('available', 'reserved')
    AND NOT (new_car_model_id IS NOT NULL AND NOT COALESCE(new_car_unit, false));
$function$;
