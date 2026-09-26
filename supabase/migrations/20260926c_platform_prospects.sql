-- OPS-CRM-1: the owner's own prospecting CRM (platform console > People > Prospects).
--
-- Who the owner is trying to sign up (salesmen, dealers), where each one is in
-- the conversation, and when to follow up. Superadmin-only. Three things are
-- done by the database so no client can skip them:
--   1. phone is stored normalized (60xxxxxxxxx) and is UNIQUE -> one person, one row
--   2. a waitlist signup becomes a prospect; a real signup whose phone matches
--      links the prospect to the account and moves it to 'signed_up'
--   3. logging a contact stamps last_contacted_at, and is REFUSED on a
--      do_not_contact prospect (PDPA s.43: once someone says stop, we stop)

create table if not exists public.platform_prospects (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (length(trim(name)) > 0),
  phone                text,
  business             text,
  kind                 text not null default 'salesman' check (kind in ('salesman','dealer','other')),
  area                 text,
  source               text not null default 'other'
                       check (source in ('waitlist','referral','social','event','walk_in','marketplace','other')),
  stage                text not null default 'new'
                       check (stage in ('new','contacted','replied','demo','signed_up','paying','lost')),
  lost_reason          text,
  next_follow_up_at    timestamptz,
  last_contacted_at    timestamptz,
  contact_count        integer not null default 0,
  notes                text,
  do_not_contact       boolean not null default false,
  dnc_at               timestamptz,
  waitlist_id          uuid unique references public.waitlist_signups(id) on delete set null,
  converted_profile_id uuid references public.profiles(id) on delete set null,
  created_by           uuid default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index if not exists platform_prospects_phone_key
  on public.platform_prospects(phone) where phone is not null;
create index if not exists platform_prospects_follow_up_idx
  on public.platform_prospects(next_follow_up_at) where not do_not_contact;

create table if not exists public.platform_prospect_activity (
  id          uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.platform_prospects(id) on delete cascade,
  kind        text not null check (kind in ('note','contacted','stage','dnc')),
  body        text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists platform_prospect_activity_prospect_idx
  on public.platform_prospect_activity(prospect_id, created_at desc);

alter table public.platform_prospects enable row level security;
alter table public.platform_prospect_activity enable row level security;

drop policy if exists platform_prospects_superadmin on public.platform_prospects;
create policy platform_prospects_superadmin on public.platform_prospects
  for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists platform_prospect_activity_superadmin on public.platform_prospect_activity;
create policy platform_prospect_activity_superadmin on public.platform_prospect_activity
  for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

revoke all on public.platform_prospects, public.platform_prospect_activity from anon, public;
grant select, insert, update, delete on public.platform_prospects, public.platform_prospect_activity to authenticated;

-- Profile id already registered under this phone (seller roles only), or null.
create or replace function public.prospect_match_profile(p_phone text)
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p
  where p_phone is not null
    and p.role in ('salesman','dealer','owner','manager','admin')
    and (public.normalize_my_phone(p.phone) = p_phone or public.normalize_my_phone(p.whatsapp_number) = p_phone)
  order by p.created_at
  limit 1
$$;
revoke all on function public.prospect_match_profile(text) from public, anon, authenticated;

-- BEFORE: normalize, stamp, auto-link to an existing account.
create or replace function public.prospect_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.phone := public.normalize_my_phone(nullif(trim(new.phone), ''));
  if new.phone is not null and length(new.phone) < 10 then
    raise exception 'prospect_bad_phone' using errcode = '22023';
  end if;
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

drop trigger if exists trg_prospect_before_write on public.platform_prospects;
create trigger trg_prospect_before_write before insert or update on public.platform_prospects
  for each row execute function public.prospect_before_write();

-- AFTER UPDATE: the timeline records stage moves and do-not-contact changes.
create or replace function public.prospect_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.platform_prospect_activity(prospect_id, kind, body)
    values (new.id, 'stage', old.stage || ' -> ' || new.stage);
  end if;
  if new.do_not_contact is distinct from old.do_not_contact then
    insert into public.platform_prospect_activity(prospect_id, kind, body)
    values (new.id, 'dnc', case when new.do_not_contact then 'Marked do not contact' else 'Do not contact removed' end);
  end if;
  return null;
end $$;

drop trigger if exists trg_prospect_after_update on public.platform_prospects;
create trigger trg_prospect_after_update after update on public.platform_prospects
  for each row execute function public.prospect_after_update();

-- Activity: a contact is refused on do-not-contact, and otherwise stamps the prospect.
create or replace function public.prospect_activity_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'contacted' and exists (
    select 1 from public.platform_prospects where id = new.prospect_id and do_not_contact
  ) then
    raise exception 'prospect_do_not_contact' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_prospect_activity_before_insert on public.platform_prospect_activity;
create trigger trg_prospect_activity_before_insert before insert on public.platform_prospect_activity
  for each row execute function public.prospect_activity_before_insert();

create or replace function public.prospect_activity_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'contacted' then
    update public.platform_prospects
       set last_contacted_at = new.created_at,
           contact_count = contact_count + 1,
           stage = case when stage = 'new' then 'contacted' else stage end
     where id = new.prospect_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_prospect_activity_after_insert on public.platform_prospect_activity;
create trigger trg_prospect_activity_after_insert after insert on public.platform_prospect_activity
  for each row execute function public.prospect_activity_after_insert();

-- A waitlist signup becomes a prospect. Never blocks the signup.
create or replace function public.prospect_from_waitlist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.platform_prospects(name, phone, source, waitlist_id, created_by)
    values (coalesce(nullif(trim(new.name), ''), 'Waitlist #' || coalesce(new.position::text, '?')),
            new.phone, 'waitlist', new.id, null)
    on conflict (phone) where phone is not null
    do update set waitlist_id = coalesce(platform_prospects.waitlist_id, excluded.waitlist_id);
  exception when others then
    raise warning 'prospect_from_waitlist: %', sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists trg_prospect_from_waitlist on public.waitlist_signups;
create trigger trg_prospect_from_waitlist after insert on public.waitlist_signups
  for each row execute function public.prospect_from_waitlist();

-- A seller account appearing (or setting its phone) links the matching prospect.
-- Runs inside signup / profile edits, so it swallows its own errors.
create or replace function public.prospect_link_on_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role not in ('salesman','dealer','owner','manager','admin') then return null; end if;
  begin
    update public.platform_prospects
       set converted_profile_id = new.id,
           stage = case when stage in ('signed_up','paying') then stage else 'signed_up' end
     where converted_profile_id is null
       and phone is not null
       and phone in (public.normalize_my_phone(new.phone), public.normalize_my_phone(new.whatsapp_number));
  exception when others then
    raise warning 'prospect_link_on_profile: %', sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists trg_prospect_link_on_profile on public.profiles;
create trigger trg_prospect_link_on_profile
  after insert or update of phone, whatsapp_number, role on public.profiles
  for each row execute function public.prospect_link_on_profile();

-- Backfill the waitlist that already exists.
insert into public.platform_prospects(name, phone, source, waitlist_id, created_by, created_at)
select coalesce(nullif(trim(w.name), ''), 'Waitlist #' || coalesce(w.position::text, '?')),
       w.phone, 'waitlist', w.id, null, w.created_at
from public.waitlist_signups w
where not exists (select 1 from public.platform_prospects p where p.waitlist_id = w.id)
on conflict do nothing;
