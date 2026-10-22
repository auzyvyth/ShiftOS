-- NEWCAR-2: platform photos per model + "tick the models you sell" at signup
-- (owner, 2026-10-22). Reverses the 2026-10-08 "an advisor's page starts EMPTY"
-- rule: a new-car advisor now ticks the models they sell and gets a card for
-- each, carrying photos the platform uploaded (console > New car prices).
--
--   new_car_model_media   one row per (brand, model): the photos. Superadmin-write.
--   car_listings.stock_photos
--                         true = the card still shows the platform's photos.
--                         Such a card shows on the seller's mini page and the
--                         /new-cars model page, but NOT in the showroom grid
--                         (owner's pick): twenty advisors would otherwise put
--                         twenty identical cards of one model in the grid. The
--                         grid filters stock_photos = false (CarListingPage,
--                         api/shell.js, api/og.js). The flag drops the moment
--                         the seller changes the card's photos.
--   new_car_add_cards()   the ONE way such a card is made. The client cannot
--                         set stock_photos itself (trigger below).
--
-- A console photo change re-syncs every card still on stock photos.
-- One migration, one schema reload. Apply after midnight MYT, nobody live.
-- Ship BEFORE the frontend: the grid filters on a column this adds.
begin;

-- 1. The flag -----------------------------------------------------------------
alter table public.car_listings
  add column if not exists stock_photos boolean not null default false;

-- 2. Photos per model -------------------------------------------------------------
create table if not exists public.new_car_model_media (
  brand      text not null,
  model      text not null,
  images     text[] not null check (cardinality(images) between 1 and 12),
  updated_at timestamptz not null default now(),
  primary key (brand, model)
);
alter table public.new_car_model_media enable row level security;

drop policy if exists new_car_model_media_read on public.new_car_model_media;
create policy new_car_model_media_read on public.new_car_model_media
  for select to anon, authenticated using (true);
drop policy if exists new_car_model_media_insert on public.new_car_model_media;
create policy new_car_model_media_insert on public.new_car_model_media
  for insert to authenticated with check (is_superadmin());
drop policy if exists new_car_model_media_update on public.new_car_model_media;
create policy new_car_model_media_update on public.new_car_model_media
  for update to authenticated using (is_superadmin()) with check (is_superadmin());
drop policy if exists new_car_model_media_delete on public.new_car_model_media;
create policy new_car_model_media_delete on public.new_car_model_media
  for delete to authenticated using (is_superadmin());

revoke all on public.new_car_model_media from public, anon, authenticated;
grant select on public.new_car_model_media to anon, authenticated;
grant insert, update, delete on public.new_car_model_media to authenticated;

-- 3. A console photo change follows onto every card still on stock photos -------
create or replace function public.new_car_media_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  perform set_config('app.stock_sync', 'on', true);
  update car_listings cl
     set images = new.images
   where cl.stock_photos and not cl.new_car_unit
     and cl.brand = new.brand and cl.model = new.model
     and cl.images is distinct from new.images;
  perform set_config('app.stock_sync', '', true);
  return new;
end $$;

drop trigger if exists trg_new_car_media_sync on public.new_car_model_media;
create trigger trg_new_car_media_sync
  before insert or update on public.new_car_model_media
  for each row execute function public.new_car_media_sync();

-- 4. stock_photos is server-set, and drops when the seller changes the photos ---
create or replace function public.new_car_stock_photos_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.stock_photos then
    if tg_op = 'INSERT' or not old.stock_photos then
      -- Only new_car_add_cards may switch it on.
      if coalesce(current_setting('app.stock_cards', true), '') <> 'on' then
        new.stock_photos := false;
      end if;
    elsif new.images is distinct from old.images
          and coalesce(current_setting('app.stock_sync', true), '') <> 'on' then
      new.stock_photos := false;  -- the seller's own photos: a normal card now
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_new_car_stock_photos on public.car_listings;
create trigger trg_new_car_stock_photos
  before insert or update on public.car_listings
  for each row execute function public.new_car_stock_photos_guard();

-- 5. Tick the models you sell -> one card each -----------------------------------
-- Results per model: added | already_listed | no_photos | unavailable |
-- no_price_for_area | error. A failed model never blocks the others.
create or replace function public.new_car_add_cards(p_models text[])
returns table (model text, result text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  p profiles%rowtype;
  v_dealer uuid;
  v_model text;
  v_imgs text[];
  v_mid uuid;
  v_price numeric;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not_signed_in';
  end if;
  select * into p from profiles where id = v_uid;
  if p.new_car_brand is null then raise exception 'new_car_no_brand'; end if;
  v_dealer := get_my_dealer_id();

  for v_model in
    select distinct m from unnest(coalesce(p_models, '{}')) m where btrim(m) <> '' limit 30
  loop
    model := v_model;
    select images into v_imgs from new_car_model_media mm
     where mm.brand = p.new_car_brand and mm.model = v_model;
    select id, price_peninsular into v_mid, v_price from new_car_models nm
     where nm.brand = p.new_car_brand and nm.model = v_model and nm.is_active
     order by nm.price_peninsular limit 1;

    if v_imgs is null then result := 'no_photos';
    elsif v_mid is null then result := 'unavailable';
    elsif exists (select 1 from car_listings c
                   where c.dealer_id = v_dealer and c.brand = p.new_car_brand and c.model = v_model
                     and c.new_car_model_id is not null and not c.new_car_unit
                     and c.status <> all (array['sold','archived'])) then
      result := 'already_listed';
    else
      begin
        perform set_config('app.stock_cards', 'on', true);
        -- Price, variant, specs and slug are set by new_car_card_fill.
        insert into car_listings (dealer_id, assigned_to, new_car_model_id, brand, model,
                                  selling_price, condition, state, city, status, images, stock_photos)
        values (v_dealer, v_uid, v_mid, p.new_car_brand, v_model,
                v_price, 'new', p.state, p.city, 'available', v_imgs, true);
        perform set_config('app.stock_cards', '', true);
        result := 'added';
      exception
        when unique_violation then result := 'already_listed';
        when others then
          result := case when sqlerrm = 'new_car_no_price_for_zone' then 'no_price_for_area' else 'error' end;
      end;
    end if;
    return next;
  end loop;
end $$;

revoke all on function public.new_car_add_cards(text[]) from public, anon;
grant execute on function public.new_car_add_cards(text[]) to authenticated;

-- 6. Expose the flag to the grids (append-only, grants kept) ----------------------
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

commit;
