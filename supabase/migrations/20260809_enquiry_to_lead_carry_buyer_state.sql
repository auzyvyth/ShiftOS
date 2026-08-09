-- Applied live via MCP apply_migration on 2026-08-09; captured here for repo parity.
--
-- enquiry_to_lead dropped NEW.buyer_state: the car-detail enquiry form captures
-- the buyer's state into whatsapp_enquiries.buyer_state, but the lead it created
-- never received it, so state never surfaced in the pipeline. Carry it through on
-- insert, and backfill it onto a matched existing lead that lacks one.
CREATE OR REPLACE FUNCTION public.enquiry_to_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phone text;
  v_lead_id uuid;
  v_salesman_id uuid;
  v_state text := NULLIF(btrim(COALESCE(NEW.buyer_state, '')), '');
BEGIN
  v_phone := regexp_replace(COALESCE(NEW.buyer_phone,''), '\D', '', 'g');
  IF v_phone = '' THEN RETURN NEW; END IF; -- anonymous click, nothing to contact

  -- Resolve which salesman this click belongs to: explicit salesman_id wins,
  -- else the ref_slug the buyer clicked through, else the car's assigned rep.
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

  SELECT id INTO v_lead_id FROM leads
    WHERE dealer_id = NEW.dealer_id AND is_deleted = false
      AND regexp_replace(COALESCE(phone,''), '\D','','g') = v_phone
    ORDER BY created_at DESC LIMIT 1;
  IF v_lead_id IS NULL THEN
    INSERT INTO leads (dealer_id, buyer_name, phone, buyer_state, lead_source, car_listing_id,
                       salesman_id, stage, is_deleted, notes, last_contacted_at, created_at)
    VALUES (NEW.dealer_id, COALESCE(NULLIF(NEW.buyer_name,''),'WhatsApp enquiry'),
            NEW.buyer_phone, v_state, 'enquiry', NEW.listing_id, v_salesman_id, 'new',
            false, NEW.buyer_message, NEW.last_contacted_at, COALESCE(NEW.created_at, now()))
    RETURNING id INTO v_lead_id;
  ELSIF v_state IS NOT NULL THEN
    -- Enrich an existing matched lead that has no state yet (don't clobber a set one).
    UPDATE leads SET buyer_state = v_state
      WHERE id = v_lead_id AND NULLIF(btrim(COALESCE(buyer_state,'')), '') IS NULL;
  END IF;
  UPDATE whatsapp_enquiries SET lead_id = v_lead_id WHERE id = NEW.id;
  RETURN NEW;
END
$function$;

-- One-off backfill: restore state to leads whose linked enquiry captured one but
-- the old trigger dropped it (the Helowtest -> Penang case).
UPDATE leads l
SET buyer_state = NULLIF(btrim(e.buyer_state), '')
FROM whatsapp_enquiries e
WHERE e.lead_id = l.id
  AND e.buyer_state IS NOT NULL AND btrim(e.buyer_state) <> ''
  AND NULLIF(btrim(COALESCE(l.buyer_state,'')), '') IS NULL;
