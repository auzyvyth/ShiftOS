// Sections that used to make up the GM Oversight tab, each now living where its
// question belongs: GoalTracker + RevenueBreakdown in Reports > Revenue (RevOpsPage),
// AuditTrail in Team. The "Eyes Here" exceptions are on Overview's alert list.
import React, { useEffect, useState, useMemo } from 'react';
import { carPnl } from '../../utils/carPnl';
import { supabase } from '../../supabaseClient';
import { usePersistentState } from '../../hooks/usePersistentState';
import { Target, ChevronRight } from 'lucide-react';

const fmtRM = (n) => 'RM ' + Math.round(Number(n || 0)).toLocaleString('en-MY');
const fmtRMShort = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e6) return 'RM ' + (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return 'RM ' + (v / 1e3).toFixed(1) + 'k';
  return 'RM ' + v.toFixed(0);
};
const fmtAgo = (ts) => {
  const d = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  return Math.floor(d / 86400) + 'd ago';
};

// ─── Audit Trail ──────────────────────────────────────────────────────────────
export function AuditTrail({ dealerId, initialFilter = 'all' }) {
  const [filter, setFilter] = useState(initialFilter); // all | anomaly | car_listings | leads | deal_financing | stock_units
  const [logs, setLogs, cached] = usePersistentState(dealerId ? `audit:${filter}:${dealerId}` : null, []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealerId) return;
    setLoading(true);
    let q = supabase.from('activity_log').select('*').eq('dealer_id', dealerId).order('created_at', { ascending: false }).limit(50);
    if (filter === 'anomaly') q = q.eq('is_anomaly', true);
    else if (filter !== 'all') q = q.eq('table_name', filter);
    q.then(({ data }) => { setLogs(data || []); setLoading(false); });
  }, [dealerId, filter]);

  const tableLabel = {
    car_listings: 'Listing',
    stock_units: 'Stock',
    deal_financing: 'HP',
    leads: 'Lead',
    dealer_products: 'Product',
    vendors: 'Vendor',
    recon_jobs: 'Recon',
    profiles: 'Account',
  };
  const actionColor = { create: '#16a34a', update: '#3b82f6', delete: '#dc2626' };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          ['all', 'All'],
          ['anomaly', 'Anomalies'],
          ['car_listings', 'Listings'],
          ['stock_units', 'Stock'],
          ['leads', 'Leads'],
          ['deal_financing', 'HP'],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            style={{
              fontSize: 12,
              padding: '6px 14px',
              borderRadius: 18,
              cursor: 'pointer',
              background: filter === k ? '#111827' : '#fff',
              border: `1px solid ${filter === k ? '#111827' : '#e5e7eb'}`,
              color: filter === k ? '#fff' : '#374151',
              fontWeight: filter === k ? 600 : 500,
            }}
          >
            {l}
          </button>
        ))}
      </div>
      {loading && !(cached && logs.length) ? (
        <p style={{ fontSize: 13, color: '#9ca3af', padding: '20px 0' }}>Loading…</p>
      ) : logs.length === 0 ? (
        <p style={{ fontSize: 13, color: '#9ca3af', padding: '20px 0' }}>No activity for this filter.</p>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          {logs.map((log, i) => (
            <div key={log.id} style={{
              padding: '13px 18px',
              borderBottom: i === logs.length - 1 ? 'none' : '1px solid #f3f4f6',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: log.is_anomaly ? '#fffbeb' : '#fff',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: 4,
                background: log.is_anomaly ? '#d97706' : actionColor[log.action] || '#9ca3af',
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: '#111827', margin: 0, fontWeight: 500 }}>
                  <span style={{ color: '#6b7280' }}>{tableLabel[log.table_name] || log.table_name} ·</span> {log.summary || log.action}
                </p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>
                  {log.actor_name || 'System'} · {log.actor_role || '—'} · {fmtAgo(log.created_at)}
                  {log.is_anomaly && <span style={{ color: '#d97706', fontWeight: 600 }}> · {log.anomaly_reason}</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Goal Tracker ─────────────────────────────────────────────────────────────
export function GoalTracker({ dealerId, mtdRevenue, mtdProfit, mtdUnits }) {
  const monthKey = new Date().toISOString().slice(0, 7) + '-01';
  const [goal, setGoal] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ target_units: '', target_revenue: '', target_profit: '' });

  useEffect(() => {
    if (!dealerId) return;
    supabase.from('dealer_goals').select('*').eq('dealer_id', dealerId).eq('month', monthKey).maybeSingle()
      .then(({ data }) => {
        setGoal(data);
        if (data) setDraft({ target_units: data.target_units || '', target_revenue: data.target_revenue || '', target_profit: data.target_profit || '' });
      });
  }, [dealerId, monthKey]);

  const handleSave = async () => {
    const payload = {
      dealer_id: dealerId,
      month: monthKey,
      target_units: Number(draft.target_units) || null,
      target_revenue: Number(draft.target_revenue) || null,
      target_profit: Number(draft.target_profit) || null,
      updated_at: new Date().toISOString(),
    };
    const { data } = await supabase.from('dealer_goals').upsert(payload, { onConflict: 'dealer_id,month' }).select().single();
    setGoal(data);
    setEditing(false);
  };

  const today = new Date();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysElapsed = today.getDate();
  const totalDays = monthEnd.getDate();
  const pace = daysElapsed / totalDays;

  const ring = (actual, target) => {
    if (!target || target <= 0) return null;
    const pct = Math.min(100, (actual / target) * 100);
    const onPace = pct >= pace * 100 - 5;
    return { pct, color: onPace ? '#16a34a' : pct >= pace * 100 - 15 ? '#d97706' : '#dc2626', onPace };
  };

  const rUnits = ring(mtdUnits, goal?.target_units);
  const rRev = ring(mtdRevenue, goal?.target_revenue);
  const rProf = ring(mtdProfit, goal?.target_profit);

  if (!goal && !editing) {
    return (
      <div style={{ background: '#fff', border: '1px dashed #d1d5db', borderRadius: 12, padding: '24px 26px', textAlign: 'center' }}>
        <Target style={{ width: 28, height: 28, color: '#9ca3af', margin: '0 auto 8px' }} />
        <p style={{ fontSize: 13, color: '#374151', margin: 0, fontWeight: 500 }}>No monthly target set</p>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 14px' }}>Set goals to track pace in real-time.</p>
        <button onClick={() => setEditing(true)} style={{ padding: '8px 18px', background: '#111827', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Set Targets
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '22px 26px' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 14 }}>Set Monthly Targets</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            ['target_units', 'Units', ''],
            ['target_revenue', 'Revenue', 'RM'],
            ['target_profit', 'Profit', 'RM'],
          ].map(([k, l, prefix]) => (
            <div key={k}>
              <label style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 500 }}>{l}</label>
              <div style={{ position: 'relative', marginTop: 4 }}>
                {prefix && <span style={{ position: 'absolute', left: 11, top: 9, fontSize: 13, color: '#9ca3af' }}>{prefix}</span>}
                <input
                  type="number"
                  value={draft[k]}
                  onChange={e => setDraft(p => ({ ...p, [k]: e.target.value }))}
                  style={{ width: '100%', padding: `8px 12px 8px ${prefix ? 40 : 12}px`, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '9px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} style={{ flex: 1, padding: '9px', background: '#111827', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save Targets</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '22px 26px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Monthly Pace · Day {daysElapsed} of {totalDays}</p>
        <button onClick={() => setEditing(true)} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 18 }}>
        {[
          { label: 'Units', actual: mtdUnits, target: goal?.target_units, fmt: (v) => v, ring: rUnits },
          { label: 'Revenue', actual: mtdRevenue, target: goal?.target_revenue, fmt: fmtRM, ring: rRev },
          { label: 'Profit', actual: mtdProfit, target: goal?.target_profit, fmt: fmtRM, ring: rProf },
        ].map(g => (
          <div key={g.label}>
            <p style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 500, margin: 0 }}>{g.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '4px 0 6px', letterSpacing: '-0.01em' }}>
              {g.fmt(g.actual)}
              <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}> / {g.target ? g.fmt(g.target) : '—'}</span>
            </p>
            {g.ring && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${g.ring.pct}%`, height: '100%', background: g.ring.color, borderRadius: 3, transition: 'width 0.4s' }} />
                </div>
                <span style={{ fontSize: 11, color: g.ring.color, fontWeight: 600 }}>{Math.round(g.ring.pct)}%</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
// ─── Revenue Breakdown (drill-down: what drove the revenue) ────────────────────
// Mirrors the per-unit P&L in OwnerCarPanel so "gross" here matches the listing
// P&L modal exactly (purchase + recon + services + commission + handover +
// holding + ad spend, plus F&I back-end). Assembled client-side from a handful of
// dealer-scoped, grouped queries (no N+1) rather than a fragile SQL RPC.
function unitGross(l, stock, cfg, adSpend, handover, addonRev, addonCost) {
  // The ONE profit engine (src/utils/carPnl.js). "handover" here carries transfer + admin +
  // warranty reserve, so the drill-down rows still add up to the gross.
  const sold = !!(l.sold_date || l.sold_at || l.status === 'sold');
  const e = carPnl({
    purchase: Number(stock?.purchase_price) || Number(l.purchase_price) || 0,
    reconEstimate: Number(stock?.recon_cost) || Number(l.recon_cost) || 0,
    servicesCost: l.included_services_cost, commission: l.commission_amount, adSpend,
    handoverCost: sold ? handover : null, addonRevenue: addonRev, addonCost,
    asking: l.selling_price, soldPrice: l.sold_price, isSold: sold,
    startDate: stock?.purchase_date || stock?.created_at || l.created_at, soldDate: l.sold_date || l.sold_at,
    engineCc: l.engine_cc || stock?.engine_cc, warrantyMonths: l.warranty_months, cfg: cfg || {},
  });
  const line = (k) => e.lines.find((x) => x.key === k)?.val || 0;
  return {
    revenue: e.revenue, purchase: line('purchase'), recon: line('recon'), services: line('services'),
    commission: line('commission'), handover: line('transfer') + line('admin') + line('warranty'),
    holding: e.holding, adSpend: line('ads'), addonRev, addonCost, gross: e.net, days: e.days,
  };
}

const PERIODS = [
  { key: 'mtd', label: 'This month' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'all', label: 'All time' },
];

export function RevenueBreakdown({ dealerId }) {
  const [rows, setRows] = usePersistentState(dealerId ? `oversight_rev:${dealerId}` : null, null);
  const [period, setPeriod] = useState('mtd');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!dealerId) return;
    let cancelled = false;
    (async () => {
      const [sold, stock, leads, ads, addons, tasks, cfg, team] = await Promise.all([
        supabase.from('car_listings').select('id, brand, model, year, sold_date, sold_at, sold_price, selling_price, assigned_to, commission_amount, included_services_cost, purchase_price, recon_cost, created_at').eq('dealer_id', dealerId).eq('status', 'sold'),
        supabase.from('stock_units').select('listing_id, purchase_price, recon_cost, purchase_date, created_at').eq('dealer_id', dealerId).not('listing_id', 'is', null),
        supabase.from('leads').select('car_listing_id').eq('dealer_id', dealerId).not('car_listing_id', 'is', null),
        supabase.from('ad_spend').select('listing_id, amount').eq('dealer_id', dealerId).not('listing_id', 'is', null),
        supabase.from('deal_products').select('listing_id, sold_price, dealer_products(cost_price)').eq('dealer_id', dealerId),
        supabase.from('post_sale_tasks').select('listing_id, status, cost').eq('dealer_id', dealerId),
        supabase.from('dealer_cost_settings').select('*').eq('dealer_id', dealerId).maybeSingle(),
        supabase.from('profiles').select('id, full_name').eq('dealer_id', dealerId),
      ]);
      if (cancelled) return;
      const stockBy = {}; (stock.data || []).forEach((s) => { stockBy[s.listing_id] = s; });
      const leadsBy = {}; (leads.data || []).forEach((x) => { leadsBy[x.car_listing_id] = (leadsBy[x.car_listing_id] || 0) + 1; });
      const adsBy = {}; (ads.data || []).forEach((a) => { adsBy[a.listing_id] = (adsBy[a.listing_id] || 0) + (Number(a.amount) || 0); });
      const handoverBy = {}; (tasks.data || []).forEach((t) => { if (t.status !== 'na') handoverBy[t.listing_id] = (handoverBy[t.listing_id] || 0) + (Number(t.cost) || 0); });
      const addRevBy = {}; const addCostBy = {};
      (addons.data || []).forEach((d) => { addRevBy[d.listing_id] = (addRevBy[d.listing_id] || 0) + (Number(d.sold_price) || 0); addCostBy[d.listing_id] = (addCostBy[d.listing_id] || 0) + (Number(d.dealer_products?.cost_price) || 0); });
      const nameBy = {}; (team.data || []).forEach((p) => { nameBy[p.id] = p.full_name; });
      const out = (sold.data || []).map((l) => {
        const m = unitGross(l, stockBy[l.id], cfg.data, adsBy[l.id] || 0, handoverBy[l.id] || 0, addRevBy[l.id] || 0, addCostBy[l.id] || 0);
        return {
          ...l,
          ...m,
          salesman: nameBy[l.assigned_to] || 'Unassigned',
          leadsCount: leadsBy[l.id] || 0,
          when: l.sold_date || l.sold_at || l.created_at,
        };
      }).sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0));
      setRows(out);
    })();
    return () => { cancelled = true; };
  }, [dealerId]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (period === 'all') return rows;
    const now = new Date();
    return rows.filter((r) => {
      if (!r.when) return false;
      const d = new Date(r.when);
      if (period === 'mtd') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return (now - d) / 86400000 <= 90;
    });
  }, [rows, period]);

  const trends = useMemo(() => {
    const byModel = {};
    filtered.forEach((r) => {
      const key = `${r.brand || '?'} ${r.model || ''}`.trim();
      const g = byModel[key] || (byModel[key] = { key, brand: r.brand, units: 0, rev: 0, gross: 0, days: 0, daysN: 0 });
      g.units += 1; g.rev += r.revenue || 0; g.gross += r.gross || 0;
      if (r.days != null) { g.days += r.days; g.daysN += 1; }
    });
    return Object.values(byModel)
      .map((g) => ({ ...g, avgPrice: g.units ? g.rev / g.units : 0, avgGross: g.units ? g.gross / g.units : 0, avgDays: g.daysN ? Math.round(g.days / g.daysN) : null }))
      .sort((a, b) => b.units - a.units || b.gross - a.gross);
  }, [filtered]);

  const bySalesman = useMemo(() => {
    const by = {};
    filtered.forEach((r) => {
      const g = by[r.salesman] || (by[r.salesman] = { name: r.salesman, units: 0, gross: 0 });
      g.units += 1; g.gross += r.gross || 0;
    });
    return Object.values(by).filter((g) => g.name !== 'Unassigned').sort((a, b) => b.gross - a.gross);
  }, [filtered]);

  const bestSale = useMemo(() => {
    return filtered.reduce((b, r) => (r.gross || 0) > (b?.gross || -Infinity) ? r : b, null);
  }, [filtered]);

  if (rows === null) return <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading breakdown…</p>;

  const totalRev = filtered.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalGross = filtered.reduce((s, r) => s + (r.gross || 0), 0);
  const topModel = trends[0];
  const topSalesman = bySalesman[0];
  const th = { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', padding: '8px 10px', whiteSpace: 'nowrap' };
  const td = { fontSize: 13, color: '#374151', textAlign: 'right', padding: '10px', whiteSpace: 'nowrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Period toggle + totals */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid ' + (period === p.key ? '#111827' : '#e5e7eb'), background: period === p.key ? '#111827' : '#fff', color: period === p.key ? '#fff' : '#6b7280' }}>{p.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 18, fontSize: 12, color: '#6b7280' }}>
          <span>{filtered.length} sold</span>
          <span>Revenue <b style={{ color: '#111827' }}>{fmtRM(totalRev)}</b></span>
          <span>Gross <b style={{ color: totalGross >= 0 ? '#16a34a' : '#dc2626' }}>{fmtRM(totalGross)}</b></span>
        </div>
      </div>

      {/* Highlights */}
      {filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {topModel && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Top model</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>{topModel.key}</p>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{topModel.units} sold · {fmtRM(topModel.gross)} gross</p>
            </div>
          )}
          {topSalesman && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Top salesperson</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>{topSalesman.name}</p>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{topSalesman.units} sold · {fmtRM(topSalesman.gross)} gross</p>
            </div>
          )}
          {bestSale && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Best single sale</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>{bestSale.brand} {bestSale.model}</p>
              <p style={{ fontSize: 12, color: '#16a34a', margin: '2px 0 0' }}>{fmtRM(bestSale.gross)} gross</p>
            </div>
          )}
        </div>
      )}

      {/* Contributors table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
                <th style={{ ...th, textAlign: 'left' }}>Car</th>
                <th style={{ ...th, textAlign: 'left' }}>Salesperson</th>
                <th style={th}>Sold</th>
                <th style={th}>Days</th>
                <th style={th}>Leads</th>
                <th style={th}>Ads</th>
                <th style={th}>Gross</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#9ca3af', padding: '24px' }}>No sales in this period.</td></tr>
              )}
              {filtered.map((r) => {
                const open = expanded === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr onClick={() => setExpanded(open ? null : r.id)} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: open ? '#fafafa' : '#fff' }}>
                      <td style={{ ...td, textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ChevronRight style={{ width: 13, height: 13, color: '#9ca3af', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: '#111827' }}>{r.brand} {r.model}{r.year ? ` · ${r.year}` : ''}</span>
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'left', color: r.salesman === 'Unassigned' ? '#9ca3af' : '#374151' }}>{r.salesman}</td>
                      <td style={td}>{fmtRMShort(r.revenue)}</td>
                      <td style={td}>{r.days != null ? `${r.days}d` : '—'}</td>
                      <td style={td}>{r.leadsCount}</td>
                      <td style={td}>{r.adSpend ? fmtRMShort(r.adSpend) : '—'}</td>
                      <td style={{ ...td, fontWeight: 700, color: r.gross >= 0 ? '#16a34a' : '#dc2626' }}>{r.gross < 0 ? '− ' : ''}{fmtRMShort(Math.abs(r.gross))}</td>
                    </tr>
                    {open && (
                      <tr style={{ background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                        <td colSpan={7} style={{ padding: '4px 16px 14px 32px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, maxWidth: 760 }}>
                            {[
                              ['Sale price', r.revenue, false],
                              ['Purchase', r.purchase, true],
                              ['Recon', r.recon, true],
                              ['Incl. services', r.services, true],
                              ['Commission', r.commission, true],
                              ['Handover', r.handover, true],
                              ['Holding', r.holding, true],
                              ['Ad spend', r.adSpend, true],
                              ['F&I add-ons', r.addonRev - r.addonCost, false],
                            ].filter(([, v]) => v).map(([label, val, neg]) => (
                              <div key={label}>
                                <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>{label}</p>
                                <p style={{ fontSize: 13, fontWeight: 600, color: neg ? '#dc2626' : '#111827', margin: '2px 0 0' }}>{neg ? '− ' : ''}{fmtRM(Math.abs(Number(val)))}</p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trends by model */}
      {trends.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0, padding: '16px 16px 10px' }}>What sells — by model</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
                  <th style={{ ...th, textAlign: 'left' }}>Model</th>
                  <th style={th}>Units</th>
                  <th style={th}>Avg price</th>
                  <th style={th}>Avg days</th>
                  <th style={th}>Avg gross</th>
                  <th style={th}>Total gross</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((g) => (
                  <tr key={g.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 600, color: '#111827' }}>{g.key}</td>
                    <td style={td}>{g.units}</td>
                    <td style={td}>{fmtRMShort(g.avgPrice)}</td>
                    <td style={td}>{g.avgDays != null ? `${g.avgDays}d` : '—'}</td>
                    <td style={{ ...td, color: g.avgGross >= 0 ? '#16a34a' : '#dc2626' }}>{g.avgGross < 0 ? '− ' : ''}{fmtRMShort(Math.abs(g.avgGross))}</td>
                    <td style={{ ...td, fontWeight: 700, color: g.gross >= 0 ? '#16a34a' : '#dc2626' }}>{g.gross < 0 ? '− ' : ''}{fmtRMShort(Math.abs(g.gross))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
