import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { getRef } from '../utils/refTracking';

// Name-only gate shown before a buyer opens WhatsApp. Captures the buyer's name,
// creates a real pipeline lead (create_lead_from_whatsapp RPC — anon-callable),
// then opens WhatsApp. Phone isn't asked (lower friction) — the seller gets it
// from the WhatsApp chat itself. Used by every public "WhatsApp" button.
export default function ContactGate({ open, onClose, waUrl, dealerId, carId, carName, onConfirmed }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

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
    // don't intercept it; the lead insert runs after, non-blocking.
    if (waUrl && waUrl !== '#') window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (dealerId) {
      supabase.rpc('create_lead_from_whatsapp', {
        p_dealer_id: dealerId,
        p_car_id: carId || null,
        p_name: nm,
        p_phone: null,
        p_ref_slug: getRef() || null,
      }).then(({ error }) => { if (error) console.error('create_lead_from_whatsapp:', error); });
    }
    try { onConfirmed?.(); } catch { /* ignore */ }
    setName(''); setBusy(false); onClose();
  };

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'DM Sans',sans-serif" }}>
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
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#111827', outline: 'none', marginBottom: 12 }}
        />
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
  );
}
