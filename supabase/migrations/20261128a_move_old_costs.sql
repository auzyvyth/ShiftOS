-- COSTS-1 step 2: move the older repair (recon_jobs) and ad (ad_spend) rows into car_costs.
-- QUEUED for the PRODUCTION RELEASE night of the cost list, not before: production's current app
-- still reads recon_jobs / ad_spend, so moving them earlier hides those costs there until it updates.
-- The new app reads all three tables, so before and after this runs it shows the same numbers.
-- Live on 2026-11-28: 5 recon_jobs rows, 3 ad_spend rows. A row with no amount (cost null or 0)
-- is not a cost and stays where it is. paid_at becomes the move time (the guard trigger stamps it).
-- The old tables are dropped in a later migration, once nothing reads them.
begin;

insert into public.car_costs (dealer_id, stock_unit_id, kind, label, payee, amount, state, cost_date, created_at)
select j.dealer_id, j.stock_unit_id,
       case when j.category in ('wash', 'polish') then 'detailing' when j.category = 'inspection' then 'inspection' else 'recon' end,
       left(coalesce(nullif(btrim(j.title), ''), 'Repair'), 80), left(nullif(btrim(j.vendor), ''), 80), j.cost,
       case when j.status = 'done' then 'paid' else 'estimate' end,
       coalesce(j.completed_at, j.created_at)::date, j.created_at
  from public.recon_jobs j
 where j.cost > 0 and j.stock_unit_id is not null;
delete from public.recon_jobs where cost > 0 and stock_unit_id is not null;

insert into public.car_costs (dealer_id, stock_unit_id, kind, label, amount, state, cost_date, created_at)
select a.dealer_id, a.stock_unit_id, 'ads',
       left('Ads, ' || coalesce(initcap(nullif(btrim(a.channel), '')), 'other'), 80), a.amount, 'paid',
       coalesce(a.spent_at, a.created_at::date), a.created_at
  from public.ad_spend a
 where a.amount > 0 and a.stock_unit_id is not null;
delete from public.ad_spend where amount > 0 and stock_unit_id is not null;

commit;
-- Check after: select count(*) from car_costs (8 more); recon_jobs and ad_spend 0 rows with an amount;
-- Overview's gross for the month unchanged (the screens read all three tables, so totals do not move).
