-- Consolidate 3 conflicting triggers on car_listings into one.
-- trg_sync_gross_profit and trg_update_listing_computed stomped each other
-- and caused UPDATE rollbacks. Single source of truth below.

DROP TRIGGER IF EXISTS trg_sync_gross_profit       ON car_listings;
DROP TRIGGER IF EXISTS trg_update_listing_computed ON car_listings;
DROP FUNCTION IF EXISTS sync_gross_profit();
DROP FUNCTION IF EXISTS update_listing_computed_fields();

CREATE OR REPLACE FUNCTION compute_listing_gp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.gross_profit := COALESCE(NEW.sold_price, NEW.selling_price, 0)
                    - COALESCE(NEW.purchase_price, 0)
                    - COALESCE(NEW.recon_cost, 0)
                    - COALESCE(NEW.included_services_cost, 0);

  NEW.days_in_stock := EXTRACT(DAY FROM (NOW() - NEW.created_at))::int;

  RETURN NEW;
END;
$$;

-- Re-create the surviving trigger (drop+add in case it already exists)
DROP TRIGGER IF EXISTS trg_compute_listing_gp ON car_listings;
CREATE TRIGGER trg_compute_listing_gp
  BEFORE INSERT OR UPDATE ON car_listings
  FOR EACH ROW EXECUTE FUNCTION compute_listing_gp();
