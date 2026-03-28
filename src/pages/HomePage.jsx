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
import { useSiteProfile } from '../hooks/useSiteProfile';

const CAR_FIELDS = 'id,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,images,status,created_at';
const HERO_IMG   = 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1400&auto=format&fit=crop&q=70';
const BRANDS     = ['Perodua','Proton','Honda','Toyota','Mazda','BMW','Mercedes','Hyundai','Nissan','Mitsubishi'];
const BODY_TYPES = ['Sedan','SUV','Hatchback','MPV','Pickup','Coupe'];
const BUDGET_OPTIONS = [
  { value:'30000',  label:'Under RM 30k'  },
  { value:'50000',  label:'Under RM 50k'  },
  { value:'80000',  label:'Under RM 80k'  },
  { value:'120000', label:'Under RM 120k' },
  { value:'200000', label:'Under RM 200k' },
];

const isHotDeal = (c) => {
  const op = c.original_price, sp = c.selling_price;
  return op && op > 0 && sp > 0 && sp <= op * 0.97;
};

function CustomSelect({ label, icon: Icon, value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected ? selected.label : placeholder;

  return (
    <div ref={ref} style={{ position:'relative', width:'100%' }}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        style={{
          width:'100%', display:'flex', alignItems:'center', gap:'10px',
          background: open ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
          border:`1px solid ${open ? 'rgba(220,38,38,0.5)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius:'10px', padding:'12px 14px',
          cursor:'pointer', transition:'all 0.2s',
          fontFamily:"'DM Sans',sans-serif", outline:'none',
        }}
      >
        <Icon size={14} style={{ color: open ? '#dc2626' : '#4b5563', flexShrink:0, transition:'color 0.2s' }} />
        <div style={{ flex:1, minWidth:0, textAlign:'left' }}>
          <p style={{ color:'#4b5563', fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 3px 0' }}>{label}</p>
          <p style={{ color: value ? 'white' : '#6b7280', fontSize:'13px', fontWeight: value ? '600' : '400', margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {displayLabel}
          </p>
        </div>
        <ChevronDown size={12} style={{ color:'#374151', flexShrink:0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s' }} />
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:9999,
          background:'#0d1117', border:'1px solid rgba(220,38,38,0.2)',
          borderRadius:'12px', overflow:'hidden',
          boxShadow:'0 20px 50px rgba(0,0,0,0.7)', animation:'dropIn 0.15s ease',
        }}>
          <button type="button" onClick={() => { onChange(''); setOpen(false); }}
            style={{ width:'100%', textAlign:'left', padding:'10px 16px', background: !value ? 'rgba(220,38,38,0.08)' : 'transparent', border:'none', borderBottom:'1px solid rgba(255,255,255,0.05)', color: !value ? '#f87171' : '#6b7280', fontSize:'13px', fontWeight: !value ? '600' : '400', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}
            onMouseEnter={e => { if (value) e.currentTarget.style.background='rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = !value ? 'rgba(220,38,38,0.08)' : 'transparent'; }}
          >{placeholder}</button>
          {options.map((opt, i) => {
            const isSelected = value === opt.value;
            return (
              <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{ width:'100%', textAlign:'left', padding:'10px 16px', background: isSelected ? 'rgba(220,38,38,0.1)' : 'transparent', border:'none', borderBottom: i === options.length-1 ? 'none' : '1px solid rgba(255,255,255,0.03)', color: isSelected ? '#f87171' : '#d1d5db', fontSize:'13px', fontWeight: isSelected ? '600' : '400', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'space-between' }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background='rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'rgba(220,38,38,0.1)' : 'transparent'; }}
              >
                {opt.label}
                {isSelected && <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#dc2626', display:'inline-block', flexShrink:0 }}/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FadeIn({ children, delay = 0, style = {} }) {
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } }, { threshold:0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ opacity:v?1:0, transform:v?'translateY(0)':'translateY(28px)', transition:`opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`, ...style }}>
      {children}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background:'#0d1117', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', overflow:'hidden' }}>
      <div style={{ height:'200px', background:'linear-gradient(90deg,#111827 25%,#1f2937 50%,#111827 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.5s infinite' }}/>
      <div style={{ padding:'16px' }}>
        {[70,50,90,100].map((w,i) => <div key={i} style={{ height:'12px', width:`${w}%`, background:'#1f2937', borderRadius:'6px', marginBottom:'10px', animation:'shimmer 1.5s infinite' }}/>)}
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

const HomePage = () => {
  const { t } = useTranslation();
  const { siteName, waUrl } = useSiteProfile();
  const [featured,  setFeatured]  = useState([]);
  const [hotDeals,  setHotDeals]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [stock,     setStock]     = useState(0);
  const [soldCount, setSoldCount] = useState(null);
  const [brand,     setBrand]     = useState('');
  const [bodyType,  setBodyType]  = useState('');
  const [maxPrice,  setMaxPrice]  = useState('');

  useEffect(() => {
    let ch, soldCh;
    const load = async () => {
      const { data, error, count } = await supabase
        .from('car_listings').select(CAR_FIELDS,{ count:'exact' })
        .eq('status','active').order('created_at',{ ascending:false }).limit(60);
      if (!error && data) {
        setFeatured(data.slice(0,6));
        setStock(count || data.length);
        setHotDeals(data.filter(isHotDeal).sort((a,b)=>((b.original_price-b.selling_price)/b.original_price)-((a.original_price-a.selling_price)/a.original_price)).slice(0,6));
      }
      setLoading(false);
    };
    const fetchSoldCount = async () => {
      const { count } = await supabase.from('car_listings').select('id',{ count:'exact', head:true }).eq('status','sold');
      setSoldCount(count || 0);
    };
    load(); fetchSoldCount();
    ch     = supabase.channel('home').on('postgres_changes',{event:'*',schema:'public',table:'car_listings'},load).subscribe();
    soldCh = supabase.channel('home_sold').on('postgres_changes',{event:'UPDATE',schema:'public',table:'car_listings'},fetchSoldCount).subscribe();
    return () => { if (ch) supabase.removeChannel(ch); if (soldCh) supabase.removeChannel(soldCh); };
  }, []);

  const searchUrl = () => {
    const p = new URLSearchParams();
    if (brand)    p.set('brand', brand);
    if (bodyType) p.set('body_type', bodyType);
    if (maxPrice) p.set('max_price', maxPrice);
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

  const soldDisplay = soldCount !== null && soldCount > 0 ? `${soldCount}+` : soldCount === 0 ? '0' : '500+';
  const wrap = { maxWidth:'1280px', margin:'0 auto', padding:'0 16px' };
  const sec  = (bg) => ({ background:bg||'#080C14', padding:'60px 0' });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Bebas+Neue&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        html, body { overflow-x: hidden; width: 100%; }
        body { background: #080C14 !important; margin: 0 !important; }

        @keyframes shimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes pulse-red{ 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.45)} 50%{box-shadow:0 0 0 12px rgba(220,38,38,0)} }
        @keyframes dropIn   { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }

        .shine-hp { position:relative; overflow:hidden; }
        .shine-hp::before { content:''; position:absolute; top:0; left:-80%; width:60%; height:100%; background:linear-gradient(120deg,transparent,rgba(255,255,255,0.2),transparent); transform:skewX(-20deg); transition:left 0.5s ease; }
        .shine-hp:hover::before { left:130%; }
        .red-btn-hp:hover  { background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%) !important; transform:translateY(-1px); }
        .wa-btn-hp:hover   { background:rgba(37,211,102,0.2) !important; border-color:rgba(37,211,102,0.45) !important; }
        .ghost-hp:hover    { background:rgba(255,255,255,0.08) !important; }
        .card-hp { transition:transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease !important; }
        .card-hp:hover { transform:translateY(-3px) !important; box-shadow:0 16px 40px rgba(0,0,0,0.45) !important; border-color:rgba(220,38,38,0.25) !important; }

        /* ── Search grid ── */
        .search-grid-hp {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr auto;
          gap: 10px;
          align-items: stretch;
        }

        /* ── Hero buttons ── */
        .hero-btns-hp { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:28px; }

        /* ── Stats strip ── */
        .stats-flex { display:flex; }

        /* ── Section padding ── */
        .sec-pad { padding: 60px 0; }

        /* ── Tablet ── */
        @media(max-width: 768px) {
          .search-grid-hp {
            grid-template-columns: 1fr 1fr !important;
          }
          .search-btn-hp {
            grid-column: 1 / -1 !important;
          }
        }

        /* ── Mobile ── */
        @media(max-width: 480px) {
          .search-grid-hp {
            grid-template-columns: 1fr !important;
          }
          .search-btn-hp {
            grid-column: 1 !important;
          }
          .hero-btns-hp {
            flex-direction: column !important;
          }
          .hero-btns-hp a,
          .hero-btns-hp button {
            justify-content: center !important;
            width: 100% !important;
          }
          .stats-flex {
            flex-direction: column !important;
          }
          .stats-flex > div {
            border-right: none !important;
            border-bottom: 1px solid rgba(255,255,255,0.05) !important;
          }
          .for-dealers-inner {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .sec-pad { padding: 40px 0 !important; }
        }
      `}</style>

      <Helmet>
        <title>{siteName} — Buy Trusted Used Cars in Malaysia</title>
        <meta name="description" content="Browse 200+ verified used cars from trusted Malaysian dealers. Transparent pricing, no hidden fees, free consultation." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preload" as="image" href={HERO_IMG} />
      </Helmet>

      <Header />

      {/* ══════════ HERO ══════════ */}
      <section style={{ position:'relative', display:'flex', flexDirection:'column', justifyContent:'center', background:'#080C14', overflow:'visible', paddingTop:'80px', paddingBottom:'80px' }}>
        {/* Background */}
        <div style={{ position:'absolute', inset:0, zIndex:0, overflow:'hidden' }}>
          <img src={HERO_IMG} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 30%', opacity:0.28 }}/>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right,rgba(8,12,20,0.97) 25%,rgba(8,12,20,0.65) 60%,rgba(8,12,20,0.25) 100%)' }}/>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,#080C14 0%,transparent 50%)' }}/>
        </div>

        <div style={{ ...wrap, position:'relative', zIndex:1, width:'100%' }}>
          <motion.div initial={{ opacity:0, y:40 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.8, ease:[0.22,1,0.36,1] }}>
            {/* Eyebrow */}
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
              <div style={{ width:'28px', height:'2px', background:'#dc2626', flexShrink:0 }}/>
              <span style={{ color:'#dc2626', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em' }}>Malaysia's Trusted Car Platform</span>
            </div>

            {/* Headline */}
            <h1 style={{ color:'white', margin:'0 0 14px 0', lineHeight:1, fontSize:'clamp(2.6rem,10vw,5.5rem)', fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'0.02em', wordBreak:'break-word' }}>
              Find Your<br/>
              <span style={{ background:'linear-gradient(135deg,#ffffff 0%,#dc2626 55%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                Perfect Drive.
              </span>
            </h1>

            {/* Subheadline */}
            <p style={{ color:'#9ca3af', fontSize:'clamp(13px,3.5vw,16px)', margin:'0 0 24px 0', maxWidth:'100%', lineHeight:1.6 }}>
              Browse <span style={{ color:'white', fontWeight:'700' }}>{stock > 0 ? `${stock}+` : 'verified'} cars</span> from trusted Malaysian dealers. Transparent pricing, no hidden fees.
            </p>

            {/* CTA buttons */}
            <div className="hero-btns-hp">
              <Link to="/cars" className="shine-hp red-btn-hp" style={redBtn}>Browse Cars <ArrowRight size={15}/></Link>
              <a href="{waUrl(`Hi ${siteName}, I need help finding a car`)}" target="_blank" rel="noopener noreferrer" className="wa-btn-hp" style={waBtn}>
                <MessageCircle size={15}/> WhatsApp Us
              </a>
            </div>
          </motion.div>

          {/* ── Search bar ── */}
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.45, duration:0.65, ease:[0.22,1,0.36,1] }} style={{ position:'relative', zIndex:10 }}>
            <div style={{ background:'rgba(10,14,24,0.92)', backdropFilter:'blur(24px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px 16px 0 0', padding:'14px' }}>
              <div className="search-grid-hp">
                <CustomSelect label="Brand"  icon={Search}     value={brand}    onChange={setBrand}    placeholder="All Brands" options={BRANDS.map(b=>({ value:b, label:b }))} />
                <CustomSelect label="Type"   icon={Zap}        value={bodyType} onChange={setBodyType} placeholder="All Types"  options={BODY_TYPES.map(b=>({ value:b, label:b }))} />
                <CustomSelect label="Budget" icon={DollarSign} value={maxPrice} onChange={setMaxPrice} placeholder="Any Price" options={BUDGET_OPTIONS} />
                <Link
                  to={searchUrl()}
                  className="search-btn-hp shine-hp"
                  style={{ ...redBtn, borderRadius:'10px', padding:'12px 20px', whiteSpace:'nowrap', justifyContent:'center', animation:'pulse-red 2.5s infinite', textAlign:'center' }}
                >
                  <Search size={15}/> Search
                </Link>
              </div>
            </div>

            {/* Trust strip */}
            <div className="stats-flex" style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.06)', borderTop:'none', borderRadius:'0 0 16px 16px' }}>
              {[
                { v: stock>0?`${stock}+`:'50+', l:'Cars Available'    },
                { v:'< 1 Hour',                  l:'WhatsApp Response' },
                { v:'100%',                      l:'Verified Listings' },
              ].map((item,i,arr)=>(
                <div key={i} style={{ flex:1, textAlign:'center', padding:'12px 8px', borderRight:i<arr.length-1?'1px solid rgba(255,255,255,0.05)':'none' }}>
                  <p style={{ color:'white', fontSize:'13px', fontWeight:'700', margin:'0 0 2px 0' }}>{item.v}</p>
                  <p style={{ color:'#4b5563', fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.08em', margin:0 }}>{item.l}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'80px', background:'linear-gradient(to bottom,transparent,#080C14)', zIndex:0, pointerEvents:'none' }}/>
      </section>

      {/* ══════════ HOT DEALS ══════════ */}
      {(hotDeals.length > 0 || loading) && (
        <section className="sec-pad" style={{ background:'#080C14' }}>
          <div style={wrap}>
            <FadeIn>
              <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'32px', flexWrap:'wrap', gap:'12px' }}>
                <div>
                  <p style={{ color:'#dc2626', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 8px 0', display:'flex', alignItems:'center', gap:'5px' }}>
                    <Flame size={11}/> Limited Time
                  </p>
                  <h2 style={{ color:'white', fontSize:'clamp(1.4rem,5vw,2.2rem)', fontWeight:'800', margin:0 }}>Hot Deals</h2>
                  <div style={{ width:'40px', height:'3px', background:'#dc2626', borderRadius:'2px', marginTop:'10px' }}/>
                </div>
                <Link to="/cars?hot_deals=true" style={{ color:'#4b5563', fontSize:'13px', fontWeight:'600', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}
                  onMouseEnter={e=>e.currentTarget.style.color='white'} onMouseLeave={e=>e.currentTarget.style.color='#4b5563'}>
                  View All <ArrowRight size={13}/>
                </Link>
              </div>
            </FadeIn>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'16px' }}>
              {loading ? [...Array(3)].map((_,i)=><SkeletonCard key={i}/>) : hotDeals.map(c=><CarCard key={c.id} car={c}/>)}
            </div>
          </div>
        </section>
      )}

      {/* ══════════ FEATURED ══════════ */}
      <section className="sec-pad" style={{ background:'#0a0e18' }}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'32px', flexWrap:'wrap', gap:'12px' }}>
              <div>
                <p style={{ color:'#f59e0b', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 8px 0', display:'flex', alignItems:'center', gap:'5px' }}>
                  <Star size={11}/> Just Listed
                </p>
                <h2 style={{ color:'white', fontSize:'clamp(1.4rem,5vw,2.2rem)', fontWeight:'800', margin:0 }}>{t('home.hotDeals.title')}</h2>
                <div style={{ width:'40px', height:'3px', background:'#dc2626', borderRadius:'2px', marginTop:'10px' }}/>
              </div>
              <Link to="/cars" style={{ color:'#4b5563', fontSize:'13px', fontWeight:'600', textDecoration:'none', display:'flex', alignItems:'center', gap:'4px' }}
                onMouseEnter={e=>e.currentTarget.style.color='white'} onMouseLeave={e=>e.currentTarget.style.color='#4b5563'}>
                All Cars <ArrowRight size={13}/>
              </Link>
            </div>
          </FadeIn>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'16px', marginBottom:'32px' }}>
            {loading ? [...Array(3)].map((_,i)=><SkeletonCard key={i}/>) : featured.map(c=><CarCard key={c.id} car={c}/>)}
          </div>
          <div style={{ textAlign:'center' }}>
            <Link to="/cars" className="shine-hp ghost-hp" style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', color:'white', fontWeight:'600', fontSize:'14px', padding:'13px 28px', borderRadius:'50px', textDecoration:'none', transition:'all 0.2s ease', position:'relative', overflow:'hidden' }}>
              {t('home.hotDeals.viewAllBtn')} <ArrowRight size={14}/>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════ STATS ══════════ */}
      <section style={{ background:'#0a0e18', borderTop:'1px solid rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
        <div style={wrap}>
          <div className="stats-flex">
            {[
              { Icon:Users,  v:soldDisplay, l:'Cars Sold'        },
              { Icon:Star,   v:'4.9★',      l:'Customer Rating'  },
              { Icon:Shield, v:'RM 0',      l:'Consultation Fee' },
            ].map((s,i,arr)=>(
              <FadeIn key={i} delay={i*0.1} style={{ flex:1 }}>
                <div style={{ textAlign:'center', padding:'32px 16px', borderRight:i<arr.length-1?'1px solid rgba(255,255,255,0.05)':'none' }}>
                  <s.Icon size={16} style={{ color:'#dc2626', margin:'0 auto 10px', display:'block' }}/>
                  <p style={{ color:'white', fontSize:'clamp(1.4rem,5vw,2rem)', fontWeight:'800', fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'0.04em', lineHeight:1, margin:'0 0 4px 0' }}>{s.v}</p>
                  <p style={{ color:'#4b5563', fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.1em', margin:0 }}>{s.l}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ WHY XDRIVE ══════════ */}
      <section className="sec-pad" style={{ background:'#080C14' }}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom:'32px' }}>
              <p style={{ color:'#dc2626', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 8px 0' }}>Why {siteName}</p>
              <h2 style={{ color:'white', fontSize:'clamp(1.4rem,5vw,2.2rem)', fontWeight:'800', margin:0 }}>{t('home.whyChoose.title')}</h2>
              <div style={{ width:'40px', height:'3px', background:'#dc2626', borderRadius:'2px', marginTop:'10px' }}/>
            </div>
          </FadeIn>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'14px' }}>
            {benefits.map((b,i)=>(
              <FadeIn key={i} delay={i*0.08}>
                <div className="card-hp" style={{ ...card, padding:'20px', height:'100%' }}>
                  <div style={{ width:'40px', height:'40px', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.2)', marginBottom:'12px' }}>
                    <b.icon size={17} style={{ color:'#dc2626' }}/>
                  </div>
                  <h3 style={{ color:'white', fontSize:'13px', fontWeight:'700', margin:'0 0 6px 0' }}>{b.title}</h3>
                  <p style={{ color:'#6b7280', fontSize:'12px', lineHeight:'1.6', margin:0 }}>{b.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section id="how-it-works" className="sec-pad" style={{ background:'#0a0e18' }}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom:'32px' }}>
              <p style={{ color:'#dc2626', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 8px 0' }}>Simple Process</p>
              <h2 style={{ color:'white', fontSize:'clamp(1.4rem,5vw,2.2rem)', fontWeight:'800', margin:0 }}>{t('home.howItWorks.title')}</h2>
              <div style={{ width:'40px', height:'3px', background:'#dc2626', borderRadius:'2px', marginTop:'10px' }}/>
            </div>
          </FadeIn>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'14px' }}>
            {steps.map((s,i)=>(
              <FadeIn key={i} delay={i*0.1}>
                <div className="card-hp" style={{ ...card, padding:'20px', position:'relative', overflow:'hidden', height:'100%' }}>
                  <span style={{ position:'absolute', top:'8px', right:'12px', fontFamily:"'Bebas Neue',sans-serif", fontSize:'4rem', lineHeight:1, color:'rgba(220,38,38,0.06)', userSelect:'none', pointerEvents:'none' }}>{s.n}</span>
                  <div style={{ width:'40px', height:'40px', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.2)', marginBottom:'12px' }}>
                    <s.icon size={17} style={{ color:'#dc2626' }}/>
                  </div>
                  <h3 style={{ color:'white', fontSize:'13px', fontWeight:'700', margin:'0 0 6px 0' }}>{s.t}</h3>
                  <p style={{ color:'#6b7280', fontSize:'12px', lineHeight:'1.6', margin:0 }}>{s.d}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ TESTIMONIALS ══════════ */}
      <section className="sec-pad" style={{ background:'#080C14' }}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ marginBottom:'32px' }}>
              <p style={{ color:'#dc2626', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 8px 0' }}>Real Buyers</p>
              <h2 style={{ color:'white', fontSize:'clamp(1.4rem,5vw,2.2rem)', fontWeight:'800', margin:0 }}>{t('home.testimonials.title')}</h2>
              <div style={{ width:'40px', height:'3px', background:'#dc2626', borderRadius:'2px', marginTop:'10px' }}/>
            </div>
          </FadeIn>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'14px' }}>
            {testimonials.map((item,i)=>(
              <FadeIn key={i} delay={i*0.1}>
                <div style={{ ...card, padding:'20px', height:'100%' }}>
                  <div style={{ display:'flex', gap:'3px', marginBottom:'12px' }}>
                    {[...Array(item.r)].map((_,j)=><Star key={j} size={13} style={{ fill:'#f59e0b', color:'#f59e0b' }}/>)}
                  </div>
                  <p style={{ color:'#d1d5db', fontSize:'13px', lineHeight:'1.7', marginBottom:'16px', fontStyle:'italic' }}>"{item.text}"</p>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:'rgba(220,38,38,0.15)', border:'1px solid rgba(220,38,38,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ color:'#f87171', fontWeight:'800', fontSize:'13px' }}>{item.name[0]}</span>
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
      <section className="sec-pad" style={{ background:'#0a0e18' }}>
        <div style={wrap}>
          <FadeIn>
            <div style={{ borderRadius:'16px', overflow:'hidden', position:'relative', background:'linear-gradient(135deg,#0d1117 0%,#1a0808 100%)', border:'1px solid rgba(220,38,38,0.18)', display:'flex', flexWrap:'wrap' }}>
              <div style={{ padding:'32px', flex:'1', minWidth:'240px', position:'relative', zIndex:1 }}>
                <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.2)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'16px' }}>
                  <Calculator size={20} style={{ color:'#dc2626' }}/>
                </div>
                <h2 style={{ color:'white', fontSize:'clamp(1.2rem,4vw,1.8rem)', fontWeight:'800', margin:'0 0 10px 0', lineHeight:1.25 }}>{t('home.budget.title')}</h2>
                <p style={{ color:'#6b7280', fontSize:'13px', lineHeight:'1.7', margin:'0 0 24px 0' }}>{t('home.budget.subtitle')}</p>
                <Link to="/calculator" className="shine-hp red-btn-hp" style={redBtn}><Calculator size={15}/>{t('home.budget.calcBtn')}</Link>
              </div>
              <div style={{ flex:'1', minWidth:'200px', minHeight:'180px', position:'relative' }}>
                <img src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=60" alt="" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.35, minHeight:'180px' }} loading="lazy"/>
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right,#0d1117 0%,transparent 55%)' }}/>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════ FOR DEALERS ══════════ */}
      <section className="sec-pad" style={{ background:'#080C14', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
        <div style={wrap}>
          <FadeIn>
            <div className="for-dealers-inner" style={{ ...card, padding:'32px', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:'24px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 80% 50%,rgba(220,38,38,0.05) 0%,transparent 60%)', pointerEvents:'none' }}/>
              <div style={{ flex:1, minWidth:'200px', position:'relative', zIndex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
                  <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#dc2626', display:'inline-block', animation:'pulse-red 2.5s infinite' }}/>
                  <span style={{ color:'#dc2626', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em' }}>For Car Dealers</span>
                </div>
                <h2 style={{ color:'white', fontSize:'clamp(1.2rem,4vw,1.8rem)', fontWeight:'800', margin:'0 0 10px 0', lineHeight:1.25 }}>
                  Run your dealership smarter with <span style={{ color:'#dc2626' }}>ShiftOS.</span>
                </h2>
                <p style={{ color:'#6b7280', fontSize:'13px', lineHeight:'1.7', margin:0 }}>
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
      <section id="contact" className="sec-pad" style={{ background:'#0a0e18', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'400px', height:'400px', background:'radial-gradient(circle,rgba(220,38,38,0.06) 0%,transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ ...wrap, maxWidth:'600px', textAlign:'center', position:'relative', zIndex:1 }}>
          <FadeIn>
            <p style={{ color:'#dc2626', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:'14px' }}>Ready to Drive?</p>
            <h2 style={{ color:'white', fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(2rem,8vw,4.5rem)', letterSpacing:'0.02em', lineHeight:1, margin:'0 0 16px 0' }}>
              {t('home.cta.title')}
            </h2>
            <p style={{ color:'#6b7280', fontSize:'clamp(13px,3.5vw,15px)', lineHeight:'1.7', margin:'0 0 32px 0' }}>{t('home.cta.subtitle')}</p>
            <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
              <Link to="/cars" className="shine-hp red-btn-hp" style={redBtn}>{t('home.cta.browseBtn')} <ArrowRight size={15}/></Link>
              <a href="{waUrl(`Hi ${siteName}, I need help finding a car`)}" target="_blank" rel="noopener noreferrer" className="wa-btn-hp" style={waBtn}>
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
