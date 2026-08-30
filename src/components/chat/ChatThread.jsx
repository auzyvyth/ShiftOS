import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Check, CheckCheck, Send, AlertCircle, Eye, ShieldAlert, Sparkles, X, Lock } from 'lucide-react';
import { useChatThread, tickState } from '../../hooks/useChat';
import BuyerPushPrompt from './BuyerPushPrompt';
import { supabase } from '../../supabaseClient';
import useVisualViewport from '../../hooks/useVisualViewport';
import { AI_FEATURES_ENABLED } from '../../utils/aiFeatureFlag';

// One conversation. Shared by the buyer widget (dark, on the marketplace) and
// the seller inbox (light, in the panel), so ticks, masking and the send box
// behave identically on both sides.
//
// Masking note: we never re-implement the redaction rule in JS. The server
// stored `body_ai` with numbers already replaced; this renders that, and swaps
// to `body` only when the reader taps. One rule, in the database.

export const THEMES = {
  light: {
    bg: '#fff', panel: '#f9fafb', border: '#e5e7eb', text: '#111827',
    sub: '#6b7280', mine: '#dc2626', mineText: '#fff',
    theirs: '#f3f4f6', theirsText: '#111827', inputBg: '#fff',
  },
  dark: {
    bg: '#0f1420', panel: '#141b2b', border: 'rgba(255,255,255,0.10)', text: '#f3f4f6',
    sub: 'rgba(255,255,255,0.55)', mine: '#dc2626', mineText: '#fff',
    theirs: 'rgba(255,255,255,0.07)', theirsText: '#f3f4f6', inputBg: 'rgba(255,255,255,0.05)',
  },
};

const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', hour12: true });

// Splits redacted text so each [number hidden] / [contact hidden] placeholder
// renders as a tappable chip instead of dead literal text.
function RedactedBody({ text, onReveal, t }) {
  const parts = String(text).split(/(\[(?:number|contact) hidden\])/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\[(number|contact) hidden\]$/.test(part) ? (
          <button key={i} onClick={onReveal}
            style={{ display:'inline-flex', alignItems:'center', gap:4, margin:'0 2px', padding:'1px 7px', borderRadius:5, border:`1px dashed ${t.border}`, background:'rgba(127,127,127,0.14)', color:'inherit', font:'inherit', fontSize:'0.92em', cursor:'pointer', verticalAlign:'baseline' }}>
            <Eye size={11} /> tap to show
          </button>
        ) : (
          <span key={i}>{part}</span>
        ))}
    </>
  );
}

function Bubble({ msg, mine, t }) {
  const [revealed, setRevealed] = useState(false);
  const state = tickState(msg);
  const hidden = msg.has_sensitive && !revealed;

  return (
    <div style={{ display:'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom:8 }}>
      <div style={{ maxWidth:'78%', minWidth:0 }}>
        <div style={{
          background: mine ? t.mine : t.theirs,
          color: mine ? t.mineText : t.theirsText,
          borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          padding:'9px 13px', fontSize:14, lineHeight:1.55,
          wordBreak:'break-word', whiteSpace:'pre-wrap',
          opacity: msg.pending ? 0.65 : 1,
        }}>
          {hidden
            ? <RedactedBody text={msg.body_ai} onReveal={() => setRevealed(true)} t={t} />
            : msg.body}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5, justifyContent: mine ? 'flex-end' : 'flex-start', marginTop:3, padding:'0 3px' }}>
          <span style={{ fontSize:10.5, color:t.sub }}>{fmtTime(msg.created_at)}</span>
          {msg.failed && (
            <span style={{ fontSize:10.5, color:'#f87171', display:'inline-flex', alignItems:'center', gap:3 }}>
              <AlertCircle size={11} /> not sent
            </span>
          )}
          {mine && !msg.failed && (
            state === 'sending' ? <span style={{ fontSize:10.5, color:t.sub }}>·</span>
            : state === 'sent'  ? <Check size={13} style={{ color:t.sub }} />
            : <CheckCheck size={13} style={{ color: state === 'read' ? '#38bdf8' : t.sub }} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatThread({
  threadId, role, theme = 'light', headerName, headerSub, headerRight = null,
  showPrivacyNote = false, height = 460, aiAssist = false, bare = false,
  // /choose-plan is the real salesman plan picker. NOT '/upgrade' — that path
  // has no route and falls through to NotFoundPage.
  aiUpgrade = false, upgradeHref = '/choose-plan',
  // Set by a parent whose own fixed container is already sized to the visual
  // viewport (ChatSheet, BuyerChat) — their composer is above the keyboard by
  // construction, so this component must not pin it a second time.
  viewportPinned = false,
}) {
  const t = THEMES[theme] || THEMES.light;
  const { messages, loading, sending, send, markRead } = useChatThread(threadId, role);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState(null);
  const [askText, setAskText] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const formRef = useRef(null);
  const vv = useVisualViewport();
  const [kbFocused, setKbFocused] = useState(false);
  const [composerH, setComposerH] = useState(0);

  // Keyboard handling, the way every real chat app does it: the composer sits
  // ON TOP of the keyboard and nothing else moves.
  //
  // What was here before called inputRef.scrollIntoView() on focus and again on
  // every visual-viewport change. scrollIntoView walks every scrollable
  // ANCESTOR — including the page body — so the browser scrolled the whole page
  // to reach the input and the entire chat box visibly flew upward. That is the
  // "the whole chatbox goes up when the keyboard opens" bug. The message list
  // below already learned this exact lesson and sets scrollTop directly instead;
  // the composer kept the old approach.
  //
  // ChatSheet and BuyerChat size their own fixed container off the visual
  // viewport, so their composer already lands above the keyboard — they pass
  // viewportPinned and opt out. Every other surface renders this thread in the
  // normal page flow at a fixed pixel height (SellerInbox 540, BuyerInbox 480),
  // where the box has no way to know where the keyboard is. There, the composer
  // pins itself to the bottom of the visible area for as long as it has focus.
  //
  // window.innerHeight is the LAYOUT viewport and does not shrink for the
  // keyboard, so the difference between the two is the keyboard itself.
  const kbHeight = typeof window === 'undefined'
    ? 0
    : Math.max(0, window.innerHeight - vv.height);
  // A keyboard takes a big slice of the screen. The small deltas are the URL bar
  // collapsing on scroll, which must not move the composer.
  // composerH > 0 guards the first frame: without a measurement the fixed
  // offset would put the bar exactly at the bottom edge, i.e. off-screen.
  const pinned = !viewportPinned && kbFocused && composerH > 0 && kbHeight > 120;

  // Measured while the composer is still in flow, because once it goes fixed its
  // offsetHeight is the same but its slot is gone — the number is needed both
  // for the fixed offset and for the spacer that keeps the box from collapsing.
  const focusComposer = () => {
    if (formRef.current) setComposerH(formRef.current.offsetHeight);
    setKbFocused(true);
  };

  // The composer GROWS with the message instead of hiding it.
  //
  // It was a single-line <input>, so anything past about thirty characters
  // scrolled out of sight to the left. A seller writing a real pitch — specs,
  // financing, condition notes — could not reread what they had written or spot
  // a typo before sending. Every chat app people actually use grows the field
  // and caps it; this does the same.
  //
  // Height is measured, not guessed: reset to 'auto' first so scrollHeight
  // reports the CONTENT height rather than the height we last set (without the
  // reset the box can only ever grow, never shrink back when text is deleted).
  // Past the cap it scrolls, so a 300-word message stays readable in a box that
  // never eats the conversation above it.
  const MAX_COMPOSER_H = 140;
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // box-sizing is border-box, so `height` has to cover the border too, but
    // scrollHeight counts only content + padding. Adding the 2px back stops the
    // field from being permanently one hair too short and showing a scrollbar
    // on a single line of text.
    const borders = el.offsetHeight - el.clientHeight;
    const needed = el.scrollHeight + borders;
    el.style.height = `${Math.min(needed, MAX_COMPOSER_H)}px`;
    el.style.overflowY = needed > MAX_COMPOSER_H ? 'auto' : 'hidden';
    // The pinned composer is positioned off its own height (top = bottom edge
    // minus composerH) and the spacer below reserves exactly that much. Growing
    // without re-measuring would slide the box down behind the keyboard, one
    // line at a time. Same value is a no-op re-render, so this cannot loop.
    if (formRef.current) setComposerH(formRef.current.offsetHeight);
  }, [draft]);

  // Enter sends on a desktop keyboard; on a phone Enter is the return key and
  // must insert a newline, or a multi-line message becomes impossible to type.
  // Shift+Enter is always a newline. `(hover: hover) and (pointer: fine)` is the
  // capability test for a real mouse+keyboard, not a width breakpoint — a small
  // laptop window is still a desktop.
  const onComposerKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const hasKeyboard = typeof window !== 'undefined'
      && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    if (!hasKeyboard) return;
    e.preventDefault();
    submit();
  };

  // Keep the newest message in view as the keyboard opens and closes. scrollTop
  // on this one container only — never scrollIntoView, see above.
  // composerH is in here because a growing composer eats the list's height in
  // the flow layouts (SellerInbox, BuyerInbox) — without it the newest message
  // slides out of sight behind the box as the seller types a long one.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [pinned, vv.height, composerH]);

  // The AI never sees a raw phone number: chat-assist fetches the transcript
  // itself from the redacted `chat_messages_ai` view. We send only a thread id.
  const callAssist = async (mode, question) => {
    if (aiLoading || !threadId) return;
    setAiLoading(true);
    setAiAnswer(null);
    try {
      const { data, error } = await supabase.functions.invoke('chat-assist', {
        body: { thread_id: threadId, mode, question },
      });
      if (error || data?.error) {
        setNotice(data?.error || 'AI unavailable right now');
        setTimeout(() => setNotice(null), 4000);
        return;
      }
      if (mode === 'suggest') setDraft(data.reply);
      else setAiAnswer(data.reply);
      setAskText('');
    } finally {
      setAiLoading(false);
    }
  };

  // Opening the thread, and every message that lands while it is open, counts
  // as read.
  useEffect(() => { if (threadId) markRead(); }, [threadId, messages.length, markRead]);
  // Bottom-pin the message list itself. scrollIntoView() on a bottom marker
  // walks every scrollable ANCESTOR into view too — including the page body
  // this sits inside on /account — so a short early conversation kept yanking
  // the whole page down to bring the (already-visible) marker into view.
  // Setting scrollTop directly touches only this one container.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = async (e) => {
    e?.preventDefault();
    const text = draft;
    if (!text.trim()) return;
    setDraft('');
    const res = await send(text);
    if (!res.ok) {
      setNotice(res.rateLimited
        ? 'Slow down a moment — too many messages at once.'
        : 'Message not sent. Check your connection and try again.');
      setDraft(text);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  return (
    // `bare` drops this component's own border + radius so it can sit flush
    // inside a container that already draws them (the buyer inbox card).
    <div style={{ display:'flex', flexDirection:'column', height, background:t.bg, border: bare ? 'none' : `1px solid ${t.border}`, borderRadius: bare ? 0 : 14, overflow:'hidden', fontFamily:"system-ui,sans-serif" }}>
      {headerName && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', borderBottom:`1px solid ${t.border}`, background:t.panel, flexShrink:0 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ margin:0, fontSize:13.5, fontWeight:700, color:t.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{headerName}</p>
            {headerSub && <p style={{ margin:0, fontSize:11.5, color:t.sub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{headerSub}</p>}
          </div>
          {headerRight}
        </div>
      )}

      {showPrivacyNote && (
        <div style={{ display:'flex', gap:8, padding:'9px 14px', background:'rgba(217,119,6,0.10)', borderBottom:`1px solid ${t.border}`, flexShrink:0 }}>
          <ShieldAlert size={14} style={{ color:'#d97706', flexShrink:0, marginTop:1 }} />
          <p style={{ margin:0, fontSize:11.5, lineHeight:1.5, color:t.text }}>
            Keep IC numbers, bank details and copies of documents out of this chat.
            Phone numbers are hidden by default and only shown when the other person taps.
          </p>
        </div>
      )}

      <div ref={listRef} style={{ flex:1, overflowY:'auto', padding:'14px', minHeight:0 }}>
        {loading ? (
          <p style={{ fontSize:12.5, color:t.sub, textAlign:'center', marginTop:24 }}>Loading…</p>
        ) : messages.length === 0 ? (
          <p style={{ fontSize:12.5, color:t.sub, textAlign:'center', marginTop:24, lineHeight:1.6 }}>
            No messages yet.<br />Say hello and ask anything about the car.
          </p>
        ) : messages.map(m => (
          <Bubble key={m.id} msg={m} mine={m.sender_role === role} t={t} />
        ))}
      </div>

      {notice && (
        <p style={{ margin:0, padding:'7px 14px', fontSize:11.5, color:'#f87171', background:'rgba(248,113,113,0.10)', flexShrink:0 }}>{notice}</p>
      )}

      {/* Lite has the same chat, without the AI. The locked strip sits in the
          exact slot the AI bar occupies on Premium so the upgrade shows what is
          missing where it would have been, instead of a banner bolted on top. */}
      {AI_FEATURES_ENABLED && !aiAssist && aiUpgrade && (
        <div style={{ display:'flex', alignItems:'center', gap:9, flexWrap:'wrap', borderTop:`1px solid ${t.border}`, background:t.panel, padding:'9px 12px', flexShrink:0 }}>
          <Lock size={12} style={{ color:t.sub, flexShrink:0 }} />
          <p style={{ margin:0, flex:'1 1 150px', minWidth:0, fontSize:11.5, lineHeight:1.5, color:t.sub }}>
            Draft replies and ask about a buyer with AI on Premium.
          </p>
          <a href={upgradeHref}
            style={{ display:'inline-flex', alignItems:'center', gap:5, flexShrink:0, padding:'6px 12px', borderRadius:8, background:'#dc2626', color:'#fff', fontSize:11.5, fontWeight:700, textDecoration:'none', fontFamily:"system-ui,sans-serif" }}>
            <Sparkles size={12} /> Upgrade
          </a>
        </div>
      )}

      {/* No Anthropic API credits loaded yet — every AI call would just fail.
          Show the same slot as a plain "coming soon" note instead of a live
          bar or an upgrade pitch for a feature that doesn't work yet. */}
      {!AI_FEATURES_ENABLED && aiAssist && (
        <div style={{ display:'flex', alignItems:'center', gap:9, borderTop:`1px solid ${t.border}`, background:t.panel, padding:'9px 12px', flexShrink:0 }}>
          <Sparkles size={12} style={{ color:t.sub, flexShrink:0 }} />
          <p style={{ margin:0, fontSize:11.5, lineHeight:1.5, color:t.sub }}>
            AI drafting &amp; buyer Q&amp;A — coming soon.
          </p>
        </div>
      )}

      {AI_FEATURES_ENABLED && aiAssist && (
        <div style={{ borderTop:`1px solid ${t.border}`, background:t.panel, padding:'9px 10px', flexShrink:0 }}>
          {aiAnswer && (
            <div style={{ display:'flex', gap:8, background:'rgba(124,58,237,0.07)', border:'1px solid rgba(124,58,237,0.20)', borderRadius:9, padding:'10px 12px', marginBottom:8 }}>
              <p style={{ margin:0, flex:1, fontSize:12.5, lineHeight:1.6, color:t.text, whiteSpace:'pre-wrap' }}>{aiAnswer}</p>
              <button onClick={() => setAiAnswer(null)} aria-label="Dismiss"
                style={{ background:'none', border:'none', color:t.sub, cursor:'pointer', padding:0, height:'fit-content' }}>
                <X size={13} />
              </button>
            </div>
          )}
          <div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
            <button onClick={() => callAssist('suggest')} disabled={aiLoading}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 11px', borderRadius:8, border:'1px solid rgba(124,58,237,0.30)', background:'transparent', color:'#8b5cf6', fontSize:11.5, fontWeight:600, cursor: aiLoading ? 'wait' : 'pointer', fontFamily:"system-ui,sans-serif", whiteSpace:'nowrap' }}>
              <Sparkles size={12} /> {aiLoading ? 'Thinking…' : 'Draft a reply'}
            </button>
            <input value={askText} onChange={e => setAskText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && askText.trim()) { e.preventDefault(); callAssist('ask', askText); } }}
              placeholder="Ask the AI about this buyer…" aria-label="Ask the AI about this conversation"
              style={{ flex:'1 1 160px', minWidth:0, boxSizing:'border-box', padding:'7px 11px', borderRadius:8, border:`1px solid ${t.border}`, background:t.inputBg, color:t.text, fontSize:11.5, fontFamily:"system-ui,sans-serif", outline:'none' }} />
          </div>
          <p style={{ margin:'7px 2px 0', fontSize:10.5, color:t.sub, lineHeight:1.5 }}>
            The AI reads this chat with phone numbers and IC numbers already stripped out. Drafts are yours to edit and send.
          </p>
        </div>
      )}

      {/* The buyer's half of notifications. Only after they have actually sent
          something — the moment they start waiting on a reply is the moment the
          ask makes sense, and a permission prompt fired on open is the kind
          people reflexively block. Sits in the slot the seller's AI bar
          occupies, so neither side gains a layout of its own. */}
      {role === 'buyer' && messages.some(m => m.sender_role === 'buyer') && (
        <BuyerPushPrompt t={t} />
      )}

      {/* Holds the composer's slot open while it is fixed, so the message list
          does not grow into the gap and shunt the conversation. */}
      {pinned && <div aria-hidden style={{ height: composerH, flexShrink:0 }} />}

      {/* Deliberately NOT portalled, against the usual overlay rule: moving this
          form in the DOM would remount the input, drop focus, close the keyboard
          and immediately unpin — a flicker loop. Flipping `position` leaves the
          node exactly where it is, so focus survives. Safe here because a fixed
          child escapes an ancestor's overflow:hidden, and the only containers
          that would trap it (ChatSheet's and BuyerChat's backdrop-filter layers,
          which do create a containing block) pass viewportPinned and never pin. */}
      <form onSubmit={submit} ref={formRef}
        style={{
          display:'flex', gap:8, alignItems:'flex-end', padding:10, borderTop:`1px solid ${t.border}`,
          background:t.panel, flexShrink:0, boxSizing:'border-box',
          ...(pinned ? {
            position:'fixed', left:0, right:0,
            // The bottom edge of the visible area in layout-viewport
            // coordinates — the same math ChatSheet uses for its container.
            top: vv.offsetTop + vv.height - composerH,
            zIndex:60,
          } : null),
        }}>
        <textarea ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type a message"
          onFocus={focusComposer} onBlur={() => setKbFocused(false)} onKeyDown={onComposerKeyDown}
          rows={1} maxLength={4000} aria-label="Message"
          style={{ flex:1, minWidth:0, boxSizing:'border-box', padding:'11px 14px', borderRadius:10, border:`1px solid ${t.border}`, background:t.inputBg, color:t.text, fontSize:14, lineHeight:1.4, fontFamily:"system-ui,sans-serif", outline:'none', resize:'none', display:'block' }} />
        {/* Keeps focus in the input: without this the tap blurs it, the bar
            unpins out from under the finger before the click lands, and the
            keyboard shuts between every message. */}
        <button type="submit" onMouseDown={e => e.preventDefault()}
          disabled={!draft.trim() || sending} aria-label="Send"
          style={{ flexShrink:0, width:44, height:44, borderRadius:10, border:'none', background: draft.trim() ? '#dc2626' : t.theirs, color: draft.trim() ? '#fff' : t.sub, cursor: draft.trim() ? 'pointer' : 'default', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}
