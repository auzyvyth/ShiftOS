// The pop-up behind every Overview number (owner, 2026-11-15: "when clicked, any number should pop up
// every detail where it comes from, each list adds up to 100%"). It only DRAWS what
// src/utils/moneyExplain.js returns; it does no maths of its own, so it cannot disagree with the number
// that opened it. premiumLight look: a white sheet, grey bars, ink words, no coloured borders.
// Portalled with a scroll lock and Back-to-close (CLAUDE.md overlay rules 1, 2 and 5).
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { premiumLight as PL } from '../../theme/tokens';
import { useModalHistory } from '../../hooks/useModalHistory';

const SHOWN = 8; // rows shown before "Show all"

const fmt = (v, kind = 'rm') => {
  const x = Number(v) || 0;
  if (kind === 'count') return x.toLocaleString('en-MY');
  if (kind === 'days') return `${Math.round(x)} days`;
  const r = Math.round(Math.abs(x));
  return `${x < 0 ? '-' : ''}RM ${r.toLocaleString('en-MY')}`;
};

function Rows({ rows, kind }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, SHOWN);
  const maxPct = Math.max(1, ...rows.map((r) => Math.abs(r.pct || 0)));
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {shown.map((r, i) => {
        const bad = r.tone === 'bad' || r.value < 0;
        return (
          <div key={`${r.label}-${i}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: PL.text, overflowWrap: 'anywhere' }}>{r.label}</div>
                {r.sub && <div style={{ fontSize: 12, color: PL.textMuted, marginTop: 1 }}>{r.sub}</div>}
              </div>
              <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: bad ? PL.accentText : r.tone === 'good' ? PL.up : PL.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(r.value, r.kind || kind)}</div>
                {r.pct != null && <div style={{ fontSize: 12, color: PL.textSec, fontVariantNumeric: 'tabular-nums' }}>{r.pct.toFixed(1)}%</div>}
              </div>
            </div>
            {r.pct != null && (
              <div style={{ height: 6, background: PL.raised, borderRadius: 99, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (Math.abs(r.pct) / maxPct) * 100))}%`, background: bad ? PL.accentText : PL.accent, borderRadius: 99 }} />
              </div>
            )}
          </div>
        );
      })}
      {rows.length > SHOWN && (
        <button type="button" onClick={() => setAll((v) => !v)} style={{ minHeight: 40, border: 0, borderRadius: 12, background: PL.raised, color: PL.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

export default function MoneyDetailSheet({ detail, onClose }) {
  useModalHistory(true, onClose);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  if (!detail) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={detail.title} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', background: PL.card, color: PL.text, borderRadius: '20px 20px 0 0', padding: '18px 20px calc(24px + env(safe-area-inset-bottom))', fontFamily: 'inherit', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: PL.textSec, fontWeight: 600 }}>{detail.title}</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: Number(detail.total) < 0 ? PL.accentText : PL.text, marginTop: 2 }}>{fmt(detail.total, detail.kind)}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ flex: '0 0 44px', height: 44, border: 0, borderRadius: 22, background: PL.raised, color: PL.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {detail.empty && (
          <p style={{ fontSize: 14, color: PL.textSec, lineHeight: 1.55, margin: '18px 0 0' }}>Nothing to show for this yet.</p>
        )}

        <div style={{ display: 'grid', gap: 26, marginTop: 22 }}>
          {detail.sections.map((s) => (
            <section key={s.heading}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: PL.textMuted, marginBottom: 12 }}>{s.heading}</div>
              <Rows rows={s.rows} kind={detail.kind === 'days' ? 'count' : detail.kind} />
              {s.rows.every((r) => r.pct != null) && s.rows.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${PL.line}`, marginTop: 14, paddingTop: 10, fontSize: 12.5, color: PL.textSec }}>
                  <span>Total</span><span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>100%</span>
                </div>
              )}
              {s.note && <p style={{ fontSize: 12, color: PL.textMuted, margin: '8px 0 0' }}>{s.note}</p>}
            </section>
          ))}
        </div>
        {detail.note && <p style={{ fontSize: 12, color: PL.textMuted, lineHeight: 1.5, margin: '22px 0 0' }}>{detail.note}</p>}
      </div>
    </div>,
    document.body,
  );
}
