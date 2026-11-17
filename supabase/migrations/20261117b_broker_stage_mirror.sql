-- BROKER-4 (owner, 2026-11-17): a broker's buyer on a dealer car moves on the dealer's board like a
-- linked salesman's lead does. Owner: "make it work just like how their salesman does, should move with
-- the broker's stage, but ofc with some restrictions: when the broker updates to won, the dealer has to
-- approve it first, only then it goes into won leads on the broker's side".
--
-- Found 2026-11-17: a buyer who asks on a broker's page gets TWO lead rows (the broker's own copy and the
-- dealer's), and nothing tied them, so the broker moved theirs to Contacted and the dealer's sat in New.
--
-- 1. leads.broker_twin_id (on the BROKER's lead) = the dealer's lead for the same buyer.
--    leads.won_requested_at = the broker pressed Won and the dealer has not answered (set on both rows).
--    Only definer code writes either (session flag app.broker_twin); a browser write is reverted, or a
--    broker could point their lead at any dealer lead and steer it.
-- 2. The broker moves their lead -> the dealer's lead takes the same stage. Restrictions:
--      Won           -> held: the broker's lead keeps its stage, both rows get won_requested_at, the
--                       dealer is notified. Nothing is sold.
--      Deposit taken -> the dealer's lead goes to Negotiating, never Deposit taken: that stage reserves
--                       the dealer's car (sync_car_reservation_on_lead_stage).
--      A dealer lead that is already Won is never moved.
--    One way only: the dealer's own stage changes do not move the broker's lead, except Won / undo.
-- 3. dealer_decide_broker_won(lead, approve): the dealer owner answers. Approve = the dealer's lead goes
--    Won (the won trigger sells the car, makes the customer + handover, broker_lead_sync owes the
--    commission), and then the broker's lead goes Won. Reject = both requests cleared, broker told.
--    A dealer who marks the lead Won themselves counts as approval too; Undo sale puts the broker's
--    lead back to Negotiating.
-- 4. _broker_capture / _broker_claim link the two rows when they are made; a manual registration on a
--    lead of the broker's now gets a dealer copy too (it had none, so the dealer never saw the buyer).
--    Backfill links the pairs that exist.
--
-- APPLIED 2026-11-17 ~12:05 UTC (owner: "apply all the migrations now"). Fixed by 20261117d.

begin;

alter table public.leads
  add column if not exists broker_twin_id uuid,  -- plain column, NO foreign key: a second key on leads broke every embed once (20261116e)
  add column if not exists won_requested_at timestamptz;
create index if not exists leads_broker_twin_id_idx on public.leads (broker_twin_id) where broker_twin_id is not null;

-- ── BEFORE: guard the two columns, hold Won, mirror every other stage ────────────────────────────
create or replace function public.broker_twin_before()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_flag boolean := coalesce(current_setting('app.broker_twin', true), '') = 'on';
  v_mapped text;
  d public.leads%rowtype;
begin
  if not v_flag then
    if tg_op = 'INSERT' then
      new.broker_twin_id := null;
      new.won_requested_at := null;
      return new;
    end if;
    new.broker_twin_id := old.broker_twin_id;
    new.won_requested_at := old.won_requested_at;
  end if;

  if tg_op <> 'UPDATE' or v_flag or new.broker_twin_id is null
     or new.stage is not distinct from old.stage then
    return new;
  end if;

  -- The dealer's row, only while it is really this broker's buyer on that dealer's car.
  select * into d from public.leads
   where id = new.broker_twin_id and via_broker_id = new.salesman_id
     and coalesce(is_deleted, false) = false;
  if not found then return new; end if;

  if new.stage in ('won', 'closed_won') then
    new.stage := old.stage;                       -- held until the dealer approves
    if old.won_requested_at is null and d.stage not in ('won', 'closed_won') then
      new.won_requested_at := now();
      perform set_config('app.broker_twin', 'on', true);
      update public.leads set won_requested_at = now() where id = d.id;
      perform set_config('app.broker_twin', '', true);
      insert into public.dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
      values (d.dealer_id, 'broker_won_request', 'A broker says their buyer bought the car',
              public._broker_name(new.salesman_id) || ' marked ' || coalesce(d.buyer_name, 'their buyer')
              || ' as Won. Open the lead to approve or reject it.', 'crm', d.id);
    end if;
    return new;
  end if;

  -- Any other stage: the broker changed their mind about Won, and the dealer's row follows.
  new.won_requested_at := null;
  v_mapped := case when new.stage = 'deposit_taken' then 'negotiating' else new.stage end;
  -- Lost on a lead un-reserves its car (sync_car_reservation_on_lead_stage); a broker's buyer never
  -- reserved it (Deposit maps to Negotiating), so a broker's Lost must not free a car someone else holds.
  if v_mapped in ('lost', 'closed_lost') and exists (
       select 1 from public.car_listings where id = d.car_listing_id and status = 'reserved') then
    return new;
  end if;
  if d.stage not in ('won', 'closed_won') then
    perform set_config('app.broker_twin', 'on', true);
    update public.leads
       set stage = v_mapped, won_requested_at = null, updated_at = now()
     where id = d.id and (stage is distinct from v_mapped or won_requested_at is not null);
    perform set_config('app.broker_twin', '', true);
  end if;
  return new;
end $$;

drop trigger if exists trg_a0_broker_twin on public.leads;
create trigger trg_a0_broker_twin
  before insert or update on public.leads
  for each row execute function public.broker_twin_before();

-- ── AFTER: the dealer's lead went Won (approval) or left Won (undo) ─────────────────────────────
-- Named to run after trg_zz_broker_lead_sync, so the registration is already "sold" when the broker's
-- lead goes Won and broker_claim_on_won finds nothing left to claim.
create or replace function public.broker_twin_after()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare b record;
begin
  if new.via_broker_id is null then return null; end if;
  if new.stage in ('won', 'closed_won') and coalesce(old.stage, '') not in ('won', 'closed_won') then
    perform set_config('app.broker_twin', 'on', true);
    for b in update public.leads
                set stage = 'won', won_requested_at = null, updated_at = now()
              where broker_twin_id = new.id and stage not in ('won', 'closed_won')
              returning id, salesman_id
    loop
      insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
      values (b.salesman_id, 'broker_won_approved', 'The dealer confirmed your sale',
              coalesce(new.buyer_name, 'Your buyer') || ' is now Won.', b.id);
    end loop;
    update public.leads set won_requested_at = null where id = new.id and won_requested_at is not null;
    perform set_config('app.broker_twin', '', true);
  elsif coalesce(old.stage, '') in ('won', 'closed_won') and new.stage not in ('won', 'closed_won') then
    perform set_config('app.broker_twin', 'on', true);
    update public.leads set stage = 'negotiating', updated_at = now()
     where broker_twin_id = new.id and stage in ('won', 'closed_won');
    perform set_config('app.broker_twin', '', true);
  end if;
  return null;
exception when others then
  perform set_config('app.broker_twin', '', true);
  raise warning 'broker_twin_after: %', sqlerrm;
  return null;
end $$;

drop trigger if exists trg_zzz_broker_twin_won on public.leads;
create trigger trg_zzz_broker_twin_won
  after update of stage on public.leads
  for each row when (new.stage is distinct from old.stage)
  execute function public.broker_twin_after();

-- ── The dealer's answer ──────────────────────────────────────────────────────────────────────────
create or replace function public.dealer_decide_broker_won(p_lead uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  d public.leads%rowtype;
  v_broker_lead uuid; v_broker uuid;
begin
  if p_approve is null then return jsonb_build_object('ok', false, 'reason', 'bad_action'); end if;
  select * into d from public.leads where id = p_lead for update;
  if not found or not public.broker_is_dealer_owner(d.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  select id, salesman_id into v_broker_lead, v_broker from public.leads
   where broker_twin_id = d.id and won_requested_at is not null
   order by won_requested_at limit 1;
  if v_broker_lead is null then
    return jsonb_build_object('ok', false, 'reason', 'no_request');
  end if;

  if p_approve then
    if d.car_listing_id is null then return jsonb_build_object('ok', false, 'reason', 'no_car'); end if;
    begin
      update public.leads set stage = 'won', updated_at = now() where id = d.id;  -- broker_twin_after finishes the broker's side
    exception when others then
      if sqlerrm like '%car_already_won%' then return jsonb_build_object('ok', false, 'reason', 'car_already_won'); end if;
      raise;
    end;
    return jsonb_build_object('ok', true, 'stage', 'won');
  end if;

  perform set_config('app.broker_twin', 'on', true);
  update public.leads set won_requested_at = null where id in (d.id, v_broker_lead);
  perform set_config('app.broker_twin', '', true);
  insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
  values (v_broker, 'broker_won_rejected', 'The dealer did not confirm the sale',
          'The dealer says ' || coalesce(d.buyer_name, 'your buyer') || ' has not bought yet. Talk to them.', v_broker_lead);
  return jsonb_build_object('ok', true, 'stage', d.stage);
end $$;

revoke all on function public.dealer_decide_broker_won(uuid, boolean) from public;
revoke all on function public.dealer_decide_broker_won(uuid, boolean) from anon;
grant execute on function public.dealer_decide_broker_won(uuid, boolean) to authenticated;

-- ── Link the rows when they are made ────────────────────────────────────────────────────────────
-- _broker_capture: verbatim from the live DB except the no-phone insert now carries broker_twin_id.
CREATE OR REPLACE FUNCTION public._broker_capture(p_listing uuid, p_slug text, p_dealer_lead uuid, p_name text, p_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
    perform set_config('app.broker_twin', 'on', true);
    insert into public.leads (dealer_id, salesman_id, buyer_name, phone, stage, lead_source, is_deleted, notes, dealer_car_id, broker_twin_id)
    values (v_broker, v_broker, v_name, null, 'new', 'whatsapp', false,
            'Asked about ' || coalesce(v_label, 'a dealer car') || ' on your page. This is '
            || public._broker_name(v_dealer) || '''s car. No phone number was given: reply on WhatsApp.', p_listing,
            (select id from public.leads where id = p_dealer_lead and dealer_id = v_dealer and via_broker_id = v_broker))
    returning id into v_id;
    perform set_config('app.broker_twin', '', true);
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
  perform set_config('app.broker_twin', '', true);
  raise warning '_broker_capture: %', sqlerrm;
end $function$;

-- _broker_claim: verbatim from the live DB except the block after "-- BROKER-4" at the end.
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
  -- 30 registrations a day, and 40 refused tries a day: a refusal says "this number is already
  -- with the dealer", so unlimited tries would be a way to test numbers against a dealer's list.
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
  -- The dealer already knows this buyer: an earlier lead of theirs, or any registration in the
  -- last 44 days (the 14-day hold + 30). First contact wins; a hold cannot be renewed forever.
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

  -- The broker's own copy of the buyer, in the broker's own pipeline. The lead the broker picked
  -- (manual), else one they already have for this number, else a new one.
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
  if v_blead is null and p_source = 'page' then
    insert into public.leads (dealer_id, salesman_id, buyer_name, phone, stage, lead_source, is_deleted, notes)
    values (p_broker, p_broker, v_name, v_phone, 'new', 'whatsapp', false,
            'Asked about ' || v_label || ' on your page. This is ' || public._broker_name(c.dealer_id) || '''s car.')
    returning id into v_blead;
  end if;
  if v_blead is not null then
    update public.broker_registrations set broker_lead_id = v_blead where id = v_id;
  end if;

  -- BROKER-4: the dealer's copy of the buyer, tied to the broker's, so it moves with the broker's stage.
  -- A page enquiry already made one (p_dealer_lead); a manual registration gets one here.
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

-- ── Backfill the pairs that exist ────────────────────────────────────────────────────────────────
select set_config('app.broker_twin', 'on', true);
-- a) registrations that hold both rows
update public.leads b set broker_twin_id = r.dealer_lead_id
  from public.broker_registrations r
 where r.broker_lead_id = b.id and r.dealer_lead_id is not null and b.broker_twin_id is null;
update public.leads d set via_broker_id = r.broker_id
  from public.broker_registrations r
 where r.dealer_lead_id = d.id and d.via_broker_id is null;
-- b) page enquiries with no phone: same broker, same car, made in the same second
update public.leads b set broker_twin_id = d.id
  from public.leads d
 where b.broker_twin_id is null and b.dealer_car_id is not null and b.salesman_id = b.dealer_id
   and d.via_broker_id = b.salesman_id and d.car_listing_id = b.dealer_car_id
   and abs(extract(epoch from (d.created_at - b.created_at))) < 5
   and coalesce(b.is_deleted, false) = false and coalesce(d.is_deleted, false) = false;
-- c) bring the dealer's rows level with the broker's stage now (never Won / Deposit, never a sold row)
update public.leads d
   set stage = case when b.stage in ('won', 'closed_won', 'deposit_taken') then 'negotiating' else b.stage end
  from public.leads b
 where b.broker_twin_id = d.id and d.stage not in ('won', 'closed_won')
   and d.stage is distinct from case when b.stage in ('won', 'closed_won', 'deposit_taken') then 'negotiating' else b.stage end;
select set_config('app.broker_twin', '', true);

commit;
