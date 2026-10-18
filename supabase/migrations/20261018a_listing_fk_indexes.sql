-- Deleting a car rewrites every row that points at it (ON DELETE SET NULL /
-- CASCADE). Ten of those foreign-key columns had no index, so each delete
-- scanned those tables whole for the matching rows. On a slow moment of the
-- free database the delete passed the 8s request limit and failed with a 500
-- (airymotors, 2026-10-18; repeat taps then queued behind it).
-- Tables are small, so plain CREATE INDEX is quick. One migration = one freeze.
create index if not exists leads_car_listing_id_idx on public.leads (car_listing_id);
create index if not exists chat_messages_listing_id_idx on public.chat_messages (listing_id);
create index if not exists appointments_car_listing_id_idx on public.appointments (car_listing_id);
create index if not exists car_listings_new_car_card_id_idx on public.car_listings (new_car_card_id);
create index if not exists whatsapp_enquiries_listing_id_idx on public.whatsapp_enquiries (listing_id);
create index if not exists customers_listing_id_idx on public.customers (listing_id);
create index if not exists saved_cars_listing_id_idx on public.saved_cars (listing_id);
create index if not exists salesman_listings_listing_id_idx on public.salesman_listings (listing_id);
create index if not exists hero_carousel_slides_car_listing_id_idx on public.hero_carousel_slides (car_listing_id);
create index if not exists seller_live_state_listing_id_idx on public.seller_live_state (listing_id);
