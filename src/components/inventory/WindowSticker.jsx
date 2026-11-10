// Window sticker (INV-STICKER, owner 2026-11-10): one A4 page per car to tape on the
// windscreen or hand over in the showroom. A buyer on the lot scans the QR, lands on
// the car's page (photos, book a viewing, WhatsApp) and the visit is counted as
// "Window sticker" (?src=sticker, refTracking.js -> CHANNEL_META.sticker).
// Printing uses the browser's own print (Save as PDF works too). Nothing is saved.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { X, Printer } from 'lucide-react';
import { premiumLight as PL } from '../../theme/tokens';
import { useModalHistory } from '../../hooks/useModalHistory';
import { SITE_URL } from '../../config/site';
import { calcMonthly, DEFAULT_EIR } from '../../utils/financing';
import { cdnImg } from '../../utils/img';

const tags = (raw) => (!raw ? [] : Array.isArray(raw) ? raw.filter(Boolean) : String(raw).split(/,|\n/).map(s => s.trim()).filter(Boolean));
const rm = (n) => `RM ${Number(n).toLocaleString('en-MY')}`;
const LIVE = ['available', 'reserved'];

export function stickerUrl(car) {
  return car?.slug ? `${SITE_URL}/showroom/${car.slug}?src=sticker` : null;
}

function specRows(car) {
  const rows = [
    ['Year', car.year],
    ['Mileage', car.mileage != null && car.mileage !== '' ? `${Number(car.mileage).toLocaleString('en-MY')} km` : null],
    ['Transmission', car.transmission],
    ['Engine', car.engine_cc ? `${Number(car.engine_cc).toLocaleString('en-MY')} cc` : null],
    ['Fuel', car.fuel_type],
    ['Colour', car.colour || car.color],
    ['Body', car.body_type],
    ['Condition', car.condition ? car.condition[0].toUpperCase() + car.condition.slice(1) : null],
    ['Auction grade', car.auction_grade],
    ['Warranty', car.warranty_months ? `${car.warranty_months} months` : null],
  ];
  return rows.filter(([, v]) => v != null && v !== '');
}

export function WindowStickerSheet({ car, dealerName, scans, onClose }) {
  const open = !!car;
  useModalHistory(open, onClose);
  const [qr, setQr] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  useEffect(() => {
    setQr(null);
    const url = stickerUrl(car);
    if (!url) return;
    QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(null));
  }, [car]);
  if (!open) return null;

  const price = Number(car.selling_price || car.price) || 0;
  const monthly = price ? calcMonthly(price) : null;
  const photo = Array.isArray(car.images) && car.images[0] ? cdnImg(car.images[0], 1200, 80) : null;
  const title = [car.year, car.brand, car.model].filter(Boolean).join(' ');
  const feats = tags(car.features).slice(0, 12);
  const isLive = LIVE.includes(car.status || 'available');

  return createPortal(
    <div className="ws-root" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(17,24,39,.45)', backdropFilter: 'blur(4px)', overflowY: 'auto', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
          body > *:not(.ws-root) { display: none !important; }
          .ws-root { position: static !important; background: #fff !important; backdrop-filter: none !important; overflow: visible !important; }
          .ws-bar { display: none !important; }
          .ws-wrap { padding: 0 !important; display: block !important; }
          .ws-page { margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; width: 210mm !important; max-width: none !important; height: 296mm !important; padding: 14mm !important; overflow: hidden !important; }
          .ws-photo { aspect-ratio: 2 / 1 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="ws-bar" style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fff', boxShadow: PL.shadow }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: PL.text }}>Window sticker</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: PL.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {scans == null ? 'A4 page. Print it or save as PDF.' : `${scans} scan${scans === 1 ? '' : 's'} in the last 30 days`}
          </p>
        </div>
        <button onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#fff', background: PL.accent, border: 'none', borderRadius: PL.radius.row, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Printer style={{ width: 15, height: 15 }} /> Print
        </button>
        <button onClick={onClose} aria-label="Close" style={{ width: 38, height: 38, borderRadius: 999, border: 'none', background: PL.raised, color: PL.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {!isLive && (
        <p className="ws-bar" style={{ maxWidth: 794, margin: '12px auto 0', padding: '10px 14px', background: '#fff', borderRadius: PL.radius.row, fontSize: 12, color: PL.accentText }}>
          This car is not live, so the QR code will not open for buyers until you make it Available.
        </p>
      )}

      {/* The page: 210mm at 96dpi = 794px. Scales down on a phone. */}
      <div className="ws-wrap" style={{ padding: '16px 12px 40px', display: 'flex', justifyContent: 'center' }}>
        <div className="ws-page" style={{ width: '100%', maxWidth: 794, background: '#fff', borderRadius: 12, boxShadow: PL.shadow, padding: 'clamp(18px, 5vw, 44px)', boxSizing: 'border-box', color: '#111827' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, borderBottom: '2px solid #111827', paddingBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 'clamp(13px, 3vw, 16px)', fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' }}>{dealerName || 'Dealership'}</p>
            {car.stock_number || car.plate_number ? (
              <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>{car.plate_number || car.stock_number}</p>
            ) : null}
          </div>

          <h1 style={{ margin: '18px 0 2px', fontSize: 'clamp(24px, 6vw, 40px)', lineHeight: 1.1, fontWeight: 800 }}>{title}</h1>
          {car.variant && <p style={{ margin: 0, fontSize: 'clamp(14px, 3.4vw, 20px)', color: '#4b5563' }}>{car.variant}</p>}

          {photo && (
            <img className="ws-photo" src={photo} alt="" style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 10, margin: '16px 0 0', background: '#f3f4f6' }} />
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginTop: 18 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Price</p>
              <p style={{ margin: '2px 0 0', fontSize: 'clamp(30px, 8vw, 52px)', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{price ? rm(price) : 'Ask us'}</p>
              {monthly ? (
                <p style={{ margin: '8px 0 0', fontSize: 'clamp(13px, 3vw, 17px)', fontWeight: 600 }}>
                  about {rm(monthly)} a month*
                </p>
              ) : null}
            </div>
            {qr && (
              <div style={{ textAlign: 'center' }}>
                <img src={qr} alt="QR code to this car's page" style={{ width: 'clamp(96px, 24vw, 150px)', height: 'auto', display: 'block' }} />
                <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 600 }}>Scan for photos and to book a viewing</p>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0 24px', marginTop: 22 }}>
            {specRows(car).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid #e5e7eb', fontSize: 'clamp(12px, 2.8vw, 14px)' }}>
                <span style={{ color: '#6b7280' }}>{k}</span>
                <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>

          {feats.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Features</p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', columns: 'auto 180px', columnGap: 24, fontSize: 'clamp(12px, 2.8vw, 14px)' }}>
                {feats.map(f => <li key={f} style={{ padding: '3px 0', breakInside: 'avoid' }}>{f}</li>)}
              </ul>
            </div>
          )}

          {monthly ? (
            <p style={{ margin: '24px 0 0', fontSize: 10, color: '#6b7280', lineHeight: 1.45 }}>
              *Estimate only: 90% loan over 7 years at {DEFAULT_EIR}% a year (effective rate, reducing balance).
              Insurance and fees not included. The bank decides the loan and the rate.
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
