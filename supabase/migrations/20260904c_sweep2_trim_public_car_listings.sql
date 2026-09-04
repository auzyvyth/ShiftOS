-- SWEEP-2. public_car_listings is the ONE anon-facing view. Four columns on it
-- have no consumer anywhere (checked every .from('public_car_listings') call in
-- src/, every api/ handler, every edge function, pg_depend for dependent views
-- and pg_proc for functions returning its row type). Removing a column needs
-- DROP + CREATE (CREATE OR REPLACE can only append), which drops every grant,
-- so they go in ONE migration rather than paying that risk once per column.
--
--   car_documents          -- a jsonb_agg of {type}. document_types already says
--                             the same thing and is what CarDetailPage/ComparePage
--                             read; CarDetailPage rebuilds this shape client-side
--                             from document_types (CarDetailPage.jsx:1232).
--   included_services_cost -- a hardcoded NULL::numeric. The dealer's COST, never
--                             a public fact; the column was already neutered.
--   plate_number           -- the car's registration plate, published to anon.
--   vin                    -- legacy/duplicate of vin_number. vin_number is the
--                             one that renders ("Chassis No."); this one is read
--                             by nothing.
--
-- get_salesman_featured_listings RETURNS SETOF this view, so it holds a hard
-- dependency on the row type and must be dropped and recreated around it. Its
-- body is SELECT pcl.*, so it follows the new column set with no edit.
-- Grants on BOTH objects are re-asserted explicitly below, never copied off the
-- old object.
drop function if exists public.get_salesman_featured_listings(uuid);
drop view if exists public.public_car_listings;

create view public.public_car_listings as
 select cl.id,
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
    ( select coalesce(array_agg(distinct d.value ->> 'type'), array[]::text[])
        from jsonb_array_elements(
             case when jsonb_typeof(cl.car_documents) = 'array'
                  then cl.car_documents else '[]'::jsonb end) d(value)) as document_types,
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
    ( select pr.role from profiles pr where pr.id = cl.dealer_id) as seller_role,
    cl.sambung_monthly,
    cl.sambung_months_left,
    cl.sambung_balance,
    cl.sambung_deposit,
    cl.sambung_bank,
    ( select pr.is_verified from profiles pr where pr.id = cl.dealer_id) as dealer_is_verified,
    cl.docs_verified,
    cl.geran_status,
    cl.condition_declared_at,
    cl.original_price is not null and cl.original_price > 0::numeric
      and cl.selling_price is not null and cl.selling_price > 0::numeric
      and cl.selling_price <= (cl.original_price * 0.97) as is_hot_deal,
    coalesce(ss.sold_count, 0) as seller_sold_count
   from car_listings cl
     left join market_price_stats mp
       on lower(cl.brand) = mp.brand_key
      and lower(cl.model) = mp.model_key
      and floor(cl.year::numeric / 3::numeric) = mp.yr_bucket
     left join lateral ( select s.puspakom_b5_date, s.puspakom_b7_date
                           from stock_units s
                          where s.listing_id = cl.id
                          order by s.created_at desc
                          limit 1) su on true
     left join seller_public_stats ss on ss.seller_id = cl.dealer_id
  where (cl.status = any (array['active','available','reserved','sold']))
    and not (exists ( select 1 from profiles pr
                       where pr.id = cl.dealer_id
                         and (pr.is_active = false or pr.account_status = 'deleted')));

-- The view is not auto-updatable (aggregates, subqueries, a LATERAL join), so
-- the INSERT/UPDATE/DELETE/TRUNCATE the old object carried for service_role
-- could never have functioned; they are deliberately not restored. Read is all
-- this surface is for.
revoke all on public.public_car_listings from public, anon, authenticated, service_role;
grant select on public.public_car_listings to anon, authenticated, service_role;

create function public.get_salesman_featured_listings(p_salesman_id uuid)
returns setof public.public_car_listings
language sql
stable
security definer
set search_path to 'public'
as $function$
  select pcl.*
  from public_car_listings pcl
  join salesman_listings sl on sl.listing_id = pcl.id
  where sl.salesman_id = p_salesman_id
    and pcl.status in ('available', 'reserved')
  order by pcl.created_at desc;
$function$;

-- Anon EXECUTE is correct here: the salesman mini page is public and this only
-- returns cars already readable on the view above. Granted explicitly, and
-- revoked from public first so no privilege is inherited rather than intended.
revoke all on function public.get_salesman_featured_listings(uuid) from public;
grant execute on function public.get_salesman_featured_listings(uuid) to anon, authenticated, service_role;
