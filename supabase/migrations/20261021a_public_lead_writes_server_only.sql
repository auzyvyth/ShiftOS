-- Public lead writes go through the server only (audit 2026-10-21, TODO SEC-10).
-- NOT APPLIED: written inside the 09:00-22:00 MYT no-DDL window. Run after
-- 22:00 MYT, and only AFTER the matching api/enquiry.js, api/booking.js and
-- api/whatsapp-lead.js are live in production (they switch to the server key;
-- with the old code live, this migration would break every enquiry, booking
-- and WhatsApp lead).
--
-- 1. Turnstile + the per-IP limit on /api/whatsapp-lead, /api/enquiry and
--    /api/booking could be skipped: the public key could call
--    create_lead_from_whatsapp / create_lead_from_booking and insert into
--    whatsapp_enquiries / appointments directly. Only the per-seller caps were
--    left (40 + 60 + 30 an hour), each fake row a push + Telegram + email.
--    Now the two functions run for service_role only, a public enquiry row can
--    only be a nameless "tapped WhatsApp" record (no lead, no buyer details),
--    and appointments can only be inserted by the seller's own team.
-- 2. create_lead_from_whatsapp, on a lead matched by phone, OVERWROTE its car
--    with whatever car id the caller sent, from any seller. Now it only fills a
--    BLANK car (same rule as chat_after_message) and only with a car of this
--    dealer. It also refuses a dealer account that is not active.

begin;

-- 1a. Lead functions: server only.
revoke execute on function public.create_lead_from_whatsapp(uuid, text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_lead_from_whatsapp(uuid, text, text, text, uuid, text)
  to service_role;

revoke execute on function public.create_lead_from_booking(uuid, uuid, text, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_lead_from_booking(uuid, uuid, text, text, text, text, text, uuid)
  to service_role;

-- 1b. whatsapp_enquiries: the browser still records WhatsApp TAPS directly
-- (StickyWhatsAppButton, ShowroomCard, CarCard), always without a name or
-- phone. enquiry_to_lead makes no lead from such a row. A named enquiry comes
-- only from /api/enquiry (service role, which bypasses RLS).
drop policy if exists enquiries_public_insert on public.whatsapp_enquiries;
create policy enquiries_public_insert on public.whatsapp_enquiries
  for insert to anon, authenticated
  with check (
    is_dealer_active(dealer_id)
    and whatsapp_enquiry_rate_ok(session_id, dealer_id)
    and buyer_name is null
    and buyer_phone is null
    and buyer_state is null
    and salesman_id is null
    and lead_id is null
  );

-- 1c. appointments: buyer bookings come only from /api/booking (service role).
-- Sellers book for their own team: LeadDrawer + CRMPanel (dealer_id = the
-- dealer), Lite/Premium (dealer_id of the lead, or NULL on a self-owned lead).
drop policy if exists appointments_public_insert on public.appointments;
create policy appointments_team_insert on public.appointments
  for insert to authenticated
  with check (
    dealer_id = (select get_my_dealer_id())
    or (dealer_id is null and salesman_id = (select auth.uid()))
  );

-- 2. create_lead_from_whatsapp: same signature, so this replaces in place.
create or replace function public.create_lead_from_whatsapp(
  p_dealer_id uuid, p_name text, p_phone text, p_state text, p_car_id uuid, p_ref_slug text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  -- A live account, NOT is_dealer_active(): that one reads subscription_status,
  -- which means nothing for a salesman (2 Premium sellers read "inactive"
  -- there today), and a buyer's way to reach a seller must never be gated on it.
  if not exists (select 1 from profiles
                 where id = p_dealer_id and is_active
                   and coalesce(account_status, 'active') <> 'deleted') then
    raise exception 'dealer_inactive' using errcode = 'check_violation';
  end if;

  -- Only a car of THIS dealer counts; any other id is ignored.
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
    -- Fill blanks only: never move a lead onto another car.
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
  return v_id;
end;
$function$;

-- CREATE OR REPLACE keeps grants, but re-assert: server only.
revoke execute on function public.create_lead_from_whatsapp(uuid, text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_lead_from_whatsapp(uuid, text, text, text, uuid, text)
  to service_role;

commit;

-- Verify afterwards (each must be false / exactly one row):
--   select has_function_privilege('anon', 'public.create_lead_from_whatsapp(uuid,text,text,text,uuid,text)', 'execute');
--   select has_function_privilege('authenticated', 'public.create_lead_from_booking(uuid,uuid,text,text,text,text,text,uuid)', 'execute');
--   select oid::regprocedure from pg_proc where proname = 'create_lead_from_whatsapp';
--   select policyname, roles from pg_policies where tablename in ('appointments','whatsapp_enquiries') and cmd = 'INSERT';
