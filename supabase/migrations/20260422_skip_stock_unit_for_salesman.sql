-- Salesman listings don't need stock units — skip the trigger for them.
CREATE OR REPLACE FUNCTION auto_create_stock_unit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.dealer_id AND role = 'salesman') THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM stock_units WHERE listing_id = NEW.id) THEN
    INSERT INTO stock_units (
      dealer_id, listing_id, brand, model, year, variant,
      colour, mileage, transmission, fuel_type, body_type,
      engine_cc, is_recon, vin_number, asking_price,
      purchase_price, recon_cost, status
    ) VALUES (
      NEW.dealer_id, NEW.id, NEW.brand, NEW.model, NEW.year, NEW.variant,
      NEW.colour, NEW.mileage, NEW.transmission, NEW.fuel_type, NEW.body_type,
      NEW.engine_cc, NEW.is_recon, NEW.vin_number, NEW.selling_price,
      0, 0, 'in_stock'
    );
  END IF;
  RETURN NEW;
END;
$$;
