-- Drop the dead profiles.ic_submitted column.
--
-- ic_submitted was never wired up: the only IC write path (set_my_ic) sets
-- ic_hash / ic_last4 / ic_verified_at and clears ic_number, but never touches
-- ic_submitted, and no trigger, policy or view references it. The superadmin
-- listing-approval queue used to read it and therefore showed every seller who
-- had actually verified their IC as "not submitted". The panel now reads the
-- real signal (ic_verified_at) instead, so the column is fully unreferenced.
--
-- SEQUENCING: run this ONLY after the AdminPage change that stops selecting
-- ic_submitted (branch claude/site-audit-account-issues-944rtf) is live in
-- production. If the column is dropped while prod still selects it, the
-- PostgREST nested select in the approval queue will error.

ALTER TABLE public.profiles DROP COLUMN IF EXISTS ic_submitted;
