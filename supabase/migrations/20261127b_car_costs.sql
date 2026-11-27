-- COSTS-1: one list of what each car cost (owner approved the mockup, 2026-11-27).
-- QUEUED, not applied (DDL after midnight MYT, nobody live).
--
-- One row = one cost on one car: what it was for (kind), who was paid, the amount, and how sure
-- we are of it (estimate = not done yet, owed = bill received, paid = money out). The buy price
-- stays on stock_units.purchase_price; this table holds everything spent AFTER buying.
-- ADDITIVE on purpose: staging and production share this database, and production still writes
-- recon_jobs / ad_spend. Those rows keep counting (the app reads all three; the GP trigger sums
-- both repair sources), so applying this changes no number on any screen. Moving the old rows
-- in and retiring the old tables is a later, separate migration.
begin;

create table public.car_costs (
  id            uuid primary key default gen_random_uuid(),
  dealer_id     uuid not null references public.profiles(id) on delete cascade,
  stock_unit_id uuid not null references public.stock_units(id) on delete cascade,
  kind          text not null check (kind in ('recon', 'detailing', 'transport', 'inspection', 'ads', 'other')),
  label         text not null check (length(btrim(label)) between 1 and 80),
  payee         text check (payee is null or length(payee) <= 80),
  vendor_id     uuid references public.vendors(id) on delete set null,
  amount        numeric(12, 2) not null check (amount > 0 and amount < 10000000),
  state         text not null default 'paid' check (state in ('estimate', 'owed', 'paid')),
  cost_date     date not null default ((now() at time zone 'Asia/Kuala_Lumpur')::date),
  due_date      date,
  paid_at       timestamptz,
  note          text check (note is null or length(note) <= 200),
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index car_costs_unit_idx on public.car_costs (stock_unit_id);
create index car_costs_dealer_state_idx on public.car_costs (dealer_id, state);

-- A row's own ids prove nothing (CLAUDE.md DMS lesson 4): the car and the supplier must be this dealer's.
create or replace function public.car_costs_guard() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not exists (select 1 from stock_units s where s.id = new.stock_unit_id and s.dealer_id = new.dealer_id) then
    raise exception 'car_costs_wrong_car';
  end if;
  if new.vendor_id is not null and not exists (select 1 from vendors v where v.id = new.vendor_id and v.dealer_id = new.dealer_id) then
    raise exception 'car_costs_wrong_vendor';
  end if;
  if tg_op = 'INSERT' then new.created_by := auth.uid(); else new.created_by := old.created_by; new.created_at := old.created_at; end if;
  new.paid_at := case when new.state = 'paid' then coalesce(case when tg_op = 'UPDATE' and old.state = 'paid' then old.paid_at end, now()) end;
  if new.state <> 'owed' then new.due_date := null; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_car_costs_guard before insert or update on public.car_costs
  for each row execute function public.car_costs_guard();
-- Re-runs compute_stock_unit_gp on the car, the same way recon_jobs does (recon_job_touch_unit).
create trigger trg_car_costs_touch_unit after insert or update or delete on public.car_costs
  for each row execute function public.recon_job_touch_unit();

alter table public.car_costs enable row level security;
-- Same people who see the car's Owner tab: owner, accountant, manager/admin with the cost switch.
create policy car_costs_cost_roles on public.car_costs for all
  using (public.can_see_dealer_stock(dealer_id)) with check (public.can_see_dealer_stock(dealer_id));
revoke all on public.car_costs from anon;
grant select, insert, update, delete on public.car_costs to authenticated;
revoke all on function public.car_costs_guard() from public, anon, authenticated;

-- Sold-car GP (Accountant): repairs now come from recon_jobs AND car_costs repair rows (kind recon,
-- detailing; mirrored in src/utils/carCosts.js RECON_KINDS). Otherwise identical to the live function.
create or replace function public.compute_stock_unit_gp() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_services numeric := 0; v_commission numeric := 0;
begin
  new.recon_actual := nullif(
      coalesce((select sum(coalesce(j.cost, 0)) from recon_jobs j where j.stock_unit_id = new.id and j.dealer_id = new.dealer_id), 0)
    + coalesce((select sum(c.amount) from car_costs c where c.stock_unit_id = new.id and c.dealer_id = new.dealer_id and c.kind in ('recon', 'detailing')), 0), 0);
  if new.status is distinct from 'sold' then new.gross_profit := null; return new; end if;
  if new.listing_id is not null then
    select coalesce(included_services_cost, 0), coalesce(commission_amount, 0) into v_services, v_commission
      from car_listings where id = new.listing_id and dealer_id = new.dealer_id;
  end if;
  new.gross_profit := coalesce(new.sold_price, 0) - coalesce(new.purchase_price, 0)
    - stock_recon_effective(new.recon_cost, new.recon_actual) - coalesce(v_services, 0) - coalesce(v_commission, 0);
  return new;
end $$;

commit;
-- After applying: get_advisors (security); has_table_privilege('anon','public.car_costs','select') = false;
-- probe in a rolled-back transaction: owner inserts a row (ok), a row naming another dealer's car is
-- refused (car_costs_wrong_car), a linked salesman reads 0 rows, recon_actual moves with a repair row.
