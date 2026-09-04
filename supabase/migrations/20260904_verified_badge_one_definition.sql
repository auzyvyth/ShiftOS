-- "Verified" on a public seller surface means AN ADMIN CHECKED THIS ACCOUNT --
-- profiles.is_verified, set only by the platform console (AccountsTab) together
-- with verified_at / verified_by. These two RPCs had each invented their own
-- definition instead:
--   get_salesman_by_slug (the public mini page): ic_hash IS NOT NULL OR
--     ic_number <> ''  -- i.e. "this seller uploaded an IC"
--   get_salesman_by_id  (the car detail page):   ic_number <> ''
--     -- plaintext only, so it read FALSE for everyone verified through the
--     -- secure hashed path, which nulls ic_number out
-- Uploading a document is not a check. Under the slug version, testsales and
-- auzytest -- neither approved by anyone -- were shown a blue "Verified by
-- XDrive" tick on their public mini page. The badge was claiming a review that
-- had not happened, which is worse than having no badge at all.
-- One definition now, the same column the marketplace cards already read via
-- public_car_listings.dealer_is_verified.
--
-- Both keep their existing signature and return-column list, so this is a true
-- CREATE OR REPLACE: no second overload is created (see the CLAUDE.md note on
-- reordered params) and the anon/authenticated EXECUTE grants are preserved.

create or replace function public.get_salesman_by_slug(p_slug text)
returns table (
  id uuid, full_name text, avatar_url text, cover_url text, dealership text,
  site_name text, brand_color text, slug text, subdomain text,
  whatsapp_number text, dealer_id uuid, bio text, city text, state text,
  location text, facebook text, website text, instagram text, tiktok text,
  job_title text, about_text text, response_time text,
  specializations text[], is_verified boolean
)
language sql
stable
security definer
set search_path = public
as $$
  SELECT
    id, full_name, avatar_url, cover_url, dealership, site_name, brand_color,
    slug, subdomain, whatsapp_number, dealer_id, bio, city, state, location,
    facebook, website, instagram, tiktok, job_title, about_text, response_time,
    specializations,
    COALESCE(is_verified, false) AS is_verified
  FROM profiles
  WHERE slug = p_slug
    AND role = 'salesman'
    AND is_active = true
  LIMIT 1;
$$;

create or replace function public.get_salesman_by_id(p_id uuid)
returns table (
  id uuid, full_name text, avatar_url text, dealership text, site_name text,
  brand_color text, slug text, subdomain text, whatsapp_number text,
  dealer_id uuid, bio text, city text, state text, facebook text, website text,
  is_verified boolean, deposit_policy text, deposit_terms text,
  processing_fee numeric, handles_roadtax_insurance boolean, location text,
  business_hours text, phone text
)
language sql
stable
security definer
set search_path = public
as $$
  SELECT
    id, full_name, avatar_url, dealership, site_name, brand_color, slug,
    subdomain, whatsapp_number, dealer_id, bio, city, state, facebook, website,
    COALESCE(is_verified, false) AS is_verified,
    deposit_policy, deposit_terms, processing_fee,
    handles_roadtax_insurance, location, business_hours, phone
  FROM profiles
  WHERE id = p_id
    AND role = 'salesman'
    AND is_active = true
  LIMIT 1;
$$;
