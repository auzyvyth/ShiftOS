import React, { useState, useEffect, useRef } from 'react';
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

const STAT_TYPES = ['Price', 'Mileage', 'Year', 'Engine CC', 'Horsepower', 'Condition Grade', 'Custom'];
const BADGE_OPTS = ['HOT DEAL', 'RARE FIND', 'NEW ARRIVAL'];
const TX_OPTS    = ['Auto', 'Manual', 'CVT', 'EV'];
const FUEL_OPTS  = ['Petrol', 'Diesel', 'Hybrid', 'Electric'];

const BADGE_STYLES = {
  'HOT DEAL':    { bg: 'rgba(220,38,38,0.15)',  border: 'rgba(220,38,38,0.3)',  color: '#f87171' },
  'RARE FIND':   { bg: 'rgba(124,58,237,0.15)', border: 'rgba(124,58,237,0.3)', color: '#a78bfa' },
  'NEW ARRIVAL': { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', color: '#34d399' },
};

const genId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const makeDefaultStats = () => [
  { id: genId(), type: 'Price',     value: '', unit: 'RM' },
  { id: genId(), type: 'Mileage',   value: '', unit: 'km' },
  { id: genId(), type: 'Year',      value: '', unit: ''   },
  { id: genId(), type: 'Engine CC', value: '', unit: ''   },
];

const iCls = 'w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/20 transition-all';
const smlCls = 'bg-white/[0.05] border border-white/10 rounded-xl px-2.5 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/20 transition-all';

const Label = ({ children }) => (
  <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest mb-1.5 mt-0">{children}</p>
);

const ErrMsg = ({ msg }) => msg ? (
  <p className="text-red-400 text-xs mt-1">{msg}</p>
) : null;

// ─── Sortable stat row ────────────────────────────────────────────────────────

function SortableStat({ stat, onUpdate, onRemove, canRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stat.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-2 mb-2"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 text-gray-700 hover:text-gray-400 transition-colors p-1"
        style={{ background: 'none', border: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5.5" cy="3.5" r="1.2"/><circle cx="10.5" cy="3.5" r="1.2"/>
          <circle cx="5.5" cy="8"   r="1.2"/><circle cx="10.5" cy="8"   r="1.2"/>
          <circle cx="5.5" cy="12.5" r="1.2"/><circle cx="10.5" cy="12.5" r="1.2"/>
        </svg>
      </button>

      {/* Type */}
      <select
        value={stat.type}
        onChange={e => onUpdate(stat.id, 'type', e.target.value)}
        className={smlCls + ' flex-shrink-0 w-24 sm:w-32'}
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
        className={smlCls + ' flex-1 min-w-0'}
      />

      {/* Unit */}
      <input
        value={stat.unit}
        onChange={e => onUpdate(stat.id, 'unit', e.target.value)}
        placeholder="Unit"
        className={smlCls + ' flex-shrink-0 w-12'}
      />

      {/* Remove */}
      <button
        onClick={() => canRemove && onRemove(stat.id)}
        disabled={!canRemove}
        className={`flex-shrink-0 p-1 rounded transition-colors ${canRemove ? 'text-gray-600 hover:text-red-400 cursor-pointer' : 'text-gray-800 cursor-not-allowed'}`}
        style={{ background: 'none', border: 'none' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HeroSlideForm({ slide, userId, profile, slideCount, onClose, onSave }) {
  const isEdit = !!slide;

  const [dealerListings,  setDealerListings]  = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [filteredResults, setFilteredResults] = useState([]);
  const [showDropdown,    setShowDropdown]    = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [imageOverride,   setImageOverride]   = useState(false);
  const [attempted,       setAttempted]       = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [generalError,    setGeneralError]    = useState('');

  const debounceRef = useRef(null);
  const dropdownRef = useRef(null);

  const [form, setForm] = useState({
    car_listing_id:  slide?.car_listing_id  || '',
    car_name:        slide?.car_name        || '',
    year:            slide?.year            ? String(slide.year) : '',
    transmission:    slide?.transmission    || 'Auto',
    fuel_type:       slide?.fuel_type       || 'Petrol',
    badge:           slide?.badge           || null,
    whatsapp_number: slide?.whatsapp_number || profile?.whatsapp_number || '+60',
    image_url:       slide?.image_url       || '',
    listing_url:     slide?.listing_url     || '',
    active:          slide?.active          ?? true,
    stats: slide?.stats?.length
      ? slide.stats.map(s => ({ ...s, id: s.id || genId(), value: s.value ?? '', unit: s.unit ?? '' }))
      : makeDefaultStats(),
  });

  // ── Fetch dealer listings ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    setLoadingListings(true);
    supabase
      .from('car_listings')
      .select('id, slug, brand, model, year, selling_price, images, mileage, engine_cc, transmission, fuel_type')
      .eq('dealer_id', userId)
      .neq('status', 'sold')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDealerListings(data || []);
        setFilteredResults(data || []);
        setLoadingListings(false);
      });
  }, [userId]);

  // ── Close dropdown on outside click ───────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── dnd-kit sensors ───────────────────────────────────────────────────────
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

  // ── Debounced search ──────────────────────────────────────────────────────
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = value.trim().toLowerCase();
      setFilteredResults(
        q ? dealerListings.filter(l =>
          `${l.brand || ''} ${l.model || ''} ${l.year || ''}`.toLowerCase().includes(q)
        ) : dealerListings
      );
      setShowDropdown(true);
    }, 300);
  };

  // ── Select listing ────────────────────────────────────────────────────────
  const handleListingSelect = (listing) => {
    setSelectedListing(listing);
    setSearchQuery(`${listing.year} ${listing.brand} ${listing.model}`);
    setShowDropdown(false);

    const img = Array.isArray(listing.images) ? listing.images[0] || '' : '';

    setForm(f => ({
      ...f,
      car_listing_id:  listing.id,
      car_name:        `${listing.year} ${listing.brand} ${listing.model}`,
      year:            String(listing.year || ''),
      transmission:    listing.transmission || f.transmission,
      fuel_type:       listing.fuel_type    || f.fuel_type,
      image_url:       img,
      listing_url:     listing.slug ? `/cars/${listing.slug}` : '',
      stats: [
        { id: genId(), type: 'Price',     unit: 'RM', value: listing.selling_price ? String(listing.selling_price) : '' },
        { id: genId(), type: 'Mileage',   unit: 'km', value: listing.mileage       ? String(listing.mileage)       : '' },
        { id: genId(), type: 'Year',      unit: '',   value: listing.year           ? String(listing.year)          : '' },
        { id: genId(), type: 'Engine CC', unit: '',   value: listing.engine_cc      ? String(listing.engine_cc)     : '' },
      ],
    }));
    setImageOverride(false);
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.car_name.trim())  e.car_name  = 'Car name is required';
    if (!form.year)             e.year      = 'Year is required';
    if (!form.image_url.trim()) e.image_url = 'Image URL is required';
    const filled = form.stats.filter(s => String(s.value).trim());
    if (filled.length < 4)     e.stats     = 'Fill in at least 4 stat values';
    return e;
  };

  const errors  = attempted ? validate() : {};
  const isValid = Object.keys(validate()).length === 0;

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setAttempted(true);
    if (!isValid) return;
    setSaving(true);
    setGeneralError('');

    const payload = {
      dealer_id:       userId,
      car_listing_id:  form.car_listing_id || null,
      car_name:        form.car_name.trim(),
      year:            parseInt(form.year) || null,
      transmission:    form.transmission,
      fuel_type:       form.fuel_type,
      badge:           form.badge || null,
      whatsapp_number: form.whatsapp_number.trim(),
      image_url:       form.image_url.trim(),
      listing_url:     form.listing_url.trim() || null,
      active:          form.active,
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
        .insert({ ...payload, sort_order: slideCount })
        .select()
        .single());
    }

    setSaving(false);
    if (err) { setGeneralError(err.message); return; }
    onSave(result);
  };

  const showImageManual = imageOverride || !form.image_url || !selectedListing;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)', fontFamily: "'DM Sans',sans-serif" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full sm:max-w-lg flex flex-col rounded-t-2xl sm:rounded-2xl"
        style={{
          maxHeight: '92vh',
          background: 'rgba(11,11,15,0.98)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 0 0 1px rgba(220,38,38,0.07), 0 32px 64px rgba(0,0,0,0.72)',
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none z-10 rounded-t-2xl"
          style={{ background: 'linear-gradient(90deg,transparent 8%,rgba(220,38,38,0.55) 38%,rgba(56,189,248,0.38) 68%,transparent 92%)' }}
        />

        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div>
            <h3 className="text-white font-semibold text-base m-0">
              {isEdit ? 'Edit Slide' : 'New Slide'}
            </h3>
            <p className="text-gray-500 text-xs mt-0.5 m-0">
              {isEdit ? 'Update this hero carousel slide' : 'Add a car to your homepage spotlight'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg flex items-center"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-7">

          {/* ════ STEP 1: Search listings ════ */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                style={{ background: '#dc2626' }}
              >1</span>
              <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest m-0">Search Your Listings</p>
            </div>

            <div className="relative" ref={dropdownRef}>
              {/* Search input */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>
                <input
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => {
                    setFilteredResults(
                      searchQuery.trim()
                        ? dealerListings.filter(l =>
                            `${l.brand || ''} ${l.model || ''} ${l.year || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                        : dealerListings
                    );
                    setShowDropdown(true);
                  }}
                  placeholder="Search by brand, model or year…"
                  className={iCls}
                  style={{ paddingLeft: '2.25rem' }}
                  autoComplete="off"
                />
                {loadingListings && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-3.5 h-3.5 border-2 border-white/10 border-t-red-500 rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Dropdown results */}
              {showDropdown && !loadingListings && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 rounded-xl z-50 overflow-hidden"
                  style={{
                    maxHeight: 220, overflowY: 'auto',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(11,11,15,0.98)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                >
                  {filteredResults.length === 0 ? (
                    <p className="text-gray-600 text-sm text-center py-4 m-0">
                      {dealerListings.length === 0 ? 'No active listings found' : 'No matches'}
                    </p>
                  ) : (
                    filteredResults.map((l, i) => (
                      <button
                        key={l.id}
                        onMouseDown={() => handleListingSelect(l)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                        style={{
                          background: selectedListing?.id === l.id ? 'rgba(220,38,38,0.08)' : 'none',
                          border: 'none',
                          borderBottom: i < filteredResults.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                        }}
                        onMouseEnter={e => { if (selectedListing?.id !== l.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        onMouseLeave={e => { if (selectedListing?.id !== l.id) e.currentTarget.style.background = 'none'; }}
                      >
                        {Array.isArray(l.images) && l.images[0] ? (
                          <img src={l.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-700"
                            style={{ background: 'rgba(255,255,255,0.05)' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h10l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
                              <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold m-0 truncate">{l.year} {l.brand} {l.model}</p>
                          {l.selling_price && (
                            <p className="text-gray-500 text-xs m-0">RM {Number(l.selling_price).toLocaleString()}</p>
                          )}
                        </div>
                        {selectedListing?.id === l.id && (
                          <div className="text-red-500 flex-shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected car preview pill */}
            {selectedListing && (
              <div
                className="mt-3 p-3 rounded-xl flex items-center gap-3"
                style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}
              >
                {form.image_url && (
                  <img
                    src={form.image_url} alt=""
                    className="w-14 h-10 rounded-lg object-cover flex-shrink-0"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold m-0 truncate">{form.car_name}</p>
                  <p className="text-gray-500 text-xs m-0">{form.transmission} · {form.fuel_type}</p>
                </div>
                <div className="text-red-500 flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* ════ STEP 2: Customize ════ */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span
                className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                style={{ background: '#dc2626' }}
              >2</span>
              <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest m-0">Customize</p>
            </div>

            <div className="space-y-4">

              {/* Car Name + Year */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label>Car Name *</Label>
                  <input
                    value={form.car_name}
                    onChange={e => setForm(f => ({ ...f, car_name: e.target.value }))}
                    placeholder="e.g. 2022 Honda Civic FC"
                    className={iCls}
                    style={errors.car_name ? { borderColor: 'rgba(220,38,38,0.5)' } : {}}
                  />
                  <ErrMsg msg={errors.car_name} />
                </div>
                <div>
                  <Label>Year *</Label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                    min={1990}
                    max={new Date().getFullYear() + 1}
                    placeholder="2022"
                    className={iCls}
                    style={errors.year ? { borderColor: 'rgba(220,38,38,0.5)' } : {}}
                  />
                  <ErrMsg msg={errors.year} />
                </div>
              </div>

              {/* Transmission + Fuel */}
              <div className="grid grid-cols-2 gap-3">
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

              {/* Badge chips */}
              <div>
                <Label>Badge</Label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setForm(f => ({ ...f, badge: null }))}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: !form.badge ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${!form.badge ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)'}`,
                      color: !form.badge ? 'white' : '#6b7280',
                      cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    None
                  </button>
                  {BADGE_OPTS.map(b => {
                    const bs = BADGE_STYLES[b];
                    const active = form.badge === b;
                    return (
                      <button
                        key={b}
                        onClick={() => setForm(f => ({ ...f, badge: b }))}
                        className="px-3 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all"
                        style={{
                          background: active ? bs.bg : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${active ? bs.border : 'rgba(255,255,255,0.08)'}`,
                          color: active ? bs.color : '#6b7280',
                          cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                        }}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <Label>WhatsApp Number</Label>
                <div className={`flex items-center overflow-hidden ${iCls}`} style={{ padding:0 }}>
                  <span className="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-700 bg-gray-800/50 flex-shrink-0">+60</span>
                  <input
                    type="tel"
                    value={(form.whatsapp_number||'').replace(/^\+?60/,'')}
                    onChange={e => setForm(f => ({ ...f, whatsapp_number: '+60'+e.target.value.replace(/\D/g,'') }))}
                    placeholder="123456789"
                    className="flex-1 bg-transparent border-none outline-none text-white text-sm px-3 py-2.5"
                  />
                </div>
              </div>

              {/* Image */}
              <div>
                <Label>Car Image *</Label>
                {!showImageManual ? (
                  <div className="flex items-center gap-3">
                    <div
                      className="w-24 h-16 rounded-xl overflow-hidden flex-shrink-0"
                      style={{ border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <img
                        src={form.image_url} alt=""
                        className="w-full h-full object-cover block"
                        onError={e => { e.target.style.opacity = '0'; }}
                      />
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm m-0 mb-2">Using listing image</p>
                      <button
                        onClick={() => setImageOverride(true)}
                        className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
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
                      <div
                        className="h-28 rounded-xl overflow-hidden mt-2"
                        style={{ border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <img
                          src={form.image_url} alt="Preview"
                          className="w-full h-full object-cover block"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Active toggle */}
              <div
                className="flex items-center justify-between py-2 px-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div>
                  <p className="text-white text-sm font-medium m-0">Active</p>
                  <p className="text-gray-500 text-xs m-0">Show on homepage carousel</p>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  style={{
                    position: 'relative', width: 40, height: 22, borderRadius: 11,
                    background: form.active ? '#dc2626' : 'rgba(255,255,255,0.1)',
                    border: 'none', cursor: 'pointer', padding: 0,
                    transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3,
                    left: form.active ? 21 : 3,
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'white', transition: 'left 0.2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                  }} />
                </button>
              </div>

              {/* Stats editor */}
              <div>
                <Label>Stats &amp; Specs</Label>
                <p className="text-gray-600 text-xs mb-3 m-0">Min 4, max 6. Drag to reorder.</p>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStatDragEnd}>
                  <SortableContext items={form.stats.map(s => s.id)} strategy={verticalListSortingStrategy}>
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

                <button
                  onClick={addStat}
                  disabled={form.stats.length >= 6}
                  className="w-full mt-2 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all"
                  style={{
                    background: 'none',
                    border: `1px dashed ${form.stats.length >= 6 ? 'rgba(255,255,255,0.06)' : 'rgba(220,38,38,0.3)'}`,
                    color: form.stats.length >= 6 ? '#1f2937' : '#ef4444',
                    cursor: form.stats.length >= 6 ? 'not-allowed' : 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Stat
                </button>
              </div>
            </div>
          </div>

          {/* General error */}
          {generalError && (
            <div
              className="text-red-400 text-sm rounded-xl px-4 py-2.5"
              style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)' }}
            >
              {generalError}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="flex gap-2.5 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (attempted && !isValid)}
            className="py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
            style={{
              flex: 2,
              background: (saving || (attempted && !isValid)) ? 'rgba(220,38,38,0.35)' : 'linear-gradient(135deg,#dc2626,#b91c1c)',
              boxShadow: (saving || (attempted && !isValid)) ? 'none' : '0 2px 10px rgba(220,38,38,0.28)',
              border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans',sans-serif",
            }}
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
