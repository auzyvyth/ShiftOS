-- Fix: triggers on appointments/whatsapp_enquiries insert into dealer_notifications /
-- salesman_notifications, but those tables have no RLS policy for the anon role.
-- Unauthenticated buyers (storefront bookings & WA enquiries) hit a 401 because
-- the notification insert inside the trigger is rejected by RLS.
--
-- Fix 1: make every trigger function on these tables SECURITY DEFINER so they
-- execute as the function owner (postgres) and bypass RLS.
-- Fix 2: as a belt-and-braces fallback, grant anon INSERT on the notification
-- tables — they are internal and only written to by triggers anyway.

-- ── Step 1: SECURITY DEFINER on trigger functions ────────────────────────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT p.proname, n.nspname
    FROM pg_trigger   t
    JOIN pg_proc      p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_class     c ON c.oid = t.tgrelid
    WHERE c.relname IN ('appointments', 'whatsapp_enquiries')
      AND NOT p.prosecdef          -- skip ones already SECURITY DEFINER
      AND NOT t.tgisinternal       -- skip internal/system triggers
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I() SECURITY DEFINER SET search_path = public, pg_temp',
      r.nspname, r.proname
    );
    RAISE NOTICE 'Patched trigger function: %.%', r.nspname, r.proname;
  END LOOP;
END $$;

-- ── Step 2: fallback anon INSERT policies on notification tables ──────────────
-- (covers any trigger paths not caught above, e.g. chained triggers)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dealer_notifications' AND policyname = 'anon_trigger_insert'
  ) THEN
    CREATE POLICY anon_trigger_insert ON dealer_notifications
      FOR INSERT TO anon WITH CHECK (true);
    RAISE NOTICE 'Created anon INSERT policy on dealer_notifications';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'salesman_notifications' AND policyname = 'anon_trigger_insert'
  ) THEN
    CREATE POLICY anon_trigger_insert ON salesman_notifications
      FOR INSERT TO anon WITH CHECK (true);
    RAISE NOTICE 'Created anon INSERT policy on salesman_notifications';
  END IF;
END $$;
