-- SEC-1: seller phone numbers must only leave the DB through /api/wa and
-- /api/call-number (rate-limited per IP at the edge). Both RPCs were still
-- executable by anon/authenticated, so anyone could loop every public car id
-- against /rest/v1/rpc and harvest every number, skipping the rate limit.
--
-- Safe to apply: proven 2026-10-09 from the API logs that production's /api/wa
-- already calls with the server (sb_secret_) key, and grep shows no browser
-- caller of either function. Independent of 20261009a; can run alone.
-- No DDL 09:00-22:00 Malaysia time (01:00-14:00 UTC).

-- Grants held via PUBLIC are inherited by anon, so revoke from public too.
revoke execute on function public.get_seller_whatsapp(uuid, text, uuid)  from public, anon, authenticated;
revoke execute on function public.get_listing_call_number(uuid)          from public, anon, authenticated;
grant  execute on function public.get_seller_whatsapp(uuid, text, uuid)  to service_role;
grant  execute on function public.get_listing_call_number(uuid)          to service_role;

-- Verify after applying (expect false, false, true for each):
--   select p.oid::regprocedure, has_function_privilege('anon', p.oid, 'EXECUTE'),
--          has_function_privilege('authenticated', p.oid, 'EXECUTE'),
--          has_function_privilege('service_role', p.oid, 'EXECUTE')
--   from pg_proc p where proname in ('get_seller_whatsapp','get_listing_call_number');
-- Then tap a WhatsApp and a Call button on a live car page: both must still open.
