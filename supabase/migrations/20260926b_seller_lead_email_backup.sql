-- SELLER-EMAIL: an email backup for leads that never reached the seller.
-- Buyers already get one (notify-chat-unread). Sellers did not: a lead
-- notification row IS the push (trg_push_on_*_notification), and a push only
-- reaches a device that is registered — so a rep who signed out, never turned
-- push on, or whose phone dropped its subscription, heard nothing at all.
-- notify-seller-unread (cron below) emails those, and stamps emailed_at so a
-- row is only ever emailed once.
alter table public.salesman_notifications add column if not exists emailed_at timestamptz;
alter table public.dealer_notifications   add column if not exists emailed_at timestamptz;

-- The cron scans "recent, lead-type, not yet emailed" every 15 minutes.
create index if not exists salesman_notifications_email_scan
  on public.salesman_notifications (created_at)
  where emailed_at is null and type in ('new_enquiry','chat_message','new_booking','booking_unconfirmed');
create index if not exists dealer_notifications_email_scan
  on public.dealer_notifications (created_at)
  where emailed_at is null and type in ('new_enquiry','chat_message','new_booking','booking_unconfirmed');

-- Every 15 min, off the :00 / :30 minutes the other jobs pile onto.
-- (Applied live as cron jobid 17.)
select cron.schedule('notify-seller-unread', '7,22,37,52 * * * *', $$
  select net.http_post(
    url     := 'https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1/notify-seller-unread',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(public.get_cron_edge_key(), '')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);
