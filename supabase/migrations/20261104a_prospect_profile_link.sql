-- PROSPECT-IMPORT (2026-11-04): prospects found on Facebook groups and TikTok lives.
--
-- Advisors found that way have a PROFILE LINK, not a phone number, so the phone
-- unique index could not stop the same person being added twice. This adds:
--   profile_url  the public profile link, stored cleaned (no www./m., no ?query,
--                no trailing slash, lower case) and UNIQUE -> one person, one row
--   brand        what they sell (Proton, Perodua...), free text
--   source       + 'facebook', 'tiktok' so the console can say which channel converts
-- Cleaning lives in the same BEFORE trigger as the phone, so the console's paste
-- import and the single Add form cannot store two spellings of one link.

alter table public.platform_prospects
  add column if not exists profile_url text,
  add column if not exists brand text;

alter table public.platform_prospects drop constraint if exists platform_prospects_source_check;
alter table public.platform_prospects add constraint platform_prospects_source_check
  check (source in ('waitlist','referral','social','facebook','tiktok','event','walk_in','marketplace','other'));

-- facebook.com/profile.php?id=123 keeps its id: it IS the profile.
-- Mirrored in src/utils/prospectImport.js cleanProfileUrl (npm run test:prospects);
-- change one, change both, or the paste preview disagrees with what is stored.
create or replace function public.prospect_clean_url(p_url text)
returns text language sql immutable set search_path = public as $$
  with b as (
    select regexp_replace(regexp_replace(lower(trim(coalesce(p_url, ''))), '^https?://', ''),
                          '^(www\.|m\.|web\.)', '') as u
  )
  select nullif(
    case when u ~ 'profile\.php\?(.*&)?id=[0-9]+'
         then regexp_replace(u, '^([^/]+)/profile\.php\?(.*&)?id=([0-9]+).*$', '\1/profile.php?id=\3')
         -- a TikTok live / video link names the account: keep tiktok.com/@handle
         when u ~ '^tiktok\.com/@[^/?#]+'
         then substring(u from '^(tiktok\.com/@[^/?#]+)')
         else regexp_replace(regexp_replace(u, '[?#].*$', ''), '/+$', '') end,
    '')
  from b
$$;
revoke all on function public.prospect_clean_url(text) from public, anon;

create unique index if not exists platform_prospects_profile_url_key
  on public.platform_prospects(profile_url) where profile_url is not null;

create or replace function public.prospect_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.phone := public.normalize_my_phone(nullif(trim(new.phone), ''));
  if new.phone is not null and length(new.phone) < 10 then
    raise exception 'prospect_bad_phone' using errcode = '22023';
  end if;
  new.profile_url := public.prospect_clean_url(new.profile_url);
  new.brand := nullif(trim(new.brand), '');
  new.updated_at := now();
  if new.do_not_contact and (tg_op = 'INSERT' or not old.do_not_contact) then
    new.dnc_at := now();
  elsif not new.do_not_contact then
    new.dnc_at := null;
  end if;
  if new.converted_profile_id is null and new.phone is not null then
    new.converted_profile_id := public.prospect_match_profile(new.phone);
    if new.converted_profile_id is not null and new.stage not in ('signed_up','paying') then
      new.stage := 'signed_up';
    end if;
  end if;
  return new;
end $$;
