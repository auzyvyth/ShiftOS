import { X } from 'lucide-react';

// Active filter tag with a remove button.
// Used in filter sidebars to show applied filters.
export default function FilterBadge({ label, onRemove }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)',
      color: '#f87171', fontSize: '11px', fontWeight: '600',
      padding: '4px 10px', borderRadius: '20px',
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: 0, display: 'flex', alignItems: 'center' }}
      >
        <X size={10} />
      </button>
    </span>
  );
}
