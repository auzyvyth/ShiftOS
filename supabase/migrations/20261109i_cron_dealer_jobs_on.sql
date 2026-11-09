-- Owner, 2026-11-09: the dealer dashboard is in use again, so the dealer jobs
-- paused by 20261023a (IO-7) come back. APPLIED 2026-11-09 05:30 UTC.
-- cron.alter_job edits cron.job rows: not DDL, no API schema reload.
--
-- ON again:
--   4 warm-leads-push            dealer push: warm leads sitting 3+ days (daily 09:00 UTC)
--   8 expire-trial-subscriptions now DEALER / OWNER rows only. It used to flip
--                                salesmen to 'expired' too, and subscription_status
--                                means nothing for a salesman (Premium = plan_expires_at).
-- STILL OFF on purpose:
--   3 notify-price-alerts        marketplace buyers, not the dealer dashboard
--   9 refresh-market-price-stats nothing in src/ api/ or the DB reads
--                                market_price_stats; one run took 1,087 s inside
--                                the 2026-10-22 freeze. Drop it in a cleanup round.

select cron.alter_job(job_id := 4, active := true);
select cron.alter_job(job_id := 8, active := true, command := $c$
    UPDATE profiles
    SET subscription_status = 'expired'
    WHERE subscription_status = 'trial'
      AND role IN ('dealer', 'owner')
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at < now();
  $c$);
