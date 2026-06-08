-- AI consolidation: shared per-dealer quota pool + per-role/feature request log
-- All sub-roles (salesman, manager, admin, fi_officer, accountant) draw from the
-- same daily quota as their parent dealer, tracked in ai_usage(dealer_id, date, count).
-- ai_request_log adds per-role/feature visibility so the owner can see who is using AI.

create table if not exists ai_request_log (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references profiles(id) on delete cascade,
  user_id uuid not null,
  role text not null,
  feature text not null,
  model text not null,
  max_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_request_log_dealer_date_idx
  on ai_request_log (dealer_id, created_at desc);

create index if not exists ai_request_log_user_idx
  on ai_request_log (user_id, created_at desc);

alter table ai_request_log enable row level security;

drop policy if exists "Dealer can view own ai request log" on ai_request_log;
create policy "Dealer can view own ai request log"
  on ai_request_log for select
  using (dealer_id = get_my_dealer_id());

-- Atomically check-and-increment the shared per-dealer daily quota.
-- Returns the new count; raises nothing — caller compares against the cap.
create or replace function increment_ai_usage(p_dealer_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into ai_usage (dealer_id, date, count)
  values (p_dealer_id, current_date, 1)
  on conflict (dealer_id, date)
  do update set count = ai_usage.count + 1, updated_at = now()
  returning count into v_count;

  return v_count;
end;
$$;

-- ai_usage needs a unique constraint on (dealer_id, date) for the upsert above
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ai_usage_dealer_id_date_key'
  ) then
    alter table ai_usage add constraint ai_usage_dealer_id_date_key unique (dealer_id, date);
  end if;
end $$;
