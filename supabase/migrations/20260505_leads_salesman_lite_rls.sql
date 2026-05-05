-- Allow standalone salesmen (dealer_id IS NULL) to own their leads by salesman_id

-- 1. Make buyer_name and phone nullable — enquiries may arrive without them
ALTER TABLE leads
  ALTER COLUMN buyer_name DROP NOT NULL,
  ALTER COLUMN phone      DROP NOT NULL;

-- 2. Widen lead_source to include values used by the app
--    (drop and recreate to avoid issues if constraint name differs across envs)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_lead_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_lead_source_check
  CHECK (lead_source IN (
    'walk_in', 'whatsapp', 'referral', 'drevo_enquiry',
    'enquiry', 'manual'
  ));

-- 3. RLS: standalone salesmen read/write their own leads
DROP POLICY IF EXISTS "salesman_lite_leads_all" ON leads;
CREATE POLICY "salesman_lite_leads_all" ON leads
  FOR ALL
  USING  (salesman_id = auth.uid() AND dealer_id IS NULL)
  WITH CHECK (salesman_id = auth.uid() AND dealer_id IS NULL);
