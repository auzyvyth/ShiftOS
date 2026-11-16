import React, { useState } from 'react';
import { Users } from 'lucide-react';
import SalesmanHealthSheet from '../../components/team/SalesmanHealthSheet';
import { STATUS, TONE, issueText, noScoreReason, fmtMinutes, needsAttention } from '../../utils/teamHealth';
import { premiumLight as PL } from '../../theme/tokens';

// ONE table of how each salesman is doing (plan step 4c, 2026-11-16). It replaced four copies:
// Team's Leaderboard, Team's "Inactive 30d+" badge, Performance's score table and Performance's
// link-clicks list. Judgement (status, score, issues) is the database's (`gm_salesman_scores` ->
// `_team_health`, via useTeamScores); this file only lays it out. Clicks + WhatsApp are the
// salesman's link (`get_dealer_slug_analytics`), Sold is all time from TeamTab's sold map.
// Avg profit shows only with "View gross profit". Tap a row = SalesmanHealthSheet.

const fmtRMShort = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1_000_000) return `RM ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `RM ${(v / 1_000).toFixed(0)}k`;
  return `RM ${Math.round(v)}`;
};

// The status pill already says Inactive / Not started; the score column says why only when it adds something.
function whyNoScore(s) {
  if (s.status === 'inactive' || s.status === 'never') return '—';
  return noScoreReason(s) || '—';
}

// Phone: one line of the numbers that matter, the rest is in the details sheet (tap).
function phoneLine(s, sold, link) {
  const bits = [];
  bits.push(s.score != null ? ['Score', s.score] : null);
  if (s.leads_30d != null) bits.push(['Won', `${s.won_30d ?? 0}/${s.leads_30d}`]);
  if (s.avg_response_min != null) bits.push(['Reply', fmtMinutes(s.avg_response_min)]);
  if (link) bits.push(['Clicks', link.clicks]);
  bits.push(['Sold', sold || 0]);
  return bits.filter(Boolean);
}

export function StatusWord({ status }) {
  const st = STATUS[status];
  if (!st) return null;
  const t = TONE[st.tone];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: t.fg, background: t.bg, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '.06em' }}>
      {st.label}
    </span>
  );
}

function ScoreBar({ score }) {
  const color = score >= 50 ? PL.text : PL.accentText;
  const pct = Math.min(100, Math.max(0, score));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: 44, height: 5, background: '#eceef1', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
        <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
    </span>
  );
}

export default function TeamScoreboard({ scores, loading, salespeople = [], soldMap = {}, analyticsMap = {}, showMoney }) {
  const [openRep, setOpenRep] = useState(null);
  const slugOf = Object.fromEntries(salespeople.map((p) => [p.id, p.slug]));
  // Worst first: people with something to look at, then by score (no score last).
  const rows = [...scores].sort((a, b) =>
    ((b.issues || []).length > 0) - ((a.issues || []).length > 0)
    || (b.score ?? -1) - (a.score ?? -1));

  const cols = [
    { key: 'score', label: 'Score', w: 104, cell: (s) => (s.score != null ? <ScoreBar score={s.score} /> : <span style={{ fontSize: 11, color: PL.textMuted }}>{whyNoScore(s)}</span>) },
    { key: 'leads', label: 'Won / leads', w: 96, cell: (s) => (s.leads_30d != null ? `${s.won_30d ?? 0} / ${s.leads_30d}` : '—') },
    { key: 'conv', label: 'Close rate', cell: (s) => (s.conv_rate != null && (s.leads_30d ?? 0) >= 3 ? `${Number(s.conv_rate).toFixed(0)}%` : '—') },
    { key: 'reply', label: 'Reply', cell: (s) => (s.avg_response_min != null
      ? <span style={{ color: s.avg_response_min > 60 ? PL.accentText : PL.up }}>{fmtMinutes(s.avg_response_min)}</span> : '—') },
    ...(showMoney ? [{ key: 'gp', label: 'Avg profit', cell: (s) => (s.avg_gp != null ? fmtRMShort(s.avg_gp) : '—') }] : []),
    { key: 'link', label: 'Link clicks', w: 112, cell: (s) => {
      const a = analyticsMap[slugOf[s.id]];
      return a ? <>{a.clicks}<span style={{ color: PL.textMuted, fontWeight: 500 }}> · {a.whatsapp} WA</span></> : '—';
    } },
    { key: 'sold', label: 'Sold', hint: 'ever', w: 72, cell: (s) => soldMap[s.id]?.sold || 0 },
  ];
  // Fixed widths: every row is its own grid, so auto widths drifted row to row.
  const grid = `minmax(0, 1fr) ${cols.map((c) => `${c.w || 88}px`).join(' ')}`;
  const attention = needsAttention(scores);

  return (
    <section style={{ padding: '14px 16px 6px', borderBottom: `1px solid ${PL.line}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: PL.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>How each salesman is doing</p>
        {!loading && scores.length > 0 && (
          <span style={{ fontSize: 12, fontWeight: 600, color: attention ? PL.accentText : PL.textSec }}>
            {attention ? `${attention} need${attention === 1 ? 's' : ''} a look` : 'All on track'}
          </span>
        )}
      </div>
      <p style={{ fontSize: 11.5, color: PL.textMuted, margin: '0 0 10px' }}>
        Last 30 days, counting only what each salesman did themselves. Tap a name for the details.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: PL.textMuted, padding: '14px 0', margin: 0 }}>Loading...</p>
      ) : rows.length === 0 ? (
        <div style={{ padding: '22px 12px', textAlign: 'center', background: PL.raised, borderRadius: PL.radius.row, marginBottom: 10 }}>
          <Users size={22} color="#d1d5db" style={{ margin: '0 auto 6px', display: 'block' }} />
          <p style={{ fontSize: 13, color: PL.textMuted, margin: 0 }}>No salesman activity recorded yet.</p>
        </div>
      ) : (
        <div className="tsb">
          <div className="tsb-head" style={{ gridTemplateColumns: grid }}>
            <span>Salesman</span>
            {cols.map((c) => <span key={c.key} style={{ textAlign: 'right' }}>{c.label}{c.hint && <em> {c.hint}</em>}</span>)}
          </div>
          {rows.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              className="tsb-row"
              style={{ gridTemplateColumns: grid }}
              onClick={() => setOpenRep(s)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenRep(s); } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                {s.avatar_url
                  ? <img src={s.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: 15, objectFit: 'cover', flexShrink: 0 }} />
                  : <span style={{ width: 30, height: 30, borderRadius: 15, background: PL.raised, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#374151', flexShrink: 0 }}>{(s.name || '?')[0].toUpperCase()}</span>}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: PL.text }}>{s.name || '—'}</span>
                    <StatusWord status={s.status} />
                  </div>
                  {(s.issues || []).length > 0 && (
                    <div style={{ fontSize: 11.5, color: PL.textSec, marginTop: 2 }}>
                      {s.issues.map((c) => issueText(c, s)).filter(Boolean).slice(0, 2).join(' · ')}
                    </div>
                  )}
                  <div className="tsb-mob">
                    {phoneLine(s, soldMap[s.id]?.sold, analyticsMap[slugOf[s.id]]).map(([k, val]) => (
                      <span key={k}>{k} <b>{val}</b></span>
                    ))}
                  </div>
                </div>
              </div>
              {cols.map((c) => (
                <div key={c.key} className="tsb-cell" data-label={c.label}>{c.cell(s)}</div>
              ))}
            </div>
          ))}
        </div>
      )}

      {openRep && <SalesmanHealthSheet person={openRep} onClose={() => setOpenRep(null)} />}
      <style>{`
        .tsb-head{display:grid;gap:10px;padding:8px 10px;background:${PL.raised};border-radius:10px;font-size:10px;font-weight:700;color:${PL.textMuted};text-transform:uppercase;letter-spacing:.06em}
        .tsb-head em{font-style:normal;font-weight:500;text-transform:none;letter-spacing:0}
        .tsb-row{display:grid;gap:10px;align-items:center;padding:11px 10px;border-bottom:1px solid ${PL.line};cursor:pointer;border-radius:10px}
        .tsb-row:last-child{border-bottom:none}
        .tsb-row:hover{background:${PL.raised}}
        .tsb-row:focus-visible{outline:2px solid ${PL.text};outline-offset:-2px}
        .tsb-cell{text-align:right;font-size:13px;font-weight:600;color:${PL.text};font-variant-numeric:tabular-nums;white-space:nowrap}
        .tsb-mob{display:none}
        @media (max-width: 760px){
          .tsb-head,.tsb-cell{display:none}
          .tsb-row{display:block !important;padding:12px 4px}
          .tsb-mob{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px;font-size:12px;color:${PL.textMuted}}
          .tsb-mob b{color:${PL.text};font-weight:700;font-variant-numeric:tabular-nums}
        }
      `}</style>
    </section>
  );
}
