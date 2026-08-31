-- ONE definition of "hot deal", used by every surface that asks the question.
--
-- There were two, and they disagreed:
--   strict  (>= 3% off)          -- MarketplacePage hero row, CarCard's discount badge
--   loose   (original_price > 0) -- the ?hot_deals=true grid filter on BOTH grids,
--                                   and get_marketplace_stats().hot_deals
-- So the moment a dealer records an original_price, "Hot Deals" would list cars at
-- full price -- or above it -- as deals, while the hero row beside it showed a
-- different set.
--
-- PostgREST cannot compare two columns in a filter, which is why the grids were
-- reduced to the loose test in the first place. Exposing the comparison as a
-- boolean COLUMN on the view fixes that: the filter becomes is_hot_deal=eq.true
-- and there is one place to change the threshold.
--
-- CREATE OR REPLACE VIEW (new column appended last) preserves the existing ACL --
-- anon SELECT, authenticated SELECT -- so no grants are restated here.

create or replace view public.public_car_listings as
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
    cl.plate_number,
    cl.video_url,
    cl.salesman_slug,
    ( SELECT COALESCE(array_agg(DISTINCT d.value ->> 'type'::text), ARRAY[]::text[]) AS "coalesce"
           FROM jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(cl.car_documents) = 'array'::text THEN cl.car_documents
                    ELSE '[]'::jsonb
                END) d(value)) AS document_types,
    ( SELECT COALESCE(jsonb_agg(jsonb_build_object('type', d.value ->> 'type'::text)), '[]'::jsonb) AS "coalesce"
           FROM jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(cl.car_documents) = 'array'::text THEN cl.car_documents
                    ELSE '[]'::jsonb
                END) d(value)) AS car_documents,
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
    NULL::numeric AS included_services_cost,
    cl.vin,
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
    cl.sambung_monthly,
    cl.sambung_months_left,
    cl.sambung_balance,
    cl.sambung_deposit,
    cl.sambung_bank,
    ( SELECT pr.is_verified
           FROM profiles pr
          WHERE pr.id = cl.dealer_id) AS dealer_is_verified,
    cl.docs_verified,
    cl.geran_status,
    cl.condition_declared_at,
    -- THE hot-deal test. Same threshold the hero row and the card badge use.
    (cl.original_price IS NOT NULL
       AND cl.original_price > 0
       AND cl.selling_price IS NOT NULL
       AND cl.selling_price > 0
       AND cl.selling_price <= cl.original_price * 0.97) AS is_hot_deal
   FROM car_listings cl
     LEFT JOIN market_price_stats mp ON lower(cl.brand) = mp.brand_key AND lower(cl.model) = mp.model_key AND floor(cl.year::numeric / 3::numeric) = mp.yr_bucket
     LEFT JOIN LATERAL ( SELECT s.puspakom_b5_date,
            s.puspakom_b7_date
           FROM stock_units s
          WHERE s.listing_id = cl.id
          ORDER BY s.created_at DESC
         LIMIT 1) su ON true
  WHERE (cl.status = ANY (ARRAY['active'::text, 'available'::text, 'reserved'::text, 'sold'::text])) AND NOT (EXISTS ( SELECT 1
           FROM profiles pr
          WHERE pr.id = cl.dealer_id AND (pr.is_active = false OR pr.account_status = 'deleted'::text)));

-- The counter the header/footer use to decide whether to show a "Hot Deals"
-- entry point at all must agree with the filter behind it, or the nav links to
-- an empty page.
create or replace function public.get_marketplace_stats()
 returns table(listings bigint, dealers bigint, hot_deals bigint)
 language sql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  SELECT
    COUNT(*) AS listings,
    COUNT(DISTINCT dealer_id) AS dealers,
    COUNT(*) FILTER (
      WHERE original_price IS NOT NULL AND original_price > 0
        AND selling_price  IS NOT NULL AND selling_price  > 0
        AND selling_price <= original_price * 0.97
    ) AS hot_deals
  FROM car_listings
  WHERE status IN ('available', 'reserved');
$function$;
