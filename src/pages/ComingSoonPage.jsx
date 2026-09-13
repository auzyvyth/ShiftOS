import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Clock3, ArrowLeft } from 'lucide-react';
import MarketplaceHeader from '../components/MarketplaceHeader';
import MarketplaceSubNav from '../components/MarketplaceSubNav';
import MarketplaceFooter from '../components/MarketplaceFooter';

// One empty-page shell for every sub-nav section (the two links in
// MarketplaceSubNav) instead of a near-identical file per section — there is
// nothing here yet but a headline, so a second copy would only be a place for
// the two to drift.
export default function ComingSoonPage({ title, description }) {
  return (
    <>
      <Helmet><title>{title} | XDrive</title></Helmet>
      <MarketplaceHeader />
      <MarketplaceSubNav />
      <main style={{ background: '#080C14', minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', fontFamily: "'Outfit',sans-serif" }}>
        <div style={{ textAlign: 'center', maxWidth: 440 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(220,38,38,0.12)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Clock3 size={26} />
          </div>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: '0 0 10px' }}>{title}</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 28px' }}>{description}</p>
          <Link to="/showroom" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: '#fff', background: '#dc2626', padding: '11px 20px', borderRadius: 11, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            <ArrowLeft size={15} /> Back to Browse Cars
          </Link>
        </div>
      </main>
      <MarketplaceFooter />
    </>
  );
}
