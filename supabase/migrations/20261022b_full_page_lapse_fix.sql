-- A lapsed Premium seller kept the full page, unlimited loan posters and
-- Telegram booking reminders (found testing a lapse, 2026-10-22).
--
-- salesman_has_full_page() ended in `or p.payment_status = 'received'`. Every
-- standalone seller has payment_status NULL since 20261019a, so for an expired
-- date the test was `false or NULL` = NULL, and the outer
-- `coalesce(..., true)` (meant for "no such salesman row") turned that NULL
-- into TRUE. The panel was right (is_salesman_premium() uses WHERE, where NULL
-- counts as false), so the seller saw Lite while buyers still saw the
-- Premium page.
-- Same signature, so a plain replace: callers (get_salesman_by_slug/_by_id,
-- claim_loan_poster, trg_zz_lite_no_booking_reminder, 20261021b) need no edit.

create or replace function public.salesman_has_full_page(p_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce((
      select p.dealer_id is not null
          or (p.plan::text = 'salesman_full'
              and coalesce(p.is_active, true)
              and (coalesce(p.plan_expires_at > now(), false)
                   or coalesce(p.payment_status = 'received', false)))
        from profiles p
       where p.id = p_id and p.role = 'salesman'
  ), true);
$function$;

revoke all on function public.salesman_has_full_page(uuid) from public, anon, authenticated;
