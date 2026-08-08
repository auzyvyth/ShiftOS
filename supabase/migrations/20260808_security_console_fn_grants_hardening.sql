-- CREATE FUNCTION grants EXECUTE to PUBLIC by default; revoking from anon alone
-- leaves that inherited grant. Strip PUBLIC so only authenticated superadmins reach
-- the readers (the is_superadmin() body gate is the real guard; this removes the
-- executable-by-anon surface + advisor warnings). The trigger function is never an
-- RPC — revoke execute from everyone.
REVOKE ALL ON FUNCTION public.get_activity_log(timestamptz,integer,uuid,uuid,text,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_activity_summary(timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_active_sessions(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_security_posture() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_activity_log(timestamptz,integer,uuid,uuid,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_activity_summary(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_sessions(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_security_posture() TO authenticated;

REVOKE ALL ON FUNCTION public.stamp_activity_context() FROM PUBLIC, anon, authenticated;
