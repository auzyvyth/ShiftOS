-- SalesmanLite listing panel upgrade
-- Ensures analytics_events has composite index for per-listing CVR stats
-- (salesman_slug + car_id queries that power the heatmap bars)

CREATE INDEX IF NOT EXISTS idx_analytics_events_slug_car
  ON public.analytics_events (salesman_slug, car_id)
  WHERE car_id IS NOT NULL;

-- Ensure car_listings exposes all columns needed by the car detail popup
-- These columns exist from CarForm; add them if somehow missing on older DBs.
ALTER TABLE public.car_listings
  ADD COLUMN IF NOT EXISTS original_price  numeric,
  ADD COLUMN IF NOT EXISTS features        text,
  ADD COLUMN IF NOT EXISTS options         text,
  ADD COLUMN IF NOT EXISTS city            text,
  ADD COLUMN IF NOT EXISTS state           text,
  ADD COLUMN IF NOT EXISTS condition       text DEFAULT 'used',
  ADD COLUMN IF NOT EXISTS fuel_type       text,
  ADD COLUMN IF NOT EXISTS body_type       text,
  ADD COLUMN IF NOT EXISTS engine_cc       integer;

-- RLS: standalone salesman (dealer_id = auth.uid()) can read their own
-- car_listings rows including the new columns.  The existing owner/dealer
-- SELECT policy already covers this via dealer_id = auth.uid(), so no
-- new policy is needed — this comment documents the intent.
