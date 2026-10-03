-- Remove Sambung Bayar from the schema entirely.
--
-- Sambung Bayar (car loan takeover) is a criminal offence under s.38 of the
-- Hire Purchase Act 1967 (CLAUDE.md, "Legal subjects"). The feature was taken
-- out of CarForm and the filters on 2026-09-14, but its five columns stayed on
-- car_listings AND on the anon-readable public_car_listings view. Checked
-- 2026-10-03: 0 rows hold any value in them (and 0 in _bk_airy_cars, which is
-- a backup snapshot and is left as it is).
--
-- Order matters:
--  1. get_salesman_featured_listings RETURNS SETOF public_car_listings, a hard
--     dependency on the view's row type, so it is dropped first and recreated
--     after (body unchanged; `select pcl.*` follows the new column set).
--  2. A view can only lose columns by DROP + CREATE, which drops its grants, so
--     they are re-asserted explicitly below (read from relacl, not copied).
--  3. The base columns go last.
-- The definition below is the live one (pg_get_viewdef, 2026-10-03) minus the
-- five sambung_* lines. Nothing else changes.
--
-- The frontend stopped writing these columns (CarForm.jsx) in the same release,
-- and must ship BEFORE this runs: a save that names a dropped column fails.

drop function if exists public.get_salesman_featured_listings(uuid);
drop view public.public_car_listings;

create view public.public_car_listings as
 SELECT cl.id,
    cl.brand,
    cl.model,
    cl.variant,
    cl.year,
    cl.state,
    cl.mileage,
    cl.colour,
    cl.condition,
    cl.registration_date,
    cl.specs,
    cl.options,
    cl.features,
    cl.base_price,
    cl.selling_price,
    cl.images,
    cl.created_at,
    cl.transmission,
    cl.city,
    cl.body_type,
    cl.fuel_type,
    cl.status,
    cl.engine_cc,
    cl.previous_price,
    cl.original_price,
    cl.dealer_id,
    cl.vin_number,
    cl.auction_grade,
    cl.interior_grade,
    cl.is_recon,
    cl.import_country,
    cl.damage_map,
    cl.local_reg_date,
    cl.auction_house,
    cl.chassis_status,
    cl.assigned_to,
    cl.slug,
    cl.video_url,
    cl.salesman_slug,
    ( SELECT COALESCE(array_agg(DISTINCT d.value ->> 'type'::text), ARRAY[]::text[]) AS "coalesce"
           FROM jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(cl.car_documents) = 'array'::text THEN cl.car_documents
                    ELSE '[]'::jsonb
                END) d(value)) AS document_types,
    cl.previous_owners,
    cl.road_tax_expiry,
    cl.loan_eligible,
    cl.warranty_months,
    cl.deposit_amount,
    cl.ai_captions,
    cl.financing_type,
    cl.payment_type,
    cl.dealer_perks,
    cl.canonical_variant,
    cl.description,
    cl.included_services,
    cl.horsepower,
    cl.doors,
    cl.seats,
    cl.co2_emissions,
    cl.fuel_consumption,
    cl.insurance_group,
    cl.acceleration,
    cl.top_speed,
    cl.boot_size,
    cl.safety_rating,
    cl.cylinders,
    mp.market_avg_price,
    mp.market_sample_count,
    su.puspakom_b5_date,
    su.puspakom_b7_date,
    ( SELECT pr.role
           FROM profiles pr
          WHERE pr.id = cl.dealer_id) AS seller_role,
    ( SELECT pr.is_verified
           FROM profiles pr
          WHERE pr.id = cl.dealer_id) AS dealer_is_verified,
    cl.docs_verified,
    cl.geran_status,
    cl.condition_declared_at,
    cl.original_price IS NOT NULL AND cl.original_price > 0::numeric AND cl.selling_price IS NOT NULL AND cl.selling_price > 0::numeric AND cl.selling_price <= (cl.original_price * 0.97) AS is_hot_deal,
    COALESCE(ss.sold_count, 0) AS seller_sold_count,
    cl.listing_title,
    cl.specs_overridden,
    ( SELECT pr.seller_type
           FROM profiles pr
          WHERE pr.id = cl.dealer_id) AS seller_type
   FROM car_listings cl
     LEFT JOIN market_price_stats mp ON lower(cl.brand) = mp.brand_key AND lower(cl.model) = mp.model_key AND floor(cl.year::numeric / 3::numeric) = mp.yr_bucket
     LEFT JOIN LATERAL ( SELECT s.puspakom_b5_date,
            s.puspakom_b7_date
           FROM stock_units s
          WHERE s.listing_id = cl.id
          ORDER BY s.created_at DESC
         LIMIT 1) su ON true
     LEFT JOIN seller_public_stats ss ON ss.seller_id = cl.dealer_id
  WHERE (cl.status = ANY (ARRAY['active'::text, 'available'::text, 'reserved'::text, 'sold'::text])) AND NOT (EXISTS ( SELECT 1
           FROM profiles pr
          WHERE pr.id = cl.dealer_id AND (pr.is_active = false OR pr.account_status = 'deleted'::text)));

-- Grants as they were (relacl 2026-10-03): read-only for the API roles.
revoke all on public.public_car_listings from public;
grant select on public.public_car_listings to anon, authenticated, service_role;

create function public.get_salesman_featured_listings(p_salesman_id uuid)
returns setof public.public_car_listings
language sql
stable security definer
set search_path to 'public'
as $function$
  select pcl.*
  from public_car_listings pcl
  join salesman_listings sl on sl.listing_id = pcl.id
  where sl.salesman_id = p_salesman_id
    and pcl.status in ('available', 'reserved')
  order by pcl.created_at desc;
$function$;

-- proacl 2026-10-03: anon, authenticated, service_role; PUBLIC already revoked.
revoke all on function public.get_salesman_featured_listings(uuid) from public;
grant execute on function public.get_salesman_featured_listings(uuid) to anon, authenticated, service_role;

alter table public.car_listings
  drop column sambung_monthly,
  drop column sambung_months_left,
  drop column sambung_balance,
  drop column sambung_deposit,
  drop column sambung_bank;
