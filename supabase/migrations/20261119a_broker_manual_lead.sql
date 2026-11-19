-- BROKER-5 (owner screenshot 2026-11-19: a buyer a broker registers by hand "needs to automatically go to lead stage new").
-- _broker_claim made the broker's own lead only when p_source = 'page', so the "Register buyer" form
-- (broker_register_buyer -> _broker_claim(..., 'manual', ...)) left the buyer out of the broker's Leads.
-- Fix: a manual registration makes the lead too (stage 'new', lead_source 'manual'), exactly like a page one.
-- The dealer-twin code below it then mirrors it onto the dealer's pipeline as before.
-- Same argument types, so CREATE OR REPLACE replaces the function (no second overload). Grants are kept.
-- No backfill: the only registrations with no broker lead are already SOLD (the dealer's lead is Won), and a
-- "new" lead on a sold buyer would be wrong.
CREATE OR REPLACE FUNCTION public._broker_claim(p_broker uuid, p_listing uuid, p_name text, p_phone text, p_source text, p_dealer_lead uuid, p_broker_lead uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  c record;
  v_phone text := public.normalize_my_phone(p_phone);
  v_name  text := btrim(coalesce(p_name, ''));
  v_label text;
  held public.broker_registrations%rowtype;
  v_id uuid;
  v_until timestamptz := now() + interval '14 days';
  v_comm numeric;
  v_blead uuid;
  v_reason text;
  v_dlead uuid;
  v_bstage text;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 or v_phone is null or v_phone !~ '^60[0-9]{8,10}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_details');
  end if;

  select dealer_id, status, assigned_to, new_car_model_id, year, brand, model, variant into c
    from public.car_listings where id = p_listing;
  if not found or c.dealer_id = p_broker or not public._broker_live(p_broker, c.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  if c.status <> 'available' or c.assigned_to is not null or c.new_car_model_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if (select count(*) from public.broker_registrations
       where broker_id = p_broker and registered_at > now() - interval '1 day') >= 30
     or (select count(*) from public.broker_audit
          where broker_id = p_broker and action = 'refused' and at > now() - interval '1 day') >= 40 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(c.dealer_id::text || ':' || v_phone, 0));

  select * into held from public.broker_registrations
   where dealer_id = c.dealer_id and buyer_phone = v_phone
     and status = 'registered' and hold_until > now()
   order by registered_at limit 1;
  if found then
    if held.broker_id = p_broker then
      return jsonb_build_object('ok', false, 'reason', 'mine', 'until', held.hold_until);
    end if;
    update public.broker_registrations set refused_count = refused_count + 1 where id = held.id;
    v_reason := 'held';
  elsif exists (select 1 from public.leads l
                 where l.dealer_id = c.dealer_id and coalesce(l.is_deleted, false) = false
                   and l.id is distinct from p_dealer_lead
                   and l.created_at > now() - interval '180 days'
                   and public.normalize_my_phone(l.phone) = v_phone)
     or exists (select 1 from public.broker_registrations r
                 where r.dealer_id = c.dealer_id and r.buyer_phone = v_phone
                   and r.registered_at > now() - interval '44 days') then
    v_reason := 'known';
  end if;
  if v_reason is not null then
    insert into public.broker_audit (dealer_id, broker_id, actor, action, detail)
    values (c.dealer_id, p_broker, auth.uid(), 'refused', jsonb_build_object('why', v_reason, 'source', p_source));
    return jsonb_build_object('ok', false, 'reason', v_reason,
                              'until', case when v_reason = 'held' then held.hold_until end);
  end if;

  select commission_default into v_comm from public.dealer_brokers
   where dealer_id = c.dealer_id and broker_id = p_broker;
  v_label := btrim(concat_ws(' ', c.year::text, c.brand, c.model, c.variant));

  insert into public.broker_registrations
    (dealer_id, broker_id, listing_id, car_label, buyer_name, buyer_phone, buyer_consented, hold_until,
     source, commission_agreed, dealer_lead_id)
  values (c.dealer_id, p_broker, p_listing, v_label, v_name, v_phone, true, v_until,
          p_source, coalesce(v_comm, 0), p_dealer_lead)
  returning id into v_id;

  if p_broker_lead is not null then
    select id into v_blead from public.leads
     where id = p_broker_lead and salesman_id = p_broker
       and (dealer_id is null or dealer_id = p_broker) and coalesce(is_deleted, false) = false;
  end if;
  if v_blead is null then
    select id into v_blead from public.leads
     where salesman_id = p_broker and (dealer_id is null or dealer_id = p_broker)
       and coalesce(is_deleted, false) = false
       and public.normalize_my_phone(phone) = v_phone
     order by created_at desc limit 1;
  end if;
  -- BROKER-5: was `and p_source = 'page'`. Every registration, by page or by hand, lands in the broker's Leads.
  if v_blead is null then
    insert into public.leads (dealer_id, salesman_id, buyer_name, phone, stage, lead_source, is_deleted, notes)
    values (p_broker, p_broker, v_name, v_phone, 'new',
            case when p_source = 'page' then 'whatsapp' else 'manual' end, false,
            case when p_source = 'page'
                 then 'Asked about ' || v_label || ' on your page. This is ' || public._broker_name(c.dealer_id) || '''s car.'
                 else 'You registered this buyer on ' || public._broker_name(c.dealer_id) || '''s ' || v_label || '.' end)
    returning id into v_blead;
  end if;
  if v_blead is not null then
    update public.broker_registrations set broker_lead_id = v_blead where id = v_id;
  end if;

  if v_blead is not null then
    v_dlead := p_dealer_lead;
    if v_dlead is null then
      select stage into v_bstage from public.leads where id = v_blead;
      insert into public.leads (dealer_id, salesman_id, buyer_name, phone, stage, lead_source, car_listing_id,
                                via_broker_id, is_deleted, notes)
      values (c.dealer_id, null, v_name, v_phone,
              case when v_bstage in ('won', 'closed_won', 'deposit_taken') then 'negotiating' else coalesce(v_bstage, 'new') end,
              'referral', p_listing, p_broker, false,
              'Broker ' || public._broker_name(p_broker) || '''s buyer. This lead moves with the broker''s stage.')
      returning id into v_dlead;
      update public.broker_registrations set dealer_lead_id = v_dlead where id = v_id;
    else
      update public.leads set via_broker_id = p_broker where id = v_dlead and via_broker_id is null;
    end if;
    perform set_config('app.broker_twin', 'on', true);
    update public.leads set broker_twin_id = v_dlead, dealer_car_id = coalesce(dealer_car_id, p_listing) where id = v_blead;
    perform set_config('app.broker_twin', '', true);
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'until', v_until, 'commission', coalesce(v_comm, 0),
                            'dealer_id', c.dealer_id, 'label', v_label, 'lead_id', v_blead);
end $function$;
