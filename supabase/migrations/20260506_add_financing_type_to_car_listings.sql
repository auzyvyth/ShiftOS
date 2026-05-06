ALTER TABLE car_listings
  ADD COLUMN IF NOT EXISTS financing_type text
  CHECK (financing_type IN ('cash', 'loan', 'sambung_bayar'));
