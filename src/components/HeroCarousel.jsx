import React, { useState, useEffect, useCallback } from 'react';

const BADGE_STYLES = {
  'HOT DEAL':    { bg: 'rgba(220,38,38,0.85)',  color: '#fff' },
  'RARE FIND':   { bg: 'rgba(124,58,237,0.85)', color: '#fff' },
  'NEW ARRIVAL': { bg: 'rgba(16,185,129,0.85)', color: '#fff' },
};

// ─── Individual slide ─────────────────────────────────────────────────────────

function Slide({ slide, visible }) {
  const badge = slide.badge && slide.badge !== 'None' ? slide.badge : null;
  const stats = Array.isArray(slide.stats) ? slide.stats.filter(s => s.value) : [];

  const waMsg = encodeURIComponent(
    `Hi, I'm interested in the ${slide.year || ''} ${slide.car_name || 'car'}. Can you share more details?`
  );
  const waUrl = slide.whatsapp_number
    ? `https://wa.me/${slide.whatsapp_number.replace(/\D/g, '')}?text=${waMsg}`
    : null;

  return (
    <div
      className="hc-slide"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
    >
      {/* Full-bleed image */}
      {slide.image_url && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <img
            src={slide.image_url}
            alt={slide.car_name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 35%' }}
          />
          {/* Gradient: dark left-to-transparent (text area), dark bottom (blend), subtle top */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg,rgba(6,9,16,0.97) 0%,rgba(6,9,16,0.82) 38%,rgba(6,9,16,0.35) 62%,rgba(6,9,16,0.05) 100%)' }}/>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(6,9,16,0.88) 0%,transparent 42%)' }}/>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(6,9,16,0.45) 0%,transparent 22%)' }}/>
        </div>
      )}
      {!slide.image_url && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#060910,#0d1117)' }}/>
      )}

      {/* Content — pinned bottom-left */}
      <div className="hc-content-wrap">
        <div className="hc-inner">

          {/* Eyebrow line + badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 24, height: 2, background: '#dc2626', flexShrink: 0 }}/>
            {badge && BADGE_STYLES[badge] ? (
              <span style={{
                background: BADGE_STYLES[badge].bg, color: BADGE_STYLES[badge].color,
                fontSize: 10, fontWeight: 800, padding: '2px 9px',
                borderRadius: 20, letterSpacing: '0.07em',
                fontFamily: "'DM Sans',sans-serif",
              }}>
                {badge}
              </span>
            ) : (
              <span style={{ color: '#dc2626', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'DM Sans',sans-serif" }}>
                Featured Car
              </span>
            )}
          </div>

          {/* Car name */}
          <h1 className="hc-title" style={{ color: 'white', margin: '0 0 4px 0', lineHeight: 1 }}>
            {slide.year && (
              <span style={{ background: 'linear-gradient(135deg,#dc2626,#f87171)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {slide.year}{' '}
              </span>
            )}
            {slide.car_name}
          </h1>

          {/* Stats — Maserati-style flat row */}
          {stats.length > 0 && (
            <div className="hc-stats">
              {stats.slice(0, 4).map((s, i) => (
                <div key={i} className="hc-stat">
                  <p style={{ color: '#6b7280', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px 0', fontFamily: "'DM Sans',sans-serif" }}>
                    {s.type}
                  </p>
                  <p style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.1, fontFamily: "'DM Sans',sans-serif" }}>
                    {s.value}
                    {s.unit && <span style={{ color: '#9ca3af', fontSize: 12, fontWeight: 500, marginLeft: 2 }}>{s.unit}</span>}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* WhatsApp CTA */}
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hc-cta"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.28)',
                color: '#25D366', fontWeight: 700, fontSize: 13,
                padding: '10px 20px', borderRadius: 50, textDecoration: 'none',
                transition: 'all 0.2s ease', fontFamily: "'DM Sans',sans-serif",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,211,102,0.2)'; e.currentTarget.style.borderColor = 'rgba(37,211,102,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,211,102,0.1)'; e.currentTarget.style.borderColor = 'rgba(37,211,102,0.28)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enquire via WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main carousel ────────────────────────────────────────────────────────────

export default function HeroCarousel({ slides, isLoading }) {
  const [activeIdx, setActiveIdx] = useState(0);

  const prev = useCallback(() =>
    setActiveIdx(i => (i - 1 + slides.length) % slides.length), [slides.length]);
  const next = useCallback(() =>
    setActiveIdx(i => (i + 1) % slides.length), [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(next, 5500);
    return () => clearInterval(t);
  }, [slides.length, next]);

  useEffect(() => {
    if (activeIdx >= slides.length && slides.length > 0) setActiveIdx(0);
  }, [slides.length, activeIdx]);

  if (isLoading) {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060910' }}>
        <div className="animate-spin" style={{ width: 28, height: 28, border: '2px solid rgba(255,255,255,0.07)', borderTopColor: '#dc2626', borderRadius: '50%' }}/>
      </div>
    );
  }

  if (!slides || slides.length === 0) return null;

  return (
    <>
      <style>{`
        .hc-slide {
          position: absolute; inset: 0;
          transition: opacity 0.7s ease;
        }
        .hc-content-wrap {
          position: relative; z-index: 1;
          height: 100%;
          display: flex; flex-direction: column; justify-content: flex-end;
          max-width: 1280px; margin: 0 auto;
          padding: 0 24px 200px;
        }
        .hc-inner { max-width: 540px; }
        .hc-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(2.6rem, 7vw, 5rem);
          letter-spacing: 0.02em;
          word-break: break-word;
        }
        .hc-stats {
          display: flex; flex-wrap: wrap;
          gap: 0; margin: 16px 0 22px;
        }
        .hc-stat {
          padding: 6px 20px 6px 0;
          margin-right: 20px;
          border-right: 1px solid rgba(255,255,255,0.1);
        }
        .hc-stat:last-child { border-right: none; margin-right: 0; }
        .hc-nav-prev {
          position: absolute; left: 20px; top: 42%; transform: translateY(-50%);
          width: 38px; height: 38px; border-radius: 50%;
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
          color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; z-index: 5;
        }
        .hc-nav-next {
          position: absolute; right: 20px; top: 42%; transform: translateY(-50%);
          width: 38px; height: 38px; border-radius: 50%;
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
          color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; z-index: 5;
        }
        .hc-nav-prev:hover, .hc-nav-next:hover {
          background: rgba(220,38,38,0.3) !important;
          border-color: rgba(220,38,38,0.5) !important;
        }
        .hc-dots {
          position: absolute; bottom: 196px; left: 0; right: 0;
          display: flex; justify-content: center; gap: 6px; z-index: 5;
        }
        @media (max-width: 768px) {
          .hc-content-wrap { padding: 0 16px 168px; }
          .hc-inner { max-width: 100%; }
          .hc-title { font-size: clamp(2rem, 9vw, 3rem); }
          .hc-stat { padding: 5px 14px 5px 0; margin-right: 14px; }
          .hc-nav-prev { left: 10px; width: 32px; height: 32px; }
          .hc-nav-next { right: 10px; width: 32px; height: 32px; }
          .hc-dots { bottom: 162px; }
        }
        @media (max-width: 480px) {
          .hc-content-wrap { padding: 0 14px 152px; }
          .hc-title { font-size: clamp(1.85rem, 10vw, 2.6rem); }
          .hc-stat { padding: 4px 12px 4px 0; margin-right: 12px; }
          .hc-nav-prev, .hc-nav-next { display: none; }
          .hc-dots { bottom: 148px; }
        }
      `}</style>

      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        {slides.map((slide, i) => (
          <Slide key={slide.id} slide={slide} visible={i === activeIdx} />
        ))}

        {slides.length > 1 && (
          <>
            <button className="hc-nav-prev" onClick={prev} aria-label="Previous slide">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>

            <button className="hc-nav-next" onClick={next} aria-label="Next slide">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>

            <div className="hc-dots">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  style={{
                    width: i === activeIdx ? 22 : 6, height: 6,
                    borderRadius: 3, border: 'none', padding: 0, cursor: 'pointer',
                    background: i === activeIdx ? '#dc2626' : 'rgba(255,255,255,0.22)',
                    transition: 'all 0.3s',
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
