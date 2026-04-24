CREATE OR REPLACE FUNCTION public.use_dealer_invite(invite_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.dealer_invites
  SET used = true
  WHERE code = invite_code AND used = false AND expires_at > now();
END;
$$;
