import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// Lazy: these carousels sit below the fold, but a static import put CarCard
// (~10 KB gzipped, plus ContactGate and GradeBadge) into the marketplace ENTRY
// bundle — the exact weight MPERF-1 removed when it stopped routing "/" through
// HomePage. It came back through this import. The Suspense fallback below is the
// same skeleton the `loading` state already renders, so there is no visual
// change and no layout shift.
const CarCard = lazy(() => import('@/components/CarCard'));

const CAROUSEL_GAP = 12;

// Mirrors the compact CarCard's real DOM metrics 1:1 (image aspect-ratio,
// cc-name/cc-sub/cc-specgrid/cc-footer dimensions, incl. the <520px overrides)
// so swapping the skeleton for the loaded card causes no layout shift. Some of
// those mobile overrides live in CarCard's GLOBAL media query, not scoped to
// .cc-compact, so they hit compact cards too even though nothing here says
// "compact" — .cc-monthly-row goes display:none, .cc-price-main drops to 16px,
// .cc-wa shrinks to 28x28. Re-check against CarCard.jsx if either file changes.
const SkeletonCarouselCard = ({ width }) => {
  const b = '#e8e6e0';
  const s = 'mp-shimmer 1.5s infinite';
  return (
    <div className="btc-skel" style={{ width, flexShrink: 0, background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Image — aspect-ratio 16:9 matches cc-imgwrap (4:3 on mobile compact, see .btc-skel-img below) */}
      <div className="btc-skel-img" style={{ aspectRatio: '16 / 9', flexShrink: 0, background: `linear-gradient(90deg,${b} 25%,#f0eeea 50%,${b} 75%)`, backgroundSize: '200% 100%', animation: s }} />
      {/* Body — matches cc-body padding: 11px 13px 13px (7px 9px 9px on mobile compact) */}
      <div className="btc-skel-body" style={{ padding: '11px 13px 13px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Name — matches cc-name minHeight:34 (28 on mobile compact), marginBottom:2 */}
        <div className="btc-skel-name" style={{ minHeight: 34, display: 'flex', alignItems: 'center', marginBottom: 2 }}>
          <div style={{ height: 13, width: '80%', background: b, borderRadius: 4, animation: s }} />
        </div>
        {/* Sub line — matches cc-sub height:14, marginBottom:9 (12/5 on mobile compact) */}
        <div className="btc-skel-sub" style={{ height: 14, marginBottom: 9, display: 'flex', alignItems: 'center' }}>
          <div style={{ height: 10, width: '52%', background: b, borderRadius: 4, animation: s, animationDelay: '0.05s' }} />
        </div>
        {/* Price block — matches cc-price-block marginBottom:10 (6 on mobile compact) */}
        <div className="btc-skel-priceblock" style={{ marginBottom: 10 }}>
          {/* Strikethrough row — always 16px reserved on compact cards, empty here */}
          <div style={{ height: 16 }} />
          {/* Main price — matches cc-price-main (fontSize 20, lineHeight 1.15) + marginTop:1; fontSize drops to 16 under 520px for EVERY card (CarCard.jsx's mobile media query isn't scoped to non-compact) */}
          <div className="btc-skel-price-main" style={{ height: 23, width: '68%', background: b, borderRadius: 5, marginTop: 1, animation: s, animationDelay: '0.07s' }} />
          {/* Monthly pill — matches cc-monthly-row height:20, marginTop:4; that same global mobile query sets .cc-monthly-row{display:none}, so it fully disappears under 520px on every card, compact included */}
          <div className="btc-skel-monthly" style={{ height: 20, marginTop: 4, display: 'flex', alignItems: 'center' }}>
            <div style={{ height: 20, width: '58%', background: b, borderRadius: 20, animation: s, animationDelay: '0.1s' }} />
          </div>
        </div>
        {/* 2×2 spec grid — matches cc-specgrid rowGap:6 columnGap:8 marginBottom:10 (4/6/6 on mobile compact) */}
        <div className="btc-skel-specgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 6, columnGap: 8, marginBottom: 10 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ height: 13, background: b, borderRadius: 4, animation: s, animationDelay: `${0.1 + i * 0.04}s` }} />
          ))}
        </div>
        {/* Divider — matches cc-divider marginBottom:8 (6 on mobile compact) */}
        <div className="btc-skel-divider" style={{ height: 1, background: '#F1F5F9', marginBottom: 8 }} />
        {/* Footer row — matches cc-footer minHeight:28 (22 on mobile compact); WA button is 32×32 desktop, 28×28 under 520px on every card (same unscoped global rule) */}
        <div className="btc-skel-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 28, marginTop: 'auto' }}>
          <div style={{ height: 10, width: '48%', background: b, borderRadius: 4, animation: s, animationDelay: '0.18s' }} />
          <div className="btc-skel-wa" style={{ height: 32, width: 32, background: b, borderRadius: 10, animation: s, animationDelay: '0.18s' }} />
        </div>
      </div>
      <style>{`
        @media (max-width: 520px) {
          .btc-skel-img         { aspect-ratio: 4 / 3 !important; }
          .btc-skel-body        { padding: 7px 9px 9px !important; }
          .btc-skel-name        { min-height: 28px !important; }
          .btc-skel-sub         { height: 12px !important; margin-bottom: 5px !important; }
          .btc-skel-priceblock  { margin-bottom: 6px !important; }
          .btc-skel-price-main  { height: 18px !important; }
          .btc-skel-monthly     { display: none !important; }
          .btc-skel-specgrid    { row-gap: 4px !important; column-gap: 6px !important; margin-bottom: 6px !important; }
          .btc-skel-divider     { margin-bottom: 6px !important; }
          .btc-skel-footer      { min-height: 22px !important; }
          .btc-skel-wa          { width: 28px !important; height: 28px !important; }
        }
      `}</style>
    </div>
  );
};

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
              : (
                <Suspense fallback={[...Array(4)].map((_, i) => <SkeletonCarouselCard key={i} width={cardW} />)}>
                  {cars.map(car => (
                    <div key={car.id} style={{ width: cardW, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                      <CarCard car={car} ctaContext={ctaContext} compact sizes={cardW ? `${cardW}px` : undefined} />
                    </div>
                  ))}
                </Suspense>
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
