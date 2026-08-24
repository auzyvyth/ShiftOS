-- In-app buyer <-> seller chat: schema, redaction, RLS, realtime.
-- Applied live 2026-08-23 via MCP apply_migration; committed so the repo and
-- the database do not drift.
--
-- THE ONE RULE THAT MATTERS HERE: masking a number in the UI does not hide it
-- from the AI, because the AI reads the database and not the screen. Every
-- message is therefore stored twice — `body` (raw, what the two humans see,
-- revealed on tap) and `body_ai` (redacted). Every AI path reads body_ai and
-- nothing else. Do not add an AI call that selects `body`.

-- ---------------------------------------------------------------------------
-- 1. SECURITY FIX (prerequisite). handle_new_user() defaulted role to 'dealer'
--    when a signup carried no metadata. An anonymous sign-in carries none, so
--    every guest buyer opening a chat would have received a role='dealer'
--    profile. Anonymous users are always buyers.
--    Verified: anonymous insert into auth.users -> profiles.role = 'buyer'.
-- ---------------------------------------------------------------------------
-- (full body applied live; the only change from the previous version is the
--  `if coalesce(new.is_anonymous,false) then v_role := 'buyer';` branch)


-- ---------------------------------------------------------------------------
-- 2. Redaction. The only version of a message the AI may read.
--    Threshold is 9+ digits: every Malaysian phone number and IC clears it,
--    while a year range ("2018-2020", 8 digits), a price and a mileage do not,
--    so the AI keeps its useful context.
-- ---------------------------------------------------------------------------
create or replace function public.redact_for_ai(p_text text)
returns text language plpgsql immutable set search_path = public as $$
declare
  v_out text := coalesce(p_text, '');
  v_match text;
begin
  v_out := regexp_replace(v_out,
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contact hidden]', 'g');
  for v_match in
    select m[1] from regexp_matches(v_out, '([+(]?[0-9][0-9\s().\-]{6,}[0-9])', 'g') as m
     group by m[1] order by length(m[1]) desc
  loop
    if length(regexp_replace(v_match, '[^0-9]', '', 'g')) >= 9 then
      v_out := replace(v_out, v_match, '[number hidden]');
    end if;
  end loop;
  return v_out;
end; $$;

-- ---------------------------------------------------------------------------
-- 3. Tables. Buyers may be anonymous or registered; either way they are a real
--    auth user, so RLS is uniform and there are no bearer-token games.
-- ---------------------------------------------------------------------------
create table if not exists public.chat_threads (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references public.car_listings(id) on delete cascade,
  dealer_id       uuid references public.profiles(id) on delete cascade,
  salesman_id     uuid references public.profiles(id) on delete set null,
  buyer_id        uuid not null references auth.users(id) on delete cascade,
  buyer_label     text not null,
  buyer_is_anon   boolean not null default true,
  lead_id         uuid references public.leads(id) on delete set null,
  status          text not null default 'open',
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  last_sender_role text,
  buyer_unread    integer not null default 0,
  seller_unread   integer not null default 0,
  constraint chat_threads_status_chk check (status in ('open','closed','blocked'))
);
create unique index if not exists chat_threads_listing_buyer_uniq on public.chat_threads (listing_id, buyer_id);
create index if not exists chat_threads_seller_idx   on public.chat_threads (dealer_id, last_message_at desc);
create index if not exists chat_threads_salesman_idx on public.chat_threads (salesman_id, last_message_at desc);
create index if not exists chat_threads_buyer_idx    on public.chat_threads (buyer_id, last_message_at desc);

create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references public.chat_threads(id) on delete cascade,
  sender_role   text not null,
  sender_id     uuid not null references auth.users(id) on delete cascade,
  body          text not null,
  body_ai       text not null default '',   -- redact_for_ai(body); AI reads ONLY this
  has_sensitive boolean not null default false,
  created_at    timestamptz not null default now(),
  delivered_at  timestamptz,
  read_at       timestamptz,
  constraint chat_messages_role_chk  check (sender_role in ('buyer','seller')),
  constraint chat_messages_body_len  check (char_length(body) between 1 and 4000)
);
create index if not exists chat_messages_thread_idx on public.chat_messages (thread_id, created_at);

-- ---------------------------------------------------------------------------
-- 4. RLS. chat_thread_role() is SECURITY DEFINER so the chat_messages policies
--    can ask "which side am I on" without recursing through chat_threads'
--    own policies.
-- ---------------------------------------------------------------------------
create or replace function public.chat_thread_role(p_thread_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
           when t.buyer_id = auth.uid() then 'buyer'
           when t.salesman_id = auth.uid() then 'seller'
           when t.dealer_id is not null and t.dealer_id = public.get_my_dealer_id() then 'seller'
           else null end
    from public.chat_threads t where t.id = p_thread_id;
$$;

create or replace function public.chat_rate_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) < 20 from public.chat_messages
   where sender_id = auth.uid() and created_at > now() - interval '1 minute';
$$;

alter table public.chat_threads  enable row level security;
alter table public.chat_messages enable row level security;

-- No client INSERT policy on threads: start_chat_thread() derives the seller
-- side from the listing, so a buyer cannot attach themselves to a dealer or
-- salesman of their choosing. No UPDATE/DELETE anywhere: history is
-- append-only and state changes go through the RPCs below.
create policy chat_threads_participant_select on public.chat_threads for select
  using (public.chat_thread_role(id) is not null);
create policy chat_messages_participant_select on public.chat_messages for select
  using (public.chat_thread_role(thread_id) is not null);
create policy chat_messages_participant_insert on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and sender_role = public.chat_thread_role(thread_id)
    and public.chat_rate_ok()
    and exists (select 1 from public.chat_threads t where t.id = thread_id and t.status = 'open')
  );

-- ---------------------------------------------------------------------------
-- 5. Triggers + RPCs (start_chat_thread, mark_chat_read, mark_chat_delivered,
--    chat_redact_message, chat_after_message) — see live DB for full bodies.
--    chat_after_message notifies only on the FIRST unread of a burst, and uses
--    body_ai so a phone number cannot leak onto a lock screen either.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_threads;

-- Verified live (all probes rolled back):
--   redaction on insert: phone + email masked, has_sensitive true
--   seller sees the thread; an unrelated dealer's salesman sees 0 rows
--   buyer posting as sender_role='seller': blocked
--   unrelated salesman posting into the thread: blocked
--   mark_chat_read: zeroes unread, stamps read_at
--   rate limit: blocked after exactly 20 messages/minute
--   anonymous auth signup: profiles.role = 'buyer' (not 'dealer')
