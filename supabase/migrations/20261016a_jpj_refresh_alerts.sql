-- JPJ-1: the weekly JPJ refresh fails silently. A bad week wrote
-- reg_ingest_log.ok = false and stopped there, while Market Demand kept showing
-- older numbers with no sign anything was wrong. reg_refresh_finish() now calls
-- notify_ops() (Telegram + platform admin push, 15-min throttle per key) when:
--   1. any year failed in this run (http error, truncated body, parse error), or
--   2. there has been no good load or "unchanged" check for 6 days (this run writes one when healthy, so a
--      missed week shows up on the same Monday), which also
--      catches reg_refresh_start() never running (nothing queued, nothing failed).
-- Gap left on purpose: if cron job 15 itself stops running, nothing calls this
-- function. Watch cron.job_run_details if that ever matters.
-- Same signature, so CREATE OR REPLACE keeps the grants and makes no overload.

-- Already live since 20261013c; repeated so this file stands on its own.
alter table public.reg_ingest_log add column if not exists content_md5 text;

create or replace function public.reg_refresh_finish()
 returns table(source_year integer, outcome text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r          record;
  v_status   integer;
  v_bytes    bigint;
  v_md5      text;
  v_prev     bigint;
  v_prev_md5 text;
  v_note     text;
  v_failed   text;
  v_last_ok  timestamptz;
begin
  for r in
    select * from public.reg_refresh_queue
     where state = 'pending' order by id
  loop
    source_year := r.source_year;

    select resp.status_code, length(resp.content), md5(resp.content)
      into v_status, v_bytes, v_md5
      from net._http_response resp
     where resp.id = r.request_id;

    if not found then
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

    select l.total_bytes, l.content_md5 into v_prev, v_prev_md5
      from public.reg_ingest_log l
     where l.source_year = r.source_year and l.ok and l.total_bytes is not null
     order by l.id desc limit 1;

    if v_prev_md5 is not null and v_prev_md5 = v_md5 then
      update public.reg_refresh_queue
         set state = 'done', note = 'unchanged since last load, skipped', settled_at = now()
       where id = r.id;
      insert into public.reg_ingest_log (source_year, total_bytes, ok, message, content_md5)
      values (r.source_year, v_bytes, true, 'unchanged since last load, skipped', v_md5);
      outcome := 'unchanged, skipped';
      return next;
      continue;
    end if;

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
      drop table if exists pg_temp._reg_rows;
      perform public.reg_load_response(r.request_id, r.source_year);
      -- reg_load_response wrote the ok log row; stamp it so next week can compare.
      update public.reg_ingest_log
         set content_md5 = v_md5
       where id = (select max(l.id) from public.reg_ingest_log l
                    where l.source_year = r.source_year and l.ok);
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

  -- JPJ-1: alert ops. now() is fixed for the transaction, so settled_at = now()
  -- picks out exactly the rows this run failed.
  select string_agg(q.source_year || ': ' || coalesce(q.note, 'failed'), E'\n' order by q.id)
    into v_failed
    from public.reg_refresh_queue q
   where q.state = 'failed' and q.settled_at = now();

  if v_failed is not null then
    perform public.notify_ops('err:jpj_refresh',
      E'JPJ data refresh failed\n' || v_failed ||
      E'\nMarket Demand keeps showing the last good load. See reg_ingest_log.');
    return;  -- a failed week is also a stale week; one alert, not two
  end if;

  -- Staleness covers what the line above cannot see: reg_refresh_start never
  -- ran or queued nothing, so there is no failed row to report. A healthy week
  -- writes an ok row (loaded or "unchanged, skipped") in THIS transaction, so a
  -- last ok older than 6 days means this Monday produced nothing. Do not run this
  -- function by hand mid-week without expecting the stale alert.
  select max(l.ran_at) into v_last_ok from public.reg_ingest_log l where l.ok;
  if v_last_ok is null or v_last_ok < now() - interval '6 days' then
    perform public.notify_ops('err:jpj_stale',
      E'JPJ data is going stale\nNo good refresh since ' ||
      coalesce(to_char(v_last_ok at time zone 'Asia/Kuala_Lumpur', 'DD Mon YYYY'), 'ever') ||
      E'. Check cron jobs 14 and 15 and reg_refresh_queue.');
  end if;
end $function$;
