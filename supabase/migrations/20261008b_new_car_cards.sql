-- NEWCAR-1 step 3 (2026-10-08): an advisor's new-car CARD is a real listing.
--
-- Owner's call: new-car advisors get the same card as used cars (photos, the
-- listing copy tools, performance stats), one card per VARIANT, made from the
-- new-car form. Research: Autotrader UK / Edmunds / CarDekho run the official
-- model data as one layer and the seller's listing linked to it as another;
-- Carlist has only the second layer, so its advisors type their own prices.
--
-- A card is a car_listings row with new_car_model_id set:
--   * its brand / model / variant / condition / selling_price are COPIED from
--     new_car_models by trigger, priced for the advisor's zone. The advisor can
--     never type the price, and a console price change re-prices every card.
--   * it does not count toward the listing cap (a price list is not stock).
--   * it never reserves and never sells. A won deal on a card INSERTS a sold
--     unit (a copy, new_car_unit = true, new_car_card_id = the card) and moves the lead onto it, so
--     "won = a sold car_listings row" stays true for every count, commission
--     and handover path (CLAUDE.md "Won = sold"), and the card stays up for
--     the next buyer. Undo sale on a unit deletes the unit and moves the lead
--     back to the card.
-- Applies AFTER 20261008a.

alter table public.car_listings
  add column if not exists new_car_model_id uuid references public.new_car_models(id),
  add column if not exists new_car_card_id  uuid references public.car_listings(id) on delete set null,
  -- true = a sold unit made from a card. A flag, not "card_id is not null":
  -- deleting the card nulls card_id, and the unit must not turn into a card.
  add column if not exists new_car_unit     boolean not null default false;

create index if not exists car_listings_new_car_model_idx on public.car_listings(new_car_model_id) where new_car_model_id is not null;
-- One live card per variant per advisor.
create unique index if not exists car_listings_one_card_per_variant
  on public.car_listings(dealer_id, new_car_model_id)
  where new_car_model_id is not null and not new_car_unit and status not in ('sold', 'archived');

-- 1. Card fields come from the catalogue ----------------------------------
-- Named trg_zz_ so it runs AFTER trg_normalize_car_model: the card keeps the
-- catalogue's exact names, which is what the mini page and presenter match on.
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
  return new;
end $$;

drop trigger if exists trg_zz_new_car_card on public.car_listings;
create trigger trg_zz_new_car_card before insert or update on public.car_listings
  for each row execute function public.new_car_card_fill();

-- Console price change / hide -> every live card follows.
create or replace function public.new_car_model_to_cards()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.is_active then
    update car_listings set status = 'archived'
     where new_car_model_id = new.id and not new_car_unit
       and status not in ('sold', 'archived');
  else
    update car_listings set selling_price = selling_price  -- re-runs new_car_card_fill
     where new_car_model_id = new.id and not new_car_unit
       and status not in ('sold', 'archived');
  end if;
  return new;
end $$;
drop trigger if exists trg_new_car_model_to_cards on public.new_car_models;
create trigger trg_new_car_model_to_cards after update on public.new_car_models
  for each row execute function public.new_car_model_to_cards();

-- An advisor who moves state gets their zone's price.
create or replace function public.new_car_cards_on_zone_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update car_listings set selling_price = selling_price
   where dealer_id = new.id and new_car_model_id is not null and not new_car_unit
     and status not in ('sold', 'archived');
  return new;
exception when others then
  -- A zone with no price must not block saving a profile: the card keeps its
  -- last price and the next catalogue edit raises it in the console.
  raise warning 'new_car_cards_on_zone_change: %', sqlerrm;
  return new;
end $$;
drop trigger if exists trg_new_car_cards_on_zone_change on public.profiles;
create trigger trg_new_car_cards_on_zone_change after update of state, city on public.profiles
  for each row when (new.seller_type = 'new_car') execute function public.new_car_cards_on_zone_change();

-- 2. Listing cap: cards and units never count -------------------------------
create or replace function public.enforce_listing_cap()
returns trigger language plpgsql set search_path to 'pg_catalog', 'public' as $function$
DECLARE
  v_cap    int;
  v_active int;
BEGIN
  -- New-car cards come from the price list, they are not stock (NEWCAR-1).
  IF NEW.new_car_model_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT CASE
           WHEN p.role = 'salesman' AND p.plan::text = 'salesman_full'
                AND p.dealer_id IS NULL
                AND NOT (COALESCE(p.plan_expires_at > now(), false)
                         OR p.payment_status = 'received')
           THEN (SELECT listing_cap FROM plan_config WHERE plan = 'salesman_lite')
           ELSE pc.listing_cap
         END
    INTO v_cap
  FROM profiles p
  JOIN plan_config pc ON pc.plan = p.plan::text
  WHERE p.id = NEW.dealer_id;

  -- NULL cap = unlimited (dealer_group)
  IF v_cap IS NULL THEN RETURN NEW; END IF;

  -- Unpublished cars are private stock, not public listings — never gate them.
  IF NEW.status = 'unpublished' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_active
  FROM car_listings
  WHERE dealer_id = NEW.dealer_id
  AND status NOT IN ('sold', 'archived', 'unpublished')
  AND new_car_model_id IS NULL;

  IF v_active >= v_cap THEN
    RAISE EXCEPTION 'listing_cap_exceeded'
      USING HINT = 'Upgrade your plan to add more listings',
            DETAIL = format('active=%s cap=%s', v_active, v_cap);
  END IF;

  RETURN NEW;
END;
$function$;

create or replace function public.enforce_listing_cap_on_publish()
returns trigger language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
DECLARE
  v_cap    int;
  v_active int;
BEGIN
  IF NEW.new_car_model_id IS NOT NULL THEN RETURN NEW; END IF;
  IF OLD.status NOT IN ('unpublished', 'archived') THEN RETURN NEW; END IF;
  IF NEW.status IN ('unpublished', 'sold', 'archived') THEN RETURN NEW; END IF;

  SELECT pc.listing_cap INTO v_cap
  FROM profiles p
  JOIN plan_config pc ON pc.plan = p.plan::text
  WHERE p.id = NEW.dealer_id;

  IF v_cap IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_active
  FROM car_listings
  WHERE dealer_id = NEW.dealer_id
    AND status NOT IN ('sold', 'archived', 'unpublished')
    AND new_car_model_id IS NULL
    AND id != NEW.id;

  IF v_active >= v_cap THEN
    RAISE EXCEPTION 'listing_cap_exceeded'
      USING HINT = 'Upgrade your plan to add more listings',
            DETAIL = format('active=%s cap=%s', v_active, v_cap);
  END IF;

  RETURN NEW;
END;
$function$;

-- A lapsed subscription must never stop a deal being marked won: the sold
-- unit is the server's copy of a card that already passed this check.
create or replace function public.enforce_active_subscription()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
DECLARE
  v_role   text;
  v_status text;
  v_trial  timestamptz;
BEGIN
  IF NEW.dealer_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.new_car_unit THEN RETURN NEW; END IF;

  SELECT role, subscription_status, trial_ends_at
    INTO v_role, v_status, v_trial
  FROM profiles
  WHERE id = NEW.dealer_id;

  -- superadmin / platform accounts are never gated
  IF v_role = 'superadmin' THEN RETURN NEW; END IF;

  -- active subscription, or trial still within its window -> allow
  IF v_status = 'active' THEN RETURN NEW; END IF;
  IF v_status = 'trial' AND v_trial IS NOT NULL AND v_trial > now() THEN RETURN NEW; END IF;

  -- NULL status = legacy account predating trial tracking -> allow (don't lock out grandfathered dealers)
  IF v_status IS NULL THEN RETURN NEW; END IF;

  -- everything else (expired, or trial past trial_ends_at) is blocked
  RAISE EXCEPTION 'subscription_inactive'
    USING HINT = 'Your trial has ended — activate your ShiftOS subscription to continue',
          DETAIL = format('status=%s trial_ends_at=%s', v_status, v_trial);
END;
$function$;

-- 3. A deposit never reserves a card -----------------------------------------
create or replace function public.sync_car_reservation_on_lead_stage()
returns trigger language plpgsql security definer set search_path to 'pg_catalog', 'public' as $function$
BEGIN
  IF NEW.car_listing_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Deposit taken -> reserve the car (only if currently available; never
  -- overwrite a sold/already-reserved car). Stamp who reserved it + when.
  -- A new-car card is a price list entry, not one car: never reserved.
  IF NEW.stage = 'deposit_taken'
     AND OLD.stage IS DISTINCT FROM 'deposit_taken' THEN
    UPDATE car_listings
       SET status = 'reserved',
           reserved_by = NEW.salesman_id,
           reserved_at = now()
     WHERE id = NEW.car_listing_id
       AND status = 'available'
       AND new_car_model_id IS NULL;
  END IF;

  -- Lead lost -> release the reservation (only if currently reserved; never
  -- touch a sold car). Clear attribution.
  IF NEW.stage IN ('lost', 'closed_lost')
     AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    UPDATE car_listings
       SET status = 'available',
           reserved_by = NULL,
           reserved_at = NULL
     WHERE id = NEW.car_listing_id
       AND status = 'reserved';
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Won on a card -> a sold unit ----------------------------------------------
-- BEFORE UPDATE on leads, so NEW.car_listing_id already points at the unit
-- when trg_lead_won (AFTER) runs: that trigger then flips the UNIT to sold and
-- builds the customer + handover rows from it, exactly as for any car. The
-- unit is inserted 'unpublished' so the new-listing Telegram post and the cap
-- skip it, and unpublished -> sold does not count as publishing.
create or replace function public.new_car_unit_on_won()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c car_listings%rowtype;
  v_unit uuid;
begin
  if new.stage in ('won', 'closed_won')
     and (old.stage is null or old.stage not in ('won', 'closed_won'))
     and new.car_listing_id is not null then
    select * into c from car_listings where id = new.car_listing_id;
    if c.new_car_model_id is not null and not c.new_car_unit then
      perform set_config('app.new_car_unit', 'on', true);
      insert into car_listings (
        dealer_id, assigned_to, brand, model, variant, year, condition, is_recon, mileage,
        transmission, fuel_type, body_type, colour, selling_price, images, description,
        listing_title, state, city, payment_type, status, new_car_model_id, new_car_card_id, new_car_unit
      ) values (
        c.dealer_id, coalesce(c.assigned_to, new.salesman_id), c.brand, c.model, c.variant, c.year,
        'new', false, 0, c.transmission, c.fuel_type, c.body_type, c.colour, c.selling_price,
        c.images, c.description, c.listing_title, c.state, c.city, c.payment_type,
        'unpublished', c.new_car_model_id, c.id, true
      ) returning id into v_unit;
      perform set_config('app.new_car_unit', '', true);
      new.car_listing_id := v_unit;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_lead_new_car_unit on public.leads;
create trigger trg_lead_new_car_unit before update on public.leads
  for each row execute function public.new_car_unit_on_won();

-- 5. Undo sale on a unit: delete the unit, the lead goes back to the card ----
create or replace function public.undo_car_sale(p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_uid   uuid := auth.uid();
  v_role  text;
  v_car   car_listings%rowtype;
  v_leads uuid[];
  v_pkgs  int := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_car from car_listings where id = p_listing_id for update;
  if not found then raise exception 'not_found'; end if;
  select role into v_role from profiles where id = v_uid;
  if not (
       is_superadmin()
    or v_car.dealer_id = v_uid
    or (v_role in ('manager', 'admin') and v_car.dealer_id = get_my_dealer_id())
    or (v_role = 'salesman' and v_car.assigned_to = v_uid)
  ) then raise exception 'not_allowed'; end if;
  if v_car.status is distinct from 'sold' then raise exception 'not_sold'; end if;

  select array_agg(id) into v_leads from leads
   where car_listing_id = p_listing_id and stage in ('won', 'closed_won')
     and coalesce(is_deleted, false) = false;

  if v_leads is not null then
    select count(*) into v_pkgs from service_packages sp
     where sp.lead_id = any(v_leads)
        or sp.customer_id in (select id from customers where lead_id = any(v_leads));
    if v_pkgs > 0 then
      raise exception 'sale_has_service_packages'
        using hint = 'A service package was sold on this deal. Remove it before undoing the sale.';
    end if;
    delete from post_sale_tasks where lead_id = any(v_leads);
    delete from customers       where lead_id = any(v_leads);
    update leads set stage = 'negotiating', updated_at = now(),
                     car_listing_id = coalesce(v_car.new_car_card_id, car_listing_id)
     where id = any(v_leads);
  end if;

  if v_car.new_car_unit then
    -- A new-car unit only existed for that sale; relisting it would put a
    -- second copy of the card on the page.
    delete from car_listings where id = p_listing_id;
  else
    perform set_config('app.undo_sale', 'on', true);
    update car_listings set status = 'available', sold_at = null, sold_date = null where id = p_listing_id;
    perform set_config('app.undo_sale', '', true);
  end if;
  return jsonb_build_object('reopened_leads', coalesce(array_length(v_leads, 1), 0));
end;
$function$;

-- Trigger functions are not callable through the API; keep it that way.
revoke all on function public.new_car_card_fill() from public, anon, authenticated;
revoke all on function public.new_car_model_to_cards() from public, anon, authenticated;
revoke all on function public.new_car_cards_on_zone_change() from public, anon, authenticated;
revoke all on function public.new_car_unit_on_won() from public, anon, authenticated;
