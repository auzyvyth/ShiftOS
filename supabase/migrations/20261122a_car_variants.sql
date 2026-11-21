-- 20261122a_car_variants.sql  (owner, 2026-11-21)  QUEUED, NOT APPLIED.
-- One row per real variant; many listings point at it. Soft catalogue: a row exists only because a real
-- car (or an owner-confirmed entry) carries it, nothing is invented, and buyers only ever see variants that
-- have a live car (the marketplace filter reads them through listings, never this table's list).
-- Apply after midnight MYT with nobody live (one API freeze), then check:
--   select count(*) from car_variants;                                  -- 31 seeded
--   select count(*) from car_listings where variant_id is null and status in ('active','available','reserved','sold') and new_car_model_id is null;
--
-- Identity of a variant = brand + model + generation + trim + engine size (nominal, rounded to 100 cc) + fuel.
-- NULL generation / fuel / engine = "not known", and two unknowns count as the same value.

create table if not exists public.car_variants (
  id            uuid primary key default gen_random_uuid(),
  brand         text not null check (length(btrim(brand)) between 1 and 60),
  model         text not null check (length(btrim(model)) between 1 and 60),
  generation    text check (generation is null or length(btrim(generation)) between 1 and 40),  -- FL5, 992, 40 Series, 2013-present
  variant       text not null default '' check (length(variant) <= 80),                          -- trim only; '' = the single / base trim
  engine_cc     integer check (engine_cc is null or engine_cc between 50 and 12000),             -- nominal: 2.5L = 2500
  fuel_type     text check (fuel_type is null or fuel_type in ('Petrol','Diesel','Hybrid','Plug-in hybrid','Electric')),
  body_type     text check (body_type is null or body_type in ('Sedan','SUV','MPV','Hatchback','Coupe','Pickup')),
  status        text not null default 'seen' check (status in ('seen','verified')),              -- verified = a person confirmed it
  first_seen_at timestamptz not null default now()
);

create unique index if not exists car_variants_identity on public.car_variants (
  lower(brand), lower(model), coalesce(lower(generation), ''), lower(variant), coalesce(engine_cc, 0), coalesce(fuel_type, '')
);
create index if not exists car_variants_brand_model on public.car_variants (lower(brand), lower(model));

alter table public.car_variants enable row level security;
-- The catalogue is names only (no buyer or seller data), so anyone may read it. Nobody writes directly.
drop policy if exists car_variants_read on public.car_variants;
create policy car_variants_read on public.car_variants for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.car_variants from public, anon, authenticated;
grant select on public.car_variants to anon, authenticated;

alter table public.car_listings add column if not exists variant_id uuid references public.car_variants(id) on delete set null;
create index if not exists car_listings_variant_id on public.car_listings (variant_id) where variant_id is not null;

-- The only way in. A signed-in, non-guest seller account names a variant; it is found or created as 'seen'.
-- Guests are `authenticated` too (anonymous sign-in), so the check is inside the function.
create or replace function public.get_or_create_car_variant(
  p_brand text, p_model text, p_generation text, p_variant text,
  p_engine_cc integer default null, p_fuel_type text default null, p_body_type text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
  b text := nullif(regexp_replace(btrim(coalesce(p_brand, '')), '\s+', ' ', 'g'), '');
  m text := nullif(regexp_replace(btrim(coalesce(p_model, '')), '\s+', ' ', 'g'), '');
  g text := nullif(regexp_replace(btrim(coalesce(p_generation, '')), '\s+', ' ', 'g'), '');
  v text := regexp_replace(btrim(coalesce(p_variant, '')), '\s+', ' ', 'g');
  cc integer := case when p_engine_cc is null then null else (round(p_engine_cc / 100.0) * 100)::integer end;
  fuel text := nullif(btrim(coalesce(p_fuel_type, '')), '');
  body text := nullif(btrim(coalesce(p_body_type, '')), '');
  r uuid;
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'not_allowed'; end if;
  select role into v_role from profiles where id = v_uid;
  if v_role is null or v_role = 'buyer' then raise exception 'not_allowed'; end if;
  if b is null or m is null then raise exception 'brand_and_model_required'; end if;

  select id into r from car_variants
   where lower(brand) = lower(b) and lower(model) = lower(m) and coalesce(lower(generation), '') = coalesce(lower(g), '')
     and lower(variant) = lower(v) and coalesce(engine_cc, 0) = coalesce(cc, 0) and coalesce(fuel_type, '') = coalesce(fuel, '');
  if r is not null then return r; end if;

  insert into car_variants (brand, model, generation, variant, engine_cc, fuel_type, body_type)
  values (b, m, g, v, cc, fuel, body)
  on conflict do nothing
  returning id into r;
  if r is null then   -- lost a race with an identical insert
    select id into r from car_variants
     where lower(brand) = lower(b) and lower(model) = lower(m) and coalesce(lower(generation), '') = coalesce(lower(g), '')
       and lower(variant) = lower(v) and coalesce(engine_cc, 0) = coalesce(cc, 0) and coalesce(fuel_type, '') = coalesce(fuel, '');
  end if;
  return r;
end;
$$;
revoke all on function public.get_or_create_car_variant(text, text, text, text, integer, text, text) from public, anon;
grant execute on function public.get_or_create_car_variant(text, text, text, text, integer, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Backfill: the cars the public marketplace shows today (dry run 2026-11-21: 43 spellings -> 31 variants).
-- Owner decisions: Premium = Premier (Toyota's grade name), JBL is an option, blank generations filled where
-- only one generation exists, GR Yaris is one model. Anything not matched stays variant_id NULL (not guessed).
-- Generation labels are the chassis decoder's year ranges (src/utils/chassisDecode.js); unknown stays NULL.
-- ---------------------------------------------------------------------------------------------------
create temporary table _vmap (
  brand text, model text, old_variant text, old_fuel text,           -- what the listing says now (old_fuel NULL = any)
  to_model text, generation text, variant text, engine_cc int, fuel_type text, body_type text
) on commit drop;

insert into _vmap values
 ('Alfa Romeo','Giulia','2.0 Veloce',null,'Giulia',null,'Veloce',2000,null,'Sedan'),
 ('BMW','Z4','sDrive20i M Sport',null,'Z4',null,'sDrive20i M Sport',2000,null,null),
 ('Daihatsu','Move Canbus','STRIPES G TURBO',null,'Move Canbus',null,'Stripes G Turbo',null,null,null),
 ('Ferrari','812','6.5 Superfast',null,'812',null,'Superfast',6500,null,'Coupe'),
 ('Ferrari','Roma','3.9',null,'Roma',null,'',3900,null,'Coupe'),
 ('Ferrari','SF90','Competition hybrid',null,'SF90',null,'Competition',3500,null,'Coupe'),
 ('Honda','Civic','2.0L(T) HATCHBACK FL5 TYPE-R',null,'Civic','FL5','Type R',2000,null,'Hatchback'),
 ('Honda','Civic','FL5 TYPE-R 2.0L HATCHBACK',null,'Civic','FL5','Type R',2000,null,'Hatchback'),
 ('Honda','Civic','FL5 TYPE-R',null,'Civic','FL5','Type R',2000,null,'Hatchback'),
 ('Honda','Civic','Type R FL5',null,'Civic','FL5','Type R',2000,null,'Hatchback'),
 ('Honda','Civic','Type-R 2.0l Hatchback',null,'Civic','FL5','Type R',2000,null,'Hatchback'),
 ('Land Rover','Defender','110 S',null,'Defender',null,'110 S',null,null,'SUV'),
 ('Land Rover','Defender','90',null,'Defender',null,'90',2000,null,'SUV'),
 ('Land Rover','Defender','S',null,'Defender',null,'S',3000,null,'SUV'),
 ('Lexus','GX','GX550 3.5L TURBO VERSION L',null,'GX',null,'550 Version L',3500,null,'SUV'),
 ('Lexus','IS','300 2.0 F Sport',null,'IS','2013-present','300 F Sport',2000,null,'Sedan'),
 ('Lexus','IS','300 2.0L(T) F-Sport',null,'IS','2013-present','300 F Sport',2000,null,'Sedan'),
 ('Lexus','IS','300 2.0L(T) F-SPORT',null,'IS','2013-present','300 F Sport',2000,null,'Sedan'),
 ('Lexus','NX','250 2.5 Base',null,'NX',null,'250 Base',2500,null,'SUV'),
 ('Lexus','NX','250 2.5L VERSION L',null,'NX',null,'250 Version L',2500,null,'SUV'),
 ('Lexus','RX','350 2.4L (T) F-Sport',null,'RX','2022-present','350 F Sport',2400,null,'SUV'),
 ('Lexus','RX','350 2.4L Turbo F-Sport',null,'RX','2022-present','350 F Sport',2400,null,'SUV'),
 ('Lexus','RX','350 2.4L(T) F-SPORT',null,'RX','2022-present','350 F Sport',2400,null,'SUV'),
 ('Mazda','MX-5','ROADSTER (MX-5) S',null,'MX-5',null,'S',2000,null,null),
 ('MINI','Cooper','WORKS 3-DOOR',null,'Cooper',null,'Works 3 Door',null,null,'Hatchback'),
 ('Porsche','911','Carrera 992',null,'911','992','Carrera',3000,null,'Coupe'),
 ('Porsche','911','GT3 (992) 4.0 Auto PDK',null,'911','992','GT3',4000,null,null),
 ('Rolls Royce','Cullinan','6.8L',null,'Cullinan',null,'',6800,null,'SUV'),
 ('Subaru','BRZ','S',null,'BRZ',null,'S',2400,null,'Coupe'),
 ('Toyota','Alphard','2.5L SC',null,'Alphard','30 Series','SC',2500,null,'MPV'),
 ('Toyota','Alphard','2.5L Z','Hybrid','Alphard','40 Series','Z',2500,'Hybrid','MPV'),
 ('Toyota','Alphard','2.5L Z',null,'Alphard','40 Series','Z',2500,'Petrol','MPV'),
 ('Toyota','Alphard','2.5 Z New Model',null,'Alphard','40 Series','Z',2500,'Petrol','MPV'),
 ('Toyota','Alphard','2.5 Z JBL Full',null,'Alphard','40 Series','Z',2500,'Petrol','MPV'),
 ('Toyota','Crown','Sport 2.5L Z',null,'Crown',null,'Sport Z',2500,null,null),
 ('Toyota','GR Yaris','RZ HIGH PERORMANCE',null,'GR Yaris','2020-present','RZ High Performance',1600,null,'Hatchback'),
 ('Toyota','Yaris','GR RZ HIGH',null,'GR Yaris','2020-present','RZ High Performance',1600,null,'Hatchback'),
 ('Toyota','GR86','2.4L RZ',null,'GR86',null,'RZ',2400,null,'Coupe'),
 ('Toyota','Harrier','2.0L G',null,'Harrier','80 Series','G',2000,null,'SUV'),
 ('Toyota','Vellfire','2.4L Turbo Z Premium',null,'Vellfire','40 Series','Z Premier',2400,null,'MPV'),
 ('Toyota','Vellfire','2.4T Z Premier',null,'Vellfire','40 Series','Z Premier',2400,null,'MPV'),
 ('Toyota','Vellfire','Executive Lounge',null,'Vellfire','40 Series','Executive Lounge',2500,null,'MPV'),
 ('Volkswagen','Golf','golf gti 2.0 se',null,'Golf',null,'GTI SE',2000,null,'Hatchback');

insert into car_variants (brand, model, generation, variant, engine_cc, fuel_type, body_type)
select distinct on (lower(brand), lower(to_model), coalesce(lower(generation), ''), lower(variant), coalesce(engine_cc, 0), coalesce(fuel_type, ''))
       brand, to_model, generation, variant, engine_cc, fuel_type, body_type
from _vmap
on conflict do nothing;

-- pass 1: rows that name a fuel (the Alphard Z hybrids), pass 2: everything else not yet linked
update car_listings c
   set variant_id = v.id, model = m.to_model, variant = nullif(m.variant, ''),
       body_type = case when m.model = 'Defender' or m.model = 'GX' then m.body_type else c.body_type end
  from _vmap m
  join car_variants v on lower(v.brand) = lower(m.brand) and lower(v.model) = lower(m.to_model)
   and coalesce(lower(v.generation), '') = coalesce(lower(m.generation), '') and lower(v.variant) = lower(m.variant)
   and coalesce(v.engine_cc, 0) = coalesce(m.engine_cc, 0) and coalesce(v.fuel_type, '') = coalesce(m.fuel_type, '')
 where lower(c.brand) = lower(m.brand) and lower(c.model) = lower(m.model) and lower(btrim(c.variant)) = lower(m.old_variant)
   and m.old_fuel is not null and c.fuel_type = m.old_fuel and c.variant_id is null and c.new_car_model_id is null;

update car_listings c
   set variant_id = v.id, model = m.to_model, variant = nullif(m.variant, ''),
       body_type = case when m.model = 'Defender' or m.model = 'GX' then m.body_type else c.body_type end
  from _vmap m
  join car_variants v on lower(v.brand) = lower(m.brand) and lower(v.model) = lower(m.to_model)
   and coalesce(lower(v.generation), '') = coalesce(lower(m.generation), '') and lower(v.variant) = lower(m.variant)
   and coalesce(v.engine_cc, 0) = coalesce(m.engine_cc, 0) and coalesce(v.fuel_type, '') = coalesce(m.fuel_type, '')
 where lower(c.brand) = lower(m.brand) and lower(c.model) = lower(m.model) and lower(btrim(c.variant)) = lower(m.old_variant)
   and m.old_fuel is null and c.variant_id is null and c.new_car_model_id is null;
