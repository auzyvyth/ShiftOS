import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  MessageCircle, Shield, TrendingDown, Star, CheckCircle,
  Users, DollarSign, UserCheck, ShieldCheck, Calculator, Flame,
  Search, ChevronDown, ArrowRight, Zap, MapPin,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StickyWhatsAppButton from '@/components/StickyWhatsAppButton';
import CarCard from '@/components/CarCard';
import { supabase } from '../supabaseClient';

const CAR_FIELDS = 'id,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,images,status,created_at';
const HERO_IMG   = 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1400&auto=format&fit=crop&q=70';
const BRANDS     = ['Perodua','Proton','Honda','Toyota','Mazda','BMW','Mercedes','Hyundai','Nissan','Mitsubishi'];
const BODY_TYPES = ['Sedan','SUV','Hatchback','MPV','Pickup','Coupe'];

const isHotDeal = (c) => {
  const op = c.original_price, sp = c.selling_price;
  return op && op > 0 && sp > 0 && sp <= op * 0.97;
};

function FadeIn({ children, delay = 0, style = {} }) {
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ opacity: v?1:0, transform: v?'translateY(0)':'translateY(28px)', transition:`opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`, ...style }}>
      {children}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background:'#0d1117', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', overflow:'hidden' }}>
      <div style={{ height:'200px', background:'linear-gradient(90deg,#111827 25%,#1f2937 50%,#111827 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.5s infinite' }}/>
      <div style={{ padding:'16px' }}>
        {[70,50,90,100].map((w,i) => (
          <div key={i} style={{ height:'12px', width:`${w}%`, background:'#1f2937', borderRadius:'6px', marginBottom:'10px', animation:'shimmer 1.5s infinite' }}/>
        ))}
      </div>
    </div>
  );
}

const redBtn = {
  display:'inline-flex', alignItems:'center', gap:'8px',
  background:'linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)',
  color:'white', fontWeight:'700', fontSize:'14px',
  padding:'13px 28px', borderRadius:'50px', textDecoration:'none',
  boxShadow:'0 4px 20px rgba(220,38,38,0.35)',
  transition:'all 0.2s ease', position:'relative', overflow:'hidden',
};
const waBtn = {
  display:'inline-flex', alignItems:'center', gap:'8px',
  background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.28)',
  color:'#25D366', fontWeight:'700', fontSize:'14px',
  padding:'13px 28px', borderRadius:'50px', textDecoration:'none',
  transition:'all 0.2s ease',
};
const card = {
  background:'linear-gradient(145deg,#0d1117 0%,#111827 100%)',
  border:'1px solid rgba(255,255,255,0.07)',
  borderRadius:'16px',
};
const selectSt = {
  background:'transparent', color:'white',
  appearance:'none', WebkitAppearance:'none',
  border:'none', outline:'none',
  fontSize:'13px', fontWeight:'600',
  width:'100%', cursor:'pointer',
  fontFamily:"'DM Sans',sans-serif",
};

const HomePage = () => {
  const { t } = useTranslation();
  const [featured,  setFeatured]  = useState([]);
  const [hotDeals,  setHotDeals]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [stock,     setStock]     = useState(0);
  // ── Live sold count ───────────────────────────────────────────────────────
  const [soldCount, setSoldCount] = useState(null); // null = loading, number = live
  // ─────────────────────────────────────────────────────────────────────────
  const [brand,     setBrand]     = useState('');
  const [bodyType,  setBodyType]  = useState('');
  const [maxPrice,  setMaxPrice]  = useState('');

  useEffect(() => {
    let ch, soldCh;

    const load = async () => {
      const { data, error, count } = await supabase
        .from('car_listings')
        .select(CAR_FIELDS, { count:'exact' })
        .eq('status','active')
        .order('created_at',{ ascending:false })
        .limit(60);
      if (!error && data) {
        setFeatured(data.slice(0,6));
        setStock(count || data.length);
        setHotDeals(
          data.filter(isHotDeal)
            .sort((a,b)=>((b.original_price-b.selling_price)/b.original_price)-((a.original_price-a.selling_price)/a.original_price))
            .slice(0,6)
        );
      }
      setLoading(false);
    };

    // Fetch live sold count
    const fetchSoldCount = async () => {
      const { count } = await supabase
        .from('car_listings')
        .select('id', { count:'exact', head:true })
        .eq('status','sold');
      setSoldCount(count || 0);
    };

    load();
    fetchSoldCount();

    ch = supabase.channel('home')
      .on('postgres_changes',{event:'*',schema:'public',table:'car_listings'},load)
      .subscribe();

    // Subscribe to sold count changes separately for instant homepage update
    soldCh = supabase.channel('home_sold')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'car_listings'},fetchSoldCount)
      .subscribe();

    return () => {
      if (ch) supabase.removeChannel(ch);
      if (soldCh) supabase.removeChannel(soldCh);
    };
  }, []);

  const searchUrl = () => {
    const p = new URLSearchParams();
    if (brand)    p.set('brand',brand);
    if (bodyType) p.set('body_type',bodyType);
    if (maxPrice) p.set('max_price',maxPrice);
    const q = p.toString();
    return q ? `/cars?${q}` : '/cars';
  };

  const benefits = [
    { icon:TrendingDown, title:t('home.whyChoose.benefit1Title'), desc:t('home.whyChoose.benefit1Desc') },
    { icon:UserCheck,    title:t('home.whyChoose.benefit2Title'), desc:t('home.whyChoose.benefit2Desc') },
    { icon:ShieldCheck,  title:t('home.whyChoose.benefit3Title'), desc:t('home.whyChoose.benefit3Desc') },
    { icon:DollarSign,   title:t('home.whyChoose.benefit4Title'), desc:t('home.whyChoose.benefit4Desc') },
  ];

  const steps = [
    { n:'01', icon:MessageCircle, t:'Tell Us What You Need',    d:'WhatsApp us your budget and must-haves.' },
    { n:'02', icon:Search,        t:'We Find the Best Options', d:'We shortlist verified cars that match.' },
    { n:'03', icon:Shield,        t:'Inspect & Test Drive',     d:'Visit, inspect, and take it for a spin.' },
    { n:'04', icon:CheckCircle,   t:'Drive Away Happy',         d:'Best deal negotiated, paperwork handled.' },
  ];

  const testimonials = [
    { name:'Ahmad Faris',    loc:'Kuala Lumpur', text:'Saved RM 8,000 on my Honda Civic. Best deal I could never have gotten myself.', r:5 },
    { name:'Siti Norzahira', loc:'Selangor',     text:'Zero pressure, honest advice, best price in town. Will definitely come back.',  r:5 },
    { name:'Rajendran K.',   loc:'Penang',       text:'Found my perfect car in 3 days and saved thousands. Highly recommended.',        r:5 },
  ];

  // ── Derived sold display string ───────────────────────────────────────────
  // Shows live count if > 0, else falls back to '500+' until data loads
  const soldDisplay = soldCount !== null && soldCount > 0 ? `${soldCount}+` : soldCount === 0 ? '0' : '500+';
  // ─────────────────────────────────────────────────────────────────────────

  const SHead = ({ eyebrow, title, eyebrowColor='#dc2626', right, icon:Icon }) => (
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'40px' }}>
      <div>
        <p style={{ color:eyebrowColor, fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 8px 0', display:'flex', alignItems:'center', gap:'6px' }}>
          {Icon && <Icon size={11}/>}{eyebrow}
        </p>
        <h2 style={{ color:'white', fontSize:'clamp(1.6rem,3vw,2.2rem)', fontWeight:'800', margin:0, lineHeight:1.2 }}>{title}</h2>
        <div style={{ width:'40px', height:'3px', background:'#dc2626', borderRadius:'2px', marginTop:'10px' }}/>
      </div>
      {right}
    </div>
  );

  const ViewAll = ({ to }) => (
    <Link to={to} style={{ color:'#4b5563', fontSize:'13px', fontWeight:'600', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}
      onMouseEnter={e=>e.currentTarget.style.color='white'}
      onMouseLeave={e=>e.currentTarget.style.color='#4b5563'}
    >
      View All <ArrowRight size={13}/>
    </Link>
  );

  const wrap = { maxWidth:'1280px', margin:'0 auto', padding:'0 24px' };
  const sec  = (bg) => ({ background:bg||'#080C14', padding:'80px 0' });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Bebas+Neue&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { background: #080C14 !important; margin: 0 !important; }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes pulse-red { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.45)} 50%{box-shadow:0 0 0 12px rgba(220,38,38,0)} }
        .shine-hp { position:relative; overflow:hidden; }
        .shine-hp::before { content:''; position:absolute; top:0; left:-80%; width:60%; height:100%; background:linear-gradient(120deg,transparent,rgba(255,255,255,0.2),transparent); transform:skewX(-20deg); transition:left 0.5s ease; }
        .shine-hp:hover::before { left:130%; }
        .red-btn-hp:hover { background: linear-gradient(135deg,#ef4444 0%,#dc2626 100%) !important; transform: translateY(-1px); }
        .wa-btn-hp:hover  { background: rgba(37,211,102,0.2) !important; border-color: rgba(37,211,102,0.45) !important; }
        .ghost-hp:hover   { background: rgba(255,255,255,0.08) !important; }
        .card-hp { transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease !important; }
        .card-hp:hover { transform: translateY(-3px) !important; box-shadow: 0 16px 40px rgba(0,0,0,0.45) !important; border-color: rgba(220,38,38,0.25) !important; }
        .search-wrap:hover { border-color: rgba(255,255,255,0.18) !important; }
        select option { background:#0d1117 !important; color:white !important; }
        @media(max-width:900px){ .search-grid-hp { grid-template-columns: 1fr 1fr !important; } }
        @media(max-width:580px){
          .search-grid-hp { grid-template-columns: 1fr !important; }
          .hero-btns-hp   { flex-direction: column !important; }
          .hero-btns-hp a { justify-content: center !important; }
          .stats-flex     { flex-wrap: wrap !important; }
          .stats-flex > div { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; width:100% !important; }
        }
      `}</style>

      <Helmet>
        <title>Drevo — Find Your Perfect Car in Malaysia</title>
        <meta name="description" content="Browse trusted used cars from verified Malaysian dealers. Best prices, transparent listings, WhatsApp direct." />
        <link rel="preload" as="image" href={HERO_IMG} />
      </Helmet>

      <Header />

      {/* ══════════ HERO ══════════ */}
      <section style={{ position:'relative', minHeight:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', background:'#080C14', overflow:'hidden', paddingBottom:'0' }}>
        <div style={{ position:'absolute', inset:0, zIndex:0 }}>
          <img src={HERO_IMG} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 30%', opacity:0.28 }}/>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right,rgba(8,12,20,0.97) 25%,rgba(8,12,20,0.65) 60%,rgba(8,12,20,0.25) 100%)' }}/>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,#080C14 0%,transparent 50%)' }}/>
          <div style={{ position:'absolute', bottom:'-150px', left:'-150px', width:'600px', height:'600px', borderRadius:'50%', background:'radial-gradient(circle,rgba(220,38,38,0.09) 0%,transparent 70%)', pointerEvents:'none' }}/>
        </div>

        <div style={{ ...wrap, position:'relative', zIndex:1, paddingTop:'130px' }}>
          <motion.div initial={{ opacity:0, y:40 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.8, ease:[0.22,1,0.36,1] }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'22px' }}>
              <div style={{ width:'28px', height:'2px', background:'#dc2626' }}/>
              <span style={{ color:'#dc2626', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.2em' }}>Malaysia's Trusted Car Platform</span>
            </div>

            <h1 style={{ color:'white', margin:'0 0 22px 0', lineHeight:0.95, fontSize:'clamp(3rem,9vw,7rem)', fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'0.02em' }}>
              Find Your<br/>
              <span style={{ background:'linear-gradient(135deg,#ffffff 0%,#dc2626 55%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                Perfect Drive.
              </span>
            </h1>

            <p style={{ color:'#9ca3af', fontSize:'clamp(14px,2vw,18px)', margin:'0 0 38px 0', maxWidth:'480px', lineHeight:1.7 }}>
              Browse <span style={{ color:'white', fontWeight:'700' }}>{stock > 0 ? `${stock}+` : 'verified'} cars</span> from trusted Malaysian dealers. Transparent pricing, no hidden fees.
            </p>

            <div className="hero-btns-hp" style={{ display:'flex', gap:'12px', flexWrap:'wrap', marginBottom:'60px' }}>
              <Link to="/cars" className="shine-hp red-btn-hp" style={redBtn}>Browse Cars <ArrowRight size={15}/></Link>
              <a href="https://wa.me/60174155191?text=Hi%20Drevo%2C%20I%20need%20help%20finding%20a%20car" target="_blank" rel="noopener noreferrer" className="wa-btn-hp" style={waBtn}>
                <MessageCircle size={15}/> WhatsApp Us
              </a>
            </div>
          </motion.div>

          {/* Search bar */}
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.45, duration:0.65, ease:[0.22,1,0.36,1] }}>
            <div style={{ background:'rgba(10,14,24,0.9)', backdropFilter:'blur(24px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px 16px 0 0', padding:'18px 18px 18px' }}>
              <div className="search-grid-hp" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:'10px' }}>
                {[
                  { label:'Brand',  Icon:Search,    value:brand,    set:setBrand,    opts:BRANDS,     ph:'All Brands' },
                  { label:'Type',   Icon:Zap,       value:bodyType, set:setBodyType, opts:BODY_TYPES,  ph:'All Types'  },
                  { label:'Budget', Icon:DollarSign, value:maxPrice, set:setMaxPrice, opts:null,       ph:'Any Price'  },
                ].map(f => (
                  <div key={f.label} className="search-wrap" style={{ display:'flex', alignItems:'center', gap:'10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'12px 14px', transition:'border-color 0.2s' }}>
                    <f.Icon size={14} style={{ color:'#4b5563', flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color:'#4b5563', fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 3px 0' }}>{f.label}</p>
                      <select value={f.value} onChange={e=>f.set(e.target.value)} style={selectSt}>
                        <option value="">{f.ph}</option>
                        {f.opts
                          ? f.opts.map(o=><option key={o} value={o}>{o}</option>)
                          : [['30000','Under RM 30k'],['50000','Under RM 50k'],['80000','Under RM 80k'],['120000','Under RM 120k'],['200000','Under RM 200k']].map(([v,l])=><option key={v} value={v}>{l}</option>)
                        }
                      </select>
                    </div>
                    <ChevronDown size={12} style={{ color:'#374151', flexShrink:0 }}/>
                  </div>
                ))}
                <Link to={searchUrl()} className="shine-hp" style={{ ...redBtn, borderRadius:'10px', padding:'12px 18px', whiteSpace:'nowrap', justifyContent:'center', animation:'pulse-red 2.5s infinite' }}>
                  <Search size={15}/> Search
                </Link>
              </div>
            </div>

            {/* Trust strip */}
            <div className="stats-flex" style={{ display:'flex', background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.06)', borderTop:'none', borderRadius:'0 0 16px 16px' }}>
              {[
                { v: stock>0?`${stock}+`:'50+', l:'Cars Available'    },
                { v:'< 1 Hour',                  l:'WhatsApp Response' },
                { v:'100%',                      l:'Verified Listings' },
              ].map((item,i,arr)=>(
                <div key={i} style={{ flex:1, textAlign:'center', padding:'14px 10px', borderRight:i<arr.length-1?'1px solid rgba(255,255,255,0.05)':'none' }}>
                  <p style={{ color:'white', fontSize:'13px', fontWeight:'700', margin:'0 0 2px 0' }}>{item.v}</p>
                  <p style={{ color:'#4b5563', fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.08em', margin:0 }}>{item.l}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'100px', background:'linear-gradient(to bottom,transparent,#080C14)', zIndex:0, pointerEvents:'none' }}/>
      </section>

      {/* ══════════ HOT DEALS ══════════ */}
      {(hotDeals.length > 0 || loading) && (
        <section style={sec('#080C14')}>
          <div style={wrap}>
            <FadeIn>
              <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'40px' }}>
                <div>
                  <p style={{ color:'#dc2626', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 8px 0', display:'flex', alignItems:'center', gap:'5px' }}>
                    <Flame size={11}/> Limited Time
                  </p>
                  <h2 style={{ color:'white', fontSize:'clamp(1.6rem,3vw,2.2rem)', fontWeight:'800', margin:0 }}>Hot Deals</h2>
                  <div style={{ width:'40px', height:'3px', background:'#dc2626', borderRadius:'2px', marginTop:'10px' }}/>
                </div>
                <Link to="/cars?hot_deals=true" style={{ color:'#4b5563', fontSize:'13px', fontWeight:'600', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}
                  onMouseEnter={e=>e.currentTarget.style.color='white'} onMouseLeave={e=>e.currentTarget.style.color='#4b5563'}>
                  View All <ArrowRight size={13}/>
                </Link>
              </div>
            </FadeIn>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))', gap:'20px' }}>
              {loading ? [...Array(3)].map((_,i)=><SkeletonCard key={i}/>) : hotDeals.map(c=><CarCard key={c.id} car={c}/>)}
            </div>
          </div>
        </section>
      )}

      {/* ══════════ FEATURED ══════════ */}
      <section style={sec('#0a0e18')}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'40px' }}>
              <div>
                <p style={{ color:'#f59e0b', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 8px 0', display:'flex', alignItems:'center', gap:'5px' }}>
                  <Star size={11}/> Just Listed
                </p>
                <h2 style={{ color:'white', fontSize:'clamp(1.6rem,3vw,2.2rem)', fontWeight:'800', margin:0 }}>{t('home.hotDeals.title')}</h2>
                <div style={{ width:'40px', height:'3px', background:'#dc2626', borderRadius:'2px', marginTop:'10px' }}/>
              </div>
              <Link to="/cars" style={{ color:'#4b5563', fontSize:'13px', fontWeight:'600', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}
                onMouseEnter={e=>e.currentTarget.style.color='white'} onMouseLeave={e=>e.currentTarget.style.color='#4b5563'}>
                All Cars <ArrowRight size={13}/>
              </Link>
            </div>
          </FadeIn>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))', gap:'20px', marginBottom:'40px' }}>
            {loading ? [...Array(3)].map((_,i)=><SkeletonCard key={i}/>) : featured.map(c=><CarCard key={c.id} car={c}/>)}
          </div>
          <div style={{ textAlign:'center' }}>
            <Link to="/cars" className="shine-hp ghost-hp" style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', color:'white', fontWeight:'600', fontSize:'14px', padding:'13px 28px', borderRadius:'50px', textDecoration:'none', transition:'all 0.2s ease', position:'relative', overflow:'hidden' }}>
              {t('home.hotDeals.viewAllBtn')} <ArrowRight size={14}/>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════ STATS — live sold count ══════════ */}
      <section style={{ background:'#0a0e18', borderTop:'1px solid rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
        <div style={wrap}>
          <div className="stats-flex" style={{ display:'flex' }}>
            {[
              // ── soldDisplay is the live Supabase count ──────────────────
              { Icon:Users,  v:soldDisplay, l:'Cars Sold'        },
              { Icon:Star,   v:'4.9★',      l:'Customer Rating'  },
              { Icon:Shield, v:'RM 0',      l:'Consultation Fee' },
            ].map((s,i,arr)=>(
              <FadeIn key={i} delay={i*0.1} style={{ flex:1 }}>
                <div style={{ textAlign:'center', padding:'36px 20px', borderRight:i<arr.length-1?'1px solid rgba(255,255,255,0.05)':'none' }}>
                  <s.Icon size={16} style={{ color:'#dc2626', margin:'0 auto 10px', display:'block' }}/>
                  <p style={{ color:'white', fontSize:'2rem', fontWeight:'800', fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'0.04em', lineHeight:1, margin:'0 0 4px 0' }}>{s.v}</p>
                  <p style={{ color:'#4b5563', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.1em', margin:0 }}>{s.l}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ WHY DREVO ══════════ */}
      <section style={sec('#080C14')}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom:'40px' }}>
              <p style={{ color:'#dc2626', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 8px 0' }}>Why Drevo</p>
              <h2 style={{ color:'white', fontSize:'clamp(1.6rem,3vw,2.2rem)', fontWeight:'800', margin:0 }}>{t('home.whyChoose.title')}</h2>
              <div style={{ width:'40px', height:'3px', background:'#dc2626', borderRadius:'2px', marginTop:'10px' }}/>
            </div>
          </FadeIn>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'16px' }}>
            {benefits.map((b,i)=>(
              <FadeIn key={i} delay={i*0.08}>
                <div className="card-hp" style={{ ...card, padding:'24px', height:'100%' }}>
                  <div style={{ width:'42px', height:'42px', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.2)', marginBottom:'14px' }}>
                    <b.icon size={18} style={{ color:'#dc2626' }}/>
                  </div>
                  <h3 style={{ color:'white', fontSize:'14px', fontWeight:'700', margin:'0 0 8px 0' }}>{b.title}</h3>
                  <p style={{ color:'#6b7280', fontSize:'13px', lineHeight:'1.65', margin:0 }}>{b.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section id="how-it-works" style={sec('#0a0e18')}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom:'40px' }}>
              <p style={{ color:'#dc2626', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 8px 0' }}>Simple Process</p>
              <h2 style={{ color:'white', fontSize:'clamp(1.6rem,3vw,2.2rem)', fontWeight:'800', margin:0 }}>{t('home.howItWorks.title')}</h2>
              <div style={{ width:'40px', height:'3px', background:'#dc2626', borderRadius:'2px', marginTop:'10px' }}/>
            </div>
          </FadeIn>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'16px' }}>
            {steps.map((s,i)=>(
              <FadeIn key={i} delay={i*0.1}>
                <div className="card-hp" style={{ ...card, padding:'24px', position:'relative', overflow:'hidden', height:'100%' }}>
                  <span style={{ position:'absolute', top:'12px', right:'16px', fontFamily:"'Bebas Neue',sans-serif", fontSize:'4.5rem', lineHeight:1, color:'rgba(220,38,38,0.06)', userSelect:'none', pointerEvents:'none' }}>{s.n}</span>
                  <div style={{ width:'42px', height:'42px', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.2)', marginBottom:'14px' }}>
                    <s.icon size={18} style={{ color:'#dc2626' }}/>
                  </div>
                  <h3 style={{ color:'white', fontSize:'14px', fontWeight:'700', margin:'0 0 8px 0' }}>{s.t}</h3>
                  <p style={{ color:'#6b7280', fontSize:'13px', lineHeight:'1.65', margin:0 }}>{s.d}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ TESTIMONIALS ══════════ */}
      <section style={sec('#080C14')}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom:'40px' }}>
              <p style={{ color:'#dc2626', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 8px 0' }}>Real Buyers</p>
              <h2 style={{ color:'white', fontSize:'clamp(1.6rem,3vw,2.2rem)', fontWeight:'800', margin:0 }}>{t('home.testimonials.title')}</h2>
              <div style={{ width:'40px', height:'3px', background:'#dc2626', borderRadius:'2px', marginTop:'10px' }}/>
            </div>
          </FadeIn>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))', gap:'16px' }}>
            {testimonials.map((item,i)=>(
              <FadeIn key={i} delay={i*0.1}>
                <div style={{ ...card, padding:'24px', height:'100%' }}>
                  <div style={{ display:'flex', gap:'3px', marginBottom:'14px' }}>
                    {[...Array(item.r)].map((_,j)=><Star key={j} size={13} style={{ fill:'#f59e0b', color:'#f59e0b' }}/>)}
                  </div>
                  <p style={{ color:'#d1d5db', fontSize:'13px', lineHeight:'1.7', marginBottom:'20px', fontStyle:'italic' }}>"{item.text}"</p>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(220,38,38,0.15)', border:'1px solid rgba(220,38,38,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ color:'#f87171', fontWeight:'800', fontSize:'14px' }}>{item.name[0]}</span>
                    </div>
                    <div>
                      <p style={{ color:'white', fontWeight:'700', fontSize:'13px', margin:'0 0 2px 0' }}>{item.name}</p>
                      <p style={{ color:'#4b5563', fontSize:'11px', margin:0, display:'flex', alignItems:'center', gap:'3px' }}><MapPin size={10}/>{item.loc}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CALCULATOR ══════════ */}
      <section style={sec('#0a0e18')}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ borderRadius:'20px', overflow:'hidden', position:'relative', background:'linear-gradient(135deg,#0d1117 0%,#1a0808 100%)', border:'1px solid rgba(220,38,38,0.18)', display:'flex', flexWrap:'wrap' }}>
              <div style={{ position:'absolute', top:0, right:0, width:'400px', height:'400px', background:'radial-gradient(circle,rgba(220,38,38,0.07) 0%,transparent 70%)', transform:'translate(30%,-30%)', pointerEvents:'none' }}/>
              <div style={{ padding:'48px', flex:'1', minWidth:'260px', position:'relative', zIndex:1 }}>
                <div style={{ width:'48px', height:'48px', borderRadius:'12px', background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.2)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'20px' }}>
                  <Calculator size={22} style={{ color:'#dc2626' }}/>
                </div>
                <h2 style={{ color:'white', fontSize:'clamp(1.4rem,3vw,2rem)', fontWeight:'800', margin:'0 0 12px 0', lineHeight:1.25 }}>{t('home.budget.title')}</h2>
                <p style={{ color:'#6b7280', fontSize:'14px', lineHeight:'1.7', margin:'0 0 28px 0', maxWidth:'360px' }}>{t('home.budget.subtitle')}</p>
                <Link to="/calculator" className="shine-hp red-btn-hp" style={redBtn}><Calculator size={15}/>{t('home.budget.calcBtn')}</Link>
              </div>
              <div style={{ flex:'1', minWidth:'220px', minHeight:'200px', position:'relative' }}>
                <img src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=60" alt="" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.35, minHeight:'200px' }} loading="lazy"/>
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right,#0d1117 0%,transparent 55%)' }}/>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════ FOR DEALERS ══════════ */}
      <section style={{ ...sec('#080C14'), borderTop:'1px solid rgba(255,255,255,0.04)' }}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ ...card, padding:'48px', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:'32px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 80% 50%,rgba(220,38,38,0.05) 0%,transparent 60%)', pointerEvents:'none' }}/>
              <div style={{ flex:1, minWidth:'240px', position:'relative', zIndex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
                  <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#dc2626', display:'inline-block', animation:'pulse-red 2.5s infinite' }}/>
                  <span style={{ color:'#dc2626', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em' }}>For Car Dealers</span>
                </div>
                <h2 style={{ color:'white', fontSize:'clamp(1.4rem,3vw,1.9rem)', fontWeight:'800', margin:'0 0 12px 0', lineHeight:1.25 }}>
                  Run your dealership smarter with <span style={{ color:'#dc2626' }}>ShiftOS.</span>
                </h2>
                <p style={{ color:'#6b7280', fontSize:'13px', lineHeight:'1.7', margin:0, maxWidth:'460px' }}>
                  Manage listings, track your team, generate TikTok content, and grow sales — all from one dashboard built for Malaysian dealers.
                </p>
              </div>
              <div style={{ flexShrink:0, position:'relative', zIndex:1 }}>
                <Link to="/for-dealers" className="shine-hp red-btn-hp" style={redBtn}>Learn About ShiftOS <ArrowRight size={15}/></Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════ FINAL CTA ══════════ */}
      <section id="contact" style={{ ...sec('#0a0e18'), position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'600px', height:'600px', background:'radial-gradient(circle,rgba(220,38,38,0.06) 0%,transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ ...wrap, maxWidth:'700px', textAlign:'center', position:'relative', zIndex:1 }}>
          <FadeIn>
            <p style={{ color:'#dc2626', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:'16px' }}>Ready to Drive?</p>
            <h2 style={{ color:'white', fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(2.5rem,7vw,5rem)', letterSpacing:'0.02em', lineHeight:1, margin:'0 0 20px 0' }}>
              {t('home.cta.title')}
            </h2>
            <p style={{ color:'#6b7280', fontSize:'16px', lineHeight:'1.7', margin:'0 0 40px 0' }}>{t('home.cta.subtitle')}</p>
            <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
              <Link to="/cars" className="shine-hp red-btn-hp" style={redBtn}>{t('home.cta.browseBtn')} <ArrowRight size={15}/></Link>
              <a href="https://wa.me/60174155191?text=Hi%20Drevo%2C%20I%20need%20help%20finding%20a%20car" target="_blank" rel="noopener noreferrer" className="wa-btn-hp" style={waBtn}>
                <MessageCircle size={15}/>{t('home.cta.whatsappBtn')}
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