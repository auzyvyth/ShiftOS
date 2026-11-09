-- One win, one deposit per car (TODO DMS-AUDIT part 4, batch 2). Owner, 2026-11-08.
-- Apply after 20261109c, 00:00-09:00 MYT, nobody live. ONE migration = one API freeze.
--
-- Before this, a second lead on an already-sold car could be moved to Won: the won trigger
-- skipped the car (already sold) but still made a second customer + handover, and the
-- dealer LeadDrawer then re-wrote the car (sold_at, assigned_to = whoever was picked),
-- taking the first salesman's credit. Live: Cullinan 67b534ce has 3 wins, the audit Vios
-- f6e45cc9 has 2. Client half: LeadDrawer.confirmCloseSale no longer writes the car.
--
-- A per-car advisory lock, not a unique index: a new-car model card can carry several
-- won leads for a moment (new_car_unit_on_won moves each onto its own sold unit), and an
-- index cannot look at car_listings to skip cards.

begin;

-- ── 1. Clean the duplicates (keep the EARLIEST win per car) ─────────────────
-- Same undo as undo_car_sale(): the later wins move off Won, and the customer +
-- handover rows the won trigger made for them go (nothing else hangs off them:
-- 0 service packages checked 2026-11-08). The kept win and the car are untouched.
create temporary table _dup_wins on commit drop as
  select id from (
    select l.id, row_number() over (partition by l.car_listing_id order by l.updated_at, l.id) rn
      from public.leads l
      join public.car_listings c on c.id = l.car_listing_id
     where l.stage in ('won','closed_won') and l.is_deleted is not true
       and c.new_car_model_id is null
  ) x where rn > 1;

delete from public.post_sale_tasks where lead_id in (select id from _dup_wins);
delete from public.customers       where lead_id in (select id from _dup_wins);
update public.leads
   set stage = 'lost', loss_reason = 'Duplicate win removed (car already sold)', updated_at = now()
 where id in (select id from _dup_wins);

-- ── 2. The guard ───────────────────────────────────────────────────────────
create or replace function public.guard_one_win_per_car()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_card boolean;
begin
  if new.car_listing_id is null or new.is_deleted is true
     or new.stage not in ('won','closed_won','deposit_taken') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.stage is not distinct from new.stage
     and old.car_listing_id is not distinct from new.car_listing_id then
    return new;
  end if;

  select (new_car_model_id is not null and coalesce(new_car_unit, false) = false)
    into v_card from car_listings where id = new.car_listing_id;
  if v_card then return new; end if;   -- a model card: each win becomes its own unit

  -- Two people pressing Won on the same car at once wait for each other here.
  perform pg_advisory_xact_lock(hashtext('one_win:' || new.car_listing_id::text));

  if new.stage in ('won','closed_won') and exists (
       select 1 from leads o
        where o.car_listing_id = new.car_listing_id and o.id <> new.id
          and o.stage in ('won','closed_won') and o.is_deleted is not true) then
    raise exception 'car_already_won' using errcode = 'P0001',
      hint = 'Undo the existing sale (undo_car_sale) before closing it to another buyer.';
  end if;

  if new.stage = 'deposit_taken' and exists (
       select 1 from leads o
        where o.car_listing_id = new.car_listing_id and o.id <> new.id
          and o.stage = 'deposit_taken' and o.is_deleted is not true) then
    raise exception 'car_has_deposit' using errcode = 'P0001',
      hint = 'Another buyer already has a deposit on this car.';
  end if;

  return new;
end;
$$;
revoke all on function public.guard_one_win_per_car() from public, anon, authenticated;

-- Named to run AFTER trg_lead_new_car_unit ("trg_lead_n" < "trg_lead_o"), so a model-card
-- win has already been moved onto its own unit when this checks.
drop trigger if exists trg_lead_one_win on public.leads;
create trigger trg_lead_one_win
  before insert or update of stage, car_listing_id on public.leads
  for each row execute function public.guard_one_win_per_car();

commit;

-- ============================ PROBES (after apply) ==========================================
-- a) no car with two live wins (expect 0 rows):
--    select car_listing_id from leads where stage in ('won','closed_won') and is_deleted is not true
--      and car_listing_id is not null group by 1 having count(*) > 1;
-- b) Cullinan 67b534ce: 1 won lead (3d62a44a), 1 customer row, 8 handover rows.
-- c) in a DO block that raises at the end: update a lost lead on the Cullinan to 'won'
--    -> car_already_won. Existing two deposits on that car are NOT touched (rule applies to new ones).
-- ROLLBACK: drop trigger trg_lead_one_win on public.leads; drop function public.guard_one_win_per_car();
--   (the cleanup in step 1 is not reversed by this; the lost leads can be re-won after undo_car_sale.)
