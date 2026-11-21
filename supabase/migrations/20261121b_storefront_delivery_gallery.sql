-- STOREFRONT-2 stage 4 phase C (docs/STOREFRONT_PLAN.md): "Happy customers", the dealer's own
-- handover photos on their site (<sub>.drevo.my), uploaded in dashboard Storefront > Delivery photos.
-- QUEUED, NOT APPLIED. Runs AFTER 20261121a (phase B): the layout check below lists the phase B
-- ids too. Apply after midnight Malaysia time with nobody live (CLAUDE.md), then flip DB_PHASE_C
-- (and DB_PHASE_B, if not already) to true in src/utils/storefrontLayout.js in the same release.
-- Until then the section and the upload panel exist nowhere in the app.
-- ONE migration = one API freeze: everything for phase C is in this file.
--
-- The law (PDPA 2010, checked 2026-11-21, see docs/STOREFRONT_PLAN.md phase C): a photo of an
-- identifiable buyer is their personal data. Publishing it needs their consent (s.6), in a form
-- that can be recorded and kept (PDP Regulations 2013 reg. 3), and they can withdraw it (s.38),
-- after which it must come down. So: no photo is stored without a consent record (who ticked,
-- when, how the buyer agreed), a photo is deleted in one tap, and no buyer name, phone, IC or
-- plate column exists. The words under a photo = the car + the month (+ an optional 60-char
-- caption with no 7+ digit run), the same rules as src/utils/deliveryCaption.js
-- (npm run test:deliverycaption reads this file).

-- 1. Who may manage a dealer's delivery photos: the dealer themselves, or their manager / admin
--    when the owner gave them the Storefront tab (dealer_can 'tab_storefront', off by default).
--    Never a salesman, an accountant or an F&I officer, never an anonymous (guest) session.
create or replace function public._storefront_editor(p_dealer uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select coalesce(
    auth.uid() is not null
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and p_dealer is not null
    and p_dealer = public.get_my_dealer_id()
    and exists (select 1 from public.profiles me
                 where me.id = auth.uid()
                   and me.role in ('dealer', 'owner', 'superadmin', 'manager', 'admin'))
    and public.dealer_can(p_dealer, 'tab_storefront'),
  false)
$$;
revoke all on function public._storefront_editor(uuid) from public;
revoke all on function public._storefront_editor(uuid) from anon;
grant execute on function public._storefront_editor(uuid) to authenticated;

-- 2. The photos. No UPDATE: a wrong row is deleted and uploaded again, so a consent record can
--    never be edited after the fact.
create table if not exists public.storefront_deliveries (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references public.profiles(id) on delete cascade,
  photo_url text not null,
  caption text,
  car_name text not null,
  delivered_month date not null,
  consent_at timestamptz not null,
  consent_by uuid not null references auth.users(id),
  consent_how text not null,
  created_at timestamptz not null default now(),
  -- The photo must be this dealer's own upload in our bucket, never a link to anywhere else.
  constraint storefront_deliveries_photo check (
    length(photo_url) <= 500
    and photo_url ~ '^https://'
    and position(('/storage/v1/object/public/car-images/deliveries/' || dealer_id::text || '/') in photo_url) > 0),
  constraint storefront_deliveries_caption check (
    caption is null or (length(caption) <= 60
      and regexp_replace(caption, '[[:space:]().+-]', '', 'g') !~ '[0-9]{7,}')),
  constraint storefront_deliveries_car_name check (
    length(btrim(car_name)) between 1 and 80
    and regexp_replace(car_name, '[[:space:]().+-]', '', 'g') !~ '[0-9]{7,}'),
  constraint storefront_deliveries_month check (
    delivered_month = date_trunc('month', delivered_month)::date
    and delivered_month >= date '2000-01-01'),
  constraint storefront_deliveries_consent_how check (consent_how in ('written', 'whatsapp'))
);
create index if not exists storefront_deliveries_dealer_idx
  on public.storefront_deliveries (dealer_id, delivered_month desc, created_at desc);

-- 3. The consent record is written by the database, not the browser: who ticked = the signed-in
--    user, when = now. The browser must still send consent_at (the tick); without it, no row.
--    Also: not a future month (Malaysia time) and at most 60 photos per dealer.
create or replace function public.storefront_delivery_stamp()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if new.consent_at is null then
    raise exception 'consent_required' using errcode = '23514';
  end if;
  new.consent_at := now();
  new.consent_by := auth.uid();
  new.created_at := now();
  if new.consent_by is null then
    raise exception 'consent_required' using errcode = '23514';
  end if;
  if new.delivered_month > date_trunc('month', now() at time zone 'Asia/Kuala_Lumpur')::date then
    raise exception 'future_month' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtext('storefront_deliveries:' || new.dealer_id::text));
  if (select count(*) from public.storefront_deliveries d where d.dealer_id = new.dealer_id) >= 60 then
    raise exception 'delivery_cap' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.storefront_delivery_stamp() from public, anon, authenticated;

drop trigger if exists trg_storefront_delivery_stamp on public.storefront_deliveries;
create trigger trg_storefront_delivery_stamp
  before insert on public.storefront_deliveries
  for each row execute function public.storefront_delivery_stamp();

alter table public.storefront_deliveries enable row level security;
revoke all on public.storefront_deliveries from public, anon;
grant select, insert, delete on public.storefront_deliveries to authenticated;

drop policy if exists storefront_deliveries_select on public.storefront_deliveries;
create policy storefront_deliveries_select on public.storefront_deliveries
  for select to authenticated using (public._storefront_editor(dealer_id));
drop policy if exists storefront_deliveries_insert on public.storefront_deliveries;
create policy storefront_deliveries_insert on public.storefront_deliveries
  for insert to authenticated with check (public._storefront_editor(dealer_id) and consent_at is not null);
drop policy if exists storefront_deliveries_delete on public.storefront_deliveries;
create policy storefront_deliveries_delete on public.storefront_deliveries
  for delete to authenticated using (public._storefront_editor(dealer_id));

-- 4. The files: car-images/deliveries/<dealer_id>/... The live bucket policies only allow
--    <uid>/... and stock/<dealer_id>/..., so a manager could not upload for the dealer and
--    nobody could delete under deliveries/. These three cover exactly that folder. The bucket
--    is public, so the site reads the photo by URL with no policy.
drop policy if exists car_images_deliveries_insert on storage.objects;
create policy car_images_deliveries_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'car-images'
    and (storage.foldername(name))[1] = 'deliveries'
    and (storage.foldername(name))[2] = (select public.get_my_dealer_id())::text
    and public._storefront_editor((select public.get_my_dealer_id())));
drop policy if exists car_images_deliveries_select on storage.objects;
create policy car_images_deliveries_select on storage.objects
  for select to authenticated using (
    bucket_id = 'car-images'
    and (storage.foldername(name))[1] = 'deliveries'
    and (storage.foldername(name))[2] = (select public.get_my_dealer_id())::text
    and public._storefront_editor((select public.get_my_dealer_id())));
drop policy if exists car_images_deliveries_delete on storage.objects;
create policy car_images_deliveries_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'car-images'
    and (storage.foldername(name))[1] = 'deliveries'
    and (storage.foldername(name))[2] = (select public.get_my_dealer_id())::text
    and public._storefront_editor((select public.get_my_dealer_id())));

-- 5. The layout check learns "deliveries". Same signature, so CREATE OR REPLACE replaces it in
--    place and the profiles CHECK constraint keeps using it. The list must equal SECTIONS in
--    src/utils/storefrontLayout.js with both gates open (npm run test:storefrontlayout reads it).
create or replace function public.storefront_layout_ok(p jsonb)
returns boolean
language sql
immutable
as $$
  -- coalesce: a CHECK passes on NULL, so a missing key must read as false, never unknown.
  select coalesce(p is null or (
    jsonb_typeof(p) = 'object'
    and p->>'v' = '1'
    and jsonb_typeof(p->'sections') = 'array'
    and jsonb_array_length(p->'sections') <= 20
    and pg_column_size(p) <= 4096
    and not exists (
      select 1 from jsonb_array_elements(p->'sections') s
      where jsonb_typeof(s) <> 'object'
         or coalesce(s->>'id', '') not in ('hero', 'strip', 'brands', 'video', 'hot_deals', 'browse', 'cars', 'about',
                                          'reviews', 'sold', 'deliveries', 'why', 'stats', 'how', 'testimonials',
                                          'calculator', 'contact')
         or jsonb_typeof(s->'on') is distinct from 'boolean'
         or coalesce(s->>'variant', '') not in ('a', 'b', 'c')
    )
  ), false)
$$;

-- 6. The site's read. storefront_deliveries has no public policy; this SECURITY DEFINER function
--    returns ONLY what the section draws, and only for a dealer whose storefront is public (the
--    same conditions as get_dealer_recent_sales / get_dealer_profile_by_subdomain). Never the
--    consent columns, never who uploaded. Newest 24.
create or replace function public.get_dealer_deliveries(p_subdomain text)
returns table(photo_url text, caption text, car_name text, delivered_month date)
language sql
stable
security definer
set search_path to 'public'
as $$
  select d.photo_url, d.caption, d.car_name, d.delivered_month
    from profiles p
    join storefront_deliveries d on d.dealer_id = p.id
   where p.subdomain = p_subdomain
     and p.role = any (array['dealer'::text, 'owner'::text, 'superadmin'::text])
     and p.payment_status is distinct from 'pending'
     and p.is_active = true
     and p.account_status is distinct from 'deleted'
   order by d.delivered_month desc, d.created_at desc
   limit 24;
$$;

-- Supabase grants new functions to anon directly and PUBLIC holds EXECUTE by default:
-- revoke both, then grant exactly the two roles a storefront visitor has.
revoke all on function public.get_dealer_deliveries(text) from public;
revoke all on function public.get_dealer_deliveries(text) from anon, authenticated;
grant execute on function public.get_dealer_deliveries(text) to anon, authenticated;

-- After applying, check (read-only):
--   select oid::regprocedure from pg_proc where proname in ('get_dealer_deliveries', 'storefront_layout_ok', '_storefront_editor');  -- one row each
--   select has_function_privilege('anon', 'public.get_dealer_deliveries(text)', 'execute');   -- true
--   select has_function_privilege('anon', 'public._storefront_editor(uuid)', 'execute');      -- false
--   select has_table_privilege('anon', 'public.storefront_deliveries', 'select');             -- false
--   select policyname from pg_policies where tablename = 'objects' and policyname like 'car_images_deliveries%';  -- three
