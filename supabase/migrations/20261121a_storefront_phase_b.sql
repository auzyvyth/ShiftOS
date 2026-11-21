-- STOREFRONT-2 stage 4 phase B (docs/STOREFRONT_PLAN.md): three new dealer-site sections,
-- "brands" (logos of the brands in stock), "browse" (brand / model / price / body type bar) and
-- "sold" (recently sold: car + month only).
-- QUEUED, NOT APPLIED. Apply after midnight Malaysia time with nobody live (CLAUDE.md), then flip
-- DB_PHASE_B to true in src/utils/storefrontLayout.js in the same release. Until both happen the
-- three sections exist nowhere in the app, so nothing calls the function below and nothing saves
-- the new ids.
-- ONE migration = one API freeze: both changes are in this file.

-- 1. The layout check learns the three new section ids. Same signature, so CREATE OR REPLACE
--    replaces it in place and the profiles CHECK constraint keeps using it. The list must equal
--    SECTIONS in src/utils/storefrontLayout.js with the gate open
--    (npm run test:storefrontlayout reads this file).
create or replace function public.storefront_layout_ok(p jsonb)
returns boolean
language sql
immutable
as $$
  -- coalesce: a CHECK passes on NULL, so a missing key must read as false, never unknown.
  select coalesce(p is null or (
    jsonb_typeof(p) = 'object'
    and p->>'v' = '1'
    and jsonb_typeof(p->'sections') = 'array'
    and jsonb_array_length(p->'sections') <= 20
    and pg_column_size(p) <= 4096
    and not exists (
      select 1 from jsonb_array_elements(p->'sections') s
      where jsonb_typeof(s) <> 'object'
         or coalesce(s->>'id', '') not in ('hero', 'strip', 'brands', 'video', 'hot_deals', 'browse', 'cars', 'about',
                                          'reviews', 'sold', 'why', 'stats', 'how', 'testimonials', 'calculator', 'contact')
         or jsonb_typeof(s->'on') is distinct from 'boolean'
         or coalesce(s->>'variant', '') not in ('a', 'b', 'c')
    )
  ), false)
$$;

-- 2. Recently sold on a dealer's own site. public_car_listings shows live cars only, so a
--    buyer cannot read a sold car; this SECURITY DEFINER function returns ONLY what the
--    section draws, and only for a dealer whose storefront is public (the same conditions as
--    get_dealer_profile_by_subdomain): brand, model, variant, year, the first photo and the
--    MONTH it sold (Malaysia time). Never the price, the buyer, the plate or the exact date
--    (same rule as get_agent_recent_sales). Last 12 cars sold in the last 12 months.
--    The subdomain is the storefront's public address, not a secret: the cars it returns
--    were on that dealer's public site while they were for sale.
create or replace function public.get_dealer_recent_sales(p_subdomain text)
returns table(brand text, model text, variant text, year integer, photo text, sold_month date)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.brand, c.model, c.variant, c.year::integer,
         c.images[1],
         date_trunc('month', c.sold_at at time zone 'Asia/Kuala_Lumpur')::date
    from profiles p
    join car_listings c on c.dealer_id = p.id
   where p.subdomain = p_subdomain
     and p.role = any (array['dealer'::text, 'owner'::text, 'superadmin'::text])
     and p.payment_status is distinct from 'pending'
     and p.is_active = true
     and p.account_status is distinct from 'deleted'
     and c.status = 'sold'
     and c.sold_at is not null
     and c.sold_at > now() - interval '12 months'
     and c.sold_at <= now()
   order by c.sold_at desc
   limit 12;
$$;

-- Supabase grants new functions to anon directly and PUBLIC holds EXECUTE by default:
-- revoke both, then grant exactly the two roles a storefront visitor has.
revoke all on function public.get_dealer_recent_sales(text) from public;
revoke all on function public.get_dealer_recent_sales(text) from anon, authenticated;
grant execute on function public.get_dealer_recent_sales(text) to anon, authenticated;

-- After applying, check (read-only):
--   select oid::regprocedure from pg_proc where proname in ('get_dealer_recent_sales', 'storefront_layout_ok');  -- one row each
--   select has_function_privilege('anon', 'public.get_dealer_recent_sales(text)', 'execute');                 -- true
--   select * from public.get_dealer_recent_sales('vyth');                                                       -- no price / buyer columns
