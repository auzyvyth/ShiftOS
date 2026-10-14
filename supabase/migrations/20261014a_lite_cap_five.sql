-- Salesman Lite trimmed (owner, 2026-10-13). Lite = get found + get the lead;
-- working the lead is Premium. Server side of that split:
--   1. Lite live-car cap 10 -> 5 (enforce_listing_cap reads plan_config, and
--      so does its unpaid-Premium fallback). Sellers already over 5 keep what
--      is live; they cannot add or republish until they are under it.
--   2. A Lite seller's public page is the BASIC page: bio, banner, social
--      links, job title, specialisations and brand colour come back NULL from
--      the public RPCs (the SPA page and the og.js crawler both read these),
--      plus a `page_basic` flag so the page can show "Made with XDrive".
--      Nothing is deleted: the columns stay on profiles and return the day
--      the seller is Premium.
--   3. Telegram booking reminders are Premium: a Lite seller's appointment
--      never carries remind_at, so the appointment-reminder cron skips it.
-- Dealer-linked salesmen (dealer_id set) are never "basic": their dealer pays.

begin;

update public.plan_config set listing_cap = 5 where plan = 'salesman_lite';

-- Does this salesman get the full toolkit? Mirrors is_salesman_premium() /
-- isPremiumSalesman() for ANOTHER user's row, for definer functions and
-- triggers only. Not callable by clients (it would let anyone ask any
-- account's plan), so EXECUTE is revoked from public, anon and authenticated.
create or replace function public.salesman_has_full_page(p_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select coalesce((
    select p.dealer_id is not null
        or (p.plan::text = 'salesman_full'
            and coalesce(p.is_active, true)
            and (coalesce(p.plan_expires_at > now(), false) or p.payment_status = 'received'))
    from profiles p
    where p.id = p_id and p.role = 'salesman'
  ), true);
$$;
revoke all on function public.salesman_has_full_page(uuid) from public, anon, authenticated;

-- Return type gains page_basic, so DROP + CREATE (CREATE OR REPLACE cannot
-- change a RETURNS TABLE). No view or function depends on it (checked
-- pg_depend 2026-10-14). Grants re-asserted explicitly below, same set as
-- before: anon, authenticated, service_role.
drop function if exists public.get_salesman_by_slug(text);
create function public.get_salesman_by_slug(p_slug text)
returns table(id uuid, full_name text, avatar_url text, cover_url text, dealership text, site_name text,
  brand_color text, slug text, subdomain text, whatsapp_number text, dealer_id uuid, bio text, city text,
  state text, location text, facebook text, website text, instagram text, tiktok text, job_title text,
  about_text text, response_time text, specializations text[], is_verified boolean, seller_type text,
  has_whatsapp boolean, page_basic boolean)
language sql stable security definer
set search_path to 'public'
as $$
  select q.id, q.full_name, q.avatar_url,
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
$$;
revoke all on function public.get_salesman_by_slug(text) from public;
grant execute on function public.get_salesman_by_slug(text) to anon, authenticated, service_role;

-- Same signature, so a plain replace. The car page's seller card reads this.
create or replace function public.get_salesman_by_id(p_id uuid)
returns table(id uuid, full_name text, avatar_url text, dealership text, site_name text, brand_color text,
  slug text, subdomain text, whatsapp_number text, dealer_id uuid, bio text, city text, state text,
  facebook text, website text, is_verified boolean, deposit_policy text, deposit_terms text,
  processing_fee numeric, handles_roadtax_insurance boolean, location text, business_hours text,
  phone text, has_whatsapp boolean, has_phone boolean)
language sql stable security definer
set search_path to 'public'
as $$
  select p.id, p.full_name, p.avatar_url, p.dealership, p.site_name,
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
$$;

-- Telegram booking reminders: Premium only. Named trg_zz_* so it runs after
-- trg_set_appointment_salesman has filled salesman_id on insert.
create or replace function public.lite_no_booking_reminder()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if new.remind_at is not null and new.salesman_id is not null
     and not public.salesman_has_full_page(new.salesman_id) then
    new.remind_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.lite_no_booking_reminder() from public, anon, authenticated;

drop trigger if exists trg_zz_lite_no_booking_reminder on public.appointments;
create trigger trg_zz_lite_no_booking_reminder
  before insert or update of remind_at, salesman_id on public.appointments
  for each row execute function public.lite_no_booking_reminder();

commit;
