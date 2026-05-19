-- Add form_layout column to profiles for per-user CarForm section order
alter table profiles
  add column if not exists form_layout jsonb default null;
