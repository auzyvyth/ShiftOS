import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// The carousels use THE marketplace card (ShowroomCard, MARKET-CARD 2026-11-16), the
// same one as the grid below them: a buyer learns one card. MarketplacePage already
// imports ShowroomCard statically, so this adds nothing to the entry bundle (the old
// lazy CarCard import existed to keep CarCard out of it).
import ShowroomCard, { ShowroomCardSkeleton } from '@/components/ShowroomCard';

const CAROUSEL_GAP = 12;

const SkeletonCarouselCard = ({ width }) => (
  <div style={{ width, flexShrink: 0, display: 'flex' }}><ShowroomCardSkeleton /></div>
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
          onPointerEnter={e => { if (e.pointerType !== 'mouse') return; e.currentTarget.style.color = '#DC2626'; }}
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
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'background-color 150ms var(--xd-ease-out), border-color 150ms var(--xd-ease-out), color 150ms var(--xd-ease-out), box-shadow 150ms var(--xd-ease-out), transform 150ms var(--xd-ease-out), opacity 150ms var(--xd-ease-out)',
          }}
          onPointerEnter={e => { if (e.pointerType !== 'mouse') return; e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.borderColor = '#DC2626'; e.currentTarget.style.color = '#fff'; }}
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
              : (
                cars.map(car => (
                  <div key={car.id} style={{ width: cardW, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                    <ShowroomCard car={car} ctaContext={ctaContext} />
                  </div>
                ))
              )
            }
          </div>
        </div>

        {canRight && !isEmpty && !loading && (
          <button onClick={() => scroll(1)} aria-label={`Scroll ${title} right`} style={{
            position: 'absolute', right: -16, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, width: 32, height: 32, borderRadius: '50%',
            background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)',
            color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'background-color 150ms var(--xd-ease-out), border-color 150ms var(--xd-ease-out), color 150ms var(--xd-ease-out), box-shadow 150ms var(--xd-ease-out), transform 150ms var(--xd-ease-out), opacity 150ms var(--xd-ease-out)',
          }}
          onPointerEnter={e => { if (e.pointerType !== 'mouse') return; e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.borderColor = '#DC2626'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; e.currentTarget.style.color = '#374151'; }}
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
