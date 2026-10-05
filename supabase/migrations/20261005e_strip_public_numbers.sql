-- CDP-3 part 2 (2026-10-05). RUN ONLY AFTER the /api/wa frontend is live on
-- production (see 20261005d). Strips seller numbers from the public lookups:
-- they return NULL in the number columns plus has_whatsapp / has_phone flags,
-- so the UI still knows whether to show a button.

-- 2. The broad profile lookups stop carrying numbers ------------------------
-- Return type changes (two flags appended), so DROP + CREATE, and re-grant.
drop function if exists public.get_salesman_by_id(uuid);
create function public.get_salesman_by_id(p_id uuid)
returns table(id uuid, full_name text, avatar_url text, dealership text, site_name text,
  brand_color text, slug text, subdomain text, whatsapp_number text, dealer_id uuid,
  bio text, city text, state text, facebook text, website text, is_verified boolean,
  deposit_policy text, deposit_terms text, processing_fee numeric,
  handles_roadtax_insurance boolean, location text, business_hours text, phone text,
  has_whatsapp boolean, has_phone boolean)
language sql stable security definer
set search_path to 'public'
as $function$
  SELECT
    id, full_name, avatar_url, dealership, site_name, brand_color, slug,
    subdomain, NULL::text, dealer_id, bio, city, state, facebook, website,
    COALESCE(is_verified, false) AS is_verified,
    deposit_policy, deposit_terms, processing_fee,
    handles_roadtax_insurance, location, business_hours, NULL::text,
    nullif(btrim(whatsapp_number), '') IS NOT NULL,
    nullif(btrim(phone), '') IS NOT NULL
  FROM profiles
  WHERE id = p_id
    AND role = 'salesman'
    AND is_active = true
  LIMIT 1;
$function$;

drop function if exists public.get_dealer_profile_by_id(uuid);
create function public.get_dealer_profile_by_id(p_dealer_id uuid)
returns table(id uuid, dealership text, city text, state text, location text, site_name text,
  slug text, subdomain text, whatsapp_number text, avatar_url text, site_logo_url text,
  is_verified boolean, ssm_number text, postcode text, business_hours text, phone text,
  stat_years integer, verified_at timestamptz, created_at timestamptz,
  deposit_policy text, deposit_terms text, handles_roadtax_insurance boolean,
  processing_fee numeric, has_whatsapp boolean, has_phone boolean)
language sql stable security definer
set search_path to 'public'
as $function$
  SELECT id, dealership, city, state, location, site_name,
         slug, subdomain, NULL::text, avatar_url, site_logo_url, is_verified,
         ssm_number, postcode, business_hours, NULL::text,
         stat_years, verified_at, created_at,
         deposit_policy, deposit_terms, handles_roadtax_insurance,
         processing_fee,
         nullif(btrim(whatsapp_number), '') IS NOT NULL,
         nullif(btrim(phone), '') IS NOT NULL
  FROM profiles
  WHERE id = p_dealer_id
    AND role IN ('dealer', 'owner', 'superadmin')
    AND is_active = true
    AND account_status IS DISTINCT FROM 'deleted';
$function$;

drop function if exists public.get_salesman_by_slug(text);
create function public.get_salesman_by_slug(p_slug text)
returns table(id uuid, full_name text, avatar_url text, cover_url text, dealership text,
  site_name text, brand_color text, slug text, subdomain text, whatsapp_number text,
  dealer_id uuid, bio text, city text, state text, location text, facebook text,
  website text, instagram text, tiktok text, job_title text, about_text text,
  response_time text, specializations text[], is_verified boolean, seller_type text,
  has_whatsapp boolean)
language sql stable security definer
set search_path to 'public'
as $function$
  SELECT
    id, full_name, avatar_url, cover_url, dealership, site_name, brand_color,
    slug, subdomain, NULL::text, dealer_id, bio, city, state, location,
    facebook, website, instagram, tiktok, job_title, about_text, response_time,
    specializations,
    COALESCE(is_verified, false) AS is_verified,
    seller_type,
    coalesce(nullif(btrim(whatsapp_number), ''), nullif(btrim(phone), '')) IS NOT NULL
  FROM profiles
  WHERE slug = p_slug
    AND role = 'salesman'
    AND (is_active = true OR approval_status = 'pending')
    AND suspended_at IS NULL
    AND COALESCE(account_status, 'active') <> 'deleted'
    AND deleted_at IS NULL
  LIMIT 1;
$function$;

revoke all on function public.get_salesman_by_id(uuid) from public;
revoke all on function public.get_dealer_profile_by_id(uuid) from public;
revoke all on function public.get_salesman_by_slug(text) from public;
grant execute on function public.get_salesman_by_id(uuid) to anon, authenticated, service_role;
grant execute on function public.get_dealer_profile_by_id(uuid) to anon, authenticated, service_role;
grant execute on function public.get_salesman_by_slug(text) to anon, authenticated, service_role;

-- 3. The one-request bulk leak: blank the number columns on the view ---------
-- Same names/types/order, so CREATE OR REPLACE keeps the view and its grants.
-- No client reads these columns (analytics.js reads id, DealerSlugRedirect and
-- og.js read subdomain).
create or replace view public.public_dealer_profiles as
 SELECT id, slug, subdomain, custom_domain, dealership, site_name, site_logo_url,
    logo_url, brand_color, font_choice, hero_title, hero_subtitle, hero_cta_text,
    about_text,
    NULL::text AS whatsapp_number,
    location, city, state, social_tiktok, social_instagram, social_facebook,
    announcement_bar, announcement_bar_enabled, storefront_why, storefront_how,
    storefront_testimonials, storefront_cta, hero_video_url, hero_video_title,
    hero_video_enabled, avatar_url, watermark_text, is_active,
    NULL::text AS contact_whatsapp,
    CASE WHEN role = 'superadmin'::text THEN email ELSE NULL::text END AS email,
    CASE WHEN role = 'superadmin'::text THEN phone ELSE NULL::text END AS phone
   FROM profiles
  WHERE role = ANY (ARRAY['dealer'::text, 'owner'::text, 'superadmin'::text])
    AND is_active = true
    AND account_status IS DISTINCT FROM 'deleted'::text;
