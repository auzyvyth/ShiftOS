import React from 'react';
import { Search } from 'lucide-react';

// Submit-only search box. Previously this fired a `search_listing_terms` RPC on
// every keystroke (live autocomplete), which hurt performance. The search now
// runs ONLY when the user presses Enter or clicks the search button — onSubmit
// receives the current value. Props kept backwards-compatible with callers
// (navigateTo / anchorRef are accepted but unused now).
export default function SearchAutocomplete({
  value = '',
  onChange,
  onSubmit,
  placeholder = 'Search brand, model, variant…',
  inputStyle = {},
  wrapStyle = {},
  wrapClassName = '',
  dark = false,
}) {
  const bg      = dark ? 'rgba(255,255,255,0.06)' : '#ffffff';
  const border  = dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.1)';
  const textCol = dark ? '#ffffff' : '#111827';
  const iconCol = dark ? 'rgba(255,255,255,0.5)' : '#9ca3af';

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(value);
  };

  return (
    <div className={wrapClassName} style={{ position: 'relative', ...wrapStyle }}>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', alignItems: 'center', background: bg, border, borderRadius: '10px', overflow: 'hidden' }}
      >
        <button
          type="submit"
          aria-label="Search"
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '0 6px 0 13px', height: '100%', color: iconCol,
          }}
        >
          <Search size={15} />
        </button>
        <input
          type="text"
          autoComplete="off"
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1, border: 'none', outline: 'none',
            padding: '10px 14px 10px 4px', fontSize: '13px',
            color: textCol, background: 'transparent',
            fontFamily: "'Outfit',sans-serif",
            ...inputStyle,
          }}
        />
      </form>
    </div>
  );
}
