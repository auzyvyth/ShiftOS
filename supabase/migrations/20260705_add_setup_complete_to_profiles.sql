-- Tracks whether a dealer-created salesman has finished the /salesman-setup
-- two-step onboarding (password + WhatsApp/IC/PDPA). create-salesman leaves it
-- false; SalesmanSetup.finish() flips it true. The dealer Team tab shows a
-- "pending setup" state with a resend-email button until it is true.
alter table profiles add column if not exists setup_complete boolean not null default false;

-- Backfill: every profile that already exists at deploy time is treated as set
-- up (this gate only applies to accounts created from now on). Only rows
-- inserted AFTER this migration default to false and surface as pending.
update profiles set setup_complete = true where setup_complete = false;
