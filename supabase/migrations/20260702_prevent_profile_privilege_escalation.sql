-- CRITICAL: prevent cross-tenant privilege escalation via self-writes to profiles.
--
-- The RLS write policy `users_upsert_own_profile_no_escalation` only blocked
-- self-promotion to `superadmin`; it did NOT stop a user from setting their own
-- role to another privileged team role (manager/admin/accountant/fi_officer) or
-- pointing `dealer_id` at another dealer's tenant. Because get_my_dealer_id()
-- returns profiles.dealer_id for those roles, that allowed full read/write access
-- to a victim dealership's data. (Victim dealer ids are public via
-- public_car_listings.dealer_id.)
--
-- Legitimate linked roles are created only by the service-role `invites` /
-- `create-salesman` edge functions and the handle_new_user auth trigger — all of
-- which run with no end-user auth.uid(), so they bypass this guard.

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Bypass for non end-user contexts (auth stub trigger + service-role admin
  -- functions have no auth.uid()) and for superadmins.
  IF auth.uid() IS NULL OR is_superadmin() THEN
    RETURN NEW;
  END IF;

  -- Privileged team roles are invite-only; a user may never self-assign one.
  IF NEW.role IN ('manager','admin','accountant','fi_officer','superadmin')
     AND (TG_OP = 'INSERT' OR NEW.role IS DISTINCT FROM OLD.role) THEN
    RAISE EXCEPTION 'not allowed to assign role: %', NEW.role
      USING ERRCODE = 'check_violation';
  END IF;

  -- A user may only belong to their own tenant. dealer_id NULL = owns self;
  -- linking to another dealer's id is done only by the service-role invite flow.
  IF NEW.dealer_id IS NOT NULL AND NEW.dealer_id <> NEW.id
     AND (TG_OP = 'INSERT' OR NEW.dealer_id IS DISTINCT FROM OLD.dealer_id) THEN
    RAISE EXCEPTION 'not allowed to change tenant (dealer_id)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();
