-- CRITICAL: unauthenticated write access to every shared loan application.
--
-- Policy `loan_share_token_update` granted the anon role UPDATE on
-- loan_applications with this USING clause:
--
--   share_token IS NOT NULL
--   AND length(share_token) >= 32
--   AND share_token ~ '^[0-9a-f]{8}-...-[0-9a-f]{12}$'
--
-- That is a row FILTER, not an ownership check: it never compares share_token
-- against a value the caller had to know. Any anonymous PATCH to
-- /rest/v1/loan_applications therefore matched every row whose token happened
-- to be UUID-shaped - which was every shared application, since
-- ensure_loan_share_token leaves a pre-existing UUID token in place (36 >= 32).
-- Verified against production: an anon UPDATE affected 2 of 2 rows.
--
-- Blind writes were the smaller half. Because WITH CHECK also allowed the new
-- row to carry any UUID-shaped share_token, an attacker could set the token to
-- a value of their choosing and then read the row back through get_loan_share -
-- turning a write primitive into a full read of buyer name, phone, car,
-- financing figures and document state for every dealer on the platform.
--
-- Nothing needs it. The buyer's page never writes; it reads through
-- get_loan_share, which is SECURITY DEFINER and so does not rely on the anon
-- grant either. Minting a token is ensure_loan_share_token, authenticated and
-- owner-scoped. So the policy goes, and anon loses the table grants with it -
-- the remaining policies (owner, team, salesman) all key on auth.uid(), which
-- is null for anon, but a grant anon has no use for should not be sitting there
-- waiting for the next policy that forgets to check who is calling.

drop policy if exists loan_share_token_update on public.loan_applications;

revoke select, insert, update, delete on public.loan_applications from anon;
