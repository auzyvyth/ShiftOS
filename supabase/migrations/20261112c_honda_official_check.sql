-- NEWCAR: Honda rows checked against Honda Malaysia's own pricing pages (owner, 2026-11-12).
-- DATA ONLY (no DDL), so no API freeze.
--
-- Source: honda.com.my/model/<model>/pricing, Peninsular, "Retail Price Without Insurance".
-- 23 of 24 prices already matched exactly (City, City Hatchback, WR-V, HR-V, Civic, CR-V,
-- Prelude, Civic Type R). Honda's site lists exactly these 9 models; the Civic Type R is still
-- on it at RM399,900.
--
-- e:N1: the page now shows RM150,060 (selling price 149,402 + handling 50 + road tax 160 +
-- registration 300 + plate 98 + endorsement 50). 20261022c loaded RM149,900, the launch price
-- from the press release, when an EV paid no road tax. Every other row is on-the-road WITHOUT
-- insurance including road tax, so the e:N1 follows the same rule.
--
-- Zone prices (Sabah & Sarawak / Labuan / Langkawi) exist on those pages but only in
-- script-driven tabs, so none are loaded here; those zones keep showing "ask".

update public.new_car_models
   set price_peninsular = 150060
 where brand = 'Honda' and model = 'e:N1' and variant = 'Standard';

update public.new_car_models set source_url = 'https://www.honda.com.my/model/city/pricing'           where brand = 'Honda' and model = 'City';
update public.new_car_models set source_url = 'https://www.honda.com.my/model/city-hatchback/pricing' where brand = 'Honda' and model = 'City Hatchback';
update public.new_car_models set source_url = 'https://www.honda.com.my/model/wr-v/pricing'           where brand = 'Honda' and model = 'WR-V';
update public.new_car_models set source_url = 'https://www.honda.com.my/model/hrv/pricing'            where brand = 'Honda' and model = 'HR-V';
update public.new_car_models set source_url = 'https://www.honda.com.my/model/civic/pricing'          where brand = 'Honda' and model = 'Civic';
update public.new_car_models set source_url = 'https://www.honda.com.my/model/crv/pricing'            where brand = 'Honda' and model = 'CR-V';
update public.new_car_models set source_url = 'https://www.honda.com.my/model/en1/pricing'            where brand = 'Honda' and model = 'e:N1';
update public.new_car_models set source_url = 'https://www.honda.com.my/model/prelude/pricing'        where brand = 'Honda' and model = 'Prelude';
update public.new_car_models set source_url = 'https://www.honda.com.my/model/type-r/pricing'         where brand = 'Honda' and model = 'Civic Type R';
