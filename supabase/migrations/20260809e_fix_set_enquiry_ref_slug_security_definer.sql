-- Fix: WhatsApp/enquiry taps stopped creating pipeline leads (all inbound leads
-- silently dropped). Root cause: the BEFORE INSERT trigger set_enquiry_ref_slug()
-- on whatsapp_enquiries was SECURITY INVOKER, so it ran as the anon role on every
-- public /api/enquiry insert and read the base car_listings table:
--
--     SELECT p.slug FROM car_listings cl JOIN profiles p ON p.id = cl.assigned_to ...
--
-- anon has NO SELECT grant on car_listings (public reads go through the
-- public_car_listings view), so this threw:
--     42501: permission denied for table car_listings
-- which aborted the whole enquiry insert -> no whatsapp_enquiries row, no
-- enquiry_to_lead trigger, no pipeline lead. Every OTHER trigger on
-- whatsapp_enquiries is already SECURITY DEFINER; this one was missing the flag.
--
-- Fix: recreate as SECURITY DEFINER (owned by postgres, which can read
-- car_listings), matching the sibling triggers. This is the correct fix rather
-- than GRANT SELECT ON car_listings TO anon, which would defeat the intentional
-- base-table lockdown and expose all columns publicly. Function body unchanged.
CREATE OR REPLACE FUNCTION public.set_enquiry_ref_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_slug text;
BEGIN
  IF NEW.ref_slug IS NULL AND NEW.listing_id IS NOT NULL THEN
    SELECT p.slug INTO v_slug
    FROM car_listings cl
    JOIN profiles p ON p.id = cl.assigned_to
    WHERE cl.id = NEW.listing_id
      AND cl.assigned_to IS NOT NULL
      AND p.slug IS NOT NULL
    LIMIT 1;
    IF v_slug IS NOT NULL THEN
      NEW.ref_slug := v_slug;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
