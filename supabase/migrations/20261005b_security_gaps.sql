-- Security sweep follow-up (2026-10-05). Five gaps found by reading every
-- policy that applies to anon/PUBLIC and every anon-callable definer function.
-- Remember: guest buyers use anonymous sign-in, which hands out the
-- `authenticated` role, so "authenticated" is NOT a boundary here.
--
-- 1. storage "Auth upload" let ANY signed-in user (guests included) write any
--    file into ANY bucket at any path: car-images, avatars, even other people's
--    kyc-docs folders. Insert policies are OR'd, so it overrode the per-folder
--    avatars/kyc rules. Replaced with car-images only, real accounts only, own
--    folder (every client path is `<uid>/...`) or the dealer's `stock/<dealer>/`
--    folder (AddCarForm.jsx:316).
-- 2. ai_salesman_usage had client INSERT/UPDATE policies, so a seller could
--    zero their own daily AI counters and bypass salesman_ai_quota_ok(). The
--    only writer is increment_ai_usage() (SECURITY DEFINER), which bypasses RLS.
-- 3. reviews: a guest could post a 5-star review with verified_purchase=true,
--    a seller could review themselves, and there was no rate limit. Guarded by
--    a trigger: real accounts only, never your own business, verified_purchase
--    and status are server-owned, 5 new reviews per person per 24h.
-- 4. bookings_public_insert let anyone insert rows with no rate limit or field
--    check. The table has 0 rows and no client code uses it, so the policy goes.
-- 5. start_chat_thread had no cap: one guest could open a thread on every car.
--    New threads are capped at 30 per buyer per 24h (re-opening an existing
--    thread is never counted).

-- 1. Storage ----------------------------------------------------------------
drop policy if exists "Auth upload" on storage.objects;
drop policy if exists car_images_owner_insert on storage.objects;
create policy car_images_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'car-images'
    and not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or ((storage.foldername(name))[1] = 'stock'
          and (storage.foldername(name))[2] = (select public.get_my_dealer_id())::text)
    )
  );

-- 2. AI quota counters --------------------------------------------------------
drop policy if exists ai_usage_own_upsert on public.ai_salesman_usage;
drop policy if exists ai_usage_own_update on public.ai_salesman_usage;

-- 3. Reviews ------------------------------------------------------------------
create or replace function public.guard_review_write()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or is_superadmin() then return new; end if;

  if tg_op = 'INSERT' then
    if exists (select 1 from auth.users u where u.id = auth.uid() and coalesce(u.is_anonymous, false)) then
      raise exception 'sign_in_required' using errcode = 'check_violation';
    end if;
    if new.dealer_id = auth.uid() or new.dealer_id = get_my_dealer_id() then
      raise exception 'cannot_review_self' using errcode = 'check_violation';
    end if;
    if (select count(*) from public.reviews
         where buyer_id = auth.uid() and created_at > now() - interval '24 hours') >= 5 then
      raise exception 'rate_limited' using errcode = 'check_violation';
    end if;
    new.verified_purchase := false;
    new.status := 'visible';
  else
    -- An edit never changes who, where, or the server-owned flags.
    new.buyer_id := old.buyer_id;
    new.dealer_id := old.dealer_id;
    new.verified_purchase := old.verified_purchase;
    new.status := old.status;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_review_write on public.reviews;
create trigger trg_guard_review_write
  before insert or update on public.reviews
  for each row execute function public.guard_review_write();
revoke all on function public.guard_review_write() from public, anon, authenticated;

-- 4. Dead public insert -------------------------------------------------------
drop policy if exists bookings_public_insert on public.bookings;

-- 5. Chat thread cap (body unchanged from live except the marked block) --------
create or replace function public.start_chat_thread(p_listing_id uuid)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_anon   boolean;
  v_listing public.car_listings;
  v_label  text;
  v_salesman uuid;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'sign in required';
  end if;

  select * into v_listing from public.car_listings where id = p_listing_id;
  if v_listing.id is null then
    raise exception 'listing not found';
  end if;

  -- NEW: cap brand-new threads; re-opening an existing one is free.
  if not exists (select 1 from public.chat_threads
                  where listing_id = p_listing_id and buyer_id = v_uid)
     and (select count(*) from public.chat_threads
           where buyer_id = v_uid and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'rate_limited' using errcode = 'check_violation';
  end if;

  select coalesce(u.is_anonymous, false) into v_anon from auth.users u where u.id = v_uid;

  select case
           when v_anon then 'Guest ' || upper(substr(replace(v_uid::text, '-', ''), 1, 4))
           else coalesce(nullif(trim(p.full_name), ''),
                         nullif(split_part(coalesce(p.email, ''), '@', 1), ''),
                         'Buyer')
         end
    into v_label
    from public.profiles p where p.id = v_uid;

  v_label := coalesce(v_label, 'Guest ' || upper(substr(replace(v_uid::text, '-', ''), 1, 4)));

  -- Same resolver as create_lead_from_whatsapp and the enquiry_to_lead trigger.
  v_salesman := public.resolve_lead_salesman(v_listing.dealer_id, p_listing_id, null, null);

  insert into public.chat_threads
    (listing_id, dealer_id, salesman_id, buyer_id, buyer_label, buyer_is_anon)
  values
    (p_listing_id, v_listing.dealer_id, v_salesman, v_uid, v_label, v_anon)
  on conflict (listing_id, buyer_id) do update
    set buyer_label   = excluded.buyer_label,
        buyer_is_anon = excluded.buyer_is_anon,
        -- Heal a thread orphaned by the old inline rule when the buyer reopens
        -- it, but never re-attribute one that already has an owner.
        salesman_id   = coalesce(public.chat_threads.salesman_id, excluded.salesman_id)
  returning id into v_id;

  return v_id;
end;
$$;
