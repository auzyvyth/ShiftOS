-- Applied live via MCP apply_migration on 2026-07-03; captured for repo parity.
--
-- Sambung bayar (loan takeover) listing fields. A sambung bayar car isn't sold
-- outright — the buyer takes over the seller's existing hire-purchase loan, so the
-- figures that matter are the monthly instalment, months left, outstanding balance,
-- upfront cash to take over, and which bank holds the loan. payment_type='sambung_bayar'
-- is the flag; these carry the numbers.
ALTER TABLE public.car_listings
  ADD COLUMN IF NOT EXISTS sambung_monthly     numeric,
  ADD COLUMN IF NOT EXISTS sambung_months_left integer,
  ADD COLUMN IF NOT EXISTS sambung_balance     numeric,
  ADD COLUMN IF NOT EXISTS sambung_deposit     numeric,
  ADD COLUMN IF NOT EXISTS sambung_bank        text;

-- public_car_listings VIEW must also be updated to expose the 5 columns (appended
-- at the end). See the migration in the MCP history / repo for the full recreated
-- view definition.
