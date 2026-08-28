-- decide_user_approval() flipped approval_status to 'approved' but never set
-- is_active=true. The listings INSERT policy (salesman_inserts_own_listings)
-- gates on is_active_salesman(), which checks is_active=true, not
-- approval_status. Every standalone salesman starts is_active=false at
-- signup (handle_new_user), so an admin clicking "Approve" left them
-- permanently blocked from publishing ("Publishing was blocked — your
-- account isn't fully activated yet") even though the panel showed them as
-- approved. Same gap applies to dealers approved through this RPC.
--
-- Applied live via MCP apply_migration on 2026-08-28
-- (fix_decide_user_approval_activates_account); committed here so the repo
-- carries the source.

create or replace function public.decide_user_approval(p_user_id uuid, p_approve boolean, p_reason text default null::text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_admin uuid := auth.uid();
begin
  if not public.is_superadmin() then raise exception 'not_authorized'; end if;

  if p_approve then
    update public.profiles
      set approval_status = 'approved',
          is_verified = true,
          verified_at = now(),
          verified_by = v_admin,
          approved_by = v_admin,
          approved_at = now(),
          rejection_reason = null,
          is_active = true
    where id = p_user_id;
  else
    update public.profiles
      set approval_status = 'rejected',
          is_verified = false,
          rejection_reason = nullif(btrim(coalesce(p_reason,'')), '')
    where id = p_user_id;
  end if;

  -- Drop the path record. The physical objects are purged by the caller via the
  -- Storage API; with this row gone the app can no longer locate or sign them.
  delete from public.kyc_documents where user_id = p_user_id;
end;
$function$;

-- Backfill accounts already approved through this RPC before the fix, which
-- were stuck is_active=false despite showing "approved" in the admin panel.
update public.profiles
set is_active = true
where approval_status = 'approved'
  and is_active = false
  and approved_by is not null;
