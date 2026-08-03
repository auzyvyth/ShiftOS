-- F5 (server-side portion): create_lead_from_whatsapp only DEDUPED (name+car/24h),
-- so a name-varying flood created unlimited net-new pipeline leads. Add a
-- per-dealer flood cap keyed on p_dealer_id -- the one identifier ContactGate
-- always sends and a client cannot null out. Deduped/repeat clicks don't count
-- (the cap only gates the net-new INSERT), and the buyer still reaches WhatsApp
-- (ContactGate opens it regardless of this RPC's result). A CAPTCHA/Turnstile
-- proof-of-human on the public write path is the real control and is tracked as a
-- follow-up (needs Turnstile keys + an edge verification step).
CREATE OR REPLACE FUNCTION public.create_lead_from_whatsapp(p_dealer_id uuid, p_car_id uuid, p_name text, p_phone text DEFAULT NULL::text, p_ref_slug text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_phone text := NULLIF(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), '');
  v_name text := NULLIF(btrim(COALESCE(p_name, '')), '');
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

  -- Dedupe: by phone if we have one, otherwise by name+car within 24h (so repeat
  -- name-only clicks don't spam the pipeline).
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
      salesman_id = COALESCE(salesman_id, v_salesman),
      updated_at = now()
    WHERE id = v_existing;
    RETURN v_existing;
  END IF;

  -- Flood cap: bound net-new whatsapp leads per dealer per hour. Generous enough
  -- not to block real buyers; stops a name-varying spam loop that dedupe can't.
  SELECT count(*) INTO v_recent FROM leads
   WHERE dealer_id = p_dealer_id
     AND lead_source = 'whatsapp'
     AND created_at > now() - interval '1 hour';
  IF v_recent >= 40 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO leads (dealer_id, salesman_id, buyer_name, phone, car_listing_id, stage, lead_source, is_deleted)
  VALUES (p_dealer_id, v_salesman, v_name, v_phone, p_car_id, 'new', 'whatsapp', false)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;
