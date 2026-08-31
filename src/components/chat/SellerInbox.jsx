import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, ArrowLeft, UserCircle2, BadgeCheck, ChevronDown, GitBranch } from 'lucide-react';
import { useChatThreads } from '../../hooks/useChat';
import ChatThread, { THEMES } from './ChatThread';
import { STAGE_ORDER, STAGE_CONFIG, canonicalStage } from '../../lib/leadsHelpers';

// Seller-side inbox. `theme` picks the palette so the same component sits on a
// light dealer dashboard or a dark salesman panel without a second copy.
//
// `aiAssist` is what separates Premium from Lite here: the conversation, the
// realtime, the ticks and the masking are identical on both plans — Lite just
// gets the AI bar replaced by an upgrade strip (`aiUpgrade`).
//
// A guest buyer shows as "Guest 4F2A" — deliberately anonymous until they
// choose to register. A registered buyer shows their own name with a verified
// mark, which is the difference the seller can actually act on.

const fmtAgo = (iso) => {
  if (!iso) return '';
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 1) return 'now';
  if (mins < 60) return `${Math.round(mins)}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
};

// The pipeline path a live deal walks. 'lost' is deliberately not in the row —
// it is not a step on the way anywhere, so it is stated on its own when a deal
// actually died there.
const PATH = STAGE_ORDER.filter(x => x !== 'lost');

export default function SellerInbox({
  salesmanId = null, dealerId = null,
  theme = 'light', aiAssist = true, aiUpgrade = false, upgradeHref = '/choose-plan',
  // Fill the viewport instead of sitting in the page as a ~540px island. The
  // chat tab IS the page on Lite and Premium, and a short box floating in a
  // tall empty column is what made it look bolted on.
  fullHeight = false,
  // Everything the page keeps below this panel — its own bottom padding plus
  // any fixed chrome (Lite has a 60px bottom nav on mobile inside an 80px
  // reserve; Premium uses a drawer and just has 24px of padding). Passed in
  // rather than detected: only the page knows its own chrome.
  bottomInset = 0,
}) {
  const { threads, loading, totalUnread } = useChatThreads({ salesmanId, dealerId });
  const [openId, setOpenId] = useState(null);
  const [showStage, setShowStage] = useState(false);
  const fillRef = useRef(null);
  const [fillH, setFillH] = useState(null);

  // Measure rather than hardcode an offset: the distance from this panel's top
  // to the bottom of the window is the height it should fill, and that differs
  // between Lite and Premium (different headers, sub-nav and page padding).
  //
  // window.innerHeight, NOT visualViewport.height — the latter shrinks when the
  // phone keyboard opens, which would collapse the whole panel mid-message.
  // ChatThread already handles the keyboard by pinning its own composer.
  const measure = useCallback(() => {
    const el = fillRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    setFillH(Math.max(360, window.innerHeight - top - bottomInset));
  }, [bottomInset]);

  useEffect(() => {
    if (!fullHeight) return undefined;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [fullHeight, measure]);

  // Re-measure once the list has rendered: on the first frame the panel may
  // still be under a loading state of a different height.
  useEffect(() => { if (fullHeight && !loading) measure(); }, [fullHeight, loading, measure]);

  // A different conversation is a different lead — never inherit the last one's
  // open stage strip.
  useEffect(() => { setShowStage(false); }, [openId]);

  const t = THEMES[theme] || THEMES.light;
  // Row hover/active tint and separators, derived so both palettes stay legible.
  const dark = theme === 'dark';
  const rowActive = dark ? 'rgba(220,38,38,0.10)' : 'rgba(220,38,38,0.05)';
  const rowLine = dark ? 'rgba(255,255,255,0.05)' : '#f3f4f6';
  const ph = dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6';

  const open = threads.find(x => x.id === openId) || null;
  const carOf = (x) => x.listing ? [x.listing.year, x.listing.brand, x.listing.model].filter(Boolean).join(' ') : 'Car enquiry';

  if (loading) {
    return <p style={{ fontSize:13, color:t.sub, padding:'32px 0', textAlign:'center' }}>Loading messages…</p>;
  }

  if (!threads.length) {
    return (
      <div style={{ textAlign:'center', padding:'48px 20px', color:t.sub }}>
        <MessageSquare size={30} style={{ color:t.sub, opacity:0.5, marginBottom:10 }} />
        <p style={{ fontSize:14, fontWeight:600, color:t.text, margin:'0 0 4px' }}>No conversations yet</p>
        <p style={{ fontSize:12.5, margin:0, lineHeight:1.6 }}>
          When a buyer starts a chat from one of your listings, it lands here.
        </p>
      </div>
    );
  }

  const list = (
    <div style={{ background:t.bg, border:`1px solid ${t.border}`, borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column', height: fullHeight ? '100%' : undefined, minHeight:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 14px', borderBottom:`1px solid ${t.border}`, background:t.panel, flexShrink:0 }}>
        <MessageSquare size={15} style={{ color:'#dc2626' }} />
        <p style={{ margin:0, fontSize:13, fontWeight:700, color:t.text, flex:1 }}>Messages</p>
        {totalUnread > 0 && (
          <span style={{ fontSize:11, fontWeight:700, color:'#fff', background:'#dc2626', borderRadius:20, padding:'1px 8px' }}>{totalUnread}</span>
        )}
      </div>
      <div style={{ ...(fullHeight ? { flex:1, minHeight:0 } : { maxHeight:'min(520px, 60vh)' }), overflowY:'auto' }}>
        {threads.map(row => {
          const active = row.id === openId;
          const unread = row.seller_unread || 0;
          return (
            <button key={row.id} onClick={() => setOpenId(row.id)}
              style={{ width:'100%', display:'flex', gap:10, alignItems:'center', padding:'11px 14px', background: active ? rowActive : 'transparent', border:'none', borderBottom:`1px solid ${rowLine}`, cursor:'pointer', textAlign:'left', fontFamily:"system-ui,sans-serif" }}>
              {row.listing?.images?.[0]
                ? <img src={row.listing.images[0]} alt="" style={{ width:42, height:42, borderRadius:9, objectFit:'cover', flexShrink:0, border:`1px solid ${t.border}` }} />
                : <div style={{ width:42, height:42, borderRadius:9, background:ph, flexShrink:0 }} />}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:1 }}>
                  {row.buyer_is_anon
                    ? <UserCircle2 size={12} style={{ color:t.sub, flexShrink:0 }} />
                    : <BadgeCheck size={12} style={{ color:'#16a34a', flexShrink:0 }} />}
                  <span style={{ fontSize:13, fontWeight: unread ? 700 : 600, color:t.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {row.buyer_label}
                  </span>
                  <span style={{ fontSize:10.5, color:t.sub, marginLeft:'auto', flexShrink:0 }}>{fmtAgo(row.last_message_at)}</span>
                </div>
                <p style={{ margin:0, fontSize:11.5, color:t.sub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {carOf(row)}
                </p>
              </div>
              {unread > 0 && (
                <span style={{ flexShrink:0, minWidth:19, height:19, borderRadius:10, background:'#dc2626', color:'#fff', fontSize:10.5, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 5px' }}>
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  // The pipeline stage of the lead this conversation created. Chat is the one
  // inbound channel where the seller is talking to someone whose pipeline card
  // they cannot see, so they answer without knowing whether this is a first
  // hello or a deal with a deposit on it.
  const stage = open?.lead?.stage ? canonicalStage(open.lead.stage) : null;
  const stageCfg = stage ? STAGE_CONFIG[stage] : null;
  const stageIdx = stage ? PATH.indexOf(stage) : -1;
  // The thread carries lead_id, but `leads` RLS only returns rows where
  // salesman_id = auth.uid(). So a lead sitting unassigned in the dealer pool
  // reads back as null here — that is "not yours to see", NOT "no lead", and
  // telling a rep a real buyer isn't in the pipeline is worse than saying
  // nothing. The two cases are separated on lead_id, which is always readable.
  const leadHidden = !!open?.lead_id && !open?.lead;

  const stagePill = open && (
    <button onClick={() => setShowStage(v => !v)}
      aria-expanded={showStage}
      aria-label={stage ? `Pipeline stage: ${stageCfg?.label || stage}`
        : leadHidden ? 'In the pipeline, not assigned to you' : 'Not in the pipeline yet'}
      style={{ display:'flex', alignItems:'center', gap:5, background: showStage ? rowActive : 'none',
               border:`1px solid ${t.border}`, borderRadius:8, padding:'5px 9px', fontSize:11.5,
               color:t.text, cursor:'pointer', fontFamily:"system-ui,sans-serif", whiteSpace:'nowrap' }}>
      <GitBranch size={12} style={{ color:t.sub, flexShrink:0 }} />
      {stageCfg?.label || (leadHidden ? 'In pipeline' : 'No lead')}
      <ChevronDown size={11} style={{ color:t.sub, flexShrink:0, transform: showStage ? 'rotate(180deg)' : 'none', transition:'transform .15s' }} />
    </button>
  );

  // Expands INSIDE the thread rather than floating over it: ChatThread's root
  // is overflow:hidden, so an absolutely positioned popover would be clipped,
  // and portalling something this small buys nothing but overlay bugs.
  const stageStrip = showStage && open && (
    <div style={{ padding:'10px 14px', borderBottom:`1px solid ${t.border}`, background:t.panel, flexShrink:0 }}>
      {!stage ? (
        <p style={{ margin:0, fontSize:11.5, color:t.sub, lineHeight:1.5 }}>
          {leadHidden
            ? 'This buyer is in the pipeline but the lead is not assigned to you, so the stage is hidden.'
            : 'Not in the pipeline yet — a lead is created the first time this buyer messages you.'}
        </p>
      ) : stage === 'lost' ? (
        <p style={{ margin:0, fontSize:11.5, color:t.sub, lineHeight:1.5 }}>
          This deal is marked lost. Replying here does not reopen it — move it in the pipeline first.
        </p>
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:4, overflowX:'auto', paddingBottom:2 }}>
          {PATH.map((key, i) => {
            const done = i < stageIdx;
            const here = i === stageIdx;
            return (
              <div key={key} style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                {i > 0 && <span style={{ width:10, height:1, background:t.border, flexShrink:0 }} />}
                <span style={{
                  display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:20,
                  fontSize:11, whiteSpace:'nowrap',
                  background: here ? 'rgba(220,38,38,0.12)' : 'transparent',
                  border: `1px solid ${here ? 'rgba(220,38,38,0.35)' : t.border}`,
                  color: here ? '#f87171' : done ? t.text : t.sub,
                  fontWeight: here ? 700 : 500,
                }}>
                  <span aria-hidden style={{ width:5, height:5, borderRadius:'50%', flexShrink:0,
                    background: here ? '#dc2626' : done ? t.sub : 'transparent',
                    border: done || here ? 'none' : `1px solid ${t.border}` }} />
                  {STAGE_CONFIG[key]?.label || key}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div ref={fillRef} style={fullHeight && fillH ? { height: fillH } : undefined}>
      <style>{`
        .chat-inbox{display:grid;grid-template-columns:320px 1fr;gap:14px;align-items:start}
        .chat-inbox.ci-fill{align-items:stretch;height:100%}
        .chat-inbox .ci-thread{display:block;min-height:0}
        .chat-inbox.ci-fill .ci-list,.chat-inbox.ci-fill .ci-thread{min-height:0;height:100%}
        @media(max-width:820px){
          .chat-inbox{grid-template-columns:1fr}
          .chat-inbox.has-open .ci-list{display:none}
          .chat-inbox:not(.has-open) .ci-thread{display:none}
        }
      `}</style>
      <div className={`chat-inbox${open ? ' has-open' : ''}${fullHeight ? ' ci-fill' : ''}`}>
        <div className="ci-list">{list}</div>
        <div className="ci-thread">
          {open ? (
            <ChatThread
              threadId={open.id}
              role="seller"
              theme={theme}
              height={fullHeight ? '100%' : 540}
              aiAssist={aiAssist}
              aiUpgrade={aiUpgrade}
              upgradeHref={upgradeHref}
              headerName={open.buyer_label}
              headerSub={carOf(open)}
              headerBelow={stageStrip}
              headerRight={
                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  {stagePill}
                  <button onClick={() => setOpenId(null)} aria-label="Back to all messages"
                    style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:`1px solid ${t.border}`, borderRadius:8, padding:'5px 10px', fontSize:11.5, color:t.sub, cursor:'pointer', fontFamily:"system-ui,sans-serif" }}>
                    <ArrowLeft size={12} /> All
                  </button>
                </div>
              }
            />
          ) : (
            <div style={{ background:t.bg, border:`1px solid ${t.border}`, borderRadius:14, padding:'60px 20px', textAlign:'center', color:t.sub, fontSize:13, height: fullHeight ? '100%' : undefined, display:'flex', alignItems:'center', justifyContent:'center' }}>
              Pick a conversation to reply.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
