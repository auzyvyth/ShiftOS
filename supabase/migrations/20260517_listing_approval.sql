-- Add rejection reason column for the approval system
ALTER TABLE car_listings ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Allow superadmin to read all listings (needed for the approval queue)
DO $$ BEGIN
  CREATE POLICY "superadmin_select_all_listings" ON car_listings
    FOR SELECT USING (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow superadmin to approve/reject any listing
DO $$ BEGIN
  CREATE POLICY "superadmin_update_all_listings" ON car_listings
    FOR UPDATE USING (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC: superadmin approves a pending listing → sets status to 'available'
CREATE OR REPLACE FUNCTION approve_listing(p_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'superadmin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE car_listings
    SET status = 'available', rejection_reason = NULL
    WHERE id = p_listing_id AND status = 'pending_approval';
END;
$$;

-- RPC: superadmin rejects a pending listing with a reason note
CREATE OR REPLACE FUNCTION reject_listing(p_listing_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'superadmin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE car_listings
    SET status = 'rejected', rejection_reason = p_reason
    WHERE id = p_listing_id AND status = 'pending_approval';
END;
$$;
