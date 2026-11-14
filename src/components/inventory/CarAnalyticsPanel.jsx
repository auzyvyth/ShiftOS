// The "Analytics" button of the dealer's car pop-up (owner, 2026-11-12): what buyers did on THIS car.
// It replaces the per-car table that lived in Reports > Listings. Same source
// (`get_dealer_car_analytics`), so the numbers match the row on the Inventory list.
// Views only count buyers who allowed analytics, so they undercount: the page says "counted".
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { premiumLight as PL } from '../../theme/tokens';

const WINDOWS = [[7, '7 days'], [30, '30 days'], [90, '90 days']];
const num = (n) => Number(n || 0).toLocaleString();

export default function CarAnalyticsPanel({ listing, dealerId }) {
  const [days, setDays] = useState(30);
  const [state, setState] = useState({ loading: true, error: false, row: null, scans: null });

  useEffect(() => {
    if (!dealerId) return undefined;
    let off = false;
    setState((s) => ({ ...s, loading: true, error: false }));
    Promise.all([
      supabase.rpc('get_dealer_car_analytics', { p_dealer_id: dealerId, p_days: days }),
      supabase.rpc('get_dealer_sticker_scans', { p_dealer_id: dealerId, p_days: days }),
    ]).then(([a, s]) => {
      if (off) return;
      if (a.error) { setState({ loading: false, error: true, row: null, scans: null }); return; }
      const row = (a.data || []).find((r) => r.car_id === listing.id) || null;
      const scanRow = s.error ? null : (s.data || []).find((r) => r.car_id === listing.id);
      setState({ loading: false, error: false, row, scans: s.error ? null : Number(scanRow?.scans) || 0 });
    }).catch(() => { if (!off) setState({ loading: false, error: true, row: null, scans: null }); });
    return () => { off = true; };
  }, [dealerId, listing.id, days]);

  const views = Number(state.row?.views) || 0;
  const wa = Number(state.row?.whatsapp) || 0;
  const calls = Number(state.row?.calls) || 0;
  const bookings = Number(state.row?.bookings) || 0;
  const taps = wa + calls;
  const cvr = views > 0 ? `${((taps / views) * 100).toFixed(1)}%` : '—';
  const listedDays = listing.created_at ? Math.max(0, Math.floor((Date.now() - new Date(listing.created_at).getTime()) / 86400000)) : null;
  const tiles = [['Views', views], ['WhatsApp', wa], ['Calls', calls], ['Bookings', bookings]];

  return (
    <div>
      <div role="group" aria-label="Time window" style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {WINDOWS.map(([d, label]) => (
          <button key={d} onClick={() => setDays(d)} aria-pressed={days === d}
            style={{ height: 34, padding: '0 14px', borderRadius: PL.radius.pill, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              background: days === d ? PL.text : PL.raised, color: days === d ? '#fff' : PL.textSec }}>{label}</button>
        ))}
      </div>

      {state.error ? (
        <div role="alert" style={{ background: PL.raised, borderRadius: PL.radius.row, padding: 14, fontSize: 13.5, color: PL.accentText }}>
          Could not load the numbers. Close this and open the car again.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {tiles.map(([k, v]) => (
              <div key={k} style={{ background: PL.raised, borderRadius: PL.radius.row, padding: '14px 16px', minHeight: 74 }}>
                <div style={{ fontSize: 10.5, color: PL.textMuted, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>{k}</div>
                {state.loading
                  ? <div aria-label="Loading" style={{ width: 44, height: 26, borderRadius: 6, background: PL.hover, marginTop: 6 }} />
                  : <div style={{ fontSize: 28, fontWeight: 800, color: v ? PL.text : PL.textMuted, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{num(v)}</div>}
              </div>
            ))}
          </div>

          <div style={{ background: PL.raised, borderRadius: PL.radius.row, padding: '2px 14px', marginTop: 8 }}>
            {[
              ['Conversion rate', state.loading ? '…' : cvr, '(WhatsApp + calls) divided by views'],
              ['Sticker scans', state.loading || state.scans == null ? '…' : num(state.scans), 'People who scanned the window sticker'],
              ['Listed for', listedDays == null ? '—' : `${num(listedDays)} day${listedDays === 1 ? '' : 's'}`, null],
            ].map(([k, v, hint], i) => (
              <div key={k} style={{ padding: '10px 0', borderTop: i ? `1px solid ${PL.line}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 13, color: PL.textSec }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: PL.text, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                </div>
                {hint && <div style={{ fontSize: 11.5, color: PL.textMuted, marginTop: 2 }}>{hint}</div>}
              </div>
            ))}
          </div>

          {!state.loading && views === 0 && taps === 0 && bookings === 0 && (
            <p style={{ margin: '12px 2px 0', fontSize: 13, color: PL.textSec }}>Nobody has been counted on this car in the last {days} days.</p>
          )}
          <p style={{ margin: '12px 2px 0', fontSize: 11.5, color: PL.textMuted }}>Views count only buyers who allowed analytics, so the real number is higher.</p>
        </>
      )}
    </div>
  );
}
