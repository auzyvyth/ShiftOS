-- IO-7 (owner, 2026-10-23): the database froze again (from ~18:00 UTC Oct 22,
-- restarted 00:08 UTC Oct 23). Solo salesmen (Lite / Premium) come first; the
-- marketplace and the dealer dashboard can wait. So:
--
-- PAUSED (active = false), switch back on with cron.alter_job(id, active := true):
--   3  notify-price-alerts         marketplace buyers' price-drop emails, every 3 h
--   4  warm-leads-push             dealer push: warm leads sitting 3+ days
--   8  expire-trial-subscriptions  dealer trials (subscription_status means
--                                  nothing for a salesman)
--   9  refresh-market-price-stats  REFRESH MATERIALIZED VIEW market_price_stats.
--                                  Nothing in src/ or api/ reads it; the last
--                                  run took 1,087 s inside the freeze.
--
-- LESS OFTEN (nothing a seller gets is lost):
--   18 sweep-premium-lapses  hourly -> daily 00:00 UTC (08:00 MYT). Premium
--      itself ends on plan_expires_at without the sweep; the sweep only locks
--      over-cap cars and sends the 3-days-out / ended pushes.
--   16 ask-viewing-outcomes  13x a day -> 09:00 + 17:00 MYT. It asks about
--      viewings that ended 3-48 h ago, so two runs a day still catch every one.
--
-- KEPT as is (solo salesman paths): 5 expiry-reminders (daily; matches 30/7
-- days out exactly), 6 cleanup-cron-logs, 7 appointment-reminders, 10 purge
-- (30-day deletion promise), 12 nudges, 13 buyer reply email, 17 seller
-- unread email, 14/15 JPJ (weekly already).
--
-- cron.alter_job edits cron.job rows; not DDL, no API schema reload.

select cron.alter_job(job_id := 3,  active := false);
select cron.alter_job(job_id := 4,  active := false);
select cron.alter_job(job_id := 8,  active := false);
select cron.alter_job(job_id := 9,  active := false);
select cron.alter_job(job_id := 18, schedule := '0 0 * * *');
select cron.alter_job(job_id := 16, schedule := '0 1,9 * * *');
