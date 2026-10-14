-- Lite cap back to 10 (owner, 2026-10-14: "5 is a little too kedekut").
-- The rest of 20261014a (basic page, no Telegram reminders on Lite) stays.
-- Data only, no DDL. Applied live 2026-10-14.
update public.plan_config set listing_cap = 10 where plan = 'salesman_lite';
