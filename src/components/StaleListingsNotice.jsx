import React from 'react';

// Shown above a public car grid that is painting the device's saved copy of
// the listings because the live fetch failed (see LIVE_CARS_CACHE_KEY in
// marketplaceConfig.js). Neutral, not an error banner: the buyer can still
// browse, and the copy says plainly that what they see may be out of date.
export default function StaleListingsNotice({ onRetry }) {
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '12px', flexWrap: 'wrap',
        background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '10px',
        padding: '10px 14px', marginBottom: '14px',
        fontFamily: "'Outfit',sans-serif", fontSize: '14px', color: '#4b5563',
      }}
    >
      <span style={{ minWidth: 0 }}>
        Can't reach the server right now. Showing cars from your last visit, some may already be sold.
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: '#111827', fontWeight: 700, fontSize: '14px',
            fontFamily: "'Outfit',sans-serif", textDecoration: 'underline',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
