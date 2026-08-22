-- The 30-day account purge had never run.
--
-- The cron job built its Authorization header as
--   'Bearer ' || current_setting('app.service_role_key', true)
-- and that database setting was never set. current_setting(..., true) returns
-- NULL when the setting is missing, and concatenating NULL yields NULL, so the
-- ENTIRE headers jsonb collapsed to NULL and the job posted with no
-- Authorization header at all. purge-deleted-accounts answered 401 every night.
-- Nothing surfaced it: pg_cron counts the run a success because it got an HTTP
-- response back, and the function fails closed and quietly.
--
-- Fixed by sending the same shared key in Vault (`cron_edge_key`) that the other
-- cron jobs already use, and by teaching the function to resolve its accepted key
-- from that same Vault entry rather than from an env var it cannot compare
-- against (see supabase/functions/purge-deleted-accounts/index.ts). One value,
-- both sides, nothing to drift.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'purge-deleted-accounts-daily';
  if v_jobid is null then
    raise notice 'purge-deleted-accounts-daily not scheduled here; nothing to alter';
    return;
  end if;

  perform cron.alter_job(
    job_id  := v_jobid,
    command := $cmd$
  select net.http_post(
    url     := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/purge-deleted-accounts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(public.get_cron_edge_key(), '')
    ),
    body    := '{}'::jsonb
  );
  $cmd$
  );
end $$;
