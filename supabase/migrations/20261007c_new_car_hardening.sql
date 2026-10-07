-- NEWCAR-1 hardening (security recheck, 2026-10-07).
--
-- 1. Table grants. Supabase's default grants gave anon and authenticated every
--    privilege (incl. TRUNCATE, which RLS does not cover) on both new tables.
--    The rest of the project is trimmed; match it. RLS still decides rows.
-- 2. The public model page lists only APPROVED + ACTIVE advisors, capped at 50.
--    Perodua has publicly warned about scammers posing as sales advisors and
--    taking booking fees into personal accounts; a brand-named public list must
--    not show a signup nobody has checked yet. (The advisor's own mini page keeps
--    the get_salesman_by_slug rule; this is the page that ranks strangers.)
--    The cap bounds get_agent_reply_time, which runs once per advisor row.
-- 3. source_url must be http(s): it is rendered as a link in the console.

revoke all on public.new_car_models from anon, authenticated;
grant select on public.new_car_models to anon;
grant select, insert, update, delete on public.new_car_models to authenticated;

revoke all on public.seller_new_models from anon, authenticated;
grant select, insert, delete on public.seller_new_models to authenticated;

alter table public.new_car_models drop constraint if exists new_car_models_source_url_check;
alter table public.new_car_models add constraint new_car_models_source_url_check
  check (source_url is null or source_url ~* '^https?://');

create or replace function public.get_new_model_advisors(p_brand text, p_model text)
returns table (
  slug text, full_name text, avatar_url text, city text, state text,
  is_verified boolean, has_whatsapp boolean, price_zone text,
  reply_median_minutes integer, reply_samples integer, variants_sold integer
)
language sql stable security definer set search_path = public as $$
  with sellers as (
    select sm.seller_id, count(*)::int as variants_sold
      from seller_new_models sm
      join new_car_models m on m.id = sm.model_id
     where m.is_active and m.brand = p_brand and m.model = p_model
     group by sm.seller_id
  ), live as (
    select p.*, s.variants_sold
      from sellers s
      join profiles p on p.id = s.seller_id
     where p.role = 'salesman'
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

revoke all on function public.get_new_model_advisors(text, text) from public, anon, authenticated;
grant execute on function public.get_new_model_advisors(text, text) to anon, authenticated;
