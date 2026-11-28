-- OPS-DAILY: one Telegram + phone push every morning (7:30 MYT) saying how the platform is.
-- Rides on notify_ops (Telegram + push to superadmins). Counts only: no names, phones, ICs.
-- One migration = one API freeze: apply after midnight MYT, nobody live.

create or replace function public.ops_daily_checkup()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flags int := 0;
  v_lines text := '';
  v_n bigint; v_m bigint; v_x numeric; v_t text;
begin
  -- 1. Scheduled jobs that failed in the last 24h
  begin
    select count(*), string_agg(distinct j.jobname, ', ')
      into v_n, v_t
    from cron.job_run_details d join cron.job j using (jobid)
    where d.start_time > now() - interval '24 hours' and d.status = 'failed';
    if v_n > 0 then
      v_flags := v_flags + 1;
      v_lines := v_lines || format(E'\nJobs failed: %s (%s)', v_n, left(v_t, 120));
    else
      v_lines := v_lines || E'\nJobs: all ran fine';
    end if;
  exception when others then v_lines := v_lines || E'\nJobs: could not check';
  end;

  -- 2. Calls to edge functions / webhooks that errored (pg_net keeps only a few hours)
  begin
    select count(*) filter (where status_code >= 400 or error_msg is not null or timed_out),
           count(*)
      into v_n, v_m
    from net._http_response;
    if v_n > 0 then
      v_flags := v_flags + 1;
      v_lines := v_lines || format(E'\nServer calls: %s of %s failed', v_n, v_m);
    else
      v_lines := v_lines || format(E'\nServer calls: %s ok', v_m);
    end if;
  exception when others then v_lines := v_lines || E'\nServer calls: could not check';
  end;

  -- 3. App errors reported by users' browsers
  begin
    select count(*) into v_n from error_logs where created_at > now() - interval '24 hours';
    if v_n >= 25 then v_flags := v_flags + 1; end if;
    v_lines := v_lines || format(E'\nApp errors (24h): %s%s', v_n, case when v_n >= 25 then ' (high)' else '' end);
  exception when others then v_lines := v_lines || E'\nApp errors: could not check';
  end;

  -- 4. Database speed: memory hit rate + slowest repeated query
  begin
    select round(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit + heap_blks_read), 0), 2)
      into v_x from pg_statio_user_tables;
    if v_x is not null and v_x < 99 then v_flags := v_flags + 1; end if;
    v_lines := v_lines || format(E'\nDB memory hit: %s%%%s', coalesce(v_x::text, 'n/a'),
                                 case when v_x < 99 then ' (low)' else '' end);
  exception when others then v_lines := v_lines || E'\nDB memory hit: could not check';
  end;
  begin
    select round(mean_exec_time::numeric), calls, left(regexp_replace(query, '\s+', ' ', 'g'), 50)
      into v_x, v_n, v_t
    from extensions.pg_stat_statements
    where calls >= 20 and query not ilike '%pg_stat%' and query not ilike '%cron.%'
          and query not ilike '%realtime.%'
    order by mean_exec_time desc limit 1;
    if v_x is not null then
      if v_x > 1000 then v_flags := v_flags + 1; end if;
      v_lines := v_lines || format(E'\nSlowest query: %s ms avg, %s calls (%s)', v_x, v_n, v_t);
    end if;
  exception when others then null;
  end;
  begin
    select pg_size_pretty(pg_database_size(current_database())) into v_t;
    v_lines := v_lines || format(E'\nDB size: %s', v_t);
  exception when others then null;
  end;

  -- 5. Growth + queues (counts only)
  begin
    select count(*) filter (where role = 'salesman'),
           count(*) filter (where role in ('dealer','owner')),
           count(*) filter (where role = 'buyer')
      into v_n, v_m, v_x
    from profiles where created_at > now() - interval '24 hours';
    v_lines := v_lines || format(E'\nNew sign-ups: %s sellers, %s dealers, %s buyers', v_n, v_m, v_x);
    select count(*) into v_n from car_listings where created_at > now() - interval '24 hours';
    select count(*) into v_m from leads where created_at > now() - interval '24 hours';
    v_lines := v_lines || format(E'\nNew cars: %s, new leads: %s', v_n, v_m);
    select count(*) into v_n from car_listings where status = 'pending_approval';
    if v_n > 0 then v_lines := v_lines || format(E'\nCars waiting for review: %s', v_n); end if;
  exception when others then v_lines := v_lines || E'\nGrowth: could not check';
  end;

  -- 6. Lead alerts: sellers with no phone/push device
  begin
    select count(*) into v_n from push_subscriptions;
    v_lines := v_lines || format(E'\nPush devices registered: %s', v_n);
  exception when others then null;
  end;

  perform notify_ops(
    'daily_checkup',
    case when v_flags = 0 then 'Drevo daily check: all good'
         else format('Drevo daily check: %s thing(s) need a look', v_flags) end
    || v_lines
  );
end;
$$;

-- Only the scheduler (postgres) runs it. Never reachable from the API.
revoke all on function public.ops_daily_checkup() from public, anon, authenticated;

select cron.schedule('ops-daily-checkup', '30 23 * * *', $$select public.ops_daily_checkup()$$);
