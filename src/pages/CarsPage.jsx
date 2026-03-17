import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { RotateCcw, ChevronDown, Search, SlidersHorizontal, X, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StickyWhatsAppButton from '@/components/StickyWhatsAppButton';
import CarCard from '@/components/CarCard';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '../supabaseClient';

/* ─── tiny helpers ─────────────────────────────────────────── */
const Tag = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-2.5 py-1 rounded-full">
    {label}
    <button onClick={onRemove} className="hover:text-blue-900 transition-colors">
      <X className="w-3 h-3" />
    </button>
  </span>
);

const FilterSection = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0 rounded-lg mx-2 mb-2 bg-gray-50/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 px-4 text-sm font-semibold text-gray-800 hover:text-blue-700 hover:bg-white/80 transition-all rounded-lg"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="pb-4 px-4 bg-white rounded-b-lg border-t border-gray-100">{children}</div>}
    </div>
  );
};

const FilterDropdown = ({ value, onChange, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-white shadow-sm hover:border-blue-300 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value ? 'text-gray-800' : 'text-gray-400'}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 rounded-2xl border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
              !value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
            }`}
            role="option"
            aria-selected={!value}
          >
            {placeholder}
          </button>

          {options.map((option) => {
            const selected = String(option) === String(value);
            return (
              <button
                key={option}
                type="button"
                onClick={() => { onChange(option); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  selected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                }`}
                role="option"
                aria-selected={selected}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ─── price brackets ───────────────────────────────────────── */
const PRICE_BRACKETS = [
  { label: 'Under RM 50k',   min: 0,       max: 50000 },
  { label: 'RM 50k – 100k',  min: 50000,   max: 100000 },
  { label: 'RM 100k – 200k', min: 100000,  max: 200000 },
  { label: 'RM 200k – 500k', min: 200000,  max: 500000 },
  { label: 'RM 500k – 1M',   min: 500000,  max: 1000000 },
  { label: 'Above RM 1M',    min: 1000000, max: Infinity },
];

/* ─── main component ───────────────────────────────────────── */
const CarsPage = () => {
  const { t } = useTranslation();
  const drawerRef = useRef(null);
  const [displayCount, setDisplayCount] = useState(12);
  const [allCars, setAllCars]                           = useState([]);
  const [loading, setLoading]                           = useState(true);
  const [fetchError, setFetchError]                     = useState(null);
  const [drawerOpen, setDrawerOpen]                     = useState(false);
  const [selectedPriceBracket, setSelectedPriceBracket] = useState(null);
  const [selectedBrands, setSelectedBrands]             = useState([]);
  const [selectedYear, setSelectedYear]                 = useState('');
  const [selectedBodyTypes, setSelectedBodyTypes]       = useState([]);
  const [selectedTransmission, setSelectedTransmission] = useState([]);
  const [selectedFuelTypes, setSelectedFuelTypes]       = useState([]);
  const [selectedLocation, setSelectedLocation]         = useState('');
  const [sortBy, setSortBy]                             = useState('price-high');
  const [searchQuery, setSearchQuery]                   = useState('');
  const refreshData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('car_listings')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) {
      setAllCars(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    const fetchCars = async () => {
      setLoading(true);
      setFetchError(null);
      const { data, error } = await supabase
        .from('car_listings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { setFetchError(error.message); setAllCars([]); }
      else        { setAllCars(data || []); }
      setLoading(false);
    };
    fetchCars();

    // Set up real-time subscription
    const channel = supabase.channel('cars_page_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'car_listings',
        },
        (payload) => {
          console.log('CarsPage real-time update received:', payload);
          
          setAllCars(current => {
            switch (payload.eventType) {
              case 'INSERT':
                return [payload.new, ...current];
              case 'UPDATE':
                return current.map(car => 
                  car.id === payload.new.id ? { ...car, ...payload.new } : car
                );
              case 'DELETE':
                return current.filter(car => car.id !== payload.old.id);
              default:
                return current;
            }
          });
        }
      )
      .subscribe((status) => {
        console.log('CarsPage subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Refresh data when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      console.log('Window focused, refreshing car data...');
      refreshData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) setDrawerOpen(false);
    };
    if (drawerOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [drawerOpen]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const brands        = [...new Set(allCars.map(c => c.brand || c.make).filter(Boolean))].sort();
  const years         = [...new Set(allCars.map(c => c.year).filter(Boolean))].sort((a, b) => b - a);
  const locations     = [...new Set(allCars.map(c => c.state || c.location).filter(Boolean))].sort();
  const bodyTypes     = ['Sedan', 'SUV', 'MPV', 'Hatchback', 'Coupe', 'Pickup'];
  const transmissions = ['Automatic', 'Manual'];
  const fuelTypes     = ['Petrol', 'Diesel', 'Hybrid', 'Electric'];

  const toggle = (setState) => (val) =>
    setState(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const resetFilters = () => {
    setSelectedPriceBracket(null);
    setSelectedBrands([]);
    setSelectedYear('');
    setSelectedBodyTypes([]);
    setSelectedTransmission([]);
    setSelectedFuelTypes([]);
    setSelectedLocation('');
    setSearchQuery('');
  };

  const activeFilterCount = [
    !!selectedPriceBracket,
    selectedBrands.length > 0,
    !!selectedYear,
    selectedBodyTypes.length > 0,
    selectedTransmission.length > 0,
    selectedFuelTypes.length > 0,
    !!selectedLocation,
  ].filter(Boolean).length;

  const activeTags = [
    ...(selectedPriceBracket ? [{ label: selectedPriceBracket.label, remove: () => setSelectedPriceBracket(null) }] : []),
    ...selectedBrands.map(b  => ({ label: b,  remove: () => toggle(setSelectedBrands)(b) })),
    ...selectedBodyTypes.map(bt => ({ label: bt, remove: () => toggle(setSelectedBodyTypes)(bt) })),
    ...selectedTransmission.map(tr => ({ label: tr, remove: () => toggle(setSelectedTransmission)(tr) })),
    ...selectedFuelTypes.map(ft => ({ label: ft, remove: () => toggle(setSelectedFuelTypes)(ft) })),
    ...(selectedYear     ? [{ label: selectedYear,     remove: () => setSelectedYear('') }]     : []),
    ...(selectedLocation ? [{ label: selectedLocation, remove: () => setSelectedLocation('') }] : []),
  ];

  const filteredCars = allCars.filter(car => {
    const price    = car.selling_price || car.price || 0;
    const brand    = car.brand || car.make;
    const location = car.state || car.location;
    const year     = car.year || (car.registration_date ? new Date(car.registration_date).getFullYear() : null);
    const search   = searchQuery.toLowerCase();

    if (selectedPriceBracket && (price < selectedPriceBracket.min || price > selectedPriceBracket.max)) return false;
    if (selectedBrands.length > 0 && !selectedBrands.includes(brand)) return false;
    if (selectedYear && String(year) !== String(selectedYear)) return false;
    if (selectedBodyTypes.length > 0 && !selectedBodyTypes.includes(car.body_type)) return false;
    if (selectedTransmission.length > 0) {
      const norm = car.transmission === 'Auto' ? 'Automatic' : 'Manual';
      if (!selectedTransmission.includes(norm)) return false;
    }
    if (selectedFuelTypes.length > 0 && !selectedFuelTypes.includes(car.fuel_type)) return false;
    if (selectedLocation && location !== selectedLocation) return false;
    if (search && !`${brand} ${car.model} ${year}`.toLowerCase().includes(search)) return false;
    return true;
  });

  const sortedCars = [...filteredCars].sort((a, b) => {
    const pA = a.selling_price || a.price || 0, pB = b.selling_price || b.price || 0;
    const yA = a.year || 0, yB = b.year || 0;
    if (sortBy === 'price-low')  return pA - pB;
    if (sortBy === 'price-high') return pB - pA;
    if (sortBy === 'newest')     return yB - yA;
    return 0;
  });

  const displayedCars = sortedCars.slice(0, displayCount);

  /* ── Filter Panel (shared sidebar + drawer) ──────────────── */
  const FilterPanel = () => (
    <div className="space-y-0">

      <FilterSection title={t('cars.filters.priceRange') || 'Price Range'}>
        <div className="grid grid-cols-2 gap-2">
          {PRICE_BRACKETS.map((bracket) => (
            <button
              key={bracket.label}
              onClick={() => setSelectedPriceBracket(
                selectedPriceBracket?.label === bracket.label ? null : bracket
              )}
              className={`text-xs font-medium px-2 py-2.5 rounded-lg border text-left transition-all
                ${selectedPriceBracket?.label === bracket.label
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
            >
              {bracket.label}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title={t('cars.filters.brand') || 'Brand'}>
        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
          {brands.length === 0
            ? <p className="text-xs text-gray-400 italic">No brands available</p>
            : brands.map(brand => (
              <label key={brand} className="flex items-center gap-2.5 cursor-pointer group">
                <Checkbox
                  checked={selectedBrands.includes(brand)}
                  onCheckedChange={() => toggle(setSelectedBrands)(brand)}
                  className="rounded"
                />
                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{brand}</span>
              </label>
            ))}
        </div>
      </FilterSection>

      <FilterSection title={t('cars.filters.year') || 'Year'}>
        <FilterDropdown
          value={selectedYear}
          onChange={setSelectedYear}
          options={years}
          placeholder={t('cars.filters.allYears') || 'All Years'}
        />
      </FilterSection>

      <FilterSection title={t('cars.filters.bodyType') || 'Body Type'}>
        <div className="grid grid-cols-2 gap-2">
          {bodyTypes.map(type => (
            <button
              key={type}
              onClick={() => toggle(setSelectedBodyTypes)(type)}
              className={`text-xs font-medium px-2 py-2.5 rounded-lg border transition-all
                ${selectedBodyTypes.includes(type)
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
            >
              {type}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title={t('cars.filters.transmission') || 'Transmission'}>
        <div className="flex gap-2">
          {transmissions.map(trans => (
            <button
              key={trans}
              onClick={() => toggle(setSelectedTransmission)(trans)}
              className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-all
                ${selectedTransmission.includes(trans)
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
            >
              {trans}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Fuel Type">
        <div className="grid grid-cols-2 gap-2">
          {fuelTypes.map(fuel => (
            <button
              key={fuel}
              onClick={() => toggle(setSelectedFuelTypes)(fuel)}
              className={`text-xs font-medium px-2 py-2.5 rounded-lg border transition-all
                ${selectedFuelTypes.includes(fuel)
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
            >
              {fuel}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title={t('cars.filters.location') || 'Location'}>
        <FilterDropdown
          value={selectedLocation}
          onChange={setSelectedLocation}
          options={locations}
          placeholder={t('cars.filters.allLocations') || 'All Locations'}
        />
      </FilterSection>

    </div>
  );

  /* ── loading / error ─────────────────────────────────────── */
  if (loading) return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm font-medium">Loading listings…</p>
        </div>
      </div>
      <Footer />
    </>
  );

  if (fetchError) return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-6 h-6 text-red-500" />
          </div>
          <p className="font-semibold text-gray-900 mb-2">Failed to load listings</p>
          <p className="text-xs font-mono text-red-500 bg-red-50 px-3 py-2 rounded-lg">{fetchError}</p>
        </div>
      </div>
      <Footer />
    </>
  );

  /* ── page ────────────────────────────────────────────────── */
  return (
    <>
      <Helmet>
        <title>{t('cars.header.title')} – XDrive</title>
        <meta name="description" content={t('cars.header.subtitle')} />
      </Helmet>

      <Header />

      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" aria-hidden="true" />
      )}

      <div
        ref={drawerRef}
        className={`fixed inset-y-0 right-0 z-50 w-80 max-w-[90vw] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col rounded-l-2xl border-l border-gray-200 ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-600" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{activeFilterCount}</span>
            )}
          </h2>
          <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-2">
          <FilterPanel />
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={resetFilters} className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl py-2.5 hover:bg-gray-50 transition-colors">
            Reset all
          </button>
          <button onClick={() => setDrawerOpen(false)} className="flex-1 bg-blue-700 text-white text-sm font-medium rounded-xl py-2.5 hover:bg-blue-800 transition-colors">
            Show {filteredCars.length} cars
          </button>
        </div>
      </div>

      <div className="pt-20 bg-[#F7F8FA] min-h-screen">
        <div className="bg-white border-b border-gray-100">
          <div className="container mx-auto px-4 py-6 lg:py-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
              {t('cars.header.title') || 'Browse Cars'}
            </h1>
            <p className="text-gray-500 text-sm lg:text-base">
              {t('cars.header.subtitle') || 'Find your perfect match from our curated inventory.'}
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 lg:py-8">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search brand, model, year…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              />
            </div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="h-full w-full sm:w-auto appearance-none border border-gray-200 rounded-2xl px-4 pr-9 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-transparent shadow-sm cursor-pointer font-semibold"
              >
                <option value="price-high">{t('cars.sort.priceHigh') || 'Price: High to Low'}</option>
                <option value="price-low">{t('cars.sort.priceLow') || 'Price: Low to High'}</option>
                <option value="newest">{t('cars.sort.newest') || 'Newest first'}</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={refreshData}
              className="inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden inline-flex items-center justify-center gap-2 bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:bg-blue-800 transition-colors relative"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Active tags */}
          {activeTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="text-xs text-gray-500 font-medium">Active:</span>
              {activeTags.map((tag, i) => (
                <Tag key={i} label={tag.label} onRemove={tag.remove} />
              ))}
              <button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors ml-1">
                Clear all
              </button>
            </div>
          )}

          <div className="flex gap-6 items-start">
            {/* Desktop sidebar */}
            <aside className="hidden lg:block w-72 flex-shrink-0 sticky top-24 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{activeFilterCount}</span>
                  )}
                </h2>
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors">
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>
              <div className="px-5 py-2">
                <FilterPanel />
              </div>
            </aside>

            {/* Car grid */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 mb-4">
                <span className="font-semibold text-gray-800">{filteredCars.length}</span>{' '}
                {t('cars.results.found') || 'cars found'}
              </p>

              {displayedCars.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {displayedCars.map(car => (
                      <CarCard key={car.id} car={car} />
                    ))}
                  </div>
                  {displayCount < sortedCars.length && (
                    <div className="mt-10 text-center">
                      <button
                        onClick={() => setDisplayCount(prev => prev + 12)}
                        className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-8 py-3 rounded-full shadow-sm hover:border-blue-400 hover:text-blue-700 transition-all hover:shadow-md"
                      >
                        Load more
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <p className="text-xs text-gray-400 mt-2">
                        Showing {displayedCars.length} of {sortedCars.length}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-700 font-semibold mb-1">{t('cars.results.empty') || 'No cars found'}</p>
                  <p className="text-gray-400 text-sm mb-5">Try adjusting your filters or search term.</p>
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 text-sm text-blue-700 font-semibold hover:underline"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t('cars.results.resetBtn') || 'Reset all filters'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
      <StickyWhatsAppButton />
    </>
  );
};

export default CarsPage;