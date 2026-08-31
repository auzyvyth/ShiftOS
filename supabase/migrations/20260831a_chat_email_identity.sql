-- CHAT-EMAIL, part 1: identity propagation + email de-dup + unsubscribe spine.
--
-- Plain version: when a guest buyer finally gives us an email, everything that
-- had been calling them "Guest 4F2A" has to learn their real name — their
-- profile, every chat thread they hold, and the pipeline lead their first
-- message created. None of that happened before this migration, because the
-- only trigger on auth.users is on_auth_user_created and upgrading a guest is
-- an UPDATE, not an INSERT.
--
-- THE ONE RULE HERE: this trigger runs inside the auth transaction. If it ever
-- throws, the user's email verification fails. Every statement below is inside
-- an exception handler that downgrades any failure to a warning. A cosmetic
-- relabel must never cost someone their sign-in.

-- ---------------------------------------------------------------------------
-- 1. Unsubscribe spine. An email nag with no opt-out is what gets
--    alerts@xdrive.my marked as spam, which would take the price alerts down
--    with it.
--
--    The token is checked inside a SECURITY DEFINER FUNCTION that takes it as
--    an ARGUMENT (`where notify_unsub_token = p_token`). It is deliberately NOT
--    an RLS policy or a view: a policy can only describe the token's SHAPE,
--    which matches every row at once for anybody — the exact hole that was live
--    twice on loan_applications. See CLAUDE.md "A share token is a PASSWORD".
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists notify_email_opt_out boolean not null default false,
  add column if not exists notify_unsub_token   uuid    not null default gen_random_uuid();

create or replace function public.email_unsubscribe(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_token is null then return false; end if;
  update public.profiles
     set notify_email_opt_out = true
   where notify_unsub_token = p_token
  returning id into v_id;
  return v_id is not null;
end; $$;

-- Never return the token as a column anywhere: whoever can read it can replay
-- the link. This function answers yes/no and nothing else.
revoke all on function public.email_unsubscribe(uuid) from public;
grant execute on function public.email_unsubscribe(uuid) to anon, authenticated;

-- Marks the last time the unread-reply email went out for a thread, so the
-- cron nags once per unread burst rather than every time it runs.
alter table public.chat_threads
  add column if not exists buyer_email_notified_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. The identity sync itself.
--
--    Fires when auth.users gains an email or stops being anonymous — i.e. when
--    supabase.auth.updateUser({ email }) is confirmed. Because it lives in the
--    database it runs whichever client did the upgrade, the same reason the
--    won-deal fan-out lives in a trigger.
-- ---------------------------------------------------------------------------
create or replace function public.sync_identity_from_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email       text;
  v_meta_name   text;
  v_label       text;
  v_guest_label text;
begin
  v_email := nullif(btrim(coalesce(new.email, '')), '');
  v_meta_name := nullif(btrim(coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name', '')), '');

  -- profiles.email is what every downstream reader uses (the unread-reply cron
  -- included). handle_new_user copies it at INSERT and nothing ever updated it.
  -- coalesce, never overwrite: a name the person typed themselves outranks
  -- whatever the provider metadata says.
  update public.profiles p
     set email     = coalesce(v_email, p.email),
         full_name = coalesce(nullif(btrim(coalesce(p.full_name, '')), ''), v_meta_name)
   where p.id = new.id;

  -- Same label rule as start_chat_thread. Kept in step deliberately: two
  -- different answers to "what is this buyer called" is how the seller ends up
  -- seeing one name in the inbox and another in the pipeline.
  select coalesce(nullif(btrim(p.full_name), ''),
                  nullif(split_part(coalesce(p.email, ''), '@', 1), ''),
                  'Buyer')
    into v_label
    from public.profiles p where p.id = new.id;

  if v_label is null or coalesce(new.is_anonymous, false) then
    return new;
  end if;

  v_guest_label := 'Guest ' || upper(substr(replace(new.id::text, '-', ''), 1, 4));

  -- buyer_label is a SNAPSHOT written once by start_chat_thread and refreshed
  -- only if the buyer happens to reopen the thread. Without this the seller
  -- keeps seeing a guest forever. A buyer can hold several threads (4 live
  -- today), so this is all of them, not the current one.
  update public.chat_threads t
     set buyer_label   = v_label,
         buyer_is_anon = false
   where t.buyer_id = new.id
     and (t.buyer_label is distinct from v_label or t.buyer_is_anon);

  -- And the pipeline lead their first message created, which was stamped with
  -- the guest label and a null email. This is the half that is actually worth
  -- money: it turns "Guest 4F2A" into a named, contactable lead in the rep's
  -- board, This Week and every count that reads leads.
  --
  -- Only renames a lead still carrying the guest label — a name a rep typed
  -- over the top is theirs and must survive.
  update public.leads l
     set buyer_name  = case when coalesce(btrim(l.buyer_name), '') in ('', v_guest_label)
                            then v_label else l.buyer_name end,
         buyer_email = coalesce(nullif(btrim(coalesce(l.buyer_email, '')), ''), v_email),
         updated_at  = now()
    from public.chat_threads t
   where t.buyer_id = new.id
     and l.id = t.lead_id;

  return new;
exception when others then
  -- This runs inside the auth transaction. A relabel is never worth failing
  -- someone's email verification over.
  raise warning 'sync_identity_from_auth_user failed (non-fatal): %', sqlerrm;
  return new;
end; $$;

drop trigger if exists on_auth_user_identity_change on auth.users;
create trigger on_auth_user_identity_change
  after update on auth.users
  for each row
  when (old.email is distinct from new.email
        or old.is_anonymous is distinct from new.is_anonymous)
  execute function public.sync_identity_from_auth_user();

-- ---------------------------------------------------------------------------
-- 3. Lead de-dup on email as well as phone.
--
--    chat_after_message matched on phone only. An email sign-in gives us no
--    phone, so a buyer who had already WhatsApp'd the dealer became a SECOND
--    row for the same human. Email is only trusted here because Supabase has
--    verified it — an unverified address would let someone type a stranger's
--    and merge themselves into that stranger's customer record.
--
--    Everything else in this function is byte-identical to the deployed
--    version (fetched and diffed before editing, per the edge-function/DB
--    drift rule); the only change is the v_existing email branch and filling a
--    blank buyer_email on an existing lead.
-- ---------------------------------------------------------------------------
create or replace function public.chat_after_message()
returns trigger language plpgsql security definer set search_path = public as $$
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
         seller_unread = case when new.sender_role = 'buyer'  then t.seller_unread + 1 else t.seller_unread end,
         -- A new seller reply re-opens the nag window: the buyer has something
         -- unread again, so the cron is allowed to email about it once more.
         buyer_email_notified_at = case when new.sender_role = 'seller' then null else t.buyer_email_notified_at end
   where t.id = new.thread_id
   returning * into v_thread;

  select coalesce(nullif(trim(concat_ws(' ', c.brand, c.model)), ''), 'a car')
    into v_car
    from public.car_listings c where c.id = v_thread.listing_id;

  -- CHAT-1. Who is actually on the buyer side of this thread? A seller messaging
  -- another seller is a TRADE contact, not retail demand. Keep the conversation,
  -- skip the pipeline lead -- filing it as a lead put competitors in each other's
  -- CRM and inflated every count that reads leads. 'buyer' is the only
  -- non-selling role; guest buyers are role='buyer' so they are unaffected.
  select coalesce(p.role, 'buyer') into v_buyer_role
    from public.profiles p where p.id = v_thread.buyer_id;
  v_buyer_role := coalesce(v_buyer_role, 'buyer');

  -- Own block: a lead failure must not cost the seller their notification, and
  -- neither may cost the buyer their message.
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

      -- Then email. A buyer who signed in with an address and never gave a
      -- phone matches nothing above, which is how one human became two rows.
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
               -- Fill a blank only. A corrected address is the rep's, not ours.
               buyer_email    = coalesce(nullif(btrim(coalesce(buyer_email, '')), ''), v_buyer_email),
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
end; $$;
