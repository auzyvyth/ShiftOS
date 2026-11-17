import { useState, useRef, useEffect } from 'react';
import { carWarmProps } from '../utils/carPrefetch';
import { useNavigate, Link } from 'react-router-dom';
import { Car, ArrowLeftRight, Heart, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';
import { cdnImg } from '../utils/img';
import ViewProgressBar from './ViewProgressBar';
import { trackEvent } from '../utils/analytics';
import { cardTitle, cardPlace } from '../utils/cardTitle';
import { useSavedCars } from '../hooks/useSavedCars';
import { calcMonthly, DEFAULT_LOAN_RATIO, DEFAULT_TENURE_YEARS, DEFAULT_EIR } from '../utils/financing';
import { isSubdomain } from '../hooks/useTenant';

// Inject the image-loading shimmer animation once. Animates `transform`
// (not `background-position`) so the compositor can run it on the GPU —
// background-position forces a full repaint of the element every frame,
// and with a dozen+ skeleton cards on screen at once (9 shimmering bars
// each) that repaint was blocking the main thread for the whole time the
// marketplace grid waited on data (Lighthouse: non-composited-animations).
if (typeof document !== 'undefined') {
  const STYLE_ID = 'sc-shimmer-keyframes';
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = '@keyframes sc-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}';
    document.head.appendChild(s);
  }
}

// Solid base layer + a gradient band swept across it via `transform`.
// Same look as the old background-position shimmer, GPU-composited instead
// of repainted every frame.
function Shimmer({ style, className, dark = false, delay }) {
  const base = dark ? '#0f1623' : '#e5e7eb';
  const sweep = dark
    ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)'
    : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)';
  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden', background: base, ...style }}>
      <div style={{ position: 'absolute', inset: 0, background: sweep, animation: `sc-shimmer 1.5s infinite${delay ? ` ${delay}` : ''}` }} />
    </div>
  );
}

// THE marketplace car card (MARKET-CARD, 2026-11-16): portrait, photo on top.
// Props:
//   car        — public_car_listings row
//   ctaContext — accepted for old callers; contact lives on the car page now
//   inCompare / compareFull / onCompare — the compare tray
// Photos are resized WebP via weserv; 480px covers a 240px card on a 2x screen.
const toThumb = (url) => cdnImg(url, 480, 72);

// eslint-disable-next-line no-unused-vars
export default function ShowroomCard({ car, ctaContext, inCompare = false, compareFull = false, onCompare, priority = false, dark = false, priceMode = 'price' }) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [inView, setInView] = useState(false);
  const cardRef = useRef(null);
  const dragX = useRef(null);
  const suppressClick = useRef(false);
  const galleryPreloaded = useRef(false);
  const { isSaved, toggleSave } = useSavedCars();

  // Load the first image when the card scrolls within 200px of the viewport.
  // priority cards (hero/first fold) skip the observer and load immediately.
  useEffect(() => {
    if (priority) { setInView(true); return; }
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [priority]);

  const brand        = car.brand || 'Unknown';
  const model        = car.model || '';
  const variant      = car.variant || '';
  const year         = car.year || '';
  const price        = car.selling_price || 0;
  // A new-car card covers every variant of a model; selling_price is the
  // cheapest (20261017c), so it reads "From RM x" (public_car_listings.is_model_card).
  const fromPrefix   = car.is_model_card ? 'From ' : '';
  const origPrice    = car.original_price || null;
  const mileage      = car.mileage || null;
  const transmission = car.transmission || null;
  const isSold       = (car.status || '') === 'sold';
  const hasDiscount  = origPrice && origPrice > 0 && price > 0 && origPrice > price;
  const discountPct  = hasDiscount ? Math.round(((origPrice - price) / origPrice) * 100) : null;
  const isHot        = hasDiscount && discountPct >= 3;
  const photoCount   = Array.isArray(car.images) ? car.images.length : 0;
  // Seller trust signals. Both come from public_car_listings (anon-safe) — the
  // profiles embed is RLS-blocked for logged-out buyers, so it cannot be used
  // here. dealer_is_verified is false for everyone until KYC approvals start
  // flowing, so the tick simply does not render yet.
  const isVerified   = car.dealer_is_verified === true;
  // Below 3 a sold count reads as "new seller", which is worse than saying
  // nothing — so it stays hidden rather than advertising a weak number.
  const soldCount    = Number(car.seller_sold_count) || 0;
  const showSold     = soldCount >= 3;
  const slides     = Array.isArray(car.images) ? car.images.filter(Boolean).slice(0, 8) : [];
  const hasGallery = !isSold && slides.length > 1;
  const safeIdx    = imgIdx < slides.length ? imgIdx : 0;

  useEffect(() => { setImgLoaded(false); }, [safeIdx]);

  // weserv.nl (the CDN resizer) occasionally stalls instead of erroring —
  // the <img> never fires onError, so the shimmer placeholder spins forever.
  // Fall back to the original Supabase URL if it hasn't loaded within 4s.
  const [cdnTimedOut, setCdnTimedOut] = useState(false);
  useEffect(() => {
    setCdnTimedOut(false);
    if (!inView || imgLoaded) return;
    const t = setTimeout(() => setCdnTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, [inView, safeIdx, imgLoaded]);

  const slideBy = (dx) => {
    if (!hasGallery || Math.abs(dx) <= 36) return false;
    setImgIdx(i => {
      const cur = i < slides.length ? i : 0;
      return (cur + (dx < 0 ? 1 : -1) + slides.length) % slides.length;
    });
    return true;
  };
  // Preload all gallery images for this card the moment the user first touches it.
  // Uses Image() so no DOM elements are added — browser caches them for instant slide.
  const preloadGallery = () => {
    if (!hasGallery || galleryPreloaded.current) return;
    galleryPreloaded.current = true;
    slides.forEach((src, i) => { if (i !== safeIdx) { const img = new window.Image(); img.src = toThumb(src); } });
  };

  const onImgTouchStart = (e) => { preloadGallery(); dragX.current = e.touches[0].clientX; };
  const onImgTouchEnd   = (e) => {
    if (dragX.current == null) return;
    if (slideBy(e.changedTouches[0].clientX - dragX.current)) suppressClick.current = true;
    dragX.current = null;
  };
  const onImgMouseDown  = (e) => {
    e.preventDefault();
    preloadGallery();
    dragX.current = e.clientX;
    const onDocUp = (ev) => {
      document.removeEventListener('mouseup', onDocUp);
      if (dragX.current == null) return;
      if (slideBy(ev.clientX - dragX.current)) suppressClick.current = true;
      dragX.current = null;
    };
    document.addEventListener('mouseup', onDocUp);
  };

  const rawImage   = slides[safeIdx] || (Array.isArray(car.images) && car.images[0]) || null;
  const image      = !imgError && toThumb(rawImage);
  const normalTx   = ['Auto', 'Automatic', 'AT'].includes(transmission) ? 'Auto' : ['Manual', 'MT'].includes(transmission) ? 'Manual' : transmission || null;
  // The card's name is built from the structured fields (src/utils/cardTitle.js):
  // "2023 Toyota Vellfire" over "Executive Lounge". The seller's free-text headline
  // stays on the car page; on a grid it made every card a different shape and case.
  const { name: cardName, variant: cardVariant } = cardTitle(car);
  const place      = cardPlace(car);
  const monthly    = calcMonthly(price);
  // 'monthly' = the browse grid's Monthly switch (src/utils/priceMode.js): the
  // instalment becomes the big number and the price moves to the small line.
  const showMonthly = priceMode === 'monthly' && !!monthly;

  const specParts = [
    mileage ? Number(mileage).toLocaleString('en-MY') + ' km' : null,
    normalTx,
    car.fuel_type || null,
  ].filter(Boolean);

  // seller_role/seller_type come from the public_car_listings view (anon-safe);
  // the car.dealer embed is RLS-blocked for logged-out visitors. role='salesman'
  // = a STANDALONE seller: "Private seller" (their own car) or "Agent".
  const role = car.seller_role || car.dealer?.role;
  const sellerType = car.seller_type || car.dealer?.seller_type;
  const sellerLabel = role !== 'salesman' ? 'Dealer' : sellerType === 'private' ? 'Private seller' : 'Agent';
  const condLabel = { used: 'Used', recon: 'Recon', new: 'New' }[car.condition] || '';
  const grade = car.auction_grade ? `Grade ${car.auction_grade}${car.interior_grade ? ' / ' + car.interior_grade : ''}` : null;

  // The card is a clickable div for mouse users; the name is a real <Link>, the
  // keyboard / screen-reader / crawler path into the car. Both run this function.
  // Route by HOST, not theme: a dealer storefront card goes to /cars/.
  const carHref = (isSubdomain() ? '/cars/' : '/showroom/') + (car.slug || car.id);
  const trackCardClick = () => {
    trackEvent(supabase, 'card_click', { car_id: car.id, car_name: `${year} ${brand} ${model}`, dealer_id: car.dealer_id || null, metadata: { source: 'showroom_card' } });
  };
  const saved = isSaved(car.id);
  const priceText = price ? fromPrefix + 'RM ' + price.toLocaleString('en-MY') : 'Price on request';

  return (
    <div
      ref={cardRef}
      className={`sc-root${dark ? ' sc-dark' : ''}${isSold ? ' sc-sold' : ''}`}
      {...(!isSold ? carWarmProps(car) : {})}
      onClick={() => {
        if (suppressClick.current) { suppressClick.current = false; return; }
        if (isSold || !(car.slug || car.id)) return;
        trackCardClick();
        navigate(carHref);
      }}
    >
      {/* Photo: swipe / drag through up to 8 photos */}
      <div className="sc-photo" onTouchStart={onImgTouchStart} onTouchEnd={onImgTouchEnd} onMouseDown={onImgMouseDown}>
        {image ? (
          <>
            {(!imgLoaded || !inView) && <Shimmer dark={dark} style={{ position: 'absolute', inset: 0 }} />}
            {inView && (
              <img
                key={safeIdx}
                src={cdnTimedOut && rawImage ? rawImage : image}
                alt={`${year} ${brand} ${model}`}
                loading="eager"
                decoding="async"
                onError={(e) => {
                  if (rawImage && !e.currentTarget.dataset.fb && e.currentTarget.src !== rawImage) {
                    e.currentTarget.dataset.fb = '1';
                    e.currentTarget.src = rawImage;
                  } else { setImgError(true); }
                }}
                onLoad={() => setImgLoaded(true)}
                style={{ opacity: imgLoaded ? 1 : 0, filter: isSold ? 'grayscale(60%)' : 'none' }}
              />
            )}
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Car size={28} color="#9ca3af" />
          </div>
        )}
        <ViewProgressBar carId={car.id} />

        {isSold ? <span className="sc-tag tl">Sold</span>
          : isHot && discountPct ? <span className="sc-tag tl crimson">-{discountPct}%</span>
          : grade ? <span className="sc-tag tl">{grade}</span> : null}
        {photoCount > 1 && (
          <span className="sc-tag bl">{hasGallery ? `${safeIdx + 1} / ${slides.length}` : `${photoCount} photos`}</span>
        )}
        {!isSold && (
          <div className="sc-tools">
            {onCompare && (
              <button
                type="button"
                className={`sc-tool sc-hide-narrow${inCompare ? ' on' : ''}`}
                title={inCompare ? 'Remove from compare' : 'Compare'}
                aria-label={`${inCompare ? 'Remove from compare' : 'Compare'} ${cardName}`}
                aria-pressed={inCompare}
                onClick={e => {
                  e.stopPropagation();
                  if (compareFull) { toast.error('Compare full — remove a car first (max 4)', { duration: 2500 }); return; }
                  onCompare();
                }}
              >
                <ArrowLeftRight size={15} />
              </button>
            )}
            <button
              type="button"
              className={`sc-tool${saved ? ' on' : ''}`}
              title={saved ? 'Remove from saved' : 'Save this car'}
              aria-label={`${saved ? 'Remove from saved' : 'Save'} ${cardName}`}
              aria-pressed={saved}
              onClick={e => { e.stopPropagation(); toggleSave(car.id); }}
            >
              <Heart size={15} fill={saved ? '#fff' : 'none'} stroke="currentColor" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      <div className="sc-body">
        <h3 className="sc-name">
          {isSold || !(car.slug || car.id) ? cardName : (
            <Link
              to={carHref}
              onClick={e => { e.stopPropagation(); trackCardClick(); }}
              aria-label={`${[year, brand, model, variant].filter(Boolean).join(' ')}, ${price ? fromPrefix + 'RM ' + price.toLocaleString('en-MY') : 'price on request'}`}
            >
              {cardName}
            </Link>
          )}
        </h3>
        <div className="sc-variant">{cardVariant || ' '}</div>

        {showMonthly ? (
          <>
            <div className="sc-price xd-crimson-text">RM {monthly.toLocaleString('en-MY')}/mo</div>
            <div className="sc-sub">{fromPrefix}RM {price.toLocaleString('en-MY')} · {Math.round((1 - DEFAULT_LOAN_RATIO) * 100)}% down, {DEFAULT_TENURE_YEARS} yrs, {DEFAULT_EIR}%</div>
          </>
        ) : (
          <>
            <div className="sc-price xd-crimson-text">
              {priceText}
            </div>
            <div className="sc-sub">
              {hasDiscount && <span style={{ textDecoration: 'line-through', marginRight: 6 }}>RM {origPrice.toLocaleString('en-MY')}</span>}
              {monthly ? `${car.is_model_card ? 'from' : 'est.'} RM ${monthly.toLocaleString('en-MY')}/mo` : ' '}
            </div>
          </>
        )}

        <div className="sc-specs">
          <div className="sc-specs-in">{specParts.join(' · ') || ' '}</div>
        </div>
        <div className="sc-seller" title={isVerified ? `Verified ${sellerLabel.toLowerCase()}` : undefined}>
          {isVerified && <BadgeCheck size={13} style={{ flexShrink: 0, color: 'var(--xd-crimson-mid)' }} aria-label="Verified" role="img" />}
          <span>
            <span className="sc-hide-narrow">{condLabel ? condLabel + ' · ' : ''}</span>
            {sellerLabel}{place ? `, ${place}` : ''}{showSold ? ` · ${soldCount} sold` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// Skeleton: the same portrait shape as the card, so nothing jumps when it loads.
export function ShowroomCardSkeleton({ dark = false }) {
  const bar = (style, delay) => <Shimmer dark={dark} delay={delay} style={{ borderRadius: 4, ...style }} />;
  return (
    <div className={`sc-root${dark ? ' sc-dark' : ''}`} style={{ pointerEvents: 'none' }}>
      <Shimmer dark={dark} style={{ aspectRatio: '4 / 3' }} />
      <div className="sc-body">
        {bar({ height: 14, width: '78%', marginBottom: 6 })}
        {bar({ height: 11, width: '48%', marginBottom: 12 }, '0.05s')}
        {bar({ height: 18, width: '58%', marginBottom: 6 }, '0.08s')}
        {bar({ height: 11, width: '42%', marginBottom: 16 }, '0.1s')}
        {bar({ height: 11, width: '86%', marginBottom: 6 }, '0.12s')}
        {bar({ height: 11, width: '60%' }, '0.14s')}
      </div>
    </div>
  );
}
