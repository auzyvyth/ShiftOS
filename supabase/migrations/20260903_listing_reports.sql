-- Listing reports — buyer-submitted moderation queue for the public marketplace.
--
-- Design rules baked in, do NOT "improve" them away:
--  1. Reports are INERT. Nothing here touches car_listings, ranking, or the
--     dealer's notifications. Report volume must never auto-flag, auto-unpublish
--     or downrank a listing — on a multi-dealer marketplace that is a griefing
--     vector (dealer A buries dealer B). The superadmin is the only judge.
--  2. Writes go through report_listing() ONLY. There is deliberately NO INSERT
--     policy on the table, so the 3-per-24h cap cannot be bypassed by a direct
--     PostgREST insert. Adding an INSERT policy re-opens that hole.
--  3. listing_id is ON DELETE SET NULL and the report carries a jsonb snapshot,
--     so a seller deleting a reported listing cannot erase the evidence.

CREATE TABLE IF NOT EXISTS public.listing_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id       uuid REFERENCES public.car_listings(id) ON DELETE SET NULL,
  dealer_id        uuid,                        -- snapshot; survives listing delete
  reporter_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason           text NOT NULL CHECK (reason IN (
                     'sold_elsewhere','wrong_info','scam_suspicious',
                     'duplicate','offensive','other')),
  note             text,
  listing_snapshot jsonb,                       -- brand/model/year/price/slug at report time
  status           text NOT NULL DEFAULT 'open' CHECK (status IN (
                     'open','reviewing','resolved','dismissed')),
  admin_note       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz,
  resolved_by      uuid REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS listing_reports_status_idx  ON public.listing_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS listing_reports_listing_idx ON public.listing_reports (listing_id);
CREATE INDEX IF NOT EXISTS listing_reports_reporter_idx ON public.listing_reports (reporter_id, created_at DESC);

-- One OPEN report per person per listing. They can report it again only after
-- the superadmin has closed the first one. Stops a single user filing the same
-- complaint three times and burning their own daily quota on noise.
CREATE UNIQUE INDEX IF NOT EXISTS listing_reports_one_open_per_reporter
  ON public.listing_reports (reporter_id, listing_id)
  WHERE status IN ('open','reviewing');

ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;

-- Superadmin reads everything. No other role sees reports at all — a dealer must
-- not be able to see who reported them (retaliation) or that they were reported.
DO $$ BEGIN
  CREATE POLICY "superadmin_select_listing_reports" ON public.listing_reports
    FOR SELECT USING (is_superadmin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "superadmin_update_listing_reports" ON public.listing_reports
    FOR UPDATE USING (is_superadmin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A reporter may see the reports they filed (so the UI can say "already reported").
DO $$ BEGIN
  CREATE POLICY "reporter_select_own_listing_reports" ON public.listing_reports
    FOR SELECT USING (reporter_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Submit a report ────────────────────────────────────────────────────────
-- Signed-in only. Caps at 3 reports per user per rolling 24h. Returns the new
-- report id; raises 'rate_limited' / 'already_reported' / 'not_signed_in' so the
-- client can show a specific message.
CREATE OR REPLACE FUNCTION public.report_listing(
  p_listing_id uuid,
  p_reason     text,
  p_note       text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_recent integer;
  v_car    record;
  v_id     uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_signed_in' USING ERRCODE = 'check_violation';
  END IF;

  IF p_reason NOT IN ('sold_elsewhere','wrong_info','scam_suspicious','duplicate','offensive','other') THEN
    RAISE EXCEPTION 'invalid_reason' USING ERRCODE = 'check_violation';
  END IF;

  SELECT id, dealer_id, brand, model, variant, year, selling_price, slug
    INTO v_car
    FROM car_listings
   WHERE id = p_listing_id;

  IF v_car.id IS NULL THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = 'check_violation';
  END IF;

  -- Rolling 24h cap, counted per reporter across all listings.
  SELECT count(*) INTO v_recent
    FROM listing_reports
   WHERE reporter_id = v_uid
     AND created_at > now() - interval '24 hours';

  IF v_recent >= 3 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM listing_reports
     WHERE reporter_id = v_uid
       AND listing_id = p_listing_id
       AND status IN ('open','reviewing')
  ) THEN
    RAISE EXCEPTION 'already_reported' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO listing_reports (listing_id, dealer_id, reporter_id, reason, note, listing_snapshot)
  VALUES (
    p_listing_id,
    v_car.dealer_id,
    v_uid,
    p_reason,
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    jsonb_build_object(
      'brand', v_car.brand, 'model', v_car.model, 'variant', v_car.variant,
      'year', v_car.year, 'selling_price', v_car.selling_price, 'slug', v_car.slug
    )
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── Admin queue ────────────────────────────────────────────────────────────
-- Full detail in one call: report + reporter identity + live listing + dealer.
-- An RPC rather than client-side joins so no broad SELECT policy has to be
-- opened on profiles/car_listings for this feature.
CREATE OR REPLACE FUNCTION public.admin_list_listing_reports(p_status text DEFAULT NULL)
RETURNS TABLE (
  id uuid, created_at timestamptz, status text, reason text, note text,
  admin_note text, resolved_at timestamptz,
  listing_id uuid, listing_snapshot jsonb, listing_exists boolean,
  listing_status text, listing_slug text, listing_price numeric,
  dealer_id uuid, dealer_name text, dealer_email text, dealer_subdomain text,
  reporter_id uuid, reporter_name text, reporter_email text,
  reporter_total_reports bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT is_superadmin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT r.id, r.created_at, r.status, r.reason, r.note,
         r.admin_note, r.resolved_at,
         r.listing_id, r.listing_snapshot, (c.id IS NOT NULL) AS listing_exists,
         c.status, c.slug, c.selling_price,
         r.dealer_id, d.full_name, d.email, d.subdomain,
         r.reporter_id, p.full_name, p.email,
         (SELECT count(*) FROM listing_reports x WHERE x.reporter_id = r.reporter_id)
    FROM listing_reports r
    LEFT JOIN car_listings c ON c.id = r.listing_id
    LEFT JOIN profiles     d ON d.id = r.dealer_id
    LEFT JOIN profiles     p ON p.id = r.reporter_id
   WHERE p_status IS NULL OR r.status = p_status
   ORDER BY (r.status = 'open') DESC, r.created_at DESC;
END;
$$;

-- ── Admin triage ───────────────────────────────────────────────────────────
-- Status only. Deliberately does NOT act on the listing: if the superadmin
-- decides a listing must go, they use the existing listing controls. Keeping
-- the two separate is what stops "N reports" from ever becoming an automatic
-- penalty.
CREATE OR REPLACE FUNCTION public.admin_resolve_listing_report(
  p_report_id uuid,
  p_status    text,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT is_superadmin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_status NOT IN ('open','reviewing','resolved','dismissed') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE listing_reports
     SET status      = p_status,
         admin_note  = COALESCE(NULLIF(btrim(COALESCE(p_admin_note, '')), ''), admin_note),
         resolved_at = CASE WHEN p_status IN ('resolved','dismissed') THEN now() ELSE NULL END,
         resolved_by = CASE WHEN p_status IN ('resolved','dismissed') THEN auth.uid() ELSE NULL END
   WHERE id = p_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.report_listing(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_listing(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_listing_reports(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_listing_report(uuid, text, text) TO authenticated;
