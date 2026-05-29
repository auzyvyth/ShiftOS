import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gauge, Settings2, MessageCircle, Fuel, Calendar, Heart, Images } from 'lucide-react';
import GradeBadge from './GradeBadge';
import { buildWaUrl } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import { getRef } from '../utils/refTracking';
import { isSubdomain } from '../hooks/useTenant';
import { useSavedCars } from '../hooks/useSavedCars';
import { calcMonthly } from '../utils/financing';

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

const CarCard = ({ car, showDiscountBadge = true, ctaContext, priority = false }) => {
  const navigate = useNavigate();
  const [imgError, setImgError]   = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const { isSaved, toggleSave }   = useSavedCars();

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
  const isSold      = status === 'sold';

  const photoCount = Array.isArray(car.images) ? car.images.length : 0;

  const rawImage = !imgError && (
    (Array.isArray(car.images) && car.images[0]) ||
    car.image_url || car.photo_url || null
  );
  const toThumb = (url) => {
    if (!url || !url.includes('/storage/v1/object/public/')) return url;
    return url + (url.includes('?') ? '&' : '?') + 'width=520&quality=75&format=webp';
  };
  const image = toThumb(rawImage);

  const auctionGrade  = car.auction_grade || null;
  const interiorGrade = car.interior_grade || null;
  const hasGrade      = auctionGrade || interiorGrade;

  const formattedPrice   = price ? 'RM ' + price.toLocaleString('en-MY') : 'P.O.R';
  const monthly          = calcMonthly(price);
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

        @media (max-width: 520px) {
          .cc-body         { padding: 9px 10px 11px !important; }
          .cc-name         { font-size: 12px !important; }
          .cc-price-main   { font-size: 16px !important; }
          .cc-monthly-row  { display: none !important; }
          .cc-spec-val     { font-size: 10px !important; }
          .cc-wa           { width: 28px !important; height: 28px !important; }
        }
      `}</style>

      <div
        className={`cc-root${isHot ? ' hot' : ''}${xdrive ? ' xdrive' : ''}`}
        onClick={() => {
          if (isSold || !(car.slug || car.id)) return;
          trackEvent(supabase, 'card_click', {
            car_id:    car.id,
            car_name:  `${year} ${brand} ${model}`,
            dealer_id: car.dealer_id || null,
            metadata:  { source: 'car_card' },
          });
          navigate((isSubdomain() ? '/cars/' : '/showroom/') + (car.slug || car.id));
        }}
        style={{
          background:    xd.cardBg,
          border:        xd.border,
          borderRadius:  xdrive ? 16 : 12,
          overflow:      'hidden',
          cursor:        isSold ? 'default' : 'pointer',
          fontFamily:    '"DM Sans", sans-serif',
          display:       'flex',
          flexDirection: 'column',
          boxShadow:     xd.cardShadow,
        }}
      >

        {/* ── Image ── */}
        <div style={{
          position:   'relative',
          height:     170,
          flexShrink: 0,
          overflow:   'hidden',
          background: xd.imgBg,
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
                src={image}
                alt={`${year} ${brand} ${model}`}
                loading={priority ? 'eager' : 'lazy'}
                fetchPriority={priority ? 'high' : 'auto'}
                onError={() => setImgError(true)}
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
                {condBadge && (
                  <span style={badgePill(condBadge.bg, condBadge.color)}>
                    {{ used: 'USED', recon: 'RECON', new: 'NEW' }[condKey]}
                  </span>
                )}
                {isHot && (
                  <span style={badgePill('#DC2626', '#fff')}>HOT DEAL</span>
                )}
                {isNew && !isHot && (
                  <span style={badgePill('#059669', '#fff')}>NEW</span>
                )}
              </>
            )}
          </div>

          {/* Bottom-left: photo count */}
          {photoCount > 1 && (
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
              <span>{photoCount}</span>
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
        </div>

        {/* ── Body ── */}
        <div
          className="cc-body"
          style={{ padding: '11px 13px 13px', display: 'flex', flexDirection: 'column', flex: 1 }}
        >

          {/* Name */}
          <h3 className="cc-name" style={{
            color:        xd.title,
            fontSize:     13,
            fontWeight:   700,
            lineHeight:   1.3,
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            margin:       '0 0 2px',
          }}>
            {[year, brand, model, variant].filter(Boolean).join(' ')}
          </h3>

          {/* Sub: colour · location — 14px reserved */}
          <p style={{
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
          <div style={{ marginBottom: 10 }}>

            {/* Strikethrough + save — 16px reserved */}
            <div style={{ height: 16, display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
              {hasDiscount && (
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

            {/* Monthly pill — 20px reserved, hidden as full row on mobile */}
            <div className="cc-monthly-row" style={{ height: 20, display: 'flex', alignItems: 'center', marginTop: 4 }}>
              {monthly ? (
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
              ) : <span />}
            </div>

          </div>

          {/* ── 4 spec cells (2×2 grid, icon + value, no box background) ── */}
          <div style={{
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
          <div style={{ borderTop: xd.divider, marginBottom: 8 }} />

          {/* ── Footer: freshness + grade | WA ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', minHeight: 28 }}>

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
                e.stopPropagation();
                supabase.from('whatsapp_enquiries').insert({
                  dealer_id:     car.dealer_id || null,
                  listing_id:    car.id        || null,
                  buyer_name:    null,
                  buyer_phone:   null,
                  buyer_message: waText,
                  source:        'car_card',
                  status:        'new',
                  ref_slug:      getRef() || null,
                }).then(() => {});
                trackEvent(supabase, 'whatsapp_click', {
                  car_id:    car.id,
                  car_name:  `${year} ${brand} ${model}`,
                  dealer_id: car.dealer_id || null,
                  metadata:  { source: 'car_card' },
                });
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
      </div>
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
