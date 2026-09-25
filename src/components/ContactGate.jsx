import React, { useEffect, useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getRef } from '../utils/refTracking';
import { loadBuyerDetails, saveBuyerDetails } from '../utils/consent';
import { supabase } from '../supabaseClient';
import { MY_STATES } from '../utils/locations';
import { apiUrl } from '../utils/apiUrl';
import Turnstile from './Turnstile';

// Lazy for the same reason as in ConsentBanner: this component is reachable from
// every car card, so a static import would drag the full legal prose onto the
// marketplace entry bundle for a link almost nobody taps.
const LegalModal = lazy(() => import('./LegalModal'));


// Gate shown before a buyer opens WhatsApp. Captures the buyer's name (required)
// plus phone and state (both optional, so friction stays low), creates a real
// pipeline lead (create_lead_from_whatsapp RPC — anon-callable), then opens
// WhatsApp. Matches the car-detail enquiry form's fields so salesmen get the same
// info from every "WhatsApp" button. Used by every public "WhatsApp" button.
export default function ContactGate({ open, onClose, waUrl, dealerId, carId, carName, onConfirmed }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(null);
  const [showLegal, setShowLegal] = useState(false);
  // The signed-in buyer's profile row, when there is one — used to prefill and
  // to know which columns are still empty for the write-back below.
  const [buyerProfile, setBuyerProfile] = useState(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    // Prefill from device-remembered details (preferences consent tier; no-ops
    // and returns null when the buyer hasn't granted it).
    const saved = loadBuyerDetails();
    if (saved) {
      setName((v) => v || saved.name || '');
      setPhone((v) => v || saved.phone || '');
      setState((v) => v || saved.state || '');
    }
    // Then, for a signed-in buyer, fill any still-empty field from their account
    // so the "no re-typing your details" promise holds across devices. Only
    // fills gaps — never overwrites what's already typed or device-remembered.
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', session.user.id)
        .maybeSingle();
      if (!active || !prof) return;
      setBuyerProfile({ id: session.user.id, ...prof });
      setName((v) => v || prof.full_name || '');
      setPhone((v) => v || prof.phone || '');
    })();
    return () => { active = false; document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const proceed = () => {
    const nm = name.trim();
    if (!nm || busy) return;
    setBusy(true);
    // Open WhatsApp synchronously inside the click gesture so popup blockers
    // don't intercept it; the lead insert runs after, non-blocking. Because the
    // chat opens regardless, a captcha/rate-limit rejection on the write only
    // skips the CRM record — it never blocks the buyer reaching the seller.
    if (waUrl && waUrl !== '#') window.open(waUrl, '_blank', 'noopener,noreferrer');
    // Remember on this device for next time (no-ops without preferences consent).
    saveBuyerDetails({ name: nm, phone: phone.trim(), state });
    if (dealerId) {
      fetch(apiUrl('/api/whatsapp-lead'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealerId,
          carId: carId || null,
          name: nm,
          phone: phone.trim() || null,
          state: state || null,
          refSlug: getRef() || null,
          token,
        }),
      }).catch((err) => console.error('whatsapp-lead:', err));
    }
    // Progressive profiling: seed a signed-in buyer's account from this enquiry
    // so their next one (on any device) is truly pre-filled. Fill only columns
    // that are still empty, so a name/phone they corrected in their account is
    // never overwritten by an older enquiry. RLS permits this self-update.
    if (buyerProfile?.id) {
      const patch = {};
      if (nm && !buyerProfile.full_name) patch.full_name = nm;
      if (phone.trim() && !buyerProfile.phone) patch.phone = phone.trim();
      if (Object.keys(patch).length) {
        supabase.from('profiles').update(patch).eq('id', buyerProfile.id)
          .then(({ error }) => { if (error) console.error('buyer profile write-back:', error.message); });
      }
    }
    try { onConfirmed?.(); } catch { /* ignore */ }
    setName(''); setPhone(''); setState(''); setToken(null); setBusy(false); onClose();
  };

  return (
    <>
    {createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "system-ui,sans-serif" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 16, padding: '22px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>Before you chat</p>
        <p style={{ margin: '4px 0 16px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
          {carName ? `Let the seller know who's asking about the ${carName}.` : "Let the seller know who's asking."}
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') proceed(); }}
          placeholder="Your name"
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#111827', outline: 'none', marginBottom: 10 }}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') proceed(); }}
          inputMode="tel"
          placeholder="Phone number (optional)"
          aria-label="Phone number"
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#111827', outline: 'none', marginBottom: 10 }}
        />
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          aria-label="Your state"
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: state ? '#111827' : '#9ca3af', outline: 'none', marginBottom: 12, cursor: 'pointer', background: '#fff' }}
        >
          <option value="">Your state (optional)</option>
          {MY_STATES.map((s) => <option key={s} value={s} style={{ color: '#111827' }}>{s}</option>)}
        </select>
        <Turnstile onToken={setToken} action="whatsapp_lead" className="cg-turnstile" />
        <p style={{ margin: '10px 0 12px', fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
          {t('common.privacyNoticePre')}
          <button type="button" onClick={() => setShowLegal(true)} style={{ background: 'none', border: 'none', padding: 0, color: '#dc2626', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>{t('common.privacyPolicy')}</button>
          {t('common.privacyNoticePost')}
        </p>
        <button
          disabled={!name.trim() || busy}
          onClick={proceed}
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: name.trim() ? '#22c55e' : '#e5e7eb', color: name.trim() ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
        >
          Continue to WhatsApp
        </button>
        <button onClick={onClose} style={{ width: '100%', marginTop: 8, padding: '8px', background: 'none', border: 'none', color: '#9ca3af', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </div>,
    document.body,
    )}
    {showLegal && (
      <Suspense fallback={null}>
        <LegalModal doc="privacy" onClose={() => setShowLegal(false)} />
      </Suspense>
    )}
    </>
  );
}
