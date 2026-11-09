-- DMS Tier 0 security tightening (2026-11-09). ONE migration = ONE API freeze.
-- Apply only 00:00-09:00 MYT with seller_live_state empty (CLAUDE.md DB rule).
-- Test first: run this whole file inside begin; ... rollback; then the probes at the bottom.
-- Pre-checked against live data 2026-11-08: 0 cross-dealer leads, 0 task/customer dealer mismatches.

begin;

-- 1. Public car view: remove the seller's cost price (base_price). ---------------------
-- get_salesman_featured_listings RETURNS SETOF the view's row type, so it must go first.
drop function if exists public.get_salesman_featured_listings(uuid);
drop view if exists public.public_car_listings;

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

revoke all on public.public_car_listings from public, anon, authenticated;
grant select on public.public_car_listings to anon, authenticated;
grant all on public.public_car_listings to service_role;

create function public.get_salesman_featured_listings(p_salesman_id uuid)
 returns setof public.public_car_listings
 language sql stable security definer
 set search_path to 'public'
as $$
  select pcl.*
    from public_car_listings pcl
    join salesman_listings sl on sl.listing_id = pcl.id
   where sl.salesman_id = p_salesman_id
     and pcl.status in ('available', 'reserved')
   order by pcl.created_at desc;
$$;
revoke all on function public.get_salesman_featured_listings(uuid) from public;
grant execute on function public.get_salesman_featured_listings(uuid) to anon, authenticated, service_role;

-- 2. Handover steps: a step must belong to a lead the caller can work. -----------------
create or replace function public.guard_post_sale_task_owner()
 returns trigger language plpgsql security definer
 set search_path to 'pg_catalog', 'public'
as $$
begin
  if auth.uid() is null or public.is_superadmin() then
    return new;                                   -- server / cron / platform paths
  end if;
  if tg_op = 'UPDATE'
     and new.lead_id is not distinct from old.lead_id
     and new.dealer_id is not distinct from old.dealer_id then
    return new;                                   -- ticking a step: nothing structural changed
  end if;
  if not exists (
    select 1 from public.leads l
     where l.id = new.lead_id
       and l.dealer_id is not distinct from new.dealer_id
       and (l.salesman_id = auth.uid()
            or l.dealer_id = public.get_my_dealer_id()
            or l.dealer_id = auth.uid())
  ) then
    raise exception 'post_sale_task_not_yours' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_post_sale_task_owner() from public, anon, authenticated;

drop trigger if exists trg_aa_guard_post_sale_task on public.post_sale_tasks;
create trigger trg_aa_guard_post_sale_task
  before insert or update of lead_id, dealer_id on public.post_sale_tasks
  for each row execute function public.guard_post_sale_task_owner();

-- The expiry fan-out also checks the dealer, so a stray row can never reach another dealer's customer.
create or replace function public.sync_customer_expiry_from_task()
 returns trigger language plpgsql security definer
 set search_path to 'pg_catalog', 'public'
as $$
declare
  v_date date;
begin
  if new.step_key not in ('insurance', 'road_tax') then
    return new;
  end if;
  if new.status is distinct from 'done' then
    return new;
  end if;
  v_date := coalesce(
    new.result_date,
    (coalesce(new.completed_at, now())::date + interval '12 months')::date
  );
  if new.step_key = 'insurance' then
    update customers
       set insurance_expiry = v_date
     where lead_id = new.lead_id
       and dealer_id is not distinct from new.dealer_id
       and (insurance_expiry is null or new.result_date is not null);
  else
    update customers
       set road_tax_expiry = v_date
     where lead_id = new.lead_id
       and dealer_id is not distinct from new.dealer_id
       and (road_tax_expiry is null or new.result_date is not null);
  end if;
  return new;
end;
$$;

-- 3. Leads: a car on a lead must belong to the lead's dealer. ---------------------------
create or replace function public.guard_lead_car_dealer()
 returns trigger language plpgsql security definer
 set search_path to 'pg_catalog', 'public'
as $$
declare
  v_car_dealer uuid;
begin
  if new.car_listing_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.car_listing_id is not distinct from old.car_listing_id then
    return new;
  end if;
  select dealer_id into v_car_dealer from public.car_listings where id = new.car_listing_id;
  if not found then
    return new;                                   -- the foreign key reports a missing car
  end if;
  if new.dealer_id is null then
    -- Old tabs still send manual leads with no dealer: fill it from the car, but only for the car's own side.
    if auth.uid() is null or auth.uid() = v_car_dealer or public.get_my_dealer_id() = v_car_dealer then
      new.dealer_id := v_car_dealer;
      return new;
    end if;
    raise exception 'lead_car_dealer_mismatch' using errcode = '42501';
  end if;
  if new.dealer_id <> v_car_dealer then
    raise exception 'lead_car_dealer_mismatch' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_lead_car_dealer() from public, anon, authenticated;

drop trigger if exists trg_aa_guard_lead_car on public.leads;
create trigger trg_aa_guard_lead_car
  before insert or update of car_listing_id on public.leads
  for each row execute function public.guard_lead_car_dealer();

-- 4. AI usage counter: only record_ai_request() (SECURITY DEFINER) writes it. ------------
drop policy if exists "Dealers can insert own ai_usage" on public.ai_usage;
drop policy if exists "Dealers can update own ai_usage" on public.ai_usage;

-- 5. Loan applications: the salesman's own rows may not name another dealer. -------------
drop policy if exists salesman_own on public.loan_applications;
create policy salesman_own on public.loan_applications
  for all to authenticated
  using (salesman_id = (select auth.uid()))
  with check (
    salesman_id = (select auth.uid())
    and (dealer_id is null
         or dealer_id = (select auth.uid())
         or dealer_id = (select public.get_my_dealer_id()))
  );

commit;

-- ============================ PROBES (run after apply, one per call) ========================
-- a) select has_column_privilege('anon','public.public_car_listings','base_price','select');  -- must error: column gone
--    select count(*) from public.public_car_listings;                                         -- still returns rows
-- b) select oid::regprocedure from pg_proc where proname in
--      ('get_salesman_featured_listings','guard_post_sale_task_owner','guard_lead_car_dealer');  -- one row each
-- c) select policyname from pg_policies where tablename='ai_usage';                           -- select policies only
-- d) as authenticated user (set local role + request.jwt.claims in a DO block that raises at the end):
--      insert a post_sale_tasks row for someone else's lead      -> 42501 post_sale_task_not_yours
--      update a lead of yours to another dealer's car_listing_id -> 42501 lead_car_dealer_mismatch
--      insert loan_applications with another dealer_id           -> RLS violation
-- e) smoke: open /, /showroom, one /s/<slug> page, one car page; add a lead with a car; tick a handover step.
-- ROLLBACK PLAN: view + function bodies are above; re-add base_price after cl.features to restore the old view.
