-- FINDME-1 step 3b: a chat about a Find me post says so in both inboxes.
-- It read "Car enquiry" (seller) and linked the buyer to /showroom, because
-- both inboxes only knew how to name a thread by its car, and a post thread
-- has none.
--
-- Buyer: get_my_chat_threads gains the post's id + fields (the buyer owns the
-- post, so nothing new is exposed). A new return column means DROP + CREATE,
-- so grants are re-asserted below. The anon grant is NOT carried over: the
-- function returns nothing without auth.uid(), and guests are 'authenticated'.
--
-- Seller: sellers cannot read find_me_posts (RLS: own posts only), so an
-- embed would come back null. chat_post_subjects(thread ids) returns the post
-- fields ONLY for threads the caller is a party to (chat_thread_role), and
-- never buyer_id or the buyer's note.

drop function if exists public.get_my_chat_threads();
create function public.get_my_chat_threads()
returns table(thread_id uuid, listing_id uuid, status text, last_message_at timestamptz,
  last_sender_role text, buyer_unread integer, last_preview text, car_slug text,
  car_brand text, car_model text, car_variant text, car_year integer, car_price numeric,
  car_image text, car_city text, car_state text, car_engine_cc integer, car_mileage integer,
  car_transmission text, seller_name text, seller_avatar text, seller_slug text,
  find_me_post_id uuid, post_brand text, post_model text, post_min_year integer, post_max_year integer)
language sql stable security definer set search_path = public
as $function$
  select
    t.id, t.listing_id, t.status, t.last_message_at, t.last_sender_role,
    coalesce(t.buyer_unread, 0),
    m.body_ai,
    c.slug, c.brand, c.model, c.variant, c.year, c.selling_price, (c.images)[1],
    c.city, c.state, c.engine_cc, c.mileage, c.transmission,
    coalesce(nullif(trim(s.full_name), ''), nullif(trim(s.dealership), ''),
             nullif(trim(s.site_name), ''), 'Seller'),
    coalesce(nullif(trim(s.avatar_url), ''), nullif(trim(s.logo_url), ''),
             nullif(trim(s.site_logo_url), '')),
    s.slug,
    p.id, p.brand, p.model, p.min_year, p.max_year
  from public.chat_threads t
  left join public.car_listings c on c.id = t.listing_id
  left join public.find_me_posts p on p.id = t.find_me_post_id
  left join public.profiles     s on s.id = coalesce(t.salesman_id, t.dealer_id)
  left join lateral (
    select cm.body_ai from public.chat_messages cm
     where cm.thread_id = t.id order by cm.created_at desc limit 1
  ) m on true
  where auth.uid() is not null and t.buyer_id = auth.uid()
  order by t.last_message_at desc nulls last;
$function$;

create or replace function public.chat_post_subjects(p_thread_ids uuid[])
returns table(thread_id uuid, post_id uuid, brand text, model text, min_year integer, max_year integer)
language sql stable security definer set search_path = public
as $$
  select t.id, p.id, p.brand, p.model, p.min_year, p.max_year
    from public.chat_threads t
    join public.find_me_posts p on p.id = t.find_me_post_id
   where t.id = any(p_thread_ids[1:200])
     and public.chat_thread_role(t.id) is not null;
$$;

revoke all on function public.get_my_chat_threads() from public;
revoke all on function public.chat_post_subjects(uuid[]) from public;
revoke all on function public.get_my_chat_threads() from anon;
revoke all on function public.chat_post_subjects(uuid[]) from anon;
grant execute on function public.get_my_chat_threads() to authenticated, service_role;
grant execute on function public.chat_post_subjects(uuid[]) to authenticated;
