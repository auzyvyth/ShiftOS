-- ============================================================
-- Feature: Canonical variant normalization
--
-- Adds canonical_variant column to car_listings.
-- AI normalizes free-text variant at save time → one canonical
-- form per model trim (e.g. "FL5 Type R", "1.5 TC-P", "GR Sport").
-- search_listing_terms prefers canonical_variant over raw variant,
-- collapsing hundreds of free-text spellings into one dropdown row.
-- ============================================================

ALTER TABLE car_listings
  ADD COLUMN IF NOT EXISTS canonical_variant text;

-- Index for search grouping performance
CREATE INDEX IF NOT EXISTS car_listings_canonical_idx
  ON car_listings (brand, model, canonical_variant)
  WHERE canonical_variant IS NOT NULL;

-- ── Update search_listing_terms to use canonical_variant ─────────────────────
-- v3: prefers canonical_variant, falls back to raw variant,
--     groups and displays the same normalized expression
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
    -- Prefer canonical_variant; fall back to raw variant; null when blank
    NULLIF(TRIM(COALESCE(
      NULLIF(TRIM(COALESCE(canonical_variant, '')), ''),
      NULLIF(TRIM(COALESCE(variant, '')), '')
    )), '') AS variant,
    COUNT(*) AS listing_count
  FROM car_listings
  WHERE
    LENGTH(TRIM(search_text)) >= 2
    AND status IN ('available', 'reserved')
    AND brand IS NOT NULL
    AND (
      brand              ILIKE '%' || TRIM(search_text) || '%'
      OR model              ILIKE '%' || TRIM(search_text) || '%'
      OR variant            ILIKE '%' || TRIM(search_text) || '%'
      OR canonical_variant  ILIKE '%' || TRIM(search_text) || '%'
      OR (brand || ' ' || COALESCE(model, ''))
           ILIKE '%' || TRIM(search_text) || '%'
      OR (brand || ' ' || COALESCE(model, '') || ' ' || COALESCE(canonical_variant, COALESCE(variant, '')))
           ILIKE '%' || TRIM(search_text) || '%'
    )
  GROUP BY
    brand,
    model,
    NULLIF(TRIM(COALESCE(
      NULLIF(TRIM(COALESCE(canonical_variant, '')), ''),
      NULLIF(TRIM(COALESCE(variant, '')), '')
    )), '')
  ORDER BY listing_count DESC, brand, model, variant
  LIMIT LEAST(max_results, 20)
$$;

GRANT EXECUTE ON FUNCTION search_listing_terms(text, int) TO anon;
GRANT EXECUTE ON FUNCTION search_listing_terms(text, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION search_listing_terms(text, int) FROM public;
