-- Phone format gate.
--
-- The same Malaysian number was being stored three different ways:
--   profiles.phone                  -> 01123142642   (local)
--   whatsapp_enquiries.buyer_phone  -> 01123142642   (local)
--   leads.phone                     -> 601123142642  (intl)
-- so any join on raw phone text silently matched nothing (verified: 0 matches before
-- this migration, 76 leads + 18 enquiries for the same buyer after it). Rather than
-- backfill -- and let the formats drift apart again -- every table that stores a buyer
-- phone gets a GENERATED column carrying the canonical form. Postgres recomputes it on
-- every insert and update, so drift is now structurally impossible.
--
-- normalize_phone MUST return the same string as src/lib/phone.js normalizePhone().
-- That JS helper is the existing canonical form (60-prefixed) and is already used for
-- runtime matching in SalesmanLite.jsx:2682. If you change one, change both.
-- Two deliberate differences from the JS, both only affecting values that cannot be
-- real phone numbers:
--   '' / non-digits          -> NULL  (JS returns ''; NULL is used here so junk rows
--                                      cannot false-match each other in a join)
--   under 11 chars normalised -> NULL (cannot be a real MY number: 60 + 9-10 digits)

create or replace function public.normalize_phone(p text)
returns text
language sql
immutable
parallel safe
as $$
  select case when length(n) >= 11 then n else null end
  from (
    select case
             when d = ''            then null
             when left(d, 2) = '60' then d
             when left(d, 1) = '0'  then '60' || substr(d, 2)
             else                        '60' || d
           end as n
    from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) a
  ) b;
$$;

comment on function public.normalize_phone(text) is
  'Canonical Malaysian phone form (60-prefixed digits). Mirrors src/lib/phone.js normalizePhone(). Returns NULL for junk/short input so it cannot false-match in joins.';

alter table public.profiles
  add column if not exists phone_norm text
  generated always as (public.normalize_phone(phone)) stored;

alter table public.leads
  add column if not exists phone_norm text
  generated always as (public.normalize_phone(phone)) stored;

alter table public.whatsapp_enquiries
  add column if not exists phone_norm text
  generated always as (public.normalize_phone(buyer_phone)) stored;

create index if not exists idx_profiles_phone_norm on public.profiles (phone_norm) where phone_norm is not null;
create index if not exists idx_leads_phone_norm    on public.leads (phone_norm) where phone_norm is not null;
create index if not exists idx_wa_enq_phone_norm   on public.whatsapp_enquiries (phone_norm) where phone_norm is not null;
