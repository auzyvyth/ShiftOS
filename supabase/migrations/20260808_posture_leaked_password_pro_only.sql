-- Leaked-password protection is a Supabase Pro-plan feature; on the Hobby plan it
-- is unavailable, so stop showing it as an actionable to-do.
UPDATE public.security_posture
   SET status='unknown', value='Pro plan only',
       detail='Supabase leaked-password protection (HaveIBeenPwned) requires the Pro plan; not available on the current Hobby plan. Revisit when upgrading.',
       updated_at=now()
 WHERE key='leaked_password_protection';
