-- Security sweep 2026-09-05.
--
-- notify_ops() is the single ops-alert entry point: it posts to the ops Telegram
-- channel AND pushes every superadmin's device. It was executable by anon, and
-- the 15-minute throttle keys off a caller-supplied string, so anyone could send
-- unlimited spoofed "ops alerts" to the owner's phone by varying p_key. It has no
-- internal guard because every legitimate caller is a SECURITY DEFINER trigger
-- owned by postgres, which is unaffected by this revoke.
-- notify_ops_telegram() is the older shim onto the same path.
--
-- fire_due_nudges() is the pg_cron sweep. It flips due nudges to ready and
-- inserts salesman_notifications rows, and each of those rows IS a push. pg_cron
-- runs it as postgres; no browser or edge caller exists (verified by grep over
-- src/, api/, server/ and supabase/functions/ -- only comments mention it).
--
-- Supabase's ALTER DEFAULT PRIVILEGES grants EXECUTE to anon/authenticated at
-- CREATE time, so these grants were never written by hand -- which is exactly why
-- they went unnoticed. Same trap as 20260905i.

revoke all on function public.notify_ops(text, text)          from anon, authenticated, public;
revoke all on function public.notify_ops_telegram(text, text) from anon, authenticated, public;
revoke all on function public.fire_due_nudges()               from anon, authenticated, public;

grant execute on function public.notify_ops(text, text)          to service_role;
grant execute on function public.notify_ops_telegram(text, text) to service_role;
grant execute on function public.fire_due_nudges()               to service_role;
