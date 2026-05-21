import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function SearchAutocomplete({
  value = '',
  onChange,
  onSubmit,
  navigateTo = '/showroom',
  placeholder = 'Search brand, model, variant…',
  inputStyle = {},
  wrapStyle = {},
  dark = false,
}) {
  const navigate                       = useNavigate();
  const [suggestions, setSuggestions]  = useState([]);
  const [open, setOpen]                = useState(false);
  const [cursor, setCursor]            = useState(-1);
  const [dropPos, setDropPos]          = useState({ top: 0, left: 0, width: 0 });
  const debounce                       = useRef(null);
  const wrapRef                        = useRef(null);

  const updatePos = useCallback(() => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 5, left: r.left, width: r.width });
  }, []);

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
        updatePos();
      } else {
        setSuggestions([]);
        setOpen(false);
      }
    }, 300);
  }, [updatePos]);

  useEffect(() => { query(value); }, [value, query]);

  // Reposition on scroll / resize while open
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pick = (s) => {
    setOpen(false);
    setSuggestions([]);
    onChange?.('');
    const p = new URLSearchParams();
    if (s.brand)   p.set('brand', s.brand);
    if (s.model)   p.set('model', s.model);
    if (s.variant) p.set('variant', s.variant);
    navigate(`${navigateTo}${p.toString() ? `?${p}` : ''}`);
  };

  const handleKey = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown')                  { e.preventDefault(); setCursor(c => Math.min(c + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp')               { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)); }
    else if (e.key === 'Enter' && cursor >= 0)  { e.preventDefault(); pick(suggestions[cursor]); }
    else if (e.key === 'Escape')                { setOpen(false); setCursor(-1); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setOpen(false);
    onSubmit?.(value);
  };

  const bg      = dark ? 'rgba(255,255,255,0.06)' : '#ffffff';
  const border  = dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)';
  const textCol = dark ? '#ffffff' : '#111827';
  const iconCol = dark ? 'rgba(255,255,255,0.32)' : '#9ca3af';
  const hoverBg = 'rgba(220,38,38,0.05)';
  const activeBg = 'rgba(220,38,38,0.09)';

  const dropdown = open && suggestions.length > 0 && createPortal(
    <div style={{
      position: 'fixed',
      top: dropPos.top,
      left: dropPos.left,
      width: dropPos.width,
      background: '#ffffff',
      border: '1px solid rgba(0,0,0,0.09)',
      borderRadius: '12px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
      zIndex: 99999,
      overflow: 'hidden',
      maxHeight: '60vh',
      overflowY: 'auto',
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
            }}
            onMouseOver={e => { if (!isActive) e.currentTarget.style.background = hoverBg; }}
            onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
              {parts.map((p, pi) => (
                <React.Fragment key={pi}>
                  {pi > 0 && <span style={{ color: '#d1d5db', fontSize: '11px', flexShrink: 0 }}>·</span>}
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
    </div>,
    document.body
  );

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...wrapStyle }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', background: bg, border, borderRadius: '10px', overflow: 'hidden' }}>
        <Search size={13} style={{ flexShrink: 0, margin: '0 0 0 13px', color: iconCol, pointerEvents: 'none' }} />
        <input
          type="text"
          autoComplete="off"
          value={value}
          onChange={e => onChange?.(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => { if (suggestions.length) { setOpen(true); updatePos(); } }}
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
      {dropdown}
    </div>
  );
}
