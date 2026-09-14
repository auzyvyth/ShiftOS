-- Bug: Salesman Lite is free forever (identity verification only, no billing
-- cycle), but prevent_profile_privilege_escalation() stamped a generic
-- 14-day trial (subscription_status='trial', trial_ends_at=+14d) on EVERY
-- new profile row on INSERT, with no carve-out for the free-forever plan.
-- That 14-day rule exists for DEALER signups (20260721_trial_first_dealer_
-- signup.sql) but caught salesman_lite too, so approved Lite sellers showed
-- "Trial · Nd left" in Platform > People > Accounts (AccountsTab.jsx
-- statusOf()), and a daily cron (pg_cron jobid 8) later flipped the older
-- ones to "Expired" once that fake trial_ends_at passed. Premium
-- (salesman_full, standalone) is correctly gated with a real 30-day free
-- month before payment is required -- only Lite was wrong.
create or replace function public.prevent_profile_privilege_escalation()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  paid_plans CONSTANT text[] := ARRAY['dealer_starter','dealer_growth','dealer_pro','dealer_group','salesman_full'];
  gated boolean;
  plan_ok boolean;
  onboarding_completing boolean;
  self_restoring boolean;
BEGIN
  IF auth.uid() IS NULL OR is_superadmin() THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.role, 'buyer') <> 'buyer'
     AND (TG_OP = 'INSERT' OR NEW.role IS DISTINCT FROM OLD.role)
     AND EXISTS (
       SELECT 1 FROM auth.users u
        WHERE u.id = NEW.id AND COALESCE(u.is_anonymous, false)
     ) THEN
    RAISE EXCEPTION 'guest accounts cannot become sellers: add an email and password to this account first'
      USING ERRCODE = 'check_violation';
  END IF;

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

  IF NEW.payment_status IS NOT NULL AND NEW.payment_status <> 'pending' THEN
    IF TG_OP = 'UPDATE' AND NEW.payment_status = OLD.payment_status THEN
      NULL;
    ELSE
      NEW.payment_status := CASE WHEN TG_OP = 'UPDATE' THEN OLD.payment_status ELSE NULL END;
    END IF;
  END IF;

  onboarding_completing := TG_OP = 'UPDATE'
    AND COALESCE(OLD.onboarding_complete, false) = false
    AND NEW.onboarding_complete = true;

  gated := NEW.plan::text = 'salesman_full' AND NEW.dealer_id IS NULL;
  IF gated THEN
    IF TG_OP = 'UPDATE'
       AND COALESCE(OLD.payment_status,'') = 'received'
       AND NEW.plan IS NOT DISTINCT FROM OLD.plan
       AND NEW.role IS NOT DISTINCT FROM OLD.role THEN
      NEW.payment_status := 'received';
    ELSIF TG_OP = 'INSERT' OR onboarding_completing THEN
      NEW.payment_status := NULL;
    ELSIF TG_OP = 'UPDATE'
          AND (NEW.plan IS DISTINCT FROM OLD.plan OR NEW.role IS DISTINCT FROM OLD.role) THEN
      NEW.payment_status := 'pending';
    END IF;
  END IF;

  self_restoring := TG_OP = 'UPDATE'
    AND COALESCE(current_setting('app.allow_self_restore', true), '') = 'on'
    AND OLD.account_status = 'deleted'
    AND NEW.account_status = 'active'
    AND auth.uid() = NEW.id;

  IF TG_OP = 'INSERT' OR (gated AND onboarding_completing) THEN
    IF NEW.plan::text = 'salesman_lite' THEN
      -- Free forever -- there is no billing cycle for a countdown to describe.
      NEW.subscription_status := 'active';
      NEW.trial_ends_at := NULL;
    ELSE
      NEW.subscription_status := 'trial';
      IF gated THEN
        NEW.trial_ends_at := now() + interval '30 days';
      ELSIF NEW.trial_ends_at IS NULL OR NEW.trial_ends_at > (now() + interval '15 days') THEN
        NEW.trial_ends_at := now() + interval '14 days';
      END IF;
    END IF;
    NEW.plan_expires_at := NULL;
    NEW.account_status := 'active';
    IF TG_OP = 'INSERT' THEN
      NEW.deleted_at        := NULL;
      NEW.suspended_at      := NULL;
      NEW.suspension_reason := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
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
    IF NOT self_restoring AND NEW.account_status IS DISTINCT FROM OLD.account_status THEN
      NEW.account_status := OLD.account_status;
    END IF;
    IF NOT self_restoring AND NEW.is_active = true AND OLD.is_active = false THEN
      NEW.is_active := false;
    END IF;
    IF NOT self_restoring AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      NEW.deleted_at := OLD.deleted_at;
    END IF;
    IF NEW.suspended_at IS DISTINCT FROM OLD.suspended_at THEN
      NEW.suspended_at := OLD.suspended_at;
    END IF;
    IF NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason THEN
      NEW.suspension_reason := OLD.suspension_reason;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: every existing Lite account currently mislabeled "Trial · Nd
-- left" or "Expired" from the old bug goes back to a plain "Active" with no
-- countdown. Runs as the migration role (no auth.uid()), so the trigger's
-- own UPDATE-locking of subscription_status/trial_ends_at does not apply.
update public.profiles
set subscription_status = 'active', trial_ends_at = null
where role = 'salesman'
  and plan = 'salesman_lite'
  and subscription_status in ('trial', 'expired');
