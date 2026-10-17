-- One new-car card per MODEL, not per variant (owner, 2026-10-17; reverses the
-- 2026-10-08 one-card-per-variant call). A seller lists "Proton e.MAS 7" once;
-- the car page lets the buyer switch Prime / Premium / Premium Plus; the deal
-- records the variant the buyer actually took.
--
--   card  : new_car_model_id = the model's CHEAPEST active variant priced for
--           the seller's zone (the "from" price). variant = NULL. Re-anchored on
--           every write, so a console price change can move the anchor.
--   lead  : new_car_model_id = the variant bought, picked when marking won.
--   unit  : new_car_unit_on_won copies the lead's variant (validated: same
--           brand + model as the card), else the card's anchor.
--
-- Also fixes: the panels' won handlers set the lead's ORIGINAL car to sold,
-- which for a new-car lead is the card (the BEFORE trigger has already moved
-- the lead onto a unit). A card can no longer be marked sold; the unit is.
--
-- Live state 2026-10-17: 9 cards, no seller has two cards of one model, so no
-- merge is needed. One migration, one schema reload. Apply after 22:00 MYT.
begin;

-- 1. The variant a buyer took ---------------------------------------------
alter table public.leads
  add column if not exists new_car_model_id uuid references public.new_car_models(id) on delete set null;

-- 2. Cards anchor on the cheapest variant; cards are never sold ------------
create or replace function public.new_car_card_fill()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m   new_car_models%rowtype;
  a   new_car_models%rowtype;
  p   profiles%rowtype;
  v_zone text;
  v_price numeric;
begin
  if tg_op = 'UPDATE' then
    if new.new_car_unit is distinct from old.new_car_unit then
      raise exception 'new_car_card_locked' using hint = 'Make a new card instead.';
    end if;
  end if;
  if new.new_car_unit then
    if tg_op = 'INSERT' and (new.new_car_model_id is null
       or coalesce(current_setting('app.new_car_unit', true), '') <> 'on') then
      raise exception 'new_car_unit_server_only';
    end if;
    return new;
  end if;
  if new.new_car_model_id is null then return new; end if;

  select * into m from new_car_models where id = new.new_car_model_id;
  if tg_op = 'UPDATE' then
    -- The anchor may move between variants of the SAME model; never to another model.
    select * into a from new_car_models where id = old.new_car_model_id;
    if m.id is null or a.id is null or m.brand <> a.brand or m.model <> a.model then
      raise exception 'new_car_card_locked' using hint = 'Make a new card instead of changing the model.';
    end if;
    -- A card stays up after a win; the sold record is the unit.
    if new.status = 'sold' and old.status is distinct from 'sold' then
      new.status := old.status;
      new.sold_at := old.sold_at;
    end if;
    -- Archiving needs no price (the model may have none left).
    if new.status = 'archived' then return new; end if;
  end if;
  select * into p from profiles where id = new.dealer_id;
  if tg_op = 'INSERT' then
    if m.id is null or not m.is_active then raise exception 'new_car_model_unavailable'; end if;
    if p.new_car_brand is distinct from m.brand then raise exception 'new_car_wrong_brand'; end if;
  end if;

  v_zone := new_car_price_zone(p.state, p.city);
  select mm.* into a from new_car_models mm
   where mm.brand = m.brand and mm.model = m.model and mm.is_active
     and new_car_zone_price(mm, v_zone) is not null
   order by new_car_zone_price(mm, v_zone), mm.sort_order
   limit 1;
  if a.id is null then
    -- On an edit, keep the card as it was: raising here would fail the
    -- console's price-list update for every other seller too.
    if tg_op = 'UPDATE' then return new; end if;
    raise exception 'new_car_no_price_for_zone' using hint = 'XDrive has no official price for your area yet.';
  end if;
  v_price := new_car_zone_price(a, v_zone);

  new.new_car_model_id := a.id;
  new.new_car_card_id := null;  -- only a unit points at a card
  new.brand := a.brand;
  new.model := a.model;
  new.variant := null;          -- a card is the whole model
  new.selling_price := v_price; -- "from"
  new.condition := 'new';
  new.is_recon := false;
  new.mileage := 0;
  new.year := coalesce(new.year, extract(year from current_date)::int);
  new.body_type := coalesce(a.body_type, new.body_type);
  new.fuel_type := coalesce(a.fuel_type, new.fuel_type);
  new.transmission := coalesce(a.transmission, new.transmission);
  if new.slug is null or new.slug = '' then
    new.slug := slugify(new.brand || ' ' || new.model || ' ' || new.year::text)
                || '-' || left(replace(new.id::text, '-', ''), 4);
  end if;
  return new;
end $$;

-- 3. The sold unit records the variant the buyer took ----------------------
create or replace function public.new_car_unit_on_won()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c car_listings%rowtype;
  card_m new_car_models%rowtype;
  v new_car_models%rowtype;
  p profiles%rowtype;
  v_unit uuid;
begin
  if new.stage in ('won', 'closed_won')
     and (old.stage is null or old.stage not in ('won', 'closed_won'))
     and new.car_listing_id is not null then
    select * into c from car_listings where id = new.car_listing_id;
    if c.new_car_model_id is not null and not c.new_car_unit then
      select * into card_m from new_car_models where id = c.new_car_model_id;
      -- The seller's pick, only if it is a variant of THIS card's model.
      select * into v from new_car_models
       where id = new.new_car_model_id and brand = card_m.brand and model = card_m.model;
      if v.id is null then v := card_m; end if;
      select * into p from profiles where id = c.dealer_id;
      perform set_config('app.new_car_unit', 'on', true);
      insert into car_listings (
        dealer_id, assigned_to, brand, model, variant, year, condition, is_recon, mileage,
        transmission, fuel_type, body_type, colour, selling_price, images, description,
        listing_title, state, city, payment_type, status, new_car_model_id, new_car_card_id, new_car_unit
      ) values (
        c.dealer_id, coalesce(c.assigned_to, new.salesman_id), v.brand, v.model, v.variant, c.year,
        'new', false, 0, coalesce(v.transmission, c.transmission), coalesce(v.fuel_type, c.fuel_type),
        coalesce(v.body_type, c.body_type), c.colour,
        coalesce(new_car_zone_price(v, new_car_price_zone(p.state, p.city)), c.selling_price),
        c.images, c.description, c.listing_title, c.state, c.city, c.payment_type,
        'unpublished', v.id, c.id, true
      ) returning id into v_unit;
      perform set_config('app.new_car_unit', '', true);
      new.new_car_model_id := v.id;
      new.car_listing_id := v_unit;
    end if;
  end if;
  return new;
end $$;

-- 4. One card per model per seller -----------------------------------------
drop index if exists public.car_listings_one_card_per_variant;
create unique index if not exists car_listings_one_card_per_model
  on public.car_listings (dealer_id, brand, model)
  where new_car_model_id is not null and not new_car_unit
    and status <> all (array['sold'::text, 'archived'::text]);

-- 5. Car page: every variant of the card's model, priced for the seller ----
-- New column (variants) changes the return type: drop + create, re-grant.
drop function if exists public.get_new_car_listing_info(uuid);
create function public.get_new_car_listing_info(p_listing_id uuid)
returns table (brand text, model text, variant text, body_type text, fuel_type text,
  transmission text, specs jsonb, effective_from date, price_zone text,
  advisor_verified boolean, other_cards jsonb, variants jsonb)
language sql stable security definer set search_path = public as $$
  select m.brand, m.model, m.variant, m.body_type, m.fuel_type, m.transmission,
         coalesce(m.specs, '{}'::jsonb), m.effective_from,
         new_car_price_zone(p.state, p.city),
         coalesce(p.is_verified, false),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', o.id, 'slug', o.slug, 'model', o.model, 'variant', o.variant,
                    'price', o.selling_price, 'image', o.images[1])
                  order by om.sort_order, o.selling_price)
             from public_car_listings o
             join car_listings oc on oc.id = o.id
             join new_car_models om on om.id = oc.new_car_model_id
            where oc.dealer_id = c.dealer_id and not oc.new_car_unit and o.id <> c.id
         ), '[]'::jsonb),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'model_id', vm.id, 'variant', vm.variant,
                    'price', new_car_zone_price(vm, new_car_price_zone(p.state, p.city)),
                    'body_type', vm.body_type, 'fuel_type', vm.fuel_type,
                    'transmission', vm.transmission, 'specs', coalesce(vm.specs, '{}'::jsonb),
                    'effective_from', vm.effective_from)
                  order by new_car_zone_price(vm, new_car_price_zone(p.state, p.city)) nulls last, vm.sort_order)
             from new_car_models vm
            where vm.brand = m.brand and vm.model = m.model and vm.is_active
         ), '[]'::jsonb)
    from car_listings c
    join public_car_listings pub on pub.id = c.id
    join new_car_models m on m.id = c.new_car_model_id
    join profiles p on p.id = c.dealer_id
   where c.id = p_listing_id and not c.new_car_unit;
$$;
revoke all on function public.get_new_car_listing_info(uuid) from public, anon, authenticated;
grant execute on function public.get_new_car_listing_info(uuid) to anon, authenticated;

-- 6. Console price-list edits reach every card of the MODEL ---------------
-- Was keyed on new_car_model_id = the edited row, which under one card per
-- variant was the card. Now a card anchors on one variant, so: re-anchor all
-- cards of the model; archive them only when the model has no active variant
-- left (it used to archive on deactivating the card's own variant).
create or replace function public.new_car_model_to_cards()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from new_car_models where brand = new.brand and model = new.model and is_active) then
    update car_listings c set selling_price = c.selling_price
      from new_car_models m
     where m.id = c.new_car_model_id and m.brand = new.brand and m.model = new.model
       and c.new_car_model_id is not null and not c.new_car_unit
       and c.status not in ('sold', 'archived');
  else
    update car_listings c set status = 'archived'
      from new_car_models m
     where m.id = c.new_car_model_id and m.brand = new.brand and m.model = new.model
       and c.new_car_model_id is not null and not c.new_car_unit
       and c.status not in ('sold', 'archived');
  end if;
  return new;
end $$;

-- 7. Re-anchor today's cards (fires new_car_card_fill) ---------------------
update public.car_listings set selling_price = selling_price
 where new_car_model_id is not null and not new_car_unit
   and status <> all (array['sold'::text, 'archived'::text]);

commit;

-- Check afterwards:
--   select model, variant, selling_price from car_listings where new_car_model_id is not null and not new_car_unit;
--   select oid::regprocedure from pg_proc where proname = 'get_new_car_listing_info';  -- one row
