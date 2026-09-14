import React, { useState, useMemo } from 'react';
import CarCard from '../CarCard';

/* Which bucket a tab draws from, in display order. "all" is the blended,
   score-ranked default — model matches lead it. */
const TABS = [
  { key: 'all',   label: 'Recommended' },
  { key: 'model', label: 'Same model' },
  { key: 'brand', label: 'Same brand' },
  { key: 'body',  label: 'Same body' },
  { key: 'price', label: 'Similar price' },
];

const MIN_PER_TAB = 2;

const rm = (n) => 'RM ' + Number(n).toLocaleString('en-MY');

/* How close a candidate is to the car being viewed. Model is weighted hardest
   so the blended tab leads with same-model cars, then brand, then shape. */
function score(c, car) {
  let s = 0;
  if (c.model === car.model && c.brand === car.brand) s += 50;
  if (c.brand === car.brand) s += 25;
  if (car.body_type && c.body_type === car.body_type) s += 15;
  if (car.dealer_id && c.dealer_id === car.dealer_id) s += 10;
  if (car.state && c.state === car.state) s += 5;

  const p = Number(car.selling_price) || 0;
  const q = Number(c.selling_price) || 0;
  if (p > 0 && q > 0) {
    const gap = Math.abs(q - p) / p;
    if (gap <= 0.10) s += 12;
    else if (gap <= 0.20) s += 6;
  }
  if (car.year && c.year && Math.abs(c.year - car.year) <= 2) s += 8;
  return s;
}

/* Heading follows the active tab — it used to always read "More {brand}"
   even when the list wasn't brand-matched. */
function headingFor(key, car) {
  switch (key) {
    case 'model': return `More ${car.model}`;
    case 'brand': return `More ${car.brand}`;
    case 'body':  return `Other ${car.body_type}s`;
    case 'price': return `Around ${rm(Math.round((Number(car.selling_price) || 0) / 1000) * 1000)}`;
    default:      return 'Cars like this';
  }
}

export default function SimilarCars({ car, buckets, ctaContext, variant = 'desktop', th, wrapStyle }) {
  const [tab, setTab] = useState('all');

  // Blend every bucket into one score-ranked list for the default tab.
  const lists = useMemo(() => {
    const seen = new Map();
    Object.values(buckets || {}).forEach((rows) => {
      (rows || []).forEach((c) => { if (c && c.id !== car.id && !seen.has(c.id)) seen.set(c.id, c); });
    });
    const all = [...seen.values()]
      .sort((a, b) => score(b, car) - score(a, car))
      .slice(0, 8);
    return { ...buckets, all };
  }, [buckets, car]);

  const tabs = TABS.filter((t) => (lists[t.key] || []).length >= MIN_PER_TAB);
  if (tabs.length === 0) return null;

  const activeKey = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;
  const cars = (lists[activeKey] || []).slice(0, 8);
  const isMobile = variant === 'mobile';

  const pill = (t) => {
    const on = t.key === activeKey;
    return (
      <button
        key={t.key}
        onClick={() => setTab(t.key)}
        style={{
          background: on ? '#dc2626' : 'transparent',
          border: `1px solid ${on ? '#dc2626' : (th?.border || 'rgba(255,255,255,0.12)')}`,
          color: on ? '#fff' : (th?.textSec || 'rgba(255,255,255,0.6)'),
          borderRadius: 999,
          padding: isMobile ? '5px 12px' : '6px 14px',
          fontSize: isMobile ? 11 : 12,
          fontWeight: 600,
          fontFamily: 'system-ui, sans-serif',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.16s',
        }}
      >
        {t.label}
      </button>
    );
  };

  // The wrapper lives here, not in the page, so a car with nothing similar
  // leaves no empty padded block behind.
  return (
    <div style={wrapStyle}>
      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#dc2626', margin: '0 0 4px', fontWeight: 700 }}>
        You might also like
      </p>
      <h2 style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: isMobile ? '2.2rem' : '2.4rem',
        letterSpacing: '0.06em',
        color: th?.text,
        margin: '0 0 16px',
        borderLeft: '3px solid #dc2626',
        paddingLeft: isMobile ? 12 : 14,
      }}>
        {headingFor(activeKey, car)}
      </h2>

      {tabs.length > 1 && (
        <>
          <style>{`.sc-tabs::-webkit-scrollbar { display: none; }`}</style>
          {/* Five pills overflow 375px, so the row scrolls rather than wraps. */}
          <div className="sc-tabs" style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', paddingBottom: 2 }}>
            {tabs.map(pill)}
          </div>
        </>
      )}

      {/* compact matches the marketplace home page's body-type carousels
          (BodyTypeCarousel.jsx) — taller 4:3 photo + tighter text on mobile,
          instead of CarCard's default full-width 16:9 shape, which read as
          cramped photos at 2-up card widths. sizes is corrected per layout so
          the image CDN isn't asked for a full-viewport-wide image for what is
          actually a half-width (mobile) or quarter-width (desktop) slot. */}
      {isMobile ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {cars.map((s) => (
            <CarCard key={s.id} car={s} ctaContext={ctaContext} showCompare compact sizes="calc(50vw - 26px)" />
          ))}
        </div>
      ) : (
        <>
          <div className="cdp-similar-grid">
            {cars.map((s) => (
              <CarCard key={s.id} car={s} ctaContext={ctaContext} showCompare compact sizes="(max-width: 1024px) calc(50vw - 40px), 300px" />
            ))}
          </div>
          <div className="cdp-similar-scroll">
            {cars.map((s) => (
              <div key={s.id} style={{ flexShrink: 0, width: '72vw', scrollSnapAlign: 'start' }}>
                <CarCard car={s} ctaContext={ctaContext} showCompare compact sizes="72vw" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
