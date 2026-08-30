import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageSquare } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import ChatThread, { THEMES } from './ChatThread';
import useVisualViewport from '../../hooks/useVisualViewport';

// One in-app conversation, opened over whatever surface you are already on.
//
// Why a sheet and not a link to the Inbox tab: the seller inbox is an embedded
// TAB inside SalesmanLite / SalesmanPremium, not a route, and the dealer
// dashboard has no inbox at all. A "go to the inbox" link would need a
// different implementation on every surface and would still be impossible on
// the dealer side. This renders the same thread anywhere a lead is shown.
//
// A dealer CAN read and reply here: chat_thread_role() returns 'seller' for the
// thread's salesman AND for anyone whose get_my_dealer_id() matches the
// thread's dealer_id, so RLS on chat_threads/chat_messages already allows it.

export default function ChatSheet({
  leadId = null,
  threadId: threadIdProp = null,
  buyerName = 'Buyer',
  carLabel = null,
  theme = 'light',
  aiAssist = false,
  aiUpgrade = false,
  upgradeHref = '/choose-plan',
  onClose,
}) {
  // Size to the area the keyboard leaves behind, not to `vh` — see
  // useVisualViewport. Without this the composer sits under the keyboard and
  // the browser scrolls the whole sheet up to reach it.
  const vv = useVisualViewport();
  const [threadId, setThreadId] = useState(threadIdProp);
  // loading | ready | none | error — 'none' and 'error' look identical to the
  // seller otherwise, and "no conversation" on a lead that has one is the kind
  // of empty state that makes someone think a buyer vanished.
  const [state, setState] = useState(threadIdProp ? 'ready' : 'loading');
  const t = THEMES[theme] || THEMES.light;

  // chat_threads.lead_id is the link the DB trigger writes when a buyer's first
  // message creates the lead, so the lookup is one indexed read.
  useEffect(() => {
    if (threadIdProp) { setThreadId(threadIdProp); setState('ready'); return; }
    if (!leadId) { setState('none'); return; }
    let cancelled = false;
    (async () => {
      // lead_id is NOT unique on chat_threads: a buyer who chats about a second
      // car gets a second thread that dedups onto the same lead. Open the live
      // one — maybeSingle() would throw PGRST116 the moment that happens.
      const { data, error } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('lead_id', leadId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(1);
      if (cancelled) return;
      if (error) { console.error('ChatSheet thread lookup:', error); setState('error'); return; }
      if (!data?.length) { setState('none'); return; }
      setThreadId(data[0].id);
      setState('ready');
    })();
    return () => { cancelled = true; };
  }, [leadId, threadIdProp]);

  // Overlay rule 2 — lock the page behind the sheet. Restore whatever was
  // there rather than '', because this can open on top of a drawer that set it.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const closeBtn = (
    <button onClick={onClose} aria-label="Close conversation"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: 'transparent', border: `1px solid ${t.border}`, color: t.sub, cursor: 'pointer' }}>
      <X size={14} />
    </button>
  );

  const message = (title, body) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.bg, borderRadius: 14, overflow: 'hidden', border: `1px solid ${t.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: `1px solid ${t.border}`, background: t.panel, flexShrink: 0 }}>
        <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{buyerName}</p>
        {closeBtn}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '32px 24px', textAlign: 'center' }}>
        <MessageSquare size={26} style={{ color: t.sub, opacity: 0.5, marginBottom: 4 }} />
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: t.text }}>{title}</p>
        <p style={{ margin: 0, fontSize: 12.5, color: t.sub, lineHeight: 1.6, maxWidth: 300 }}>{body}</p>
      </div>
    </div>
  );

  return createPortal(
    <>
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
      {/* Pinned to the VISUAL viewport (top/height from useVisualViewport)
          rather than `inset:0`, so when the keyboard opens this box shrinks to
          the space above it and the sheet inside it never goes underneath. */}
      <div style={{ position: 'fixed', top: vv.offsetTop, left: 0, right: 0, height: vv.height, zIndex: 2001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, pointerEvents: 'none' }}>
        <div style={{ width: '100%', maxWidth: 520, height: 'min(640px, 100%)', pointerEvents: 'auto', fontFamily: 'system-ui, sans-serif' }}>
          {state === 'loading' && message('Opening the conversation…', 'One moment.')}
          {state === 'none' && message(
            'No in-app conversation',
            'This buyer has not messaged you inside ShiftOS. Reach them on WhatsApp or by phone instead.',
          )}
          {state === 'error' && message(
            'Could not open the conversation',
            'Something went wrong loading this chat. Close this and try again.',
          )}
          {state === 'ready' && threadId && (
            <ChatThread
              threadId={threadId}
              role="seller"
              theme={theme}
              height="100%"
              // This sheet's container is already sized to the visual viewport,
              // so the composer is above the keyboard by construction.
              viewportPinned
              aiAssist={aiAssist}
              aiUpgrade={aiUpgrade}
              upgradeHref={upgradeHref}
              headerName={buyerName}
              headerSub={carLabel}
              headerRight={closeBtn}
            />
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
