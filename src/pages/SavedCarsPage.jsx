import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';
import { useSavedCars } from '../hooks/useSavedCars';
import { supabase } from '../supabaseClient';
import CarCard from '../components/CarCard';

export default function SavedCarsPage() {
  const { savedIds, ready } = useSavedCars();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const ids = [...savedIds];
    if (!ids.length) {
      setCars([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('public_car_listings')
      .select('id,slug,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,colour,condition,images,status,created_at,dealer_id,auction_grade,interior_grade,is_recon,financing_type,engine_cc,previous_owners')
      .in('id', ids)
      .then(({ data }) => {
        if (data) {
          // Preserve the order from savedIds
          const map = Object.fromEntries(data.map((c) => [c.id, c]));
          setCars(ids.map((id) => map[id]).filter(Boolean));
        }
        setLoading(false);
      });
  }, [savedIds, ready]);

  const count = savedIds.size;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#080C14',
        fontFamily: "'DM Sans', sans-serif",
        color: '#f1f5f9',
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <Link
          to="/cars"
          style={{
            color: 'rgba(255,255,255,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} />
          Browse cars
        </Link>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* Title */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <Heart size={22} color="#dc2626" fill="#dc2626" />
            <h1
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 36,
                letterSpacing: '0.04em',
                margin: 0,
                color: '#f1f5f9',
              }}
            >
              SAVED CARS
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
            {count === 0
              ? 'No saved cars yet'
              : `${count} car${count === 1 ? '' : 's'} saved`}
          </p>
        </div>

        {/* States */}
        {!ready || loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 280,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  animation: 'pulse 1.5s ease infinite',
                }}
              />
            ))}
          </div>
        ) : cars.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(220,38,38,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Heart size={32} color="rgba(220,38,38,0.5)" />
            </div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#f1f5f9' }}>
              No saved cars yet
            </p>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 320 }}>
              Tap the heart icon on any car listing to save it here for easy access later.
            </p>
            <Link
              to="/cars"
              style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#dc2626',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Browse cars →
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {cars.map((car) => (
              <CarCard key={car.id} car={car} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
