import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight, Search } from 'lucide-react';
import MarketplaceHeader from '../components/MarketplaceHeader';
import MarketplaceFooter from '../components/MarketplaceFooter';
import CarCard from '../components/CarCard';
import { useSavedCars, useSavedCarsDetails } from '../hooks/useSavedCars';
import { useMarketplaceTracking } from '../hooks/useMarketplaceTracking';

// Full-page view of the buyer's saved cars — the routed counterpart to the
// SavedCarsPanel drawer, sharing the same react-query cache (useSavedCars) so
// the two stay in sync. Reached from the footer "Saved Listings" link and any
// bookmarked /saved URL. Marketplace (light) theme.
export default function SavedCarsPage() {
  useMarketplaceTracking();
  const { savedIds, ready } = useSavedCars();
  const { cars, loading } = useSavedCarsDetails(savedIds, ready);
  const count = savedIds.size;

  useEffect(() => {
    document.title = 'Saved Cars | XDrive';
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2', display: 'flex', flexDirection: 'column' }}>
      <MarketplaceHeader />

      <main style={{ flex: 1, width: '100%', maxWidth: 1200, margin: '0 auto', padding: '28px 18px 64px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Heart size={18} fill="#dc2626" stroke="#dc2626" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: 0, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.03em' }}>
            Saved Cars
          </h1>
          {count > 0 && (
            <span style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(220,38,38,0.2)' }}>
              {count}
            </span>
          )}
        </div>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 26px', maxWidth: 560, lineHeight: 1.6 }}>
          Cars you've tapped the heart on, in one place. Saved on this browser and synced to your account when you log in — compare them, then message the seller when you're ready.
        </p>

        {/* Body */}
        {!ready || loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 320, borderRadius: 14, background: 'rgba(0,0,0,0.04)' }} />
            ))}
          </div>
        ) : count === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '56px 24px', textAlign: 'center', maxWidth: 480, margin: '12px auto 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#F7F6F2', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <Heart size={26} stroke="#9ca3af" />
            </div>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>No saved cars yet</p>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 22px', lineHeight: 1.6 }}>
              Tap the <Heart size={13} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }} fill="#dc2626" stroke="#dc2626" /> on any listing and it lands here so you can come back to it later.
            </p>
            <Link
              to="/showroom"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 10, background: '#dc2626', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}
            >
              <Search size={15} /> Browse all cars <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {cars.map((car) => (
              <CarCard key={car.id} car={car} showCompare />
            ))}
          </div>
        )}
      </main>

      <MarketplaceFooter />
    </div>
  );
}
