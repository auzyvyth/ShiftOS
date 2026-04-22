-- Migration: add_plan_column_to_profiles
-- Adds account_plan enum + plan column, backfills existing rows,
-- and updates handle_new_user trigger to carry plan through auth metadata.

-- Step 1: Create enum (idempotent)
DO $$ BEGIN
  CREATE TYPE account_plan AS ENUM (
    'dealer_full',
    'salesman_full',
    'salesman_lite',
    'superadmin'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Add column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan account_plan;

-- Step 3: Backfill existing rows
UPDATE public.profiles
SET plan = CASE
  WHEN role = 'superadmin'                                     THEN 'superadmin'::account_plan
  WHEN role = 'dealer'                                         THEN 'dealer_full'::account_plan
  WHEN role IN ('owner','admin') AND dealer_id IS NULL         THEN 'dealer_full'::account_plan
  WHEN role = 'salesman' AND dealer_id IS NOT NULL             THEN 'salesman_full'::account_plan
  WHEN role = 'salesman' AND dealer_id IS NULL                 THEN 'salesman_lite'::account_plan
  ELSE NULL
END
WHERE plan IS NULL;

-- Step 4: Update handle_new_user trigger to read plan from user_metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, plan, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'dealer'),
    (NEW.raw_user_meta_data->>'plan')::account_plan,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
