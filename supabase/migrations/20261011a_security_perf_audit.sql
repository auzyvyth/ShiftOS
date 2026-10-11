-- Security + load audit, 2026-10-11. NOT APPLIED: owner runs it in the SQL
-- editor after 22:00 MYT (one migration = one schema-cache freeze).
--
-- 1. telegram-enquiry-notify was an open relay (no auth, verify_jwt off, CORS
--    *): anyone could make the XDrive bot send any text to any seller who had
--    linked Telegram. Its two DB callers now send the same vault secret
--    telegram-notify already gets. Deploy the edge function AFTER this runs.
-- 2. leads_public_insert let anyone insert any lead row (any stage, any
--    salesman_id, any notes) straight into any seller's pipeline at 3 per
--    PHONE per hour, so a fresh made-up number per insert had no limit. No real
--    path uses it: the definer functions that create inbound leads run as
--    postgres, which has BYPASSRLS, and sellers insert under their own
--    policies. (The 20260831b comment saying the definers need it was wrong.)
-- 3. create_lead_from_booking is callable by anon directly (skipping
--    /api/booking's IP limit) and had no cap. It also OVERWROTE notes on an
--    existing lead matched by phone, so anyone who knew a buyer's number could
--    rewrite what the seller had written. Now: 40 new leads per dealer per
--    hour, and a new note is appended, never replaces.
-- 4. appointments: 5 per phone per day, so rotating numbers = unlimited fake
--    bookings, each one a push + Telegram to the seller. Add a per-dealer
--    ceiling of 30 per hour, whatever the phone.
-- 5. car_hunts: same phone-rotation hole. Global ceiling of 60 per hour.
-- 6. Write grants anon/authenticated never need on two views (not exploitable
--    today: one is not updatable, the other is invoker-rights over an
--    append-only table). Hygiene, so a future change cannot open them.
-- 7. Advisor: mutable search_path on reg_refresh_years; auth.uid() evaluated
--    per row in 7 policies (wrap in a sub-select so it runs once per query).
-- 8. appointment-reminder woke an edge function every 5 minutes (~800 API
--    requests/day, most finding nothing). The cron now checks for work in SQL
--    first and only calls the function when there is something to send.

begin;

-- 1 ---------------------------------------------------------------------------
create or replace function public.notify_salesman_new_booking()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_telegram_chat_id text; v_car_name text; v_date_str text; v_msg text; v_dealer_name text;
  v_secret text;
BEGIN
  IF NEW.salesman_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO salesman_notifications (salesman_id, type, title, body, ref_id)
  VALUES (NEW.salesman_id, 'new_booking', 'New Booking 📅',
    COALESCE(NEW.buyer_name, 'Someone') || ' just booked an appointment', NEW.id);
  SELECT telegram_chat_id INTO v_telegram_chat_id FROM profiles WHERE id = NEW.salesman_id;
  IF v_telegram_chat_id IS NULL THEN RETURN NEW; END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
   WHERE name = 'telegram_webhook_secret' LIMIT 1;
  IF v_secret IS NULL THEN RETURN NEW; END IF;
  SELECT CONCAT_WS(' ', year::text, brand, model) INTO v_car_name FROM car_listings WHERE id = NEW.car_listing_id;
  SELECT COALESCE(site_name, dealership, full_name) INTO v_dealer_name FROM profiles WHERE id = NEW.dealer_id;
  SELECT to_char(NEW.appointment_date AT TIME ZONE 'Asia/Kuala_Lumpur', 'Dy, DD Mon YYYY @ HH12:MI AM') INTO v_date_str;
  v_msg := '📅 *New Booking*' || E'\n' || '━━━━━━━━━━━━━━━━' || E'\n\n' ||
    CASE WHEN v_dealer_name IS NOT NULL THEN '🏢 *' || v_dealer_name || '*' || E'\n' ELSE '' END ||
    '👤 *' || COALESCE(NEW.buyer_name, 'Unknown') || '*' || E'\n' ||
    '📱 ' || COALESCE(NEW.buyer_phone, '—') || E'\n' ||
    CASE WHEN v_car_name IS NOT NULL THEN '🚗 ' || v_car_name || E'\n' ELSE '' END ||
    '🗓 ' || COALESCE(v_date_str, '—') || E'\n' ||
    CASE WHEN NEW.booking_type IS NOT NULL THEN '📋 ' || initcap(replace(NEW.booking_type, '_', ' ')) || E'\n' ELSE '' END ||
    CASE WHEN NEW.notes IS NOT NULL AND trim(NEW.notes) <> '' THEN '📝 _"' || NEW.notes || '"_' || E'\n' ELSE '' END ||
    E'\n' || '⚡ Open ShiftOS to confirm the appointment.';
  PERFORM net.http_post(
    url := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/telegram-enquiry-notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object('chat_id', v_telegram_chat_id, 'message', v_msg));
  RETURN NEW;
END; $function$;

create or replace function public.notify_salesman_new_enquiry()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_salesman_id uuid; v_telegram_chat_id text; v_car_name text; v_dealer_name text;
  v_base text; v_msg text; r record; v_secret text;
BEGIN
  v_salesman_id := resolve_lead_salesman(NEW.dealer_id, NEW.listing_id, NEW.ref_slug, NEW.salesman_id);
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
   WHERE name = 'telegram_webhook_secret' LIMIT 1;

  SELECT CONCAT_WS(' ', year::text, brand, model) INTO v_car_name FROM car_listings WHERE id = NEW.listing_id;
  SELECT COALESCE(site_name, dealership, full_name) INTO v_dealer_name FROM profiles WHERE id = NEW.dealer_id;
  v_base := '━━━━━━━━━━━━━━━━' || E'\n\n' ||
    CASE WHEN v_dealer_name IS NOT NULL THEN '🏢 *' || v_dealer_name || '*' || E'\n' ELSE '' END ||
    '👤 *' || COALESCE(NEW.buyer_name, 'Unknown') || '*' || E'\n' ||
    '📱 ' || COALESCE(NEW.buyer_phone, '—') || E'\n' ||
    CASE WHEN v_car_name IS NOT NULL THEN '🚗 ' || v_car_name || E'\n' ELSE '' END ||
    CASE WHEN NEW.buyer_message IS NOT NULL AND trim(NEW.buyer_message) <> ''
         THEN '💬 _"' || NEW.buyer_message || '"_' || E'\n' ELSE '' END;

  IF v_salesman_id IS NOT NULL THEN
    INSERT INTO salesman_notifications (salesman_id, type, title, body, ref_id)
    VALUES (v_salesman_id, 'new_enquiry', 'New Enquiry 💬',
      COALESCE(NEW.buyer_name, 'Someone') || ' enquired about a listing', NEW.id);
    SELECT telegram_chat_id INTO v_telegram_chat_id FROM profiles WHERE id = v_salesman_id;
    IF v_telegram_chat_id IS NOT NULL AND v_secret IS NOT NULL THEN
      v_msg := '🔔 *New Enquiry*' || E'\n' || v_base || E'\n' || '⚡ Open ShiftOS now to follow up before they go cold.';
      PERFORM net.http_post(
        url := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/telegram-enquiry-notify',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
        body := jsonb_build_object('chat_id', v_telegram_chat_id, 'message', v_msg));
    END IF;
  ELSIF NEW.dealer_id IS NOT NULL THEN
    v_msg := '🆕 *New Unclaimed Lead*' || E'\n' || v_base || E'\n' || '⚡ First to claim it in ShiftOS gets it!';
    FOR r IN SELECT id, telegram_chat_id FROM profiles
             WHERE dealer_id = NEW.dealer_id AND role = 'salesman' LOOP
      INSERT INTO salesman_notifications (salesman_id, type, title, body, ref_id)
      VALUES (r.id, 'new_enquiry', 'New Unclaimed Lead 🆕',
        COALESCE(NEW.buyer_name, 'Someone') || ' enquired — claim it first', NEW.id);
      IF r.telegram_chat_id IS NOT NULL AND v_secret IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/telegram-enquiry-notify',
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
          body := jsonb_build_object('chat_id', r.telegram_chat_id, 'message', v_msg));
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $function$;

-- 2 ---------------------------------------------------------------------------
drop policy if exists leads_public_insert on public.leads;

-- 3 ---------------------------------------------------------------------------
create or replace function public.create_lead_from_booking(
  p_dealer_id uuid, p_car_id uuid, p_name text, p_phone text DEFAULT NULL::text,
  p_state text DEFAULT NULL::text, p_ref_slug text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text, p_assigned_to uuid DEFAULT NULL::uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_phone text := NULLIF(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), '');
  v_name text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_notes text := NULLIF(btrim(left(COALESCE(p_notes, ''), 600)), '');
  v_salesman uuid;
  v_existing uuid;
  v_id uuid;
  v_owner_plan text;
  v_recent integer;
BEGIN
  IF p_dealer_id IS NULL OR v_name IS NULL THEN
    RAISE EXCEPTION 'name and dealer are required';
  END IF;

  -- ONE resolver for every inbound path. Do not inline this again.
  v_salesman := public.resolve_lead_salesman(p_dealer_id, p_car_id, p_ref_slug, NULL);
  IF v_salesman IS NULL THEN
    v_salesman := p_assigned_to;
  END IF;

  -- Solo-panel gate (Lite AND Premium): a booking lands as a pending
  -- appointment only and becomes a lead when the salesman confirms it.
  IF v_salesman IS NOT NULL THEN
    SELECT plan INTO v_owner_plan FROM profiles WHERE id = v_salesman;
    IF v_owner_plan IN ('salesman_lite', 'salesman_full') THEN
      RETURN NULL;
    END IF;
  END IF;

  IF v_phone IS NOT NULL THEN
    SELECT id INTO v_existing FROM leads
    WHERE dealer_id = p_dealer_id
      AND regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = v_phone
      AND COALESCE(is_deleted, false) = false
    ORDER BY created_at DESC LIMIT 1;
  ELSE
    SELECT id INTO v_existing FROM leads
    WHERE dealer_id = p_dealer_id
      AND lower(btrim(COALESCE(buyer_name, ''))) = lower(v_name)
      AND COALESCE(car_listing_id::text, '') = COALESCE(p_car_id::text, '')
      AND COALESCE(is_deleted, false) = false
      AND created_at >= now() - interval '24 hours'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_existing IS NOT NULL THEN
    -- Append, never replace: this is reachable by anyone holding the anon key,
    -- and the seller's own notes live in this column.
    UPDATE leads SET
      car_listing_id = COALESCE(p_car_id, car_listing_id),
      phone = COALESCE(NULLIF(v_phone, ''), phone),
      buyer_state = COALESCE(buyer_state, p_state),
      salesman_id = COALESCE(salesman_id, v_salesman),
      stage = CASE WHEN stage = 'new' THEN 'viewing_booked' ELSE stage END,
      notes = CASE
        WHEN v_notes IS NULL THEN notes
        WHEN notes IS NULL OR btrim(notes) = '' THEN v_notes
        WHEN position(v_notes in notes) > 0 THEN notes
        ELSE left(notes || E'\n' || v_notes, 4000)
      END,
      updated_at = now()
    WHERE id = v_existing;
    RETURN v_existing;
  END IF;

  SELECT count(*) INTO v_recent FROM leads
   WHERE dealer_id = p_dealer_id
     AND created_at > now() - interval '1 hour'
     AND lead_source = 'enquiry';
  IF v_recent >= 40 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO leads (
    dealer_id, salesman_id, buyer_name, phone, buyer_state,
    car_listing_id, stage, lead_source, notes, is_deleted
  )
  VALUES (
    p_dealer_id, v_salesman, v_name, v_phone, p_state,
    p_car_id, 'viewing_booked', 'enquiry', v_notes, false
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- 4 ---------------------------------------------------------------------------
create or replace function public.appointments_public_rate_ok(p_phone text, p_dealer_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  cnt integer;
BEGIN
  -- Ceiling per seller whatever the phone: a fresh number per insert used to
  -- buy unlimited bookings, each one a push and a Telegram to the seller.
  SELECT COUNT(*) INTO cnt
  FROM appointments
  WHERE dealer_id = p_dealer_id
    AND created_at > now() - interval '1 hour';
  IF cnt >= 30 THEN
    RETURN false;
  END IF;

  IF p_phone IS NULL OR p_phone = '' THEN
    SELECT COUNT(*) INTO cnt
    FROM appointments
    WHERE (buyer_phone IS NULL OR buyer_phone = '')
      AND dealer_id = p_dealer_id
      AND created_at > now() - interval '1 hour';
    RETURN cnt < 20;
  END IF;

  SELECT COUNT(*) INTO cnt
  FROM appointments
  WHERE buyer_phone = p_phone
    AND dealer_id = p_dealer_id
    AND created_at > now() - interval '1 day';
  RETURN cnt < 5;
END;
$function$;

create index if not exists idx_appointments_dealer_created
  on public.appointments (dealer_id, created_at desc);

-- 5 ---------------------------------------------------------------------------
create or replace function public.car_hunts_rate_ok(p_phone text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare cnt int;
begin
  if p_phone is null or p_phone = '' then return false; end if;
  select count(*) into cnt from car_hunts
   where created_at > now() - interval '1 hour';
  if cnt >= 60 then return false; end if;
  select count(*) into cnt from car_hunts
   where hunter_phone = p_phone and created_at > now() - interval '1 hour';
  return cnt < 3;
end;
$function$;

-- 6 ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on public.public_car_listings from anon, authenticated, public;
revoke insert, update, delete, truncate, references, trigger
  on public.chat_messages_ai from anon, authenticated, public;

-- 7 ---------------------------------------------------------------------------
alter function public.reg_refresh_years() set search_path = public, pg_temp;

alter policy salesman_reads_own_listings on public.car_listings
  using ((dealer_id = (select auth.uid())) and salesman_can_manage_listings());
alter policy salesman_updates_own_listings on public.car_listings
  using ((dealer_id = (select auth.uid())) and salesman_can_manage_listings())
  with check ((dealer_id = (select auth.uid())) and salesman_can_manage_listings());
alter policy salesman_deletes_own_listings on public.car_listings
  using ((dealer_id = (select auth.uid())) and salesman_can_manage_listings());
alter policy salesman_inserts_own_listings on public.car_listings
  with check ((dealer_id = (select auth.uid())) and salesman_can_manage_listings()
              and salesman_under_listing_limit());
alter policy seller_hidden_models_own_ins on public.seller_hidden_models
  with check ((seller_id = (select auth.uid())) and exists (
    select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'salesman'));
alter policy seller_hidden_models_own_del on public.seller_hidden_models
  using (seller_id = (select auth.uid()));
alter policy seller_hidden_models_own_read on public.seller_hidden_models
  using ((seller_id = (select auth.uid())) or is_superadmin());

-- 8 ---------------------------------------------------------------------------
-- Same two conditions the function checks (Job 1: a Telegram reminder due in
-- the last 10 min; Job 2: a pending booking within -2h..+5h with no nag yet).
select cron.alter_job(7, command := $cron$
  select net.http_post(
    url     := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/appointment-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(public.get_cron_edge_key(), '')
    ),
    body    := '{}'::jsonb
  )
  where exists (
    select 1 from public.appointments a
     where a.remind_sent = false
       and a.remind_at between now() - interval '10 minutes' and now()
  ) or exists (
    select 1 from public.appointments a
     where a.status = 'pending'
       and a.salesman_id is not null
       and a.appointment_date between now() - interval '2 hours' and now() + interval '5 hours'
       and not exists (
         select 1 from public.salesman_notifications n
          where n.type = 'booking_unconfirmed' and n.ref_id = a.id)
  );
$cron$);

commit;
