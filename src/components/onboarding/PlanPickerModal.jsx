import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Check } from 'lucide-react';

// Shared plan switcher for the onboarding flows. Shows every plan (salesman +
// dealer) with price, caps and features; selecting one routes to the matching
// onboarding flow/tier. Used by SalesmanOnboarding + DealerOnboarding.

const SALESMAN_PLANS = [
  {
    tier: 'lite', route: '/salesman-onboarding/lite', label: 'Salesman Lite',
    price: 'FREE', priceSub: 'forever', caps: ['Up to 10 listings', '1 user'],
    features: ['Auto-published to xdrive.my', 'Direct WhatsApp enquiries', 'Basic performance analytics', 'No credit card required'],
  },
  {
    tier: 'premium', route: '/salesman-onboarding/premium', label: 'Salesman Premium', soon: true,
    price: 'RM 50', priceSub: '/month', caps: ['Unlimited listings', '1 user'],
    features: ['Priority marketplace placement', 'Advanced CRM automation', 'Commission tracking', 'Advanced analytics', 'Custom profile subdomain'],
  },
];

const DEALER_PLANS = [
  {
    tier: 'starter', route: '/dealer-onboarding/starter', label: 'Dealer Starter',
    price: 'RM 299', priceSub: '/month', trial: '14-day free trial', caps: ['Up to 30 listings', 'Team of 2'],
    features: ['Full dealer dashboard', 'Lead CRM + pipeline', 'Analytics & reports', 'Custom subdomain'],
  },
  {
    tier: 'growth', route: '/dealer-onboarding/growth', label: 'Dealer Growth', popular: true,
    price: 'RM 599', priceSub: '/month', trial: '14-day free trial', caps: ['Up to 80 listings', 'Team of 5'],
    features: ['Everything in Starter', 'F&I add-on revenue tracking', 'Post-sale handover board', 'Priority support'],
  },
  {
    tier: 'pro', route: '/dealer-onboarding/pro', label: 'Dealer Pro',
    price: 'RM 1,199', priceSub: '/month', trial: '14-day free trial', caps: ['Unlimited listings', 'Unlimited team'],
    features: ['Everything in Growth', 'Custom branding', 'Dedicated account manager', 'SLA-backed uptime'],
  },
];

function PlanCard({ plan, current, onSelect }) {
  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      background: current ? 'rgba(220,38,38,0.06)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${current ? 'rgba(220,38,38,0.4)' : plan.popular ? 'rgba(220,38,38,0.25)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 14, padding: '20px 18px',
      opacity: plan.soon ? 0.62 : 1,
    }}>
      {plan.popular && !current && (
        <span style={{ position: 'absolute', top: -9, left: 18, background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4 }}>Most popular</span>
      )}
      {plan.soon && (
        <span style={{ position: 'absolute', top: -9, left: 18, background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4 }}>Coming soon</span>
      )}
      <p style={{ fontSize: 13, fontWeight: 600, color: '#E8EDF5', letterSpacing: '0.04em' }}>{plan.label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, margin: '8px 0 2px' }}>
        <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 30, letterSpacing: 1, color: '#fff', lineHeight: 1 }}>{plan.price}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{plan.priceSub}</span>
      </div>
      {plan.trial && <p style={{ fontSize: 10, color: 'rgba(74,222,128,0.7)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{plan.trial}</p>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: `${plan.trial ? 0 : 10}px 0 12px` }}>
        {plan.caps.map((c) => (
          <span key={c} style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '3px 7px' }}>{c}</span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, marginBottom: 16 }}>
        {plan.features.map((f) => (
          <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
            <Check size={13} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
            <span>{f}</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => !current && !plan.soon && onSelect(plan.route)}
        disabled={current || plan.soon}
        style={{
          height: 42, borderRadius: 8, border: (current || plan.soon) ? '1px solid rgba(255,255,255,0.12)' : 'none',
          background: (current || plan.soon) ? 'transparent' : '#dc2626', color: (current || plan.soon) ? 'rgba(255,255,255,0.4)' : '#fff',
          fontFamily: "system-ui,sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          cursor: (current || plan.soon) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        {plan.soon ? 'Coming soon' : current ? 'Current plan' : 'Select plan'}
      </button>
    </div>
  );
}

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
