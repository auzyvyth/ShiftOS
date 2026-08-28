-- A5: suspension captured no reason and told the seller nothing.
--
-- Applied live via MCP apply_migration on 2026-08-28
-- (migration suspension_reason_and_notice); committed here so the repo carries
-- the source.
--
-- One click set is_active=false. The seller hit a full-screen "Account
-- Suspended -- contact support" wall with no idea what they had done, and
-- nobody was notified at all. Account REVIEW already has preset, actionable
-- rejection reasons; suspension is harsher and had none.
alter table public.profiles
  add column if not exists suspension_reason text,
  add column if not exists suspended_at timestamptz;

comment on column public.profiles.suspension_reason is
  'Why this account was suspended. Shown verbatim to the account holder in SuspendedBanner, so it is written as something they can act on.';

-- One entry point for suspend/unsuspend, so the reason, the timestamp and the
-- notice can never be written by one caller and skipped by the next.
--
-- SECURITY DEFINER because it inserts a notification row: the console is not
-- granted blanket INSERT on dealer_notifications / salesman_notifications, and
-- should not be. Inserting that row IS the push -- trg_push_on_dealer_notification
-- and trg_push_on_salesman_notification fan it out -- so there is no separate
-- send-push call here.
create or replace function public.set_account_suspended(
  p_user_id uuid,
  p_suspended boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select role into v_role from profiles where id = p_user_id;
  if v_role is null then
    raise exception 'account not found' using errcode = 'no_data_found';
  end if;

  if p_suspended then
    update profiles
       set is_active = false,
           suspension_reason = v_reason,
           suspended_at = now()
     where id = p_user_id;
  else
    -- Lifting a suspension clears the reason: a stale one would keep showing
    -- in the seller's banner the next time they are suspended for something
    -- else, before the new reason is written.
    update profiles
       set is_active = true,
           suspension_reason = null,
           suspended_at = null
     where id = p_user_id;
  end if;

  -- Tell them. A suspended seller can still sign in far enough to see the
  -- banner, and the push reaches them even when they are not looking.
  if v_role in ('dealer', 'owner') then
    insert into dealer_notifications (dealer_id, type, title, body)
    values (
      p_user_id,
      case when p_suspended then 'account_suspended' else 'account_reinstated' end,
      case when p_suspended then 'Your account has been suspended' else 'Your account is active again' end,
      case when p_suspended
           then coalesce(v_reason, 'Contact XDrive support to resolve this.')
           else 'Your listings are back on the marketplace.' end
    );
  elsif v_role = 'salesman' then
    insert into salesman_notifications (salesman_id, type, title, body)
    values (
      p_user_id,
      case when p_suspended then 'account_suspended' else 'account_reinstated' end,
      case when p_suspended then 'Your account has been suspended' else 'Your account is active again' end,
      case when p_suspended
           then coalesce(v_reason, 'Contact XDrive support to resolve this.')
           else 'Your listings are back on the marketplace.' end
    );
  end if;
end;
$$;

revoke all on function public.set_account_suspended(uuid, boolean, text) from public;
revoke all on function public.set_account_suspended(uuid, boolean, text) from anon;
grant execute on function public.set_account_suspended(uuid, boolean, text) to authenticated;
