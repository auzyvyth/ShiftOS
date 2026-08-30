-- AUTH-1: a guest (anonymous) session must never become a seller account.
--
-- What happened: guest buyers sign in anonymously so they can open an in-app
-- chat without an account (see CLAUDE.md, in-app buyer chat). handle_new_user()
-- correctly stamps role='buyer' on those users. But nothing stopped a LATER
-- write from changing that role, and both onboarding pages adopted whatever
-- session already existed -- so a guest who tapped a sell CTA had their
-- anonymous identity converted into a salesman account.
--
-- That produced profile c8cd260e-c308-4020-a234-d9f98906e64c: role='salesman',
-- plan='salesman_lite', a live storefront slug, and auth.users.email = NULL with
-- is_anonymous = true. Nobody can ever sign into it again -- there is no address
-- to reset a password to -- and it is an unverified account holding a public
-- seller page.
--
-- prevent_profile_privilege_escalation already blocked the staff roles and
-- blocked climbing to dealer/owner, but 'salesman' was a legal self-assignment
-- (that is how normal Lite signup works), so this path passed every check.
--
-- The guard is here, in the trigger, rather than only in the onboarding pages,
-- for the same reason the won-deal fanout lives in the DB: it has to hold no
-- matter which client does the write.
--
-- Upgrading is still possible and is the intended path: linking an email to an
-- anonymous user flips auth.users.is_anonymous to false, after which the same
-- write succeeds. So this blocks "guest becomes seller", not "guest becomes a
-- real account and then a seller".

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

  -- AUTH-1. Every role except 'buyer' is a selling identity of some kind, and a
  -- guest account cannot hold one. Checked against the target row's own auth
  -- user, not the JWT, so it holds however the write arrives.
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

  IF TG_OP = 'INSERT' OR (gated AND onboarding_completing) THEN
    NEW.subscription_status := 'trial';
    IF gated THEN
      NEW.trial_ends_at := now() + interval '30 days';
    ELSIF NEW.trial_ends_at IS NULL OR NEW.trial_ends_at > (now() + interval '15 days') THEN
      NEW.trial_ends_at := now() + interval '14 days';
    END IF;
    NEW.plan_expires_at := NULL;
    NEW.account_status := 'active';
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
