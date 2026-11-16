-- The daily team-health push opens Team, not Analytics > Performance (plan step 4c, 2026-11-16).
-- "How each salesman is doing" moved from Performance (now "Traffic", website only) to the Team tab
-- (src/pages/dashboard/TeamScoreboard.jsx). The only change below is the link_to literal: the body
-- is copied from the live function (pg_get_functiondef, 2026-11-16). One overload exists
-- (notify_team_health()), same signature, so CREATE OR REPLACE replaces it.
-- QUEUED: apply after midnight Malaysia time, when nobody is live.

CREATE OR REPLACE FUNCTION public.notify_team_health()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  d record;
  r jsonb;
  v_kinds text[];
  v_lines text[];
  v_new int;
  v_kind text;
  v_name text;
begin
  for d in
    select distinct p.dealer_id as id
      from public.profiles p
      join public.profiles dl on dl.id = p.dealer_id
     where p.role = 'salesman' and p.dealer_id is not null and coalesce(p.is_active, true)
       and dl.role in ('dealer', 'owner') and coalesce(dl.is_active, true)
       and coalesce(dl.account_status, 'active') <> 'deleted'
  loop
    v_lines := '{}';
    v_new := 0;
    for r in select * from jsonb_array_elements(public._team_health(d.id)) loop
      v_name := coalesce(nullif(r->>'name', ''), 'A salesman');
      v_kinds := array_remove(array[
        case when r->>'status' in ('inactive', 'never') then r->>'status' end,
        case when (r->>'untouched')::int > 0 then 'untouched' end
      ], null);

      delete from public.team_health_alerts a
       where a.salesman_id = (r->>'id')::uuid and not (a.kind = any(v_kinds));

      foreach v_kind in array v_kinds loop
        insert into public.team_health_alerts (salesman_id, kind, dealer_id)
        values ((r->>'id')::uuid, v_kind, d.id)
        on conflict (salesman_id, kind) do nothing;

        if exists (select 1 from public.team_health_alerts a
                    where a.salesman_id = (r->>'id')::uuid and a.kind = v_kind
                      and (a.last_notified is null or a.last_notified < now() - interval '7 days')) then
          v_new := v_new + 1;
          v_lines := v_lines || case v_kind
            when 'inactive' then v_name || ': no activity for ' || (r->>'days_quiet') || ' days'
            when 'never' then v_name || ': has not started using the app'
            else v_name || ': ' || (r->>'untouched') || ' lead' ||
                 case when (r->>'untouched')::int = 1 then '' else 's' end || ' with no follow-up'
          end;
          update public.team_health_alerts set last_notified = now()
           where salesman_id = (r->>'id')::uuid and kind = v_kind;
        end if;
      end loop;
    end loop;

    if v_new > 0 then
      insert into public.dealer_notifications (dealer_id, type, title, body, link_to)
      values (
        d.id, 'team_health',
        case when v_new = 1 then 'Your team: 1 thing needs attention'
             else 'Your team: ' || v_new || ' things need attention' end,
        array_to_string(v_lines[1:4], E'\n') ||
          case when array_length(v_lines, 1) > 4 then E'\n+' || (array_length(v_lines, 1) - 4) || ' more' else '' end,
        '/dashboard/team'
      );
    end if;
  end loop;
end;
$function$;
