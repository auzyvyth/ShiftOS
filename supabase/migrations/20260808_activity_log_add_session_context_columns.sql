-- Forensics defect 1: tie each logged action to a login session + device.
-- session_id is the PK of auth.sessions (carried in every access token's JWT claim),
-- so activity_log.session_id joins directly to auth.sessions for who/where/which-device.
ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS ip         text,
  ADD COLUMN IF NOT EXISTS user_agent text;

COMMENT ON COLUMN public.activity_log.session_id IS 'auth.sessions.id of the acting session (from JWT session_id claim); NULL for system/service-role writes';
COMMENT ON COLUMN public.activity_log.ip         IS 'x-forwarded-for at write time (request header)';
COMMENT ON COLUMN public.activity_log.user_agent IS 'user-agent at write time (request header)';
