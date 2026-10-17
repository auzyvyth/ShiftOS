-- public_car_listings: append is_model_card (owner, 2026-10-17). A new-car card
-- covers every variant of a model (20261017c) and its selling_price is the
-- CHEAPEST variant, so the marketplace card must say "From RM x". The grids
-- could not tell a model card from any other car: new_car_model_id is not in
-- the view. This appends one boolean; nothing else changes.
--
-- Appending a column keeps every grant and the get_salesman_featured_listings
-- (SETOF view) dependency. Built from the LIVE definition; refuses to run if
-- the anchor (the FROM after the last column) is not there exactly once.
begin;
do $$
declare
  v_def text := pg_get_viewdef('public.public_car_listings'::regclass, true);
  v_anchor text := E'\n   FROM car_listings cl\n';
begin
  if v_def ilike '%is_model_card%' then
    raise notice 'is_model_card already in the view; nothing to do';
    return;
  end if;
  if (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'public_car_listings: anchor not found exactly once; check the live view';
  end if;
  v_def := replace(v_def, v_anchor,
    E',\n    cl.new_car_model_id IS NOT NULL AND NOT COALESCE(cl.new_car_unit, false) AS is_model_card' || v_anchor);
  execute 'create or replace view public.public_car_listings as ' || v_def;
end $$;
commit;

-- Check afterwards:
--   select count(*) filter (where is_model_card) from public_car_listings;  -- 9 on 2026-10-17
--   select has_table_privilege('anon', 'public.public_car_listings', 'select');
