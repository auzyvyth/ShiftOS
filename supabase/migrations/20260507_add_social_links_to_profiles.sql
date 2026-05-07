ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS instagram  text,
  ADD COLUMN IF NOT EXISTS tiktok     text,
  ADD COLUMN IF NOT EXISTS facebook   text,
  ADD COLUMN IF NOT EXISTS website    text;
