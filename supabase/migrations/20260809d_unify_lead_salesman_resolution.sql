-- Applied live via MCP apply_migration on 2026-08-09; captured here for repo parity.
--
-- Harden + unify salesman attribution for inbound leads. The salesman_id a lead
-- gets was resolved by TWO different, drifting code paths -> the same "lead never
-- shows in my pipeline" bug bit twice:
--   * create_lead_from_whatsapp (ContactGate / WhatsApp tap): ref_slug -> self-
--     owned-salesman. It was MISSING the car assigned_to fallback, so a WhatsApp
--     tap with no ref_slug on a car locked to a rep (incl. a linked salesman
--     under a dealer) never attributed to that rep.
--   * enquiry_to_lead (enquiry form): explicit -> ref_slug (UNGUARDED: any
--     profile, any dealer) -> assigned_to -> self-owned-salesman.
--
-- Both now call ONE SECURITY DEFINER resolver, resolve_lead_salesman(), so every
-- capture path attributes a lead identically for all three salesman surfaces:
--   - Salesman Lite (standalone, dealer_id NULL)      -> SalesmanLite.jsx
--   - Salesman Premium (standalone, dealer_id NULL)   -> SalesmanPremium.jsx
--   - Salesman under a dealer (dealer_id set)          -> Salesmanpanel.jsx
-- Resolution order (first hit wins):
--   0. explicit rep the caller already resolved (e.g. api set salesman_id)
--   1. referral slug -> must be role='salesman' AND scoped to this dealer
--   2. car exclusivity lock -> car_listings.assigned_to (the closer)
--   3. the "dealer" is itself a self-owned salesman (Lite/Premium standalone)
-- Real dealers/owners fall through to NULL, so genuinely unassigned leads stay in
-- the shared dealer pool (visible to the dealer / view_all_leads), unchanged.

CREATE OR REPLACE FUNCTION public.resolve_lead_salesman(
  p_dealer_id uuid,
  p_car_id uuid DEFAULT NULL::uuid,
  p_ref_slug text DEFAULT NULL::text,
  p_explicit uuid DEFAULT NULL::uuid
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v uuid;
BEGIN
  IF p_dealer_id IS NULL THEN
    RETURN p_explicit;
  END IF;

  -- 0. Caller already resolved the rep (api/enquiry.js sets salesman_id): trust it.
  IF p_explicit IS NOT NULL THEN
    RETURN p_explicit;
  END IF;

  -- 1. Referral slug -> must be a salesman scoped to this dealer (prevents a
  --    non-salesman slug or a cross-dealer slug collision from stealing the lead).
  IF p_ref_slug IS NOT NULL AND btrim(p_ref_slug) <> '' THEN
    SELECT id INTO v FROM profiles
    WHERE slug = p_ref_slug AND role = 'salesman'
      AND (id = p_dealer_id OR dealer_id = p_dealer_id)
    LIMIT 1;
    IF v IS NOT NULL THEN RETURN v; END IF;
  END IF;

  -- 2. Car exclusivity lock -> the assigned rep is always the closer.
  IF p_car_id IS NOT NULL THEN
    SELECT assigned_to INTO v FROM car_listings WHERE id = p_car_id;
    IF v IS NOT NULL THEN RETURN v; END IF;
  END IF;

  -- 3. The "dealer" is itself a self-owned salesman (standalone Lite/Premium):
  --    they own every inbound lead. Real dealers/owners -> NULL (dealer pool).
  SELECT id INTO v FROM profiles
  WHERE id = p_dealer_id AND role = 'salesman' AND dealer_id IS NULL;
  RETURN v;
END;
$function$;

-- WhatsApp-button path (ContactGate) -----------------------------------------
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

  v_salesman := public.resolve_lead_salesman(p_dealer_id, p_car_id, p_ref_slug, NULL);

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

-- Enquiry-form path (trigger on whatsapp_enquiries) --------------------------
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

  v_salesman_id := public.resolve_lead_salesman(NEW.dealer_id, NEW.listing_id, NEW.ref_slug, NEW.salesman_id);
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
    -- Adopt an existing orphan lead (salesman_id NULL) onto the resolved rep so a
    -- re-enquiry surfaces it in that rep's pipeline.
    IF v_salesman_id IS NOT NULL THEN
      UPDATE leads SET salesman_id = v_salesman_id
        WHERE id = v_lead_id AND salesman_id IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END
$function$;
