import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

// Styled dropdown used in the HomePage hero search bar.
// options: { value, label }[]
// icon: a Lucide icon component rendered inside the trigger button
export default function CustomSelect({ label, icon: Icon, value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected ? selected.label : placeholder;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
          background: open ? 'rgba(196,162,101,0.06)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${open ? 'rgba(196,162,101,0.35)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: '4px', padding: '13px 14px', cursor: 'pointer',
          transition: 'all 0.2s', fontFamily: "'Outfit', sans-serif", outline: 'none',
        }}
      >
        <Icon size={14} style={{ color: open ? '#C4A265' : '#52525A', flexShrink: 0, transition: 'color 0.2s' }} />
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <p style={{ color: '#52525A', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 3px 0', fontWeight: 600 }}>
            {label}
          </p>
          <p style={{ color: value ? '#F0F0F0' : '#6B6B72', fontSize: '13px', fontWeight: value ? '600' : '400', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {displayLabel}
          </p>
        </div>
        <ChevronDown size={12} style={{ color: '#3A3A42', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 9999,
          background: '#141416', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.09)', borderRadius: '6px',
          overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
          animation: 'dropIn 0.15s ease',
        }}>
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            style={{
              width: '100%', textAlign: 'left', padding: '10px 16px',
              background: !value ? 'rgba(196,162,101,0.06)' : 'transparent',
              border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
              color: !value ? '#C4A265' : '#6B6B72', fontSize: '13px',
              fontWeight: !value ? '600' : '400', cursor: 'pointer',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            {placeholder}
          </button>
          {options.map((opt, i) => {
            const isSelected = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 16px',
                  background: isSelected ? 'rgba(196,162,101,0.06)' : 'transparent',
                  border: 'none',
                  borderBottom: i === options.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                  color: isSelected ? '#C4A265' : '#C0C0C6', fontSize: '13px',
                  fontWeight: isSelected ? '600' : '400', cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                {opt.label}
                {isSelected && (
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#C4A265', display: 'inline-block', flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
