import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ChevronDown, ChevronRight, CheckCircle2, Car, Clock, AlertTriangle } from 'lucide-react';
import { computeProgress, nextBlocker } from '../../utils/postSaleSteps';
import PostSaleChecklist from './PostSaleChecklist';

const WON_STAGES = ['won', 'closed_won'];

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
export default function PostSaleBoard({ dealerId, salesmanId = null }) {
  const [deals, setDeals] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [tasksMap, setTasksMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [hideDone, setHideDone] = useState(true);

  useEffect(() => {
    if (!dealerId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from('leads')
        .select('id, dealer_id, buyer_name, phone, car_listing_id, salesman_id, assigned_to, loan_bank, loan_amount, loan_status, updated_at, car_listings(brand, model, year, selling_price), salesman_profile:salesman_id(full_name)')
        .eq('dealer_id', dealerId)
        .in('stage', WON_STAGES)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });
      if (salesmanId) q = q.eq('salesman_id', salesmanId);
      const { data: wonLeads } = await q;
      if (cancelled) return;
      const leads = wonLeads || [];
      setDeals(leads);

      // One query for all tasks across these deals, then group → progress.
      const ids = leads.map((l) => l.id);
      if (ids.length) {
        const { data: allTasks } = await supabase
          .from('post_sale_tasks')
          .select('lead_id, step_key, status')
          .in('lead_id', ids);
        const byLead = {};
        (allTasks || []).forEach((t) => { (byLead[t.lead_id] ||= []).push(t); });
        const pm = {};
        ids.forEach((id) => { pm[id] = byLead[id] ? computeProgress(byLead[id]) : -1; });
        if (!cancelled) { setProgressMap(pm); setTasksMap(byLead); }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealerId, salesmanId]);

  // Shared dark panel — this board is built dark-first; the dashboard shell is
  // light, so it needs its own dark background wrapper to stay legible.
  const PANEL = { background: '#0B1016', border: '1px solid #1c232e', borderRadius: 16, padding: 'clamp(12px, 3vw, 18px)' };

  if (loading) return <div style={PANEL}><p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Loading sold deals…</p></div>;

  const visible = (hideDone ? deals.filter((d) => progressMap[d.id] !== 100) : deals)
    .slice()
    .sort((a, b) => {
      // Active deals first, oldest (most overdue) at the top; done deals sink.
      const aDone = progressMap[a.id] === 100, bDone = progressMap[b.id] === 100;
      if (aDone !== bDone) return aDone ? 1 : -1;
      return (daysSince(b.updated_at) || 0) - (daysSince(a.updated_at) || 0);
    });

  const overdueCount = deals.filter(
    (d) => progressMap[d.id] !== 100 && (daysSince(d.updated_at) || 0) > SLA_BREACH_DAYS
  ).length;
  const doneCount = deals.filter((d) => progressMap[d.id] === 100).length;

  if (deals.length === 0) {
    return (
      <div style={{ ...PANEL, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        <Car size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
        <p style={{ fontSize: 13, margin: 0 }}>No sold deals yet. Won deals show up here for handover processing.</p>
      </div>
    );
  }

  return (
    <div style={{ ...PANEL, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            {deals.filter((d) => progressMap[d.id] !== 100).length} in processing
          </p>
          {overdueCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#f87171', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '3px 9px' }}>
              <AlertTriangle size={12} />{overdueCount} overdue
            </span>
          )}
          {doneCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '3px 9px' }}>
              {doneCount} completed
            </span>
          )}
        </div>
        <button onClick={() => setHideDone((v) => !v)} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>
          {hideDone ? 'Show completed' : 'Hide completed'}
        </button>
      </div>

      {visible.map((d) => {
        const car = d.car_listings;
        const carLabel = car ? `${car.year || ''} ${car.brand || ''} ${car.model || ''}`.trim() : 'No car linked';
        const prog = progressMap[d.id];
        const isOpen = open === d.id;
        const done = prog === 100;
        const age = daysSince(d.updated_at);
        const slaColor = done ? '#4ade80' : age > SLA_BREACH_DAYS ? '#f87171' : age >= SLA_WARN_DAYS ? '#fbbf24' : 'rgba(255,255,255,0.45)';
        const blocker = done ? null : nextBlocker(tasksMap[d.id]);
        return (
          <div key={d.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
            <button
              onClick={() => setOpen(isOpen ? null : d.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              {isOpen ? <ChevronDown size={16} color="rgba(255,255,255,0.5)" /> : <ChevronRight size={16} color="rgba(255,255,255,0.5)" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.buyer_name || 'Buyer'}</p>
                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '1px 7px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Next: {blocker.label}<span style={{ color: 'rgba(255,255,255,0.4)' }}> · {blocker.owner}</span>
                    </span>
                  )}
                </div>
              </div>
              {done ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>
                  <CheckCircle2 size={14} /> Done
                </span>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, width: 90 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <div style={{ width: `${prog < 0 ? 0 : prog}%`, height: '100%', background: '#dc2626' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', minWidth: 30, textAlign: 'right' }}>{prog < 0 ? '–' : `${prog}%`}</span>
                </div>
              )}
            </button>
            {isOpen && (
              <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ paddingTop: 12 }}>
                  <PostSaleChecklist lead={d} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
