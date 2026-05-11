import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export const PRICE_STEPS = [
  { value: '',        label: 'Any' },
  { value: '10000',   label: 'RM 10k' },
  { value: '20000',   label: 'RM 20k' },
  { value: '30000',   label: 'RM 30k' },
  { value: '40000',   label: 'RM 40k' },
  { value: '50000',   label: 'RM 50k' },
  { value: '60000',   label: 'RM 60k' },
  { value: '70000',   label: 'RM 70k' },
  { value: '80000',   label: 'RM 80k' },
  { value: '90000',   label: 'RM 90k' },
  { value: '100000',  label: 'RM 100k' },
  { value: '200000',  label: 'RM 200k' },
  { value: '300000',  label: 'RM 300k' },
  { value: '400000',  label: 'RM 400k' },
  { value: '500000',  label: 'RM 500k' },
  { value: '600000',  label: 'RM 600k' },
  { value: '700000',  label: 'RM 700k' },
  { value: '800000',  label: 'RM 800k' },
  { value: '900000',  label: 'RM 900k' },
  { value: '1000000', label: 'RM 1M' },
  { value: '2000000', label: 'RM 2M' },
  { value: '3000000', label: 'RM 3M' },
];

const DRUM_H = 44;

function PriceDrum({ value, onChange }) {
  const ref      = useRef(null);
  const timer    = useRef(null);
  const isProg   = useRef(false);
  const wheelAcc = useRef(0);
  const wheelTimer = useRef(null);
  const idx      = PRICE_STEPS.findIndex(s => s.value === (value || ''));

  // Scroll to initial position on mount — dropdown remounts on open so always fresh
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    isProg.current = true;
    el.scrollTop = (idx === -1 ? 0 : idx) * DRUM_H;
  }, []); // eslint-disable-line

  // Intercept wheel/trackpad: accumulate delta, snap by 1 row per gesture tick
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = e => {
      e.preventDefault();
      wheelAcc.current += e.deltaY;
      clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => {
        const steps = Math.round(wheelAcc.current / DRUM_H);
        wheelAcc.current = 0;
        if (steps === 0) return;
        const curI = Math.round(el.scrollTop / DRUM_H);
        const nextI = Math.max(0, Math.min(curI + steps, PRICE_STEPS.length - 1));
        isProg.current = true;
        el.scrollTop = nextI * DRUM_H;
        onChange(PRICE_STEPS[nextI].value);
      }, 50);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onChange]); // eslint-disable-line

  const handleScroll = useCallback(() => {
    // Skip scroll events triggered by our own programmatic scrollTop writes
    if (isProg.current) { isProg.current = false; return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.round(el.scrollTop / DRUM_H);
      const clamped = Math.max(0, Math.min(i, PRICE_STEPS.length - 1));
      isProg.current = true;
      el.scrollTop = clamped * DRUM_H;
      onChange(PRICE_STEPS[clamped].value);
    }, 100);
  }, [onChange]);

  return (
    <div style={{ position:'relative', height:DRUM_H*5, borderRadius:10, border:'1px solid rgba(0,0,0,0.09)', overflow:'hidden', background:'#fff' }}>
      {/* selection band */}
      <div style={{ position:'absolute', top:DRUM_H*2, left:0, right:0, height:DRUM_H, background:'rgba(220,38,38,0.06)', borderTop:'1.5px solid rgba(220,38,38,0.25)', borderBottom:'1.5px solid rgba(220,38,38,0.25)', pointerEvents:'none', zIndex:2 }}/>
      {/* top fade */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:DRUM_H*2, background:'linear-gradient(to bottom, rgba(255,255,255,0.96) 20%, transparent)', pointerEvents:'none', zIndex:3 }}/>
      {/* bottom fade */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:DRUM_H*2, background:'linear-gradient(to top, rgba(255,255,255,0.96) 20%, transparent)', pointerEvents:'none', zIndex:3 }}/>
      {/* scroll list */}
      <div ref={ref} onScroll={handleScroll}
        style={{ height:'100%', overflowY:'scroll', scrollbarWidth:'none', msOverflowStyle:'none', WebkitOverflowScrolling:'touch' }}>
        <div style={{ height:DRUM_H*2 }}/>
        {PRICE_STEPS.map((s, i) => (
          <div key={s.value || 'any'}
            onClick={() => { isProg.current = true; if (ref.current) ref.current.scrollTo({ top: i * DRUM_H, behavior:'smooth' }); onChange(s.value); }}
            style={{ height:DRUM_H, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:s.value===(value||'')?700:400, color:s.value===(value||'')?'#dc2626':'#374151', fontFamily:"'Outfit',sans-serif", cursor:'pointer', userSelect:'none', transition:'color 0.1s, font-weight 0.1s' }}>
            {s.label}
          </div>
        ))}
        <div style={{ height:DRUM_H*2 }}/>
      </div>
    </div>
  );
}

export function PriceDrumPicker({ minValue = '', maxValue = '', onApply, dark = false }) {
  const [open, setOpen]       = useState(false);
  const [localMin, setLocalMin] = useState('');
  const [localMax, setLocalMax] = useState('');
  const dropRef = useRef(null);

  const minLabel = PRICE_STEPS.find(s => s.value === (minValue || ''))?.label || 'Any';
  const maxLabel = PRICE_STEPS.find(s => s.value === (maxValue || ''))?.label || 'Any';
  const hasValue = minValue || maxValue;

  const openDropdown = () => {
    setLocalMin(minValue || '');
    setLocalMax(maxValue || '');
    setOpen(true);
  };

  const apply = () => { onApply(localMin, localMax); setOpen(false); };
  const clear  = () => { onApply('', '');             setOpen(false); };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const cardBg     = dark ? '#111827'                  : '#ffffff';
  const borderCol  = dark ? 'rgba(255,255,255,0.1)'    : 'rgba(0,0,0,0.09)';
  const labelCol   = dark ? '#64748b'                  : '#94a3b8';
  const clearColor = dark ? 'rgba(255,255,255,0.6)'    : '#6b7280';

  return (
    <div ref={dropRef} style={{ position:'relative' }}>
      {/* Trigger button */}
      <button onClick={openDropdown}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background: hasValue ? 'rgba(220,38,38,0.06)' : cardBg, border:`1px solid ${hasValue ? 'rgba(220,38,38,0.3)' : borderCol}`, borderRadius:10, padding:'10px 13px', cursor:'pointer', fontSize:13, fontWeight: hasValue ? 600 : 400, color: hasValue ? '#dc2626' : labelCol, fontFamily:"'Outfit',sans-serif", transition:'all 0.15s' }}>
        <span>{hasValue ? `${minLabel} – ${maxLabel}` : 'Any price'}</span>
        <ChevronDown size={14} style={{ flexShrink:0, opacity:0.45 }}/>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:300, background:'#ffffff', border:'1px solid rgba(0,0,0,0.1)', borderRadius:14, padding:'16px', boxShadow:'0 16px 48px rgba(0,0,0,0.15)' }}>
          <div style={{ display:'flex', gap:10, marginBottom:12 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ margin:'0 0 5px', fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:"'Outfit',sans-serif" }}>Min</p>
              <PriceDrum value={localMin} onChange={setLocalMin} />
            </div>
            <div style={{ display:'flex', alignItems:'center', paddingTop: DRUM_H*2 + 18, color:'#d1d5db', fontSize:18, lineHeight:1, flexShrink:0 }}>—</div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ margin:'0 0 5px', fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:"'Outfit',sans-serif" }}>Max</p>
              <PriceDrum value={localMax} onChange={setLocalMax} />
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={clear}
              style={{ flex:1, background:'transparent', border:'1px solid rgba(0,0,0,0.09)', borderRadius:9, padding:'10px', fontSize:13, fontWeight:600, cursor:'pointer', color:clearColor, fontFamily:"'Outfit',sans-serif" }}>
              Clear
            </button>
            <button onClick={apply}
              style={{ flex:2, background:'#dc2626', border:'none', borderRadius:9, padding:'10px', fontSize:13, fontWeight:700, cursor:'pointer', color:'#fff', fontFamily:"'Outfit',sans-serif" }}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
