-- NEWCAR-1 (2026-10-08, owner): advisors CHOOSE what they sell.
--
-- Owner's call: a new advisor's page starts EMPTY like every account. Nothing
-- is listed for them from the catalogue; they add a card per variant from the
-- new-car form (photo + done), and only cards show. So:
--   1. get_seller_new_models (the auto price list on the mini page) is dropped.
--      The old mini page code reads its error as "no models" and shows nothing.
--   2. get_new_model_advisors lists advisors with a LIVE CARD for the model,
--      not "every advisor of the brand who did not hide it".
--   3. Cards got a null slug (see new_car_card_fill below). Fixed + backfilled.
--   4. get_new_car_listing_info(listing): what the car page shows for a card --
--      the catalogue specs, the price basis, and the advisor's other cards.
-- seller_hidden_models stays (get_my_new_car_catalogue reads it) but nothing
-- writes it any more.
-- Applies AFTER 20261008b. DDL: run outside 09:00-22:00 MYT.

-- 3. Slug ---------------------------------------------------------------------
create or replace function public.new_car_card_fill()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m   new_car_models%rowtype;
  p   profiles%rowtype;
  v_price numeric;
begin
  if tg_op = 'UPDATE' then
    if new.new_car_model_id is distinct from old.new_car_model_id
       or new.new_car_unit is distinct from old.new_car_unit then
      raise exception 'new_car_card_locked' using hint = 'Make a new card instead of changing the variant.';
    end if;
  end if;
  -- A sold unit keeps the price it sold at; only cards follow the catalogue.
  -- Only new_car_unit_on_won may create one (it also skips the subscription check).
  if new.new_car_unit then
    if tg_op = 'INSERT' and (new.new_car_model_id is null
       or coalesce(current_setting('app.new_car_unit', true), '') <> 'on') then
      raise exception 'new_car_unit_server_only';
    end if;
    return new;
  end if;
  if new.new_car_model_id is null then return new; end if;

  select * into m from new_car_models where id = new.new_car_model_id;
  select * into p from profiles where id = new.dealer_id;
  if tg_op = 'INSERT' then
    if m.id is null or not m.is_active then raise exception 'new_car_model_unavailable'; end if;
    if p.new_car_brand is distinct from m.brand then raise exception 'new_car_wrong_brand'; end if;
  end if;
  v_price := new_car_zone_price(m, new_car_price_zone(p.state, p.city));
  if v_price is null then
    raise exception 'new_car_no_price_for_zone' using hint = 'XDrive has no official price for your area yet.';
  end if;

  new.new_car_card_id := null;  -- only a unit points at a card
  new.brand := m.brand;
  new.model := m.model;
  new.variant := m.variant;
  new.selling_price := v_price;
  new.condition := 'new';
  new.is_recon := false;
  new.mileage := 0;
  new.year := coalesce(new.year, extract(year from current_date)::int);
  new.body_type := coalesce(m.body_type, new.body_type);
  new.fuel_type := coalesce(m.fuel_type, new.fuel_type);
  new.transmission := coalesce(m.transmission, new.transmission);
  -- car_slug_trigger runs FIRST (alphabetical), while brand/model are still
  -- empty, so it leaves the slug null and the card's links went to
  -- /showroom/null ("This listing is no longer available"). Same formula.
  if new.slug is null or new.slug = '' then
    new.slug := slugify(new.brand || ' ' || new.model || ' ' || new.year::text)
                || '-' || left(replace(new.id::text, '-', ''), 4);
  end if;
  return new;
end $$;

update public.car_listings
   set slug = slugify(brand || ' ' || model || ' ' || year::text) || '-' || left(replace(id::text, '-', ''), 4)
 where new_car_model_id is not null and (slug is null or slug = '');

-- 1. No automatic price list --------------------------------------------------
drop function if exists public.get_seller_new_models(text);

-- 2. Advisors of a model = advisors with a live card of it ---------------------
create or replace function public.get_new_model_advisors(p_brand text, p_model text)
returns table (
  slug text, full_name text, avatar_url text, city text, state text,
  is_verified boolean, has_whatsapp boolean, price_zone text,
  reply_median_minutes integer, reply_samples integer, variants_sold integer
)
language sql stable security definer set search_path = public as $$
  with live as (
    select p.*, v.n as variants_sold
      from profiles p
      cross join lateral (
        select count(*)::int as n
          from public_car_listings pc
          join car_listings c on c.id = pc.id
          join new_car_models m on m.id = c.new_car_model_id
         where c.dealer_id = p.id and not c.new_car_unit
           and m.brand = p_brand and m.model = p_model
      ) v
     where p.seller_type = 'new_car'
       and p.new_car_brand = p_brand
       and v.n > 0
       and p.role = 'salesman'
       and p.slug is not null
       and p.is_active = true
       and p.approval_status = 'approved'
       and p.suspended_at is null
       and coalesce(p.account_status, 'active') <> 'deleted'
       and p.deleted_at is null
     order by coalesce(p.is_verified, false) desc, p.full_name
     limit 50
  )
  select l.slug, l.full_name, l.avatar_url, l.city, l.state,
         coalesce(l.is_verified, false),
         coalesce(nullif(btrim(l.whatsapp_number), ''), nullif(btrim(l.phone), '')) is not null,
         new_car_price_zone(l.state, l.city),
         r.median_minutes, r.samples, l.variants_sold
    from live l
    left join lateral get_agent_reply_time(l.id) r on true
   order by coalesce(l.is_verified, false) desc,
            case when coalesce(r.samples, 0) >= 5 then r.median_minutes end asc nulls last,
            l.full_name;
$$;

-- 4. Car page info for a card. Only for a car the public can already see
-- (it must be in public_car_listings). No phone, no buyer data.
create or replace function public.get_new_car_listing_info(p_listing_id uuid)
returns table (
  brand text, model text, variant text, body_type text, fuel_type text,
  transmission text, specs jsonb, effective_from date, price_zone text,
  advisor_verified boolean, other_cards jsonb
)
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
         ), '[]'::jsonb)
    from car_listings c
    join public_car_listings pub on pub.id = c.id
    join new_car_models m on m.id = c.new_car_model_id
    join profiles p on p.id = c.dealer_id
   where c.id = p_listing_id and not c.new_car_unit;
$$;

revoke all on function public.get_new_car_listing_info(uuid) from public, anon, authenticated;
grant execute on function public.get_new_car_listing_info(uuid) to anon, authenticated;
revoke all on function public.get_new_model_advisors(text, text) from public, anon, authenticated;
grant execute on function public.get_new_model_advisors(text, text) to anon, authenticated;
revoke all on function public.new_car_card_fill() from public, anon, authenticated;
