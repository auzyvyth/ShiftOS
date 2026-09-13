-- Unverified contact email for guest buyers who want a "seller replied" notice.
-- Deliberately separate from profiles.email (which is only ever set by the
-- verified auth email-change flow, sync_identity_from_auth_user). Never use
-- this column for lead de-dup or account merging — it is not proven to belong
-- to whoever typed it, only good enough to notify.
alter table public.profiles add column if not exists notify_email text;
