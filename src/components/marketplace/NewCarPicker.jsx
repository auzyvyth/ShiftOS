import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cdnImg } from '../../utils/img';
import { MY_STATES } from '../../utils/locations';
import { newModelPath, readBuyerState } from '../../utils/newCars';

// The marketplace hero's "New" mode (owner, 2026-10-22): brand -> model -> the
// model page (/new-cars/:brand/:model), which lists the advisors and asks where
// the buyer is. New cars are never browsed card by card like used stock: the
// brand sets the price, so a grid of identical cards is noise. The advisors are
// what differ.
//
// `brands` comes from liveNewCarBrands() (src/utils/newCars.js): only brands and
// models with a live advisor card, so no tap lands on an empty page.

// Logo files in /public/brands. A brand is listed here only once its CURRENT
// logo is in that folder; the rest render as a wordmark. (proton.svg was the
// ProtonMail logo and was deleted, 2026-10-22; BYD has no file.)
const LOGOS = { Perodua: '/brands/perodua.svg', Toyota: '/brands/toyota.svg', Honda: '/brands/honda.svg' };

const fromPrice = (n) => (n ? `From RM ${Number(n).toLocaleString('en-MY')}` : 'See prices');

export default function NewCarPicker({ brands }) {
  const [brand, setBrand] = useState(null);
  const models = brands.find((b) => b.brand === brand)?.models || [];
  // The model page sorts advisors by this; the buyer can change it there.
  const state = readBuyerState(MY_STATES);
  const href = (m) => newModelPath(brand, m) + (state ? `?state=${encodeURIComponent(state)}` : '');

  return (
    <div className="mp-ncp">
      <div className="mp-ncp-head">
        {brand ? (
          <button type="button" className="mp-ncp-back" onClick={() => setBrand(null)}>
            <ChevronLeft size={15} /> All brands
          </button>
        ) : <span className="mp-ncp-q">Pick a brand</span>}
        <span className="mp-ncp-hint">{brand ? `${models.length} ${models.length === 1 ? 'model' : 'models'}` : 'Official prices, local advisors'}</span>
      </div>

      {!brand ? (
        <div className="mp-ncp-brands">
          {brands.map((b) => (
            <button key={b.brand} type="button" className="mp-ncp-brand" onClick={() => setBrand(b.brand)}>
              <span className="mp-ncp-mark">
                {LOGOS[b.brand]
                  ? <img src={LOGOS[b.brand]} alt={b.brand} loading="lazy" />
                  : <span className="mp-ncp-word">{b.brand}</span>}
              </span>
              <span className="mp-ncp-sub">{b.models.length} {b.models.length === 1 ? 'model' : 'models'}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mp-ncp-models">
          {models.map((m) => {
            const img = cdnImg(m.photo, 300, 65);
            return (
              <Link key={m.model} to={href(m.model)} className="mp-ncp-model">
                <span className="mp-ncp-img" style={img ? { backgroundImage: `url("${img}")` } : undefined} />
                <span className="mp-ncp-meta">
                  <span className="mp-ncp-mname">{m.model}</span>
                  <span className="mp-ncp-price">{fromPrice(m.from)} <ChevronRight size={12} /></span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Light hero surface. Tiles are the same white card as the hero's car rows
// (.mp-carrow-item), so the two halves of the hero read as one language. No red
// here: the picker has no primary button, the tile IS the action.
export const NEW_CAR_PICKER_CSS = `
  .mp-ncp { margin-bottom:10px; font-family:'Outfit',sans-serif; min-width:0; }
  .mp-ncp-head { display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:10px; min-height:22px; }
  .mp-ncp-q { font-size:14px; font-weight:700; color:#111827; }
  .mp-ncp-hint { font-size:12px; color:#6b7280; text-align:right; }
  .mp-ncp-back { display:inline-flex; align-items:center; gap:2px; margin-left:-4px; padding:2px 4px; background:none; border:none; border-radius:6px; font:inherit; font-size:14px; font-weight:700; color:#111827; cursor:pointer; }
  .mp-ncp-brands { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .mp-ncp-brand { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; min-height:112px; padding:14px 10px 12px; background:#fff; border:1px solid #ECEAE3; border-radius:12px; box-shadow:0 1px 3px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.05); cursor:pointer; font:inherit; transition:transform .2s var(--xd-ease-out, ease), box-shadow .2s var(--xd-ease-out, ease), border-color .2s ease; }
  .mp-ncp-mark { height:52px; display:flex; align-items:center; justify-content:center; }
  .mp-ncp-mark img { max-height:52px; max-width:120px; object-fit:contain; }
  .mp-ncp-word { font-family:'Bebas Neue',sans-serif; font-size:36px; letter-spacing:.04em; line-height:1; color:#0f1115; }
  .mp-ncp-sub { font-size:12px; font-weight:500; color:#6b7280; }
  .mp-ncp-models { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(132px,1fr); gap:10px; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; padding:2px 2px 6px; margin:0 -2px; }
  .mp-ncp-models::-webkit-scrollbar { display:none; }
  /* Soft right edge: says "there is more" without a hard cut through a card. */
  .mp-ncp-models { -webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent); mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent); }
  .mp-ncp-model { scroll-snap-align:start; display:flex; flex-direction:column; text-decoration:none; background:#fff; border:1px solid #ECEAE3; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.05); transition:transform .2s var(--xd-ease-out, ease), box-shadow .2s var(--xd-ease-out, ease), border-color .2s ease; }
  .mp-ncp-img { display:block; aspect-ratio:4/3; background:#F0EEE8 center/cover no-repeat; }
  .mp-ncp-meta { display:flex; flex-direction:column; gap:2px; padding:8px 10px 10px; border-top:1px solid rgba(0,0,0,.06); min-width:0; }
  .mp-ncp-mname { font-size:14px; font-weight:700; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mp-ncp-price { display:inline-flex; align-items:center; gap:2px; font-size:12px; color:#4b5563; font-variant-numeric:tabular-nums; white-space:nowrap; }
  @media (hover:hover) and (pointer:fine) {
    .mp-ncp-brand:hover, .mp-ncp-model:hover { transform:translateY(-2px); border-color:rgba(15,17,21,.35); box-shadow:0 10px 24px rgba(15,23,42,.12); }
    .mp-ncp-back:hover { background:rgba(0,0,0,.05); }
  }
  .mp-ncp-brand:active, .mp-ncp-model:active { transform:scale(.98); }
  .mp-ncp button:focus-visible, .mp-ncp a:focus-visible { outline:2px solid #0f1115; outline-offset:2px; }
  @media (prefers-reduced-motion: reduce) { .mp-ncp-brand, .mp-ncp-model { transition:none; } }
  /* Desktop: the hero centres its column, so a picker that changes height
     between steps moved the headline. Reserve the taller (models) step. */
  @media (min-width:900px) { .mp-ncp { min-height:232px; } }
  @media (min-width:600px) {
    .mp-ncp-brands { grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); }
    .mp-ncp-models { grid-auto-columns:minmax(150px,calc((100% - 30px) / 3.4)); }
  }
`;
