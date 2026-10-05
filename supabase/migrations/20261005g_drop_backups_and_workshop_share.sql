-- SEC-4 + SEC-2b, owner-approved 2026-10-06.
-- SEC-4: _bk_airy_* were ad-hoc backup copies of one seller's data (leads,
-- customers, WhatsApp enquiries, appointments...) -- real buyer names and phones
-- kept with no purpose and no retention date (PDPA). Nothing references them:
-- no view, function, client or edge function.
drop table if exists public._bk_airy_analytics, public._bk_airy_appointments,
  public._bk_airy_cars, public._bk_airy_customers, public._bk_airy_lead_activities,
  public._bk_airy_leads, public._bk_airy_notifs, public._bk_airy_wa;

-- SEC-2b: a share-token policy that only checked the token's SHAPE, i.e. it
-- matched every row with any token, for anon. 0 rows today; would have
-- published customer_name + customer_phone. No client reads workshop_jobs.
drop policy if exists public_read_job_by_token on public.workshop_jobs;
