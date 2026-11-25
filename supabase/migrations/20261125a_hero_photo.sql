-- PAGE-HERO (owner, 2026-11-25): a Premium seller's page opens with the seller
-- as the hero. Their HERO PHOTO is separate from the round profile photo
-- (avatar_url, always a JPG, used in chat, cards and the contact bar): it is
-- usually a see-through cut-out made on the phone (CUTOUT-1), stored as
-- avatars/<uid>/hero.webp, or a plain photo (hero.jpg) shown in a frame.
--
-- Written ONLY through set_my_hero_photo (the URL must be the caller's own
-- file in the avatars bucket). Read publicly ONLY through get_agent_hero(slug),
-- its own call like get_agent_about, so the main profile read can never fail on
-- it; it answers for Premium pages only (salesman_has_full_page) and re-checks
-- the URL, so a value written some other way is never shown.

alter table public.profiles add column if not exists hero_url text;

create or replace function public._hero_url_ok(p_owner uuid, p_url text)
returns boolean
language sql immutable
set search_path to 'public'
as $$
  select p_url is not null
     and length(p_url) <= 400
     and split_part(p_url, '?', 1) ~ ('^https://lemdkdizdlcirhbzqlos\.supabase\.co/storage/v1/object/public/avatars/'
                                       || p_owner::text || '/hero\.(webp|png|jpg)$');
$$;

create or replace function public.set_my_hero_photo(p_url text)
returns text
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from profiles where id = v_uid and role = 'salesman') then
    raise exception 'not_a_seller';
  end if;
  if p_url is not null and not public._hero_url_ok(v_uid, p_url) then
    raise exception 'bad_hero_url';
  end if;
  update profiles set hero_url = p_url where id = v_uid;
  return p_url;
end;
$$;

create or replace function public.get_agent_hero(p_slug text)
returns text
language sql stable security definer
set search_path to 'public'
as $$
  select case when public.salesman_has_full_page(p.id) and public._hero_url_ok(p.id, p.hero_url)
              then p.hero_url end
  from profiles p
  where p.slug = p_slug
    and p.role = 'salesman'
    and (p.is_active = true or p.approval_status = 'pending')
    and p.suspended_at is null
    and coalesce(p.account_status, 'active') <> 'deleted'
    and p.deleted_at is null
  limit 1;
$$;

-- Supabase grants new functions to anon directly: revoke from both.
revoke all on function public._hero_url_ok(uuid, text) from public, anon, authenticated;
revoke all on function public.set_my_hero_photo(text) from public, anon;
grant execute on function public.set_my_hero_photo(text) to authenticated;
revoke all on function public.get_agent_hero(text) from public;
grant execute on function public.get_agent_hero(text) to anon, authenticated;
