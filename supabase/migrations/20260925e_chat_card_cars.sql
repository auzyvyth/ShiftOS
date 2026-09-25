-- Car cards were blank for the BUYER. The card read its car straight from
-- car_listings (a PostgREST embed + a live fetch), but car_listings has no
-- public SELECT policy: the marketplace reads through the public_car_listings
-- view. So the seller (who owns the car) saw the card and the buyer got null
-- and fell back to the plain text.
--
-- chat_thread_cards(thread) returns the card fields for every car sent in a
-- thread, only to the two parties of that thread (chat_thread_role). Not the
-- view: it drops sold cars, and a card must still say "Sold" after the sale.
-- Only what the card shows leaves the database.
create or replace function public.chat_thread_cards(p_thread_id uuid)
returns table (id uuid, slug text, brand text, model text, variant text, year int,
               selling_price numeric, mileage int, images text[], status text)
language sql stable security definer set search_path = public
as $$
  select c.id, c.slug, c.brand, c.model, c.variant, c.year, c.selling_price, c.mileage,
         case when c.images is null then null else c.images[1:1] end, c.status
    from public.car_listings c
   where public.chat_thread_role(p_thread_id) is not null
     and c.id in (select m.listing_id from public.chat_messages m
                   where m.thread_id = p_thread_id and m.listing_id is not null);
$$;

revoke all on function public.chat_thread_cards(uuid) from public;
revoke all on function public.chat_thread_cards(uuid) from anon;
grant execute on function public.chat_thread_cards(uuid) to authenticated;
