import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { getCategoryCfg } from "../../utils/serviceCategories";
import FinancingCalculator from "../../components/FinancingCalculator";
import {
  X,
  Check,
  Pencil,
  Video,
  Tag,
  Copy,
  Clipboard,
  UserPlus,
  CheckCircle2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Calculator,
  Gauge,
  Settings,
  Droplets,
  Palette,
  MapPin,
} from "lucide-react";

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw.split(/,|\n/).map(s => s.trim()).filter(Boolean);
}

const DRAWER_GRADE_COLORS = { S:'#a78bfa', 5:'#34d399', '4.5':'#6ee7b7', 4:'#fbbf24', '3.5':'#fb923c', 3:'#93c5fd', R:'#ef4444', RA:'#3b82f6', 2:'#1d4ed8', 1:'#1e3a8a' };
const DRAWER_DMG_COLORS   = { scratch:'#fbbf24', dent:'#93c5fd', crack:'#f43f5e', replaced:'#a78bfa' };

function DrawerDamageMap({ damageMap }) {
  const zones = Array.isArray(damageMap) ? damageMap : [];
  const byZone = {};
  zones.forEach(z => { byZone[z.zone] = z.type; });
  const fill   = z => byZone[z] ? DRAWER_DMG_COLORS[byZone[z]] + '44' : 'rgba(255,255,255,0.035)';
  const stroke = z => byZone[z] ? DRAWER_DMG_COLORS[byZone[z]]       : 'rgba(255,255,255,0.09)';
  return (
    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 16 }}>
      <svg viewBox="0 0 170 220" width={150} height={220} style={{ flexShrink: 0 }}>
        <rect x="42" y="6"   width="86" height="44" rx="6" fill={fill('hood')}        stroke={stroke('hood')}        strokeWidth="1.3"/>
        <text x="85" y="33"  textAnchor="middle" fontSize="10" fill="#9ca3af" fontFamily="DM Sans,sans-serif">Hood</text>
        <rect x="6"  y="6"   width="34" height="44" rx="5" fill={fill('front-left')}  stroke={stroke('front-left')}  strokeWidth="1.3"/>
        <text x="23" y="23"  textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="DM Sans,sans-serif">FL</text>
        <text x="23" y="34"  textAnchor="middle" fontSize="7" fill="#6b7280" fontFamily="DM Sans,sans-serif">Fender</text>
        <rect x="130" y="6"  width="34" height="44" rx="5" fill={fill('front-right')} stroke={stroke('front-right')} strokeWidth="1.3"/>
        <text x="147" y="23" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="DM Sans,sans-serif">FR</text>
        <text x="147" y="34" textAnchor="middle" fontSize="7" fill="#6b7280" fontFamily="DM Sans,sans-serif">Fender</text>
        <rect x="6"  y="54"  width="32" height="80" rx="4" fill={fill('left')}        stroke={stroke('left')}        strokeWidth="1.3"/>
        <text x="22" y="97"  textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="DM Sans,sans-serif" transform="rotate(-90,22,97)">Left</text>
        <rect x="132" y="54" width="32" height="80" rx="4" fill={fill('right')}       stroke={stroke('right')}       strokeWidth="1.3"/>
        <text x="148" y="97" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="DM Sans,sans-serif" transform="rotate(90,148,97)">Right</text>
        <rect x="40" y="54"  width="90" height="80" rx="4" fill={fill('roof')}        stroke={stroke('roof')}        strokeWidth="1.3"/>
        <text x="85" y="98"  textAnchor="middle" fontSize="11" fill="#9ca3af" fontFamily="DM Sans,sans-serif">Roof</text>
        <rect x="6"  y="138" width="32" height="36" rx="4" fill={fill('rear-left')}   stroke={stroke('rear-left')}   strokeWidth="1.3"/>
        <text x="22" y="155" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="DM Sans,sans-serif">RL</text>
        <text x="22" y="166" textAnchor="middle" fontSize="7" fill="#6b7280" fontFamily="DM Sans,sans-serif">Qtr</text>
        <rect x="132" y="138" width="32" height="36" rx="4" fill={fill('rear-right')} stroke={stroke('rear-right')} strokeWidth="1.3"/>
        <text x="148" y="155" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="DM Sans,sans-serif">RR</text>
        <text x="148" y="166" textAnchor="middle" fontSize="7" fill="#6b7280" fontFamily="DM Sans,sans-serif">Qtr</text>
        <rect x="40" y="138" width="90" height="36" rx="4" fill={fill('trunk')}       stroke={stroke('trunk')}       strokeWidth="1.3"/>
        <text x="85" y="161" textAnchor="middle" fontSize="11" fill="#9ca3af" fontFamily="DM Sans,sans-serif">Trunk</text>
        <text x="85" y="192" textAnchor="middle" fontSize="8" fill="#374151" fontFamily="DM Sans,sans-serif">▲ FRONT · REAR ▼</text>
      </svg>
      <div style={{ flex: 1, minWidth: 140 }}>
        <p style={{ fontSize: 10, color: '#374151', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Legend</p>
        {Object.entries(DRAWER_DMG_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <div style={{ width: 11, height: 11, borderRadius: 3, background: color + '44', border: `1.5px solid ${color}`, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#9ca3af', textTransform: 'capitalize' }}>{type}</span>
          </div>
        ))}
        <p style={{ fontSize: 10, color: '#374151', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '16px 0 10px' }}>Reported</p>
        {zones.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
            <span style={{ fontSize: 12, color: '#34d399' }}>No damage reported</span>
          </div>
        ) : zones.map((z, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: (DRAWER_DMG_COLORS[z.type] || '#9ca3af') + '44', border: `1.5px solid ${DRAWER_DMG_COLORS[z.type] || '#9ca3af'}`, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#6b7280' }}><span style={{ color: '#e5e5e5' }}>{z.zone}</span> — {z.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListingDetailDrawer({
  listing, salesmen, salesmenById, onClose, onUpdate, onDelete,
  setEditListing, setTiktokListing, setPriceEditListing, setMarkSoldListing,
  setDeleteId, copyListing, copiedListingId, handleAssign, handleUnassign,
  handleStatus, updatingStatus, getListingAge,
}) {
  const [imgIdx, setImgIdx]       = useState(0);
  const [lbOpen, setLbOpen]       = useState(false);
  const [drawerTab, setDrawerTab] = useState('specs');
  const [showAssign, setShowAssign] = useState(false);
  const [calcOpen,  setCalcOpen]  = useState(false);
  const [isMobile, setIsMobile]   = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const images = Array.isArray(listing.images) && listing.images.length > 0 ? listing.images : ['/placeholder-car.jpg'];
  const sp = listing.selling_price || listing.price || 0;
  const op = listing.original_price || listing.previous_price || null;
  const saving = op && op > sp ? op - sp : 0;
  const monthly = sp > 0 ? Math.round((sp * 0.9 * (1 + 3.5 / 100 * 7)) / (7 * 12)) : null;
  const pct = op && op > sp ? Math.round(((op - sp) / op) * 100) : 0;
  const gradeMeta = DRAWER_GRADE_COLORS[listing.auction_grade] || null;
  const intColor = { A:'#34d399', B:'#fbbf24', C:'#fb923c', D:'#93c5fd' }[listing.interior_grade] || '#9ca3af';
  let damageMap = [];
  try { if (listing.damage_map) damageMap = typeof listing.damage_map === 'string' ? JSON.parse(listing.damage_map) : listing.damage_map; } catch {}
  const features = parseTags(listing.features);
  const options  = parseTags(listing.options);
  const isSold   = listing.status === 'sold';
  const age      = getListingAge(listing.created_at);
  const sCfg = ({ available: { bg: 'rgba(74,222,128,0.12)', bd: 'rgba(74,222,128,0.3)', tx: '#4ade80', dot: '#4ade80' }, reserved: { bg: 'rgba(251,191,36,0.12)', bd: 'rgba(251,191,36,0.3)', tx: '#fbbf24', dot: '#fbbf24' }, sold: { bg: 'rgba(156,163,175,0.12)', bd: 'rgba(156,163,175,0.2)', tx: '#9ca3af', dot: '#9ca3af' } })[listing.status || 'available'] || { bg: 'rgba(74,222,128,0.12)', bd: 'rgba(74,222,128,0.3)', tx: '#4ade80', dot: '#4ade80' };

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { if (lbOpen) setLbOpen(false); else onClose(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lbOpen, onClose]);

  const tabs = ['specs', 'features', 'options', ...(listing.is_recon ? ['recon'] : [])];
  const tabLabel = { specs: 'Specifications', features: 'Features', options: 'Options', recon: 'Recon' };

  const btnBase = { width: '100%', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderRadius: 6, padding: '11px 14px', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'background 0.2s', border: '1px solid rgba(255,255,255,0.08)', fontFamily: "'DM Sans', sans-serif", color: '#9ca3af' };

  const specRows = [
    { k: 'Year',              v: listing.year || '—' },
    { k: 'Registration Date', v: listing.registration_date || '—' },
    { k: 'VIN',               v: listing.vin_number || '—' },
    { k: 'Condition',         v: listing.condition || '—' },
    { k: 'Chassis Status',    v: listing.chassis_status || '—', dot: true },
    { k: 'Location',          v: [listing.city, listing.state].filter(Boolean).join(', ') || '—' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', overflowY: 'auto' }}
        onClick={onClose}
      >
        {/* Panel */}
        <div
          style={{ position: 'relative', margin: isMobile ? 0 : '24px auto', maxWidth: isMobile ? '100vw' : 1100, width: isMobile ? '100vw' : 'calc(100vw - 48px)', height: isMobile ? '100dvh' : undefined, maxHeight: isMobile ? '100dvh' : 'calc(100vh - 48px)', background: 'rgba(11,11,15,0.99)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: isMobile ? 0 : 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, width: 36, height: 36, borderRadius: 6, background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025))', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>

          {/* Body */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0, overflowY: 'auto', flexDirection: isMobile ? 'column' : 'row' }}>
            {/* LEFT */}
            <div style={{ flex: 1, minWidth: 0, padding: isMobile ? 16 : 24, borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.08)', overflowY: isMobile ? 'visible' : 'auto' }}>

              {/* Gallery */}
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Thumb strip */}
                <div style={{ width: 64, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: isMobile ? 200 : 320, overflowY: 'auto' }}>
                  {images.map((img, i) => (
                    <div
                      key={i}
                      onClick={() => setImgIdx(i)}
                      style={{ width: 64, height: 48, borderRadius: 4, cursor: 'pointer', flexShrink: 0, background: '#0d0d0d', border: i === imgIdx ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', opacity: i === imgIdx ? 1 : 0.45, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                    </div>
                  ))}
                </div>
                {/* Main image */}
                <div style={{ flex: 1, position: 'relative', background: '#0d0d0d', borderRadius: 6, overflow: 'hidden', height: isMobile ? 200 : 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={images[imgIdx]}
                    alt=""
                    onClick={() => setLbOpen(true)}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'zoom-in', display: 'block' }}
                  />
                  {images.length > 1 && (
                    <>
                      <button onClick={e => { e.stopPropagation(); setImgIdx(i => (i - 1 + images.length) % images.length); }} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: 6, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronLeft style={{ width: 14, height: 14 }} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setImgIdx(i => (i + 1) % images.length); }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: 6, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronRight style={{ width: 14, height: 14 }} />
                      </button>
                    </>
                  )}
                  <button onClick={() => setLbOpen(true)} style={{ position: 'absolute', bottom: 8, right: 8, width: 28, height: 28, borderRadius: 6, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ZoomIn style={{ width: 13, height: 13 }} />
                  </button>
                  {images.length > 1 && (
                    <span style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 10, color: '#9ca3af', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 7px' }}>{imgIdx + 1} / {images.length}</span>
                  )}
                </div>
              </div>

              {/* Car header */}
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>{listing.brand}</p>
                <p style={{ fontSize: 22, fontWeight: 300, color: '#f3f4f6', margin: '4px 0 0', lineHeight: 1.2 }}>{listing.model}{listing.variant ? ` ${listing.variant}` : ''}</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '6px 0 0' }}>
                  {[listing.year, listing.body_type, listing.transmission, listing.fuel_type].filter(Boolean).join(' · ')}
                </p>
                {(listing.city || listing.state) && (
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin style={{ width: 11, height: 11 }} />
                    {[listing.city, listing.state].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              {/* Price row */}
              <div style={{ marginTop: 12 }}>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: '#f3f4f6', margin: 0, lineHeight: 1 }}>RM {sp.toLocaleString()}</p>
                {saving > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: '#374151', textDecoration: 'line-through' }}>RM {op.toLocaleString()}</span>
                    <span style={{ fontSize: 10, color: '#93c5fd', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 4, padding: '1px 6px' }}>SAVE RM {saving.toLocaleString()}</span>
                  </div>
                )}
                {monthly && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Est. RM {monthly.toLocaleString()}/mo · 90% loan · 7yr · 3.5% p.a.</p>}
              </div>

              {/* Specs strip */}
              <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', margin: '16px 0', padding: '12px 0', gap: 0, overflowX: 'auto' }}>
                {[
                  { Icon: Gauge,    label: 'Mileage',       value: listing.mileage ? `${Number(listing.mileage).toLocaleString()} km` : '—' },
                  { Icon: Settings, label: 'Engine',        value: listing.engine_cc ? `${Number(listing.engine_cc).toLocaleString()} cc` : '—' },
                  { Icon: ChevronRight, label: 'Transmission', value: listing.transmission || '—' },
                  { Icon: Droplets, label: 'Fuel',          value: listing.fuel_type || '—' },
                  { Icon: Palette,  label: 'Colour',        value: listing.colour || '—' },
                ].map(({ Icon, label, value }, i, arr) => (
                  <div key={label} style={{ flex: '1 0 80px', textAlign: 'center', padding: '0 12px', borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <Icon style={{ width: 13, height: 13, color: '#6b7280', marginBottom: 4 }} />
                    <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280', marginBottom: 3 }}>{label}</p>
                    <p style={{ fontSize: 13, color: '#f3f4f6' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
                {tabs.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDrawerTab(tab)}
                    style={{ padding: '8px 16px', fontSize: 12, color: drawerTab === tab ? '#f3f4f6' : '#6b7280', borderBottom: drawerTab === tab ? '2px solid #ef4444' : '2px solid transparent', background: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'color 0.15s' }}
                  >
                    {tabLabel[tab]}
                  </button>
                ))}
              </div>

              {/* Tab: Specifications */}
              {drawerTab === 'specs' && (
                <div>
                  {specRows.map(({ k, v, dot }) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{k}</span>
                      <span style={{ fontSize: 13, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {dot && v !== '—' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />}
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: Features */}
              {drawerTab === 'features' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {features.length === 0 ? <p style={{ fontSize: 13, color: '#6b7280' }}>No features listed.</p> : features.map((f, i) => (
                    <span key={i} style={{ fontSize: 12, color: '#9ca3af', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 10px' }}>{f}</span>
                  ))}
                </div>
              )}

              {/* Tab: Options */}
              {drawerTab === 'options' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {options.length === 0 ? <p style={{ fontSize: 13, color: '#6b7280' }}>No options listed.</p> : options.map((o, i) => (
                    <span key={i} style={{ fontSize: 12, color: '#9ca3af', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 10px' }}>{o}</span>
                  ))}
                </div>
              )}

              {/* Tab: Recon */}
              {drawerTab === 'recon' && listing.is_recon && (
                <div>
                  {gradeMeta && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.04)', border: `1px solid ${gradeMeta}25`, borderRadius: 6, padding: '10px 16px', marginBottom: 20 }}>
                      <div>
                        <p style={{ fontSize: 9, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Ext. Grade</p>
                        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: gradeMeta, lineHeight: 1 }}>{listing.auction_grade}</p>
                      </div>
                      {listing.interior_grade && (
                        <>
                          <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.08)' }} />
                          <div>
                            <p style={{ fontSize: 9, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Int. Grade</p>
                            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: intColor, lineHeight: 1 }}>{listing.interior_grade}</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {[
                    { k: 'Import Country', v: listing.import_country },
                    { k: 'Auction House',  v: listing.auction_house },
                    { k: 'Exterior Grade', v: listing.auction_grade },
                    { k: 'Interior Grade', v: listing.interior_grade },
                  ].filter(r => r.v).map(({ k, v }) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{k}</span>
                      <span style={{ fontSize: 13, color: '#9ca3af' }}>{v}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 20, marginBottom: 0 }}>Condition Map</p>
                  <DrawerDamageMap damageMap={damageMap} />
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div style={{ flex: isMobile ? 'none' : '0 0 200px', width: isMobile ? '100%' : undefined, padding: isMobile ? '12px 16px 24px' : 20, display: 'flex', flexDirection: 'column', gap: 0, borderTop: isMobile ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
              <div style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025))', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 18, display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr', gap: 8 }}>
                <p style={{ fontSize: 10, color: '#6b7280', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, gridColumn: isMobile ? '1 / -1' : undefined }}>Actions</p>

                {/* Edit */}
                <button onClick={() => { setEditListing(listing); }} style={{ ...btnBase, border: '1px solid rgba(56,189,248,0.25)', color: '#64b4ff' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                  <Pencil style={{ width: 14, height: 14, flexShrink: 0 }} />Edit Listing
                </button>

                {/* TikTok */}
                <button onClick={() => setTiktokListing(listing)} style={{ ...btnBase, border: '1px solid rgba(255,100,100,0.25)', color: '#ff6b6b' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                  <Video style={{ width: 14, height: 14, flexShrink: 0 }} />ShiftOS Studio
                </button>

                {/* Price */}
                <button onClick={() => setPriceEditListing(listing)} style={{ ...btnBase, border: '1px solid rgba(59,130,246,0.3)', color: '#ef4444' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                  <Tag style={{ width: 14, height: 14, flexShrink: 0 }} />Change Price
                </button>

                {/* Copy */}
                <button onClick={() => copyListing(listing)} style={{ ...btnBase, border: '1px solid rgba(139,195,74,0.25)', color: copiedListingId === listing.id ? '#4ade80' : '#8bc34a' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                  {copiedListingId === listing.id ? <Check style={{ width: 14, height: 14, flexShrink: 0 }} /> : <Clipboard style={{ width: 14, height: 14, flexShrink: 0 }} />}
                  {copiedListingId === listing.id ? 'Copied!' : 'Copy Writing'}
                </button>

                {/* Financing Calculator */}
                <button onClick={() => setCalcOpen(true)} style={{ ...btnBase, border: '1px solid rgba(59,130,246,0.25)', color: '#ef4444' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                  <Calculator style={{ width: 14, height: 14, flexShrink: 0 }} />Financing Calc
                </button>

                {/* Assign */}
                <div style={{ position: 'relative', gridColumn: isMobile ? '1 / -1' : undefined }}>
                  <button onClick={() => setShowAssign(v => !v)} style={{ ...btnBase, border: '1px solid rgba(100,180,255,0.25)', color: '#64b4ff' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                    <UserPlus style={{ width: 14, height: 14, flexShrink: 0 }} />Assign Salesman
                  </button>
                  {showAssign && (
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: 4, background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, boxShadow: '0 -8px 32px rgba(0,0,0,0.7)', zIndex: 60, overflow: 'hidden', padding: '4px 0' }}>
                      {listing.assigned_to && (
                        <button onClick={() => { handleUnassign(listing.id); setShowAssign(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>
                          <X style={{ width: 12, height: 12 }} />Unassign
                        </button>
                      )}
                      {salesmen.map(s => (
                        <button key={s.id} onClick={() => { handleAssign(listing.id, s.id, s.full_name); setShowAssign(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: listing.assigned_to === s.id ? 'rgba(168,85,247,0.1)' : 'none', border: 'none', color: listing.assigned_to === s.id ? '#c084fc' : '#d1d5db', fontSize: 12, cursor: 'pointer' }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{(s.full_name || 'S')[0].toUpperCase()}</div>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name || 'Unknown'}</span>
                          {listing.assigned_to === s.id && <Check style={{ width: 11, height: 11, marginLeft: 'auto', flexShrink: 0 }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mark Sold */}
                {!isSold && (
                  <button onClick={() => setMarkSoldListing(listing)} style={{ ...btnBase, border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                    <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} />Mark as Sold
                  </button>
                )}

                {/* Delete */}
                <button onClick={() => { setDeleteId(listing.id); onClose(); }} style={{ ...btnBase, border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.09)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}>
                  <Trash2 style={{ width: 14, height: 14, flexShrink: 0 }} />Delete Listing
                </button>

                {/* Metadata */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 12, marginTop: 4, gridColumn: isMobile ? '1 / -1' : undefined }}>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px' }}>Listed {age === 0 ? 'today' : `${age} day${age !== 1 ? 's' : ''} ago`}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: sCfg.dot, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: sCfg.tx, textTransform: 'capitalize' }}>{listing.status || 'available'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lbOpen && (
        <div
          onClick={() => setLbOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {/* Close */}
          <button
            onClick={() => setLbOpen(false)}
            style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e5e5e5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
          {/* Counter */}
          {images.length > 1 && (
            <span style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', fontSize: 12, color: '#9ca3af', background: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: '4px 12px' }}>
              {imgIdx + 1} / {images.length}
            </span>
          )}
          {/* Prev */}
          {images.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setImgIdx(i => (i - 1 + images.length) % images.length); }}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e5e5e5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft style={{ width: 22, height: 22 }} />
            </button>
          )}
          {/* Image */}
          <img
            src={images[imgIdx]}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 'calc(100vw - 120px)', maxHeight: '90vh', objectFit: 'contain', borderRadius: 4, display: 'block' }}
          />
          {/* Next */}
          {images.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setImgIdx(i => (i + 1) % images.length); }}
              style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e5e5e5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight style={{ width: 22, height: 22 }} />
            </button>
          )}
        </div>
      )}

      {/* Financing Calculator modal */}
      {calcOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setCalcOpen(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'DM Sans',sans-serif" }}
        >
          <div style={{ width: '100%', maxWidth: 860, background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <p style={{ color: 'white', fontWeight: 600, fontSize: 14, margin: '0 0 2px' }}>Financing &amp; Cost Calculator</p>
                <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>{listing.brand} {listing.model}{listing.variant ? ` ${listing.variant}` : ''}</p>
              </div>
              <button onClick={() => setCalcOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <FinancingCalculator
                initialPrice={listing.selling_price || listing.price}
                engineCc={listing.engine_cc}
                bodyType={listing.body_type}
                carName={`${listing.brand} ${listing.model}${listing.variant ? ` ${listing.variant}` : ''}`}
                carYear={listing.year ? String(listing.year) : ''}
                carColor={listing.colour || ''}
                flat
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ListingDetailDrawer;
