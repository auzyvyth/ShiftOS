import React, { useState } from 'react';

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

// Text colours for a LIGHT card: the pastel ones above are for dark surfaces
// and were near-unreadable on the white marketplace card.
const LIGHT_TEXT = {
  '#4ade80': '#15803d', '#60a5fa': '#1d4ed8', '#facc15': '#a16207',
  '#fb923c': '#c2410c', '#f87171': '#b91c1c', '#e5e7eb': '#374151',
};

const FALLBACK = { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.18)', text: '#e5e7eb', tip: '' };

/**
 * GradeBadge — displays auction grade + interior grade side by side.
 *
 * Props:
 *   auctionGrade  string  e.g. "4.5"
 *   interiorGrade string  e.g. "A"
 *   size          "sm" (default) | "lg"
 *   labelled      bool    prefix "Grade" — without it a bare "4.5" on a
 *                         search card reads as a star rating
 *   light         bool    on a light surface (darker text, dark divider)
 */
export default function GradeBadge({ auctionGrade, interiorGrade, size = 'sm', labelled = false, light = false }) {
  const [tipOpen, setTipOpen] = useState(false);
  if (!auctionGrade && !interiorGrade) return null;

  const cfg   = auctionGrade ? (GRADE_CFG[auctionGrade] || FALLBACK) : FALLBACK;
  const isLg  = size === 'lg';
  const gradeText = light ? (LIGHT_TEXT[cfg.text] || cfg.text) : cfg.text;
  const font = 'var(--xd-font-body)';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        title={cfg.tip || ''}
        onClick={(e) => {
          // Native title tooltips never fire on touch devices — most buyers
          // are on mobile, so without a tap affordance this grade is
          // unexplained on every card. stopPropagation: the badge sits
          // inside a whole-card click-to-navigate area.
          if (!cfg.tip) return;
          e.stopPropagation();
          setTipOpen((o) => !o);
          setTimeout(() => setTipOpen(false), 2500);
        }}
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
          cursor: cfg.tip ? 'pointer' : 'default',
        }}
      >
        {labelled && (
          <span style={{ color: gradeText, fontSize: isLg ? '12px' : '10px', fontWeight: '600', opacity: 0.85, fontFamily: font }}>Grade</span>
        )}
        {auctionGrade && (
          <span style={{
            color: gradeText,
            fontSize: isLg ? '15px' : '11px',
            fontWeight: '800',
            letterSpacing: '0.02em',
            fontFamily: font,
          }}>
            {auctionGrade}
          </span>
        )}
        {auctionGrade && interiorGrade && (
          <span style={{ color: light ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)', fontSize: isLg ? '13px' : '9px' }}>│</span>
        )}
        {interiorGrade && (
          <span style={{
            color: light ? '#374151' : '#d1d5db',
            fontSize: isLg ? '13px' : '10px',
            fontWeight: '700',
            fontFamily: font,
          }}>
            {interiorGrade}
          </span>
        )}
      </div>
      {tipOpen && cfg.tip && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: 6,
          background: '#111827', color: '#f3f4f6', fontSize: 11, fontWeight: 600,
          padding: '5px 9px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 20,
          boxShadow: '0 4px 14px rgba(0,0,0,0.3)', fontFamily: font,
        }}>
          Grade {auctionGrade || interiorGrade}: {cfg.tip}
        </div>
      )}
    </div>
  );
}
