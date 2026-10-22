-- IO-5 (2026-10-22): every frequent job runs on the same four minutes.
--
-- Why: the database froze on 2026-10-22 (Disk IO 100%). Supabase's backup
-- setting archive_timeout = 2min seals and archives a whole 16 MB WAL segment
-- for any 2-minute window that had ANY write. Measured right after the
-- restart: 188 kB of real WAL in 44 min, 18 segments (~288 MB) archived.
-- Every pg_cron run writes its own log row (cron.log_run is a postmaster
-- setting Supabase owns), even a guarded run that does nothing, and the jobs
-- were scattered (:00 :05 :07 :10 :13 :17 :22 :41 ...), so they woke about
-- 16 of the 30 windows each hour. On :00/:15/:30/:45 they share 4.
--
-- appointment-reminders (7) goes from every 5 min to every 15: the edge
-- function's Telegram look-back is widened 10 -> 20 min in the SAME release
-- (supabase/functions/appointment-reminder/index.ts), and so is this guard,
-- or reminders between ticks would be dropped. Deploy the function first.
--
-- cron.alter_job edits cron.job rows; it is not DDL (no API schema reload),
-- but it ships in the after-midnight slot with the release.

select cron.alter_job(
  job_id   := 7,
  schedule := '*/15 * * * *',
  command  := $cmd$
  select net.http_post(
    url     := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/appointment-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(public.get_cron_edge_key(), '')
    ),
    body    := '{}'::jsonb
  )
  where exists (
    select 1 from public.appointments a
     where a.remind_sent = false
       and a.remind_at between now() - interval '20 minutes' and now()
  ) or exists (
    select 1 from public.appointments a
     where a.status = 'pending'
       and a.salesman_id is not null
       and a.appointment_date between now() - interval '2 hours' and now() + interval '5 hours'
       and not exists (
         select 1 from public.salesman_notifications n
          where n.type = 'booking_unconfirmed' and n.ref_id = a.id)
  );
$cmd$
);

-- notify-seller-unread: :07/:22/:37/:52 -> :00/:15/:30/:45 (the function's
-- window is 15 min..48 h, so the shift changes nothing it sends).
select cron.alter_job(job_id := 17, schedule := '0,15,30,45 * * * *');
-- sweep-premium-lapses: :41 -> :00 hourly.
select cron.alter_job(job_id := 18, schedule := '0 * * * *');
-- ask-viewing-outcomes: :17 -> :00, same hours.
select cron.alter_job(job_id := 16, schedule := '0 1-13 * * *');
-- notify-price-alerts: :13 -> :00, every 3 hours.
select cron.alter_job(job_id := 3, schedule := '0 */3 * * *');
-- 12 and 13 already run */30 (:00/:30); the daily jobs are already on the hour
-- or half hour.
