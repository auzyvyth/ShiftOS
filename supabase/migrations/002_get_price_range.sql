-- ============================================================
-- Feature 2: Market price intelligence
-- Returns min/avg/max selling price for a given brand+model combo
-- across all active, reserved, and sold listings.
-- Used by CarForm pricing hint and CarDetail "similar price" badge.
-- ============================================================

CREATE OR REPLACE FUNCTION get_price_range(
  p_brand     text DEFAULT NULL,
  p_model     text DEFAULT NULL,
  p_variant   text DEFAULT NULL,
  p_year_from int  DEFAULT NULL,
  p_year_to   int  DEFAULT NULL
)
RETURNS TABLE(
  min_price    numeric,
  avg_price    numeric,
  max_price    numeric,
  sample_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    MIN(selling_price)::numeric,
    ROUND(AVG(selling_price))::numeric,
    MAX(selling_price)::numeric,
    COUNT(*)::bigint
  FROM car_listings
  WHERE
    selling_price IS NOT NULL
    AND selling_price > 0
    AND status IN ('available', 'reserved', 'sold')
    AND (p_brand   IS NULL OR brand  ILIKE p_brand)
    AND (p_model   IS NULL OR model  ILIKE p_model)
    AND (p_variant IS NULL OR variant ILIKE '%' || p_variant || '%')
    AND (p_year_from IS NULL OR year >= p_year_from)
    AND (p_year_to   IS NULL OR year <= p_year_to)
$$;

GRANT EXECUTE ON FUNCTION get_price_range(text, text, text, int, int) TO anon;
GRANT EXECUTE ON FUNCTION get_price_range(text, text, text, int, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION get_price_range(text, text, text, int, int) FROM public;
