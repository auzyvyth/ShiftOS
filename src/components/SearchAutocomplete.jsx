import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { SEARCH_TERMS } from '../utils/searchTerms';

// Search box with a client-side suggestions dropdown. Used to fire a
// `search_listing_terms` RPC on every keystroke (live autocomplete against the
// DB), which hurt performance, so it became submit-only. Suggestions are back,
// but from the make/model catalogue already bundled in the app (carData.js via
// searchTerms.js) — filtered in memory as the user types, so there is still
// ZERO network call per keystroke, or at all. Enter / the search button / a
// picked suggestion all still go through the one onSubmit path.
// Props kept backwards-compatible with callers (navigateTo is accepted but
// unused now). anchorRef is used — see the dropdown positioning note below.
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
  // Ref to the visible outer bar (e.g. MarketplacePage's mp-hero-search pill,
  // which wraps this input AND the submit button). The dropdown measures ITS
  // rect rather than this component's own wrap div, so it lines up flush with
  // the full bar instead of stopping short at the input's own edge.
  anchorRef,
}) {
  const bg      = dark ? 'rgba(255,255,255,0.06)' : '#ffffff';
  const border  = dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.1)';
  const textCol = dark ? '#ffffff' : '#111827';
  const iconCol = dark ? 'rgba(255,255,255,0.5)' : '#9ca3af';

  const [focused, setFocused] = useState(false);
  const wrapRef = useRef(null);
  const [rect, setRect] = useState(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_TERMS.filter(t => t.toLowerCase().includes(q)).slice(0, 8);
  }, [value]);

  const showDropdown = focused && matches.length > 0;

  // Portalled to document.body (overlay rule: parent stacking contexts —
  // e.g. MarketplacePage's .mp-trust-strip, which sits later in the DOM with
  // its own z-index — were painting OVER this dropdown no matter how high its
  // own z-index went, because that z-index only ever competed within its
  // ancestor's local stacking context, never against a sibling section's).
  // Position is measured off anchorRef (or this component's own wrap div as
  // a fallback) rather than CSS, so it tracks the real bar on resize/scroll.
  useEffect(() => {
    if (!showDropdown) return;
    const anchor = anchorRef?.current || wrapRef.current;
    if (!anchor) return;
    const update = () => setRect(anchor.getBoundingClientRect());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [showDropdown, anchorRef]);

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
    <div ref={wrapRef} className={wrapClassName} style={{ position: 'relative', ...wrapStyle }}>
      <style>{`
        .xd-ac-dropdown::-webkit-scrollbar { width: 6px; }
        .xd-ac-dropdown::-webkit-scrollbar-track { background: transparent; }
        .xd-ac-dropdown::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 10px; }
        .xd-ac-dropdown::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.3); }
        .xd-ac-dropdown-dark::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); }
        .xd-ac-dropdown-dark::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }
      `}</style>
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
      {showDropdown && rect && createPortal(
        <ul
          className={`xd-ac-dropdown${dark ? ' xd-ac-dropdown-dark' : ''}`}
          style={{
            position: 'fixed', top: rect.bottom + 6, left: rect.left, width: rect.width, zIndex: 1000,
            margin: 0, padding: '6px', listStyle: 'none',
            background: dark ? '#141b2b' : '#ffffff',
            border: dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.1)',
            borderRadius: '10px', boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
            maxHeight: '280px', overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: dark ? 'rgba(255,255,255,0.25) transparent' : 'rgba(0,0,0,0.18) transparent',
          }}
        >
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
        </ul>,
        document.body
      )}
    </div>
  );
}
