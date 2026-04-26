-- Helper: returns true if calling user is an active salesman
CREATE OR REPLACE FUNCTION is_active_salesman()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'salesman'
      AND is_active = true
  );
$$;

-- car_listings: salesman can only read own listings if active
DROP POLICY IF EXISTS "salesman_reads_own_listings" ON car_listings;
CREATE POLICY "salesman_reads_own_listings" ON car_listings
  FOR SELECT
  USING (dealer_id = auth.uid() AND is_active_salesman());

-- car_listings: salesman can only update own listings if active
DROP POLICY IF EXISTS "salesman_updates_own_listings" ON car_listings;
CREATE POLICY "salesman_updates_own_listings" ON car_listings
  FOR UPDATE
  USING (dealer_id = auth.uid() AND is_active_salesman())
  WITH CHECK (dealer_id = auth.uid() AND is_active_salesman());

-- car_listings: salesman can only delete own listings if active
DROP POLICY IF EXISTS "salesman_deletes_own_listings" ON car_listings;
CREATE POLICY "salesman_deletes_own_listings" ON car_listings
  FOR DELETE
  USING (dealer_id = auth.uid() AND is_active_salesman());

-- car_listings: salesman can only insert if active
DROP POLICY IF EXISTS "salesman_inserts_own_listings" ON car_listings;
CREATE POLICY "salesman_inserts_own_listings" ON car_listings
  FOR INSERT
  WITH CHECK (dealer_id = auth.uid() AND is_active_salesman());

-- whatsapp_enquiries: salesman lite select
DROP POLICY IF EXISTS "enquiries_salesman_lite_select" ON whatsapp_enquiries;
CREATE POLICY "enquiries_salesman_lite_select" ON whatsapp_enquiries
  FOR SELECT
  USING (
    dealer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'salesman'
        AND dealer_id IS NULL
        AND is_active = true
    )
  );

-- whatsapp_enquiries: salesman lite update
DROP POLICY IF EXISTS "enquiries_salesman_lite_update" ON whatsapp_enquiries;
CREATE POLICY "enquiries_salesman_lite_update" ON whatsapp_enquiries
  FOR UPDATE
  USING (
    dealer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'salesman'
        AND dealer_id IS NULL
        AND is_active = true
    )
  );

-- appointments: salesman lite select + update
DROP POLICY IF EXISTS "appointments_salesman_lite_select" ON appointments;
CREATE POLICY "appointments_salesman_lite_select" ON appointments
  FOR SELECT
  USING (salesman_id = auth.uid() AND dealer_id = auth.uid() AND is_active_salesman());

DROP POLICY IF EXISTS "appointments_salesman_lite_update" ON appointments;
CREATE POLICY "appointments_salesman_lite_update" ON appointments
  FOR UPDATE
  USING (salesman_id = auth.uid() AND dealer_id = auth.uid() AND is_active_salesman());
