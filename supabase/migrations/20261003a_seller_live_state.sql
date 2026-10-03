-- LIVE-1: "Live now" on the salesman mini page.
-- While a seller runs Live presentation (SalesmanProfilePage), the car on
-- their screen is pinned at the top of their public mini page, so a viewer who
-- taps the TikTok bio link lands on the car being shown. TikTok penalises a
-- phone number / link / QR on a live stream, so the bio link is the only
-- bridge, and this is what makes it land somewhere useful.
--
-- Own table, not columns on profiles: profiles has 9 UPDATE triggers
-- (approval guards, signup notifier, prospect linking) and the presenter
-- writes on every swipe + a heartbeat. None of that should fire for this.
-- No client policies at all: both doors are SECURITY DEFINER functions.

create table if not exists public.seller_live_state (
  seller_id  uuid primary key references public.profiles(id) on delete cascade,
  listing_id uuid references public.car_listings(id) on delete set null,
  live_until timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.seller_live_state enable row level security;
revoke all on public.seller_live_state from public, anon, authenticated;

-- Seller sets (or clears, p_listing_id null) the car on screen. The subject is
-- auth.uid(), never an argument; the car must be one this seller's mini page
-- actually shows (owned, assigned, or featured via salesman_listings), and
-- live. Each call extends the window 10 minutes — the presenter heartbeats, so
-- a closed tab expires on its own instead of pinning a car forever.
create or replace function public.set_live_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;

  if p_listing_id is null then
    delete from seller_live_state where seller_id = v_uid;
    return;
  end if;

  if not exists (
    select 1 from car_listings c
    where c.id = p_listing_id
      and c.status in ('available', 'reserved')
      and (c.dealer_id = v_uid or c.assigned_to = v_uid
           or exists (select 1 from salesman_listings s
                      where s.listing_id = c.id and s.salesman_id = v_uid))
  ) then
    raise exception 'not_your_listing';
  end if;

  insert into seller_live_state (seller_id, listing_id, live_until, updated_at)
  values (v_uid, p_listing_id, now() + interval '10 minutes', now())
  on conflict (seller_id) do update
    set listing_id = excluded.listing_id,
        live_until = excluded.live_until,
        updated_at = now();
end;
$$;

-- Public read: the car a seller is showing right now, by mini-page slug.
-- Returns only a listing id (the page already loaded that car from
-- public_car_listings), and only while the window is open and the car is live.
create or replace function public.get_salesman_live(p_slug text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select l.listing_id
  from profiles p
  join seller_live_state l on l.seller_id = p.id
  join car_listings c on c.id = l.listing_id
  where p.slug = p_slug
    and l.live_until > now()
    and c.status in ('available', 'reserved')
  limit 1;
$$;

revoke all on function public.set_live_listing(uuid) from public, anon;
grant execute on function public.set_live_listing(uuid) to authenticated;
revoke all on function public.get_salesman_live(text) from public;
grant execute on function public.get_salesman_live(text) to anon, authenticated;
