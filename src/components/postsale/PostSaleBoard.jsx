import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, Car, Clock, AlertTriangle, UserRound, RefreshCw } from 'lucide-react';
import useHandover from '../../hooks/useHandover';
import PostSaleChecklist from './PostSaleChecklist';

// Target handover turnaround in Malaysia (settle loan -> JPJ -> road tax ->
// handover) is roughly 2-3 weeks. Past 21 days a deal is overdue.
const SLA_WARN_DAYS = 14;
const SLA_BREACH_DAYS = 21;
function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - new Date(ts)) / 86400000);
}

// Lists won deals that still need post-sale processing. dealerId scopes to a
// dealership; pass salesmanId to scope to one salesman's own sold deals.
//
// `controller` is a useHandover() instance owned by the page. Pass it wherever
// other surfaces (a pipeline card, a customer row) show handover state too, so
// all of them read and refresh the same data. Left out, the board keeps its own
// instance and behaves standalone — that is the dealer dashboard's case.
export default function PostSaleBoard({
  dealerId,
  salesmanId = null,
  dark = false,
  controller = null,
  openDealId = null,
  onViewCustomer = null,
}) {
  // Hooks can't be conditional: always call it, but starve it of a dealerId
  // when the page already handed us a controller so it never double-fetches.
  const ownController = useHandover(controller ? null : dealerId, salesmanId);
  const h = controller || ownController;
  const { deals, progressByLead: progressMap, nextStepByLead: nextStepMap, loading, error, refresh, setTasksForLead } = h;

  const [open, setOpen] = useState(null);
  const [hideDone, setHideDone] = useState(true);

  // Deep link from another tab ("open this buyer's handover") — expand that
  // deal and scroll it into view once it is on screen.
  useEffect(() => {
    if (!openDealId) return;
    setOpen(openDealId);
    const el = document.getElementById(`handover-deal-${openDealId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [openDealId, deals]);

  // Theme tokens — light (dealer dashboard shell) or dark (salesman panel).
  const t = dark
    ? { panelBg: 'rgba(255,255,255,0.03)', cardBg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)', divider: 'rgba(255,255,255,0.06)', text: '#f1f5f9', sub: '#9ca3af', chip: 'rgba(255,255,255,0.06)', chipBorder: 'rgba(255,255,255,0.1)', chipText: '#d1d5db', track: 'rgba(255,255,255,0.1)', btnBg: 'rgba(255,255,255,0.06)' }
    : { panelBg: '#fff', cardBg: '#fff', border: '#e5e7eb', divider: '#f3f4f6', text: '#111827', sub: '#6b7280', chip: '#f3f4f6', chipBorder: '#e5e7eb', chipText: '#374151', track: '#e5e7eb', btnBg: '#f3f4f6' };
  const PANEL = { background: t.panelBg, border: `1px solid ${t.border}`, borderRadius: 16, padding: 'clamp(12px, 3vw, 18px)' };

  if (loading && deals.length === 0) return <div style={PANEL}><p style={{ fontSize: 13, color: t.sub, margin: 0 }}>Loading sold deals…</p></div>;

  // A failed read used to render as "No sold deals yet" — the one empty state
  // that makes a salesman think their win vanished. Say what happened instead.
  if (error && deals.length === 0) {
    return (
      <div style={{ ...PANEL, textAlign: 'center' }}>
        <AlertTriangle size={24} color="#dc2626" style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: t.text, margin: '0 0 10px' }}>Could not load your sold deals.</p>
        <button onClick={refresh} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: t.chipText, background: t.btnBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}>
          <RefreshCw size={13} /> Try again
        </button>
      </div>
    );
  }

  const visible = (hideDone ? deals.filter((d) => progressMap[d.id] !== 100) : deals)
    .slice()
    .sort((a, b) => {
      // Active deals first; among them the most RECENT on top so newly added
      // customers surface immediately. Done deals sink to the bottom.
      const aDone = progressMap[a.id] === 100, bDone = progressMap[b.id] === 100;
      if (aDone !== bDone) return aDone ? 1 : -1;
      return (daysSince(a.updated_at) || 0) - (daysSince(b.updated_at) || 0);
    });

  const overdueCount = deals.filter(
    (d) => progressMap[d.id] !== 100 && (daysSince(d.updated_at) || 0) > SLA_BREACH_DAYS
  ).length;
  const doneCount = deals.filter((d) => progressMap[d.id] === 100).length;

  if (deals.length === 0) {
    return (
      <div style={{ ...PANEL, textAlign: 'center', color: t.sub }}>
        <Car size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
        <p style={{ fontSize: 13, margin: 0 }}>No sold deals yet. Won deals show up here for handover processing.</p>
      </div>
    );
  }

  return (
    <div style={{ ...PANEL, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 12, color: t.sub, margin: 0 }}>
            {deals.filter((d) => progressMap[d.id] !== 100).length} in processing
          </p>
          {overdueCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#dc2626', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '3px 9px' }}>
              <AlertTriangle size={12} />{overdueCount} overdue
            </span>
          )}
          {doneCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 8, padding: '3px 9px' }}>
              {doneCount} completed
            </span>
          )}
        </div>
        {doneCount > 0 ? (
          <button onClick={() => setHideDone((v) => !v)} style={{ fontSize: 11, fontWeight: 600, color: t.sub, background: t.btnBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>
            {hideDone ? `Show completed (${doneCount})` : 'Hide completed'}
          </button>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 600, color: t.sub, opacity: 0.7 }}>No completed yet</span>
        )}
      </div>

      {visible.map((d) => {
        const car = d.car_listings;
        const carLabel = car ? `${car.year || ''} ${car.brand || ''} ${car.model || ''}`.trim() : 'No car linked';
        const prog = progressMap[d.id];
        const isOpen = open === d.id;
        const done = prog === 100;
        const age = daysSince(d.updated_at);
        const slaColor = done ? '#059669' : age > SLA_BREACH_DAYS ? '#dc2626' : age >= SLA_WARN_DAYS ? '#d97706' : '#9ca3af';
        const blocker = done ? null : nextStepMap[d.id];
        return (
          <div key={d.id} id={`handover-deal-${d.id}`} style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <button
              onClick={() => setOpen(isOpen ? null : d.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              {isOpen ? <ChevronDown size={16} color="#9ca3af" /> : <ChevronRight size={16} color="#9ca3af" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: t.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.buyer_name || 'Buyer'}</p>
                <p style={{ fontSize: 11.5, color: t.sub, margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {carLabel}{d.salesman_profile?.full_name ? ` · ${d.salesman_profile.full_name.split(' ')[0]}` : ''}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '5px 0 0', flexWrap: 'wrap' }}>
                  {age !== null && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 600, color: slaColor }}>
                      <Clock size={10} />
                      {done ? 'Completed' : age > SLA_BREACH_DAYS ? `Overdue · ${age}d` : age === 0 ? 'Won today' : `${age}d in handover`}
                    </span>
                  )}
                  {blocker && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: t.chipText, background: t.chip, border: `1px solid ${t.chipBorder}`, borderRadius: 6, padding: '1px 7px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Next: {blocker.label}<span style={{ color: t.sub }}> · {blocker.owner}</span>
                    </span>
                  )}
                </div>
              </div>
              {done ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#059669', flexShrink: 0 }}>
                  <CheckCircle2 size={14} /> Done
                </span>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, width: 90 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 99, background: t.track, overflow: 'hidden' }}>
                    <div style={{ width: `${prog < 0 ? 0 : prog}%`, height: '100%', background: '#dc2626' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.sub, minWidth: 30, textAlign: 'right' }}>{prog < 0 ? '–' : `${prog}%`}</span>
                </div>
              )}
            </button>
            {isOpen && (
              <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${t.divider}` }}>
                <div style={{ paddingTop: 12 }}>
                  <PostSaleChecklist lead={d} dark={dark} onTasksChange={(tasks) => setTasksForLead(d.id, tasks)} />
                </div>
                {onViewCustomer && (
                  <button
                    onClick={() => onViewCustomer(d)}
                    style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: t.chipText, background: t.btnBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}
                  >
                    <UserRound size={13} /> View customer record
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
