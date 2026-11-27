-- HONEYPOT-1 infrastructure (owner, 2026-11-27). QUEUED, apply after midnight Malaysia time, nobody live.
-- This file holds ONLY the generic parts. The decoy names are never written in this repo:
-- they are created afterwards by calling the two builder functions below from the SQL editor,
-- and are listed in honeypot_decoys (superadmin read) so the owner can look them up.

begin;

create table if not exists public.honeypot_decoys (
  id         bigserial primary key,
  kind       text not null check (kind in ('table', 'rpc', 'path')),
  name       text not null,
  created_at timestamptz not null default now(),
  unique (kind, name)
);

create table if not exists public.honeypot_hits (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  kind       text not null,          -- table / rpc / path
  name       text not null,          -- which decoy
  action     text,                   -- INSERT / UPDATE / DELETE / CALL / GET ...
  ip         text,
  user_agent text,
  role       text,
  uid        uuid
);
create index if not exists honeypot_hits_at_idx on public.honeypot_hits (at desc);

alter table public.honeypot_decoys enable row level security;
alter table public.honeypot_hits   enable row level security;

drop policy if exists honeypot_decoys_admin_read on public.honeypot_decoys;
create policy honeypot_decoys_admin_read on public.honeypot_decoys
  for select to authenticated using (public.is_superadmin());
drop policy if exists honeypot_hits_admin_read on public.honeypot_hits;
create policy honeypot_hits_admin_read on public.honeypot_hits
  for select to authenticated using (public.is_superadmin());

revoke all on public.honeypot_decoys, public.honeypot_hits from public, anon, authenticated;
grant select on public.honeypot_decoys, public.honeypot_hits to authenticated;
revoke all on sequence public.honeypot_decoys_id_seq, public.honeypot_hits_id_seq from public, anon, authenticated;

-- One entry point: log the touch, then alert through notify_ops (phone + Telegram).
-- Never raises: a tripwire must not turn into an error that tells the visitor it is one.
create or replace function public.honeypot_record(
  p_kind text, p_name text, p_action text,
  p_ip text default null, p_ua text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  h   json;
  v_ip text;
  v_ua text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then h := null;
  end;
  v_ip := coalesce(p_ip, split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1));
  v_ua := coalesce(p_ua, h->>'user-agent');

  insert into public.honeypot_hits (kind, name, action, ip, user_agent, role, uid)
  values (p_kind, p_name, p_action, nullif(trim(v_ip), ''), left(v_ua, 300),
          current_setting('request.jwt.claim.role', true), auth.uid());

  delete from public.honeypot_hits where at < now() - interval '90 days';

  begin
    perform public.notify_ops('honeypot:' || p_kind,
      'Tripwire touched' || E'\n' || p_kind || ' / ' || p_name || ' / ' || coalesce(p_action, '?')
      || ' / ' || coalesce(nullif(trim(v_ip), ''), 'no ip'));
  exception when others then
    raise warning 'honeypot_record: notify failed: %', sqlerrm;
  end;
exception when others then
  raise warning 'honeypot_record failed: %', sqlerrm;
end $$;

-- Web decoys (the edge middleware) call it with the service key. Nobody else.
revoke all on function public.honeypot_record(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.honeypot_record(text, text, text, text, text) to service_role;

-- Trigger body shared by every decoy table: log, then drop the write silently (RETURN NULL),
-- because RAISE would roll the log row back with it. A BEFORE trigger fires before RLS checks.
create or replace function public.honeypot_trg() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.honeypot_record('table', tg_table_name, tg_op);
  return null;
end $$;
revoke all on function public.honeypot_trg() from public, anon, authenticated;

-- Builder 1: a decoy table. Looks ordinary, holds nothing, any write is logged.
create or replace function public.honeypot_make_table(p_name text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_name !~ '^[a-z][a-z0-9_]{2,40}$' then raise exception 'bad name'; end if;
  execute format('create table if not exists public.%I (id bigserial primary key, data jsonb, created_at timestamptz default now())', p_name);
  execute format('alter table public.%I enable row level security', p_name);
  execute format('drop policy if exists %I on public.%I', p_name || '_open', p_name);
  execute format('create policy %I on public.%I for all to anon, authenticated using (true) with check (true)', p_name || '_open', p_name);
  execute format('grant select, insert, update, delete on public.%I to anon, authenticated', p_name);
  execute format('drop trigger if exists trg_hp on public.%I', p_name);
  execute format('create trigger trg_hp before insert or update or delete on public.%I for each row execute function public.honeypot_trg()', p_name);
  insert into public.honeypot_decoys (kind, name) values ('table', p_name) on conflict do nothing;
end $$;
revoke all on function public.honeypot_make_table(text) from public, anon, authenticated;

-- Builder 2: a decoy RPC. Callable by anon, returns an empty array, logs the call.
create or replace function public.honeypot_make_rpc(p_name text) returns void
language plpgsql security definer set search_path = public, pg_temp as $out$
begin
  if p_name !~ '^[a-z][a-z0-9_]{2,40}$' then raise exception 'bad name'; end if;
  execute format($f$create or replace function public.%I() returns jsonb language plpgsql security definer set search_path = public, pg_temp as $b$ begin perform public.honeypot_record('rpc', %L, 'CALL'); return '[]'::jsonb; end $b$$f$, p_name, p_name);
  execute format('revoke all on function public.%I() from public', p_name);
  execute format('grant execute on function public.%I() to anon, authenticated', p_name);
  insert into public.honeypot_decoys (kind, name) values ('rpc', p_name) on conflict do nothing;
end $out$;
revoke all on function public.honeypot_make_rpc(text) from public, anon, authenticated;

commit;
