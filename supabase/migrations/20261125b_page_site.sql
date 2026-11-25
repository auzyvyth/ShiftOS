-- PAGE-SITE 2 (owner, 2026-11-25): a Premium page can carry the seller's own
-- page background (a curated gradient, `ground`), promos of the month, the seller's own note on each model, delivery towns and the order of its sections. All of it
-- is ONE small jsonb on the seller's profile, `profiles.page_site`.
--
-- The seller's OWN claims, never Drevo prices: every promo must carry an end
-- date (and hides itself after it on the page); delivery km/minutes are the
-- seller's estimate. No phone number can be typed into any field (CDP-3): a run
-- of 7+ digits is refused, same rule as src/utils/pageSite.js (the limits below
-- are repeated there; `npm run test:pagesite`).
--
-- Written ONLY through set_my_page_site (a salesman, Premium page). Read
-- publicly ONLY through get_agent_site(slug): its own call like get_agent_hero,
-- so the main profile read can never fail on it, Premium pages only, and it
-- re-checks the value so a row written some other way is never shown.

alter table public.profiles add column if not exists page_site jsonb;

create or replace function public._page_site_ok(p jsonb)
returns boolean
language plpgsql stable
set search_path to 'public'
as $$
declare
  e jsonb;
  ids text[] := array['promos','models','cars','calculator','delivery'];
  t text;
begin
  if p is null then return true; end if;
  if jsonb_typeof(p) <> 'object' then return false; end if;
  if length(p::text) > 8000 then return false; end if;
  if coalesce(p->>'v', '1') <> '1' then return false; end if;
  if p ? 'ground' and not ((p->>'ground') = any (array['white','ivory','stone','sage','sky','blush','accent'])) then return false; end if;

  if p ? 'order' then
    if jsonb_typeof(p->'order') <> 'array' or jsonb_array_length(p->'order') > 5 then return false; end if;
    for t in select jsonb_array_elements_text(p->'order') loop
      if not (t = any(ids)) then return false; end if;
    end loop;
  end if;
  if p ? 'off' then
    if jsonb_typeof(p->'off') <> 'array' or jsonb_array_length(p->'off') > 5 then return false; end if;
    for t in select jsonb_array_elements_text(p->'off') loop
      if not (t = any(ids)) then return false; end if;
    end loop;
  end if;

  if p ? 'promos' then
    if jsonb_typeof(p->'promos') <> 'array' or jsonb_array_length(p->'promos') > 12 then return false; end if;
    for e in select * from jsonb_array_elements(p->'promos') loop
      if jsonb_typeof(e) <> 'object' then return false; end if;
      if coalesce(length(btrim(e->>'model')), 0) not between 1 and 40 then return false; end if;
      if coalesce(length(e->>'text'), 0) > 80 then return false; end if;
      if (e->>'until') is null or (e->>'until') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
      begin perform (e->>'until')::date; exception when others then return false; end;
      if (e->>'until')::date > (now() at time zone 'Asia/Kuala_Lumpur')::date + 120 then return false; end if;
      if e ? 'price' and not ((e->>'price') ~ '^\d{1,7}$' and (e->>'price')::numeric between 1 and 2000000) then return false; end if;
      if regexp_replace(coalesce(e->>'model','') || coalesce(e->>'text',''), '[\s\-.+()]', '', 'g') ~ '[0-9]{7,}' then return false; end if;
    end loop;
  end if;

  if p ? 'notes' then
    if jsonb_typeof(p->'notes') <> 'array' or jsonb_array_length(p->'notes') > 12 then return false; end if;
    for e in select * from jsonb_array_elements(p->'notes') loop
      if jsonb_typeof(e) <> 'object' then return false; end if;
      if coalesce(length(btrim(e->>'model')), 0) not between 1 and 40 then return false; end if;
      if coalesce(length(btrim(e->>'text')), 0) not between 1 and 160 then return false; end if;
      if regexp_replace(coalesce(e->>'model','') || coalesce(e->>'text',''), '[\s\-.+()]', '', 'g') ~ '[0-9]{7,}' then return false; end if;
    end loop;
  end if;

  if p ? 'delivery' then
    if jsonb_typeof(p->'delivery') <> 'object' then return false; end if;
    if coalesce(length(p->'delivery'->>'base'), 0) > 40 then return false; end if;
    if p->'delivery' ? 'items' then
      if jsonb_typeof(p->'delivery'->'items') <> 'array' or jsonb_array_length(p->'delivery'->'items') > 12 then return false; end if;
      for e in select * from jsonb_array_elements(p->'delivery'->'items') loop
        if jsonb_typeof(e) <> 'object' then return false; end if;
        if coalesce(length(btrim(e->>'town')), 0) not between 1 and 40 then return false; end if;
        if not ((e->>'km') ~ '^\d{1,4}$' and (e->>'km')::int between 1 and 3000) then return false; end if;
        if e ? 'min' and not ((e->>'min') ~ '^\d{1,4}$' and (e->>'min')::int between 1 and 2880) then return false; end if;
        if regexp_replace(coalesce(e->>'town',''), '[\s\-.+()]', '', 'g') ~ '[0-9]{7,}' then return false; end if;
      end loop;
    end if;
  end if;
  return true;
end;
$$;

create or replace function public.set_my_page_site(p_site jsonb)
returns jsonb
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
  if not public.salesman_has_full_page(v_uid) then raise exception 'not_premium'; end if;
  if not public._page_site_ok(p_site) then raise exception 'page_site_invalid'; end if;
  update profiles set page_site = p_site where id = v_uid;
  return p_site;
end;
$$;

create or replace function public.get_agent_site(p_slug text)
returns jsonb
language sql stable security definer
set search_path to 'public'
as $$
  select case when public.salesman_has_full_page(p.id) and public._page_site_ok(p.page_site)
              then p.page_site end
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
revoke all on function public._page_site_ok(jsonb) from public, anon, authenticated;
revoke all on function public.set_my_page_site(jsonb) from public, anon;
grant execute on function public.set_my_page_site(jsonb) to authenticated;
revoke all on function public.get_agent_site(text) from public;
grant execute on function public.get_agent_site(text) to anon, authenticated;
