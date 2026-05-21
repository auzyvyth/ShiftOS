import React, { useEffect, useState } from 'react';
import { X, Heart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSavedCars } from '../hooks/useSavedCars';
import { supabase } from '../supabaseClient';
import CarCard from './CarCard';

export default function SavedCarsPanel({ open, onClose }) {
  const { savedIds, toggleSave, ready } = useSavedCars();
  const [cars, setCars]     = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch full car objects whenever savedIds changes and panel is open
  useEffect(() => {
    if (!ready) return;
    const ids = [...savedIds];
    if (!ids.length) { setCars([]); return; }
    setLoading(true);
    supabase
      .from('public_car_listings')
      .select('id,slug,brand,model,variant,year,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,colour,condition,images,status,created_at,dealer_id,auction_grade,interior_grade,is_recon,financing_type,engine_cc,previous_owners')
      .in('id', ids)
      .then(({ data }) => {
        if (data) {
          const map = Object.fromEntries(data.map(c => [c.id, c]));
          setCars(ids.map(id => map[id]).filter(Boolean));
        }
        setLoading(false);
      });
  }, [savedIds, ready]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const count = savedIds.size;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 800,
          background: 'rgba(0,0,0,0.55)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 801,
        width: 'min(420px, 100vw)',
        background: '#0d1117',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: open ? '-24px 0 80px rgba(0,0,0,0.5)' : 'none',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Heart size={16} fill="#dc2626" stroke="#dc2626" />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Outfit',sans-serif" }}>
              Saved Cars
            </span>
            {count > 0 && (
              <span style={{
                background: 'rgba(220,38,38,0.15)', color: '#f87171',
                fontSize: 11, fontWeight: 700, padding: '2px 8px',
                borderRadius: 20, fontFamily: "'Outfit',sans-serif",
                border: '1px solid rgba(220,38,38,0.25)',
              }}>
                {count}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 8, width: 32, height: 32, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#9ca3af',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {!ready || loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ height: 200, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'cc-shimmer 1.5s infinite', backgroundSize: '200% 100%' }} />
              ))}
            </div>
          ) : count === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, textAlign: 'center' }}>
              <Heart size={36} stroke="rgba(255,255,255,0.12)" />
              <p style={{ color: '#6b7280', fontSize: 14, fontFamily: "'Outfit',sans-serif", margin: 0 }}>
                No saved cars yet.
              </p>
              <p style={{ color: '#4b5563', fontSize: 13, fontFamily: "'Outfit',sans-serif", margin: 0 }}>
                Tap the ♥ on any listing to save it here.
              </p>
              <Link
                to="/showroom"
                onClick={onClose}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginTop: 8, padding: '9px 18px', borderRadius: 9,
                  background: '#dc2626', color: '#fff', textDecoration: 'none',
                  fontSize: 13, fontWeight: 700, fontFamily: "'Outfit',sans-serif",
                }}
              >
                Browse cars <ArrowRight size={13} />
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {cars.map(car => (
                <div key={car.id} onClick={onClose}>
                  <CarCard car={car} showDiscountBadge />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
