import React from 'react';
import { Check } from 'lucide-react';

// One plan card, shared by the onboarding PlanPickerModal and the standalone
// /plans page. It was inlined in the modal; the page needs the exact same card,
// and two copies of a pricing card is how a price ends up different in two
// places. Dark-surface styling only — every surface that shows plans is dark.
export default function PlanCard({ plan, current, onSelect }) {
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
