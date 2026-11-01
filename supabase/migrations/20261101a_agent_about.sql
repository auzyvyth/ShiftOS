-- PAGE-PRO 2 (owner, 2026-11-01): a Premium seller page is a real mini page
-- ("About me", "Why buy from me", "Track record"). Four new answers the seller
-- gives in Premium Settings. QUEUED for after midnight MYT (DDL freezes the API).
--
-- Read through a NEW function, get_agent_about(slug), instead of widening
-- get_salesman_by_slug: changing that one's return type means DROP + CREATE of
-- the function every seller page, the share picture and og.js depend on.
-- Same visibility rule as get_salesman_by_slug, and like the bio, the answers
-- are returned only for a full (Premium) page: a Lite page gets nulls.
--
-- Free text never carries a phone number (CDP-3: seller numbers never ship to
-- the public): 8+ digits in a row is refused by a CHECK.

begin;

alter table public.profiles
  add column if not exists years_selling smallint,
  add column if not exists languages text[],
  add column if not exists areas_covered text,
  add column if not exists my_promise text;

alter table public.profiles
  drop constraint if exists profiles_years_selling_range,
  drop constraint if exists profiles_languages_known,
  drop constraint if exists profiles_areas_covered_ok,
  drop constraint if exists profiles_my_promise_ok;

alter table public.profiles
  add constraint profiles_years_selling_range
    check (years_selling is null or years_selling between 0 and 60),
  add constraint profiles_languages_known
    check (languages is null or languages <@ array['ms','en','zh','ta']::text[]),
  add constraint profiles_areas_covered_ok
    check (areas_covered is null or (char_length(areas_covered) <= 120 and areas_covered !~ '[0-9]{8,}')),
  add constraint profiles_my_promise_ok
    check (my_promise is null or (char_length(my_promise) <= 160 and my_promise !~ '[0-9]{8,}'));

create or replace function public.get_agent_about(p_slug text)
returns table (years_selling smallint, languages text[], areas_covered text, my_promise text)
language sql
stable
security definer
set search_path = public
as $$
  select
    case when q.full_page then q.years_selling end,
    case when q.full_page then q.languages end,
    case when q.full_page then q.areas_covered end,
    case when q.full_page then q.my_promise end
  from (
    select p.years_selling, p.languages, p.areas_covered, p.my_promise,
           public.salesman_has_full_page(p.id) as full_page
    from profiles p
    where p.slug = p_slug
      and p.role = 'salesman'
      and (p.is_active = true or p.approval_status = 'pending')
      and p.suspended_at is null
      and coalesce(p.account_status, 'active') <> 'deleted'
      and p.deleted_at is null
    limit 1
  ) q;
$$;

-- Public read (the page is public), like get_salesman_by_slug. Supabase grants
-- new functions to anon directly, so state it explicitly rather than inherit.
revoke all on function public.get_agent_about(text) from public;
grant execute on function public.get_agent_about(text) to anon, authenticated, service_role;

commit;
