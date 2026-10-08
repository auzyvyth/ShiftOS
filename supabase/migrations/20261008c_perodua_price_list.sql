-- NEWCAR-1: Perodua price list (owner's file 2026-10-08), checked line by line.
-- DATA ONLY (no schema change), so it does not freeze the API.
--
-- On the road without insurance, Peninsular. Every price below was checked
-- against Perodua's own figures as reported by paultan.org / soyacincau /
-- Malay Mail / carbase.my / zigwheels.my on 2026-10-08. Where the owner's file
-- disagreed, the published price wins:
--   Myvi      file 48,341-62,160 and wrong variant names; Perodua lists
--             1.3 G no PSDA 46,500 / 1.3 G 48,500 / 1.5 X 50,900 / 1.5 H 54,900 / 1.5 AV 59,900
--   Bezza     1.0 G Auto 38,145 -> 36,580; 1.3 X 45,766 -> 43,980
--   Alza      1.5 H 70,481 (a ~2-year-old dealer page) -> 68,000
--   Ativa     1.0 Turbo H 69,720 -> 67,300
--   QV-E      the file's 53,499 / 77,499 were a promotion that ended 30 Sep 2026.
--             Standard full purchase is 93,999. The BaaS price (69,999) is left
--             out: it excludes a RM215/month battery rental, so a monthly
--             instalment worked from it would understate what the buyer pays.
-- Axia also gets its official East Malaysia prices (Perodua, 3 Aug 2026 cut).
-- No rebates are stored (they change monthly; the presenter's rebate box is for that).

insert into public.new_car_models
  (brand, model, variant, body_type, fuel_type, transmission, price_peninsular, price_sabah_sarawak, effective_from, source_url, sort_order, specs)
values
  ('Perodua','Axia','1.0 E Manual','Hatchback','Petrol','5-speed manual',22000,null,'2026-08-03','https://paultan.org/2026/06/23/perodua-axia-price-variants-specs-guide/',10,'{"engine":"1.0L 3-cyl","power_ps":67,"torque_nm":91,"seats":5}'),
  ('Perodua','Axia','1.0 G','Hatchback','Petrol','D-CVT',33900,35900,'2026-08-03','https://www.malaymail.com/news/money/2026/08/03/perodua-slashes-axia-prices-by-up-to-rm4700-effective-immediately-nationwide/230056',10,'{"engine":"1.0L 3-cyl","power_ps":67,"torque_nm":91,"seats":5}'),
  ('Perodua','Axia','1.0 X','Hatchback','Petrol','D-CVT',38500,40500,'2026-08-03','https://www.malaymail.com/news/money/2026/08/03/perodua-slashes-axia-prices-by-up-to-rm4700-effective-immediately-nationwide/230056',10,'{"engine":"1.0L 3-cyl","power_ps":67,"torque_nm":91,"seats":5}'),
  ('Perodua','Axia','1.0 SE','Hatchback','Petrol','D-CVT',43000,45000,'2026-08-03','https://www.malaymail.com/news/money/2026/08/03/perodua-slashes-axia-prices-by-up-to-rm4700-effective-immediately-nationwide/230056',10,'{"engine":"1.0L 3-cyl","power_ps":67,"torque_nm":91,"seats":5}'),
  ('Perodua','Axia','1.0 AV','Hatchback','Petrol','D-CVT',49000,51000,'2026-08-03','https://www.malaymail.com/news/money/2026/08/03/perodua-slashes-axia-prices-by-up-to-rm4700-effective-immediately-nationwide/230056',10,'{"engine":"1.0L 3-cyl","power_ps":67,"torque_nm":91,"seats":5}'),
  ('Perodua','Bezza','1.0 G Manual','Sedan','Petrol','5-speed manual',34580,null,'2026-10-08','https://paultan.org/research/perodua/bezza/',20,'{"engine":"1.0L 3-cyl","power_ps":67,"torque_nm":91,"seats":5}'),
  ('Perodua','Bezza','1.0 G Auto','Sedan','Petrol','4-speed auto',36580,null,'2026-10-08','https://paultan.org/research/perodua/bezza/',20,'{"engine":"1.0L 3-cyl","power_ps":67,"torque_nm":91,"seats":5}'),
  ('Perodua','Bezza','1.3 X','Sedan','Petrol','4-speed auto',43980,null,'2026-10-08','https://paultan.org/research/perodua/bezza/',20,'{"engine":"1.3L 4-cyl","power_ps":95,"torque_nm":121,"seats":5}'),
  ('Perodua','Bezza','1.3 AV','Sedan','Petrol','4-speed auto',49980,null,'2026-10-08','https://paultan.org/research/perodua/bezza/',20,'{"engine":"1.3L 4-cyl","power_ps":95,"torque_nm":121,"seats":5}'),
  ('Perodua','Myvi','1.3 G (no PSDA)','Hatchback','Petrol','D-CVT',46500,null,'2026-10-08','https://paultan.org/research/perodua/myvi/',30,'{"engine":"1.3L 4-cyl","power_ps":94,"torque_nm":121,"seats":5}'),
  ('Perodua','Myvi','1.3 G','Hatchback','Petrol','D-CVT',48500,null,'2026-10-08','https://paultan.org/research/perodua/myvi/',30,'{"engine":"1.3L 4-cyl","power_ps":94,"torque_nm":121,"seats":5}'),
  ('Perodua','Myvi','1.5 X','Hatchback','Petrol','D-CVT',50900,null,'2026-10-08','https://paultan.org/research/perodua/myvi/',30,'{"engine":"1.5L 4-cyl","power_ps":102,"torque_nm":136,"seats":5}'),
  ('Perodua','Myvi','1.5 H','Hatchback','Petrol','D-CVT',54900,null,'2026-10-08','https://paultan.org/research/perodua/myvi/',30,'{"engine":"1.5L 4-cyl","power_ps":102,"torque_nm":136,"seats":5}'),
  ('Perodua','Myvi','1.5 AV','Hatchback','Petrol','D-CVT',59900,null,'2026-10-08','https://paultan.org/research/perodua/myvi/',30,'{"engine":"1.5L 4-cyl","power_ps":102,"torque_nm":136,"seats":5}'),
  ('Perodua','Alza','1.5 X','MPV','Petrol','D-CVT',62500,null,'2026-10-08','https://paultan.org/research/perodua/alza/',40,'{"engine":"1.5L 4-cyl","power_ps":105,"torque_nm":138,"seats":7}'),
  ('Perodua','Alza','1.5 H','MPV','Petrol','D-CVT',68000,null,'2026-10-08','https://paultan.org/research/perodua/alza/',40,'{"engine":"1.5L 4-cyl","power_ps":105,"torque_nm":138,"seats":7}'),
  ('Perodua','Alza','1.5 AV','MPV','Petrol','D-CVT',75500,null,'2026-10-08','https://paultan.org/research/perodua/alza/',40,'{"engine":"1.5L 4-cyl","power_ps":105,"torque_nm":138,"seats":7}'),
  ('Perodua','Ativa','1.0 Turbo X','SUV','Petrol','D-CVT',62500,null,'2026-10-08','https://www.carbase.my/perodua/ativa/d55l/1.0-h-cvt-2026',50,'{"engine":"1.0L turbo","power_ps":97,"torque_nm":140,"seats":5}'),
  ('Perodua','Ativa','1.0 Turbo H','SUV','Petrol','D-CVT',67300,null,'2026-10-08','https://www.carbase.my/perodua/ativa/d55l/1.0-h-cvt-2026',50,'{"engine":"1.0L turbo","power_ps":97,"torque_nm":140,"seats":5}'),
  ('Perodua','Ativa','1.0 Turbo AV','SUV','Petrol','D-CVT',73400,null,'2026-10-08','https://www.carbase.my/perodua/ativa/d55l/1.0-av-cvt-2026',50,'{"engine":"1.0L turbo","power_ps":97,"torque_nm":140,"seats":5}'),
  ('Perodua','Aruz','1.5 X','SUV','Petrol','4-speed auto',68900,null,'2026-09-17','https://paultan.org/2026/09/17/perodua-aruz-now-priced-at-rm69k-74k-rm4k-cheaper-across-the-range-additional-rm4k-malaysia-day-rebate/',60,'{"engine":"1.5L 4-cyl","power_ps":101,"torque_nm":133,"seats":7}'),
  ('Perodua','Aruz','1.5 AV','SUV','Petrol','4-speed auto',73900,null,'2026-09-17','https://paultan.org/2026/09/17/perodua-aruz-now-priced-at-rm69k-74k-rm4k-cheaper-across-the-range-additional-rm4k-malaysia-day-rebate/',60,'{"engine":"1.5L 4-cyl","power_ps":101,"torque_nm":133,"seats":7}'),
  ('Perodua','Traz','1.5 X','SUV','Petrol','CVT',76100,null,'2026-10-08','https://paultan.org/research/perodua/traz/',70,'{"engine":"1.5L 4-cyl","power_ps":106,"torque_nm":138,"seats":5}'),
  ('Perodua','Traz','1.5 H','SUV','Petrol','CVT',81100,null,'2026-10-08','https://paultan.org/research/perodua/traz/',70,'{"engine":"1.5L 4-cyl","power_ps":106,"torque_nm":138,"seats":5}'),
  ('Perodua','Traz','1.5 H Two-tone','SUV','Petrol','CVT',82000,null,'2026-10-08','https://paultan.org/research/perodua/traz/',70,'{"engine":"1.5L 4-cyl","power_ps":106,"torque_nm":138,"seats":5}'),
  ('Perodua','QV-E','Full purchase','SUV','Electric',null,93999,null,'2026-10-08','https://www.wapcar.my/news/own-a-perodua-qv-e-from-rm-63499-now-available-for-full-purchase-754037',80,'{"battery_kwh":52.5,"range_km":370,"power_ps":204,"seats":5}')
on conflict (brand, model, variant) do nothing;
