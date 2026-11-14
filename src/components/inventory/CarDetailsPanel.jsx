// The "Details" button of the dealer's car pop-up (ListingDetailDrawer, DashboardPage.jsx).
// Owner, 2026-11-12: ONE pop-up per car with three buttons (Details | Owner | Analytics) in place of
// three separate screens. This is the first: everything the buyer sees on the car page, plus the
// dealer-only identifiers, on one scrolling page. No sub-tabs (Specs / Features / Options / Recon
// used to be four clicks); each is a section. Drawn in premiumLight: grey blocks, no borders.
//
// The six facts at the top (year, mileage, engine, gearbox, fuel, colour) are NOT repeated in the lists below.
// The field list mirrors the public car page's `detailRows` (CarDetailPage.jsx) so the two never
// disagree about what a car is; a row with no value shows a dash, because on THIS screen the gap
// is the news ("no VIN", "no road tax date"). Recon-only rows show only on a recon car.
import React from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, MapPin } from 'lucide-react';
import { premiumLight as PL } from '../../theme/tokens';
import DamageMap from '../DamageMap';

const CONDITION_LABEL = { recon: 'Recon', used: 'Used', new: 'New' };
const CHASSIS_LABEL = { clean: 'Clean', repaired: 'Repaired', written_off: 'Written off' };
// Same answer the buyer reads on the car page (CarDetailPage fmtFinancing): a new car is always a loan.
const financing = (l) => {
  if (l.condition === 'new') return 'Loan available';
  const pt = l.payment_type || l.financing_type;
  if (pt === 'cash') return 'Cash only';
  if (pt === 'loan') return 'Loan available';
  return l.loan_eligible === false ? 'Cash only' : 'Loan available';
};
// 'held' is written when the registration card is uploaded; any other text is the reason it is not held.
const geran = (l) => (!l.geran_status ? null : l.geran_status === 'held' ? 'Held (card uploaded)' : l.geran_status);

const num = (n) => Number(n).toLocaleString();
const dateMY = (d) => {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
};
const has = (v) => v !== null && v !== undefined && v !== '' && v !== 0;

function tags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return String(raw).split(/,|\n/).map((s) => s.trim()).filter(Boolean);
}

// Three buttons. `tabs` = [{ id, label }]; the caller decides which exist (Owner needs the
// view_cost permission, so a salesman or manager without it sees fewer).
export function CarSheetTabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" aria-label="Car information" style={{ display: 'flex', gap: 4, background: PL.raised, borderRadius: PL.radius.pill, padding: 4, marginBottom: 16 }}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} role="tab" aria-selected={on} onClick={() => onChange(t.id)}
            style={{ flex: 1, height: 38, borderRadius: PL.radius.pill, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              background: on ? PL.card : 'transparent', color: on ? PL.text : PL.textMuted, boxShadow: on ? '0 1px 3px rgba(17,24,39,0.12)' : 'none', transition: 'background .15s, color .15s' }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Group({ title, rows }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: PL.textMuted }}>{title}</h3>
      <div style={{ background: PL.raised, borderRadius: PL.radius.row, padding: '2px 14px' }}>
        {rows.map(([k, v], i) => {
          const empty = !has(v);
          return (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderTop: i ? `1px solid ${PL.line}` : 'none' }}>
              <span style={{ fontSize: 13, color: PL.textSec }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: empty ? 400 : 600, color: empty ? PL.textMuted : PL.text, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{empty ? '—' : v}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Chips({ title, items, none }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: PL.textMuted }}>{title}</h3>
      {items.length === 0
        ? <p style={{ margin: 0, fontSize: 13, color: PL.textMuted }}>{none}</p>
        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {items.map((f, i) => <span key={i} style={{ fontSize: 12.5, color: PL.textSec, background: PL.raised, borderRadius: PL.radius.pill, padding: '5px 12px' }}>{f}</span>)}
          </div>}
    </section>
  );
}

export default function CarDetailsPanel({ listing, images, imgIdx, setImgIdx, onOpenLightbox, isMobile, monthlyText }) {
  const l = listing;
  const recon = !!l.is_recon;
  const sp = l.selling_price || l.price || 0;
  const op = l.original_price || l.previous_price || null;
  const saving = op && op > sp ? op - sp : 0;
  let damageMap = [];
  try { if (l.damage_map) damageMap = typeof l.damage_map === 'string' ? JSON.parse(l.damage_map) : l.damage_map; } catch { /* unreadable map: shown as none */ }

  const facts = [
    ['Year', l.year], ['Mileage', l.mileage ? `${num(l.mileage)} km` : null], ['Engine', l.engine_cc ? `${num(l.engine_cc)} cc` : null],
    ['Gearbox', l.transmission], ['Fuel', l.fuel_type], ['Colour', l.colour],
  ];
  const groups = [
    ['The car', [
      ['Brand', l.brand], ['Model', l.model], ['Variant', l.variant],
      ['Condition', CONDITION_LABEL[l.condition] || (recon ? 'Recon' : null)], ['Body type', l.body_type],
      ['Doors', l.doors], ['Seats', l.seats],
      ['Location', [l.city, l.state].filter(Boolean).join(', ')],
    ]],
    ['Engine and performance', [
      ['Cylinders', l.cylinders ? `${l.cylinders}-cyl` : null],
      ['Power', l.horsepower ? `${num(l.horsepower)} hp` : null],
      ['Fuel economy', l.fuel_consumption ? `${l.fuel_consumption} km/L` : null],
      ['0-100 km/h', l.acceleration ? `${l.acceleration}s` : null], ['Top speed', l.top_speed ? `${l.top_speed} km/h` : null],
      ['Boot space', l.boot_size ? `${l.boot_size} L` : null], ['CO2', l.co2_emissions ? `${l.co2_emissions} g/km` : null],
      ['Safety rating', l.safety_rating ? `${l.safety_rating} stars` : null], ['Insurance group', l.insurance_group ? String(l.insurance_group) : null],
    ]],
    ['Registration and papers', [
      ['Plate number', l.plate_number], ['Chassis no. (VIN)', l.vin_number || l.vin], ['Engine no.', l.engine_number],
      ['Registered', dateMY(l.registration_date)], ...(recon ? [['Local registration', dateMY(l.local_reg_date)]] : []),
      ['Previous owners', l.previous_owners != null && l.previous_owners !== '' ? String(l.previous_owners) : null],
      ['Chassis status', l.condition !== 'new' ? CHASSIS_LABEL[l.chassis_status] : null],
      ['Geran', geran(l)], ['Road tax until', dateMY(l.road_tax_expiry)],
      ['Documents checked', l.docs_verified ? `Yes${l.docs_verified_at ? `, ${dateMY(l.docs_verified_at)}` : ''}` : null],
    ]],
    ['Sale terms', [
      ['Warranty', l.warranty_months > 0 ? `${l.warranty_months} months` : null],
      ['Financing', financing(l)],
      ['Deposit to reserve', l.deposit_amount > 0 ? `RM ${num(l.deposit_amount)}` : null],
    ]],
    ...(recon ? [['Import and auction', [
      ['Imported from', l.import_country], ['Auction house', l.auction_house],
      ['Exterior grade', l.auction_grade], ['Interior grade', l.interior_grade],
    ]]] : []),
  ];

  const arrow = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'rgba(17,24,39,0.55)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <div>
      {/* Gallery */}
      <div style={{ display: 'flex', gap: 8 }}>
        {!isMobile && (
          <div style={{ width: 64, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {images.map((img, i) => (
              <button key={i} onClick={() => setImgIdx(i)} aria-label={`Photo ${i + 1}`}
                style={{ width: 64, height: 48, borderRadius: 8, padding: 0, cursor: 'pointer', flexShrink: 0, background: PL.raised, border: 'none', overflow: 'hidden', opacity: i === imgIdx ? 1 : 0.5, outline: i === imgIdx ? `2px solid ${PL.text}` : 'none' }}>
                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, position: 'relative', background: '#0f1117', borderRadius: PL.radius.row, overflow: 'hidden', height: isMobile ? 210 : 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={images[imgIdx]} alt="" onClick={onOpenLightbox} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'zoom-in', display: 'block' }} />
          {images.length > 1 && (
            <>
              <button aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); setImgIdx((i) => (i - 1 + images.length) % images.length); }} style={{ ...arrow, left: 8 }}><ChevronLeft size={16} /></button>
              <button aria-label="Next photo" onClick={(e) => { e.stopPropagation(); setImgIdx((i) => (i + 1) % images.length); }} style={{ ...arrow, right: 8 }}><ChevronRight size={16} /></button>
              <span style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 11, color: '#fff', background: 'rgba(17,24,39,0.55)', borderRadius: PL.radius.pill, padding: '3px 9px' }}>{imgIdx + 1} / {images.length}</span>
            </>
          )}
          <button aria-label="Full screen" onClick={onOpenLightbox} style={{ position: 'absolute', bottom: 8, right: 8, width: 30, height: 30, borderRadius: '50%', background: 'rgba(17,24,39,0.55)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ZoomIn size={14} /></button>
        </div>
      </div>

      {/* Name, price */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12, color: PL.textMuted, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>{l.brand}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: PL.text, lineHeight: 1.2, marginTop: 2 }}>{l.model}{l.variant ? ` ${l.variant}` : ''}</div>
        {(l.city || l.state) && (
          <div style={{ fontSize: 13, color: PL.textSec, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} />{[l.city, l.state].filter(Boolean).join(', ')}</div>
        )}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: PL.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>RM {num(sp)}</span>
          {saving > 0 && <span style={{ fontSize: 13, color: PL.textMuted, textDecoration: 'line-through' }}>RM {num(op)}</span>}
          {saving > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: PL.accentText }}>Down RM {num(saving)}</span>}
        </div>
        {monthlyText && <div style={{ fontSize: 12.5, color: PL.textMuted, marginTop: 4 }}>{monthlyText}</div>}
      </div>

      {/* The six facts a buyer checks first */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 16 }}>
        {facts.map(([k, v]) => (
          <div key={k} style={{ background: PL.raised, borderRadius: PL.radius.row, padding: '10px 12px', minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: PL.textMuted, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>{k}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: has(v) ? PL.text : PL.textMuted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{has(v) ? v : '—'}</div>
          </div>
        ))}
      </div>

      {groups.map(([title, rows]) => <Group key={title} title={title} rows={rows} />)}

      {has(l.specs) && typeof l.specs === 'string' && (
        <section style={{ marginTop: 18 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: PL.textMuted }}>Seller's notes</h3>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: PL.textSec, whiteSpace: 'pre-wrap' }}>{l.specs}</p>
        </section>
      )}

      <Chips title="Features" items={tags(l.features)} none="No features listed." />
      <Chips title="Options" items={tags(l.options)} none="No options listed." />

      {recon && (
        <section style={{ marginTop: 18 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: PL.textMuted }}>Condition map</h3>
          {Array.isArray(damageMap) && damageMap.length > 0
            ? <DamageMap value={damageMap} readOnly theme="light" />
            : <p style={{ margin: 0, fontSize: 13, color: PL.textMuted }}>No damage marked on this car.</p>}
        </section>
      )}
    </div>
  );
}
