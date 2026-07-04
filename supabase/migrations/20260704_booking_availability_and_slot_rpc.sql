-- ─────────────────────────────────────────────────────────────────────────
-- Booking availability: a seller (salesman OR dealer) sets a weekly schedule
-- ONCE. Buyers see a tap-calendar derived from it minus already-booked slots.
-- Ownership mirrors the appointment-owner chain in api/booking.js:
--   ref slug > car_listings.assigned_to > dealer  (with dealer as fallback rule)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.booking_availability (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  dealer_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- 0=Sun .. 6=Sat, to match JS Date.getDay(). Default Mon-Fri.
  weekdays     int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  start_hour   int  NOT NULL DEFAULT 9   CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour     int  NOT NULL DEFAULT 18  CHECK (end_hour  >= 1 AND end_hour  <= 24),
  slot_minutes int  NOT NULL DEFAULT 60  CHECK (slot_minutes IN (30, 60)),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (end_hour > start_hour)
);

ALTER TABLE public.booking_availability ENABLE ROW LEVEL SECURITY;

-- The owner (dealer or salesman) manages only their own row. Dealers own
-- themselves (auth.uid() = profile.id = owner_id); salesmen likewise. Buyer
-- reads never touch this table directly — they go through get_booking_slots.
DROP POLICY IF EXISTS booking_availability_owner_all ON public.booking_availability;
CREATE POLICY booking_availability_owner_all
  ON public.booking_availability
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ── Slot resolver: one anon-callable call returns the resolved owner, their
-- availability rule (falling back to the dealer's), and the taken slots so the
-- client can grey out full days/times. Never returns buyer PII. ──
CREATE OR REPLACE FUNCTION public.get_booking_slots(
  p_car_id   uuid,
  p_ref_slug text DEFAULT NULL,
  p_days     int  DEFAULT 21
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dealer   uuid;
  v_assigned uuid;
  v_ref      uuid;
  v_owner    uuid;
  v_is_house boolean;
  v_av       public.booking_availability%ROWTYPE;
  v_found    boolean := false;
  v_booked   jsonb;
BEGIN
  SELECT dealer_id, assigned_to INTO v_dealer, v_assigned
  FROM public.car_listings WHERE id = p_car_id;
  IF v_dealer IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_ref_slug IS NOT NULL AND length(trim(p_ref_slug)) > 0 THEN
    SELECT id INTO v_ref FROM public.profiles WHERE slug = p_ref_slug;
  END IF;

  v_owner := COALESCE(v_ref, v_assigned, v_dealer);

  -- Owner's own rule first; fall back to the dealer's house rule.
  SELECT * INTO v_av FROM public.booking_availability
    WHERE owner_id = v_owner AND is_active = true;
  IF FOUND THEN
    v_found := true;
  ELSIF v_owner <> v_dealer THEN
    SELECT * INTO v_av FROM public.booking_availability
      WHERE owner_id = v_dealer AND is_active = true;
    IF FOUND THEN
      v_found := true;
      v_owner := v_dealer;   -- block against the house calendar we resolved to
    END IF;
  END IF;

  v_is_house := (v_owner = v_dealer);

  -- Taken slots that block the resolved calendar. A salesman can't be in two
  -- places at once (block their own pending/confirmed). The house calendar
  -- blocks only unclaimed dealer bookings (salesman_id IS NULL) so it stays
  -- conservative without over-blocking a multi-rep dealer.
  SELECT COALESCE(jsonb_agg(appointment_date), '[]'::jsonb) INTO v_booked
  FROM public.appointments
  WHERE appointment_date >= now()
    AND status IN ('pending', 'confirmed')
    AND (
      (v_is_house AND dealer_id = v_owner AND salesman_id IS NULL)
      OR (NOT v_is_house AND salesman_id = v_owner)
    );

  RETURN jsonb_build_object(
    'owner_id',         v_owner,
    'has_availability', v_found,
    'weekdays',         CASE WHEN v_found THEN to_jsonb(v_av.weekdays)   ELSE NULL END,
    'start_hour',       CASE WHEN v_found THEN v_av.start_hour           ELSE NULL END,
    'end_hour',         CASE WHEN v_found THEN v_av.end_hour             ELSE NULL END,
    'slot_minutes',     CASE WHEN v_found THEN v_av.slot_minutes         ELSE NULL END,
    'days',             p_days,
    'booked',           v_booked
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_slots(uuid, text, int) TO anon, authenticated;

-- ── Extend claim_lead: claiming an unclaimed lead ALSO claims the linked
-- appointment (the actual viewing slot), so an aimless marketplace booking
-- that lands in the open pool is grabbed whole — lead + slot — atomically. ──
CREATE OR REPLACE FUNCTION public.claim_lead(p_lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_ok boolean;
BEGIN
  IF NOT is_active_salesman() THEN RETURN false; END IF;
  UPDATE leads
     SET salesman_id = auth.uid(), updated_at = now()
   WHERE id = p_lead_id
     AND salesman_id IS NULL
     AND dealer_id = get_my_dealer_id()
  RETURNING true INTO v_ok;

  IF COALESCE(v_ok, false) THEN
    UPDATE appointments
       SET salesman_id = auth.uid(), updated_at = now()
     WHERE lead_id = p_lead_id
       AND salesman_id IS NULL
       AND dealer_id = get_my_dealer_id();
  END IF;

  RETURN COALESCE(v_ok, false);
END; $function$;
