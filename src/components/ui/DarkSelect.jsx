import { ChevronDown } from 'lucide-react';

// Styled native <select> for dark-background filter sidebars.
// options: string[] — each string is both value and label.
export default function DarkSelect({ value, onChange, options, placeholder }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
          padding: '9px 32px 9px 12px', color: value ? 'white' : '#6b7280',
          fontSize: '12px', fontWeight: '500',
          appearance: 'none', WebkitAppearance: 'none',
          cursor: 'pointer', outline: 'none',
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o} value={o} style={{ background: '#0d1117', color: 'white' }}>{o}</option>
        ))}
      </select>
      <ChevronDown size={12} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
    </div>
  );
}
