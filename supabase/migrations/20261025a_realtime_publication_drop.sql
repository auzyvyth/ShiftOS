-- IO-2 step 2. DO NOT APPLY together with 20261024a.
--
-- Apply only after the liveChannel client (src/lib/liveChannel.js) has been in
-- production for a few days AND console logs show no
-- "liveChannel: ... refused, using postgres_changes" fallbacks: an app tab
-- opened before the release still listens with postgres_changes, and taking
-- the tables out of the publication silences it until it reloads.
--
-- What it buys: Realtime stops polling the database for changes
-- (realtime.list_changes) once no client subscribes with postgres_changes;
-- removing the tables makes any straggler fail fast instead of keeping the
-- poller running. Check afterwards (expect 0 rows):
--   select tablename from pg_publication_tables where pubname = 'supabase_realtime';

alter publication supabase_realtime drop table
  public.appointments,
  public.car_listings,
  public.chat_messages,
  public.chat_threads,
  public.dealer_notifications,
  public.kyc_documents,
  public.leads,
  public.salesman_notifications,
  public.whatsapp_enquiries;
