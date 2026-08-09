import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getRef } from '../utils/refTracking';
import Turnstile from './Turnstile';
import LegalModal from './LegalModal';

const MY_STATES = ['Johor','Kedah','Kelantan','Kuala Lumpur','Labuan','Melaka','Negeri Sembilan','Pahang','Penang','Perak','Perlis','Putrajaya','Sabah','Sarawak','Selangor','Terengganu'];

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

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
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
    if (dealerId) {
      fetch('/api/whatsapp-lead', {
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
    <LegalModal doc={showLegal ? 'privacy' : null} onClose={() => setShowLegal(false)} />
    </>
  );
}
