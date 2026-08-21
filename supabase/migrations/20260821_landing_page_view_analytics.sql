-- Add landing_page_view/landing_page_exit event types so ShiftOS marketing
-- page (/shiftos) and salesman landing page (/for-salesmen) visits can be
-- tracked distinctly from marketplace traffic (page_view/store_visit, which
-- feed get_marketplace_funnel). Both the table CHECK and the RLS insert
-- policy gate event_type independently (analytics_events_event_type_check +
-- analytics_insert_v2) -- both must be updated in lockstep or inserts fail
-- silently (trackEvent swallows errors by design).

ALTER TABLE public.analytics_events DROP CONSTRAINT analytics_events_event_type_check;
ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_event_type_check
  CHECK ((event_type = ANY (ARRAY[
    'link_visit'::text, 'car_view'::text, 'whatsapp_click'::text, 'call_click'::text,
    'page_view'::text, 'page_exit'::text, 'store_visit'::text, 'calculator_view'::text,
    'card_click'::text, 'booking_click'::text, 'share'::text, 'minipage_view'::text,
    'minipage_card_click'::text, 'pwa_installed'::text,
    'landing_page_view'::text, 'landing_page_exit'::text
  ])));

DROP POLICY analytics_insert_v2 ON public.analytics_events;
CREATE POLICY analytics_insert_v2 ON public.analytics_events
  FOR INSERT
  WITH CHECK (
    (event_type IS NOT NULL)
    AND (event_type = ANY (ARRAY[
      'page_view'::text, 'page_exit'::text, 'car_view'::text, 'store_visit'::text,
      'link_visit'::text, 'whatsapp_click'::text, 'call_click'::text, 'booking_click'::text,
      'share'::text, 'enquiry'::text, 'listing_view'::text, 'card_click'::text,
      'minipage_view'::text, 'minipage_card_click'::text, 'pwa_installed'::text,
      'landing_page_view'::text, 'landing_page_exit'::text
    ]))
    AND (session_id IS NOT NULL)
    AND (session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text)
    AND analytics_rate_limit_ok(session_id)
  );

-- Superadmin-guarded read RPC for XDrive Ops -> Funnel: visits + unique
-- sessions per marketing landing page, current range vs prior range.
CREATE OR REPLACE FUNCTION public.get_landing_page_visits(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_len interval;
  v_prev_from timestamptz;
  result jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;
  v_len := p_to - p_from;
  v_prev_from := p_from - v_len;

  with ev as (
    select page_path, session_id, created_at
    from analytics_events
    where event_type = 'landing_page_view'
      and page_path in ('/shiftos', '/for-salesmen')
      and created_at >= v_prev_from and created_at < p_to
  )
  select jsonb_build_object(
    'shiftos', jsonb_build_object(
      'visits', count(*) filter (where page_path = '/shiftos' and created_at >= p_from),
      'sessions', count(distinct session_id) filter (where page_path = '/shiftos' and created_at >= p_from),
      'prev_visits', count(*) filter (where page_path = '/shiftos' and created_at < p_from)
    ),
    'for_salesmen', jsonb_build_object(
      'visits', count(*) filter (where page_path = '/for-salesmen' and created_at >= p_from),
      'sessions', count(distinct session_id) filter (where page_path = '/for-salesmen' and created_at >= p_from),
      'prev_visits', count(*) filter (where page_path = '/for-salesmen' and created_at < p_from)
    )
  ) into result
  from ev;

  return result;
end;
$$;
