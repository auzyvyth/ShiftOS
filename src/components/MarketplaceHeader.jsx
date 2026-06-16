import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, Flame, Menu, Phone, Heart, Car, Sparkles, RefreshCw, Building2, TrendingUp, Crown, User, Star } from 'lucide-react';
import { useSavedCars } from '../hooks/useSavedCars';
import SavedCarsPanel from './SavedCarsPanel';
import AnnouncementBar from './AnnouncementBar';
import useMarketplaceSettings from '../hooks/useMarketplaceSettings';
import { PLAN_CONFIG } from '../utils/planConfig';

// Tier sub-label from the single source of truth (planConfig) so header copy never drifts.
const tierSub = (k) => {
  const c = PLAN_CONFIG[k];
  return c.listingCap == null
    ? 'Unlimited listings & seats'
    : `${c.listingCap} listings · ${c.seatCap} seat${c.seatCap > 1 ? 's' : ''}`;
};
const tierName = (k) => PLAN_CONFIG[k].label.replace('Dealer ', '').replace('Salesman ', '');

export default function MarketplaceHeader() {
  const [scrolled, setScrolled]      = useState(false);
  const [menuOpen, setMenuOpen]      = useState(false);
  const [conditionOpen, setCondOpen] = useState(false);
  const [savedOpen, setSavedOpen]    = useState(false);
  const { savedIds }                 = useSavedCars();
  const { settings }                 = useMarketplaceSettings();
  const menuRef = useRef(null);
  const { pathname, search } = useLocation();
  const sp = new URLSearchParams(search);

  const isShowroom  = pathname === '/showroom' && !sp.get('hot_deals') && !sp.get('condition');
  const isHotDeals  = sp.get('hot_deals') === 'true';
  const isCondition = !!sp.get('condition');

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

  return (
    <>
      <AnnouncementBar />
      <style>{`
        .mh-root { position:sticky; top:0; z-index:100; background:#ffffff; border-bottom:1px solid #ECECEC; transition:box-shadow 0.25s, border-color 0.25s; }
        .mh-root.scrolled { box-shadow:0 1px 0 rgba(0,0,0,0.03), 0 8px 28px rgba(15,23,42,0.08); border-bottom-color:#E5E7EB; }

        /* ── nav links ── */
        .mh-nav-link { color:#4b5563; font-size:14px; font-weight:500; text-decoration:none; padding:6px 2px; position:relative; transition:color 0.15s; font-family:'Outfit',sans-serif; white-space:nowrap; }
        .mh-nav-link::after { content:''; position:absolute; bottom:0; left:0; right:0; height:2px; background:#dc2626; transform:scaleX(0); transition:transform 0.2s; transform-origin:left; border-radius:2px; }
        .mh-nav-link:hover,.mh-nav-link.active { color:#111827; }
        .mh-nav-link:hover::after,.mh-nav-link.active::after { transform:scaleX(1); }
        .mh-hot-link { color:#ea580c!important; font-weight:600; }
        .mh-hot-link::after { background:#ea580c!important; }
        .mh-hot-link:hover { color:#c2410c!important; }

        /* ── dropdown (mega) ── */
        .mh-dropdown { position:relative; }
        .mh-dropdown-trigger { color:#4b5563; font-size:14px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:5px; font-family:'Outfit',sans-serif; white-space:nowrap; background:none; border:none; padding:6px 2px; position:relative; transition:color 0.15s; }
        .mh-dropdown-trigger::after { content:''; position:absolute; bottom:0; left:0; right:0; height:2px; background:#dc2626; transform:scaleX(0); transition:transform 0.2s; transform-origin:left; border-radius:2px; }
        .mh-dropdown:hover .mh-dropdown-trigger, .mh-dropdown-trigger:focus, .mh-dropdown-trigger.active { color:#111827; }
        .mh-dropdown:hover .mh-dropdown-trigger::after, .mh-dropdown-trigger.active::after { transform:scaleX(1); }
        .mh-dropdown-chevron { transition:transform 0.2s; display:inline-block; }
        .mh-dropdown:hover .mh-dropdown-chevron { transform:rotate(180deg); }

        /* menu is a transparent positioning wrapper; padding-top is the hover-bridge
           so moving the cursor from trigger to card never crosses a dead zone */
        .mh-dropdown-menu { position:absolute; top:100%; left:50%; transform:translateX(-50%); padding-top:12px; display:none; z-index:200; }
        .mh-dropdown:hover .mh-dropdown-menu { display:block; }
        .mh-dropdown-menu.right { left:auto; right:0; transform:none; }
        .mh-mega { background:#ffffff; border:1px solid #ECECEC; border-radius:16px; padding:10px; box-shadow:0 18px 50px rgba(15,23,42,0.16); animation:mhFade 0.16s ease; }
        @keyframes mhFade { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
        .mh-mega-row { display:flex; align-items:flex-start; gap:13px; padding:11px 12px; border-radius:12px; text-decoration:none; transition:background 0.13s; }
        .mh-mega-row:hover { background:#F7F6F2; }
        .mh-mega-ico { width:38px; height:38px; border-radius:11px; background:#FEF2F2; color:#dc2626; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background 0.13s; }
        .mh-mega-row:hover .mh-mega-ico { background:#FEE2E2; }
        .mh-mega-tt { color:#111827; font-size:14px; font-weight:700; font-family:'Outfit',sans-serif; line-height:1.2; }
        .mh-mega-ds { color:#6b7280; font-size:12px; font-weight:500; font-family:'Outfit',sans-serif; margin-top:3px; line-height:1.35; }
        .mh-mega-head { font-size:10.5px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#9ca3af; font-family:'Outfit',sans-serif; padding:8px 12px 4px; }

        /* ── saved ── */
        .mh-saved { display:flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; font-size:14px; font-weight:500; font-family:'Outfit',sans-serif; position:relative; padding:6px 2px; transition:color 0.15s; }

        /* ── contact / auth ── */
        .mh-phone { display:flex; align-items:center; gap:7px; color:#374151; font-size:13px; font-weight:600; text-decoration:none; font-family:'Outfit',sans-serif; padding:8px 13px; border:1px solid rgba(0,0,0,0.1); border-radius:9px; transition:border-color 0.15s, color 0.15s; white-space:nowrap; }
        .mh-phone:hover { border-color:rgba(0,0,0,0.28); color:#111827; }
        .mh-cta { display:flex; align-items:center; gap:7px; background:#dc2626; color:#fff; font-size:14px; font-weight:700; padding:9px 18px; border-radius:9px; text-decoration:none; font-family:'Outfit',sans-serif; transition:background 0.15s,transform 0.15s,box-shadow 0.15s; white-space:nowrap; cursor:pointer; border:none; box-shadow:0 1px 2px rgba(220,38,38,0.25); }
        .mh-cta:hover { background:#b91c1c; transform:translateY(-1px); box-shadow:0 6px 18px rgba(220,38,38,0.28); }
        .mh-cta-chevron { transition:transform 0.2s; display:inline-block; font-size:11px; }
        .mh-dropdown:hover .mh-cta-chevron { transform:rotate(180deg); }
        .mh-signin { display:flex; align-items:center; gap:7px; background:transparent; border:1px solid rgba(0,0,0,0.12); color:#374151; font-size:14px; font-weight:600; padding:9px 16px; border-radius:9px; text-decoration:none; font-family:'Outfit',sans-serif; transition:border-color 0.15s,color 0.15s; white-space:nowrap; }
        .mh-signin:hover { border-color:rgba(0,0,0,0.3); color:#111827; }

        /* ── mobile ── */
        .mh-hamburger { display:none; background:rgba(0,0,0,0.04); border:1px solid rgba(0,0,0,0.08); color:#111827; border-radius:9px; padding:8px; cursor:pointer; align-items:center; justify-content:center; transition:background 0.15s; }
        .mh-hamburger:hover { background:rgba(0,0,0,0.07); }
        .mh-mobile-nav { display:none; flex-direction:column; gap:2px; padding:12px 20px 16px; border-top:1px solid rgba(0,0,0,0.06); background:#ffffff; }
        .mh-mobile-link { color:#4b5563; font-size:15px; font-weight:500; text-decoration:none; padding:12px 0; border-bottom:1px solid rgba(0,0,0,0.05); font-family:'Outfit',sans-serif; transition:color 0.15s; display:block; }
        .mh-mobile-link:hover,.mh-mobile-link.active { color:#111827; }
        .mh-mobile-link.active { border-left:2px solid #dc2626; padding-left:10px; }
        .mh-mobile-sub { padding:6px 0 6px 16px; display:flex; flex-direction:column; gap:0; border-bottom:1px solid rgba(0,0,0,0.05); }
        .mh-mobile-sub-item { color:#6b7280; font-size:13px; font-weight:500; text-decoration:none; padding:9px 0; font-family:'Outfit',sans-serif; transition:color 0.12s; }
        .mh-mobile-sub-item:hover { color:#111827; }
        .mh-mobile-cta { margin-top:10px; display:flex; align-items:center; justify-content:center; gap:7px; background:#dc2626; color:#fff; font-size:15px; font-weight:700; padding:13px; border-radius:10px; text-decoration:none; font-family:'Outfit',sans-serif; }
        @media (max-width:720px) {
          .mh-desktop-nav { display:none!important; }
          .mh-desktop-cta { display:none!important; }
          .mh-hamburger { display:flex!important; }
          .mh-mobile-nav.open { display:flex!important; }
        }
      `}</style>

      <header className={`mh-root${scrolled ? ' scrolled' : ''}`} ref={menuRef}>
        <div style={{ maxWidth:'1360px', margin:'0 auto', padding:'0 clamp(20px, 4vw, 48px)', height:'64px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'24px' }}>
          <div style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
            <Link to="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:'2px' }}>
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'26px', letterSpacing:'0.04em', lineHeight:1 }}>
                <span style={{ color:'#dc2626' }}>X</span><span style={{ color:'#111827' }}>DRIVE</span>
              </span>
              <span style={{ fontSize:'9px', fontWeight:'700', color:'#9ca3af', letterSpacing:'0.1em', marginLeft:'4px', marginTop:'2px', fontFamily:"'Outfit',sans-serif" }}>.MY</span>
            </Link>
          </div>

          <nav className="mh-desktop-nav" style={{ display:'flex', alignItems:'center', gap:'28px', flex:1, justifyContent:'center' }}>
            <Link to="/showroom" className={`mh-nav-link${isShowroom ? ' active' : ''}`}>Showroom</Link>
            <a href="/marketplace?hot_deals=true" className={`mh-nav-link mh-hot-link${isHotDeals ? ' active' : ''}`} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
              <Flame size={13} /> Hot Deals
            </a>
            <div className="mh-dropdown">
              <button className={`mh-dropdown-trigger${isCondition ? ' active' : ''}`} aria-haspopup="true">
                Condition <span className="mh-dropdown-chevron">▾</span>
              </button>
              <div className="mh-dropdown-menu" role="menu">
                <div className="mh-mega" style={{ width:340 }}>
                  <a href="/showroom?condition=used" className="mh-mega-row">
                    <span className="mh-mega-ico"><Car size={18} /></span>
                    <span><span className="mh-mega-tt">Used Cars</span><span className="mh-mega-ds" style={{ display:'block' }}>Inspected pre-owned cars from trusted dealers</span></span>
                  </a>
                  <a href="/showroom?condition=new" className="mh-mega-row">
                    <span className="mh-mega-ico"><Sparkles size={18} /></span>
                    <span><span className="mh-mega-tt">New Cars</span><span className="mh-mega-ds" style={{ display:'block' }}>Brand-new units straight from the showroom</span></span>
                  </a>
                  <a href="/showroom?condition=recon" className="mh-mega-row">
                    <span className="mh-mega-ico"><RefreshCw size={18} /></span>
                    <span><span className="mh-mega-tt">Recon / Import</span><span className="mh-mega-ds" style={{ display:'block' }}>Reconditioned imports, graded and verified</span></span>
                  </a>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSavedOpen(true)}
              className="mh-saved"
              style={{ color: savedIds.size > 0 ? '#dc2626' : '#4b5563' }}
            >
              <Heart size={14} fill={savedIds.size > 0 ? '#dc2626' : 'none'} stroke="currentColor" strokeWidth={2} />
              Saved
              {savedIds.size > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -8,
                  background: '#dc2626', color: '#fff',
                  fontSize: 9, fontWeight: 800, borderRadius: 20,
                  padding: '1px 5px', fontFamily: "'Outfit',sans-serif", lineHeight: 1.4,
                }}>
                  {savedIds.size}
                </span>
              )}
            </button>
          </nav>

          <div style={{ display:'flex', alignItems:'center', gap:'12px', flexShrink:0 }}>
            <a href={`tel:+${settings.support_whatsapp}`} className="mh-phone mh-desktop-cta">
              <Phone size={13} style={{ color:'#dc2626' }} /> {settings.support_phone}
            </a>
            <a href="/login" className="mh-signin mh-desktop-cta">Sign In</a>
            <div className="mh-dropdown mh-desktop-cta">
              <button className="mh-cta" aria-haspopup="true">
                Get Started <span className="mh-cta-chevron">▾</span>
              </button>
              <div className="mh-dropdown-menu right" role="menu">
                <div className="mh-mega" style={{ width:316 }}>
                  <div className="mh-mega-head">For Dealers</div>
                  {[['dealer_starter', Building2], ['dealer_growth', TrendingUp], ['dealer_pro', Crown]].map(([k, Icon]) => (
                    <a key={k} href="/shiftos#pricing" className="mh-mega-row">
                      <span className="mh-mega-ico"><Icon size={18} /></span>
                      <span><span className="mh-mega-tt">{tierName(k)} · RM{PLAN_CONFIG[k].price}/mo</span><span className="mh-mega-ds" style={{ display:'block' }}>{tierSub(k)}</span></span>
                    </a>
                  ))}
                  <div style={{ height:1, background:'#F1F1F1', margin:'6px 10px' }} />
                  <div className="mh-mega-head">For Salesmen</div>
                  <a href="/shiftos?for=salesman#pricing" className="mh-mega-row">
                    <span className="mh-mega-ico"><User size={18} /></span>
                    <span><span className="mh-mega-tt">{tierName('salesman_lite')} · Free</span><span className="mh-mega-ds" style={{ display:'block' }}>List up to {PLAN_CONFIG.salesman_lite.listingCap} cars, track leads</span></span>
                  </a>
                  <a href="/shiftos?for=salesman#pricing" className="mh-mega-row">
                    <span className="mh-mega-ico"><Star size={18} /></span>
                    <span><span className="mh-mega-tt">{tierName('salesman_full')} · RM{PLAN_CONFIG.salesman_full.price}/mo</span><span className="mh-mega-ds" style={{ display:'block' }}>{PLAN_CONFIG.salesman_full.listingCap} cars + AI tools & deal sheets</span></span>
                  </a>
                </div>
              </div>
            </div>
            <button className="mh-hamburger" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}>
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        <div className={`mh-mobile-nav${menuOpen ? ' open' : ''}`}>
          <Link to="/showroom" className={`mh-mobile-link${isShowroom ? ' active' : ''}`} onClick={() => setMenuOpen(false)}>Showroom</Link>
          <a href="/marketplace?hot_deals=true" className="mh-mobile-link" style={{ color:'#ea580c', display:'flex', alignItems:'center', gap:7 }} onClick={() => setMenuOpen(false)}><Flame size={14} /> Hot Deals</a>
          <button className="mh-mobile-link" style={{ background:'none', border:'none', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'12px 0', color:'#4b5563', fontSize:'15px', fontWeight:'500', fontFamily:"'Outfit',sans-serif" }} onClick={() => setCondOpen(o => !o)}>
            Condition <span style={{ fontSize:12 }}>{conditionOpen ? '▲' : '▼'}</span>
          </button>
          {conditionOpen && (
            <div className="mh-mobile-sub">
              {[['used', Car, 'Used Cars'],['new', Sparkles, 'New Cars'],['recon', RefreshCw, 'Recon / Import']].map(([v, Icon, l]) => (
                <a key={v} href={`/showroom?condition=${v}`} className="mh-mobile-sub-item" style={{ display:'flex', alignItems:'center', gap:7 }} onClick={() => setMenuOpen(false)}><Icon size={13} /> {l}</a>
              ))}
            </div>
          )}
          <button
            className="mh-mobile-link"
            style={{ background:'none', border:'none', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:8, width:'100%', padding:'12px 0', color: savedIds.size > 0 ? '#dc2626' : '#4b5563', fontSize:15, fontWeight:500, fontFamily:"'Outfit',sans-serif" }}
            onClick={() => { setMenuOpen(false); setSavedOpen(true); }}
          >
            <Heart size={15} fill={savedIds.size > 0 ? '#dc2626' : 'none'} stroke="currentColor" />
            Saved Cars {savedIds.size > 0 && `(${savedIds.size})`}
          </button>
          <a href={`tel:+${settings.support_whatsapp}`} className="mh-mobile-link" style={{ display:'flex', alignItems:'center', gap:'8px', color:'#374151' }}><Phone size={14} style={{ color:'#dc2626' }} /> {settings.support_phone}</a>
          <a href="/login" className="mh-mobile-link" style={{ color:'#4b5563', borderBottom:'none' }} onClick={() => setMenuOpen(false)}>Sign In →</a>
          <a href="/shiftos" className="mh-mobile-cta" onClick={() => setMenuOpen(false)}>Get Started — For Dealers</a>
          <a href="/shiftos?for=salesman#pricing" className="mh-mobile-cta" style={{ marginTop:8, background:'transparent', border:'1px solid rgba(220,38,38,0.5)', color:'#dc2626' }} onClick={() => setMenuOpen(false)}>Get Started — For Salesmen</a>
        </div>
      </header>
      <SavedCarsPanel open={savedOpen} onClose={() => setSavedOpen(false)} />
    </>
  );
}
