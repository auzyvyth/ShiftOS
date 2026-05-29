import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gauge, MessageCircle, Calendar, Heart } from 'lucide-react';
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

const XDRIVE_PHONE = '60174155191';

const CarCard = ({ car, showDiscountBadge = true, ctaContext, priority = false }) => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const { isSaved, toggleSave } = useSavedCars();

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
  const footerTx = [fuelType, normalTx].filter(Boolean).join(' · ') || null;

  const waText = `Hi, I'm interested in the ${year} ${brand} ${model}${variant ? ' ' + variant : ''}. Can you share more details?`;
  const ctxResolved = ctaContext?.type !== 'loading' ? ctaContext : null;
  const whatsappUrl = buildWaUrl(
    ctxResolved || { type: 'listing', profile: null, ref: null },
    XDRIVE_PHONE,
    waText
  );

  /* ── Palettes ── */
  const xd = xdrive ? {
    cardBg:     '#FFFFFF',
    cardShadow: '0 1px 4px rgba(15,23,42,0.07), 0 1px 2px rgba(15,23,42,0.04)',
    border:     isHot ? '1px solid rgba(220,38,38,0.28)' : '1px solid #DDE3EC',
    imgBg:      '#EBF0F6',
    title:      '#0F172A',
    sub:        '#64748B',
    priceMain:  isHot ? '#DC2626' : '#0F172A',
    strike:     '#94A3B8',
    saveBg:     '#DCFCE7',
    saveColor:  '#15803D',
    saveBorder: '1px solid #BBF7D0',
    monthly:    '#94A3B8',
    specBg:     '#F1F5F9',
    specBorder: '1px solid #E2E8F0',
    specLabel:  '#64748B',
    specValue:  '#0F172A',
    divider:    '1px solid #E2E8F0',
    footer:     '#64748B',
    waBtn:      isSold
      ? { bg: '#F1F5F9',                  border: '1px solid #E2E8F0',               color: '#94A3B8' }
      : { bg: 'rgba(37,211,102,0.08)',    border: '1px solid rgba(37,211,102,0.28)', color: '#15803D' },
    noImg:      '#94A3B8',
    /* image overlay badges */
    condBadge: {
      used:  { bg: 'rgba(255,255,255,0.88)', color: '#334155' },
      recon: { bg: 'rgba(109,40,217,0.82)',  color: '#fff'    },
      new:   { bg: 'rgba(5,150,105,0.82)',   color: '#fff'    },
    },
  } : {
    cardBg:     '#0d1117',
    cardShadow: undefined,
    border:     isHot ? '0.5px solid rgba(220,38,38,0.25)' : '0.5px solid rgba(255,255,255,0.07)',
    imgBg:      '#0e0e14',
    title:      '#f3f4f6',
    sub:        '#6b7280',
    priceMain:  isHot ? '#f87171' : '#f3f4f6',
    strike:     '#6b7280',
    saveBg:     'rgba(16,185,129,0.12)',
    saveColor:  '#34d399',
    saveBorder: '1px solid rgba(16,185,129,0.3)',
    monthly:    '#6b7280',
    specBg:     'rgba(255,255,255,0.04)',
    specBorder: 'none',
    specLabel:  '#6b7280',
    specValue:  '#f3f4f6',
    divider:    '1px solid rgba(255,255,255,0.07)',
    footer:     '#6b7280',
    waBtn:      isSold
      ? { bg: 'rgba(255,255,255,0.03)',   border: '0.5px solid rgba(255,255,255,0.06)', color: '#6b7280' }
      : { bg: 'rgba(37,211,102,0.08)',    border: '1px solid rgba(37,211,102,0.2)',     color: '#25D366' },
    noImg:      '#2d3748',
    condBadge: {
      used:  { bg: 'rgba(0,0,0,0.55)',        color: '#d1d5db' },
      recon: { bg: 'rgba(109,40,217,0.75)',   color: '#fff'    },
      new:   { bg: 'rgba(5,150,105,0.75)',    color: '#fff'    },
    },
  };

  const condKey  = car.condition && ['used','recon','new'].includes(car.condition) ? car.condition : null;
  const condBadge = condKey ? xd.condBadge[condKey] : null;

  return (
    <>
      <style>{`
        @keyframes cc-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

        .cc-root {
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .cc-root:hover {
          transform: translateY(-3px);
          box-shadow: 0 16px 40px rgba(0,0,0,0.55);
          border-color: rgba(255,255,255,0.15) !important;
        }
        .cc-root.hot:hover {
          box-shadow: 0 16px 40px rgba(220,38,38,0.18);
          border-color: rgba(220,38,38,0.4) !important;
        }
        .cc-root.xdrive:hover {
          box-shadow: 0 8px 28px rgba(15,23,42,0.13) !important;
          border-color: #DC2626 !important;
          transform: translateY(-3px);
        }
        .cc-root.xdrive.hot:hover {
          box-shadow: 0 8px 28px rgba(220,38,38,0.18) !important;
          border-color: #DC2626 !important;
        }
        .cc-wa:hover {
          background: rgba(37,211,102,0.18) !important;
          border-color: rgba(37,211,102,0.5) !important;
        }

        @media (max-width: 520px) {
          .cc-body       { padding: 8px 10px 10px !important; }
          .cc-name       { font-size: 12px !important; }
          .cc-sub        { font-size: 10px !important; }
          .cc-price-main { font-size: 15px !important; }
          .cc-monthly    { display: none !important; }
          .cc-spec-lbl   { font-size: 8px !important; }
          .cc-spec-val   { font-size: 10px !important; }
          .cc-wa         { width: 28px !important; height: 28px !important; }
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
          borderRadius:  xdrive ? 14 : 12,
          overflow:      'hidden',
          cursor:        isSold ? 'default' : 'pointer',
          fontFamily:    '"DM Sans", sans-serif',
          display:       'flex',
          flexDirection: 'column',
          boxShadow:     xd.cardShadow,
        }}
      >

        {/* ── Image ── */}
        <div
          className="cc-img"
          style={{
            position:   'relative',
            height:     160,
            flexShrink: 0,
            overflow:   'hidden',
            background: xd.imgBg,
          }}
        >
          {image ? (
            <>
              {!imgLoaded && (
                <div style={{
                  position:        'absolute', inset: 0,
                  background:      xdrive
                    ? 'linear-gradient(90deg,#E2E8F0 25%,#EBF0F6 50%,#E2E8F0 75%)'
                    : 'linear-gradient(90deg,#0f1623 25%,#182030 50%,#0f1623 75%)',
                  backgroundSize:  '200% 100%',
                  animation:       'cc-shimmer 1.5s infinite',
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
                  width:      '100%',
                  height:     '100%',
                  objectFit:  'cover',
                  opacity:    imgLoaded ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                  filter:     isSold ? 'grayscale(60%)' : 'none',
                }}
              />
              {/* Dark gradient for dark-theme cards */}
              {!xdrive && (
                <div style={{
                  position:      'absolute', bottom: 0, left: 0, right: 0, height: 48,
                  background:    'linear-gradient(to top, rgba(13,17,23,0.7), transparent)',
                  pointerEvents: 'none',
                }} />
              )}
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

          {/* ── Image overlay: condition + deal badges (top-left) ── */}
          <div style={{
            position:      'absolute', top: 7, left: 7,
            display:       'flex', flexDirection: 'column', gap: 4,
            zIndex:        5, pointerEvents: 'none',
          }}>
            {isSold ? (
              <span style={{
                fontSize: 9, fontWeight: 700, lineHeight: 1,
                padding: '3px 7px', borderRadius: 20,
                background: 'rgba(0,0,0,0.6)', color: '#e5e7eb',
                backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                letterSpacing: '0.04em',
              }}>SOLD</span>
            ) : (
              <>
                {condBadge && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, lineHeight: 1,
                    padding: '3px 7px', borderRadius: 20,
                    background: condBadge.bg, color: condBadge.color,
                    backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                    letterSpacing: '0.04em',
                  }}>
                    {{ used: 'USED', recon: 'RECON', new: 'NEW' }[condKey]}
                  </span>
                )}
                {isHot && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, lineHeight: 1,
                    padding: '3px 7px', borderRadius: 20,
                    background: '#DC2626', color: '#fff',
                    letterSpacing: '0.04em',
                  }}>HOT DEAL</span>
                )}
                {isNew && !isHot && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, lineHeight: 1,
                    padding: '3px 7px', borderRadius: 20,
                    background: '#059669', color: '#fff',
                    letterSpacing: '0.04em',
                  }}>NEW</span>
                )}
              </>
            )}
          </div>

          {/* Heart / save button — top-right */}
          {!isSold && (
            <button
              onClick={e => { e.stopPropagation(); toggleSave(car.id); }}
              aria-label={isSaved(car.id) ? 'Remove from saved' : 'Save this car'}
              style={{
                position:      'absolute', top: 7, right: 7, zIndex: 10,
                width:         30, height: 30, borderRadius: '50%',
                display:       'flex', alignItems: 'center', justifyContent: 'center',
                background:    isSaved(car.id) ? 'rgba(220,38,38,0.92)' : 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                border:        isSaved(car.id) ? '1.5px solid rgba(220,38,38,0.6)' : '1.5px solid rgba(255,255,255,0.2)',
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
          style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', flex: 1 }}
        >
          {/* Car name — 1 line, truncated */}
          <h3 className="cc-name" style={{
            color:          xd.title,
            fontSize:       13,
            fontWeight:     600,
            lineHeight:     1.3,
            whiteSpace:     'nowrap',
            overflow:       'hidden',
            textOverflow:   'ellipsis',
            margin:         '0 0 2px',
          }}>
            {[year, brand, model, variant].filter(Boolean).join(' ')}
          </h3>

          {/* Sub line — always 14px reserved */}
          <p style={{
            margin:       '0 0 8px',
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

          {/* ── Price section ── */}
          <div style={{ marginBottom: 8 }}>

            {/* Strikethrough + save badge — always 16px reserved */}
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
              fontSize:      18,
              fontWeight:    700,
              lineHeight:    1.2,
              letterSpacing: '-0.02em',
              marginTop:     1,
            }}>
              {formattedPrice}
            </span>

            {/* Monthly estimate — always 16px reserved */}
            <div className="cc-monthly" style={{ height: 16, display: 'flex', alignItems: 'center', marginTop: 1 }}>
              {monthly && (
                <span style={{ fontSize: 10, color: xd.monthly, lineHeight: 1 }}>
                  est. RM {monthly.toLocaleString('en-MY')}/mo
                </span>
              )}
            </div>

          </div>

          {/* ── 2-spec row: mileage + year ── */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 9 }}>
            {[
              { icon: Gauge,    label: 'Mileage', value: formattedMileage || '—' },
              { icon: Calendar, label: 'Year',    value: year ? String(year) : '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{
                flex:       1, minWidth: 0,
                background: xd.specBg,
                border:     xd.specBorder,
                borderRadius: 8,
                padding:    '5px 8px',
                display:    'flex', alignItems: 'center', gap: 5,
              }}>
                <Icon size={11} style={{ color: xd.specLabel, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <span className="cc-spec-lbl" style={{ display: 'block', fontSize: 9, color: xd.specLabel, lineHeight: 1.2 }}>{label}</span>
                  <span className="cc-spec-val" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: xd.specValue, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ borderTop: xd.divider, marginBottom: 8 }} />

          {/* ── Bottom row ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', minHeight: 30 }}>

            {/* Left: grade badge OR fuel · transmission text */}
            <div style={{ minWidth: 0, overflow: 'hidden', flex: 1 }}>
              {hasGrade ? (
                <GradeBadge auctionGrade={auctionGrade} interiorGrade={interiorGrade} size="sm" />
              ) : footerTx ? (
                <span style={{ fontSize: 10, color: xd.footer, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {footerTx}
                </span>
              ) : null}
            </div>

            {/* Right: WA button */}
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

export default CarCard;
