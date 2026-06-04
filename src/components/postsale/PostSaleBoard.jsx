import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ChevronDown, ChevronRight, CheckCircle2, Car } from 'lucide-react';
import { computeProgress } from '../../utils/postSaleSteps';
import PostSaleChecklist from './PostSaleChecklist';

const WON_STAGES = ['won', 'closed_won'];

// Lists won deals that still need post-sale processing. dealerId scopes to a
// dealership; pass salesmanId to scope to one salesman's own sold deals.
export default function PostSaleBoard({ dealerId, salesmanId = null }) {
  const [deals, setDeals] = useState([]);
  const [progressMap, setProgressMap] = useState({});
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
        if (!cancelled) setProgressMap(pm);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealerId, salesmanId]);

  if (loading) return <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', padding: 16 }}>Loading sold deals…</p>;

  const visible = hideDone ? deals.filter((d) => progressMap[d.id] !== 100) : deals;

  if (deals.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        <Car size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
        <p style={{ fontSize: 13, margin: 0 }}>No sold deals yet. Won deals show up here for handover processing.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          {visible.length} deal{visible.length === 1 ? '' : 's'} in processing
        </p>
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
