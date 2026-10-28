-- APPLIED 2026-10-28 (cron.alter_job, no schema reload); edge function v20 deployed same time.
-- appointment-reminders (jobid 7): Telegram look-back 20 -> 35 min.
-- On 2026-10-24 the DB stalled and 5 runs of this job failed with "job startup
-- timeout". With a 20-min look-back on a 15-min schedule, one skipped run left a
-- 10-min gap, and a Telegram "viewing in 1 hour" reminder due in it was never
-- sent. 35 min covers one skipped run. remind_sent=false still stops a repeat.
-- The edge function (supabase/functions/appointment-reminder/index.ts) uses the
-- same 35 min: deploy it in the same slot.
--
-- cron.alter_job edits a cron.job row; not DDL, no API schema reload.

select cron.alter_job(
  job_id   := 7,
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
       and a.remind_at between now() - interval '35 minutes' and now()
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
