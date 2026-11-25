import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cdnImg } from '../../../utils/img';
import { colourSwatch } from '../../../utils/newCars';
import { pageCalc } from '../../../utils/pageCalc';
import { specStrip, modelNote, modelRm as rm } from '../../../utils/modelPick';
import { useNewCarInfo, useNewCarVariant, useNewCarInfos } from '../../newcar/NewCarListingInfo';
import ModelHelper from './ModelHelper';

// "Pick your model" on a new-car advisor's page (PAGE-SITE 2). Model tabs (each with
// its "from" price) -> a stage: photo, colour, the picked variant's spec strip
// (engine, power, torque, seats; range and battery for an electric car), the
// variant price list, the seller's own note on the model, then ask. Below it, the
// "Not sure which model?" helper (ModelHelper). Only for sellers with model cards
// (is_model_card): the same cards and variant store the car page uses, so a price
// here is the price there. Prices are the brand's list price for the seller's zone;
// a promo is the promo board's, typed by the seller. A colour changes the words of
// the ask, never the photo: we hold one photo set per model, not one per paint.

const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
const carName = (c) => [c?.brand, c?.model].filter(Boolean).join(' ');

function ModelPanel({ car, note, firstName, hasWa, waUrlFor, onWhatsApp, onCalc }) {
  const raw = useNewCarInfo(car.id);
  const { variants, current, choose } = useNewCarVariant(car.id, raw);
  const [colourPick, setColourPick] = useState(null);
  const [shot, setShot] = useState(0);
  const photos = Array.isArray(car.images) ? car.images.filter(Boolean) : [];
  const colours = list(current?.specs?.colours);
  const colour = colours.includes(colourPick) ? colourPick : null;
  const price = Number(current?.price) || Number(car.selling_price) || 0;
  const calc = price > 0 ? pageCalc({ ...car, selling_price: price }, { depositPct: 0.1, years: 7 }) : null;
  const strip = specStrip(current ? { ...current, fuel_type: current.fuel_type || raw?.fuel_type } : raw);
  const name = carName(car);
  const vname = current?.variant || car.variant || '';
  const body = current?.body_type || raw?.body_type || '';
  const ask = `Hi ${firstName}, I'm looking at the ${[name, vname].filter(Boolean).join(' ')}${colour ? ` in ${colour}` : ''}${price ? ` (${rm(price)})` : ''}.\nCan you tell me the price, any promo and the stock?`;
  return (
    <div className="ps-card ps-model">
      <div className="ps-media">
        <div className="ps-stage">
          {photos[shot] ? <img src={cdnImg(photos[shot], 960, 78)} alt={`${name}, photo ${shot + 1}`} loading="lazy" /> : null}
          {body && <span className="ps-stage-tag">{body}</span>}
        </div>
        {photos.length > 1 && (
          <div className="ps-shots" role="group" aria-label="Photos">
            {photos.slice(0, 6).map((u, i) => (
              <button key={u} type="button" aria-pressed={i === shot} aria-label={`Photo ${i + 1}`} onClick={() => setShot(i)}>
                <img src={cdnImg(u, 160, 60)} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ps-info">
        <div className="ps-mhead">
          <div style={{ minWidth: 0 }}>
            <p className="ps-mname">{name}</p>
            {vname && <p className="ps-mvar">{vname}</p>}
          </div>
          <p className="ps-price">{price > 0 ? rm(price) : 'Ask for the price'}</p>
        </div>
        {calc && <p className="ps-est">About {rm(calc.monthly)} a month at 10% deposit over 7 years. An estimate: the bank decides.</p>}
        {colours.length > 0 && (
          <div>
            <p className="ps-lbl">Colour <b>{colour ? `· ${colour}` : ''}</b></p>
            <div className="ps-cols" role="radiogroup" aria-label="Colour">
              {colours.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={c === colour} aria-label={c} title={c} className="ps-col"
                  style={{ background: colourSwatch(c) }} onClick={() => setColourPick(c === colour ? null : c)} />
              ))}
              {!colour && <span className="ps-colname">Tap to choose</span>}
            </div>
          </div>
        )}
        {strip.length > 0 && (
          <dl className="ps-spec">
            {strip.map((x) => <div key={x.label}><dt>{x.label}</dt><dd>{x.value}</dd></div>)}
          </dl>
        )}
        {variants.length > 1 && (
          <div>
            <p className="ps-lbl">All variants</p>
            <div className="ps-vars" role="radiogroup" aria-label="Variant">
              {variants.map((v) => (
                <button key={v.model_id} type="button" role="radio" aria-checked={v.model_id === current?.model_id} className="ps-var"
                  onClick={() => { choose(v.model_id); setColourPick(null); }}>
                  <span>{v.variant}</span><span>{rm(v.price)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {note && (
          <div className="ps-note">
            <p className="ps-lbl">{firstName}'s take</p>
            <p>{note}</p>
          </div>
        )}
        <div className="ps-btns">
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
  const [pickId, setPickId] = useState(null);
  const stageRef = useRef(null);
  // ONE call for every model's variants + specs: the tabs and the helper read it.
  const infos = useNewCarInfos(models.map((c) => c.id));
  useEffect(() => { if (pickId && !models.some((c) => c.id === pickId)) setPickId(null); }, [models, pickId]);
  if (!models.length) return null;
  const car = models.find((c) => c.id === pickId) || models[0];
  const show = (id) => {
    setPickId(id);
    setTimeout(() => stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };
  return (
    <section className="ps ps-dark" id="ap-models" aria-label="Pick your model">
      <div className="ps-head">
        <div>
          <h2>Pick your model</h2>
          <p>Choose the model, variant and colour, then ask {firstName} for the price and stock.</p>
        </div>
      </div>
      {models.length > 1 && (
        <div className="ps-mtabs" role="group" aria-label="Models">
          {models.map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === car.id} onClick={() => setPickId(c.id)}>
              <b>{c.model || carName(c)}</b>
              {Number(c.selling_price) > 0 && <span>from {rm(c.selling_price)}</span>}
            </button>
          ))}
        </div>
      )}
      <div ref={stageRef} style={{ scrollMarginTop: 70 }}>
        <ModelPanel key={car.id} car={car} note={modelNote(site, car)} firstName={firstName} hasWa={hasWa} waUrlFor={waUrlFor} onWhatsApp={onWhatsApp} onCalc={onCalc} />
      </div>
      <p className="ps-fine">List prices for {firstName}'s area, from the brand. Any promo is on the promo board, set by {firstName}.</p>
      {models.length >= 3 && (
        <ModelHelper cars={models} infos={infos} firstName={firstName} hasWa={hasWa} waUrlFor={waUrlFor} onWhatsApp={onWhatsApp} onShow={show} />
      )}
    </section>
  );
}
