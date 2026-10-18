-- NEWCAR-1: BYD Atto 3 Performance (owner's file, 2026-10-18). DATA ONLY, no API freeze.
-- Limited edition: 69 units nationwide (Merdeka special). When BYD says it is sold
-- out, HIDE the row in the console (is_active = false); never delete it.
-- East Malaysia price left NULL (file marks it approximate), same as 20261018c.
insert into public.new_car_models
  (brand, model, variant, body_type, fuel_type, transmission, price_peninsular, price_sabah_sarawak, effective_from, source_url, sort_order, specs)
values
  ('BYD','Atto 3','Performance','SUV','Electric',null,149800,null,'2026-10-01',null,40,'{"length_mm": 4455, "width_mm": 1875, "height_mm": 1615, "wheelbase_mm": 2720, "seats": 5, "drive": "All-wheel drive (dual motor)", "power_ps": 449, "torque_nm": 560, "zero_100_s": 4.0, "battery_kwh": 74.88, "ac_kw": 11, "dc_kw": 220, "range_km": 470, "warranty": "6 years / 150,000 km", "battery_warranty": "8 years / 160,000 km", "colours": ["Ski White", "Atlantis Grey", "Harbour Grey", "Cosmos Black"], "specs_checked": "2026-10-18", "features": ["Limited edition: 69 units nationwide", "Everything on the Premium, plus", "Dual motor AWD", "Windscreen head-up display", "Vehicle refrigerator (cooling and heating)", "V2L (power out)", "BYD Blade LFP battery"]}'::jsonb)
on conflict (brand, model, variant) do nothing;
