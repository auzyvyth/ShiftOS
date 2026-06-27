import React, { useState } from 'react';
import { Check, Clock, Circle, MinusCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { usePostSaleTasks } from '../../hooks/usePostSaleTasks';
import { POST_SALE_STEPS, OWNER_LABELS, STATUS_CONFIG } from '../../utils/postSaleSteps';

const STEP_META = Object.fromEntries(POST_SALE_STEPS.map((s) => [s.key, s]));

function StatusIcon({ status }) {
  if (status === 'done') return <Check size={16} />;
  if (status === 'in_progress') return <Clock size={15} />;
  if (status === 'na') return <MinusCircle size={15} />;
  return <Circle size={15} />;
}

// Renders the post-sale handover checklist for a won deal. Light-themed to match
// the dashboard shell. Marking a step done is a single tap on the round button;
// the row expands (tap anywhere on the title) for notes / due date / cost.
export default function PostSaleChecklist({ lead, compact = false, dark = false }) {
  const { tasks, loading, progress, updateTask } = usePostSaleTasks(lead);
  const [expanded, setExpanded] = useState(null);

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
                  onClick={() => updateTask(t.id, { status: isDone ? 'pending' : 'done' })}
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
