-- Add missing columns to profiles for onboarding flow
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ic text,
  ADD COLUMN IF NOT EXISTS ic_submitted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ic_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS selected_plan text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS ssm_number text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

-- RLS: allow a user to upsert their own profile row (needed for onboarding)
DROP POLICY IF EXISTS "Users can upsert own profile" ON public.profiles;
CREATE POLICY "Users can upsert own profile"
  ON public.profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS: allow insert of own profile (covers initial signUp upsert)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Make sure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
