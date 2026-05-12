-- ============================================================
-- Feature 2b: Extended get_price_range
-- Adds min_year, max_year, avg_days_to_sell to the return type.
-- Must DROP first — Postgres can't ALTER return columns in place.
-- ============================================================

DROP FUNCTION IF EXISTS get_price_range(text, text, text, int, int);

CREATE FUNCTION get_price_range(
  p_brand     text DEFAULT NULL,
  p_model     text DEFAULT NULL,
  p_variant   text DEFAULT NULL,
  p_year_from int  DEFAULT NULL,
  p_year_to   int  DEFAULT NULL
)
RETURNS TABLE(
  min_price        numeric,
  avg_price        numeric,
  max_price        numeric,
  sample_count     bigint,
  min_year         int,
  max_year         int,
  avg_days_to_sell numeric
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
    COUNT(*)::bigint,
    MIN(year)::int,
    MAX(year)::int,
    ROUND(
      AVG(
        CASE
          WHEN status = 'sold' AND sold_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (sold_at - created_at)) / 86400.0
        END
      )::numeric, 0
    )
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
