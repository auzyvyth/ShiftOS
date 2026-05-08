import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gauge, Settings2, MessageCircle, Fuel, Calendar } from 'lucide-react';
import GradeBadge from './GradeBadge';
import { buildWaUrl } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { trackEvent, getSlugFromURL } from '../utils/analytics';

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

  // Real DB fields from CarForm
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

  // 2×2 grid: only real DB fields, show — when missing
  const specCells = [
    { icon: Gauge,    label: 'Mileage', value: formattedMileage || '—' },
    { icon: Calendar, label: 'Year',    value: year ? String(year) : '—' },
    { icon: Fuel,     label: 'Fuel',    value: fuelType || '—' },
    { icon: Settings2, label: 'Gearbox', value: normalTx || '—' },
  ];

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
        .cc-wa:hover {
          background: rgba(37,211,102,0.18) !important;
          border-color: rgba(37,211,102,0.5) !important;
        }

        @media (max-width: 520px) {
          .cc-img         { height: 150px !important; }
          .cc-body        { padding: 10px !important; }
          .cc-name        { font-size: 13px !important; margin-bottom: 2px !important; }
          .cc-sub         { margin-bottom: 8px !important; }
          .cc-sub-loc     { display: none !important; }
          .cc-sub-dot     { display: none !important; }
          .cc-price-main  { font-size: 17px !important; }
          .cc-monthly     { display: none !important; }
          .cc-pricebox    { margin-bottom: 10px !important; }
          .cc-grid        { gap: 4px !important; margin-bottom: 10px !important; }
          .cc-cell        { padding: 5px 7px !important; gap: 5px !important; }
          .cc-cell-lbl    { font-size: 9px !important; }
          .cc-cell-val    { font-size: 11px !important; }
          .cc-divider     { margin-bottom: 8px !important; }
          .cc-wa          { width: 34px !important; height: 34px !important; }
        }
      `}</style>

      <div
        className={`cc-root${isHot ? ' hot' : ''}`}
        onClick={() => {
          if (isSold || !(car.slug || car.id)) return;
          trackEvent(supabase, 'card_click', {
            car_id: car.id,
            car_name: `${year} ${brand} ${model}`,
            dealer_id: car.dealer_id || null,
            metadata: { source: 'car_card' },
          });
          navigate('/cars/' + (car.slug || car.id));
        }}
        style={{
          background: 'var(--color-background-primary, #0d1117)',
          border: isHot
            ? '0.5px solid rgba(220,38,38,0.25)'
            : '0.5px solid var(--color-border-tertiary, rgba(255,255,255,0.07))',
          borderRadius: 'var(--border-radius-lg, 12px)',
          overflow: 'hidden',
          cursor: isSold ? 'default' : 'pointer',
          fontFamily: 'var(--font-sans, "Outfit", sans-serif)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── Image ── */}
        <div className="cc-img" style={{ position: 'relative', height: 195, background: '#0e0e14', flexShrink: 0, overflow: 'hidden' }}>
          {image ? (
            <>
              {!imgLoaded && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(90deg,#0f1623 25%,#182030 50%,#0f1623 75%)',
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
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
                background: 'linear-gradient(to top, rgba(13,17,23,0.7), transparent)',
                pointerEvents: 'none',
              }} />
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
                <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h10l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
                <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
              </svg>
              <span style={{ fontSize: 10, color: '#374151' }}>No photo</span>
            </div>
          )}

        </div>

        {/* ── Body ── */}
        <div className="cc-body" style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>

          {/* Car name */}
          <h3 className="cc-name" style={{
            color: 'var(--color-text-primary, #f3f4f6)',
            fontSize: 15, fontWeight: 500, lineHeight: 1.3,
            whiteSpace: 'normal', wordBreak: 'break-word',
            margin: '0 0 2px',
          }}>
            {[year, brand, model, variant].filter(Boolean).join(' ')}
          </h3>

          {/* Sub line: colour · location */}
          <div className="cc-sub" style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, overflow: 'hidden' }}>
            {colour && (
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary, #6b7280)', flexShrink: 0 }}>{colour}</span>
            )}
            {colour && location && (
              <span className="cc-sub-dot" style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--color-text-secondary, #6b7280)', flexShrink: 0 }} />
            )}
            {location && (
              <span className="cc-sub-loc" style={{ fontSize: 11, color: 'var(--color-text-secondary, #6b7280)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location}</span>
            )}
          </div>

          {/* Price */}
          <div className="cc-pricebox" style={{ marginBottom: 12 }}>
            {hasDiscount && (
              <span style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: 11, textDecoration: 'line-through' }}>
                RM {originalPrice.toLocaleString('en-MY')}
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
              <span className="cc-price-main" style={{
                color: isHot ? '#f87171' : 'var(--color-text-primary, #ffffff)',
                fontSize: 20, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.01em',
              }}>
                {formattedPrice}
              </span>
              {monthly && (
                <span className="cc-monthly" style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: 11 }}>
                  est. RM {monthly.toLocaleString('en-MY')}/mo
                </span>
              )}
            </div>
            {isHot && (
              <span style={{ color: '#34d399', fontSize: 11, fontWeight: 600 }}>
                Save RM {(originalPrice - price).toLocaleString('en-MY')}
              </span>
            )}
          </div>

          {/* 2×2 specs grid — all real DB fields */}
          <div className="cc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {specCells.map((cell, i) => (
              <div key={i} className="cc-cell" style={{
                background: 'var(--color-background-secondary, rgba(255,255,255,0.04))',
                borderRadius: 'var(--border-radius-md, 8px)',
                padding: '7px 9px',
                display: 'flex', alignItems: 'center', gap: 6,
                minWidth: 0,
              }}>
                <cell.icon size={13} style={{ color: 'var(--color-text-secondary, #6b7280)', flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span className="cc-cell-lbl" style={{ display: 'block', fontSize: 10, color: 'var(--color-text-secondary, #6b7280)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{cell.label}</span>
                  <span className="cc-cell-val" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary, #f3f4f6)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="cc-divider" style={{ borderTop: '0.5px solid var(--color-border-tertiary, rgba(255,255,255,0.07))', marginBottom: 10 }} />

          {/* Bottom row: condition + grade (left) | WA icon (right) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto' }}>
            {/* Left: condition pill + grade — shrinks to content */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, minWidth: 0 }}>
              {car.condition && (
                <span style={{
                  display: 'inline-block',
                  alignSelf: 'flex-start',
                  fontSize: 10, fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 20,
                  ...(car.condition === 'recon'
                    ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }
                    : car.condition === 'new'
                    ? { background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }
                    : { background: 'rgba(107,114,128,0.12)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.25)' }),
                }}>
                  {{ used: 'Used', recon: 'Recon', new: 'New' }[car.condition] || car.condition}
                </span>
              )}
              {hasGrade && <GradeBadge auctionGrade={auctionGrade} interiorGrade={interiorGrade} size="sm" />}
              {!car.condition && !hasGrade && <span style={{ fontSize: 10, color: 'var(--color-text-secondary, #6b7280)' }}>—</span>}
            </div>

            {/* Right: WA icon-only button */}
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
                  ref_slug:      getSlugFromURL() || null,
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
                width: 40, height: 40,
                background: isSold ? 'rgba(255,255,255,0.03)' : 'rgba(37,211,102,0.08)',
                border: isSold
                  ? '0.5px solid var(--color-border-tertiary, rgba(255,255,255,0.06))'
                  : '1px solid rgba(37,211,102,0.2)',
                color: isSold ? 'var(--color-text-secondary, #6b7280)' : '#25D366',
                borderRadius: 'var(--border-radius-md, 10px)',
                textDecoration: 'none', transition: 'all 0.18s',
                pointerEvents: isSold ? 'none' : 'auto',
              }}
            >
              <MessageCircle size={16} />
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default CarCard;
