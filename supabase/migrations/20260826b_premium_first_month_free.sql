-- Salesman Premium first-month-free promo: a new solo Premium signup
-- (plan='salesman_full', dealer_id IS NULL) gets 30 days of full access
-- immediately, no DuitNow QR up front -- mirrors the dealer trial that
-- already exists (trial_first_dealer_signup), which this table never had.
-- After 30 days the account hits the same expired-trial QR screen dealers
-- see (DealerPendingApproval variant="expired"), reused as-is.
--
-- IMPORTANT mechanics discovered while building this: handle_new_user()
-- inserts a bare profiles row the moment auth.users gets created (plan
-- defaults to salesman_lite -- SalesmanOnboarding's signUp() never passes
-- plan in the auth metadata, only account_type/tier). The real activation
-- -- SalesmanOnboarding.activate()'s upsert, which sets plan='salesman_full'
-- + onboarding_complete=true in one call -- therefore conflicts on id and
-- fires this trigger as TG_OP='UPDATE', never 'INSERT'. A trial-grant that
-- only checked TG_OP='INSERT' would be dead code for every real signup. So
-- "onboarding_completing" (OLD.onboarding_complete=false -> NEW=true) is
-- treated as equivalent to a fresh INSERT for the gated case. A later,
-- deliberate Lite<->Full switch by an already-onboarded user is NOT this
-- condition and stays pay-first immediately, unchanged.

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  paid_plans CONSTANT text[] := ARRAY['dealer_starter','dealer_growth','dealer_pro','dealer_group','salesman_full'];
  gated boolean;
  plan_ok boolean;
  onboarding_completing boolean;
BEGIN
  IF auth.uid() IS NULL OR is_superadmin() THEN
    RETURN NEW;
  END IF;

  -- ── Role guards ──────────────────────────────────────────────────────────
  IF NEW.role IN ('manager','admin','accountant','fi_officer','superadmin')
     AND (TG_OP = 'INSERT' OR NEW.role IS DISTINCT FROM OLD.role) THEN
    RAISE EXCEPTION 'not allowed to assign role: %', NEW.role
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.role IN ('dealer','owner')
     AND NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE(OLD.role,'') NOT IN ('dealer','owner') THEN
    RAISE EXCEPTION 'not allowed to change role to %', NEW.role
      USING ERRCODE = 'check_violation';
  END IF;

  -- Tenant (dealer_id) move: blocked, EXCEPT a solo salesman linking to a dealer
  -- for the first time via the invite-redemption RPC (which sets the flag only
  -- after verifying a valid, unused, unexpired invite).
  IF NEW.dealer_id IS NOT NULL AND NEW.dealer_id <> NEW.id
     AND (TG_OP = 'INSERT' OR NEW.dealer_id IS DISTINCT FROM OLD.dealer_id) THEN
    IF NOT (
      TG_OP = 'UPDATE'
      AND OLD.dealer_id IS NULL
      AND NEW.role = 'salesman'
      AND COALESCE(current_setting('app.allow_tenant_move', true), '') = 'on'
    ) THEN
      RAISE EXCEPTION 'not allowed to change tenant (dealer_id)'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- ── Plan: bind to role family; salesman may switch lite<->full ───────────
  plan_ok := NEW.plan IS NULL
    OR (NEW.role IN ('dealer','owner') AND NEW.plan::text IN ('dealer_starter','dealer_growth','dealer_pro'))
    OR (NEW.role = 'salesman'          AND NEW.plan::text IN ('salesman_lite','salesman_full'));

  IF TG_OP = 'INSERT' THEN
    IF NOT plan_ok THEN NEW.plan := NULL; END IF;
  ELSE
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      IF NOT plan_ok THEN
        NEW.plan := OLD.plan;
      ELSIF OLD.plan IS NULL THEN
        NULL;
      ELSIF NEW.role = 'salesman'
            AND OLD.plan::text IN ('salesman_lite','salesman_full')
            AND NEW.plan::text IN ('salesman_lite','salesman_full') THEN
        NULL;
      ELSE
        NEW.plan := OLD.plan;
      END IF;
    END IF;
  END IF;

  -- ── Payment status: never self-grant access ─────────────────────────────
  IF NEW.payment_status IS NOT NULL AND NEW.payment_status <> 'pending' THEN
    IF TG_OP = 'UPDATE' AND NEW.payment_status = OLD.payment_status THEN
      NULL;
    ELSE
      NEW.payment_status := CASE WHEN TG_OP = 'UPDATE' THEN OLD.payment_status ELSE NULL END;
    END IF;
  END IF;

  -- handle_new_user() already inserted a bare row at signup (see header
  -- comment) -- the real activation lands as an UPDATE that flips
  -- onboarding_complete false->true. Treat that moment like a fresh signup.
  onboarding_completing := TG_OP = 'UPDATE'
    AND COALESCE(OLD.onboarding_complete, false) = false
    AND NEW.onboarding_complete = true;

  -- Pay-first gate: solo Salesman Premium only.
  gated := NEW.plan::text = 'salesman_full' AND NEW.dealer_id IS NULL;
  IF gated THEN
    IF TG_OP = 'UPDATE'
       AND COALESCE(OLD.payment_status,'') = 'received'
       AND NEW.plan IS NOT DISTINCT FROM OLD.plan
       AND NEW.role IS NOT DISTINCT FROM OLD.role THEN
      NEW.payment_status := 'received';
    ELSIF TG_OP = 'INSERT' OR onboarding_completing THEN
      -- First-month-free promo: brand new signup (whether it lands as a
      -- genuine INSERT, or as the onboarding-completing UPDATE described
      -- above) gets 30 days of access via subscription_status/trial_ends_at
      -- below, no upfront QR. Force NULL regardless of what the client sent
      -- -- the DB decides this, not the client.
      NEW.payment_status := NULL;
    ELSIF TG_OP = 'UPDATE'
          AND (NEW.plan IS DISTINCT FROM OLD.plan OR NEW.role IS DISTINCT FROM OLD.role) THEN
      -- A later Lite<->Full switch (or role change into a gated plan) by an
      -- already-onboarded user is a deliberate mid-life action, not the
      -- initial signup -- stays pay-first immediately, same as before.
      NEW.payment_status := 'pending';
    END IF;
  END IF;

  -- ── Subscription / trial / status ────────────────────────────────────────
  IF TG_OP = 'INSERT' OR (gated AND onboarding_completing) THEN
    NEW.subscription_status := 'trial';
    IF gated THEN
      -- Fixed 30-day (one month) trial for solo Premium's first-month-free
      -- promo -- ignores whatever the client sent (including the 14-day
      -- default the trial_ends_at column stamped on handle_new_user's bare
      -- insert), same reasoning as payment_status above.
      NEW.trial_ends_at := now() + interval '30 days';
    ELSIF NEW.trial_ends_at IS NULL OR NEW.trial_ends_at > (now() + interval '15 days') THEN
      NEW.trial_ends_at := now() + interval '14 days';
    END IF;
    NEW.plan_expires_at := NULL;
    NEW.account_status := 'active';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Block self-extension of access on every other update.
    IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
      NEW.subscription_status := OLD.subscription_status;
    END IF;
    IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
       AND (OLD.trial_ends_at IS NULL OR NEW.trial_ends_at > OLD.trial_ends_at) THEN
      NEW.trial_ends_at := OLD.trial_ends_at;
    END IF;
    IF NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at THEN
      NEW.plan_expires_at := OLD.plan_expires_at;
    END IF;
    IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
      NEW.account_status := OLD.account_status;
    END IF;
    IF NEW.is_active = true AND OLD.is_active = false THEN
      NEW.is_active := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
