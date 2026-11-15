-- 20261116e: APPLIED 2026-11-15 ~13:00 UTC (emergency correction of 20261116d).
-- 20261116d added leads.dealer_car_id -> car_listings and leads.via_broker_id -> profiles as foreign keys.
-- A second leads -> car_listings key made every plain `car_listings(...)` embed on leads ambiguous
-- (PostgREST PGRST201), so the leads fetch failed in Lite, Premium, linked, manager, accountant and CRM
-- panels and they kept showing their saved copy (stages "went back to New"). Display-only columns: no foreign key.
alter table public.leads drop constraint if exists leads_dealer_car_id_fkey;
alter table public.leads drop constraint if exists leads_via_broker_id_fkey;
