-- PAGE-SITE 3 (owner, 2026-11-26): a Premium seller's handover photos on their page (/s/<slug>),
-- "the keys I handed over", uploaded in Premium Settings > Your page > Handover photos.
-- QUEUED, NOT APPLIED. Apply after midnight Malaysia time with nobody live (CLAUDE.md), in the
-- same slot as 20261125b_page_site.sql. One migration = one API freeze.
--
-- Same law and the same shape as the dealer storefront's photo wall (20261121b,
-- storefront_deliveries): a photo of a buyer is their personal data (PDPA 2010 s.6 consent,
-- recorded per PDP Regulations 2013 reg. 3; s.38 withdrawal = delete in one tap). So: no row
-- without a consent record written by the database (who ticked, when, how the buyer agreed),
-- no UPDATE path, and NO buyer name / phone / IC / plate column. Words = the car + the month
-- (+ a 60-char caption with no 7+ digit run): src/utils/deliveryCaption.js is the one rules file.
--
-- The files live in the seller's own folder, car-images/<uid>/handover/..., which the live
-- bucket policies already let the seller upload to and delete from (car_images_owner_insert,
-- "Authenticated delete own images"). No storage policy is added.

create table if not exists public.agent_handover_photos (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  photo_url text not null,
  caption text,
  car_name text not null,
  delivered_month date not null,
  consent_at timestamptz not null,
  consent_by uuid not null references auth.users(id),
  consent_how text not null,
  created_at timestamptz not null default now(),
  constraint agent_handover_photos_photo check (
    length(photo_url) <= 500
    and photo_url ~ '^https://'
    and position(('/storage/v1/object/public/car-images/' || seller_id::text || '/handover/') in photo_url) > 0),
  constraint agent_handover_photos_caption check (
    caption is null or (length(caption) <= 60
      and regexp_replace(caption, '[[:space:]().+-]', '', 'g') !~ '[0-9]{7,}')),
  constraint agent_handover_photos_car_name check (
    length(btrim(car_name)) between 1 and 80
    and regexp_replace(car_name, '[[:space:]().+-]', '', 'g') !~ '[0-9]{7,}'),
  constraint agent_handover_photos_month check (
    delivered_month = date_trunc('month', delivered_month)::date
    and delivered_month >= date '2000-01-01'),
  constraint agent_handover_photos_consent_how check (consent_how in ('written', 'whatsapp'))
);
create index if not exists agent_handover_photos_seller_idx
  on public.agent_handover_photos (seller_id, delivered_month desc, created_at desc);

-- Who may manage them: the signed-in seller themselves, never a guest session, Premium page only.
create or replace function public._handover_photo_owner(p_seller uuid)
returns boolean
language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $$
  select coalesce(
    auth.uid() is not null
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and p_seller = auth.uid()
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'salesman'),
  false)
$$;
revoke all on function public._handover_photo_owner(uuid) from public, anon;
grant execute on function public._handover_photo_owner(uuid) to authenticated;

-- The consent record is the database's: who = the signed-in user, when = now. The browser must
-- still send consent_at (the tick). Not a future month, Premium page only, 60 photos at most.
create or replace function public.agent_handover_photo_stamp()
returns trigger
language plpgsql security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if new.consent_at is null then raise exception 'consent_required' using errcode = '23514'; end if;
  new.consent_at := now();
  new.consent_by := auth.uid();
  new.created_at := now();
  if new.consent_by is null then raise exception 'consent_required' using errcode = '23514'; end if;
  if not public.salesman_has_full_page(new.seller_id) then raise exception 'not_premium' using errcode = '23514'; end if;
  if new.delivered_month > date_trunc('month', now() at time zone 'Asia/Kuala_Lumpur')::date then
    raise exception 'future_month' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtext('agent_handover_photos:' || new.seller_id::text));
  if (select count(*) from public.agent_handover_photos d where d.seller_id = new.seller_id) >= 60 then
    raise exception 'delivery_cap' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.agent_handover_photo_stamp() from public, anon, authenticated;

drop trigger if exists trg_agent_handover_photo_stamp on public.agent_handover_photos;
create trigger trg_agent_handover_photo_stamp
  before insert on public.agent_handover_photos
  for each row execute function public.agent_handover_photo_stamp();

alter table public.agent_handover_photos enable row level security;
revoke all on public.agent_handover_photos from public, anon;
grant select, insert, delete on public.agent_handover_photos to authenticated;

drop policy if exists agent_handover_photos_select on public.agent_handover_photos;
create policy agent_handover_photos_select on public.agent_handover_photos
  for select to authenticated using (public._handover_photo_owner(seller_id));
drop policy if exists agent_handover_photos_insert on public.agent_handover_photos;
create policy agent_handover_photos_insert on public.agent_handover_photos
  for insert to authenticated with check (public._handover_photo_owner(seller_id) and consent_at is not null);
drop policy if exists agent_handover_photos_delete on public.agent_handover_photos;
create policy agent_handover_photos_delete on public.agent_handover_photos
  for delete to authenticated using (public._handover_photo_owner(seller_id));

-- The page reads them through this, by slug: Premium pages only, active sellers only, newest 24.
-- Car + month + caption + photo. Never the consent record, never who ticked.
create or replace function public.get_agent_handover_photos(p_slug text)
returns table (id uuid, photo_url text, car_name text, delivered_month date, caption text)
language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $$
  select h.id, h.photo_url, h.car_name, h.delivered_month, h.caption
  from public.profiles p
  join public.agent_handover_photos h on h.seller_id = p.id
  where p.slug = p_slug
    and p.role = 'salesman'
    and (p.is_active = true or p.approval_status = 'pending')
    and p.suspended_at is null
    and coalesce(p.account_status, 'active') <> 'deleted'
    and p.deleted_at is null
    and public.salesman_has_full_page(p.id)
  order by h.delivered_month desc, h.created_at desc
  limit 24
$$;
revoke all on function public.get_agent_handover_photos(text) from public;
grant execute on function public.get_agent_handover_photos(text) to anon, authenticated;
