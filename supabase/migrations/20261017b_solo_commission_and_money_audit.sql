-- 20261017b: solo-seller commission keeps itself right + the change log covers money.
--
-- 1) For a solo seller (role 'salesman', dealer_id NULL) commission IS the margin:
--    selling_price - base_price. It was a stored copy written only by CarForm on save,
--    so 9 of 17 solo listings carried a stale number (Lexus RX: RM 2,000 stored,
--    RM 9,000 real) and the goal gauge, commission totals and Performance tab
--    under-counted. Now the database sets it on every write, whichever screen did it.
--    Dealer-linked salesmen and dealers keep their typed commission (a real payout).
--    A row with no base price is left alone: there is nothing to compute from.
--
-- 2) log_dealer_activity only recorded selling_price + status on cars, so a base-price
--    edit left no trace (which is why the Lexus's history could not be traced).
--    It now also records the money fields and who owns a deal.
--
-- One migration on purpose: each one freezes the API (see CLAUDE.md, DB migrations).

begin;

-- ── 1. Commission = margin for solo sellers ──────────────────────────────────
create or replace function public.solo_commission_is_margin()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if new.base_price is null or new.base_price <= 0 then
    return new;
  end if;
  if exists (
    select 1 from profiles p
    where p.id = new.dealer_id and p.role = 'salesman' and p.dealer_id is null
  ) then
    new.commission_amount := greatest(coalesce(new.selling_price, 0) - new.base_price, 0);
  end if;
  return new;
end;
$$;

revoke all on function public.solo_commission_is_margin() from public, anon, authenticated;

drop trigger if exists trg_solo_commission_is_margin on public.car_listings;
create trigger trg_solo_commission_is_margin
  before insert or update of selling_price, base_price, commission_amount, dealer_id
  on public.car_listings
  for each row execute function public.solo_commission_is_margin();

-- ── 2. Change log: record the money fields too ───────────────────────────────
create or replace function public.log_dealer_activity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
DECLARE
  v_actor_id UUID;
  v_actor_name TEXT;
  v_actor_role TEXT;
  v_dealer_id UUID;
  v_record_id UUID;
  v_changes JSONB := '{}'::jsonb;
  v_summary TEXT;
  v_action TEXT;
  v_is_anomaly BOOLEAN := false;
  v_anomaly_reason TEXT;
  v_hour INT;
  v_new JSONB;
  v_old JSONB;
  v_extra TEXT[];
  v_col TEXT;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NOT NULL THEN
    SELECT full_name, role INTO v_actor_name, v_actor_role FROM profiles WHERE id = v_actor_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_record_id := NEW.id;
    v_dealer_id := NEW.dealer_id;
    v_summary := 'Created ' || TG_TABLE_NAME;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_record_id := NEW.id;
    v_dealer_id := NEW.dealer_id;
    -- Build field diff for key columns
    IF TG_TABLE_NAME = 'car_listings' THEN
      IF NEW.selling_price IS DISTINCT FROM OLD.selling_price THEN
        v_changes := v_changes || jsonb_build_object('selling_price', jsonb_build_object('old', OLD.selling_price, 'new', NEW.selling_price));
        v_summary := COALESCE(v_summary || ', ', '') || 'Price RM ' || OLD.selling_price || ' → RM ' || NEW.selling_price;
        -- Anomaly: price dropped more than 15%
        IF OLD.selling_price > 0 AND NEW.selling_price < OLD.selling_price * 0.85 THEN
          v_is_anomaly := true;
          v_anomaly_reason := 'Price dropped >15%';
        END IF;
      END IF;
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
        v_summary := COALESCE(v_summary || ', ', '') || 'Status: ' || OLD.status || ' → ' || NEW.status;
      END IF;
      v_extra := ARRAY['base_price', 'commission_amount', 'deposit_amount', 'recon_cost', 'assigned_to'];
    ELSIF TG_TABLE_NAME = 'stock_units' THEN
      IF NEW.sold_price IS DISTINCT FROM OLD.sold_price THEN
        v_changes := v_changes || jsonb_build_object('sold_price', jsonb_build_object('old', OLD.sold_price, 'new', NEW.sold_price));
        v_summary := COALESCE(v_summary || ', ', '') || 'Sold price set RM ' || NEW.sold_price;
      END IF;
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
      END IF;
      v_extra := ARRAY['purchase_price', 'recon_cost'];
    ELSIF TG_TABLE_NAME = 'deal_financing' THEN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
        v_summary := COALESCE(v_summary || ', ', '') || 'HP ' || OLD.status || ' → ' || NEW.status;
      END IF;
    ELSIF TG_TABLE_NAME = 'leads' THEN
      IF NEW.stage IS DISTINCT FROM OLD.stage THEN
        v_changes := v_changes || jsonb_build_object('stage', jsonb_build_object('old', OLD.stage, 'new', NEW.stage));
        v_summary := COALESCE(v_summary || ', ', '') || 'Stage: ' || OLD.stage || ' → ' || NEW.stage;
      END IF;
      v_extra := ARRAY['salesman_id', 'loan_amount', 'car_listing_id'];
    END IF;
    -- Money / ownership fields: old + new into field_changes, one summary word each.
    IF v_extra IS NOT NULL THEN
      v_new := to_jsonb(NEW);
      v_old := to_jsonb(OLD);
      FOREACH v_col IN ARRAY v_extra LOOP
        IF (v_new -> v_col) IS DISTINCT FROM (v_old -> v_col) THEN
          v_changes := v_changes || jsonb_build_object(v_col, jsonb_build_object('old', v_old -> v_col, 'new', v_new -> v_col));
          v_summary := COALESCE(v_summary || ', ', '') || replace(v_col, '_', ' ') || ' changed';
        END IF;
      END LOOP;
    END IF;
    IF v_changes = '{}'::jsonb THEN RETURN NEW; END IF; -- nothing tracked
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_record_id := OLD.id;
    v_dealer_id := OLD.dealer_id;
    v_summary := 'Deleted ' || TG_TABLE_NAME;
    v_is_anomaly := true;
    v_anomaly_reason := 'Record deleted';
  END IF;

  -- Off-hours edit anomaly (Malaysia time, 10pm-7am)
  v_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Asia/Kuala_Lumpur'));
  IF v_action = 'update' AND (v_hour >= 22 OR v_hour < 7) THEN
    v_is_anomaly := true;
    v_anomaly_reason := COALESCE(v_anomaly_reason || ' + ', '') || 'Off-hours edit';
  END IF;

  IF v_dealer_id IS NOT NULL THEN
    INSERT INTO activity_log (dealer_id, actor_id, actor_name, actor_role, table_name, record_id, action, field_changes, summary, is_anomaly, anomaly_reason)
    VALUES (v_dealer_id, v_actor_id, v_actor_name, v_actor_role, TG_TABLE_NAME, v_record_id, v_action, v_changes, v_summary, v_is_anomaly, v_anomaly_reason);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

-- ── 3. Correct the stale rows (after 1 + 2, so the fix itself is logged) ─────
-- Touching base_price fires the new trigger, which recomputes commission.
update public.car_listings l
set base_price = l.base_price
from public.profiles p
where p.id = l.dealer_id and p.role = 'salesman' and p.dealer_id is null
  and l.base_price > 0
  and coalesce(l.commission_amount, 0) <> greatest(coalesce(l.selling_price, 0) - l.base_price, 0);

commit;
