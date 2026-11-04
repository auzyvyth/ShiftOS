-- LIVE-LOG (owner, 2026-11-04): a history of every Live presentation.
--
-- seller_live_state only says "live RIGHT NOW": set_live_listing(null) deletes
-- the row when the seller taps End, so a finished live left no trace at all.
-- A trial seller (aps) went Live twice and the database could not show it.
-- Live use is the best sign of who will pay, so it is now a row per live.
--
-- One row per live, written ONLY by set_live_listing (no client policies,
-- same as seller_live_state). Counts and car ids only: nothing about viewers.
--
-- A live that is never ended (tab closed, phone died) is marked closed by
-- itself: any later set_live_listing call, from ANY seller, closes every open
-- live with no heartbeat for 10 minutes, ended_at = its last heartbeat,
-- end_reason 'timeout'. The presenter also sends End on pagehide (keepalive),
-- so a closed tab usually ends cleanly. Readers never trust ended_at alone:
-- "still live" = ended_at is null AND last_seen_at within 10 minutes.
--
-- An End followed by a restart within 10 minutes (reload, bfcache restore)
-- reopens the same row, so one live is one row.

create table if not exists public.live_sessions (
  id            bigint generated always as identity primary key,
  seller_id     uuid not null references public.profiles(id) on delete cascade,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  ended_at      timestamptz,
  end_reason    text check (end_reason in ('ended', 'timeout')),
  car_ids       uuid[] not null default '{}'
);
create index if not exists live_sessions_seller_started_idx
  on public.live_sessions (seller_id, started_at desc);
create index if not exists live_sessions_open_idx
  on public.live_sessions (last_seen_at) where ended_at is null;
alter table public.live_sessions enable row level security;
revoke all on public.live_sessions from public, anon, authenticated;

-- Same signature as 20261003a, so this REPLACES it (no overload).
create or replace function public.set_live_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sid bigint;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;

  -- Close lives that went quiet (no heartbeat for 10 min), everyone's. Writes
  -- nothing on the usual call: the partial index finds no open stale rows.
  update live_sessions
     set ended_at = last_seen_at, end_reason = 'timeout'
   where ended_at is null
     and last_seen_at < now() - interval '10 minutes';
  delete from seller_live_state where live_until < now();

  if p_listing_id is null then
    delete from seller_live_state where seller_id = v_uid;
    update live_sessions
       set ended_at = now(), end_reason = 'ended', last_seen_at = now()
     where seller_id = v_uid and ended_at is null;
    return;
  end if;

  if not exists (
    select 1 from car_listings c
    where c.id = p_listing_id
      and c.status in ('available', 'reserved')
      and (c.dealer_id = v_uid or c.assigned_to = v_uid
           or exists (select 1 from salesman_listings s
                      where s.listing_id = c.id and s.salesman_id = v_uid))
  ) then
    raise exception 'not_your_listing';
  end if;

  insert into seller_live_state (seller_id, listing_id, live_until, updated_at)
  values (v_uid, p_listing_id, now() + interval '10 minutes', now())
  on conflict (seller_id) do update
    set listing_id = excluded.listing_id,
        live_until = excluded.live_until,
        updated_at = now();

  -- The live this beat belongs to: the open one, else one ended in the last
  -- 10 minutes (reopened), else a new one.
  select id into v_sid from live_sessions
   where seller_id = v_uid and ended_at is null
   order by started_at desc limit 1;
  if v_sid is null then
    select id into v_sid from live_sessions
     where seller_id = v_uid and ended_at > now() - interval '10 minutes'
     order by ended_at desc limit 1;
  end if;

  if v_sid is null then
    insert into live_sessions (seller_id, car_ids)
    values (v_uid, array[p_listing_id]);
  else
    update live_sessions
       set last_seen_at = now(),
           ended_at = null,
           end_reason = null,
           car_ids = case when p_listing_id = any(car_ids) then car_ids
                          else car_ids || p_listing_id end
     where id = v_sid;
  end if;
end;
$$;

-- Console / owner read: Live use per seller over the last p_days days.
-- Superadmin only. Counts and dates only.
create or replace function public.get_live_history(p_days int default 30)
returns table (
  seller_id    uuid,
  name         text,
  slug         text,
  plan         text,
  lives        int,
  minutes      int,
  cars_shown   int,
  last_live_at timestamptz,
  live_now     boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not is_superadmin() then
    return;
  end if;
  return query
    select s.seller_id,
           coalesce(nullif(p.site_name, ''), nullif(p.dealership, ''), p.full_name)::text,
           p.slug::text,
           p.plan::text,
           count(*)::int,
           (sum(extract(epoch from (coalesce(s.ended_at, s.last_seen_at) - s.started_at))) / 60)::int,
           (select count(distinct c) from live_sessions s2, unnest(s2.car_ids) c
             where s2.seller_id = s.seller_id
               and s2.started_at > now() - make_interval(days => p_days))::int,
           max(s.started_at),
           bool_or(s.ended_at is null and s.last_seen_at > now() - interval '10 minutes')
      from live_sessions s
      join profiles p on p.id = s.seller_id
     where s.started_at > now() - make_interval(days => p_days)
     group by s.seller_id, p.site_name, p.dealership, p.full_name, p.slug, p.plan
     order by max(s.started_at) desc;
end;
$$;

revoke all on function public.get_live_history(int) from public;
revoke all on function public.get_live_history(int) from anon;
grant execute on function public.get_live_history(int) to authenticated;

-- Lives already left behind in seller_live_state (closed without End) are the
-- only past lives we know of: keep them as one row each. Start time is unknown,
-- so started_at = their last heartbeat (0 minutes).
insert into live_sessions (seller_id, started_at, last_seen_at, ended_at, end_reason, car_ids)
select l.seller_id, l.updated_at, l.updated_at,
       case when l.live_until < now() then l.updated_at end,
       case when l.live_until < now() then 'timeout' end,
       case when l.listing_id is null then '{}'::uuid[] else array[l.listing_id] end
  from seller_live_state l
 where not exists (select 1 from live_sessions x where x.seller_id = l.seller_id);
