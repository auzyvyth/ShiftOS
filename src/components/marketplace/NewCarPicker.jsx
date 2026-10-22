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

const rmFrom = (n) => (n ? `From RM ${Number(n).toLocaleString('en-MY')}` : 'See prices');
// A brand tile's price is its cheapest live model: the one number a buyer
// choosing between brands wants.
const brandFrom = (b) => b.models.reduce((lo, m) => (m.from && (!lo || m.from < lo) ? m.from : lo), null);

export default function NewCarPicker({ brands }) {
  const [brand, setBrand] = useState(null);
  const models = brands.find((b) => b.brand === brand)?.models || [];
  // The model page sorts advisors by this; the buyer can change it there.
  const state = readBuyerState(MY_STATES);
  const href = (m) => newModelPath(brand, m) + (state ? `?state=${encodeURIComponent(state)}` : '');

  // No heading row (owner, 2026-10-22): the tiles ARE the question, and every
  // word sits UNDER its picture. Only what a buyer decides on: brand, model, price.
  return (
    <div className="mp-ncp">
      {!brand ? (
        <div key="brands" className="mp-ncp-brands mp-ncp-step">
          {brands.map((b) => (
            <button key={b.brand} type="button" className="mp-ncp-brand" onClick={() => setBrand(b.brand)}>
              <span className="mp-ncp-mark">
                {LOGOS[b.brand]
                  ? <img src={LOGOS[b.brand]} alt={b.brand} loading="lazy" />
                  : <span className="mp-ncp-word">{b.brand}</span>}
              </span>
              <span className="mp-ncp-sub">{rmFrom(brandFrom(b))}</span>
            </button>
          ))}
        </div>
      ) : (
        <div key="models" className="mp-ncp-step">
          <div className="mp-ncp-models">
            {models.map((m) => {
              const img = cdnImg(m.photo, 300, 65);
              return (
                <Link key={m.model} to={href(m.model)} className="mp-ncp-model">
                  <span className="mp-ncp-img" style={img ? { backgroundImage: `url("${img}")` } : undefined} />
                  <span className="mp-ncp-meta">
                    <span className="mp-ncp-mname">{brand} {m.model}</span>
                    <span className="mp-ncp-price">{rmFrom(m.from)}<ChevronRight size={13} /></span>
                  </span>
                </Link>
              );
            })}
          </div>
          <button type="button" className="mp-ncp-back" onClick={() => setBrand(null)}>
            <ChevronLeft size={15} /> All brands
          </button>
        </div>
      )}
    </div>
  );
}

// Light hero surface, Apple-store cards: white, soft corners, no border, a
// shadow that is barely there and lifts on hover. Ink text, grey price, no red:
// the picker has no primary button, the tile IS the action.
export const NEW_CAR_PICKER_CSS = `
  .mp-ncp { margin-bottom:10px; font-family:'Outfit',sans-serif; min-width:0; }
  .mp-ncp-step { animation:mp-ncp-in .32s cubic-bezier(.22,1,.36,1) both; }
  @keyframes mp-ncp-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
  .mp-ncp-brands { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
  .mp-ncp-brand, .mp-ncp-model { background:#fff; border:none; border-radius:18px; cursor:pointer; font:inherit;
    box-shadow:0 0 0 1px rgba(15,17,21,.05), 0 2px 8px rgba(15,17,21,.05);
    transition:transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s cubic-bezier(.22,1,.36,1); }
  .mp-ncp-brand { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; min-height:118px; padding:18px 12px 14px; }
  .mp-ncp-mark { height:48px; display:flex; align-items:center; justify-content:center; }
  .mp-ncp-mark img { max-height:48px; max-width:120px; object-fit:contain; }
  .mp-ncp-word { font-family:'Bebas Neue',sans-serif; font-size:34px; letter-spacing:.03em; line-height:1; color:#1d1d1f; }
  .mp-ncp-sub { font-size:12.5px; font-weight:500; color:#6e6e73; font-variant-numeric:tabular-nums; letter-spacing:.005em; }
  .mp-ncp-models { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(140px,1fr); gap:12px; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; padding:4px 4px 10px; margin:-4px -4px 0; }
  .mp-ncp-models::-webkit-scrollbar { display:none; }
  /* Soft right edge: says "there is more" without a hard cut through a card. */
  .mp-ncp-models { -webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent); mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent); }
  .mp-ncp-model { scroll-snap-align:start; display:flex; flex-direction:column; text-decoration:none; overflow:hidden; }
  .mp-ncp-img { display:block; aspect-ratio:4/3; background:#F5F5F7 center/cover no-repeat; }
  .mp-ncp-meta { display:flex; flex-direction:column; gap:3px; padding:10px 12px 12px; min-width:0; }
  .mp-ncp-mname { font-size:14.5px; font-weight:600; letter-spacing:-.01em; color:#1d1d1f; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mp-ncp-price { display:inline-flex; align-items:center; gap:1px; font-size:12.5px; color:#6e6e73; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .mp-ncp-back { display:inline-flex; align-items:center; gap:2px; margin:4px 0 0 -6px; min-height:36px; padding:0 8px; background:none; border:none; border-radius:9px; font:inherit; font-size:13.5px; font-weight:600; color:#1d1d1f; cursor:pointer; }
  @media (hover:hover) and (pointer:fine) {
    .mp-ncp-brand:hover, .mp-ncp-model:hover { transform:translateY(-2px); box-shadow:0 0 0 1px rgba(15,17,21,.06), 0 12px 28px rgba(15,17,21,.10); }
    .mp-ncp-back:hover { background:rgba(15,17,21,.05); }
  }
  /* Feedback on the press itself, not on release. */
  .mp-ncp-brand:active, .mp-ncp-model:active { transform:scale(.97); transition-duration:.1s; }
  .mp-ncp button:focus-visible, .mp-ncp a:focus-visible { outline:2px solid #1d1d1f; outline-offset:2px; }
  @media (prefers-reduced-motion: reduce) {
    .mp-ncp-brand, .mp-ncp-model { transition:none; }
    .mp-ncp-step { animation:mp-ncp-fade .2s ease both; }
    @keyframes mp-ncp-fade { from { opacity:0; } to { opacity:1; } }
  }
  /* Desktop: the hero centres its column, so a picker that changes height
     between steps moved the headline. Reserve the taller (models) step. */
  @media (min-width:900px) { .mp-ncp { min-height:250px; } }
  @media (min-width:600px) {
    .mp-ncp-brands { grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); }
    .mp-ncp-models { grid-auto-columns:minmax(150px,calc((100% - 36px) / 3.4)); }
  }
`;
