-- Fix 1: Set REPLICA IDENTITY FULL so real-time UPDATE/DELETE filters work
-- reliably on dealer_id (a non-PK column).  Default identity only sends the PK
-- in old record, making filtered subscriptions miss UPDATE/DELETE events.
ALTER TABLE appointments       REPLICA IDENTITY FULL;
ALTER TABLE whatsapp_enquiries REPLICA IDENTITY FULL;
ALTER TABLE analytics_events   REPLICA IDENTITY FULL;

-- Fix 2: Ensure these tables are in the supabase_realtime publication
-- (idempotent — safe to run if already present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_enquiries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_enquiries;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
  END IF;
END $$;
