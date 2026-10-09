-- ANALYTICS-SPOOF: analytics_events is written ONLY by /api/track (service role).
--
-- `analytics_insert_v2` let anyone insert any salesman_slug / dealer_id, capped
-- only per session_id, which the caller invents. A script could inflate any
-- seller's views and WhatsApp taps. /api/track is rate-limited per IP at the
-- edge, takes dealer_id from the car, and still applies analytics_rate_limit_ok.
--
-- APPLY ONLY AFTER the /api/track frontend is live in production. Before that,
-- prod still inserts directly and every event would be dropped.
-- No DDL 09:00-22:00 Malaysia time (01:00-14:00 UTC).

drop policy if exists analytics_insert_v2 on public.analytics_events;

-- The table grant is held by the roles directly AND possibly via PUBLIC; revoke both.
revoke insert on public.analytics_events from public, anon, authenticated;

-- Verify after applying (expect false, false, true):
--   select has_table_privilege('anon', 'public.analytics_events', 'INSERT'),
--          has_table_privilege('authenticated', 'public.analytics_events', 'INSERT'),
--          has_table_privilege('service_role', 'public.analytics_events', 'INSERT');
