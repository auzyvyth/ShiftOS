-- Three fixes to how a salesman's work with a buyer connects to the rest of the
-- system. Built from the LIVE function bodies (pg_get_functiondef), not the
-- older repo copy of chat_after_message in 20260830e, which is missing the
-- verified-email dedup and the buyer_email_notified_at reset.
--
-- 1. chat_after_message: a buyer who opens a SECOND chat (about another car)
--    gets a new thread whose salesman_id is resolved from that car alone by
--    start_chat_thread. The message then dedups onto the buyer's existing lead,
--    but the new thread kept its own (usually NULL) owner. The rep who owns the
--    lead never saw the conversation, and the push went to the dealer's general
--    inbox. Now an unowned thread takes the lead's owner. A thread that already
--    has an owner (a car exclusively locked to another rep) is left alone: that
--    lock is the dealer's explicit decision.
--
-- 2. claim_lead: records an 'assigned' lead_activities row, so a claim shows in
--    the lead's history and counts as activity on the dealer's Team tab.
--
-- 3. get_team_activity(p_dealer_id): the dealer's Team tab read "last active"
--    from activity_log, which only the DEALER dashboard ever writes. No salesman
--    action lands there, so every salesman older than 30 days showed
--    "Inactive 30d+" no matter how much they worked. This reads the tables that
--    actually record a rep's work -- lead_activities (stage moves, calls,
--    WhatsApps, notes, claims) and seller chat replies -- plus activity_log for
--    the office roles. Counts and timestamps only; no buyer data leaves it.

-- ── 1. chat_after_message ──────────────────────────────────────────────────
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
  v_owner   uuid;
  v_lead_id uuid;
  v_recent int;
begin
  update public.chat_threads t
     set last_message_at  = new.created_at,
         last_sender_role = new.sender_role,
         buyer_unread  = case when new.sender_role = 'seller' then t.buyer_unread  + 1 else t.buyer_unread  end,
         seller_unread = case when new.sender_role = 'buyer'  then t.seller_unread + 1 else t.seller_unread end,
         -- A new seller reply re-opens the nag window: the buyer has something
         -- unread again, so the cron may email about it once more.
         buyer_email_notified_at = case when new.sender_role = 'seller' then null else t.buyer_email_notified_at end
   where t.id = new.thread_id
   returning * into v_thread;

  select coalesce(nullif(trim(concat_ws(' ', c.brand, c.model)), ''), 'a car')
    into v_car
    from public.car_listings c where c.id = v_thread.listing_id;

  -- CHAT-1. A seller messaging another seller is a TRADE contact, not retail
  -- demand: keep the conversation, skip the pipeline lead.
  select coalesce(p.role, 'buyer') into v_buyer_role
    from public.profiles p where p.id = v_thread.buyer_id;
  v_buyer_role := coalesce(v_buyer_role, 'buyer');

  -- Own block: a lead failure must not cost the seller their notification, and
  -- neither may cost the buyer their message.
  if new.sender_role = 'buyer'
     and v_thread.lead_id is null
     and v_buyer_role = 'buyer' then
    begin
      select public.normalize_my_phone(coalesce(p.phone, p.whatsapp_number)),
             nullif(btrim(coalesce(p.email, '')), '')
        into v_buyer_phone, v_buyer_email
        from public.profiles p where p.id = v_thread.buyer_id;

      if v_buyer_phone is not null then
        select id into v_existing from public.leads
         where dealer_id = v_thread.dealer_id
           and public.normalize_my_phone(phone) = v_buyer_phone
           and coalesce(is_deleted, false) = false
         order by created_at desc limit 1;
      end if;

      -- Verified email only: an unverified address would let someone type a
      -- stranger's and merge into that stranger's record.
      if v_existing is null and v_buyer_email is not null then
        select id into v_existing from public.leads
         where dealer_id = v_thread.dealer_id
           and lower(btrim(coalesce(buyer_email, ''))) = lower(v_buyer_email)
           and coalesce(is_deleted, false) = false
         order by created_at desc limit 1;
      end if;

      if v_existing is not null then
        update public.leads
           set car_listing_id = coalesce(v_thread.listing_id, car_listing_id),
               salesman_id    = coalesce(salesman_id, v_thread.salesman_id),
               buyer_email    = coalesce(nullif(btrim(coalesce(buyer_email, '')), ''), v_buyer_email),
               updated_at     = now()
         where id = v_existing
         returning salesman_id into v_owner;
        v_lead_id := v_existing;

        -- One buyer, one rep: an unowned thread follows the lead's owner.
        if v_owner is not null and v_thread.salesman_id is null then
          update public.chat_threads set salesman_id = v_owner where id = v_thread.id;
          v_thread.salesman_id := v_owner;
        end if;
      else
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

  -- Only ping on the FIRST unread message of a burst.
  v_first_unread := (new.sender_role = 'buyer' and v_thread.seller_unread = 1)
                  or (new.sender_role = 'seller' and v_thread.buyer_unread = 1);
  if not v_first_unread then
    return new;
  end if;

  if new.sender_role = 'buyer' then
    -- Inserting the notification row IS the push (trg_push_on_* fans it out).
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
end; $function$;

-- ── 2. claim_lead ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_lead(p_lead_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_ok boolean; v_dealer uuid;
BEGIN
  IF NOT is_active_salesman() THEN RETURN false; END IF;
  v_dealer := get_my_dealer_id();
  UPDATE leads
     SET salesman_id = auth.uid(), updated_at = now()
   WHERE id = p_lead_id
     AND salesman_id IS NULL
     AND dealer_id = v_dealer
  RETURNING true INTO v_ok;

  IF COALESCE(v_ok, false) THEN
    UPDATE appointments
       SET salesman_id = auth.uid(), updated_at = now()
     WHERE lead_id = p_lead_id
       AND salesman_id IS NULL
       AND dealer_id = v_dealer;

    UPDATE chat_threads
       SET salesman_id = auth.uid()
     WHERE lead_id = p_lead_id
       AND salesman_id IS NULL
       AND dealer_id = v_dealer;

    -- History + Team-tab activity. Must never undo the claim itself.
    BEGIN
      INSERT INTO lead_activities (lead_id, dealer_id, activity_type, note, created_by)
      VALUES (p_lead_id, v_dealer, 'assigned', 'Claimed from the incoming pool', auth.uid());
    EXCEPTION WHEN others THEN
      RAISE WARNING 'claim_lead activity insert failed (non-fatal): %', SQLERRM;
    END;
  END IF;

  RETURN COALESCE(v_ok, false);
END; $function$;

-- ── 3. get_team_activity ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_team_activity(p_dealer_id uuid)
 RETURNS TABLE (user_id uuid, last_active_at timestamptz, actions_30d integer, chats_30d integer)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with ok as (
    -- The subject comes from the session; the argument only has to match it.
    select 1 where p_dealer_id = public.get_my_dealer_id() or public.is_superadmin()
  ),
  ev as (
    select la.created_by as uid, la.created_at as at, 'action'::text as kind
      from public.lead_activities la, ok
     where la.dealer_id = p_dealer_id and la.created_by is not null
    union all
    select m.sender_id, m.created_at, 'chat'
      from public.chat_messages m
      join public.chat_threads t on t.id = m.thread_id, ok
     where t.dealer_id = p_dealer_id and m.sender_role = 'seller'
    union all
    select a.actor_id, a.created_at, 'action'
      from public.activity_log a, ok
     where a.dealer_id = p_dealer_id and a.actor_id is not null
  )
  select uid,
         max(at),
         (count(*) filter (where kind = 'action' and at > now() - interval '30 days'))::int,
         (count(*) filter (where kind = 'chat'   and at > now() - interval '30 days'))::int
    from ev
   group by uid;
$function$;

REVOKE ALL ON FUNCTION public.get_team_activity(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_team_activity(uuid) TO authenticated;
