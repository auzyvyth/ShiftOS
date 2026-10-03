-- Sitemap: list every agent page (/s/:slug) that actually shows cars.
--
-- get_public_agent_slugs() was built in the dashboard and never committed. It
-- only counted cars the salesman OWNS (car_listings.dealer_id = salesman), so
-- a salesman under a dealer -- whose page shows cars ASSIGNED to them and cars
-- they FEATURE via salesman_listings -- was left out of the sitemap even with
-- live cars on their page. The page itself (api/og.js getSalesmanCars and
-- SalesmanProfilePage) has always used all three sources; this matches it.
--
-- Same signature and return type, so CREATE OR REPLACE replaces it in place
-- (no overload). Grants are unchanged.

create or replace function public.get_public_agent_slugs()
returns table(slug text, lastmod timestamp with time zone)
language sql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  with agent_cars as (
    select c.dealer_id as salesman_id, c.created_at
      from car_listings c
     where c.status in ('available', 'reserved')
    union all
    select c.assigned_to, c.created_at
      from car_listings c
     where c.assigned_to is not null
       and c.status in ('available', 'reserved')
    union all
    select sl.salesman_id, c.created_at
      from salesman_listings sl
      join car_listings c on c.id = sl.listing_id
     where c.status in ('available', 'reserved')
  )
  select p.slug,
         greatest(max(a.created_at), p.created_at) as lastmod
    from profiles p
    join agent_cars a on a.salesman_id = p.id
   where p.role = 'salesman'
     and p.slug is not null
     and p.slug <> ''
     and coalesce(p.is_active, true) = true
     and p.suspended_at is null
     and p.deleted_at is null
     and coalesce(p.account_status, 'active') <> 'deleted'
   group by p.slug, p.created_at;
$function$;
