-- A sale's real price and date were overwritten by the sync triggers.
--
-- 1. fn_sync_stock_unit_on_sale (car_listings -> stock_units) copied
--    NEW.selling_price (the ASKING price) into stock_units.sold_price and
--    sold_at (now) into sold_date. Mark Sold now records the actual price on
--    car_listings.sold_price, and the stock P&L reads stock_units — so the
--    negotiated price was replaced by the asking price.
-- 2. stamp_sold_at forced sold_date = CURRENT_DATE on every sale, so a sale
--    date typed in the Stock tab (which reaches car_listings through
--    sync_stock_sold_to_listing) was thrown away, then (1) wrote today's date
--    back onto the stock unit.
-- 3. 3 sold cars had stock_units.sold_price NULL (revenue 0 in P&L).

create or replace function public.stamp_sold_at()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.status = 'sold' and (old.status is distinct from 'sold') then
    new.sold_at := now();
    -- keep a date written in this same update (Stock tab sale date)
    if new.sold_date is not distinct from old.sold_date or new.sold_date is null then
      new.sold_date := current_date;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.fn_sync_stock_unit_on_sale()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare days_held int;
begin
  if new.status = 'sold' and (old.status is distinct from 'sold') then
    days_held := extract(day from (coalesce(new.sold_at, now()) - new.created_at))::int;
    insert into stock_units (
      dealer_id, listing_id, purchase_price, recon_cost, status,
      sold_price, sold_date, days_in_stock, created_at
    ) values (
      new.dealer_id, new.id, coalesce(new.base_price, 0), coalesce(new.recon_cost, 0), 'sold',
      coalesce(new.sold_price, new.selling_price),
      coalesce(new.sold_date, new.sold_at::date, current_date),
      days_held, now()
    )
    on conflict (listing_id) do update set
      status        = 'sold',
      sold_price    = excluded.sold_price,
      sold_date     = excluded.sold_date,
      days_in_stock = excluded.days_in_stock;
  end if;
  return new;
end;
$function$;

update stock_units s
   set sold_price = c.sold_price
  from car_listings c
 where c.id = s.listing_id
   and c.status = 'sold' and s.status = 'sold'
   and s.sold_price is null and c.sold_price is not null;
