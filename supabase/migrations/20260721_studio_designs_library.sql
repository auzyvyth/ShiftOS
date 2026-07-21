-- TikTok Studio design library — per-user saved designs, 5 max (enforced
-- client-side + a hard DB cap trigger so a crafted client can't hoard rows).
-- Applied to live DB 2026-07-21 (MCP migration studio_designs_library).
CREATE TABLE IF NOT EXISTS public.studio_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Design',
  payload jsonb NOT NULL,
  thumb text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_designs_user ON public.studio_designs(user_id, created_at DESC);

ALTER TABLE public.studio_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS studio_designs_own ON public.studio_designs;
CREATE POLICY studio_designs_own ON public.studio_designs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.enforce_studio_design_cap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM studio_designs WHERE user_id = NEW.user_id;
  IF v_count >= 5 THEN
    RAISE EXCEPTION 'design_library_full' USING HINT = 'Max 5 saved designs — delete one first';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_studio_design_cap ON public.studio_designs;
CREATE TRIGGER trg_studio_design_cap
  BEFORE INSERT ON public.studio_designs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_studio_design_cap();
