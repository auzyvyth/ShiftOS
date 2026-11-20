-- MET-1 (2026-11-20, QUEUED for the after-midnight slot): analytics_events has a
-- CHECK on event_type, so /api/track rows with a new type are refused by the DB
-- (the API swallows the error, nothing breaks, nothing is stored).
-- Adds: search_run, listing_impressions, signin_prompt, signin_done, car_saved.
-- Also adds 'enquiry' and 'listing_view': lib/analyticsEvent.js has accepted them
-- since ANALYTICS-SPOOF but the CHECK never listed them, so those were dropped too.
-- Also adds get_marketplace_search(): the console Funnel tab's search / impression /
-- sign-in-wall numbers (superadmin only, same guard as get_marketplace_top).
-- Table is small, so the check is validated in the same transaction.
begin;
alter table public.analytics_events drop constraint analytics_events_event_type_check;
alter table public.analytics_events add constraint analytics_events_event_type_check
  check (event_type = any (array[
    'link_visit','car_view','whatsapp_click','call_click','page_view','page_exit','store_visit',
    'calculator_view','card_click','booking_click','share','minipage_view','minipage_card_click',
    'pwa_installed','landing_page_view','landing_page_exit',
    'enquiry','listing_view',
    'search_run','listing_impressions','signin_prompt','signin_done','car_saved'
  ]));

create or replace function public.get_marketplace_search(p_from timestamptz, p_to timestamptz, p_limit int default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_span interval := p_to - p_from;
begin
  if not public.is_superadmin() then
    raise exception 'not authorized';
  end if;

  return (
    with cur as (
      select event_type, metadata from analytics_events
      where created_at >= p_from and created_at < p_to
        and event_type in ('search_run','listing_impressions','card_click','signin_prompt','signin_done','car_saved')
    ),
    prev as (
      select event_type, metadata from analytics_events
      where created_at >= p_from - v_span and created_at < p_from
        and event_type in ('search_run','listing_impressions','card_click','signin_prompt','signin_done','car_saved')
    ),
    labelled as (
      select coalesce(nullif(metadata->>'q',''),
               (select string_agg(x, ' + ') from jsonb_array_elements_text(
                  case when jsonb_typeof(metadata->'filters') = 'array' then metadata->'filters' else '[]'::jsonb end) x)
             ) as label,
             (metadata->>'results') = '0' as no_match
      from cur
      where event_type = 'search_run' and coalesce(metadata->>'surface','marketplace') = 'marketplace'
    )
    select jsonb_build_object(
      'searches',     (select count(*) from cur  where event_type = 'search_run' and coalesce(metadata->>'surface','marketplace') = 'marketplace'),
      'no_match',     (select count(*) from cur  where event_type = 'search_run' and coalesce(metadata->>'surface','marketplace') = 'marketplace' and (metadata->>'results') = '0'),
      'impressions',  (select coalesce(sum(nullif(metadata->>'shown','')::int),0) from cur where event_type = 'listing_impressions' and coalesce(metadata->>'surface','marketplace') = 'marketplace'),
      'card_clicks',  (select count(*) from cur  where event_type = 'card_click'),
      'signin_prompts',(select count(*) from cur where event_type = 'signin_prompt'),
      'signin_done',  (select count(*) from cur  where event_type = 'signin_done' and (metadata->>'ok') = 'true'),
      'saves',        (select count(*) from cur  where event_type = 'car_saved'),
      'prev', jsonb_build_object(
        'searches',     (select count(*) from prev where event_type = 'search_run' and coalesce(metadata->>'surface','marketplace') = 'marketplace'),
        'no_match',     (select count(*) from prev where event_type = 'search_run' and coalesce(metadata->>'surface','marketplace') = 'marketplace' and (metadata->>'results') = '0'),
        'impressions',  (select coalesce(sum(nullif(metadata->>'shown','')::int),0) from prev where event_type = 'listing_impressions' and coalesce(metadata->>'surface','marketplace') = 'marketplace'),
        'card_clicks',  (select count(*) from prev where event_type = 'card_click'),
        'signin_prompts',(select count(*) from prev where event_type = 'signin_prompt'),
        'signin_done',  (select count(*) from prev where event_type = 'signin_done' and (metadata->>'ok') = 'true'),
        'saves',        (select count(*) from prev where event_type = 'car_saved')
      ),
      'top', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                select label, count(*) as count, count(*) filter (where no_match) as no_match
                from labelled where label is not null
                group by label order by count(*) desc, label limit p_limit) x),
      'top_no_match', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
                select label, count(*) as count
                from labelled where label is not null and no_match
                group by label order by count(*) desc, label limit p_limit) x)
    )
  );
end;
$$;
revoke all on function public.get_marketplace_search(timestamptz, timestamptz, int) from public, anon;
grant execute on function public.get_marketplace_search(timestamptz, timestamptz, int) to authenticated, service_role;

commit;
