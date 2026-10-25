-- Loan check (IDEA-23, 2026-10-25): what to fix BEFORE any bank sees the file.
-- One row per lead (a walk-in buyer has no lead). The answers are a salesman's
-- notes on a buyer's credit record, so: own rows only, the dealer reads its
-- team's, anon reads nothing, and no IC number is ever stored here.
-- Separate from loan_applications on purpose: a check is not a submission, and a
-- row there flips leads.loan_status to 'submitted' (trg_sync_lead_loan).
-- QUEUED for the after-midnight slot (CLAUDE.md DB migrations). Additive only.

begin;

create table if not exists public.loan_checks (
  id          uuid primary key default gen_random_uuid(),
  salesman_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  dealer_id   uuid references public.profiles(id) on delete set null,
  lead_id     uuid unique references public.leads(id) on delete cascade,
  listing_id  uuid references public.car_listings(id) on delete set null,
  buyer_name  text,
  answers     jsonb not null default '{}'::jsonb,
  outcome     text not null check (outcome in ('ready', 'fix', 'hold')),
  fix_count   integer not null default 0 check (fix_count >= 0),
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists loan_checks_salesman_idx on public.loan_checks (salesman_id, updated_at desc);

create or replace function public.loan_checks_touch()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_loan_checks_touch on public.loan_checks;
create trigger trg_loan_checks_touch before update on public.loan_checks
  for each row execute function public.loan_checks_touch();

alter table public.loan_checks enable row level security;

-- A salesman writes only their own rows, and only against their own lead.
-- is_active_salesman() keeps guests (anonymous sign-in = authenticated) out.
drop policy if exists loan_checks_own on public.loan_checks;
create policy loan_checks_own on public.loan_checks
  for all to authenticated
  using (salesman_id = (select auth.uid()))
  with check (
    salesman_id = (select auth.uid())
    and (select public.is_active_salesman())
    and (dealer_id is null or dealer_id = (select public.get_my_dealer_id()))
    and (lead_id is null or exists (
      select 1 from public.leads l where l.id = lead_id and l.salesman_id = (select auth.uid())
    ))
  );

-- The dealer a linked salesman works under can read the team's checks.
drop policy if exists loan_checks_dealer_read on public.loan_checks;
create policy loan_checks_dealer_read on public.loan_checks
  for select to authenticated
  using (dealer_id is not null and dealer_id = (select auth.uid()));

revoke all on public.loan_checks from anon, public;
grant select, insert, update, delete on public.loan_checks to authenticated;

commit;
