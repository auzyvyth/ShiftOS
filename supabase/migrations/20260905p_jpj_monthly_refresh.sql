-- Nothing refreshed the JPJ registration data. The four year-files were loaded
-- by hand on 2026-09-05 and the Market Demand tab would have gone on showing
-- them forever, getting quietly more wrong every month with no symptom - the
-- numbers still render, they are just stale.
--
-- Shape: pg_net is asynchronous (http_get returns a request id, the body lands
-- in net._http_response later), so a fetch and its parse cannot share a
-- transaction. Two cron jobs twenty minutes apart: one enqueues, one drains.

create table if not exists public.reg_refresh_queue (
  id           bigserial primary key,
  source_year  integer     not null,
  request_id   bigint      not null,
  state        text        not null default 'pending'
                 check (state in ('pending','done','failed')),
  note         text,
  requested_at timestamptz not null default now(),
  settled_at   timestamptz
);

create index if not exists reg_refresh_queue_pending_idx
  on public.reg_refresh_queue (state, requested_at) where state = 'pending';

alter table public.reg_refresh_queue enable row level security;
-- No policy at all: only the ingestion job (SECURITY DEFINER) touches this.
-- It carries no dealer or buyer data, so nobody else has a reason to read it.

-- Which years to re-pull. The current year always; the previous one as well in
-- Jan-Mar, which covers both late revisions to the closed year and the 1 Jan
-- rollover, when the new year's file may not exist yet.
create or replace function public.reg_refresh_years()
returns setof integer
language sql
stable
as $$
  select extract(year from (now() at time zone 'Asia/Kuala_Lumpur'))::integer
  union
  select extract(year from (now() at time zone 'Asia/Kuala_Lumpur'))::integer - 1
   where extract(month from (now() at time zone 'Asia/Kuala_Lumpur'))::integer <= 3
$$;

create or replace function public.reg_refresh_start()
returns table (source_year integer, request_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer;
  v_req  bigint;
begin
  -- Anything still pending from a previous run has missed its response window
  -- (pg_net keeps bodies for hours, not days). Bury it so it cannot be parsed
  -- against a stale body later.
  update public.reg_refresh_queue
     set state = 'failed',
         note = coalesce(note, 'superseded by a later run'),
         settled_at = now()
   where state = 'pending';

  for v_year in select * from public.reg_refresh_years() loop
    -- 30s: the 2026 file was 28MB on first load and grows all year.
    select net.http_get(
             format('https://storage.data.gov.my/transportation/cars_%s.csv', v_year),
             null, null, 30000
           ) into v_req;

    insert into public.reg_refresh_queue (source_year, request_id)
    values (v_year, v_req);

    source_year := v_year;
    request_id  := v_req;
    return next;
  end loop;
end $$;

create or replace function public.reg_refresh_finish()
returns table (source_year integer, outcome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r          record;
  v_status   integer;
  v_bytes    bigint;
  v_prev     bigint;
  v_note     text;
begin
  for r in
    select * from public.reg_refresh_queue
     where state = 'pending' order by id
  loop
    source_year := r.source_year;

    select resp.status_code, length(resp.content)
      into v_status, v_bytes
      from net._http_response resp
     where resp.id = r.request_id;

    if not found then
      -- Still in flight is possible on a slow fetch; only give up once the
      -- response could not plausibly still be coming.
      if r.requested_at > now() - interval '30 minutes' then
        outcome := 'still fetching, left pending';
        return next;
        continue;
      end if;
      update public.reg_refresh_queue
         set state = 'failed', note = 'no response row (dropped or purged)', settled_at = now()
       where id = r.id;
      insert into public.reg_ingest_log (source_year, ok, message)
      values (r.source_year, false, 'refresh: no pg_net response row');
      outcome := 'failed: no response';
      return next;
      continue;
    end if;

    if v_status is null or v_status >= 300 then
      update public.reg_refresh_queue
         set state = 'failed', note = format('http %s', v_status), settled_at = now()
       where id = r.id;
      insert into public.reg_ingest_log (source_year, ok, message)
      values (r.source_year, false, format('refresh: http %s', v_status));
      outcome := format('failed: http %s', v_status);
      return next;
      continue;
    end if;

    -- A truncated download is the dangerous case: reg_load_response DELETEs the
    -- whole year before inserting, so a half-received body would silently wipe
    -- most of it and leave a plausible-looking table. A year-file only ever
    -- grows, so anything materially smaller than the last good load is refused.
    select l.total_bytes into v_prev
      from public.reg_ingest_log l
     where l.source_year = r.source_year and l.ok and l.total_bytes is not null
     order by l.id desc limit 1;

    if v_prev is not null and v_bytes < (v_prev * 0.9)::bigint then
      v_note := format('refresh: refused, %s bytes vs %s last good', v_bytes, v_prev);
      update public.reg_refresh_queue
         set state = 'failed', note = v_note, settled_at = now()
       where id = r.id;
      insert into public.reg_ingest_log (source_year, total_bytes, ok, message)
      values (r.source_year, v_bytes, false, v_note);
      outcome := 'failed: body smaller than last good load';
      return next;
      continue;
    end if;

    begin
      -- reg_load_response creates _reg_rows ON COMMIT DROP, so a second year in
      -- the same transaction would collide with the first one's table.
      drop table if exists pg_temp._reg_rows;
      perform public.reg_load_response(r.request_id, r.source_year);
      update public.reg_refresh_queue
         set state = 'done', settled_at = now()
       where id = r.id;
      outcome := 'loaded';
    exception when others then
      update public.reg_refresh_queue
         set state = 'failed', note = left(sqlerrm, 300), settled_at = now()
       where id = r.id;
      insert into public.reg_ingest_log (source_year, total_bytes, ok, message)
      values (r.source_year, v_bytes, false, 'refresh: ' || left(sqlerrm, 200));
      outcome := 'failed: ' || left(sqlerrm, 120);
    end;

    return next;
  end loop;
end $$;

-- Cron only. These take no argument that names a subject, but they write the
-- table every seller reads, so nothing reachable from the client gets EXECUTE.
revoke all on function public.reg_refresh_years()  from public, anon, authenticated;
revoke all on function public.reg_refresh_start()  from public, anon, authenticated;
revoke all on function public.reg_refresh_finish() from public, anon, authenticated;

-- Weekly, not monthly: data.gov.my republishes the whole year-file whenever it
-- revises anything, so a weekly pull picks up corrections instead of only the
-- new month. One 28MB fetch a week.
--   jobid 14  jpj-refresh-fetch   0 2 * * 1   (Mon 10:00 Malaysia)
--   jobid 15  jpj-refresh-parse  20 2 * * 1
-- select cron.schedule('jpj-refresh-fetch', '0 2 * * 1',  $$select public.reg_refresh_start()$$);
-- select cron.schedule('jpj-refresh-parse', '20 2 * * 1', $$select public.reg_refresh_finish()$$);
