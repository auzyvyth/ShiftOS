import React, { useEffect, useRef, useState } from 'react';
import { Mail, X, Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';

// Asks the BUYER for an email, inside the conversation, after their first
// message — so a seller's reply can reach them once they have closed the tab.
//
// Why this exists: push only lands on a device that granted permission and is
// still around. Most buyers here are guests (Supabase anonymous sign-in), and a
// guest who closed the tab had no channel at all — the seller answered into a
// void. Email is the one channel that survives the tab closing.
//
// THE POINT IS THE ADDRESS, NOT THE ACCOUNT. We need somewhere to send a
// notification; we never need to fuse two identities. That is what makes the
// collision case below safe to decline rather than clever.
//
// Timing is deliberately the same as BuyerPushPrompt: after they have sent
// something, never on open. Someone who has typed nothing has not asked us for
// anything yet, and an ask in front of the thing they came to do reads as a
// signup wall — losing the message to save an email is a bad trade.

const DISMISS_KEY = 'xd_buyer_email_dismissed';
const DISMISS_DAYS = 7;

function dismissedRecently() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

const looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s).trim());

// Supabase reports a taken address a few different ways depending on version
// and on whether "confirm email" is on. Match the shape, not one exact string.
const isTakenError = (msg) => /already|exists|registered|taken/i.test(String(msg || ''));

export default function BuyerEmailPrompt({ t, onResolved }) {
  // null = still checking. Prevents a flash of the prompt for a buyer who
  // already has an email, and tells ChatThread which of the two asks to show.
  const [needed, setNeeded] = useState(null);
  const [dismissed, setDismissed] = useState(dismissedRecently);
  const [step, setStep] = useState('email');   // email | code | done | taken
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const resolvedRef = useRef(onResolved);
  resolvedRef.current = onResolved;

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      // No session at all: the thread cannot exist, so nothing to ask about.
      const has = !!user?.email;
      if (!alive) return;
      setNeeded(!!user && !has);
      resolvedRef.current?.(has);
    })();
    return () => { alive = false; };
  }, []);

  // If they confirm in another tab — they clicked the link in the email instead
  // of copying the code — supabase-js syncs the session across tabs and fires
  // USER_UPDATED here. Without this the prompt would sit there asking for a
  // code that has already been used.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'USER_UPDATED' && session?.user?.email) {
        // Deliberately does NOT report up: telling the parent we have an email
        // swaps this whole strip out for the push prompt in the same frame, so
        // the confirmation below would never be seen. The next mount picks it
        // up from the session and shows the push ask then.
        setStep('done');
      }
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  const sendCode = async (e) => {
    e?.preventDefault();
    const addr = email.trim();
    if (!looksLikeEmail(addr)) { setErr('That email does not look right.'); return; }
    setBusy(true); setErr(null);
    // updateUser upgrades the ANONYMOUS user in place and keeps the same
    // auth.uid(), so this conversation, its messages and the seller's pipeline
    // lead all carry over with nothing to migrate. Do NOT swap this for
    // signInWithOtp (what BuyerAuthPage uses) — that signs into a DIFFERENT
    // user and strands the whole thread.
    const { error } = await supabase.auth.updateUser({ email: addr });
    setBusy(false);
    if (error) {
      // The address already has an account. We deliberately do NOT try to move
      // this conversation onto it: re-pointing a chat at another account
      // because someone typed its address in this tab is an account-takeover
      // shape, and it is irreversible. Say so and leave the guest thread alone.
      if (isTakenError(error.message)) { setStep('taken'); return; }
      setErr(error.message || 'Could not send the code. Try again.');
      return;
    }
    setStep('code');
  };

  const verify = async (e) => {
    e?.preventDefault();
    const token = code.trim();
    if (token.length < 6) { setErr('Enter the 6-digit code from the email.'); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(), token, type: 'email_change',
    });
    setBusy(false);
    if (error) { setErr('That code did not work. Check it and try again.'); return; }
    // Everything downstream — profiles.email, this thread's label, the seller's
    // pipeline lead — is done by the sync_identity_from_auth_user trigger. There
    // is deliberately no client-side follow-up write here.
    setStep('done');
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
    setDismissed(true);
  };

  if (needed === null || dismissed) return null;
  if (!needed && step !== 'done') return null;

  const wrap = {
    display:'flex', flexDirection:'column', gap:7,
    borderTop:`1px solid ${t.border}`, background:t.panel,
    padding:'9px 12px', flexShrink:0,
  };
  const field = {
    flex:'1 1 150px', minWidth:0, boxSizing:'border-box', padding:'7px 11px',
    borderRadius:8, border:`1px solid ${t.border}`, background:t.inputBg,
    color:t.text, fontSize:12.5, fontFamily:'system-ui,sans-serif', outline:'none',
  };
  const cta = {
    flexShrink:0, padding:'7px 13px', borderRadius:8, border:'none',
    background:'#dc2626', color:'#fff', fontSize:11.5, fontWeight:700,
    cursor: busy ? 'wait' : 'pointer', fontFamily:'system-ui,sans-serif',
  };

  if (step === 'done') {
    return (
      <div style={wrap}>
        <p style={{ margin:0, display:'flex', alignItems:'center', gap:7, fontSize:11.5, color:t.sub, lineHeight:1.5 }}>
          <Check size={13} style={{ color:'#16a34a', flexShrink:0 }} />
          Email saved. We will let you know when the seller replies.
        </p>
      </div>
    );
  }

  if (step === 'taken') {
    return (
      <div style={wrap}>
        <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
          <Mail size={13} style={{ color:t.sub, flexShrink:0, marginTop:2 }} />
          <p style={{ margin:0, flex:1, fontSize:11.5, color:t.sub, lineHeight:1.55 }}>
            That email already has an account. Sign in from the menu to keep all
            your chats in one place — this conversation stays here either way.
          </p>
          <button onClick={dismiss} aria-label="Dismiss"
            style={{ background:'none', border:'none', color:t.sub, cursor:'pointer', padding:0, flexShrink:0 }}>
            <X size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
        <Mail size={13} style={{ color:t.sub, flexShrink:0, marginTop:2 }} />
        <p style={{ margin:0, flex:1, fontSize:11.5, color:t.sub, lineHeight:1.55 }}>
          {step === 'email'
            ? 'Add your email and we will tell you when the seller replies — even if you close this page.'
            : `Enter the 6-digit code we sent to ${email.trim()}.`}
        </p>
        <button onClick={dismiss} aria-label="Not now"
          style={{ background:'none', border:'none', color:t.sub, cursor:'pointer', padding:0, flexShrink:0 }}>
          <X size={13} />
        </button>
      </div>

      <form onSubmit={step === 'email' ? sendCode : verify}
        style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
        {step === 'email' ? (
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@email.com" aria-label="Your email address"
            autoComplete="email" inputMode="email" style={field} />
        ) : (
          <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456" aria-label="Six-digit code"
            autoComplete="one-time-code" inputMode="numeric" style={{ ...field, letterSpacing:2 }} />
        )}
        <button type="submit" disabled={busy} style={cta}>
          {busy ? 'Working…' : step === 'email' ? 'Notify me' : 'Confirm'}
        </button>
      </form>

      {step === 'code' && (
        <button onClick={() => { setStep('email'); setCode(''); setErr(null); }}
          style={{ alignSelf:'flex-start', background:'none', border:'none', padding:0, fontSize:11, color:t.sub, textDecoration:'underline', cursor:'pointer', fontFamily:'system-ui,sans-serif' }}>
          Use a different email
        </button>
      )}

      {err && <p style={{ margin:0, fontSize:11, color:'#f87171', lineHeight:1.5 }}>{err}</p>}
    </div>
  );
}
