import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// Same "thin dark strip" language as AnnouncementBar.jsx (#15171c, one step
// off the header's #0f1115, red as the only accent) — this is the sub-nav
// sibling of that bar, not a variant of it, so it stays its own file.
const NAV_ITEMS = [
  { to: '/vehicle-services', label: 'Vehicle Services' },
  { to: '/automotive-products', label: 'Automotive Products' },
];

export default function MarketplaceSubNav() {
  const { pathname } = useLocation();
  return (
    <>
      <style>{`
        /* Sticks directly under MarketplaceHeader via --mh-h (its measured,
           live height — see MarketplaceHeader.jsx), the same pattern
           CarListingPage's topbar and ComparePage already use. When the
           header auto-hides on scroll, --mh-h drops to 0 and this bar rides
           up to the very top with it, instead of leaving a gap. */
        .mp-subnav { position:sticky; top:var(--mh-h, 70px); z-index:90; background:#15171c; border-bottom:1px solid rgba(255,255,255,0.08); transition:top .28s ease; font-family:'Outfit',sans-serif; }
        .mp-subnav-inner { max-width:1400px; margin:0 auto; padding:0 clamp(16px,3.5vw,44px); display:flex; align-items:center; gap:4px; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
        .mp-subnav-inner::-webkit-scrollbar { display:none; }
        .mp-subnav-link { flex-shrink:0; display:flex; align-items:center; gap:7px; padding:11px 14px; font-size:13px; font-weight:600; color:rgba(255,255,255,0.68); text-decoration:none; border-bottom:2px solid transparent; white-space:nowrap; transition:color .14s,border-color .14s; }
        .mp-subnav-link:hover { color:#fff; }
        .mp-subnav-link.active { color:#fff; border-bottom-color:#dc2626; }
        .mp-subnav-badge { font-size:9px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:rgba(255,255,255,0.45); background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; }
      `}</style>
      <nav className="mp-subnav" aria-label="Marketplace sections">
        <div className="mp-subnav-inner">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`mp-subnav-link${pathname === item.to ? ' active' : ''}`}
            >
              {item.label} <span className="mp-subnav-badge">Soon</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
