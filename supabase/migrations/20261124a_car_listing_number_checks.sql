-- Car numbers must make sense, whoever writes them (form, panel or direct API).
-- Price, list price and previous price: above zero when set. Deposit: zero or more.
-- Mileage: zero or more when set. Blank (NULL) stays allowed for all of them.
-- One existing row had mileage -100 (a sold test car); its mileage is cleared,
-- since the real figure is unknown.

begin;

update public.car_listings set mileage = null where mileage < 0;

alter table public.car_listings
  add constraint car_listings_selling_price_positive  check (selling_price  is null or selling_price  > 0) not valid,
  add constraint car_listings_original_price_positive check (original_price is null or original_price > 0) not valid,
  add constraint car_listings_previous_price_positive check (previous_price is null or previous_price > 0) not valid,
  add constraint car_listings_deposit_not_negative       check (deposit_amount is null or deposit_amount >= 0) not valid,
  add constraint car_listings_mileage_not_negative    check (mileage        is null or mileage        >= 0) not valid;

alter table public.car_listings validate constraint car_listings_selling_price_positive;
alter table public.car_listings validate constraint car_listings_original_price_positive;
alter table public.car_listings validate constraint car_listings_previous_price_positive;
alter table public.car_listings validate constraint car_listings_deposit_not_negative;
alter table public.car_listings validate constraint car_listings_mileage_not_negative;

commit;
