-- RAPTOR-1 + RAPTOR-4: timed follow-up nudges, AI-drafted, ALWAYS human-sent.
-- Applied to the live DB 2026-08-23 via MCP apply_migration; committed here so
-- the repo and the database do not drift.
--
-- A nudge is a REMINDER with the message already written. Nothing in this
-- schema or its cron job ever contacts a buyer — the salesman reviews the
-- draft and presses send in WhatsApp themselves. Do not add an auto-send path.

create table if not exists public.scheduled_nudges (
  id            uuid primary key default gen_random_uuid(),
  dealer_id     uuid references public.profiles(id) on delete cascade,
  salesman_id   uuid not null references public.profiles(id) on delete cascade,
  lead_id       uuid not null references public.leads(id) on delete cascade,
  draft_message text not null,
  channel       text not null default 'whatsapp',
  reason        text,
  ai_drafted    boolean not null default false,
  scheduled_for timestamptz not null,
  status        text not null default 'pending',
  created_at    timestamptz not null default now(),
  notified_at   timestamptz,
  actioned_at   timestamptz,
  constraint scheduled_nudges_channel_chk check (channel in ('whatsapp','telegram')),
  constraint scheduled_nudges_status_chk  check (status in ('pending','ready','sent','dismissed','expired'))
);

comment on table public.scheduled_nudges is
  'RAPTOR-1/4. Queued follow-up reminders per lead. status: pending (waiting for scheduled_for) -> ready (due, reminder pushed, waiting on the human) -> sent | dismissed | expired. The salesman always reviews and sends; nothing here messages a buyer.';

-- The cron sweep reads exactly this predicate.
create index if not exists scheduled_nudges_due_idx
  on public.scheduled_nudges (scheduled_for) where status = 'pending';
-- The queue UI reads exactly this one.
create index if not exists scheduled_nudges_owner_idx
  on public.scheduled_nudges (salesman_id, status, scheduled_for desc);
-- One open nudge per lead: stops the queue turning into a pile of duplicates
-- for the same buyer.
create unique index if not exists scheduled_nudges_one_open_per_lead
  on public.scheduled_nudges (lead_id) where status in ('pending','ready');

alter table public.scheduled_nudges enable row level security;

-- get_my_dealer_id() is SECURITY DEFINER, so none of these re-query a table
-- they are defined on (no recursion).
create policy nudges_own_select on public.scheduled_nudges for select
  using (salesman_id = auth.uid() or dealer_id = public.get_my_dealer_id());
create policy nudges_own_insert on public.scheduled_nudges for insert
  with check (salesman_id = auth.uid());
create policy nudges_own_update on public.scheduled_nudges for update
  using      (salesman_id = auth.uid() or dealer_id = public.get_my_dealer_id())
  with check (salesman_id = auth.uid() or dealer_id = public.get_my_dealer_id());
create policy nudges_own_delete on public.scheduled_nudges for delete
  using (salesman_id = auth.uid() or dealer_id = public.get_my_dealer_id());

-- Sweep that turns a due nudge into a reminder for the salesman.
-- Deliberately pure SQL, called by pg_cron directly: inserting into
-- salesman_notifications already fires a real device push via
-- trg_push_on_salesman_notification -> push_to_users, so there is no edge
-- function to call and no service-role JWT to paste into a cron command
-- (which is the CRON-1 rot on jobs 3 and 7).
create or replace function public.fire_due_nudges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fired integer := 0;
begin
  -- 1. Drop nudges whose lead is already closed or deleted. Chasing a buyer
  --    who already bought (or walked) is the fastest way to make the salesman
  --    distrust the queue.
  update public.scheduled_nudges n
     set status = 'dismissed', actioned_at = now()
    from public.leads l
   where l.id = n.lead_id
     and n.status in ('pending','ready')
     and (l.is_deleted is true
          or l.stage in ('won','closed_won','lost','closed_lost'));

  -- 2. Expire what the salesman ignored for a week, so the queue stays a
  --    to-do list and not an archive.
  update public.scheduled_nudges
     set status = 'expired'
   where status = 'ready'
     and notified_at < now() - interval '7 days';

  -- 3. Fire what is due. The notification row is the push.
  with due as (
    update public.scheduled_nudges n
       set status = 'ready', notified_at = now()
     where n.status = 'pending'
       and n.scheduled_for <= now()
    returning n.id, n.salesman_id, n.lead_id, n.draft_message
  ), ins as (
    insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
    select d.salesman_id,
           'nudge_due',
           'Follow-up ready: ' || coalesce(nullif(l.buyer_name, ''), 'your lead'),
           left(d.draft_message, 140),
           d.id
      from due d
      join public.leads l on l.id = d.lead_id
    returning 1
  )
  select count(*)::int into v_fired from ins;

  return v_fired;
end;
$$;

comment on function public.fire_due_nudges() is
  'RAPTOR-1. Cron sweep (every 5 min): dismisses nudges on closed/deleted leads, expires ignored ones after 7 days, and flips due ones to ready + inserts the salesman_notifications row whose own trigger sends the push. Never messages a buyer.';

-- Only cron (postgres) runs this; no client has any reason to.
revoke execute on function public.fire_due_nudges() from anon, authenticated;

-- jobid 12 on the live DB. No HTTP, no JWT literal — unlike jobs 3 and 7.
-- select cron.schedule('fire-due-nudges', '*/5 * * * *', $$select public.fire_due_nudges();$$);
