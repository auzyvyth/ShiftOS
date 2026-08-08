import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gauge, Settings2, MessageCircle, Fuel, Calendar, Heart, Images, GitCompare, ShieldCheck } from 'lucide-react';
import GradeBadge from './GradeBadge';
import { buildWaUrl } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { cdnImg, cdnSrcSet } from '../utils/img';
import { trackEvent, getOrCreateSessionId } from '../utils/analytics';
import { getRef } from '../utils/refTracking';
import { isSubdomain } from '../hooks/useTenant';
import ContactGate from './ContactGate';
import { useSavedCars } from '../hooks/useSavedCars';
import { useCompare } from '../hooks/useCompare';
import { calcMonthly, HIGH_VALUE_THRESHOLD } from '../utils/financing';

const getAgeDays = (createdAt) => {
  if (!createdAt) return null;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
};

const formatAge = (days) => {
  if (days === null) return null;
  if (days === 0)    return 'Just listed';
  if (days === 1)    return 'Listed yesterday';
  if (days < 7)     return `Listed ${days}d ago`;
  if (days < 30)    return `Listed ${Math.floor(days / 7)}w ago`;
  return `Listed ${Math.floor(days / 30)}mo ago`;
};

const XDRIVE_PHONE = '60174155191';

const CarCard = ({ car, showDiscountBadge = true, ctaContext, priority = false, showCompare = false, compact = false,
  // Default assumes a full-width / 2-col grid slot. Contexts that render the
  // card narrower (e.g. the 2-up body-type carousels) MUST pass their real
  // rendered width so srcset stops fetching a ~2x-oversized image.
  sizes = '(max-width: 520px) calc(100vw - 32px), (max-width: 768px) calc(50vw - 24px), 380px' }) => {
  const navigate = useNavigate();
  const [imgError, setImgError]   = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgIdx, setImgIdx]       = useState(0);
  const [waGateOpen, setWaGateOpen] = useState(false);
  const dragX = useRef(null);
  const suppressClick = useRef(false);
  const galleryPreloaded = useRef(false);
  const { isSaved, toggleSave }   = useSavedCars();
  const { isInCompare, addToCompare, removeFromCompare, compareIds } = useCompare();
  const inCompare   = isInCompare(car.id);
  const compareFull = compareIds.length >= 4 && !inCompare;

  const xdrive = !isSubdomain();

  const brand         = car.brand || car.make || 'Unknown';
  const model         = car.model || '';
  const variant       = car.variant || '';
  const year          = car.year || '';
  const price         = car.selling_price || car.price || 0;
  const originalPrice = car.original_price || null;
  const mileage       = car.mileage || car.odometer || null;
  const transmission  = car.transmission || null;
  const location      = car.state || car.location || null;
  const status        = car.status || 'available';
  const ageDays       = getAgeDays(car.created_at);

  const hasDiscount = originalPrice && originalPrice > 0 && price > 0 && originalPrice > price;
  const discountPct = hasDiscount ? Math.round(((originalPrice - price) / originalPrice) * 100) : null;
  const isHot       = hasDiscount && discountPct >= 3;
  const isNew       = ageDays !== null && ageDays <= 7;
  const marketAvg   = car.market_avg_price || null;
  const marketBand  = (marketAvg && price > 0)
    ? price <= marketAvg * 0.93 ? 'below'
    : price >= marketAvg * 1.07 ? 'above'
    : 'fair'
    : null;
  const isSold      = status === 'sold';
  const isReserved  = status === 'reserved';

  const galleryImages = (Array.isArray(car.images) ? car.images.filter(Boolean) : []);
  const photoCount = galleryImages.length;
  // Cap the in-card slider at 8 — full set is on the detail page.
  const slides = galleryImages.slice(0, 8);
  const hasGallery = !isSold && slides.length > 1;
  const safeIdx = imgIdx < slides.length ? imgIdx : 0;

  const rawImage = !imgError && (
    slides[safeIdx] || galleryImages[0] ||
    car.image_url || car.photo_url || null
  );
  // Resized WebP via weserv (the old ?width= params on /object/public/ were
  // silently ignored by Supabase, so full-res images were being served).
  const image = cdnImg(rawImage, 640, 72);
  // Responsive candidates so mobile cards stop over-fetching the fixed 640px src.
  const imageSrcSet = cdnSrcSet(rawImage, undefined, 72);

  // Reset shimmer whenever the visible slide changes.
  useEffect(() => { setImgLoaded(false); }, [safeIdx]);

  // weserv.nl (the CDN resizer) occasionally stalls instead of erroring —
  // the <img> never fires onError, so the shimmer placeholder spins forever.
  // Fall back to the original Supabase URL if it hasn't loaded within 4s.
  const [cdnTimedOut, setCdnTimedOut] = useState(false);
  useEffect(() => {
    setCdnTimedOut(false);
    if (imgLoaded) return;
    const t = setTimeout(() => setCdnTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, [safeIdx, imgLoaded]);

  const slideBy = (dx) => {
    if (!hasGallery || Math.abs(dx) <= 36) return false;
    setImgIdx((i) => {
      const cur = i < slides.length ? i : 0;
      return (cur + (dx < 0 ? 1 : -1) + slides.length) % slides.length;
    });
    return true;
  };
  const preloadGallery = () => {
    if (!hasGallery || galleryPreloaded.current) return;
    galleryPreloaded.current = true;
    slides.forEach((src, i) => { if (i !== safeIdx) { const img = new window.Image(); img.src = cdnImg(src, 640, 72); } });
  };

  const onImgTouchStart = (e) => { preloadGallery(); dragX.current = e.touches[0].clientX; };
  const onImgTouchEnd = (e) => {
    if (dragX.current == null) return;
    if (slideBy(e.changedTouches[0].clientX - dragX.current)) suppressClick.current = true;
    dragX.current = null;
  };
  const onImgMouseDown = (e) => {
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

  const auctionGrade  = car.auction_grade || null;
  const interiorGrade = car.interior_grade || null;
  const hasGrade      = auctionGrade || interiorGrade;

  // Sambung bayar (loan takeover): a full price is meaningless — the buyer takes
  // over the loan, so the headline is the real monthly + upfront cash + months left.
  const isSambung = (car.payment_type === 'sambung_bayar') && Number(car.sambung_monthly) > 0;
  const sambungMonthly = Number(car.sambung_monthly) || 0;
  const sambungDeposit = Number(car.sambung_deposit) || 0;
  const sambungMonths  = Number(car.sambung_months_left) || 0;
  const fmtRM = (n) => 'RM ' + Number(n).toLocaleString('en-MY');

  const formattedPrice   = isSambung
    ? fmtRM(sambungMonthly) + '/mo'
    : (price ? 'RM ' + price.toLocaleString('en-MY') : 'P.O.R');
  // For sambung the "monthly pill" slot carries the deposit + months-left instead
  // of an estimated instalment (which doesn't apply to a takeover).
  const monthly          = isSambung ? null : calcMonthly(price);
  const formattedMileage = mileage ? Number(mileage).toLocaleString('en-MY') + ' km' : null;
  const normalTx =
    ['Auto', 'Automatic', 'AT'].includes(transmission) ? 'Auto' :
    ['Manual', 'MT'].includes(transmission) ? 'Manual' : transmission || null;

  const colour   = car.colour || null;
  const fuelType = car.fuel_type || null;
  const saving   = hasDiscount ? (originalPrice - price).toLocaleString('en-MY') : null;
  const subLine  = [colour, location].filter(Boolean).join(' · ') || null;
  const ageLabel = formatAge(ageDays);

  const waText = `Hi, I'm interested in the ${year} ${brand} ${model}${variant ? ' ' + variant : ''}. Can you share more details?`;
  const ctxResolved = ctaContext?.type !== 'loading' ? ctaContext : null;
  const whatsappUrl = buildWaUrl(
    ctxResolved || { type: 'listing', profile: null, ref: null },
    XDRIVE_PHONE,
    waText
  );

  /* ── Palettes ── */
  const xd = xdrive ? {
    cardBg:      '#FFFFFF',
    cardShadow:  isHot
      ? '0 0 0 1px rgba(220,38,38,0.1), 0 2px 8px rgba(220,38,38,0.08)'
      : '0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.05)',
    border:      isHot ? '1px solid rgba(220,38,38,0.25)' : '1px solid #E2E8F0',
    imgBg:       '#EBF0F6',
    title:       '#0F172A',
    sub:         '#64748B',
    priceMain:   isHot ? '#DC2626' : '#0F172A',
    strike:      '#94A3B8',
    saveBg:      '#DCFCE7',
    saveColor:   '#15803D',
    saveBorder:  '1px solid #BBF7D0',
    monthlyBg:   '#F1F5F9',
    monthlyColor:'#475569',
    monthlyBdr:  '1px solid #E2E8F0',
    specIcon:    '#94A3B8',
    specVal:     '#1E293B',
    divider:     '1px solid #F1F5F9',
    footerColor: '#94A3B8',
    freshColor:  ageDays !== null && ageDays <= 2 ? '#DC2626' : '#94A3B8',
    waBtn:       isSold
      ? { bg:'#F8FAFC',                    border:'1px solid #E2E8F0',               color:'#94A3B8' }
      : { bg:'rgba(37,211,102,0.08)',       border:'1px solid rgba(37,211,102,0.28)', color:'#15803D' },
    noImg:       '#94A3B8',
    condBadge: {
      used:  { bg: 'rgba(255,255,255,0.88)', color: '#334155' },
      recon: { bg: 'rgba(109,40,217,0.82)',  color: '#fff'    },
      new:   { bg: 'rgba(5,150,105,0.82)',   color: '#fff'    },
    },
  } : {
    cardBg:      '#0d1117',
    cardShadow:  undefined,
    border:      isHot ? '0.5px solid rgba(220,38,38,0.25)' : '0.5px solid rgba(255,255,255,0.07)',
    imgBg:       '#0e0e14',
    title:       '#f3f4f6',
    sub:         '#6b7280',
    priceMain:   isHot ? '#f87171' : '#f3f4f6',
    strike:      '#6b7280',
    saveBg:      'rgba(16,185,129,0.12)',
    saveColor:   '#34d399',
    saveBorder:  '1px solid rgba(16,185,129,0.3)',
    monthlyBg:   'rgba(255,255,255,0.06)',
    monthlyColor:'#9ca3af',
    monthlyBdr:  'none',
    specIcon:    '#4b5563',
    specVal:     '#d1d5db',
    divider:     '1px solid rgba(255,255,255,0.06)',
    footerColor: '#6b7280',
    freshColor:  ageDays !== null && ageDays <= 2 ? '#f87171' : '#6b7280',
    waBtn:       isSold
      ? { bg:'rgba(255,255,255,0.03)',      border:'0.5px solid rgba(255,255,255,0.06)', color:'#6b7280' }
      : { bg:'rgba(37,211,102,0.08)',       border:'1px solid rgba(37,211,102,0.2)',     color:'#25D366' },
    noImg:       '#2d3748',
    condBadge: {
      used:  { bg: 'rgba(0,0,0,0.55)',        color: '#d1d5db' },
      recon: { bg: 'rgba(109,40,217,0.75)',   color: '#fff'    },
      new:   { bg: 'rgba(5,150,105,0.75)',    color: '#fff'    },
    },
  };

  const condKey   = car.condition && ['used','recon','new'].includes(car.condition) ? car.condition : null;
  const condBadge = condKey ? xd.condBadge[condKey] : null;

  const specRows = [
    { Icon: Gauge,     val: formattedMileage || '—' },
    { Icon: Calendar,  val: year ? String(year) : '—' },
    { Icon: Fuel,      val: fuelType || '—' },
    { Icon: Settings2, val: normalTx || '—' },
  ];

  return (
    <>
      <style>{`
        @keyframes cc-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

        .cc-root {
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .cc-root.xdrive:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(15,23,42,0.14) !important;
          border-color: #DC2626 !important;
        }
        .cc-root.xdrive.hot:hover {
          box-shadow: 0 12px 32px rgba(220,38,38,0.2) !important;
        }
        .cc-root:not(.xdrive):hover {
          transform: translateY(-3px);
          box-shadow: 0 16px 40px rgba(0,0,0,0.55);
          border-color: rgba(255,255,255,0.15) !important;
        }
        .cc-root:not(.xdrive).hot:hover {
          box-shadow: 0 16px 40px rgba(220,38,38,0.18);
          border-color: rgba(220,38,38,0.4) !important;
        }
        .cc-wa:hover {
          background: rgba(37,211,102,0.18) !important;
          border-color: rgba(37,211,102,0.5) !important;
        }

        .cc-imgwrap { touch-action: pan-y; user-select: none; -webkit-user-select: none; }

        @media (max-width: 520px) {
          .cc-body         { padding: 9px 10px 11px !important; }
          .cc-name         { font-size: 12px !important; }
          .cc-price-main   { font-size: 16px !important; }
          .cc-monthly-row  { display: none !important; }
          .cc-spec-val     { font-size: 10px !important; }
          .cc-wa           { width: 28px !important; height: 28px !important; }
        }

        /* Compact variant (body-type carousel): equal-height cards that fill
           their stretched wrapper, so a sambung/discount card can never grow
           the row out of alignment. */
        .cc-compact { height: 100%; }

        /* On mobile the 2-up carousel cards are narrow — give the image more
           height (taller ratio) and tighten the body so the card footprint
           stays roughly the same while the photo reads much larger. */
        @media (max-width: 520px) {
          .cc-compact .cc-imgwrap     { aspect-ratio: 4 / 3 !important; }
          .cc-compact .cc-body        { padding: 7px 9px 9px !important; }
          .cc-compact .cc-name        { font-size: 11.5px !important; min-height: 28px !important; line-height: 1.2 !important; }
          .cc-compact .cc-sub         { height: 12px !important; line-height: 12px !important; font-size: 10px !important; margin-bottom: 5px !important; }
          .cc-compact .cc-price-block { margin-bottom: 6px !important; }
          .cc-compact .cc-specgrid    { row-gap: 4px !important; column-gap: 6px !important; margin-bottom: 6px !important; }
          .cc-compact .cc-divider     { margin-bottom: 6px !important; }
          .cc-compact .cc-footer      { min-height: 22px !important; }
        }
      `}</style>

      <article
        className={`cc-root${isHot ? ' hot' : ''}${xdrive ? ' xdrive' : ''}${compact ? ' cc-compact' : ''}`}
        tabIndex={isSold ? undefined : 0}
        role="article"
        aria-label={`${year} ${brand} ${model}${isSold ? ' — Sold' : ''}`}
        onClick={() => {
          if (suppressClick.current) { suppressClick.current = false; return; }
          if (isSold || !(car.slug || car.id)) return;
          trackEvent(supabase, 'card_click', {
            car_id:    car.id,
            car_name:  `${year} ${brand} ${model}`,
            dealer_id: car.dealer_id || null,
            metadata:  { source: 'car_card' },
          });
          navigate((isSubdomain() ? '/cars/' : '/showroom/') + (car.slug || car.id));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isSold || !(car.slug || car.id)) return;
            navigate((isSubdomain() ? '/cars/' : '/showroom/') + (car.slug || car.id));
          }
        }}
        style={{
          position:      'relative',
          zIndex:        0,
          background:    xd.cardBg,
          border:        xd.border,
          borderRadius:  xdrive ? 16 : 12,
          overflow:      'hidden',
          cursor:        isSold ? 'default' : 'pointer',
          fontFamily:    'system-ui, sans-serif',
          display:       'flex',
          flexDirection: 'column',
          boxShadow:     xd.cardShadow,
          height:        compact ? '100%' : undefined,
        }}
      >

        {/* ── Image ── */}
        <div
          className="cc-imgwrap"
          onTouchStart={onImgTouchStart}
          onTouchEnd={onImgTouchEnd}
          onMouseDown={onImgMouseDown}
          style={{
            position:     'relative',
            aspectRatio:  '16 / 9',
            flexShrink:   0,
            overflow:     'hidden',
            background:   xd.imgBg,
          }}>
          {image ? (
            <>
              {!imgLoaded && (
                <div style={{
                  position:       'absolute', inset: 0,
                  background:     xdrive
                    ? 'linear-gradient(90deg,#E2E8F0 25%,#EBF0F6 50%,#E2E8F0 75%)'
                    : 'linear-gradient(90deg,#0f1623 25%,#182030 50%,#0f1623 75%)',
                  backgroundSize: '200% 100%',
                  animation:      'cc-shimmer 1.5s infinite',
                }} />
              )}
              <img
                key={safeIdx}
                src={cdnTimedOut && rawImage ? rawImage : image}
                srcSet={cdnTimedOut ? undefined : imageSrcSet}
                alt={`${year} ${brand} ${model}`}
                loading={priority ? 'eager' : 'lazy'}
                fetchPriority={priority ? 'high' : 'auto'}
                sizes={sizes}
                onError={(e) => {
                  if (rawImage && !e.currentTarget.dataset.fb && e.currentTarget.src !== rawImage) {
                    e.currentTarget.dataset.fb = '1';
                    e.currentTarget.src = rawImage;
                  } else { setImgError(true); }
                }}
                onLoad={() => setImgLoaded(true)}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  opacity:    imgLoaded ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                  filter:     isSold ? 'grayscale(60%)' : 'none',
                }}
              />
              {/* Bottom gradient for badge legibility */}
              <div style={{
                position:      'absolute', bottom: 0, left: 0, right: 0, height: 52,
                background:    'linear-gradient(to top, rgba(0,0,0,0.42), transparent)',
                pointerEvents: 'none',
              }} />
              {/* Top gradient — keeps the heart/compare icons legible over any photo
                  (bright sky, white cars, phone-flash shots) and gives every card the
                  same subtle frame regardless of how the source photo was shot. */}
              <div style={{
                position:      'absolute', top: 0, left: 0, right: 0, height: 46,
                background:    'linear-gradient(to bottom, rgba(0,0,0,0.28), transparent)',
                pointerEvents: 'none',
              }} />

            </>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={xd.noImg} strokeWidth="1.2">
                <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h10l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
                <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
              </svg>
              <span style={{ fontSize: 10, color: xd.noImg }}>No photo</span>
            </div>
          )}

          {/* Top-left: condition + deal badges */}
          <div style={{
            position: 'absolute', top: 8, left: 8,
            display: 'flex', flexDirection: 'column', gap: 4,
            zIndex: 5, pointerEvents: 'none',
          }}>
            {isSold ? (
              <span style={badgePill('rgba(0,0,0,0.62)', '#e5e7eb')}>SOLD</span>
            ) : (
              <>
                {/* Compact cards (body-type carousel) stay clean: no condition
                    (RECON/USED/NEW) or "JUST ARRIVED" chips crowding the photo —
                    only the deal signal survives. */}
                {!compact && condBadge && (
                  <span style={badgePill(condBadge.bg, condBadge.color)}>
                    {{ used: 'USED', recon: 'RECON', new: 'NEW' }[condKey]}
                  </span>
                )}
                {isHot && (
                  <span style={badgePill('#DC2626', '#fff')}>HOT DEAL</span>
                )}
                {!compact && isNew && !isHot && (
                  <span style={badgePill('#C4A265', '#1a1206')}>JUST ARRIVED</span>
                )}
              </>
            )}
            {/* Verified-dealer trust chip — marketplace only (mixed dealers);
                redundant on a single-dealer storefront where every card shares it */}
            {xdrive && car.dealer_is_verified && (
              <span style={{ ...badgePill('rgba(37,99,235,0.92)', '#fff'), display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <ShieldCheck size={10} strokeWidth={2.5} /> VERIFIED
              </span>
            )}
          </div>

          {/* Bottom-left: RESERVED banner (dconcept-style) — real status, set by
              the deposit_taken lead trigger */}
          {isReserved && !isSold && (
            <>
              <div style={{
                position: 'absolute', inset: 0, zIndex: 4,
                background: 'linear-gradient(to top, rgba(185,28,28,0.32), transparent 55%)',
                pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, zIndex: 6,
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
                padding: '6px 16px 6px 11px', borderTopRightRadius: 12,
                boxShadow: '0 2px 10px rgba(0,0,0,0.35)', pointerEvents: 'none',
              }}>
                RESERVED
              </div>
            </>
          )}

          {/* Bottom-left: photo count / slide position */}
          {photoCount > 1 && !isReserved && (
            <div style={{
              position: 'absolute', bottom: 8, left: 8, zIndex: 5,
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              padding: '3px 8px', borderRadius: 20,
              color: '#fff', fontSize: 10, fontWeight: 600,
              pointerEvents: 'none',
            }}>
              <Images size={10} />
              <span>{hasGallery ? `${safeIdx + 1}/${slides.length}` : photoCount}</span>
            </div>
          )}

          {/* Top-right: heart */}
          {!isSold && (
            <button
              onClick={e => { e.stopPropagation(); toggleSave(car.id); }}
              aria-label={isSaved(car.id) ? 'Remove from saved' : 'Save this car'}
              style={{
                position:      'absolute', top: 8, right: 8, zIndex: 10,
                width:         30, height: 30, borderRadius: '50%',
                display:       'flex', alignItems: 'center', justifyContent: 'center',
                background:    isSaved(car.id) ? 'rgba(220,38,38,0.92)' : 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                border:        isSaved(car.id) ? '1.5px solid rgba(220,38,38,0.6)' : '1.5px solid rgba(255,255,255,0.22)',
                cursor:        'pointer',
                transition:    'all 0.18s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <Heart
                size={13}
                fill={isSaved(car.id) ? '#fff' : 'none'}
                stroke={isSaved(car.id) ? '#fff' : 'rgba(255,255,255,0.9)'}
                strokeWidth={2}
              />
            </button>
          )}

          {/* Compare toggle (opt-in via showCompare) */}
          {showCompare && !isSold && (
            <button
              onClick={e => { e.stopPropagation(); if (inCompare) removeFromCompare(car.id); else if (!compareFull) addToCompare(car.id); }}
              aria-label={inCompare ? 'Remove from compare' : 'Add to compare'}
              title={compareFull ? 'Compare list full (max 4)' : inCompare ? 'Remove from compare' : 'Add to compare'}
              style={{
                position: 'absolute', top: 44, right: 8, zIndex: 10,
                width: 30, height: 30, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: inCompare ? 'rgba(220,38,38,0.92)' : 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                border: inCompare ? '1.5px solid rgba(220,38,38,0.6)' : '1.5px solid rgba(255,255,255,0.22)',
                cursor: compareFull ? 'not-allowed' : 'pointer',
                opacity: compareFull ? 0.5 : 1,
                transition: 'all 0.18s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <GitCompare size={13} stroke={inCompare ? '#fff' : 'rgba(255,255,255,0.9)'} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* ── Body ── */}
        <div
          className="cc-body"
          style={{ padding: '11px 13px 13px', display: 'flex', flexDirection: 'column', flex: 1 }}
        >

          {/* Name — wraps to a 2nd line on narrow cards instead of truncating
              mid-variant; two lines are reserved so cards stay aligned. */}
          <h3 className="cc-name" style={{
            color:            xd.title,
            fontSize:         13,
            fontWeight:       700,
            lineHeight:       1.3,
            display:          '-webkit-box',
            WebkitLineClamp:  2,
            WebkitBoxOrient:  'vertical',
            overflow:         'hidden',
            minHeight:        34,
            margin:           '0 0 2px',
          }}>
            {[year, brand, model, variant].filter(Boolean).join(' ')}
          </h3>

          {/* Sub: colour · location — 14px reserved */}
          <p className="cc-sub" style={{
            margin:       '0 0 9px',
            height:       14,
            lineHeight:   '14px',
            fontSize:     11,
            color:        xd.sub,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {subLine || ' '}
          </p>

          {/* ── Price block ── */}
          <div className="cc-price-block" style={{ marginBottom: 10 }}>

            {/* Strikethrough + save — only reserves height when it has content
                (discount or sambung); collapsed otherwise so the price sits
                tight under the details and the card stays short/impactful.
                Compact cards ALWAYS reserve this row so a sambung/discount chip
                can never make one card taller than its neighbours. */}
            <div style={{ height: (compact || isSambung || hasDiscount) ? 16 : 0, display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
              {isSambung ? (
                <span style={{
                  fontSize: 9, fontWeight: 700, lineHeight: 1, flexShrink: 0, letterSpacing: '0.04em',
                  padding: '2px 6px', borderRadius: 20,
                  background: xdrive ? 'rgba(245,158,11,0.15)' : 'rgba(217,119,6,0.09)',
                  color: xdrive ? '#fbbf24' : '#b45309',
                  border: `1px solid ${xdrive ? 'rgba(245,158,11,0.3)' : 'rgba(217,119,6,0.2)'}`,
                }}>
                  SAMBUNG BAYAR
                </span>
              ) : hasDiscount && (
                <>
                  <span style={{ fontSize: 10, color: xd.strike, textDecoration: 'line-through', lineHeight: 1, flexShrink: 0 }}>
                    RM {originalPrice.toLocaleString('en-MY')}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, lineHeight: 1, flexShrink: 0,
                    padding: '2px 6px', borderRadius: 20,
                    background: xd.saveBg, color: xd.saveColor, border: xd.saveBorder,
                  }}>
                    Save RM {saving}
                  </span>
                </>
              )}
            </div>

            {/* Main price */}
            <span className="cc-price-main" style={{
              display:       'block',
              color:         xd.priceMain,
              fontSize:      20,
              fontWeight:    800,
              lineHeight:    1.15,
              letterSpacing: '-0.03em',
              marginTop:     1,
            }}>
              {formattedPrice}
            </span>

            {/* Monthly pill — 20px reserved, hidden as full row on mobile. For
                sambung bayar this carries the upfront deposit + months left. */}
            <div className="cc-monthly-row" style={{ height: 20, display: 'flex', alignItems: 'center', marginTop: 4 }}>
              {isSambung ? (
                (sambungDeposit > 0 || sambungMonths > 0) ? (
                  <span className="cc-monthly-pill" style={{
                    display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 600,
                    color: xd.monthlyColor, background: xd.monthlyBg, border: xd.monthlyBdr,
                    padding: '3px 8px', borderRadius: 20, lineHeight: 1,
                  }}>
                    {[sambungDeposit > 0 ? `${fmtRM(sambungDeposit)} deposit` : null,
                      sambungMonths > 0 ? `${sambungMonths} bln lagi` : null].filter(Boolean).join(' · ')}
                  </span>
                ) : <span />
              ) : monthly ? (
                <span className="cc-monthly-pill" style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  fontSize:     10,
                  fontWeight:   600,
                  color:        xd.monthlyColor,
                  background:   xd.monthlyBg,
                  border:       xd.monthlyBdr,
                  padding:      '3px 8px',
                  borderRadius: 20,
                  lineHeight:   1,
                }}>
                  est. RM {monthly.toLocaleString('en-MY')}/mo
                </span>
              ) : price > HIGH_VALUE_THRESHOLD ? (
                <span className="cc-monthly-pill" style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  fontSize:     10,
                  fontWeight:   600,
                  color:        xd.monthlyColor,
                  background:   xd.monthlyBg,
                  border:       xd.monthlyBdr,
                  padding:      '3px 8px',
                  borderRadius: 20,
                  lineHeight:   1,
                }}>
                  Financing available on request
                </span>
              ) : <span />}
            </div>

            {/* Market price signal pill — omitted on compact cards to keep the
                height uniform and the layout clean. */}
            {!compact && marketBand && (
              <div style={{ marginTop: 6 }}>
                <span style={{
                  display:      'inline-flex',
                  alignItems:   'center',
                  fontSize:     9,
                  fontWeight:   700,
                  lineHeight:   1,
                  padding:      '3px 7px',
                  borderRadius: 20,
                  background:   marketBand === 'below' ? (xdrive ? 'rgba(34,197,94,0.15)' : 'rgba(22,163,74,0.09)')
                              : marketBand === 'fair'  ? (xdrive ? 'rgba(59,130,246,0.15)' : 'rgba(37,99,235,0.08)')
                              :                         (xdrive ? 'rgba(245,158,11,0.15)' : 'rgba(217,119,6,0.09)'),
                  color:        marketBand === 'below' ? (xdrive ? '#4ade80' : '#15803d')
                              : marketBand === 'fair'  ? (xdrive ? '#93c5fd' : '#1d4ed8')
                              :                         (xdrive ? '#fbbf24' : '#b45309'),
                  border:       `1px solid ${
                    marketBand === 'below' ? (xdrive ? 'rgba(34,197,94,0.3)'   : 'rgba(22,163,74,0.2)')
                  : marketBand === 'fair'  ? (xdrive ? 'rgba(59,130,246,0.3)'  : 'rgba(37,99,235,0.18)')
                  :                         (xdrive ? 'rgba(245,158,11,0.3)'   : 'rgba(217,119,6,0.2)')}`,
                }}>
                  {marketBand === 'below' ? '▼ Below Market'
                 : marketBand === 'fair'  ? '● Fair Price'
                 :                          '▲ Above Market'}
                </span>
              </div>
            )}

          </div>

          {/* ── 4 spec cells (2×2 grid, icon + value, no box background) ── */}
          <div className="cc-specgrid" style={{
            display:             'grid',
            gridTemplateColumns: '1fr 1fr',
            rowGap:              6,
            columnGap:           8,
            marginBottom:        10,
          }}>
            {specRows.map(({ Icon, val }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                <Icon size={11} style={{ color: xd.specIcon, flexShrink: 0 }} />
                <span className="cc-spec-val" style={{
                  fontSize:     11,
                  fontWeight:   600,
                  color:        xd.specVal,
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                  lineHeight:   1.3,
                }}>
                  {val}
                </span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="cc-divider" style={{ borderTop: xd.divider, marginBottom: 8 }} />

          {/* ── Footer: freshness + grade | WA ── */}
          <div className="cc-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', minHeight: 28 }}>

            <div style={{ minWidth: 0, overflow: 'hidden', flex: 1 }}>
              {hasGrade ? (
                <GradeBadge auctionGrade={auctionGrade} interiorGrade={interiorGrade} size="sm" />
              ) : ageLabel ? (
                <span style={{
                  fontSize:   10,
                  fontWeight: 500,
                  color:      xd.freshColor,
                  whiteSpace: 'nowrap',
                }}>
                  {ageLabel}
                </span>
              ) : null}
            </div>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`WhatsApp enquiry for ${year} ${brand} ${model}`}
              className="cc-wa"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                setWaGateOpen(true);
              }}
              style={{
                flexShrink:    0,
                display:       'flex', alignItems: 'center', justifyContent: 'center',
                width:         32, height: 32,
                background:    xd.waBtn.bg,
                border:        xd.waBtn.border,
                color:         xd.waBtn.color,
                borderRadius:  10,
                textDecoration: 'none',
                transition:    'all 0.18s',
                pointerEvents: isSold ? 'none' : 'auto',
              }}
            >
              <MessageCircle size={14} />
            </a>

          </div>
        </div>
        <ContactGate
          open={waGateOpen}
          onClose={() => setWaGateOpen(false)}
          waUrl={whatsappUrl}
          dealerId={car.dealer_id}
          carId={car.id}
          carName={`${year} ${brand} ${model}`}
          onConfirmed={() => {
            supabase.from('whatsapp_enquiries').insert({
              dealer_id:     car.dealer_id || null,
              listing_id:    car.id        || null,
              buyer_name:    null,
              buyer_phone:   null,
              buyer_message: waText,
              source:        'car_card',
              status:        'new',
              ref_slug:      getRef() || null,
              session_id:    getOrCreateSessionId(),
            }).then(() => {});
            trackEvent(supabase, 'whatsapp_click', {
              car_id:    car.id,
              car_name:  `${year} ${brand} ${model}`,
              dealer_id: car.dealer_id || null,
              metadata:  { source: 'car_card' },
            });
          }}
        />
      </article>
    </>
  );
};

function badgePill(bg, color) {
  return {
    display:             'inline-block',
    fontSize:            9,
    fontWeight:          700,
    lineHeight:          1,
    padding:             '3px 7px',
    borderRadius:        20,
    background:          bg,
    color:               color,
    backdropFilter:      'blur(4px)',
    WebkitBackdropFilter:'blur(4px)',
    letterSpacing:       '0.04em',
  };
}

export default React.memo(CarCard);
