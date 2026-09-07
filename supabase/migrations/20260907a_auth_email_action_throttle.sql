-- AUTH-5: rate-limit the auth emails a stranger can make us send.
--
-- Plain version: password reset, magic link and "resend confirmation" all send
-- an email to whatever address is typed in the box, and nothing in the app
-- limited how often. Type someone else's address and hold down the button and
-- we mail-bomb their inbox on their behalf. Supabase's own per-address cooldown
-- was the only thing standing there.
--
-- This is a sliding window per (email, action): 3 sends per 15 minutes. When
-- the window fills, the caller is told how many seconds until the oldest send
-- ages out — there is deliberately NO extra penalty lock on top, because the
-- person being told to wait is usually the legitimate owner who did not get the
-- first email.
--
-- Known tradeoff, stated rather than hidden: the key is an email address the
-- CALLER supplies, so someone can burn a victim's three sends and delay that
-- victim's own reset for up to 15 minutes. That is the same accepted tradeoff
-- login_throttle_fail already carries, and it is why the window is short and
-- self-healing rather than a long lock. A throttle keyed on a client-supplied
-- identifier is a spam brake, NOT a proof-of-human control — the real control
-- is the captcha in AUTH-6/ACT-10, and this does not replace it.
--
-- Per-action, not per-email: filling the "reset" bucket must not also block the
-- magic link, which may be the only way that person can get in.

create table if not exists public.auth_email_action_throttle (
  email        text        not null,
  action       text        not null,
  attempts     integer     not null default 0,
  window_start timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (email, action)
);

comment on table public.auth_email_action_throttle is
  'AUTH-5 sliding-window counter for auth emails (reset / magic / resend). Written only by auth_email_action_gate().';

-- The purge inside the function sweeps by updated_at.
create index if not exists auth_email_action_throttle_updated_idx
  on public.auth_email_action_throttle (updated_at);

-- No policies, on purpose. RLS on with zero policies means anon and
-- authenticated can neither read nor write it directly; the SECURITY DEFINER
-- function below is the only door. Counting rows must not be a way to ask
-- "has this address requested a password reset recently".
alter table public.auth_email_action_throttle enable row level security;

-- Ask whether this email may trigger this action right now, and record it if so.
-- Returns allowed=false with seconds_left when the window is full.
create or replace function public.auth_email_action_gate(p_email text, p_action text)
returns table(allowed boolean, seconds_left integer, attempts integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_now    timestamptz := now();
  v_window constant interval := interval '15 minutes';
  v_max    constant integer  := 3;
  v        public.auth_email_action_throttle;
begin
  -- Not our job to validate an address: an obvious non-email is let through so
  -- Supabase gives its own error, and so we never create a counter row for junk.
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    return query select true, 0, 0;
    return;
  end if;

  -- Whitelist. An open action column would let a caller fill this table with
  -- arbitrary rows, and a typo'd action name would silently get its own budget.
  if v_action not in ('reset', 'magic', 'resend') then
    raise exception 'auth_email_action_gate: unknown action %', v_action
      using errcode = '22023';
  end if;

  -- Keep the table bounded. Occasional rather than every call: a full window is
  -- 15 minutes, so anything untouched for an hour is dead weight.
  if random() < 0.02 then
    delete from public.auth_email_action_throttle
     where updated_at < v_now - interval '1 hour';
  end if;

  insert into public.auth_email_action_throttle (email, action, attempts, window_start, updated_at)
  values (v_email, v_action, 0, v_now, v_now)
  on conflict (email, action) do nothing;

  select * into v
    from public.auth_email_action_throttle
   where email = v_email and action = v_action
     for update;

  -- Window rolled over — start a fresh one.
  if v.window_start < v_now - v_window then
    v.attempts := 0;
    v.window_start := v_now;
  end if;

  if v.attempts >= v_max then
    -- Do NOT extend the window on a refused attempt. Hammering the button must
    -- not push the legitimate owner's wait further out.
    update public.auth_email_action_throttle
       set updated_at = v_now
     where email = v_email and action = v_action;
    return query select
      false,
      greatest(1, ceil(extract(epoch from (v.window_start + v_window - v_now)))::integer),
      v.attempts;
    return;
  end if;

  update public.auth_email_action_throttle
     set attempts = v.attempts + 1,
         window_start = v.window_start,
         updated_at = v_now
   where email = v_email and action = v_action;

  return query select true, 0, v.attempts + 1;
end;
$$;

-- anon needs this: nobody is signed in when they ask for a reset or a magic
-- link. Revoke from public first — a grant held by PUBLIC is inherited by anon
-- and a later "revoke from anon" would silently no-op (see the share-token
-- rules in CLAUDE.md).
revoke all on function public.auth_email_action_gate(text, text) from public;
grant execute on function public.auth_email_action_gate(text, text) to anon, authenticated;
