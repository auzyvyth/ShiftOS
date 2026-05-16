import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

// Collapsible sidebar filter group.
// Wrap any filter controls in this to get the toggle header.
export default function FilterSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: open ? '16px' : '0', marginBottom: '4px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '14px 0 10px', color: 'white', fontSize: '12px', fontWeight: '700',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        {title}
        {open
          ? <ChevronUp size={13} style={{ color: '#6b7280' }} />
          : <ChevronDown size={13} style={{ color: '#6b7280' }} />
        }
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
