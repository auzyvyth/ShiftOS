-- ONLINE-2 (2026-10-21): console Home names who is live, not just how many.
--
-- The "online now" counter (presence, src/lib/onlinePresence.js) carries no
-- names on purpose: its channel is public, so a name there is a name anyone can
-- read. Who is LIVE is already a database fact (seller_live_state, written only
-- by set_live_listing), so the console reads it here instead, behind
-- is_superadmin(). Read-only: no new writes, no disk IO.
--
-- Returns the seller, their mini-page slug and the car on screen. No phone, no
-- email, nothing about viewers.

create or replace function public.get_live_sellers()
returns table (
  seller_id     uuid,
  name          text,
  slug          text,
  plan          text,
  car           text,
  live_until    timestamptz,
  last_beat_at  timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not is_superadmin() then
    return;
  end if;
  return query
    select s.seller_id,
           coalesce(nullif(p.site_name, ''), nullif(p.dealership, ''), p.full_name)::text,
           p.slug::text,
           p.plan::text,
           nullif(concat_ws(' ', c.year::text, c.brand, c.model, c.variant), '')::text,
           s.live_until,
           s.updated_at
      from seller_live_state s
      join profiles p on p.id = s.seller_id
      left join car_listings c on c.id = s.listing_id
     where s.live_until > now()
     order by s.updated_at desc;
end;
$$;

revoke all on function public.get_live_sellers() from public;
revoke all on function public.get_live_sellers() from anon;
grant execute on function public.get_live_sellers() to authenticated;
