import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Search } from 'lucide-react';
import { CAR_DATA } from '../../data/carData';
import { MY_STATES } from '../../utils/locations';
import { LOGOS } from '../../config/brandLogos';
import { PRICE_STEPS } from '../PriceDrumPicker';
import { calcMonthly } from '../../utils/financing';
import { COLOURS as COLOUR_SWATCHES } from '../../utils/carFormOptions';
import {
  BRAND_OPTIONS, TRANSMISSIONS, FINANCING_TYPES, MILEAGE_OPTIONS, CONDITION_OPTIONS,
  FUEL_TYPES, COLOURS, YEARS,
} from '../../config/marketplaceConfig';
import { sv } from '../storefront/sections/shared';

// The showroom + dealer /cars filter panel (owner, 2026-11-22: Carlist's grouped drawer, done better).
// Sections: Car (Brand > Model rows that open a picker, Variant as a text box), Budget (Monthly | Price),
// Condition, Year & mileage, Location, then "More" (gearbox, fuel, colour, seller, payment) folded.
// It only edits the DRAFT: nothing loads until the buyer presses Search (owner: "only let it work once
// when user click search"), so there is no live car count on the button. Hot deals + body type are the
// chip row's job and are not repeated here.

const SELLER_TYPES = [{ value: 'dealer', label: 'Dealer' }, { value: 'agent', label: 'Agent' }, { value: 'private', label: 'Private' }];
const TOP_BRANDS = ['Perodua', 'Proton', 'Honda', 'Toyota'];
const MONTHLY_CHIPS = [800, 1200, 2000, 3000, 4000];
const PRICE_CHIPS = [50000, 80000, 100000, 150000, 200000, 300000];
const STEPS = PRICE_STEPS.filter((s) => s.value).map((s) => Number(s.value));
const fmt = (n) => Number(n).toLocaleString('en-MY');
const priceLabel = (n) => (n >= 1000000 ? `RM ${n / 1000000}M` : `RM ${n / 1000}k`);

// A monthly budget -> the nearest allowed max price, on the SAME loan the cards quote (calcMonthly:
// 90% loan, 7 years, DEFAULT_EIR). Nearest, not floor: the steps are 100k apart above RM 100k.
export function maxPriceForMonthly(monthly) {
  const per = calcMonthly(100000) / 100000;
  const raw = monthly / per;
  return STEPS.reduce((best, s) => (Math.abs(s - raw) < Math.abs(best - raw) ? s : best), STEPS[0]);
}

// Theme for the panel AND its container (drawer / sidebar), so both are painted from one place.
// Dealer sites use their saved theme (--sf-*, Dark or Light); the marketplace is the light surface.
export function filterTheme(dark) {
  return dark ? {
    '--fp-pg': sv('bg', '#0b0e14'), '--fp-card': sv('card', '#141821'),
    '--fp-row': 'color-mix(in srgb, var(--sf-text, #f3f4f6) 7%, transparent)',
    '--fp-text': sv('text', '#f3f4f6'), '--fp-muted': sv('muted', 'rgba(255,255,255,0.6)'),
    '--fp-line': sv('border', 'rgba(255,255,255,0.08)'),
    '--fp-ink': sv('text', '#f3f4f6'), '--fp-ink-text': sv('card', '#141821'),
  } : {
    '--fp-pg': '#f5f4f1', '--fp-card': '#ffffff', '--fp-row': '#f2f3f5',
    '--fp-text': '#111827', '--fp-muted': '#6b7280', '--fp-line': 'rgba(17,24,39,0.08)',
    '--fp-ink': '#0f1115', '--fp-ink-text': '#ffffff',
  };
}

const S = {
  sec: { marginBottom: '18px' },
  title: { fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fp-muted)', margin: '0 4px 8px' },
  card: { background: 'var(--fp-card)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 0 0 1px var(--fp-line)' },
  pad: { padding: '14px' },
  row: { width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', background: 'none', border: 'none', color: 'var(--fp-text)', fontSize: '15px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' },
  k: { color: 'var(--fp-muted)', width: '58px', flexShrink: 0, fontSize: '13.5px' },
  sub: { fontSize: '13px', color: 'var(--fp-muted)', margin: '0 2px 7px' },
};
const val = (on) => ({ flex: 1, minWidth: 0, fontWeight: on ? 700 : 500, color: on ? 'var(--fp-text)' : 'var(--fp-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const chip = (on) => ({
  padding: '8px 13px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap',
  background: on ? 'var(--fp-ink)' : 'var(--fp-card)', color: on ? 'var(--fp-ink-text)' : 'var(--fp-text)',
  boxShadow: on ? 'none' : '0 0 0 1px var(--fp-line)',
});
const line = { borderTop: '1px solid var(--fp-line)' };

function Seg({ options, value, onPick, onCard }) {
  return (
    <div role="group" style={{ display: 'flex', padding: '3px', borderRadius: '999px', background: onCard ? 'var(--fp-card)' : 'var(--fp-row)', boxShadow: onCard ? '0 0 0 1px var(--fp-line)' : 'none' }}>
      {options.map(([v, label]) => {
        const on = (value || '') === v;
        return (
          <button key={v || 'any'} type="button" aria-pressed={on} onClick={() => onPick(v)}
            style={{ flex: 1, minWidth: 0, padding: '8px 4px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 700, whiteSpace: 'nowrap', background: on ? 'var(--fp-ink)' : 'transparent', color: on ? 'var(--fp-ink-text)' : 'var(--fp-muted)', transition: 'background-color 120ms var(--xd-ease-out), color 120ms var(--xd-ease-out)' }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Logo({ brand, size = 26 }) {
  const src = LOGOS[brand];
  return (
    <span style={{ width: size, height: size, flexShrink: 0, borderRadius: '8px', background: '#fff', boxShadow: '0 0 0 1px var(--fp-line)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {src
        ? <img src={src} alt="" width={size - 6} height={size - 6} style={{ objectFit: 'contain', width: size - 6, height: size - 6 }} />
        : <span style={{ fontSize: size > 30 ? '11px' : '9.5px', fontWeight: 800, color: '#111827' }}>{brand.slice(0, 3).toUpperCase()}</span>}
    </span>
  );
}

// One picker screen (brand / model / state): back, search box, a list. Tapping a row sets it and
// goes back to the main screen.
function Picker({ title, items, current, anyLabel, onPick, onBack, top }) {
  const [q, setQ] = useState('');
  const shown = q ? items.filter((x) => x.toLowerCase().includes(q.toLowerCase())) : items;
  const rowStyle = (on) => ({ ...S.row, fontWeight: on ? 700 : 500 });
  return (
    <div>
      <button type="button" onClick={onBack} style={{ ...S.row, padding: '2px 2px 12px', fontSize: '17px', fontWeight: 800 }}>
        <ChevronLeft size={20} /> {title}
      </button>
      {items.length > 8 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--fp-card)', borderRadius: '14px', padding: '0 12px', boxShadow: '0 0 0 1px var(--fp-line)', marginBottom: '12px' }}>
          <Search size={16} style={{ color: 'var(--fp-muted)', flexShrink: 0 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${title.toLowerCase()}`}
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--fp-text)', fontSize: '16px', padding: '11px 0', fontFamily: 'inherit' }} />
        </label>
      )}
      {!q && top}
      <div style={S.card}>
        {!q && <button type="button" onClick={() => onPick('')} style={rowStyle(!current)}>{anyLabel}</button>}
        {shown.map((x, i) => (
          <button key={x} type="button" onClick={() => onPick(x)} style={{ ...rowStyle(current === x), ...((i || !q) ? line : null) }}>
            <span style={{ flex: 1 }}>{x}</span>
            {current === x && <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--fp-muted)' }}>Selected</span>}
          </button>
        ))}
        {!shown.length && <div style={{ ...S.row, color: 'var(--fp-muted)', cursor: 'default' }}>No match</div>}
      </div>
    </div>
  );
}

export default function FiltersPanel({ isMarketplace, draft, setDraftParam, priceMode }) {
  const d = draft;
  const [view, setView] = useState('main');
  const [budget, setBudget] = useState(priceMode === 'monthly' ? 'monthly' : 'price');
  const moreCount = ['transmission', 'fuel_type', 'colour', 'seller_type', 'financing'].filter((k) => d[k]).length;
  const [moreOpen, setMoreOpen] = useState(moreCount > 0);
  const models = CAR_DATA[d.brand] || [];
  const maxP = Number(d.max_price) || 0;

  if (view === 'brand') {
    const top = (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '8px', marginBottom: '12px' }}>
        {TOP_BRANDS.filter((b) => BRAND_OPTIONS.includes(b)).map((b) => (
          <button key={b} type="button" onClick={() => { setDraftParam('brand', b); setView('main'); }}
            style={{ background: 'var(--fp-card)', borderRadius: '14px', padding: '12px 4px 9px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--fp-text)', fontSize: '12px', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', boxShadow: d.brand === b ? '0 0 0 2px var(--fp-ink)' : '0 0 0 1px var(--fp-line)' }}>
            <Logo brand={b} size={36} />{b}
          </button>
        ))}
      </div>
    );
    return <Picker title="Brand" items={BRAND_OPTIONS} current={d.brand} anyLabel="Any brand" top={top}
      onPick={(b) => { setDraftParam('brand', b); setView('main'); }} onBack={() => setView('main')} />;
  }
  if (view === 'model') {
    return <Picker title={`${d.brand} model`} items={models} current={d.model} anyLabel={`Any ${d.brand} model`}
      onPick={(m) => { setDraftParam('model', m); setView('main'); }} onBack={() => setView('main')} />;
  }
  if (view === 'state') {
    return <Picker title="State" items={MY_STATES} current={d.state} anyLabel="All of Malaysia"
      onPick={(s) => { setDraftParam('state', s); setView('main'); }} onBack={() => setView('main')} />;
  }

  const chevron = <ChevronRight size={17} style={{ color: 'var(--fp-muted)', flexShrink: 0 }} />;
  const yearSel = (key, label) => (
    <label style={{ flex: 1, minWidth: 0, position: 'relative', background: 'var(--fp-row)', borderRadius: '12px', padding: '8px 12px' }}>
      <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--fp-muted)' }}>{label}</span>
      <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--fp-text)' }}>{d[key] || 'Any'}</span>
      <select aria-label={`Year ${label.toLowerCase()}`} value={d[key] || ''} onChange={(e) => setDraftParam(key, e.target.value)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', fontSize: '16px' }}>
        <option value="">Any</option>
        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  );

  return (
    <div style={{ color: 'var(--fp-text)' }}>
      <div style={S.sec}>
        <p style={S.title}>Car</p>
        <div style={S.card}>
          <button type="button" style={S.row} onClick={() => setView('brand')}>
            <span style={S.k}>Brand</span>
            {d.brand && <Logo brand={d.brand} />}
            <span style={val(!!d.brand)}>{d.brand || 'Any brand'}</span>{chevron}
          </button>
          <button type="button" style={{ ...S.row, ...line, opacity: d.brand && models.length ? 1 : 0.45, cursor: d.brand && models.length ? 'pointer' : 'default' }}
            disabled={!d.brand || !models.length} onClick={() => setView('model')}>
            <span style={S.k}>Model</span>
            <span style={val(!!d.model)}>{d.model || (d.brand ? 'Any model' : 'Pick a brand first')}</span>{chevron}
          </button>
          {d.model && (
            <div style={{ ...S.row, ...line, cursor: 'default' }}>
              <span style={S.k}>Variant</span>
              <input value={d.variant || ''} onChange={(e) => setDraftParam('variant', e.target.value)} placeholder="Any, or type e.g. 1.5 V"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--fp-text)', fontSize: '16px', fontWeight: 600, fontFamily: 'inherit', padding: 0 }} />
            </div>
          )}
        </div>
      </div>

      <div style={S.sec}>
        <p style={S.title}>Budget</p>
        <div style={{ ...S.card, ...S.pad }}>
          <div style={{ marginBottom: '12px' }}>
            <Seg options={[['monthly', 'Monthly'], ['price', 'Price']]} value={budget} onPick={setBudget} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {budget === 'monthly'
              ? MONTHLY_CHIPS.map((m) => {
                const p = maxPriceForMonthly(m);
                const on = maxP === p;
                return <button key={m} type="button" aria-pressed={on} style={chip(on)} onClick={() => setDraftParam('max_price', on ? '' : String(p))}>RM {fmt(m)}/mo</button>;
              })
              : PRICE_CHIPS.map((p) => {
                const on = maxP === p;
                return <button key={p} type="button" aria-pressed={on} style={chip(on)} onClick={() => setDraftParam('max_price', on ? '' : String(p))}>Up to {priceLabel(p)}</button>;
              })}
            <button type="button" style={chip(!maxP)} onClick={() => setDraftParam('max_price', '')}>Any</button>
          </div>
          {maxP > 0 && (
            <p style={{ fontSize: '12px', color: 'var(--fp-muted)', margin: '10px 2px 0', lineHeight: 1.45 }}>
              Cars up to RM {fmt(maxP)}, about RM {fmt(calcMonthly(maxP))}/mo (10% down, 7 yrs, 6.5%). The bank decides.
            </p>
          )}
          {Number(d.min_price) > 0 && (
            <button type="button" onClick={() => setDraftParam('min_price', '')} style={{ ...chip(false), marginTop: '10px' }}>From RM {fmt(d.min_price)} ✕</button>
          )}
        </div>
      </div>

      <div style={S.sec}>
        <p style={S.title}>Condition</p>
        <Seg onCard options={[['', 'Any'], ...CONDITION_OPTIONS.map((c) => [c.value, c.value === 'recon' ? 'Recon' : c.label])]}
          value={d.condition} onPick={(v) => setDraftParam('condition', v)} />
      </div>

      <div style={S.sec}>
        <p style={S.title}>Year & mileage</p>
        <div style={{ ...S.card, ...S.pad }}>
          <div style={{ display: 'flex', gap: '8px' }}>{yearSel('year_from', 'From')}{yearSel('year_to', 'To')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: '10px' }}>
            {MILEAGE_OPTIONS.map((o) => {
              const on = d.mileage_max === o.value;
              return <button key={o.value} type="button" aria-pressed={on} style={chip(on)} onClick={() => setDraftParam('mileage_max', on ? '' : o.value)}>Under {Number(o.value) / 1000}k km</button>;
            })}
          </div>
        </div>
      </div>

      <div style={S.sec}>
        <p style={S.title}>Location</p>
        <div style={S.card}>
          <button type="button" style={S.row} onClick={() => setView('state')}>
            <span style={val(!!d.state)}>{d.state || 'All of Malaysia'}</span>{chevron}
          </button>
        </div>
      </div>

      <div style={S.sec}>
        <div style={S.card}>
          <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} style={{ ...S.row, fontWeight: 700 }}>
            <span style={{ flex: 1 }}>More filters{moreCount ? ` (${moreCount})` : ''}</span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--fp-muted)' }}>{moreOpen ? 'Hide' : 'Gearbox, fuel, colour'}</span>
            <ChevronRight size={17} style={{ color: 'var(--fp-muted)', transform: moreOpen ? 'rotate(90deg)' : 'none', transition: 'transform 160ms var(--xd-ease-out)' }} />
          </button>
          {moreOpen && (
            <div style={{ ...line, padding: '14px' }}>
              <p style={S.sub}>Gearbox</p>
              <div style={{ marginBottom: '14px' }}>
                <Seg options={[['', 'Any'], ...TRANSMISSIONS.map((t) => [t, t])]} value={d.transmission} onPick={(v) => setDraftParam('transmission', v)} />
              </div>
              <p style={S.sub}>Fuel</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '14px' }}>
                {FUEL_TYPES.map((f) => <button key={f} type="button" aria-pressed={d.fuel_type === f} style={chip(d.fuel_type === f)} onClick={() => setDraftParam('fuel_type', d.fuel_type === f ? '' : f)}>{f}</button>)}
              </div>
              <p style={S.sub}>Colour{d.colour ? `: ${d.colour}` : ''}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                {COLOUR_SWATCHES.filter((c) => COLOURS.includes(c.label)).map((c) => {
                  const on = d.colour === c.label;
                  return (
                    <button key={c.label} type="button" aria-label={c.label} aria-pressed={on} title={c.label}
                      onClick={() => setDraftParam('colour', on ? '' : c.label)}
                      style={{ width: '28px', height: '28px', borderRadius: '999px', border: 'none', cursor: 'pointer', background: c.hex, boxShadow: on ? '0 0 0 2px var(--fp-card), 0 0 0 4px var(--fp-ink)' : 'inset 0 0 0 1px rgba(0,0,0,0.18)' }} />
                  );
                })}
              </div>
              {isMarketplace && (
                <>
                  <p style={S.sub}>Seller</p>
                  <div style={{ marginBottom: '14px' }}>
                    <Seg options={[['', 'Any'], ...SELLER_TYPES.map((s) => [s.value, s.label])]} value={d.seller_type} onPick={(v) => setDraftParam('seller_type', v)} />
                  </div>
                </>
              )}
              <p style={S.sub}>Payment</p>
              <Seg options={[['', 'Any'], ...FINANCING_TYPES.map((f) => [f.value, f.label])]} value={d.financing} onPick={(v) => setDraftParam('financing', v)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
