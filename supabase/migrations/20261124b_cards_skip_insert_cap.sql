-- New-car cards skip the listing cap (enforce_listing_cap), but the INSERT policy
-- salesman_inserts_own_listings calls salesman_under_listing_limit(), which counted them.
-- A seller with 14 cars + 16 cards (cap 30) could not add a card: RLS 42501, shown as
-- "Couldn't save". Same rule on both sides: cards are not counted.
create or replace function public.salesman_under_listing_limit()
 returns boolean
 language sql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  with cap as (
    select pc.listing_cap as c
      from profiles p
      join plan_config pc on pc.plan = p.plan::text
     where p.id = auth.uid()
  )
  select (select c from cap) is null
      or (
           select count(*)
             from car_listings
            where dealer_id = auth.uid()
              and new_car_model_id is null
              and status not in ('sold', 'archived', 'unpublished', 'private')
         ) < (select c from cap);
$function$;
