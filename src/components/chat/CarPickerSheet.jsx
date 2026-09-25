import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Car } from 'lucide-react';
import { supabase } from '../../supabaseClient';

// The seller's "send a car" list. Every row comes from chat_sendable_cars,
// which applies the SAME rule the insert policy does (chat_can_send_car), so
// nothing offered here can be rejected on send for being the wrong car.
// In a Find me chat the cars that fit the buyer's post come first.

export const carTitle = (c) =>
  [c.year, c.brand, c.model, c.variant].filter(Boolean).join(' ');

export const fmtRM = (n) => (Number(n) > 0 ? `RM ${Number(n).toLocaleString('en-MY')}` : null);

export default function CarPickerSheet({ threadId, t, onPick, onClose }) {
  const [cars, setCars] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let live = true;
    supabase.rpc('chat_sendable_cars', { p_thread_id: threadId }).then(({ data, error: err }) => {
      if (!live) return;
      if (err) { console.error('chat_sendable_cars:', err); setError('Could not load your cars. Try again.'); return; }
      setCars(data || []);
    });
    return () => { live = false; };
  }, [threadId]);

  // Overlay rule 2. The chat under this sheet has usually locked the body
  // already, so restore what was there rather than '' — or closing the picker
  // would unlock the page under a chat that is still open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!cars) return [];
    return needle ? cars.filter(c => carTitle(c).toLowerCase().includes(needle)) : cars;
  }, [cars, q]);
  const fits = shown.filter(c => c.match_rank === 2);
  const rest = shown.filter(c => c.match_rank !== 2);

  const row = (c) => (
    <button key={c.id} type="button" onClick={() => onPick(c)}
      style={{ display:'flex', alignItems:'center', gap:11, width:'100%', padding:'9px 10px', border:'none', borderRadius:10, background:'transparent', color:t.text, cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
      {c.image
        ? <img src={c.image} alt="" style={{ width:56, height:42, borderRadius:7, objectFit:'cover', flexShrink:0, border:`1px solid ${t.border}` }} />
        : <span style={{ width:56, height:42, borderRadius:7, flexShrink:0, background:t.theirs, display:'flex', alignItems:'center', justifyContent:'center', color:t.sub }}><Car size={18} /></span>}
      <span style={{ flex:1, minWidth:0 }}>
        <span style={{ display:'block', fontSize:13.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{carTitle(c)}</span>
        <span style={{ display:'block', fontSize:12, color:t.sub }}>
          {[fmtRM(c.selling_price), Number(c.mileage) > 0 ? `${Number(c.mileage).toLocaleString('en-MY')} km` : null, c.status === 'reserved' ? 'Reserved' : null].filter(Boolean).join(' · ')}
        </span>
      </span>
    </button>
  );

  const label = (text) => (
    <p style={{ margin:'10px 10px 4px', fontSize:11, fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase', color:t.sub }}>{text}</p>
  );

  return createPortal(
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, zIndex:12000, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Send a car"
        style={{ width:'100%', maxWidth:520, maxHeight:'80vh', display:'flex', flexDirection:'column', background:t.bg, color:t.text, borderRadius:'16px 16px 0 0', border:`1px solid ${t.border}`, boxShadow:t.shadow, fontFamily:'system-ui,sans-serif', boxSizing:'border-box' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 14px 10px' }}>
          <p style={{ margin:0, flex:1, fontSize:15, fontWeight:700 }}>Send a car</p>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background:'none', border:'none', color:t.sub, cursor:'pointer', padding:4, display:'flex' }}>
            <X size={18} />
          </button>
        </div>
        {cars && cars.length > 6 && (
          <div style={{ padding:'0 14px 8px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, border:`1px solid ${t.border}`, borderRadius:10, padding:'0 10px', background:t.inputBg }}>
              <Search size={14} style={{ color:t.sub, flexShrink:0 }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search your cars" aria-label="Search your cars"
                style={{ flex:1, minWidth:0, padding:'9px 0', border:'none', background:'transparent', color:t.text, fontSize:14, outline:'none', fontFamily:'inherit' }} />
            </div>
          </div>
        )}
        <div style={{ flex:1, minHeight:0, overflowY:'auto', padding:'0 4px 16px' }}>
          {error ? (
            <p style={{ margin:'16px 14px', fontSize:13, color:'#f87171' }}>{error}</p>
          ) : cars === null ? (
            <p style={{ margin:'16px 14px', fontSize:13, color:t.sub }}>Loading your cars…</p>
          ) : cars.length === 0 ? (
            <p style={{ margin:'16px 14px', fontSize:13, color:t.sub, lineHeight:1.55 }}>
              No cars to send yet. Cars show here once they are listed as available or reserved in your stock.
            </p>
          ) : shown.length === 0 ? (
            <p style={{ margin:'16px 14px', fontSize:13, color:t.sub }}>No car matches “{q}”.</p>
          ) : fits.length > 0 ? (
            <>
              {label('Fits their post')}
              {fits.map(row)}
              {rest.length > 0 && label('Your other cars')}
              {rest.map(row)}
            </>
          ) : shown.map(row)}
        </div>
      </div>
    </div>,
    document.body,
  );
}
