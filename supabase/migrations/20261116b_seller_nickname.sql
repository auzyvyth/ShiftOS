-- NICKNAME-1 (owner, 2026-11-15): a seller's social media name ("fedaus"), separate from the full name and
-- from the page name (`slug`). The page name is locked on purpose: it is the ?ref= attribution key, the
-- analytics key, the invite code and every link already shared. A nickname is a DISPLAY and SEARCH name:
-- shown as "@fedaus" on /s/:slug and added to what Google is told, on every seller plan (Lite included).
-- QUEUED: apply in the midnight window with nobody live. One migration, one API freeze.
--
-- Rules (mirrored in src/utils/nickname.js, which is the only place that words them):
--   2-30 characters, letters / numbers / dot / underscore, no spaces, no leading @
--   unique, ignoring capitals (profiles_nickname_unique)
--   never a phone number (9+ digits): the page is public and a seller's number never ships (CDP-3)
--   never "official", "authorised", "verified", "drevo", "admin", "support", "moderator"
--   never another seller's page name, and a page name can never be an existing nickname
--   sellers only (a dealer's public name is its business name)

alter table public.profiles add column if not exists nickname text;

create unique index if not exists profiles_nickname_unique
  on public.profiles (lower(nickname)) where nickname is not null and nickname <> '';

-- ONE place that decides if a nickname is acceptable. NULL = fine, else the reason.
create or replace function public.nickname_problem(p text) returns text
language sql immutable set search_path to 'pg_catalog', 'public' as $$
  select case
    when p is null then null
    when char_length(p) < 2 then 'too_short'
    when char_length(p) > 30 then 'too_long'
    when p !~ '^[A-Za-z0-9._]+$' or p ~ '^[.]' or p ~ '[.]$' or p ~ '[.][.]' then 'characters'
    when regexp_replace(p, '[._]', '', 'g') ~ '[0-9]{9,}' then 'phone'
    when lower(regexp_replace(p, '[._]', '', 'g')) ~ '(official|authori[sz]ed|verified|drevo|admin|support|moderator)' then 'reserved'
    else null
  end;
$$;

-- Runs on every write of the column, whoever writes it, so the rules cannot be skipped by a client.
create or replace function public.guard_profile_nickname() returns trigger
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v text; prob text;
begin
  if tg_op = 'UPDATE' and new.nickname is not distinct from old.nickname then return new; end if;
  v := nullif(regexp_replace(regexp_replace(btrim(coalesce(new.nickname, '')), '^@+', ''), '\s+', '', 'g'), '');
  if v is null then new.nickname := null; return new; end if;
  if new.role is distinct from 'salesman' then
    raise exception 'nickname_sellers_only' using errcode = 'P0001';
  end if;
  prob := public.nickname_problem(v);
  if prob is not null then
    raise exception 'nickname_%', prob using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles o
              where o.id <> new.id and (lower(o.nickname) = lower(v) or lower(o.slug) = lower(v))) then
    raise exception 'nickname_taken' using errcode = 'P0001';
  end if;
  new.nickname := v;
  return new;
end $$;

drop trigger if exists trg_guard_profile_nickname on public.profiles;
create trigger trg_guard_profile_nickname before insert or update of nickname on public.profiles
  for each row execute function public.guard_profile_nickname();

-- Settings asks this while the seller types. Signed-in only; says yes / no, never who has it.
create or replace function public.is_nickname_available(p_nick text) returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select public.nickname_problem(p_nick) is null
     and p_nick is not null
     and not exists (
       select 1 from public.profiles o
        where o.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
          and (lower(o.nickname) = lower(p_nick) or lower(o.slug) = lower(p_nick)));
$$;

-- A page name may not be someone's nickname either (the other half of the same rule).
create or replace function public.is_slug_available(p_slug text) returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select length(coalesce(p_slug, '')) >= 3
     and not exists (
       select 1 from profiles
        where (lower(slug) = lower(p_slug) or lower(nickname) = lower(p_slug))
          and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid));
$$;

-- The public page and the search-engine render read the nickname here, for every plan. It sits in its own
-- function (like get_agent_about) so the main profile read can never fail because of it, and it answers
-- only for an active seller: a suspended or deleted account's nickname is not published.
create or replace function public.get_agent_nickname(p_slug text) returns text
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select p.nickname from public.profiles p
   where lower(p.slug) = lower(p_slug) and p.role = 'salesman'
     and coalesce(p.is_active, false) and p.suspended_at is null
     and coalesce(p.account_status, 'active') <> 'deleted'
     and p.nickname is not null and p.nickname <> ''
   limit 1;
$$;

revoke all on function public.nickname_problem(text) from public, anon;
revoke all on function public.guard_profile_nickname() from public, anon, authenticated;
revoke all on function public.is_nickname_available(text) from public, anon;
grant execute on function public.is_nickname_available(text) to authenticated;
revoke all on function public.is_slug_available(text) from public;
grant execute on function public.is_slug_available(text) to anon, authenticated;
revoke all on function public.get_agent_nickname(text) from public;
grant execute on function public.get_agent_nickname(text) to anon, authenticated;
