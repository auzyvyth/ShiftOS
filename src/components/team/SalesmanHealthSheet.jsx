import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalHistory } from '../../hooks/useModalHistory';
import { premiumLight as PL } from '../../theme/tokens';
import {
  STATUS, TONE, issueText, issueAdvice, noScoreReason, fmtMinutes, SCORE_PARTS, lastActiveText,
} from '../../utils/teamHealth';

// One salesman, read for the owner (TEAM-HEALTH). Everything here comes from the
// row gm_salesman_scores already returned: no extra query, and no maths of its
// own (the score's parts come from the DB too), so it can never disagree with
// the table or the daily alert. Light dealer-dashboard surface, quiet-terminal rules.

// premiumLight: white blocks floating on a white sheet (shadow), no card borders.
const INK = PL.text;
const MUTED = PL.textMuted;
const CARD = { background: PL.cardBg, borderRadius: 16, boxShadow: PL.shadow };
const MICRO = { fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: MUTED, fontWeight: 600 };
const NUM = { fontVariantNumeric: 'tabular-nums' };

function Tile({ label, value, note }) {
  return (
    <div style={{ ...CARD, padding: '12px 14px', minWidth: 0 }}>
      <div style={MICRO}>{label}</div>
      <div style={{ ...NUM, fontSize: 22, fontWeight: 700, color: INK, marginTop: 2 }}>{value}</div>
      {note && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{note}</div>}
    </div>
  );
}

export default function SalesmanHealthSheet({ person: s, onClose }) {
  useModalHistory(true, onClose);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const st = STATUS[s.status];
  const tone = TONE[st?.tone || 'neutral'];
  const issues = (s.issues || []).filter((c) => issueText(c, s));
  const parts = s.score_parts;

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      className="shs-wrap"
    >
      <style>{`@media (min-width: 640px){.shs-wrap{align-items:center!important}.shs-card{border-radius:14px!important;max-height:86vh!important}}`}</style>
      <div
        className="shs-card"
        role="dialog"
        aria-modal="true"
        aria-label={`${s.name || 'Salesman'} performance`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: PL.canvas, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', borderRadius: '14px 14px 0 0', fontFamily: 'system-ui, sans-serif' }}
      >
        {/* Header */}
        <div style={{ background: PL.card, borderBottom: `1px solid ${PL.line}`, padding: '16px 16px 14px', display: 'flex', gap: 12, alignItems: 'center', position: 'sticky', top: 0 }}>
          {s.avatar_url
            ? <img src={s.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 44, height: 44, borderRadius: 22, background: PL.raised, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#374151', flexShrink: 0 }}>{(s.name || '?')[0].toUpperCase()}</div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>{s.name || 'Salesman'}</span>
              {st && <span style={{ fontSize: 10, fontWeight: 700, color: tone.fg, background: tone.bg, borderRadius: 999, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '.06em' }}>{st.label}</span>}
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{lastActiveText(s)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={MICRO}>Score</div>
            {s.score != null
              ? <div style={{ ...NUM, fontSize: 22, fontWeight: 700, color: INK }}>{s.score}<span style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>/100</span></div>
              : <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, marginTop: 4 }}>{noScoreReason(s) || '—'}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: PL.raised, borderRadius: 999, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X size={16} color={MUTED} />
          </button>
        </div>

        <div style={{ padding: 16, display: 'grid', gap: 16 }}>
          {/* What needs attention */}
          <section>
            <div style={{ ...MICRO, marginBottom: 8 }}>What needs your attention</div>
            {issues.length === 0 ? (
              <div style={{ ...CARD, padding: '12px 14px', fontSize: 13, color: INK }}>
                Nothing. They are working their leads.
              </div>
            ) : (
              <div style={CARD}>
                {issues.map((c, i) => (
                  <div key={c} style={{ padding: '12px 14px', borderTop: i ? `1px solid ${PL.line}` : 'none' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{issueText(c, s)}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{issueAdvice(c)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* The numbers, last 30 days */}
          <section>
            <div style={{ ...MICRO, marginBottom: 8 }}>Last 30 days</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
              <Tile label="New leads" value={s.leads_30d ?? 0} />
              <Tile label="Followed up" value={s.leads_30d ? `${s.worked_30d ?? 0}/${s.leads_30d}` : '—'} note="by them" />
              <Tile label="Sold" value={s.won_30d ?? 0} note={s.conv_rate != null && s.leads_30d >= 3 ? `${Number(s.conv_rate).toFixed(1)}% of leads` : null} />
              <Tile label="Reply time" value={fmtMinutes(s.avg_response_min)} note={s.avg_response_min != null ? 'median' : 'no replies'} />
            </div>
          </section>

          {/* How the score is made */}
          <section>
            <div style={{ ...MICRO, marginBottom: 8 }}>How the score is made</div>
            <div style={{ ...CARD, padding: '14px' }}>
              {parts ? SCORE_PARTS.map((p) => {
                const v = Number(parts[p.key] || 0);
                return (
                  <div key={p.key} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: INK, marginBottom: 4 }}>
                      <span>{p.label}</span>
                      <span style={{ ...NUM, color: MUTED }}><b style={{ color: INK }}>{Math.round(v)}</b> / {p.max}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: PL.raised, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (v / p.max) * 100)}%`, height: '100%', background: INK, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              }) : (
                <div style={{ fontSize: 13, color: MUTED }}>
                  {s.status === 'inactive' || s.status === 'never'
                    ? 'No score while they are not using the app. A number here would only reflect what other people did on their leads.'
                    : 'A score needs at least 3 new leads in 30 days. Fewer than that is luck, not a pattern.'}
                </div>
              )}
              <div style={{ fontSize: 11, color: MUTED, borderTop: `1px solid ${PL.line}`, paddingTop: 8, marginTop: 2 }}>
                Only counts what {s.name || 'they'} did themselves. Changes you make on their leads do not count.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
