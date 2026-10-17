-- A broker can also sell new cars (owner, 2026-10-17). "Sells new for brand X"
-- is now new_car_brand being set, not seller_type = 'new_car'. A broker with a
-- brand keeps seller_type 'broker' (src/pages/SalesmanOnboarding.jsx
-- sellsToDb). Card creation already keyed on new_car_brand
-- (new_car_card_fill); these were the only two objects keyed on seller_type.
-- One migration, one schema reload. Apply after 22:00 MYT.

-- 1. Public "advisors for this model" list: any non-private salesman with the
--    brand and a live card of the model. Body otherwise identical to live.
create or replace function public.get_new_model_advisors(p_brand text, p_model text)
returns table (slug text, full_name text, avatar_url text, city text, state text,
  is_verified boolean, has_whatsapp boolean, price_zone text,
  reply_median_minutes integer, reply_samples integer, variants_sold integer)
language sql stable security definer set search_path = public as $$
  with live as (
    select p.*, v.n as variants_sold
      from profiles p
      cross join lateral (
        select count(*)::int as n
          from public_car_listings pc
          join car_listings c on c.id = pc.id
          join new_car_models m on m.id = c.new_car_model_id
         where c.dealer_id = p.id and not c.new_car_unit
           and m.brand = p_brand and m.model = p_model
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
         r.median_minutes, r.samples, l.variants_sold
    from live l
    left join lateral get_agent_reply_time(l.id) r on true
   order by coalesce(l.is_verified, false) desc,
            case when coalesce(r.samples, 0) >= 5 then r.median_minutes end asc nulls last,
            l.full_name;
$$;
-- CREATE OR REPLACE keeps the existing grants (anon + authenticated execute).

-- 2. Re-price a seller's cards when their state/city changes: fire for anyone
--    holding a brand, not only seller_type 'new_car'.
drop trigger if exists trg_new_car_cards_on_zone_change on public.profiles;
create trigger trg_new_car_cards_on_zone_change
  after update of state, city on public.profiles
  for each row when (new.new_car_brand is not null)
  execute function public.new_car_cards_on_zone_change();
