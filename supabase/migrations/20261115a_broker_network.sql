-- BROKER-1 (owner, 2026-11-15): a dealer works with outside brokers.
-- QUEUED, NOT APPLIED. Apply after midnight Malaysia time, only when nobody is live
-- (CLAUDE.md "DB migrations"). One migration, one API freeze.
--
-- Shape (docs/ARCHITECTURE.md section 8 gets a line):
--   dealer_brokers       one row per (dealer, broker): requested / active / paused / revoked / declined
--   broker_registrations a broker registers a buyer on a dealer's car; the FIRST registration holds
--                        that buyer on that dealer's stock for 14 days; append-only identity columns
-- A broker is a STANDALONE seller (profiles.dealer_id is null), never a linked salesman: they keep
-- their own cars and may work for several dealers. Access to a dealer's stock needs Premium
-- (is_salesman_premium: plan_expires_at in the future), so the broker's subscription is the paywall.
--
-- What this deliberately does NOT do:
--   * no `leads` row for a registered buyer. guard_lead_car_dealer forces a lead's dealer_id to
--     equal its car's dealer, and the standalone-seller lead policies need dealer_id null, so a
--     broker could never read it back; a won/deposit lead would also flip the DEALER's car
--     (auto_create_customer_on_won, sync_car_reservation_on_lead_stage). The registration IS the
--     broker's record. A sale is confirmed only by the dealer (broker_mark_sold).
--   * no money movement: broker_mark_paid is a record.
--   * leads that arrive through a broker's page are not attributed to the broker yet
--     (resolve_lead_salesman rule 2 is scoped to the dealer's own team): follow-up.

begin;

-- ---------------------------------------------------------------- tables

create table public.dealer_brokers (
  id                 uuid primary key default gen_random_uuid(),
  dealer_id          uuid not null references public.profiles(id) on delete cascade,
  broker_id          uuid not null references public.profiles(id) on delete cascade,
  status             text not null default 'requested'
                     check (status in ('requested', 'active', 'paused', 'revoked', 'declined')),
  requested_by       text not null check (requested_by in ('broker', 'dealer')),
  commission_default numeric(10,2) not null default 0
                     check (commission_default >= 0 and commission_default <= 100000),
  requested_at       timestamptz not null default now(),
  decided_at         timestamptz,
  unique (dealer_id, broker_id),
  check (dealer_id <> broker_id)
);
create index dealer_brokers_broker_idx on public.dealer_brokers (broker_id, requested_at desc);

create table public.broker_registrations (
  id                uuid primary key default gen_random_uuid(),
  dealer_id         uuid not null references public.profiles(id) on delete cascade,
  broker_id         uuid not null references public.profiles(id) on delete cascade,
  listing_id        uuid references public.car_listings(id) on delete set null,
  car_label         text not null,
  buyer_name        text not null check (char_length(buyer_name) between 2 and 80),
  buyer_phone       text not null check (buyer_phone ~ '^60[0-9]{8,10}$'),
  buyer_consented   boolean not null check (buyer_consented),
  registered_at     timestamptz not null default now(),
  hold_until        timestamptz not null,
  status            text not null default 'registered' check (status in ('registered', 'sold')),
  sold_at           timestamptz,
  commission_amount numeric(10,2) check (commission_amount is null or (commission_amount >= 0 and commission_amount <= 100000)),
  paid_at           timestamptz,
  refused_count     integer not null default 0
);
create index broker_registrations_hold_idx on public.broker_registrations (dealer_id, buyer_phone, hold_until desc);
create index broker_registrations_broker_idx on public.broker_registrations (broker_id, registered_at desc);

-- Nobody edits who/what/when. Only the status columns move (and only inside the functions below).
create or replace function public.broker_reg_lock() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.dealer_id        is distinct from old.dealer_id
  or new.broker_id        is distinct from old.broker_id
  or new.buyer_name       is distinct from old.buyer_name
  or new.buyer_phone      is distinct from old.buyer_phone
  or new.buyer_consented  is distinct from old.buyer_consented
  or new.registered_at    is distinct from old.registered_at
  or new.hold_until       is distinct from old.hold_until then
    raise exception 'broker_registration_locked' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_broker_reg_lock before update on public.broker_registrations
  for each row execute function public.broker_reg_lock();

-- ---------------------------------------------------------------- helpers

create or replace function public.broker_is_dealer_owner(p_dealer uuid) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (select 1 from public.profiles
                  where id = auth.uid() and id = p_dealer and role in ('dealer', 'owner'));
$$;

-- The caller is a Premium standalone seller with an ACTIVE connection to a dealer in good standing.
create or replace function public._broker_ok(p_dealer uuid) returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select public.is_salesman_premium()
     and exists (select 1 from public.profiles where id = auth.uid() and dealer_id is null)
     and exists (select 1 from public.dealer_brokers
                  where dealer_id = p_dealer and broker_id = auth.uid() and status = 'active')
     and public._dealer_in_good_standing(p_dealer);
$$;

create or replace function public._broker_name(p_id uuid) returns text
language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(nullif(btrim(full_name), ''), nullif(btrim(site_name), ''), slug, 'A seller')
    from public.profiles where id = p_id;
$$;

-- ---------------------------------------------------------------- row access (reads only)

alter table public.dealer_brokers enable row level security;
alter table public.broker_registrations enable row level security;

create policy dealer_brokers_select on public.dealer_brokers for select to authenticated
  using (broker_id = (select auth.uid()) or dealer_id = (select public.get_my_dealer_id()));

create policy broker_registrations_select on public.broker_registrations for select to authenticated
  using (broker_id = (select auth.uid()) or public.broker_is_dealer_owner(dealer_id));

revoke all on public.dealer_brokers, public.broker_registrations from public, anon, authenticated;
grant select on public.dealer_brokers, public.broker_registrations to authenticated;

-- ---------------------------------------------------------------- connection

-- A broker applies to a dealer by the dealer's storefront name (the part before .drevo.my).
create or replace function public.broker_request(p_subdomain text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  me public.profiles%rowtype;
  d  public.profiles%rowtype;
  cur public.dealer_brokers%rowtype;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.role <> 'salesman' or me.dealer_id is not null
     or not coalesce(me.is_active, false) or me.account_status is not distinct from 'deleted' then
    return jsonb_build_object('ok', false, 'reason', 'not_a_standalone_seller');
  end if;

  select * into d from public.profiles
   where lower(subdomain) = lower(btrim(coalesce(p_subdomain, ''))) and role in ('dealer', 'owner') limit 1;
  if d.id is null or not public._dealer_in_good_standing(d.id) then
    return jsonb_build_object('ok', false, 'reason', 'dealer_not_found');
  end if;

  if (select count(*) from public.dealer_brokers
       where broker_id = me.id and requested_at > now() - interval '1 day') >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;

  select * into cur from public.dealer_brokers where dealer_id = d.id and broker_id = me.id for update;
  if found then
    if cur.status in ('requested', 'active', 'paused') then
      return jsonb_build_object('ok', true, 'status', cur.status);
    end if;
    update public.dealer_brokers
       set status = 'requested', requested_by = 'broker', requested_at = now(), decided_at = null
     where id = cur.id;
  else
    insert into public.dealer_brokers (dealer_id, broker_id, status, requested_by)
    values (d.id, me.id, 'requested', 'broker');
  end if;

  insert into public.dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
  values (d.id, 'broker_request', 'A broker wants to sell your cars',
          public._broker_name(me.id) || ' asked to join.', 'team', me.id);
  return jsonb_build_object('ok', true, 'status', 'requested');
end $$;

-- A dealer invites a broker by the broker's page name (slug).
create or replace function public.broker_invite(p_slug text, p_commission numeric default 0) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  b public.profiles%rowtype;
  cur public.dealer_brokers%rowtype;
begin
  if not public.broker_is_dealer_owner(auth.uid()) or not public._dealer_in_good_standing(auth.uid()) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if p_commission is null or p_commission < 0 or p_commission > 100000 then
    return jsonb_build_object('ok', false, 'reason', 'bad_commission');
  end if;
  select * into b from public.profiles
   where lower(slug) = lower(btrim(coalesce(p_slug, ''))) and role = 'salesman' and dealer_id is null
     and coalesce(is_active, false) and account_status is distinct from 'deleted' limit 1;
  if b.id is null then
    return jsonb_build_object('ok', false, 'reason', 'broker_not_found');
  end if;

  select * into cur from public.dealer_brokers where dealer_id = auth.uid() and broker_id = b.id for update;
  if found then
    if cur.status in ('requested', 'active', 'paused') then
      return jsonb_build_object('ok', true, 'status', cur.status);
    end if;
    update public.dealer_brokers
       set status = 'requested', requested_by = 'dealer', commission_default = p_commission,
           requested_at = now(), decided_at = null
     where id = cur.id;
  else
    insert into public.dealer_brokers (dealer_id, broker_id, status, requested_by, commission_default)
    values (auth.uid(), b.id, 'requested', 'dealer', p_commission);
  end if;

  insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
  values (b.id, 'broker_invite', 'A dealer invited you to sell their cars',
          public._broker_name(auth.uid()) || ' would like you to sell their stock.', auth.uid());
  return jsonb_build_object('ok', true, 'status', 'requested');
end $$;

-- Every state change after the request. The caller must be the dealer or the broker of the row.
create or replace function public.broker_set_status(
  p_dealer uuid, p_broker uuid, p_action text, p_commission numeric default null
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  r public.dealer_brokers%rowtype;
  v_dealer boolean := public.broker_is_dealer_owner(p_dealer);
  v_broker boolean := (auth.uid() = p_broker);
  v_new text;
  v_drop boolean := false;
begin
  if not (v_dealer or v_broker) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if p_commission is not null and (p_commission < 0 or p_commission > 100000) then
    return jsonb_build_object('ok', false, 'reason', 'bad_commission');
  end if;

  select * into r from public.dealer_brokers where dealer_id = p_dealer and broker_id = p_broker for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_dealer then
    if    p_action = 'approve' and r.status = 'requested' and r.requested_by = 'broker' then v_new := 'active';
    elsif p_action = 'decline' and r.status = 'requested' then v_new := 'declined';
    elsif p_action = 'pause'   and r.status = 'active'    then v_new := 'paused';
    elsif p_action = 'resume'  and r.status = 'paused'    then v_new := 'active';
    elsif p_action = 'revoke'  and r.status in ('active', 'paused') then v_new := 'revoked'; v_drop := true;
    elsif p_action = 'set_commission' and r.status in ('requested', 'active', 'paused') and p_commission is not null then v_new := r.status;
    else
      return jsonb_build_object('ok', false, 'reason', 'bad_action');
    end if;
  else
    if    p_action = 'accept'  and r.status = 'requested' and r.requested_by = 'dealer' then v_new := 'active';
    elsif p_action = 'decline' and r.status = 'requested' and r.requested_by = 'dealer' then v_new := 'declined';
    elsif p_action = 'leave'   and r.status in ('active', 'paused') then v_new := 'revoked'; v_drop := true;
    else
      return jsonb_build_object('ok', false, 'reason', 'bad_action');
    end if;
  end if;

  update public.dealer_brokers
     set status = v_new,
         commission_default = coalesce(p_commission, commission_default),
         decided_at = case when v_new <> r.status then now() else decided_at end
   where id = r.id;

  -- Revoked or left: the dealer's cars leave the broker's page now. Registrations stay.
  if v_drop then
    delete from public.salesman_listings where salesman_id = p_broker and dealer_id = p_dealer;
  end if;

  if p_action <> 'set_commission' then
    if v_dealer then
      insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
      values (p_broker, 'broker_' || p_action,
              case p_action when 'approve' then 'You can now sell this dealer''s cars'
                            when 'decline' then 'The dealer did not accept your request'
                            when 'pause'   then 'A dealer paused your access'
                            when 'resume'  then 'A dealer restored your access'
                            else 'A dealer ended the connection' end,
              public._broker_name(p_dealer), p_dealer);
    else
      insert into public.dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
      values (p_dealer, 'broker_' || p_action,
              case p_action when 'accept' then 'A broker accepted your invite'
                            when 'decline' then 'A broker declined your invite'
                            else 'A broker left' end,
              public._broker_name(p_broker), 'team', p_broker);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'status', v_new);
end $$;

-- ---------------------------------------------------------------- reads

create or replace function public.broker_my_dealers() returns table (
  dealer_id uuid, name text, subdomain text, status text, requested_by text, commission_default numeric
) language sql stable security definer set search_path = pg_catalog, public as $$
  select b.dealer_id,
         coalesce(nullif(btrim(p.dealership), ''), nullif(btrim(p.site_name), ''), p.subdomain, 'Dealer'),
         p.subdomain, b.status, b.requested_by, b.commission_default
    from public.dealer_brokers b
    join public.profiles p on p.id = b.dealer_id
   where b.broker_id = auth.uid() and b.status <> 'declined'
   order by b.requested_at desc;
$$;

create or replace function public.broker_dealer_stock(p_dealer uuid) returns table (
  id uuid, brand text, model text, variant text, year integer, mileage integer,
  selling_price numeric, image text, transmission text, slug text,
  commission numeric, on_my_page boolean
) language sql stable security definer set search_path = pg_catalog, public as $$
  select c.id, c.brand, c.model, c.variant, c.year, c.mileage, c.selling_price,
         c.images[1], c.transmission, c.slug,
         (select b.commission_default from public.dealer_brokers b
           where b.dealer_id = p_dealer and b.broker_id = auth.uid()),
         exists (select 1 from public.salesman_listings sl
                  where sl.salesman_id = auth.uid() and sl.listing_id = c.id)
    from public.public_car_listings c
   where c.dealer_id = p_dealer
     and public._broker_ok(p_dealer)
     and c.status = 'available'
     and c.assigned_to is null
     and not coalesce(c.is_model_card, false)
   order by c.created_at desc
   limit 200;
$$;

create or replace function public.broker_my_regs() returns table (
  id uuid, dealer_name text, car_label text, buyer_name text, buyer_phone text,
  registered_at timestamptz, hold_until timestamptz, status text,
  commission_amount numeric, paid_at timestamptz
) language sql stable security definer set search_path = pg_catalog, public as $$
  select r.id,
         coalesce(nullif(btrim(p.dealership), ''), nullif(btrim(p.site_name), ''), 'Dealer'),
         r.car_label, r.buyer_name, r.buyer_phone, r.registered_at, r.hold_until, r.status,
         r.commission_amount, r.paid_at
    from public.broker_registrations r
    join public.profiles p on p.id = r.dealer_id
   where r.broker_id = auth.uid()
   order by r.registered_at desc
   limit 200;
$$;

create or replace function public.dealer_my_brokers() returns table (
  broker_id uuid, name text, slug text, plan text, status text, requested_by text,
  commission_default numeric, since timestamptz,
  cars_on_page integer, buyers integer, sold integer, owed numeric
) language sql stable security definer set search_path = pg_catalog, public as $$
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
             and r.status = 'sold' and r.paid_at is null)
    from public.dealer_brokers b
    join public.profiles p on p.id = b.broker_id
   where b.dealer_id = auth.uid() and public.broker_is_dealer_owner(b.dealer_id)
   order by (b.status = 'requested') desc, b.requested_at desc;
$$;

create or replace function public.dealer_broker_regs() returns table (
  id uuid, broker_id uuid, broker_name text, car_label text, buyer_name text, buyer_phone text,
  registered_at timestamptz, hold_until timestamptz, status text,
  commission_amount numeric, paid_at timestamptz, refused_count integer
) language sql stable security definer set search_path = pg_catalog, public as $$
  select r.id, r.broker_id, public._broker_name(r.broker_id), r.car_label, r.buyer_name, r.buyer_phone,
         r.registered_at, r.hold_until, r.status, r.commission_amount, r.paid_at, r.refused_count
    from public.broker_registrations r
   where r.dealer_id = auth.uid() and public.broker_is_dealer_owner(r.dealer_id)
   order by r.registered_at desc
   limit 200;
$$;

-- ---------------------------------------------------------------- the broker's page

create or replace function public.broker_add_to_page(p_listing uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare c record;
begin
  select dealer_id, status, assigned_to, new_car_model_id into c
    from public.car_listings where id = p_listing;
  if not found or not public._broker_ok(c.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  if c.status <> 'available' or c.assigned_to is not null or c.new_car_model_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if exists (select 1 from public.salesman_listings where salesman_id = auth.uid() and listing_id = p_listing) then
    return jsonb_build_object('ok', true);
  end if;
  if (select count(*) from public.salesman_listings
       where salesman_id = auth.uid() and dealer_id <> auth.uid()) >= 30 then
    return jsonb_build_object('ok', false, 'reason', 'cap');
  end if;
  insert into public.salesman_listings (dealer_id, salesman_id, listing_id)
  values (c.dealer_id, auth.uid(), p_listing);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.broker_remove_from_page(p_listing uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  delete from public.salesman_listings
   where salesman_id = auth.uid() and listing_id = p_listing and dealer_id <> auth.uid();
  return jsonb_build_object('ok', true);
end $$;

-- The public page shows a dealer's car only while the broker is connected (active) AND still
-- Premium. Everything else behaves as before (linked salesmen, a seller's own cars).
create or replace function public.get_salesman_featured_listings(p_salesman_id uuid)
returns setof public_car_listings
language sql stable security definer set search_path to 'public' as $function$
  select pcl.*
    from public_car_listings pcl
    join salesman_listings sl on sl.listing_id = pcl.id
   where sl.salesman_id = p_salesman_id
     and pcl.status in ('available', 'reserved')
     and (
       not exists (select 1 from profiles s
                    where s.id = sl.salesman_id and s.dealer_id is null and sl.dealer_id <> sl.salesman_id)
       or (
         exists (select 1 from dealer_brokers db
                  where db.broker_id = sl.salesman_id and db.dealer_id = sl.dealer_id and db.status = 'active')
         and salesman_has_full_page(sl.salesman_id)
       )
     )
   order by pcl.created_at desc;
$function$;

-- ---------------------------------------------------------------- registering a buyer

create or replace function public.broker_register_buyer(
  p_listing uuid, p_name text, p_phone text, p_consent boolean
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  c record;
  v_phone text := public.normalize_my_phone(p_phone);
  v_name  text := btrim(coalesce(p_name, ''));
  v_label text;
  held public.broker_registrations%rowtype;
  v_id uuid;
  v_until timestamptz := now() + interval '14 days';
begin
  if not coalesce(p_consent, false) then
    return jsonb_build_object('ok', false, 'reason', 'consent_required');
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 or v_phone is null or v_phone !~ '^60[0-9]{8,10}$' then
    return jsonb_build_object('ok', false, 'reason', 'bad_details');
  end if;

  select dealer_id, status, assigned_to, new_car_model_id, year, brand, model, variant into c
    from public.car_listings where id = p_listing;
  if not found or not public._broker_ok(c.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  if c.status <> 'available' or c.assigned_to is not null or c.new_car_model_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if (select count(*) from public.broker_registrations
       where broker_id = auth.uid() and registered_at > now() - interval '1 day') >= 30 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(c.dealer_id::text || ':' || v_phone, 0));

  select * into held from public.broker_registrations
   where dealer_id = c.dealer_id and buyer_phone = v_phone
     and status = 'registered' and hold_until > now()
   order by registered_at limit 1;
  if found then
    if held.broker_id = auth.uid() then
      return jsonb_build_object('ok', false, 'reason', 'mine', 'until', held.hold_until);
    end if;
    update public.broker_registrations set refused_count = refused_count + 1 where id = held.id;
    return jsonb_build_object('ok', false, 'reason', 'held', 'until', held.hold_until);
  end if;

  v_label := btrim(concat_ws(' ', c.year::text, c.brand, c.model, c.variant));
  insert into public.broker_registrations
    (dealer_id, broker_id, listing_id, car_label, buyer_name, buyer_phone, buyer_consented, hold_until)
  values (c.dealer_id, auth.uid(), p_listing, v_label, v_name, v_phone, true, v_until)
  returning id into v_id;

  -- No buyer name or number in the push: lock screens are public.
  insert into public.dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
  values (c.dealer_id, 'broker_buyer', 'A broker registered a buyer',
          public._broker_name(auth.uid()) || ' on your ' || v_label, 'team', v_id);

  return jsonb_build_object('ok', true, 'id', v_id, 'until', v_until);
end $$;

-- Only the DEALER says a buyer bought. Commission defaults to the broker's agreed amount.
create or replace function public.broker_mark_sold(p_reg uuid, p_commission numeric default null) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.broker_registrations%rowtype; v_amt numeric;
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
  v_amt := coalesce(p_commission,
    (select commission_default from public.dealer_brokers where dealer_id = r.dealer_id and broker_id = r.broker_id), 0);
  update public.broker_registrations
     set status = 'sold', sold_at = now(), commission_amount = v_amt where id = r.id;
  insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
  values (r.broker_id, 'broker_sale', 'Your buyer bought the car',
          'The dealer confirmed the sale of ' || r.car_label || '.', r.id);
  return jsonb_build_object('ok', true, 'commission', v_amt);
end $$;

-- A record that the dealer paid the broker. Drevo moves no money.
create or replace function public.broker_mark_paid(p_reg uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.broker_registrations%rowtype;
begin
  select * into r from public.broker_registrations where id = p_reg for update;
  if not found or not public.broker_is_dealer_owner(r.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if r.status <> 'sold' or r.paid_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'bad_action');
  end if;
  update public.broker_registrations set paid_at = now() where id = r.id;
  insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
  values (r.broker_id, 'broker_paid', 'Commission marked as paid',
          'The dealer marked your commission on ' || r.car_label || ' as paid.', r.id);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- grants
-- New functions are granted to anon by default: take it back, then grant the signed-in role only.
-- Anonymous guests (buyers in chat) are `authenticated` too, so every function checks the
-- caller's profile itself (_broker_ok / broker_is_dealer_owner / role checks above).

revoke all on function public.broker_is_dealer_owner(uuid) from public, anon;
revoke all on function public._broker_ok(uuid) from public, anon, authenticated;
revoke all on function public._broker_name(uuid) from public, anon, authenticated;
revoke all on function public.broker_request(text) from public, anon;
revoke all on function public.broker_invite(text, numeric) from public, anon;
revoke all on function public.broker_set_status(uuid, uuid, text, numeric) from public, anon;
revoke all on function public.broker_my_dealers() from public, anon;
revoke all on function public.broker_dealer_stock(uuid) from public, anon;
revoke all on function public.broker_my_regs() from public, anon;
revoke all on function public.dealer_my_brokers() from public, anon;
revoke all on function public.dealer_broker_regs() from public, anon;
revoke all on function public.broker_add_to_page(uuid) from public, anon;
revoke all on function public.broker_remove_from_page(uuid) from public, anon;
revoke all on function public.broker_register_buyer(uuid, text, text, boolean) from public, anon;
revoke all on function public.broker_mark_sold(uuid, numeric) from public, anon;
revoke all on function public.broker_mark_paid(uuid) from public, anon;

grant execute on function
  public.broker_is_dealer_owner(uuid),
  public.broker_request(text),
  public.broker_invite(text, numeric),
  public.broker_set_status(uuid, uuid, text, numeric),
  public.broker_my_dealers(),
  public.broker_dealer_stock(uuid),
  public.broker_my_regs(),
  public.dealer_my_brokers(),
  public.dealer_broker_regs(),
  public.broker_add_to_page(uuid),
  public.broker_remove_from_page(uuid),
  public.broker_register_buyer(uuid, text, text, boolean),
  public.broker_mark_sold(uuid, numeric),
  public.broker_mark_paid(uuid)
to authenticated;

commit;

-- After applying, verify (never by reading this file):
--   select oid::regprocedure from pg_proc where proname in
--     ('get_salesman_featured_listings','broker_request','broker_register_buyer');   -- one row each
--   select has_function_privilege('anon', 'public.broker_dealer_stock(uuid)', 'execute');  -- false
--   select has_table_privilege('authenticated', 'public.broker_registrations', 'insert'); -- false
--   -- and a probe AS a Premium standalone seller with no connection: broker_dealer_stock(<dealer>)
--   -- returns zero rows; with one: rows; after broker_set_status(...,'revoke'): zero again.
