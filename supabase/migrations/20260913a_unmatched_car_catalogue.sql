-- Logs brand/model values a seller typed that aren't in the local CAR_DATA
-- picker list, so real gaps in the catalogue can be reviewed and backfilled
-- instead of guessed at. Insert-only from the client; only a superadmin reads it.
create table if not exists unmatched_car_catalogue (
  id           uuid primary key default gen_random_uuid(),
  field        text not null check (field in ('brand','model')),
  brand        text,              -- the chosen brand, for context when field = 'model'
  typed_value  text not null,
  dealer_id    uuid references profiles(id) on delete set null,
  listing_id   uuid references car_listings(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists unmatched_car_catalogue_field_idx on unmatched_car_catalogue(field, typed_value);

alter table unmatched_car_catalogue enable row level security;

-- A seller can only log a gap under their own dealer_id — never someone else's.
create policy unmatched_car_catalogue_insert on unmatched_car_catalogue
  for insert to authenticated
  with check (dealer_id = get_my_dealer_id());

create policy unmatched_car_catalogue_select on unmatched_car_catalogue
  for select to authenticated
  using (is_superadmin());
