-- SEC-ANON. Public write paths were open wider than the hardened API proxies in
-- front of them suggest.
--
-- The proxies in api/ (Turnstile + the per-IP limits in middleware.js) are
-- OPTIONAL: the anon key ships in the JS bundle, so anyone can skip them and
-- POST straight to /rest/v1/<table>. Whatever RLS allows is the real limit.
--
-- Every cap below returned TRUE whenever the caller left the identifying field
-- blank, so the cap only applied to an attacker who chose to identify
-- themselves. Blank now gets its own bounded bucket instead of a free pass.

-- 1. leads. Verified live: 25 anon inserts landed in a named Salesman Lite
--    rep's pipeline with dealer_id NULL, salesman_id set to the victim and
--    phone NULL, and leads_public_rate_ok waved every one of them through.
--
--    leads_public_insert cannot simply be dropped: public.leads has FORCE ROW
--    LEVEL SECURITY, so the SECURITY DEFINER routines that create every real
--    inbound lead (create_lead_from_whatsapp, create_lead_from_booking,
--    enquiry_to_lead, chat_after_message) are subject to RLS too and this is
--    the policy they insert under. A no-phone lead is also legitimate — a guest
--    chat buyer has no number — so the shape cannot be rejected outright.
--
--    What it can do is bound the no-phone bucket PER TARGET, which is what the
--    old signature could not express: it never saw salesman_id, so a NULL
--    dealer_id (exactly a Salesman Lite pipeline) collapsed to "no limit".
create or replace function public.leads_public_rate_ok(
  p_phone text, p_dealer_id uuid, p_salesman_id uuid
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  cnt integer;
BEGIN
  IF p_phone IS NULL OR p_phone = '' THEN
    -- No phone to key on. Bound the no-phone bucket for whichever owner this
    -- lead is aimed at, so an unattributable flood cannot exceed one hour's
    -- plausible volume for one seller.
    SELECT COUNT(*) INTO cnt
    FROM leads
    WHERE (phone IS NULL OR phone = '')
      AND created_at > now() - interval '1 hour'
      AND (
        (p_dealer_id IS NOT NULL AND dealer_id = p_dealer_id)
        OR (p_dealer_id IS NULL AND p_salesman_id IS NOT NULL AND salesman_id = p_salesman_id)
        OR (p_dealer_id IS NULL AND p_salesman_id IS NULL
            AND dealer_id IS NULL AND salesman_id IS NULL)
      );
    RETURN cnt < 20;
  END IF;

  SELECT COUNT(*) INTO cnt
  FROM leads
  WHERE phone = p_phone
    AND (p_dealer_id IS NULL OR dealer_id = p_dealer_id)
    AND created_at > now() - interval '1 hour';
  RETURN cnt < 3;
END;
$function$;

drop policy if exists leads_public_insert on public.leads;
create policy leads_public_insert on public.leads
  for insert to anon, authenticated
  with check (
    ((dealer_id IS NULL) OR is_dealer_active(dealer_id))
    AND leads_public_rate_ok(phone, dealer_id, salesman_id)
  );

-- 2. whatsapp_enquiries keyed only on session_id, a string the client invents.
--    Rotating it per request defeated the cap completely and a blank one
--    skipped it. Add a per-dealer ceiling so rotation cannot buy more than the
--    tenant's own hourly budget.
create or replace function public.whatsapp_enquiry_rate_ok(p_session_id text, p_dealer_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  per_session integer;
  per_dealer  integer;
BEGIN
  SELECT COUNT(*) INTO per_dealer
  FROM whatsapp_enquiries
  WHERE dealer_id = p_dealer_id
    AND created_at > now() - interval '1 hour';
  IF per_dealer >= 60 THEN
    RETURN false;
  END IF;

  IF p_session_id IS NULL OR p_session_id = '' THEN
    SELECT COUNT(*) INTO per_session
    FROM whatsapp_enquiries
    WHERE (session_id IS NULL OR session_id = '')
      AND dealer_id = p_dealer_id
      AND created_at > now() - interval '1 minute';
    RETURN per_session < 5;
  END IF;

  SELECT COUNT(*) INTO per_session
  FROM whatsapp_enquiries
  WHERE session_id = p_session_id
    AND created_at > now() - interval '1 minute';
  RETURN per_session < 5;
END;
$function$;

drop policy if exists enquiries_public_insert on public.whatsapp_enquiries;
create policy enquiries_public_insert on public.whatsapp_enquiries
  for insert to anon, authenticated
  with check (
    is_dealer_active(dealer_id)
    AND whatsapp_enquiry_rate_ok(session_id, dealer_id)
  );

-- 3. appointments let a blank buyer_phone through unlimited. This policy
--    governs EVERY appointment insert, dealer-created ones included, so the
--    no-phone bucket sits well above real dealer volume.
create or replace function public.appointments_public_rate_ok(p_phone text, p_dealer_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  cnt integer;
BEGIN
  IF p_phone IS NULL OR p_phone = '' THEN
    SELECT COUNT(*) INTO cnt
    FROM appointments
    WHERE (buyer_phone IS NULL OR buyer_phone = '')
      AND dealer_id = p_dealer_id
      AND created_at > now() - interval '1 hour';
    RETURN cnt < 20;
  END IF;

  SELECT COUNT(*) INTO cnt
  FROM appointments
  WHERE buyer_phone = p_phone
    AND dealer_id = p_dealer_id
    AND created_at > now() - interval '1 day';
  RETURN cnt < 5;
END;
$function$;

-- 4. waitlist_signups accepted anything from anon: WITH CHECK (true). The
--    api/waitlist.js limiter is skippable for the same reason as above, so a
--    single script could fill the launch waitlist with junk rows and shift
--    everyone's queue position (`position` is what the page promises people).
create or replace function public.waitlist_rate_ok(p_phone text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  cnt integer;
BEGIN
  IF p_phone IS NULL OR p_phone = '' THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO cnt
  FROM waitlist_signups
  WHERE created_at > now() - interval '1 hour';
  IF cnt >= 100 THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO cnt
  FROM waitlist_signups
  WHERE phone = p_phone
    AND created_at > now() - interval '1 day';
  RETURN cnt < 3;
END;
$function$;

drop policy if exists anon_insert on public.waitlist_signups;
create policy anon_insert on public.waitlist_signups
  for insert to anon
  with check (
    length(btrim(name)) between 2 and 100
    AND phone ~ '^\\+?[0-9]{9,15}$'
    AND (referral_code IS NULL OR length(referral_code) <= 40)
    AND (referred_by IS NULL OR length(referred_by) <= 40)
    AND waitlist_rate_ok(phone)
  );

-- 5. profiles: users_upsert_own_profile_no_escalation is FOR ALL, which grants
--    DELETE. Migration 20260828e dropped the DELETE policies on profiles so a
--    client-side hard delete would be impossible; this one quietly handed it
--    back, letting a seller destroy their own row from the browser and skip the
--    soft-delete + 30-day purge the platform console runs on. Verified: an
--    authenticated self-DELETE removed 1 row.
--    SELECT is already covered by profiles_own_and_team_select and INSERT by
--    insert_own_profile, so this only needs to carry UPDATE.
drop policy if exists users_upsert_own_profile_no_escalation on public.profiles;
create policy users_update_own_profile_no_escalation on public.profiles
  for update to anon, authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id AND (is_superadmin() OR role <> 'superadmin'));
