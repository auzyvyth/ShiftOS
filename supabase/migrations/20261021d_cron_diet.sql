-- IO-1 (2026-10-21): timed jobs do their work only when there is work.
--
-- The database is 57 MB and every read is served from memory, so disk IO is
-- WRITES. Every cron run writes its own log rows (cron.job_run_details, ~5
-- writes), and every job that calls an edge function also writes a pg_net
-- request + response row and wakes a function that runs its own queries.
-- At current volume (30 days: 5 bookings, 20 chat messages, 4 seller emails,
-- 3 buyer emails, 4 price alerts, 0 nudges ever) almost every run found nothing.
--
-- Pattern (already used by appointment-reminders, jobid 7): the HTTP call sits
-- behind `where exists (...)`, so an idle run is one in-memory check and no
-- function call. Each guard is a SUPERSET of what the function itself selects,
-- so it can never skip a run that had work.
--
-- Left alone on purpose:
--   * appointment-reminders (7): already guarded, and the edge function only
--     looks back 10 minutes for due Telegram reminders
--     (supabase/functions/appointment-reminder/index.ts:42); a slower schedule
--     would drop reminders.
--   * sweep-premium-lapses (18): plain SQL, owner-set push timings ride on it.
--
-- Not DDL (cron.alter_job updates cron.job), but it is a database change, so it
-- ships in the after-midnight slot with the release (CLAUDE.md release rule).

-- notify-seller-unread (17): every 15 min, only when a lead notification is
-- unread, not yet emailed, and inside the function's 15 min..48 h window.
select cron.alter_job(
  job_id  := 17,
  command := $cmd$
  select net.http_post(
    url     := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/notify-seller-unread',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(public.get_cron_edge_key(), '')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  where exists (
    select 1 from public.salesman_notifications n
     where n.emailed_at is null and not coalesce(n.is_read, false)
       and n.type in ('new_enquiry', 'chat_message', 'new_booking', 'booking_unconfirmed')
       and n.created_at > now() - interval '49 hours'
  ) or exists (
    select 1 from public.dealer_notifications n
     where n.emailed_at is null and not coalesce(n.is_read, false)
       and n.type in ('new_enquiry', 'chat_message', 'new_booking', 'booking_unconfirmed')
       and n.created_at > now() - interval '49 hours'
  );
$cmd$
);

-- notify-chat-unread (13): every 30 min, only when a seller's reply is sitting
-- unread in an open thread whose buyer has not been emailed about it.
select cron.alter_job(
  job_id  := 13,
  command := $cmd$
  select net.http_post(
    url     := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/notify-chat-unread',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(public.get_cron_edge_key(), '')
    ),
    body    := '{}'::jsonb
  )
  where exists (
    select 1 from public.chat_threads t
      join public.profiles b on b.id = t.buyer_id
     where t.buyer_unread > 0 and t.last_sender_role = 'seller' and t.status = 'open'
       and t.buyer_email_notified_at is null
       and (b.email is not null or b.notify_email is not null)
       and not coalesce(b.notify_email_opt_out, false)
  );
$cmd$
);

-- notify-price-alerts (3): was every 30 min for 4 alerts. Every 3 hours, and
-- only when an alert is switched on. A price drop reaching a buyer within 3 h
-- is still the same day.
select cron.alter_job(
  job_id   := 3,
  schedule := '13 */3 * * *',
  command  := $cmd$
  select net.http_post(
    url     := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/notify-price-alerts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(public.get_cron_edge_key(), '')
    ),
    body    := '{}'::jsonb
  )
  where exists (select 1 from public.price_alerts a where a.is_active);
$cmd$
);

-- fire-due-nudges (12): no nudge has ever been created. Every 30 min instead of
-- 15, and the sweep only runs when one is open.
select cron.alter_job(
  job_id   := 12,
  schedule := '*/30 * * * *',
  command  := $cmd$
  select public.fire_due_nudges()
  where exists (select 1 from public.scheduled_nudges n where n.status in ('pending', 'ready'));
$cmd$
);
