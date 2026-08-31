-- FIX-WAITLIST. Two waitlist features have never worked.
--
-- api/waitlist.js runs as the ANON role, and waitlist_signups has no anon
-- SELECT policy (only superadmin_read_waitlist, for authenticated). So both of
-- its reads silently return null:
--   * api/waitlist.js:32 "return existing signup if phone already registered"
--     never matches -> a returning person gets a NEW row and a NEW queue
--     position every time they submit, and the page shows them a different
--     number each visit.
--   * api/waitlist.js:71 the referrer lookup never matches -> founding_member
--     is never granted to anybody. The referral reward is dead.
-- Only 2 rows exist so far, so this has not bitten yet — it would have on the
-- first day of real traffic, which is exactly when the referral loop matters.
--
-- Both reads become one SECURITY DEFINER lookup that returns ONLY the two
-- fields the API echoes back. No anon SELECT policy is added: the table holds
-- names and phone numbers, and a policy would make the whole list readable.
create or replace function public.waitlist_lookup(p_phone text)
returns table ("position" integer, referral_code text)
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select w.position, w.referral_code
  from waitlist_signups w
  where w.phone = p_phone
  limit 1;
$function$;

-- Credit a referrer their founding-member badge. Takes the referral CODE, never
-- an id, so the caller cannot aim it at a row of their choosing, and it is a
-- no-op unless that code has actually been used by somebody.
create or replace function public.waitlist_credit_referrer(p_ref_code text)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
DECLARE
  v_id    uuid;
  v_uses  int;
BEGIN
  IF p_ref_code IS NULL OR btrim(p_ref_code) = '' THEN RETURN false; END IF;

  SELECT id INTO v_id
  FROM waitlist_signups
  WHERE referral_code = p_ref_code AND founding_member IS NOT TRUE
  LIMIT 1;
  IF v_id IS NULL THEN RETURN false; END IF;

  SELECT COUNT(*) INTO v_uses
  FROM waitlist_signups
  WHERE referred_by = p_ref_code;
  IF v_uses < 1 THEN RETURN false; END IF;

  UPDATE waitlist_signups SET founding_member = true WHERE id = v_id;
  RETURN true;
END;
$function$;

revoke all on function public.waitlist_lookup(text) from public;
revoke all on function public.waitlist_credit_referrer(text) from public;
grant execute on function public.waitlist_lookup(text) to anon, authenticated;
grant execute on function public.waitlist_credit_referrer(text) to anon, authenticated;
