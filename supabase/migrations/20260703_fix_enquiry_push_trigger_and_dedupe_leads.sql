-- Applied live via MCP apply_migration on 2026-07-03; captured here for repo parity.
--
-- 1) notify_push_on_enquiry() read NEW.car_listing_id, but whatsapp_enquiries has
--    no such column (it's listing_id). Every enquiry INSERT aborted with
--    'record "new" has no field "car_listing_id"', so zero WhatsApp enquiries were
--    ever recorded (the storefront "we've saved your enquiry instead" toast lied).
CREATE OR REPLACE FUNCTION public.notify_push_on_enquiry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_dealer_id uuid;
  v_assigned_to uuid;
  v_car_brand text;
  v_car_model text;
  v_edge_url text;
  v_anon_key text;
BEGIN
  SELECT cl.dealer_id, cl.assigned_to, cl.brand, cl.model
    INTO v_dealer_id, v_assigned_to, v_car_brand, v_car_model
    FROM car_listings cl
    WHERE cl.id = NEW.listing_id;

  IF v_dealer_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_edge_url := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/send-push';
  v_anon_key := current_setting('app.anon_key', true);

  IF v_anon_key IS NULL OR v_anon_key = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body    := jsonb_build_object(
      'user_ids', ARRAY[v_dealer_id::text, v_assigned_to::text],
      'title',    'New Enquiry',
      'body',     'Someone enquired about ' || coalesce(v_car_brand, '') || ' ' || coalesce(v_car_model, ''),
      'url',      '/dashboard',
      'tag',      'enquiry-' || NEW.id
    )::text
  );

  RETURN NEW;
END;
$function$;

-- 2) Split-brain lead creation: enquiry_to_lead (dedup + salesman resolution) AND
--    create_lead_from_whatsapp_enquiry (naive, no dedup) both fired, plus
--    api/enquiry.js inserted a third. Keep the sophisticated one; drop the naive
--    duplicate so each enquiry yields exactly one lead. (api/enquiry.js's manual
--    insert is removed in the same change.)
DROP TRIGGER IF EXISTS trg_lead_from_whatsapp_enquiry ON public.whatsapp_enquiries;

-- 3) One-off data repair: the Salesman Lite settings save prepended +60 to a local
--    number that kept its leading trunk 0, producing the invalid +6001123142642.
UPDATE public.profiles
SET whatsapp_number = '+601123142642'
WHERE id = 'bb7c0fd6-9d4c-486a-b309-d01e937619de'
  AND whatsapp_number = '+6001123142642';
