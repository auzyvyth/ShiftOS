import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, Flame, Menu, Phone } from 'lucide-react';

export default function MarketplaceHeader() {
  const [scrolled, setScrolled]      = useState(false);
  const [menuOpen, setMenuOpen]      = useState(false);
  const [conditionOpen, setCondOpen] = useState(false);
  const menuRef = useRef(null);
  const { pathname, search } = useLocation();
  const sp = new URLSearchParams(search);

  const isShowroom  = (pathname === '/showroom' || pathname === '/marketplace') && !sp.get('hot_deals') && !sp.get('condition');
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
      <style>{`
        .mh-root { position:sticky; top:0; z-index:100; transition:background 0.25s,box-shadow 0.25s; }
        .mh-root.scrolled { background:rgba(12,12,14,0.9)!important; backdrop-filter:blur(16px) saturate(1.4); box-shadow:0 1px 0 rgba(255,255,255,0.06); }
        .mh-nav-link { color:#9ca3af; font-size:14px; font-weight:500; text-decoration:none; padding:6px 2px; position:relative; transition:color 0.15s; font-family:'Outfit',sans-serif; white-space:nowrap; }
        .mh-nav-link::after { content:''; position:absolute; bottom:0; left:0; right:0; height:1.5px; background:#dc2626; transform:scaleX(0); transition:transform 0.2s; transform-origin:left; border-radius:2px; }
        .mh-nav-link:hover,.mh-nav-link.active { color:#fff; }
        .mh-nav-link:hover::after,.mh-nav-link.active::after { transform:scaleX(1); }
        .mh-hot-link { color:#fb923c!important; }
        .mh-hot-link::after { background:#fb923c!important; }
        .mh-hot-link:hover { color:#fdba74!important; }
        .mh-dropdown { position:relative; }
        .mh-dropdown-trigger { color:#9ca3af; font-size:14px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:5px; font-family:'Outfit',sans-serif; white-space:nowrap; background:none; border:none; padding:6px 2px; position:relative; transition:color 0.15s; }
        .mh-dropdown-trigger::after { content:''; position:absolute; bottom:0; left:0; right:0; height:1.5px; background:#dc2626; transform:scaleX(0); transition:transform 0.2s; transform-origin:left; border-radius:2px; }
        .mh-dropdown:hover .mh-dropdown-trigger, .mh-dropdown-trigger:focus, .mh-dropdown-trigger.active { color:#fff; }
        .mh-dropdown:hover .mh-dropdown-trigger::after, .mh-dropdown-trigger.active::after { transform:scaleX(1); }
        .mh-dropdown-chevron { transition:transform 0.2s; display:inline-block; }
        .mh-dropdown:hover .mh-dropdown-chevron { transform:rotate(180deg); }
        .mh-dropdown-menu { position:absolute; top:calc(100% + 10px); left:50%; transform:translateX(-50%); min-width:170px; background:rgba(10,14,24,0.98); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:6px; display:none; flex-direction:column; gap:2px; backdrop-filter:blur(20px); box-shadow:0 12px 40px rgba(0,0,0,0.7); z-index:200; }
        .mh-dropdown:hover .mh-dropdown-menu { display:flex; }
        .mh-dropdown-item { color:#9ca3af; font-size:13px; font-weight:500; text-decoration:none; padding:9px 12px; border-radius:8px; font-family:'Outfit',sans-serif; transition:background 0.12s,color 0.12s; white-space:nowrap; }
        .mh-dropdown-item:hover { background:rgba(255,255,255,0.07); color:#fff; }
        .mh-cta { display:flex; align-items:center; gap:7px; background:#dc2626; color:#fff; font-size:14px; font-weight:700; padding:9px 18px; border-radius:9px; text-decoration:none; font-family:'Outfit',sans-serif; transition:background 0.15s,transform 0.15s; white-space:nowrap; }
        .mh-cta:hover { background:#b91c1c; transform:translateY(-1px); }
        .mh-hamburger { display:none; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:8px; padding:8px; cursor:pointer; align-items:center; justify-content:center; transition:background 0.15s; }
        .mh-hamburger:hover { background:rgba(255,255,255,0.1); }
        .mh-mobile-nav { display:none; flex-direction:column; gap:2px; padding:12px 20px 16px; border-top:1px solid rgba(255,255,255,0.06); background:rgba(12,12,14,0.97); backdrop-filter:blur(16px); }
        .mh-mobile-link { color:#9ca3af; font-size:15px; font-weight:500; text-decoration:none; padding:11px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-family:'Outfit',sans-serif; transition:color 0.15s; display:block; }
        .mh-mobile-link:hover,.mh-mobile-link.active { color:#fff; }
        .mh-mobile-link.active { border-left:2px solid #dc2626; padding-left:10px; }
        .mh-mobile-sub { padding:6px 0 6px 16px; display:flex; flex-direction:column; gap:0; border-bottom:1px solid rgba(255,255,255,0.05); }
        .mh-mobile-sub-item { color:#6b7280; font-size:13px; font-weight:500; text-decoration:none; padding:8px 0; font-family:'Outfit',sans-serif; transition:color 0.12s; }
        .mh-mobile-sub-item:hover { color:#fff; }
        .mh-mobile-cta { margin-top:10px; display:flex; align-items:center; justify-content:center; gap:7px; background:#dc2626; color:#fff; font-size:15px; font-weight:700; padding:13px; border-radius:10px; text-decoration:none; font-family:'Outfit',sans-serif; }
        @media (max-width:720px) {
          .mh-desktop-nav { display:none!important; }
          .mh-hamburger { display:flex!important; }
          .mh-mobile-nav.open { display:flex!important; }
        }
      `}</style>

      <header className={`mh-root${scrolled ? ' scrolled' : ''}`} style={{ background:'transparent', borderBottom:'1px solid transparent' }} ref={menuRef}>
        <div style={{ maxWidth:'1360px', margin:'0 auto', padding:'0 20px', height:'64px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'24px' }}>
          <Link to="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:'2px', flexShrink:0 }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'26px', letterSpacing:'0.04em', lineHeight:1 }}>
              <span style={{ color:'#dc2626' }}>X</span><span style={{ color:'#ffffff' }}>DRIVE</span>
            </span>
            <span style={{ fontSize:'9px', fontWeight:'700', color:'#6b7280', letterSpacing:'0.1em', marginLeft:'4px', marginTop:'2px', fontFamily:"'Outfit',sans-serif" }}>.MY</span>
          </Link>

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
                <a href="/showroom?condition=used"  className="mh-dropdown-item">🚗 Used Cars</a>
                <a href="/showroom?condition=new"   className="mh-dropdown-item">✨ New Cars</a>
                <a href="/showroom?condition=recon" className="mh-dropdown-item">🔁 Recon / Import</a>
              </div>
            </div>
          </nav>

          <div style={{ display:'flex', alignItems:'center', gap:'12px', flexShrink:0 }}>
            <a href="tel:+60174155191" className="mh-desktop-nav" style={{ display:'flex', alignItems:'center', gap:'6px', color:'#6b7280', fontSize:'13px', fontWeight:'500', textDecoration:'none', fontFamily:"'Outfit',sans-serif" }}>
              <Phone size={13} /> +60 17-415 5191
            </a>
            <a href="/login" className="mh-cta">List Your Car</a>
            <button className="mh-hamburger" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}>
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        <div className={`mh-mobile-nav${menuOpen ? ' open' : ''}`}>
          <Link to="/showroom" className={`mh-mobile-link${isShowroom ? ' active' : ''}`} onClick={() => setMenuOpen(false)}>Showroom</Link>
          <a href="/marketplace?hot_deals=true" className="mh-mobile-link" style={{ color:'#fb923c' }} onClick={() => setMenuOpen(false)}>🔥 Hot Deals</a>
          <button className="mh-mobile-link" style={{ background:'none', border:'none', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', padding:'11px 0', color:'#9ca3af', fontSize:'15px', fontWeight:'500', fontFamily:"'Outfit',sans-serif" }} onClick={() => setCondOpen(o => !o)}>
            Condition <span style={{ fontSize:12 }}>{conditionOpen ? '▲' : '▼'}</span>
          </button>
          {conditionOpen && (
            <div className="mh-mobile-sub">
              {[['used','🚗 Used Cars'],['new','✨ New Cars'],['recon','🔁 Recon / Import']].map(([v,l]) => (
                <a key={v} href={`/showroom?condition=${v}`} className="mh-mobile-sub-item" onClick={() => setMenuOpen(false)}>{l}</a>
              ))}
            </div>
          )}
          <a href="tel:+60174155191" className="mh-mobile-link" style={{ display:'flex', alignItems:'center', gap:'8px' }}><Phone size={14} /> +60 17-415 5191</a>
          <a href="/login" className="mh-mobile-cta" onClick={() => setMenuOpen(false)}>List Your Car</a>
        </div>
      </header>
    </>
  );
}
