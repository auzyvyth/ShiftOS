import React, { useEffect, useState, useMemo } from 'react';
import { useModalHistory } from '../hooks/useModalHistory';
import { supabase } from '../supabaseClient';
import { usePersistentState } from '../hooks/usePersistentState';
import { premiumLight as PL } from '../theme/tokens';
import '../theme/premiumLight.css';

// hp_docs holds the buyer's loan documents (IC, payslips) — never to disk.
const redactHp = (rows) => (rows || []).map(({ hp_docs, ...rest }) => rest);

const HP_STATUS = {
  // premiumLight (2026-11-16): one grey fill, the WORD carries the meaning. Waiting on the bank is
  // plain; approved is the good green; disbursed is done (ink); rejected is red.
  pending:   { label: 'Pending',   color: PL.textSec,    bg: PL.raised, border: 'transparent' },
  approved:  { label: 'Approved',  color: PL.up,         bg: PL.raised, border: 'transparent' },
  rejected:  { label: 'Rejected',  color: PL.accentText, bg: PL.raised, border: 'transparent' },
  disbursed: { label: 'Disbursed', color: PL.text,       bg: PL.raised, border: 'transparent' },
};

const REJECTION_CATEGORIES = [
  { value: 'ccris_issue',          label: 'CCRIS / Blacklist' },
  { value: 'income_insufficient',  label: 'Income Insufficient' },
  { value: 'dsr_exceeded',         label: 'DSR Exceeded' },
  { value: 'age_limit',            label: 'Age Limit' },
  { value: 'employment_type',      label: 'Employment Type' },
  { value: 'vehicle_age',          label: 'Vehicle Too Old' },
  { value: 'other',                label: 'Other' },
];

function fmtRM(n) {
  return 'RM ' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function daysSince(ts) {
  return Math.floor((Date.now() - new Date(ts)) / 86400000);
}
function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.max(0, Math.floor((new Date(b) - new Date(a)) / 86400000));
}

// ── Bank Scorecard ─────────────────────────────────────────────────────────────
function BankScorecard({ rows }) {
  const banks = useMemo(() => {
    const map = {};
    for (const r of rows) {
      if (!r.bank_name) continue;
      if (!map[r.bank_name]) map[r.bank_name] = { name: r.bank_name, total: 0, approved: 0, rejected: 0, disbursed: 0, decisionDays: [], rejectionReasons: {} };
      const b = map[r.bank_name];
      b.total++;
      if (r.status === 'approved' || r.status === 'disbursed') {
        b.approved++;
        const d = daysBetween(r.submitted_at, r.approved_at);
        if (d !== null) b.decisionDays.push(d);
      }
      if (r.status === 'disbursed') b.disbursed++;
      if (r.status === 'rejected') {
        b.rejected++;
        const d = daysBetween(r.submitted_at, r.rejected_at);
        if (d !== null) b.decisionDays.push(d);
        const cat = r.rejection_reason_category || 'other';
        b.rejectionReasons[cat] = (b.rejectionReasons[cat] || 0) + 1;
      }
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [rows]);

  if (banks.length === 0) return null;

  return (
    <div style={{ marginBottom: 20, background: '#fff', borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: '16px 14px' }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: PL.text, margin: '0 0 10px' }}>How each bank is doing</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
              {['Bank', 'Submitted', 'Approval Rate', 'Avg Decision', 'Disbursed', 'Top Rejection Reason'].map(h => (
                <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {banks.map(b => {
              const approvalRate = b.total > 0 ? Math.round((b.approved / b.total) * 100) : 0;
              const avgDays = b.decisionDays.length > 0 ? Math.round(b.decisionDays.reduce((s, d) => s + d, 0) / b.decisionDays.length) : null;
              const topRejection = Object.entries(b.rejectionReasons).sort((a, z) => z[1] - a[1])[0];
              const topRejLabel = topRejection ? REJECTION_CATEGORIES.find(c => c.value === topRejection[0])?.label ?? topRejection[0] : '—';
              const rateColor = approvalRate >= 70 ? PL.up : approvalRate >= 40 ? PL.text : PL.accentText;
              return (
                <tr key={b.name} style={{ borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 700, color: '#111827' }}>{b.name}</td>
                  <td style={{ padding: '9px 12px', color: '#374151' }}>{b.total}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, color: rateColor }}>{approvalRate}%</span>
                      <div style={{ width: 60, height: 4, background: PL.raised, borderRadius: 2 }}>
                        <div style={{ width: `${approvalRate}%`, height: '100%', background: rateColor, borderRadius: 2 }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '9px 12px', color: avgDays !== null && avgDays > 7 ? PL.accentText : '#9ca3af' }}>
                    {avgDays !== null ? `${avgDays}d` : '—'}
                  </td>
                  <td style={{ padding: '9px 12px', color: PL.text, fontWeight: 600 }}>{b.disbursed}</td>
                  <td style={{ padding: '9px 12px', color: '#6b7280', fontSize: 12 }}>{topRejLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Reject Modal ───────────────────────────────────────────────────────────────
function RejectModal({ onConfirm, onCancel }) {
  useModalHistory(true, onCancel);
  const [category, setCategory] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: 24, width: 340, maxWidth: 'calc(100vw - 32px)' }}>
        <p style={{ fontWeight: 700, color: '#111827', marginBottom: 6 }}>Rejection Reason</p>
        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 18 }}>Select the bank's rejection reason to track performance.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {REJECTION_CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              style={{
                padding: '9px 14px', borderRadius: 8, textAlign: 'left', fontSize: 13, cursor: 'pointer',
                background: category === c.value ? '#eceef1' : PL.raised, border: 'none',
                color: category === c.value ? PL.text : '#374151', fontWeight: category === c.value ? 700 : 400,
                fontWeight: category === c.value ? 600 : 400,
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="pl-btn-grey" onClick={onCancel} style={{ flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button
            onClick={() => category && onConfirm(category)}
            disabled={!category}
            style={{ flex: 1, padding: '9px', borderRadius: 8, background: category ? '#dc2626' : 'rgba(220,38,38,0.3)', border: 'none', color: '#fff', cursor: category ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}
          >
            Confirm Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function HPBoard({ dealerId }) {
  const [rows, setRows, cached] = usePersistentState(dealerId ? `hp:${dealerId}` : null, [], { redact: redactHp });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [rejectTarget, setRejectTarget] = useState(null); // row id pending rejection

  const recentCutoff = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 3); return d; }, []);

  useEffect(() => {
    if (!dealerId) return;
    supabase
      .from('deal_financing')
      .select('*, lead:leads(buyer_name, phone, assigned_to, salesman:profiles!leads_assigned_to_fkey(full_name), car_listing:car_listings(brand, model, year))')
      .eq('dealer_id', dealerId)
      .order('submitted_at', { ascending: false })
      .then(({ data }) => { setRows(data || []); setLoading(false); });
  }, [dealerId]);

  const handleStatusUpdate = async (id, patch) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('deal_financing')
      .update({ ...patch, updated_at: now, status_changed_at: now })
      .eq('id', id);
    if (!error) setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch, status_changed_at: now } : r));
  };

  const handleReject = async (category) => {
    if (!rejectTarget) return;
    await handleStatusUpdate(rejectTarget, {
      status: 'rejected',
      rejection_reason_category: category,
      rejected_at: new Date().toISOString(),
    });
    setRejectTarget(null);
  };

  const counts = useMemo(() => ({
    pending: rows.filter(r => r.status === 'pending').length,
    approved: rows.filter(r => r.status === 'approved').length,
    rejected: rows.filter(r => r.status === 'rejected').length,
    disbursed: rows.filter(r => r.status === 'disbursed').length,
  }), [rows]);

  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter);

  const summaryTotal = useMemo(() => ({
    pending: rows.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.loan_amount), 0),
    approved: rows.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.loan_amount), 0),
    disbursed: rows.filter(r => r.status === 'disbursed').reduce((s, r) => s + Number(r.loan_amount), 0),
  }), [rows]);

  if (loading && !cached) return <p style={{ color: '#4b5563', fontSize: 13, padding: 16 }}>Loading HP board…</p>;

  return (
    <div>
      {rejectTarget && <RejectModal onConfirm={handleReject} onCancel={() => setRejectTarget(null)} />}

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Pending', count: counts.pending, amount: summaryTotal.pending, ...HP_STATUS.pending },
          { label: 'Approved', count: counts.approved, amount: summaryTotal.approved, ...HP_STATUS.approved },
          { label: 'Disbursed', count: counts.disbursed, amount: summaryTotal.disbursed, ...HP_STATUS.disbursed },
          { label: 'Rejected', count: counts.rejected, amount: 0, ...HP_STATUS.rejected },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: '14px 16px' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: s.color, margin: 0 }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: PL.text, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>{s.count}</p>
            <p style={{ fontSize: 12, color: PL.textMuted, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>{s.amount > 0 ? fmtRM(s.amount) : '\u00a0'}</p>
          </div>
        ))}
      </div>

      {/* Recent status changes banner */}
      {(() => {
        const recent = rows.filter(r => r.status_changed_at && new Date(r.status_changed_at) >= recentCutoff);
        if (recent.length === 0) return null;
        return (
          <div className="pl-note" style={{ marginBottom: 16, padding: "10px 14px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: PL.text, marginBottom: 6 }}>{recent.length} status update{recent.length !== 1 ? 's' : ''} in the last 3 days</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recent.slice(0, 5).map(r => {
                const s = HP_STATUS[r.status] || HP_STATUS.pending;
                const car = r.lead?.car_listing;
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: s.color, background: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 11, flexShrink: 0 }}>{s.label}</span>
                    <span style={{ flex: 1, minWidth: 0, color: '#374151' }}>
                      {r.bank_name}
                      {r.lead?.buyer_name && <span style={{ color: '#6b7280' }}> · {r.lead.buyer_name}</span>}
                      {car && <span style={{ color: '#9ca3af' }}> · {car.year} {car.brand} {car.model}</span>}
                    </span>
                    <span style={{ color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(r.status_changed_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Bank scorecard */}
      <BankScorecard rows={rows} />

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['all', 'All'], ...Object.entries(HP_STATUS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            style={{
              fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
              background: filter === k ? '#eceef1' : 'transparent', border: 'none',
              color: filter === k ? PL.text : PL.textSec,
            }}
          >
            {label} ({k === 'all' ? rows.length : counts[k] || 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#4b5563', fontSize: 13 }}>
          {rows.length === 0 ? 'No HP submissions yet. Add them from the F&I panel or lead drawer.' : `No ${filter} submissions.`}
        </div>
      ) : (
        // Card layout — one application per card. Reads top-to-bottom (bank +
        // status, who/what, the numbers, then context + actions) so there's no
        // 11-column horizontal scroll and it works on a phone.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(row => {
            const days = daysSince(row.submitted_at);
            const overdue = row.status === 'pending' && days > 5;
            const car = row.lead?.car_listing;
            const s = HP_STATUS[row.status] || HP_STATUS.pending;
            const recentlyUpdated = row.status_changed_at && new Date(row.status_changed_at) >= recentCutoff;
            const rejLabel = row.rejection_reason_category
              ? REJECTION_CATEGORIES.find(c => c.value === row.rejection_reason_category)?.label ?? row.rejection_reason_category
              : null;
            const figure = (label, value, strong) => (
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#9ca3af', margin: 0 }}>{label}</p>
                <p style={{ fontSize: strong ? 15 : 13, fontWeight: strong ? 800 : 600, color: strong ? '#111827' : '#374151', margin: '3px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
              </div>
            );
            return (
              <div key={row.id} style={{ background: '#fff', borderRadius: PL.radius.card, padding: 16, boxShadow: PL.shadow }}>
                {/* Header: bank + who/what, status on the right */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>{row.bank_name}</p>
                    <p style={{ fontSize: 12.5, color: '#6b7280', margin: '3px 0 0' }}>
                      {row.lead?.buyer_name || 'Buyer —'}{car ? ` · ${car.year} ${car.brand} ${car.model}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 20, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
                    {recentlyUpdated && <span style={{ fontSize: 10, fontWeight: 600, color: PL.textMuted }}>Updated recently</span>}
                  </div>
                </div>

                {/* The numbers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, margin: '12px 0', padding: '10px 0', borderTop: '1px solid rgba(17,24,39,0.06)', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                  {figure('Amount', fmtRM(row.loan_amount), true)}
                  {figure('Tenure', `${row.tenure_months}m`)}
                  {figure('Monthly', row.monthly_install ? fmtRM(row.monthly_install) : '—')}
                </div>

                {/* Context + actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 11.5, color: '#9ca3af', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
                    <span style={{ color: overdue ? PL.accentText : '#9ca3af', fontWeight: overdue ? 700 : 400 }}>
                      {days === 0 ? 'Submitted today' : `${days}d ago`}{overdue ? ' · overdue' : ''}
                    </span>
                    {row.lead?.salesman?.full_name && <span>· {row.lead.salesman.full_name}</span>}
                    {row.status === 'rejected' && rejLabel && <span style={{ color: PL.accentText }}>· {rejLabel}</span>}
                  </div>
                  {(row.status === 'pending' || row.status === 'approved') && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {row.status === 'pending' && (
                        <>
                          <button onClick={() => handleStatusUpdate(row.id, { status: 'approved', approved_at: new Date().toISOString() })} style={{ fontSize: 12, fontWeight: 700, padding: '7px 16px', borderRadius: 10, background: PL.accent, border: 'none', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Approve</button>
                          <button className="pl-btn-grey" onClick={() => setRejectTarget(row.id)} style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 10, cursor: 'pointer' }}>Reject</button>
                        </>
                      )}
                      {row.status === 'approved' && (
                        <button onClick={() => handleStatusUpdate(row.id, { status: 'disbursed', disbursed_at: new Date().toISOString() })} style={{ fontSize: 12, fontWeight: 700, padding: '7px 16px', borderRadius: 10, background: PL.text, border: 'none', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Mark Disbursed</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
