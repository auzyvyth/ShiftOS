-- 20261116f: the dealer's copy of a broker's lead follows the broker's progress. QUEUED, not applied.
-- Owner, 2026-11-15: "dealer crm does not auto update the lead stage, should do".
--
-- Rules (the two businesses stay apart; this only keeps the dealer's board honest):
--   * only a BROKER's own lead (a standalone seller, dealer_id = themselves) mirrors, and only to the dealer
--     lead it was filed against (leads.dealer_lead_ref, else the registration's dealer_lead_id);
--   * only the pre-sale steps mirror: contacted, viewing_booked, test_drive, negotiating;
--   * forward only: the dealer's lead never goes backwards, and one a dealer's own salesman is working
--     (salesman_id set) is never touched;
--   * NEVER mirrored: deposit_taken (it reserves the dealer's car), won (the dealer approves a sale claim)
--     and lost. A broker cannot reserve, sell or close a dealer's car by moving their own lead.
--   * the dealer's lead gets a history line "Moved by broker <name>".

-- A plain column, NO foreign key (a second leads -> car_listings key broke every embed once, see 20261116e).
alter table public.leads add column if not exists dealer_lead_ref uuid;

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
  if p_dealer_lead is not null then
    update public.leads set via_broker_id = v_broker
     where id = p_dealer_lead and dealer_id = v_dealer and via_broker_id is null;
  end if;

  v_phone := public.normalize_my_phone(p_phone);
  if v_phone is null or v_phone !~ '^60[0-9]{8,10}$' then
    v_name := nullif(btrim(coalesce(p_name, '')), '');
    if v_name is null then return; end if;
    if exists (select 1 from public.leads
                where salesman_id = v_broker and lower(btrim(coalesce(buyer_name, ''))) = lower(v_name)
                  and coalesce(is_deleted, false) = false and created_at > now() - interval '24 hours') then
      return;
    end if;
    insert into public.leads (dealer_id, salesman_id, buyer_name, phone, stage, lead_source, is_deleted, notes, dealer_car_id, dealer_lead_ref)
    values (v_broker, v_broker, v_name, null, 'new', 'whatsapp', false,
            'Asked about ' || coalesce(v_label, 'a dealer car') || ' on your page. This is '
            || public._broker_name(v_dealer) || '''s car. No phone number was given: reply on WhatsApp.', p_listing, p_dealer_lead)
    returning id into v_id;
    insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
    values (v_broker, 'broker_lead', 'A buyer asked about a dealer car on your page',
            coalesce(v_label, 'A dealer car') || '. Open Leads to contact them.', v_id);
    return;
  end if;

  res := public._broker_claim(v_broker, p_listing, p_name, p_phone, 'page', p_dealer_lead, null);
  if (res->>'ok')::boolean then
    if nullif(res->>'lead_id', '') is not null then
      update public.leads set dealer_car_id = p_listing, dealer_lead_ref = coalesce(dealer_lead_ref, p_dealer_lead)
       where id = (res->>'lead_id')::uuid and salesman_id = v_broker;
    end if;
    insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
    values (v_broker, 'broker_lead', 'A buyer asked about a dealer car on your page',
            (res->>'label') || '. Open Leads to contact them.', (res->>'id')::uuid);
  end if;
exception when others then
  raise warning '_broker_capture: %', sqlerrm;
end $function$;

create or replace function public.broker_stage_mirror()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare v_to int; v_target uuid; v_old text;
begin
  if new.stage is not distinct from old.stage then return null; end if;
  v_to := case new.stage when 'contacted' then 1 when 'viewing_booked' then 2 when 'test_drive' then 3 when 'negotiating' then 4 else null end;
  if v_to is null then return null; end if;
  if new.salesman_id is null or new.dealer_id is distinct from new.salesman_id then return null; end if;
  if not exists (select 1 from public.profiles p
                  where p.id = new.salesman_id and p.role = 'salesman' and p.dealer_id is null and p.seller_type = 'broker') then
    return null;
  end if;
  v_target := coalesce(new.dealer_lead_ref,
    (select r.dealer_lead_id from public.broker_registrations r
      where r.broker_lead_id = new.id and r.dealer_lead_id is not null
      order by r.registered_at desc limit 1));
  if v_target is null then return null; end if;

  select stage into v_old from public.leads t
   where t.id = v_target and t.dealer_id is distinct from new.salesman_id
     and coalesce(t.is_deleted, false) = false and t.salesman_id is null
     and (case t.stage when 'new' then 0 when 'contacted' then 1 when 'viewing_booked' then 2 when 'test_drive' then 3 else 99 end) < v_to;
  if v_old is null then return null; end if;

  update public.leads set stage = new.stage where id = v_target;
  insert into public.lead_activities (lead_id, activity_type, from_stage, to_stage, note, dealer_id)
  select v_target, 'stage_changed', v_old, new.stage, 'Moved by broker ' || public._broker_name(new.salesman_id), t.dealer_id
    from public.leads t where t.id = v_target;
  return null;
exception when others then
  raise warning 'broker_stage_mirror: %', sqlerrm;
  return null;
end $function$;

create trigger trg_zz_broker_stage_mirror
  after update of stage on public.leads
  for each row execute function public.broker_stage_mirror();
