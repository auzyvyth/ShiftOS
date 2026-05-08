-- Remove hardcoded anon key from appointment-reminders cron job.
-- The key is now read from vault at runtime so it never lives in SQL.
--
-- One-time setup (run in Supabase SQL editor if not done yet):
--   SELECT vault.create_secret('<your-anon-key>', 'anon_key');

SELECT cron.unschedule('appointment-reminders');

SELECT cron.schedule(
  'appointment-reminders',
  '* * * * *',
  $$
  SELECT extensions.http_post(
    url    := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/appointment-reminder',
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key' LIMIT 1
      )
    )
  );
  $$
);
