-- Block ALL marketplace data belonging to suspended or deleted accounts.
--
-- Signal (single source of truth): profiles.is_active = false.
--   - Suspension flips is_active = false (account_status stays 'active').
--     SuspendedBanner.jsx keys off exactly is_active === false.
--   - Deletion (delete-account edge fn) sets account_status='deleted'
--     AND is_active=false AND deleted_at=now().
-- So `is_active = false` alone covers both cases; account_status='deleted'
-- is kept as an explicit belt-and-suspenders in case a future path marks a
-- row deleted without flipping is_active.
--
-- Before this change only public_car_listings excluded deleted OWNERS (and it
-- missed suspended owners entirely). The salesman accessors
-- (get_salesman_by_slug / get_salesman_by_id) already gated on is_active=true;
-- the three dealer accessors below did not. This unifies all of them.

-- 1) Marketplace car grid + detail page -------------------------------------
CREATE OR REPLACE VIEW public.public_car_listings AS
 SELECT cl.id, cl.brand, cl.model, cl.variant, cl.year, cl.state, cl.mileage,
    cl.colour, cl.condition, cl.registration_date, cl.specs, cl.options,
    cl.features, cl.base_price, cl.selling_price, cl.images, cl.created_at,
    cl.transmission, cl.city, cl.body_type, cl.fuel_type, cl.status,
    cl.engine_cc, cl.previous_price, cl.original_price, cl.dealer_id,
    cl.vin_number, cl.auction_grade, cl.interior_grade, cl.is_recon,
    cl.import_country, cl.damage_map, cl.local_reg_date, cl.auction_house,
    cl.chassis_status, cl.assigned_to, cl.slug, cl.plate_number, cl.video_url,
    cl.salesman_slug, cl.car_documents, cl.previous_owners, cl.road_tax_expiry,
    cl.loan_eligible, cl.warranty_months, cl.deposit_amount, cl.ai_captions,
    cl.financing_type, cl.payment_type, cl.dealer_perks, cl.canonical_variant,
    cl.description, cl.included_services, cl.included_services_cost, cl.vin,
    cl.horsepower, cl.doors, cl.seats, cl.co2_emissions, cl.fuel_consumption,
    cl.insurance_group, cl.acceleration, cl.top_speed, cl.boot_size,
    cl.safety_rating, cl.cylinders,
    mp.market_avg_price, mp.market_sample_count,
    su.puspakom_b5_date, su.puspakom_b7_date,
    ( SELECT pr.role FROM profiles pr WHERE pr.id = cl.dealer_id) AS seller_role,
    cl.sambung_monthly, cl.sambung_months_left, cl.sambung_balance,
    cl.sambung_deposit, cl.sambung_bank,
    ( SELECT pr.is_verified FROM profiles pr WHERE pr.id = cl.dealer_id) AS dealer_is_verified,
    cl.docs_verified
   FROM car_listings cl
     LEFT JOIN market_price_stats mp
       ON lower(cl.brand) = mp.brand_key
      AND lower(cl.model) = mp.model_key
      AND floor(cl.year::numeric / 3::numeric) = mp.yr_bucket
     LEFT JOIN LATERAL ( SELECT s.puspakom_b5_date, s.puspakom_b7_date
           FROM stock_units s
          WHERE s.listing_id = cl.id
          ORDER BY s.created_at DESC
         LIMIT 1) su ON true
  WHERE (cl.status = ANY (ARRAY['active'::text, 'available'::text, 'reserved'::text, 'sold'::text]))
    AND NOT EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = cl.dealer_id
        AND (pr.is_active = false OR pr.account_status = 'deleted')
    );

-- 2) Seller block on the car detail page ------------------------------------
CREATE OR REPLACE FUNCTION public.get_dealer_profile_by_id(p_dealer_id uuid)
 RETURNS TABLE(id uuid, dealership text, city text, state text, location text, site_name text, slug text, subdomain text, whatsapp_number text, avatar_url text, site_logo_url text, is_verified boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, dealership, city, state, location, site_name,
         slug, subdomain, whatsapp_number, avatar_url, site_logo_url, is_verified
  FROM profiles
  WHERE id = p_dealer_id
    AND role IN ('dealer', 'owner', 'superadmin')
    AND is_active = true
    AND account_status IS DISTINCT FROM 'deleted';
$function$;

-- 3) Subdomain storefront entry point ---------------------------------------
CREATE OR REPLACE FUNCTION public.get_dealer_profile_by_subdomain(p_subdomain text)
 RETURNS TABLE(id uuid, dealership text, site_name text, subdomain text, avatar_url text, site_logo_url text, logo_url text, email text, phone text, whatsapp_number text, social_facebook text, social_instagram text, social_tiktok text, location text, city text, state text, about_text text, brand_color text, custom_domain text, slug text, storefront_why jsonb, storefront_how jsonb, storefront_testimonials jsonb, storefront_cta jsonb, hero_title text, hero_subtitle text, hero_cta_text text, announcement_bar text, announcement_bar_enabled boolean, stat_years integer, stat_happy_customers integer, is_verified boolean, business_hours text)
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
    stat_years, stat_happy_customers, is_verified, business_hours
  FROM profiles
  WHERE subdomain = p_subdomain
    AND role = ANY (ARRAY['dealer'::text, 'owner'::text, 'superadmin'::text])
    AND payment_status IS DISTINCT FROM 'pending'
    AND is_active = true
    AND account_status IS DISTINCT FROM 'deleted'
  LIMIT 1;
$function$;

-- 4) Public dealer directory view (footer, slug redirect, analytics, CTA) ----
CREATE OR REPLACE VIEW public.public_dealer_profiles AS
 SELECT id, slug, subdomain, custom_domain, dealership, site_name, site_logo_url,
    logo_url, brand_color, font_choice, hero_title, hero_subtitle, hero_cta_text,
    about_text, whatsapp_number, location, city, state, social_tiktok,
    social_instagram, social_facebook, announcement_bar, announcement_bar_enabled,
    storefront_why, storefront_how, storefront_testimonials, storefront_cta,
    hero_video_url, hero_video_title, hero_video_enabled, avatar_url,
    watermark_text, is_active, subscription_status,
    whatsapp_number AS contact_whatsapp, email, phone
   FROM profiles
  WHERE role = ANY (ARRAY['dealer'::text, 'owner'::text, 'superadmin'::text])
    AND is_active = true
    AND account_status IS DISTINCT FROM 'deleted';

GRANT SELECT ON public.public_dealer_profiles TO anon, authenticated;
