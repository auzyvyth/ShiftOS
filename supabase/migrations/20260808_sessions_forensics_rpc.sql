-- Superadmin reader for the Security console Sessions panel. auth.sessions holds
-- current (non-expired) login sessions with device/ip. Enriched with each session's
-- logged-action count so a session ties to what it actually did (activity_log.session_id).
CREATE OR REPLACE FUNCTION public.get_active_sessions(
  p_limit integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.last_seen desc nulls last), '[]'::jsonb)
    from (
      select s.id,
             s.user_id,
             coalesce(p.full_name, p.dealership, u.email) as user_name,
             u.email as user_email,
             p.role  as user_role,
             coalesce(dp.dealership, dp.full_name) as dealer_name,
             s.created_at,
             s.refreshed_at as last_seen,
             s.not_after,
             (s.not_after is not null and s.not_after < now()) as expired,
             s.aal::text as aal,
             s.user_agent,
             host(s.ip) as ip,
             (select count(*) from activity_log a where a.session_id = s.id) as action_count,
             (select max(a.created_at) from activity_log a where a.session_id = s.id) as last_action_at
      from auth.sessions s
      left join auth.users u on u.id = s.user_id
      left join profiles p on p.id = s.user_id
      left join profiles dp on dp.id = coalesce(p.dealer_id, p.id)
      order by s.refreshed_at desc nulls last
      limit least(coalesce(p_limit, 300), 1000)
    ) x
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.get_active_sessions(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_active_sessions(integer) TO authenticated;
