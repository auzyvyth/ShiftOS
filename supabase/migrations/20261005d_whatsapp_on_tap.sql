-- CDP-3 (2026-10-05): seller WhatsApp numbers no longer ship to the public.
--
-- Before: anyone could pull every seller's number without loading a page.
--   * public_dealer_profiles (definer view, anon SELECT) returned every active
--     dealer's whatsapp_number in ONE request.
--   * get_dealer_profile_by_id / get_salesman_by_id returned whatsapp_number AND
--     phone for any id, and ids are enumerable from public_car_listings.
--   * get_salesman_by_slug returned whatsapp_number for any slug.
-- After: the number is handed out one at a time by get_seller_whatsapp, called
-- only from the /api/wa route (rate-limited per IP in middleware.js), which
-- redirects the buyer straight to wa.me. Same pattern as
-- get_listing_call_number (CDP-2).
--
-- TWO migrations, run in order:
--   d (this file) adds the lookup. Safe any time: nothing stops working.
--   e strips the numbers from the RPCs and the view. Run it only AFTER the
--     frontend that links through /api/wa is live on production, or the live
--     site's WhatsApp buttons disappear until it ships.
--
-- Left alone on purpose: get_dealer_profile_by_subdomain. It serves a dealer's
-- OWN storefront, where the WhatsApp number is the site's main contact.

-- 1. The one-number lookup -----------------------------------------------------
create or replace function public.get_seller_whatsapp(
  p_listing_id uuid default null,
  p_slug       text default null,
  p_seller_id  uuid default null)
returns text language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_dealer uuid; v_status text; v_who uuid; v_num text;
begin
  if p_listing_id is not null then
    select dealer_id, status into v_dealer, v_status from car_listings where id = p_listing_id;
    -- Only a listing the public can see. A sold/draft/hidden car must not
    -- become a way to look a seller's number up.
    if v_dealer is null or (v_status is distinct from 'available' and v_status is distinct from 'reserved')
       or not public.is_dealer_active(v_dealer) then
      return null;
    end if;
    -- ONE resolver for who answers this car (CLAUDE.md, inbound attribution).
    -- p_slug is a rep the buyer chose or arrived through; it only counts when
    -- that rep belongs to this car's dealer.
    v_who := public.resolve_lead_salesman(v_dealer, p_listing_id, nullif(btrim(p_slug), ''), null);
    if v_who is not null then
      select coalesce(nullif(btrim(whatsapp_number), ''), nullif(btrim(phone), ''))
        into v_num from profiles where id = v_who;
    end if;
    if v_num is null then
      select coalesce(nullif(btrim(whatsapp_number), ''), nullif(btrim(phone), ''))
        into v_num from profiles where id = v_dealer;
    end if;
    return v_num;
  end if;

  -- No car: an agent page (/s/:slug) or a seller-level button.
  select coalesce(nullif(btrim(p.whatsapp_number), ''), nullif(btrim(p.phone), ''))
    into v_num
    from profiles p
   where ((p_slug is not null and p.slug = p_slug and p.role = 'salesman')
       or (p_slug is null and p_seller_id is not null and p.id = p_seller_id
           and p.role in ('salesman', 'dealer', 'owner')))
     and p.is_active = true
     and p.suspended_at is null
     and coalesce(p.account_status, 'active') <> 'deleted'
     and p.deleted_at is null
   limit 1;
  return v_num;
end;
$$;
revoke all on function public.get_seller_whatsapp(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.get_seller_whatsapp(uuid, text, uuid) to anon, authenticated, service_role;
