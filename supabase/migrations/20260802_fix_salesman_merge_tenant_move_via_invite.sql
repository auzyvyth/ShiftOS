-- The prevent_profile_privilege_escalation tenant guard blocks ANY change of
-- profiles.dealer_id to a non-self value. That correctly stops a user self-moving
-- into another dealer's tenant to read its data -- but it also broke the
-- legitimate salesman->dealer merge: use_dealer_invite (SECURITY DEFINER) sets
-- profiles.dealer_id after verifying a valid invite, and the trigger (which sees
-- auth.uid()=the caller, not superadmin) raised 'not allowed to change tenant',
-- leaving the salesman unlinked. (A second bug compounded it: use_dealer_invite
-- referenced a non-existent profiles.updated_at column -- dropped here.)
--
-- Fix: use_dealer_invite sets a transaction-local flag (app.allow_tenant_move)
-- AFTER it has verified the invite; the guard permits the move ONLY when that
-- flag is set AND it is a solo salesman (OLD.dealer_id IS NULL) linking for the
-- first time. A PostgREST client cannot set custom GUCs, so the verified invite
-- remains the sole authorization. use_dealer_invite also re-tenants the
-- salesman's own leads + listings in the same atomic call.

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

  -- Pay-first gate: solo Salesman Premium only.
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

-- Full server-side, atomic merge: verify invite, flag the tenant move, link the
-- salesman's profile + plan, re-tenant their own leads + listings, mark used.
CREATE OR REPLACE FUNCTION public.use_dealer_invite(invite_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_invite dealer_invites%ROWTYPE;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_invite FROM dealer_invites
  WHERE code = upper(trim(invite_code)) AND used = false AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_or_expired_invite'; END IF;

  -- Authorize the tenant move for the escalation trigger (transaction-local).
  PERFORM set_config('app.allow_tenant_move', 'on', true);

  UPDATE profiles SET dealer_id = v_invite.dealer_id, plan = 'salesman_full'
  WHERE id = v_user_id AND role = 'salesman';
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;

  UPDATE leads SET dealer_id = v_invite.dealer_id
   WHERE salesman_id = v_user_id AND dealer_id IS NULL;
  UPDATE car_listings SET dealer_id = v_invite.dealer_id
   WHERE assigned_to = v_user_id;

  UPDATE dealer_invites SET used = true, accepted_by = v_user_id, accepted_at = now()
   WHERE id = v_invite.id;
END; $function$;
