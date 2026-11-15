-- 20261116d: broker <-> dealer connection audit fixes (2026-11-15). QUEUED, not applied.
-- A. leads.dealer_car_id / leads.via_broker_id: join a broker-page lead to its car and its broker.
-- B. _page_broker needs the broker to have a WhatsApp number (else the buyer reaches the dealer and no lead is filed).
-- C. create_lead_from_booking files the broker's lead too (a booking on a broker's page went to the dealer only).
-- D. PIN-1: profiles.pinned_listing_ids (max 4) + set_my_pinned_listings + get_agent_pins.
--
-- (A) detail:
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
  add column if not exists dealer_car_id uuid,   -- NO foreign key: a second leads -> car_listings key makes every plain
  add column if not exists via_broker_id uuid;   -- `car_listings(...)` embed on leads ambiguous (PGRST201). See 20261116e.

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

-- B ---------------------------------------------------------------------------------------------
-- The buyer's WhatsApp tap goes to the broker's number (get_seller_whatsapp falls back to the DEALER's number when the
-- broker has none). If the broker has no number there is nobody to message, so no broker lead is filed either:
-- the two stay in step, and the dealer simply keeps a buyer who would have gone to a broker with no number.
create or replace function public._page_broker(p_slug text, p_listing uuid)
returns uuid
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select p.id
    from public.car_listings c
    join public.profiles p on p.slug = nullif(btrim(p_slug), '')
    join public.salesman_listings sl on sl.salesman_id = p.id and sl.listing_id = c.id
   where c.id = p_listing
     and c.dealer_id <> p.id
     and c.status = 'available' and c.assigned_to is null and c.new_car_model_id is null
     and coalesce(nullif(btrim(p.whatsapp_number), ''), nullif(btrim(p.phone), '')) is not null
     and public._broker_live(p.id, c.dealer_id)
   limit 1;
$function$;

-- C ---------------------------------------------------------------------------------------------
-- Same body as the live function plus ONE call: the broker whose page the booking came from gets their lead.
create or replace function public.create_lead_from_booking(
  p_dealer_id uuid, p_car_id uuid, p_name text, p_phone text default null, p_state text default null,
  p_ref_slug text default null, p_notes text default null, p_assigned_to uuid default null)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_notes text := nullif(btrim(left(coalesce(p_notes, ''), 600)), '');
  v_salesman uuid;
  v_existing uuid;
  v_id uuid;
  v_owner_plan text;
  v_recent integer;
begin
  if p_dealer_id is null or v_name is null then
    raise exception 'name and dealer are required';
  end if;

  -- ONE resolver for every inbound path. Do not inline this again.
  v_salesman := public.resolve_lead_salesman(p_dealer_id, p_car_id, p_ref_slug, null);
  if v_salesman is null then
    v_salesman := p_assigned_to;
  end if;

  -- Solo-panel gate (Lite AND Premium): a booking lands as a pending
  -- appointment only and becomes a lead when the salesman confirms it.
  if v_salesman is not null then
    select plan into v_owner_plan from profiles where id = v_salesman;
    if v_owner_plan in ('salesman_lite', 'salesman_full') then
      return null;
    end if;
  end if;

  if v_phone is not null then
    select id into v_existing from leads
     where dealer_id = p_dealer_id
       and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone
       and coalesce(is_deleted, false) = false
     order by created_at desc limit 1;
  else
    select id into v_existing from leads
     where dealer_id = p_dealer_id
       and lower(btrim(coalesce(buyer_name, ''))) = lower(v_name)
       and coalesce(car_listing_id::text, '') = coalesce(p_car_id::text, '')
       and coalesce(is_deleted, false) = false
       and created_at >= now() - interval '24 hours'
     order by created_at desc limit 1;
  end if;

  if v_existing is not null then
    -- Append, never replace: this is reachable by anyone holding the anon key,
    -- and the seller's own notes live in this column.
    update leads set
      car_listing_id = coalesce(p_car_id, car_listing_id),
      phone = coalesce(nullif(v_phone, ''), phone),
      buyer_state = coalesce(buyer_state, p_state),
      salesman_id = coalesce(salesman_id, v_salesman),
      stage = case when stage = 'new' then 'viewing_booked' else stage end,
      notes = case
                when v_notes is null then notes
                when notes is null or btrim(notes) = '' then v_notes
                when position(v_notes in notes) > 0 then notes
                else left(notes || E'\n' || v_notes, 4000)
              end,
      updated_at = now()
    where id = v_existing;
    perform public._broker_capture(p_car_id, p_ref_slug, v_existing, v_name, v_phone);
    return v_existing;
  end if;

  select count(*) into v_recent from leads
   where dealer_id = p_dealer_id
     and created_at > now() - interval '1 hour'
     and lead_source = 'enquiry';
  if v_recent >= 40 then
    raise exception 'rate_limited' using errcode = 'check_violation';
  end if;

  insert into leads (dealer_id, salesman_id, buyer_name, phone, buyer_state,
                     car_listing_id, stage, lead_source, notes, is_deleted)
  values (p_dealer_id, v_salesman, v_name, v_phone, p_state,
          p_car_id, 'viewing_booked', 'enquiry', v_notes, false)
  returning id into v_id;
  perform public._broker_capture(p_car_id, p_ref_slug, v_id, v_name, v_phone);
  return v_id;
end;
$function$;

-- D ---------------------------------------------------------------------------------------------
-- PIN-1: up to 4 cars a seller keeps first on their mini page. Stored on the profile, written ONLY by the function
-- (which checks every id is a car on this seller's own page); the CHECK keeps a direct write to 4 as well.
alter table public.profiles
  add column if not exists pinned_listing_ids uuid[] not null default '{}';
alter table public.profiles
  add constraint profiles_pinned_max4 check (cardinality(pinned_listing_ids) <= 4);

create or replace function public.set_my_pinned_listings(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare v_ids uuid[];
begin
  if auth.uid() is null
     or not exists (select 1 from public.profiles where id = auth.uid() and role = 'salesman' and dealer_id is null) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  -- de-duplicate, keeping the order the seller pinned them in
  select coalesce(array_agg(x order by o), '{}') into v_ids
    from (select x, min(o) as o from unnest(coalesce(p_ids, '{}')) with ordinality as t(x, o) group by x) d;
  if cardinality(v_ids) > 4 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;
  if exists (select 1 from unnest(v_ids) as i
              where not exists (select 1 from public.car_listings c
                                 where c.id = i
                                   and (c.dealer_id = auth.uid()
                                        or exists (select 1 from public.salesman_listings sl
                                                    where sl.listing_id = c.id and sl.salesman_id = auth.uid())))) then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;
  update public.profiles set pinned_listing_ids = v_ids where id = auth.uid();
  return jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids));
end $function$;

-- The public page reads the pins on their own (like get_agent_about), Premium pages only.
create or replace function public.get_agent_pins(p_slug text)
returns uuid[]
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(p.pinned_listing_ids, '{}')
    from public.profiles p
   where p.slug = nullif(btrim(p_slug), '')
     and p.role = 'salesman'
     and coalesce(p.is_active, false) and p.suspended_at is null
     and p.account_status is distinct from 'deleted'
     and public.salesman_has_full_page(p.id)
   limit 1;
$function$;

-- Supabase grants new functions to anon directly: the write function is for signed-in sellers only.
revoke all on function public.set_my_pinned_listings(uuid[]) from public, anon;
grant execute on function public.set_my_pinned_listings(uuid[]) to authenticated;
grant execute on function public.get_agent_pins(text) to anon, authenticated;
