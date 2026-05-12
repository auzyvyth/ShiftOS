-- ============================================================
-- Schedule notify-price-alerts Edge Function every 30 minutes
-- Requires pg_cron extension (enabled by default on Supabase)
-- ============================================================

SELECT cron.schedule(
  'notify-price-alerts',          -- job name (unique)
  '*/30 * * * *',                 -- every 30 minutes
  $$
    SELECT net.http_post(
      url     := current_setting('app.edge_function_url') || '/notify-price-alerts',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    )
  $$
);
