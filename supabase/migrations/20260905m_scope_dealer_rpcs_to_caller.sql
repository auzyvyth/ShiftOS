-- Three more "the argument names the subject, so the argument IS the check"
-- functions, this time granted to `authenticated` rather than anon. That is not
-- a boundary on this project: anonymous sign-in gives guest buyers the
-- `authenticated` role, so anyone who opens a chat on the marketplace can call
-- these. Each one now derives the caller's own dealer scope the way
-- get_dealer_car_analytics already does, and refuses anything else.

-- 1. get_plan_usage(p_dealer_id) returned ANY dealer's plan, price, listing and
--    seat caps, active listing count, seat count and HP submissions this month.
--    That is a competitor's whole commercial position, and their usage against
--    the caps we sell them. Callers (DashboardPage.jsx:1100) already pass their
--    own dealer id.
create or replace function public.get_plan_usage(p_dealer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if auth.uid() is null
     or not (p_dealer_id = auth.uid()
             or p_dealer_id = public.get_my_dealer_id()
             or public.is_superadmin()) then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'plan',               p.plan,
    'label',              pc.label,
    'price_myr',          pc.price_myr,
    'listing_cap',        pc.listing_cap,
    'seat_cap',           pc.seat_cap,
    'trial_ends_at',      p.trial_ends_at,
    'active_listings', (
      SELECT COUNT(*) FROM car_listings
      WHERE dealer_id = p_dealer_id
      AND status NOT IN ('sold', 'archived')
    ),
    'seat_count', (
      SELECT COUNT(*) FROM profiles
      WHERE dealer_id = p_dealer_id
      AND is_active = true
    ),
    'hp_submissions_mtd', (
      SELECT COUNT(*) FROM deal_financing
      WHERE dealer_id = p_dealer_id
      AND submitted_at >= date_trunc('month', now())
    )
  ) INTO result
  FROM profiles p
  JOIN plan_config pc ON pc.plan = p.plan::text
  WHERE p.id = p_dealer_id;

  return result;
end;
$$;

revoke all on function public.get_plan_usage(uuid) from public, anon;
grant execute on function public.get_plan_usage(uuid) to authenticated;

-- 2. get_dealer_slug_analytics(p_dealer_id, p_days) returned per-salesman link
--    clicks and WhatsApp taps for ANY dealer — the same leak get_car_analytics
--    had, one level up. Every caller (PerformanceTab.jsx:167,
--    DashboardPage.jsx:3080 and :4309) passes the same dealerId it hands
--    get_dealer_car_analytics on the adjacent line, and that function already
--    enforces exactly this guard, so the check is compatible by construction.
create or replace function public.get_dealer_slug_analytics(p_dealer_id uuid, p_days integer default 90)
returns table (slug text, clicks bigint, whatsapp bigint)
language sql
stable
security definer
set search_path = public
as $$
  WITH guard AS (
    SELECT auth.uid() IS NOT NULL
       AND (auth.uid() = p_dealer_id
            OR get_my_dealer_id() = p_dealer_id
            OR is_superadmin()) AS ok
  )
  SELECT
    ae.salesman_slug AS slug,
    COUNT(*) FILTER (WHERE ae.event_type IN ('link_visit', 'car_view')) AS clicks,
    COUNT(*) FILTER (WHERE ae.event_type = 'whatsapp_click') AS whatsapp
  FROM analytics_events ae, guard
  WHERE guard.ok
    AND ae.salesman_slug IS NOT NULL
    AND ae.dealer_id = p_dealer_id
    AND ae.created_at >= now() - (p_days || ' days')::interval
  GROUP BY ae.salesman_slug;
$$;

revoke all on function public.get_dealer_slug_analytics(uuid, integer) from public, anon;
grant execute on function public.get_dealer_slug_analytics(uuid, integer) to authenticated;

-- 3. record_ai_request bumps a dealer's shared daily AI counter and writes the
--    per-feature log row. Unguarded, any signed-in account could burn any
--    dealer's 400/day pool to zero, or poison their usage log. It is the only
--    thing standing between a dealer and an unbounded Anthropic bill, so it has
--    to be the caller's own row.
--
--    The scope expression mirrors ai-proxy's resolveDealerId exactly
--    (dealer/owner/superadmin own their pool; every sub-role shares the
--    parent's), which is what get_my_dealer_id() already computes.
create or replace function public.record_ai_request(
  p_dealer_id uuid, p_user_id uuid, p_role text,
  p_feature text, p_model text, p_max_tokens integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    raise exception 'not authorized';
  end if;
  if not (p_dealer_id = auth.uid()
          or p_dealer_id = public.get_my_dealer_id()
          or public.is_superadmin()) then
    raise exception 'not authorized';
  end if;

  insert into ai_usage (dealer_id, date, count)
  values (p_dealer_id, current_date, 1)
  on conflict (dealer_id, date)
  do update set count = ai_usage.count + 1, updated_at = now()
  returning count into v_count;

  insert into ai_request_log (dealer_id, user_id, role, feature, model, max_tokens)
  values (p_dealer_id, p_user_id, p_role, p_feature, p_model, p_max_tokens);

  return v_count;
end;
$$;

revoke all on function public.record_ai_request(uuid, uuid, text, text, text, integer) from public, anon;
grant execute on function public.record_ai_request(uuid, uuid, text, text, text, integer) to authenticated;
