-- Fix public_dealer_profiles view:
-- 1. Add email + phone columns (were missing, causing footer query to error and return nothing)
-- 2. Scope to dealer/owner/superadmin roles only (previously exposed all profiles incl. staff)
-- 3. Revoke write privileges from anon/authenticated (view is read-only public data)

CREATE OR REPLACE VIEW public.public_dealer_profiles AS
SELECT
  id, slug, subdomain, custom_domain, dealership, site_name,
  site_logo_url, logo_url, brand_color, font_choice,
  hero_title, hero_subtitle, hero_cta_text,
  about_text, whatsapp_number,
  location, city, state,
  social_tiktok, social_instagram, social_facebook,
  announcement_bar, announcement_bar_enabled,
  storefront_why, storefront_how, storefront_testimonials, storefront_cta,
  hero_video_url, hero_video_title, hero_video_enabled,
  avatar_url, watermark_text, is_active, subscription_status,
  whatsapp_number AS contact_whatsapp,
  email, phone
FROM public.profiles
WHERE role IN ('dealer', 'owner', 'superadmin');

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.public_dealer_profiles FROM anon, authenticated;

GRANT SELECT ON public.public_dealer_profiles TO anon, authenticated;
