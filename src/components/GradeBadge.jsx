import React from 'react';

/* ── Grade colour map ──────────────────────────────────────── */
const GRADE_CFG = {
  S:     { bg: 'rgba(34,197,94,0.18)',   border: 'rgba(34,197,94,0.4)',   text: '#4ade80', tip: 'Excellent condition' },
  '5':   { bg: 'rgba(34,197,94,0.18)',   border: 'rgba(34,197,94,0.4)',   text: '#4ade80', tip: 'Excellent condition' },
  '4.5': { bg: 'rgba(34,197,94,0.18)',   border: 'rgba(34,197,94,0.4)',   text: '#4ade80', tip: 'Excellent condition' },
  '4':   { bg: 'rgba(59,130,246,0.18)',  border: 'rgba(59,130,246,0.4)',  text: '#60a5fa', tip: 'Good condition' },
  '3.5': { bg: 'rgba(59,130,246,0.18)',  border: 'rgba(59,130,246,0.4)',  text: '#60a5fa', tip: 'Good condition' },
  '3':   { bg: 'rgba(234,179,8,0.18)',   border: 'rgba(234,179,8,0.4)',   text: '#facc15', tip: 'Fair condition' },
  R:     { bg: 'rgba(249,115,22,0.18)',  border: 'rgba(249,115,22,0.4)',  text: '#fb923c', tip: 'Accident repaired' },
  RA:    { bg: 'rgba(249,115,22,0.18)',  border: 'rgba(249,115,22,0.4)',  text: '#fb923c', tip: 'Accident repaired' },
  '2':   { bg: 'rgba(220,38,38,0.18)',   border: 'rgba(220,38,38,0.4)',   text: '#f87171', tip: 'Poor condition' },
  '1':   { bg: 'rgba(220,38,38,0.18)',   border: 'rgba(220,38,38,0.4)',   text: '#f87171', tip: 'Poor condition' },
};

const FALLBACK = { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.18)', text: '#e5e7eb', tip: '' };

/**
 * GradeBadge — displays auction grade + interior grade side by side.
 *
 * Props:
 *   auctionGrade  string  e.g. "4.5"
 *   interiorGrade string  e.g. "A"
 *   size          "sm" (default) | "lg"
 */
export default function GradeBadge({ auctionGrade, interiorGrade, size = 'sm' }) {
  if (!auctionGrade && !interiorGrade) return null;

  const cfg   = auctionGrade ? (GRADE_CFG[auctionGrade] || FALLBACK) : FALLBACK;
  const isLg  = size === 'lg';

  return (
    <div
      title={cfg.tip || ''}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isLg ? '7px' : '4px',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: isLg ? '9px' : '6px',
        padding: isLg ? '6px 12px' : '3px 7px',
        backdropFilter: 'blur(6px)',
        lineHeight: 1,
      }}
    >
      {auctionGrade && (
        <span style={{
          color: cfg.text,
          fontSize: isLg ? '15px' : '11px',
          fontWeight: '800',
          letterSpacing: '0.02em',
          fontFamily: "'DM Sans',sans-serif",
        }}>
          {auctionGrade}
        </span>
      )}
      {auctionGrade && interiorGrade && (
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: isLg ? '13px' : '9px' }}>│</span>
      )}
      {interiorGrade && (
        <span style={{
          color: '#d1d5db',
          fontSize: isLg ? '13px' : '10px',
          fontWeight: '700',
          fontFamily: "'DM Sans',sans-serif",
        }}>
          {interiorGrade}
        </span>
      )}
    </div>
  );
}
