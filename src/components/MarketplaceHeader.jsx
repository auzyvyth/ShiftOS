import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { X, Flame, Menu, Phone, Heart, Car, Sparkles, RefreshCw, Search, Building2, TrendingUp, Crown, User, Star, ChevronDown } from 'lucide-react';
import { useSavedCars } from '../hooks/useSavedCars';
import SavedCarsPanel from './SavedCarsPanel';
import AnnouncementBar from './AnnouncementBar';
import useMarketplaceSettings from '../hooks/useMarketplaceSettings';
import { PLAN_CONFIG } from '../utils/planConfig';

// Tier copy from the single source of truth (planConfig) so header never drifts.
const tierSub = (k) => {
  const c = PLAN_CONFIG[k];
  return c.listingCap == null
    ? 'Unlimited listings & seats'
    : `${c.listingCap} listings · ${c.seatCap} seat${c.seatCap > 1 ? 's' : ''}`;
};
const tierName = (k) => PLAN_CONFIG[k].label.replace('Dealer ', '').replace('Salesman ', '');

const CONDITIONS = [
  { v: 'used',  Icon: Car,       label: 'Used Cars',      desc: 'Inspected pre-owned from trusted dealers' },
  { v: 'new',   Icon: Sparkles,  label: 'New Cars',       desc: 'Brand-new units straight from showrooms' },
  { v: 'recon', Icon: RefreshCw, label: 'Recon / Import', desc: 'Reconditioned imports, graded & verified' },
];

export default function MarketplaceHeader() {
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [mCondOpen, setMCondOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [q, setQ]                 = useState('');
  const [cat, setCat]             = useState('');
  const { savedIds }              = useSavedCars();
  const { settings }              = useMarketplaceSettings();
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const sp = new URLSearchParams(search);
  const isHotDeals = sp.get('hot_deals') === 'true';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const submitSearch = (e) => {
    e?.preventDefault();
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (cat)      p.set('condition', cat);
    navigate(`/showroom${p.toString() ? `?${p}` : ''}`);
    setMenuOpen(false);
  };

  return (
    <>
      <AnnouncementBar />
      <style>{`
        .mh-root { position:sticky; top:0; z-index:100; background:#ffffff; border-bottom:1px solid #ECEAE3; transition:box-shadow 0.25s, border-color 0.25s; font-family:'Outfit',sans-serif; }
        .mh-root.scrolled { box-shadow:0 1px 0 rgba(0,0,0,0.03), 0 10px 30px rgba(15,23,42,0.08); border-bottom-color:#E5E7EB; }
        .mh-bar { max-width:1380px; margin:0 auto; padding:0 clamp(16px,3.5vw,44px); height:74px; display:flex; align-items:center; gap:clamp(14px,2.5vw,32px); }

        /* logo */
        .mh-logo { text-decoration:none; display:flex; align-items:baseline; gap:2px; flex-shrink:0; }
        .mh-logo-x { font-family:'Bebas Neue',sans-serif; font-size:30px; letter-spacing:0.03em; line-height:1; color:#dc2626; }
        .mh-logo-t { font-family:'Bebas Neue',sans-serif; font-size:30px; letter-spacing:0.03em; line-height:1; color:#0f1115; }
        .mh-logo-my { font-size:10px; font-weight:800; color:#C4A265; letter-spacing:0.12em; margin-left:3px; }

        /* search */
        .mh-search { display:flex; align-items:center; gap:9px; flex:1; max-width:600px; background:#F4F3EF; border:1.5px solid #E7E4DB; border-radius:13px; padding:0 6px 0 15px; height:48px; transition:border-color .15s, box-shadow .15s, background .15s; }
        .mh-search:focus-within { background:#fff; border-color:#dc2626; box-shadow:0 0 0 4px rgba(220,38,38,0.10); }
        .mh-search-ico { color:#9ca3af; flex-shrink:0; }
        .mh-search-input { flex:1; min-width:0; border:none; background:none; outline:none; font-family:inherit; font-size:14.5px; color:#0f1115; font-weight:500; }
        .mh-search-input::placeholder { color:#9ca3af; font-weight:400; }
        .mh-search-cat { border:none; background:none; outline:none; font-family:inherit; font-size:13px; font-weight:700; color:#374151; cursor:pointer; border-left:1px solid #E0DDD3; padding:0 6px 0 11px; height:26px; flex-shrink:0; -webkit-appearance:none; appearance:none; }
        .mh-search-btn { flex-shrink:0; background:#dc2626; color:#fff; border:none; border-radius:10px; height:36px; padding:0 18px; font-family:inherit; font-size:13.5px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px; transition:background .15s, transform .12s; }
        .mh-search-btn:hover { background:#b91c1c; transform:translateY(-1px); }

        /* right cluster */
        .mh-actions { display:flex; align-items:center; gap:6px; flex-shrink:0; margin-left:auto; }
        .mh-link { display:flex; align-items:center; gap:6px; color:#3f4654; font-size:13.5px; font-weight:600; text-decoration:none; padding:9px 12px; border-radius:10px; transition:background .14s,color .14s; white-space:nowrap; background:none; border:none; cursor:pointer; position:relative; font-family:inherit; }
        .mh-link:hover { background:#F4F3EF; color:#0f1115; }
        .mh-link.hot { color:#ea580c; }
        .mh-link.hot:hover { background:#fff7ed; color:#c2410c; }
        .mh-link.active { color:#dc2626; }
        .mh-saved-badge { position:absolute; top:1px; right:1px; background:#dc2626; color:#fff; font-size:9px; font-weight:800; border-radius:20px; min-width:15px; height:15px; display:flex; align-items:center; justify-content:center; padding:0 4px; line-height:1; }
        .mh-divider { width:1px; height:24px; background:#E7E4DB; margin:0 4px; flex-shrink:0; }
        .mh-signin { color:#0f1115; font-size:13.5px; font-weight:600; text-decoration:none; padding:9px 14px; border-radius:10px; border:1.5px solid #E2DFD6; transition:border-color .14s,background .14s; white-space:nowrap; font-family:inherit; }
        .mh-signin:hover { border-color:#cfcabb; background:#FAF9F6; }

        /* get-started CTA + mega */
        .mh-dd { position:relative; }
        .mh-cta { display:flex; align-items:center; gap:7px; background:#0f1115; color:#fff; font-size:13.5px; font-weight:700; padding:10px 16px; border-radius:11px; border:none; cursor:pointer; font-family:inherit; white-space:nowrap; transition:background .15s,transform .12s,box-shadow .15s; box-shadow:0 1px 2px rgba(0,0,0,0.18); }
        .mh-cta:hover { background:#dc2626; transform:translateY(-1px); box-shadow:0 8px 22px rgba(220,38,38,0.26); }
        .mh-cta-chev { transition:transform .2s; }
        .mh-dd:hover .mh-cta-chev { transform:rotate(180deg); }
        .mh-menu { position:absolute; top:100%; right:0; padding-top:13px; display:none; z-index:200; }
        .mh-dd:hover .mh-menu { display:block; }
        .mh-mega { background:#fff; border:1px solid #ECEAE3; border-radius:18px; padding:10px; box-shadow:0 22px 60px rgba(15,23,42,0.18); animation:mhFade .16s ease; }
        @keyframes mhFade { from { opacity:0; transform:translateY(-5px); } to { opacity:1; transform:none; } }
        .mh-row { display:flex; align-items:flex-start; gap:13px; padding:11px 12px; border-radius:13px; text-decoration:none; transition:background .13s; }
        .mh-row:hover { background:#F7F5F0; }
        .mh-row-ico { width:40px; height:40px; border-radius:12px; background:#FEF2F2; color:#dc2626; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background .13s; }
        .mh-row:hover .mh-row-ico { background:#FEE2E2; }
        .mh-row-tt { color:#0f1115; font-size:14px; font-weight:700; line-height:1.2; }
        .mh-row-ds { color:#6b7280; font-size:12px; font-weight:500; margin-top:3px; line-height:1.35; display:block; }
        .mh-mega-head { font-size:10.5px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#9ca3af; padding:9px 12px 4px; }

        /* mobile */
        .mh-burger { display:none; background:#F4F3EF; border:1px solid #E7E4DB; color:#0f1115; border-radius:11px; padding:9px; cursor:pointer; align-items:center; justify-content:center; }
        .mh-burger:hover { background:#EDEBE4; }
        .mh-mobile { display:none; flex-direction:column; padding:14px 18px 20px; border-top:1px solid #ECEAE3; background:#fff; gap:4px; }
        .mh-m-search { display:flex; align-items:center; gap:9px; background:#F4F3EF; border:1.5px solid #E7E4DB; border-radius:12px; padding:0 6px 0 13px; height:48px; margin-bottom:8px; }
        .mh-m-search input { flex:1; min-width:0; border:none; background:none; outline:none; font-family:inherit; font-size:14px; color:#0f1115; }
        .mh-m-search button { flex-shrink:0; background:#dc2626; color:#fff; border:none; border-radius:9px; height:36px; padding:0 14px; font-weight:700; font-size:13px; cursor:pointer; }
        .mh-m-link { color:#374151; font-size:15px; font-weight:600; text-decoration:none; padding:13px 6px; border-bottom:1px solid #F1EFE9; display:flex; align-items:center; gap:9px; background:none; border-left:none; border-right:none; border-top:none; cursor:pointer; width:100%; text-align:left; font-family:inherit; justify-content:space-between; }
        .mh-m-sub { padding:2px 0 8px 18px; display:flex; flex-direction:column; }
        .mh-m-sub a { color:#6b7280; font-size:13.5px; font-weight:500; text-decoration:none; padding:9px 0; display:flex; align-items:center; gap:8px; }
        .mh-m-cta { margin-top:12px; display:flex; align-items:center; justify-content:center; gap:7px; background:#dc2626; color:#fff; font-size:15px; font-weight:700; padding:14px; border-radius:12px; text-decoration:none; }
        .mh-m-cta.alt { margin-top:8px; background:#fff; color:#dc2626; border:1.5px solid rgba(220,38,38,0.4); }

        @media (max-width:1024px) { .mh-search { max-width:none; } }
        @media (max-width:860px) {
          .mh-search, .mh-link, .mh-divider, .mh-signin, .mh-dd { display:none!important; }
          .mh-burger { display:flex!important; }
          .mh-mobile.open { display:flex!important; }
          .mh-bar { height:64px; justify-content:space-between; }
        }
      `}</style>

      <header className={`mh-root${scrolled ? ' scrolled' : ''}`} ref={menuRef}>
        <div className="mh-bar">
          <Link to="/" className="mh-logo">
            <span className="mh-logo-x">X</span><span className="mh-logo-t">DRIVE</span>
            <span className="mh-logo-my">.MY</span>
          </Link>

          {/* Search — the marketplace anchor */}
          <form className="mh-search" onSubmit={submitSearch} role="search">
            <Search size={17} className="mh-search-ico" />
            <input
              className="mh-search-input"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by brand, model or keyword…"
              aria-label="Search cars"
            />
            <select className="mh-search-cat" value={cat} onChange={e => setCat(e.target.value)} aria-label="Condition">
              <option value="">All Cars</option>
              <option value="used">Used</option>
              <option value="new">New</option>
              <option value="recon">Recon</option>
            </select>
            <button type="submit" className="mh-search-btn"><Search size={14} /> Search</button>
          </form>

          <div className="mh-actions">
            <a href="/marketplace?hot_deals=true" className={`mh-link hot${isHotDeals ? ' active' : ''}`}><Flame size={15} /> Hot Deals</a>
            <button onClick={() => setSavedOpen(true)} className="mh-link" aria-label="Saved cars">
              <Heart size={16} fill={savedIds.size > 0 ? '#dc2626' : 'none'} stroke={savedIds.size > 0 ? '#dc2626' : 'currentColor'} strokeWidth={2} />
              Saved
              {savedIds.size > 0 && <span className="mh-saved-badge">{savedIds.size}</span>}
            </button>

            <span className="mh-divider" />

            <a href={`tel:+${settings.support_whatsapp}`} className="mh-link" aria-label="Call us"><Phone size={15} style={{ color:'#dc2626' }} /></a>
            <a href="/login" className="mh-signin">Sign In</a>

            <div className="mh-dd">
              <button className="mh-cta" aria-haspopup="true">Get Started <ChevronDown size={14} className="mh-cta-chev" /></button>
              <div className="mh-menu" role="menu">
                <div className="mh-mega" style={{ width:320 }}>
                  <div className="mh-mega-head">For Dealers</div>
                  {[['dealer_starter', Building2], ['dealer_growth', TrendingUp], ['dealer_pro', Crown]].map(([k, Icon]) => (
                    <a key={k} href="/shiftos#pricing" className="mh-row">
                      <span className="mh-row-ico"><Icon size={18} /></span>
                      <span><span className="mh-row-tt">{tierName(k)} · RM{PLAN_CONFIG[k].price}/mo</span><span className="mh-row-ds">{tierSub(k)}</span></span>
                    </a>
                  ))}
                  <div style={{ height:1, background:'#F1EFE9', margin:'6px 10px' }} />
                  <div className="mh-mega-head">For Salesmen</div>
                  <a href="/shiftos?for=salesman#pricing" className="mh-row">
                    <span className="mh-row-ico"><User size={18} /></span>
                    <span><span className="mh-row-tt">{tierName('salesman_lite')} · Free</span><span className="mh-row-ds">List up to {PLAN_CONFIG.salesman_lite.listingCap} cars, track leads</span></span>
                  </a>
                  <a href="/shiftos?for=salesman#pricing" className="mh-row">
                    <span className="mh-row-ico"><Star size={18} /></span>
                    <span><span className="mh-row-tt">{tierName('salesman_full')} · RM{PLAN_CONFIG.salesman_full.price}/mo</span><span className="mh-row-ds">{PLAN_CONFIG.salesman_full.listingCap} cars + AI tools & deal sheets</span></span>
                  </a>
                </div>
              </div>
            </div>

            <button className="mh-burger" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}>
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {/* Mobile */}
        <div className={`mh-mobile${menuOpen ? ' open' : ''}`}>
          <div className="mh-m-search">
            <Search size={16} style={{ color:'#9ca3af', flexShrink:0 }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search cars…" onKeyDown={e => e.key === 'Enter' && submitSearch()} />
            <button type="button" onClick={() => submitSearch()}>Search</button>
          </div>
          <Link to="/showroom" className="mh-m-link" onClick={() => setMenuOpen(false)}><span style={{ display:'flex', alignItems:'center', gap:9 }}><Car size={17} /> Showroom</span></Link>
          <a href="/marketplace?hot_deals=true" className="mh-m-link" style={{ color:'#ea580c' }} onClick={() => setMenuOpen(false)}><span style={{ display:'flex', alignItems:'center', gap:9 }}><Flame size={17} /> Hot Deals</span></a>
          <button className="mh-m-link" onClick={() => setMCondOpen(o => !o)}>
            <span style={{ display:'flex', alignItems:'center', gap:9 }}><Sparkles size={17} /> Browse by Condition</span>
            <ChevronDown size={16} style={{ transform: mCondOpen ? 'rotate(180deg)' : 'none', transition:'transform .2s' }} />
          </button>
          {mCondOpen && (
            <div className="mh-m-sub">
              {CONDITIONS.map(({ v, Icon, label }) => (
                <a key={v} href={`/showroom?condition=${v}`} onClick={() => setMenuOpen(false)}><Icon size={15} /> {label}</a>
              ))}
            </div>
          )}
          <button className="mh-m-link" onClick={() => { setMenuOpen(false); setSavedOpen(true); }}>
            <span style={{ display:'flex', alignItems:'center', gap:9, color: savedIds.size > 0 ? '#dc2626' : '#374151' }}>
              <Heart size={17} fill={savedIds.size > 0 ? '#dc2626' : 'none'} stroke="currentColor" /> Saved Cars {savedIds.size > 0 && `(${savedIds.size})`}
            </span>
          </button>
          <a href={`tel:+${settings.support_whatsapp}`} className="mh-m-link" style={{ color:'#374151' }}><span style={{ display:'flex', alignItems:'center', gap:9 }}><Phone size={16} style={{ color:'#dc2626' }} /> {settings.support_phone}</span></a>
          <a href="/login" className="mh-m-link" style={{ borderBottom:'none' }} onClick={() => setMenuOpen(false)}>Sign In →</a>
          <a href="/shiftos#pricing" className="mh-m-cta" onClick={() => setMenuOpen(false)}>Get Started — For Dealers</a>
          <a href="/shiftos?for=salesman#pricing" className="mh-m-cta alt" onClick={() => setMenuOpen(false)}>Get Started — For Salesmen</a>
        </div>
      </header>
      <SavedCarsPanel open={savedOpen} onClose={() => setSavedOpen(false)} />
    </>
  );
}
