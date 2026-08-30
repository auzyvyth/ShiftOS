import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { SALESMAN_PLANS, DEALER_PLANS } from '../../utils/plans';
import PlanCard from './PlanCard';

// Shared plan switcher for the onboarding flows. Shows every plan (salesman +
// dealer) with price, caps and features; selecting one routes to the matching
// onboarding flow/tier. Used by SalesmanOnboarding + DealerOnboarding.
//
// The plans themselves come from src/utils/plans.js so this modal and the
// standalone /plans page can never disagree about what anything costs.

// In-onboarding plan SWITCHER only — it always shows every plan, because the
// person is already onboarding and is changing their mind about which. The
// standalone pick-a-plan surface is /plans (src/pages/PlansPage.jsx); the two
// share the cards and the catalogue so neither can drift.
export default function PlanPickerModal({ currentTier, onClose }) {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const select = (route) => { onClose(); navigate(route); };

  const section = (title, plans, cols) => (
    <div style={{ marginBottom: 22 }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>{title}</p>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 14 }} className="ppm-grid">
        {plans.map((p) => <PlanCard key={p.tier} plan={p} current={p.tier === currentTier} onSelect={select} />)}
      </div>
    </div>
  );

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(4,6,12,0.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 16px', fontFamily: "system-ui,sans-serif" }}
    >
      <style>{`@media(max-width:760px){.ppm-grid{grid-template-columns:1fr !important;}}`}</style>
      <div style={{ width: '100%', maxWidth: 940, background: '#0C1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '26px 26px 22px', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(220,38,38,0.7)', marginBottom: 8 }}>Choose your plan</p>
            <h2 style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 32, letterSpacing: 2, color: '#E8EDF5', lineHeight: 1 }}>Plans &amp; Pricing</h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', marginTop: 6 }}>Switch any time — your progress is kept within the same product.</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={17} />
          </button>
        </div>

        {section('For individual salesmen / agents', SALESMAN_PLANS, 2)}
        {section('For dealerships', DEALER_PLANS, 3)}

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 4 }}>
          Switching between salesman and dealer restarts that product's onboarding.
        </p>
      </div>
    </div>,
    document.body
  );
}
