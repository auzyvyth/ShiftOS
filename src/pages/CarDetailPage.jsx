import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Gauge, Settings, Calendar, CheckCircle, MessageCircle, Phone, Clock, ChevronRight, Fuel, Tag, Palette, FileText, Star, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StickyWhatsAppButton from '@/components/StickyWhatsAppButton';
import CarGallery from '@/components/CarGallery';
import CarCard from '@/components/CarCard';
import FinancingCalculator from '@/components/FinancingCalculator';
import { supabase } from '../supabaseClient';

const calcMonthly = (price) => {
  if (!price || price <= 0) return null;
  const loan = price * 0.9;
  return Math.round((loan * (1 + (3.5 / 100) * 7)) / (7 * 12));
};

// Road tax helper (JPJ, private vehicles, Peninsular Malaysia)
const calcRoadTax = (cc, bodyType = 'Sedan') => {
  if (!cc || cc <= 0) return null;
  const nonSaloon = bodyType && ['SUV', 'MPV', 'Pickup'].includes(bodyType);
  const c = Number(cc);
  if (c <= 1000) return 20;
  if (c <= 1200) return 55;
  if (c <= 1400) return 70;
  if (c <= 1600) return 90;
  if (c <= 1800) return Math.round(200 + (c - 1600) * (nonSaloon ? 0.40 : 0.50));
  if (c <= 2000) return Math.round(280 + (c - 1800) * (nonSaloon ? 0.40 : 0.50));
  if (c <= 2500) return Math.round(380 + (c - 2000) * 1.00);
  if (c <= 3000) return Math.round(880 + (c - 2500) * (nonSaloon ? 2.50 : 4.50));
  return Math.round((nonSaloon ? 2130 : 3130) + (c - 3000) * (nonSaloon ? 2.50 : 4.50));
};

const STATUS_CONFIG = {
  active:   { label: 'Available', dot: 'bg-green-400',  text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  reserved: { label: 'Reserved',  dot: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  sold:     { label: 'Sold',      dot: 'bg-red-400',    text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
};

const CarDetailPage = () => {
  const { id }  = useParams();
  const { t }   = useTranslation();
  const [car, setCar]                 = useState(null);
  const [similarCars, setSimilarCars] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [calcOpen, setCalcOpen]       = useState(false);

  useEffect(() => {
    const fetchCar = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('car_listings').select('*').eq('id', id).single();
      if (error) { console.error(error); setLoading(false); return; }
      setCar(data);
      const { data: similar } = await supabase.from('car_listings').select('*').eq('brand', data.brand).neq('id', id).limit(3);
      setSimilarCars(similar || []);
      setLoading(false);

      const channel = supabase.channel('car_detail_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'car_listings' }, (payload) => {
          if (payload.new?.id === data.id) setCar(c => ({ ...c, ...payload.new }));
          setSimilarCars(c => {
            if (payload.eventType === 'UPDATE') return c.map(x => x.id === payload.new.id ? { ...x, ...payload.new } : x);
            if (payload.eventType === 'DELETE') return c.filter(x => x.id !== payload.old.id);
            return c;
          });
        })
        .subscribe();
      return () => supabase.removeChannel(channel);
    };
    fetchCar();
  }, [id]);

  useEffect(() => {
    const onFocus = async () => {
      const { data, error } = await supabase.from('car_listings').select('*').eq('id', id).single();
      if (!error && data) {
        setCar(data);
        const { data: similar } = await supabase.from('car_listings').select('*').eq('brand', data.brand).neq('id', id).limit(3);
        setSimilarCars(similar || []);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [id]);

  if (loading) return (
    <><Header />
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 text-sm font-medium">Loading…</p>
      </div>
    </div><Footer /></>
  );

  if (!car) return (
    <><Header />
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-900 mb-2">Car not found</p>
        <Link to="/cars" className="text-blue-600 hover:underline text-sm">← Back to listings</Link>
      </div>
    </div><Footer /></>
  );

  const make          = car.brand || '';
  const price         = car.selling_price || 0;
  // Support both `original_price` (preferred) and legacy `previous_price` fields
  const previousPrice = car.original_price || car.previous_price || null;
  const engineCc      = car.engine_cc || null;
  const location      = car.state || '';
  const year          = car.year || (car.registration_date ? new Date(car.registration_date).getFullYear() : '');
  const images        = car.images || [];
  const carName       = `${make} ${car.model}${car.variant ? ' ' + car.variant : ''} ${year}`.trim();
  const monthly       = calcMonthly(price);
  const roadTax       = calcRoadTax(engineCc, car.body_type || car.bodyType);
  const status        = car.status || 'active';
  const statusCfg     = STATUS_CONFIG[status] || STATUS_CONFIG.active;

  const hasDiscount  = previousPrice && previousPrice > price;
  const discountAmt  = hasDiscount ? previousPrice - price : null;
  const discountPct  = hasDiscount ? Math.round((discountAmt / previousPrice) * 100) : null;

  const whatsappMsg  = `Hi, I'm interested in the ${carName} listed at RM ${price.toLocaleString()}. Is it still available?`;
  const whatsappLink = `https://wa.me/60174155191?text=${encodeURIComponent(whatsappMsg)}`;

  const specs = [
    { icon: Calendar,    label: 'Year',         value: year || '—' },
    { icon: Gauge,       label: 'Mileage',       value: car.mileage ? `${Number(car.mileage).toLocaleString()} km` : '—' },
    { icon: Settings,    label: 'Transmission',  value: car.transmission || '—' },
    { icon: CheckCircle, label: 'Condition',     value: car.condition ? car.condition.charAt(0).toUpperCase() + car.condition.slice(1) : '—' },
    { icon: Fuel,        label: 'Fuel Type',     value: car.fuel_type || '—' },
    { icon: Tag,         label: 'Body Type',     value: car.body_type || '—' },
    { icon: Palette,     label: 'Colour',        value: car.colour || '—' },
    { icon: Gauge,       label: 'Engine',        value: engineCc ? `${Number(engineCc).toLocaleString()}cc` : '—' },
    { icon: MapPin,      label: 'Location',      value: location || 'Malaysia' },
  ];

  // Simplified detail sections: only "Captions" and "Features & quirks"
  const captionContent = car.captions || car.specs || null;
  const featuresAndQuirksContent = [car.features, car.options].filter(Boolean).join('\n\n') || null;

  const PriceBadge = () => hasDiscount && (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
      <TrendingDown className="w-3 h-3" />−{discountPct}%
    </span>
  );

  return (
    <>
      <Helmet>
        <title>{carName} – RM {price.toLocaleString()} | Drevo</title>
        <meta name="description" content={`${carName} for sale at RM ${price.toLocaleString()}. Located in ${location}.`} />
      </Helmet>

      <Header />

      <div className="pt-20 bg-[#F7F8FA] min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-6 lg:py-10">

          {/* Breadcrumb */}
          <nav className="hidden md:flex items-center gap-1.5 text-xs text-gray-400 mb-5">
            <Link to="/" className="hover:text-blue-700 transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/cars" className="hover:text-blue-700 transition-colors">Browse Cars</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-600 font-medium truncate max-w-[200px]">{carName}</span>
          </nav>

          <div className="md:hidden mb-4">
            <Link to="/cars" className="inline-flex items-center text-sm font-semibold text-blue-700 hover:text-blue-800 transition-colors">
              ← Back to listings
            </Link>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 lg:gap-6">

            {/* ── LEFT ── */}
            <div className="xl:col-span-2 space-y-5">

              {/* Gallery (with discount badge overlay when applicable) */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 relative">
                {images.length > 0
                  ? (
                    <>
                      <CarGallery images={images} carName={carName} />
                      {hasDiscount && (
                        <div className="absolute top-4 right-4 z-20">
                          <div className="car-card-discount-badge">
                            <TrendingDown size={12} />
                            <span>−{discountPct}%</span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-72 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">No images available</div>
                  )
                }
              </div>

              {/* Title + Price */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-1">{make}</p>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 leading-tight">
                      {car.model}{car.variant ? <span className="font-semibold"> {car.variant}</span> : ''} <span className="font-semibold">{year}</span>
                    </h1>
                    <div className="flex items-center flex-wrap gap-3 mt-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />{statusCfg.label}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-gray-500"><MapPin className="w-3.5 h-3.5" />{location || 'Malaysia'}</span>
                      {engineCc && <span className="flex items-center gap-1 text-sm text-gray-500"><Gauge className="w-3.5 h-3.5" />{Number(engineCc).toLocaleString()}cc</span>}
                    </div>
                  </div>

                  {/* Price block */}
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 lg:px-5 lg:py-4 lg:text-right lg:min-w-[260px]">
                    <p className="text-[11px] text-gray-500 mb-0.5 uppercase tracking-wide">Asking Price</p>
                    {hasDiscount && (
                      <div className="flex items-center gap-2 lg:justify-end mb-1">
                        <span className="text-sm text-gray-400 line-through">RM {previousPrice.toLocaleString('en-MY')}</span>
                        <PriceBadge />
                      </div>
                    )}
                    <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 leading-tight">
                      RM {price > 0 ? price.toLocaleString('en-MY') : '—'}
                    </p>
                    {hasDiscount && <p className="text-xs text-green-600 font-semibold mt-0.5">Save RM {discountAmt.toLocaleString('en-MY')}</p>}
                    {monthly && <p className="text-sm text-blue-700 font-semibold mt-1">≈ RM {monthly.toLocaleString('en-MY')}<span className="text-gray-400 font-normal">/mo</span></p>}
                    {roadTax != null && (
                      <p className="text-sm text-gray-600 font-medium mt-1">Est. Road Tax: RM {roadTax.toLocaleString('en-MY')}<span className="text-gray-400 font-normal">/yr</span>
                        <button onClick={() => setCalcOpen(true)} className="ml-2 text-xs text-blue-700 font-semibold">Estimate</button>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile CTAs */}
              <div className="xl:hidden bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                    className="w-full bg-[#25D366] hover:bg-[#1db954] text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all">
                    <MessageCircle className="w-4 h-4" />WhatsApp
                  </a>
                  <button onClick={() => window.location.href = 'tel:+60174155191'}
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all">
                    <Phone className="w-4 h-4" />Call
                  </button>
                  <button onClick={() => setCalcOpen(true)}
                    className="w-full border-2 border-blue-700 text-blue-700 hover:bg-blue-50 py-2 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm transition-all">
                    📊 Estimate
                  </button>
                </div>
              </div>

              {/* Key specs */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 sm:mb-4">At a Glance</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                  {specs.map(({ icon: Icon, label, value }) => value !== '—' && (
                    <div key={label} className="flex flex-col gap-1 p-3 sm:p-3.5 bg-gray-50 rounded-xl border border-gray-100 group">
                      <Icon className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mt-0.5">{label}</p>
                      <p className="text-sm font-bold text-gray-800 truncate">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Car details — only two sections: Captions and Features & quirks */}
              {(captionContent || featuresAndQuirksContent) && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-4 sm:mb-5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Car Details</h2>
                  </div>
                  <div className="space-y-4">
                    {captionContent && (
                      <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5 sm:p-4">
                        <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                          <FileText className="w-3.5 h-3.5 text-blue-500" />
                          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Captions</h3>
                        </div>
                        <div className="text-gray-700 text-sm leading-6 pl-4 border-l-2 border-blue-100 whitespace-pre-line">{captionContent}</div>
                      </div>
                    )}

                    {featuresAndQuirksContent && (
                      <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5 sm:p-4">
                        <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                          <Star className="w-3.5 h-3.5 text-blue-500" />
                          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Features & quirks</h3>
                        </div>
                        <div className="text-gray-700 text-sm leading-6 pl-4 border-l-2 border-blue-100 whitespace-pre-line">{featuresAndQuirksContent}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* ── RIGHT: sidebar ── */}
            <div className="xl:col-span-1">
              <div className="hidden xl:block bg-white rounded-2xl shadow-sm border border-gray-100 p-6 xl:sticky xl:top-24 space-y-4">

                <div className="pb-4 border-b border-gray-100">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Asking Price</p>
                  {hasDiscount && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-400 line-through">RM {previousPrice.toLocaleString('en-MY')}</span>
                      <PriceBadge />
                    </div>
                  )}
                  <p className="text-3xl font-extrabold text-gray-900">RM {price > 0 ? price.toLocaleString('en-MY') : '—'}</p>
                  {hasDiscount && <p className="text-xs text-green-600 font-semibold mt-0.5">Save RM {discountAmt.toLocaleString('en-MY')}</p>}
                  {monthly && <p className="text-sm text-blue-600 font-medium mt-1">≈ RM {monthly.toLocaleString('en-MY')}<span className="text-gray-400 font-normal text-xs"> /mo · 7yr @ 3.5%</span></p>}
                  {roadTax != null && <p className="text-sm text-gray-600 font-medium mt-1">Est. Road Tax: RM {roadTax.toLocaleString('en-MY')}<span className="text-gray-400 font-normal text-xs"> /yr</span></p>}
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mt-3 ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />{statusCfg.label}
                  </span>
                </div>

                <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                  className="w-full bg-[#25D366] hover:bg-[#1db954] text-white py-3.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2 text-sm">
                  <MessageCircle className="w-5 h-5" />WhatsApp Us
                </a>
                <button onClick={() => window.location.href = 'tel:+60174155191'}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2 text-sm">
                  <Phone className="w-5 h-5" />Call Now
                </button>
                <button onClick={() => setCalcOpen(true)}
                  className="w-full border-2 border-blue-700 text-blue-700 hover:bg-blue-50 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm">
                  📊 Financing & Cost Estimate
                </button>

                <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 pt-1">
                  <Clock className="w-3 h-3" /><span>Usually replies within 1 hour</span>
                </div>

                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-xs font-bold text-gray-700 mb-2.5">Why buy with Drevo?</p>
                  <ul className="space-y-1.5 text-xs text-gray-600">
                    {[t('carDetail.sidebar.benefit1'), t('carDetail.sidebar.benefit2'), t('carDetail.sidebar.benefit3'), t('carDetail.sidebar.benefit4')].map((b, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-blue-600 mt-0.5 flex-shrink-0" />{b}
                      </li>
                    ))}
                  </ul>
                </div>

              </div>
            </div>

          </div>

          {/* Similar cars */}
          {similarCars.length > 0 && (
            <div className="mt-14">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-gray-900">More {make}s</h2>
                <Link to="/cars" className="text-sm text-blue-600 font-semibold hover:underline">View all →</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {similarCars.map(c => <CarCard key={c.id} car={c} />)}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Calculator Modal */}
      <AnimatePresence>
        {calcOpen && (
          <motion.div key="calc-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setCalcOpen(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ duration: 0.2 }}
              className="w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden bg-white">
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                <div>
                  <p className="font-bold text-gray-900 text-sm">Financing & Cost Calculator</p>
                  <p className="text-xs text-gray-400">{carName}</p>
                </div>
                <button onClick={() => setCalcOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors text-lg font-light">×</button>
              </div>
              <div className="max-h-[80vh] overflow-y-auto">
                {/* Pass engineCc and bodyType so Road Tax tab auto-populates */}
                <FinancingCalculator initialPrice={price} engineCc={engineCc} bodyType={car.body_type} flat />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
      <StickyWhatsAppButton />
    </>
  );
};

export default CarDetailPage;