import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Tag, Gauge, Calendar, Zap, Star } from 'lucide-react';
import { supabase } from '../supabaseClient';

const ICON_MAP = {
  price: Tag, mileage: Gauge, year: Calendar,
  engine: Zap, engine_cc: Zap, horsepower: Zap, grade: Star,
};

const BADGE = {
  'HOT DEAL':    { bg: 'rgba(220,38,38,0.9)',  color: '#fff' },
  'RARE FIND':   { bg: 'rgba(124,58,237,0.9)', color: '#fff' },
  'NEW ARRIVAL': { bg: 'rgba(16,185,129,0.9)', color: '#fff' },
};


const HC2_CSS = `
  .hc2-section {
    position: relative;
    background: #060910;
    overflow: hidden;
    min-height: 520px;
    font-family: 'DM Sans', sans-serif;
  }
  .hc2-glow {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 70% 50%, rgba(220,38,38,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .hc2-inner {
    position: relative; z-index: 1;
    max-width: 1280px; margin: 0 auto;
    padding: 80px 24px 0;
  }
  .hc2-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    align-items: center;
    min-height: 340px;
  }
  .hc2-image-col {
    display: flex; align-items: center; justify-content: center;
  }
  @keyframes hc2-slide-in {
    from { opacity: 0; transform: translateX(-20px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes hc2-img-in {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
  }
  .hc2-slide-in { animation: hc2-slide-in 0.5s ease forwards; }
  .hc2-img-in   { animation: hc2-img-in   0.5s ease forwards; }
  .hc2-enquire-btn {
    display: inline-flex; align-items: center; gap: 7px;
    background: linear-gradient(135deg,#dc2626,#b91c1c);
    color: white; font-weight: 700; font-size: 13px;
    padding: 11px 22px; border-radius: 50px; text-decoration: none;
    box-shadow: 0 4px 16px rgba(220,38,38,0.35);
    transition: all 0.2s;
  }
  .hc2-enquire-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(220,38,38,0.45); }
  .hc2-details-btn {
    display: inline-flex; align-items: center; gap: 7px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
    color: white; font-weight: 600; font-size: 13px;
    padding: 11px 22px; border-radius: 50px; text-decoration: none;
    transition: all 0.2s;
  }
  .hc2-details-btn:hover { background: rgba(255,255,255,0.1); }
  .hc2-stats-wrap { margin-top: 28px; padding-bottom: 0; }
  .hc2-dots { display: flex; justify-content: center; gap: 6px; margin-bottom: 14px; }
  .hc2-stats-grid {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 1px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px; overflow: hidden;
    backdrop-filter: blur(12px);
  }
  .hc2-stat-cell {
    padding: 14px 20px;
    background: rgba(8,12,20,0.8);
    border-right: 1px solid rgba(255,255,255,0.05);
  }
  .hc2-stat-cell:last-child { border-right: none; }
  .hc2-nav-btn {
    position: absolute; top: 46%; transform: translateY(-50%);
    width: 38px; height: 38px; border-radius: 50%;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    color: white; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    z-index: 5; transition: all 0.2s;
  }
  .hc2-nav-btn:hover { background: rgba(220,38,38,0.2); border-color: rgba(220,38,38,0.4); }
  .hc2-prev { left: 16px; }
  .hc2-next { right: 16px; }
  .hc2-spinner {
    width: 28px; height: 28px;
    border: 2px solid rgba(255,255,255,0.07); border-top-color: #dc2626;
    border-radius: 50%; animation: hc2-spin 0.8s linear infinite;
  }
  @keyframes hc2-spin { to { transform: rotate(360deg); } }
  @keyframes spin     { to { transform: rotate(360deg); } }
  .hc2-fade {
    position: absolute; bottom: 0; left: 0; right: 0; height: 48px;
    background: linear-gradient(to bottom,transparent,#080C14);
    pointer-events: none;
  }
  @media (max-width: 768px) {
    .hc2-grid { grid-template-columns: 1fr; gap: 16px; min-height: auto; }
    .hc2-image-col { justify-content: center; max-height: 200px; overflow: hidden; }
    .hc2-image-col img { max-height: 190px; width: auto; max-width: 100%; }
    .hc2-nav-btn { display: none; }
    .hc2-stats-grid { grid-template-columns: repeat(2,1fr); }
    .hc2-inner { padding: 64px 16px 0; }
  }
  @media (max-width: 480px) {
    .hc2-image-col img { max-height: 160px; }
    .hc2-stat-cell { padding: 12px 14px; }
  }
`;

export default function HeroCarousel({ siteName, waNumber }) {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 4000);

    const fetchSlides = async () => {
      try {
        const { data, error } = await supabase
          .from('hero_carousel_slides')
          .select('*, car_listings(slug)')
          .eq('active', true)
          .order('sort_order', { ascending: true });

        setSlides(!error && data ? data : []);
      } catch (e) {
        setSlides([]);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };

    fetchSlides();
    return () => clearTimeout(timeout);
  }, []);

  const touchStartX = useRef(null);

  const go   = useCallback((n) => { setIdx(n); setAnimKey(k => k + 1); }, []);
  const prev = useCallback(() => { setIdx(i => (i - 1 + slides.length) % slides.length); setAnimKey(k => k + 1); }, [slides.length]);
  const next = useCallback(() => { setIdx(i => (i + 1) % slides.length); setAnimKey(k => k + 1); }, [slides.length]);

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
    touchStartX.current = null;
  };

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [slides.length, paused, next]);

  if (loading) return (
    <div style={{ width:'100%', height:'88vh', background:'#080C14', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{HC2_CSS}</style>
      <div style={{ width:'32px', height:'32px', border:'2px solid rgba(220,38,38,0.2)', borderTop:'2px solid #dc2626', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
    </div>
  );

  if (!slides.length) return (
    <section style={{ minHeight:'70vh', background:'#080C14', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'40px 16px' }}>
      <p style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(2.5rem,8vw,5rem)', color:'white', letterSpacing:'0.04em', margin:'0 0 8px', lineHeight:1 }}>
        FIND YOUR PERFECT <span style={{ color:'#dc2626' }}>DRIVE</span>
      </p>
      <p style={{ color:'#6b7280', fontSize:'15px', maxWidth:'400px', lineHeight:1.7, margin:'0 0 28px' }}>
        Browse our verified used car collection. Transparent pricing, no hidden fees.
      </p>
      <a href="/cars" style={{ background:'#dc2626', color:'white', fontWeight:'700', fontSize:'14px', padding:'13px 28px', borderRadius:'50px', textDecoration:'none' }}>
        Browse Our Cars
      </a>
    </section>
  );

  const s      = slides[idx];
  const badge  = s.badge && s.badge !== 'None' ? s.badge : null;
  const stats  = Array.isArray(s.stats) ? s.stats.filter(x => x.value) : [];
  const priceVal = stats.find(x => (x.key || x.type)?.toLowerCase() === 'price')?.value;
  const phone  = (s.whatsapp_number || waNumber || '').replace(/\D/g, '');
  const waMsg  = encodeURIComponent(`Hi, I'm interested in the ${s.year || ''} ${s.car_name || 'car'}. Can you share more details?`);
  const waHref = phone ? `https://wa.me/${phone}?text=${waMsg}` : null;

  return (
    <section
      className="hc2-section"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <style>{HC2_CSS}</style>

      {/* Full-bleed blurred background image */}
      {s.image_url && (
        <div style={{ position:'absolute', inset:0, zIndex:0, overflow:'hidden' }}>
          <img
            src={s.image_url}
            alt=""
            style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center', filter:'blur(6px) brightness(0.55) saturate(1.1)', transform:'scale(1.04)', transition:'opacity 0.7s ease' }}
          />
          {/* Gradient overlays for readability */}
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(105deg,rgba(6,9,16,0.72) 0%,rgba(6,9,16,0.25) 55%,rgba(6,9,16,0.05) 100%)' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(6,9,16,0.82) 0%,transparent 55%)' }} />
        </div>
      )}
      {!s.image_url && <div className="hc2-glow" />}

      <div className="hc2-inner">
        <div className="hc2-grid">

          {/* ── Left: content ── */}
          <div key={`c-${animKey}`} className="hc2-slide-in">
            {/* Badge row */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={{ width:24, height:2, background:'#dc2626', flexShrink:0 }} />
              {badge && BADGE[badge] ? (
                <span style={{ background:BADGE[badge].bg, color:BADGE[badge].color, fontSize:10, fontWeight:800, padding:'3px 10px', borderRadius:20, letterSpacing:'0.07em' }}>{badge}</span>
              ) : (
                <span style={{ color:'#dc2626', fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase' }}>Featured</span>
              )}
            </div>

            {/* Car name */}
            <h1 style={{ margin:'0 0 6px', lineHeight:1, fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(2.4rem,5.5vw,4.5rem)', letterSpacing:'0.02em', color:'white' }}>
              {s.year && (
                <span style={{ background:'linear-gradient(135deg,#dc2626,#f87171)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{s.year} </span>
              )}
              {s.car_name}
            </h1>

            {/* Subtitle */}
            {(s.transmission || s.fuel_type) && (
              <p style={{ color:'#9ca3af', fontSize:13, margin:'0 0 18px' }}>
                {[s.transmission, s.fuel_type].filter(Boolean).join(' · ')}
              </p>
            )}

            {/* Price */}
            {priceVal && (
              <div style={{ marginBottom:22 }}>
                <p style={{ color:'#6b7280', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 4px' }}>Starting from</p>
                <p style={{ color:'#f87171', fontSize:'clamp(1.3rem,3vw,1.8rem)', fontWeight:800, margin:0 }}>{priceVal}</p>
              </div>
            )}

            {/* CTAs */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {waHref && (
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="hc2-enquire-btn">
                  Enquire Now →
                </a>
              )}
              {s.car_listing_id && (
                <Link to={`/cars/${s.car_listings?.slug || s.car_listing_id}`} className="hc2-details-btn">
                  View Details
                </Link>
              )}
            </div>
          </div>

          {/* ── Right: image ── */}
          <div key={`i-${animKey}`} className="hc2-image-col hc2-img-in">
            {s.image_url ? (
              <img
                src={s.image_url}
                alt={s.car_name}
                style={{ width:'100%', maxHeight:320, objectFit:'contain', borderRadius:4, filter:'drop-shadow(0 0 40px rgba(220,38,38,0.15)) drop-shadow(0 20px 40px rgba(0,0,0,0.5))' }}
              />
            ) : (
              <div style={{ width:'100%', height:280, background:'rgba(255,255,255,0.02)', borderRadius:16, border:'1px solid rgba(255,255,255,0.05)' }} />
            )}
          </div>
        </div>

        {/* ── Dots + stats strip ── */}
        <div className="hc2-stats-wrap">
          {slides.length > 1 && (
            <div className="hc2-dots">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  style={{ width:i === idx ? 22 : 6, height:6, borderRadius:3, border:'none', padding:0, cursor:'pointer', background:i === idx ? '#dc2626' : 'rgba(255,255,255,0.2)', transition:'all 0.3s' }}
                />
              ))}
            </div>
          )}

          {stats.length > 0 && (
            <div className="hc2-stats-grid">
              {stats.slice(0, 4).map((st, i) => {
                const Icon = ICON_MAP[(st.key || st.type)?.toLowerCase()];
                return (
                  <div key={i} className="hc2-stat-cell">
                    <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                      {Icon && <Icon size={11} style={{ color:'#f87171', flexShrink:0 }} />}
                      <p style={{ color:'#6b7280', fontSize:9, textTransform:'uppercase', letterSpacing:'0.1em', margin:0 }}>{st.type || st.key}</p>
                    </div>
                    <p style={{ color:'white', fontSize:15, fontWeight:700, margin:0 }}>
                      {st.value}
                      {st.unit && <span style={{ color:'#9ca3af', fontSize:11, fontWeight:500, marginLeft:3 }}>{st.unit}</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Nav arrows (desktop only) ── */}
      {slides.length > 1 && (
        <>
          <button onClick={prev} aria-label="Previous" className="hc2-nav-btn hc2-prev">
            <ChevronLeft size={16} />
          </button>
          <button onClick={next} aria-label="Next" className="hc2-nav-btn hc2-next">
            <ChevronRight size={16} />
          </button>
        </>
      )}

      <div className="hc2-fade" />
    </section>
  );
}
