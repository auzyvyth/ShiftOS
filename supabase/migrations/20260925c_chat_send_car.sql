-- FINDME-1 step 3 (part A): a seller sends one of their cars into a chat as a
-- card. Works in every chat (car-page chats and Find me post chats), because
-- they all share one message table and one ChatThread component.
--
-- 1. chat_can_send_car() is the ONE rule for "may this seller send this car
--    into this thread". The insert policy and the picker (chat_sendable_cars)
--    both call it, so what the picker offers can never drift from what the
--    database accepts.
-- 2. The rule now also honours the exclusivity lock (CLAUDE.md "Car ownership
--    model"): a car assigned to one rep cannot be sent by another rep. The
--    step-1 policy let any rep of the dealer send it. It also requires the car
--    to belong to the thread's dealer, so a card can never tie a lead to a
--    car from a different dealership.
-- 3. Won = sold: a Find me thread has no car of its own, so its lead had no
--    car_listing_id, and a win on it would never flip any car to sold. The
--    car the seller sent now fills that blank (never overwrites a car the
--    lead already has), both when the lead is created and when a card is
--    sent after the lead exists.

-- ── 1. The rule ─────────────────────────────────────────────────────────────
create or replace function public.chat_can_send_car(p_thread_id uuid, p_listing_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.chat_thread_role(p_thread_id) = 'seller', false)
     and exists (
       select 1
         from public.chat_threads t
         join public.car_listings c on c.id = p_listing_id
        where t.id = p_thread_id
          and t.status = 'open'
          and c.status in ('available', 'reserved')
          and c.dealer_id = t.dealer_id
          and c.dealer_id = public.get_my_dealer_id()
          -- exclusivity lock: open car, mine, or I am the dealer who owns it
          and (c.assigned_to is null
               or c.assigned_to = (select auth.uid())
               or c.dealer_id = (select auth.uid()))
     );
$$;

drop policy chat_messages_participant_insert on public.chat_messages;
create policy chat_messages_participant_insert on public.chat_messages
  for insert with check (
    sender_id = (select auth.uid())
    and sender_role = public.chat_thread_role(thread_id)
    and public.chat_rate_ok()
    and exists (select 1 from public.chat_threads t where t.id = chat_messages.thread_id and t.status = 'open')
    and (listing_id is null
         or (sender_role = 'seller' and public.chat_can_send_car(thread_id, listing_id)))
  );

-- ── 2. The picker ───────────────────────────────────────────────────────────
-- Every car this seller may send into this thread. In a Find me thread, cars
-- that fit the buyer's post come first: match_rank 2 = brand + model (and
-- inside the year range / budget when the buyer gave one), 1 = brand only.
create or replace function public.chat_sendable_cars(p_thread_id uuid)
returns table (id uuid, slug text, brand text, model text, variant text, year int,
               selling_price numeric, mileage int, image text, status text, match_rank int)
language sql stable security definer set search_path = public
as $$
  with t as (select * from public.chat_threads where chat_threads.id = p_thread_id),
       p as (select fp.* from public.find_me_posts fp join t on fp.id = t.find_me_post_id)
  select c.id, c.slug, c.brand, c.model, c.variant, c.year, c.selling_price, c.mileage,
         c.images[1], c.status,
         case
           when p.id is null then 0
           when lower(c.brand) = lower(p.brand)
                and (p.model is null or lower(c.model) = lower(p.model))
                and (p.min_year is null or c.year >= p.min_year)
                and (p.max_year is null or c.year <= p.max_year)
                and (p.max_budget is null or c.selling_price <= p.max_budget) then 2
           when lower(c.brand) = lower(p.brand) then 1
           else 0
         end as match_rank
    from public.car_listings c
    cross join t
    left join p on true
   where public.chat_can_send_car(p_thread_id, c.id)
     and c.dealer_id = t.dealer_id
   order by match_rank desc, c.created_at desc nulls last
   limit 200;
$$;

-- ── 3. chat_after_message: the sent car fills the lead's blank car ──────────
-- Same function as 20260925b, with two changes marked "card:".
create or replace function public.chat_after_message()
returns trigger
language plpgsql security definer set search_path = public
as $function$
declare
  v_thread public.chat_threads; v_first_unread boolean; v_car text; v_buyer_phone text; v_buyer_email text;
  v_buyer_role text; v_existing uuid; v_owner uuid; v_lead_id uuid; v_recent int; v_label text;
  v_card uuid;
begin
  update public.chat_threads t
     set last_message_at = new.created_at, last_sender_role = new.sender_role,
         buyer_unread  = case when new.sender_role = 'seller' then t.buyer_unread  + 1 else t.buyer_unread  end,
         seller_unread = case when new.sender_role = 'buyer'  then t.seller_unread + 1 else t.seller_unread end,
         buyer_email_notified_at = case when new.sender_role = 'seller' then null else t.buyer_email_notified_at end
   where t.id = new.thread_id returning * into v_thread;

  -- card: a car sent after the lead exists fills its car if it has none.
  if new.listing_id is not null and v_thread.lead_id is not null then
    begin
      update public.leads set car_listing_id = new.listing_id, updated_at = now()
       where id = v_thread.lead_id and car_listing_id is null;
    exception when others then
      raise warning 'chat_after_message card link failed (non-fatal): %', sqlerrm;
    end;
  end if;

  if v_thread.listing_id is not null then
    select coalesce(nullif(trim(concat_ws(' ', c.brand, c.model)), ''), 'a car') into v_car from public.car_listings c where c.id = v_thread.listing_id;
  elsif v_thread.find_me_post_id is not null then
    select coalesce(nullif(trim(concat_ws(' ', p.brand, p.model)), ''), 'a car') || ' (Find me post)' into v_car from public.find_me_posts p where p.id = v_thread.find_me_post_id;
  end if;
  v_car := coalesce(v_car, 'a car');
  if new.sender_role = 'buyer' and not v_thread.buyer_revealed then
    select coalesce(nullif(trim(p.full_name), ''), nullif(split_part(coalesce(p.email, ''), '@', 1), ''), 'Buyer')
      into v_label from public.profiles p where p.id = v_thread.buyer_id;
    v_label := coalesce(v_label, 'Buyer');
    update public.chat_threads set buyer_label = v_label, buyer_revealed = true where id = v_thread.id;
    v_thread.buyer_label := v_label; v_thread.buyer_revealed := true;
  end if;
  select coalesce(p.role, 'buyer') into v_buyer_role from public.profiles p where p.id = v_thread.buyer_id;
  v_buyer_role := coalesce(v_buyer_role, 'buyer');
  if new.sender_role = 'buyer' and v_thread.lead_id is null and v_buyer_role = 'buyer' then
    begin
      -- card: the thread's own car, else the newest car the seller sent in it.
      v_card := v_thread.listing_id;
      if v_card is null then
        select m.listing_id into v_card from public.chat_messages m
         join public.car_listings c on c.id = m.listing_id and c.dealer_id = v_thread.dealer_id
         where m.thread_id = v_thread.id and m.listing_id is not null
         order by m.created_at desc limit 1;
      end if;
      select public.normalize_my_phone(coalesce(p.phone, p.whatsapp_number)), nullif(btrim(coalesce(p.email, '')), '')
        into v_buyer_phone, v_buyer_email from public.profiles p where p.id = v_thread.buyer_id;
      if v_buyer_phone is not null then
        select id into v_existing from public.leads where dealer_id = v_thread.dealer_id
           and public.normalize_my_phone(phone) = v_buyer_phone and coalesce(is_deleted, false) = false order by created_at desc limit 1;
      end if;
      if v_existing is null and v_buyer_email is not null then
        select id into v_existing from public.leads where dealer_id = v_thread.dealer_id
           and lower(btrim(coalesce(buyer_email, ''))) = lower(v_buyer_email) and coalesce(is_deleted, false) = false order by created_at desc limit 1;
      end if;
      if v_existing is not null then
        update public.leads set car_listing_id = coalesce(v_thread.listing_id, car_listing_id, v_card),
               salesman_id = coalesce(salesman_id, v_thread.salesman_id),
               buyer_email = coalesce(nullif(btrim(coalesce(buyer_email, '')), ''), v_buyer_email), updated_at = now()
         where id = v_existing returning salesman_id into v_owner;
        v_lead_id := v_existing;
        if v_owner is not null and v_thread.salesman_id is null then
          update public.chat_threads set salesman_id = v_owner where id = v_thread.id; v_thread.salesman_id := v_owner;
        end if;
      else
        select count(*) into v_recent from public.leads where dealer_id = v_thread.dealer_id
           and lead_source in ('chat', 'find_me') and created_at > now() - interval '1 hour';
        if v_recent < 40 then
          insert into public.leads (dealer_id, salesman_id, buyer_name, phone, buyer_email, car_listing_id, stage, lead_source, notes, is_deleted)
          values (v_thread.dealer_id, v_thread.salesman_id, v_thread.buyer_label, v_buyer_phone, v_buyer_email, v_card, 'new',
             case when v_thread.find_me_post_id is not null then 'find_me' else 'chat' end,
             case when v_thread.find_me_post_id is not null then 'Replied to your answer on their Find me post (' || v_car || '): '
                  else 'Started an in-app chat: ' end || left(coalesce(new.body_ai, ''), 200), false)
          returning id into v_lead_id;
        end if;
      end if;
      if v_lead_id is not null then update public.chat_threads set lead_id = v_lead_id where id = v_thread.id; end if;
    exception when others then
      raise warning 'chat_after_message lead creation failed (non-fatal): %', sqlerrm;
    end;
  end if;
  v_first_unread := (new.sender_role = 'buyer' and v_thread.seller_unread = 1) or (new.sender_role = 'seller' and v_thread.buyer_unread = 1);
  if not v_first_unread then return new; end if;
  if new.sender_role = 'buyer' then
    if v_thread.salesman_id is not null then
      insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
      values (v_thread.salesman_id, 'chat_message', v_thread.buyer_label || ' · ' || v_car, left(new.body_ai, 140), v_thread.id);
    elsif v_thread.dealer_id is not null then
      insert into public.dealer_notifications (dealer_id, type, title, body, ref_id)
      values (v_thread.dealer_id, 'chat_message', v_thread.buyer_label || ' · ' || v_car, left(new.body_ai, 140), v_thread.id);
    end if;
  elsif new.sender_role = 'seller' then
    perform public.push_to_users(array[v_thread.buyer_id], v_car, left(new.body_ai, 140), '/account/messages', 'chat-' || v_thread.id);
  end if;
  return new;
exception when others then
  raise warning 'chat_after_message notify failed (non-fatal): %', sqlerrm;
  return new;
end; $function$;

-- ── Grants: PUBLIC first (anon inherits it), then anon directly ─────────────
revoke all on function public.chat_can_send_car(uuid, uuid) from public;
revoke all on function public.chat_sendable_cars(uuid) from public;
revoke all on function public.chat_can_send_car(uuid, uuid) from anon;
revoke all on function public.chat_sendable_cars(uuid) from anon;
grant execute on function public.chat_can_send_car(uuid, uuid) to authenticated;
grant execute on function public.chat_sendable_cars(uuid) to authenticated;
