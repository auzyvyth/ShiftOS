-- PUSH-2 (2026-10-05): a solo seller (Lite/Premium, dealer_id NULL) got no bell
-- entry for an organic enquiry. notify_salesman_new_enquiry resolved the rep
-- inline: explicit -> ref_slug -> "every salesman WHERE dealer_id = dealer".
-- A solo seller owns themselves, so that loop matched nobody. It also had an
-- unscoped slug fallback that could ping a salesman of ANOTHER dealer with the
-- buyer's name and phone.
--
-- Fix: one resolver again (resolve_lead_salesman, CLAUDE.md "Inbound lead
-- attribution"). Rule 4 of it attributes to the self-owned salesman.
--
-- No double push: for a solo seller notify_new_enquiry also wrote a
-- dealer_notifications row, which no solo surface reads (Lite and Premium read
-- salesman_notifications only) but which pushed. Now the salesman row pushes,
-- so the dealer row is skipped when the "dealer" is a solo salesman.

create or replace function public.notify_new_enquiry()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if exists (select 1 from profiles
              where id = new.dealer_id and role = 'salesman' and dealer_id is null) then
    return new;  -- solo seller: notify_salesman_new_enquiry covers them
  end if;
  insert into dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
  values (
    new.dealer_id, 'new_enquiry', 'New enquiry received',
    coalesce(new.buyer_name, 'Someone') || ' is interested in a car',
    'crm', new.id
  );
  return new;
end; $function$;

create or replace function public.notify_salesman_new_enquiry()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_salesman_id uuid; v_telegram_chat_id text; v_car_name text; v_dealer_name text;
  v_base text; v_msg text; r record;
BEGIN
  v_salesman_id := resolve_lead_salesman(NEW.dealer_id, NEW.listing_id, NEW.ref_slug, NEW.salesman_id);

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
    -- Attributed lead -> the one salesman.
    INSERT INTO salesman_notifications (salesman_id, type, title, body, ref_id)
    VALUES (v_salesman_id, 'new_enquiry', 'New Enquiry 💬',
      COALESCE(NEW.buyer_name, 'Someone') || ' enquired about a listing', NEW.id);
    SELECT telegram_chat_id INTO v_telegram_chat_id FROM profiles WHERE id = v_salesman_id;
    IF v_telegram_chat_id IS NOT NULL THEN
      v_msg := '🔔 *New Enquiry*' || E'\n' || v_base || E'\n' || '⚡ Open ShiftOS now to follow up before they go cold.';
      PERFORM net.http_post(
        url := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/telegram-enquiry-notify',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('chat_id', v_telegram_chat_id, 'message', v_msg));
    END IF;
  ELSIF NEW.dealer_id IS NOT NULL THEN
    -- Organic unassigned lead -> ping every salesman of the dealer (first claims it).
    v_msg := '🆕 *New Unclaimed Lead*' || E'\n' || v_base || E'\n' || '⚡ First to claim it in ShiftOS gets it!';
    FOR r IN SELECT id, telegram_chat_id FROM profiles
             WHERE dealer_id = NEW.dealer_id AND role = 'salesman' LOOP
      INSERT INTO salesman_notifications (salesman_id, type, title, body, ref_id)
      VALUES (r.id, 'new_enquiry', 'New Unclaimed Lead 🆕',
        COALESCE(NEW.buyer_name, 'Someone') || ' enquired — claim it first', NEW.id);
      IF r.telegram_chat_id IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/telegram-enquiry-notify',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object('chat_id', r.telegram_chat_id, 'message', v_msg));
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $function$;
