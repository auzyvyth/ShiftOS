-- Mask the chassis / VIN number on the PUBLIC car view (DMS-AUDIT part 1).
--
-- public_car_listings is the only public read path for cars (anon + authenticated
-- can SELECT it, it runs as its owner). It returned cl.vin_number raw: the car
-- page masks it on screen (src/utils/maskVin.js), but the full number shipped to
-- every visitor's browser and could be scraped.
--
-- Now the view returns the SAME mask the page draws: the last 6 characters (the
-- production serial) become '••••••', a value of 6 characters or fewer is all
-- dots, blank becomes NULL. maskVin() on an already-masked value returns it
-- unchanged, so the car page renders identically before and after this runs.
--
-- Only the vin_number expression changes. Column name, type (text) and position
-- (26) are identical, so CREATE OR REPLACE works with no DROP: the grants
-- (anon=r, authenticated=r, service_role) and the row type that
-- get_salesman_featured_listings(uuid) RETURNS SETOF stay as they are. No grant
-- statements needed.
--
-- Seller panels, the dealer dashboard and the console read car_listings
-- directly (RLS-scoped), not this view, so they keep the full number.
--
-- Body below is pg_get_viewdef of the live view on 2026-11-09, unchanged except
-- vin_number.

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
    (CASE
        WHEN NULLIF(btrim(cl.vin_number, E' \t\r\n'), '') IS NULL THEN NULL
        WHEN length(btrim(cl.vin_number, E' \t\r\n')) <= 6 THEN repeat('•', length(btrim(cl.vin_number, E' \t\r\n')))
        ELSE left(btrim(cl.vin_number, E' \t\r\n'), -6) || '••••••'
    END)::text AS vin_number,
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
          WHERE pr.id = cl.dealer_id) AS seller_type,
    cl.new_car_model_id IS NOT NULL AND NOT COALESCE(cl.new_car_unit, false) AS is_model_card,
    cl.stock_photos
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
