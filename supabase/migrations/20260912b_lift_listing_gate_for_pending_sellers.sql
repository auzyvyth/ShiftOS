-- LITE-GATE-1: a seller waiting on approval could not create, edit or delete a
-- listing — while the product told them, in writing, that they could.
--
-- `AccountReviewBanner` has always said "Keep adding your cars in the meantime.
-- Everything you list is saved and goes live on the marketplace the moment
-- you're approved", and its own docstring reads "Shown as a BANNER, never a
-- gate. A seller waiting on review can still build listings". The RLS policies
-- never matched that promise: all four salesman policies on car_listings
-- required `is_active_salesman()` -> `profiles.is_active = true`, which a
-- self-signup does not get until a human approves them. So the seller sat
-- waiting on the owner before they could do the one thing the banner invited
-- them to do, and the insert failed as a bare 42501 ("Publishing was blocked",
-- CarForm.jsx).
--
-- WHY THIS IS SAFE — the marketplace is guarded by the VIEW, not by this policy.
-- `public_car_listings` already ends with:
--     AND NOT EXISTS (SELECT 1 FROM profiles pr
--                      WHERE pr.id = cl.dealer_id
--                        AND (pr.is_active = false OR pr.account_status = 'deleted'))
-- so a pending seller's listings stay invisible to every public surface until
-- approval flips `is_active`. Nothing reaches a buyer any earlier than it does
-- today; the seller simply gets to do the work while they wait.
--
-- WHY NOT JUST DROP THE CHECK — `is_active` carries TWO meanings, and the old
-- helper could not tell them apart:
--   * `decide_user_approval()`  sets is_active = true  on approval
--   * `set_account_suspended()` sets is_active = false on suspension
-- Dropping the check outright would hand a SUSPENDED seller their write access
-- back, which is precisely what migration 20260426
-- ("enforce_salesman_lite_suspension") exists to prevent. So the new helper
-- tests the states that are a deliberate admin NO — suspended, rejected,
-- deleted — and ignores the one that only means "nobody has got to you yet".
--
-- `is_active_salesman()` is deliberately LEFT IN PLACE and unchanged: the
-- `leads` policies still use it, and suspension enforcement there is untouched.
-- Do not "tidy" the two into one — they answer different questions.

CREATE OR REPLACE FUNCTION public.salesman_can_manage_listings()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
     WHERE id = auth.uid()
       AND role IN ('salesman', 'salesman_lite', 'salesman_full')
       -- a deliberate admin NO, in its three forms:
       AND suspended_at IS NULL
       AND approval_status <> 'rejected'
       AND COALESCE(account_status, 'active') <> 'deleted'
       AND deleted_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.salesman_can_manage_listings() TO authenticated;

-- The four policies, now measuring "is this account blocked" instead of
-- "has this account been approved". The listing cap on INSERT is unchanged.

DROP POLICY IF EXISTS "salesman_reads_own_listings" ON car_listings;
CREATE POLICY "salesman_reads_own_listings" ON car_listings
  FOR SELECT
  USING (dealer_id = auth.uid() AND salesman_can_manage_listings());

DROP POLICY IF EXISTS "salesman_updates_own_listings" ON car_listings;
CREATE POLICY "salesman_updates_own_listings" ON car_listings
  FOR UPDATE
  USING (dealer_id = auth.uid() AND salesman_can_manage_listings())
  WITH CHECK (dealer_id = auth.uid() AND salesman_can_manage_listings());

DROP POLICY IF EXISTS "salesman_deletes_own_listings" ON car_listings;
CREATE POLICY "salesman_deletes_own_listings" ON car_listings
  FOR DELETE
  USING (dealer_id = auth.uid() AND salesman_can_manage_listings());

DROP POLICY IF EXISTS "salesman_inserts_own_listings" ON car_listings;
CREATE POLICY "salesman_inserts_own_listings" ON car_listings
  FOR INSERT
  WITH CHECK (
    dealer_id = auth.uid()
    AND salesman_can_manage_listings()
    AND salesman_under_listing_limit()
  );
