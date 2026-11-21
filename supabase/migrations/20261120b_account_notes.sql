-- NOTES-1 (2026-11-20, QUEUED for the after-midnight slot): the owner's private notes + tags
-- on any account, shown in Console > Accounts. Its OWN table, not a column on `profiles`:
-- a seller can read their own profiles row, so a note there ("slow payer", "promised X")
-- would be visible to the person it is about. Superadmin only, in every command.
begin;

create table if not exists public.platform_account_notes (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  note       text not null default '' check (length(note) <= 2000),
  tags       text[] not null default '{}'
             check (cardinality(tags) <= 8 and length(array_to_string(tags, '|')) <= 250),
  updated_at timestamptz not null default now()
);

alter table public.platform_account_notes enable row level security;

drop policy if exists platform_account_notes_superadmin on public.platform_account_notes;
create policy platform_account_notes_superadmin on public.platform_account_notes
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Supabase grants new tables to anon directly; revoke from public AND anon, then grant the
-- one role that can pass the policy.
revoke all on public.platform_account_notes from public, anon;
grant select, insert, update, delete on public.platform_account_notes to authenticated;

commit;
