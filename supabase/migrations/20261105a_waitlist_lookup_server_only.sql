-- waitlist_lookup(p_phone) leaked any phone's waitlist position and referral_code
-- to anyone: it is SECURITY DEFINER and was EXECUTE-granted to anon/authenticated,
-- so a visitor could call the RPC straight from the browser, supplying any phone
-- number, and bypass /api/waitlist's captcha + per-IP rate limit.
--
-- Make it server-only, the same shape as get_listing_call_number and
-- auth_account_status: only the service role may call it, and api/waitlist.js now
-- uses SUPABASE_SERVICE_ROLE_KEY. No PUBLIC grant exists on it, so revoking the
-- two role grants is enough; service_role keeps EXECUTE.
--
-- Deploy order (safe either way): ship the api/waitlist.js change FIRST (it works
-- with or without this revoke via the service-key-first client), then apply this.
revoke execute on function public.waitlist_lookup(text) from anon, authenticated;
grant  execute on function public.waitlist_lookup(text) to service_role;
