-- Workaround: gross_profit is a GENERATED ALWAYS column — PostgREST includes
-- it in UPDATE statements causing a 400. RPC bypasses PostgREST's query
-- construction and runs a clean SET status = $1 directly.
CREATE OR REPLACE FUNCTION update_listing_status(
  p_listing_id uuid,
  p_status      text,
  p_dealer_id   uuid
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE car_listings
  SET status = p_status
  WHERE id = p_listing_id
    AND dealer_id = p_dealer_id;
$$;

GRANT EXECUTE ON FUNCTION update_listing_status(uuid, text, uuid) TO authenticated;
