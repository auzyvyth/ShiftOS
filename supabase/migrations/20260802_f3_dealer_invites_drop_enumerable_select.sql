-- F3: dealer_invites_public_select_by_code was NOT filtered to a supplied code —
-- it returned EVERY unused, unexpired invite (code, email, invited_name,
-- dealer_id) to anyone. Replace with an exact-code redeem RPC that returns only
-- the dealer_id the redemption flow needs.

create or replace function public.redeem_invite(p_code text)
returns table (dealer_id uuid)
language sql stable security definer set search_path to 'public'
as $$
  select dealer_id from dealer_invites
  where code = upper(btrim(p_code))
    and used = false
    and expires_at > now()
  limit 1;
$$;
grant execute on function public.redeem_invite(text) to authenticated;

-- Remove the enumerable public SELECT policy. Dealers still manage their own
-- invites via dealer_invites_owner_all (authenticated); use_dealer_invite
-- (SECURITY DEFINER) keeps working as it bypasses RLS for its own lookup.
drop policy if exists dealer_invites_public_select_by_code on dealer_invites;

-- Least privilege: anon has no business reading, creating, or updating invites
-- (creation is server-side via service role; redemption is authenticated).
revoke select, insert, update on dealer_invites from anon;
