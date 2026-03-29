-- ── Recon Car Grading System ─────────────────────────────────────────────────
-- Adds 8 new columns to car_listings for recon/import grading
-- RLS already on car_listings (dealer_id = auth.uid()) — no new policies needed
-- Run this in Supabase SQL Editor before deploying the front-end changes.

ALTER TABLE car_listings
  ADD COLUMN IF NOT EXISTS auction_grade   text,
  ADD COLUMN IF NOT EXISTS interior_grade  text,
  ADD COLUMN IF NOT EXISTS is_recon        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS import_country  text,
  ADD COLUMN IF NOT EXISTS damage_map      jsonb    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS local_reg_date  date,
  ADD COLUMN IF NOT EXISTS auction_house   text,
  ADD COLUMN IF NOT EXISTS chassis_status  text;

-- Optional: constrain to known values (idempotent — safe to re-run)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'car_listings_auction_grade_check') THEN
    ALTER TABLE car_listings ADD CONSTRAINT car_listings_auction_grade_check
      CHECK (auction_grade IS NULL OR auction_grade IN ('S','5','4.5','4','3.5','3','R','RA','2','1'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'car_listings_interior_grade_check') THEN
    ALTER TABLE car_listings ADD CONSTRAINT car_listings_interior_grade_check
      CHECK (interior_grade IS NULL OR interior_grade IN ('A','B','C','D'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'car_listings_chassis_status_check') THEN
    ALTER TABLE car_listings ADD CONSTRAINT car_listings_chassis_status_check
      CHECK (chassis_status IS NULL OR chassis_status IN ('clean','repaired','written_off'));
  END IF;
END $$;

-- Index for filtering recon cars quickly
CREATE INDEX IF NOT EXISTS idx_car_listings_is_recon ON car_listings (dealer_id, is_recon);
