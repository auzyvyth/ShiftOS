import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { BRANDS, BODY_TYPES, TRANSMISSIONS, FINANCING_TYPES, MY_STATES, YEARS, MILEAGE_OPTIONS, CONDITION_OPTIONS } from '../../config/marketplaceConfig';
import { CAR_DATA } from '../CarForm';

export default function AdvancedSearchModal({ open, onClose, heroQ, heroBudget, onApply }) {
  const [advBrand,        setAdvBrand]        = useState('');
  const [advBodyType,     setAdvBodyType]     = useState('');
  const [advCondition,    setAdvCondition]    = useState('');
  const [advState,        setAdvState]        = useState('');
  const [advYearFrom,     setAdvYearFrom]     = useState('');
  const [advYearTo,       setAdvYearTo]       = useState('');
  const [advMileageMax,   setAdvMileageMax]   = useState('');
  const [advTransmission, setAdvTransmission] = useState('');
  const [advFinancing,    setAdvFinancing]    = useState('');
  const [advModel,        setAdvModel]        = useState('');
  const [advVariant,      setAdvVariant]      = useState('');

  if (!open) return null;

  const clearAll = () => {
    setAdvBrand(''); setAdvBodyType(''); setAdvCondition(''); setAdvState('');
    setAdvYearFrom(''); setAdvYearTo(''); setAdvMileageMax(''); setAdvTransmission('');
    setAdvFinancing(''); setAdvModel(''); setAdvVariant('');
  };

  const handleApply = () => {
    const p = new URLSearchParams();
    if (heroQ)           p.set('q', heroQ);
    if (heroBudget)      p.set('max_price', heroBudget);
    if (advBrand)        p.set('brand', advBrand);
    if (advBodyType)     p.set('body_type', advBodyType);
    if (advCondition)    p.set('condition', advCondition);
    if (advState)        p.set('state', advState);
    if (advYearFrom)     p.set('year_from', advYearFrom);
    if (advYearTo)       p.set('year_to', advYearTo);
    if (advMileageMax)   p.set('mileage_max', advMileageMax);
    if (advTransmission) p.set('transmission', advTransmission);
    if (advFinancing)    p.set('financing', advFinancing);
    if (advModel)        p.set('model', advModel);
    if (advVariant)      p.set('variant', advVariant);
    onClose();
    onApply(p);
  };

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)' }}/>
      <div className="mp-adv-modal" style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:201, width:'min(500px,92vw)', maxHeight:'min(580px,85vh)', overflowY:'auto', background:'#0c0f16', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'20px', fontFamily:"'Outfit',sans-serif", boxShadow:'0 24px 80px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px 14px', borderBottom:'1px solid rgba(255,255,255,0.07)', position:'sticky', top:0, background:'#0c0f16', zIndex:1 }}>
          <div>
            <p style={{ margin:0, fontSize:'14px', fontWeight:'700', color:'#fff', fontFamily:"'Outfit',sans-serif" }}>Advanced Search</p>
            <p style={{ margin:0, fontSize:'11px', color:'rgba(255,255,255,0.32)', marginTop:'1px', fontFamily:"'Outfit',sans-serif" }}>Narrow down your perfect car</p>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.07)', border:'none', color:'rgba(255,255,255,0.55)', width:'30px', height:'30px', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <X size={13}/>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding:'16px 20px' }}>
          {[
            { key:'condition',    label:'Condition',   options: CONDITION_OPTIONS.map(c => ({ val:c.value, label:c.label })), get: advCondition,    set: setAdvCondition },
            { key:'transmission', label:'Transmission', options: TRANSMISSIONS.map(t => ({ val:t, label:t })),                 get: advTransmission, set: setAdvTransmission },
            { key:'financing',    label:'Payment',      options: FINANCING_TYPES.map(f => ({ val:f.value, label:f.label })),   get: advFinancing,    set: setAdvFinancing },
          ].map(row => (
            <div key={row.key} style={{ display:'grid', gridTemplateColumns:'90px 1fr', alignItems:'center', gap:'10px', marginBottom:'10px', minHeight:'32px' }}>
              <span style={{ fontSize:'10px', fontWeight:'700', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{row.label}</span>
              <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
                {row.options.map(o => (
                  <button key={o.val} type="button" onClick={() => row.set(row.get === o.val ? '' : o.val)}
                    style={{ padding:'5px 11px', borderRadius:'50px', border:`1px solid ${row.get===o.val?'rgba(220,38,38,0.55)':'rgba(255,255,255,0.1)'}`, background: row.get===o.val?'rgba(220,38,38,0.18)':'transparent', color: row.get===o.val?'#f87171':'rgba(255,255,255,0.48)', fontSize:'11px', fontWeight:'600', cursor:'pointer', fontFamily:"'Outfit',sans-serif", transition:'all 0.12s' }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', margin:'8px 0 14px' }}/>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            {/* Brand */}
            <div>
              <p style={{ margin:'0 0 5px', fontSize:'9px', fontWeight:'700', color:'rgba(255,255,255,0.28)', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:"'Outfit',sans-serif" }}>Brand</p>
              <div style={{ position:'relative' }}>
                <select value={advBrand} onChange={e=>{ setAdvBrand(e.target.value); setAdvModel(''); }}
                  style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'9px', padding:'9px 26px 9px 11px', color: advBrand?'#fff':'rgba(255,255,255,0.38)', fontSize:'12px', appearance:'none', cursor:'pointer', outline:'none', fontFamily:"'Outfit',sans-serif" }}>
                  <option value="" style={{ background:'#0d1117' }}>All Brands</option>
                  {BRANDS.map(b => <option key={b} value={b} style={{ background:'#0d1117' }}>{b}</option>)}
                </select>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2.5" strokeLinecap="round" style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </div>
            {/* Model */}
            <div>
              <p style={{ margin:'0 0 5px', fontSize:'9px', fontWeight:'700', color:'rgba(255,255,255,0.28)', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:"'Outfit',sans-serif" }}>Model</p>
              <div style={{ position:'relative' }}>
                <select value={advModel} onChange={e=>setAdvModel(e.target.value)} disabled={!advBrand}
                  style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'9px', padding:'9px 26px 9px 11px', color: advModel?'#fff':'rgba(255,255,255,0.38)', fontSize:'12px', appearance:'none', cursor: advBrand?'pointer':'not-allowed', outline:'none', fontFamily:"'Outfit',sans-serif", opacity: advBrand?1:0.4 }}>
                  <option value="" style={{ background:'#0d1117' }}>{advBrand ? 'All Models' : 'Select brand first'}</option>
                  {(CAR_DATA[advBrand]||[]).map(m => <option key={m} value={m} style={{ background:'#0d1117' }}>{m}</option>)}
                </select>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2.5" strokeLinecap="round" style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </div>
            {[
              { label:'Body Type',  val:advBodyType,   set:setAdvBodyType,   opts:BODY_TYPES.map(b=>({v:b,l:b})),            placeholder:'All Types' },
              { label:'State',      val:advState,      set:setAdvState,      opts:MY_STATES.map(s=>({v:s,l:s})),             placeholder:'All States' },
              { label:'Max Mileage',val:advMileageMax, set:setAdvMileageMax, opts:MILEAGE_OPTIONS.map(o=>({v:o.value,l:o.label})), placeholder:'Any km' },
              { label:'Year From',  val:advYearFrom,   set:setAdvYearFrom,   opts:YEARS.map(y=>({v:y,l:y})),                 placeholder:'From' },
              { label:'Year To',    val:advYearTo,     set:setAdvYearTo,     opts:YEARS.map(y=>({v:y,l:y})),                 placeholder:'To' },
            ].map(({ label, val, set, opts, placeholder }) => (
              <div key={label}>
                <p style={{ margin:'0 0 5px', fontSize:'9px', fontWeight:'700', color:'rgba(255,255,255,0.28)', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:"'Outfit',sans-serif" }}>{label}</p>
                <div style={{ position:'relative' }}>
                  <select value={val} onChange={e=>set(e.target.value)}
                    style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'9px', padding:'9px 26px 9px 11px', color: val?'#fff':'rgba(255,255,255,0.38)', fontSize:'12px', appearance:'none', cursor:'pointer', outline:'none', fontFamily:"'Outfit',sans-serif" }}>
                    <option value="" style={{ background:'#0d1117' }}>{placeholder}</option>
                    {opts.map(o => <option key={o.v} value={o.v} style={{ background:'#0d1117' }}>{o.l}</option>)}
                  </select>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2.5" strokeLinecap="round" style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><path d="M6 9l6 6 6-6"/></svg>
                </div>
              </div>
            ))}
          </div>

          {advModel && (
            <div style={{ marginTop:'10px' }}>
              <p style={{ margin:'0 0 5px', fontSize:'9px', fontWeight:'700', color:'rgba(255,255,255,0.28)', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:"'Outfit',sans-serif" }}>Variant</p>
              <input type="text" value={advVariant} onChange={e=>setAdvVariant(e.target.value)} placeholder="e.g. 1.5 G"
                style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:'9px', padding:'9px 11px', color:'#fff', fontSize:'12px', outline:'none', fontFamily:"'Outfit',sans-serif", boxSizing:'border-box' }}/>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 20px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', gap:'8px', position:'sticky', bottom:0, background:'#0c0f16' }}>
          <button type="button" onClick={clearAll}
            style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', color:'rgba(255,255,255,0.5)', fontSize:'12px', fontWeight:'600', borderRadius:'10px', padding:'10px', cursor:'pointer', fontFamily:"'Outfit',sans-serif" }}>
            Clear all
          </button>
          <button type="button" onClick={handleApply}
            style={{ flex:2, background:'#dc2626', border:'none', color:'white', fontSize:'12px', fontWeight:'700', borderRadius:'10px', padding:'10px', cursor:'pointer', fontFamily:"'Outfit',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
            <Search size={12}/> Search
          </button>
        </div>
      </div>
    </>
  );
}
