-- New-car cards are always bought on a loan (owner, 2026-10-08). NewCarForm never
-- asked cash or loan, so payment_type fell to the column default 'cash' and the
-- car page said "Financing: Cash Only" on every new Proton/Perodua card.
-- 1. The card trigger now sets payment_type = 'loan' on every card write.
--    Units copy the card's value in new_car_unit_on_won, so they follow.
-- 2. Backfill (already run as plain DML on 2026-10-08 17:00, no-op if re-run).
-- Function signature unchanged (trigger, no args), so no overload risk.

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
  new.payment_type := 'loan';  -- new cars are sold on a loan; not a seller choice
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
revoke all on function public.new_car_card_fill() from public, anon, authenticated;

update public.car_listings set payment_type = 'loan'
 where new_car_model_id is not null and payment_type is distinct from 'loan';
