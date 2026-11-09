-- 20261109j db hygiene. APPLIED 2026-11-09 06:01 UTC. Three small fixes (a fourth was checked and skipped, see end).
-- The tool wraps this in begin/commit.

-- 1. public_dealer_profiles handed the platform admin's email and phone to anyone who could read the view.
--    Nothing reads them (only DealerSlugRedirect.jsx and api/og.js use the view, and both select `subdomain` only).
--    Same columns, names, types and order as the live view; only the two CASE columns become NULL.
create or replace view public.public_dealer_profiles as
 SELECT id,
    slug,
    subdomain,
    custom_domain,
    dealership,
    site_name,
    site_logo_url,
    logo_url,
    brand_color,
    font_choice,
    hero_title,
    hero_subtitle,
    hero_cta_text,
    about_text,
    NULL::text AS whatsapp_number,
    location,
    city,
    state,
    social_tiktok,
    social_instagram,
    social_facebook,
    announcement_bar,
    announcement_bar_enabled,
    storefront_why,
    storefront_how,
    storefront_testimonials,
    storefront_cta,
    hero_video_url,
    hero_video_title,
    hero_video_enabled,
    avatar_url,
    watermark_text,
    is_active,
    NULL::text AS contact_whatsapp,
    NULL::text AS email,
    NULL::text AS phone
   FROM profiles
  WHERE (role = ANY (ARRAY['dealer'::text, 'owner'::text, 'superadmin'::text])) AND is_active = true AND account_status IS DISTINCT FROM 'deleted'::text;

-- 2. The updated_at trigger function had no fixed search_path (security advisor warning).
--    Its body only does `new.updated_at := now()`, so pg_catalog is all it needs.
alter function public.touch_car_listing_updated_at() set search_path = pg_catalog, public;

-- 3. Deleting an admin's account was blocked if they had resolved a listing report (FK was NO ACTION).
--    resolved_by is nullable, so keep the report and blank who resolved it.
alter table public.listing_reports drop constraint listing_reports_resolved_by_fkey;
alter table public.listing_reports
  add constraint listing_reports_resolved_by_fkey
  foreign key (resolved_by) references public.profiles(id) on delete set null;

-- 4. SKIPPED: market_price_stats + cron job 9. Do NOT drop: the view public_car_listings LEFT JOINs
--    market_price_stats (market_avg_price), so a DROP would fail or break the marketplace.
