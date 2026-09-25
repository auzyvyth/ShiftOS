-- FINDME-1 step 1: "Find me" posts. A signed-in buyer posts the car they want;
-- approved sellers answer with "I have it", which opens a chat with the buyer
-- and can carry one of the seller's cars as a card.
--
-- Rules this migration enforces (the UI only mirrors them):
--   * only a signed-in, non-anonymous role='buyer' account can post
--     (3 open posts at once, 5 new posts a day)
--   * only an approved, active dealer/owner/salesman can answer
--   * one chat per seller per post, 5 sellers per post, 10 new post chats per
--     seller per day
--   * the public never sees who posted: no buyer_id leaves the database, and a
--     seller sees "Buyer in <state>" until the buyer replies (PDPA 2010 s.8 —
--     the buyer's identity reaches a seller only by the buyer's own action)
--   * the buyer's note is stored through redact_for_ai, so a phone number or
--     email typed into a public card is masked
--   * nothing becomes a pipeline lead until the buyer replies
--     (chat_after_message, lead_source 'find_me')

-- ── Posts ────────────────────────────────────────────────────────────────────
create table public.find_me_posts (
  id          uuid primary key default gen_random_uuid(),
  buyer_id    uuid not null references auth.users(id) on delete cascade,
  brand       text not null,
  model       text,
  min_year    int,
  max_year    int,
  max_budget  numeric,
  state       text,
  note        text,
  status      text not null default 'open' check (status in ('open', 'found', 'closed')),
  reply_count int  not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days',
  closed_at   timestamptz,
  constraint find_me_years  check (min_year is null or max_year is null or min_year <= max_year),
  constraint find_me_budget check (max_budget is null or max_budget > 0),
  constraint find_me_note   check (note is null or length(note) <= 280)
);
create index find_me_posts_open_idx  on public.find_me_posts (created_at desc) where status = 'open';
create index find_me_posts_buyer_idx on public.find_me_posts (buyer_id, created_at desc);

alter table public.find_me_posts enable row level security;
-- A buyer reads their own posts (any status). Everyone else reads through
-- list_find_me_posts / get_find_me_post, which never return buyer_id.
-- No write policies: every write goes through the functions below.
create policy find_me_posts_own_select on public.find_me_posts
  for select using (buyer_id = (select auth.uid()));
revoke all on public.find_me_posts from public, anon, authenticated;
grant select on public.find_me_posts to authenticated;

-- ── Chats that hang off a post instead of a car ─────────────────────────────
alter table public.chat_threads alter column listing_id drop not null;
alter table public.chat_threads
  add column find_me_post_id uuid references public.find_me_posts(id) on delete cascade,
  -- false while the seller only knows "Buyer in <state>"; flipped on the
  -- buyer's first reply, when the label becomes their real name.
  add column buyer_revealed boolean not null default true;
alter table public.chat_threads
  add constraint chat_threads_subject check (listing_id is not null or find_me_post_id is not null);
-- One chat per seller per post. A dealer answering keys on dealer_id; a
-- salesman keys on themselves.
create unique index chat_threads_findme_seller_uniq
  on public.chat_threads (find_me_post_id, coalesce(salesman_id, dealer_id))
  where find_me_post_id is not null;

-- A car sent into a chat as a card.
alter table public.chat_messages
  add column listing_id uuid references public.car_listings(id) on delete set null;

-- Same insert rule as before, plus: only a seller may attach a car, and only a
-- live car they can sell (their dealer's, assigned to them, or featured by them).
drop policy chat_messages_participant_insert on public.chat_messages;
create policy chat_messages_participant_insert on public.chat_messages
  for insert with check (
    sender_id = (select auth.uid())
    and sender_role = public.chat_thread_role(thread_id)
    and public.chat_rate_ok()
    and exists (select 1 from public.chat_threads t where t.id = chat_messages.thread_id and t.status = 'open')
    and (
      listing_id is null
      or (sender_role = 'seller' and exists (
        select 1 from public.car_listings c
         where c.id = chat_messages.listing_id
           and c.status in ('available', 'reserved')
           and (c.dealer_id = public.get_my_dealer_id()
                or c.assigned_to = (select auth.uid())
                or exists (select 1 from public.salesman_listings sl
                            where sl.listing_id = c.id and sl.salesman_id = (select auth.uid())))))
    )
  );

alter table public.leads drop constraint leads_lead_source_check;
alter table public.leads add constraint leads_lead_source_check check (lead_source = any (array[
  'walk_in', 'whatsapp', 'referral', 'drevo_enquiry', 'enquiry', 'manual', 'chat', 'find_me']));

-- ── Buyer: post / close ─────────────────────────────────────────────────────
create or replace function public.create_find_me_post(
  p_brand text, p_model text default null, p_min_year int default null, p_max_year int default null,
  p_max_budget numeric default null, p_state text default null, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_anon  boolean;
  v_role  text;
  v_brand text := nullif(btrim(coalesce(p_brand, '')), '');
  v_model text;
  v_year  int := extract(year from now())::int + 1;
  v_id    uuid;
begin
  if v_uid is null then raise exception 'sign_in_required'; end if;
  select coalesce(u.is_anonymous, false) into v_anon from auth.users u where u.id = v_uid;
  if v_anon then raise exception 'sign_in_required'; end if;
  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'buyer' then raise exception 'buyers_only'; end if;

  if v_brand is null or length(v_brand) > 40 then raise exception 'invalid_brand'; end if;
  if length(coalesce(p_model, '')) > 60 then raise exception 'invalid_model'; end if;
  if (p_min_year is not null and (p_min_year < 1980 or p_min_year > v_year))
     or (p_max_year is not null and (p_max_year < 1980 or p_max_year > v_year)) then
    raise exception 'invalid_year';
  end if;
  if p_max_budget is not null and (p_max_budget < 1000 or p_max_budget > 10000000) then
    raise exception 'invalid_budget';
  end if;
  if length(coalesce(p_note, '')) > 280 then raise exception 'note_too_long'; end if;

  if (select count(*) from public.find_me_posts
       where buyer_id = v_uid and status = 'open' and expires_at > now()) >= 3 then
    raise exception 'too_many_open_posts';
  end if;
  if (select count(*) from public.find_me_posts
       where buyer_id = v_uid and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limited';
  end if;

  -- Same model cleanup as listings (trg_normalize_car_model), so a post for
  -- "ALPHARD 2.5L" and a listed "Alphard" name the same car.
  v_model := (public.normalize_car_model_parts(v_brand, nullif(btrim(coalesce(p_model, '')), ''), null)).model;

  insert into public.find_me_posts (buyer_id, brand, model, min_year, max_year, max_budget, state, note)
  values (v_uid, v_brand, v_model,
          p_min_year, p_max_year, p_max_budget,
          nullif(btrim(coalesce(p_state, '')), ''),
          nullif(btrim(public.redact_for_ai(btrim(coalesce(p_note, '')))), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- "Found it" (p_found) or plain close. Only the poster; open chats stay usable.
create or replace function public.close_find_me_post(p_id uuid, p_found boolean default true)
returns boolean
language sql
security definer
set search_path = public
as $$
  with u as (
    update public.find_me_posts
       set status = case when p_found then 'found' else 'closed' end, closed_at = now()
     where id = p_id and buyer_id = auth.uid() and status = 'open'
    returning 1)
  select exists (select 1 from u);
$$;

-- ── Public read: never returns buyer_id ─────────────────────────────────────
create or replace function public.list_find_me_posts(p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, brand text, model text, min_year int, max_year int, max_budget numeric,
  state text, note text, status text, reply_count int, is_full boolean,
  created_at timestamptz, expires_at timestamptz, is_mine boolean, i_replied boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.brand, p.model, p.min_year, p.max_year, p.max_budget,
         p.state, p.note, p.status, p.reply_count, p.reply_count >= 5,
         p.created_at, p.expires_at,
         coalesce(p.buyer_id = auth.uid(), false),
         exists (select 1 from public.chat_threads t
                  where t.find_me_post_id = p.id
                    and (t.salesman_id = auth.uid()
                         or (t.salesman_id is null and t.dealer_id = public.get_my_dealer_id())))
    from public.find_me_posts p
   where p.status = 'open' and p.expires_at > now()
   order by p.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- One post: open ones for anybody, any status for its own buyer.
create or replace function public.get_find_me_post(p_id uuid)
returns table (
  id uuid, brand text, model text, min_year int, max_year int, max_budget numeric,
  state text, note text, status text, reply_count int, is_full boolean,
  created_at timestamptz, expires_at timestamptz, is_mine boolean, i_replied boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.brand, p.model, p.min_year, p.max_year, p.max_budget,
         p.state, p.note,
         case when p.status = 'open' and p.expires_at <= now() then 'expired' else p.status end,
         p.reply_count, p.reply_count >= 5,
         p.created_at, p.expires_at,
         coalesce(p.buyer_id = auth.uid(), false),
         exists (select 1 from public.chat_threads t
                  where t.find_me_post_id = p.id
                    and (t.salesman_id = auth.uid()
                         or (t.salesman_id is null and t.dealer_id = public.get_my_dealer_id())))
    from public.find_me_posts p
   where p.id = p_id
     and ((p.status = 'open' and p.expires_at > now()) or p.buyer_id = auth.uid());
$$;

-- ── Seller: "I have it" ─────────────────────────────────────────────────────
-- Opens (or returns) this seller's chat on the post and sends the first
-- message in one step, so a reply slot is only spent on a real message.
-- Errors the UI branches on: sign_in_required, not_a_seller,
-- seller_under_review, post_closed, own_post, post_full, daily_limit.
create or replace function public.find_me_reply(p_post_id uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_anon    boolean;
  v_me      public.profiles;
  v_post    public.find_me_posts;
  v_dealer  uuid;
  v_salesman uuid;
  v_key     uuid;
  v_id      uuid;
  v_msg     text := btrim(coalesce(p_message, ''));
begin
  if v_uid is null then raise exception 'sign_in_required'; end if;
  select coalesce(u.is_anonymous, false) into v_anon from auth.users u where u.id = v_uid;
  if v_anon then raise exception 'sign_in_required'; end if;

  select * into v_me from public.profiles where id = v_uid;
  if v_me.role is null or v_me.role not in ('dealer', 'owner', 'salesman') then
    raise exception 'not_a_seller';
  end if;
  if v_me.approval_status is distinct from 'approved'
     or v_me.is_active is not true
     or coalesce(v_me.account_status, 'active') <> 'active' then
    raise exception 'seller_under_review';
  end if;

  v_dealer   := public.get_my_dealer_id();
  v_salesman := case when v_me.role = 'salesman' then v_uid else null end;
  v_key      := coalesce(v_salesman, v_dealer);

  select * into v_post from public.find_me_posts where id = p_post_id for update;
  if v_post.id is null or v_post.status <> 'open' or v_post.expires_at <= now() then
    raise exception 'post_closed';
  end if;
  if v_post.buyer_id = v_uid then raise exception 'own_post'; end if;

  -- Already answered this post: hand back the chat, spend nothing.
  select t.id into v_id from public.chat_threads t
   where t.find_me_post_id = p_post_id and coalesce(t.salesman_id, t.dealer_id) = v_key;
  if v_id is not null then return v_id; end if;

  if v_msg = '' or length(v_msg) > 2000 then raise exception 'invalid_message'; end if;
  if v_post.reply_count >= 5 then raise exception 'post_full'; end if;
  if (select count(*) from public.chat_threads t
       where t.find_me_post_id is not null
         and coalesce(t.salesman_id, t.dealer_id) = v_key
         and t.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'daily_limit';
  end if;

  insert into public.chat_threads
    (listing_id, find_me_post_id, dealer_id, salesman_id, buyer_id,
     buyer_label, buyer_is_anon, buyer_revealed)
  values
    (null, p_post_id, v_dealer, v_salesman, v_post.buyer_id,
     'Buyer in ' || coalesce(v_post.state, 'Malaysia'), false, false)
  returning id into v_id;

  update public.find_me_posts set reply_count = reply_count + 1 where id = p_post_id;

  -- The normal message path: trg_chat_redact fills body_ai, chat_after_message
  -- pushes the buyer.
  insert into public.chat_messages (thread_id, sender_role, sender_id, body)
  values (v_id, 'seller', v_uid, v_msg);

  return v_id;
end;
$$;

-- ── chat_after_message: post-aware ──────────────────────────────────────────
-- Changes from the live version, nothing else:
--   * a post chat names the post ("Toyota Alphard (Find me post)") where a car
--     chat names the car
--   * the buyer's first reply in a post chat reveals their name to the seller
--     (buyer_revealed) BEFORE the lead is created, so the lead carries it
--   * a lead from a post chat is lead_source 'find_me'; the hourly flood cap
--     counts both chat sources
create or replace function public.chat_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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
  v_label   text;
begin
  update public.chat_threads t
     set last_message_at  = new.created_at,
         last_sender_role = new.sender_role,
         buyer_unread  = case when new.sender_role = 'seller' then t.buyer_unread  + 1 else t.buyer_unread  end,
         seller_unread = case when new.sender_role = 'buyer'  then t.seller_unread + 1 else t.seller_unread end,
         buyer_email_notified_at = case when new.sender_role = 'seller' then null else t.buyer_email_notified_at end
   where t.id = new.thread_id
   returning * into v_thread;

  if v_thread.listing_id is not null then
    select coalesce(nullif(trim(concat_ws(' ', c.brand, c.model)), ''), 'a car')
      into v_car
      from public.car_listings c where c.id = v_thread.listing_id;
  elsif v_thread.find_me_post_id is not null then
    select coalesce(nullif(trim(concat_ws(' ', p.brand, p.model)), ''), 'a car') || ' (Find me post)'
      into v_car
      from public.find_me_posts p where p.id = v_thread.find_me_post_id;
  end if;
  v_car := coalesce(v_car, 'a car');

  -- Post chat: the seller has only seen "Buyer in <state>". The buyer
  -- replying is the consent to show who they are.
  if new.sender_role = 'buyer' and not v_thread.buyer_revealed then
    select coalesce(nullif(trim(p.full_name), ''),
                    nullif(split_part(coalesce(p.email, ''), '@', 1), ''),
                    'Buyer')
      into v_label
      from public.profiles p where p.id = v_thread.buyer_id;
    v_label := coalesce(v_label, 'Buyer');
    update public.chat_threads set buyer_label = v_label, buyer_revealed = true where id = v_thread.id;
    v_thread.buyer_label := v_label;
    v_thread.buyer_revealed := true;
  end if;

  select coalesce(p.role, 'buyer') into v_buyer_role
    from public.profiles p where p.id = v_thread.buyer_id;
  v_buyer_role := coalesce(v_buyer_role, 'buyer');

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

        if v_owner is not null and v_thread.salesman_id is null then
          update public.chat_threads set salesman_id = v_owner where id = v_thread.id;
          v_thread.salesman_id := v_owner;
        end if;
      else
        select count(*) into v_recent from public.leads
         where dealer_id = v_thread.dealer_id
           and lead_source in ('chat', 'find_me')
           and created_at > now() - interval '1 hour';
        if v_recent < 40 then
          insert into public.leads
            (dealer_id, salesman_id, buyer_name, phone, buyer_email,
             car_listing_id, stage, lead_source, notes, is_deleted)
          values
            (v_thread.dealer_id, v_thread.salesman_id, v_thread.buyer_label,
             v_buyer_phone, v_buyer_email, v_thread.listing_id, 'new',
             case when v_thread.find_me_post_id is not null then 'find_me' else 'chat' end,
             case when v_thread.find_me_post_id is not null
                  then 'Replied to your answer on their Find me post (' || v_car || '): '
                  else 'Started an in-app chat: ' end
               || left(coalesce(new.body_ai, ''), 200),
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

  v_first_unread := (new.sender_role = 'buyer' and v_thread.seller_unread = 1)
                  or (new.sender_role = 'seller' and v_thread.buyer_unread = 1);
  if not v_first_unread then
    return new;
  end if;

  if new.sender_role = 'buyer' then
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
  raise warning 'chat_after_message notify failed (non-fatal): %', sqlerrm;
  return new;
end; $function$;

-- ── Grants: revoke from PUBLIC first (anon inherits PUBLIC), then grant ─────
revoke all on function public.create_find_me_post(text, text, int, int, numeric, text, text) from public;
revoke all on function public.close_find_me_post(uuid, boolean) from public;
revoke all on function public.list_find_me_posts(int, int) from public;
revoke all on function public.get_find_me_post(uuid) from public;
revoke all on function public.find_me_reply(uuid, text) from public;
-- Supabase also grants new functions to anon DIRECTLY (default privileges),
-- so revoking from PUBLIC alone leaves anon able to call them. Found in the
-- dry run: anon reached create_find_me_post and was stopped only by its own
-- sign-in check. Belt and braces for the three write paths.
revoke all on function public.create_find_me_post(text, text, int, int, numeric, text, text) from anon;
revoke all on function public.close_find_me_post(uuid, boolean) from anon;
revoke all on function public.find_me_reply(uuid, text) from anon;
grant execute on function public.create_find_me_post(text, text, int, int, numeric, text, text) to authenticated;
grant execute on function public.close_find_me_post(uuid, boolean) to authenticated;
grant execute on function public.list_find_me_posts(int, int) to anon, authenticated;
grant execute on function public.get_find_me_post(uuid) to anon, authenticated;
grant execute on function public.find_me_reply(uuid, text) to authenticated;
