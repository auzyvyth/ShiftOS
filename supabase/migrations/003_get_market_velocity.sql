-- ============================================================
-- Feature 3: Market velocity — dealer-only demand intelligence
--
-- Returns one row per brand/model currently in the dealer's stock,
-- showing platform-wide demand signals for each combo.
--
-- Security model:
--   - authenticated only (no anon grant)
--   - SECURITY DEFINER to read stock_units + car_listings across RLS
--   - explicit auth.uid() check: caller must BE the dealer or a
--     sub-user (manager/admin/salesman) whose profiles.dealer_id
--     points to p_dealer_id
--   - raises 'access_denied' exception on mismatch (no silent empty)
-- ============================================================

CREATE OR REPLACE FUNCTION get_market_velocity(p_dealer_id uuid)
RETURNS TABLE(
  brand             text,
  model             text,
  dealer_stock      bigint,   -- units dealer currently holds in stock
  market_active     bigint,   -- platform-wide active/reserved listings
  sold_last_30d     bigint,   -- platform-wide units sold in last 30 days
  avg_days_to_sell  numeric,  -- platform-wide avg days listed→sold (nulls excluded)
  sell_through_rate numeric   -- sold / (sold + active) × 100, 0–100
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Hard security gate: caller must be the dealer or one of their sub-users
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (
        id = p_dealer_id
        OR dealer_id = p_dealer_id
      )
  ) THEN
    RAISE EXCEPTION 'access_denied'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Input sanity: null dealer_id is always wrong
  IF p_dealer_id IS NULL THEN
    RAISE EXCEPTION 'invalid_argument'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
  WITH dealer_combos AS (
    -- Distinct brand+model combos the dealer currently holds
    SELECT DISTINCT su.brand, su.model
    FROM stock_units su
    WHERE su.dealer_id = p_dealer_id
      AND su.status    = 'in_stock'
      AND su.brand IS NOT NULL
      AND su.model IS NOT NULL
  ),
  dealer_counts AS (
    SELECT su.brand, su.model, COUNT(*) AS cnt
    FROM stock_units su
    WHERE su.dealer_id = p_dealer_id
      AND su.status    = 'in_stock'
    GROUP BY su.brand, su.model
  ),
  market_stats AS (
    SELECT
      cl.brand,
      cl.model,
      COUNT(*) FILTER (
        WHERE cl.status IN ('available', 'reserved')
      )::bigint AS active,

      COUNT(*) FILTER (
        WHERE cl.status = 'sold'
          AND cl.sold_at >= (NOW() - INTERVAL '30 days')
      )::bigint AS sold_30d,

      ROUND(
        AVG(
          CASE
            WHEN cl.status = 'sold' AND cl.sold_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (cl.sold_at - cl.created_at)) / 86400.0
          END
        )::numeric, 1
      ) AS avg_days,

      COUNT(*) FILTER (WHERE cl.status = 'sold'  )::bigint AS total_sold,
      COUNT(*) FILTER (WHERE cl.status IN ('available','reserved','sold'))::bigint AS total_ever

    FROM car_listings cl
    INNER JOIN dealer_combos dc
      ON cl.brand = dc.brand AND cl.model = dc.model
    GROUP BY cl.brand, cl.model
  )
  SELECT
    dc.brand,
    dc.model,
    COALESCE(dd.cnt,          0)::bigint  AS dealer_stock,
    COALESCE(ms.active,       0)::bigint  AS market_active,
    COALESCE(ms.sold_30d,     0)::bigint  AS sold_last_30d,
    COALESCE(ms.avg_days,     0)::numeric AS avg_days_to_sell,
    CASE
      WHEN COALESCE(ms.total_ever, 0) > 0
        THEN ROUND(
          (COALESCE(ms.total_sold, 0)::numeric / ms.total_ever::numeric) * 100,
          1
        )
      ELSE 0::numeric
    END AS sell_through_rate
  FROM dealer_combos dc
  LEFT JOIN dealer_counts dd ON dc.brand = dd.brand AND dc.model = dd.model
  LEFT JOIN market_stats   ms ON dc.brand = ms.brand AND dc.model = ms.model
  ORDER BY dd.cnt DESC NULLS LAST, dc.brand, dc.model;
END;
$$;

-- Authenticated users only — anon gets nothing
GRANT EXECUTE ON FUNCTION get_market_velocity(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION get_market_velocity(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION get_market_velocity(uuid) FROM public;
