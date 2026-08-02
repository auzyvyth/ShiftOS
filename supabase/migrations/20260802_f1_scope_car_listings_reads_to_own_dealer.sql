-- F1 (marketplace security audit): stop any authenticated account reading every
-- dealer's base-table financials.
--
-- Before: the `public_read_listings` SELECT policy on car_listings was granted to
-- {public}. anon has no table-level SELECT grant on car_listings, so in practice
-- this granted every AUTHENTICATED user blanket read of all rows with status in
-- (active, available, reserved, sold) -- including purchase_price, recon_cost,
-- commission_amount, gross_profit, sold_price and admin_notes -- across EVERY
-- dealer. Because buyer signup is free/open, anyone could register, obtain a JWT
-- and read the entire platform's cost/margin/commission data from the base table.
--
-- Public marketplace browsing (anon AND authenticated) reads the curated
-- security-definer view public_car_listings (security_invoker = false, so it runs
-- as its owner and bypasses base-table RLS; the six sensitive columns above are not
-- selected by the view). Tightening base-table RLS therefore does not affect
-- marketplace reads.
--
-- After: authenticated users may read base-table rows only within their own dealer
-- scope via get_my_dealer_id() (SECURITY DEFINER, queries profiles only -> no
-- recursion on car_listings). That single predicate covers every in-app base-table
-- reader -- dealer/owner/manager/admin/accountant/fi_officer and linked/lite
-- salesmen (featured listings, Available Inventory pool, team leaderboard) -- since
-- all of them read their own dealer's rows. A buyer with no dealer resolves to NULL
-- -> zero base-table rows -> they browse via the view only. Superadmin keeps its
-- own all-access policy; the assigned/own salesman policies remain as additive
-- permissive grants.

DROP POLICY IF EXISTS public_read_listings ON public.car_listings;

CREATE POLICY authenticated_reads_own_dealer_listings
  ON public.car_listings
  FOR SELECT
  TO authenticated
  USING (dealer_id = get_my_dealer_id());
