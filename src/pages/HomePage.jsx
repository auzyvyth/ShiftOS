import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  MessageCircle, Shield, Award, TrendingDown, Star, CheckCircle,
  Users, DollarSign, UserCheck, ShieldCheck, Calculator, Flame,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StickyWhatsAppButton from '@/components/StickyWhatsAppButton';
import CarCard from '@/components/CarCard';
import { supabase } from '../supabaseClient';

// ── Constants ─────────────────────────────────────────────────────────────────
const CAR_FIELDS = 'id,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,images,status';
const HERO_IMG   = 'https://images.unsplash.com/photo-1694025881942-b752102cee95?w=1280&auto=format&fit=crop&q=50';

const isHotDeal = (car) => {
  const op = car.original_price, sp = car.selling_price;
  return op && op > 0 && sp > 0 && sp <= op * 0.97;
};

// ── Lightweight fade-in for below-fold sections (no framer-motion) ────────────
function FadeIn({ children, delay = 0, className = '' }) {
  const ref  = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return <div className="bg-gray-100 rounded-xl h-80 animate-pulse" />;
}

// ── HomePage ──────────────────────────────────────────────────────────────────
const HomePage = () => {
  const { t } = useTranslation();
  const [featuredCars, setFeaturedCars] = useState([]);
  const [hotDeals,     setHotDeals]     = useState([]);
  const [loading,      setLoading]      = useState(true);

  // ── Single fetch, split results ───────────────────────────────────────────
  useEffect(() => {
    let channel;

    const fetchAll = async () => {
      const { data, error } = await supabase
        .from('car_listings')
        .select(CAR_FIELDS)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(60); // enough for both sections, one round-trip

      if (!error && data) {
        setFeaturedCars(data.slice(0, 6));

        const deals = data
          .filter(isHotDeal)
          .sort((a, b) => {
            const pA = (a.original_price - a.selling_price) / a.original_price;
            const pB = (b.original_price - b.selling_price) / b.original_price;
            return pB - pA;
          })
          .slice(0, 6);

        setHotDeals(deals);
      }
      setLoading(false);
    };

    fetchAll();

    // ── One real-time channel for both sections ──
    channel = supabase
      .channel('home_listings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'car_listings' },
        () => {
          // Re-fetch on any change — keeps both sections fresh
          fetchAll();
        }
      )
      .subscribe();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  // ── Static data ───────────────────────────────────────────────────────────
  const testimonials = [
    { name: 'Ahmad', location: 'Kuala Lumpur', text: 'Saved RM 8,000 on my Honda Civic! XDrive negotiated a deal I never could have gotten myself. Highly recommended!', rating: 5 },
    { name: 'Siti',  location: 'Selangor',     text: 'Best car buying experience ever. No pressure, just honest advice and the best price in town. Thank you XDrive!',     rating: 5 },
    { name: 'Raj',   location: 'Penang',        text: 'I was skeptical at first, but XDrive proved me wrong. They found me the perfect car and saved me thousands!',        rating: 5 },
  ];

  const howItWorksSteps = [
    { step: 1, icon: Shield,       title: t('home.howItWorks.step1') },
    { step: 2, icon: MessageCircle,title: t('home.howItWorks.step2') },
    { step: 3, icon: DollarSign,   title: t('home.howItWorks.step3') },
    { step: 4, icon: CheckCircle,  title: t('home.howItWorks.step4') },
  ];

  const benefits = [
    { icon: TrendingDown, title: t('home.whyChoose.benefit1Title'), desc: t('home.whyChoose.benefit1Desc') },
    { icon: UserCheck,    title: t('home.whyChoose.benefit2Title'), desc: t('home.whyChoose.benefit2Desc') },
    { icon: ShieldCheck,  title: t('home.whyChoose.benefit3Title'), desc: t('home.whyChoose.benefit3Desc') },
    { icon: DollarSign,   title: t('home.whyChoose.benefit4Title'), desc: t('home.whyChoose.benefit4Desc') },
  ];

  return (
    <>
      <Helmet>
        <title>XDrive - {t('home.hero.headline')} {t('home.hero.highlight')}</title>
        <meta name="description" content={t('home.hero.subheadline')} />
        {/* Preload hero — tells browser to fetch it ASAP, before CSS is parsed */}
        <link rel="preload" as="image" href={HERO_IMG} />
      </Helmet>

      <Header />

      {/* ── Hero — keep framer-motion here only (above fold, worth it) ── */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        <div
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: `url(${HERO_IMG})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/50" />
        </div>
        <div className="relative z-10 container mx-auto px-4 text-center text-white">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              {t('home.hero.headline')}<br />
              <span className="text-[#25D366]">{t('home.hero.highlight')}</span>
            </h1>
            <p className="text-xl md:text-2xl mb-10 text-gray-200 max-w-3xl mx-auto">
              {t('home.hero.subheadline')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/cars"
                className="bg-[#1E3A8A] text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-[#1E3A8A]/90 transition-all shadow-2xl hover:scale-105">
                {t('home.hero.browseBtn')}
              </Link>
              <a href="https://wa.me/60174155191?text=Hi%20XDrive%2C%20I%20need%20help%20finding%20a%20car"
                target="_blank" rel="noopener noreferrer"
                className="bg-[#25D366] text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-[#25D366]/90 transition-all shadow-2xl hover:scale-105 flex items-center justify-center gap-2">
                <MessageCircle className="w-6 h-6" />
                {t('home.hero.chatBtn')}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Trust Indicators ── */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Users,         color: '#1E3A8A', value: '500+',                    label: t('home.trust.carsSold')     },
              { icon: Award,         color: '#25D366', value: t('home.trust.bestPrice'), label: t('home.trust.guarantee')    },
              { icon: MessageCircle, color: '#1E3A8A', value: t('home.trust.free'),      label: t('home.trust.consultation') },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 0.1} className="text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: `${item.color}15` }}>
                  <item.icon className="w-10 h-10" style={{ color: item.color }} />
                </div>
                <div className="text-4xl font-bold text-[#1E3A8A] mb-2">{item.value}</div>
                <p className="text-gray-600 font-medium">{item.label}</p>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Hot Deals ── */}
      {(hotDeals.length > 0 || loading) && (
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <FadeIn className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 text-red-500 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
                <Flame className="w-4 h-4" /> Hot Deals
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Best Prices Right Now</h2>
              <p className="text-xl text-gray-600">Listings with the biggest discounts — updated live</p>
            </FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
              {loading
                ? [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
                : hotDeals.map(car => <CarCard key={car.id} car={car} />)
              }
            </div>
          </div>
        </section>
      )}

      {/* ── Featured Cars ── */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <FadeIn className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('home.hotDeals.title')}</h2>
            <p className="text-xl text-gray-600">{t('home.hotDeals.subtitle')}</p>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
            {loading
              ? [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
              : featuredCars.map(car => <CarCard key={car.id} car={car} />)
            }
          </div>
          <div className="text-center">
            <Link to="/cars"
              className="inline-block bg-[#1E3A8A] text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-[#1E3A8A]/90 transition-all shadow-lg hover:shadow-xl hover:scale-105">
              {t('home.hotDeals.viewAllBtn')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <FadeIn className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('home.testimonials.title')}</h2>
            <p className="text-xl text-gray-600">{t('home.testimonials.subtitle')}</p>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 h-full">
                  <div className="flex gap-1 mb-4">
                    {[...Array(t.rating)].map((_, j) => <Star key={j} className="w-5 h-5 fill-yellow-400 text-yellow-400" />)}
                  </div>
                  <p className="text-gray-700 mb-6 italic">"{t.text}"</p>
                  <div>
                    <p className="font-bold text-gray-900">{t.name}</p>
                    <p className="text-sm text-gray-600">{t.location}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-16 bg-gradient-to-br from-[#1E3A8A]/5 to-[#25D366]/5">
        <div className="container mx-auto px-4">
          <FadeIn className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('home.howItWorks.title')}</h2>
            <p className="text-xl text-gray-600">{t('home.howItWorks.subtitle')}</p>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {howItWorksSteps.map((item, i) => (
              <FadeIn key={i} delay={i * 0.1} className="relative">
                <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 text-center h-full">
                  <div className="bg-[#1E3A8A] text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">{item.step}</div>
                  <item.icon className="w-12 h-12 text-[#25D366] mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                </div>
                {i < 3 && (
                  <div className="hidden md:block absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2">
                    <div className="w-8 h-0.5 bg-[#1E3A8A]/30" />
                  </div>
                )}
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Choose Us ── */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <FadeIn className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('home.whyChoose.title')}</h2>
            <p className="text-xl text-gray-600">{t('home.whyChoose.subtitle')}</p>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((b, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 h-full">
                  <b.icon className="w-12 h-12 text-[#1E3A8A] mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{b.title}</h3>
                  <p className="text-gray-600">{b.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Calculator CTA ── */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <FadeIn>
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="flex flex-col md:flex-row items-center">
                <div className="p-10 md:w-1/2 text-center md:text-left">
                  <div className="bg-[#1E3A8A]/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto md:mx-0 mb-6">
                    <Calculator className="w-8 h-8 text-[#1E3A8A]" />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('home.budget.title')}</h2>
                  <p className="text-lg text-gray-600 mb-8">{t('home.budget.subtitle')}</p>
                  <Link to="/calculator"
                    className="inline-flex items-center gap-2 bg-[#1E3A8A] text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-[#1E3A8A]/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
                    <Calculator className="w-5 h-5" />
                    {t('home.budget.calcBtn')}
                  </Link>
                </div>
                <div className="md:w-1/2 h-64 md:h-auto w-full relative">
                  <img
                    src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=50"
                    alt="Car financing"
                    className="w-full h-full object-cover absolute inset-0"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section id="contact" className="py-20 bg-gradient-to-r from-[#1E3A8A] to-[#1E3A8A]/80 text-white">
        <div className="container mx-auto px-4 text-center">
          <FadeIn>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">{t('home.cta.title')}</h2>
            <p className="text-xl mb-10 text-gray-200 max-w-2xl mx-auto">{t('home.cta.subtitle')}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/cars"
                className="bg-white text-[#1E3A8A] px-8 py-4 rounded-full text-lg font-semibold hover:bg-gray-100 transition-all shadow-xl hover:scale-105">
                {t('home.cta.browseBtn')}
              </Link>
              <a href="https://wa.me/60174155191?text=Hi%20XDrive%2C%20I%20need%20help%20finding%20a%20car"
                target="_blank" rel="noopener noreferrer"
                className="bg-[#25D366] text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-[#25D366]/90 transition-all shadow-xl hover:scale-105 flex items-center justify-center gap-2">
                <MessageCircle className="w-6 h-6" />
                {t('home.cta.whatsappBtn')}
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
      <StickyWhatsAppButton />
    </>
  );
};

export default HomePage;