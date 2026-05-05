-- Fix public/anon read policy on car_listings to allow status='available'
-- Previously status was 'active'; all listing records were updated to 'available'
-- This drops any policy that filtered by status='active' and replaces it
-- with one that allows reading any non-sold listing (available + reserved).

-- Drop old policies that may have filtered by status='active'
DROP POLICY IF EXISTS "Public can read active listings" ON car_listings;
DROP POLICY IF EXISTS "Anyone can view active listings" ON car_listings;
DROP POLICY IF EXISTS "Public read active listings" ON car_listings;
DROP POLICY IF EXISTS "public_read_active" ON car_listings;
DROP POLICY IF EXISTS "anon_read_active" ON car_listings;
DROP POLICY IF EXISTS "Enable read access for all users" ON car_listings;

-- Create correct public read policy: allow reading available + reserved + sold
-- (sold listings shown on detail pages; filtering happens in the frontend)
CREATE POLICY "public_read_listings" ON car_listings
  FOR SELECT
  TO anon, authenticated
  USING (status IN ('available', 'reserved', 'sold'));
