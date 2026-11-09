-- Throttle writes go through the server.
-- login_throttle_check, login_throttle_fail and auth_email_action_gate become
-- server-only, the same shape as waitlist_lookup (20261105a) and
-- auth_account_status (20260912b): only service_role may EXECUTE, and the
-- sign-in pages reach them through api/auth-throttle.js (server key, per-IP
-- limit in middleware.js).
--
-- Revoked from public as well as anon and authenticated: anonymous sign-in
-- hands visitors the authenticated role, and a PUBLIC grant would be
-- inherited by both.
--
-- login_throttle_clear is unchanged: it acts only on the caller's own session
-- email (20260905l) and the page calls it on the client that holds the new
-- session.
--
-- Deploy order: ship api/auth-throttle.js + src/utils/authThrottle.js FIRST
-- (the route uses the server key, so it works before and after this), then
-- apply this. Grants only, no function bodies change.

revoke all on function public.login_throttle_check(text) from public, anon, authenticated;
revoke all on function public.login_throttle_fail(text) from public, anon, authenticated;
revoke all on function public.auth_email_action_gate(text, text) from public, anon, authenticated;

grant execute on function public.login_throttle_check(text) to service_role;
grant execute on function public.login_throttle_fail(text) to service_role;
grant execute on function public.auth_email_action_gate(text, text) to service_role;

