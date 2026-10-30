-- FEEDBACK-1 (2026-10-30): questions, reviews and likes reach the seller.
--
-- Before this, a buyer's question or review on the car page and a heart on a
-- car were written to the database and nothing else happened: no push, no
-- notification row, no dashboard surface. 5 of 7 questions had no answer.
--
-- What this adds:
--  1. saved_cars(listing_id) index: likes are counted per car now.
--  2. feedback_recipient(listing): THE seller for a car (assigned rep, else a
--     self-owned salesman). One rule, used by every trigger below.
--  3. A question or follow-up -> salesman_notifications 'new_question'.
--     A new review -> 'new_review'. The notification row IS the push.
--     Burst guard: no second push while an unread one of the same type is
--     under 15 minutes old (same idea as chat's "first unread of a burst").
--  4. Likes: the FIRST like on a car pushes at once ('like_first'). Every later
--     like is only counted; one daily digest per seller ('like_digest') at
--     12:00 MYT says how many. Per like the trigger does ONE insert-or-nothing
--     on like_first_ping, so 1,000 likes cost 1,000 tiny writes and a handful
--     of pushes (the pg_net call is the expensive part, and that is capped).
--  5. get_my_car_likes(): counts per car for the signed-in seller. Counts only,
--     never who: a buyer who saved a car never agreed to be contacted (PDPA).
--
-- Dealers (role dealer/owner) with no assigned rep get nothing here: the dealer
-- dashboard has no users today (see DB migrations rule, 2026-10-28).

create index if not exists saved_cars_listing_idx on public.saved_cars (listing_id);

create or replace function public.feedback_recipient(p_listing uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select coalesce(c.assigned_to,
                  case when p.role = 'salesman' and p.dealer_id is null then p.id end)
  from public.car_listings c
  join public.profiles p on p.id = c.dealer_id
  where c.id = p_listing
$$;
revoke all on function public.feedback_recipient(uuid) from public, anon, authenticated;

create or replace function public.feedback_car_name(p_listing uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select nullif(trim(concat_ws(' ', c.year::text, c.brand, c.model)), '')
  from public.car_listings c where c.id = p_listing
$$;
revoke all on function public.feedback_car_name(uuid) from public, anon, authenticated;

-- True when this seller already has an unread notification of this type that
-- is under 15 minutes old: the earlier push already woke them up.
create or replace function public.feedback_recently_pinged(p_seller uuid, p_type text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.salesman_notifications n
    where n.salesman_id = p_seller and n.type = p_type
      and n.is_read is not true
      and n.created_at > now() - interval '15 minutes')
$$;
revoke all on function public.feedback_recently_pinged(uuid, text) from public, anon, authenticated;

-- ── Questions ───────────────────────────────────────────────────────────────
create or replace function public.notify_seller_on_question()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_seller uuid;
  v_car text;
begin
  v_seller := public.feedback_recipient(new.listing_id);
  if v_seller is null or v_seller = new.author_id then return new; end if;
  if public.feedback_recently_pinged(v_seller, 'new_question') then return new; end if;
  v_car := coalesce(public.feedback_car_name(new.listing_id), 'your car');
  insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
  values (v_seller, 'new_question',
          case when new.parent_id is null then 'New question on ' || v_car
               else 'New reply on ' || v_car end,
          left(new.body, 140), new.id);
  return new;
exception when others then
  raise warning 'notify_seller_on_question failed (non-fatal): %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notify_seller_on_question on public.listing_comments;
create trigger trg_notify_seller_on_question
  after insert on public.listing_comments
  for each row execute function public.notify_seller_on_question();

-- ── Reviews ─────────────────────────────────────────────────────────────────
-- A review is about the seller account (reviews.dealer_id). Only a self-owned
-- salesman is notified; an edit (UPDATE) never re-pings.
create or replace function public.notify_seller_on_review()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_seller uuid;
begin
  select p.id into v_seller from public.profiles p
  where p.id = new.dealer_id and p.role = 'salesman' and p.dealer_id is null;
  if v_seller is null or v_seller = new.buyer_id then return new; end if;
  if public.feedback_recently_pinged(v_seller, 'new_review') then return new; end if;
  insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
  values (v_seller, 'new_review',
          'New ' || new.rating || '-star review from ' || coalesce(nullif(new.reviewer_name, ''), 'a buyer'),
          coalesce(left(new.body, 140), ''), new.id);
  return new;
exception when others then
  raise warning 'notify_seller_on_review failed (non-fatal): %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notify_seller_on_review on public.reviews;
create trigger trg_notify_seller_on_review
  after insert on public.reviews
  for each row execute function public.notify_seller_on_review();

-- ── Likes ───────────────────────────────────────────────────────────────────
-- One row per car that has had its first-like push. Unlike + like again never
-- re-sends it.
create table if not exists public.like_first_ping (
  listing_id uuid primary key references public.car_listings (id) on delete cascade,
  seller_id  uuid not null,
  like_id    uuid,
  pinged_at  timestamptz not null default now()
);
alter table public.like_first_ping enable row level security;  -- no policies: definer-only

-- When each seller's last daily digest went out (the digest counts likes after it).
create table if not exists public.like_digest_state (
  seller_id      uuid primary key,
  last_digest_at timestamptz not null default now()
);
alter table public.like_digest_state enable row level security;  -- no policies: definer-only

create or replace function public.notify_seller_on_like()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_seller uuid;
  v_new boolean;
begin
  v_seller := public.feedback_recipient(new.listing_id);
  if v_seller is null or v_seller = new.user_id then return new; end if;
  insert into public.like_first_ping (listing_id, seller_id, like_id)
  values (new.listing_id, v_seller, new.id)
  on conflict (listing_id) do nothing
  returning true into v_new;
  if v_new then
    insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
    values (v_seller, 'like_first',
            'Someone saved your ' || coalesce(public.feedback_car_name(new.listing_id), 'car'),
            'A buyer added it to their saved cars. Keep the price and photos sharp.',
            new.listing_id);
  end if;
  return new;
exception when others then
  raise warning 'notify_seller_on_like failed (non-fatal): %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notify_seller_on_like on public.saved_cars;
create trigger trg_notify_seller_on_like
  after insert on public.saved_cars
  for each row execute function public.notify_seller_on_like();

-- Daily digest: one row per seller who got likes since their last digest,
-- leaving out the likes that already had their own first-like push and the
-- seller's own taps. Pure SQL; the notification row is the push.
create or replace function public.send_like_digest()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_sent int := 0;
begin
  for r in
    with likes as (
      select public.feedback_recipient(s.listing_id) as seller_id, s.listing_id, s.user_id, s.created_at
      from public.saved_cars s
      where s.created_at > now() - interval '25 hours'
        and not exists (select 1 from public.like_first_ping f where f.like_id = s.id)
    )
    select l.seller_id, count(*) as n,
           (array_agg(l.listing_id order by l.created_at desc))[1] as top_listing
    from likes l
    left join public.like_digest_state d on d.seller_id = l.seller_id
    where l.seller_id is not null
      and l.user_id <> l.seller_id
      and l.created_at > coalesce(d.last_digest_at, now() - interval '24 hours')
    group by l.seller_id
  loop
    insert into public.salesman_notifications (salesman_id, type, title, body, ref_id)
    values (r.seller_id, 'like_digest',
            r.n || case when r.n = 1 then ' person' else ' people' end || ' saved your cars today',
            'See which cars buyers are saving in Feedback.', r.top_listing);
    insert into public.like_digest_state (seller_id, last_digest_at) values (r.seller_id, now())
    on conflict (seller_id) do update set last_digest_at = excluded.last_digest_at;
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;
revoke all on function public.send_like_digest() from public, anon, authenticated;

-- 04:00 UTC = 12:00 MYT, minute :00 (IO-5: frequent-job minutes only; this is daily).
-- Guarded so a day with no likes costs one in-memory check.
select cron.unschedule('like-digest') where exists (select 1 from cron.job where jobname = 'like-digest');
select cron.schedule('like-digest', '0 4 * * *',
  $$select public.send_like_digest() where exists (select 1 from public.saved_cars where created_at > now() - interval '25 hours')$$);

-- ── Counts for the seller's Feedback tab ────────────────────────────────────
-- Counts only. The subject is the session: cars this caller sells.
create or replace function public.get_my_car_likes()
returns table (listing_id uuid, likes integer, likes_7d integer)
language sql stable security definer set search_path = public
as $$
  select s.listing_id,
         count(*)::int,
         count(*) filter (where s.created_at > now() - interval '7 days')::int
  from public.saved_cars s
  join public.car_listings c on c.id = s.listing_id
  where auth.uid() is not null
    and (c.assigned_to = auth.uid()
         or (c.dealer_id = auth.uid() and c.assigned_to is null))
    and s.user_id <> auth.uid()
  group by s.listing_id
$$;
revoke all on function public.get_my_car_likes() from public, anon;
grant execute on function public.get_my_car_likes() to authenticated;
