-- Fix Salesman Lite "Traffic Sources" counts drifting DOWN day-over-day.
--
-- Root cause: get_salesman_channel_breakdown counted raw, all-time events for a
-- car-id set that the frontend derived from get_salesman_analytics — a rolling
-- 30-day window. When a car's last view aged past 30 days it dropped out of that
-- set and took all of its historical "direct" views with it, so the total fell
-- even though no real visits were lost (the reported 67 -> 65).
--
-- Two fixes here, both backward compatible (same signature + return shape):
--   1) Session-DEDUPED (DISTINCT ON car_id+session) so the breakdown reconciles
--      with the headline "views" KPI (get_salesman_analytics is also deduped).
--   2) p_car_ids is now OPTIONAL: NULL or an empty array counts across ALL of the
--      slug's cars (all-time, stable, only grows). Callers passing a concrete id
--      list keep the old scoping. The Lite panel now passes NULL.

CREATE OR REPLACE FUNCTION public.get_salesman_channel_breakdown(p_car_ids uuid[], p_slug text)
 RETURNS TABLE(car_id uuid, channel text, views bigint, enquiries bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      ae.car_id,
      COALESCE(NULLIF(ae.metadata->>'channel',''), 'direct') AS channel,
      ae.event_type,
      COALESCE(ae.session_id, ae.id::text) AS sess
    FROM analytics_events ae
    WHERE ae.salesman_slug = p_slug
      AND ae.car_id IS NOT NULL
      AND (p_car_ids IS NULL OR array_length(p_car_ids, 1) IS NULL OR ae.car_id = ANY(p_car_ids))
      AND ae.event_type IN ('car_view','link_visit','whatsapp_click','call_click')
  ),
  dedup_views AS (
    SELECT DISTINCT ON (car_id, sess) car_id, channel
    FROM base
    WHERE event_type IN ('car_view','link_visit')
    ORDER BY car_id, sess, channel
  ),
  dedup_enq AS (
    SELECT DISTINCT ON (car_id, sess) car_id, channel
    FROM base
    WHERE event_type IN ('whatsapp_click','call_click')
    ORDER BY car_id, sess, channel
  ),
  v AS (
    SELECT car_id, channel, COUNT(*)::bigint AS views
    FROM dedup_views GROUP BY car_id, channel
  ),
  e AS (
    SELECT car_id, channel, COUNT(*)::bigint AS enquiries
    FROM dedup_enq GROUP BY car_id, channel
  )
  SELECT
    COALESCE(v.car_id, e.car_id) AS car_id,
    COALESCE(v.channel, e.channel) AS channel,
    COALESCE(v.views, 0)::bigint AS views,
    COALESCE(e.enquiries, 0)::bigint AS enquiries
  FROM v
  FULL OUTER JOIN e ON e.car_id = v.car_id AND e.channel = v.channel;
$function$;
