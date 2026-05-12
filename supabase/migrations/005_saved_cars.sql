-- ============================================================
-- saved_cars table
-- Persists wishlist for authenticated users.
-- Guests use localStorage (useSavedCars hook merges on sign-in).
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_cars (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES car_listings(id) ON DELETE CASCADE,
  saved_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS saved_cars_user_idx ON saved_cars (user_id);

ALTER TABLE saved_cars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_cars_owner" ON saved_cars
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
