import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import CarCard from '@/components/CarCard';

const CAROUSEL_GAP = 12;

const SkeletonCarouselCard = ({ width }) => (
  <div style={{
    width, flexShrink: 0,
    background: '#ffffff', border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: 14, overflow: 'hidden',
  }}>
    <div style={{ height: 160, background: 'linear-gradient(90deg,#e8e6e0 25%,#f0eeea 50%,#e8e6e0 75%)', backgroundSize: '200% 100%', animation: 'mp-shimmer 1.5s infinite' }} />
    <div style={{ padding: 12 }}>
      {[80, 55, 100, 70].map((w, i) => (
        <div key={i} style={{ height: 9, width: `${w}%`, background: '#e8e6e0', borderRadius: 4, marginBottom: 8, animation: 'mp-shimmer 1.5s infinite' }} />
      ))}
    </div>
  </div>
);

export default function BodyTypeCarousel({ title, eyebrow, cars, loading, bodyType, ctaContext }) {
  const scrollRef = useRef(null);
  const clipRef   = useRef(null);
  const [canLeft,  setCanLeft]  = useState(false);
  const [canRight, setCanRight] = useState(true);
  const [cardW, setCardW] = useState(280);

  useEffect(() => {
    const el = clipRef.current;
    if (!el) return;
    const calc = () => setCardW(Math.floor((el.offsetWidth - CAROUSEL_GAP) / 2));
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (cardW + CAROUSEL_GAP) * 2, behavior: 'smooth' });
  };

  const isEmpty = !loading && cars.length === 0;

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14, paddingRight: 4 }}>
        <div>
          <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#DC2626', fontFamily: "'Outfit',sans-serif" }}>{eyebrow}</p>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '0.03em' }}>{title}</h3>
        </div>
        <Link
          to={`/showroom?body_type=${bodyType}`}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151', textDecoration: 'none', fontFamily: "'Outfit',sans-serif", flexShrink: 0, transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
          onMouseLeave={e => e.currentTarget.style.color = '#374151'}
        >
          View All <ArrowRight size={11} />
        </Link>
      </div>

      <div style={{ position: 'relative' }}>
        {canLeft && (
          <button onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`} style={{
            position: 'absolute', left: -16, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, width: 32, height: 32, borderRadius: '50%',
            background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)',
            color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.borderColor = '#DC2626'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; e.currentTarget.style.color = '#374151'; }}
          >
            <ChevronLeft size={16} />
          </button>
        )}

        <div ref={clipRef} style={{ overflow: 'hidden' }}>
          <div
            ref={scrollRef}
            onScroll={updateArrows}
            className="btc-scroll"
            style={{ display: 'flex', gap: CAROUSEL_GAP, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', paddingBottom: 6, paddingTop: 2 }}
          >
            {loading
              ? [...Array(4)].map((_, i) => <SkeletonCarouselCard key={i} width={cardW} />)
              : isEmpty
              ? <div style={{ width: '100%', padding: '32px 0', color: '#9ca3af', fontSize: 13, fontFamily: "'Outfit',sans-serif", textAlign: 'center' }}>No {title.toLowerCase()} listed yet</div>
              : cars.map(car => (
                <div key={car.id} style={{ width: cardW, flexShrink: 0 }}>
                  <CarCard car={car} ctaContext={ctaContext} />
                </div>
              ))
            }
          </div>
        </div>

        {canRight && !isEmpty && !loading && (
          <button onClick={() => scroll(1)} aria-label={`Scroll ${title} right`} style={{
            position: 'absolute', right: -16, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, width: 32, height: 32, borderRadius: '50%',
            background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)',
            color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.borderColor = '#DC2626'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; e.currentTarget.style.color = '#374151'; }}
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
