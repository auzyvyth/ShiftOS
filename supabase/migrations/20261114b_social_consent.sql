-- Drevo's own social pages (SOCIAL-1, 2026-11-13). QUEUED for tonight's release window
-- (00:00-09:00 MYT, nobody live): a migration freezes the live API for up to 45 s. Not applied.
--
-- What it is: after a seller submits a car for approval, the app asks "may Drevo feature this car on
-- its Facebook Page and TikTok?". The answer is stored on the car. When the owner approves the car in
-- the console, a consenting car appears in the console's Social queue; the OWNER posts it (TikTok
-- requires a human to preview and consent to every post, so nothing is automatic).
--
-- Rules this migration enforces in the database (the app is not trusted):
--   * only the car's own seller can set the consent, through set_listing_social_consent;
--   * a browser can never write posted / skipped / consent directly (guard trigger reverts it);
--   * only a superadmin reads the queue or skips a car;
--   * `public_car_listings` lists its columns explicitly, so none of these four reach the public.
-- "Posted" is stamped by the zernio-post edge function (service role), never by a browser.

begin;

alter table public.car_listings
  add column if not exists social_consent    boolean,      -- null = never asked, true = yes, false = no / withdrawn
  add column if not exists social_consent_at timestamptz,
  add column if not exists social_posted_at  timestamptz,  -- set by the edge function after a live post
  add column if not exists social_skipped_at timestamptz;  -- owner chose not to post it

-- A client (authenticated / anon) can never change these four columns by a plain INSERT or UPDATE.
-- SECURITY DEFINER functions run as their owner and the edge function as service_role, so both pass.
create or replace function public.guard_social_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.social_consent := null;
      new.social_consent_at := null;
      new.social_posted_at := null;
      new.social_skipped_at := null;
    else
      new.social_consent := old.social_consent;
      new.social_consent_at := old.social_consent_at;
      new.social_posted_at := old.social_posted_at;
      new.social_skipped_at := old.social_skipped_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_zz_guard_social_columns on public.car_listings;
create trigger trg_zz_guard_social_columns
  before insert or update on public.car_listings
  for each row execute function public.guard_social_columns();

-- The seller's answer. Own car only (not a linked salesman's: the dealer decides for those), never a
-- new-car model card. A "yes" clears an old "skipped" so it queues again; a "no" after a post tells the
-- console to take it down (see get_social_queue, kind = 'withdrawn').
create or replace function public.set_listing_social_consent(p_listing uuid, p_consent boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  update public.car_listings
     set social_consent = p_consent,
         social_consent_at = now(),
         social_skipped_at = case when p_consent then null else social_skipped_at end
   where id = p_listing
     and dealer_id = auth.uid()
     and new_car_model_id is null
     and status <> 'archived';
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- The console's queue (superadmin only). 'queue' = approved (status available), the seller said yes,
-- not posted, not skipped. 'withdrawn' = the seller said no AFTER we posted: take it down.
-- Photos come back as jsonb; the seller's name is what the post credits.
create or replace function public.get_social_queue()
returns table (
  kind text, id uuid, slug text, brand text, model text, variant text, year integer,
  selling_price numeric, mileage integer, state text, city text, transmission text, fuel_type text,
  description text, images jsonb, seller_id uuid, seller_name text, seller_slug text,
  social_consent_at timestamptz, social_posted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select case when c.social_consent is true then 'queue' else 'withdrawn' end,
         c.id, c.slug, c.brand, c.model, c.variant, c.year,
         c.selling_price, c.mileage, c.state, c.city, c.transmission, c.fuel_type,
         c.description, to_jsonb(c.images), c.dealer_id,
         coalesce(nullif(p.dealership, ''), nullif(p.site_name, ''), p.full_name),
         p.slug, c.social_consent_at, c.social_posted_at
    from public.car_listings c
    left join public.profiles p on p.id = c.dealer_id
   where c.new_car_model_id is null
     and (
       (c.social_consent is true and c.status = 'available'
          and c.social_posted_at is null and c.social_skipped_at is null)
       or
       (c.social_consent is false and c.social_posted_at is not null
          and c.social_posted_at > now() - interval '30 days')
     )
   order by c.social_consent_at desc nulls last
   limit 100;
end;
$$;

create or replace function public.skip_social_listing(p_listing uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.car_listings set social_skipped_at = now() where id = p_listing;
end;
$$;

-- Supabase grants new functions to anon directly: revoke from public AND anon, grant explicitly.
revoke all on function public.set_listing_social_consent(uuid, boolean) from public, anon;
revoke all on function public.get_social_queue()                         from public, anon;
revoke all on function public.skip_social_listing(uuid)                  from public, anon;
grant execute on function public.set_listing_social_consent(uuid, boolean) to authenticated;
grant execute on function public.get_social_queue()                         to authenticated;
grant execute on function public.skip_social_listing(uuid)                  to authenticated;

commit;

-- Verify after applying (read-only):
--   select has_function_privilege('anon', 'public.get_social_queue()', 'execute');                       -- false
--   select has_function_privilege('anon', 'public.set_listing_social_consent(uuid,boolean)', 'execute'); -- false
--   select oid::regprocedure from pg_proc where proname in ('set_listing_social_consent','get_social_queue','skip_social_listing','guard_social_columns'); -- one row each
--   select column_name from information_schema.columns where table_name='public_car_listings' and column_name like 'social%'; -- no rows
