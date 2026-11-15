-- 20261116c: four fixes found while testing brokers on 2026-11-15. QUEUED, not applied.
-- ONE migration = ONE API freeze. Apply after midnight Malaysia time with nobody live, or on the owner's "apply it now".
--
-- 1. guard_lead_win_price read `is_model_card` from the BASE table car_listings. That column only exists
--    on the view public_car_listings, so EVERY stage change on a lead that has a car raised 42703
--    ("column is_model_card does not exist"). Reproduced 2026-11-15 in a rolled-back probe.
-- 2. A solo seller's lead carries dealer_id = their own id (getDealerIdFromProfile), but the only
--    solo UPDATE policy needs dealer_id IS NULL. The update changed 0 rows with no error, so the stage
--    snapped back on refresh. Reproduced as the seller in a rolled-back probe (rows = 0).
-- 3. broker_mark_sold only stamped the registration. It never sold the dealer's car, so no customer,
--    no handover, no revenue or margin on Overview. It now closes the sale through the ONE won trigger.
-- 4. A buyer arriving on a broker's ?ref= link with no phone typed (the box is optional) made no
--    broker lead at all, because a registration needs a valid number. The broker now still gets the
--    lead (no hold is filed: there is no number to hold).

-- 1 ---------------------------------------------------------------------------------------------
create or replace function public.guard_lead_win_price()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_car    record;
  v_solo   boolean;
  v_dealer uuid;
begin
  if new.car_listing_id is null then return new; end if;
  -- is_model_card is a column of the VIEW only; on the table it is "has a model and is not a sold unit".
  select id, dealer_id, selling_price,
         (new_car_model_id is not null and coalesce(new_car_unit, false) = false) as is_model_card,
         new_car_model_id
    into v_car from public.car_listings where id = new.car_listing_id;
  if not found or v_car.is_model_card or v_car.new_car_model_id is not null then return new; end if;
  v_dealer := coalesce(new.dealer_id, v_car.dealer_id);
  select exists (select 1 from public.profiles p
                  where p.id = v_dealer and p.role = 'salesman' and p.dealer_id is null) into v_solo;
  if v_solo then return new; end if;
  if old.stage in ('won','closed_won') then
    if new.agreed_price is distinct from old.agreed_price
       and not public.can_approve_dealer_discount(v_dealer) then
      raise exception 'deal_closed' using hint = 'Only the dealer or a manager can change a closed deal''s price.';
    end if;
    return new;
  end if;
  if new.stage not in ('won','closed_won') then return new; end if;
  new.agreed_price := coalesce(new.agreed_price, v_car.selling_price);
  if new.agreed_price is not null and new.agreed_price <= 0 then
    raise exception 'bad_price';
  end if;
  if public.deal_discount_over_limit(v_dealer, v_car.selling_price, new.agreed_price)
     and not public.can_approve_dealer_discount(v_dealer)
     and not exists (select 1 from public.deal_price_approvals a
                      where a.lead_id = new.id and a.status = 'approved'
                        and a.agreed_price = new.agreed_price) then
    raise exception 'discount_needs_approval'
      using hint = 'This price is over the dealer''s discount limit. Use close_deal_at_price to ask for approval.';
  end if;
  return new;
end;
$function$;

-- 2 ---------------------------------------------------------------------------------------------
-- A standalone seller edits their OWN leads, whose dealer_id is their own id. Both columns must equal
-- the caller before AND after, so a seller can never hand a lead to anyone else or take one that is not theirs.
create policy leads_salesman_solo_update on public.leads
  for update to authenticated
  using (
    salesman_id = (select auth.uid())
    and dealer_id = (select auth.uid())
    and (select is_active_salesman())
    and not (select is_linked_salesman())
  )
  with check (
    salesman_id = (select auth.uid())
    and dealer_id = (select auth.uid())
    and (select is_active_salesman())
    and not (select is_linked_salesman())
  );

-- 3 ---------------------------------------------------------------------------------------------
create or replace function public.broker_mark_sold(p_reg uuid, p_commission numeric default null)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  r public.broker_registrations%rowtype;
  v_amt numeric; v_floor numeric;
  v_car_status text; v_lead uuid; v_closed boolean := false;
begin
  select * into r from public.broker_registrations where id = p_reg for update;
  if not found or not public.broker_is_dealer_owner(r.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if r.status <> 'registered' then
    return jsonb_build_object('ok', false, 'reason', 'bad_action');
  end if;
  if p_commission is not null and (p_commission < 0 or p_commission > 100000) then
    return jsonb_build_object('ok', false, 'reason', 'bad_commission');
  end if;
  v_floor := coalesce(r.commission_agreed,
    (select commission_default from public.dealer_brokers where dealer_id = r.dealer_id and broker_id = r.broker_id), 0);
  if p_commission is not null and p_commission < v_floor then
    return jsonb_build_object('ok', false, 'reason', 'below_agreed', 'agreed', v_floor);
  end if;
  v_amt := coalesce(p_commission, v_floor);

  -- Stamp the registration FIRST: when the lead below turns Won, broker_lead_sync finds nothing left
  -- in "registered" and stays out of the way (the dealer chose this amount, not the default).
  update public.broker_registrations
     set status = 'sold', sold_at = now(), commission_amount = v_amt, sold_by = 'dealer',
         sold_listing_id = r.listing_id where id = r.id;

  -- Close the sale on the dealer's side through the ONE won trigger (auto_create_customer_on_won):
  -- it flips the car to sold, makes the customer and seeds the handover. Nothing here writes a car
  -- status by hand. A car that is no longer for sale (sold to someone else) is left alone.
  select status into v_car_status from public.car_listings where id = r.listing_id and dealer_id = r.dealer_id;
  if found and v_car_status in ('available', 'reserved') then
    -- the lead the dealer already has for this buyer on THIS car, else a new one in the shared pool
    select id into v_lead from public.leads
     where dealer_id = r.dealer_id and coalesce(is_deleted, false) = false
       and (id = r.dealer_lead_id
            or (public.normalize_my_phone(phone) = r.buyer_phone and car_listing_id = r.listing_id))
       and (car_listing_id is null or car_listing_id = r.listing_id)
     order by (id = r.dealer_lead_id) desc nulls last, created_at desc
     limit 1;
    if v_lead is null then
      insert into public.leads (dealer_id, salesman_id, buyer_name, phone, stage, lead_source, car_listing_id, is_deleted, notes)
      values (r.dealer_id, null, r.buyer_name, r.buyer_phone, 'negotiating', 'referral', r.listing_id, false,
              'Sold through broker ' || public._broker_name(r.broker_id) || '.')
      returning id into v_lead;
    end if;
    update public.leads
       set car_listing_id = coalesce(car_listing_id, r.listing_id), stage = 'won'
     where id = v_lead and stage not in ('won', 'closed_won');
    update public.broker_registrations set dealer_lead_id = v_lead where id = r.id;
    v_closed := true;
  end if;

  insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
  values (r.broker_id, 'broker_sale', 'Your buyer bought the car',
          'The dealer confirmed the sale of ' || r.car_label || '. Commission owed: RM ' || round(v_amt) || '.', r.id);
  return jsonb_build_object('ok', true, 'commission', v_amt, 'car_closed', v_closed);
end $function$;

-- 4 ---------------------------------------------------------------------------------------------
create or replace function public._broker_capture(p_listing uuid, p_slug text, p_dealer_lead uuid, p_name text, p_phone text)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_broker uuid; res jsonb; v_phone text; v_name text; v_label text; v_dealer uuid; v_id uuid;
begin
  if p_listing is null or nullif(btrim(coalesce(p_slug, '')), '') is null then return; end if;
  v_broker := public._page_broker(p_slug, p_listing);
  if v_broker is null then return; end if;

  v_phone := public.normalize_my_phone(p_phone);
  if v_phone is null or v_phone !~ '^60[0-9]{8,10}$' then
    -- No usable number (the box on the car page is optional): nothing to hold, but the broker whose
    -- page the buyer used must still see the buyer. A repeat tap inside a day is the same buyer.
    v_name := nullif(btrim(coalesce(p_name, '')), '');
    if v_name is null then return; end if;
    select dealer_id, btrim(concat_ws(' ', year::text, brand, model, variant)) into v_dealer, v_label
      from public.car_listings where id = p_listing;
    if exists (select 1 from public.leads
                where salesman_id = v_broker and lower(btrim(coalesce(buyer_name, ''))) = lower(v_name)
                  and coalesce(is_deleted, false) = false and created_at > now() - interval '24 hours') then
      return;
    end if;
    insert into public.leads (dealer_id, salesman_id, buyer_name, phone, stage, lead_source, is_deleted, notes)
    values (v_broker, v_broker, v_name, null, 'new', 'whatsapp', false,
            'Asked about ' || coalesce(v_label, 'a dealer car') || ' on your page. This is '
            || public._broker_name(v_dealer) || '''s car. No phone number was given: reply on WhatsApp.')
    returning id into v_id;
    insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
    values (v_broker, 'broker_lead', 'A buyer asked about a dealer car on your page',
            coalesce(v_label, 'A dealer car') || '. Open Leads to contact them.', v_id);
    return;
  end if;

  res := public._broker_claim(v_broker, p_listing, p_name, p_phone, 'page', p_dealer_lead, null);
  if (res->>'ok')::boolean then
    insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
    values (v_broker, 'broker_lead', 'A buyer asked about a dealer car on your page',
            (res->>'label') || '. Open Leads to contact them.', (res->>'id')::uuid);
  end if;
exception when others then
  raise warning '_broker_capture: %', sqlerrm;
end $function$;
