-- A dealer's buy price and recon cost live on the stock record only (TODO DMS-AUDIT part 4,
-- batch 4). Owner, 2026-11-09.
-- Apply AFTER 20261109c, d, e (needs can_see_dealer_stock from c, stock_recon_effective and
-- the batch-3 auto_create_stock_unit from e). 00:00-09:00 MYT, nobody live. ONE API freeze.
--
-- What it does: a dealer car's buy price and recon cost are kept on the stock record only
-- (dealer / accountant / manager, batch 1). The listing is read by the whole team, so the
-- cost columns on it are emptied for DEALER cars and never filled there again. Also scoped
-- to the same money roles: the activity log (it records cost edits) and gm_exception_alerts
-- (it lists costs).
--
-- Solo sellers (role 'salesman', dealer_id NULL) are untouched: only they can read their own
-- cars, and base_price IS their cost (solo_commission_is_margin reads it).
--
-- Where the two disagree the stock record wins (it is the money record; batch 3 makes its
-- gross_profit THE profit). Step 0 aborts if any dealer car's cost has no stock record.

begin;

-- ── 0. Safety: never strip a cost that has nowhere to go ───────────────────
do $$
declare n int;
begin
  select count(*) into n
    from public.car_listings l
    join public.profiles d on d.id = l.dealer_id
   where not (d.role = 'salesman' and d.dealer_id is null)
     and (coalesce(l.purchase_price, 0) > 0 or coalesce(l.base_price, 0) > 0 or coalesce(l.recon_cost, 0) > 0)
     and not exists (select 1 from public.stock_units su where su.listing_id = l.id);
  if n > 0 then
    raise exception 'batch 4: % dealer car(s) have a cost but no stock record; aborting', n;
  end if;
end $$;

-- ── 1. The listing never holds a dealer's cost ─────────────────────────────
-- INSERT: the values are handed to auto_create_stock_unit (AFTER INSERT) through a
-- transaction-local setting keyed by the row id, so multi-row inserts (CSV import) work.
-- UPDATE: a cost typed on the listing (CarForm edit on the dealer side) goes to the stock
-- record, but only for someone allowed to see dealer costs. A salesman's edit is dropped.
-- Recon on an UPDATE is never carried: CarForm sends recon + included services as one
-- number, and the stock tab's Edit Costs is where recon is set.
create or replace function public.dealer_costs_off_listing()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_cost  numeric;
  v_recon numeric;
begin
  if new.dealer_id is null
     or exists (select 1 from profiles p
                 where p.id = new.dealer_id and p.role = 'salesman' and p.dealer_id is null) then
    return new;
  end if;

  v_cost  := coalesce(nullif(new.purchase_price, 0), nullif(new.base_price, 0));
  v_recon := nullif(new.recon_cost, 0);

  if tg_op = 'INSERT' then
    perform set_config('drevo.cost_' || replace(new.id::text, '-', ''),
                       coalesce(v_cost::text, '') || '|' || coalesce(v_recon::text, ''), true);
  elsif v_cost is not null and public.can_see_dealer_stock(new.dealer_id) then
    update stock_units set purchase_price = v_cost
     where listing_id = new.id and purchase_price is distinct from v_cost;
  end if;

  new.purchase_price := null;
  new.base_price     := null;
  new.recon_cost     := null;
  return new;
end;
$$;

revoke all on function public.dealer_costs_off_listing() from public, anon, authenticated;

drop trigger if exists trg_zz_dealer_costs_off_listing on public.car_listings;
create trigger trg_zz_dealer_costs_off_listing
  before insert or update of purchase_price, base_price, recon_cost on public.car_listings
  for each row execute function public.dealer_costs_off_listing();

-- ── 2. New stock record takes the cost from the hand-off, not the listing ───
create or replace function public.auto_create_stock_unit()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_key   text := 'drevo.cost_' || replace(new.id::text, '-', '');
  v_stash text := current_setting(v_key, true);
  v_cost  numeric;
  v_recon numeric;
begin
  if coalesce(v_stash, '') <> '' then
    v_cost  := nullif(split_part(v_stash, '|', 1), '')::numeric;
    v_recon := nullif(split_part(v_stash, '|', 2), '')::numeric;
    perform set_config(v_key, '', true);
  end if;

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
      coalesce(v_cost, nullif(new.purchase_price, 0), new.base_price, 0),
      coalesce(v_recon, new.recon_cost, 0), 'in_stock'
    );
  end if;
  return new;
end;
$$;

-- ── 3. Backfill: stock record keeps what it has, fills a blank from the listing ─
update public.stock_units su
   set recon_cost = l.recon_cost
  from public.car_listings l
  join public.profiles d on d.id = l.dealer_id
 where su.listing_id = l.id
   and not (d.role = 'salesman' and d.dealer_id is null)
   and coalesce(su.recon_cost, 0) = 0 and coalesce(l.recon_cost, 0) > 0;

update public.stock_units su
   set purchase_price = coalesce(nullif(l.purchase_price, 0), l.base_price)
  from public.car_listings l
  join public.profiles d on d.id = l.dealer_id
 where su.listing_id = l.id
   and not (d.role = 'salesman' and d.dealer_id is null)
   and coalesce(su.purchase_price, 0) = 0
   and coalesce(nullif(l.purchase_price, 0), l.base_price, 0) > 0;

-- Strip. The activity log trigger is paused for this one statement: it would otherwise write
-- 60 "base price changed" rows carrying the old cost (and flag them off-hours anomalies).
alter table public.car_listings disable trigger trg_activity_car_listings;
update public.car_listings l
   set purchase_price = null, base_price = null, recon_cost = null
  from public.profiles d
 where d.id = l.dealer_id
   and not (d.role = 'salesman' and d.dealer_id is null)
   and (l.purchase_price is not null or l.base_price is not null or l.recon_cost is not null);
alter table public.car_listings enable trigger trg_activity_car_listings;

-- ── 4. activity_log: money roles only ──────────────────────────────────────
drop policy if exists "Dealer reads own activity log" on public.activity_log;
create policy activity_log_money_roles_read on public.activity_log
  for select to authenticated
  using ((select public.can_see_dealer_stock(dealer_id)) or (select public.is_superadmin()));

-- ── 5. gm_exception_alerts: money roles only, the one recon rule ───────────
create or replace function public.gm_exception_alerts(p_dealer_id uuid)
returns jsonb language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;
  if not (public.can_see_dealer_stock(p_dealer_id) or public.is_superadmin()) then
    raise exception 'Forbidden';
  end if;

  with
  loss_makers as (
    select jsonb_agg(jsonb_build_object(
      'id', cl.id,
      'name', cl.brand || ' ' || cl.model || ' ' || coalesce(cl.year::text, ''),
      'price', cl.selling_price,
      'cost', coalesce(su.purchase_price, 0) + public.stock_recon_effective(su.recon_cost, su.recon_actual)
    )) as items
    from car_listings cl
    left join stock_units su on su.listing_id = cl.id
    where cl.dealer_id = p_dealer_id and cl.status = 'available'
      and cl.selling_price > 0
      and cl.selling_price < (coalesce(su.purchase_price, 0) + public.stock_recon_effective(su.recon_cost, su.recon_actual))
  ),
  missing_b7 as (
    select count(*) as cnt from stock_units
    where dealer_id = p_dealer_id and status = 'in_stock' and puspakom_b7_date is null
  ),
  expired_b7 as (
    select count(*) as cnt from stock_units
    where dealer_id = p_dealer_id and status = 'in_stock'
      and puspakom_b7_date is not null
      and puspakom_b7_date + interval '3 months' < now()
  ),
  stuck_hp as (
    select count(*) as cnt from deal_financing
    where dealer_id = p_dealer_id and status = 'pending'
      and submitted_at < now() - interval '7 days'
  ),
  cold_leads as (
    select count(*) as cnt from leads
    where dealer_id = p_dealer_id
      and stage not in ('won', 'lost')
      and coalesce(updated_at, created_at) < now() - interval '5 days'
  ),
  off_hours_today as (
    select count(*) as cnt from activity_log
    where dealer_id = p_dealer_id
      and is_anomaly = true
      and created_at >= now() - interval '7 days'
  )
  select jsonb_build_object(
    'loss_makers', coalesce(loss_makers.items, '[]'::jsonb),
    'missing_b7', missing_b7.cnt,
    'expired_b7', expired_b7.cnt,
    'stuck_hp', stuck_hp.cnt,
    'cold_leads', cold_leads.cnt,
    'anomalies_7d', off_hours_today.cnt
  ) into v_result
  from loss_makers, missing_b7, expired_b7, stuck_hp, cold_leads, off_hours_today;

  return v_result;
end;
$$;

revoke all on function public.gm_exception_alerts(uuid) from public, anon;
grant execute on function public.gm_exception_alerts(uuid) to authenticated;

commit;

-- ── Probes (run after applying) ───────────────────────────────────────────
-- a) no dealer car carries a cost on the listing (expect 0):
--    select count(*) from car_listings l join profiles d on d.id = l.dealer_id
--     where not (d.role = 'salesman' and d.dealer_id is null)
--       and (l.purchase_price is not null or l.base_price is not null or l.recon_cost is not null);
-- b) solo sellers kept theirs (expect the pre-migration count, 30 on 2026-11-09):
--    select count(*) from car_listings l join profiles d on d.id = l.dealer_id
--     where d.role = 'salesman' and d.dealer_id is null and l.base_price > 0;
-- c) every dealer stock record that had a cost still has it (compare to pre-run, 60):
--    select count(*) from stock_units su join profiles d on d.id = su.dealer_id
--     where d.role in ('dealer','owner') and su.purchase_price > 0;
-- d) as a linked salesman: activity_log returns 0 rows; gm_exception_alerts -> Forbidden.
-- e) one overload: select oid::regprocedure from pg_proc where proname in
--    ('auto_create_stock_unit','gm_exception_alerts','dealer_costs_off_listing');
-- ROLLBACK: drop trigger trg_zz_dealer_costs_off_listing on car_listings; drop function
--   dealer_costs_off_listing(); drop policy activity_log_money_roles_read and re-create
--   "Dealer reads own activity log" for select using (dealer_id = auth.uid() or dealer_id =
--   (select dealer_id from profiles where id = auth.uid()) or is_superadmin()); auto_create_stock_unit + gm_exception_alerts bodies are in git history.
--   The stripped listing costs are not restored: the stock record holds them.
