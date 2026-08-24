-- The AI's only window onto a conversation. `body` is not a column here, so a
-- bug (or a careless `select *`) in any AI path physically cannot pull a raw
-- phone number, IC or email out of the database. security_invoker keeps the
-- caller's RLS: you still only see threads you are a participant in.
--
-- The chat-assist edge function reads THIS view. Do not point it at
-- chat_messages.
create or replace view public.chat_messages_ai
with (security_invoker = true) as
  select id, thread_id, sender_role, body_ai, has_sensitive, created_at
    from public.chat_messages;

comment on view public.chat_messages_ai is
  'Redacted read model for AI features. Deliberately omits chat_messages.body. Any AI path must read this view, never the base table.';

grant select on public.chat_messages_ai to authenticated;
