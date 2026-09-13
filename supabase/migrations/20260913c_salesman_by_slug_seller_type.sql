-- Appends seller_type to get_salesman_by_slug's return columns so the mini
-- page can tell a buyer whether they're dealing with a private seller or a
-- broker/agent. RETURNS TABLE cannot be widened via CREATE OR REPLACE (the
-- return type must stay identical), so this must drop + recreate — same
-- trap as the CLAUDE.md view/function reordering notes. Re-asserting the
-- same EXECUTE grants that already existed (anon + authenticated + PUBLIC):
-- this RPC is deliberately public, it backs a public mini page.
drop function if exists public.get_salesman_by_slug(text);

create or replace function public.get_salesman_by_slug(p_slug text)
 returns table(id uuid, full_name text, avatar_url text, cover_url text, dealership text, site_name text, brand_color text, slug text, subdomain text, whatsapp_number text, dealer_id uuid, bio text, city text, state text, location text, facebook text, website text, instagram text, tiktok text, job_title text, about_text text, response_time text, specializations text[], is_verified boolean, seller_type text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  SELECT
    id, full_name, avatar_url, cover_url, dealership, site_name, brand_color,
    slug, subdomain, whatsapp_number, dealer_id, bio, city, state, location,
    facebook, website, instagram, tiktok, job_title, about_text, response_time,
    specializations,
    COALESCE(is_verified, false) AS is_verified,
    seller_type
  FROM profiles
  WHERE slug = p_slug
    AND role = 'salesman'
    AND (is_active = true OR approval_status = 'pending')
    AND suspended_at IS NULL
    AND COALESCE(account_status, 'active') <> 'deleted'
    AND deleted_at IS NULL
  LIMIT 1;
$function$;

grant execute on function public.get_salesman_by_slug(text) to anon, authenticated, service_role;
