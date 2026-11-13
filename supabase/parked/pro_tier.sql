-- Drevo Pro entitlement (IDEA-34, 2026-11-13). QUEUED for tonight's release window (00:00-09:00 MYT,
-- nobody live): a migration freezes the live API for everyone for up to 45 seconds. Not applied.
--
-- Owner's terms: paid upfront, no free trial, no pay = no use.
-- Design: its OWN table, not a column on `profiles`. `profiles` carries the big escalation guards
-- (prevent_profile_privilege_escalation, trg_zy_guard_profile_lifecycle) and a seller can write
-- their own row, so a new column there needs a new guard branch. A separate table has no client
-- write path at all: RLS lets a user READ their own row, and the only writers are the two
-- SECURITY DEFINER functions below, both superadmin-only (same pattern as record_subscription_payment).
-- This does NOT switch posting on by itself: the zernio-post edge function still allows only
-- ZERNIO_TEST_USER_IDS, because until per-seller Zernio connect exists every post goes to the
-- owner's own accounts. Wiring Pro into that function is part of Z1, not this migration.

begin;

create table if not exists public.pro_subscriptions (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  paid_until      timestamptz not null,
  last_payment_at timestamptz not null default now(),
  payments        integer not null default 1,
  created_at      timestamptz not null default now()
);

alter table public.pro_subscriptions enable row level security;

drop policy if exists pro_subscriptions_read_own on public.pro_subscriptions;
create policy pro_subscriptions_read_own on public.pro_subscriptions
  for select to authenticated using (user_id = auth.uid());

-- No insert / update / delete policy: nobody writes this table from a browser.
revoke all on table public.pro_subscriptions from public, anon, authenticated;
grant select on table public.pro_subscriptions to authenticated;

-- Log one paid month(s). Extends from the later of now() and the current paid_until, so paying
-- early never loses days. Superadmin only.
create or replace function public.record_pro_payment(p_user uuid, p_months integer default 1)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_until timestamptz;
begin
  if not public.is_superadmin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_months is null or p_months < 1 or p_months > 24 then
    raise exception 'bad_months';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'no_such_user';
  end if;

  insert into public.pro_subscriptions as s (user_id, paid_until)
  values (p_user, now() + make_interval(months => p_months))
  on conflict (user_id) do update
    set paid_until      = greatest(s.paid_until, now()) + make_interval(months => p_months),
        last_payment_at = now(),
        payments        = s.payments + 1
  returning paid_until into v_until;

  return v_until;
end;
$$;

-- Take Pro away at once (refund, chargeback, mistaken payment). Superadmin only.
create or replace function public.revoke_pro(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.pro_subscriptions where user_id = p_user;
end;
$$;

-- "Am I paid up?" for the caller only: the paid-through date while it is in the future, else null.
create or replace function public.my_pro_status()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select paid_until from public.pro_subscriptions
  where user_id = auth.uid() and paid_until > now();
$$;

-- Supabase grants new functions to anon directly: revoke from public AND anon, then grant explicitly.
revoke all on function public.record_pro_payment(uuid, integer) from public, anon;
revoke all on function public.revoke_pro(uuid)                  from public, anon;
revoke all on function public.my_pro_status()                   from public, anon;
grant execute on function public.record_pro_payment(uuid, integer) to authenticated;
grant execute on function public.revoke_pro(uuid)                  to authenticated;
grant execute on function public.my_pro_status()                   to authenticated;

commit;

-- Verify after applying (read-only):
--   select has_function_privilege('anon', 'public.record_pro_payment(uuid,integer)', 'execute');  -- false
--   select has_function_privilege('anon', 'public.my_pro_status()', 'execute');                   -- false
--   select has_table_privilege('authenticated', 'public.pro_subscriptions', 'insert');            -- false
--   select oid::regprocedure from pg_proc where proname in ('record_pro_payment','revoke_pro','my_pro_status'); -- one row each
