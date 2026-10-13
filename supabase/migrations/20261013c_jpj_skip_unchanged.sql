-- JPJ weekly refresh: skip a file identical to the last good load.
-- 4 of the 6 runs before 2026-10-13 re-downloaded a byte-identical cars_2026.csv
-- and still rebuilt reg_car_month from 640k rows (~700 MB of disk IO per run on
-- a 0.5 GB free-plan box). Identity is an md5 of the body, not its length: a
-- corrected row can keep the size the same.
-- Same signature as before, so CREATE OR REPLACE keeps the grants and makes no
-- second overload.

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
end $function$;
