import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Users, ArrowLeftRight, MessageCircle, Heart } from 'lucide-react';
import { toast } from 'sonner';
import GradeBadge from './GradeBadge';
import { buildWaUrl } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { cdnImg } from '../utils/img';
import { trackEvent, getOrCreateSessionId } from '../utils/analytics';
import { getRef } from '../utils/refTracking';
import ContactGate from './ContactGate';
import { useSavedCars } from '../hooks/useSavedCars';
import { calcMonthly } from '../utils/financing';

// Inject the image-loading shimmer animation once.
if (typeof document !== 'undefined') {
  const STYLE_ID = 'sc-shimmer-keyframes';
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = '@keyframes sc-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}';
    document.head.appendChild(s);
  }
}

// Fallback WhatsApp for listings with no dealer profile attached.
const XDRIVE_WA = '60174155191';

// Horizontal card used in ShowroomPage listings.
// Props:
//   car        — car_listing row (with optional dealer join)
//   ctaContext — from useCTAContext() in the parent
//   inCompare  — bool: whether this car is in the compare tray
//   compareFull — bool: compare tray at max capacity
//   onCompare  — callback to add/remove from compare
// Resized WebP via weserv. (The old ?width= params on /object/public/ URLs were
// silently ignored by Supabase, so full-res images were being served.)
const toThumb = (url) => cdnImg(url, 640, 72);

export default function ShowroomCard({ car, ctaContext, inCompare = false, compareFull = false, onCompare, priority = false, dark = false }) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [inView, setInView] = useState(false);
  const [waGateOpen, setWaGateOpen] = useState(false);
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

  // Theme — dark on the dealer subdomain (matches the storefront), light on the
  // public marketplace. Passed explicitly by the parent page so it always agrees
  // with the page context (don't re-derive isSubdomain() per card).
  const c = dark ? {
    cardBg:'#0d1117', cardBorder:'rgba(255,255,255,0.08)',
    imgBg:'#0e0e14', title:'#f3f4f6', spec:'#9ca3af',
    yearBg:'rgba(255,255,255,0.06)', yearText:'#d1d5db', yearBorder:'rgba(255,255,255,0.1)',
    usedPill:{ background:'rgba(255,255,255,0.06)', color:'#d1d5db', border:'1px solid rgba(255,255,255,0.12)' },
    cmpBg:'rgba(255,255,255,0.06)', cmpBorder:'rgba(255,255,255,0.14)', cmpText:'#d1d5db',
    saveBg:'rgba(255,255,255,0.05)', saveBorder:'rgba(255,255,255,0.12)', saveIcon:'#9ca3af',
  } : {
    cardBg:'#ffffff', cardBorder:'rgba(0,0,0,0.08)',
    imgBg:'#000000', title:'#111827', spec:'#4b5563',
    yearBg:'rgba(0,0,0,0.05)', yearText:'#374151', yearBorder:'rgba(0,0,0,0.09)',
    usedPill:{ background:'rgba(0,0,0,0.05)', color:'#374151', border:'1px solid rgba(0,0,0,0.1)' },
    cmpBg:'rgba(0,0,0,0.05)', cmpBorder:'rgba(0,0,0,0.12)', cmpText:'#374151',
    saveBg:'rgba(0,0,0,0.03)', saveBorder:'rgba(0,0,0,0.1)', saveIcon:'#9ca3af',
  };

  const brand        = car.brand || 'Unknown';
  const model        = car.model || '';
  const variant      = car.variant || '';
  const year         = car.year || '';
  const price        = car.selling_price || 0;
  const origPrice    = car.original_price || null;
  const mileage      = car.mileage || null;
  const transmission = car.transmission || null;
  const location     = car.state || null;
  const isSold       = (car.status || '') === 'sold';
  const hasDiscount  = origPrice && origPrice > 0 && price > 0 && origPrice > price;
  const discountPct  = hasDiscount ? Math.round(((origPrice - price) / origPrice) * 100) : null;
  const isHot        = hasDiscount && discountPct >= 3;
  const photoCount   = Array.isArray(car.images) ? car.images.length : 0;
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
  const waText     = `Hi, I'm interested in the ${year} ${brand} ${model}${variant ? ' ' + variant : ''}. Can you share more details?`;
  const ctxResolved = ctaContext?.type !== 'loading' ? ctaContext : null;
  const whatsappUrl = buildWaUrl(ctxResolved || { type: 'listing', profile: null, ref: null }, XDRIVE_WA, waText);
  const monthly    = calcMonthly(price);

  const specParts = [
    mileage ? Number(mileage).toLocaleString('en-MY') + ' km' : null,
    normalTx,
    car.fuel_type || null,
    location,
  ].filter(Boolean);

  const condStyle = car.condition === 'recon'
    ? { background: 'rgba(139,92,246,0.1)', color: '#7c3aed', border: '1px solid rgba(139,92,246,0.22)' }
    : car.condition === 'new'
    ? { background: 'rgba(5,150,105,0.09)', color: '#059669', border: '1px solid rgba(5,150,105,0.22)' }
    : c.usedPill;

  return (
    <div
      ref={cardRef}
      className={`sc-root${isHot ? ' hot' : ''}`}
      onClick={() => {
        if (suppressClick.current) { suppressClick.current = false; return; }
        if (isSold || !(car.slug || car.id)) return;
        trackEvent(supabase, 'card_click', { car_id: car.id, car_name: `${year} ${brand} ${model}`, dealer_id: car.dealer_id || null, metadata: { source: 'showroom_card' } });
        navigate((dark ? '/cars/' : '/showroom/') + (car.slug || car.id));
      }}
      style={{ display: 'flex', flexDirection: 'row', background: c.cardBg, border: isHot ? '1px solid rgba(220,38,38,0.3)' : `1px solid ${c.cardBorder}`, borderRadius: '12px', overflow: 'hidden', cursor: isSold ? 'default' : 'pointer', fontFamily: "'Outfit',sans-serif", minHeight: '190px', minWidth: 0 }}
    >
      {/* Image column — swipe/drag to slide through gallery */}
      <div
        className="sc-img-col"
        onTouchStart={onImgTouchStart}
        onTouchEnd={onImgTouchEnd}
        onMouseDown={onImgMouseDown}
        style={{ width: '38%', maxWidth: '210px', flexShrink: 0, position: 'relative', background: c.imgBg, overflow: 'hidden', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        {image ? (
          <>
            {(!imgLoaded || !inView) && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,#e5e7eb 25%,#d1d5db 50%,#e5e7eb 75%)', backgroundSize: '200% 100%', animation: 'sc-shimmer 1.5s infinite' }} />}
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
                style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s', filter: isSold ? 'grayscale(60%)' : 'none' }}
              />
            )}
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Car size={28} color="#9ca3af" />
          </div>
        )}

        {/* Price — solid black bar at the bottom of the image column, price
            centred within the bar (Carlist-style), not floating over the car. */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: 42, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '7px 12px', background: '#000000', pointerEvents: 'none' }}>
          {hasDiscount && <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.55)', textDecoration: 'line-through', lineHeight: 1, marginBottom: '2px' }}>RM {origPrice.toLocaleString('en-MY')}</div>}
          <div style={{ fontSize: '15px', fontWeight: '800', color: isHot ? '#fca5a5' : '#ffffff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {price ? 'RM ' + price.toLocaleString('en-MY') : 'P.O.R'}
          </div>
        </div>

        {/* Top badge row */}
        <div style={{ position: 'absolute', top: 6, left: 6, right: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
          {(() => {
            // seller_role comes from the public_car_listings view (anon-safe);
            // the car.dealer embed is RLS-blocked for logged-out visitors, which
            // made every card fall back to "Dealer".
            const role = car.seller_role || car.dealer?.role;
            const isAgent = role === 'salesman';
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: isAgent ? 'rgba(251,146,60,0.18)' : 'rgba(59,130,246,0.18)', border: `1px solid ${isAgent ? 'rgba(251,146,60,0.4)' : 'rgba(59,130,246,0.4)'}`, borderRadius: '6px', padding: '2px 7px', backdropFilter: 'blur(6px)' }}>
                <Users size={8} color={isAgent ? '#fb923c' : '#60a5fa'} />
                <span style={{ fontSize: '9px', fontWeight: '700', color: isAgent ? '#fb923c' : '#60a5fa' }}>{isAgent ? 'Agent' : 'Dealer'}</span>
              </div>
            );
          })()}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 'auto' }}>
            {photoCount > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,0.6)', borderRadius: '6px', padding: '2px 6px', backdropFilter: 'blur(4px)' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                <span style={{ fontSize: '9px', fontWeight: '700', color: 'rgba(255,255,255,0.75)' }}>{hasGallery ? `${safeIdx + 1}/${slides.length}` : photoCount}</span>
              </div>
            )}
            {isHot && discountPct && (
              <div style={{ background: '#dc2626', color: 'white', fontSize: '9px', fontWeight: '800', padding: '2px 7px', borderRadius: '20px' }}>-{discountPct}%</div>
            )}
          </div>
        </div>
      </div>

      {/* Content column */}
      <div className="sc-content-col" style={{ flex: 1, padding: '11px 14px 11px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Row 1: condition + year */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '6px' }}>
          {car.condition && (
            <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', flexShrink: 0, ...condStyle }}>
              {{ used: 'Used', recon: 'Recon', new: 'New' }[car.condition] || car.condition}
            </span>
          )}
          {year && (
            <span style={{ fontSize: '10px', fontWeight: '600', color: c.yearText, padding: '2px 7px', borderRadius: '20px', background: c.yearBg, border: `1px solid ${c.yearBorder}`, flexShrink: 0 }}>{year}</span>
          )}
          {isHot && (
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#fb923c', marginLeft: 'auto', flexShrink: 0 }}>
              Save RM {(origPrice - price).toLocaleString('en-MY')}
            </span>
          )}
        </div>

        {/* Row 2: car name */}
        <h3 style={{ color: c.title, fontSize: '14px', fontWeight: '700', margin: '0 0 4px', lineHeight: '1.25', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {[brand, model, variant].filter(Boolean).join(' ')}
        </h3>

        {/* Row 3: specs */}
        <p className="sc-spec-line" style={{ fontSize: '11px', color: c.spec, margin: '0 0 6px', lineHeight: '1.5', whiteSpace: 'normal', wordBreak: 'break-word', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {specParts.join('  •  ')}
        </p>

        {/* Row 4: compare + grade */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '6px 0 4px', flexWrap: 'wrap' }}>
          <button
            onClick={e => {
              e.stopPropagation();
              if (compareFull) { toast.error('Compare full — remove a car first (max 4)', { duration: 2500 }); return; }
              onCompare && onCompare();
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: inCompare ? '#dc2626' : c.cmpBg, border: `1px solid ${inCompare ? '#dc2626' : c.cmpBorder}`, borderRadius: '7px', padding: '4px 9px', color: inCompare ? '#fff' : c.cmpText, fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", transition: 'all 0.15s', flexShrink: 0 }}
          >
            <ArrowLeftRight size={10} />{inCompare ? 'Added' : 'Compare'}
          </button>
          {(car.auction_grade || car.interior_grade) && (
            <GradeBadge auctionGrade={car.auction_grade || null} interiorGrade={car.interior_grade || null} size="sm" />
          )}
        </div>

        {/* Row 5: monthly estimate */}
        {monthly && (
          <p style={{ fontSize: '10px', color: c.spec, margin: '0 0 6px', lineHeight: 1 }}>
            est. <span style={{ color: c.spec, fontWeight: '600' }}>RM {monthly.toLocaleString('en-MY')}/mo</span>
          </p>
        )}

        {/* Row 6: WhatsApp + save */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              setWaGateOpen(true);
            }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px 0', background: isSold ? 'rgba(0,0,0,0.03)' : '#25D366', border: isSold ? '1px solid rgba(0,0,0,0.07)' : '1px solid #1ea952', color: isSold ? '#9ca3af' : '#ffffff', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: '700', fontFamily: "'Outfit',sans-serif", transition: 'all 0.15s', pointerEvents: isSold ? 'none' : 'auto', boxSizing: 'border-box' }}
          >
            <MessageCircle size={13} /> WhatsApp
          </a>
          <ContactGate
            open={waGateOpen}
            onClose={() => setWaGateOpen(false)}
            waUrl={whatsappUrl}
            dealerId={car.dealer_id}
            carId={car.id}
            carName={`${year} ${brand} ${model}`}
            onConfirmed={() => {
              supabase.from('whatsapp_enquiries').insert({ dealer_id: car.dealer_id || null, listing_id: car.id || null, buyer_name: null, buyer_phone: null, buyer_message: waText, source: 'showroom_card', status: 'new', ref_slug: getRef() || null, session_id: getOrCreateSessionId() }).then(() => {});
              trackEvent(supabase, 'whatsapp_click', { car_id: car.id, car_name: `${year} ${brand} ${model}`, dealer_id: car.dealer_id || null, metadata: { source: 'showroom_card' } });
            }}
          />
          {!isSold && (
            <button
              onClick={e => { e.stopPropagation(); toggleSave(car.id); }}
              title={isSaved(car.id) ? 'Remove from saved' : 'Save this car'}
              style={{ width: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: isSaved(car.id) ? '1px solid rgba(220,38,38,0.35)' : `1px solid ${c.saveBorder}`, background: isSaved(car.id) ? 'rgba(220,38,38,0.08)' : c.saveBg, cursor: 'pointer', transition: 'all 0.15s', color: isSaved(car.id) ? '#dc2626' : c.saveIcon }}
            >
              <Heart size={14} fill={isSaved(car.id) ? '#dc2626' : 'none'} stroke="currentColor" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Horizontal skeleton — mirrors ShowroomCard's exact row structure.
export function ShowroomCardSkeleton({ dark = false }) {
  const g   = dark
    ? 'linear-gradient(90deg,#0f1623 25%,#182030 50%,#0f1623 75%)'
    : 'linear-gradient(90deg,#e5e7eb 25%,#d1d5db 50%,#e5e7eb 75%)';
  const gsz = '200% 100%';
  const s   = 'sc-shimmer 1.5s infinite';
  const bar = (extra) => ({ background: g, backgroundSize: gsz, animation: s, ...extra });
  return (
    <div className="sc-root" style={{ background: dark ? '#0d1117' : '#ffffff', border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', overflow: 'hidden', display: 'flex', height: '190px', pointerEvents: 'none' }}>
      {/* Image column — sc-img-col class picks up mobile media queries from ShowroomPage */}
      <div className="sc-img-col" style={{ width: '38%', maxWidth: '210px', flexShrink: 0, background: g, backgroundSize: gsz, animation: s }} />
      {/* Content column */}
      <div className="sc-content-col" style={{ flex: 1, padding: '11px 14px 11px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Row 1: condition pill + year pill */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          <div style={bar({ height: 20, width: 42, borderRadius: 20 })} />
          <div style={bar({ height: 20, width: 32, borderRadius: 20, animationDelay: '0.05s' })} />
        </div>
        {/* Row 2: name — 2 lines */}
        <div style={bar({ height: 13, width: '82%', borderRadius: 4, marginBottom: 5, animationDelay: '0.05s' })} />
        <div style={bar({ height: 13, width: '58%', borderRadius: 4, marginBottom: 6, animationDelay: '0.07s' })} />
        {/* Row 3: spec line — clamps to 2 lines on the real card, reserve the same */}
        <div style={bar({ height: 10, width: '90%', borderRadius: 4, marginBottom: 4, animationDelay: '0.1s' })} />
        <div style={bar({ height: 10, width: '60%', borderRadius: 4, marginBottom: 6, animationDelay: '0.12s' })} />
        <div style={{ flex: 1 }} />
        {/* Row 4: compare button */}
        <div style={bar({ height: 22, width: 78, borderRadius: 7, marginBottom: 5, animationDelay: '0.1s' })} />
        {/* Row 5: monthly estimate */}
        <div style={bar({ height: 10, width: '52%', borderRadius: 4, marginBottom: 6, animationDelay: '0.12s' })} />
        {/* Row 6: WA + save buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={bar({ flex: 1, height: 34, borderRadius: 8, animationDelay: '0.15s' })} />
          <div style={bar({ width: 36, height: 34, borderRadius: 8, flexShrink: 0, animationDelay: '0.15s' })} />
        </div>
      </div>
    </div>
  );
}
