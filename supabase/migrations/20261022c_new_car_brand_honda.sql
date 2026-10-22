-- NEWCAR-1: Honda joins Proton / Perodua / Toyota / BYD as a new-car brand (owner, 2026-10-22).
-- One migration (one API freeze): widen the two brand CHECKs, then load the
-- Honda price list from the owner's file (honda_malaysia_models_2026.json, October 2026).
-- Rows below are generated from that file, not retyped.
--
-- On the road without insurance, Peninsular. Checked against Paultan / Wapcar /
-- Autobuzz / Zigwheels on 2026-10-22: every price matched except e:N1, where the
-- file said RM150,060 and Honda Malaysia's own press release says RM149,900.
-- Deliberately left out:
--   East Malaysia / Labuan / Langkawi prices: the file gives none ("contact local
--     dealers"). A zone with no price shows "ask", never the Peninsular number.
--   Warranty: the file says "up to 8 years", not a per-model term.
--   e:N1 range: the file says "~412 km WLTP class (confirm exact)".
--   City sedan size: the file marks it "approx"; City Hatchback length is a range.
-- engine_cc where the file omits it (HR-V, Civic, CR-V, Prelude, Type R) is the
-- engine family's displacement (1.5L 1498 cc, 2.0L e:HEV 1993 cc, K20C1 1996 cc),
-- needed for the Live presenter's insurance estimate.

alter table public.profiles drop constraint if exists profiles_new_car_brand_check;
alter table public.profiles add constraint profiles_new_car_brand_check
  check (new_car_brand is null or new_car_brand = any (array['Proton','Perodua','Toyota','BYD','Honda']));

alter table public.new_car_models drop constraint if exists new_car_models_brand_check;
alter table public.new_car_models add constraint new_car_models_brand_check
  check (brand = any (array['Proton','Perodua','Toyota','BYD','Honda']));

insert into public.new_car_models
  (brand, model, variant, body_type, fuel_type, transmission, price_peninsular, price_sabah_sarawak, effective_from, source_url, sort_order, specs)
values
  ('Honda','City','1.5L E','Sedan','Petrol','CVT',89900,null,'2026-10-19',null,10,'{"engine_cc": 1498, "power_ps": 121, "torque_nm": 145, "engine": "4-cylinder, 16-valve DOHC i-VTEC", "drive": "Front-wheel drive", "fuel_kml": 17.9, "wheels": "15-inch", "tyres": "185/60 R15", "fuel_tank_l": 40, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','City','1.5L V','Sedan','Petrol','CVT',94900,null,'2026-10-19',null,10,'{"engine_cc": 1498, "power_ps": 121, "torque_nm": 145, "engine": "4-cylinder, 16-valve DOHC i-VTEC", "drive": "Front-wheel drive", "fuel_kml": 17.9, "wheels": "16-inch", "tyres": "185/55 R16", "fuel_tank_l": 40, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','City','1.5L Petrol RS','Sedan','Petrol','CVT',99900,null,'2026-10-19',null,10,'{"engine_cc": 1498, "power_ps": 121, "torque_nm": 145, "engine": "4-cylinder, 16-valve DOHC i-VTEC", "drive": "Front-wheel drive", "fuel_kml": 17.9, "wheels": "16-inch", "tyres": "185/55 R16", "fuel_tank_l": 40, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','City','1.5L e:HEV RS','Sedan','Hybrid','e-CVT',111900,null,'2026-10-19',null,10,'{"engine_cc": 1498, "power_ps": 109, "torque_nm": 253, "engine": "1.5L Atkinson-cycle + electric motor (i-MMD)", "drive": "Front-wheel drive", "fuel_kml": 27.0, "wheels": "16-inch", "tyres": "185/55 R16", "fuel_tank_l": 40, "boot_l": 410, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','City Hatchback','1.5L V','Hatchback','Petrol','CVT',95900,null,'2026-10-19',null,20,'{"engine_cc": 1498, "power_ps": 121, "torque_nm": 145, "engine": "4-cylinder, 16-valve DOHC i-VTEC", "drive": "Front-wheel drive", "fuel_kml": 17.9, "wheels": "16-inch two-tone", "tyres": "185/55 R16", "fuel_tank_l": 40, "boot_l": 289, "width_mm": 1748, "height_mm": 1488, "wheelbase_mm": 2600, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','City Hatchback','1.5L Petrol RS','Hatchback','Petrol','CVT',100900,null,'2026-10-19',null,20,'{"engine_cc": 1498, "power_ps": 121, "torque_nm": 145, "engine": "4-cylinder, 16-valve DOHC i-VTEC", "drive": "Front-wheel drive", "fuel_kml": 17.9, "wheels": "16-inch", "tyres": "185/55 R16", "fuel_tank_l": 40, "boot_l": 289, "width_mm": 1748, "height_mm": 1488, "wheelbase_mm": 2600, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','City Hatchback','1.5L e:HEV RS','Hatchback','Hybrid','e-CVT',112900,null,'2026-10-19',null,20,'{"engine_cc": 1498, "power_ps": 109, "torque_nm": 253, "engine": "1.5L Atkinson-cycle + electric motor (i-MMD)", "drive": "Front-wheel drive", "fuel_kml": 27.0, "wheels": "16-inch", "tyres": "185/55 R16", "fuel_tank_l": 40, "boot_l": 289, "width_mm": 1748, "height_mm": 1488, "wheelbase_mm": 2600, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','WR-V','1.5L E','SUV','Petrol','CVT',94900,null,'2026-10-19',null,30,'{"engine_cc": 1498, "power_ps": 121, "torque_nm": 145, "engine": "1.5L DOHC i-VTEC", "drive": "Front-wheel drive", "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','WR-V','1.5L V','SUV','Petrol','CVT',98900,null,'2026-10-19',null,30,'{"engine_cc": 1498, "power_ps": 121, "torque_nm": 145, "engine": "1.5L DOHC i-VTEC", "drive": "Front-wheel drive", "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','WR-V','1.5L RS','SUV','Petrol','CVT',104900,null,'2026-10-19',null,30,'{"engine_cc": 1498, "power_ps": 121, "torque_nm": 145, "engine": "1.5L DOHC i-VTEC", "drive": "Front-wheel drive", "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','HR-V','1.5L S','SUV','Petrol','CVT',115900,null,'2026-10-19',null,40,'{"engine": "1.5L NA", "engine_cc": 1498, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','HR-V','1.5L Turbo E','SUV','Petrol','CVT',130900,null,'2026-10-19',null,40,'{"engine_cc": 1498, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','HR-V','1.5L Turbo V','SUV','Petrol','CVT',137900,null,'2026-10-19',null,40,'{"engine_cc": 1498, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','HR-V','1.5L e:HEV RS','SUV','Hybrid','e-CVT',143900,null,'2026-10-19',null,40,'{"engine": "1.5L e:HEV hybrid", "engine_cc": 1498, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','Civic','1.5L Turbo E','Sedan','Petrol','CVT',133900,null,'2026-10-19',null,50,'{"engine_cc": 1498, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','Civic','1.5L Turbo V','Sedan','Petrol','CVT',144900,null,'2026-10-19',null,50,'{"engine_cc": 1498, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','Civic','1.5L Turbo RS','Sedan','Petrol','CVT',149900,null,'2026-10-19',null,50,'{"engine_cc": 1498, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','Civic','2.0L e:HEV RS','Sedan','Hybrid','e-CVT',167900,null,'2026-10-19',null,50,'{"engine_cc": 1993, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','CR-V','2.0L e:HEV E','SUV','Hybrid','e-CVT',178200,null,'2026-10-19',null,60,'{"engine": "2.0L e:HEV", "engine_cc": 1993, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','CR-V','1.5L Turbo V','SUV','Petrol','CVT',181900,null,'2026-10-19',null,60,'{"engine_cc": 1498, "drive": "All-wheel drive", "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','CR-V','2.0L e:HEV RS','SUV','Hybrid','e-CVT',195900,null,'2026-10-19',null,60,'{"engine": "2.0L e:HEV", "engine_cc": 1993, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','e:N1','Standard','SUV','Electric',null,149900,null,'2026-10-19',null,70,'{"specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','Prelude','2.0L e:HEV','Coupe','Hybrid','e-CVT',278000,null,'2026-10-19',null,80,'{"power_ps": 184, "torque_nm": 315, "engine": "2.0L e:HEV", "engine_cc": 1993, "specs_checked": "2026-10-22"}'::jsonb),
  ('Honda','Civic Type R','2.0L Turbo Manual','Hatchback','Petrol','6-speed manual',399900,null,'2026-10-19',null,90,'{"power_ps": 330, "engine": "2.0L turbo (K20C1)", "engine_cc": 1996, "specs_checked": "2026-10-22"}'::jsonb)

on conflict (brand, model, variant) do nothing;
