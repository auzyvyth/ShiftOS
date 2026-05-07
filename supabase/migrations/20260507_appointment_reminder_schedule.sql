-- Add reminder tracking columns to appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS remind_at   timestamptz,
  ADD COLUMN IF NOT EXISTS remind_sent boolean DEFAULT false;

-- Enable pg_net (HTTP from SQL) and pg_cron (scheduled jobs)
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule appointment reminder check every minute
SELECT cron.schedule(
  'appointment-reminders',
  '* * * * *',
  $$
  SELECT extensions.http_post(
    url    := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/appointment-reminder',
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REDACTED_ANON_KEY'
    )
  );
  $$
);
