-- Mudah-style free-text listing title, and a flag for seller-corrected specs.
--
-- WHY. `model` is a free-text picker, so sellers have been cramming the variant
-- and engine into it to get the extra words a listing needs: "ALPHARD 2.5L",
-- "CIVIC 2.0L(T) HATCHBACK", "RX350 2.4L(T)". That breaks two things at once —
-- lookupFullSpec(brand, model, year) misses (12 Alphards spelled four ways, only
-- "Alphard" resolves), and a buyer filtering model = 'Alphard' never sees them.
-- Giving the seller somewhere to write "G82 LCI LIGHTS + BUCKET SEAT, LOW
-- MILEAGE" is what lets `model` become a clean catalogue value.
--
-- `specs_overridden` marks a listing whose seller rejected the catalogue figures.
-- It is the catalogue's error log: a model that keeps getting overridden has a
-- wrong or missing generation row.

alter table public.car_listings
  add column if not exists listing_title    text,
  add column if not exists specs_overridden boolean not null default false;

alter table public.car_listings
  drop constraint if exists car_listings_listing_title_len;
alter table public.car_listings
  add constraint car_listings_listing_title_len
  check (listing_title is null or char_length(listing_title) <= 120);

comment on column public.car_listings.listing_title is
  'Seller-written headline (Mudah style). Free text, <=120 chars. Never parsed — brand/model/year/variant stay structured.';
comment on column public.car_listings.specs_overridden is
  'True when the seller edited specs the catalogue had already filled. Signals a catalogue row to review.';
