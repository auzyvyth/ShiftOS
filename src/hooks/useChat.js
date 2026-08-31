import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';

// In-app buyer <-> seller chat.
//
// Sensitive text is NOT masked here. The server already stored two versions of
// every message — `body` (raw) and `body_ai` (phone numbers, IC numbers and
// emails replaced). The UI renders body_ai by default and swaps to body when
// the reader taps. That keeps one redaction rule, in the database, instead of a
// second copy in JS that would drift out of sync with it.

// Ticks, WhatsApp-style: one for sent, two for delivered, two coloured for read.
export function tickState(msg) {
  if (msg.read_at) return 'read';
  if (msg.delivered_at) return 'delivered';
  if (msg.pending) return 'sending';
  return 'sent';
}

// Live messages for one thread, plus sending and receipts.
// role is 'buyer' or 'seller' — it decides which bubbles are mine.
export function useChatThread(threadId, role) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState(null);
  const channelRef = useRef(null);

  const load = useCallback(async () => {
    if (!threadId) { setMessages([]); return; }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('chat_messages')
      .select('id, thread_id, sender_role, sender_id, body, body_ai, has_sensitive, created_at, delivered_at, read_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (err) { console.error('useChatThread load:', err); setError(err.message); setLoading(false); return; }
    setMessages(data || []);
    setError(null);
    setLoading(false);
  }, [threadId]);

  useEffect(() => { load(); }, [load]);

  // Realtime. INSERT appends; UPDATE carries the delivery/read stamps back to
  // the sender so their ticks change without a refetch.
  useEffect(() => {
    if (!threadId) return;
    const ch = supabase
      .channel(`chat:${threadId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        ({ new: row }) => {
          setMessages(prev => {
            // Replace my own optimistic copy rather than showing it twice.
            const optimistic = prev.findIndex(m => m.pending && m.body === row.body);
            if (optimistic !== -1) {
              const next = [...prev];
              next[optimistic] = row;
              return next;
            }
            if (prev.some(m => m.id === row.id)) return prev;
            return [...prev, row];
          });
          // Their message reached my screen — that is what the second tick means.
          if (row.sender_role !== role) {
            supabase.rpc('mark_chat_delivered', { p_thread_id: threadId }).then(null, () => {});
          }
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        ({ new: row }) => setMessages(prev => prev.map(m => (m.id === row.id ? { ...m, ...row } : m))))
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); channelRef.current = null; };
  }, [threadId, role]);

  const send = useCallback(async (text) => {
    const body = (text || '').trim();
    if (!body || !threadId || sending) return { ok: false };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    setSending(true);
    // Optimistic bubble so the input clears instantly; realtime swaps in the
    // real row a moment later.
    const temp = {
      id: `temp-${Date.now()}`, thread_id: threadId, sender_role: role,
      sender_id: user.id, body, body_ai: body, has_sensitive: false,
      created_at: new Date().toISOString(), delivered_at: null, read_at: null,
      pending: true,
    };
    setMessages(prev => [...prev, temp]);

    const { error: err } = await supabase.from('chat_messages').insert({
      thread_id: threadId, sender_role: role, sender_id: user.id, body,
    });
    setSending(false);
    if (err) {
      console.error('chat send:', err);
      setMessages(prev => prev.map(m => (m.id === temp.id ? { ...m, failed: true, pending: false } : m)));
      // 23514 is the rate-limit check tripping — say so plainly rather than
      // leaving a message sitting there looking sent.
      return { ok: false, rateLimited: err.code === '23514' || /rate/i.test(err.message || '') };
    }
    return { ok: true };
  }, [threadId, role, sending]);

  const markRead = useCallback(() => {
    if (!threadId) return;
    supabase.rpc('mark_chat_read', { p_thread_id: threadId }).then(null, () => {});
  }, [threadId]);

  return { messages, loading, sending, error, send, markRead, reload: load };
}

// Seller inbox: every thread for this salesman (or the whole dealership when
// no salesmanId is given), newest activity first.
export function useChatThreads({ salesmanId = null, dealerId = null }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  // The inbox hook gets mounted more than once (the nav badge and the inbox
  // itself). Two realtime channels sharing a topic name collide, so give each
  // instance its own.
  const instanceRef = useRef(Math.random().toString(36).slice(2, 9));

  const load = useCallback(async () => {
    if (!salesmanId && !dealerId) { setThreads([]); setLoading(false); return; }
    let q = supabase
      .from('chat_threads')
      .select('id, listing_id, buyer_label, buyer_is_anon, buyer_id, status, created_at, last_message_at, last_sender_role, seller_unread, lead_id, listing:listing_id(brand, model, year, selling_price, images), lead:lead_id(id, stage)')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200);
    q = salesmanId ? q.eq('salesman_id', salesmanId) : q.eq('dealer_id', dealerId);
    const { data, error } = await q;
    if (error) { console.error('useChatThreads:', error); setLoading(false); return; }
    setThreads(data || []);
    setLoading(false);
  }, [salesmanId, dealerId]);

  useEffect(() => { load(); }, [load]);

  // Any thread row changing (new message bumps last_message_at and the unread
  // count) re-sorts the list, so the inbox stays live without polling.
  useEffect(() => {
    if (!salesmanId && !dealerId) return;
    const ch = supabase
      .channel(`chat-inbox:${salesmanId || dealerId}:${instanceRef.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [salesmanId, dealerId, load]);

  const totalUnread = threads.reduce((n, t) => n + (t.seller_unread || 0), 0);
  return { threads, loading, totalUnread, reload: load };
}

// Buyer side: find or open this buyer's thread for one car. Signs the buyer in
// anonymously if they have no session, so a shopper can chat without making an
// account. Supabase keeps the same user id if they register later, so the
// history carries over.
export function useBuyerThread(listingId, { autoStart = false, active = true } = {}) {
  const [threadId, setThreadId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [needsAnon, setNeedsAnon] = useState(false);
  const checkedRef = useRef(false);

  const start = useCallback(async () => {
    if (!listingId || starting) return null;
    setStarting(true);
    try {
      let { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          // Anonymous sign-ins are a project-level toggle. If it's off, say so
          // rather than failing silently on the buyer.
          console.error('anonymous sign-in:', error);
          setNeedsAnon(true);
          return null;
        }
        user = data.user;
      }
      const { data: id, error: rpcErr } = await supabase.rpc('start_chat_thread', { p_listing_id: listingId });
      if (rpcErr) { console.error('start_chat_thread:', rpcErr); return null; }
      setThreadId(id);
      return id;
    } finally {
      setStarting(false);
    }
  }, [listingId, starting]);

  // Reattach to an existing thread — deferred until `active` (the Contact
  // sheet is actually open) and run at most once per mount. This used to
  // fire unconditionally the moment CarDetailPage rendered: an
  // `auth.getUser()` plus a `chat_threads` query on every single car-detail
  // page view for anyone with a session, whether or not they ever opened
  // Contact — new network work on the site's highest-traffic page that
  // didn't exist before BuyerChat shipped.
  useEffect(() => {
    if (!active || checkedRef.current) return;
    checkedRef.current = true;
    let cancelled = false;
    (async () => {
      if (!listingId) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('listing_id', listingId)
        .eq('buyer_id', user.id)
        .maybeSingle();
      if (!cancelled && data?.id) setThreadId(data.id);
      else if (!cancelled && autoStart) start();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, active]);

  return { threadId, start, starting, needsAnon };
}

// Buyer inbox: every conversation this buyer has started, newest first.
//
// This CANNOT be a plain table query. A buyer can read their own chat_threads
// rows, but RLS on `profiles` blocks them from reading the seller's name and
// photo, so the card has nothing to show. `get_my_chat_threads()` is a
// SECURITY DEFINER function that assembles the whole card server-side, scoped
// to buyer_id = auth.uid().
export function useBuyerThreads() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId]   = useState(null);
  const instanceRef = useRef(Math.random().toString(36).slice(2, 9));

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setThreads([]); setUserId(null); setLoading(false); return; }
    setUserId(user.id);
    const { data, error } = await supabase.rpc('get_my_chat_threads');
    // Surface the failure — an empty inbox and a broken call look identical to
    // the buyer otherwise.
    if (error) { console.error('useBuyerThreads:', error); setLoading(false); return; }
    setThreads(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // A new message bumps last_message_at and buyer_unread on the thread row, so
  // watching chat_threads keeps the list live without polling.
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`buyer-inbox:${userId}:${instanceRef.current}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chat_threads', filter: `buyer_id=eq.${userId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  const totalUnread = threads.reduce((n, t) => n + (t.buyer_unread || 0), 0);
  return { threads, loading, totalUnread, reload: load };
}
