import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, X } from 'lucide-react';
import { publicClient } from '../../supabaseClient';
import { withTimeout } from '../../config/marketplaceConfig';
import { cdnImg } from '../../utils/img';
import { MY_STATES } from '../../utils/locations';
import { liveNewCarBrands, newModelPath, readBuyerState } from '../../utils/newCars';
import { LOGOS } from './NewCarPicker';

// "Buying new?" on /showroom (MARKET-CLEAN, 2026-11-16, owner: "place the new
// brands under there, their logos"). The showroom is used + recon only (model
// cards never enter it), so a buyer who wants a new car had no way in from here.
// One row of brand logos under the body-type chips; a tap opens that brand's
// models in place, each going to /new-cars/:brand/:model. Brands come from LIVE
// model cards (liveNewCarBrands), so a brand with no advisor never shows, and the
// whole row hides when there is none (a link must never lead to an empty page).
export default function NewBrandRow() {
  const [brands, setBrands] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let alive = true;
    withTimeout(
      publicClient.from('public_car_listings')
        .select('brand,model,selling_price,images')
        .in('status', ['available', 'reserved'])
        .eq('is_model_card', true)
        .limit(500),
    )
      .then(({ data, error }) => { if (alive && !error) setBrands(liveNewCarBrands(data)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!brands.length) return null;
  const state = readBuyerState(MY_STATES);
  const models = brands.find((b) => b.brand === open)?.models || [];

  return (
    <div className="nbr">
      <style>{NBR_CSS}</style>
      <div className="nbr-row">
        <span className="nbr-label">Buying new?</span>
        {brands.map((b) => (
          <button key={b.brand} type="button" className="nbr-brand" aria-pressed={open === b.brand}
            onClick={() => setOpen(open === b.brand ? null : b.brand)}>
            {LOGOS[b.brand]
              ? <img src={LOGOS[b.brand]} alt={b.brand} loading="lazy" />
              : <span className="nbr-word">{b.brand}</span>}
          </button>
        ))}
      </div>
      {open && (
        <div className="nbr-models">
          {models.map((m) => (
            <Link key={m.model} className="nbr-model"
              to={newModelPath(open, m.model) + (state ? `?state=${encodeURIComponent(state)}` : '')}>
              {m.photo
                ? <span className="nbr-img" style={{ backgroundImage: `url("${cdnImg(m.photo, 300, 65)}")` }} />
                : <span className="nbr-img nbr-noimg"><Car size={28} strokeWidth={1.5} /></span>}
              <span className="nbr-mname">{open} {m.model}</span>
              <span className="nbr-price">{m.from ? `From RM ${Number(m.from).toLocaleString('en-MY')}` : 'See prices'}</span>
            </Link>
          ))}
          <button type="button" className="nbr-close" aria-label="Close" onClick={() => setOpen(null)}><X size={16} /></button>
        </div>
      )}
    </div>
  );
}

const NBR_CSS = `
  .nbr { font-family:'Outfit',sans-serif; margin-top:8px; }
  .nbr-row { display:flex; align-items:center; gap:8px; overflow-x:auto; scrollbar-width:none; padding-bottom:2px; }
  .nbr-row::-webkit-scrollbar { display:none; }
  .nbr-label { flex-shrink:0; font-size:12px; font-weight:600; color:#6b7280; margin-right:2px; white-space:nowrap; }
  .nbr-brand { flex-shrink:0; height:44px; min-width:76px; padding:0 12px; display:flex; align-items:center; justify-content:center;
    background:#fff; border:1px solid rgba(15,17,21,.10); border-radius:8px; cursor:pointer; }
  .nbr-brand[aria-pressed="true"] { border-color:#0f1115; box-shadow:0 0 0 1px #0f1115; }
  .nbr-brand img { max-height:32px; max-width:84px; object-fit:contain; display:block; }
  .nbr-word { font-family:'Bebas Neue',sans-serif; font-size:18px; letter-spacing:.03em; color:#0f1115; }
  .nbr-models { position:relative; display:grid; grid-auto-flow:column; grid-auto-columns:150px; gap:10px; overflow-x:auto;
    scrollbar-width:none; margin-top:10px; padding:2px 40px 6px 2px; }
  .nbr-models::-webkit-scrollbar { display:none; }
  .nbr-model { display:flex; flex-direction:column; background:#fff; border-radius:12px; overflow:hidden; text-decoration:none;
    box-shadow:0 0 0 1px rgba(15,17,21,.06), 0 2px 8px rgba(15,17,21,.05); }
  .nbr-img { display:block; aspect-ratio:4/3; background:#F5F5F7 center/cover no-repeat; }
  .nbr-noimg { display:flex; align-items:center; justify-content:center; color:#c4c7cc; }
  .nbr-mname { padding:8px 10px 0; font-size:13.5px; font-weight:600; color:#0f1115; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .nbr-price { padding:2px 10px 10px; font-size:12px; color:#6b7280; font-variant-numeric:tabular-nums; }
  .nbr-close { position:sticky; right:0; align-self:start; width:32px; height:32px; border-radius:50%; border:0; background:#fff;
    box-shadow:0 0 0 1px rgba(15,17,21,.10); display:flex; align-items:center; justify-content:center; cursor:pointer; color:#0f1115; }
`;
