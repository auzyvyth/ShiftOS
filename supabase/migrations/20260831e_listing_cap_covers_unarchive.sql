-- SEC-CAP. The listing cap was farmable by archiving.
--
-- enforce_listing_cap (BEFORE INSERT) counts only listings whose status is not
-- sold/archived/unpublished, and enforce_listing_cap_on_publish (BEFORE UPDATE
-- OF status) returned early unless OLD.status = 'unpublished'. So the
-- archived -> available transition was never gated, and the loop was:
--
--   archive 30  ->  count reads 0  ->  insert 30 more  ->  un-archive all 60
--
-- Unlimited listings on any capped plan. This is not a Salesman Lite problem
-- only — every dealer tier with a listing_cap had the same hole, so the cap
-- that Starter/Growth/Pro are priced on was optional.
--
-- The gate now covers every transition OUT of a status the count ignores and
-- INTO one it counts. 'sold' is deliberately left out: reversing a sale is a
-- correction, and blocking a dealer mid-fix because the reversal puts them one
-- over is worse than the tiny amount of room it leaves.
create or replace function public.enforce_listing_cap_on_publish()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
DECLARE
  v_cap    int;
  v_active int;
BEGIN
  -- Only gate parked -> public transitions.
  IF OLD.status NOT IN ('unpublished', 'archived') THEN RETURN NEW; END IF;
  IF NEW.status IN ('unpublished', 'sold', 'archived') THEN RETURN NEW; END IF;

  SELECT pc.listing_cap INTO v_cap
  FROM profiles p
  JOIN plan_config pc ON pc.plan = p.plan::text
  WHERE p.id = NEW.dealer_id;

  -- NULL cap = unlimited (dealer_group / enterprise)
  IF v_cap IS NULL THEN RETURN NEW; END IF;

  -- Count active listings excluding the row being updated
  SELECT COUNT(*) INTO v_active
  FROM car_listings
  WHERE dealer_id = NEW.dealer_id
    AND status NOT IN ('sold', 'archived', 'unpublished')
    AND id != NEW.id;

  IF v_active >= v_cap THEN
    RAISE EXCEPTION 'listing_cap_exceeded'
      USING HINT = 'Upgrade your plan to add more listings',
            DETAIL = format('active=%s cap=%s', v_active, v_cap);
  END IF;

  RETURN NEW;
END;
$function$;
