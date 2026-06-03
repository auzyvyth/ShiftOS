import React, { useState } from 'react';
import { Check, Clock, Circle, MinusCircle, Info } from 'lucide-react';
import { usePostSaleTasks } from '../../hooks/usePostSaleTasks';
import { POST_SALE_STEPS, OWNER_LABELS, STATUS_CONFIG } from '../../utils/postSaleSteps';

const STEP_META = Object.fromEntries(POST_SALE_STEPS.map((s) => [s.key, s]));
const STATUS_CYCLE = { pending: 'in_progress', in_progress: 'done', done: 'pending', na: 'pending' };

function StatusIcon({ status }) {
  if (status === 'done') return <Check size={15} />;
  if (status === 'in_progress') return <Clock size={15} />;
  if (status === 'na') return <MinusCircle size={15} />;
  return <Circle size={15} />;
}

// Renders the post-sale handover checklist for a won deal. Dark-themed so it
// drops into both the dealer dashboard and the salesman panel.
export default function PostSaleChecklist({ lead, compact = false }) {
  const { tasks, loading, progress, updateTask } = usePostSaleTasks(lead);
  const [expanded, setExpanded] = useState(null);

  if (loading && tasks.length === 0) {
    return <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', padding: 12 }}>Loading handover steps…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#059669' : '#dc2626', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: progress === 100 ? '#4ade80' : 'rgba(255,255,255,0.7)', minWidth: 64, textAlign: 'right' }}>
          {progress === 100 ? 'Completed' : `${progress}%`}
        </span>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tasks.map((t) => {
          const meta = STEP_META[t.step_key] || { label: t.step_key };
          const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending;
          const isOpen = expanded === t.id;
          return (
            <div key={t.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* status toggle */}
                <button
                  onClick={() => updateTask(t.id, { status: STATUS_CYCLE[t.status] || 'pending' })}
                  title="Click to advance status"
                  style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: sc.color, background: sc.bg, border: `1px solid ${sc.color}55` }}
                >
                  <StatusIcon status={t.status} />
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.status === 'done' ? 'rgba(255,255,255,0.5)' : '#f1f5f9', textDecoration: t.status === 'done' ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {meta.label}
                    </span>
                    {meta.hint && (
                      <Info size={12} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : t.id)} />
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                    {t.owner_role && (
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                        {OWNER_LABELS[t.owner_role] || t.owner_role}
                      </span>
                    )}
                    {t.cost != null && (
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>RM {Number(t.cost).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                {/* status pill */}
                <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.03em', padding: '3px 8px', borderRadius: 20, color: sc.color, background: sc.bg }}>
                  {sc.label}
                </span>
              </div>

              {isOpen && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 11.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.55)', margin: 0 }}>{meta.hint}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Due
                      <input type="date" value={t.due_date || ''} onChange={(e) => updateTask(t.id, { due_date: e.target.value || null })}
                        style={{ marginLeft: 6, fontSize: 11, padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f1f5f9' }} />
                    </label>
                    <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Cost RM
                      <input type="number" value={t.cost ?? ''} onChange={(e) => updateTask(t.id, { cost: e.target.value === '' ? null : Number(e.target.value) })}
                        style={{ marginLeft: 6, width: 80, fontSize: 11, padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f1f5f9' }} />
                    </label>
                    {meta.optional && (
                      <button onClick={() => updateTask(t.id, { status: t.status === 'na' ? 'pending' : 'na' })}
                        style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', color: t.status === 'na' ? '#fbbf24' : 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                        {t.status === 'na' ? 'Mark applicable' : 'Not applicable'}
                      </button>
                    )}
                  </div>
                  {!compact && (
                    <input type="text" placeholder="Notes…" defaultValue={t.notes || ''} onBlur={(e) => updateTask(t.id, { notes: e.target.value })}
                      style={{ fontSize: 11.5, padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f1f5f9' }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
