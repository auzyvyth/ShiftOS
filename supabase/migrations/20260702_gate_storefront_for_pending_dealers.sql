-- A dealer whose payment isn't yet confirmed must not have a live public
-- storefront. Both subdomain lookups exclude payment_status='pending' so the
-- storefront resolves as "not found" until an admin confirms payment.
-- (Existing dealers have payment_status NULL -> unaffected.)

CREATE OR REPLACE FUNCTION public.get_dealer_id_by_subdomain(p_subdomain text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM profiles
  WHERE subdomain = p_subdomain
    AND payment_status IS DISTINCT FROM 'pending'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_dealer_profile_by_subdomain(p_subdomain text)
 RETURNS TABLE(id uuid, dealership text, site_name text, subdomain text, avatar_url text, site_logo_url text, logo_url text, email text, phone text, whatsapp_number text, social_facebook text, social_instagram text, social_tiktok text, location text, city text, state text, about_text text, brand_color text, custom_domain text, slug text, storefront_why jsonb, storefront_how jsonb, storefront_testimonials jsonb, storefront_cta jsonb, hero_title text, hero_subtitle text, hero_cta_text text, announcement_bar text, announcement_bar_enabled boolean, stat_years integer, stat_happy_customers integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    id, dealership, site_name, subdomain, avatar_url, site_logo_url, logo_url,
    email, phone, whatsapp_number, social_facebook, social_instagram, social_tiktok,
    location, city, state, about_text, brand_color, custom_domain, slug,
    storefront_why, storefront_how, storefront_testimonials, storefront_cta,
    hero_title, hero_subtitle, hero_cta_text,
    announcement_bar, announcement_bar_enabled,
    stat_years, stat_happy_customers
  FROM profiles
  WHERE subdomain = p_subdomain
    AND role = ANY (ARRAY['dealer'::text, 'owner'::text, 'superadmin'::text])
    AND payment_status IS DISTINCT FROM 'pending'
  LIMIT 1;
$function$;
