import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/* ─────────────────────────────────────────────────────────────────────────────
   HeroSection — xdrive.my public marketplace hero
   Palette: warm off-white bg, #dc2626 accent, #111827 text, DM Sans / Bebas Neue
───────────────────────────────────────────────────────────────────────────── */

const CHIPS = [
  'Honda Civic FL5',
  'Toyota Alphard',
  'BMW M5',
  'Porsche 911',
  'Mercedes GLC',
  'Toyota Vellfire',
];

// TODO: replace with live Supabase count
const TRUST_STATS = [
  { number: '2,400+', label: 'verified cars listed today' },
  { number: '180+',   label: 'certified dealers across Malaysia' },
  { number: '100%',   label: 'listings require full documentation' },
  { number: 'Zero',   label: 'phantom listings or fake prices' },
];

const FLOAT_ITEMS = [
  { label: 'Full ownership docs',   dot: '#22c55e' },
  { label: 'Service history',       dot: '#3b82f6' },
  { label: 'Verified dealer badge', dot: '#f59e0b' },
];

/* ── inline SVGs ── */
const IconShield = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
      fill="rgba(220,38,38,0.18)" stroke="#dc2626" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M9 12l2 2 4-4" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" aria-hidden>
    <circle cx="11" cy="11" r="8"/>
    <path d="M21 21l-4.35-4.35"/>
  </svg>
);

const IconMapPin = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="#9ca3af" strokeWidth="2" aria-hidden>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
    <circle cx="12" cy="9" r="2.5"/>
  </svg>
);

const IconChevron = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
    <path d="M6 9l6 6 6-6"/>
  </svg>
);

/* ─────────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────────── */
export default function HeroSection() {
  const navigate = useNavigate();
  const [query,  setQuery]  = useState('');
  const [budget, setBudget] = useState('');

  function handleSearch(e) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (query)  p.set('q',      query);
    if (budget) p.set('budget', budget);
    navigate(`/browse${p.toString() ? `?${p}` : ''}`);
  }

  return (
    <>
      {/* ── fonts + responsive overrides ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=Bebas+Neue&display=swap');

        .hs-navlink { transition: color 0.15s; }
        .hs-navlink:hover { color: #111827 !important; }

        .hs-cta-btn { transition: background 0.15s; }
        .hs-cta-btn:hover { background: #b91c1c !important; }

        .hs-chip { transition: border-color 0.15s, color 0.15s; }
        .hs-chip:hover { border-color: rgba(220,38,38,0.4) !important; color: #dc2626 !important; }

        .hs-search-btn { transition: background 0.15s; }
        .hs-search-btn:hover { background: #b91c1c !important; }

        .hs-just-listed-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important; }

        /* ── mobile ── */
        @media (max-width: 767px) {
          .hs-nav-links  { display: none !important; }
          .hs-car-col    { display: none !important; }

          .hs-headline   { font-size: clamp(42px, 11vw, 64px) !important; }

          .hs-search-row { flex-direction: column !important; border-radius: 14px !important; }
          .hs-search-input-wrap  { border-right: none !important; border-bottom: 1px solid rgba(0,0,0,0.07) !important; }
          .hs-search-budget-wrap { border-right: none !important; border-bottom: 1px solid rgba(0,0,0,0.07) !important; }
          .hs-search-btn { padding: 15px 20px !important; justify-content: center !important; }

          .hs-trust-grid  { grid-template-columns: 1fr 1fr !important; gap: 20px !important; }
          .hs-trust-item  { border-right: none !important; padding-right: 0 !important; }

          .hs-bottom     { gap: 0 !important; }
          .hs-trust-col  { padding-bottom: 40px !important; }
        }

        /* ── tablet ── */
        @media (min-width: 768px) and (max-width: 1023px) {
          .hs-car-col { display: none !important; }
          .hs-trust-col { width: 100% !important; }
        }
      `}</style>

      <div style={{ background: '#F2F0EB', fontFamily: "'DM Sans', sans-serif" }}>

        {/* ════════════════════════════════ NAVBAR ════════════════════════════════ */}
        <nav style={{
          maxWidth: 1280, margin: '0 auto',
          padding: '20px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <img src="/xdrivelogo.png" alt="xdrive.my" style={{ height: 32, width: 'auto', display: 'block' }} />
          </Link>

          {/* Nav links + CTA */}
          <div className="hs-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {[['Browse', '/browse'], ['Dealers', '/dealers'], ['Sell your car', '/sell']].map(([label, to]) => (
              <Link
                key={to} to={to}
                className="hs-navlink"
                style={{ textDecoration: 'none', fontSize: 14, fontWeight: 500, color: '#6b7280' }}
              >
                {label}
              </Link>
            ))}
            <Link
              to="/list-dealership"
              className="hs-cta-btn"
              style={{
                textDecoration: 'none', background: '#dc2626', color: '#fff',
                fontSize: 14, fontWeight: 600, padding: '10px 20px', borderRadius: 10,
                whiteSpace: 'nowrap',
              }}
            >
              List your dealership
            </Link>
          </div>
        </nav>

        {/* ════════════════════════════════ HERO COPY ════════════════════════════ */}
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 28px 0' }}>

          {/* Trust banner pill */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(220,38,38,0.08)',
              border: '0.5px solid rgba(220,38,38,0.25)',
              borderRadius: 100, padding: '7px 16px',
            }}>
              <IconShield />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', letterSpacing: '0.01em' }}>
                Malaysia's first fully-verified used car marketplace
              </span>
            </div>
          </div>

          {/* Headline */}
          <h1
            className="hs-headline"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(52px, 7.5vw, 80px)',
              lineHeight: 1,
              letterSpacing: '-0.02em',
              textAlign: 'center',
              margin: '0 0 18px',
            }}
          >
            <span style={{ display: 'block', color: '#111827' }}>Buy used cars.</span>
            <span style={{ display: 'block', color: 'rgba(17,24,39,0.32)' }}>Without the bullshit.</span>
          </h1>

          {/* Subheadline */}
          <p style={{
            fontSize: 15, color: '#6b7280', lineHeight: 1.75,
            textAlign: 'center', maxWidth: 480, margin: '0 auto 36px',
            fontWeight: 400,
          }}>
            Every listing on xdrive.my is from a verified dealer — complete with documents,
            real photos, and a track record. No phantom listings. No Mudah-style scams.
          </p>

          {/* ── Search bar ── */}
          <form onSubmit={handleSearch} style={{ maxWidth: 680, margin: '0 auto 20px' }}>
            <div
              className="hs-search-row"
              style={{
                display: 'flex', alignItems: 'stretch',
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.10)',
                borderRadius: 14,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                overflow: 'hidden',
              }}
            >
              {/* Text input */}
              <div
                className="hs-search-input-wrap"
                style={{ flex: 1, display: 'flex', alignItems: 'center', borderRight: '1px solid rgba(0,0,0,0.07)', minWidth: 0 }}
              >
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by make, model, or registration..."
                  style={{
                    width: '100%', border: 'none', outline: 'none',
                    padding: '16px 20px', fontSize: 14, color: '#111827',
                    background: 'transparent', fontFamily: "'DM Sans', sans-serif",
                  }}
                />
              </div>

              {/* Budget select */}
              <div
                className="hs-search-budget-wrap"
                style={{ position: 'relative', display: 'flex', alignItems: 'center', borderRight: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}
              >
                <select
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  style={{
                    border: 'none', outline: 'none',
                    padding: '16px 36px 16px 18px',
                    fontSize: 14, color: budget ? '#111827' : '#9ca3af',
                    background: 'transparent',
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: 'pointer', appearance: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <option value="">Any budget</option>
                  <option value="under100k">Under RM 100k</option>
                  <option value="100k-300k">RM 100k–300k</option>
                  <option value="above300k">RM 300k+</option>
                </select>
                {/* Custom chevron */}
                <span style={{ position: 'absolute', right: 12, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                  <IconChevron />
                </span>
              </div>

              {/* Search button */}
              <button
                type="submit"
                className="hs-search-btn"
                style={{
                  background: '#dc2626', color: '#fff',
                  border: 'none', padding: '0 28px',
                  fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  display: 'flex', alignItems: 'center', gap: 8,
                  flexShrink: 0, whiteSpace: 'nowrap',
                }}
              >
                <IconSearch /> Search
              </button>
            </div>
          </form>

          {/* ── Quick chips ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, flexWrap: 'wrap', marginBottom: 56,
          }}>
            <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500, flexShrink: 0 }}>Popular:</span>
            {CHIPS.map(chip => (
              <button
                key={chip}
                className="hs-chip"
                onClick={() => navigate(`/browse?q=${encodeURIComponent(chip)}`)}
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(0,0,0,0.09)',
                  borderRadius: 100, padding: '6px 14px',
                  fontSize: 13, fontWeight: 500, color: '#6b7280',
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* ════════════════════════════ BOTTOM TWO-COL ════════════════════════ */}
          <div
            className="hs-bottom"
            style={{ display: 'flex', gap: 48, alignItems: 'flex-start', paddingBottom: 64 }}
          >

            {/* ── LEFT: trust stats ── */}
            <div className="hs-trust-col" style={{ flex: 1 }}>
              <div
                className="hs-trust-grid"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}
              >
                {TRUST_STATS.map((stat, i) => (
                  <div
                    key={stat.number}
                    className="hs-trust-item"
                    style={{
                      paddingRight: 24,
                      paddingLeft: i === 0 ? 0 : 24,
                      borderRight: i < TRUST_STATS.length - 1 ? '1px solid rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    <div style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: 32, color: '#111827',
                      lineHeight: 1, marginBottom: 6,
                    }}>
                      {stat.number}
                    </div>
                    <div style={{
                      fontSize: 11, color: '#9ca3af',
                      fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.07em', lineHeight: 1.5,
                    }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT: car illustration placeholder + float cards (desktop only) ── */}
            <div
              className="hs-car-col"
              style={{ width: 400, flexShrink: 0, position: 'relative', paddingBottom: 24, paddingRight: 20 }}
            >
              {/* Illustration placeholder */}
              <div style={{
                height: 300,
                background: 'rgba(0,0,0,0.03)',
                border: '1.5px dashed rgba(0,0,0,0.08)',
                borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 12, color: '#c4c2bc', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.02em' }}>
                  {/* TODO: replace with actual car render */}
                  TODO: car render
                </span>
              </div>

              {/* Float card 1 — "every listing includes" — top-left */}
              <div style={{
                position: 'absolute', top: -16, left: -24,
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 12, padding: '14px 16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                minWidth: 196,
              }}>
                <p style={{
                  fontSize: 10, fontWeight: 700, color: '#9ca3af',
                  textTransform: 'uppercase', letterSpacing: '0.09em',
                  margin: '0 0 10px',
                }}>
                  every listing includes
                </p>
                {FLOAT_ITEMS.map(({ label, dot }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', fontFamily: "'DM Sans', sans-serif" }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Float card 2 — "just listed" — bottom-right */}
              <Link
                to="/listing/sample"
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="hs-just-listed-card"
                  style={{
                    position: 'absolute', bottom: 0, right: -8,
                    background: '#ffffff',
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 12, padding: '13px 15px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    minWidth: 172,
                  }}
                >
                  {/* "Just listed" tag */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'rgba(220,38,38,0.08)',
                    border: '0.5px solid rgba(220,38,38,0.25)',
                    borderRadius: 6, padding: '3px 8px',
                    marginBottom: 9,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626' }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#dc2626', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Just listed
                    </span>
                  </div>

                  {/* Car name */}
                  <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#111827', fontFamily: "'DM Sans', sans-serif" }}>
                    2021 Honda Civic 1.5T
                  </p>

                  {/* Location */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 9 }}>
                    <IconMapPin />
                    <span style={{ fontSize: 12, color: '#6b7280', fontFamily: "'DM Sans', sans-serif" }}>
                      Kuala Lumpur
                    </span>
                  </div>

                  {/* Price */}
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#dc2626', fontFamily: "'DM Sans', sans-serif" }}>
                    RM 128,000
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
