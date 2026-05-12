-- ============================================================
-- Feature 5: Buyer price alerts
--
-- Users sign in with Google (Supabase auth), save a search filter
-- set as an alert. A background job (Edge Function / cron) will
-- check new listings against active alerts and email the user.
--
-- Security model:
--   - RLS: users read/write only their own rows (user_id = auth.uid())
--   - email column is written server-side via trigger from auth.users
--     so the client can never forge someone else's email
--   - is_active can only be toggled, not abused (no billing surface)
-- ============================================================

CREATE TABLE IF NOT EXISTS price_alerts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email            text        NOT NULL,
  -- filter fields — all optional (a fully-empty alert matches everything)
  brand            text,
  model            text,
  variant          text,
  body_type        text,
  state            text,
  condition        text,
  max_price        numeric     CHECK (max_price IS NULL OR max_price >= 0),
  min_year         int         CHECK (min_year IS NULL OR (min_year >= 1990 AND min_year <= 2100)),
  max_year         int         CHECK (max_year IS NULL OR (max_year >= 1990 AND max_year <= 2100)),
  -- state
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_notified_at timestamptz,
  -- safety: max 10 alerts per user enforced at insert via constraint
  CONSTRAINT price_alerts_year_order CHECK (
    min_year IS NULL OR max_year IS NULL OR min_year <= max_year
  )
);

-- Index for the notification job scanning active alerts
CREATE INDEX IF NOT EXISTS price_alerts_active_idx
  ON price_alerts (is_active, user_id)
  WHERE is_active = true;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

-- Users see and manage only their own alerts
CREATE POLICY "alerts_owner_select" ON price_alerts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "alerts_owner_insert" ON price_alerts
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    -- Hard cap: max 10 active alerts per user
    AND (
      SELECT COUNT(*) FROM price_alerts
      WHERE user_id = auth.uid() AND is_active = true
    ) < 10
  );

CREATE POLICY "alerts_owner_update" ON price_alerts
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- Prevent email tampering — email must match the auth.users row
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "alerts_owner_delete" ON price_alerts
  FOR DELETE USING (user_id = auth.uid());

-- ── Trigger: auto-populate email from auth.users on insert ──────────────────
-- Prevents client from supplying an arbitrary email address
CREATE OR REPLACE FUNCTION price_alerts_set_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT email INTO NEW.email FROM auth.users WHERE id = NEW.user_id;
  IF NEW.email IS NULL THEN
    RAISE EXCEPTION 'user_email_not_found'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- Also enforce user_id = auth.uid() as a belt-and-suspenders check
  IF NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'access_denied'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER price_alerts_before_insert
  BEFORE INSERT ON price_alerts
  FOR EACH ROW EXECUTE FUNCTION price_alerts_set_email();
