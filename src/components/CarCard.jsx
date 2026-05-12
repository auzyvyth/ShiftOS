import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gauge, Settings2, MessageCircle, Fuel, Calendar, Heart } from 'lucide-react';
import GradeBadge from './GradeBadge';
import { buildWaUrl } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import { getRef } from '../utils/refTracking';
import { isSubdomain } from '../hooks/useTenant';
import { useSavedCars } from '../hooks/useSavedCars';

const calcMonthly = (price) => {
  if (!price || price <= 0) return null;
  return Math.round((price * 0.9 * (1 + 3.5 / 100 * 7)) / (7 * 12));
};

const getAgeDays = (createdAt) => {
  if (!createdAt) return null;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
};

const XDRIVE_PHONE = '60174155191';

const CarCard = ({ car, showDiscountBadge = true, ctaContext }) => {
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
  const status        = car.status || 'active';
  const ageDays       = getAgeDays(car.created_at);

  const hasDiscount = originalPrice && originalPrice > 0 && price > 0 && originalPrice > price;
  const discountPct = hasDiscount ? Math.round(((originalPrice - price) / originalPrice) * 100) : null;
  const isHot       = hasDiscount && discountPct >= 3;
  const isNew       = ageDays !== null && ageDays <= 7;
  const isSold      = status === 'sold';
  const isReserved  = status === 'reserved';
  const isRecon     = car.is_recon || car.condition === 'recon' || false;

  const image = !imgError && (
    (Array.isArray(car.images) && car.images[0]) ||
    car.image_url || car.photo_url || null
  );

  const auctionGrade  = car.auction_grade || null;
  const interiorGrade = car.interior_grade || null;
  const hasGrade      = auctionGrade || interiorGrade;

  const formattedPrice   = price ? 'RM ' + price.toLocaleString('en-MY') : 'P.O.R';
  const monthly          = calcMonthly(price);
  const formattedMileage = mileage ? Number(mileage).toLocaleString('en-MY') + ' km' : null;
  const normalTx =
    ['Auto', 'Automatic', 'AT'].includes(transmission) ? 'Auto' :
    ['Manual', 'MT'].includes(transmission) ? 'Manual' : transmission || null;

  const colour    = car.colour || null;
  const engineCc  = car.engine_cc ? Number(car.engine_cc).toLocaleString('en-MY') + ' cc' : null;
  const fuelType  = car.fuel_type || null;

  const waText = `Hi, I'm interested in the ${year} ${brand} ${model}${variant ? ' ' + variant : ''}. Can you share more details?`;
  const ctxResolved = ctaContext?.type !== 'loading' ? ctaContext : null;
  const whatsappUrl = buildWaUrl(
    ctxResolved || { type: 'listing', profile: null, ref: null },
    XDRIVE_PHONE,
    waText
  );

  const specCells = [
    { icon: Gauge,    label: 'Mileage', value: formattedMileage || '—' },
    { icon: Calendar, label: 'Year',    value: year ? String(year) : '—' },
    { icon: Fuel,     label: 'Fuel',    value: fuelType || '—' },
    { icon: Settings2, label: 'Gearbox', value: normalTx || '—' },
  ];

  /* ── xdrive.my silver palette ── */
  const xd = xdrive ? {
    cardBg:      '#FFFFFF',
    cardShadow:  '0 1px 4px rgba(15,23,42,0.07), 0 1px 2px rgba(15,23,42,0.04)',
    border:      isHot ? '1px solid rgba(220,38,38,0.3)' : '1px solid #DDE3EC',
    imgBg:       '#EBF0F6',
    title:       '#0F172A',
    sub:         '#64748B',
    priceMain:   isHot ? '#DC2626' : '#0F172A',
    priceStrike: '#94A3B8',
    priceSave:   '#059669',
    monthly:     '#64748B',
    cellBg:      '#F1F5F9',
    cellBorder:  '#E2E8F0',
    cellLabel:   '#94A3B8',
    cellValue:   '#1E293B',
    divider:     '#E2E8F0',
    waBtn:       isSold ? { bg:'#F1F5F9', border:'1px solid #E2E8F0', color:'#94A3B8' }
                        : { bg:'rgba(37,211,102,0.08)', border:'1px solid rgba(37,211,102,0.3)', color:'#15803D' },
    noImgIcon:   '#94A3B8',
    noImgText:   '#94A3B8',
    conditionPill: {
      recon: { bg:'#EDE9FE', color:'#6D28D9', border:'1px solid #DDD6FE' },
      new:   { bg:'#DCFCE7', color:'#15803D', border:'1px solid #BBF7D0' },
      used:  { bg:'#F1F5F9', color:'#475569', border:'1px solid #CBD5E1' },
    },
  } : null;

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
          .cc-img         { height: auto !important; aspect-ratio: 16/9 !important; }
          .cc-body        { padding: 8px 10px 10px !important; }
          .cc-name        { font-size: 12px !important; margin-bottom: 1px !important; }
          .cc-sub         { height: auto !important; margin-bottom: 4px !important; font-size: 10px !important; }
          .cc-sub-loc     { display: none !important; }
          .cc-sub-dot     { display: none !important; }
          .cc-price-main  { font-size: 15px !important; }
          .cc-monthly     { display: none !important; }
          .cc-pricebox    { height: auto !important; margin-bottom: 6px !important; }
          .cc-pricebox > div:first-child { height: auto !important; min-height: 0 !important; }
          .cc-pricebox > div:last-child  { display: none !important; }
          .cc-grid        { gap: 3px !important; margin-bottom: 6px !important; }
          .cc-cell        { padding: 4px 6px !important; gap: 4px !important; }
          .cc-cell-lbl    { font-size: 8px !important; }
          .cc-cell-val    { font-size: 10px !important; }
          .cc-divider     { margin-bottom: 6px !important; }
          .cc-wa          { width: 30px !important; height: 30px !important; }
        }
      `}</style>

      <div
        className={`cc-root${isHot ? ' hot' : ''}${xdrive ? ' xdrive' : ''}`}
        onClick={() => {
          if (isSold || !(car.slug || car.id)) return;
          trackEvent(supabase, 'card_click', {
            car_id: car.id,
            car_name: `${year} ${brand} ${model}`,
            dealer_id: car.dealer_id || null,
            metadata: { source: 'car_card' },
          });
          navigate((isSubdomain() ? '/cars/' : '/showroom/') + (car.slug || car.id));
        }}
        style={{
          background: xdrive ? xd.cardBg : 'var(--color-background-primary, #0d1117)',
          border: xdrive ? xd.border : isHot
            ? '0.5px solid rgba(220,38,38,0.25)'
            : '0.5px solid var(--color-border-tertiary, rgba(255,255,255,0.07))',
          borderRadius: xdrive ? '14px' : 'var(--border-radius-lg, 12px)',
          overflow: 'hidden',
          cursor: isSold ? 'default' : 'pointer',
          fontFamily: 'var(--font-sans, "Outfit", sans-serif)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: xdrive ? xd.cardShadow : undefined,
        }}
      >
        {/* ── Image ── */}
        <div
          className="cc-img"
          style={{
            position: 'relative',
            height: 185,
            flexShrink: 0,
            overflow: 'hidden',
            background: xdrive ? xd.imgBg : '#0e0e14',
          }}
        >
          {image ? (
            <>
              {!imgLoaded && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: xdrive
                    ? 'linear-gradient(90deg,#E2E8F0 25%,#EBF0F6 50%,#E2E8F0 75%)'
                    : 'linear-gradient(90deg,#0f1623 25%,#182030 50%,#0f1623 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'cc-shimmer 1.5s infinite',
                }} />
              )}
              <img
                src={image}
                alt={`${year} ${brand} ${model}`}
                onError={() => setImgError(true)}
                onLoad={() => setImgLoaded(true)}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  opacity: imgLoaded ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                  filter: isSold ? 'grayscale(60%)' : 'none',
                }}
              />
              {!xdrive && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 48,
                  background: 'linear-gradient(to top, rgba(13,17,23,0.7), transparent)',
                  pointerEvents: 'none',
                }} />
              )}
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={xdrive ? xd.noImgIcon : '#2d3748'} strokeWidth="1.2">
                <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h10l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
                <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
              </svg>
              <span style={{ fontSize: 10, color: xdrive ? xd.noImgText : '#374151' }}>No photo</span>
            </div>
          )}
          {/* Heart / save button */}
          {!isSold && (
            <button
              onClick={e => { e.stopPropagation(); toggleSave(car.id); }}
              title={isSaved(car.id) ? 'Remove from saved' : 'Save this car'}
              style={{
                position: 'absolute', top: 8, right: 8, zIndex: 10,
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isSaved(car.id)
                  ? 'rgba(220,38,38,0.92)'
                  : 'rgba(0,0,0,0.38)',
                backdropFilter: 'blur(4px)',
                border: isSaved(car.id)
                  ? '1.5px solid rgba(220,38,38,0.6)'
                  : '1.5px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                transition: 'all 0.18s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <Heart
                size={14}
                fill={isSaved(car.id) ? '#fff' : 'none'}
                stroke={isSaved(car.id) ? '#fff' : 'rgba(255,255,255,0.85)'}
                strokeWidth={2}
              />
            </button>
          )}
        </div>

        {/* ── Body ── */}
        <div
          className="cc-body"
          style={{
            padding: '11px 13px 13px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Car name — always 1 line */}
          <h3 className="cc-name" style={{
            color: xdrive ? xd.title : 'var(--color-text-primary, #f3f4f6)',
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            margin: '0 0 2px',
            flexShrink: 0,
          }}>
            {[year, brand, model, variant].filter(Boolean).join(' ')}
          </h3>

          {/* Sub line: colour · location — always 1 line */}
          <div
            className="cc-sub"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              marginBottom: 8, overflow: 'hidden', flexShrink: 0,
              height: 16,
            }}
          >
            {colour && (
              <span style={{ fontSize: 11, color: xdrive ? xd.sub : 'var(--color-text-secondary, #6b7280)', flexShrink: 0 }}>{colour}</span>
            )}
            {colour && location && (
              <span className="cc-sub-dot" style={{ width: 3, height: 3, borderRadius: '50%', background: xdrive ? xd.sub : 'var(--color-text-secondary, #6b7280)', flexShrink: 0 }} />
            )}
            {location && (
              <span className="cc-sub-loc" style={{ fontSize: 11, color: xdrive ? xd.sub : 'var(--color-text-secondary, #6b7280)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location}</span>
            )}
          </div>

          {/* Price — fixed height container */}
          <div
            className="cc-pricebox"
            style={{ marginBottom: 9, flexShrink: 0, height: 62, overflow: 'hidden' }}
          >
            {/* Strikethrough — reserve 1 line always */}
            <div style={{ height: 15 }}>
              {hasDiscount && (
                <span style={{ color: xdrive ? xd.priceStrike : 'var(--color-text-secondary, #6b7280)', fontSize: 11, textDecoration: 'line-through' }}>
                  RM {originalPrice.toLocaleString('en-MY')}
                </span>
              )}
            </div>
            {/* Main price — own line */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
              <span className="cc-price-main" style={{
                color: xdrive ? xd.priceMain : (isHot ? '#f87171' : 'var(--color-text-primary, #ffffff)'),
                fontSize: 20, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em',
              }}>
                {formattedPrice}
              </span>
            </div>
            {/* Monthly estimate — own line, never truncated */}
            <div style={{ height: 17 }}>
              {monthly && (
                <span className="cc-monthly" style={{ color: xdrive ? xd.monthly : 'var(--color-text-secondary, #6b7280)', fontSize: 11 }}>
                  est. RM {monthly.toLocaleString('en-MY')}/mo
                  {isHot && (
                    <span style={{ color: xdrive ? xd.priceSave : '#34d399', fontWeight: 600, marginLeft: 6 }}>
                      · Save RM {(originalPrice - price).toLocaleString('en-MY')}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* 2×2 specs grid */}
          <div className="cc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 10, flexShrink: 0 }}>
            {specCells.map((cell, i) => (
              <div key={i} className="cc-cell" style={{
                background: xdrive ? xd.cellBg : 'var(--color-background-secondary, rgba(255,255,255,0.04))',
                border: xdrive ? `1px solid ${xd.cellBorder}` : 'none',
                borderRadius: 'var(--border-radius-md, 8px)',
                padding: '6px 8px',
                display: 'flex', alignItems: 'center', gap: 6,
                minWidth: 0,
              }}>
                <cell.icon size={12} style={{ color: xdrive ? xd.cellLabel : 'var(--color-text-secondary, #6b7280)', flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span className="cc-cell-lbl" style={{ display: 'block', fontSize: 9, color: xdrive ? xd.cellLabel : 'var(--color-text-secondary, #6b7280)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{cell.label}</span>
                  <span className="cc-cell-val" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: xdrive ? xd.cellValue : 'var(--color-text-primary, #f3f4f6)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="cc-divider" style={{ borderTop: `0.5px solid ${xdrive ? xd.divider : 'var(--color-border-tertiary, rgba(255,255,255,0.07))'}`, marginBottom: 9, flexShrink: 0 }} />

          {/* Bottom row — fixed height */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto', height: 36, overflow: 'hidden' }}>
            {/* Left: condition pill + grade */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
              {car.condition && (() => {
                const pill = xdrive
                  ? (xd.conditionPill[car.condition] || xd.conditionPill.used)
                  : (car.condition === 'recon'
                    ? { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }
                    : car.condition === 'new'
                    ? { bg: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }
                    : { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.25)' });
                return (
                  <span style={{
                    display: 'inline-block', flexShrink: 0,
                    fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 20,
                    background: pill.bg, color: pill.color, border: pill.border,
                  }}>
                    {{ used: 'Used', recon: 'Recon', new: 'New' }[car.condition] || car.condition}
                  </span>
                );
              })()}
              {hasGrade && <GradeBadge auctionGrade={auctionGrade} interiorGrade={interiorGrade} size="sm" />}
              {!car.condition && !hasGrade && <span style={{ fontSize: 10, color: xdrive ? xd.sub : 'var(--color-text-secondary, #6b7280)' }}>—</span>}
            </div>

            {/* Right: WA icon button */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
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
                flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36,
                background: xdrive ? xd.waBtn.bg : (isSold ? 'rgba(255,255,255,0.03)' : 'rgba(37,211,102,0.08)'),
                border: xdrive ? xd.waBtn.border : (isSold
                  ? '0.5px solid var(--color-border-tertiary, rgba(255,255,255,0.06))'
                  : '1px solid rgba(37,211,102,0.2)'),
                color: xdrive ? xd.waBtn.color : (isSold ? 'var(--color-text-secondary, #6b7280)' : '#25D366'),
                borderRadius: 'var(--border-radius-md, 10px)',
                textDecoration: 'none', transition: 'all 0.18s',
                pointerEvents: isSold ? 'none' : 'auto',
              }}
            >
              <MessageCircle size={15} />
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default CarCard;
