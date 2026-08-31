import React, { useState } from 'react';
import { MessageSquare, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBuyerThreads } from '../../hooks/useChat';
import ChatThread from './ChatThread';
import BuyerPushPrompt from './BuyerPushPrompt';

// Buyer-side inbox, on /account.
//
// Before this existed a buyer had to find the exact listing again to carry on a
// conversation they had already started — so most of them simply never came
// back. This is the place they return to.
//
// Design note: deliberately softer than the rest of the marketplace — bigger
// corner radii, hairline borders instead of hard greys, no boxes inside boxes.
// It reads as a messaging app, which is what it is. Red is used for exactly one
// thing, the unread count, so an unanswered message is the only thing that
// pulls the eye.

const SURFACE   = '#fff';
const HAIRLINE  = '#ECE9E3';
const INK       = '#111827';
const MUTED     = '#8A8781';
const SOFT      = '#F6F4EF';
const ACCENT    = '#dc2626';
// A message list stretched to 1100px puts the name hard left and the timestamp
// hard right with nothing between. Cap it so it reads like a conversation.
const MAXW      = 640;

// The preview comes from body_ai, the redacted copy, so a phone number never
// renders in a list row. Its placeholders read as literal text though
// ("[number hidden]"), so show them the way every messaging app shows masked
// content instead.
const cleanPreview = (text) => {
  const raw = String(text || '').trim();
  if (!raw) return '';
  // A message that was ONLY a phone number redacts down to nothing readable,
  // and a row of dots looks like a rendering bug. Say what it was instead.
  if (!raw.replace(/\[(?:number|contact) hidden\]/g, '').trim()) return 'Shared a contact number';
  return raw.replace(/\[(?:number|contact) hidden\]/g, '•••••');
};

const fmtWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const mins = (now - d) / 60000;
  if (mins < 1) return 'now';
  if (mins < 60) return `${Math.round(mins)}m`;
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', hour12: true });
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
};

const fmtPrice = (n) =>
  Number.isFinite(Number(n)) && Number(n) > 0
    ? `RM ${Number(n).toLocaleString('en-MY')}`
    : null;

// 1498cc reads as 1.5L to a buyer. Under 1000cc keep the raw number.
const fmtEngine = (cc) => {
  const n = Number(cc);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}L` : `${n}cc`;
};

const carTitle = (t) =>
  [t.car_year, t.car_brand, t.car_model].filter(Boolean).join(' ') || 'Car enquiry';

const initials = (name) =>
  String(name || 'S').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

function SellerAvatar({ name, src, size = 30, ring = SURFACE }) {
  const common = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    boxShadow: `0 0 0 2.5px ${ring}`, objectFit: 'cover',
  };
  // A missing photo is the common case, so the fallback has to look intentional
  // rather than like a broken image.
  if (src) return <img src={src} alt="" referrerPolicy="no-referrer" style={common} />;
  return (
    <div style={{ ...common, background: '#E7E3DB', color: '#6E6A63', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, letterSpacing: '0.02em' }}>
      {initials(name)}
    </div>
  );
}

function ThreadRow({ t, onOpen }) {
  const unread  = t.buyer_unread || 0;
  const price   = fmtPrice(t.car_price);
  const engine  = fmtEngine(t.car_engine_cc);
  const place   = t.car_state || t.car_city || '';
  const preview = cleanPreview(t.last_preview);
  const title   = [carTitle(t), engine].filter(Boolean).join(' · ');

  // The width budget at 375px is unforgiving: the text column is ~190px once
  // the photo and the unread badge take their share. Engine size therefore
  // rides on the car line, and the price/location line is nowrap with the
  // location as the part that ellipsises — a clipped state name beats a row
  // that wraps onto a fifth line.
  return (
    <button onClick={() => onOpen(t)}
      style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left',
        background: 'transparent', border: 'none', borderRadius: 20, padding: 14,
        cursor: 'pointer', fontFamily: 'system-ui,sans-serif' }}>

      {/* Car photo with the seller's face tucked into the corner — one glance
          answers both "which car" and "who am I talking to". */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {t.car_image
          ? <img src={t.car_image} alt="" style={{ width: 56, height: 56, borderRadius: 18, objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: 56, height: 56, borderRadius: 18, background: SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={19} color="#C9C4BA" />
            </div>}
        <div style={{ position: 'absolute', right: -6, bottom: -5 }}>
          <SellerAvatar name={t.seller_name} src={t.seller_avatar} size={26} />
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 14.5, fontWeight: unread ? 700 : 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.seller_name}
          </span>
          <span style={{ fontSize: 11.5, color: MUTED, marginLeft: 'auto', flexShrink: 0 }}>{fmtWhen(t.last_message_at)}</span>
        </div>

        <p style={{ margin: '2px 0 0', fontSize: 13, color: '#5F5C56', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </p>

        {(price || place) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 0', flexWrap: 'nowrap', minWidth: 0 }}>
            {price && (
              <span style={{ fontSize: 12, fontWeight: 700, color: INK, background: SOFT, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {price}
              </span>
            )}
            {place && (
              <span style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                {place}
              </span>
            )}
          </div>
        )}

        {preview && (
          <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.4, color: unread ? INK : MUTED, fontWeight: unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.last_sender_role === 'buyer' ? 'You: ' : ''}{preview}
          </p>
        )}
      </div>

      {unread > 0 ? (
        <span style={{ flexShrink: 0, alignSelf: 'center', minWidth: 21, height: 21, borderRadius: 999, background: ACCENT, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
          {unread}
        </span>
      ) : (
        <ChevronRight size={17} color="#C9C4BA" style={{ flexShrink: 0, alignSelf: 'center' }} />
      )}
    </button>
  );
}

export default function BuyerInbox() {
  const { threads, loading } = useBuyerThreads();
  const [openId, setOpenId] = useState(null);
  const open = threads.find(t => t.thread_id === openId) || null;

  if (loading) {
    return (
      <div style={{ background: SURFACE, border: `1px solid ${HAIRLINE}`, borderRadius: 24, padding: '38px 20px', textAlign: 'center', fontSize: 13, color: MUTED, maxWidth: MAXW }}>
        Loading your messages…
      </div>
    );
  }

  if (!threads.length) {
    return (
      <div style={{ background: SURFACE, border: `1px solid ${HAIRLINE}`, borderRadius: 24, padding: '40px 24px', textAlign: 'center', maxWidth: MAXW }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: SOFT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <MessageSquare size={22} color="#C9C4BA" />
        </div>
        <p style={{ margin: '0 0 5px', fontSize: 15, fontWeight: 700, color: INK }}>No conversations yet</p>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
          Tap Contact on any listing to message the seller. Every chat you start shows up here.
        </p>
        <Link to="/showroom" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, background: INK, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600, padding: '10px 20px', borderRadius: 999 }}>
          Browse cars <ArrowRight size={13} />
        </Link>
      </div>
    );
  }

  // One column on every width. Tapping a conversation replaces the list, the
  // way a phone messaging app works — no split pane to reflow at 375px.
  if (open) {
    const spec = [fmtPrice(open.car_price), fmtEngine(open.car_engine_cc), open.car_state || open.car_city].filter(Boolean).join(' · ');
    return (
      <div style={{ background: SURFACE, border: `1px solid ${HAIRLINE}`, borderRadius: 24, overflow: 'hidden', maxWidth: MAXW }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderBottom: `1px solid ${HAIRLINE}` }}>
          <button onClick={() => setOpenId(null)} aria-label="Back to all messages"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', background: SOFT, border: 'none', cursor: 'pointer', flexShrink: 0, color: '#5F5C56' }}>
            <ChevronLeft size={18} />
          </button>
          <SellerAvatar name={open.seller_name} src={open.seller_avatar} size={38} ring={SURFACE} />
          {/* Just the seller here — the car strip directly below already names
              the car, and saying it twice is noise. */}
          <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 14.5, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {open.seller_name}
          </p>
        </div>

        {/* The car, restated above the thread — a buyer talking to three sellers
            needs to know which car this conversation is about. */}
        <Link to={open.car_slug ? `/cars/${open.car_slug}` : '/showroom'}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', textDecoration: 'none', background: SOFT }}>
          {open.car_image
            ? <img src={open.car_image} alt="" style={{ width: 46, height: 46, borderRadius: 15, objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 46, height: 46, borderRadius: 15, background: '#E7E3DB', flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{carTitle(open)}</p>
            {spec && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{spec}</p>}
          </div>
          <ChevronRight size={16} color="#C9C4BA" style={{ flexShrink: 0 }} />
        </Link>

        <ChatThread threadId={open.thread_id} role="buyer" theme="light" height={480} bare />
      </div>
    );
  }

  return (
    <div style={{ background: SURFACE, border: `1px solid ${HAIRLINE}`, borderRadius: 24, padding: 4, maxWidth: MAXW }}>
      {threads.map((t, i) => (
        <React.Fragment key={t.thread_id}>
          {i > 0 && <div style={{ height: 1, background: HAIRLINE, margin: '0 14px' }} />}
          <ThreadRow t={t} onOpen={(x) => setOpenId(x.thread_id)} />
        </React.Fragment>
      ))}
      {/* The second entry point. Inside a thread the prompt only appears once
          the buyer has typed, which is right there but leaves a buyer who
          already has conversations — and no subscription — with nowhere to turn
          them on. Having threads at all means they have already messaged
          someone, so the "not yet asked for anything" reasoning does not apply
          here. Same component, so there is one implementation of every browser
          trap, not two. */}
      <BuyerPushPrompt t={{ border: HAIRLINE, panel: SOFT, sub: MUTED }} />
    </div>
  );
}
