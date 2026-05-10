-- Allow anonymous (storefront) visitors to create leads when they book a
-- viewing or send a WhatsApp enquiry. The heatmap reads buyer_state from
-- leads, so this is what feeds the "Lead Demand by State" panel.
-- SELECT remains gated by auth (dealer_id = auth.uid()).
DROP POLICY IF EXISTS leads_public_insert ON leads;

CREATE POLICY leads_public_insert ON leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (dealer_id IS NULL OR is_dealer_active(dealer_id));
