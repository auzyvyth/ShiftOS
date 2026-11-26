import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cdnImg } from '../../utils/img';
import { carLabel } from '../../utils/liveMaths';
import { pageCalc, calcYears, fitYears, calcMessage } from '../../utils/pageCalc';
import BudgetFinder from './BudgetFinder';

// The Premium page's one money block (PAGE-SITE, 2026-11-25). Two tabs:
//   Pick a car     - one car, the buyer's deposit + years, the monthly (pageCalc.js)
//   Fit my budget  - the existing finder (BudgetFinder, `bare`)
// Both run the Live presenter's engine with the page's default rates, so a buyer
// here and a viewer on the live get the same number. An ESTIMATE: the fine print
// always says the bank decides, and the WhatsApp text only repeats what the
// buyer picked (no approval, no promise). Lite pages never render this.

const rm = (v) => Math.round(Number(v) || 0).toLocaleString('en-MY');
const DEPOSIT_MAX = 50; // percent, the most pageCalc takes

export default function PageCalculator({ listings, firstName, hasWa, waUrlFor, onWhatsApp, focus }) {
  const cars = useMemo(
    () => (listings || []).map((c, i) => ({ car: c, n: i + 1 })).filter((x) => Number(x.car.selling_price) > 0),
    [listings],
  );
  const [tab, setTab] = useState('car');
  const [pickedId, setPickedId] = useState(null);
  const [depositPct, setDepositPct] = useState(0.1);
  const [years, setYears] = useState(7);
  // "Work out my instalment" on the model picker hands over the model AND the variant the buyer
  // picked: show that car at that variant's price, not the card's cheapest "from" price. Picking
  // another car in the strip drops it.
  const [override, setOverride] = useState(null);
  useEffect(() => {
    if (!focus?.carId) return;
    setTab('car');
    setPickedId(focus.carId);
    setOverride(Number(focus.price) > 0 ? { carId: focus.carId, price: Number(focus.price), variant: focus.variant || null } : null);
  }, [focus?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // A brand tab can remove the picked car from the list: fall back to the first.
  useEffect(() => {
    if (!cars.length) return;
    if (!cars.some((x) => x.car.id === pickedId)) setPickedId(cars[0].car.id);
  }, [cars, pickedId]);

  const picked = cars.find((x) => x.car.id === pickedId) || cars[0] || null;
  const baseCar = picked?.car || null;
  const car = baseCar && override && override.carId === baseCar.id
    ? { ...baseCar, selling_price: override.price, ...(override.variant ? { variant: override.variant } : {}) }
    : baseCar;
  const yearsOffered = car ? calcYears(car) : [];
  const yearsNow = car ? fitYears(car, years) : null;
  const calcRaw = car ? pageCalc(car, { depositPct, years: yearsNow || years }) : null;
  const calc = calcRaw && car !== baseCar ? { ...calcRaw, from: false } : calcRaw;
  const href = car && hasWa ? waUrlFor(calcMessage({ firstName, car, depositPct, years: yearsNow })) : null;

  if (!cars.length) return null;

  return (
    <div id="ap-calc" className="pc-wrap" style={{ containerType: 'inline-size', scrollMarginTop: 72 }}>
    <div className="ps-head">
      <div>
        <h2>Work out your monthly</h2>
        <p>Before you talk to the bank. Pick a car, set the deposit and years, see the instalment.</p>
      </div>
    </div>
    <section className="pc ap-card" aria-label="Monthly instalment calculator">
      <style>{`
        .pc { padding: 20px 16px 18px; margin: 0 0 24px; scroll-margin-top: 72px; overflow: hidden; }
        .pc-tabs { display: flex; gap: 4px; padding: 4px; background: #F1F0EC; border-radius: 12px; margin-bottom: 16px; }
        .pc-tabs button { flex: 1; height: 44px; border: none; border-radius: 9px; background: transparent; font: inherit; font-size: 14px; font-weight: 600; color: #4b5563; cursor: pointer; }
        .pc-tabs button[aria-pressed="true"] { background: #fff; color: #0f1115; box-shadow: 0 1px 3px rgba(15,23,42,.14); }
        .pc-pick { display: flex; gap: 10px; overflow-x: auto; margin: 0 -16px 16px; padding: 2px 16px 8px; scroll-snap-type: x proximity; scrollbar-width: none; }
        .pc-pick::-webkit-scrollbar { display: none; }
        .pc-car { flex: 0 0 148px; scroll-snap-align: start; text-align: left; padding: 0; border: 2px solid transparent; border-radius: 14px; background: #F7F6F2; cursor: pointer; font: inherit; color: #111827; overflow: hidden; }
        .pc-car[aria-pressed="true"] { border-color: #0f1115; background: #fff; box-shadow: 0 8px 20px rgba(15,23,42,.14); }
        .pc-ph { display: block; position: relative; aspect-ratio: 4 / 3; background: #EDEAE3; }
        .pc-ph img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
        .pc-n { position: absolute; left: 8px; top: 8px; min-width: 24px; height: 22px; padding: 0 6px; border-radius: 11px; background: rgba(15,17,21,.82); color: #fff; font-size: 11.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
        .pc-ct { display: block; padding: 8px 10px 10px; }
        .pc-cn { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; font-size: 12.5px; font-weight: 500; line-height: 1.3; min-height: 32px; }
        .pc-cp { display: block; margin-top: 4px; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .pc-grid { display: grid; gap: 16px; }
        .pc-lbl { font-size: 13.5px; font-weight: 500; color: #4b5563; }
        .pc-field { padding: 14px 16px; border-radius: 14px; background: #F4F3EF; }
        .pc-fh { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
        .pc-fh b { font-size: 15px; font-weight: 700; color: #0f1115; font-variant-numeric: tabular-nums; text-align: right; }
        /* Deposit: a slider with the amount beside it. The thumb is 28px so a thumb is easy to grab. */
        .pc-range { -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 36px; margin: 6px 0 0; background: transparent; cursor: pointer; touch-action: pan-y; }
        .pc-range::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: linear-gradient(90deg, var(--ap-a, #dc2626) var(--pc-fill, 0%), #d9d6cd var(--pc-fill, 0%)); }
        .pc-range::-moz-range-track { height: 6px; border-radius: 3px; background: #d9d6cd; }
        .pc-range::-moz-range-progress { height: 6px; border-radius: 3px; background: var(--ap-a, #dc2626); }
        .pc-range::-webkit-slider-thumb { -webkit-appearance: none; width: 28px; height: 28px; margin-top: -11px; border-radius: 50%; background: #fff; border: none; box-shadow: 0 0 0 1px rgba(15,17,21,.12), 0 2px 6px rgba(15,17,21,.28); }
        .pc-range::-moz-range-thumb { width: 28px; height: 28px; border-radius: 50%; background: #fff; border: none; box-shadow: 0 0 0 1px rgba(15,17,21,.12), 0 2px 6px rgba(15,17,21,.28); }
        .pc-range:focus-visible { outline: none; }
        .pc-range:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 3px #fff, 0 0 0 5px #0f1115; }
        .pc-ticks { display: flex; justify-content: space-between; margin-top: -2px; font-size: 11px; font-weight: 400; color: #6b7280; font-variant-numeric: tabular-nums; }
        /* Loan length: one joined control, the picked length filled in ink. */
        .pc-seg { display: flex; margin-top: 10px; padding: 4px; border-radius: 12px; background: #E7E5DE; }
        .pc-seg button { flex: 1 1 0; min-width: 0; height: 40px; border: none; border-radius: 9px; background: transparent; font: inherit; font-size: 14px; font-weight: 600; color: #4b5563; cursor: pointer; }
        .pc-seg button[aria-checked="true"] { background: #0f1115; color: #fff; box-shadow: 0 2px 6px rgba(15,17,21,.25); }
        .pc-ctl { display: flex; flex-direction: column; gap: 16px; }
        .pc-out { background: #0f1115; color: #fff; border-radius: 18px; padding: 20px 18px 18px; position: relative; overflow: hidden; }
        .pc-k { margin: 0; font-size: 13.5px; font-weight: 500; color: rgba(255,255,255,.62); }
        .pc-big { margin: 6px 0 2px; white-space: nowrap; font-size: clamp(38px, 10vw, 52px); line-height: 1; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
        .pc-big small { display: block; margin: 6px 0 0; font-size: 14px; font-weight: 400; letter-spacing: 0; color: rgba(255,255,255,.7); }
        .pc-sum { margin: 0 0 14px; font-size: 13px; color: rgba(255,255,255,.7); }
        .pc-rows { margin: 0; padding: 12px 0 0; border-top: 1px solid rgba(255,255,255,.12); display: grid; gap: 8px; }
        .pc-rows div { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
        .pc-rows dt { margin: 0; color: rgba(255,255,255,.7); }
        .pc-rows dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
        .pc-out .ap-btn { margin-top: 16px; width: 100%; }
        .pc-link { display: flex; align-items: center; justify-content: center; margin-top: 16px; height: 48px; border-radius: 24px; background: #fff; color: #0f1115; font-weight: 600; font-size: 14px; text-decoration: none; }
        .pc-fine { margin: 14px 0 0; font-size: 11.5px; line-height: 1.5; color: #4b5563; }
        .pc-none { margin: 0; padding: 20px 4px; font-size: 14px; color: rgba(255,255,255,.8); }
        @container (max-width: 639px) {
          .pc { padding: 14px 12px 12px; margin-bottom: 16px; }
          .pc-tabs { margin-bottom: 10px; }
          .pc-tabs button { height: 38px; font-size: 13px; }
          .pc-pick { gap: 8px; margin: 0 -12px 10px; padding: 2px 12px 4px; }
          .pc-car { flex-basis: 116px; border-radius: 12px; }
          .pc-ph { aspect-ratio: 16 / 10; }
          .pc-ct { padding: 6px 8px 8px; }
          .pc-cn { font-size: 11.5px; min-height: 0; -webkit-line-clamp: 2; }
          .pc-cp { font-size: 12px; margin-top: 2px; }
          .pc-grid { gap: 10px; }
          .pc-ctl { gap: 8px; }
          .pc-field { padding: 8px 12px 8px; }
          .pc-ticks { display: none; }
          .pc-fh b { font-size: 14px; }
          .pc-range { height: 30px; margin-top: 0; }
          .pc-seg { margin-top: 6px; }
          .pc-seg { padding: 3px; }
          .pc-seg button { height: 34px; font-size: 13px; }
          .pc-out { padding: 14px 14px 12px; border-radius: 16px; }
          .pc-k { font-size: 10.5px; }
          .pc-big { margin: 4px 0 2px; font-size: 36px; }
          .pc-big small { display: inline; margin: 0 0 0 6px; font-size: 13px; }
          .pc-sum { margin: 0 0 10px; font-size: 12px; }
          .pc-rows { grid-template-columns: 1fr 1fr; gap: 8px 16px; padding-top: 10px; }
          .pc-rows div { flex-direction: column; gap: 1px; font-size: 13px; }
          .pc-rows dt { font-size: 11px; }
          .pc-out .ap-btn, .pc-link { margin-top: 12px; height: 44px; font-size: 14px; }
          .pc-fine { margin-top: 10px; font-size: 11px; }
        }
        @container (min-width: 640px) {
          .pc { padding: 28px 28px 24px; }
          .pc-pick { margin: 0 -28px 20px; padding: 2px 28px 8px; }
          .pc-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); align-items: start; gap: 24px; }
        }
      `}</style>

      <div className="pc-tabs" role="group" aria-label="Calculator mode">
        <button type="button" aria-pressed={tab === 'car'} onClick={() => setTab('car')}>Pick a car</button>
        <button type="button" aria-pressed={tab === 'budget'} onClick={() => setTab('budget')}>Fit my budget</button>
      </div>

      {tab === 'budget' ? (
        <BudgetFinder
          bare
          listings={listings}
          firstName={firstName}
          hasWa={hasWa}
          waUrlFor={waUrlFor}
          onWhatsApp={onWhatsApp}
        />
      ) : (
        <>
          <div className="pc-pick" role="group" aria-label="Pick a car">
            {cars.map(({ car: c, n }) => {
              const img = Array.isArray(c.images) ? c.images[0] : null;
              return (
                <button key={c.id} type="button" className="pc-car" aria-pressed={c.id === car?.id} onClick={() => { setPickedId(c.id); setOverride(null); }}>
                  <span className="pc-ph">
                    {img ? <img src={cdnImg(img, 320, 70)} alt="" loading="lazy" /> : null}
                    <span className="pc-n">#{n}</span>
                  </span>
                  <span className="pc-ct">
                    <span className="pc-cn">{carLabel(c)}</span>
                    <span className="pc-cp">{c.is_model_card ? 'From ' : ''}RM {rm(c.selling_price)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pc-grid">
            <div className="pc-ctl">
              <div className="pc-field">
                <div className="pc-fh">
                  <span className="pc-lbl">Deposit</span>
                  <b>{depositPct === 0 ? 'No deposit' : `${Math.round(depositPct * 100)}% · RM ${rm(calc ? calc.deposit : 0)}`}</b>
                </div>
                <input
                  type="range" className="pc-range" min={0} max={DEPOSIT_MAX} step={5}
                  value={Math.round(depositPct * 100)}
                  onChange={(e) => setDepositPct(Number(e.target.value) / 100)}
                  style={{ '--pc-fill': `${(Math.round(depositPct * 100) / DEPOSIT_MAX) * 100}%` }}
                  aria-label="Deposit percentage"
                  aria-valuetext={depositPct === 0 ? 'No deposit' : `${Math.round(depositPct * 100)} percent`}
                />
                <div className="pc-ticks" aria-hidden="true"><span>0%</span><span>25%</span><span>50%</span></div>
              </div>
              <div className="pc-field">
                <div className="pc-fh">
                  <span className="pc-lbl">Loan length</span>
                  <b>{yearsNow ? `${yearsNow} years · ${yearsNow * 12} months` : ''}</b>
                </div>
                <div className="pc-seg" role="radiogroup" aria-label="Loan years">
                  {yearsOffered.map((y) => (
                    <button key={y} type="button" role="radio" aria-checked={yearsNow === y} onClick={() => setYears(y)}>{y} yrs</button>
                  ))}
                </div>
              </div>
              {car && yearsOffered.length > 0 && yearsOffered[yearsOffered.length - 1] < 9 && (
                <p className="pc-fine" style={{ margin: 0 }}>Banks usually shorten the loan on an older car, so only the years this car can have are shown.</p>
              )}
            </div>

            <div className="pc-out" aria-live="polite">
              {calc ? (
                <>
                  <p className="pc-k">{carLabel(car)}</p>
                  <p className="pc-big">RM {rm(calc.monthly)}<small>/ month</small></p>
                  <p className="pc-sum">{calc.years} years · {calc.rate}% EIR · {depositPct === 0 ? 'no deposit' : `${Math.round(depositPct * 100)}% deposit`}</p>
                  <dl className="pc-rows">
                    <div><dt>{calc.from ? 'Price from' : 'Price'}</dt><dd>RM {rm(calc.price)}</dd></div>
                    <div><dt>Deposit</dt><dd>RM {rm(calc.deposit)}</dd></div>
                    <div><dt>Loan</dt><dd>RM {rm(calc.loan)}</dd></div>
                    <div><dt>Total interest</dt><dd>RM {rm(calc.totalInterest)}</dd></div>
                  </dl>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="ap-btn" onClick={() => onWhatsApp?.(car)}>
                      <span>Ask {firstName} about this car</span>
                    </a>
                  ) : (
                    <Link to={`/showroom/${car.slug || car.id}`} className="pc-link">View this car</Link>
                  )}
                </>
              ) : (
                <p className="pc-none">This car is too old for a bank loan on these terms. Ask {firstName} about cash or another car.</p>
              )}
            </div>
          </div>
        </>
      )}

      <p className="pc-fine">
        An estimate on the reducing balance, not an approval. Each bank sets its own rate and decides your loan. Final price and deposit are agreed with the seller.
      </p>
    </section>
    </div>
  );
}
