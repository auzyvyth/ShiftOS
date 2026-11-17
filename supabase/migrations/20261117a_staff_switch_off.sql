-- DASH-TEST 3 (2026-11-17): the owner can switch a staff member off, and off means OFF.
--
-- Before: Team's Switch off did `update profiles set is_active` from the browser. The only
-- UPDATE rules on profiles are "your own row" and "superadmin", so it changed 0 rows. Even
-- had it worked, get_my_dealer_id() ignored is_active, so a switched-off manager kept reading
-- every table scoped by `dealer_id = get_my_dealer_id()`. And prevent_profile_privilege_escalation
-- silently refuses false -> true, so nobody could be switched back on.
--
-- 1. dealer_set_staff_active(p_staff, p_active): the dealer/owner of that staff member only.
-- 2. prevent_profile_privilege_escalation: re-created VERBATIM except one line, the switch-on
--    is allowed when app.staff_toggle names this row (set only inside the function above,
--    same pattern as app.allow_self_restore / app.allow_tenant_move). A browser cannot set it.
-- 3. get_my_dealer_id(): a LINKED staff member who is switched off (is_active = false) or
--    deleted resolves to NULL, so every dealer-scoped rule shuts them out at once. Dealers,
--    owners, superadmins and standalone sellers are unchanged. The browser copy,
--    getDealerIdFromProfile (src/hooks/useProfile.js), mirrors this.
--    Checked 2026-11-17: all 7 linked staff live have is_active = true, so this locks nobody out.
--
-- APPLIED 2026-11-17 ~09:50 UTC (owner: "do the migration now", nobody live). Probed in a rolled-back
-- transaction: owner switches a staff member off -> their get_my_dealer_id() is NULL; back on
-- -> it is the dealer again; a manager calling it gets 'forbidden'; another dealer's staff
-- gets 'not_your_staff'.

begin;

create or replace function public.dealer_set_staff_active(p_staff uuid, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_me    uuid := auth.uid();
  v_role  text;
  v_staff profiles%rowtype;
begin
  if v_me is null then raise exception 'unauthorized'; end if;
  if p_active is null then raise exception 'bad_value'; end if;
  select role into v_role from profiles where id = v_me;
  -- Owner-only (CLAUDE.md: switching staff on/off is never a manager switch).
  if coalesce(v_role, '') not in ('dealer', 'owner') then raise exception 'forbidden'; end if;
  select * into v_staff from profiles where id = p_staff for update;
  if not found
     or v_staff.dealer_id is distinct from v_me
     or v_staff.role not in ('salesman', 'manager', 'admin', 'accountant', 'fi_officer') then
    raise exception 'not_your_staff';
  end if;
  -- The platform's suspension and a deleted account are not the owner's to undo.
  if v_staff.suspended_at is not null then raise exception 'platform_suspended'; end if;
  if v_staff.account_status = 'deleted' then raise exception 'account_deleted'; end if;
  if coalesce(v_staff.is_active, true) = p_active then
    return jsonb_build_object('is_active', p_active, 'changed', false);
  end if;
  perform set_config('app.staff_toggle', p_staff::text, true);
  update profiles set is_active = p_active where id = p_staff;
  perform set_config('app.staff_toggle', '', true);
  return jsonb_build_object('is_active', p_active, 'changed', true);
end;
$$;

revoke all on function public.dealer_set_staff_active(uuid, boolean) from public;
revoke all on function public.dealer_set_staff_active(uuid, boolean) from anon;
grant execute on function public.dealer_set_staff_active(uuid, boolean) to authenticated;

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
  self_restoring boolean;
  staff_toggle boolean;
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

  -- DASH-TEST 3: the dealer switching their own staff member back on. Set only inside
  -- dealer_set_staff_active (which checks it is the owner's staff), for that one row.
  staff_toggle := TG_OP = 'UPDATE'
    AND COALESCE(current_setting('app.staff_toggle', true), '') = NEW.id::text
    AND NEW.dealer_id = auth.uid()
    AND OLD.suspended_at IS NULL;

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
    IF NOT self_restoring AND NOT staff_toggle AND NEW.is_active = true AND OLD.is_active = false THEN
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

CREATE OR REPLACE FUNCTION public.get_my_dealer_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN role IN ('dealer','superadmin','owner') THEN id
    WHEN role = 'salesman' AND dealer_id IS NULL THEN id
    -- A linked staff member the owner switched off (or a deleted one) belongs to no dealer.
    WHEN is_active IS FALSE OR account_status = 'deleted' THEN NULL
    ELSE dealer_id
  END
  FROM profiles WHERE id = auth.uid() LIMIT 1;
$function$;

commit;
