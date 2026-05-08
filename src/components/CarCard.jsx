import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Gauge, Settings2, MessageCircle, Flame, ArrowLeftRight, Calendar, Zap, ShieldCheck, FileText, Key } from 'lucide-react';
import GradeBadge from './GradeBadge';
import { buildWaUrl } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { trackEvent, getSlugFromURL } from '../utils/analytics';
import HeartButton from './HeartButton';
import { useCompare } from '../hooks/useCompare';

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
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const inCompare = isInCompare(car.id);

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
  const isRecon     = car.is_recon || false;

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
  const engineVal = car.engine_cc
    ? `${Number(car.engine_cc).toLocaleString('en-MY')} cc`
    : car.engine || null;

  const waText = `Hi, I'm interested in the ${year} ${brand} ${model}${variant ? ' ' + variant : ''}. Can you share more details?`;
  const ctxResolved = ctaContext?.type !== 'loading' ? ctaContext : null;
  const whatsappUrl = buildWaUrl(
    ctxResolved || { type: 'listing', profile: null, ref: null },
    XDRIVE_PHONE,
    waText
  );

  const carColor  = car.color || car.exterior_color || null;
  const keysCount = car.keys_count ?? 1;

  const trustPills = [
    (car.owners === 1 || car.ownership_count === 1) && { icon: ShieldCheck, label: '1 owner', green: true },
    (car.accident_free || car.no_accident)           && { icon: ShieldCheck, label: 'No accidents', green: true },
    (car.service_records || car.has_service_records) && { icon: FileText,   label: 'Service records', blue: true },
    { icon: Key, label: `${keysCount} key${keysCount !== 1 ? 's' : ''}` },
  ].filter(Boolean);

  const specCells = [
    { icon: Gauge,    label: 'Mileage',      value: formattedMileage || '—' },
    { icon: Calendar, label: 'Year',          value: year || '—' },
    { icon: Zap,      label: 'Engine',        value: engineVal || '—' },
    { icon: Settings2, label: 'Transmission', value: normalTx || '—' },
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
        .cc-compare:hover {
          background: rgba(255,255,255,0.1) !important;
          color: #fff !important;
        }
        .cc-compare.active:hover {
          background: rgba(220,38,38,0.2) !important;
        }

        @media (max-width: 480px) {
          .cc-img          { height: 155px !important; }
          .cc-body         { padding: 11px !important; }
          .cc-name         { font-size: 14px !important; margin-bottom: 2px !important; }
          .cc-subline      { margin-bottom: 9px !important; }
          .cc-location     { display: none !important; }
          .cc-loc-dot      { display: none !important; }
          .cc-price-main   { font-size: 18px !important; }
          .cc-monthly      { display: none !important; }
          .cc-price-block  { margin-bottom: 10px !important; }
          .cc-spec-grid    { gap: 5px !important; margin-bottom: 10px !important; }
          .cc-spec-cell    { padding: 6px 8px !important; gap: 5px !important; }
          .cc-spec-lbl     { font-size: 9px !important; }
          .cc-spec-val     { font-size: 11px !important; }
          .cc-spec-icon    { width: 12px !important; height: 12px !important; }
          .cc-trust-row    { margin-bottom: 10px !important; gap: 4px !important; }
          .cc-trust-pill   { font-size: 10px !important; padding: 3px 8px !important; }
          .cc-divider      { margin-bottom: 9px !important; }
          .cc-wa           { font-size: 12px !important; padding: 8px 10px !important; }
          .cc-badge        { font-size: 9px !important; padding: 2px 7px !important; }
          .cc-year-chip    { font-size: 10px !important; padding: 2px 7px !important; }
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
        <div className="cc-img" style={{ position: 'relative', height: 220, background: '#0e0e14', flexShrink: 0, overflow: 'hidden' }}>
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
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2d3748" strokeWidth="1.2">
                <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h10l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
                <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
              </svg>
              <span style={{ fontSize: 11, color: '#374151' }}>No photo</span>
            </div>
          )}

          {/* Top-left badges */}
          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 5, flexWrap: 'wrap', maxWidth: 'calc(100% - 72px)' }}>
            {isSold && (
              <span className="cc-badge" style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)', color: '#9ca3af', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20 }}>SOLD</span>
            )}
            {isReserved && !isSold && (
              <span className="cc-badge" style={{ background: 'rgba(245,158,11,0.85)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20 }}>RESERVED</span>
            )}
            {isHot && showDiscountBadge && !isSold && (
              <span className="cc-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, boxShadow: '0 2px 8px rgba(220,38,38,0.45)' }}>
                <Flame size={9} /> −{discountPct}%
              </span>
            )}
            {isRecon && !isSold && (
              <span className="cc-badge" style={{ background: 'rgba(139,92,246,0.85)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20 }}>RECON</span>
            )}
            {isNew && !isHot && !isRecon && !isSold && (
              <span className="cc-badge" style={{ background: 'rgba(16,185,129,0.85)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20 }}>NEW</span>
            )}
          </div>

          {/* Top-right: year chip + heart */}
          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            {year && (
              <span className="cc-year-chip" style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', color: '#e5e7eb', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 7 }}>
                {year}
              </span>
            )}
            <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '5px 7px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <HeartButton listingId={car.id} size={15} />
            </div>
          </div>

          {/* Bottom-left: grade badge */}
          {hasGrade && (
            <div style={{ position: 'absolute', bottom: 10, left: 10 }}>
              <GradeBadge auctionGrade={auctionGrade} interiorGrade={interiorGrade} size="sm" />
            </div>
          )}

          {/* Bottom-right: compare toggle */}
          {!isSold && (
            <button
              className={`cc-compare${inCompare ? ' active' : ''}`}
              onClick={e => {
                e.stopPropagation();
                inCompare ? removeFromCompare(car.id) : addToCompare(car.id);
              }}
              title={inCompare ? 'Remove from compare' : 'Add to compare'}
              style={{
                position: 'absolute', bottom: 10, right: 10,
                display: 'flex', alignItems: 'center', gap: 4,
                background: inCompare ? 'rgba(220,38,38,0.75)' : 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                borderRadius: 20,
                color: inCompare ? '#fff' : '#9ca3af',
                fontSize: 10, fontWeight: 700,
                padding: '4px 9px',
                cursor: 'pointer', transition: 'all 0.15s',
                fontFamily: 'var(--font-sans, "Outfit", sans-serif)',
              }}
            >
              <ArrowLeftRight size={10} />
              {inCompare ? 'Comparing' : 'Compare'}
            </button>
          )}
        </div>

        {/* ── Body ── */}
        <div className="cc-body" style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>

          {/* Car name */}
          <h3 className="cc-name" style={{
            color: 'var(--color-text-primary, #f3f4f6)',
            fontSize: 17, fontWeight: 500, lineHeight: 1.3,
            whiteSpace: 'normal', wordBreak: 'break-word',
            margin: '0 0 2px',
          }}>
            {[year, brand, model, variant].filter(Boolean).join(' ')}
          </h3>

          {/* Sub line: color · location */}
          <div className="cc-subline" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'nowrap', minWidth: 0 }}>
            {carColor && (
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary, #6b7280)', flexShrink: 0 }}>{carColor}</span>
            )}
            {carColor && location && (
              <span className="cc-loc-dot" style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--color-text-secondary, #6b7280)', flexShrink: 0 }} />
            )}
            {location && (
              <span className="cc-location" style={{ fontSize: 12, color: 'var(--color-text-secondary, #6b7280)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location}</span>
            )}
            {!carColor && !location && (
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary, #6b7280)' }}>&nbsp;</span>
            )}
          </div>

          {/* Price */}
          <div className="cc-price-block" style={{ marginBottom: 14 }}>
            {hasDiscount && (
              <div>
                <span style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: 11, textDecoration: 'line-through' }}>
                  RM {originalPrice.toLocaleString('en-MY')}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span className="cc-price-main" style={{
                color: isHot ? '#f87171' : 'var(--color-text-primary, #ffffff)',
                fontSize: 22, fontWeight: 500, lineHeight: 1,
              }}>
                {formattedPrice}
              </span>
              {monthly && (
                <span className="cc-monthly" style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: 12 }}>
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

          {/* 2×2 Specs grid */}
          <div className="cc-spec-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {specCells.map((cell, i) => (
              <div key={i} className="cc-spec-cell" style={{
                background: 'var(--color-background-secondary, rgba(255,255,255,0.04))',
                borderRadius: 'var(--border-radius-md, 8px)',
                padding: '8px 10px',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <cell.icon className="cc-spec-icon" size={15} style={{ color: 'var(--color-text-secondary, #6b7280)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <span className="cc-spec-lbl" style={{ display: 'block', fontSize: 10, color: 'var(--color-text-secondary, #6b7280)', lineHeight: 1.2 }}>{cell.label}</span>
                  <span className="cc-spec-val" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary, #f3f4f6)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Trust pills */}
          {trustPills.length > 0 && (
            <div className="cc-trust-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {trustPills.map((pill, i) => (
                <span key={i} className="cc-trust-pill" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'var(--color-background-secondary, rgba(255,255,255,0.04))',
                  border: '0.5px solid var(--color-border-tertiary, rgba(255,255,255,0.07))',
                  borderRadius: 20, padding: '4px 10px',
                  fontSize: 11, color: 'var(--color-text-secondary, #6b7280)',
                }}>
                  <pill.icon
                    size={13}
                    style={{ color: pill.green ? '#1D9E75' : pill.blue ? '#378ADD' : 'var(--color-text-secondary, #6b7280)', flexShrink: 0 }}
                  />
                  {pill.label}
                </span>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="cc-divider" style={{ borderTop: '0.5px solid var(--color-border-tertiary, rgba(255,255,255,0.07))', marginBottom: 12 }} />

          {/* WhatsApp CTA */}
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
              marginTop: 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: isSold ? 'rgba(255,255,255,0.03)' : 'rgba(37,211,102,0.08)',
              border: isSold
                ? '0.5px solid var(--color-border-tertiary, rgba(255,255,255,0.06))'
                : '1px solid rgba(37,211,102,0.2)',
              color: isSold ? 'var(--color-text-secondary, #6b7280)' : '#25D366',
              borderRadius: 'var(--border-radius-md, 10px)',
              padding: '10px 14px', fontSize: 13, fontWeight: 700,
              textDecoration: 'none', transition: 'all 0.18s',
              pointerEvents: isSold ? 'none' : 'auto',
            }}
          >
            <MessageCircle size={14} />
            {isSold ? 'No Longer Available' : 'Enquire via WhatsApp'}
          </a>
        </div>
      </div>
    </>
  );
};

export default CarCard;
