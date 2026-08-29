import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cdnImg } from '../../utils/img';

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const fmtPrice = (car) => {
  const p = Number(car.selling_price);
  return p > 0 ? 'RM ' + p.toLocaleString('en-MY') : 'P.O.R';
};

// One titled row of 3 car tiles (photo + price only) inside the marketplace
// hero, replacing the old "Browse by Budget" grid. Auto-advances through the
// pool 3-at-a-time every 5s using a CSS animationend timer — mirrors
// HeroCarousel.jsx's pattern (no setInterval, auto-throttles on hidden tabs)
// rather than a JS interval. A pool of 3 or fewer never renders the timer —
// there's nothing new to cycle to.
export default function HeroCarRow({ eyebrow, title, cars, viewAllHref }) {
  const chunks = useMemo(() => chunk(cars, 3), [cars]);
  const [idx, setIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [paused, setPaused] = useState(false);

  // Guards against a stale index when the pool changes shape (e.g. row 1
  // flips from 'all' to 'hot' and the new pool has fewer chunks).
  const safeIdx = idx < chunks.length ? idx : 0;
  const current = chunks[safeIdx] || [];

  const advance = () => {
    setIdx((safeIdx + 1) % chunks.length);
    setAnimKey((k) => k + 1);
  };

  return (
    <div style={{ minWidth: 0 }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(220,38,38,0.8)', fontFamily: "'Outfit',sans-serif" }}>{eyebrow}</p>
          <h3 style={{ margin: 0, fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(16px,1.6vw,20px)', color: '#ffffff', letterSpacing: '0.02em', lineHeight: 1 }}>{title}</h3>
        </div>
        {viewAllHref && (
          <Link
            to={viewAllHref}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontFamily: "'Outfit',sans-serif", flexShrink: 0 }}
          >
            View All <ArrowRight size={10} />
          </Link>
        )}
      </div>

      {current.length === 0 ? (
        <div style={{ padding: '18px 0', color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: "'Outfit',sans-serif" }}>
          No cars listed yet
        </div>
      ) : (
        <div className="mp-carrow-grid">
          {current.map((car) => (
            <Link key={car.id} to={`/showroom/${car.slug || car.id}`} className="mp-carrow-item">
              <div className="mp-carrow-img" style={{ backgroundImage: `url(${cdnImg(car.images?.[0], 300, 65)})` }} />
              <span className="mp-carrow-price">{fmtPrice(car)}</span>
            </Link>
          ))}
        </div>
      )}

      {chunks.length > 1 && (
        <div
          key={animKey}
          className="mp-carrow-progress"
          style={{ animationDuration: '5000ms', animationPlayState: paused ? 'paused' : 'running' }}
          onAnimationEnd={advance}
        />
      )}
    </div>
  );
}
