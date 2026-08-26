import React, { useState, useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, MessageCircle, Phone, ChevronRight, ArrowLeft, X, ShieldCheck, Loader2 } from 'lucide-react';
import { useBuyerThread } from '../../hooks/useChat';

// Lazy — ChatThread (message list + useChatThread's live realtime channel)
// is only ever needed once a visitor has actually started chatting. A
// static import shipped and parsed it in CarDetailPage's bundle for every
// single car-detail page view, chat or not. The trigger button and chooser
// sheet above stay eager since they're what's visible on first paint.
const ChatThread = lazy(() => import('./ChatThread'));

// The single "Contact" entry point on a car listing (RAPTOR-6).
//
// It owns ONE sheet with two steps:
//   1. chooser — every way to reach this seller (WhatsApp, in-app chat, call)
//   2. chat    — the terms gate, then the live thread
// Before this, the car card stacked four CTAs (Book a Viewing / WhatsApp /
// Call / Chat). Now it is one red primary (Book a Viewing, owned by the page)
// plus this one neutral Contact button, and the long tail lives in the sheet.
//
// The trigger button follows the page's theme: the main marketplace
// (xdrive.my) renders light, a dealer subdomain renders dark. CarDetailPage
// passes its own isXdrive flag in as `isLight`. The sheet itself stays dark on
// both — it is an overlay over a dimmed page, not part of the surface.
//
// A shopper can chat without making an account: the first message signs them in
// anonymously, and the seller sees them as "Guest 4F2A". If they register later
// Supabase keeps the same user id, so the conversation carries over and the
// seller starts seeing their real name.

const CONSENT_KEY = 'xdrive_chat_terms_v1';

const hasConsented = () => {
  try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; }
};
const setConsented = () => {
  try { localStorage.setItem(CONSENT_KEY, '1'); } catch { /* private mode — just ask again */ }
};

// `isLight` follows CarDetailPage's own theme flag (isXdrive). The trigger
// button has to live on the page's surface, so it takes the page's colours —
// styling it for the dark theme is what made it invisible on the light one.
export default function BuyerChat({
  listingId,
  carName,
  sellerName,
  isLight = false,
  onWhatsApp,
  whatsappLabel = 'WhatsApp',
  onCall,
  callLoading = false,
  showCall = false,
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('choose');   // 'choose' | 'chat'
  const [accepted, setAccepted] = useState(hasConsented);
  // active: open — the reattach check only fires once the sheet is opened,
  // not on page load for every visitor. See useChat.js:useBuyerThread.
  const { threadId, start, starting, needsAnon } = useBuyerThread(listingId, { active: open });

  // Overlay rule 2 — lock the page behind the sheet.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const openSheet = () => { setView('choose'); setOpen(true); };
  const close = () => setOpen(false);

  // Overlay rule 3 — close this sheet BEFORE the page opens the enquiry modal,
  // never two overlays at once. handleWhatsApp only opens that modal (the real
  // wa.me deep link fires synchronously later, inside handleEnquirySubmit), so
  // there is nothing here for a popup blocker to catch.
  const closeAndRun = (fn) => () => { setOpen(false); if (fn) fn(); };

  const beginChat = async () => {
    setConsented();
    setAccepted(true);
    if (!threadId) await start();
  };

  // Picking chat jumps straight into the thread for a returning buyer who has
  // already accepted the terms, and into the gate for a first-timer.
  const chooseChat = () => {
    setView('chat');
    if (accepted && !threadId) start();
  };

  const rowStyle = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: '13px 14px', borderRadius: 12, textAlign: 'left',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
    color: '#f3f4f6', cursor: 'pointer', fontFamily: "system-ui,sans-serif",
  };
  const iconWrap = (tint) => ({
    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: tint || 'rgba(255,255,255,0.07)',
  });

  const ContactRow = ({ icon, tint, title, sub, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}
      style={{ ...rowStyle, cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      <span style={iconWrap(tint)}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{sub}</span>
      </span>
      <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
    </button>
  );

  const chooser = (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {onWhatsApp && (
        <ContactRow
          icon={<MessageCircle size={17} style={{ color: '#4ade80' }} />}
          tint="rgba(34,197,94,0.10)"
          title={whatsappLabel}
          sub="Continue the conversation on WhatsApp"
          onClick={closeAndRun(onWhatsApp)} />
      )}
      <ContactRow
        icon={<MessageSquare size={17} style={{ color: '#e2e8f0' }} />}
        title="Chat here in XDrive"
        sub="No account or phone number needed"
        onClick={chooseChat} />
      {showCall && onCall && (
        <ContactRow
          icon={callLoading
            ? <Loader2 size={17} style={{ color: '#e2e8f0', animation: 'bcspin 1s linear infinite' }} />
            : <Phone size={17} style={{ color: '#e2e8f0' }} />}
          title={callLoading ? 'Connecting…' : 'Call the seller'}
          sub="Opens your phone dialler"
          disabled={callLoading}
          onClick={onCall} />
      )}
      <style>{`@keyframes bcspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const chatGate = needsAnon ? (
    <div style={{ padding: '28px 22px', textAlign: 'center' }}>
      <p style={{ fontSize: 13.5, color: '#f3f4f6', margin: '0 0 8px', fontWeight: 600 }}>Chat isn't available right now</p>
      <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', margin: '0 0 16px', lineHeight: 1.6 }}>
        Please try again shortly, or reach the seller on WhatsApp instead.
      </p>
      {onWhatsApp && (
        <button onClick={closeAndRun(onWhatsApp)}
          style={{ width: '100%', padding: '12px', borderRadius: 11, border: '1px solid rgba(34,197,94,0.30)', background: 'rgba(34,197,94,0.10)', color: '#4ade80', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: "system-ui,sans-serif" }}>
          {whatsappLabel}
        </button>
      )}
    </div>
  ) : !accepted || !threadId ? (
    <div style={{ padding: '22px' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <ShieldCheck size={18} style={{ color: '#4ade80', flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 13.5, fontWeight: 700, color: '#f3f4f6' }}>Before you start</p>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65 }}>
            <li style={{ marginBottom: 6 }}>
              You can chat without an account. The seller will see you as a guest until you sign up.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong style={{ color: '#f3f4f6' }}>Don't send private details</strong> — no IC number, bank
              account, card details or copies of documents. Share those in person, once you know who you're dealing with.
            </li>
            <li style={{ marginBottom: 6 }}>
              Phone numbers are hidden until the other person taps to show them.
            </li>
            <li>
              XDrive stores these messages and uses them to help the seller reply faster. Messages may be
              reviewed if either side reports a problem.
            </li>
          </ul>
        </div>
      </div>
      <button onClick={beginChat} disabled={starting}
        style={{ width: '100%', padding: '13px', borderRadius: 11, border: 'none', background: '#dc2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: starting ? 'wait' : 'pointer', fontFamily: "system-ui,sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {starting ? <><Loader2 size={15} style={{ animation: 'bcspin 1s linear infinite' }} /> Starting…</> : 'I understand — start chat'}
      </button>
      <style>{`@keyframes bcspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  ) : (
    <Suspense fallback={
      <div style={{ padding: '40px 22px', textAlign: 'center' }}>
        <Loader2 size={20} style={{ color: 'rgba(255,255,255,0.4)', animation: 'bcspin 1s linear infinite' }} />
      </div>
    }>
      <ChatThread threadId={threadId} role="buyer" theme="dark" height="min(72vh, 560px)" showPrivacyNote />
    </Suspense>
  );

  const onChooser = view === 'choose';

  const panel = (
    <div onClick={close}
      style={{ position:'fixed', inset:0, zIndex:11000, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(3px)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} className="bc-sheet"
        style={{ background:'#0f1420', border:'1px solid rgba(255,255,255,0.10)', width:'100%', maxWidth:460, display:'flex', flexDirection:'column', fontFamily:"system-ui,sans-serif" }}>

        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.10)' }}>
          {!onChooser && (
            <button onClick={() => setView('choose')} aria-label="Back to contact options"
              style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', padding:4, display:'flex' }}>
              <ArrowLeft size={18} />
            </button>
          )}
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#f3f4f6' }}>
              {onChooser ? 'Contact the seller' : (sellerName || 'Message the seller')}
            </p>
            <p style={{ margin:0, fontSize:11.5, color:'rgba(255,255,255,0.55)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{carName}</p>
          </div>
          <button onClick={close} aria-label="Close"
            style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', padding:4, display:'flex' }}>
            <X size={19} />
          </button>
        </div>

        {onChooser ? chooser : chatGate}
      </div>
      <style>{`
        .bc-sheet{border-radius:18px 18px 0 0;max-height:88vh}
        @media(min-width:640px){
          .bc-sheet{border-radius:16px;margin-bottom:5vh}
        }
      `}</style>
    </div>
  );

  // A solid neutral button of equal weight on BOTH surfaces — never a ghost.
  // Neutral on purpose: the red "Book a Viewing" above stays the only accent.
  //
  // Light marketplace: the dark fill defines the shape on its own (#0F172A on a
  // white card is ~18:1).
  // Dealer subdomain: the card is #0a1220, and no fill dark enough to stay
  // neutral clears 3:1 against it — a translucent white fill is the same
  // barely-there problem the light page had. So the border carries the shape:
  // #64748B is 3.94:1 against the card, and the #334155 fill holds text at 9.5:1.
  const btn = isLight
    ? { bg: '#0F172A', border: '#0F172A', fg: '#FFFFFF' }
    : { bg: '#334155', border: '#64748B', fg: '#F1F5F9' };

  return (
    <>
      <button onClick={openSheet}
        style={{
          width:'100%', padding:'13px', borderRadius:11,
          background: btn.bg, border: `1px solid ${btn.border}`, color: btn.fg,
          fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:"system-ui,sans-serif",
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
        }}>
        <MessageSquare size={16} /> Contact
      </button>
      {open && createPortal(panel, document.body)}
    </>
  );
}
