-- COSTS-1 step 2: move the older repair (recon_jobs) and ad (ad_spend) rows into car_costs.
-- QUEUED (owner said apply when safe, 2026-11-28). Tried at 00:55 MYT: the first version was refused by
-- car_costs_guard (an orphan row, see below) and rolled back; this version timed out waiting for the
-- delete confirmation in the tool and did NOT run. Apply after midnight MYT with nobody live, confirm the
-- prompt. Until production gets the new app, its old screens stop listing these rows (repairs still count).
-- The new app reads all three tables, so before and after this runs it shows the same numbers.
-- Live on 2026-11-28: 5 recon_jobs rows, 3 ad_spend rows. A row with no amount (cost null or 0)
-- is not a cost and stays where it is, and so does a row whose car is gone or belongs to another
-- dealer (one live orphan: a repair on a deleted stock record; it counted nowhere and is left as is). paid_at becomes the move time (the guard trigger stamps it).
-- The old tables are dropped in a later migration, once nothing reads them.
begin;

insert into public.car_costs (dealer_id, stock_unit_id, kind, label, payee, amount, state, cost_date, created_at)
select j.dealer_id, j.stock_unit_id,
       case when j.category in ('wash', 'polish') then 'detailing' when j.category = 'inspection' then 'inspection' else 'recon' end,
       left(coalesce(nullif(btrim(j.title), ''), 'Repair'), 80), left(nullif(btrim(j.vendor), ''), 80), j.cost,
       case when j.status = 'done' then 'paid' else 'estimate' end,
       coalesce(j.completed_at, j.created_at)::date, j.created_at
  from public.recon_jobs j
 where j.cost > 0 and exists (select 1 from public.stock_units s where s.id = j.stock_unit_id and s.dealer_id = j.dealer_id);
delete from public.recon_jobs j where j.cost > 0 and exists (select 1 from public.stock_units s where s.id = j.stock_unit_id and s.dealer_id = j.dealer_id);

insert into public.car_costs (dealer_id, stock_unit_id, kind, label, amount, state, cost_date, created_at)
select a.dealer_id, a.stock_unit_id, 'ads',
       left('Ads, ' || coalesce(initcap(nullif(btrim(a.channel), '')), 'other'), 80), a.amount, 'paid',
       coalesce(a.spent_at, a.created_at::date), a.created_at
  from public.ad_spend a
 where a.amount > 0 and exists (select 1 from public.stock_units s where s.id = a.stock_unit_id and s.dealer_id = a.dealer_id);
delete from public.ad_spend a where a.amount > 0 and exists (select 1 from public.stock_units s where s.id = a.stock_unit_id and s.dealer_id = a.dealer_id);

commit;
-- Check after: car_costs +7, one orphan repair row left in recon_jobs; recon_jobs and ad_spend 0 rows with an amount;
-- Overview's gross for the month unchanged (the screens read all three tables, so totals do not move).
