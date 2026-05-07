ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ic_number      text,
  ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active';

-- Existing salesman_lite accounts are already live — keep them active
UPDATE profiles
  SET account_status = 'active'
  WHERE role = 'salesman'
    AND plan = 'salesman_lite'
    AND account_status IS NULL;

-- New signups will land on the signup trigger; set default for any future inserts
-- to 'pending' via application logic (see SalesmanLite boot check)
