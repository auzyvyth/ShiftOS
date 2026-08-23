import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X, ShieldCheck, Loader2 } from 'lucide-react';
import { useBuyerThread } from '../../hooks/useChat';
import ChatThread from './ChatThread';

// Buyer-side chat on a car listing. Dark, because it lives on the public
// marketplace.
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

export default function BuyerChat({ listingId, carName, sellerName }) {
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(hasConsented);
  const { threadId, start, starting, needsAnon } = useBuyerThread(listingId);

  // Overlay rule 2 — lock the page behind the sheet.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const beginChat = async () => {
    setConsented();
    setAccepted(true);
    if (!threadId) await start();
  };

  const panel = (
    <div onClick={() => setOpen(false)}
      style={{ position:'fixed', inset:0, zIndex:11000, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(3px)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} className="bc-sheet"
        style={{ background:'#0f1420', border:'1px solid rgba(255,255,255,0.10)', width:'100%', maxWidth:460, display:'flex', flexDirection:'column', fontFamily:"system-ui,sans-serif" }}>

        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.10)' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#f3f4f6' }}>{sellerName || 'Message the seller'}</p>
            <p style={{ margin:0, fontSize:11.5, color:'rgba(255,255,255,0.55)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{carName}</p>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close chat"
            style={{ background:'none', border:'none', color:'rgba(255,255,255,0.6)', cursor:'pointer', padding:4, display:'flex' }}>
            <X size={19} />
          </button>
        </div>

        {needsAnon ? (
          <div style={{ padding:'28px 22px', textAlign:'center' }}>
            <p style={{ fontSize:13.5, color:'#f3f4f6', margin:'0 0 8px', fontWeight:600 }}>Chat isn't available right now</p>
            <p style={{ fontSize:12.5, color:'rgba(255,255,255,0.55)', margin:0, lineHeight:1.6 }}>
              Please try again shortly, or use the WhatsApp button to reach the seller.
            </p>
          </div>
        ) : !accepted || !threadId ? (
          <div style={{ padding:'22px' }}>
            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              <ShieldCheck size={18} style={{ color:'#4ade80', flexShrink:0, marginTop:1 }} />
              <div>
                <p style={{ margin:'0 0 8px', fontSize:13.5, fontWeight:700, color:'#f3f4f6' }}>Before you start</p>
                <ul style={{ margin:0, paddingLeft:16, fontSize:12.5, color:'rgba(255,255,255,0.7)', lineHeight:1.65 }}>
                  <li style={{ marginBottom:6 }}>
                    You can chat without an account. The seller will see you as a guest until you sign up.
                  </li>
                  <li style={{ marginBottom:6 }}>
                    <strong style={{ color:'#f3f4f6' }}>Don't send private details</strong> — no IC number, bank
                    account, card details or copies of documents. Share those in person, once you know who you're dealing with.
                  </li>
                  <li style={{ marginBottom:6 }}>
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
              style={{ width:'100%', padding:'13px', borderRadius:11, border:'none', background:'#dc2626', color:'#fff', fontSize:14, fontWeight:700, cursor: starting ? 'wait' : 'pointer', fontFamily:"system-ui,sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {starting ? <><Loader2 size={15} style={{ animation:'bcspin 1s linear infinite' }} /> Starting…</> : 'I understand — start chat'}
            </button>
            <style>{`@keyframes bcspin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <ChatThread threadId={threadId} role="buyer" theme="dark" height="min(72vh, 560px)" showPrivacyNote />
        )}
      </div>
      <style>{`
        .bc-sheet{border-radius:18px 18px 0 0;max-height:88vh}
        @media(min-width:640px){
          .bc-sheet{border-radius:16px;margin-bottom:5vh}
        }
      `}</style>
    </div>
  );

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ width:'100%', padding:'13px', borderRadius:11, border:'1px solid rgba(255,255,255,0.16)', background:'rgba(255,255,255,0.06)', color:'#f3f4f6', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:"system-ui,sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        <MessageSquare size={16} /> Chat with the seller
      </button>
      {open && createPortal(panel, document.body)}
    </>
  );
}
