-- MET-1 (2026-11-20, QUEUED for the after-midnight slot): analytics_events has a
-- CHECK on event_type, so /api/track rows with a new type are refused by the DB
-- (the API swallows the error, nothing breaks, nothing is stored).
-- Adds: search_run, listing_impressions, signin_prompt, signin_done, car_saved.
-- Also adds 'enquiry' and 'listing_view': lib/analyticsEvent.js has accepted them
-- since ANALYTICS-SPOOF but the CHECK never listed them, so those were dropped too.
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
commit;
