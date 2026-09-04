-- Salesman panel security sweep (2026-09-04). Three profile-level holes.
--
-- 1. suspension_reason / suspended_at were client-writable. A suspended seller
--    could erase the explanation SuspendedBanner shows them (and the one the
--    platform console records), so support gets the "why am I locked out"
--    question back with no trail.
-- 2. deleted_at was client-writable, and SalesmanLite's "Reactivate" button
--    wrote it. account_status and is_active are already reverted by this
--    trigger, so the restore silently did nothing -- but deleted_at DID get
--    cleared, and purge-deleted-accounts selects `deleted_at < cutoff`. A NULL
--    never matches, so the account could never be restored AND never be
--    purged: locked out forever, data kept forever. That is a data-retention
--    problem, not just a dead button.
-- 3. redeem_invite(text) is EXECUTE-able by anon -- an unauthenticated oracle
--    that turns a guessed invite code into a dealer id, with no rate limit.
--
-- The fix for (2) is a real restore path, not a looser trigger: restore_my_account()
-- checks the grace window itself and opens a one-statement escape hatch, the same
-- shape as use_dealer_invite's app.allow_tenant_move.

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

  -- AUTH-1. Every role except 'buyer' is a selling identity of some kind, and a
  -- guest (anonymous) account cannot hold one. Checked against the target row's
  -- own auth user, not the JWT, so it holds however the write arrives.
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

  -- Set only by restore_my_account(), which has already checked that this row
  -- is the caller's own and still inside the 30-day grace window.
  self_restoring := TG_OP = 'UPDATE'
    AND COALESCE(current_setting('app.allow_self_restore', true), '') = 'on'
    AND OLD.account_status = 'deleted'
    AND NEW.account_status = 'active'
    AND auth.uid() = NEW.id;

  IF TG_OP = 'INSERT' OR (gated AND onboarding_completing) THEN
    NEW.subscription_status := 'trial';
    IF gated THEN
      NEW.trial_ends_at := now() + interval '30 days';
    ELSIF NEW.trial_ends_at IS NULL OR NEW.trial_ends_at > (now() + interval '15 days') THEN
      NEW.trial_ends_at := now() + interval '14 days';
    END IF;
    NEW.plan_expires_at := NULL;
    NEW.account_status := 'active';
    -- A fresh row never carries deletion or suspension state. Guarded on INSERT
    -- specifically: this branch also runs for the onboarding-completing UPDATE,
    -- and blanking there would let a suspended seller clear their own suspension
    -- by finishing onboarding.
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
    -- deleted_at is what purge-deleted-accounts runs on. Clearing it without
    -- clearing account_status is what stranded an account in both directions.
    IF NOT self_restoring AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      NEW.deleted_at := OLD.deleted_at;
    END IF;
    -- Suspension is set_account_suspended()'s to write, and the reason is shown
    -- to the seller verbatim. Neither is the suspended party's to edit.
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

-- Self-service restore inside the 30-day window. The panel used to write the
-- three columns directly, which this trigger reverts -- so the button did
-- nothing while still clearing deleted_at. The window check lives here, on the
-- server, because the client cannot be trusted with it.
create or replace function public.restore_my_account()
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_deleted_at timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'check_violation';
  end if;

  select account_status, deleted_at into v_status, v_deleted_at
    from profiles where id = v_uid;
  if not found then
    raise exception 'profile_not_found' using errcode = 'check_violation';
  end if;
  -- Nothing to restore is not an error -- the panel just reloads.
  if v_status is distinct from 'deleted' then
    return false;
  end if;
  -- A NULL deleted_at here is an account stranded by the old direct-write bug,
  -- not an expired one. Restoring it is the repair.
  if v_deleted_at is not null and v_deleted_at < now() - interval '30 days' then
    raise exception 'restore_window_expired' using errcode = 'check_violation';
  end if;

  perform set_config('app.allow_self_restore', 'on', true);
  update profiles
     set account_status = 'active', is_active = true, deleted_at = null
   where id = v_uid;
  return true;
end;
$$;

-- Supabase's default privileges grant EXECUTE on new public functions to anon
-- AND authenticated, and a revoke from PUBLIC does not touch the explicit anon
-- grant. Revoke it by name or this stays anon-callable.
revoke all on function public.restore_my_account() from public;
revoke all on function public.restore_my_account() from anon;
grant execute on function public.restore_my_account() to authenticated;

-- An invite code is a credential. Handing anon an oracle that turns a guessed
-- code into a dealer id is the same mistake as a share token checked by shape:
-- only a caller who already has an account has any business redeeming one.
-- Revoking from PUBLIC first, because anon inherits that grant and a revoke
-- from anon alone silently no-ops.
revoke all on function public.redeem_invite(text) from public;
revoke all on function public.redeem_invite(text) from anon;
grant execute on function public.redeem_invite(text) to authenticated;
