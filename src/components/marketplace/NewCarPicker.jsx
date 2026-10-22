import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MY_STATES } from '../../utils/locations';
import { newModelPath } from '../../utils/newCars';

// The marketplace hero's "New" mode (owner, 2026-10-22): brand -> model ->
// state -> the model page (/new-cars/:brand/:model), which lists the advisors.
// New cars are never browsed card by card like used stock: the brand sets the
// price, so a grid of identical cards is noise. The advisors are what differ.
//
// `brands` comes from liveNewCarBrands() (src/utils/newCars.js): only brands and
// models with a live advisor card. Location is a SORT on the model page, not a
// filter, so "Any state" is always allowed and no pick lands on an empty list.
const STATE_KEY = 'xd_buyer_state';

function readState() {
  try { const s = localStorage.getItem(STATE_KEY); return MY_STATES.includes(s) ? s : ''; } catch { return ''; }
}

const rm = (n) => (n ? 'From RM ' + Number(n).toLocaleString('en-MY') : 'Price on the page');

export default function NewCarPicker({ brands }) {
  const navigate = useNavigate();
  const [brand, setBrand] = useState(null);
  const [model, setModel] = useState(null);
  const [state, setState] = useState(readState);

  const models = brands.find((b) => b.brand === brand)?.models || [];
  const step = !brand ? 1 : !model ? 2 : 3;

  const go = () => {
    try { if (state) localStorage.setItem(STATE_KEY, state); } catch { /* private mode */ }
    navigate(newModelPath(brand, model) + (state ? `?state=${encodeURIComponent(state)}` : ''));
  };

  const back = () => (model ? setModel(null) : setBrand(null));

  return (
    <div className="mp-ncp">
      <div className="mp-ncp-head">
        {step > 1 ? (
          <button type="button" className="mp-ncp-back" onClick={back}>
            <ChevronLeft size={14} /> {step === 2 ? 'Brands' : brand}
          </button>
        ) : <span className="mp-ncp-q">Pick a brand</span>}
        <span className="mp-ncp-step">Step {step} of 3</span>
      </div>

      {step === 1 && (
        <div className="mp-ncp-brands">
          {brands.map((b) => (
            <button key={b.brand} type="button" className="mp-ncp-brand" onClick={() => setBrand(b.brand)}>
              <span className="mp-ncp-bname">{b.brand}</span>
              <span className="mp-ncp-sub">{b.models.length} {b.models.length === 1 ? 'model' : 'models'}</span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="mp-ncp-models" role="list">
          {models.map((m) => (
            <button key={m.model} type="button" role="listitem" className="mp-ncp-model" onClick={() => setModel(m.model)}>
              <span className="mp-ncp-mname">{brand} {m.model}</span>
              <span className="mp-ncp-sub">{rm(m.from)}</span>
              <ChevronRight size={14} color="#9ca3af" />
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="mp-ncp-loc">
          <p className="mp-ncp-pick">{brand} {model}</p>
          <label className="mp-ncp-label" htmlFor="mp-ncp-state">Where are you?</label>
          <div className="mp-ncp-row">
            <select id="mp-ncp-state" value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Any state</option>
              {MY_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" className="mp-ncp-go" onClick={go}>See advisors</button>
          </div>
          <p className="mp-ncp-note">Advisors near you are listed first. The price is set by {brand}, the same at every advisor in your region.</p>
        </div>
      )}
    </div>
  );
}

// Light hero surface; same inset fill (#F4F3EF) and ink/red rules as the search
// bar it stands in for. Red is the one primary action ("See advisors").
export const NEW_CAR_PICKER_CSS = `
  .mp-ncp { background:#F4F3EF; border:1px solid #E7E4DB; border-radius:14px; padding:12px; margin-bottom:10px; font-family:'Outfit',sans-serif; }
  .mp-ncp-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; min-height:24px; }
  .mp-ncp-q { font-size:13px; font-weight:700; color:#111827; }
  .mp-ncp-step { font-size:11px; font-weight:600; color:#6b7280; flex-shrink:0; }
  .mp-ncp-back { display:inline-flex; align-items:center; gap:2px; background:none; border:none; padding:0; font:inherit; font-size:13px; font-weight:700; color:#111827; cursor:pointer; min-width:0; }
  .mp-ncp-brands { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
  .mp-ncp-brand { display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-height:56px; padding:10px 12px; background:#fff; border:1px solid #ECEAE3; border-radius:10px; cursor:pointer; text-align:left; font:inherit; }
  .mp-ncp-bname { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:.02em; color:#0f1115; line-height:1; }
  .mp-ncp-sub { font-size:12px; color:#6b7280; font-variant-numeric:tabular-nums; }
  .mp-ncp-models { display:flex; flex-direction:column; background:#fff; border:1px solid #ECEAE3; border-radius:10px; max-height:232px; overflow-y:auto; }
  .mp-ncp-model { display:grid; grid-template-columns:minmax(0,1fr) auto auto; align-items:center; gap:10px; min-height:46px; padding:8px 12px; background:none; border:none; border-top:1px solid rgba(0,0,0,.06); cursor:pointer; text-align:left; font:inherit; }
  .mp-ncp-model:first-child { border-top:none; }
  .mp-ncp-mname { font-size:14px; font-weight:600; color:#111827; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .mp-ncp-pick { margin:0 0 10px; font-family:'Bebas Neue',sans-serif; font-size:24px; letter-spacing:.02em; color:#0f1115; line-height:1; }
  .mp-ncp-label { display:block; font-size:12px; font-weight:600; color:#4b5563; margin-bottom:6px; }
  .mp-ncp-row { display:flex; flex-direction:column; gap:8px; }
  .mp-ncp-row select { min-height:46px; padding:0 12px; border-radius:10px; border:1px solid #E2DFD6; background:#fff; font:inherit; font-size:16px; color:#111827; }
  .mp-ncp-go { min-height:46px; padding:0 28px; border:none; border-radius:10px; background:#dc2626; color:#fff; font:inherit; font-size:14px; font-weight:700; cursor:pointer; }
  .mp-ncp-note { margin:10px 0 0; font-size:12px; line-height:1.5; color:#6b7280; }
  @media (hover:hover) and (pointer:fine) {
    .mp-ncp-brand:hover { border-color:#0f1115; }
    .mp-ncp-model:hover { background:#FAF9F6; }
    .mp-ncp-go:hover { background:#b91c1c; }
  }
  .mp-ncp button:focus-visible, .mp-ncp select:focus-visible { outline:2px solid #0f1115; outline-offset:1px; }
  @media (min-width:600px) {
    .mp-ncp-brands { grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); }
    .mp-ncp-row { flex-direction:row; }
    .mp-ncp-row select { flex:1; min-width:0; }
  }
`;
