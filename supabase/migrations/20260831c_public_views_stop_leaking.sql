-- SEC-VIEW. The two public views published more than the public needs.
--
-- Both are SECURITY DEFINER by design (20260830a explains why), so every column
-- listed in them is readable by anon in bulk, in one request, with none of the
-- per-listing throttling api/call-number.js and middleware.js provide. Two
-- comments in the app claim the opposite ("the view is security_invoker and
-- anon RLS returns no rows" — useCTAContext.js:48, useTenant.js:141); that was
-- true once and is not true now. Verified live as role anon.
--
-- 1. public_dealer_profiles handed out every dealer's EMAIL and PHONE.
--    `select=email,phone,whatsapp_number` returned the lot in a single call,
--    which is precisely the harvesting api/call-number.js was built to prevent
--    ("a number rendered or fetched on page load is scrapeable"). whatsapp_number
--    stays: it is the wa.me deep link the storefront is built around, so it is
--    public by design. subscription_status goes too — whether a dealer is on
--    trial, active or expired is nobody else's business.
--
--    The only consumer of email/phone is the site footer, and only for one
--    designated platform-contact row, so those two columns answer for that row
--    alone and return NULL for every dealer. (The exact guard is corrected in
--    20260831d — the id the footer uses is not actually a superadmin row.)
drop view if exists public.public_dealer_profiles;
create view public.public_dealer_profiles as
  select id, slug, subdomain, custom_domain, dealership, site_name,
         site_logo_url, logo_url, brand_color, font_choice,
         hero_title, hero_subtitle, hero_cta_text, about_text,
         whatsapp_number, location, city, state,
         social_tiktok, social_instagram, social_facebook,
         announcement_bar, announcement_bar_enabled,
         storefront_why, storefront_how, storefront_testimonials, storefront_cta,
         hero_video_url, hero_video_title, hero_video_enabled,
         avatar_url, watermark_text, is_active,
         whatsapp_number as contact_whatsapp,
         -- The footer prints the PLATFORM's own support contact, so those two
         -- fields answer for the superadmin row and are NULL for every dealer.
         -- Keeping the column names means the deployed footer keeps working
         -- unchanged while `select=email,phone` stops being a mailing list.
         case when role = 'superadmin' then email else null end as email,
         case when role = 'superadmin' then phone else null end as phone
    from profiles
   where role = any (array['dealer','owner','superadmin'])
     and is_active = true
     and account_status is distinct from 'deleted';

-- Grants are written out deliberately rather than carried over: 20260830a is
-- the record of what happens when a view is recreated and its old grants come
-- along for the ride.
revoke all on public.public_dealer_profiles from anon, authenticated, public;
grant select on public.public_dealer_profiles to anon, authenticated;

-- 2. public_car_listings published car_documents, which is a list of URLs into
--    the PUBLIC car-images bucket. Real rows hold registration_card (the geran:
--    registered owner's full name, IC number and address), loan_clearance (bank,
--    account, outstanding balance), puspakom and service_history. Anyone could
--    read every listing's document URLs in bulk and fetch the files, no account
--    needed — and CarDetailPage rendered the geran inline with a Download button
--    to anonymous visitors.
--
--    The buyer-facing point of that section is "this car has a geran on file",
--    not the scan itself, so the view now publishes the TYPES present and no
--    URLs. Sellers and the platform console read car_listings directly and are
--    unaffected.
--
--    included_services_cost goes too: it is the dealer's COST for the included
--    services (fetchPnl subtracts it from front gross), and the public page was
--    printing it to buyers as "Total value included at no extra cost".
-- get_salesman_featured_listings is RETURNS SETOF public_car_listings, so its
-- return type IS the view's rowtype and it has to be dropped and rebuilt with
-- the view. Grants are restated rather than assumed.
drop function if exists public.get_salesman_featured_listings(uuid);
drop view if exists public.public_car_listings;
create view public.public_car_listings as
  select cl.id, cl.brand, cl.model, cl.variant, cl.year, cl.state, cl.mileage,
         cl.colour, cl.condition, cl.registration_date, cl.specs, cl.options,
         cl.features, cl.base_price, cl.selling_price, cl.images, cl.created_at,
         cl.transmission, cl.city, cl.body_type, cl.fuel_type, cl.status,
         cl.engine_cc, cl.previous_price, cl.original_price, cl.dealer_id,
         cl.vin_number, cl.auction_grade, cl.interior_grade, cl.is_recon,
         cl.import_country, cl.damage_map, cl.local_reg_date, cl.auction_house,
         cl.chassis_status, cl.assigned_to, cl.slug, cl.plate_number,
         cl.video_url, cl.salesman_slug,
         (select coalesce(array_agg(distinct d->>'type'), array[]::text[])
            from jsonb_array_elements(
              case when jsonb_typeof(cl.car_documents) = 'array'
                   then cl.car_documents else '[]'::jsonb end) d
         ) as document_types,
         -- car_documents is KEPT as a column name, stripped to types only, so
         -- the currently-deployed CarDetailPage keeps resolving its select
         -- while the URLs stop being published the moment this lands. Once the
         -- frontend reads document_types this column can go.
         (select coalesce(jsonb_agg(jsonb_build_object('type', d->>'type')), '[]'::jsonb)
            from jsonb_array_elements(
              case when jsonb_typeof(cl.car_documents) = 'array'
                   then cl.car_documents else '[]'::jsonb end) d
         ) as car_documents,
         cl.previous_owners, cl.road_tax_expiry, cl.loan_eligible,
         cl.warranty_months, cl.deposit_amount, cl.ai_captions,
         cl.financing_type, cl.payment_type, cl.dealer_perks,
         cl.canonical_variant, cl.description, cl.included_services,
         -- kept as a NULL column for the same reason: the deployed page
         -- selects it, and `> 0` on null simply renders nothing.
         null::numeric as included_services_cost,
         cl.vin, cl.horsepower, cl.doors, cl.seats, cl.co2_emissions,
         cl.fuel_consumption, cl.insurance_group, cl.acceleration,
         cl.top_speed, cl.boot_size, cl.safety_rating, cl.cylinders,
         mp.market_avg_price, mp.market_sample_count,
         su.puspakom_b5_date, su.puspakom_b7_date,
         (select pr.role from profiles pr where pr.id = cl.dealer_id) as seller_role,
         cl.sambung_monthly, cl.sambung_months_left, cl.sambung_balance,
         cl.sambung_deposit, cl.sambung_bank,
         (select pr.is_verified from profiles pr where pr.id = cl.dealer_id) as dealer_is_verified,
         cl.docs_verified, cl.geran_status, cl.condition_declared_at
    from car_listings cl
    left join market_price_stats mp
      on lower(cl.brand) = mp.brand_key
     and lower(cl.model) = mp.model_key
     and floor(cl.year::numeric / 3::numeric) = mp.yr_bucket
    left join lateral (
      select s.puspakom_b5_date, s.puspakom_b7_date
        from stock_units s
       where s.listing_id = cl.id
       order by s.created_at desc
       limit 1
    ) su on true
   where cl.status = any (array['active','available','reserved','sold'])
     and not exists (
       select 1 from profiles pr
        where pr.id = cl.dealer_id
          and (pr.is_active = false or pr.account_status = 'deleted')
     );

revoke all on public.public_car_listings from anon, authenticated, public;
grant select on public.public_car_listings to anon, authenticated;

create function public.get_salesman_featured_listings(p_salesman_id uuid)
returns setof public.public_car_listings
language sql
stable security definer
set search_path to 'public'
as $function$
  SELECT pcl.*
  FROM public_car_listings pcl
  JOIN salesman_listings sl ON sl.listing_id = pcl.id
  WHERE sl.salesman_id = p_salesman_id
    AND pcl.status IN ('available', 'reserved')
  ORDER BY pcl.created_at DESC;
$function$;

revoke all on function public.get_salesman_featured_listings(uuid) from public;
grant execute on function public.get_salesman_featured_listings(uuid) to anon, authenticated;
