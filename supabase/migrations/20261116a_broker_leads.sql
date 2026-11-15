-- BROKER-2 (owner, 2026-11-15): a buyer who comes through a broker's page reaches the BROKER,
-- and the broker network is hardened against both sides cheating.
-- QUEUED: apply after midnight MYT with nobody live. One migration, one API freeze.
--
-- Shape: the two businesses stay apart. A broker never reads or writes the dealer's leads.
--   dealer's lead  (leads, dealer_id = dealer)   unchanged, the dealer's own record
--   registration   (broker_registrations)        the claim: who brought the buyer, when, for how much
--   broker's lead  (leads, dealer_id = broker)   the broker's own copy, to work the buyer
--
-- Rules added (each closes a way to cheat):
--  1 commission is fixed at registration (commission_agreed); the dealer cannot confirm below it
--  2 a Won on the dealer's side credits the broker by itself; the dealer cannot "forget"
--  3 a claim tied to the dealer's lead lasts 90 days, so stalling past the 14-day hold pays anyway
--  4 a buyer the dealer already knows cannot be registered (staff with a side account)
--  5 refused tries are counted and capped (no testing phone numbers against a dealer's list)
--  6 a commission change reaches the broker as a notification and only affects new buyers
--  7 a broker's Won on a dealer's buyer files a sale claim; money is owed only when the dealer approves it
--  8 every change is written to broker_audit, which nobody can edit

-- ── columns ──────────────────────────────────────────────────────────────────
alter table public.broker_registrations
  add column if not exists source text not null default 'manual',
  add column if not exists commission_agreed numeric,
  add column if not exists dealer_lead_id uuid references public.leads(id) on delete set null,
  add column if not exists broker_lead_id uuid references public.leads(id) on delete set null,
  add column if not exists sold_by text,
  add column if not exists sold_listing_id uuid references public.car_listings(id) on delete set null,
  add column if not exists sale_claimed_at timestamptz,
  add column if not exists claim_disputed_at timestamptz;

alter table public.broker_registrations
  add constraint broker_registrations_source_check check (source in ('manual', 'page')),
  add constraint broker_registrations_commission_agreed_check
    check (commission_agreed is null or (commission_agreed >= 0 and commission_agreed <= 100000)),
  add constraint broker_registrations_sold_by_check check (sold_by is null or sold_by in ('dealer', 'auto'));

create index if not exists broker_registrations_dealer_lead_idx
  on public.broker_registrations (dealer_lead_id) where dealer_lead_id is not null;
create index if not exists broker_registrations_broker_lead_idx
  on public.broker_registrations (broker_lead_id) where broker_lead_id is not null;

-- ── audit: append-only, no buyer data in it ──────────────────────────────────
create table if not exists public.broker_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  dealer_id uuid not null,
  broker_id uuid not null,
  reg_id uuid,
  actor uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists broker_audit_pair_idx on public.broker_audit (dealer_id, broker_id, at desc);
create index if not exists broker_audit_actor_idx on public.broker_audit (actor, at desc);
alter table public.broker_audit enable row level security;
revoke all on public.broker_audit from public, anon, authenticated;
grant select on public.broker_audit to authenticated;
drop policy if exists broker_audit_select on public.broker_audit;
create policy broker_audit_select on public.broker_audit for select to authenticated
  using (broker_id = (select auth.uid()) or public.broker_is_dealer_owner(dealer_id));

create or replace function public.broker_audit_reg() returns trigger
language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.broker_audit (dealer_id, broker_id, reg_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, new.id, auth.uid(), 'registered',
            jsonb_build_object('source', new.source, 'commission_agreed', new.commission_agreed, 'hold_until', new.hold_until));
    return null;
  end if;
  if new.status is distinct from old.status then
    insert into public.broker_audit (dealer_id, broker_id, reg_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, new.id, auth.uid(),
            case when new.status = 'sold' then 'sold' else 'sale_undone' end,
            jsonb_build_object('commission', new.commission_amount, 'sold_by', new.sold_by));
  end if;
  if new.sale_claimed_at is distinct from old.sale_claimed_at then
    insert into public.broker_audit (dealer_id, broker_id, reg_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, new.id, auth.uid(),
            case when new.sale_claimed_at is null then 'claim_cleared' else 'sale_claimed' end, '{}'::jsonb);
  end if;
  if new.claim_disputed_at is distinct from old.claim_disputed_at and new.claim_disputed_at is not null then
    insert into public.broker_audit (dealer_id, broker_id, reg_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, new.id, auth.uid(), 'claim_disputed', '{}'::jsonb);
  end if;
  if new.paid_at is distinct from old.paid_at then
    insert into public.broker_audit (dealer_id, broker_id, reg_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, new.id, auth.uid(), 'marked_paid',
            jsonb_build_object('commission', new.commission_amount));
  end if;
  return null;
end $$;
drop trigger if exists trg_broker_audit_reg on public.broker_registrations;
create trigger trg_broker_audit_reg after insert or update on public.broker_registrations
  for each row execute function public.broker_audit_reg();

-- A connection change is logged; a commission change also reaches the broker (it was silent).
create or replace function public.broker_audit_conn() returns trigger
language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.broker_audit (dealer_id, broker_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, auth.uid(), 'connection_' || new.status,
            jsonb_build_object('commission', new.commission_default, 'requested_by', new.requested_by));
    return null;
  end if;
  if new.status is distinct from old.status then
    insert into public.broker_audit (dealer_id, broker_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, auth.uid(), 'connection_' || new.status,
            jsonb_build_object('from', old.status));
  end if;
  if new.commission_default is distinct from old.commission_default then
    insert into public.broker_audit (dealer_id, broker_id, actor, action, detail)
    values (new.dealer_id, new.broker_id, auth.uid(), 'commission_changed',
            jsonb_build_object('from', old.commission_default, 'to', new.commission_default));
    if old.status in ('active', 'paused') then
      begin
        insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
        values (new.broker_id, 'broker_commission', 'A dealer changed your commission',
                public._broker_name(new.dealer_id) || ': RM ' || round(coalesce(old.commission_default, 0))
                || ' to RM ' || round(coalesce(new.commission_default, 0))
                || ' for new buyers. Buyers you already registered keep the old amount.', new.dealer_id);
      exception when others then raise warning 'broker_audit_conn notify: %', sqlerrm;
      end;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_broker_audit_conn on public.dealer_brokers;
create trigger trg_broker_audit_conn after insert or update on public.dealer_brokers
  for each row execute function public.broker_audit_conn();

-- The claim's terms can never be edited afterwards, by anyone.
create or replace function public.broker_reg_lock() returns trigger
language plpgsql set search_path to 'pg_catalog', 'public' as $$
begin
  if new.dealer_id         is distinct from old.dealer_id
  or new.broker_id         is distinct from old.broker_id
  or new.buyer_name        is distinct from old.buyer_name
  or new.buyer_phone       is distinct from old.buyer_phone
  or new.buyer_consented   is distinct from old.buyer_consented
  or new.registered_at     is distinct from old.registered_at
  or new.hold_until        is distinct from old.hold_until
  or new.source            is distinct from old.source
  or new.commission_agreed is distinct from old.commission_agreed then
    raise exception 'broker_registration_locked' using errcode = '42501';
  end if;
  return new;
end $$;

-- ── who is a live broker (by id: the page paths have no session) ─────────────
create or replace function public._broker_live(p_broker uuid, p_dealer uuid) returns boolean
language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select exists (select 1 from public.profiles p
                  where p.id = p_broker and p.role = 'salesman' and p.dealer_id is null
                    and coalesce(p.is_active, false) and p.suspended_at is null
                    and p.account_status is distinct from 'deleted')
     and public.salesman_has_full_page(p_broker)
     and exists (select 1 from public.dealer_brokers b
                  where b.dealer_id = p_dealer and b.broker_id = p_broker and b.status = 'active')
     and public._dealer_in_good_standing(p_dealer);
$$;

-- The broker whose page (?ref=) a buyer used for this dealer car, or NULL. The car must be on
-- that broker's page and still open to brokers.
create or replace function public._page_broker(p_slug text, p_listing uuid) returns uuid
language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select p.id
    from public.car_listings c
    join public.profiles p on p.slug = nullif(btrim(p_slug), '')
    join public.salesman_listings sl on sl.salesman_id = p.id and sl.listing_id = c.id
   where c.id = p_listing
     and c.dealer_id <> p.id
     and c.status = 'available' and c.assigned_to is null and c.new_car_model_id is null
     and public._broker_live(p.id, c.dealer_id)
   limit 1;
$$;

-- ── ONE claim rule, used by the manual registration and by the broker's page ─
create or replace function public._broker_claim(
  p_broker uuid, p_listing uuid, p_name text, p_phone text,
  p_source text, p_dealer_lead uuid, p_broker_lead uuid
) returns jsonb
language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
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

  return jsonb_build_object('ok', true, 'id', v_id, 'until', v_until, 'commission', coalesce(v_comm, 0),
                            'dealer_id', c.dealer_id, 'label', v_label, 'lead_id', v_blead);
end $$;

-- Manual registration. p_lead = the broker's own lead this buyer is (from "Link a car").
drop function if exists public.broker_register_buyer(uuid, text, text, boolean);
create or replace function public.broker_register_buyer(
  p_listing uuid, p_name text, p_phone text, p_consent boolean, p_lead uuid default null
) returns jsonb
language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare res jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  if not coalesce(p_consent, false) then
    return jsonb_build_object('ok', false, 'reason', 'consent_required');
  end if;
  res := public._broker_claim(auth.uid(), p_listing, p_name, p_phone, 'manual', null, p_lead);
  if (res->>'ok')::boolean then
    insert into public.dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
    values ((res->>'dealer_id')::uuid, 'broker_buyer', 'A broker registered a buyer',
            public._broker_name(auth.uid()) || ' on your ' || (res->>'label'), 'team', (res->>'id')::uuid);
  end if;
  return res - 'dealer_id' - 'label';
end $$;

-- A buyer used a broker's page for a dealer car and a NEW dealer lead was made: file the claim
-- and tell the broker. Never fails the lead it rides on. Pushes carry no buyer name or number.
create or replace function public._broker_capture(
  p_listing uuid, p_slug text, p_dealer_lead uuid, p_name text, p_phone text
) returns void
language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare v_broker uuid; res jsonb;
begin
  if p_listing is null or nullif(btrim(coalesce(p_slug, '')), '') is null then return; end if;
  v_broker := public._page_broker(p_slug, p_listing);
  if v_broker is null then return; end if;
  res := public._broker_claim(v_broker, p_listing, p_name, p_phone, 'page', p_dealer_lead, null);
  if (res->>'ok')::boolean then
    insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
    values (v_broker, 'broker_lead', 'A buyer asked about a dealer car on your page',
            (res->>'label') || '. Open Leads to contact them.', (res->>'id')::uuid);
  end if;
exception when others then
  raise warning '_broker_capture: %', sqlerrm;
end $$;

-- ── the buyer's WhatsApp on a broker's page opens the BROKER's number ────────
create or replace function public.get_seller_whatsapp(
  p_listing_id uuid default null, p_slug text default null, p_seller_id uuid default null
) returns text
language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_dealer uuid; v_status text; v_who uuid; v_num text;
begin
  if p_listing_id is not null then
    select dealer_id, status into v_dealer, v_status from car_listings where id = p_listing_id;
    if v_dealer is null or (v_status is distinct from 'available' and v_status is distinct from 'reserved')
       or not public.is_dealer_active(v_dealer) then
      return null;
    end if;
    v_who := public._page_broker(p_slug, p_listing_id);
    if v_who is null then
      v_who := public.resolve_lead_salesman(v_dealer, p_listing_id, nullif(btrim(p_slug), ''), null);
    end if;
    if v_who is not null then
      select coalesce(nullif(btrim(whatsapp_number), ''), nullif(btrim(phone), ''))
        into v_num from profiles where id = v_who;
    end if;
    if v_num is null then
      select coalesce(nullif(btrim(whatsapp_number), ''), nullif(btrim(phone), ''))
        into v_num from profiles where id = v_dealer;
    end if;
    return v_num;
  end if;

  select coalesce(nullif(btrim(p.whatsapp_number), ''), nullif(btrim(p.phone), ''))
    into v_num
    from profiles p
   where ((p_slug is not null and p.slug = p_slug and p.role = 'salesman')
       or (p_slug is null and p_seller_id is not null and p.id = p_seller_id
           and p.role in ('salesman', 'dealer', 'owner')))
     and p.is_active = true
     and p.suspended_at is null
     and coalesce(p.account_status, 'active') <> 'deleted'
     and p.deleted_at is null
   limit 1;
  return v_num;
end;
$$;

-- ── the two lead makers call the capture when they create a NEW lead ─────────
create or replace function public.create_lead_from_whatsapp(
  p_dealer_id uuid, p_name text, p_phone text, p_state text, p_car_id uuid, p_ref_slug text
) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare
  v_phone text := public.normalize_my_phone(p_phone);
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_state text := nullif(btrim(coalesce(p_state, '')), '');
  v_car uuid;
  v_salesman uuid;
  v_existing uuid;
  v_id uuid;
  v_recent integer;
begin
  if p_dealer_id is null or v_name is null then
    raise exception 'name and dealer are required';
  end if;
  if not exists (select 1 from profiles
                  where id = p_dealer_id and is_active
                    and coalesce(account_status, 'active') <> 'deleted') then
    raise exception 'dealer_inactive' using errcode = 'check_violation';
  end if;
  select id into v_car from car_listings where id = p_car_id and dealer_id = p_dealer_id;
  v_salesman := public.resolve_lead_salesman(p_dealer_id, v_car, p_ref_slug, null);
  if v_phone is not null then
    select id into v_existing from leads
     where dealer_id = p_dealer_id
       and public.normalize_my_phone(phone) = v_phone
       and coalesce(is_deleted, false) = false
     order by created_at desc limit 1;
  else
    select id into v_existing from leads
     where dealer_id = p_dealer_id
       and lower(btrim(coalesce(buyer_name, ''))) = lower(v_name)
       and coalesce(car_listing_id::text, '') = coalesce(v_car::text, '')
       and coalesce(is_deleted, false) = false
       and created_at >= now() - interval '24 hours'
     order by created_at desc limit 1;
  end if;
  if v_existing is not null then
    update leads set
      car_listing_id = coalesce(car_listing_id, v_car),
      phone = coalesce(nullif(phone, ''), v_phone),
      buyer_state = coalesce(buyer_state, v_state),
      salesman_id = coalesce(salesman_id, v_salesman),
      updated_at = now()
    where id = v_existing;
    return v_existing;
  end if;
  select count(*) into v_recent from leads
   where dealer_id = p_dealer_id
     and lead_source = 'whatsapp'
     and created_at > now() - interval '1 hour';
  if v_recent >= 40 then
    raise exception 'rate_limited' using errcode = 'check_violation';
  end if;
  insert into leads (dealer_id, salesman_id, buyer_name, phone, buyer_state, car_listing_id, stage, lead_source, is_deleted)
  values (p_dealer_id, v_salesman, v_name, v_phone, v_state, v_car, 'new', 'whatsapp', false)
  returning id into v_id;
  perform public._broker_capture(v_car, p_ref_slug, v_id, v_name, v_phone);
  return v_id;
end;
$$;

create or replace function public.enquiry_to_lead() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_phone text;
  v_name  text := nullif(btrim(coalesce(new.buyer_name, '')), '');
  v_state text := nullif(btrim(coalesce(new.buyer_state, '')), '');
  v_lead_id uuid;
  v_salesman_id uuid;
  v_recent integer;
begin
  v_phone := regexp_replace(coalesce(new.buyer_phone, ''), '\D', '', 'g');
  if v_phone = '' and v_name is null then return new; end if;
  v_salesman_id := public.resolve_lead_salesman(new.dealer_id, new.listing_id, new.ref_slug, new.salesman_id);
  if v_salesman_id is distinct from new.salesman_id then
    update whatsapp_enquiries set salesman_id = v_salesman_id where id = new.id;
  end if;
  if v_phone <> '' then
    select id into v_lead_id from leads
     where dealer_id = new.dealer_id and is_deleted = false
       and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone
     order by created_at desc limit 1;
  else
    select id into v_lead_id from leads
     where dealer_id = new.dealer_id and is_deleted = false
       and lower(btrim(coalesce(buyer_name, ''))) = lower(v_name)
       and coalesce(car_listing_id::text, '') = coalesce(new.listing_id::text, '')
       and created_at >= now() - interval '24 hours'
     order by created_at desc limit 1;
  end if;
  if v_lead_id is null then
    select count(*) into v_recent from leads
     where dealer_id = new.dealer_id
       and lead_source in ('enquiry', 'whatsapp')
       and created_at > now() - interval '1 hour';
    if v_recent < 40 then
      insert into leads (dealer_id, buyer_name, phone, buyer_state, lead_source, car_listing_id,
                         salesman_id, stage, is_deleted, notes, last_contacted_at, created_at)
      values (new.dealer_id, coalesce(v_name, 'WhatsApp enquiry'),
              nullif(new.buyer_phone, ''), v_state, 'enquiry', new.listing_id, v_salesman_id, 'new',
              false, new.buyer_message, new.last_contacted_at, coalesce(new.created_at, now()))
      returning id into v_lead_id;
      perform public._broker_capture(new.listing_id, new.ref_slug, v_lead_id, v_name, new.buyer_phone);
    end if;
  elsif v_state is not null then
    update leads set buyer_state = v_state
     where id = v_lead_id and nullif(btrim(coalesce(buyer_state, '')), '') is null;
  end if;
  if v_lead_id is not null then
    update whatsapp_enquiries set lead_id = v_lead_id where id = new.id;
    if v_salesman_id is not null then
      update leads set salesman_id = v_salesman_id
       where id = v_lead_id and salesman_id is null;
    end if;
  end if;
  return new;
end
$$;

-- ── the dealer's sale credits the broker by itself ───────────────────────────
create or replace function public.broker_lead_sync() returns trigger
language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare
  v_phone text := public.normalize_my_phone(new.phone);
  r public.broker_registrations%rowtype;
  v_amt numeric;
  v_won boolean := new.stage in ('won', 'closed_won');
begin
  if new.dealer_id is null then return null; end if;

  if tg_op = 'INSERT' then
    -- A live hold meets the dealer's own record of that buyer: tie them, so a sale of this lead
    -- pays the broker even after the 14 days.
    if v_phone is not null then
      update public.broker_registrations set dealer_lead_id = new.id
       where dealer_id = new.dealer_id and buyer_phone = v_phone
         and status = 'registered' and hold_until > now() and dealer_lead_id is null;
    end if;
    return null;
  end if;

  if v_won and coalesce(old.stage, '') not in ('won', 'closed_won') then
    select * into r from public.broker_registrations
     where dealer_id = new.dealer_id and status = 'registered'
       and ((dealer_lead_id = new.id and registered_at > now() - interval '90 days')
         or (v_phone is not null and buyer_phone = v_phone and hold_until > now()))
     order by registered_at limit 1
     for update;
    if found then
      v_amt := coalesce(r.commission_agreed,
        (select commission_default from public.dealer_brokers where dealer_id = r.dealer_id and broker_id = r.broker_id), 0);
      update public.broker_registrations
         set status = 'sold', sold_at = now(), commission_amount = v_amt, sold_by = 'auto', dealer_lead_id = new.id,
             sold_listing_id = coalesce(new.car_listing_id, r.listing_id)
       where id = r.id;
      insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
      values (r.broker_id, 'broker_sale', 'Your buyer bought a car',
              'The dealer sold to a buyer you registered. Commission owed: RM ' || round(v_amt) || '.', r.id);
      insert into public.dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
      values (r.dealer_id, 'broker_sale', 'This sale is a broker''s buyer',
              public._broker_name(r.broker_id) || ' registered this buyer. Commission owed: RM ' || round(v_amt) || '.', 'team', r.id);
    end if;
  elsif not v_won and coalesce(old.stage, '') in ('won', 'closed_won') then
    -- Undo sale: an automatic credit that was not yet paid goes back to "registered".
    update public.broker_registrations
       set status = 'registered', sold_at = null, commission_amount = null, sold_by = null, sold_listing_id = null
     where dealer_lead_id = new.id and status = 'sold' and sold_by = 'auto' and paid_at is null;
  end if;
  return null;
exception when others then
  raise warning 'broker_lead_sync: %', sqlerrm;
  return null;
end $$;
drop trigger if exists trg_zz_broker_lead_sync on public.leads;
create trigger trg_zz_broker_lead_sync after insert or update of stage on public.leads
  for each row execute function public.broker_lead_sync();

-- A broker's Won on a buyer registered on a dealer's car FILES A SALE CLAIM with the dealer. Nothing is
-- owed yet: the dealer approves (broker_mark_sold) or disputes (broker_dispute_claim). It lives in the
-- database so it fires from any screen, like the dealer's own won trigger. Taking the lead back out of
-- Won withdraws an unanswered claim. The broker's pipeline is the broker's: this never touches the dealer's lead.
create or replace function public.broker_claim_on_won() returns trigger
language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare
  r public.broker_registrations%rowtype;
  v_phone text := public.normalize_my_phone(new.phone);
begin
  if new.salesman_id is null then return null; end if;
  if new.stage in ('won', 'closed_won') and coalesce(old.stage, '') not in ('won', 'closed_won') then
    select * into r from public.broker_registrations
     where broker_id = new.salesman_id and status = 'registered'
       and (broker_lead_id = new.id
            or (v_phone is not null and buyer_phone = v_phone and registered_at > now() - interval '90 days'))
     order by (broker_lead_id = new.id) desc nulls last, registered_at desc
     limit 1 for update;
    if found and r.sale_claimed_at is null then
      update public.broker_registrations
         set sale_claimed_at = now(), claim_disputed_at = null, broker_lead_id = coalesce(broker_lead_id, new.id)
       where id = r.id;
      insert into public.dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
      values (r.dealer_id, 'broker_sale_claim', 'A broker says their buyer bought a car',
              public._broker_name(r.broker_id) || ' on your ' || r.car_label || '. Open Team > Brokers to approve or dispute it.',
              'team', r.id);
    end if;
  elsif coalesce(old.stage, '') in ('won', 'closed_won') and new.stage not in ('won', 'closed_won') then
    update public.broker_registrations set sale_claimed_at = null
     where broker_lead_id = new.id and status = 'registered' and sale_claimed_at is not null;
  end if;
  return null;
exception when others then
  raise warning 'broker_claim_on_won: %', sqlerrm;
  return null;
end $$;
drop trigger if exists trg_ac_broker_own_lead_guard on public.leads;
drop function if exists public.broker_own_lead_guard();
drop trigger if exists trg_zz_broker_claim_on_won on public.leads;
create trigger trg_zz_broker_claim_on_won after update of stage on public.leads
  for each row execute function public.broker_claim_on_won();

-- The dealer says "this was not sold". The claim clears, the broker is told, it is logged.
create or replace function public.broker_dispute_claim(p_reg uuid) returns jsonb
language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare r public.broker_registrations%rowtype;
begin
  select * into r from public.broker_registrations where id = p_reg for update;
  if not found or not public.broker_is_dealer_owner(r.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if r.status <> 'registered' or r.sale_claimed_at is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_action');
  end if;
  update public.broker_registrations set sale_claimed_at = null, claim_disputed_at = now() where id = r.id;
  insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
  values (r.broker_id, 'broker_claim_disputed', 'The dealer did not confirm your sale',
          'The dealer says ' || r.car_label || ' was not sold to your buyer. Talk to them. The buyer stays held for you until the hold ends.', r.id);
  return jsonb_build_object('ok', true);
end $$;

-- The dealer confirming by hand: never below what was agreed when the buyer was registered.
create or replace function public.broker_mark_sold(p_reg uuid, p_commission numeric default null) returns jsonb
language plpgsql security definer set search_path to 'pg_catalog', 'public' as $$
declare r public.broker_registrations%rowtype; v_amt numeric; v_floor numeric;
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
  update public.broker_registrations
     set status = 'sold', sold_at = now(), commission_amount = v_amt, sold_by = 'dealer',
         sold_listing_id = r.listing_id where id = r.id;
  insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
  values (r.broker_id, 'broker_sale', 'Your buyer bought the car',
          'The dealer confirmed the sale of ' || r.car_label || '.', r.id);
  return jsonb_build_object('ok', true, 'commission', v_amt);
end $$;

-- ── the two lists carry the new facts (return type changes: drop, create, re-grant) ──
drop function if exists public.broker_my_regs();
create function public.broker_my_regs()
returns table(id uuid, dealer_name text, car_label text, buyer_name text, buyer_phone text,
              registered_at timestamptz, hold_until timestamptz, status text, commission_amount numeric,
              paid_at timestamptz, source text, commission_agreed numeric, broker_lead_id uuid, sold_by text,
              listing_id uuid, sale_claimed_at timestamptz, claim_disputed_at timestamptz)
language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select r.id,
         coalesce(nullif(btrim(p.dealership), ''), nullif(btrim(p.site_name), ''), 'Dealer'),
         r.car_label, r.buyer_name, r.buyer_phone, r.registered_at, r.hold_until, r.status,
         r.commission_amount, r.paid_at, r.source, r.commission_agreed, r.broker_lead_id, r.sold_by,
         r.listing_id, r.sale_claimed_at, r.claim_disputed_at
    from public.broker_registrations r
    join public.profiles p on p.id = r.dealer_id
   where r.broker_id = auth.uid()
   order by r.registered_at desc
   limit 200;
$$;

drop function if exists public.dealer_broker_regs();
create function public.dealer_broker_regs()
returns table(id uuid, broker_id uuid, broker_name text, car_label text, buyer_name text, buyer_phone text,
              registered_at timestamptz, hold_until timestamptz, status text, commission_amount numeric,
              paid_at timestamptz, refused_count integer, source text, commission_agreed numeric, sold_by text,
              sale_claimed_at timestamptz, claim_disputed_at timestamptz)
language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select r.id, r.broker_id, public._broker_name(r.broker_id), r.car_label, r.buyer_name, r.buyer_phone,
         r.registered_at, r.hold_until, r.status, r.commission_amount, r.paid_at, r.refused_count,
         r.source, r.commission_agreed, r.sold_by, r.sale_claimed_at, r.claim_disputed_at
    from public.broker_registrations r
   where r.dealer_id = auth.uid() and public.broker_is_dealer_owner(r.dealer_id)
   order by r.registered_at desc
   limit 200;
$$;

-- The dealer's per-broker numbers (BROKER-2). ONE leaf per broker, summed by Overview
-- (src/utils/brokerTotals.js): buyers, holding, to_approve, sold, owed, paid are all counted here and
-- nowhere else. Return type changes: drop, create, re-grant.
drop function if exists public.dealer_my_brokers();
create function public.dealer_my_brokers()
returns table(broker_id uuid, name text, slug text, plan text, status text, requested_by text,
              commission_default numeric, since timestamptz, cars_on_page integer, buyers integer,
              sold integer, owed numeric, holding integer, to_approve integer, paid numeric)
language sql stable security definer set search_path to 'pg_catalog', 'public' as $$
  select b.broker_id, public._broker_name(b.broker_id), p.slug, p.plan::text, b.status, b.requested_by,
         b.commission_default, coalesce(b.decided_at, b.requested_at),
         (select count(*)::int from public.salesman_listings sl
           where sl.salesman_id = b.broker_id and sl.dealer_id = b.dealer_id),
         (select count(*)::int from public.broker_registrations r
           where r.broker_id = b.broker_id and r.dealer_id = b.dealer_id),
         (select count(*)::int from public.broker_registrations r
           where r.broker_id = b.broker_id and r.dealer_id = b.dealer_id and r.status = 'sold'),
         (select coalesce(sum(r.commission_amount), 0) from public.broker_registrations r
           where r.broker_id = b.broker_id and r.dealer_id = b.dealer_id
             and r.status = 'sold' and r.paid_at is null),
         (select count(*)::int from public.broker_registrations r
           where r.broker_id = b.broker_id and r.dealer_id = b.dealer_id
             and r.status = 'registered' and r.hold_until > now() and r.sale_claimed_at is null),
         (select count(*)::int from public.broker_registrations r
           where r.broker_id = b.broker_id and r.dealer_id = b.dealer_id
             and r.status = 'registered' and r.sale_claimed_at is not null),
         (select coalesce(sum(r.commission_amount), 0) from public.broker_registrations r
           where r.broker_id = b.broker_id and r.dealer_id = b.dealer_id
             and r.status = 'sold' and r.paid_at is not null)
    from public.dealer_brokers b
    join public.profiles p on p.id = b.broker_id
   where b.dealer_id = auth.uid() and public.broker_is_dealer_owner(b.dealer_id)
   order by (b.status = 'requested') desc, b.requested_at desc;
$$;
revoke all on function public.dealer_my_brokers() from public, anon;
grant execute on function public.dealer_my_brokers() to authenticated;

-- Broker commission PER CAR, for the one profit engine (src/utils/carPnl.js, BROKER-2): an approved broker
-- sale is owed commission on the car that was sold, so it is part of that car's commission cost and
-- every profit total. Answers the dealer / owner and a manager whose "view gross profit" switch is on;
-- nobody else gets a row (a salesman never sees what a car earned or cost).
create or replace function public.dealer_broker_commission_by_car()
returns table(listing_id uuid, broker_id uuid, broker_name text, amount numeric, paid boolean, sold_at timestamptz)
language plpgsql stable security definer set search_path to 'pg_catalog', 'public' as $$
declare v_dealer uuid := public.get_my_dealer_id();
begin
  if v_dealer is null or not public.dealer_can(v_dealer, 'view_gross') then return; end if;
  return query
    select coalesce(r.sold_listing_id, r.listing_id), r.broker_id, public._broker_name(r.broker_id),
           coalesce(r.commission_amount, 0), r.paid_at is not null, r.sold_at
      from public.broker_registrations r
     where r.dealer_id = v_dealer and r.status = 'sold'
       and coalesce(r.sold_listing_id, r.listing_id) is not null;
end $$;
revoke all on function public.dealer_broker_commission_by_car() from public, anon;
grant execute on function public.dealer_broker_commission_by_car() to authenticated;

-- ── grants: helpers are internal; only the RPCs are callable, and never by anon ──
revoke all on function public._broker_live(uuid, uuid) from public, anon, authenticated;
revoke all on function public._page_broker(text, uuid) from public, anon, authenticated;
revoke all on function public._broker_claim(uuid, uuid, text, text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public._broker_capture(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.broker_audit_reg() from public, anon, authenticated;
revoke all on function public.broker_audit_conn() from public, anon, authenticated;
revoke all on function public.broker_lead_sync() from public, anon, authenticated;
revoke all on function public.broker_claim_on_won() from public, anon, authenticated;

revoke all on function public.broker_register_buyer(uuid, text, text, boolean, uuid) from public, anon;
grant execute on function public.broker_register_buyer(uuid, text, text, boolean, uuid) to authenticated;
revoke all on function public.broker_my_regs() from public, anon;
grant execute on function public.broker_my_regs() to authenticated;
revoke all on function public.dealer_broker_regs() from public, anon;
grant execute on function public.dealer_broker_regs() to authenticated;
revoke all on function public.broker_dispute_claim(uuid) from public, anon;
grant execute on function public.broker_dispute_claim(uuid) to authenticated;
revoke all on function public.broker_mark_sold(uuid, numeric) from public, anon;
grant execute on function public.broker_mark_sold(uuid, numeric) to authenticated;
-- get_seller_whatsapp and create_lead_from_whatsapp keep their grants (same argument list:
-- CREATE OR REPLACE keeps the ACL: service role only).
