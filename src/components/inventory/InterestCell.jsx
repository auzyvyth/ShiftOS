// Inventory row: the five buyer numbers for ONE car, last 30 days (Views, WhatsApp, Calls,
// Bookings, CVR). Owner, 2026-11-12: this is what Reports > Listings showed per car, moved onto
// the car's own row. null stats = still loading: a placeholder, never a 0.
import React from 'react';
import { premiumLight } from '../../theme/tokens';

export default function InterestCell({ stats, compact, scans }) {
  if (!stats) {
    return <span aria-label="Loading" style={{ display: 'inline-block', width: compact ? '100%' : 280, height: compact ? 52 : 46, borderRadius: 12, background: premiumLight.raised }} />;
  }
  // The same five numbers the old Reports > Listings table showed, now on the car's own row (owner,
  // 2026-11-12). CVR = (WhatsApp + calls) / views, as that table computed it.
  const wa = stats.wa || 0, calls = stats.calls || 0, bookings = stats.bookings || 0;
  const cvr = stats.views > 0 ? `${(((wa + calls) / stats.views) * 100).toFixed(1)}%` : '—';
  const cells = [['Views', stats.views], ['WhatsApp', wa], ['Calls', calls], ['Bookings', bookings], ['CVR', cvr]];
  return (
    <div title="Last 30 days. Views count only buyers who allowed analytics, so the real number is higher."
      style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4, width: compact ? '100%' : 280 }}>
      {cells.map(([k, v]) => (
        <div key={k} style={{ background: premiumLight.raised, borderRadius: 10, padding: compact ? '8px 2px' : '6px 2px', textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontSize: compact ? 15 : 14, fontWeight: 700, color: v && v !== '—' ? premiumLight.text : premiumLight.textMuted, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: premiumLight.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</div>
        </div>
      ))}
      {scans ? <div style={{ gridColumn: '1 / -1', fontSize: 11, color: premiumLight.textSec, marginTop: 2 }}>{scans} sticker scan{scans === 1 ? '' : 's'}</div> : null}
    </div>
  );
}
