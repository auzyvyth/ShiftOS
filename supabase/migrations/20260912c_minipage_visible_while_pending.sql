-- PREM-MINI-1: every newly signed-up seller's mini page said "Agent not found".
--
-- `get_salesman_by_slug` required `is_active = true`. A self-signup does not get
-- that until a superadmin approves them: `SalesmanOnboarding.activate()` does
-- write `is_active: true`, but the BEFORE trigger
-- `prevent_profile_privilege_escalation()` reverts exactly that transition
--     IF NOT self_restoring AND NEW.is_active = true AND OLD.is_active = false
--        THEN NEW.is_active := false;
-- for any non-superadmin caller. So the client write never takes effect, and
-- `decide_user_approval()` is the only thing that can flip it. Result: a seller
-- finished onboarding, got a slug, shared their link, and the page told the
-- world they did not exist.
--
-- Now: a seller still awaiting review resolves and their page renders as an
-- empty shell. Their CARS are unaffected either way — `public_car_listings`
-- filters on `is_active` independently, so a pending seller's page shows no
-- listings until approval, exactly as before.
--
-- The `is_active = true` test is KEPT and widened by one specific case rather
-- than replaced, because `is_active = false` means several different things and
-- only ONE of them should become visible:
--   * pending review          -> SHOW (this change)
--   * suspended               -> stay hidden (20260815b's whole purpose)
--   * rejected                -> stay hidden
--   * deleted / self-deleted  -> stay hidden
-- `suspended_at`, `account_status` and `deleted_at` are re-asserted explicitly
-- so a seller who is BOTH pending and suspended (suspended before ever being
-- approved — approval_status is still 'pending' there) stays hidden: the
-- approval clause alone would have matched them.
--
-- CREATE OR REPLACE, not DROP + CREATE: the return type is untouched, so the
-- existing anon/authenticated/service_role grants survive. Do not convert this
-- to a DROP unless you re-assert them (see the share-token rules in CLAUDE.md).

CREATE OR REPLACE FUNCTION public.get_salesman_by_slug(p_slug text)
RETURNS TABLE(
  id uuid, full_name text, avatar_url text, cover_url text, dealership text,
  site_name text, brand_color text, slug text, subdomain text,
  whatsapp_number text, dealer_id uuid, bio text, city text, state text,
  location text, facebook text, website text, instagram text, tiktok text,
  job_title text, about_text text, response_time text, specializations text[],
  is_verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    id, full_name, avatar_url, cover_url, dealership, site_name, brand_color,
    slug, subdomain, whatsapp_number, dealer_id, bio, city, state, location,
    facebook, website, instagram, tiktok, job_title, about_text, response_time,
    specializations,
    COALESCE(is_verified, false) AS is_verified
  FROM profiles
  WHERE slug = p_slug
    AND role = 'salesman'
    AND (is_active = true OR approval_status = 'pending')
    AND suspended_at IS NULL
    AND COALESCE(account_status, 'active') <> 'deleted'
    AND deleted_at IS NULL
  LIMIT 1;
$function$;
