-- MED: enforce unique salesman slugs (case-insensitive, ignore null/empty).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_slug_unique
  ON public.profiles (lower(slug))
  WHERE slug IS NOT NULL AND slug <> '';

-- MED: availability checks must see ALL profiles, but profiles RLS only exposes
-- own/team rows — so a client `.select().eq('slug'/'subdomain')` is blind to
-- other dealers and wrongly reports "available". These SECURITY DEFINER helpers
-- check across all rows (excluding the caller's own) and fold in reserved +
-- min-length.
CREATE OR REPLACE FUNCTION public.is_slug_available(p_slug text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT length(coalesce(p_slug,'')) >= 3
     AND NOT EXISTS (
       SELECT 1 FROM profiles
       WHERE lower(slug) = lower(p_slug) AND id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
     );
$$;

CREATE OR REPLACE FUNCTION public.is_subdomain_available(p_sub text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT length(coalesce(p_sub,'')) >= 3
     AND NOT is_reserved_subdomain(p_sub)
     AND NOT EXISTS (
       SELECT 1 FROM profiles
       WHERE lower(subdomain) = lower(p_sub) AND id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
     );
$$;

GRANT EXECUTE ON FUNCTION public.is_slug_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_subdomain_available(text) TO anon, authenticated;
