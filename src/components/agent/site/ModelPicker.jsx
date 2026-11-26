import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cdnImg } from '../../../utils/img';
import { colourSwatch } from '../../../utils/newCars';
import { pageCalc } from '../../../utils/pageCalc';
import { modelNote, modelRm as rm } from '../../../utils/modelPick';
import { groupBrands, fromPrice, variantLine, stageTag, orderSpecs } from '../../../utils/configurator';
import { LOGOS } from '../../../config/brandLogos';
import { useNewCarInfo, useNewCarVariant, useNewCarInfos, specRows } from '../../newcar/NewCarListingInfo';
import ModelHelper from './ModelHelper';

// The vehicle configurator on a Premium advisor page (CONFIG-1, owner 2026-11-26: a manufacturer's
// configurator, not a listing page). Brand -> model -> the stage (one big car) beside the build panel
// (price, colour, variant, specs, ask). Same data the car page uses: the seller's model cards and the
// brand price list through useNewCarInfo / useNewCarVariant, so a price here is the price there, and
// a variant picked here is the one the car page shows. Rules in src/utils/configurator.js.
// Honest by design: one photo set per MODEL is all we hold, so a colour changes the swatch, its name
// and the words of the ask, never the photo, and the panel says so. Colours only show where the brand
// list names them (Proton, Perodua, BYD today). Prices are the brand's list price for the seller's zone.

const carName = (c) => [c?.brand, c?.model].filter(Boolean).join(' ');

function Photo({ src, alt, w, q, className, eager }) {
  const [bad, setBad] = useState(false);
  useEffect(() => { setBad(false); }, [src]);
  if (!src || bad) return <span className={`cfg-nophoto ${className || ''}`} aria-hidden="true">{alt}</span>;
  return <img className={className} src={cdnImg(src, w, q)} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setBad(true)} />;
}

function Build({ car, note, firstName, hasWa, waUrlFor, onWhatsApp, onCalc }) {
  const raw = useNewCarInfo(car.id);
  const { variants, current, choose } = useNewCarVariant(car.id, raw);
  const [colourPick, setColourPick] = useState(null);
  const [shot, setShot] = useState(0);
  const photos = Array.isArray(car.images) ? car.images.filter(Boolean) : [];
  const colours = Array.isArray(current?.specs?.colours) ? current.specs.colours.filter((x) => typeof x === 'string' && x.trim()) : [];
  const colour = colours.includes(colourPick) ? colourPick : null;
  const price = Number(current?.price) || Number(car.selling_price) || 0;
  const calc = price > 0 ? pageCalc({ ...car, selling_price: price }, { depositPct: 0.1, years: 7 }) : null;
  const info = current ? { ...(raw || {}), ...current, specs: current.specs || {} } : raw;
  const specs = info ? orderSpecs(specRows(info).filter(([k]) => k !== 'Body')) : [];
  const name = carName(car);
  const vname = current?.variant || car.variant || '';
  const tag = stageTag(current, raw);
  const loading = !raw;
  const ask = `Hi ${firstName}, I'm looking at the ${[name, vname].filter(Boolean).join(' ')}${colour ? ` in ${colour}` : ''}${price ? ` (${rm(price)})` : ''}.\nCan you tell me the price, any promo and the stock?`;
  return (
    <div className="cfg-build keep-alpha">
      <div className="cfg-stage">
        <span className="cfg-mark" aria-hidden="true">{car.model}</span>
        {tag && <span className="cfg-tag">{tag}</span>}
        <div className="cfg-car" key={`${car.id}:${shot}`}>
          <Photo src={photos[shot]} alt={name} w={1280} q={80} eager />
        </div>
        <span className="cfg-floor" aria-hidden="true" />
        {photos.length > 1 && (
          <div className="cfg-shots" role="group" aria-label="Photos">
            {photos.slice(0, 6).map((u, i) => (
              <button key={u} type="button" aria-pressed={i === shot} aria-label={`Photo ${i + 1} of ${photos.length}`} onClick={() => setShot(i)}>
                <Photo src={u} alt="" w={160} q={60} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="cfg-panel">
        <p className="cfg-eyebrow">{car.brand}</p>
        <h3 className="cfg-name">{car.model}</h3>
        <p className="cfg-var">{loading ? <span className="cfg-skel" style={{ width: 120 }} /> : (vname || 'Variant')}</p>
        <div className="cfg-price">
          <p className="cfg-lbl">{variants.length > 1 ? 'Price, this variant' : 'Price'}</p>
          <p className="cfg-rm" aria-live="polite">{price > 0 ? rm(price) : 'Ask for the price'}</p>
          {calc && <p className="cfg-est">About {rm(calc.monthly)} a month, 10% deposit, 7 years. An estimate: the bank decides.</p>}
        </div>

        {colours.length > 0 && (
          <div className="cfg-block">
            <p className="cfg-lbl">Colour <b>{colour || 'Choose one'}</b></p>
            <div className="cfg-cols" role="radiogroup" aria-label="Colour">
              {colours.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={c === colour} aria-label={c} title={c} className="cfg-col"
                  onClick={() => setColourPick(c === colour ? null : c)}><i style={{ background: colourSwatch(c) }} /></button>
              ))}
            </div>
            <p className="cfg-fine">Colours offered for this variant, from the brand's list. The photo shows one colour.</p>
          </div>
        )}

        {(loading || variants.length > 1) && (
          <div className="cfg-block">
            <p className="cfg-lbl">Variant</p>
            {loading ? (
              <div className="cfg-vars">{[0, 1, 2].map((i) => <div key={i} className="cfg-v cfg-v--skel"><span className="cfg-skel" /><span className="cfg-skel" style={{ width: 70 }} /></div>)}</div>
            ) : (
              <div className="cfg-vars" role="radiogroup" aria-label="Variant">
                {variants.map((v) => {
                  const line = variantLine(variants, v);
                  return (
                    <button key={v.model_id} type="button" role="radio" aria-checked={v.model_id === current?.model_id} className="cfg-v"
                      onClick={() => choose(v.model_id)}>
                      <span className="cfg-v-n">{v.variant}{line && <small>{line}</small>}</span>
                      <span className="cfg-v-p">{rm(v.price)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {specs.length > 0 && (
          <div className="cfg-block">
            <p className="cfg-lbl">Specifications</p>
            <dl className="cfg-specs">
              {specs.slice(0, 8).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </div>
        )}

        {note && (
          <div className="cfg-note">
            <p className="cfg-lbl">{firstName}'s view</p>
            <p>{note}</p>
          </div>
        )}

        <div className="cfg-act">
          {hasWa && (
            <a className="ps-wa" href={waUrlFor(ask)} target="_blank" rel="noopener noreferrer" onClick={() => onWhatsApp?.('model', car)}>
              Ask price and stock
            </a>
          )}
          {calc && onCalc && (
            <button type="button" className="ps-ghost" onClick={() => onCalc({ carId: car.id, price, variant: vname || null })}>
              Work out my instalment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ModelPicker({ cars, site, firstName, hasWa, waUrlFor, onWhatsApp, onCalc }) {
  const models = useMemo(() => (cars || []).filter((c) => c.is_model_card), [cars]);
  const brands = useMemo(() => groupBrands(models), [models]);
  const [brandKey, setBrandKey] = useState(null);
  const [pickId, setPickId] = useState(null);
  const stageRef = useRef(null);
  // ONE call for every model's variants + specs: the rail's "from" prices and the helper read it.
  const infos = useNewCarInfos(models.map((c) => c.id));
  if (!models.length) return null;

  const brand = brands.find((b) => b.brand === brandKey) || brands.find((b) => b.models.some((c) => c.id === pickId)) || brands[0];
  const car = brand.models.find((c) => c.id === pickId) || brand.models[0];
  const pickBrand = (b) => { setBrandKey(b.brand); setPickId(b.models[0]?.id || null); };
  const show = (id) => {
    const b = brands.find((x) => x.models.some((c) => c.id === id));
    if (b) setBrandKey(b.brand);
    setPickId(id);
    setTimeout(() => stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  return (
    <section className="ps cfg" id="ap-models" aria-label="Pick your model">
      <ConfigStyle />
      <div className="ps-head">
        <div>
          <h2>Pick your <span>model</span></h2>
          <p>Choose a model, then its variant and colour. {firstName} confirms the price, promo and stock on WhatsApp.</p>
        </div>
      </div>

      {brands.length > 1 && (
        <div className="cfg-brands" role="group" aria-label="Brand">
          {brands.map((b) => (
            <button key={b.brand} type="button" aria-pressed={b.brand === brand.brand} onClick={() => pickBrand(b)}>
              {LOGOS[b.brand] ? <img src={LOGOS[b.brand]} alt="" /> : null}
              <span>{b.brand}</span>
              <small>{b.models.length} {b.models.length === 1 ? 'model' : 'models'}</small>
            </button>
          ))}
        </div>
      )}

      {brand.models.length > 1 && <div className="cfg-rail keep-alpha" role="group" aria-label={`${brand.brand} models`}>
        {brand.models.map((c) => {
          const from = fromPrice(c, infos[c.id]);
          return (
            <button key={c.id} type="button" aria-pressed={c.id === car.id} onClick={() => setPickId(c.id)}>
              <span className="cfg-rail-ph"><Photo src={Array.isArray(c.images) ? c.images[0] : null} alt={c.model} w={360} q={70} /></span>
              <b>{c.model}</b>
              <span>{from ? `from ${rm(from)}` : 'Ask for the price'}</span>
            </button>
          );
        })}
      </div>}

      <div ref={stageRef} style={{ scrollMarginTop: 70 }}>
        <Build key={car.id} car={car} note={modelNote(site, car)} firstName={firstName} hasWa={hasWa} waUrlFor={waUrlFor} onWhatsApp={onWhatsApp} onCalc={onCalc} />
      </div>
      <p className="ps-fine">List prices for {firstName}'s area, from the brand, on the road without insurance. Any promo is on the promo board, set by {firstName}.</p>
      {models.length >= 3 && (
        <ModelHelper cars={models} infos={infos} firstName={firstName} hasWa={hasWa} waUrlFor={waUrlFor} onWhatsApp={onWhatsApp} onShow={show} />
      )}
    </section>
  );
}

// The configurator's own styles (Premium pages only: this component only renders there).
// White page, hairlines, squircle corners, picked = solid ink, wide labels: the same language as PageLook (its --head,
// --bold and --r-* tokens are inherited, with fallbacks).
function ConfigStyle() {
  return (
    <style>{`
      .cfg { --c-line: rgba(10,10,11,.1); --c-line2: rgba(10,10,11,.2); --c-t1: #0a0a0b; --c-t2: rgba(10,10,11,.66); --c-t3: rgba(10,10,11,.48); --c-ink: var(--ink, #dc2626);
        --c-wide: var(--wide, 'Inter', var(--xd-font-body)); --c-head: var(--head, 'Bebas Neue', sans-serif); --c-bold: var(--bold, var(--xd-font-body));
        --c-rc: var(--r-card, 16px); --c-rb: var(--r-btn, 12px); --c-rs: var(--r-chip, 9px); }
      .cfg-lbl, .cfg-eyebrow, .cfg-tag, .cfg-brands small, .cfg-rail span:not(.cfg-rail-ph) { font-family: var(--c-wide); font-size: 10.5px; font-weight: 400;
        letter-spacing: .16em; text-transform: uppercase; color: var(--c-t3); }
      .cfg-lbl { margin: 0 0 12px; display: flex; gap: 10px; flex-wrap: wrap; }
      .cfg-lbl b { color: var(--c-t1); font-family: var(--c-bold); font-weight: 700; letter-spacing: .12em; }

      /* Brands: logo tiles, the picked one underlined */
      .cfg-brands { display: flex; gap: 0; overflow-x: auto; scrollbar-width: none; border-top: 1px solid var(--c-line); border-bottom: 1px solid var(--c-line); margin: 0 0 18px; }
      .cfg-brands::-webkit-scrollbar { display: none; }
      .cfg-brands button { flex: 1 0 auto; min-width: 116px; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 18px 14px;
        border: none; background: none; cursor: pointer; color: var(--c-t2); font-family: var(--c-wide); box-shadow: inset 0 -2px 0 transparent;
        transition: color .2s, box-shadow .2s, background .2s; }
      .cfg-brands button + button { border-left: 1px solid var(--c-line); }
      .cfg-brands img { height: 26px; width: auto; max-width: 90px; object-fit: contain; filter: brightness(0); opacity: .5; transition: opacity .2s; }
      .cfg-brands span { font-family: var(--c-bold); font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
      .cfg-brands button[aria-pressed="true"] { color: #fff; background: var(--c-ink); }
      .cfg-brands button[aria-pressed="true"] img { filter: brightness(0) invert(1); }
      .cfg-brands button[aria-pressed="true"] small { color: rgba(255,255,255,.86); }
      .cfg-brands button[aria-pressed="true"] img, .cfg-brands button:hover img { opacity: 1; }
      .cfg-brands button:not([aria-pressed="true"]):hover { color: var(--c-t1); background: rgba(10,10,11,.03); }

      /* Model rail: photo tiles */
      .cfg-rail { display: grid; grid-auto-flow: column; grid-auto-columns: 158px; width: max-content; max-width: 100%; gap: 0; overflow-x: auto; scroll-snap-type: x proximity;
        scrollbar-width: none; border: 1px solid var(--c-line); border-radius: var(--c-rc); margin: 0 0 18px; }
      .cfg-rail::-webkit-scrollbar { display: none; }
      .cfg-rail button { scroll-snap-align: start; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px 14px 14px; min-width: 0;
        border: none; background: none; cursor: pointer; text-align: left; color: var(--c-t1); font-family: inherit; box-shadow: inset 0 -2px 0 transparent; transition: background .2s, box-shadow .2s; }
      .cfg-rail button + button { border-left: 1px solid var(--c-line); }
      .cfg-rail button[aria-pressed="true"] { background: var(--c-ink); color: #fff; }
      .cfg-rail button[aria-pressed="true"] span:not(.cfg-rail-ph) { color: rgba(255,255,255,.86); }
      .cfg-rail button[aria-pressed="true"] .cfg-rail-ph { background: var(--ink-2, #b91c1c); border-radius: calc(var(--c-rs) - 2px); }
      .cfg-rail button:not([aria-pressed="true"]):hover { background: rgba(10,10,11,.03); }
      .cfg-rail-ph { width: 100%; aspect-ratio: 16 / 9; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 6px; }
      .cfg-rail-ph img { width: 100%; height: 100%; object-fit: contain; }
      .cfg-rail b { font-family: var(--c-head); font-size: 19px; font-weight: 400; line-height: 1.05; letter-spacing: .03em; text-transform: uppercase; overflow-wrap: anywhere; }
      .cfg-rail span:not(.cfg-rail-ph) { letter-spacing: .06em; text-transform: none; font-size: 12px; font-family: var(--xd-font-body); color: var(--c-t2); font-variant-numeric: tabular-nums; }

      /* The build: stage + panel */
      .cfg-build { display: grid; grid-template-columns: minmax(0, 1fr); border: 1px solid var(--c-line); border-radius: var(--c-rc); overflow: clip; }
      .cfg-stage { position: relative; overflow: hidden; min-height: 260px; aspect-ratio: 16 / 11; display: flex; align-items: center; justify-content: center;
        background: radial-gradient(ellipse 75% 60% at 50% 40%, #ffffff 0%, #f1f1f3 55%, #e5e5e8 100%); }
      .cfg-mark { position: absolute; left: 50%; top: 46%; translate: -50% -50%; white-space: nowrap; pointer-events: none; font-family: var(--c-head);
        font-weight: 400; text-transform: uppercase; font-size: clamp(80px, 22vw, 260px); line-height: 1; color: rgba(10,10,11,.05); letter-spacing: .01em; }
      .cfg-tag { position: absolute; left: 16px; top: 16px; z-index: 2; color: var(--c-t2); }
      .cfg-car { position: relative; z-index: 1; width: 88%; height: 78%; display: flex; align-items: center; justify-content: center; animation: cfg-in .5s cubic-bezier(.2,.7,.2,1) both; }
      .cfg-car img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 22px 24px rgba(0,0,0,.22)); }
      .cfg-floor { position: absolute; left: 12%; right: 12%; bottom: 13%; height: 26px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.28), rgba(0,0,0,0)); }
      .cfg-nophoto { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-family: var(--c-head); font-weight: 400;
        text-transform: uppercase; color: rgba(10,10,11,.25); font-size: 22px; letter-spacing: .08em; text-align: center; }
      .cfg-shots { position: absolute; left: 12px; bottom: 12px; z-index: 2; display: flex; gap: 6px; }
      .cfg-shots button { width: 52px; height: 36px; padding: 0; border: 1px solid var(--c-line2); border-radius: var(--c-rs); background: #fff; cursor: pointer; opacity: .7; overflow: hidden; }
      .cfg-shots button[aria-pressed="true"] { opacity: 1; border-color: var(--c-ink); }
      .cfg-shots img { width: 100%; height: 100%; object-fit: cover; display: block; }
      @keyframes cfg-in { from { opacity: 0; transform: translateX(24px) scale(.98); } to { opacity: 1; transform: none; } }

      .cfg-panel { padding: 22px 18px 20px; display: flex; flex-direction: column; min-width: 0; border-top: 1px solid var(--c-line); }
      .cfg-eyebrow { margin: 0; }
      .cfg-name { margin: 6px 0 0; font-family: var(--c-head); font-weight: 400; text-transform: uppercase; color: var(--c-t1);
        font-size: clamp(36px, 8vw, 54px); line-height: .95; letter-spacing: .02em; overflow-wrap: anywhere; }
      .cfg-var { margin: 8px 0 0; font-size: 15px; color: var(--c-t2); min-height: 20px; }
      .cfg-price { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--c-line); }
      .cfg-price .cfg-lbl { margin-bottom: 6px; }
      .cfg-rm { margin: 0; font-family: var(--c-bold); font-weight: 700; letter-spacing: -.02em; color: var(--c-t1); font-size: clamp(28px, 6.4vw, 38px); line-height: 1.05; font-variant-numeric: tabular-nums; }
      .cfg-est { margin: 8px 0 0; font-size: 13px; color: var(--c-t2); line-height: 1.5; }
      .cfg-block { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--c-line); }
      .cfg-fine { margin: 10px 0 0; font-size: 12px; color: var(--c-t3); line-height: 1.5; }

      .cfg-cols { display: flex; flex-wrap: wrap; gap: 10px; }
      .cfg-col { width: 40px; height: 40px; padding: 4px; border: 1px solid transparent; border-radius: var(--c-rs); background: none; cursor: pointer; transition: border-color .2s; }
      .cfg-col i { display: block; width: 100%; height: 100%; border-radius: calc(var(--c-rs) - 3px); box-shadow: inset 0 0 0 1px rgba(10,10,11,.18); }
      .cfg-col[aria-checked="true"] { border-color: var(--c-ink); }

      .cfg-vars { display: grid; border-top: 1px solid var(--c-line); }
      .cfg-v { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 14px 12px; min-height: 52px; border: none;
        border-bottom: 1px solid var(--c-line); background: none; cursor: pointer; text-align: left; color: var(--c-t2); font-family: inherit;
        box-shadow: inset 2px 0 0 transparent; transition: background .2s, color .2s, box-shadow .2s; }
      .cfg-v:not([aria-checked="true"]):hover { background: rgba(10,10,11,.03); color: var(--c-t1); }
      /* The picked variant: the whole row turns ink (owner, 2026-11-26: an outline "looks cheap") */
      .cfg-v[aria-checked="true"] { background: var(--c-ink); color: #fff; border-radius: var(--c-rs); border-bottom-color: transparent; }
      .cfg-v[aria-checked="true"] .cfg-v-n small { color: rgba(255,255,255,.88); }
      .cfg-v-n { min-width: 0; font-size: 14.5px; font-weight: 600; overflow-wrap: anywhere; }
      .cfg-v-n small { display: block; margin-top: 4px; font-size: 12px; font-weight: 400; color: var(--c-t3); }
      .cfg-v-p { flex-shrink: 0; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
      .cfg-v--skel { cursor: default; }
      .cfg-skel { display: inline-block; height: 12px; width: 150px; border-radius: 6px; background: rgba(10,10,11,.08); animation: cfg-pulse 1.4s ease-in-out infinite; }
      @keyframes cfg-pulse { 50% { opacity: .45; } }

      .cfg-specs { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid var(--c-line); }
      .cfg-specs div { padding: 12px 12px 12px 0; border-bottom: 1px solid var(--c-line); min-width: 0; }
      .cfg-specs div:nth-child(even) { padding-left: 14px; border-left: 1px solid var(--c-line); }
      .cfg-specs dt { font-family: var(--c-wide); font-size: 10px; font-weight: 400; letter-spacing: .16em; text-transform: uppercase; color: var(--c-t3); }
      .cfg-specs dd { margin: 4px 0 0; font-size: 14.5px; font-weight: 600; color: var(--c-t1); overflow-wrap: anywhere; }

      .cfg-note { margin-top: 22px; padding: 2px 0 2px 14px; border-left: 1px solid var(--c-line2); }
      .cfg-note .cfg-lbl { margin-bottom: 6px; }
      .cfg-note p:last-child { margin: 0; font-size: 14px; line-height: 1.55; color: var(--c-t2); overflow-wrap: anywhere; }

      .cfg-act { display: flex; gap: 8px; margin-top: 24px; }
      .cfg-act > * { flex: 1 1 0; min-width: 0; height: 52px; padding: 0 12px; white-space: normal; line-height: 1.2; text-align: center; }

      @media (min-width: 1000px) {
        .cfg-build { grid-template-columns: minmax(0, 1.55fr) minmax(360px, 1fr); }
        .cfg-stage { aspect-ratio: auto; height: min(600px, calc(100vh - 120px)); min-height: 440px; position: sticky; top: 56px; align-self: start; }
        .cfg-panel { border-top: none; border-left: 1px solid var(--c-line); padding: 32px 30px 28px; }
        .cfg-rail { grid-auto-columns: 200px; }
      }
      @media (max-width: 999px) { .cfg-stage { aspect-ratio: 4 / 3; } }
      @supports (corner-shape: squircle) { .cfg-rail, .cfg-build, .cfg-shots button, .cfg-col, .cfg-col i, .cfg-skel, .cfg-v { corner-shape: squircle; } }
      @media (prefers-reduced-motion: reduce) { .cfg-car { animation: none; } .cfg-skel { animation: none; } .cfg * { transition: none !important; } }
    `}</style>
  );
}
