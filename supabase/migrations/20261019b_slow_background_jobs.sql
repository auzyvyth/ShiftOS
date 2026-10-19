-- Slow the background jobs down (2026-10-19). The free (Nano) database ran out
-- of its daily fast-disk allowance and froze; these timers read tables all day
-- whether anyone is online or not. Matched by COMMAND, not jobid, so it is
-- correct whatever ids the jobs ended up with. No DDL, so no PostgREST reload.
-- appointment-reminder stays */5: it only looks back 10 minutes for due
-- reminders (supabase/functions/appointment-reminder/index.ts:42), so a slower
-- tick would skip some Telegram reminders entirely. notify-price-alerts stays
-- */30 for the same reason: it only matches cars created in the last 35 min
-- (supabase/functions/notify-price-alerts/index.ts:214).
-- Undo: put the old schedule back with cron.alter_job.
do $$
declare r record;
begin
  for r in select jobid, command from cron.job loop
    if r.command ilike '%refresh materialized view%market_price_stats%' then
      perform cron.alter_job(r.jobid, schedule := '0 19 * * *');   -- was hourly; now 03:00 MYT
    elsif r.command ilike '%fire_due_nudges%' then
      perform cron.alter_job(r.jobid, schedule := '*/15 * * * *'); -- was */5
    end if;
  end loop;
end $$;
