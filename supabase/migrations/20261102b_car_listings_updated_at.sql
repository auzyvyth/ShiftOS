-- car_listings had no updated_at, so the catch-up after a hidden screen
-- (src/lib/realtimeIdle.js, TIME_COLUMNS) fell back to created_at and replayed
-- only NEW cars: a car approved, sold or edited while a seller's tab was in the
-- background stayed stale until a full reload. One column + one trigger; the
-- replay picks updated_at up by itself (first existing column wins).
-- Seller panels (Lite, Premium) listen on car_listings, so this is a used surface.
-- Apply after midnight MYT with nobody live (DDL freezes the API).
begin;

alter table public.car_listings
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_car_listing_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_car_listing_updated_at on public.car_listings;
create trigger trg_touch_car_listing_updated_at
  before update on public.car_listings
  for each row execute function public.touch_car_listing_updated_at();

create index if not exists car_listings_updated_at_idx on public.car_listings (updated_at);

commit;
