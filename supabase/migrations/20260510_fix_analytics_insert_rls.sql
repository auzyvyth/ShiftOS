-- analytics_public_insert was gated on is_dealer_active(dealer_id), meaning any
-- dealer without subscription_status='active'/'trial' had every car_view and
-- booking_click silently rejected. Analytics tracking should always work —
-- SELECT is already scoped by auth.uid() so there is no confidentiality risk.
DROP POLICY IF EXISTS analytics_public_insert ON analytics_events;

CREATE POLICY analytics_public_insert ON analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
