import React, { useMemo, useState } from 'react';
import { cdnImg } from '../../../utils/img';
import { colourSwatch } from '../../../utils/newCars';
import { pageCalc } from '../../../utils/pageCalc';
import { useNewCarInfo, useNewCarVariant } from '../../newcar/NewCarListingInfo';

// "Pick your model" on a new-car advisor's page (PAGE-SITE 2): model -> variant ->
// colour, then ask. Only for sellers who have model cards (is_model_card), the
// same cards and the same variant store the car page uses, so the price here is
// the price there. Prices are the brand's list price for the seller's zone (the
// cards hold no promo, no rebate: those are the promo board's, typed by the seller).
// Colours come from the variant's spec sheet; a colour changes the words of the ask,
// never the photo (we hold one photo set per model, not one per paint).

const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
const rm = (v) => `RM ${Math.round(Number(v) || 0).toLocaleString('en-MY')}`;
const carName = (c) => [c?.brand, c?.model].filter(Boolean).join(' ');

function ModelPanel({ car, firstName, hasWa, waUrlFor, onWhatsApp }) {
  const raw = useNewCarInfo(car.id);
  const { variants, current, choose } = useNewCarVariant(car.id, raw);
  const [colourPick, setColourPick] = useState(null);
  const colours = list(current?.specs?.colours);
  const colour = colours.includes(colourPick) ? colourPick : null;
  const price = Number(current?.price) || Number(car.selling_price) || 0;
  const calc = price > 0 ? pageCalc({ ...car, selling_price: price }, { depositPct: 0.1, years: 7 }) : null;
  const photo = Array.isArray(car.images) && car.images[0];
  const name = carName(car);
  const vname = current?.variant || car.variant || '';
  const ask = `Hi ${firstName}, I'm looking at the ${[name, vname].filter(Boolean).join(' ')}${colour ? ` in ${colour}` : ''}${price ? ` (${rm(price)})` : ''}.\nCan you tell me the price, any promo and the stock?`;
  return (
    <div className="ps-card ps-model">
      <div className="ps-stage">
        {photo ? <img src={cdnImg(photo, 960, 78)} alt={name} loading="lazy" /> : null}
        {vname && <span className="ps-stage-tag">{vname}</span>}
      </div>
      <div className="ps-info">
        {variants.length > 1 && (
          <div>
            <p className="ps-lbl">Variant</p>
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
        {colours.length > 0 && (
          <div>
            <p className="ps-lbl">Colour</p>
            <div className="ps-cols" role="radiogroup" aria-label="Colour">
              {colours.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={c === colour} aria-label={c} title={c} className="ps-col"
                  style={{ background: colourSwatch(c) }} onClick={() => setColourPick(c === colour ? null : c)} />
              ))}
              <span className="ps-colname">{colour || 'Tap to choose'}</span>
            </div>
          </div>
        )}
        <div>
          <p className="ps-lbl">{variants.length > 1 || vname ? 'Price' : 'From'}</p>
          <p className="ps-price">{price > 0 ? rm(price) : 'Ask for the price'}
            {calc && <small>About {rm(calc.monthly)} a month at 10% deposit over 7 years. An estimate: the bank decides.</small>}
          </p>
        </div>
        <div className="ps-btns">
          {hasWa && (
            <a className="ps-wa" href={waUrlFor(ask)} target="_blank" rel="noopener noreferrer" onClick={() => onWhatsApp?.('model', car)}>
              Ask price and stock
            </a>
          )}
          {calc && (
            <button type="button" className="ps-ghost" onClick={() => document.getElementById('ap-calc')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Work out my instalment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ModelPicker({ cars, firstName, hasWa, waUrlFor, onWhatsApp }) {
  const models = useMemo(() => (cars || []).filter((c) => c.is_model_card), [cars]);
  const [pickId, setPickId] = useState(null);
  if (!models.length) return null;
  const car = models.find((c) => c.id === pickId) || models[0];
  return (
    <section className="ps" id="ap-models" aria-label="Pick your model">
      <div className="ps-head">
        <div>
          <h2>Pick your model</h2>
          <p>Choose the variant and colour you like, then ask {firstName} for the price and stock.</p>
        </div>
      </div>
      {models.length > 1 && (
        <div className="ps-tabs" role="group" aria-label="Models">
          {models.map((c) => <button key={c.id} type="button" aria-pressed={c.id === car.id} onClick={() => setPickId(c.id)}>{carName(c)}</button>)}
        </div>
      )}
      <ModelPanel key={car.id} car={car} firstName={firstName} hasWa={hasWa} waUrlFor={waUrlFor} onWhatsApp={onWhatsApp} />
      <p className="ps-fine">List prices for {firstName}'s area, from the brand. Any promo is on the promo board above, set by {firstName}.</p>
    </section>
  );
}
