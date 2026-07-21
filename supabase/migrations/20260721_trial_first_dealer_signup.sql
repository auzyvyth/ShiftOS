-- MKT-C1: make the "14-day free trial, no card" promise real for dealers.
-- Applied to live DB 2026-07-21 (MCP migration trial_first_dealer_signup).
--
-- Before: any gated signup (dealer/owner role OR paid plan) was forced to
-- payment_status='pending' at INSERT, throwing new dealers onto the QR
-- paywall despite every marketing surface promising a free trial.
-- After: dealers are governed by the trial machinery this same trigger
-- already enforces (subscription_status='trial' + trial_ends_at on INSERT,
-- self-extension blocked on UPDATE). The pay-first gate remains ONLY for
-- solo Salesman Premium (salesman_full with no parent dealer), whose sole
-- access control is the payment gate (PAY-1).
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

  -- ── Plan: bind to role family, freeze after first assignment ─────────────
  plan_ok := NEW.plan IS NULL
    OR (NEW.role IN ('dealer','owner') AND NEW.plan::text IN ('dealer_starter','dealer_growth','dealer_pro'))
    OR (NEW.role = 'salesman'          AND NEW.plan::text IN ('salesman_lite','salesman_full'));

  IF TG_OP = 'INSERT' THEN
    IF NOT plan_ok THEN NEW.plan := NULL; END IF;
  ELSE
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      IF OLD.plan IS NULL AND plan_ok THEN
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
