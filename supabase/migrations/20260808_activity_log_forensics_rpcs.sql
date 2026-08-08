-- Superadmin forensics readers for the Security console Activity Log panel.
-- Mirror the get_error_logs / get_error_summary convention: plpgsql, SECURITY DEFINER,
-- is_superadmin() hard-gate, return jsonb. Joins activity_log to auth.sessions (device
-- context, with the session's own ip/ua as fallback) and profiles (dealer name).

CREATE OR REPLACE FUNCTION public.get_activity_log(
  p_from timestamptz DEFAULT (now() - interval '7 days'),
  p_limit integer DEFAULT 300,
  p_dealer uuid DEFAULT NULL,
  p_actor uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_table text DEFAULT NULL,
  p_anomaly_only boolean DEFAULT false
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
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    from (
      select a.id, a.created_at, a.dealer_id,
             coalesce(d.dealership, d.full_name) as dealer_name,
             a.actor_id, a.actor_name, a.actor_role,
             a.table_name, a.record_id, a.action, a.summary, a.field_changes,
             a.is_anomaly, a.anomaly_reason,
             a.session_id,
             coalesce(a.ip, host(s.ip)) as ip,
             coalesce(a.user_agent, s.user_agent) as user_agent,
             s.created_at   as session_started_at,
             s.refreshed_at as session_last_seen,
             s.aal          as session_aal
      from activity_log a
      left join profiles d on d.id = a.dealer_id
      left join auth.sessions s on s.id = a.session_id
      where a.created_at >= p_from
        and (p_dealer is null or a.dealer_id = p_dealer)
        and (p_actor  is null or a.actor_id  = p_actor)
        and (p_action is null or a.action    = p_action)
        and (p_table  is null or a.table_name = p_table)
        and (not p_anomaly_only or a.is_anomaly is true)
      order by a.created_at desc
      limit least(coalesce(p_limit, 300), 1000)
    ) x
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_activity_summary(
  p_from timestamptz DEFAULT (now() - interval '7 days')
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

  return jsonb_build_object(
    'total',            (select count(*) from activity_log where created_at >= p_from),
    'total_24h',        (select count(*) from activity_log where created_at >= now() - interval '24 hours'),
    'anomalies',        (select count(*) from activity_log where created_at >= p_from and is_anomaly is true),
    'distinct_actors',  (select count(distinct actor_id) from activity_log where created_at >= p_from and actor_id is not null),
    'distinct_sessions',(select count(distinct session_id) from activity_log where created_at >= p_from and session_id is not null),
    'by_action', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select action, count(*) as count, max(created_at) as last_seen
        from activity_log where created_at >= p_from
        group by action order by count(*) desc limit 12
      ) x
    ),
    'by_table', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select table_name, count(*) as count
        from activity_log where created_at >= p_from
        group by table_name order by count(*) desc
      ) x
    ),
    'top_actors', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select actor_id,
               coalesce(max(actor_name), 'system') as actor_name,
               max(actor_role) as actor_role,
               count(*) as count
        from activity_log where created_at >= p_from
        group by actor_id order by count(*) desc limit 8
      ) x
    )
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.get_activity_log(timestamptz,integer,uuid,uuid,text,text,boolean) FROM anon;
REVOKE ALL ON FUNCTION public.get_activity_summary(timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_activity_log(timestamptz,integer,uuid,uuid,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_activity_summary(timestamptz) TO authenticated;
