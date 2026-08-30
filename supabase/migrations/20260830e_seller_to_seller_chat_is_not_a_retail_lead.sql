-- CHAT-1: a seller messaging another seller is a trade enquiry, not a buyer.
--
-- start_chat_thread() only checks that someone is signed in, so any account can
-- open a thread on any listing and is written in as buyer_id. That is FINE and
-- deliberate -- dealer-to-dealer trade is a real part of the Malaysian used-car
-- market and we are not going to block it. What was wrong is what happened
-- next: chat_after_message filed every one of those as a pipeline lead, so a
-- competitor asking about a unit landed in the other dealer's CRM as retail
-- demand. Two of nine live threads had already done exactly this.
--
-- The damage is to the numbers everyone reads: lead counts, conversion rate,
-- "This week" call lists and every source breakdown treat those rows as
-- shoppers. A salesman calling that number is calling another salesman.
--
-- So: keep the conversation, skip the lead. The seller still gets the
-- notification (and therefore the push) -- they should absolutely see the
-- message, it just does not belong in the pipeline.
--
-- 'buyer' is the only non-selling role, so anything else on the buyer side of a
-- thread is a trade contact. Guest buyers are role='buyer' (handle_new_user
-- forces it for anonymous users), so they are unaffected and still create leads.

CREATE OR REPLACE FUNCTION public.chat_after_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_thread  public.chat_threads;
  v_first_unread boolean;
  v_car     text;
  v_buyer_phone text;
  v_buyer_email text;
  v_buyer_role  text;
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

  -- CHAT-1. Who is actually on the buyer side of this thread?
  select coalesce(p.role, 'buyer') into v_buyer_role
    from public.profiles p where p.id = v_thread.buyer_id;
  v_buyer_role := coalesce(v_buyer_role, 'buyer');

  -- ── Pipeline lead ─────────────────────────────────────────────────────────
  -- Own block: a lead failure must not cost the seller their notification, and
  -- neither may cost the buyer their message.
  --
  -- Skipped entirely when the "buyer" is another seller (CHAT-1) -- that is a
  -- trade conversation, and filing it as retail demand corrupts every pipeline
  -- number downstream.
  if new.sender_role = 'buyer'
     and v_thread.lead_id is null
     and v_buyer_role = 'buyer' then
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

  -- ── Notification ──────────────────────────────────────────────────────────
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
    -- notification either. Trade contacts get notified too -- only the LEAD is
    -- skipped for them, never the message.
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
