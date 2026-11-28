-- PUBLIC-NAME-1 (owner, 2026-11-28): a solo seller's legal name is never public.
-- The page, Google title, share card and advisor list read `full_name` from three
-- public functions. For a solo seller (dealer_id null) they now return the page
-- username (slug) in that field; a seller linked to a dealer keeps the real name.
-- Same signatures, so CREATE OR REPLACE replaces them (no second overload).
-- QUEUED: apply after midnight Malaysia time, nobody live. Then verify with
--   select full_name from get_salesman_by_slug('<a solo seller slug>');

create or replace function public.public_seller_name(p_full_name text, p_slug text, p_dealer_id uuid)
returns text
language sql immutable
set search_path to 'public'
as $$ select case when p_dealer_id is null and nullif(btrim(p_slug), '') is not null
                  then p_slug else p_full_name end $$;
revoke all on function public.public_seller_name(text, text, uuid) from public, anon, authenticated;

create or replace function public.get_salesman_by_id(p_id uuid)
returns table(id uuid, full_name text, avatar_url text, dealership text, site_name text, brand_color text, slug text, subdomain text, whatsapp_number text, dealer_id uuid, bio text, city text, state text, facebook text, website text, is_verified boolean, deposit_policy text, deposit_terms text, processing_fee numeric, handles_roadtax_insurance boolean, location text, business_hours text, phone text, has_whatsapp boolean, has_phone boolean)
language sql stable security definer
set search_path to 'public'
as $function$
select p.id, public.public_seller_name(p.full_name, p.slug, p.dealer_id), p.avatar_url, p.dealership, p.site_name,
case when f.full_page then p.brand_color end,
p.slug, p.subdomain, null::text, p.dealer_id,
case when f.full_page then p.bio end,
p.city, p.state,
case when f.full_page then p.facebook end,
case when f.full_page then p.website end,
coalesce(p.is_verified, false),
p.deposit_policy, p.deposit_terms, p.processing_fee,
p.handles_roadtax_insurance, p.location, p.business_hours, null::text,
nullif(btrim(p.whatsapp_number), '') is not null,
nullif(btrim(p.phone), '') is not null
from profiles p
cross join lateral (select public.salesman_has_full_page(p.id) as full_page) f
where p.id = p_id
and p.role = 'salesman'
and p.is_active = true
limit 1;
$function$;

create or replace function public.get_salesman_by_slug(p_slug text)
returns table(id uuid, full_name text, avatar_url text, cover_url text, dealership text, site_name text, brand_color text, slug text, subdomain text, whatsapp_number text, dealer_id uuid, bio text, city text, state text, location text, facebook text, website text, instagram text, tiktok text, job_title text, about_text text, response_time text, specializations text[], is_verified boolean, seller_type text, has_whatsapp boolean, page_basic boolean)
language sql stable security definer
set search_path to 'public'
as $function$
select q.id, public.public_seller_name(q.full_name, q.slug, q.dealer_id), q.avatar_url,
case when q.full_page then q.cover_url end,
q.dealership, q.site_name,
case when q.full_page then q.brand_color end,
q.slug, q.subdomain, null::text, q.dealer_id,
case when q.full_page then q.bio end,
q.city, q.state, q.location,
case when q.full_page then q.facebook end,
case when q.full_page then q.website end,
case when q.full_page then q.instagram end,
case when q.full_page then q.tiktok end,
case when q.full_page then q.job_title end,
case when q.full_page then q.about_text end,
q.response_time,
case when q.full_page then q.specializations end,
coalesce(q.is_verified, false),
q.seller_type,
coalesce(nullif(btrim(q.whatsapp_number), ''), nullif(btrim(q.phone), '')) is not null,
not q.full_page
from (
select p.*, public.salesman_has_full_page(p.id) as full_page
from profiles p
where p.slug = p_slug
and p.role = 'salesman'
and (p.is_active = true or p.approval_status = 'pending')
and p.suspended_at is null
and coalesce(p.account_status, 'active') <> 'deleted'
and p.deleted_at is null
limit 1
) q;
$function$;

create or replace function public.get_new_model_advisors(p_brand text, p_model text)
returns table(slug text, full_name text, avatar_url text, city text, state text, is_verified boolean, has_whatsapp boolean, price_zone text, reply_median_minutes integer, reply_samples integer, variants_sold integer, card_id uuid, card_slug text)
language sql stable security definer
set search_path to 'public'
as $function$
  with live as (
    select p.*, v.n as variants_sold, v.card_id, v.card_slug
      from profiles p
      cross join lateral (
        select count(*) over ()::int as n, pc.id as card_id, pc.slug as card_slug
          from public_car_listings pc
          join car_listings c on c.id = pc.id
          join new_car_models m on m.id = c.new_car_model_id
         where c.dealer_id = p.id and not c.new_car_unit
           and m.brand = p_brand and m.model = p_model
         order by c.created_at desc
         limit 1
      ) v
     where p.new_car_brand = p_brand
       and coalesce(p.seller_type, 'broker') <> 'private'
       and v.n > 0 and p.role = 'salesman' and p.slug is not null
       and p.is_active = true and p.approval_status = 'approved'
       and p.suspended_at is null
       and coalesce(p.account_status, 'active') <> 'deleted'
       and p.deleted_at is null
     order by coalesce(p.is_verified, false) desc, p.full_name
     limit 50
  )
  select l.slug, public.public_seller_name(l.full_name, l.slug, l.dealer_id), l.avatar_url, l.city, l.state,
         coalesce(l.is_verified, false),
         coalesce(nullif(btrim(l.whatsapp_number), ''), nullif(btrim(l.phone), '')) is not null,
         new_car_price_zone(l.state, l.city),
         r.median_minutes, r.samples, l.variants_sold, l.card_id, l.card_slug
    from live l
    left join lateral get_agent_reply_time(l.id) r on true
   order by coalesce(l.is_verified, false) desc,
            case when coalesce(r.samples, 0) >= 5 then r.median_minutes end asc nulls last,
            l.slug;
$function$;

-- Keep the public grants exactly as they are on the live functions (anon + authenticated
-- already hold them; CREATE OR REPLACE keeps them). Verify afterwards:
--   select has_function_privilege('anon', 'public.public_seller_name(text,text,uuid)', 'execute');  -- false
