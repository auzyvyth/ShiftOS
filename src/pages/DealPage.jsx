import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function formatRM(n) {
  return 'RM ' + Number(n || 0).toLocaleString('en-MY');
}

function ExpiredView() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="24" height="24" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8, fontFamily: 'DM Sans, sans-serif' }}>This deal sheet has expired</h2>
        <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, fontFamily: 'DM Sans, sans-serif' }}>
          Deal sheets are valid for 1 hour. Ask your salesman to send you a fresh link, or save the PDF next time before it expires.
        </p>
      </div>
    </div>
  );
}

function ServiceIcon({ category }) {
  const icons = {
    protection:  '🛡',
    tint:        '🪟',
    window_tint: '🪟',
    warranty:    '📋',
    insurance:   '📑',
    road_tax:    '📄',
    service:     '🔧',
    accessories: '🎨',
    workshop:    '🔩',
    other:       '✦',
  };
  return <span style={{ fontSize: 14 }}>{icons[category] || '✦'}</span>;
}

export default function DealPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const presentMode = searchParams.get('present') === '1';
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [minsLeft, setMinsLeft] = useState(null);

  useEffect(() => {
    supabase.rpc('get_deal_by_token', { p_token: token }).then(({ data }) => {
      setDeal(data || null);
      if (data?.expires_at) {
        const mins = Math.round((new Date(data.expires_at) - Date.now()) / 60000);
        setMinsLeft(mins > 0 ? mins : 0);
      }
      setLoading(false);
    });
  }, [token]);

  useEffect(() => {
    if (!deal?.expires_at) return;
    const id = setInterval(() => {
      const mins = Math.round((new Date(deal.expires_at) - Date.now()) / 60000);
      setMinsLeft(mins > 0 ? mins : 0);
    }, 30000);
    return () => clearInterval(id);
  }, [deal?.expires_at]);

  const handlePrint = () => window.print();
  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!deal) return <ExpiredView />;

  const { car, dealer, addons = [], fees = {}, financing = null, car_price, addons_total, fees_total = 0, grand_total, generated_at, expires_at } = deal;
  const accentColor = dealer?.brand_color || '#dc2626';
  const mainImage = car?.images?.[0] || null;
  const includedServices = car?.included_services || [];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #f1f5f9; }
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .deal-card { box-shadow: none !important; border: none !important; }
          @page { margin: 16mm; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: presentMode ? '0' : '24px 16px 48px' }}>
        <div className="deal-card" style={{
          maxWidth: 680,
          margin: '0 auto',
          background: 'white',
          borderRadius: presentMode ? 0 : 20,
          overflow: 'hidden',
          boxShadow: presentMode ? 'none' : '0 4px 32px rgba(0,0,0,0.10)',
          minHeight: presentMode ? '100vh' : undefined,
        }}>

          {/* Dealer header */}
          <div style={{ background: accentColor, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: '-0.01em' }}>{dealer?.name || 'Dealership'}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Deal Sheet</p>
            </div>
            {dealer?.whatsapp && !presentMode && (
              <a
                href={`https://wa.me/${dealer.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="no-print"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '8px 14px', color: 'white', fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Contact Dealer
              </a>
            )}
          </div>

          {/* Car image */}
          {mainImage && (
            <div style={{ height: presentMode ? 320 : 240, overflow: 'hidden', background: '#f8fafc' }}>
              <img src={mainImage} alt={`${car.brand} ${car.model}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          <div style={{ padding: '24px 28px' }}>

            {/* Car title + price */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <div>
                <h1 style={{ fontSize: presentMode ? 28 : 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  {car?.year} {car?.brand} {car?.model}
                </h1>
                <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                  {car?.city && <span style={{ fontSize: 12, color: '#6b7280' }}>{car.city}{car.state ? `, ${car.state}` : ''}</span>}
                  {car?.mileage && <span style={{ fontSize: 12, color: '#6b7280' }}>· {Number(car.mileage).toLocaleString()} km</span>}
                  {car?.transmission && <span style={{ fontSize: 12, color: '#6b7280' }}>· {car.transmission}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: presentMode ? 26 : 20, fontWeight: 800, color: accentColor }}>{formatRM(car_price)}</p>
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Car price</p>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#f1f5f9', margin: '20px 0' }} />

            {/* Included services */}
            {includedServices.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>What's Included</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {includedServices.map((svc, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ServiceIcon category={svc.category} />
                      </div>
                      <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{svc.label || svc.name || svc.category}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: '#22c55e', fontWeight: 600 }}>Included</span>
                    </div>
                  ))}
                </div>
                <div style={{ height: 1, background: '#f1f5f9', margin: '20px 0' }} />
              </div>
            )}

            {/* Add-ons */}
            {addons.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Add-ons</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {addons.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ServiceIcon category={a.category} />
                        <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{a.name}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{formatRM(a.price)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Add-ons subtotal</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{formatRM(addons_total)}</span>
                </div>
                <div style={{ height: 1, background: '#f1f5f9', margin: '8px 0 20px' }} />
              </div>
            )}

            {/* Fees */}
            {(fees.road_tax > 0 || fees.insurance > 0 || fees.puspakom > 0) && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Fees & Registration</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {fees.road_tax > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>Road Tax</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{formatRM(fees.road_tax)}</span>
                    </div>
                  )}
                  {fees.insurance > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>Insurance</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{formatRM(fees.insurance)}</span>
                    </div>
                  )}
                  {fees.puspakom > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                      <span style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>Puspakom Inspection</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{formatRM(fees.puspakom)}</span>
                    </div>
                  )}
                </div>
                {fees_total > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', marginTop: 4 }}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>Fees subtotal</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{formatRM(fees_total)}</span>
                  </div>
                )}
                <div style={{ height: 1, background: '#f1f5f9', margin: '8px 0 20px' }} />
              </div>
            )}

            {/* Financing */}
            {financing && (
              <div style={{ marginBottom: 20, padding: '14px 16px', background: '#f5f3ff', borderRadius: 12, border: '1px solid #e9d5ff' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>HP Financing</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{financing.bank}</p>
                    <p style={{ fontSize: 12, color: '#6b7280' }}>
                      {financing.tenure_months}mo · {financing.annual_rate_pct}% p.a. · Loan {formatRM(financing.loan_amount)}
                    </p>
                  </div>
                  {financing.monthly_install > 0 && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: presentMode ? 24 : 20, fontWeight: 800, color: '#7c3aed' }}>
                        {formatRM(financing.monthly_install)}
                      </p>
                      <p style={{ fontSize: 11, color: '#9ca3af' }}>/ month (EIR)</p>
                    </div>
                  )}
                </div>
                {financing.status && (
                  <div style={{ marginTop: 10, display: 'inline-flex', padding: '2px 9px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                    background: ['approved','disbursed'].includes(financing.status) ? '#ecfdf5' : '#fffbeb',
                    color:      ['approved','disbursed'].includes(financing.status) ? '#059669' : '#d97706',
                    border: `1px solid ${['approved','disbursed'].includes(financing.status) ? '#a7f3d0' : '#fde68a'}` }}>
                    {financing.status.charAt(0).toUpperCase() + financing.status.slice(1)}
                  </div>
                )}
              </div>
            )}

            {/* Total */}
            <div style={{ background: accentColor, borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Package</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                  {fees_total > 0 ? 'Car + add-ons + fees' : 'Car + all add-ons'}
                </p>
              </div>
              <p style={{ fontSize: presentMode ? 32 : 26, fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>{formatRM(grand_total)}</p>
            </div>

            {/* Actions */}
            {!presentMode && (
              <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <button
                  onClick={handlePrint}
                  style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#111827', border: 'none', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Download PDF
                </button>
                <button
                  onClick={handleCopy}
                  style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#f1f5f9', border: '1px solid #e5e7eb', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            )}

            {/* Validity */}
            <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 }}>
              {minsLeft !== null && minsLeft > 0
                ? `This deal sheet expires in ${minsLeft} minute${minsLeft !== 1 ? 's' : ''}.`
                : minsLeft === 0
                ? 'This deal sheet has expired.'
                : null}
              {generated_at && (
                <> Generated {new Date(generated_at).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })} · {dealer?.name}</>
              )}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
