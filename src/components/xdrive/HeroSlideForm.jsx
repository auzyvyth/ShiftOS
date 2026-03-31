import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../../supabaseClient';

// ─── Constants ────────────────────────────────────────────────────────────────

const STAT_TYPES  = ['Price', 'Mileage', 'Year', 'Engine CC', 'Horsepower', 'Condition Grade', 'Custom'];
const BADGE_OPTS  = ['None', 'HOT DEAL', 'RARE FIND', 'NEW ARRIVAL'];
const TX_OPTS     = ['Auto', 'Manual', 'CVT', 'EV'];
const FUEL_OPTS   = ['Petrol', 'Diesel', 'Hybrid', 'Electric'];

const genId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const makeDefaultStats = () => [
  { id: genId(), type: 'Price',        value: '', unit: 'RM' },
  { id: genId(), type: 'Mileage',      value: '', unit: 'km' },
  { id: genId(), type: 'Year',         value: '', unit: ''   },
  { id: genId(), type: 'Transmission', value: '', unit: ''   },
];

// Shared input class (mirrors DashboardPage iCls)
const iCls = 'w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/20 transition-all';
const smlCls = 'bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/20 transition-all';

const Label = ({ children }) => (
  <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
    {children}
  </p>
);

const SectionHeading = ({ title, sub }) => (
  <div style={{ marginBottom: 14 }}>
    <p style={{ color: '#9ca3af', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', margin: 0 }}>{title}</p>
    {sub && <p style={{ color: '#4b5563', fontSize: 12, marginTop: 3 }}>{sub}</p>}
  </div>
);

const ErrMsg = ({ msg }) => msg ? (
  <p style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{msg}</p>
) : null;

// ─── Sortable stat row ────────────────────────────────────────────────────────

function SortableStat({ stat, onUpdate, onRemove, canRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stat.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        marginBottom: 7,
      }}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        style={{
          background: 'none', border: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          color: '#4b5563', padding: '4px 2px', flexShrink: 0,
          display: 'flex', alignItems: 'center', transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#9ca3af'}
        onMouseLeave={e => e.currentTarget.style.color = '#4b5563'}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5.5" cy="3.5" r="1.2"/><circle cx="10.5" cy="3.5" r="1.2"/>
          <circle cx="5.5" cy="8"   r="1.2"/><circle cx="10.5" cy="8"   r="1.2"/>
          <circle cx="5.5" cy="12.5" r="1.2"/><circle cx="10.5" cy="12.5" r="1.2"/>
        </svg>
      </button>

      {/* Type */}
      <select
        value={stat.type}
        onChange={e => onUpdate(stat.id, 'type', e.target.value)}
        className={smlCls}
        style={{ flex: '0 0 138px' }}
      >
        {STAT_TYPES.map(t => (
          <option key={t} value={t} style={{ background: '#111118' }}>{t}</option>
        ))}
      </select>

      {/* Value */}
      <input
        value={stat.value}
        onChange={e => onUpdate(stat.id, 'value', e.target.value)}
        placeholder="Value"
        className={smlCls}
        style={{ flex: 1, minWidth: 0 }}
      />

      {/* Unit */}
      <input
        value={stat.unit}
        onChange={e => onUpdate(stat.id, 'unit', e.target.value)}
        placeholder="Unit"
        className={smlCls}
        style={{ flex: '0 0 60px' }}
      />

      {/* Remove */}
      <button
        onClick={() => canRemove && onRemove(stat.id)}
        disabled={!canRemove}
        style={{
          background: 'none', border: 'none', flexShrink: 0,
          cursor: canRemove ? 'pointer' : 'not-allowed',
          color: canRemove ? '#4b5563' : '#1f2937',
          padding: '4px', borderRadius: 6,
          display: 'flex', alignItems: 'center', transition: 'color 0.15s',
        }}
        onMouseEnter={e => canRemove && (e.currentTarget.style.color = '#f87171')}
        onMouseLeave={e => { e.currentTarget.style.color = canRemove ? '#4b5563' : '#1f2937'; }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Main form component ──────────────────────────────────────────────────────

export default function HeroSlideForm({ slide, userId, profile, slideCount, onClose, onSave }) {
  const isEdit = !!slide;

  const [sourceTab,        setSourceTab]        = useState('listings');
  const [dealerListings,   setDealerListings]   = useState([]);
  const [selectedId,       setSelectedId]       = useState('');
  const [listingSearch,    setListingSearch]    = useState('');
  const [loadingListings,  setLoadingListings]  = useState(false);
  const [imageOverride,    setImageOverride]    = useState(false);
  const [attempted,        setAttempted]        = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [generalError,     setGeneralError]     = useState('');

  const [form, setForm] = useState({
    car_name:        slide?.car_name        || '',
    year:            slide?.year            ? String(slide.year) : '',
    transmission:    slide?.transmission    || 'Auto',
    fuel_type:       slide?.fuel_type       || 'Petrol',
    badge:           slide?.badge           || 'None',
    whatsapp_number: slide?.whatsapp_number || profile?.whatsapp_number || '',
    image_url:       slide?.image_url       || '',
    stats: slide?.stats?.length
      ? slide.stats.map(s => ({ ...s, id: s.id || genId(), value: s.value ?? '', unit: s.unit ?? '' }))
      : makeDefaultStats(),
  });

  // Fetch dealer's listings on mount
  useEffect(() => {
    if (!userId) return;
    setLoadingListings(true);
    supabase
      .from('car_listings')
      .select('id, brand, model, year, selling_price, images, mileage, engine_cc, horsepower, transmission, fuel_type')
      .eq('dealer_id', userId)
      .neq('status', 'sold')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDealerListings(data || []);
        setLoadingListings(false);
      });
  }, [userId]);

  // dnd-kit sensors for stat rows
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Stat helpers ──────────────────────────────────────────────────────────

  const handleStatDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = form.stats.findIndex(s => s.id === active.id);
    const newIdx = form.stats.findIndex(s => s.id === over.id);
    setForm(f => ({ ...f, stats: arrayMove(f.stats, oldIdx, newIdx) }));
  };

  const updateStat = (id, field, value) =>
    setForm(f => ({ ...f, stats: f.stats.map(s => s.id === id ? { ...s, [field]: value } : s) }));

  const removeStat = (id) => {
    if (form.stats.length <= 4) return;
    setForm(f => ({ ...f, stats: f.stats.filter(s => s.id !== id) }));
  };

  const addStat = () => {
    if (form.stats.length >= 6) return;
    setForm(f => ({ ...f, stats: [...f.stats, { id: genId(), type: 'Custom', value: '', unit: '' }] }));
  };

  // ── Listing selection ──────────────────────────────────────────────────────

  const handleListingSelect = (listingId) => {
    const listing = dealerListings.find(l => l.id === listingId);
    if (!listing) return;
    setSelectedId(listingId);

    const img = Array.isArray(listing.images) ? listing.images[0] || '' : '';

    // Build stats from listing data — filter out blank values, then pad to min 4
    const rawStats = [
      { id: genId(), type: 'Price',       value: listing.selling_price ? Number(listing.selling_price).toLocaleString() : '', unit: 'RM' },
      { id: genId(), type: 'Mileage',     value: listing.mileage     ? Number(listing.mileage).toLocaleString()    : '', unit: 'km' },
      { id: genId(), type: 'Year',        value: listing.year        ? String(listing.year)                        : '', unit: ''   },
      { id: genId(), type: 'Engine CC',   value: listing.engine_cc   ? Number(listing.engine_cc).toLocaleString()  : '', unit: 'cc' },
      { id: genId(), type: 'Horsepower',  value: listing.horsepower  ? String(listing.horsepower)                  : '', unit: 'hp' },
      { id: genId(), type: 'Condition Grade', value: '', unit: '' },
    ].filter(s => s.value !== '');

    while (rawStats.length < 4) {
      rawStats.push({ id: genId(), type: 'Custom', value: '', unit: '' });
    }

    const autoStats = rawStats.slice(0, 6).map(s => ({
      ...s,
      value: s.value ?? '',
      unit:  s.unit  ?? '',
    }));

    setForm(f => ({
      ...f,
      car_name:     `${listing.brand || ''} ${listing.model || ''}`.trim(),
      year:         String(listing.year || ''),
      transmission: listing.transmission || f.transmission,
      fuel_type:    listing.fuel_type    || f.fuel_type,
      image_url:    img,
      stats:        autoStats,
    }));
    setImageOverride(false);
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = () => {
    const e = {};
    if (!form.car_name.trim())   e.car_name   = 'Car name is required';
    if (!form.year)              e.year       = 'Year is required';
    if (!form.image_url.trim())  e.image_url  = 'Image URL is required';
    const filled = form.stats.filter(s => s.value.trim());
    if (filled.length < 4)      e.stats      = 'Fill in at least 4 stat values';
    return e;
  };

  const errors   = attempted ? validate() : {};
  const isValid  = Object.keys(validate()).length === 0;

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setAttempted(true);
    if (!isValid) return;

    setSaving(true);
    setGeneralError('');

    const payload = {
      dealer_id:       userId,
      car_name:        form.car_name.trim(),
      year:            parseInt(form.year) || null,
      transmission:    form.transmission,
      fuel_type:       form.fuel_type,
      badge:           form.badge === 'None' ? null : form.badge,
      whatsapp_number: form.whatsapp_number.trim(),
      image_url:       form.image_url.trim(),
      stats:           form.stats,
    };

    let result, err;

    if (isEdit) {
      ({ data: result, error: err } = await supabase
        .from('hero_carousel_slides')
        .update(payload)
        .eq('id', slide.id)
        .eq('dealer_id', userId)
        .select()
        .single());
    } else {
      ({ data: result, error: err } = await supabase
        .from('hero_carousel_slides')
        .insert({ ...payload, sort_order: slideCount, active: true })
        .select()
        .single());
    }

    setSaving(false);
    if (err) { setGeneralError(err.message); return; }
    onSave(result);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const currentYear = new Date().getFullYear();
  const filteredListings = listingSearch.trim()
    ? dealerListings.filter(l =>
        `${l.brand || ''} ${l.model || ''} ${l.year || ''}`.toLowerCase().includes(listingSearch.toLowerCase())
      )
    : dealerListings;

  const showImageInput = sourceTab === 'manual' || imageOverride || !selectedId || !form.image_url;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: 16, backdropFilter: 'blur(4px)',
        fontFamily: "'DM Sans',sans-serif",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          position: 'relative', width: '100%', maxWidth: 600, maxHeight: '92vh',
          background: 'rgba(11,11,15,0.98)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 0 0 1px rgba(220,38,38,0.07), 0 32px 64px rgba(0,0,0,0.72)',
          borderRadius: 16, display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg,transparent 8%,rgba(220,38,38,0.55) 38%,rgba(56,189,248,0.38) 68%,transparent 92%)',
          borderRadius: '16px 16px 0 0', pointerEvents: 'none', zIndex: 2,
        }} />

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)',
          flexShrink: 0,
        }}>
          <div>
            <h3 style={{ color: 'white', fontWeight: 600, fontSize: 16, margin: 0 }}>
              {isEdit ? 'Edit Slide' : 'New Slide'}
            </h3>
            <p style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
              {isEdit ? 'Update this hero carousel slide' : 'Add a car to your homepage spotlight'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6b7280', padding: '5px', borderRadius: 7,
              display: 'flex', transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'white'}
            onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '22px 22px 8px' }}>

          {/* ════════ SECTION 1: Car Selection ════════ */}
          <div style={{ marginBottom: 28 }}>
            <SectionHeading title="Car Selection" />

            {/* Tab toggle */}
            <div style={{
              display: 'flex', background: 'rgba(255,255,255,0.04)',
              borderRadius: 11, padding: 3, marginBottom: 16,
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              {[
                { id: 'listings', label: 'From Listings' },
                { id: 'manual',   label: 'Manual Entry'  },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setSourceTab(id)}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 9,
                    fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: sourceTab === id ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'none',
                    color: sourceTab === id ? 'white' : '#6b7280',
                    boxShadow: sourceTab === id ? '0 2px 8px rgba(220,38,38,0.22)' : 'none',
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Listings picker */}
            {sourceTab === 'listings' && (
              <div>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <div style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: '#4b5563', pointerEvents: 'none',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="11" cy="11" r="8"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </div>
                  <input
                    value={listingSearch}
                    onChange={e => setListingSearch(e.target.value)}
                    placeholder="Search listings…"
                    className={iCls}
                    style={{ paddingLeft: '2.2rem' }}
                  />
                </div>

                {loadingListings ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0' }}>
                    <div className="w-5 h-5 border-2 border-white/10 border-t-red-500 rounded-full animate-spin" />
                  </div>
                ) : filteredListings.length === 0 ? (
                  <p style={{ color: '#4b5563', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                    {dealerListings.length === 0 ? 'No active listings found' : 'No matches'}
                  </p>
                ) : (
                  <div style={{
                    maxHeight: 210, overflowY: 'auto',
                    borderRadius: 11, border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    {filteredListings.map((l, i) => (
                      <button
                        key={l.id}
                        onClick={() => handleListingSelect(l.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', background: selectedId === l.id
                            ? 'rgba(220,38,38,0.1)' : 'none',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                          borderBottom: i < filteredListings.length - 1
                            ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          transition: 'background 0.12s', fontFamily: "'DM Sans',sans-serif",
                        }}
                        onMouseEnter={e => { if (selectedId !== l.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={e => { if (selectedId !== l.id) e.currentTarget.style.background = 'none'; }}
                      >
                        {Array.isArray(l.images) && l.images[0] ? (
                          <img src={l.images[0]} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 34, height: 34, borderRadius: 6, background: 'rgba(255,255,255,0.05)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h10l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
                              <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
                            </svg>
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: 'white', fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {l.year} {l.brand} {l.model}
                          </p>
                          {l.selling_price && (
                            <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>
                              RM {Number(l.selling_price).toLocaleString()}
                            </p>
                          )}
                        </div>
                        {selectedId === l.id && (
                          <div style={{ color: '#dc2626', flexShrink: 0 }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ════════ SECTION 2: Car Details ════════ */}
          <div style={{ marginBottom: 28 }}>
            <SectionHeading title="Car Details" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Car Name */}
              <div>
                <Label>Car Name *</Label>
                <input
                  value={form.car_name}
                  onChange={e => setForm(f => ({ ...f, car_name: e.target.value }))}
                  placeholder="e.g. Honda Civic FC"
                  className={iCls}
                  style={errors.car_name ? { borderColor: 'rgba(220,38,38,0.5)' } : {}}
                />
                <ErrMsg msg={errors.car_name} />
              </div>

              {/* Year */}
              <div>
                <Label>Year *</Label>
                <input
                  type="number"
                  value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  min={1990}
                  max={currentYear + 1}
                  placeholder={String(currentYear)}
                  className={iCls}
                  style={errors.year ? { borderColor: 'rgba(220,38,38,0.5)' } : {}}
                />
                <ErrMsg msg={errors.year} />
              </div>

              {/* Transmission + Fuel */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <Label>Transmission</Label>
                  <select
                    value={form.transmission}
                    onChange={e => setForm(f => ({ ...f, transmission: e.target.value }))}
                    className={iCls}
                  >
                    {TX_OPTS.map(o => <option key={o} value={o} style={{ background: '#111118' }}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Fuel Type</Label>
                  <select
                    value={form.fuel_type}
                    onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}
                    className={iCls}
                  >
                    {FUEL_OPTS.map(o => <option key={o} value={o} style={{ background: '#111118' }}>{o}</option>)}
                  </select>
                </div>
              </div>

              {/* Badge */}
              <div>
                <Label>Badge</Label>
                <select
                  value={form.badge}
                  onChange={e => setForm(f => ({ ...f, badge: e.target.value }))}
                  className={iCls}
                >
                  {BADGE_OPTS.map(o => <option key={o} value={o} style={{ background: '#111118' }}>{o}</option>)}
                </select>
              </div>

              {/* WhatsApp */}
              <div>
                <Label>WhatsApp Number</Label>
                <input
                  value={form.whatsapp_number}
                  onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))}
                  placeholder="+60123456789"
                  className={iCls}
                />
              </div>
            </div>
          </div>

          {/* ════════ SECTION 3: Car Image ════════ */}
          <div style={{ marginBottom: 28 }}>
            <SectionHeading title="Car Image" />

            {/* From-listing image preview with Change option */}
            {!showImageInput ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 120, height: 80, borderRadius: 10, overflow: 'hidden',
                  flexShrink: 0, border: '1px solid rgba(255,255,255,0.07)',
                }}>
                  <img
                    src={form.image_url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={e => { e.target.style.opacity = '0'; }}
                  />
                </div>
                <div>
                  <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8 }}>Using listing image</p>
                  <button
                    onClick={() => setImageOverride(true)}
                    style={{
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8, color: '#9ca3af', padding: '6px 14px', fontSize: 13,
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'DM Sans',sans-serif",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <input
                  value={form.image_url}
                  onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://example.com/car.jpg"
                  className={iCls}
                  style={errors.image_url ? { borderColor: 'rgba(220,38,38,0.5)' } : {}}
                />
                <ErrMsg msg={errors.image_url} />
                {form.image_url && (
                  <div style={{
                    height: 120, borderRadius: 10, overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.07)', marginTop: 10,
                  }}>
                    <img
                      src={form.image_url}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ════════ SECTION 4: Specs & Stats ════════ */}
          <div style={{ marginBottom: 8 }}>
            <SectionHeading
              title="Specs & Stats"
              sub="Minimum 4, maximum 6. Drag to reorder."
            />

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleStatDragEnd}
            >
              <SortableContext
                items={form.stats.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {form.stats.map(stat => (
                  <SortableStat
                    key={stat.id}
                    stat={stat}
                    onUpdate={updateStat}
                    onRemove={removeStat}
                    canRemove={form.stats.length > 4}
                  />
                ))}
              </SortableContext>
            </DndContext>

            <ErrMsg msg={errors.stats} />

            {/* Add stat */}
            <button
              onClick={addStat}
              disabled={form.stats.length >= 6}
              style={{
                background: 'none',
                border: `1px dashed ${form.stats.length >= 6 ? 'rgba(255,255,255,0.06)' : 'rgba(220,38,38,0.3)'}`,
                borderRadius: 10, width: '100%', marginTop: 6, padding: '8px 0',
                color: form.stats.length >= 6 ? '#1f2937' : '#ef4444',
                fontSize: 13, fontWeight: 600,
                cursor: form.stats.length >= 6 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'background 0.15s', fontFamily: "'DM Sans',sans-serif",
              }}
              onMouseEnter={e => { if (form.stats.length < 6) e.currentTarget.style.background = 'rgba(220,38,38,0.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              + Add Stat
            </button>
          </div>

          {/* General error */}
          {generalError && (
            <div style={{
              color: '#f87171', fontSize: 13, marginTop: 16,
              background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: 9, padding: '10px 14px',
            }}>
              {generalError}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', gap: 10, padding: '16px 22px',
          borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'none', color: '#9ca3af', fontSize: 14,
              cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: "'DM Sans',sans-serif",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (attempted && !isValid)}
            style={{
              flex: 2, padding: '10px', borderRadius: 12, border: 'none',
              background: (saving || (attempted && !isValid))
                ? 'rgba(220,38,38,0.35)'
                : 'linear-gradient(135deg,#dc2626,#b91c1c)',
              boxShadow: (saving || (attempted && !isValid)) ? 'none' : '0 2px 10px rgba(220,38,38,0.28)',
              color: 'white', fontSize: 14, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.15s', fontFamily: "'DM Sans',sans-serif",
            }}
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Save Slide
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
