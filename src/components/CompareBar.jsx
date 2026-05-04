import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowLeftRight } from 'lucide-react';
import { useCompare } from '../hooks/useCompare';
import { supabase } from '../supabaseClient';

export default function CompareBar() {
  const { compareIds, removeFromCompare, clearCompare } = useCompare();
  const navigate = useNavigate();
  const [cars, setCars] = useState({});
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Animate in/out
  useEffect(() => {
    if (compareIds.length >= 1) setVisible(true);
    else {
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [compareIds.length]);

  // Fetch car data for any IDs not yet loaded
  useEffect(() => {
    const missing = compareIds.filter((id) => !cars[id]);
    if (!missing.length) return;
    supabase
      .from('car_listings')
      .select('id, year, brand, model, variant, selling_price, images')
      .in('id', missing)
      .then(({ data }) => {
        if (!data) return;
        setCars((prev) => {
          const next = { ...prev };
          data.forEach((c) => { next[c.id] = c; });
          return next;
        });
      });
  }, [compareIds]);

  if (!visible) return null;

  const shown = compareIds.length >= 1;
  const handleCompare = () => {
    const params = new URLSearchParams();
    compareIds.forEach((id, i) => params.set(['a', 'b', 'c'][i], id));
    navigate(`/compare?${params.toString()}`);
  };

  return (
    <>
      <style>{`
        @keyframes cb-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes cb-slide-down {
          from { transform: translateY(0);    opacity: 1; }
          to   { transform: translateY(100%); opacity: 0; }
        }
        .cb-bar {
          animation: ${shown ? 'cb-slide-up' : 'cb-slide-down'} 0.25s ease both;
        }
      `}</style>

      <div
        className="cb-bar"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: isMobile ? 60 : 0,
          zIndex: 200,
          background: 'rgba(6,12,20,0.98)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: isMobile ? '10px 14px' : '12px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* Thumbnails */}
          <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0, overflowX: 'auto' }}>
            {compareIds.map((id) => {
              const car = cars[id];
              const img = car?.images?.[0];
              const name = car
                ? [car.year, car.brand, car.model].filter(Boolean).join(' ')
                : '…';
              const price = car?.selling_price
                ? `RM ${Number(car.selling_price).toLocaleString('en-MY')}`
                : null;

              return (
                <div
                  key={id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    padding: '6px 10px 6px 6px',
                    flexShrink: 0,
                    minWidth: 0,
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{ width: 44, height: 36, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.06)' }}>
                    {img
                      ? <img src={img} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🚗</div>
                    }
                  </div>

                  {/* Info */}
                  {!isMobile && (
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{name}</p>
                      {price && <p style={{ margin: 0, fontSize: 11, color: '#60a5fa' }}>{price}</p>}
                    </div>
                  )}

                  {/* Remove */}
                  <button
                    onClick={() => removeFromCompare(id)}
                    style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0, marginLeft: isMobile ? 0 : 4 }}
                    aria-label="Remove from compare"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}

            {/* Empty slots */}
            {Array.from({ length: 3 - compareIds.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                style={{
                  width: isMobile ? 56 : 180,
                  height: isMobile ? 48 : 50,
                  borderRadius: 10,
                  border: '1px dashed rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>+ add car</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              onClick={clearCompare}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer', padding: '6px 4px', whiteSpace: 'nowrap' }}
            >
              Clear
            </button>
            <button
              onClick={handleCompare}
              disabled={compareIds.length < 2}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: compareIds.length >= 2 ? '#dc2626' : 'rgba(255,255,255,0.06)',
                border: 'none',
                borderRadius: 8,
                color: compareIds.length >= 2 ? '#fff' : 'rgba(255,255,255,0.3)',
                fontSize: 13,
                fontWeight: 600,
                padding: '9px 16px',
                cursor: compareIds.length >= 2 ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              <ArrowLeftRight size={14} />
              {isMobile ? 'Compare' : `Compare${compareIds.length >= 2 ? ` (${compareIds.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
