-- NEWCAR: Toyota catalogue widened from the OFFICIAL UMW Toyota price lists (owner, 2026-11-12).
-- DATA ONLY (no DDL), so no API freeze. Rows without photos stay invisible to advisors
-- (the signup picker only offers models that have photos in new_car_model_media).
--
-- Prices: UMW Toyota Motor "Price List for Peninsular Malaysia", Individual Private, "On The
-- Road Price without Insurance", read from toyota.com.my on 2026-11-12. Each row carries the
-- list's own effective date and its PDF link in source_url, so a price can be audited and a
-- refresh is a diff against the same page. Toyota republishes lists every few weeks.
-- Zones: no East Malaysia / Labuan / Langkawi price (a zone with no price shows "ask").
--
-- Left out on purpose: Hiace (a van, and 'Van' is not in marketplace BODY_TYPES; the panel van
--   is company-commercial only), Hilux single cab, GR86 / GR Yaris / GR Corolla (halo cars),
--   GR Supra (page 404, no price list), Land Cruiser and plain Innova (not on Toyota Malaysia's site).
--
-- Specs: only what a UMW brochure or the price list itself states. engine_cc comes from the price
-- list; Yaris, Harrier and the Hilux Rogue / GR-S come from the brochures (specs_checked set only
-- there). Transmission is 'Automatic' / 'Manual' where the price list says only A/T or M/T.
-- Fortuner 2.7 SRZ is the 2,694 cc petrol; the other Fortuner and Hilux engines are diesel.
-- Hybrids use the system output where a brochure gives it (Harrier 217 PS).

insert into public.new_car_models
  (brand, model, variant, body_type, fuel_type, transmission, price_peninsular, price_sabah_sarawak, effective_from, source_url, sort_order, specs)
values
  ('Toyota','Yaris','1.5E','Hatchback','Petrol','CVT',88000,null,'2026-07-01','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/yaris/july-2026/1.0-pm%28ip%29-yaris-price-list.pdf',15,'{"length_mm": 4140, "width_mm": 1730, "wheelbase_mm": 2550, "engine": "1.5L Dual VVT-i", "engine_cc": 1496, "power_ps": 107, "torque_nm": 140, "wheels": "16-inch", "tyres": "195/50 R16", "fuel_tank_l": 42, "specs_checked": "2026-11-12"}'::jsonb),
  ('Toyota','Yaris','1.5G','Hatchback','Petrol','CVT',91600,null,'2026-07-01','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/yaris/july-2026/1.0-pm%28ip%29-yaris-price-list.pdf',15,'{"length_mm": 4140, "width_mm": 1730, "wheelbase_mm": 2550, "engine": "1.5L Dual VVT-i", "engine_cc": 1496, "power_ps": 107, "torque_nm": 140, "wheels": "16-inch", "tyres": "195/50 R16", "fuel_tank_l": 42, "specs_checked": "2026-11-12"}'::jsonb),

  ('Toyota','Corolla','1.8G','Sedan','Petrol','Automatic',144800,null,'2026-07-01','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/corolla/july-2026/1.0-pm-%28ipte%29-corolla.pdf',35,'{"engine_cc": 1798}'::jsonb),
  ('Toyota','Corolla','1.8 GR Sport','Sedan','Petrol','Automatic',149800,null,'2026-07-01','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/corolla/july-2026/1.0-pm-%28ipte%29-corolla.pdf',35,'{"engine_cc": 1798}'::jsonb),

  ('Toyota','Veloz','1.5 AT','MPV','Petrol','Automatic',95000,null,'2026-07-01','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/veloz/july-2026/1.0-pm-veloz-price-list.pdf',50,'{"engine_cc": 1496}'::jsonb),

  ('Toyota','Innova Zenix','2.0V','MPV','Petrol','Automatic',165000,null,'2026-07-01','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/zenix/july-2026/1.0-pm-%28ipte%29-innova-zenix.pdf',60,'{"engine_cc": 1987}'::jsonb),
  ('Toyota','Innova Zenix','2.0 HEV','MPV','Hybrid','e-CVT',202000,null,'2026-07-01','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/zenix/july-2026/1.0-pm-%28ipte%29-innova-zenix.pdf',60,'{"engine_cc": 1987}'::jsonb),

  ('Toyota','Harrier','2.5 HEV','SUV','Hybrid','e-CVT',289000,null,'2026-11-02','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/harrier-hev/november-2026/1.0-pm-ipte-cpte-harrier.pdf',70,'{"length_mm": 4740, "width_mm": 1855, "height_mm": 1660, "wheelbase_mm": 2690, "engine": "2.5L Dynamic Force hybrid", "engine_cc": 2487, "power_ps": 217, "wheels": "18-inch", "tyres": "225/60 R18", "fuel_tank_l": 55, "specs_checked": "2026-11-12"}'::jsonb),

  ('Toyota','Fortuner','2.4 AT 4x4','SUV','Diesel','Automatic',195880,null,'2026-07-22','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/fortuner/july-2026/v4/1.0-pm-%28ipte%29-fortuner-price-list.pdf',80,'{"engine_cc": 2393, "drive": "Four-wheel drive"}'::jsonb),
  ('Toyota','Fortuner','2.7 SRZ AT 4x4','SUV','Petrol','Automatic',202880,null,'2026-07-22','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/fortuner/july-2026/v4/1.0-pm-%28ipte%29-fortuner-price-list.pdf',80,'{"engine_cc": 2694, "drive": "Four-wheel drive"}'::jsonb),
  ('Toyota','Fortuner','2.8 VRZ AT 4x4','SUV','Diesel','Automatic',241880,null,'2026-07-22','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/fortuner/july-2026/v4/1.0-pm-%28ipte%29-fortuner-price-list.pdf',80,'{"engine_cc": 2755, "drive": "Four-wheel drive"}'::jsonb),

  ('Toyota','Hilux','Double Cab 2.4E MT 4x4','Pickup','Diesel','Manual',117880,null,'2026-07-22','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/hilux/july-2026/v3/1.0-pm-%28ipte%29-hilux-price-list.pdf',90,'{"engine_cc": 2393, "drive": "Four-wheel drive"}'::jsonb),
  ('Toyota','Hilux','Double Cab 2.4E AT 4x4','Pickup','Diesel','Automatic',119880,null,'2026-07-22','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/hilux/july-2026/v3/1.0-pm-%28ipte%29-hilux-price-list.pdf',90,'{"engine_cc": 2393, "drive": "Four-wheel drive"}'::jsonb),
  ('Toyota','Hilux','Double Cab 2.4V AT 4x4','Pickup','Diesel','Automatic',149580,null,'2026-07-22','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/hilux/july-2026/v3/1.0-pm-%28ipte%29-hilux-price-list.pdf',90,'{"engine_cc": 2393, "drive": "Four-wheel drive"}'::jsonb),
  ('Toyota','Hilux','Double Cab 2.8 Rogue AT 4x4','Pickup','Diesel','6-speed auto',163080,null,'2026-07-22','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/hilux/july-2026/v3/1.0-pm-%28ipte%29-hilux-price-list.pdf',90,'{"engine": "2.8L diesel 1GD-FTV", "engine_cc": 2755, "power_ps": 204, "torque_nm": 500, "drive": "Four-wheel drive", "wheels": "18-inch", "tyres": "265/60 R18", "specs_checked": "2026-11-12"}'::jsonb),
  ('Toyota','Hilux','Double Cab 2.8 GR-S AT 4x4','Pickup','Diesel','6-speed auto',173280,null,'2026-07-22','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/hilux/july-2026/v3/1.0-pm-%28ipte%29-hilux-price-list.pdf',90,'{"engine": "2.8L diesel 1GD-FTV", "engine_cc": 2755, "power_ps": 224, "torque_nm": 550, "drive": "Four-wheel drive", "wheels": "18-inch", "tyres": "265/60 R18", "specs_checked": "2026-11-12"}'::jsonb),
  ('Toyota','Hilux','Double Cab BEV 4x4','Pickup','Electric',null,226300,null,'2026-03-30','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/hilux-bev/march-2026/v2/1.0-pm-%28ipte-cpte%29-hilux-bev-price-list.pdf',90,'{"drive": "Four-wheel drive"}'::jsonb),

  ('Toyota','bZ4X','Standard','SUV','Electric',null,220000,null,'2026-03-30','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/bz4x/march-2026/1.0-pm-bz4x-price-list.pdf',100,'{}'::jsonb),
  ('Toyota','Urban Cruiser','Standard','SUV','Electric',null,198000,null,'2026-03-30','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/urban-cruiser/march-2026/1.0-pm-urban-cruiser-price-list.pdf',110,'{}'::jsonb),

  ('Toyota','Alphard','2.4T Executive Lounge','MPV','Petrol','Automatic',548000,null,'2026-08-03','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/alphard/august-2026/1.0-pm-toyota-alphard-price-list.pdf',120,'{"engine_cc": 2393}'::jsonb),

  ('Toyota','Vellfire','2.5','MPV','Petrol','Automatic',448000,null,'2026-08-03','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/vellfire/august-2026/1.0-pm-toyota-vellfire-price-list.pdf',130,'{"engine_cc": 2494}'::jsonb),
  ('Toyota','Vellfire','2.5 HEV Executive Lounge','MPV','Hybrid','e-CVT',549900,null,'2026-08-03','https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/vellfire/august-2026/1.0-pm-toyota-vellfire-price-list.pdf',130,'{"engine_cc": 2487}'::jsonb)
on conflict (brand, model, variant) do nothing;

-- Existing Toyota rows: prices already equal the current official lists (checked 2026-11-12),
-- so only the audit trail changes: the list's own effective date + its PDF link.
update public.new_car_models set effective_from = '2026-07-01',
  source_url = 'https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/vios-hev/july-2026/1.0-pm%28ip%29-vios.pdf'
 where brand = 'Toyota' and model = 'Vios';
update public.new_car_models set effective_from = '2026-07-01',
  source_url = 'https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/toyota-yaris-cros-and-hev/july-2026/1.0-pm%28ip%29-yaris-cross.pdf'
 where brand = 'Toyota' and model = 'Yaris Cross';
update public.new_car_models set effective_from = '2026-07-22',
  source_url = 'https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/corolla-cross/july-2026/v2/1.0-pm%28ip%29-corolla-cross-price-list.pdf'
 where brand = 'Toyota' and model = 'Corolla Cross';
update public.new_car_models set effective_from = '2026-07-01',
  source_url = 'https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/camry-hev-and-ice/july-2026/1.0-pm-%28ipte%29-camry.pdf'
 where brand = 'Toyota' and model = 'Camry';

-- Yaris Cross cargo space per the UMW brochure: 1.5S 471 L (was 465), 1.5S HEV 466 L (was blank).
update public.new_car_models set specs = jsonb_set(specs, '{boot_l}', '471'::jsonb)
 where brand = 'Toyota' and model = 'Yaris Cross' and variant = '1.5S';
update public.new_car_models set specs = jsonb_set(specs, '{boot_l}', '466'::jsonb)
 where brand = 'Toyota' and model = 'Yaris Cross' and variant = '1.5S HEV';
