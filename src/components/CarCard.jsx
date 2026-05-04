import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Gauge, Settings2, MessageCircle, Fuel, Flame, Clock, BadgeCheck, ArrowLeftRight } from 'lucide-react';
import GradeBadge from './GradeBadge';
import { buildWaUrl } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { trackEvent, getSlugFromURL } from '../utils/analytics';
import HeartButton from './HeartButton';
import { useCompare } from '../hooks/useCompare';

const calcMonthly = (price) => {
  if (!price || price <= 0) return null;
  return Math.round((price * 0.9 * (1 + 3.5/100 * 7)) / (7 * 12));
};

const getAgeDays = (createdAt) => {
  if (!createdAt) return null;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
};

const XDRIVE_PHONE = '60174155191';

const CarCard = ({ car, showDiscountBadge = true, ctaContext }) => {
  const navigate = useNavigate();
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const [imgError,  setImgError]  = useState(false);
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
  const fuelType      = car.fuel_type || null;
  const status        = car.status || 'active';
  const ageDays       = getAgeDays(car.created_at);

  const hasDiscount  = originalPrice && originalPrice > 0 && price > 0 && originalPrice > price;
  const discountPct  = hasDiscount ? Math.round(((originalPrice - price) / originalPrice) * 100) : null;
  const isHot        = hasDiscount && discountPct >= 3;
  const isNew        = ageDays !== null && ageDays <= 7;
  const isSold       = status === 'sold';
  const isReserved   = status === 'reserved';

  const image = !imgError && (
    (Array.isArray(car.images) && car.images[0]) ||
    car.image_url || car.photo_url || null
  );
  const hasDocuments   = Array.isArray(car.car_documents) && car.car_documents.length > 0;
  const isRecon        = car.is_recon || false;
  const auctionGrade   = car.auction_grade || null;
  const interiorGrade  = car.interior_grade || null;
  const importCountry  = car.import_country || null;
  const hasGrade       = auctionGrade || interiorGrade;

  const formattedPrice   = price ? 'RM ' + price.toLocaleString('en-MY') : 'P.O.R';
  const monthly          = calcMonthly(price);
  const formattedMileage = mileage ? Number(mileage).toLocaleString('en-MY') + ' km' : null;
  const normalTx =
    ['Auto','Automatic','AT'].includes(transmission) ? 'Auto' :
    ['Manual','MT'].includes(transmission)           ? 'Manual' : transmission || null;

  const waText = `Hi, I'm interested in the ${year} ${brand} ${model}${variant ? ' ' + variant : ''}. Can you share more details?`;
  const ctxResolved = ctaContext?.type !== 'loading' ? ctaContext : null;
  const whatsappUrl = buildWaUrl(
    ctxResolved || { type: 'listing', profile: null, ref: null },
    XDRIVE_PHONE,
    waText
  );

  const specs = [
    formattedMileage && { icon: Gauge,     label: formattedMileage },
    normalTx         && { icon: Settings2, label: normalTx         },
    fuelType         && { icon: Fuel,      label: fuelType         },
    location         && { icon: MapPin,    label: location         },
  ].filter(Boolean);

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .car-card-root { transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease !important; }
        .car-card-root:hover { transform: translateY(-4px) !important; box-shadow: 0 20px 40px rgba(0,0,0,0.5) !important; border-color: rgba(255,255,255,0.14) !important; }
        .car-card-root.hot:hover { box-shadow: 0 20px 40px rgba(220,38,38,0.15) !important; border-color: rgba(220,38,38,0.45) !important; }
        .wa-cta:hover { background: rgba(37,211,102,0.22) !important; border-color: rgba(37,211,102,0.45) !important; }
        @media(max-width:640px){
          .car-card-badge { font-size:10px !important; padding:2px 6px !important; }
          .car-card-img { height:120px !important; }
          .car-card-body { padding:9px 10px 11px !important; }
          .car-card-brand { font-size:9px !important; margin-bottom:2px !important; }
          .car-card-model { font-size:12px !important; }
          .car-card-price-box { padding:7px 9px !important; margin-bottom:8px !important; }
          .car-card-price { font-size:14px !important; }
          .car-card-monthly { display:none !important; }
          .car-card-save { display:none !important; }
          .car-card-specs { gap:4px !important; margin-bottom:9px !important; }
          .car-card-spec { font-size:10px !important; padding:3px 6px !important; }
          .car-card-spec-hide { display:none !important; }
          .car-card-wa { padding:8px 6px !important; border-radius:8px !important; font-size:11px !important; gap:4px !important; }
          .car-card-wa-text { display:none !important; }
          .car-card-brand-row { margin-bottom:7px !important; }
        }
      `}</style>

      <div
        className={`car-card-root${isHot ? ' hot' : ''}`}
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
          background: 'linear-gradient(145deg,#0d1117 0%,#111827 100%)',
          border: isHot ? '1px solid rgba(220,38,38,0.28)' : '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px', overflow: 'hidden',
          cursor: isSold ? 'default' : 'pointer',
          fontFamily: "'DM Sans',sans-serif",
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* ── Image ── */}
        <div className="car-card-img" style={{ position:'relative', height:'200px', background:'#08090f', flexShrink:0, overflow:'hidden' }}>
          {image ? (
            <>
              {!imgLoaded && (
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,#111827 25%,#1f2937 50%,#111827 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.5s infinite' }}/>
              )}
              <img src={image} alt={`${year} ${brand} ${model}`}
                onError={() => setImgError(true)}
                onLoad={() => setImgLoaded(true)}
                style={{ width:'100%', height:'100%', objectFit:'cover', opacity: imgLoaded ? 1 : 0, transition:'opacity 0.3s ease', filter: isSold ? 'grayscale(70%)' : 'none' }}
              />
            </>
          ) : (
            <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', color:'#374151' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h10l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
                <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
              </svg>
              <span style={{ fontSize:'11px' }}>No photo</span>
            </div>
          )}

          {/* Bottom gradient */}
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'70px', background:'linear-gradient(to top, rgba(13,17,23,0.95), transparent)', pointerEvents:'none' }}/>

          {/* Top-left badges */}
          <div style={{ position:'absolute', top:'10px', left:'10px', display:'flex', gap:'5px', flexWrap:'wrap' }}>
            {isHot && showDiscountBadge && (
              <span className="car-card-badge" style={{ display:'inline-flex', alignItems:'center', gap:'3px', background:'linear-gradient(135deg,#dc2626,#b91c1c)', color:'white', fontSize:'11px', fontWeight:'800', padding:'3px 8px', borderRadius:'20px', boxShadow:'0 2px 10px rgba(220,38,38,0.5)' }}>
                <Flame size={9}/> HOT −{discountPct}%
              </span>
            )}
            {isRecon && (
              <span className="car-card-badge" style={{ background:'rgba(220,38,38,0.85)', color:'white', fontSize:'11px', fontWeight:'800', padding:'3px 8px', borderRadius:'20px', letterSpacing:'0.04em' }}>RECON</span>
            )}
            {isNew && !isHot && !isRecon && (
              <span className="car-card-badge" style={{ background:'rgba(16,185,129,0.9)', color:'white', fontSize:'11px', fontWeight:'800', padding:'3px 8px', borderRadius:'20px' }}>NEW</span>
            )}
            {isSold && (
              <span className="car-card-badge" style={{ background:'rgba(0,0,0,0.8)', border:'1px solid rgba(255,255,255,0.15)', color:'#9ca3af', fontSize:'11px', fontWeight:'700', padding:'3px 10px', borderRadius:'20px' }}>SOLD</span>
            )}
            {isReserved && (
              <span className="car-card-badge" style={{ background:'rgba(245,158,11,0.9)', color:'white', fontSize:'11px', fontWeight:'800', padding:'3px 10px', borderRadius:'20px' }}>RESERVED</span>
            )}
            {hasDocuments && !isSold && (
              <span className="car-card-badge" style={{ display:'inline-flex', alignItems:'center', gap:'3px', background:'rgba(34,197,94,0.85)', color:'white', fontSize:'11px', fontWeight:'800', padding:'3px 8px', borderRadius:'20px' }}>
                <BadgeCheck size={9}/> DOCS
              </span>
            )}
          </div>

          {/* Year badge + heart */}
          <div style={{ position:'absolute', top:'10px', right:'10px', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
            {year && (
              <div style={{ background:'rgba(0,0,0,0.7)', border:'1px solid rgba(255,255,255,0.1)', backdropFilter:'blur(8px)', color:'white', fontSize:'11px', fontWeight:'600', padding:'3px 8px', borderRadius:'6px' }}>
                {year}
              </div>
            )}
            <div
              onClick={e => e.stopPropagation()}
              style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)', borderRadius:8, padding:'5px 7px', border:'1px solid rgba(255,255,255,0.1)' }}
            >
              <HeartButton listingId={car.id} size={16} />
            </div>
          </div>

          {/* Grade badge + import country (bottom-left of image) */}
          {(hasGrade || (isRecon && importCountry)) && (
            <div style={{ position:'absolute', bottom:'10px', left:'10px', display:'flex', flexDirection:'column', gap:'4px', alignItems:'flex-start' }}>
              {hasGrade && <GradeBadge auctionGrade={auctionGrade} interiorGrade={interiorGrade} size="sm"/>}
              {isRecon && importCountry && (
                <span style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(6px)', border:'1px solid rgba(255,255,255,0.12)', color:'#d1d5db', fontSize:'10px', fontWeight:'600', padding:'2px 7px', borderRadius:'5px' }}>
                  {importCountry}
                </span>
              )}
            </div>
          )}

          {/* Age */}
          {ageDays !== null && ageDays > 0 && !isSold && (
            <div style={{ position:'absolute', bottom:'10px', right:'10px', display:'inline-flex', alignItems:'center', gap:'3px', color: ageDays<=7?'#34d399':ageDays<=30?'#fbbf24':'#6b7280', fontSize:'10px', fontWeight:'500' }}>
              <Clock size={9}/>{ageDays}d ago
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="car-card-body" style={{ padding:'14px 16px 16px', display:'flex', flexDirection:'column', flex:1 }}>

          {/* Brand / Model */}
          <div className="car-card-brand-row" style={{ marginBottom:'10px' }}>
            <p className="car-card-brand" style={{ color:'#6b7280', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 3px 0' }}>{brand}</p>
            <h3 className="car-card-model" style={{ color:'white', fontSize:'15px', fontWeight:'800', margin:0, lineHeight:1.3 }}>
              {model}{variant ? ` ${variant}` : ''}
            </h3>
          </div>

          {/* Price block */}
          <div className="car-card-price-box" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'10px', padding:'10px 12px', marginBottom:'12px' }}>
            {hasDiscount && (
              <p className="car-card-save" style={{ color:'#6b7280', fontSize:'11px', textDecoration:'line-through', margin:'0 0 2px 0' }}>
                RM {originalPrice.toLocaleString('en-MY')}
              </p>
            )}
            <div style={{ display:'flex', alignItems:'baseline', gap:'8px', flexWrap:'wrap' }}>
              <span className="car-card-price" style={{ color: isHot ? '#f87171' : 'white', fontSize:'20px', fontWeight:'800', lineHeight:1 }}>
                {formattedPrice}
              </span>
              {monthly && (
                <span className="car-card-monthly" style={{ color:'#6b7280', fontSize:'11px' }}>≈ RM {monthly.toLocaleString('en-MY')}/mo</span>
              )}
            </div>
            {hasDiscount && (
              <p className="car-card-save" style={{ color:'#34d399', fontSize:'11px', fontWeight:'600', margin:'4px 0 0 0' }}>
                Save RM {(originalPrice - price).toLocaleString('en-MY')}
              </p>
            )}
          </div>

          {/* Specs */}
          {specs.length > 0 && (
            <div className="car-card-specs" style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'14px' }}>
              {specs.map((s,i) => (
                <span key={i} className={`car-card-spec${i >= 2 ? ' car-card-spec-hide' : ''}`} style={{ display:'inline-flex', alignItems:'center', gap:'4px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'6px', padding:'4px 8px', color:'#9ca3af', fontSize:'11px', fontWeight:'500' }}>
                  <s.icon size={10} style={{ color:'#6b7280' }}/>{s.label}
                </span>
              ))}
            </div>
          )}

          {/* Compare toggle */}
          {!isSold && (
            <button
              onClick={e => {
                e.stopPropagation();
                inCompare ? removeFromCompare(car.id) : addToCompare(car.id);
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: inCompare ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.04)',
                border: inCompare ? '1px solid rgba(220,38,38,0.35)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '7px 10px', width: '100%', marginBottom: 8,
                color: inCompare ? '#f87171' : '#6b7280', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.18s',
              }}
            >
              <ArrowLeftRight size={12} />
              {inCompare ? 'Remove from Compare' : 'Add to Compare'}
            </button>
          )}

          {/* WhatsApp CTA */}
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
            className="wa-cta car-card-wa"
            onClick={e => {
              e.stopPropagation();
              // Record enquiry — fire-and-forget, never block navigation
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
              marginTop:'auto', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
              background: isSold ? 'rgba(255,255,255,0.04)' : 'rgba(37,211,102,0.1)',
              border: isSold ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(37,211,102,0.22)',
              color: isSold ? '#6b7280' : '#25D366',
              borderRadius:'10px', padding:'10px', fontSize:'12px', fontWeight:'700',
              textDecoration:'none', transition:'all 0.2s ease',
              pointerEvents: isSold ? 'none' : 'auto',
            }}
          >
            <MessageCircle size={13}/>
            <span className="car-card-wa-text">{isSold ? 'No Longer Available' : 'Enquire via WhatsApp'}</span>
          </a>
        </div>
      </div>
    </>
  );
};

export default CarCard;