-- 20261116d: link a broker-page lead to its dealer car (broker side) and to its broker (dealer side). QUEUED, not applied.
-- Found 2026-11-15 on staging: a buyer who used a broker's ?ref= link without typing a phone number made
-- a lead on each side, but nothing joined them to the car or the broker (the join was broker_registrations,
-- which needs a phone). So the broker's lead said "No car linked" and the dealer's said "Unassigned".
--
--   leads.dealer_car_id  on the BROKER's lead: the dealer car the buyer asked about. A reference only;
--                        the lead's real car_listing_id stays empty (the database refuses another dealer's car
--                        there). The broker screen only reads it against the cars on their own page.
--   leads.via_broker_id  on the DEALER's lead: the broker whose page the buyer used. Display only: commission is
--                        still decided by broker_registrations, never by this column.

alter table public.leads
  add column if not exists dealer_car_id uuid references public.car_listings(id) on delete set null,
  add column if not exists via_broker_id uuid references public.profiles(id) on delete set null;

-- Registrations already join both sides: fill the columns for leads that exist today.
update public.leads l set via_broker_id = r.broker_id
  from public.broker_registrations r
 where r.dealer_lead_id = l.id and l.via_broker_id is null;
update public.leads l set dealer_car_id = r.listing_id
  from public.broker_registrations r
 where r.broker_lead_id = l.id and l.dealer_car_id is null and r.listing_id is not null;

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

  select dealer_id, btrim(concat_ws(' ', year::text, brand, model, variant)) into v_dealer, v_label
    from public.car_listings where id = p_listing;
  -- the dealer's own copy says which broker's page the buyer used (dealer screens name them)
  if p_dealer_lead is not null then
    update public.leads set via_broker_id = v_broker
     where id = p_dealer_lead and dealer_id = v_dealer and via_broker_id is null;
  end if;

  v_phone := public.normalize_my_phone(p_phone);
  if v_phone is null or v_phone !~ '^60[0-9]{8,10}$' then
    -- No usable number (the box on the car page is optional): nothing to hold, but the broker whose
    -- page the buyer used must still see the buyer, and the car. A repeat tap inside a day is the same buyer.
    v_name := nullif(btrim(coalesce(p_name, '')), '');
    if v_name is null then return; end if;
    if exists (select 1 from public.leads
                where salesman_id = v_broker and lower(btrim(coalesce(buyer_name, ''))) = lower(v_name)
                  and coalesce(is_deleted, false) = false and created_at > now() - interval '24 hours') then
      return;
    end if;
    insert into public.leads (dealer_id, salesman_id, buyer_name, phone, stage, lead_source, is_deleted, notes, dealer_car_id)
    values (v_broker, v_broker, v_name, null, 'new', 'whatsapp', false,
            'Asked about ' || coalesce(v_label, 'a dealer car') || ' on your page. This is '
            || public._broker_name(v_dealer) || '''s car. No phone number was given: reply on WhatsApp.', p_listing)
    returning id into v_id;
    insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
    values (v_broker, 'broker_lead', 'A buyer asked about a dealer car on your page',
            coalesce(v_label, 'A dealer car') || '. Open Leads to contact them.', v_id);
    return;
  end if;

  res := public._broker_claim(v_broker, p_listing, p_name, p_phone, 'page', p_dealer_lead, null);
  if (res->>'ok')::boolean then
    if nullif(res->>'lead_id', '') is not null then
      update public.leads set dealer_car_id = p_listing
       where id = (res->>'lead_id')::uuid and salesman_id = v_broker and dealer_car_id is null;
    end if;
    insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
    values (v_broker, 'broker_lead', 'A buyer asked about a dealer car on your page',
            (res->>'label') || '. Open Leads to contact them.', (res->>'id')::uuid);
  end if;
exception when others then
  raise warning '_broker_capture: %', sqlerrm;
end $function$;
