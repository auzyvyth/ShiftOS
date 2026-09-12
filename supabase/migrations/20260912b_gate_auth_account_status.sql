-- SEC-B5: auth_account_status(p_email) was an account-enumeration oracle open
-- to anon (and to PUBLIC, which anon inherits from regardless of an anon-only
-- revoke -- the same trap CLAUDE.md's share-token section documents). Anyone
-- holding the public anon key could call it directly from a browser console
-- for as many emails as they liked, at any rate, completely bypassing the
-- "only after a failed login" gate the two callers (LoginPage, BuyerAuthPage)
-- enforce client-side.
--
-- Decision (owner, 2026-09-12): keep the precise Google-vs-password answer
-- (a vaguer response breaks the feature this function exists for) and do not
-- rate-limit by email (PostgREST gives the function no caller IP, so an
-- email-keyed limiter can only lock out the real owner, never the scraper).
-- Instead: require the same invisible Turnstile proof-of-human already built
-- for every other auth call (AUTH-6), verified server-side in a new Vercel API
-- route (api/auth-account-status.js) that fronts this function. A scripted
-- scraper now has to solve a challenge per lookup; one real person typing one
-- email never notices.
--
-- This only closes the hole if the DIRECT RPC path is shut: revoke EXECUTE
-- from public/anon/authenticated so the browser can no longer call it at all,
-- and grant it to service_role only -- the new API route is the sole caller,
-- using the service-role key from server-only env.
revoke all on function public.auth_account_status(text) from public;
revoke all on function public.auth_account_status(text) from anon;
revoke all on function public.auth_account_status(text) from authenticated;
grant execute on function public.auth_account_status(text) to service_role;
