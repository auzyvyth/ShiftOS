-- Applied live via MCP apply_migration on 2026-08-09; captured here for repo parity.
-- Supersedes the enquiry_to_lead body in 20260809_enquiry_to_lead_carry_buyer_state.sql.
--
-- Unify the two WhatsApp lead-capture paths so both collect the same info and
-- neither silently drops a lead:
--   1. create_lead_from_whatsapp (ContactGate path) gains p_state, so the
--      low-friction WhatsApp popup can carry the buyer's state like the enquiry form.
--      (The old 5-arg overload is dropped; p_state DEFAULT NULL keeps callers that
--      pass only 5 args working during rollout.)
--   2. enquiry_to_lead now creates a lead even when phone is absent (the car-detail
--      modal marks phone optional, but the old path required it -> name-only
--      enquiries were dropped). Phoneless dedupe mirrors create_lead_from_whatsapp
--      (name+car within 24h). Flood cap skips the net-new INSERT instead of raising,
--      so the enquiry row is always recorded even under a flood.

DROP FUNCTION IF EXISTS public.create_lead_from_whatsapp(uuid,uuid,text,text,text);

CREATE OR REPLACE FUNCTION public.create_lead_from_whatsapp(p_dealer_id uuid, p_car_id uuid, p_name text, p_phone text DEFAULT NULL::text, p_ref_slug text DEFAULT NULL::text, p_state text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_phone text := NULLIF(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), '');
  v_name text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_state text := NULLIF(btrim(COALESCE(p_state, '')), '');
  v_salesman uuid;
  v_existing uuid;
  v_id uuid;
  v_recent integer;
BEGIN
  IF p_dealer_id IS NULL OR v_name IS NULL THEN
    RAISE EXCEPTION 'name and dealer are required';
  END IF;

  IF p_ref_slug IS NOT NULL AND btrim(p_ref_slug) <> '' THEN
    SELECT id INTO v_salesman FROM profiles
    WHERE slug = p_ref_slug AND role = 'salesman'
      AND (id = p_dealer_id OR dealer_id = p_dealer_id)
    LIMIT 1;
  END IF;

  IF v_phone IS NOT NULL THEN
    SELECT id INTO v_existing FROM leads
    WHERE dealer_id = p_dealer_id
      AND regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = v_phone
      AND COALESCE(is_deleted, false) = false
    ORDER BY created_at DESC LIMIT 1;
  ELSE
    SELECT id INTO v_existing FROM leads
    WHERE dealer_id = p_dealer_id
      AND lower(btrim(COALESCE(buyer_name, ''))) = lower(v_name)
      AND COALESCE(car_listing_id::text, '') = COALESCE(p_car_id::text, '')
      AND COALESCE(is_deleted, false) = false
      AND created_at >= now() - interval '24 hours'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_existing IS NOT NULL THEN
    UPDATE leads SET
      car_listing_id = COALESCE(p_car_id, car_listing_id),
      phone = COALESCE(NULLIF(v_phone, ''), phone),
      buyer_state = COALESCE(buyer_state, v_state),
      salesman_id = COALESCE(salesman_id, v_salesman),
      updated_at = now()
    WHERE id = v_existing;
    RETURN v_existing;
  END IF;

  SELECT count(*) INTO v_recent FROM leads
   WHERE dealer_id = p_dealer_id
     AND lead_source = 'whatsapp'
     AND created_at > now() - interval '1 hour';
  IF v_recent >= 40 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO leads (dealer_id, salesman_id, buyer_name, phone, buyer_state, car_listing_id, stage, lead_source, is_deleted)
  VALUES (p_dealer_id, v_salesman, v_name, v_phone, v_state, p_car_id, 'new', 'whatsapp', false)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enquiry_to_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phone text;
  v_name  text := NULLIF(btrim(COALESCE(NEW.buyer_name, '')), '');
  v_state text := NULLIF(btrim(COALESCE(NEW.buyer_state, '')), '');
  v_lead_id uuid;
  v_salesman_id uuid;
  v_recent integer;
BEGIN
  v_phone := regexp_replace(COALESCE(NEW.buyer_phone,''), '\D', '', 'g');
  -- Truly anonymous (no name AND no phone) -> nothing to pipeline.
  IF v_phone = '' AND v_name IS NULL THEN RETURN NEW; END IF;

  v_salesman_id := NEW.salesman_id;
  IF v_salesman_id IS NULL AND NEW.ref_slug IS NOT NULL THEN
    SELECT id INTO v_salesman_id FROM profiles WHERE slug = NEW.ref_slug LIMIT 1;
  END IF;
  IF v_salesman_id IS NULL AND NEW.listing_id IS NOT NULL THEN
    SELECT assigned_to INTO v_salesman_id FROM car_listings WHERE id = NEW.listing_id;
  END IF;
  IF v_salesman_id IS DISTINCT FROM NEW.salesman_id THEN
    UPDATE whatsapp_enquiries SET salesman_id = v_salesman_id WHERE id = NEW.id;
  END IF;

  IF v_phone <> '' THEN
    SELECT id INTO v_lead_id FROM leads
      WHERE dealer_id = NEW.dealer_id AND is_deleted = false
        AND regexp_replace(COALESCE(phone,''), '\D','','g') = v_phone
      ORDER BY created_at DESC LIMIT 1;
  ELSE
    SELECT id INTO v_lead_id FROM leads
      WHERE dealer_id = NEW.dealer_id AND is_deleted = false
        AND lower(btrim(COALESCE(buyer_name,''))) = lower(v_name)
        AND COALESCE(car_listing_id::text,'') = COALESCE(NEW.listing_id::text,'')
        AND created_at >= now() - interval '24 hours'
      ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_lead_id IS NULL THEN
    SELECT count(*) INTO v_recent FROM leads
      WHERE dealer_id = NEW.dealer_id
        AND lead_source IN ('enquiry','whatsapp')
        AND created_at > now() - interval '1 hour';
    IF v_recent < 40 THEN
      INSERT INTO leads (dealer_id, buyer_name, phone, buyer_state, lead_source, car_listing_id,
                         salesman_id, stage, is_deleted, notes, last_contacted_at, created_at)
      VALUES (NEW.dealer_id, COALESCE(v_name,'WhatsApp enquiry'),
              NULLIF(NEW.buyer_phone,''), v_state, 'enquiry', NEW.listing_id, v_salesman_id, 'new',
              false, NEW.buyer_message, NEW.last_contacted_at, COALESCE(NEW.created_at, now()))
      RETURNING id INTO v_lead_id;
    END IF;
  ELSIF v_state IS NOT NULL THEN
    UPDATE leads SET buyer_state = v_state
      WHERE id = v_lead_id AND NULLIF(btrim(COALESCE(buyer_state,'')), '') IS NULL;
  END IF;

  IF v_lead_id IS NOT NULL THEN
    UPDATE whatsapp_enquiries SET lead_id = v_lead_id WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END
$function$;
