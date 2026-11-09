-- TEAM-HEALTH (owner, 2026-11-09): the dealer's view of a linked salesman must
-- READ the numbers, not just add them up, and tell the owner when someone has
-- gone quiet or is sitting on leads.
--
-- Why: gm_salesman_scores showed salesman `diara` (dealer XDRIVE) at 90 / 100
-- although she had not signed in or done anything for 45 days. The score:
--   * credited her with work the DEALER did: the dealer created a walk-in lead,
--     assigned it to her and won it on 2026-11-08 (1 lead, 1 win = 100%
--     conversion), and "response time" was measured to the first activity by
--     ANYONE (the automatic 'created' row, 2 seconds later);
--   * gave 10 free points for simply having a lead;
--   * scored a single lead as if it were a pattern;
--   * had no idea of inactivity at all.
--
-- Now (one set of rules, used by the dashboard AND the daily alert):
--   * activity = the salesman's OWN actions (lead activities they logged, chat
--     replies they sent, actions in activity_log), never someone else's edits.
--   * status: active (acted in the last 7 days), quiet (7-13 days), inactive
--     (14+ days), never (account 7+ days old, no action ever), new.
--   * no score when inactive / never / new, or under 3 leads in 30 days:
--     the screen says why instead of a number.
--   * reply time = median time to the salesman's OWN first follow-up
--     (not the automatic 'created' / 'assigned' rows).
--   * "untouched" = open leads 48h+ old the salesman never followed up.
--   * won = leads moved to won in the last 30 days (not "created in 30 days").
--   * score weights: conversion 35, reply time 25, follow-through 20,
--     gross 10, documents 10. No free points.
--
-- Daily alert (09:00 Malaysia): one dealer_notifications row per dealer that
-- has something NEW to say (a salesman went inactive / never started, or has
-- leads nobody followed up). That row is the push (trg_push_on_dealer_notification).
-- The same issue is repeated at most once a week while it lasts, and forgotten
-- when it clears. Rule-based on purpose: no AI, nothing invented.
--
-- QUEUED: apply after midnight MYT with nobody live (CLAUDE.md DB migrations).

begin;

-- ── 1. The rules, once. Internal: never callable by a client. ───────────────
create or replace function public._team_health(p_dealer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $fn$
  with reps as (
    select p.id, p.full_name, p.avatar_url, p.created_at
      from public.profiles p
     where p.role = 'salesman' and (p.dealer_id = p_dealer_id or p.id = p_dealer_id)
       and coalesce(p.is_active, true)
       and coalesce(p.account_status, 'active') <> 'deleted'
  ),
  own_events as (
    select la.created_by as uid, la.created_at as at from public.lead_activities la
     where la.dealer_id = p_dealer_id and la.created_by in (select id from reps)
    union all
    select m.sender_id, m.created_at from public.chat_messages m
      join public.chat_threads t on t.id = m.thread_id
     where t.dealer_id = p_dealer_id and m.sender_role = 'seller' and m.sender_id in (select id from reps)
    union all
    select a.actor_id, a.created_at from public.activity_log a
     where a.dealer_id = p_dealer_id and a.actor_id in (select id from reps)
  ),
  last_seen as (
    select uid, max(at) as last_at,
           count(*) filter (where at > now() - interval '30 days') as actions_30d
      from own_events group by uid
  ),
  my_leads as (
    select l.id, coalesce(l.salesman_id, l.assigned_to) as rep, l.stage, l.created_at, l.car_listing_id
      from public.leads l
     where l.dealer_id = p_dealer_id and coalesce(l.is_deleted, false) = false
       and coalesce(l.salesman_id, l.assigned_to) in (select id from reps)
  ),
  first_touch as (
    select ml.id, min(la.created_at) as at
      from my_leads ml
      join public.lead_activities la on la.lead_id = ml.id and la.created_by = ml.rep
       and la.activity_type not in ('created', 'assigned')
     group by ml.id
  ),
  per_rep as (
    select r.id, r.full_name, r.avatar_url, r.created_at,
      ls.last_at, coalesce(ls.actions_30d, 0) as actions_30d,
      (select count(*) from my_leads ml
        where ml.rep = r.id and ml.created_at > now() - interval '30 days') as leads_30d,
      (select count(*) from my_leads ml join first_touch ft on ft.id = ml.id
        where ml.rep = r.id and ml.created_at > now() - interval '30 days') as worked_30d,
      (select count(distinct la.lead_id) from public.lead_activities la join my_leads ml on ml.id = la.lead_id
        where ml.rep = r.id and la.activity_type = 'stage_changed' and la.to_stage in ('won', 'closed_won')
          and ml.stage in ('won', 'closed_won') and la.created_at > now() - interval '30 days') as won_30d,
      (select percentile_cont(0.5) within group (order by extract(epoch from (ft.at - ml.created_at)) / 60)
         from my_leads ml join first_touch ft on ft.id = ml.id
        where ml.rep = r.id and ml.created_at > now() - interval '30 days' and ft.at >= ml.created_at) as reply_min,
      (select count(*) from my_leads ml
        where ml.rep = r.id and ml.stage not in ('won', 'closed_won', 'lost', 'closed_lost')
          and ml.created_at < now() - interval '48 hours'
          and not exists (select 1 from first_touch ft where ft.id = ml.id)) as untouched,
      (select avg(su.sold_price - coalesce(su.purchase_price, 0) - coalesce(su.recon_cost, 0))
         from my_leads ml join public.stock_units su on su.listing_id = ml.car_listing_id
        where ml.rep = r.id and ml.stage in ('won', 'closed_won') and su.status = 'sold'
          and su.sold_date >= now() - interval '30 days') as avg_gp,
      (select avg((select count(*) from jsonb_object_keys(coalesce(df.hp_docs, '{}'::jsonb)) k
                    where (df.hp_docs->>k)::boolean) / 8.0)
         from public.deal_financing df join my_leads ml on ml.id = df.lead_id
        where ml.rep = r.id and df.created_at >= now() - interval '30 days') as doc_rate
    from reps r left join last_seen ls on ls.uid = r.id
  ),
  judged as (
    select pr.*,
      case when pr.last_at is null then null
           else floor(extract(epoch from now() - pr.last_at) / 86400)::int end as days_quiet,
      case
        when pr.last_at is null and pr.created_at < now() - interval '7 days' then 'never'
        when pr.last_at is null then 'new'
        when pr.last_at < now() - interval '14 days' then 'inactive'
        when pr.last_at < now() - interval '7 days' then 'quiet'
        else 'active' end as status
    from per_rep pr
  ),
  -- Points per part, so the screen can show how a score was made (never
  -- re-computed in the app). Only meaningful when there is a score.
  parts as (
    select j.*,
      case when j.leads_30d > 0 then round((j.won_30d::numeric / j.leads_30d) * 35, 1) else 0 end as pt_conv,
      round((case when j.reply_min is null then 0 when j.reply_min <= 15 then 100
                  when j.reply_min >= 240 then 0
                  else 100 - (j.reply_min - 15) * (100.0 / 225.0) end)::numeric * 0.25, 1) as pt_reply,
      case when j.leads_30d > 0 then round((j.worked_30d::numeric / j.leads_30d) * 20, 1) else 0 end as pt_follow,
      round((least(100, coalesce(j.avg_gp, 0) / 50) * 0.10)::numeric, 1) as pt_gross,
      round((coalesce(j.doc_rate, 0) * 10)::numeric, 1) as pt_docs
    from judged j
  ),
  scored as (
    select p.*,
      case when p.status in ('never', 'inactive', 'new') or p.leads_30d < 3 then null
      else least(100, round(p.pt_conv + p.pt_reply + p.pt_follow + p.pt_gross + p.pt_docs))::int end as score
    from parts p
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'name', s.full_name,
      'avatar_url', s.avatar_url,
      'status', s.status,
      'last_active_at', s.last_at,
      'days_quiet', s.days_quiet,
      'actions_30d', s.actions_30d,
      'leads_30d', s.leads_30d,
      'worked_30d', s.worked_30d,
      'won_30d', s.won_30d,
      'untouched', s.untouched,
      'conv_rate', case when s.leads_30d > 0 then round((s.won_30d::numeric / s.leads_30d) * 100, 1) end,
      'avg_response_min', case when s.reply_min is not null then round(s.reply_min::numeric, 0) end,
      'avg_gp', case when s.avg_gp is not null then round(s.avg_gp::numeric, 0) end,
      'doc_rate_pct', case when s.doc_rate is not null then round(s.doc_rate::numeric * 100, 0) end,
      'score', s.score,
      'score_parts', case when s.score is not null then jsonb_build_object(
        'conversion', s.pt_conv, 'reply', s.pt_reply, 'follow_through', s.pt_follow,
        'gross', s.pt_gross, 'docs', s.pt_docs) end,
      -- What needs the owner's attention, worst first. Codes only; the words
      -- live in the app (src/utils/teamHealth.js).
      'issues', to_jsonb(array_remove(array[
        case when s.status in ('inactive', 'never') then s.status end,
        case when s.status = 'quiet' then 'quiet' end,
        case when s.untouched > 0 then 'untouched' end,
        case when s.reply_min > 120 then 'slow_reply' end,
        case when s.leads_30d >= 3 and s.worked_30d::numeric / s.leads_30d < 0.5 then 'low_follow_through' end,
        case when s.leads_30d >= 8 and s.won_30d = 0 then 'no_sales' end
      ], null))
    ) order by
      case s.status when 'active' then 0 when 'quiet' then 1 when 'new' then 2 else 3 end,
      s.score desc nulls last, s.full_name), '[]'::jsonb)
  from scored s;
$fn$;

revoke all on function public._team_health(uuid) from public, anon, authenticated;

-- ── 2. What the dashboard calls (same name + signature, so no drift). ───────
create or replace function public.gm_salesman_scores(p_dealer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $fn$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;
  if not (auth.uid() = p_dealer_id or public.get_my_dealer_id() = p_dealer_id or public.is_superadmin()) then
    raise exception 'Forbidden';
  end if;
  return public._team_health(p_dealer_id);
end;
$fn$;

-- ── 3. The daily alert. ─────────────────────────────────────────────────────
create table if not exists public.team_health_alerts (
  salesman_id   uuid not null references public.profiles(id) on delete cascade,
  kind          text not null,
  dealer_id     uuid not null,
  first_seen    timestamptz not null default now(),
  last_notified timestamptz,
  primary key (salesman_id, kind)
);
alter table public.team_health_alerts enable row level security;
-- No policies: only the definer function below touches it.

create or replace function public.notify_team_health()
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $fn$
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

      -- Forget what has cleared, so it alerts again if it comes back.
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
        '/dashboard/analytics?sub=performance'
      );
    end if;
  end loop;
end;
$fn$;

revoke all on function public.notify_team_health() from public, anon, authenticated;

-- ── 4. A lead given to a salesman is THEIR lead (salesman_id), not just
--       "assigned_to". The dealer's Add lead form wrote only assigned_to, so the
--       linked salesman's panel (reads salesman_id) never showed it: 4 leads,
--       2 of them won deals. Fill the blank; never overwrite a set salesman_id.
--       Also: a lead can only name a salesman on ITS OWN dealer's team (DMS
--       audit rule 4: a row's own ids prove nothing). Checked 2026-11-09: 0
--       existing rows break this, so it cannot block current data.
create or replace function public.lead_salesman_from_assigned()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $fn$
begin
  if new.dealer_id is not null then
    if new.salesman_id is not null and not exists (
         select 1 from public.profiles p
          where p.id = new.salesman_id and (p.id = new.dealer_id or p.dealer_id = new.dealer_id)) then
      raise exception 'salesman_not_on_team' using errcode = 'P0001',
        hint = 'That salesman is not on this dealership''s team.';
    end if;
    if new.assigned_to is not null and not exists (
         select 1 from public.profiles p
          where p.id = new.assigned_to and (p.id = new.dealer_id or p.dealer_id = new.dealer_id)) then
      raise exception 'salesman_not_on_team' using errcode = 'P0001',
        hint = 'That salesman is not on this dealership''s team.';
    end if;
  end if;
  if new.salesman_id is null and new.assigned_to is not null
     and exists (select 1 from public.profiles p
                  where p.id = new.assigned_to and p.role = 'salesman'
                    and (p.dealer_id = new.dealer_id or p.id = new.dealer_id)) then
    new.salesman_id := new.assigned_to;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_lead_salesman_from_assigned on public.leads;
create trigger trg_lead_salesman_from_assigned
  before insert or update of assigned_to, salesman_id, dealer_id on public.leads
  for each row execute function public.lead_salesman_from_assigned();

update public.leads l set salesman_id = l.assigned_to
  from public.profiles p
 where l.salesman_id is null and l.assigned_to = p.id and p.role = 'salesman'
   and (p.dealer_id = l.dealer_id or p.id = l.dealer_id);

-- 01:00 UTC = 09:00 Malaysia. Minute 0 (IO-5: frequent jobs only on :00/:15/:30/:45).
-- Guarded: nothing runs when no dealer has a linked salesman.
select cron.schedule('team-health-daily', '0 1 * * *', $c$
  select public.notify_team_health()
   where exists (select 1 from public.profiles
                  where role = 'salesman' and dealer_id is not null and coalesce(is_active, true));
$c$);

commit;
