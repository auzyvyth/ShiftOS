import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { SEARCH_TERMS } from '../utils/searchTerms';

// Search box with a client-side suggestions dropdown. Used to fire a
// `search_listing_terms` RPC on every keystroke (live autocomplete against the
// DB), which hurt performance, so it became submit-only. Suggestions are back,
// but from the make/model catalogue already bundled in the app (carData.js via
// searchTerms.js) — filtered in memory as the user types, so there is still
// ZERO network call per keystroke, or at all. Enter / the search button / a
// picked suggestion all still go through the one onSubmit path.
// Props kept backwards-compatible with callers (navigateTo / anchorRef are
// accepted but unused now).
export default function SearchAutocomplete({
  value = '',
  onChange,
  onSubmit,
  placeholder = 'Search brand, model, variant…',
  inputStyle = {},
  // Overrides for the field shell itself. The shell's background/border are
  // INLINE styles, so a caller that wants the field to sit flush inside its own
  // container cannot override them from CSS without !important — hence a real
  // prop rather than a stylesheet hack reaching into this component's DOM.
  formStyle = {},
  wrapStyle = {},
  wrapClassName = '',
  dark = false,
}) {
  const bg      = dark ? 'rgba(255,255,255,0.06)' : '#ffffff';
  const border  = dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.1)';
  const textCol = dark ? '#ffffff' : '#111827';
  const iconCol = dark ? 'rgba(255,255,255,0.5)' : '#9ca3af';

  const [focused, setFocused] = useState(false);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_TERMS.filter(t => t.toLowerCase().includes(q)).slice(0, 8);
  }, [value]);

  const showDropdown = focused && matches.length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    setFocused(false);
    onSubmit?.(value);
  };

  const pick = (term) => {
    onChange?.(term);
    onSubmit?.(term);
    setFocused(false);
  };

  return (
    <div className={wrapClassName} style={{ position: 'relative', ...wrapStyle }}>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', alignItems: 'center', background: bg, border, borderRadius: '10px', overflow: 'hidden', ...formStyle }}
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
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
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
      {showDropdown && (
        <ul style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 40,
          margin: 0, padding: '6px', listStyle: 'none',
          background: dark ? '#141b2b' : '#ffffff',
          border: dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.1)',
          borderRadius: '10px', boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
          maxHeight: '280px', overflowY: 'auto',
        }}>
          {matches.map(term => (
            <li key={term}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(term)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                  padding: '9px 10px', borderRadius: '7px', border: 'none',
                  background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  fontFamily: "'Outfit',sans-serif", fontSize: '13px',
                  color: dark ? '#ffffff' : '#111827',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Search size={12} style={{ color: iconCol, flexShrink: 0 }} />
                {term}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
