-- A4: the platform console could not tell an active seller from a dead one.
--
-- Applied live via MCP apply_migration on 2026-08-28
-- (migration get_account_activity_for_console); committed here so the repo
-- carries the source. The anon revoke below was applied as a follow-up in the
-- same session -- see the note on it.
--
-- Dealers had counts (three client-side queries in loadAll); salesmen had none
-- at all, so the console could not answer "which Lite sellers actually use
-- this?" -- the one question the growth engine turns on.
--
-- Counts come from an RPC rather than more client-side queries because `leads`
-- has NO superadmin SELECT policy, and it should not get one: lead rows carry
-- buyer name, phone, IC and address. The console needs the NUMBER, not the
-- people. This returns counts only -- no buyer PII crosses the boundary -- and
-- is the single activity source for every account type, so the dealer and
-- salesman halves of the console cannot drift apart again.
--
-- Ownership differs by account type and is unified here:
--   dealer / standalone salesman -> they own listings (car_listings.dealer_id)
--   salesman under a dealer      -> they sell the dealer's (assigned_to)
-- so a listing counts if EITHER matches, deduplicated by listing id.
create or replace function public.get_account_activity(p_ids uuid[])
returns table (
  id uuid,
  listings integer,
  available integer,
  sold integer,
  pending integer,
  enquiries integer,
  leads integer,
  team integer,
  last_active_at timestamptz
)
language sql
security definer
set search_path to 'public'
as $$
  with ids as (
    select unnest(p_ids) as id
  ),
  -- Deduplicated: a standalone salesman is both owner and assignee of their own
  -- cars, and must not be counted twice.
  lst as (
    select distinct i.id as owner_id, c.id as listing_id, c.status, c.created_at
    from ids i
    join car_listings c on c.dealer_id = i.id or c.assigned_to = i.id
  )
  select
    i.id,
    (select count(*) from lst where lst.owner_id = i.id)::int,
    (select count(*) from lst where lst.owner_id = i.id and lst.status = 'available')::int,
    (select count(*) from lst where lst.owner_id = i.id and lst.status = 'sold')::int,
    (select count(*) from lst where lst.owner_id = i.id and lst.status = 'pending_approval')::int,
    (select count(*) from whatsapp_enquiries e
       where e.dealer_id = i.id or e.salesman_id = i.id)::int,
    (select count(*) from leads l
       where l.dealer_id = i.id or l.salesman_id = i.id)::int,
    (select count(*) from profiles p where p.dealer_id = i.id)::int,
    greatest(
      (select max(lst.created_at) from lst where lst.owner_id = i.id),
      (select max(l.created_at) from leads l where l.dealer_id = i.id or l.salesman_id = i.id)
    )
  from ids i
  where is_superadmin();
$$;

-- Supabase's default privileges GRANT EXECUTE on every new function in `public`
-- to anon, authenticated and service_role. That is an EXPLICIT grant to anon,
-- so `revoke ... from public` alone silently leaves it in place -- verified
-- with has_function_privilege('anon', ...), not by reading the migration back.
-- Revoke from both, then grant the one role that may call it. The body's
-- is_superadmin() gate is the real check; this keeps it off anon's surface.
revoke all on function public.get_account_activity(uuid[]) from public;
revoke all on function public.get_account_activity(uuid[]) from anon;
grant execute on function public.get_account_activity(uuid[]) to authenticated;
