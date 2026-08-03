-- F4: anon SELECT *and* UPDATE on workshop_jobs were gated only by
-- length(share_token) > 10 -- no format/entropy requirement -- so a short or
-- guessable token could read customer PII and tamper with job status/price.
-- share_token defaults to gen_random_uuid()::text, so require the full UUID
-- format (mirrors the loan share-token pattern) and drop the anon write path
-- entirely (no customer flow updates a job row directly; approvals belong behind
-- an RPC if ever needed).

drop policy if exists public_update_job_by_token on workshop_jobs;
drop policy if exists public_read_job_by_token on workshop_jobs;

create policy public_read_job_by_token on workshop_jobs
  for select to anon
  using (
    share_token is not null
    and share_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- Least privilege: anon only ever needs token-scoped SELECT here.
revoke insert, update on workshop_jobs from anon;
