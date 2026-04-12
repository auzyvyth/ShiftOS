-- ─── Services & Products Migration ──────────────────────────────────────────

-- Products catalogue per dealer
CREATE TABLE IF NOT EXISTS public.dealer_products (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id     uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name          text NOT NULL,
  category      text NOT NULL,
  -- categories: 'protection', 'window_tint', 'insurance', 'warranty', 'accessories', 'service', 'other'
  cost_price    numeric DEFAULT 0,
  selling_price numeric NOT NULL,
  description   text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Products attached to a specific deal (lead)
CREATE TABLE IF NOT EXISTS public.deal_products (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id     uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  lead_id       uuid REFERENCES leads(id) ON DELETE CASCADE,
  listing_id    uuid REFERENCES car_listings(id) ON DELETE SET NULL,
  product_id    uuid REFERENCES dealer_products(id) ON DELETE CASCADE NOT NULL,
  sold_price    numeric NOT NULL,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.dealer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_products   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dealer_products' AND policyname = 'team_all_dealer_products'
  ) THEN
    CREATE POLICY "team_all_dealer_products" ON public.dealer_products
    FOR ALL TO authenticated
    USING (dealer_id = get_my_dealer_id())
    WITH CHECK (dealer_id = get_my_dealer_id());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'deal_products' AND policyname = 'team_all_deal_products'
  ) THEN
    CREATE POLICY "team_all_deal_products" ON public.deal_products
    FOR ALL TO authenticated
    USING (dealer_id = get_my_dealer_id())
    WITH CHECK (dealer_id = get_my_dealer_id());
  END IF;
END $$;
