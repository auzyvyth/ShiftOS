-- NEWCAR-1 round 2 (2026-10-08): every model shows by default + the Proton list.
--
-- 1. Opt-OUT, not opt-in. An advisor saw an empty page until they ticked 30
--    boxes, and a variant added later was missing from every page until each
--    advisor ticked it too. Now an advisor's page shows EVERY active model of
--    their brand (profiles.new_car_brand) and they only hide the ones they do
--    not sell. seller_new_models is renamed seller_hidden_models; its old rows
--    meant "I sell this", the opposite of "hide this", so they are cleared
--    (1 row on the day, on a test model).
-- 2. specs jsonb: engine / power / transmission / seats / EV range, shown as the
--    spec line in the live presenter. Display only, never used in a price.
-- 3. Proton price list, Peninsular only (owner's file, 2026-10-08). List price,
--    on the road without insurance. Spot-checked against paultan.org /
--    wapcar.my / autobuzz.my for Saga, X50 and e.MAS 7: all match. Rebates in
--    the file are NOT loaded: the ones checked were launch promos that have
--    ended (X50's ended 31 Oct 2025). The presenter's per-live rebate box is
--    where a current promo goes. Persona (only a price RANGE) and Iriz (one
--    unverified odd number) are left out.
-- 4. The test row "Perodua Saga Premium" (Saga is a Proton) is hidden.
--
-- The functions keep their names and argument lists, so CREATE OR REPLACE
-- replaces them in place (no overloads).

-- 1 -------------------------------------------------------------------------
alter table public.seller_new_models rename to seller_hidden_models;
alter index if exists public.seller_new_models_model_idx rename to seller_hidden_models_model_idx;
alter policy seller_new_models_own_read on public.seller_hidden_models rename to seller_hidden_models_own_read;
alter policy seller_new_models_own_ins  on public.seller_hidden_models rename to seller_hidden_models_own_ins;
alter policy seller_new_models_own_del  on public.seller_hidden_models rename to seller_hidden_models_own_del;
delete from public.seller_hidden_models;

-- 2 -------------------------------------------------------------------------
alter table public.new_car_models add column if not exists specs jsonb;

-- Mini page + live presenter: the seller's brand, minus what they hid.
drop function if exists public.get_seller_new_models(text);
create function public.get_seller_new_models(p_slug text)
returns table (
  model_id uuid, brand text, model text, variant text, body_type text,
  fuel_type text, transmission text, price numeric, price_zone text,
  effective_from date, source_url text, specs jsonb
)
language sql stable security definer set search_path = public as $$
  with s as (
    select p.id, p.new_car_brand, new_car_price_zone(p.state, p.city) as zone
      from profiles p
     where p.slug = p_slug
       and p.role = 'salesman'
       and p.seller_type = 'new_car'
       and p.new_car_brand is not null
       and (p.is_active = true or p.approval_status = 'pending')
       and p.suspended_at is null
       and coalesce(p.account_status, 'active') <> 'deleted'
       and p.deleted_at is null
     limit 1
  )
  select m.id, m.brand, m.model, m.variant, m.body_type, m.fuel_type, m.transmission,
         new_car_zone_price(m, s.zone), s.zone, m.effective_from, m.source_url, m.specs
    from s
    join new_car_models m on m.brand = s.new_car_brand and m.is_active
   where not exists (select 1 from seller_hidden_models h where h.seller_id = s.id and h.model_id = m.id)
   order by m.sort_order, m.model, m.price_peninsular;
$$;

-- Settings: whole brand, priced for the caller's zone. selected = not hidden.
create or replace function public.get_my_new_car_catalogue(p_brand text)
returns table (
  model_id uuid, model text, variant text, price numeric, price_zone text,
  effective_from date, selected boolean
)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, new_car_price_zone(p.state, p.city) as zone
      from profiles p where p.id = auth.uid()
  )
  select m.id, m.model, m.variant, new_car_zone_price(m, me.zone), me.zone,
         m.effective_from,
         not exists (select 1 from seller_hidden_models h where h.seller_id = me.id and h.model_id = m.id)
    from me
    join new_car_models m on m.brand = p_brand and m.is_active
   order by m.sort_order, m.model, m.price_peninsular;
$$;

-- Public model page: advisors of this brand who have not hidden every variant.
create or replace function public.get_new_model_advisors(p_brand text, p_model text)
returns table (
  slug text, full_name text, avatar_url text, city text, state text,
  is_verified boolean, has_whatsapp boolean, price_zone text,
  reply_median_minutes integer, reply_samples integer, variants_sold integer
)
language sql stable security definer set search_path = public as $$
  with live as (
    select p.*, v.n as variants_sold
      from profiles p
      cross join lateral (
        select count(*)::int as n
          from new_car_models m
         where m.is_active and m.brand = p_brand and m.model = p_model
           and not exists (select 1 from seller_hidden_models h where h.seller_id = p.id and h.model_id = m.id)
      ) v
     where p.seller_type = 'new_car'
       and p.new_car_brand = p_brand
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

revoke all on function public.get_seller_new_models(text) from public, anon, authenticated;
grant execute on function public.get_seller_new_models(text) to anon, authenticated;
revoke all on function public.get_my_new_car_catalogue(text) from public, anon, authenticated;
grant execute on function public.get_my_new_car_catalogue(text) to authenticated;
revoke all on function public.get_new_model_advisors(text, text) from public, anon, authenticated;
grant execute on function public.get_new_model_advisors(text, text) to anon, authenticated;

-- 3 -------------------------------------------------------------------------
insert into public.new_car_models
  (brand, model, variant, body_type, fuel_type, transmission, price_peninsular, effective_from, source_url, sort_order, specs)
values
  ('Proton','Saga','1.5 Standard','Sedan','Petrol','4-speed auto',38990,'2026-10-08','https://paultan.org/research/proton/saga/',10,'{"engine":"1.5L NA","power_ps":120,"torque_nm":150,"seats":5}'),
  ('Proton','Saga','1.5 Executive','Sedan','Petrol','4-speed auto',44990,'2026-10-08','https://paultan.org/research/proton/saga/',10,'{"engine":"1.5L NA","power_ps":120,"torque_nm":150,"seats":5}'),
  ('Proton','Saga','1.5 Premium','Sedan','Petrol','CVT',49990,'2026-10-08','https://paultan.org/research/proton/saga/',10,'{"engine":"1.5L NA","power_ps":120,"torque_nm":150,"seats":5}'),
  ('Proton','S70','1.5 Lite','Sedan','Petrol','CVT',59800,'2026-10-08',null,20,'{"engine":"1.5L NA","power_ps":120,"torque_nm":150,"seats":5}'),
  ('Proton','S70','1.5 Prime','Sedan','Petrol','CVT',62800,'2026-10-08',null,20,'{"engine":"1.5L NA","power_ps":120,"torque_nm":150,"seats":5}'),
  ('Proton','S70','1.5TD Executive','Sedan','Petrol','7-speed DCT',73800,'2026-10-08',null,20,'{"engine":"1.5L turbo","power_ps":181,"torque_nm":290,"seats":5}'),
  ('Proton','S70','1.5TD Premium','Sedan','Petrol','7-speed DCT',79800,'2026-10-08',null,20,'{"engine":"1.5L turbo","power_ps":181,"torque_nm":290,"seats":5}'),
  ('Proton','S70','1.5TD Flagship','Sedan','Petrol','7-speed DCT',89800,'2026-10-08',null,20,'{"engine":"1.5L turbo","power_ps":181,"torque_nm":290,"seats":5}'),
  ('Proton','S70','1.5TD Flagship X','Sedan','Petrol','7-speed DCT',94800,'2026-10-08',null,20,'{"engine":"1.5L turbo","power_ps":181,"torque_nm":290,"seats":5}'),
  ('Proton','X50','1.5TD Executive','SUV','Petrol','7-speed DCT',89800,'2026-10-08','https://paultan.org/research/proton/x50/',30,'{"engine":"1.5L turbo","power_ps":181,"torque_nm":290,"seats":5}'),
  ('Proton','X50','1.5TD Premium','SUV','Petrol','7-speed DCT',101800,'2026-10-08','https://paultan.org/research/proton/x50/',30,'{"engine":"1.5L turbo","power_ps":181,"torque_nm":290,"seats":5}'),
  ('Proton','X50','1.5TD Flagship','SUV','Petrol','7-speed DCT',113300,'2026-10-08','https://paultan.org/research/proton/x50/',30,'{"engine":"1.5L turbo","power_ps":181,"torque_nm":290,"seats":5}'),
  ('Proton','X70','1.5TD Executive','SUV','Petrol','7-speed DCT',106800,'2026-10-08',null,40,'{"engine":"1.5L turbo","power_ps":181,"torque_nm":290,"seats":5}'),
  ('Proton','X70','1.5TD Premium','SUV','Petrol','7-speed DCT',119800,'2026-10-08',null,40,'{"engine":"1.5L turbo","power_ps":181,"torque_nm":290,"seats":5}'),
  ('Proton','X90','1.5TD Lite','SUV','Petrol','7-speed DCT',106800,'2026-10-08',null,50,'{"engine":"1.5L turbo","power_ps":181,"torque_nm":290,"seats":7}'),
  ('Proton','X90','1.5TD Prime','SUV','Petrol','7-speed DCT',116800,'2026-10-08',null,50,'{"engine":"1.5L turbo","power_ps":181,"torque_nm":290,"seats":7}'),
  ('Proton','X90','1.5TD Prime X','SUV','Petrol','7-speed DCT',122800,'2026-10-08',null,50,'{"engine":"1.5L turbo","power_ps":181,"torque_nm":290,"seats":6}'),
  ('Proton','e.MAS 5','Prime','SUV','Electric',null,59800,'2026-10-08',null,60,'{"battery_kwh":30.12,"range_km":225,"seats":5}'),
  ('Proton','e.MAS 5','Premium','SUV','Electric',null,72800,'2026-10-08',null,60,'{"battery_kwh":40.16,"range_km":325,"seats":5}'),
  ('Proton','e.MAS 7','Prime','SUV','Electric',null,103800,'2026-10-08','https://paultan.org/research/proton/emas-7/',70,'{"battery_kwh":49.52,"range_km":345,"seats":5}'),
  ('Proton','e.MAS 7','Premium','SUV','Electric',null,119800,'2026-10-08','https://paultan.org/research/proton/emas-7/',70,'{"battery_kwh":60.22,"range_km":410,"seats":5}'),
  ('Proton','e.MAS 7','Premium Plus','SUV','Electric',null,125800,'2026-10-08','https://paultan.org/research/proton/emas-7/',70,'{"battery_kwh":68.39,"range_km":450,"seats":5}'),
  ('Proton','e.MAS 7 PHEV','Prime','SUV','Plug-in hybrid',null,109800,'2026-10-08',null,80,'{"battery_kwh":18.4,"ev_range_km":83,"power_ps":262,"seats":5}'),
  ('Proton','e.MAS 7 PHEV','Premium','SUV','Plug-in hybrid',null,123800,'2026-10-08',null,80,'{"battery_kwh":18.4,"ev_range_km":83,"power_ps":262,"seats":5}'),
  ('Proton','e.MAS 7 PHEV','Premium Plus','SUV','Plug-in hybrid',null,129800,'2026-10-08',null,80,'{"battery_kwh":29.8,"ev_range_km":136,"power_ps":262,"seats":5}')
on conflict (brand, model, variant) do nothing;

-- 4 -------------------------------------------------------------------------
update public.new_car_models set is_active = false
 where brand = 'Perodua' and model = 'Saga';
