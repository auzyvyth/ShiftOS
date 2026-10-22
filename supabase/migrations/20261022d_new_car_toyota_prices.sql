-- NEWCAR-1: load Toyota's price list (owner's file toyota_malaysia_models_detailed_2026.json,
-- October 2026). Toyota was already an allowed brand but had ZERO rows, so a Toyota
-- advisor got an empty list. DATA ONLY: no DDL, so no API freeze.
--
-- On the road without insurance, Peninsular, checked against Paultan / CarBase /
-- Carlist / Lowyat on 2026-10-22. Only prices two sources agree on are loaded:
--   Vios 1.5E / 1.5G: the file gave a range ("approx 90000-99000"); Paultan and
--     CarBase both say RM90,600 / RM96,600, so those are used.
-- Deliberately left out:
--   Camry 2.5 HEV: the file says RM248,800 (Paultan's launch price), but a Jan 2026
--     list puts it at RM250,354. Add once the current figure is confirmed.
--   The file's "Other major models" (Yaris, Corolla, Fortuner, Hilux, Harrier, bZ4X,
--     Urban Cruiser, Innova Zenix, Veloz, Alphard, Vellfire, GR86, GR Yaris, GR
--     Corolla): one rounded "from" price per model, no variants. A price list here
--     is per variant, and a guessed variant price would read as official.
--   East Malaysia / Labuan / Langkawi: the file gives none, so those zones show "ask".
--   Specs the file gave as a range or an either/or (Vios HEV tank and boot, Vios
--     petrol wheel size).
-- fuel_kml from the file's L/100km (5.2 -> 19.2, 6.6 -> 15.2) or its own km/L claim.

insert into public.new_car_models
  (brand, model, variant, body_type, fuel_type, transmission, price_peninsular, price_sabah_sarawak, effective_from, source_url, sort_order, specs)
values
  ('Toyota','Vios','1.5E','Sedan','Petrol','CVT',90600,null,'2026-10-22',null,10,'{"length_mm": 4425, "width_mm": 1740, "height_mm": 1480, "wheelbase_mm": 2620, "engine": "1.5L Dual VVT-i", "engine_cc": 1496, "power_ps": 106, "torque_nm": 138, "drive": "Front-wheel drive", "fuel_kml": 19.2, "fuel_tank_l": 40, "boot_l": 475, "specs_checked": "2026-10-22"}'::jsonb),
  ('Toyota','Vios','1.5G','Sedan','Petrol','CVT',96600,null,'2026-10-22',null,10,'{"length_mm": 4425, "width_mm": 1740, "height_mm": 1480, "wheelbase_mm": 2620, "engine": "1.5L Dual VVT-i", "engine_cc": 1496, "power_ps": 106, "torque_nm": 138, "drive": "Front-wheel drive", "fuel_kml": 19.2, "fuel_tank_l": 40, "boot_l": 475, "specs_checked": "2026-10-22"}'::jsonb),
  ('Toyota','Vios','1.5 HEV','Sedan','Hybrid','e-CVT',103900,null,'2026-10-22',null,10,'{"length_mm": 4425, "width_mm": 1740, "height_mm": 1480, "wheelbase_mm": 2620, "engine": "1.5L hybrid", "engine_cc": 1496, "power_ps": 111, "drive": "Front-wheel drive", "fuel_kml": 27.8, "wheels": "16-inch", "tyres": "195/60 R16", "specs_checked": "2026-10-22"}'::jsonb),
  ('Toyota','Vios','1.5 HEV GR Sport','Sedan','Hybrid','e-CVT',109900,null,'2026-10-22',null,10,'{"length_mm": 4425, "width_mm": 1740, "height_mm": 1480, "wheelbase_mm": 2620, "engine": "1.5L hybrid", "engine_cc": 1496, "power_ps": 111, "drive": "Front-wheel drive", "fuel_kml": 27.8, "wheels": "17-inch", "tyres": "205/50 R17", "specs_checked": "2026-10-22"}'::jsonb),
  ('Toyota','Yaris Cross','1.5S','SUV','Petrol','CVT',99900,null,'2026-10-22',null,20,'{"length_mm": 4310, "width_mm": 1770, "height_mm": 1615, "wheelbase_mm": 2620, "wheels": "18-inch", "tyres": "215/55 R18", "drive": "Front-wheel drive", "engine": "1.5L 2NR-VE", "engine_cc": 1496, "power_ps": 106, "torque_nm": 138, "fuel_tank_l": 42, "boot_l": 465, "specs_checked": "2026-10-22"}'::jsonb),
  ('Toyota','Yaris Cross','1.5S HEV','SUV','Hybrid','e-CVT',109900,null,'2026-10-22',null,20,'{"length_mm": 4310, "width_mm": 1770, "height_mm": 1615, "wheelbase_mm": 2620, "wheels": "18-inch", "tyres": "215/55 R18", "drive": "Front-wheel drive", "engine": "1.5L hybrid", "engine_cc": 1496, "power_ps": 111, "fuel_kml": 27.8, "fuel_tank_l": 36, "specs_checked": "2026-10-22"}'::jsonb),
  ('Toyota','Corolla Cross','1.8V','SUV','Petrol','CVT',133800,null,'2026-10-22',null,30,'{"length_mm": 4460, "width_mm": 1825, "height_mm": 1620, "wheelbase_mm": 2640, "wheels": "18-inch", "tyres": "225/50 R18", "drive": "Front-wheel drive", "boot_l": 440, "engine": "1.8L Dual VVT-i", "engine_cc": 1798, "power_ps": 139, "torque_nm": 172, "fuel_tank_l": 47, "specs_checked": "2026-10-22"}'::jsonb),
  ('Toyota','Corolla Cross','1.8 HEV','SUV','Hybrid','e-CVT',140800,null,'2026-10-22',null,30,'{"length_mm": 4460, "width_mm": 1825, "height_mm": 1620, "wheelbase_mm": 2640, "wheels": "18-inch", "tyres": "225/50 R18", "drive": "Front-wheel drive", "boot_l": 440, "engine": "1.8L hybrid", "engine_cc": 1798, "power_ps": 122, "fuel_tank_l": 36, "specs_checked": "2026-10-22"}'::jsonb),
  ('Toyota','Corolla Cross','1.8 HEV GR Sport','SUV','Hybrid','e-CVT',148800,null,'2026-10-22',null,30,'{"length_mm": 4460, "width_mm": 1825, "height_mm": 1620, "wheelbase_mm": 2640, "wheels": "18-inch", "tyres": "225/50 R18", "drive": "Front-wheel drive", "boot_l": 440, "engine": "1.8L hybrid", "engine_cc": 1798, "power_ps": 122, "fuel_tank_l": 36, "specs_checked": "2026-10-22"}'::jsonb),
  ('Toyota','Camry','2.5V','Sedan','Petrol','8-speed auto',221800,null,'2026-10-22',null,40,'{"length_mm": 4920, "width_mm": 1840, "height_mm": 1445, "wheelbase_mm": 2825, "wheels": "18-inch", "tyres": "235/45 R18", "drive": "Front-wheel drive", "engine": "2.5L Dynamic Force", "engine_cc": 2487, "power_ps": 204, "torque_nm": 246, "zero_100_s": 8.9, "fuel_kml": 15.2, "fuel_tank_l": 60, "boot_l": 524, "specs_checked": "2026-10-22"}'::jsonb)

on conflict (brand, model, variant) do nothing;
