import React from 'react';
import { Users } from 'lucide-react';
import { STATUS, TONE, issueText, fmtMinutes } from '../../utils/teamHealth';
import { premiumLight as PL } from '../../theme/tokens';

// Team > People: ONE list of salesmen (plan step 4c + the 2026-11-16 design pass). One row per
// salesman, worst first, three numbers for ONE window (last 30 days): deals won out of new leads,
// median reply time, and profit on the cars they sold (only with "View gross profit"). Judgement
// (status, issues) is the database's (`gm_salesman_scores` -> `_team_health`); profit is Overview's
// engine grouped by seller (`sellerTotals`, ownerMoney.js). A row also says when commission waits
// for the owner. Tapping a row opens the person's sheet (details + tools); there are no cards.

export const fmtRM = (n) => {
  const v = Math.round(Number(n) || 0);
  const a = Math.abs(v);
  const s = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(1)}M` : a >= 10_000 ? `${Math.round(a / 1000)}k` : a.toLocaleString('en-MY');
  return `${v < 0 ? '-' : ''}RM ${s}`;
};

export function StatusWord({ status, label }) {
  const st = STATUS[status];
  const word = label || st?.label;
  if (!word) return null;
  const t = TONE[st?.tone || 'neutral'];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: t.fg, background: t.bg, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '.06em' }}>
      {word}
    </span>
  );
}

// What waits for the owner on this salesman's commission: approve first, then pay.
export function commissionDue(sold) {
  if (!sold) return null;
  if (sold.pending > 0) return { amount: sold.pending, text: 'to approve' };
  if (sold.approved > 0) return { amount: sold.approved, text: 'to pay' };
  return null;
}

export function Avatar({ person, size = 34 }) {
  return person.avatar_url
    ? <img src={person.avatar_url} alt="" style={{ width: size, height: size, borderRadius: size / 2, objectFit: 'cover', flexShrink: 0 }} />
    : <span style={{ width: size, height: size, borderRadius: size / 2, background: PL.raised, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#374151', flexShrink: 0 }}>{(person.full_name || person.name || '?')[0].toUpperCase()}</span>;
}

// The row's word: the account first (not set up, switched off), then the database's status.
export function personWord(p, s = {}) {
  if (p.role === 'salesman' && !p.setup_complete) return { label: 'Setup pending', status: 'never' };
  if (p.is_active === false) return { label: 'Switched off', status: 'new' };
  return { status: s.status };
}

export default function TeamScoreboard({ salesmen = [], scoreById = {}, loading, profitBy, soldMap = {}, onOpen }) {
  // A person's row = their account (always there) + the database's read of them (may be missing).
  const rows = salesmen.map((p) => {
    const s = scoreById[p.id] || {};
    const off = p.is_active === false;
    const setup = !p.setup_complete;
    return {
      p, s, off, setup,
      word: personWord(p, s),
      issues: off || setup ? [] : (s.issues || []).map((c) => issueText(c, s)).filter(Boolean),
      due: commissionDue(soldMap[p.id]),
    };
  }).sort((a, b) =>
    ((b.issues.length > 0 || b.setup) - (a.issues.length > 0 || a.setup))
    || (a.off - b.off)
    || ((b.s.won_30d ?? 0) - (a.s.won_30d ?? 0)));

  const showMoney = !!profitBy;
  const cols = [
    { key: 'won', label: 'Won', hint: 'of new leads', cell: ({ s }) => (s.leads_30d > 0 ? <>{s.won_30d ?? 0}<span className="tsb-dim"> of {s.leads_30d}</span></> : '—') },
    { key: 'reply', label: 'Reply', cell: ({ s }) => (s.avg_response_min != null
      ? <span style={{ color: s.avg_response_min > 60 ? PL.accentText : PL.text }}>{fmtMinutes(s.avg_response_min)}</span> : '—') },
    ...(showMoney ? [{ key: 'profit', label: 'Profit', hint: 'cars sold', cell: ({ p }) => {
      const t = profitBy[p.id];
      if (!t) return <span className="tsb-dim">—</span>;
      // Cars with no buy price are left out of profit (carPnl rule), and the row says how many.
      if (t.leftOut === t.units) return <span className="tsb-dim">No buy price</span>;
      return <>{fmtRM(t.gross)}{t.leftOut > 0 && <span className="tsb-dim"> +{t.leftOut} no buy price</span>}</>;
    } }] : []),
  ];
  const grid = `minmax(0, 1fr) ${cols.map((c) => (c.key === 'profit' ? '190px' : '96px')).join(' ')}`;

  if (loading && rows.length === 0) return <p style={{ fontSize: 13, color: PL.textMuted, padding: '18px 16px', margin: 0 }}>Loading...</p>;
  if (rows.length === 0) {
    return (
      <div style={{ padding: '26px 16px', textAlign: 'center' }}>
        <Users size={22} color="#d1d5db" style={{ margin: '0 auto 6px', display: 'block' }} />
        <p style={{ fontSize: 13, color: PL.textMuted, margin: 0 }}>No salesmen yet.</p>
      </div>
    );
  }

  return (
    <div className="tsb">
      <div className="tsb-head" style={{ gridTemplateColumns: grid }}>
        <span>Salesman</span>
        {cols.map((c) => <span key={c.key} style={{ textAlign: 'right' }}>{c.label}{c.hint && <em> {c.hint}</em>}</span>)}
      </div>
      {rows.map((r) => (
        <div
          key={r.p.id}
          role="button"
          tabIndex={0}
          className="tsb-row"
          style={{ gridTemplateColumns: grid, opacity: r.off ? 0.6 : 1 }}
          onClick={() => onOpen(r.p)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(r.p); } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Avatar person={r.p} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: PL.text }}>{r.p.full_name || r.s.name || '—'}</span>
                <StatusWord status={r.word.status} label={r.word.label} />
              </div>
              {(r.issues.length > 0 || r.due || r.setup) && (
                <div style={{ fontSize: 12, color: PL.textSec, marginTop: 2 }}>
                  {[r.setup && 'Has not finished the setup email', ...r.issues.slice(0, 2)].filter(Boolean).join(' · ')}
                  {r.due && (
                    <span style={{ color: PL.text, fontWeight: 600 }}>
                      {(r.issues.length > 0 || r.setup) ? ' · ' : ''}{fmtRM(r.due.amount)} commission {r.due.text}
                    </span>
                  )}
                </div>
              )}
              <div className="tsb-mob">
                {cols.map((c) => <span key={c.key}>{c.label} <b>{c.cell(r)}</b></span>)}
              </div>
            </div>
          </div>
          {cols.map((c) => <div key={c.key} className="tsb-cell">{c.cell(r)}</div>)}
        </div>
      ))}
      <style>{`
        .tsb-head{display:grid;gap:12px;padding:8px 12px;margin:0 4px;background:${PL.raised};border-radius:10px;font-size:10px;font-weight:700;color:${PL.textMuted};text-transform:uppercase;letter-spacing:.06em}
        .tsb-head em{font-style:normal;font-weight:500;text-transform:none;letter-spacing:0}
        .tsb-row{display:grid;gap:12px;align-items:center;padding:12px;margin:0 4px;border-bottom:1px solid ${PL.line};cursor:pointer;border-radius:12px}
        .tsb-row:last-of-type{border-bottom:none}
        .tsb-row:hover{background:${PL.raised}}
        .tsb-row:focus-visible{outline:2px solid ${PL.text};outline-offset:-2px}
        .tsb-cell{text-align:right;font-size:14px;font-weight:700;color:${PL.text};font-variant-numeric:tabular-nums;white-space:nowrap}
        .tsb-srow:hover{background:${PL.raised}}
        .tsb-srow:focus-visible{outline:2px solid ${PL.text};outline-offset:-2px}
        .tsb-dim{color:${PL.textMuted};font-weight:500}
        .tsb-mob{display:none}
        @media (max-width: 760px){
          .tsb-head,.tsb-cell{display:none}
          .tsb-row{display:block !important;padding:12px 8px}
          .tsb-mob{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px;font-size:12px;color:${PL.textMuted}}
          .tsb-mob b{color:${PL.text};font-weight:700;font-variant-numeric:tabular-nums}
        }
      `}</style>
    </div>
  );
}
