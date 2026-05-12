import React, { useState, useEffect, useRef } from 'react';
import { Bell, BellOff, X, Check, LogIn } from 'lucide-react';
import { supabase } from '../supabaseClient';

/**
 * "Save this search" button for ShowroomPage.
 * Signs user in with Google if needed, then saves the active
 * filter state as a price_alerts row.
 *
 * Props:
 *   filters  object  — { brand, model, variant, bodyType, state,
 *                        condition, maxPrice, minYear, maxYear }
 *   hasFilters bool  — show the button only when something is filtered
 */
export default function PriceAlertButton({ filters, hasFilters }) {
  const [session, setSession]   = useState(null);
  const [saved, setSaved]       = useState(false);   // just saved
  const [alertId, setAlertId]   = useState(null);    // existing alert id for this filter set
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [alerts, setAlerts]     = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const dropRef                 = useRef(null);

  // Track auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Load user's alerts when signed in
  useEffect(() => {
    if (!session) { setAlerts([]); return; }
    supabase.from('price_alerts').select('*').eq('is_active', true).order('created_at', { ascending: false })
      .then(({ data }) => setAlerts(data || []));
  }, [session, saved]);

  // Check if this exact filter combo is already saved
  useEffect(() => {
    if (!alerts.length) { setAlertId(null); return; }
    const match = alerts.find(a =>
      (a.brand       || null) === (filters.brand    || null) &&
      (a.model       || null) === (filters.model    || null) &&
      (a.max_price   || null) === (filters.maxPrice || null) &&
      (a.state       || null) === (filters.state    || null)
    );
    setAlertId(match?.id || null);
  }, [alerts, filters]);

  // Close on outside click
  useEffect(() => {
    if (!alertsOpen) return;
    const handler = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setAlertsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [alertsOpen]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  };

  const saveAlert = async () => {
    if (!session) { signInWithGoogle(); return; }
    setLoading(true);
    const { error } = await supabase.from('price_alerts').insert({
      user_id:   session.user.id,
      email:     session.user.email,  // trigger will overwrite with canonical value
      brand:     filters.brand    || null,
      model:     filters.model    || null,
      variant:   filters.variant  || null,
      body_type: filters.bodyType || null,
      state:     filters.state    || null,
      condition: filters.condition|| null,
      max_price: filters.maxPrice ? Number(filters.maxPrice) : null,
      min_year:  filters.minYear  ? Number(filters.minYear)  : null,
      max_year:  filters.maxYear  ? Number(filters.maxYear)  : null,
    });
    setLoading(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };

  const deleteAlert = async (id) => {
    await supabase.from('price_alerts').delete().eq('id', id);
    setAlerts(prev => prev.filter(a => a.id !== id));
    if (id === alertId) setAlertId(null);
  };

  if (!hasFilters && !alerts.length) return null;

  const isAlreadySaved = !!alertId;

  return (
    <div ref={dropRef} style={{ position: 'relative', display: 'flex', gap: '6px', alignItems: 'center' }}>
      {/* Save button */}
      {hasFilters && (
        <button
          onClick={isAlreadySaved ? () => deleteAlert(alertId) : saveAlert}
          disabled={loading}
          title={isAlreadySaved ? 'Remove alert' : session ? 'Save this search as an alert' : 'Sign in to save alert'}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 12px', borderRadius: '9px', cursor: loading ? 'wait' : 'pointer',
            border: isAlreadySaved ? '1px solid rgba(220,38,38,0.35)' : '1px solid rgba(0,0,0,0.1)',
            background: isAlreadySaved ? 'rgba(220,38,38,0.08)' : saved ? 'rgba(74,222,128,0.1)' : '#ffffff',
            color: isAlreadySaved ? '#dc2626' : saved ? '#4ade80' : '#6b7280',
            fontSize: '13px', fontWeight: '600',
            fontFamily: "'Outfit',sans-serif", transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
        >
          {saved
            ? <><Check size={13} /> Saved</>
            : isAlreadySaved
              ? <><BellOff size={13} /> Remove alert</>
              : session
                ? <><Bell size={13} /> Save search</>
                : <><LogIn size={13} /> Save search</>
          }
        </button>
      )}

      {/* My alerts badge */}
      {session && alerts.length > 0 && (
        <button
          onClick={() => setAlertsOpen(v => !v)}
          title="My saved alerts"
          style={{
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '34px', height: '34px', borderRadius: '9px', cursor: 'pointer',
            border: '1px solid rgba(0,0,0,0.1)', background: alertsOpen ? 'rgba(220,38,38,0.08)' : '#ffffff',
            color: alertsOpen ? '#dc2626' : '#6b7280', transition: 'all 0.15s',
          }}
        >
          <Bell size={13} />
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: '#dc2626', color: '#fff', fontSize: '9px',
            fontWeight: '800', borderRadius: '20px', padding: '1px 5px',
            fontFamily: "'Outfit',sans-serif", lineHeight: 1.4,
          }}>
            {alerts.length}
          </span>
        </button>
      )}

      {/* Alerts dropdown */}
      {alertsOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          width: '300px', background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '14px', boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
          zIndex: 400, overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', fontFamily: "'Outfit',sans-serif" }}>My saved searches</span>
            <button onClick={() => setAlertsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}><X size={13} /></button>
          </div>
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {alerts.map(a => {
              const parts = [a.brand, a.model, a.variant].filter(Boolean);
              const tags  = [
                a.state       && a.state,
                a.max_price   && `≤ RM ${(a.max_price/1000).toFixed(0)}k`,
                a.min_year    && `From ${a.min_year}`,
                a.body_type   && a.body_type,
              ].filter(Boolean);
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.04)', gap: '8px' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827', fontFamily: "'Outfit',sans-serif", marginBottom: '3px' }}>
                      {parts.length ? parts.join(' · ') : 'All cars'}
                    </p>
                    {tags.length > 0 && (
                      <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', fontFamily: "'Outfit',sans-serif" }}>
                        {tags.join(' · ')}
                      </p>
                    )}
                  </div>
                  <button onClick={() => deleteAlert(a.id)} title="Remove alert" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', flexShrink: 0, display: 'flex', padding: '2px' }}>
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ padding: '10px 14px' }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', fontFamily: "'Outfit',sans-serif" }}>
              You'll be emailed when new listings match a saved search.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
