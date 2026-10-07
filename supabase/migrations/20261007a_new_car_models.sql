-- NEWCAR-1: new-car sales advisors (Proton / Perodua / Toyota).
--
-- A new car is not stock: the brand sets one price per variant per zone, and
-- every advisor sells the same car. So the catalogue is ONE platform-maintained
-- table (superadmin-edited, never copied into car_listings), and an advisor
-- only ticks which variants they sell. When a brand changes a price we edit one
-- row and every advisor's page is right.
--
-- Price zones (checked 2026-10-07): Peninsular, Sabah/Sarawak (usually
-- +RM2,000), Labuan and Langkawi (duty-free). The zone is derived from the
-- seller's state/city in ONE function, new_car_price_zone(). A zone with no
-- price entered returns NULL -- never fall back to the Peninsular number, that
-- would show an East Malaysia buyer a price they cannot get.

-- 1. Seller type + brand ---------------------------------------------------
alter table public.profiles drop constraint if exists profiles_seller_type_check;
alter table public.profiles add constraint profiles_seller_type_check
  check (seller_type = any (array['private','broker','new_car']));

alter table public.profiles add column if not exists new_car_brand text;
alter table public.profiles drop constraint if exists profiles_new_car_brand_check;
alter table public.profiles add constraint profiles_new_car_brand_check
  check (new_car_brand is null or new_car_brand = any (array['Proton','Perodua','Toyota']));

-- 2. Catalogue -------------------------------------------------------------
create table if not exists public.new_car_models (
  id                   uuid primary key default gen_random_uuid(),
  brand                text not null check (brand = any (array['Proton','Perodua','Toyota'])),
  model                text not null,
  variant              text not null,
  body_type            text,
  fuel_type            text,
  transmission         text,
  price_peninsular     numeric(10,2) not null check (price_peninsular > 0),
  price_sabah_sarawak  numeric(10,2) check (price_sabah_sarawak > 0),
  price_labuan         numeric(10,2) check (price_labuan > 0),
  price_langkawi       numeric(10,2) check (price_langkawi > 0),
  effective_from       date not null,
  source_url           text,
  is_active            boolean not null default true,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (brand, model, variant)
);

alter table public.new_car_models enable row level security;

-- Official brand prices are public facts.
create policy new_car_models_read on public.new_car_models
  for select to anon, authenticated using (is_active or is_superadmin());
create policy new_car_models_admin_ins on public.new_car_models
  for insert to authenticated with check (is_superadmin());
create policy new_car_models_admin_upd on public.new_car_models
  for update to authenticated using (is_superadmin()) with check (is_superadmin());
create policy new_car_models_admin_del on public.new_car_models
  for delete to authenticated using (is_superadmin());

create or replace function public.touch_new_car_models()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_touch_new_car_models on public.new_car_models;
create trigger trg_touch_new_car_models before update on public.new_car_models
  for each row execute function public.touch_new_car_models();

-- 3. Which variants each advisor sells -------------------------------------
create table if not exists public.seller_new_models (
  seller_id  uuid not null references public.profiles(id) on delete cascade,
  model_id   uuid not null references public.new_car_models(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (seller_id, model_id)
);
create index if not exists seller_new_models_model_idx on public.seller_new_models(model_id);

alter table public.seller_new_models enable row level security;

-- Own rows only. The public reads these through the definer RPCs below, which
-- apply the same "is this seller live" rules as get_salesman_by_slug.
create policy seller_new_models_own_read on public.seller_new_models
  for select to authenticated using (seller_id = auth.uid() or is_superadmin());
create policy seller_new_models_own_ins on public.seller_new_models
  for insert to authenticated with check (
    seller_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'salesman')
  );
create policy seller_new_models_own_del on public.seller_new_models
  for delete to authenticated using (seller_id = auth.uid());

-- 4. Zone + price, one place -------------------------------------------------
create or replace function public.new_car_price_zone(p_state text, p_city text)
returns text language sql immutable set search_path = public as $$
  select case
    when lower(coalesce(p_city, '')) like '%langkawi%' then 'langkawi'
    when lower(btrim(coalesce(p_state, ''))) like '%labuan%' then 'labuan'
    when lower(btrim(coalesce(p_state, ''))) in ('sabah', 'sarawak') then 'sabah_sarawak'
    else 'peninsular'
  end
$$;

create or replace function public.new_car_zone_price(m public.new_car_models, p_zone text)
returns numeric language sql immutable set search_path = public as $$
  select case p_zone
    when 'sabah_sarawak' then m.price_sabah_sarawak
    when 'labuan'        then m.price_labuan
    when 'langkawi'      then m.price_langkawi
    else m.price_peninsular
  end
$$;

-- Mini page: the variants this seller sells, priced for the seller's zone.
create or replace function public.get_seller_new_models(p_slug text)
returns table (
  model_id uuid, brand text, model text, variant text, body_type text,
  fuel_type text, transmission text, price numeric, price_zone text,
  effective_from date, source_url text
)
language sql stable security definer set search_path = public as $$
  with s as (
    select p.id, new_car_price_zone(p.state, p.city) as zone
      from profiles p
     where p.slug = p_slug
       and p.role = 'salesman'
       and (p.is_active = true or p.approval_status = 'pending')
       and p.suspended_at is null
       and coalesce(p.account_status, 'active') <> 'deleted'
       and p.deleted_at is null
     limit 1
  )
  select m.id, m.brand, m.model, m.variant, m.body_type, m.fuel_type, m.transmission,
         new_car_zone_price(m, s.zone), s.zone, m.effective_from, m.source_url
    from s
    join seller_new_models sm on sm.seller_id = s.id
    join new_car_models m on m.id = sm.model_id and m.is_active
   order by m.model, m.sort_order, m.price_peninsular;
$$;

-- Seller settings: the whole catalogue for one brand, priced for the CALLER's
-- zone, with the caller's ticks. Subject comes from auth.uid(), never an arg.
create or replace function public.get_my_new_car_catalogue(p_brand text)
returns table (
  model_id uuid, model text, variant text, price numeric, price_zone text,
  effective_from date, selected boolean
)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, new_car_price_zone(p.state, p.city) as zone
      from profiles p where p.id = auth.uid()
  )
  select m.id, m.model, m.variant, new_car_zone_price(m, me.zone), me.zone,
         m.effective_from,
         exists (select 1 from seller_new_models sm where sm.seller_id = me.id and sm.model_id = m.id)
    from me
    join new_car_models m on m.brand = p_brand and m.is_active
   order by m.model, m.sort_order, m.price_peninsular;
$$;

revoke all on function public.get_seller_new_models(text) from public, anon, authenticated;
grant execute on function public.get_seller_new_models(text) to anon, authenticated;
revoke all on function public.get_my_new_car_catalogue(text) from public, anon, authenticated;
grant execute on function public.get_my_new_car_catalogue(text) to authenticated;
