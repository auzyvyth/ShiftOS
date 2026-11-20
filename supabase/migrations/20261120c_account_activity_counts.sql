-- ACCT-COUNT-1 (2026-11-20, QUEUED for the after-midnight slot): Console > Accounts counted every
-- car row, archived ones included (a seller's "Delete" archives), so `ausfedaus` read 23 cars
-- while his page showed 10 (10 available + 13 archived).
-- get_account_activity now: `listings` = cars the seller still has (archived left out), plus
-- `archived` (removed cars) and `brands` (the brands of the cars on their page now: available +
-- reserved, most cars first, max 6). Output columns change, so DROP + CREATE (CREATE OR REPLACE
-- cannot change a table return), grants asserted again (it was authenticated + service_role).
-- Same guard as before: rows only come back when is_superadmin().
begin;

drop function if exists public.get_account_activity(uuid[]);

create function public.get_account_activity(p_ids uuid[])
returns table(id uuid, listings integer, available integer, sold integer, pending integer,
              enquiries integer, leads integer, team integer, last_active_at timestamptz,
              archived integer, brands text[])
language sql
security definer
set search_path to 'public'
as $function$
  with ids as (
    select unnest(p_ids) as id
  ),
  -- Deduplicated: a standalone salesman is both owner and assignee of their own
  -- cars, and must not be counted twice.
  lst as (
    select distinct i.id as owner_id, c.id as listing_id, c.status, c.created_at,
           nullif(trim(c.brand), '') as brand
    from ids i
    join car_listings c on c.dealer_id = i.id or c.assigned_to = i.id
  ),
  bnd as (
    select owner_id, lower(brand) as k, min(brand) as label, count(*) as n
    from lst
    where brand is not null and status in ('available', 'reserved')
    group by owner_id, lower(brand)
  )
  select
    i.id,
    (select count(*) from lst where lst.owner_id = i.id and lst.status <> 'archived')::int,
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
    ),
    (select count(*) from lst where lst.owner_id = i.id and lst.status = 'archived')::int,
    coalesce((select array_agg(label order by n desc, label)
                from (select label, n from bnd where bnd.owner_id = i.id order by n desc, label limit 6) t),
             '{}'::text[])
  from ids i
  where is_superadmin();
$function$;

revoke all on function public.get_account_activity(uuid[]) from public, anon;
grant execute on function public.get_account_activity(uuid[]) to authenticated, service_role;

commit;
