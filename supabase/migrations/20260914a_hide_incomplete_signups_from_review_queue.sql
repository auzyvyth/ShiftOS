-- Abandoned signups (e.g. "Continue with Google" clicked, then the onboarding
-- form never finished) were showing up in the platform Review queue with a
-- blank dealership and no plan, looking like a real pending applicant. The
-- notify_admin_on_new_signup trigger already only fires on the
-- onboarding_complete false->true transition, so an incomplete signup never
-- alerted anyone — the queue disagreed with that by showing it anyway.
-- Scoped to get_pending_approvals() only: get_pending_kyc() (already-approved
-- sellers submitting ID) and listing approval (car_listings, a different
-- table/RPC entirely) are untouched.
CREATE OR REPLACE FUNCTION public.get_pending_approvals()
 RETURNS TABLE(id uuid, full_name text, email text, phone text, ic_last4 text, role text, plan text, dealership text, avatar_url text, created_at timestamp with time zone, kyc_tier text, kyc_submitted_at timestamp with time zone, has_docs boolean, front_path text, back_path text, selfie_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.is_superadmin() then raise exception 'not_authorized'; end if;
  return query
    select p.id, p.full_name, p.email, p.phone, p.ic_last4,
           p.role, p.plan::text, p.dealership, p.avatar_url, p.created_at,
           coalesce(k.tier, p.kyc_tier), coalesce(k.submitted_at, p.kyc_submitted_at),
           (k.user_id is not null) as has_docs,
           k.front_path, k.back_path, k.selfie_path
    from public.profiles p
    left join public.kyc_documents k on k.user_id = p.id
    where p.approval_status = 'pending'
      and p.role in ('dealer','salesman')
      and p.onboarding_complete = true
    order by coalesce(k.submitted_at, p.created_at) asc;
end;
$function$;
