import React, { useState, useEffect, useRef } from 'react';
import { Check, Clock, Circle, MinusCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { usePostSaleTasks } from '../../hooks/usePostSaleTasks';
import { POST_SALE_STEPS, OWNER_LABELS, STATUS_CONFIG } from '../../utils/postSaleSteps';

const STEP_META = Object.fromEntries(POST_SALE_STEPS.map((s) => [s.key, s]));

// Malaysian motor policies and road tax both run 12 months, so that is the
// default the expiry field opens with — a correct guess in the normal case, one
// the rep can overwrite when the policy actually differs.
const plusMonths = (iso, n) => {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d)) return '';
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

function StatusIcon({ status }) {
  if (status === 'done') return <Check size={16} />;
  if (status === 'in_progress') return <Clock size={15} />;
  if (status === 'na') return <MinusCircle size={15} />;
  return <Circle size={15} />;
}

// Renders the post-sale handover checklist for a won deal. Light-themed to match
// the dashboard shell. Marking a step done is a single tap on the round button;
// the row expands (tap anywhere on the title) for notes / due date / cost.
export default function PostSaleChecklist({ lead, compact = false, dark = false, onTasksChange = null, onExpiryWritten = null }) {
  const { tasks, loading, progress, updateTask } = usePostSaleTasks(lead);
  const [expanded, setExpanded] = useState(null);

  // Writing an expiry changes the CUSTOMER row too (trg_sync_customer_expiry
  // fans result_date out to customers.insurance_expiry / road_tax_expiry). The
  // Customers tab loads its rows once at page bootstrap, so without this it
  // kept showing "Insurance —" for a policy that was already in the database.
  const writeExpiry = async (id, patch) => {
    await updateTask(id, patch);
    if (onExpiryWritten) onExpiryWritten();
  };

  // Report the live steps up to whoever owns the board. Ticking a step used to
  // move the bar in here while the card above it kept showing the old
  // percentage and the old "Next:" step until the tab was remounted.
  // The handler is held in a ref deliberately: parents pass an inline arrow, so
  // keying the effect on it would re-fire on every render and, since reporting
  // up re-renders the parent, spin forever.
  const reportRef = useRef(onTasksChange);
  reportRef.current = onTasksChange;
  useEffect(() => {
    if (reportRef.current && tasks.length) reportRef.current(tasks);
  }, [tasks]);

  const th = dark
    ? { rowBg: 'rgba(255,255,255,0.03)', rowDoneBg: 'rgba(255,255,255,0.015)', border: 'rgba(255,255,255,0.1)', text: '#f1f5f9', sub: '#9ca3af', muted: 'rgba(255,255,255,0.4)', track: 'rgba(255,255,255,0.1)', chip: 'rgba(255,255,255,0.06)', inputBg: 'rgba(255,255,255,0.05)', inputBorder: 'rgba(255,255,255,0.15)', totalBg: 'rgba(255,255,255,0.03)' }
    : { rowBg: '#fff', rowDoneBg: '#f9fafb', border: '#e5e7eb', text: '#111827', sub: '#6b7280', muted: '#9ca3af', track: '#e5e7eb', chip: '#f3f4f6', inputBg: '#fff', inputBorder: '#d1d5db', totalBg: '#f9fafb' };

  if (loading && tasks.length === 0) {
    return <p style={{ fontSize: 13, color: th.sub, padding: 12 }}>Loading handover steps…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 99, background: th.track, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#059669' : '#dc2626', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: progress === 100 ? '#059669' : th.sub, minWidth: 64, textAlign: 'right' }}>
          {progress === 100 ? 'Completed' : `${progress}%`}
        </span>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tasks.map((t) => {
          const meta = STEP_META[t.step_key] || { label: t.step_key };
          const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending;
          const isOpen = expanded === t.id;
          const isDone = t.status === 'done';
          return (
            <div key={t.id} style={{ background: isDone ? th.rowDoneBg : th.rowBg, border: `1px solid ${th.border}`, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* One-tap complete: pending/in-progress -> done, done -> pending */}
                <button
                  onClick={() => {
                    const status = isDone ? 'pending' : 'done';
                    const patch = { status };
                    // The +12m date shown below a completed expiry step was
                    // PREFILL ONLY: it rendered from `plusMonths(completed_at)`
                    // but result_date stayed NULL unless the rep opened the
                    // picker and changed it. So the rep saw "30/08/2027",
                    // believed it was recorded, and nothing was.
                    //
                    // Downstream that lost the road tax date outright. The
                    // won-trigger carries the SELLER's old road_tax_expiry over
                    // from car_listings, and sync_customer_expiry_from_task only
                    // overwrites an existing date when result_date is set — so
                    // with it NULL the customer kept the previous owner's expiry,
                    // which is precisely the date this step just replaced.
                    //
                    // Completing the step IS the renewal, so persist the date at
                    // that moment. The rep can still correct it in the picker.
                    if (status === 'done' && meta.expiryLabel && !t.result_date) {
                      patch.result_date = plusMonths(null, 12);
                    }
                    if (meta.expiryLabel) writeExpiry(t.id, patch);
                    else updateTask(t.id, patch);
                  }}
                  title={isDone ? 'Tap to reopen this step' : 'Tap to mark done'}
                  style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: sc.color, background: sc.bg, border: `1.5px solid ${sc.color}66` }}
                >
                  <StatusIcon status={t.status} />
                </button>

                {/* Whole title block is the expand control — a big, obvious tap target */}
                <button
                  onClick={() => setExpanded(isOpen ? null : t.id)}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', padding: '2px 0', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isDone ? th.muted : th.text, textDecoration: isDone ? 'line-through' : 'none', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {meta.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                      {t.owner_role && (
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: th.muted }}>
                          {OWNER_LABELS[t.owner_role] || t.owner_role}
                        </span>
                      )}
                      {t.cost != null && (
                        <span style={{ fontSize: 10, color: th.sub }}>RM {Number(t.cost).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.03em', padding: '3px 8px', borderRadius: 20, color: sc.color, background: sc.bg }}>
                    {sc.label}
                  </span>
                  {isOpen ? <ChevronDown size={15} color={th.muted} /> : <ChevronRight size={15} color={th.muted} />}
                </button>
              </div>

              {/* Capture the date this step produced, at the moment it is produced.
                  Deliberately NOT hidden behind the expand chevron: it is the
                  one thing we need from the rep, and it only appears on the two
                  steps that produce a date, once the step is actually done. */}
              {isDone && meta.expiryLabel && (
                <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 8, background: th.chip, border: `1px solid ${th.border}` }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: th.sub }}>{meta.expiryLabel}</span>
                  <input
                    type="date"
                    value={t.result_date || plusMonths(t.completed_at, 12)}
                    onChange={(e) => writeExpiry(t.id, { result_date: e.target.value || null })}
                    title="Prefilled 12 months ahead. Correct it if the real policy differs — the customer's renewal reminder runs off this date."
                    style={{ fontSize: 11.5, padding: '5px 7px', borderRadius: 6, background: th.inputBg, border: `1px solid ${th.inputBorder}`, color: th.text }}
                  />
                  <span style={{ fontSize: 10, color: th.muted }}>reminds the customer automatically</span>
                </div>
              )}

              {isOpen && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 11.5, lineHeight: 1.5, color: th.sub, margin: 0 }}>{meta.hint}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Quick status overrides for the less-common states */}
                    <button onClick={() => updateTask(t.id, { status: 'in_progress' })}
                      style={{ fontSize: 10, fontWeight: 600, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', color: t.status === 'in_progress' ? '#d97706' : th.sub, background: t.status === 'in_progress' ? 'rgba(217,119,6,0.1)' : th.chip, border: `1px solid ${th.border}` }}>
                      In progress
                    </button>
                    {meta.optional && (
                      <button onClick={() => updateTask(t.id, { status: t.status === 'na' ? 'pending' : 'na' })}
                        style={{ fontSize: 10, fontWeight: 600, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', color: t.status === 'na' ? '#d97706' : th.sub, background: th.chip, border: `1px solid ${th.border}` }}>
                        {t.status === 'na' ? 'Mark applicable' : 'Not applicable'}
                      </button>
                    )}
                    <label style={{ fontSize: 10, color: th.muted, display: 'inline-flex', alignItems: 'center' }}>Due
                      <input type="date" value={t.due_date || ''} onChange={(e) => updateTask(t.id, { due_date: e.target.value || null })}
                        style={{ marginLeft: 6, fontSize: 11, padding: '5px 7px', borderRadius: 6, background: th.inputBg, border: `1px solid ${th.inputBorder}`, color: th.text }} />
                    </label>
                    <label style={{ fontSize: 10, color: th.muted, display: 'inline-flex', alignItems: 'center' }}>Cost RM
                      <input type="number" value={t.cost ?? ''} onChange={(e) => updateTask(t.id, { cost: e.target.value === '' ? null : Number(e.target.value) })}
                        style={{ marginLeft: 6, width: 80, fontSize: 11, padding: '5px 7px', borderRadius: 6, background: th.inputBg, border: `1px solid ${th.inputBorder}`, color: th.text }} />
                    </label>
                  </div>
                  {!compact && (
                    <input type="text" placeholder="Notes…" defaultValue={t.notes || ''} onBlur={(e) => updateTask(t.id, { notes: e.target.value })}
                      style={{ fontSize: 11.5, padding: '7px 9px', borderRadius: 6, background: th.inputBg, border: `1px solid ${th.inputBorder}`, color: th.text }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total processing cost (Puspakom, JPJ, road tax, etc.) */}
      {(() => {
        const total = tasks.filter((t) => t.status !== 'na').reduce((s, t) => s + (Number(t.cost) || 0), 0);
        if (total <= 0) return null;
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: th.totalBg, border: `1px solid ${th.border}` }}>
            <span style={{ fontSize: 11.5, color: th.sub }}>Processing cost</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: th.text }}>RM {total.toLocaleString()}</span>
          </div>
        );
      })()}
    </div>
  );
}
