-- MOBILE-7 prerequisite: buyer self-service account deletion is coming, and
-- most buyers are anonymous-upgraded guests. chat_threads.buyer_id and
-- chat_messages.sender_id both CASCADE off auth.users today, so the 30-day
-- purge (purge-deleted-accounts) hard-deleting the buyer's auth user would
-- silently wipe the SELLER's own copy of every conversation with them too —
-- the exact landmine already documented in CLAUDE.md under "Deleting an
-- anonymous user deletes the conversation (latent, do not trip it)".
--
-- Fix: the buyer leaving no longer erases the thread. buyer_label (a snapshot
-- taken once by start_chat_thread) and sender_role (independent of sender_id,
-- checked in pg_policy already) are what the seller's UI actually renders, so
-- nulling the id columns changes nothing visible on the seller side.
-- chat_thread_role() only ever compares buyer_id = auth.uid(); a NULL never
-- matches any uid, so this cannot grant buyer access to anyone.

alter table public.chat_threads alter column buyer_id drop not null;
alter table public.chat_messages alter column sender_id drop not null;

alter table public.chat_threads
  drop constraint chat_threads_buyer_id_fkey,
  add constraint chat_threads_buyer_id_fkey
    foreign key (buyer_id) references auth.users(id) on delete set null;

alter table public.chat_messages
  drop constraint chat_messages_sender_id_fkey,
  add constraint chat_messages_sender_id_fkey
    foreign key (sender_id) references auth.users(id) on delete set null;
