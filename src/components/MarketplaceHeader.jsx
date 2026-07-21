import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  X, Flame, Menu, Heart, Search, ChevronDown, Car, Sparkles, RefreshCw, LayoutGrid,
  LayoutDashboard, Tag, Handshake, PlusCircle, BookOpen, FileCheck, FileText, GitCompare, ArrowUpRight,
  User, Store,
} from 'lucide-react';
import { useSavedCars } from '../hooks/useSavedCars';
import { supabase } from '../supabaseClient';
import SavedCarsPanel from './SavedCarsPanel';
import AnnouncementBar from './AnnouncementBar';
import useMarketplaceSettings from '../hooks/useMarketplaceSettings';

// Mirror of useRoleRedirect's ROLE_ROUTES — maps a logged-in business user to their panel.
const ROLE_ROUTES = {
  superadmin: '/dashboard', dealer: '/dashboard', owner: '/dashboard',
  manager: '/manager', salesman: '/salesman', accountant: '/accountant',
  fi_officer: '/fi', admin: '/admin',
};

export default function MarketplaceHeader({ hideAnnouncement = false }) {
  const [scrolled, setScrolled]     = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [mSection, setMSection]     = useState(null);   // mobile accordion open section
  const [savedOpen, setSavedOpen]   = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ]                   = useState('');
  const { savedIds }                = useSavedCars();
  const { settings }                = useMarketplaceSettings();
  // Auth-aware header link. Signed-out → "Sign In". A business user (dealer/
  // salesman/…) → "Dashboard" to their panel. A buyer (session, no business role)
  // → "My Account" (/account). null = not logged in.
  const [authLink, setAuthLink]     = useState(null);
  const [signinOpen, setSigninOpen] = useState(false);
  const signinRef = useRef(null);
  const rootRef = useRef(null);
  const searchInputRef = useRef(null);
  const navigate = useNavigate();
  const { search } = useLocation();
  const isHotDeals = new URLSearchParams(search).get('hot_deals') === 'true';

  const partnerWa = `https://wa.me/${settings.support_whatsapp}?text=${encodeURIComponent("Hi! I'm interested in partnering with XDrive / ShiftOS for my dealership. Can we discuss?")}`;

  const BROWSE = [
    { to: '/showroom',                  Icon: LayoutGrid, label: 'All Cars',       desc: 'Every car on XDrive' },
    { to: '/showroom?condition=used',   Icon: Car,        label: 'Used Cars',      desc: 'Inspected pre-owned' },
    { to: '/showroom?condition=new',    Icon: Sparkles,   label: 'New Cars',       desc: 'Brand-new from showrooms' },
    { to: '/showroom?condition=recon',  Icon: RefreshCw,  label: 'Recon / Import', desc: 'Graded, verified imports' },
  ];
  const DEALERS = [
    { to: '/shiftos#features', Icon: PlusCircle,      label: 'List Your Inventory', desc: 'Put your stock in front of buyers' },
    { to: '/shiftos',          Icon: LayoutDashboard, label: 'ShiftOS DMS',         desc: 'Run your whole dealership' },
    { to: '/shiftos#pricing',  Icon: Tag,             label: 'Dealer Pricing',      desc: 'Plans from RM299/mo' },
    { href: partnerWa,         Icon: Handshake,       label: 'Partner with XDrive', desc: 'Grow your business with us' },
  ];
  const GUIDES = [
    { to: '/articles',                                  Icon: BookOpen,  label: 'Semua Panduan',            desc: 'All guides & articles' },
    { to: '/articles/apa-itu-puspakom-b5-b7',           Icon: FileCheck, label: 'Apa Itu Puspakom B5 & B7?', desc: 'Inspection rules explained' },
    { to: '/articles/cara-pindah-milik-kereta-mysikap', Icon: FileText,  label: 'Cara Pindah Milik MySikap', desc: 'Ownership transfer steps' },
    { to: '/articles/beza-kereta-recon-dan-terpakai',   Icon: GitCompare,label: 'Kereta Recon vs Terpakai',  desc: 'Which one is right for you' },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the Sign In buyer/seller dropdown on outside click.
  useEffect(() => {
    if (!signinOpen) return;
    const h = (e) => { if (signinRef.current && !signinRef.current.contains(e.target)) setSigninOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [signinOpen]);

  useEffect(() => {
    let active = true;
    const resolve = async (session) => {
      if (!session?.user?.id) { if (active) setAuthLink(null); return; }
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).maybeSingle();
      if (!active) return;
      const route = profile?.role && ROLE_ROUTES[profile.role];
      setAuthLink(route ? { to: route, label: 'Dashboard' } : { to: '/account', label: 'My Account' });
    };
    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => resolve(s));
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const h = e => { if (rootRef.current && !rootRef.current.contains(e.target)) { setMenuOpen(false); setSearchOpen(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen, searchOpen]);

  useEffect(() => { if (searchOpen) searchInputRef.current?.focus(); }, [searchOpen]);

  const submitSearch = (e) => {
    e?.preventDefault();
    const s = q.trim();
    navigate(`/showroom${s ? `?q=${encodeURIComponent(s)}` : ''}`);
    setSearchOpen(false); setMenuOpen(false);
  };

  const ItemRow = ({ Icon, label, desc, to, href }) => {
    const inner = (
      <>
        <span className="mh-row-ico"><Icon size={19} /></span>
        <span style={{ minWidth: 0 }}>
          <span className="mh-row-tt">{label}</span>
          <span className="mh-row-ds">{desc}</span>
        </span>
        <ArrowUpRight size={15} className="mh-row-arrow" />
      </>
    );
    return href
      ? <a href={href} target="_blank" rel="noopener noreferrer" className="mh-row">{inner}</a>
      : <Link to={to} className="mh-row">{inner}</Link>;
  };

  const MegaNav = ({ id, label, items, accent, align = 'left' }) => (
    <div className="mh-nav-item">
      <button className="mh-nav-trigger" aria-haspopup="true">{label} <ChevronDown size={14} className="mh-chev" /></button>
      <div className={`mh-menu${align === 'right' ? ' mh-menu-r' : ''}`}>
        <div className="mh-mega">
          <div className="mh-mega-grid">
            {items.map(it => <ItemRow key={it.label} {...it} />)}
          </div>
          {accent && (
            <div className="mh-mega-promo">
              <p className="mh-promo-eyebrow">{accent.eyebrow}</p>
              <p className="mh-promo-title">{accent.title}</p>
              <p className="mh-promo-sub">{accent.sub}</p>
              <Link to={accent.to} className="mh-promo-cta">{accent.cta} <ArrowUpRight size={14} /></Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {!hideAnnouncement && <AnnouncementBar />}
      <style>{`
        .mh-root { position:sticky; top:0; z-index:100; background:#fff; border-bottom:1px solid #ECEAE3; transition:box-shadow .25s,border-color .25s; font-family:'Outfit',sans-serif; }
        .mh-root.scrolled { box-shadow:0 1px 0 rgba(0,0,0,.03), 0 10px 30px rgba(15,23,42,.08); border-bottom-color:#E5E7EB; }
        .mh-bar { max-width:1400px; margin:0 auto; padding:0 clamp(16px,3.5vw,44px); height:70px; display:flex; align-items:center; gap:clamp(14px,2.4vw,30px); }

        .mh-logo { text-decoration:none; display:flex; align-items:baseline; gap:1px; flex-shrink:0; }
        .mh-logo-x { font-family:'Bebas Neue',sans-serif; font-size:29px; letter-spacing:.03em; line-height:1; color:#dc2626; }
        .mh-logo-t { font-family:'Bebas Neue',sans-serif; font-size:29px; letter-spacing:.03em; line-height:1; color:#0f1115; }
        .mh-logo-my { font-size:9.5px; font-weight:800; color:#C4A265; letter-spacing:.12em; margin-left:3px; }

        /* left nav */
        .mh-nav { display:flex; align-items:center; gap:2px; }
        .mh-nav-item { position:relative; }
        .mh-nav-link, .mh-nav-trigger { display:flex; align-items:center; gap:6px; color:#3f4654; font-size:14px; font-weight:600; text-decoration:none; padding:9px 13px; border-radius:10px; background:none; border:none; cursor:pointer; font-family:inherit; white-space:nowrap; transition:background .14s,color .14s; }
        .mh-nav-link:hover, .mh-nav-trigger:hover, .mh-nav-item:hover .mh-nav-trigger { background:#F5F3EE; color:#0f1115; }
        .mh-nav-link.hot { color:#ea580c; }
        .mh-nav-link.hot:hover, .mh-nav-link.hot.active { background:#fff7ed; color:#c2410c; }
        .mh-chev { transition:transform .2s; }
        .mh-nav-item:hover .mh-chev { transform:rotate(180deg); }

        /* mega */
        .mh-menu { position:absolute; top:100%; left:0; padding-top:13px; display:none; z-index:200; }
        /* Right-side triggers open leftward so the panel can't run off-screen */
        .mh-menu-r { left:auto; right:0; }
        .mh-nav-item:hover .mh-menu { display:block; }
        .mh-mega { background:#fff; border:1px solid #ECEAE3; border-radius:20px; box-shadow:0 26px 70px rgba(15,23,42,.2); padding:14px; display:flex; gap:12px; animation:mhFade .17s ease; }
        @keyframes mhFade { from{opacity:0;transform:translateY(-7px);} to{opacity:1;transform:none;} }
        .mh-mega-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px; width:520px; }
        .mh-row { display:flex; align-items:center; gap:13px; padding:13px 14px; border-radius:14px; text-decoration:none; transition:background .13s; position:relative; }
        .mh-row:hover { background:#F7F5F0; }
        .mh-row-ico { width:42px; height:42px; border-radius:13px; background:#FEF2F2; color:#dc2626; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:transform .14s,background .14s; }
        .mh-row:hover .mh-row-ico { background:#dc2626; color:#fff; transform:scale(1.06) rotate(-3deg); }
        .mh-row-tt { display:block; color:#0f1115; font-size:14px; font-weight:700; line-height:1.2; }
        .mh-row-ds { display:block; color:#6b7280; font-size:12px; font-weight:500; margin-top:3px; line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .mh-row-arrow { color:#cbd0d6; margin-left:auto; flex-shrink:0; opacity:0; transform:translate(-4px,4px); transition:opacity .14s,transform .14s; }
        .mh-row:hover .mh-row-arrow { opacity:1; transform:none; color:#dc2626; }
        .mh-mega-promo { width:182px; flex-shrink:0; border-radius:16px; padding:15px; background:linear-gradient(150deg,#15171c,#0f1115); display:flex; flex-direction:column; }
        .mh-promo-eyebrow { font-size:9.5px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#f87171; margin:0 0 7px; }
        .mh-promo-title { font-size:15.5px; font-weight:800; color:#fff; line-height:1.24; margin:0 0 6px; }
        .mh-promo-sub { font-size:11.5px; color:#9ca3af; line-height:1.45; margin:0 0 auto; }
        .mh-promo-cta { display:inline-flex; align-items:center; gap:5px; margin-top:14px; background:#dc2626; color:#fff; font-size:12px; font-weight:700; padding:8px 13px; border-radius:9px; text-decoration:none; align-self:flex-start; transition:background .14s,transform .12s; }
        .mh-promo-cta:hover { background:#ef4444; transform:translateY(-1px); }

        /* right cluster */
        .mh-right { display:flex; align-items:center; gap:4px; margin-left:auto; flex-shrink:0; }
        .mh-icon-btn { position:relative; width:42px; height:42px; border-radius:11px; background:none; border:none; cursor:pointer; color:#3f4654; display:flex; align-items:center; justify-content:center; transition:background .14s,color .14s; }
        .mh-icon-btn:hover { background:#F5F3EE; color:#0f1115; }
        .mh-badge { position:absolute; top:5px; right:5px; background:#dc2626; color:#fff; font-size:9px; font-weight:800; border-radius:20px; min-width:15px; height:15px; display:flex; align-items:center; justify-content:center; padding:0 4px; line-height:1; }
        .mh-vsep { width:1px; height:26px; background:#E7E4DB; margin:0 8px; }
        .mh-signin { color:#0f1115; font-size:14px; font-weight:600; text-decoration:none; padding:9px 6px; position:relative; font-family:inherit; }
        .mh-signin::after { content:''; position:absolute; left:6px; right:6px; bottom:3px; height:2px; background:#dc2626; border-radius:2px; transform:scaleX(0); transform-origin:left; transition:transform .2s; }
        .mh-signin:hover::after { transform:scaleX(1); }
        .mh-signin-menu { position:absolute; top:calc(100% + 12px); right:0; width:248px; background:#fff; border:1px solid #e5e7eb; border-radius:14px; box-shadow:0 16px 40px rgba(15,23,42,0.16); padding:6px; display:flex; flex-direction:column; gap:2px; z-index:1000; }
        .mh-signin-item { display:flex; align-items:center; gap:11px; padding:10px 11px; border-radius:10px; text-decoration:none; transition:background .14s; }
        .mh-signin-item:hover { background:#f5f6f8; }
        .mh-signin-item-t { display:block; font-size:13px; font-weight:700; color:#0f1115; }
        .mh-signin-item-s { display:block; font-size:11px; color:#6b7280; margin-top:1px; }
        .mh-getstarted { display:flex; align-items:center; gap:6px; background:#0f1115; color:#fff; font-size:13.5px; font-weight:700; padding:11px 18px; border-radius:11px; text-decoration:none; white-space:nowrap; transition:background .15s,transform .12s,box-shadow .15s; box-shadow:0 1px 2px rgba(0,0,0,.18); }
        .mh-getstarted:hover { background:#dc2626; transform:translateY(-1px); box-shadow:0 8px 22px rgba(220,38,38,.26); }

        /* search drawer */
        .mh-search-drawer { max-height:0; overflow:hidden; transition:max-height .28s ease; border-top:0 solid #ECEAE3; }
        .mh-search-drawer.open { max-height:90px; border-top:1px solid #ECEAE3; }
        .mh-search-form { max-width:1400px; margin:0 auto; padding:14px clamp(16px,3.5vw,44px); display:flex; gap:10px; box-sizing:border-box; width:100%; }
        .mh-search-field { flex:1; min-width:0; box-sizing:border-box; display:flex; align-items:center; gap:10px; background:#F4F3EF; border:1.5px solid #E7E4DB; border-radius:13px; padding:0 14px; height:50px; transition:border-color .15s,box-shadow .15s,background .15s; }
        .mh-search-field:focus-within { background:#fff; border-color:#dc2626; box-shadow:0 0 0 4px rgba(220,38,38,.10); }
        .mh-search-field input { flex:1; min-width:0; border:none; background:none; outline:none; font-family:inherit; font-size:15px; color:#0f1115; }
        .mh-search-go { flex-shrink:0; background:#dc2626; color:#fff; border:none; border-radius:12px; padding:0 24px; font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; }

        /* mobile */
        .mh-burger { display:none; background:#F4F3EF; border:1px solid #E7E4DB; color:#0f1115; border-radius:11px; padding:9px; cursor:pointer; align-items:center; justify-content:center; }
        .mh-mobile { display:none; flex-direction:column; padding:14px 18px 22px; border-top:1px solid #ECEAE3; background:#fff; gap:2px; max-height:calc(100dvh - 64px); overflow-y:auto; }
        .mh-m-search { display:flex; align-items:center; gap:9px; background:#F4F3EF; border:1.5px solid #E7E4DB; border-radius:12px; padding:0 6px 0 13px; height:48px; margin-bottom:10px; }
        .mh-m-search input { flex:1; min-width:0; border:none; background:none; outline:none; font-family:inherit; font-size:14px; color:#0f1115; }
        .mh-m-search button { flex-shrink:0; background:#dc2626; color:#fff; border:none; border-radius:9px; height:36px; padding:0 14px; font-weight:700; font-size:13px; cursor:pointer; }
        .mh-m-link, .mh-m-acc { color:#1f2733; font-size:15px; font-weight:600; text-decoration:none; padding:13px 6px; border-bottom:1px solid #F1EFE9; display:flex; align-items:center; gap:10px; justify-content:space-between; background:none; border-left:none; border-right:none; border-top:none; cursor:pointer; width:100%; font-family:inherit; }
        .mh-m-sub { display:flex; flex-direction:column; padding:2px 0 10px 16px; }
        .mh-m-sub a { color:#5b626e; font-size:13.5px; font-weight:500; text-decoration:none; padding:10px 0; display:flex; align-items:center; gap:9px; }
        .mh-m-cta { margin-top:12px; display:flex; align-items:center; justify-content:center; gap:7px; background:#dc2626; color:#fff; font-size:15px; font-weight:700; padding:14px; border-radius:12px; text-decoration:none; }
        .mh-m-signin { margin-top:8px; text-align:center; color:#0f1115; font-weight:600; text-decoration:none; padding:12px; }

        /* keep mega panels inside the viewport on mid-size screens */
        @media (max-width:1240px) { .mh-mega-promo { display:none; } }
        @media (max-width:1100px) { .mh-mega-grid { grid-template-columns:1fr; width:300px; } }
        @media (max-width:980px) {
          .mh-nav, .mh-vsep, .mh-signin, .mh-getstarted { display:none!important; }
          .mh-burger { display:flex!important; }
          .mh-mobile.open { display:flex!important; }
          .mh-bar { height:64px; }
        }
        @media (max-width:420px) { .mh-search-go { padding:0 16px; } }
      `}</style>

      <header className={`mh-root${scrolled ? ' scrolled' : ''}`} ref={rootRef}>
        <div className="mh-bar">
          <Link to="/" className="mh-logo">
            <span className="mh-logo-x">X</span><span className="mh-logo-t">DRIVE</span><span className="mh-logo-my">.MY</span>
          </Link>

          {/* LEFT — links + mega dropdowns */}
          <nav className="mh-nav">
            <MegaNav id="browse" label="Browse Cars" items={BROWSE} accent={{ eyebrow:'XDrive', title:'10,000+ cars, one place', sub:'New, used and recon from trusted dealers across Malaysia.', to:'/showroom', cta:'Browse all' }} />
            <a href="/?hot_deals=true" className={`mh-nav-link hot${isHotDeals ? ' active' : ''}`}><Flame size={15} /> Hot Deals</a>
            <Link to="/compare" className="mh-nav-link"><GitCompare size={15} /> Compare</Link>
            <Link to="/for-salesmen" className="mh-nav-link">Salesman Lite</Link>
            <MegaNav id="dealers" label="For Dealers" align="right" items={DEALERS} accent={{ eyebrow:'ShiftOS DMS', title:'Run your dealership', sub:'Listings, leads CRM, F&I and revenue analytics in one system.', to:'/shiftos', cta:'Start free trial' }} />
            <MegaNav id="guides" label="Panduan & Artikel" align="right" items={GUIDES} />
          </nav>

          {/* RIGHT — search, saved, auth */}
          <div className="mh-right">
            <button className="mh-icon-btn" aria-label="Search" onClick={() => setSearchOpen(o => !o)}>
              {searchOpen ? <X size={19} /> : <Search size={19} />}
            </button>
            <button className="mh-icon-btn" aria-label="Saved cars" onClick={() => setSavedOpen(true)}>
              <Heart size={19} fill={savedIds.size > 0 ? '#dc2626' : 'none'} stroke={savedIds.size > 0 ? '#dc2626' : 'currentColor'} strokeWidth={2} />
              {savedIds.size > 0 && <span className="mh-badge">{savedIds.size}</span>}
            </button>
            <span className="mh-vsep" />
            {authLink ? (
              <a href={authLink.to} className="mh-signin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <LayoutDashboard size={15} /> {authLink.label}
              </a>
            ) : (
              <div ref={signinRef} style={{ position: 'relative' }}>
                <button
                  className="mh-signin"
                  onClick={() => setSigninOpen(o => !o)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
                >
                  Sign In
                  <ChevronDown size={14} style={{ transform: signinOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                </button>
                {signinOpen && (
                  <div className="mh-signin-menu">
                    <a href="/buyer-login" className="mh-signin-item" onClick={() => setSigninOpen(false)}>
                      <User size={17} style={{ color: '#dc2626', flexShrink: 0 }} />
                      <span>
                        <span className="mh-signin-item-t">I'm a Buyer</span>
                        <span className="mh-signin-item-s">Save cars, alerts &amp; enquiries</span>
                      </span>
                    </a>
                    <a href="/login" className="mh-signin-item" onClick={() => setSigninOpen(false)}>
                      <Store size={17} style={{ color: '#dc2626', flexShrink: 0 }} />
                      <span>
                        <span className="mh-signin-item-t">I'm a Seller / Dealer</span>
                        <span className="mh-signin-item-s">Access your dashboard</span>
                      </span>
                    </a>
                  </div>
                )}
              </div>
            )}
            <a href="/shiftos#pricing" className="mh-getstarted">Get Started <ArrowUpRight size={14} /></a>
            <button className="mh-burger" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}>
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {/* Search drawer */}
        <div className={`mh-search-drawer${searchOpen ? ' open' : ''}`}>
          <form className="mh-search-form" onSubmit={submitSearch} role="search">
            <div className="mh-search-field">
              <Search size={18} style={{ color:'#9ca3af', flexShrink:0 }} />
              <input ref={searchInputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search by brand, model or keyword…" aria-label="Search cars" />
            </div>
            <button type="submit" className="mh-search-go">Search</button>
          </form>
        </div>

        {/* Mobile sheet */}
        <div className={`mh-mobile${menuOpen ? ' open' : ''}`}>
          <div className="mh-m-search">
            <Search size={16} style={{ color:'#9ca3af', flexShrink:0 }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search cars…" onKeyDown={e => e.key === 'Enter' && submitSearch()} />
            <button type="button" onClick={() => submitSearch()}>Search</button>
          </div>

          {[
            { id:'browse',  label:'Browse Cars',       Icon:Car,      items:BROWSE },
            { id:'dealers', label:'For Dealers',       Icon:LayoutDashboard, items:DEALERS },
            { id:'guides',  label:'Panduan & Artikel', Icon:BookOpen, items:GUIDES },
          ].map(({ id, label, Icon, items }) => (
            <React.Fragment key={id}>
              <button className="mh-m-acc" onClick={() => setMSection(s => s === id ? null : id)}>
                <span style={{ display:'flex', alignItems:'center', gap:10 }}><Icon size={17} /> {label}</span>
                <ChevronDown size={16} style={{ transform: mSection === id ? 'rotate(180deg)' : 'none', transition:'transform .2s' }} />
              </button>
              {mSection === id && (
                <div className="mh-m-sub">
                  {items.map(it => it.href
                    ? <a key={it.label} href={it.href} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}><it.Icon size={15} /> {it.label}</a>
                    : <Link key={it.label} to={it.to} onClick={() => setMenuOpen(false)}><it.Icon size={15} /> {it.label}</Link>
                  )}
                </div>
              )}
            </React.Fragment>
          ))}

          <a href="/?hot_deals=true" className="mh-m-link" style={{ color:'#ea580c' }} onClick={() => setMenuOpen(false)}>
            <span style={{ display:'flex', alignItems:'center', gap:10 }}><Flame size={17} /> Hot Deals</span>
          </a>
          <Link to="/compare" className="mh-m-link" onClick={() => setMenuOpen(false)}>
            <span style={{ display:'flex', alignItems:'center', gap:10 }}><GitCompare size={17} /> Compare Cars</span>
          </Link>
          <Link to="/for-salesmen" className="mh-m-link" onClick={() => setMenuOpen(false)}>
            <span style={{ display:'flex', alignItems:'center', gap:10 }}><Store size={17} /> Salesman Lite</span>
          </Link>
          <button className="mh-m-link" onClick={() => { setMenuOpen(false); setSavedOpen(true); }}>
            <span style={{ display:'flex', alignItems:'center', gap:10, color: savedIds.size > 0 ? '#dc2626' : '#1f2733' }}>
              <Heart size={17} fill={savedIds.size > 0 ? '#dc2626' : 'none'} stroke="currentColor" /> Saved Cars {savedIds.size > 0 && `(${savedIds.size})`}
            </span>
          </button>

          <a href="/shiftos#pricing" className="mh-m-cta" onClick={() => setMenuOpen(false)}>Get Started <ArrowUpRight size={15} /></a>
          {authLink ? (
            <a href={authLink.to} className="mh-m-signin" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }} onClick={() => setMenuOpen(false)}>
              <LayoutDashboard size={16} /> {authLink.label}
            </a>
          ) : (
            <>
              <a href="/buyer-login" className="mh-m-signin" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }} onClick={() => setMenuOpen(false)}>
                <User size={16} /> Sign In as Buyer
              </a>
              <a href="/login" className="mh-m-signin" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }} onClick={() => setMenuOpen(false)}>
                <Store size={16} /> Sign In as Seller / Dealer
              </a>
            </>
          )}
        </div>
      </header>
      <SavedCarsPanel open={savedOpen} onClose={() => setSavedOpen(false)} />
    </>
  );
}
