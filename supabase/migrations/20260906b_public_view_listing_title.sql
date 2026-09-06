-- Append listing_title + specs_overridden to public_car_listings.
-- CREATE OR REPLACE VIEW can only APPEND columns, which is exactly what this is,
-- so no DROP and every existing grant survives untouched. The definition is read
-- back and rewritten rather than retyped: this view carries ~80 columns and a
-- hand transcription is how one silently goes missing.
do $$
declare
  v_def  text;
  v_anch text := 'COALESCE(ss.sold_count, 0) AS seller_sold_count';
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'public_car_listings'
       and column_name = 'listing_title'
  ) then
    raise notice 'listing_title already on the view, nothing to do';
    return;
  end if;

  v_def := pg_get_viewdef('public.public_car_listings'::regclass, true);

  if position(v_anch in v_def) = 0 then
    raise exception 'anchor column not found - view definition changed, append by hand';
  end if;

  v_def := replace(
    v_def,
    v_anch,
    v_anch || ',' || chr(10) || '    cl.listing_title,' || chr(10) || '    cl.specs_overridden'
  );

  execute 'create or replace view public.public_car_listings as ' || v_def;
end $$;
