import React, { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cdnImg } from '../../utils/img';
import { carLabel, LOCAL_NEW_EIR } from '../../utils/liveMaths';
import { DEFAULT_EIR } from '../../utils/financing';
import {
  pageBudget, budgetMessage, PAGE_DEPOSITS, MONTHLY_PRESETS, PAY_PRESETS, salaryPct,
} from '../../utils/pageBudget';

// "What fits your budget?" on a Premium seller's page (BUDGET-1, 2026-10-23).
// A DROP-DOWN, closed on landing (owner: "not fill the whole page with it"):
// one row above the car grid until the buyer opens it. Lite pages never render
// it (SalesmanProfilePage gates on page_basic). Every number comes from
// pageBudget.js, the Live presenter's engine; tapping a car opens WhatsApp
// through /api/wa (no number on the page, CDP-3) with the buyer's own budget
// in the message, and the buyer presses send.

const rm = (v) => Math.round(Number(v) || 0).toLocaleString('en-MY');

export default function BudgetFinder({ listings, firstName, hasWa, waUrlFor, onWhatsApp }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('monthly');
  const [amount, setAmount] = useState('');
  const [depositPct, setDepositPct] = useState(0.1);
  const panelId = useId();
  const inputId = useId();

  const result = useMemo(
    () => pageBudget(listings, { mode, amount, depositPct }),
    [listings, mode, amount, depositPct],
  );
  const presets = mode === 'pay' ? PAY_PRESETS : MONTHLY_PRESETS;
  const typed = Number(amount) > 0;

  const pickMode = (m) => { setMode(m); setAmount(''); };
  const linkFor = (car) => {
    if (hasWa) return waUrlFor(budgetMessage({ firstName, car, mode, amount, depositPct }));
    return null;
  };

  const renderRow = (row, above = false) => {
    const car = row.car;
    const img = Array.isArray(car.images) ? car.images[0] : null;
    const href = linkFor(car);
    const body = (
      <>
        <span className="bf-thumb" aria-hidden="true">{img ? <img src={cdnImg(img, 160, 70)} alt="" loading="lazy" /> : null}</span>
        <span className="bf-mid">
          <span className="bf-name">#{row.n} {carLabel(car)}</span>
          <span className="bf-sub">
            {above && row.topUp != null
              ? `+RM ${rm(row.topUp)} deposit and it fits`
              : `${car.is_model_card ? 'From ' : ''}RM ${rm(car.selling_price)}${row.years < 9 ? ` · ${row.years} yrs` : ''}`}
          </span>
        </span>
        <span className="bf-end">
          <span className={above ? 'bf-mo bf-mo-above' : 'bf-mo'}>RM {rm(row.monthly)}</span>
          <span className="bf-cta">{href ? 'Ask on WhatsApp' : 'View car'}</span>
        </span>
      </>
    );
    return href ? (
      <a key={car.id} className="bf-row" href={href} target="_blank" rel="noopener noreferrer" onClick={() => onWhatsApp?.(car)}>{body}</a>
    ) : (
      <Link key={car.id} className="bf-row" to={`/showroom/${car.slug || car.id}`}>{body}</Link>
    );
  };

  return (
    <div className="ap-card bf">
      <style>{`
        .bf { margin: 0 0 16px; overflow: hidden; }
        .bf-head { width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px 16px; min-height: 56px; background: none; border: none; cursor: pointer; text-align: left; font-family: inherit; color: #111827; }
        .bf-head b { display: block; font-size: 15px; font-weight: 700; }
        .bf-head small { display: block; font-size: 12.5px; color: #4b5563; margin-top: 2px; }
        .bf-chev { margin-left: auto; flex-shrink: 0; transition: transform .2s; color: #4b5563; }
        .bf-head[aria-expanded="true"] .bf-chev { transform: rotate(180deg); }
        .bf-body { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 14px; border-top: 1px solid rgba(0,0,0,.06); padding-top: 14px; }
        .bf-seg { display: flex; gap: 4px; padding: 4px; background: #F1F0EC; border-radius: 10px; }
        .bf-seg button { flex: 1; height: 40px; border: none; border-radius: 7px; background: transparent; font: inherit; font-size: 13.5px; font-weight: 700; color: #4b5563; cursor: pointer; }
        .bf-seg button[aria-pressed="true"] { background: #fff; color: #111827; box-shadow: 0 1px 2px rgba(15,23,42,.12); }
        .bf-lbl { font-size: 12px; font-weight: 600; color: #4b5563; }
        .bf-in { display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 14px; border: 1px solid #d1d5db; border-radius: 10px; background: #fff; margin-top: 6px; }
        .bf-in:focus-within { border-color: #111827; box-shadow: 0 0 0 1px #111827; }
        .bf-in span { font-size: 16px; font-weight: 700; color: #4b5563; }
        .bf-in input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font: inherit; font-size: 20px; font-weight: 800; color: #111827; }
        .bf-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
        .bf-chips button { height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid #d1d5db; background: #fff; font: inherit; font-size: 13.5px; font-weight: 700; color: #111827; cursor: pointer; }
        .bf-chips button[aria-pressed="true"] { background: #0f1115; border-color: #0f1115; color: #fff; }
        .bf-note { margin: 0; font-size: 12.5px; color: #4b5563; line-height: 1.45; }
        .bf-note b { color: #111827; }
        .bf-res { display: flex; align-items: baseline; justify-content: space-between; padding-top: 12px; border-top: 1px solid rgba(0,0,0,.06); }
        .bf-res b { font-size: 15px; font-weight: 800; }
        .bf-res span { font-size: 12px; color: #4b5563; }
        .bf-list { display: flex; flex-direction: column; margin: -4px -8px 0; }
        .bf-row { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 12px; min-height: 56px; text-decoration: none; color: #111827; }
        .bf-row:hover { background: #F7F6F2; }
        .bf-thumb { width: 64px; height: 48px; border-radius: 8px; background: #EDEAE3; overflow: hidden; flex-shrink: 0; position: relative; }
        .bf-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .bf-mid { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .bf-name { font-size: 14px; font-weight: 700; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
        .bf-sub { font-size: 12.5px; color: #4b5563; }
        .bf-end { text-align: right; flex-shrink: 0; display: flex; flex-direction: column; }
        .bf-mo { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .bf-mo-above { color: #4b5563; }
        .bf-cta { font-size: 11.5px; color: #4b5563; }
        .bf-above { font-size: 13px; font-weight: 800; color: #4b5563; margin-top: 4px; }
        .bf-fine { margin: 0; font-size: 11.5px; color: #4b5563; line-height: 1.5; padding-top: 10px; border-top: 1px solid rgba(0,0,0,.06); }
        @media (prefers-reduced-motion: reduce) { .bf-chev { transition: none; } }
      `}</style>

      <button type="button" className="bf-head" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <span>
          <b>What fits your budget?</b>
          <small>See the monthly for every car here</small>
        </span>
        <ChevronDown size={20} className="bf-chev" aria-hidden="true" />
      </button>

      {open && (
        <div id={panelId} className="bf-body">
          <div className="bf-seg" role="group" aria-label="Budget type">
            <button type="button" aria-pressed={mode === 'monthly'} onClick={() => pickMode('monthly')}>Monthly budget</button>
            <button type="button" aria-pressed={mode === 'pay'} onClick={() => pickMode('pay')}>Take-home pay</button>
          </div>

          <div>
            <label className="bf-lbl" htmlFor={inputId}>{mode === 'pay' ? 'Take-home pay a month' : 'Monthly budget'}</label>
            <div className="bf-in">
              <span>RM</span>
              <input id={inputId} inputMode="numeric" autoComplete="off" placeholder={mode === 'pay' ? '4000' : '900'}
                value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 7))} />
            </div>
            <div className="bf-chips">
              {presets.map((v) => (
                <button key={v} type="button" aria-pressed={Number(amount) === v} onClick={() => setAmount(String(v))}>RM {rm(v)}</button>
              ))}
            </div>
          </div>

          {mode === 'pay' && typed && result.maxMonthly && (
            <p className="bf-note">Instalment at {salaryPct}% of take-home pay = <b>RM {rm(result.maxMonthly)} a month</b>. A rough guide. The bank decides.</p>
          )}

          <div>
            <span className="bf-lbl">Deposit</span>
            <div className="bf-chips" role="group" aria-label="Deposit">
              {PAGE_DEPOSITS.map((d) => (
                <button key={d} type="button" aria-pressed={depositPct === d} onClick={() => setDepositPct(d)}>{d === 0 ? 'None' : `${Math.round(d * 100)}%`}</button>
              ))}
            </div>
          </div>

          {typed && (
            <>
              <div className="bf-res">
                <b>{result.fits.length === 1 ? '1 car fits' : `${result.fits.length} cars fit`}</b>
                <span>per month</span>
              </div>
              {result.fits.length > 0 ? (
                <div className="bf-list">{result.fits.map((row) => renderRow(row))}</div>
              ) : (
                <p className="bf-note">None fit this budget yet. A bigger deposit may help.</p>
              )}
              {result.above.length > 0 && (
                <>
                  <span className="bf-above">Just above</span>
                  <div className="bf-list">{result.above.map((row) => renderRow(row, true))}</div>
                </>
              )}
            </>
          )}

          <p className="bf-fine">
            Estimate on the reducing balance: new Proton and Perodua at {LOCAL_NEW_EIR}% EIR, other cars at {DEFAULT_EIR}%, up to 9 years (shorter for older cars). Cars over RM 300,000 are not included. Each bank sets its own rate and decides your loan.
          </p>
        </div>
      )}
    </div>
  );
}
