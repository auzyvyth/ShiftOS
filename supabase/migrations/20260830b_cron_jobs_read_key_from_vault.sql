-- CRON-1: jobids 3 and 7 stored a literal service_role JWT in cron.job.command.
--
-- The token's exp claim is 2088 -- effectively permanent -- and cron.job.command
-- is plain text, so anything that can read that table hands over a full
-- RLS-bypassing key. Jobs 4, 5 and 10 already read it from Vault via
-- public.get_cron_edge_key(); 3 and 7 were never migrated.
--
-- Verified before changing: get_cron_edge_key() returns EXACTLY the same JWT
-- that was hardcoded here, so this is behaviour-neutral. That matters because
-- both target functions run with verify_jwt = true and therefore need a real
-- JWT, not an opaque secret -- swapping in a random Vault string would have
-- 401'd and silently killed price alerts and appointment reminders.
--
-- get_cron_edge_key() is SECURITY DEFINER with acl {postgres=X, service_role=X}
-- and no PUBLIC grant, so anon/authenticated cannot read the key back out.

select cron.alter_job(
  3,
  command => $cmd$
  select net.http_post(
    url     := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/notify-price-alerts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(public.get_cron_edge_key(), '')
    ),
    body    := '{}'::jsonb
  );
  $cmd$
);

select cron.alter_job(
  7,
  command => $cmd$
  select net.http_post(
    url     := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/appointment-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(public.get_cron_edge_key(), '')
    ),
    body    := '{}'::jsonb
  );
  $cmd$
);
