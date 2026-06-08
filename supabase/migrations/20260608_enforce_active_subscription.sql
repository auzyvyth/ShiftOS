-- Backend enforcement of the 14-day trial lockout.
-- The dealer dashboard already hard-locks expired dealers client-side
-- (useSubscription -> "Your trial has ended" screen), but a direct
-- PostgREST/API call could still insert listings. This trigger closes that
-- gap at the DB layer. Keyed on NEW.dealer_id (the parent dealer profile), so
-- it also covers inserts made by a dealer's salesman/manager. Independent
-- salesmen (role='salesman') and superadmin are never blocked. Legacy accounts
-- with a NULL subscription_status are grandfathered (allowed).
CREATE OR REPLACE FUNCTION public.enforce_active_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role   text;
  v_status text;
  v_trial  timestamptz;
BEGIN
  IF NEW.dealer_id IS NULL THEN RETURN NEW; END IF;

  SELECT role, subscription_status, trial_ends_at
    INTO v_role, v_status, v_trial
  FROM profiles
  WHERE id = NEW.dealer_id;

  -- superadmin / platform accounts are never gated
  IF v_role = 'superadmin' THEN RETURN NEW; END IF;

  -- active subscription, or trial still within its window -> allow
  IF v_status = 'active' THEN RETURN NEW; END IF;
  IF v_status = 'trial' AND v_trial IS NOT NULL AND v_trial > now() THEN RETURN NEW; END IF;

  -- NULL status = legacy account predating trial tracking -> allow
  IF v_status IS NULL THEN RETURN NEW; END IF;

  -- everything else (expired, or trial past trial_ends_at) is blocked
  RAISE EXCEPTION 'subscription_inactive'
    USING HINT = 'Your trial has ended — activate your ShiftOS subscription to continue',
          DETAIL = format('status=%s trial_ends_at=%s', v_status, v_trial);
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_active_subscription ON public.car_listings;
CREATE TRIGGER trg_enforce_active_subscription
  BEFORE INSERT ON public.car_listings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_subscription();
