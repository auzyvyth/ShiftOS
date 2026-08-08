-- Single BEFORE INSERT trigger populates session/device context and normalises
-- the null-actor case for EVERY write path (client logActivity() inserts AND the
-- SECURITY DEFINER trigger/RPC inserts), so we don't have to edit each writer fn.
-- Reads PostgREST request GUCs, which are set per-request regardless of the
-- SECURITY DEFINER role switch. All extractions are NULL-safe when GUCs are absent
-- (service-role / cron / cascade), so the trigger can never raise and break the insert.
CREATE OR REPLACE FUNCTION public.stamp_activity_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $$
BEGIN
  IF NEW.session_id IS NULL THEN
    NEW.session_id := nullif(auth.jwt() ->> 'session_id','')::uuid;
  END IF;
  IF NEW.ip IS NULL THEN
    NEW.ip := split_part(
      nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for',
      ',', 1);
    NEW.ip := nullif(btrim(NEW.ip), '');
  END IF;
  IF NEW.user_agent IS NULL THEN
    NEW.user_agent := nullif(current_setting('request.headers', true), '')::json ->> 'user-agent';
  END IF;
  -- Forensics defect 3: distinguish "system-initiated" from "unknown actor".
  IF NEW.actor_id IS NULL AND NEW.actor_role IS NULL THEN
    NEW.actor_role := 'system';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_activity_context ON public.activity_log;
CREATE TRIGGER trg_stamp_activity_context
  BEFORE INSERT ON public.activity_log
  FOR EACH ROW EXECUTE FUNCTION public.stamp_activity_context();

-- Backfill: label existing unattributed rows as system (tight scope: only where
-- BOTH actor id and role are absent, so nothing already attributed is touched).
UPDATE public.activity_log
   SET actor_role = 'system'
 WHERE actor_id IS NULL AND actor_role IS NULL;
