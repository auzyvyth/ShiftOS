-- One profit figure per car (TODO DMS-AUDIT part 4, batch 3). Owner, 2026-11-09.
-- Apply AFTER 20261109c + 20261109d, 00:00-09:00 MYT, nobody live. ONE migration = one API freeze.
--
-- Before this, one sold car had up to five different "profits":
--   * deal_financials booked the WHOLE price as profit (fn_auto_deal_financial copied only
--     selling_price; costs fell to their default 0; 43 of 51 rows), and its generated
--     gross_profit left commission out;
--   * stock_units.gross_profit was filled for UNSOLD cars too (0 - costs = a big negative);
--   * logging one RM800 recon job replaced a RM2,500 estimate on the P&L (profit went UP);
--   * gm_pnl_snapshot (Overview / Oversight / RevOps) re-did the sum itself.
-- After: stock_units.gross_profit is THE figure (sold cars only), deal_financials mirrors
-- its costs, gm_pnl_snapshot reads it. Handover fees / ad spend / holding cost stay in the
-- per-car P&L modal on top (it labels them), they are not in the stored figure.
--
-- Recon rule (one place, stock_recon_effective): the LARGER of the estimate and the logged
-- jobs. A job never lowers the cost; if the real cost came in under the estimate, the owner
-- lowers the estimate. Client mirror: src/utils/reconCost.js.
--
-- Also: gm_pnl_snapshot let ANY account of the dealer (a linked salesman too) read the P&L.
-- Now money roles only (can_see_dealer_stock, from 20261109c) or superadmin.

begin;

-- ── 1. Recon: cached sum of the logged jobs + the one rule ─────────────────
alter table public.stock_units add column if not exists recon_actual numeric;
comment on column public.stock_units.recon_actual is
  'Sum of recon_jobs.cost for this unit (NULL = no jobs). Written by compute_stock_unit_gp, never by a client.';

create or replace function public.stock_recon_effective(p_estimate numeric, p_actual numeric)
returns numeric language sql immutable
set search_path to 'pg_catalog'
as $$ select greatest(coalesce(p_estimate, 0), coalesce(p_actual, 0)) $$;

-- ── 2. The figure itself ──────────────────────────────────────────────────
-- Definer: an accountant edits stock but cannot read recon_jobs, and an invoker sum
-- would then come back NULL. Only jobs of the unit's OWN dealer count (a job row's
-- stock_unit_id proves nothing, DMS lesson 4).
create or replace function public.compute_stock_unit_gp()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_services numeric := 0;
  v_commission numeric := 0;
begin
  select sum(coalesce(j.cost, 0)) into new.recon_actual
    from recon_jobs j
   where j.stock_unit_id = new.id and j.dealer_id = new.dealer_id;

  if new.status is distinct from 'sold' then
    new.gross_profit := null;          -- no sale, no profit
    return new;
  end if;

  if new.listing_id is not null then
    select coalesce(included_services_cost, 0), coalesce(commission_amount, 0)
      into v_services, v_commission
      from car_listings where id = new.listing_id and dealer_id = new.dealer_id;
  end if;

  new.gross_profit := coalesce(new.sold_price, 0)
                    - coalesce(new.purchase_price, 0)
                    - stock_recon_effective(new.recon_cost, new.recon_actual)
                    - coalesce(v_services, 0)
                    - coalesce(v_commission, 0);
  return new;
end;
$$;
revoke all on function public.compute_stock_unit_gp() from public, anon, authenticated;

-- A recon job added, edited or deleted re-runs the figure on its unit.
create or replace function public.recon_job_touch_unit()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare r record;
begin
  r := coalesce(new, old);
  update stock_units set updated_at = now()
   where id = r.stock_unit_id and dealer_id = r.dealer_id;
  if tg_op = 'UPDATE' and old.stock_unit_id is distinct from new.stock_unit_id then
    update stock_units set updated_at = now()
     where id = old.stock_unit_id and dealer_id = old.dealer_id;
  end if;
  return null;
end;
$$;
revoke all on function public.recon_job_touch_unit() from public, anon, authenticated;

drop trigger if exists trg_recon_job_touch_unit on public.recon_jobs;
create trigger trg_recon_job_touch_unit
  after insert or update or delete on public.recon_jobs
  for each row execute function public.recon_job_touch_unit();

-- ── 3. deal_financials copies the real costs ─────────────────────────────
-- Generated profit now takes commission off too.
alter table public.deal_financials drop column gross_profit;
alter table public.deal_financials add column gross_profit numeric
  generated always as (coalesce(selling_price, 0) - coalesce(purchase_price, 0)
                       - coalesce(recon_cost, 0) - coalesce(included_services_cost, 0)
                       - coalesce(commission_amount, 0)) stored;

create or replace function public.fn_auto_deal_financial()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  su record;
  ld record;
begin
  if new.status = 'sold' and (old.status is distinct from 'sold') then
    select purchase_price, recon_cost, recon_actual into su
      from stock_units where listing_id = new.id and dealer_id = new.dealer_id;
    select deposit_amount, deposit_date into ld
      from leads
     where car_listing_id = new.id and stage in ('won','closed_won') and is_deleted is not true
     order by updated_at desc limit 1;

    insert into deal_financials (dealer_id, listing_id, salesman_id, selling_price,
                                 purchase_price, recon_cost, included_services_cost,
                                 commission_amount, deposit_received, deposit_date, created_at)
    values (new.dealer_id, new.id, new.assigned_to,
            coalesce(new.sold_price, new.selling_price, 0),
            coalesce(su.purchase_price, 0),
            stock_recon_effective(su.recon_cost, su.recon_actual),
            coalesce(new.included_services_cost, 0),
            coalesce(new.commission_amount, 0),
            coalesce(ld.deposit_amount, 0), ld.deposit_date, now())
    on conflict (listing_id) do update set          -- a re-sale after Undo sale
      salesman_id            = excluded.salesman_id,
      selling_price          = excluded.selling_price,
      purchase_price         = excluded.purchase_price,
      recon_cost             = excluded.recon_cost,
      included_services_cost = excluded.included_services_cost,
      commission_amount      = excluded.commission_amount,
      -- an amount the accountant already typed wins over the lead's
      deposit_received       = case when deal_financials.deposit_received > 0
                                    then deal_financials.deposit_received
                                    else excluded.deposit_received end,
      deposit_date           = coalesce(deal_financials.deposit_date, excluded.deposit_date);
  end if;
  return new;
end;
$$;

-- A cost corrected on the stock unit after the sale reaches the deal row.
create or replace function public.sync_stock_costs_to_deal()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if new.status = 'sold' and new.listing_id is not null then
    update deal_financials
       set purchase_price = coalesce(new.purchase_price, 0),
           recon_cost     = stock_recon_effective(new.recon_cost, new.recon_actual),
           selling_price  = coalesce(new.sold_price, selling_price)
     where listing_id = new.listing_id and dealer_id = new.dealer_id;
  end if;
  return null;
end;
$$;
revoke all on function public.sync_stock_costs_to_deal() from public, anon, authenticated;

drop trigger if exists trg_sync_stock_costs_to_deal on public.stock_units;
create trigger trg_sync_stock_costs_to_deal
  after update on public.stock_units
  for each row
  when (old.purchase_price is distinct from new.purchase_price
     or old.recon_cost     is distinct from new.recon_cost
     or old.recon_actual   is distinct from new.recon_actual
     or old.sold_price     is distinct from new.sold_price
     or old.status         is distinct from new.status)
  execute function public.sync_stock_costs_to_deal();

-- ── 4. New stock unit carries the plate and the buy price ───────────────
create or replace function public.auto_create_stock_unit()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not exists (select 1 from stock_units where listing_id = new.id) then
    insert into stock_units (
      dealer_id, listing_id, brand, model, year, variant,
      colour, mileage, transmission, fuel_type, body_type,
      engine_cc, is_recon, vin_number, registration_number, asking_price,
      purchase_price, recon_cost, status
    ) values (
      new.dealer_id, new.id, new.brand, new.model, new.year, new.variant,
      new.colour, new.mileage, new.transmission, new.fuel_type, new.body_type,
      new.engine_cc, new.is_recon, new.vin_number, nullif(btrim(new.plate_number), ''),
      new.selling_price,
      coalesce(nullif(new.purchase_price, 0), new.base_price, 0),
      coalesce(new.recon_cost, 0), 'in_stock'
    );
  end if;
  return new;
end;
$$;

-- ── 5. gm_pnl_snapshot: role check + reads the one figure ────────────────
create or replace function public.gm_pnl_snapshot(p_dealer_id uuid)
returns jsonb language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur';
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur';
  v_last_month_start timestamptz := v_month_start - interval '1 month';
  v_year_start timestamptz := date_trunc('year', now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur';
  v_lmtd_end timestamptz;
  v_result jsonb;
  v_daily_sparkline jsonb;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;
  if not (can_see_dealer_stock(p_dealer_id) or is_superadmin()) then
    raise exception 'Forbidden';
  end if;

  v_lmtd_end := v_last_month_start + (v_today_start - v_month_start) + interval '1 day';

  select jsonb_agg(jsonb_build_object('d', d::date, 'rev', coalesce(rev, 0)) order by d)
    into v_daily_sparkline
    from generate_series(
      (date_trunc('day', now() at time zone 'Asia/Kuala_Lumpur') - interval '29 days')::date,
      (date_trunc('day', now() at time zone 'Asia/Kuala_Lumpur'))::date,
      interval '1 day') d
    left join (
      select date_trunc('day', sold_date at time zone 'Asia/Kuala_Lumpur')::date as day, sum(sold_price) as rev
        from stock_units
       where dealer_id = p_dealer_id and status = 'sold' and sold_date >= (now() - interval '30 days')
       group by 1
    ) s on s.day = d::date;

  -- Units sold without a buy price still count for revenue + units, but not for GP or
  -- the margin (their whole price would read as profit); *_costed lets the UI say so.
  with sold as (
    select su.sold_date, su.sold_price,
           (coalesce(su.purchase_price, 0) > 0) as has_cost,
           su.gross_profit
      from stock_units su
     where su.dealer_id = p_dealer_id and su.status = 'sold'
  ),
  mtd as (
    select count(*) as units,
           coalesce(sum(sold_price), 0) as revenue,
           count(*) filter (where has_cost) as units_costed,
           coalesce(sum(sold_price) filter (where has_cost), 0) as revenue_costed,
           coalesce(sum(gross_profit) filter (where has_cost), 0) as gross_profit
      from sold where sold_date >= v_month_start
  ),
  lmtd as (
    select count(*) as units, coalesce(sum(sold_price), 0) as revenue,
           coalesce(sum(gross_profit) filter (where has_cost), 0) as gross_profit
      from sold where sold_date >= v_last_month_start and sold_date < v_lmtd_end
  ),
  today as (
    select count(*) as units, coalesce(sum(sold_price), 0) as revenue,
           coalesce(sum(gross_profit) filter (where has_cost), 0) as gross_profit
      from sold where sold_date >= v_today_start
  ),
  ytd as (
    select count(*) as units, coalesce(sum(sold_price), 0) as revenue,
           coalesce(sum(gross_profit) filter (where has_cost), 0) as gross_profit
      from sold where sold_date >= v_year_start
  ),
  inventory as (
    select count(*) filter (where status = 'in_stock') as in_stock,
           count(*) filter (where status = 'in_stock' and purchase_date < now() - interval '60 days') as aged_60,
           count(*) filter (where status = 'in_stock' and coalesce(purchase_price, 0) = 0) as missing_cost,
           coalesce(sum(coalesce(purchase_price, 0) + stock_recon_effective(recon_cost, recon_actual))
                    filter (where status = 'in_stock'), 0) as capital_tied
      from stock_units where dealer_id = p_dealer_id
  )
  select jsonb_build_object(
    'today', jsonb_build_object('units', today.units, 'revenue', today.revenue, 'gross_profit', today.gross_profit),
    'mtd',   jsonb_build_object(
               'units', mtd.units, 'revenue', mtd.revenue, 'gross_profit', mtd.gross_profit,
               'units_costed', mtd.units_costed, 'revenue_costed', mtd.revenue_costed,
               'avg_margin', case when mtd.revenue_costed > 0
                                  then round((mtd.gross_profit::numeric / mtd.revenue_costed) * 100, 1) else 0 end),
    'lmtd',  jsonb_build_object('units', lmtd.units, 'revenue', lmtd.revenue, 'gross_profit', lmtd.gross_profit),
    'ytd',   jsonb_build_object('units', ytd.units, 'revenue', ytd.revenue, 'gross_profit', ytd.gross_profit),
    'inventory', jsonb_build_object('in_stock', inventory.in_stock, 'aged_60', inventory.aged_60,
                                    'missing_cost', inventory.missing_cost, 'capital_tied', inventory.capital_tied),
    'sparkline', v_daily_sparkline
  ) into v_result from mtd, lmtd, today, ytd, inventory;

  return v_result;
end;
$function$;
revoke all on function public.gm_pnl_snapshot(uuid) from public, anon;
grant execute on function public.gm_pnl_snapshot(uuid) to authenticated;

-- ── 6. Backfill ──────────────────────────────────────────────────────────
-- Re-run the figure on every unit (sets recon_actual, NULLs unsold GP). The activity log
-- trigger is paused so this does not write ~100 "stock unit updated" rows.
alter table public.stock_units disable trigger trg_activity_stock_units;
update public.stock_units su
   set registration_number = coalesce(su.registration_number, nullif(btrim(c.plate_number), '')),
       updated_at = su.updated_at
  from public.car_listings c
 where c.id = su.listing_id;
update public.stock_units set updated_at = updated_at where listing_id is null;
alter table public.stock_units enable trigger trg_activity_stock_units;

-- deal rows: costs from the unit, commission + services from the car, deposit from the won lead.
update public.deal_financials df
   set purchase_price         = coalesce(su.purchase_price, 0),
       recon_cost             = public.stock_recon_effective(su.recon_cost, su.recon_actual),
       selling_price          = coalesce(su.sold_price, c.sold_price, df.selling_price),
       included_services_cost = coalesce(c.included_services_cost, 0),
       commission_amount      = case when df.commission_amount > 0 then df.commission_amount
                                     else coalesce(c.commission_amount, 0) end,
       deposit_received       = case when df.deposit_received > 0 then df.deposit_received
                                     else coalesce((select l.deposit_amount from public.leads l
                                                     where l.car_listing_id = df.listing_id
                                                       and l.stage in ('won','closed_won')
                                                       and l.is_deleted is not true
                                                     order by l.updated_at desc limit 1), 0) end
  from public.car_listings c
  left join public.stock_units su on su.listing_id = c.id and su.dealer_id = c.dealer_id
 where c.id = df.listing_id and c.dealer_id = df.dealer_id;

commit;

-- ============================ PROBES (after apply) ==========================================
-- a) unsold units with a profit (expect 0):
--    select count(*) from stock_units where status <> 'sold' and gross_profit is not null;
-- b) deal rows still costed at 0 where the unit has a buy price (expect 0):
--    select count(*) from deal_financials df join stock_units su on su.listing_id = df.listing_id
--     where su.purchase_price > 0 and df.purchase_price = 0;
-- c) the RM800-job car: recon_actual 800, effective recon 2,500 (estimate kept):
--    select recon_cost, recon_actual, stock_recon_effective(recon_cost, recon_actual), gross_profit
--      from stock_units where recon_actual = 800;
-- d) deal GP = unit GP for every sold car (expect 0 rows):
--    select df.listing_id from deal_financials df join stock_units su on su.listing_id = df.listing_id
--     where su.status = 'sold' and su.purchase_price > 0 and df.gross_profit <> su.gross_profit;
--    (a car whose commission the accountant edited on the deal row can differ: that is the
--     deal row's own commission, see TODO batch 6.)
-- e) as a linked salesman (set local role + request.jwt.claims in a DO block that raises):
--    select gm_pnl_snapshot('<dealer>') -> Forbidden.
-- f) plate: select count(*) from stock_units su join car_listings c on c.id = su.listing_id
--     where nullif(btrim(c.plate_number),'') is not null and su.registration_number is null;  -- 0
-- ROLLBACK: the previous bodies of compute_stock_unit_gp, fn_auto_deal_financial,
--   auto_create_stock_unit and gm_pnl_snapshot are in git history (live dump in the batch-3
--   commit message); drop triggers trg_recon_job_touch_unit + trg_sync_stock_costs_to_deal.
--   The backfilled deal costs are correct data and are not reverted.
