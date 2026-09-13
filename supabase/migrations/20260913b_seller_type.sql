-- Buyers currently see a binary Agent/Dealer badge (role='salesman' -> Agent,
-- everything else -> Dealer). That collapses two very different standalone
-- sellers into one label: a private individual selling their own car, and a
-- broker/agent who sells for others. seller_type distinguishes them.
--
-- A salesman linked to a real dealer (dealer_id set) is NOT covered by this
-- column on purpose -- that identity ("Salesman at <dealership>") is already
-- fully derivable from dealer_id + the dealer's own profile, verified by the
-- dealer's own invite (create-salesman), and must stay that way: letting a
-- self-signup salesman just type a dealership name here would be an
-- unverified claim shown to buyers as fact.
--
-- Existing standalone salesman rows default to 'broker' -- that is the
-- framing the product has always used for them (commission-first dashboards,
-- "Agent" badge), so nothing changes for anyone who already signed up.
alter table profiles
  add column if not exists seller_type text check (seller_type in ('private','broker'));

update profiles
set seller_type = 'broker'
where role = 'salesman' and dealer_id is null and seller_type is null;

-- Appended column only -- existing columns/order untouched (CREATE OR REPLACE
-- VIEW can only append; see CLAUDE.md's DB migrations notes on this view).
create or replace view public_car_listings as
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
