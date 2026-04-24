ALTER TABLE public.car_listings
  ADD COLUMN IF NOT EXISTS salesman_slug text;

-- Index for marketplace lookup by salesman profile URL
CREATE INDEX IF NOT EXISTS idx_car_listings_salesman_slug
  ON public.car_listings (salesman_slug);
