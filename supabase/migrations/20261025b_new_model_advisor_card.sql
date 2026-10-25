-- NEWCAR-STATS (2026-10-25): /new-cars/:brand/:model links each advisor to
-- their CARD for the model, so a buyer's tap opens the card and is counted as
-- a car view on the seller's dashboard. Since model cards left the browse
-- surfaces (2026-10-23) the card had no road in from the new-car page, and
-- card views fell to zero.
--
-- Adds card_id + card_slug to get_new_model_advisors. The return type changes,
-- so it is DROP + CREATE (CREATE OR REPLACE cannot change a return type), and
-- the grants are re-stated: anon + authenticated (the public page) and
-- service_role. Nothing depends on the function's row type.
begin;

drop function if exists public.get_new_model_advisors(text, text);

create function public.get_new_model_advisors(p_brand text, p_model text)
returns table(slug text, full_name text, avatar_url text, city text, state text,
              is_verified boolean, has_whatsapp boolean, price_zone text,
              reply_median_minutes integer, reply_samples integer, variants_sold integer,
              card_id uuid, card_slug text)
language sql
stable security definer
set search_path to 'public'
as $function$
  with live as (
    select p.*, v.n as variants_sold, v.card_id, v.card_slug
      from profiles p
      cross join lateral (
        -- One card per model per advisor (car_listings_one_card_per_model);
        -- the newest wins should that ever not hold.
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
       and v.n > 0
       and p.role = 'salesman'
       and p.slug is not null
       and p.is_active = true
       and p.approval_status = 'approved'
       and p.suspended_at is null
       and coalesce(p.account_status, 'active') <> 'deleted'
       and p.deleted_at is null
     order by coalesce(p.is_verified, false) desc, p.full_name
     limit 50
  )
  select l.slug, l.full_name, l.avatar_url, l.city, l.state,
         coalesce(l.is_verified, false),
         coalesce(nullif(btrim(l.whatsapp_number), ''), nullif(btrim(l.phone), '')) is not null,
         new_car_price_zone(l.state, l.city),
         r.median_minutes, r.samples, l.variants_sold,
         l.card_id, l.card_slug
    from live l
    left join lateral get_agent_reply_time(l.id) r on true
   order by coalesce(l.is_verified, false) desc,
            case when coalesce(r.samples, 0) >= 5 then r.median_minutes end asc nulls last,
            l.full_name;
$function$;

revoke all on function public.get_new_model_advisors(text, text) from public;
grant execute on function public.get_new_model_advisors(text, text) to anon, authenticated, service_role;

commit;
