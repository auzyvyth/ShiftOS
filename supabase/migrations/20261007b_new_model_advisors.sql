-- NEWCAR-1 step 5: the public "one card per model" page (/new-cars/:brand/:model).
--
-- The price is the same at every advisor, so the page lists the PEOPLE who sell
-- the model and lets buyers compare what actually differs: where they are and
-- how fast they answer (measured, get_agent_reply_time). seller_new_models is
-- own-rows RLS, so the public reads it only through this function, which
-- applies the same "is this seller live" rules as get_salesman_by_slug and
-- returns no phone number (CDP-3: buttons go through /api/wa by slug).

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
  )
  select p.slug, p.full_name, p.avatar_url, p.city, p.state,
         coalesce(p.is_verified, false),
         coalesce(nullif(btrim(p.whatsapp_number), ''), nullif(btrim(p.phone), '')) is not null,
         new_car_price_zone(p.state, p.city),
         r.median_minutes, r.samples, s.variants_sold
    from sellers s
    join profiles p on p.id = s.seller_id
    left join lateral get_agent_reply_time(p.id) r on true
   where p.role = 'salesman'
     and p.slug is not null
     and (p.is_active = true or p.approval_status = 'pending')
     and p.suspended_at is null
     and coalesce(p.account_status, 'active') <> 'deleted'
     and p.deleted_at is null
   order by coalesce(p.is_verified, false) desc,
            case when coalesce(r.samples, 0) >= 5 then r.median_minutes end asc nulls last,
            p.full_name;
$$;

revoke all on function public.get_new_model_advisors(text, text) from public, anon, authenticated;
grant execute on function public.get_new_model_advisors(text, text) to anon, authenticated;
