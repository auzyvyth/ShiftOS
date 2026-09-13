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
// NO VERIFICATION. This writes straight to profiles.notify_email, never
// profiles.email (the verified column the auth email-change flow + lead
// de-dup rely on) — a typo or a stranger's address here just means a stray
// notification, never a mixed-up account or lead. Trying to verify it first
// was a code-by-email step that depended on Supabase's auth mailer, which
// buyers were not receiving — a real account (with a real inbox check) is the
// `taken` case below, pointing them at /buyer-signup instead.
//
// Timing is deliberately the same as PushPromptStrip: after they have sent
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

export default function BuyerEmailPrompt({ t, onResolved }) {
  // null = still checking. Prevents a flash of the prompt for a buyer who
  // already has an email on file, and tells ChatThread which of the two asks
  // to show.
  const [needed, setNeeded] = useState(null);
  const [dismissed, setDismissed] = useState(dismissedRecently);
  const [step, setStep] = useState('email');   // email | done
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const resolvedRef = useRef(onResolved);
  resolvedRef.current = onResolved;

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (alive) { setNeeded(false); resolvedRef.current?.(false); } return; }
      const { data: profile } = await supabase
        .from('profiles').select('email, notify_email').eq('id', user.id).maybeSingle();
      if (!alive) return;
      const has = !!(profile?.email || profile?.notify_email);
      setNeeded(!has);
      resolvedRef.current?.(has);
    })();
    return () => { alive = false; };
  }, []);

  const save = async (e) => {
    e?.preventDefault();
    const addr = email.trim();
    if (!looksLikeEmail(addr)) { setErr('That email does not look right.'); return; }
    setBusy(true); setErr(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles')
      .update({ notify_email: addr }).eq('id', user.id);
    setBusy(false);
    if (error) { setErr('Could not save that. Try again.'); return; }
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
          Saved. We will let you know when the seller replies.
        </p>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
        <Mail size={13} style={{ color:t.sub, flexShrink:0, marginTop:2 }} />
        <p style={{ margin:0, flex:1, fontSize:11.5, color:t.sub, lineHeight:1.55 }}>
          Add your email and we will tell you when the seller replies — even if you close this page.
        </p>
        <button onClick={dismiss} aria-label="Not now"
          style={{ background:'none', border:'none', color:t.sub, cursor:'pointer', padding:0, flexShrink:0 }}>
          <X size={13} />
        </button>
      </div>

      <form onSubmit={save} style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@email.com" aria-label="Your email address"
          autoComplete="email" inputMode="email" style={field} />
        <button type="submit" disabled={busy} style={cta}>
          {busy ? 'Saving…' : 'Notify me'}
        </button>
      </form>

      {err && <p style={{ margin:0, fontSize:11, color:'#f87171', lineHeight:1.5 }}>{err}</p>}
    </div>
  );
}
