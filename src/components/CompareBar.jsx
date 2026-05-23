import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowLeftRight, Car } from 'lucide-react';
import { useCompare } from '../hooks/useCompare';
import { supabase } from '../supabaseClient';

export default function CompareBar() {
  const { compareIds, removeFromCompare, clearCompare } = useCompare();
  const navigate = useNavigate();
  const [cars, setCars] = useState({});
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const panelRef = useRef(null);
  const prevCountRef = useRef(compareIds.length);

  // Track whether bubble just appeared (for pop animation)
  const [justAppeared, setJustAppeared] = useState(compareIds.length > 0);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Trigger pop animation only when going from 0 → 1+
  useEffect(() => {
    if (prevCountRef.current === 0 && compareIds.length > 0) {
      setJustAppeared(true);
      const t = setTimeout(() => setJustAppeared(false), 300);
      prevCountRef.current = compareIds.length;
      return () => clearTimeout(t);
    }
    if (compareIds.length === 0) setOpen(false);
    prevCountRef.current = compareIds.length;
  }, [compareIds.length]);

  // Fetch car data for new IDs
  useEffect(() => {
    const missing = compareIds.filter((id) => !cars[id]);
    if (!missing.length) return;
    supabase
      .from('public_car_listings')
      .select('id, year, brand, model, selling_price, images')
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

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (compareIds.length === 0) return null;

  const count = compareIds.length;
  const canCompare = count >= 2;

  const handleCompare = () => {
    const params = new URLSearchParams();
    compareIds.forEach((id, i) => params.set(['a', 'b', 'c', 'd'][i], id));
    navigate(`/compare?${params.toString()}`);
    setOpen(false);
  };

  return (
    <>
      <style>{`
        @keyframes cb-pop {
          0%   { transform: scale(0.6); opacity: 0; }
          70%  { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes cb-panel-up {
          from { transform: translateY(10px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .cb-bubble-anim { animation: cb-pop 0.28s cubic-bezier(0.34,1.56,0.64,1) both; }
        .cb-panel-anim  { animation: cb-panel-up 0.2s ease both; }
        .cb-car-row:hover { background: rgba(255,255,255,0.07) !important; }
        .cb-action-btn { transition: opacity 0.15s, transform 0.15s; }
        .cb-action-btn:hover { opacity: 0.85; transform: scale(1.03); }
      `}</style>

      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          right: isMobile ? 12 : 24,
          bottom: isMobile ? 80 : 24,
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 10,
          fontFamily: "'DM Sans', sans-serif",
          maxWidth: isMobile ? 'calc(100vw - 24px)' : 320,
        }}
      >
        {/* ── Expanded panel ── */}
        {open && (
          <div
            className="cb-panel-anim"
            style={{
              background: 'rgba(8,12,20,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: '16px',
              width: isMobile ? 'min(288px, calc(100vw - 24px))' : 300,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Compare Cars
              </span>
              <button
                onClick={clearCompare}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: 0, fontFamily: "'DM Sans',sans-serif" }}
              >
                Clear all
              </button>
            </div>

            {/* Car slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {compareIds.map((id) => {
                const car = cars[id];
                const img = car?.images?.[0];
                const name = car ? [car.year, car.brand, car.model].filter(Boolean).join(' ') : '…';
                const price = car?.selling_price ? `RM ${Number(car.selling_price).toLocaleString('en-MY')}` : null;
                return (
                  <div
                    key={id}
                    className="cb-car-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 10, padding: '8px 10px',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ width: 48, height: 36, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.06)' }}>
                      {img
                        ? <img src={img} alt={name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car size={18} color="#4b5563" /></div>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
                      {price && <p style={{ margin: 0, fontSize: 11, color: '#60a5fa' }}>{price}</p>}
                    </div>
                    <button
                      onClick={() => removeFromCompare(id)}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })}

              {/* Empty slots */}
              {Array.from({ length: 4 - count }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  style={{
                    height: 52, borderRadius: 10,
                    border: '1px dashed rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em' }}>+ add a car</span>
                </div>
              ))}
            </div>

            {/* Compare button */}
            <button
              onClick={handleCompare}
              disabled={!canCompare}
              className="cb-action-btn"
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                background: canCompare ? '#dc2626' : 'rgba(255,255,255,0.05)',
                border: 'none', borderRadius: 10,
                color: canCompare ? '#fff' : 'rgba(255,255,255,0.25)',
                fontSize: 13, fontWeight: 700, padding: '11px',
                cursor: canCompare ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <ArrowLeftRight size={14} />
              {canCompare ? `Compare ${count} Cars` : 'Add at least 2 cars'}
            </button>
          </div>
        )}

        {/* ── Floating bubble ── */}
        <button
          className={justAppeared ? 'cb-bubble-anim' : ''}
          onClick={() => setOpen((o) => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: open ? '#b91c1c' : '#dc2626',
            border: 'none', borderRadius: 50,
            padding: '10px 16px 10px 12px',
            color: '#fff', cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(220,38,38,0.5)',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'background 0.2s',
          }}
        >
          <ArrowLeftRight size={16} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {count} {count === 1 ? 'car' : 'cars'}
          </span>
          <span style={{
            background: 'rgba(255,255,255,0.25)', borderRadius: 50,
            width: 18, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, marginLeft: 2,
          }}>
            {count}
          </span>
        </button>
      </div>
    </>
  );
}
