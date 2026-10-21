-- N+1 fix (2026-10-21): the Live presenter's Budget tab asked for every model
-- card's variants one card at a time (get_new_car_listing_info per card, via
-- useNewCarInfos in src/components/newcar/NewCarListingInfo.jsx). An advisor
-- with 10 model cards paid 10 round trips, each also building the card's
-- "other cards" list that Budget never reads.
--
-- One call for the whole list instead, returning only what Budget uses: each
-- card's variants priced for the seller's zone, same shape and order as
-- get_new_car_listing_info.variants. Same visibility rule as that function:
-- only a card the public can already see (public_car_listings), never a unit.
-- Capped at 100 ids; a mini page shows far fewer.

create or replace function public.get_new_car_variants_batch(p_listing_ids uuid[])
returns table (listing_id uuid, variants jsonb)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.id,
         coalesce((
           select jsonb_agg(jsonb_build_object('model_id', vm.id, 'variant', vm.variant,
                    'price', new_car_zone_price(vm, z.zone),
                    'body_type', vm.body_type, 'fuel_type', vm.fuel_type,
                    'transmission', vm.transmission, 'specs', coalesce(vm.specs, '{}'::jsonb),
                    'effective_from', vm.effective_from)
                  order by new_car_zone_price(vm, z.zone) nulls last, vm.sort_order)
             from new_car_models vm
            where vm.brand = m.brand and vm.model = m.model and vm.is_active
         ), '[]'::jsonb)
    from car_listings c
    join public_car_listings pub on pub.id = c.id
    join new_car_models m on m.id = c.new_car_model_id
    join profiles p on p.id = c.dealer_id
    cross join lateral (select new_car_price_zone(p.state, p.city) as zone) z
   where c.id = any (p_listing_ids[1:100]) and not c.new_car_unit;
$$;

-- Public read (the mini page and presenter run logged out too), same as the
-- single-card function. Read-only, and it answers only for public cards.
revoke all on function public.get_new_car_variants_batch(uuid[]) from public;
grant execute on function public.get_new_car_variants_batch(uuid[]) to anon, authenticated;
