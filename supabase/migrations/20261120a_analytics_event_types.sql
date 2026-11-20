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


-- Storefront layout (STOREFRONT-2 stage 2, docs/STOREFRONT_PLAN.md): the dealer's choice of
-- which sections of their site show, in what order, and which version of each. One small
-- object, written only through Settings by the dealer (own profile row, existing RLS).
-- storefront_layout_ok is the database's copy of src/utils/storefrontLayout.js: the section
-- list must stay the same in both (npm run test:storefrontlayout reads this file). The page
-- cleans whatever is saved anyway, so this check only keeps junk and size out of profiles.
create or replace function public.storefront_layout_ok(p jsonb)
returns boolean
language sql
immutable
as $$
  -- coalesce: a CHECK passes on NULL, so a missing key must read as false, never unknown
  -- ({"v":1} with no sections slipped through before this, found by the local test).
  select coalesce(p is null or (
    jsonb_typeof(p) = 'object'
    and p->>'v' = '1'
    and jsonb_typeof(p->'sections') = 'array'
    and jsonb_array_length(p->'sections') <= 20
    and pg_column_size(p) <= 4096
    and not exists (
      select 1 from jsonb_array_elements(p->'sections') s
      where jsonb_typeof(s) <> 'object'
         or coalesce(s->>'id', '') not in ('hero', 'strip', 'video', 'hot_deals', 'cars', 'about', 'reviews',
                                          'why', 'stats', 'how', 'testimonials', 'calculator', 'contact')
         or jsonb_typeof(s->'on') is distinct from 'boolean'
         or coalesce(s->>'variant', '') not in ('a', 'b', 'c')
    )
  ), false)
$$;
alter table public.profiles add column if not exists storefront_layout jsonb;
alter table public.profiles add constraint profiles_storefront_layout_ok check (public.storefront_layout_ok(storefront_layout));

-- Storefront hero video: Settings saves hero_video_* and HomePage reads it, but the
-- storefront lookup never returned it, so no dealer's video ever showed (both live
-- storefronts have one saved). Adds the three columns to get_dealer_profile_by_subdomain,
-- plus storefront_layout (above).
-- The return type changes, so CREATE OR REPLACE cannot do it: drop + create in this
-- transaction, then re-assert the grants (this lookup is public by design: anon + authenticated).
drop function public.get_dealer_profile_by_subdomain(text);
create function public.get_dealer_profile_by_subdomain(p_subdomain text)
returns table(id uuid, dealership text, site_name text, subdomain text, avatar_url text, site_logo_url text, logo_url text,
  email text, phone text, whatsapp_number text, social_facebook text, social_instagram text, social_tiktok text,
  location text, city text, state text, about_text text, brand_color text, custom_domain text, slug text,
  storefront_why jsonb, storefront_how jsonb, storefront_testimonials jsonb, storefront_cta jsonb,
  hero_title text, hero_subtitle text, hero_cta_text text, announcement_bar text, announcement_bar_enabled boolean,
  stat_years integer, stat_happy_customers integer, is_verified boolean, business_hours text,
  hero_video_enabled boolean, hero_video_url text, hero_video_title text, storefront_layout jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    p.id, p.dealership, p.site_name, p.subdomain, p.avatar_url, p.site_logo_url, p.logo_url,
    p.email, p.phone, p.whatsapp_number, p.social_facebook, p.social_instagram, p.social_tiktok,
    p.location, p.city, p.state, p.about_text, p.brand_color, p.custom_domain, p.slug,
    p.storefront_why, p.storefront_how, p.storefront_testimonials, p.storefront_cta,
    p.hero_title, p.hero_subtitle, p.hero_cta_text,
    p.announcement_bar, p.announcement_bar_enabled,
    p.stat_years, p.stat_happy_customers, p.is_verified, p.business_hours,
    p.hero_video_enabled, p.hero_video_url, p.hero_video_title, p.storefront_layout
  from profiles p
  where p.subdomain = p_subdomain
    and p.role = any (array['dealer'::text, 'owner'::text, 'superadmin'::text])
    and p.payment_status is distinct from 'pending'
    and p.is_active = true
    and p.account_status is distinct from 'deleted'
  limit 1;
$$;
grant execute on function public.get_dealer_profile_by_subdomain(text) to anon, authenticated, service_role;

commit;
