-- NEWCAR audit, 2026-11-12: Toyota + Honda price list re-checked against current Malaysian sources.
-- DATA ONLY (no DDL), so no API freeze.
--
-- 1. Camry 2.5 HEV added at RM248,800 (Paultan, CarBase and Carz agree; Zigwheels' RM218,500 is
--    an outlier). Left out on 2026-10-22 until confirmed (see 20261022d). Specs: only the body
--    dimensions it shares with the 2.5V. Power, torque, tyres, tank are NOT filled: unverified.
-- 2. Prelude power_ps 184 -> 203. 184 is the motor alone; 203 PS is the system output Honda
--    Malaysia quotes (Paultan launch article, June 2026). Torque left as is, unverified.
-- 3. specs_checked is removed from rows with no real spec sheet behind them (two or fewer spec
--    keys besides the stamp: Civic, CR-V, HR-V, e:N1). The stamp made "checked" show on rows
--    where nothing had been checked. NewCarListingInfo only shows the date when the stamp exists.
-- Civic Type R stays active: availability is unconfirmed (owner to ask a Honda dealer).

insert into public.new_car_models
  (brand, model, variant, body_type, fuel_type, transmission, price_peninsular, price_sabah_sarawak, effective_from, source_url, sort_order, specs)
values
  ('Toyota','Camry','2.5 HEV','Sedan','Hybrid','e-CVT',248800,null,'2026-11-12',null,40,
   '{"length_mm": 4920, "width_mm": 1840, "height_mm": 1445, "wheelbase_mm": 2825, "engine": "2.5L hybrid", "engine_cc": 2487}'::jsonb)
on conflict (brand, model, variant) do nothing;

update public.new_car_models
   set specs = jsonb_set(specs, '{power_ps}', '203'::jsonb)
 where brand = 'Honda' and model = 'Prelude' and variant = '2.0L e:HEV';

update public.new_car_models
   set specs = specs - 'specs_checked'
 where brand = 'Honda'
   and specs ? 'specs_checked'
   and (select count(*) from jsonb_object_keys(specs) k where k <> 'specs_checked') <= 2;
