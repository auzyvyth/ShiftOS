-- The agreed price of a deal, and the dealer's OK for a discount over their limit
-- (TODO DMS-AUDIT batch 6a). Owner, 2026-11-09: "over a limit only".
-- Apply AFTER 20261109c..f. 00:00-09:00 MYT, nobody live. ONE API freeze.
--
-- Before: a win recorded no price. The won trigger stamped the customer with the car's
-- ASKING price, and car_listings.sold_price (what the profit, the deal record and the stock
-- record all read) was filled only if the screen that closed the deal remembered to.
-- After:
--   * leads.agreed_price = the price agreed with this buyer. On a dealer car's win it is
--     filled with the asking price when no one typed one, so every win has a price.
--   * the won trigger writes it to car_listings.sold_price and customers.selling_price.
--   * a dealer sets a discount limit (RM and/or % off asking, dealer_cost_settings). Off by
--     default: nothing changes for a dealer until they set one.
--   * a salesman closing under the limit closes at once. Over it, close_deal_at_price()
--     files a request (deal_price_approvals) and pushes the dealer; the lead stays open.
--     The dealer or their manager approves (decide_deal_price), which closes the deal.
--   * the rule is enforced on leads itself (trg_ab_lead_win_price), so no screen can skip it.
-- Solo sellers (Lite / Premium) and new-car model cards are untouched.

begin;

-- ── 1. Columns ──────────────────────────────────────────────────────────────
alter table public.leads add column if not exists agreed_price numeric;
comment on column public.leads.agreed_price is
  'Price agreed with this buyer. Set on win (asking price if none given); a discount over the dealer limit needs deal_price_approvals.';

alter table public.dealer_cost_settings
  add column if not exists discount_limit_amount numeric,
  add column if not exists discount_limit_pct numeric;
comment on column public.dealer_cost_settings.discount_limit_amount is
  'A discount above this many RM off the asking price needs the dealer or a manager to approve. NULL = no RM limit.';
comment on column public.dealer_cost_settings.discount_limit_pct is
  'A discount above this % of the asking price needs approval. NULL = no % limit.';

-- ── 2. Who may approve, and is a price over the limit ──────────────────────
create or replace function public.can_approve_dealer_discount(p_dealer uuid)
returns boolean language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $$
  select p_dealer is not null and (
       p_dealer = auth.uid()
    or exists (select 1 from public.profiles me
                where me.id = auth.uid() and me.role = 'manager' and me.dealer_id = p_dealer)
    or exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'superadmin')
  )
$$;
revoke all on function public.can_approve_dealer_discount(uuid) from public, anon;
grant execute on function public.can_approve_dealer_discount(uuid) to authenticated;

-- Internal: not callable from the API (the limit itself is a money setting).
create or replace function public.deal_discount_over_limit(p_dealer uuid, p_asking numeric, p_agreed numeric)
returns boolean language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $$
  select coalesce(p_asking, 0) > 0 and p_agreed < p_asking and exists (
    select 1 from public.dealer_cost_settings s
     where s.dealer_id = p_dealer
       and (   (s.discount_limit_amount is not null and p_asking - p_agreed > s.discount_limit_amount)
            or (s.discount_limit_pct    is not null and p_asking - p_agreed > p_asking * s.discount_limit_pct / 100))
  )
$$;
revoke all on function public.deal_discount_over_limit(uuid, numeric, numeric) from public, anon, authenticated;

-- ── 3. Requests ─────────────────────────────────────────────────────────────
create table if not exists public.deal_price_approvals (
  id            uuid primary key default gen_random_uuid(),
  dealer_id     uuid not null references public.profiles(id) on delete cascade,
  lead_id       uuid not null references public.leads(id) on delete cascade,
  listing_id    uuid references public.car_listings(id) on delete set null,
  requested_by  uuid references public.profiles(id) on delete set null,
  closer_id     uuid references public.profiles(id) on delete set null,
  asking_price  numeric not null,
  agreed_price  numeric not null,
  status        text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  note          text,
  decided_by    uuid references public.profiles(id) on delete set null,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);
create unique index if not exists deal_price_approvals_one_pending
  on public.deal_price_approvals (lead_id) where status = 'pending';
create index if not exists deal_price_approvals_dealer_status
  on public.deal_price_approvals (dealer_id, status);

alter table public.deal_price_approvals enable row level security;
revoke all on public.deal_price_approvals from anon, authenticated;
grant select on public.deal_price_approvals to authenticated;
-- Read: the dealer / manager (to decide), money roles (to see), and the salesman who asked.
-- No insert / update / delete policy: rows are written only by the two functions below.
drop policy if exists deal_price_approvals_read on public.deal_price_approvals;
create policy deal_price_approvals_read on public.deal_price_approvals
  for select to authenticated
  using (
    (select public.can_approve_dealer_discount(dealer_id))
    or (select public.can_see_dealer_stock(dealer_id))
    or requested_by = (select auth.uid())
  );

-- ── 4. The rule, on leads itself ─────────────────────────────────────────────
create or replace function public.guard_lead_win_price()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_car    record;
  v_solo   boolean;
  v_dealer uuid;
begin
  if new.car_listing_id is null then return new; end if;

  select id, dealer_id, selling_price, is_model_card, new_car_model_id
    into v_car from car_listings where id = new.car_listing_id;
  if not found or v_car.is_model_card or v_car.new_car_model_id is not null then return new; end if;
  v_dealer := coalesce(new.dealer_id, v_car.dealer_id);

  select exists (select 1 from profiles p
                  where p.id = v_dealer and p.role = 'salesman' and p.dealer_id is null) into v_solo;
  if v_solo then return new; end if;

  -- A closed deal's price changes only by the dealer or a manager.
  if old.stage in ('won','closed_won') then
    if new.agreed_price is distinct from old.agreed_price
       and not public.can_approve_dealer_discount(v_dealer) then
      raise exception 'deal_closed' using hint = 'Only the dealer or a manager can change a closed deal''s price.';
    end if;
    return new;
  end if;

  if new.stage not in ('won','closed_won') then return new; end if;

  new.agreed_price := coalesce(new.agreed_price, v_car.selling_price);
  if new.agreed_price is not null and new.agreed_price <= 0 then
    raise exception 'bad_price';
  end if;

  if public.deal_discount_over_limit(v_dealer, v_car.selling_price, new.agreed_price)
     and not public.can_approve_dealer_discount(v_dealer)
     and not exists (select 1 from deal_price_approvals a
                      where a.lead_id = new.id and a.status = 'approved'
                        and a.agreed_price = new.agreed_price) then
    raise exception 'discount_needs_approval'
      using hint = 'This price is over the dealer''s discount limit. Use close_deal_at_price to ask for approval.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_lead_win_price() from public, anon, authenticated;

drop trigger if exists trg_ab_lead_win_price on public.leads;
create trigger trg_ab_lead_win_price
  before update of stage, agreed_price on public.leads
  for each row execute function public.guard_lead_win_price();

-- ── 5. Close a deal at a price (every dealer-side screen calls this) ───────
-- Returns {status:'won'} or {status:'pending', approval_id}. Errors are raised.
create or replace function public.close_deal_at_price(p_lead uuid, p_agreed numeric default null, p_closer uuid default null)
returns jsonb language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_me     uuid := auth.uid();
  v_lead   leads%rowtype;
  v_car    record;
  v_role   text;
  v_side   boolean;
  v_agreed numeric;
  v_closer uuid;
  v_id     uuid;
begin
  if v_me is null then raise exception 'unauthorized'; end if;
  select * into v_lead from leads where id = p_lead for update;
  if not found then raise exception 'not_found'; end if;
  if v_lead.stage in ('won','closed_won') then raise exception 'deal_closed'; end if;
  if v_lead.stage in ('lost','closed_lost') then raise exception 'lead_lost'; end if;
  select id, dealer_id, selling_price into v_car from car_listings where id = v_lead.car_listing_id;
  v_lead.dealer_id := coalesce(v_lead.dealer_id, v_car.dealer_id);

  select role into v_role from profiles where id = v_me;
  -- Every test is null-safe: a NULL here would make "not (...)" NULL and let anyone through.
  v_side := coalesce(v_role in ('dealer','owner','manager','admin','accountant','fi_officer')
                     and public.get_my_dealer_id() = v_lead.dealer_id, false);
  if not (v_side
          or coalesce(v_role = 'superadmin', false)
          or coalesce(v_me = v_lead.salesman_id, false)
          or coalesce(v_me = v_lead.assigned_to, false)) then
    raise exception 'forbidden';
  end if;

  -- Only the dealer side picks who gets credit; a salesman closes as themselves.
  v_closer := coalesce(case when v_side or coalesce(v_role = 'superadmin', false) then p_closer end, v_lead.salesman_id, v_lead.assigned_to);
  if p_closer is not null and (v_side or coalesce(v_role = 'superadmin', false)) and not exists (
       select 1 from profiles s where s.id = p_closer
          and (s.id = v_lead.dealer_id or s.dealer_id = v_lead.dealer_id)) then
    raise exception 'bad_closer';
  end if;

  v_agreed := coalesce(p_agreed, v_car.selling_price);
  if v_agreed is not null and v_agreed <= 0 then raise exception 'bad_price'; end if;

  if v_car.id is not null
     and public.deal_discount_over_limit(v_lead.dealer_id, v_car.selling_price, v_agreed)
     and not public.can_approve_dealer_discount(v_lead.dealer_id) then
    update deal_price_approvals set status = 'expired', decided_at = now()
     where lead_id = p_lead and status = 'pending';
    insert into deal_price_approvals (dealer_id, lead_id, listing_id, requested_by, closer_id, asking_price, agreed_price)
    values (v_lead.dealer_id, p_lead, v_car.id, v_me, v_closer, v_car.selling_price, v_agreed)
    returning id into v_id;
    -- The row IS the push (trg_push_on_dealer_notification).
    insert into dealer_notifications (dealer_id, type, title, body, link_to, ref_id)
    values (v_lead.dealer_id, 'discount_approval', 'A discount needs your OK',
            coalesce(v_lead.buyer_name, 'A buyer') || ': RM' || to_char(v_agreed, 'FM999,999,990')
              || ' (asking RM' || to_char(v_car.selling_price, 'FM999,999,990') || ')',
            '/dashboard/crm', v_id);
    return jsonb_build_object('status', 'pending', 'approval_id', v_id);
  end if;

  update leads set agreed_price = v_agreed, stage = 'won', salesman_id = v_closer, updated_at = now()
   where id = p_lead;
  return jsonb_build_object('status', 'won');
end;
$$;
revoke all on function public.close_deal_at_price(uuid, numeric, uuid) from public, anon;
grant execute on function public.close_deal_at_price(uuid, numeric, uuid) to authenticated;

-- ── 6. The dealer's answer ──────────────────────────────────────────────────
create or replace function public.decide_deal_price(p_approval uuid, p_approve boolean, p_note text default null)
returns jsonb language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_a    deal_price_approvals%rowtype;
  v_lead leads%rowtype;
begin
  select * into v_a from deal_price_approvals where id = p_approval for update;
  if not found then raise exception 'not_found'; end if;
  if not public.can_approve_dealer_discount(v_a.dealer_id) then raise exception 'forbidden'; end if;
  if v_a.status <> 'pending' then raise exception 'already_decided'; end if;

  select * into v_lead from leads where id = v_a.lead_id for update;
  if v_lead.stage in ('won','closed_won','lost','closed_lost') then
    update deal_price_approvals set status = 'expired', decided_by = auth.uid(), decided_at = now()
     where id = p_approval;
    return jsonb_build_object('status', 'expired');
  end if;

  update deal_price_approvals
     set status = case when p_approve then 'approved' else 'rejected' end,
         note = nullif(btrim(coalesce(p_note, '')), ''), decided_by = auth.uid(), decided_at = now()
   where id = p_approval;

  if p_approve then
    update leads set agreed_price = v_a.agreed_price, stage = 'won',
                     salesman_id = coalesce(v_a.closer_id, salesman_id), updated_at = now()
     where id = v_a.lead_id;
  end if;

  if v_a.requested_by is not null and v_a.requested_by <> auth.uid() then
    insert into salesman_notifications (salesman_id, type, title, body, ref_id)
    values (v_a.requested_by, 'discount_decided',
            case when p_approve then 'Price approved: deal closed' else 'Price not approved' end,
            coalesce(v_lead.buyer_name, 'Your buyer') || ': RM' || to_char(v_a.agreed_price, 'FM999,999,990')
              || coalesce(' - ' || nullif(btrim(coalesce(p_note, '')), ''), ''),
            v_a.lead_id);
  end if;
  return jsonb_build_object('status', case when p_approve then 'approved' else 'rejected' end);
end;
$$;
revoke all on function public.decide_deal_price(uuid, boolean, text) from public, anon;
grant execute on function public.decide_deal_price(uuid, boolean, text) to authenticated;

-- ── 7. The win records the agreed price ────────────────────────────────────
-- Same body as live, two changes: the car's sold_price and the customer's
-- selling_price take NEW.agreed_price when there is one.
CREATE OR REPLACE FUNCTION public.auto_create_customer_on_won()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_car      car_listings%ROWTYPE;
  v_financed boolean;
  v_owner    uuid;
  v_dealer   uuid;
  v_won      date := CURRENT_DATE;
BEGIN
  IF NEW.stage IN ('won', 'closed_won') AND (OLD.stage IS NULL OR OLD.stage NOT IN ('won', 'closed_won')) THEN

    IF NEW.car_listing_id IS NOT NULL THEN
      SELECT * INTO v_car FROM car_listings WHERE id = NEW.car_listing_id;
    END IF;

    v_dealer := COALESCE(NEW.dealer_id, NEW.salesman_id, NEW.assigned_to);
    v_owner  := COALESCE(NEW.salesman_id, NEW.assigned_to);

    IF NEW.car_listing_id IS NOT NULL AND v_car.status IS DISTINCT FROM 'sold' THEN
      UPDATE car_listings
      SET status      = 'sold',
          sold_at     = now(),
          sold_price  = COALESCE(NEW.agreed_price, sold_price),
          assigned_to = COALESCE(assigned_to, v_owner)
      WHERE id = NEW.car_listing_id;
    END IF;

    -- 1. Auto-create the customer record. Road tax carries over from the car
    --    (it stays valid for the buyer until renewal); insurance is left NULL
    --    because the buyer arranges a new policy (entered manually later).
    INSERT INTO customers (
      dealer_id, lead_id, listing_id,
      name, phone, email, ic_number,
      purchase_date,
      car_brand, car_model, car_year, car_plate,
      selling_price, payment_type, road_tax_expiry
    ) VALUES (
      v_dealer, NEW.id, NEW.car_listing_id,
      NEW.buyer_name, NEW.phone, NEW.buyer_email, NEW.buyer_ic,
      v_won,
      v_car.brand, v_car.model, v_car.year, v_car.plate_number,
      COALESCE(NEW.agreed_price, v_car.selling_price, 0), v_car.payment_type, v_car.road_tax_expiry
    )
    ON CONFLICT (lead_id) DO NOTHING;

    v_financed := (NEW.loan_bank IS NOT NULL OR NEW.loan_amount IS NOT NULL OR NEW.loan_status IS NOT NULL);

    IF NOT EXISTS (SELECT 1 FROM post_sale_tasks WHERE lead_id = NEW.id) THEN
      INSERT INTO post_sale_tasks
        (dealer_id, lead_id, listing_id, salesman_id, step_key, status, owner_role, cost, sort_order, due_date)
      VALUES
        (v_dealer, NEW.id, NEW.car_listing_id, v_owner, 'loan_settlement', 'pending',  'dealer',   NULL, 0, v_won + 5),
        (v_dealer, NEW.id, NEW.car_listing_id, v_owner, 'insurance',       'pending',  'customer', NULL, 1, v_won + 7),
        (v_dealer, NEW.id, NEW.car_listing_id, v_owner, 'puspakom_b5',     'pending',  'runner',   30,   2, v_won + 10),
        (v_dealer, NEW.id, NEW.car_listing_id, v_owner, 'puspakom_b7',     CASE WHEN v_financed THEN 'pending' ELSE 'na' END, 'runner', 60, 3, v_won + 10),
        (v_dealer, NEW.id, NEW.car_listing_id, v_owner, 'jpj_transfer',    'pending',  'runner',   100,  4, v_won + 14),
        (v_dealer, NEW.id, NEW.car_listing_id, v_owner, 'road_tax',        'pending',  'runner',   NULL, 5, v_won + 17),
        (v_dealer, NEW.id, NEW.car_listing_id, v_owner, 'geran_collection','pending',  'customer', NULL, 6, v_won + 21),
        (v_dealer, NEW.id, NEW.car_listing_id, v_owner, 'handover',        'pending',  'salesman', NULL, 7, v_won + 21);
    END IF;

  END IF;
  RETURN NEW;
END;
$function$;

commit;

-- ── Probes (after applying) ────────────────────────────────────────────────
-- a) one overload each:
--    select oid::regprocedure from pg_proc where proname in ('close_deal_at_price','decide_deal_price',
--      'guard_lead_win_price','deal_discount_over_limit','can_approve_dealer_discount','auto_create_customer_on_won');
-- b) anon cannot call: select has_function_privilege('anon','public.close_deal_at_price(uuid,numeric,uuid)','execute'); -- false
-- c) the limit helper is not API-callable:
--    select has_function_privilege('authenticated','public.deal_discount_over_limit(uuid,numeric,numeric)','execute'); -- false
-- d) as a linked salesman with a limit set: close under -> won; over -> pending + one dealer_notifications row;
--    a direct `update leads set stage='won', agreed_price=<over>` -> discount_needs_approval.
-- ROLLBACK: drop trigger trg_ab_lead_win_price on leads; drop functions close_deal_at_price,
--   decide_deal_price, guard_lead_win_price, deal_discount_over_limit, can_approve_dealer_discount;
--   drop table deal_price_approvals; restore auto_create_customer_on_won without the two
--   COALESCE(NEW.agreed_price, ...) (git history). Columns can stay (unused = harmless).
