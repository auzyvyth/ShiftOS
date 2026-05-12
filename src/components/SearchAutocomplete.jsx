import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../supabaseClient';

/**
 * Drop-in search input with live autocomplete from listing_search_terms RPC.
 *
 * Props:
 *   value        string   — controlled input value
 *   onChange     fn(val)  — called on every keystroke
 *   onSelect     fn({brand, model, variant}) — called when user picks a suggestion
 *   onSubmit     fn(val)  — called on Enter / form submit with raw text
 *   placeholder  string
 *   inputStyle   object   — extra inline styles for the <input>
 *   wrapStyle    object   — extra inline styles for the wrapper div
 *   dark         bool     — dark theme (marketplace hero)
 */
export default function SearchAutocomplete({
  value = '',
  onChange,
  onSelect,
  onSubmit,
  placeholder = 'Search brand, model, variant…',
  inputStyle = {},
  wrapStyle = {},
  dark = false,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]               = useState(false);
  const [cursor, setCursor]           = useState(-1);
  const debounce                      = useRef(null);
  const wrapRef                       = useRef(null);
  const inputRef                      = useRef(null);

  // Query RPC with 300 ms debounce
  const query = useCallback((text) => {
    clearTimeout(debounce.current);
    if (text.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_listing_terms', {
        search_text: text.trim(),
        max_results: 12,
      });
      if (!error && data?.length) {
        setSuggestions(data);
        setOpen(true);
        setCursor(-1);
      } else {
        setSuggestions([]);
        setOpen(false);
      }
    }, 300);
  }, []);

  useEffect(() => { query(value); }, [value, query]);

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pick = (s) => {
    setOpen(false);
    setSuggestions([]);
    onSelect?.(s);
  };

  const handleKey = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)); }
    else if (e.key === 'Enter' && cursor >= 0) { e.preventDefault(); pick(suggestions[cursor]); }
    else if (e.key === 'Escape') { setOpen(false); setCursor(-1); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setOpen(false);
    onSubmit?.(value);
  };

  // Colour tokens
  const bg        = dark ? 'rgba(255,255,255,0.06)' : '#ffffff';
  const border    = dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)';
  const textCol   = dark ? '#ffffff' : '#111827';
  const iconCol   = dark ? 'rgba(255,255,255,0.32)' : '#9ca3af';
  const dropBg    = '#ffffff';
  const labelCol  = '#6b7280';
  const hoverBg   = 'rgba(220,38,38,0.05)';
  const activeBg  = 'rgba(220,38,38,0.09)';

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...wrapStyle }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', background: bg, border, borderRadius: '10px', overflow: 'hidden' }}>
        <Search size={13} style={{ flexShrink: 0, margin: '0 0 0 13px', color: iconCol, pointerEvents: 'none' }} />
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          value={value}
          onChange={e => onChange?.(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
          placeholder={placeholder}
          style={{
            flex: 1, border: 'none', outline: 'none',
            padding: '10px 12px', fontSize: '13px',
            color: textCol, background: 'transparent',
            fontFamily: "'Outfit',sans-serif",
            ...inputStyle,
          }}
        />
      </form>

      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
          background: dropBg, border: '1px solid rgba(0,0,0,0.09)',
          borderRadius: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.13)',
          zIndex: 500, overflow: 'hidden',
        }}>
          {suggestions.map((s, i) => {
            const parts = [s.brand, s.model, s.variant].filter(Boolean);
            const isActive = i === cursor;
            return (
              <div
                key={`${s.brand}-${s.model}-${s.variant}-${i}`}
                onMouseDown={() => pick(s)}
                onMouseEnter={() => setCursor(i)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', cursor: 'pointer',
                  background: isActive ? activeBg : 'transparent',
                  borderBottom: i < suggestions.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseOver={e => { if (!isActive) e.currentTarget.style.background = hoverBg; }}
                onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  {parts.map((p, pi) => (
                    <React.Fragment key={pi}>
                      {pi > 0 && <span style={{ color: '#d1d5db', fontSize: '11px' }}>·</span>}
                      <span style={{
                        fontSize: '13px', fontFamily: "'Outfit',sans-serif",
                        fontWeight: pi === 0 ? 700 : pi === 1 ? 600 : 400,
                        color: pi === 0 ? '#111827' : pi === 1 ? '#374151' : '#6b7280',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{p}</span>
                    </React.Fragment>
                  ))}
                </div>
                <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700, fontFamily: "'Outfit',sans-serif", flexShrink: 0, marginLeft: '10px' }}>
                  {s.listing_count} {s.listing_count === 1 ? 'car' : 'cars'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
