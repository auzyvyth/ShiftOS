import { Link } from 'react-router-dom';

// 16 brands → clean grid (4×4 on mobile). Text-only: faster + no trademark exposure.
const BRANDS = [
  { label: 'All Brands', val: '' },
  { label: 'Perodua', val: 'Perodua' },
  { label: 'Proton', val: 'Proton' },
  { label: 'Toyota', val: 'Toyota' },
  { label: 'Honda', val: 'Honda' },
  { label: 'Nissan', val: 'Nissan' },
  { label: 'Mazda', val: 'Mazda' },
  { label: 'Mitsubishi', val: 'Mitsubishi' },
  { label: 'BMW', val: 'BMW' },
  { label: 'Mercedes', val: 'Mercedes-Benz' },
  { label: 'Hyundai', val: 'Hyundai' },
  { label: 'Kia', val: 'Kia' },
  { label: 'Lexus', val: 'Lexus' },
  { label: 'Subaru', val: 'Subaru' },
  { label: 'Volkswagen', val: 'Volkswagen' },
  { label: 'Audi', val: 'Audi' },
];

// Subtle carbon grain (inline SVG fractal noise — no image request).
const NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")";
const COAL = `${NOISE}, radial-gradient(120% 120% at 30% 20%, #232323 0%, #171717 55%, #101010 100%)`;
const COAL_ACTIVE = `${NOISE}, radial-gradient(120% 120% at 30% 20%, #3a1d1f 0%, #221314 55%, #190d0e 100%)`;

export default function BrandStrip({ activeBrand = '', hrefFor }) {
  return (
    <section style={{ background: '#EDEAE3', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '32px 0 40px' }}>
      <div style={{ maxWidth: 1380, margin: '0 auto', padding: '0 clamp(16px, 4vw, 44px)' }}>
        <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#9b7d3a', fontFamily: "'Outfit',sans-serif" }}>Browse by Brand</p>
        <div className="bs-grid">
          {BRANDS.map(({ label, val }) => {
            const active = val ? activeBrand === val : !activeBrand;
            return (
              <Link
                key={label}
                to={hrefFor(val)}
                className="bs-tile"
                style={{
                  background: active ? COAL_ACTIVE : COAL,
                  border: `1px solid ${active ? 'rgba(220,38,38,0.55)' : 'rgba(255,255,255,0.08)'}`,
                  color: active ? '#fca5a5' : '#e7e5e4',
                  boxShadow: active ? '0 6px 22px rgba(220,38,38,0.18)' : '0 2px 10px rgba(0,0,0,0.18)',
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
      <style>{`
        .bs-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px; }
        .bs-tile {
          display: flex; align-items: center; justify-content: center; text-align: center;
          min-height: 56px; padding: 8px 6px; border-radius: 13px; text-decoration: none;
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.01em;
          background-blend-mode: overlay; transition: transform .16s ease, border-color .2s, box-shadow .2s, color .2s;
        }
        .bs-tile:hover { transform: translateY(-3px); border-color: rgba(220,38,38,0.45) !important; color: #fff !important; }
        /* Below desktop, a 3-4 col grid stacks 16 brands into 5-6 tall rows.
           Switch to two fixed rows that scroll sideways so the strip stays short. */
        @media (max-width: 1100px) {
          .bs-grid {
            grid-template-columns: none;
            grid-template-rows: repeat(2, 1fr);
            grid-auto-flow: column;
            grid-auto-columns: 120px;
            overflow-x: auto;
            scroll-snap-type: x proximity;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            padding-bottom: 6px;
          }
          .bs-grid::-webkit-scrollbar { display: none; }
          .bs-tile { scroll-snap-align: start; }
        }
        @media (max-width: 460px)  { .bs-grid { grid-auto-columns: 108px; gap: 8px; } .bs-tile { min-height: 52px; font-size: 12px; border-radius: 11px; } }
      `}</style>
    </section>
  );
}
