-- Integrity defect 2: activity_log must be effectively append-only and un-forgeable.
-- TRUNCATE bypasses RLS, so the table-level grant to authenticated was a real hole
-- (any logged-in user on a direct SQL path could wipe the whole audit log). RLS
-- already blocks per-row UPDATE/DELETE (no such policy), but revoke the grants too
-- for defense-in-depth. Keep INSERT+SELECT: the dealer dashboard's logActivity()
-- writes its own audit trail through the authenticated role (30+ call sites), and
-- OversightTab/snapshots read it. SECURITY DEFINER trigger/RPC writers run as owner
-- and bypass RLS, so they are unaffected.
REVOKE TRUNCATE, UPDATE, DELETE, TRIGGER, REFERENCES ON public.activity_log FROM authenticated;
REVOKE ALL ON public.activity_log FROM anon;

-- Tighten the INSERT policy: an authenticated client may still log within its own
-- dealer scope, but can no longer attribute an action to a DIFFERENT user
-- (actor_id must be self or NULL; NULL rows get actor_role='system' via the stamp
-- trigger). Uses is_superadmin() SECURITY DEFINER helper instead of an inline
-- profiles subquery, per RLS-safety convention.
DROP POLICY IF EXISTS "Insert own-dealer activity_log" ON public.activity_log;
CREATE POLICY "Insert own-dealer activity_log"
  ON public.activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (actor_id = auth.uid() OR actor_id IS NULL)
    AND (
      dealer_id = auth.uid()
      OR dealer_id = (SELECT p.dealer_id FROM profiles p WHERE p.id = auth.uid())
      OR public.is_superadmin()
    )
  );
