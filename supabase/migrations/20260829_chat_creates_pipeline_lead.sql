-- A buyer who chats in the app never reached the seller's pipeline.
--
-- Applied live via MCP apply_migration on 2026-08-29 (migrations
-- in_app_chat_creates_pipeline_lead + dedup_leads_on_normalized_phone);
-- committed here so the repo carries the source.
--
-- Every other inbound path creates a `leads` row: a WhatsApp tap goes through
-- create_lead_from_whatsapp, the enquiry form through the enquiry_to_lead
-- trigger. In-app chat only fired a notification -- chat_after_message pinged
-- the seller and stopped there -- so the buyer existed in the inbox and nowhere
-- else. No pipeline row, no follow-up, nothing in "This week", and invisible to
-- every count the seller judges their week by.
--
-- Second bug found while wiring it up: lead de-duplication compared phone
-- numbers that can never be equal. trg_leads_normalize_phone runs
-- normalize_my_phone() on every write, so leads.phone is always stored as
-- 60xxxxxxxxx, but both inbound paths compared digits-only of the RAW incoming
-- number against it. A buyer who typed "0123456789" was matched against the
-- stored "60123456789" and never found, so the same person got a fresh lead
-- every time. The chat path reads the phone off `profiles`, which stores the
-- local "01..." form, so it would have missed every single time.

-- 1) 'chat' is a real lead source ---------------------------------------------
alter table public.leads drop constraint if exists leads_lead_source_check;
alter table public.leads add constraint leads_lead_source_check
  check (lead_source = any (array[
    'walk_in','whatsapp','referral','drevo_enquiry','enquiry','manual','chat'
  ]));

-- 2) One lead per thread, and a way back to it -------------------------------
alter table public.chat_threads
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

comment on column public.chat_threads.lead_id is
  'The pipeline lead this conversation created. Set on the buyer''s first message; NULL means no lead yet (the buyer has not spoken).';

-- 3) WhatsApp de-dup on the normalized number ---------------------------------
create or replace function public.create_lead_from_whatsapp(
  p_dealer_id uuid,
  p_name text,
  p_phone text,
  p_state text,
  p_car_id uuid,
  p_ref_slug text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_phone text := public.normalize_my_phone(p_phone);
  v_name text := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_state text := NULLIF(btrim(COALESCE(p_state, '')), '');
  v_salesman uuid;
  v_existing uuid;
  v_id uuid;
  v_recent integer;
BEGIN
  IF p_dealer_id IS NULL OR v_name IS NULL THEN
    RAISE EXCEPTION 'name and dealer are required';
  END IF;

  v_salesman := public.resolve_lead_salesman(p_dealer_id, p_car_id, p_ref_slug, NULL);

  IF v_phone IS NOT NULL THEN
    -- Both sides normalized: the column is written that way, so this is the
    -- only comparison that can ever match.
    SELECT id INTO v_existing FROM leads
    WHERE dealer_id = p_dealer_id
      AND public.normalize_my_phone(phone) = v_phone
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
    UPDATE leads SET
      car_listing_id = COALESCE(p_car_id, car_listing_id),
      phone = COALESCE(NULLIF(v_phone, ''), phone),
      buyer_state = COALESCE(buyer_state, v_state),
      salesman_id = COALESCE(salesman_id, v_salesman),
      updated_at = now()
    WHERE id = v_existing;
    RETURN v_existing;
  END IF;

  SELECT count(*) INTO v_recent FROM leads
   WHERE dealer_id = p_dealer_id
     AND lead_source = 'whatsapp'
     AND created_at > now() - interval '1 hour';
  IF v_recent >= 40 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO leads (dealer_id, salesman_id, buyer_name, phone, buyer_state, car_listing_id, stage, lead_source, is_deleted)
  VALUES (p_dealer_id, v_salesman, v_name, v_phone, v_state, p_car_id, 'new', 'whatsapp', false)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- 4) The buyer's first chat message creates the lead --------------------------
--
-- On the first message, not on opening the thread: opening a chat window and
-- typing nothing is not a lead, the same reason the WhatsApp path captures on
-- the ContactGate submit rather than the button click.
--
-- Attribution is NOT re-derived here. chat_threads.salesman_id was already
-- resolved by start_chat_thread via resolve_lead_salesman, and re-implementing
-- that rule inline is exactly what made WhatsApp leads vanish twice.
create or replace function public.chat_after_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_thread  public.chat_threads;
  v_first_unread boolean;
  v_car     text;
  v_buyer_phone text;
  v_buyer_email text;
  v_existing uuid;
  v_lead_id uuid;
  v_recent int;
begin
  update public.chat_threads t
     set last_message_at  = new.created_at,
         last_sender_role = new.sender_role,
         buyer_unread  = case when new.sender_role = 'seller' then t.buyer_unread  + 1 else t.buyer_unread  end,
         seller_unread = case when new.sender_role = 'buyer'  then t.seller_unread + 1 else t.seller_unread end
   where t.id = new.thread_id
   returning * into v_thread;

  select coalesce(nullif(trim(concat_ws(' ', c.brand, c.model)), ''), 'a car')
    into v_car
    from public.car_listings c where c.id = v_thread.listing_id;

  -- Own block: a lead failure must not cost the seller their notification, and
  -- neither may cost the buyer their message.
  if new.sender_role = 'buyer' and v_thread.lead_id is null then
    begin
      -- A guest buyer has no phone and no email; a signed-in one usually does.
      -- profiles stores the local "01..." form, so normalize before comparing.
      select public.normalize_my_phone(coalesce(p.phone, p.whatsapp_number)),
             nullif(btrim(coalesce(p.email, '')), '')
        into v_buyer_phone, v_buyer_email
        from public.profiles p where p.id = v_thread.buyer_id;

      -- The same person may already be in the pipeline from a WhatsApp tap or
      -- an enquiry. Match on phone the way create_lead_from_whatsapp does, so
      -- one buyer is one lead rather than one per channel.
      if v_buyer_phone is not null then
        select id into v_existing from public.leads
         where dealer_id = v_thread.dealer_id
           and public.normalize_my_phone(phone) = v_buyer_phone
           and coalesce(is_deleted, false) = false
         order by created_at desc limit 1;
      end if;

      if v_existing is not null then
        update public.leads
           set car_listing_id = coalesce(v_thread.listing_id, car_listing_id),
               salesman_id    = coalesce(salesman_id, v_thread.salesman_id),
               updated_at     = now()
         where id = v_existing;
        v_lead_id := v_existing;
      else
        -- Same shape of abuse guard as the WhatsApp path.
        select count(*) into v_recent from public.leads
         where dealer_id = v_thread.dealer_id
           and lead_source = 'chat'
           and created_at > now() - interval '1 hour';
        if v_recent < 40 then
          insert into public.leads
            (dealer_id, salesman_id, buyer_name, phone, buyer_email,
             car_listing_id, stage, lead_source, notes, is_deleted)
          values
            (v_thread.dealer_id, v_thread.salesman_id, v_thread.buyer_label,
             v_buyer_phone, v_buyer_email, v_thread.listing_id, 'new', 'chat',
             -- body_ai, not body: lead notes are read by the AI drafting
             -- features, and a phone or IC must not reach them this way.
             'Started an in-app chat: ' || left(coalesce(new.body_ai, ''), 200),
             false)
          returning id into v_lead_id;
        end if;
      end if;

      if v_lead_id is not null then
        update public.chat_threads set lead_id = v_lead_id where id = v_thread.id;
      end if;
    exception when others then
      raise warning 'chat_after_message lead creation failed (non-fatal): %', sqlerrm;
    end;
  end if;

  -- Only ping on the FIRST unread message of a burst, so a buyer/seller typing
  -- five lines in a row is one notification, not five.
  v_first_unread := (new.sender_role = 'buyer' and v_thread.seller_unread = 1)
                  or (new.sender_role = 'seller' and v_thread.buyer_unread = 1);
  if not v_first_unread then
    return new;
  end if;

  if new.sender_role = 'buyer' then
    -- Inserting the notification row IS the push (trg_push_on_* fans it out).
    -- Body uses the redacted text so a phone number can't leak into a lock-screen
    -- notification either.
    if v_thread.salesman_id is not null then
      insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
      values (v_thread.salesman_id, 'chat_message',
              v_thread.buyer_label || ' · ' || v_car,
              left(new.body_ai, 140), v_thread.id);
    elsif v_thread.dealer_id is not null then
      insert into public.dealer_notifications (dealer_id, type, title, body, ref_id)
      values (v_thread.dealer_id, 'chat_message',
              v_thread.buyer_label || ' · ' || v_car,
              left(new.body_ai, 140), v_thread.id);
    end if;
  elsif new.sender_role = 'seller' then
    -- Buyers have no notifications table to insert into (nothing else reads
    -- one yet), so push directly instead of adding a table just to trigger off.
    perform public.push_to_users(
      array[v_thread.buyer_id],
      v_car,
      left(new.body_ai, 140),
      '/account/messages',
      'chat-' || v_thread.id
    );
  end if;

  return new;
exception when others then
  -- A notification failure must never lose the buyer's message.
  raise warning 'chat_after_message notify failed (non-fatal): %', sqlerrm;
  return new;
end;
$function$;
