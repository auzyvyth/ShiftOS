-- Root cause: appointments_public_insert / enquiries_public_insert / analytics_public_insert
-- all use a subquery on `profiles` inside their WITH CHECK expression.
-- profiles has no anon SELECT policy → the subquery returns 0 rows for anonymous
-- storefront visitors → dealer_id IN (empty set) = FALSE → every public booking
-- and enquiry is silently rejected by RLS.
--
-- Fix: wrap the check in a SECURITY DEFINER function so it runs as the function
-- owner (postgres), bypassing profiles RLS, without exposing any profile data.

CREATE OR REPLACE FUNCTION is_dealer_active(p_dealer_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_dealer_id
      AND (
        subscription_status = 'active'
        OR (subscription_status = 'trial' AND trial_ends_at > now())
      )
  );
$$;

DROP POLICY IF EXISTS appointments_public_insert    ON appointments;
DROP POLICY IF EXISTS enquiries_public_insert       ON whatsapp_enquiries;
DROP POLICY IF EXISTS analytics_public_insert       ON analytics_events;

CREATE POLICY appointments_public_insert ON appointments
  FOR INSERT TO anon, authenticated
  WITH CHECK (is_dealer_active(dealer_id));

CREATE POLICY enquiries_public_insert ON whatsapp_enquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (is_dealer_active(dealer_id));

CREATE POLICY analytics_public_insert ON analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (dealer_id IS NULL OR is_dealer_active(dealer_id));
