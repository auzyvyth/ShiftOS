-- ============================================================
-- Feature 1: Smart search autocomplete
-- Returns distinct brand/model/variant combos from live inventory
-- matching the user's typed text in any of those three fields.
-- ============================================================

CREATE OR REPLACE FUNCTION search_listing_terms(
  search_text  text,
  max_results  int DEFAULT 12
)
RETURNS TABLE(
  brand          text,
  model          text,
  variant        text,
  listing_count  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    brand,
    model,
    variant,
    COUNT(*) AS listing_count
  FROM car_listings
  WHERE
    LENGTH(TRIM(search_text)) >= 2
    AND status IN ('available', 'reserved')
    AND brand IS NOT NULL
    AND (
      brand   ILIKE '%' || TRIM(search_text) || '%'
      OR model   ILIKE '%' || TRIM(search_text) || '%'
      OR variant ILIKE '%' || TRIM(search_text) || '%'
      OR (brand || ' ' || COALESCE(model, ''))
           ILIKE '%' || TRIM(search_text) || '%'
      OR (brand || ' ' || COALESCE(model, '') || ' ' || COALESCE(variant, ''))
           ILIKE '%' || TRIM(search_text) || '%'
    )
  GROUP BY brand, model, variant
  ORDER BY listing_count DESC, brand, model, variant
  LIMIT LEAST(max_results, 20)
$$;

-- Public marketplace can call this (car_listings SELECT is already open)
GRANT EXECUTE ON FUNCTION search_listing_terms(text, int) TO anon;
GRANT EXECUTE ON FUNCTION search_listing_terms(text, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION search_listing_terms(text, int) FROM public;
