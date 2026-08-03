-- Fix: solo salesman could never upgrade salesman_lite -> salesman_full.
-- handle_new_user() seeds every salesman with plan='salesman_lite', so by the
-- time SalesmanOnboarding.activate() writes plan='salesman_full' the row's plan
-- is already non-null and the "freeze plan after first assignment" rule reverted
-- it back to lite. Result: premium signups landed in Lite, never reaching the
-- payment/QR gate (payment_status stayed 'pending' but plan stayed lite).
--
-- Allowing the salesman lite<->full transition is safe: solo salesman_full is
-- independently payment-gated by the `gated` block below (forces
-- payment_status='pending'), so a self-set plan still grants no access until an
-- admin marks payment received. Dealer plans remain frozen (no self-upgrade).
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

  IF NEW.dealer_id IS NOT NULL AND NEW.dealer_id <> NEW.id
     AND (TG_OP = 'INSERT' OR NEW.dealer_id IS DISTINCT FROM OLD.dealer_id) THEN
    RAISE EXCEPTION 'not allowed to change tenant (dealer_id)'
      USING ERRCODE = 'check_violation';
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
        -- Plan not valid for this role: reject the change, keep the old plan.
        NEW.plan := OLD.plan;
      ELSIF OLD.plan IS NULL THEN
        -- First assignment: allow.
        NULL;
      ELSIF NEW.role = 'salesman'
            AND OLD.plan::text IN ('salesman_lite','salesman_full')
            AND NEW.plan::text IN ('salesman_lite','salesman_full') THEN
        -- Salesman self-upgrade/downgrade between lite and full. Access to full
        -- is still payment-gated by the `gated` block below.
        NULL;
      ELSE
        -- Dealer plans: frozen after first assignment (no self-service jump).
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

  -- Pay-first gate: solo Salesman Premium only. Dealers run on the trial
  -- machinery below instead of a signup paywall.
  gated := NEW.plan::text = 'salesman_full' AND NEW.dealer_id IS NULL;
  IF gated THEN
    IF TG_OP = 'UPDATE'
       AND COALESCE(OLD.payment_status,'') = 'received'
       AND NEW.plan IS NOT DISTINCT FROM OLD.plan
       AND NEW.role IS NOT DISTINCT FROM OLD.role THEN
      NEW.payment_status := 'received';
    ELSIF TG_OP = 'UPDATE'
          AND (NEW.plan IS DISTINCT FROM OLD.plan OR NEW.role IS DISTINCT FROM OLD.role) THEN
      NEW.payment_status := 'pending';
    ELSIF TG_OP = 'INSERT' THEN
      NEW.payment_status := 'pending';
    END IF;
  END IF;

  -- ── Subscription / trial / status: block self-extension of access ───────
  IF TG_OP = 'UPDATE' THEN
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
  ELSE
    NEW.subscription_status := 'trial';
    IF NEW.trial_ends_at IS NULL OR NEW.trial_ends_at > (now() + interval '15 days') THEN
      NEW.trial_ends_at := now() + interval '14 days';
    END IF;
    NEW.plan_expires_at := NULL;
    NEW.account_status := 'active';
  END IF;

  RETURN NEW;
END;
$function$;
