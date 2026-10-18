-- NEWCAR-1: BYD joins Proton / Perodua / Toyota as a new-car brand (owner, 2026-10-18).
-- Schema only: widens the two brand CHECKs. The BYD price list is entered in the
-- console (Marketplace > New car prices), like every brand's.
alter table public.profiles drop constraint if exists profiles_new_car_brand_check;
alter table public.profiles add constraint profiles_new_car_brand_check
  check (new_car_brand is null or new_car_brand = any (array['Proton','Perodua','Toyota','BYD']));

alter table public.new_car_models drop constraint if exists new_car_models_brand_check;
alter table public.new_car_models add constraint new_car_models_brand_check
  check (brand = any (array['Proton','Perodua','Toyota','BYD']));
