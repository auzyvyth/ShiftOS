import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Gauge, Settings2, MessageCircle, ChevronRight, Fuel, TrendingDown } from 'lucide-react';
import './CarCard.css';

const STATUS_CONFIG = {
  active:   { label: 'Active',   dot: 'bg-green-400',  text: 'text-green-400',  bg: 'bg-green-400/10',  next: 'reserved' },
  reserved: { label: 'Reserved', dot: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-400/10', next: 'sold'     },
  sold:     { label: 'Sold',     dot: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-400/10',    next: 'active'   },
};

const StatusBadge = ({ car }) => {
  const s = car.status || 'active';
  const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.active;
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </div>
  );
};

const calcMonthly = (price) => {
  if (!price || price <= 0) return null;
  const loan  = price * 0.9;
  const rate  = 3.5 / 100;
  const years = 7;
  return Math.round((loan * (1 + rate * years)) / (years * 12));
};

const CarCard = ({ car, showDiscountBadge = true }) => {
  const navigate    = useNavigate();
  const [imgError, setImgError] = useState(false);

  const brand        = car.brand || car.make || 'Unknown';
  const model        = car.model || '';
  const variant      = car.variant || '';
  const year         = car.year || '';
  const price        = car.selling_price || car.price || 0;
  const originalPrice = car.original_price || null;   // ← use original_price
  const mileage      = car.mileage || car.odometer || null;
  const transmission = car.transmission || null;
  const location     = car.state || car.location || null;
  const bodyType     = car.body_type || null;
  const fuelType     = car.fuel_type || null;

  // Discount — only valid when original_price is set and strictly higher than selling_price
  const hasDiscount  = originalPrice && originalPrice > 0 && price > 0 && originalPrice > price;
  const discountAmt  = hasDiscount ? originalPrice - price : null;
  const discountPct  = hasDiscount ? Math.round((discountAmt / originalPrice) * 100) : null;

  const image = !imgError && (
    (Array.isArray(car.images) && car.images[0]) ||
    car.image_url || car.photo_url || car.thumbnail || null
  );

  const formattedPrice    = price ? 'RM ' + price.toLocaleString('en-MY') : 'Price on request';
  const monthly           = calcMonthly(price);
  const formattedMileage  = mileage ? Number(mileage).toLocaleString('en-MY') + ' km' : null;

  const normalizedTransmission =
    transmission === 'Auto' || transmission === 'Automatic' || transmission === 'AT' ? 'Auto' :
    transmission === 'Manual' || transmission === 'MT' ? 'Manual' :
    transmission || null;

  const whatsappNumber = '60174155191';
  const whatsappMsg    = encodeURIComponent(`Hi, I am interested in the ${year} ${brand} ${model}${variant ? ' ' + variant : ''} listed on your site. Can you share more details?`);
  const whatsappUrl    = `https://wa.me/${whatsappNumber}?text=${whatsappMsg}`;

  return (
    <div className="car-card" onClick={() => navigate('/cars/' + car.id)}>

      <div className="car-card-image-wrap">
        {image ? (
          <img
            src={image}
            alt={`${year} ${brand} ${model}${variant ? ' ' + variant : ''}`}
            className="car-card-image"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="car-card-image-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.2">
              <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h10l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
              <circle cx="7.5" cy="17.5" r="2.5"/>
              <circle cx="16.5" cy="17.5" r="2.5"/>
            </svg>
            <span>No image</span>
          </div>
        )}

        {year && <div className="car-card-year-badge">{year}</div>}
        <div className="car-card-bottom-left">
          {bodyType && <div className="car-card-body-badge-inline">{bodyType}</div>}
          {hasDiscount && showDiscountBadge && (
            <div className="car-card-discount-inline" title={`Save RM ${discountAmt?.toLocaleString() || ''} (${discountPct}%)`}>
              <TrendingDown size={12} />
              <span>−{discountPct}%</span>
            </div>
          )}
        </div>

        <div className="car-card-status-badge">
          <StatusBadge car={car} />
        </div>
      </div>

      <div className="car-card-body">

        <div className="car-card-title-row">
          <div>
            <p className="car-card-brand">{brand}</p>
            <h3 className="car-card-model">{model || '—'}{variant && ` ${variant}`}</h3>
          </div>
          <ChevronRight className="car-card-arrow" size={18} />
        </div>

        {/* Price row */}
        <div className="car-card-price-row">
          <div className="car-card-price-stack">
            {hasDiscount && (
              <span className="car-card-previous-price">
                RM {originalPrice.toLocaleString('en-MY')}
              </span>
            )}
            <div className="car-card-price-line">
              <span className="car-card-price">{formattedPrice}</span>
              {monthly !== null && (
                <span className="car-card-monthly-wrap">
                  <span className="car-card-price-divider">/</span>
                  <span className="car-card-monthly">
                    RM {monthly.toLocaleString('en-MY')}
                    <span className="car-card-monthly-label">/mo</span>
                  </span>
                </span>
              )}
            </div>
            {hasDiscount && (
              <span className="car-card-savings">
                Save RM {discountAmt.toLocaleString('en-MY')}
              </span>
            )}
          </div>
        </div>

        <div className="car-card-specs">
          {formattedMileage && (
            <div className="car-card-spec"><Gauge size={12} /><span>{formattedMileage}</span></div>
          )}
          {normalizedTransmission && (
            <div className="car-card-spec"><Settings2 size={12} /><span>{normalizedTransmission}</span></div>
          )}
          {fuelType && (
            <div className="car-card-spec"><Fuel size={12} /><span>{fuelType}</span></div>
          )}
          {location && (
            <div className="car-card-spec"><MapPin size={12} /><span>{location}</span></div>
          )}
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="car-card-wa-btn"
          onClick={(e) => e.stopPropagation()}
        >
          <MessageCircle size={14} />
          Enquire via WhatsApp
        </a>

      </div>
    </div>
  );
};

export default CarCard;