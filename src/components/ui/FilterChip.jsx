import { Check } from 'lucide-react';

// Multi-select filter chip button.
// Pass active=true when the filter is currently applied.
export default function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        background: active ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.04)',
        border: active ? '1px solid rgba(220,38,38,0.4)' : '1px solid rgba(255,255,255,0.08)',
        color: active ? '#f87171' : '#9ca3af',
        fontSize: '12px', fontWeight: active ? '700' : '500',
        padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
        transition: 'all 0.15s ease',
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      {active && <Check size={10} />}
      {label}
    </button>
  );
}
