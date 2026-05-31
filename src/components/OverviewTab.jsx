import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, Users, Car, DollarSign, Layers, Clock, Calendar } from 'lucide-react';

const STAGE_COLORS = {
  new: '#3B82F6',
  contacted: '#8B5CF6',
  negotiating: '#F59E0B',
  presented: '#06B6D4',
  reserved: '#10B981',
  documents: '#F97316',
  hp_submitted: '#EC4899',
  sold: '#22C55E',
  lost: '#EF4444',
};

const SOURCE_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#F97316', '#EC4899'];

const STAGE_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  negotiating: 'Negotiating',
  presented: 'Presented',
  reserved: 'Reserved',
  documents: 'Documents',
  hp_submitted: 'HP Submitted',
  sold: 'Sold',
  lost: 'Lost',
};

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `RM ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `RM ${(n / 1_000).toFixed(1)}K`;
  return `RM ${n.toLocaleString()}`;
}

function delta(val, prev) {
  if (!prev || prev === 0) return null;
  return ((val - prev) / prev) * 100;
}

function KpiCard({ icon: Icon, label, value, sub, trend, iconColor }) {
  const up = trend != null && trend >= 0;
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #EAECF0', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: iconColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 18, height: 18, color: iconColor }} />
        </div>
        {trend != null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: up ? '#16A34A' : '#DC2626', background: up ? '#F0FDF4' : '#FEF2F2', borderRadius: 6, padding: '2px 7px' }}>
            {up ? <TrendingUp style={{ width: 11, height: 11 }} /> : <TrendingDown style={{ width: 11, height: 11 }} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '12px 0 2px', letterSpacing: '-0.02em' }}>{value}</p>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: 0 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{title}</p>
      {sub && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  );
}

function Panel({ children, style }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #EAECF0', borderRadius: 12, padding: '18px 20px', ...style }}>
      {children}
    </div>
  );
}

function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts);
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STAGE_DOT = (stage) => {
  const c = STAGE_COLORS[stage] || '#9CA3AF';
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block', marginRight: 6 }} />;
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OverviewTab({ dealerId }) {
  const [pnl, setPnl] = useState(null);
  const [scores, setScores] = useState([]);
  const [leads, setLeads] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealerId) return;
    setLoading(true);

    const now = Date.now();
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

    Promise.all([
      supabase.rpc('gm_pnl_snapshot', { p_dealer_id: dealerId }),
      supabase.rpc('gm_salesman_scores', { p_dealer_id: dealerId }),
      supabase.from('leads')
        .select('id, stage, source, created_at, updated_at, customer_name, salesman_id, car_listing_id')
        .eq('dealer_id', dealerId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('car_listings')
        .select('id, brand, model, year, status, created_at')
        .eq('dealer_id', dealerId),
      supabase.from('appointments')
        .select('id, appointment_date')
        .eq('dealer_id', dealerId)
        .gte('appointment_date', new Date().toISOString().slice(0, 10)),
      supabase.from('profiles')
        .select('id, full_name, slug')
        .eq('dealer_id', dealerId)
        .eq('role', 'salesman'),
    ]).then(([p, s, l, cl, apt, sm]) => {
      setPnl(p.data);
      setScores(s.data || []);

      const allLeads = l.data || [];
      const allListings = cl.data || [];
      const aptsToday = apt.data || [];
      const salesmen = sm.data || [];

      const smMap = Object.fromEntries(salesmen.map(s => [s.id, s.full_name || s.slug || 'Unknown']));

      // Build leads per salesman (active only)
      const activeLeads = allLeads.filter(l => !['sold','lost'].includes(l.stage));
      const leadsPerSm = {};
      for (const l of activeLeads) {
        if (!l.salesman_id) continue;
        leadsPerSm[l.salesman_id] = (leadsPerSm[l.salesman_id] || 0) + 1;
      }

      // Pipeline by stage
      const stageCounts = {};
      for (const l of allLeads) {
        stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1;
      }

      // Source breakdown
      const sourceCounts = {};
      for (const l of allLeads) {
        const src = l.source || 'unknown';
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      }

      // Stock aging
      const available = allListings.filter(c => c.status === 'available');
      const avgDays = available.length
        ? Math.round(available.reduce((s, c) => s + (now - new Date(c.created_at)) / 86400000, 0) / available.length)
        : 0;
      const stale = available.filter(c => (now - new Date(c.created_at)) / 86400000 > 30).length;

      // Recent leads with car info (use listing id if available)
      const recent = allLeads.slice(0, 6).map(l => ({
        ...l,
        salesmanName: smMap[l.salesman_id] || '—',
      }));

      setLeads(allLeads);
      setSnapshot({
        activeLeads: activeLeads.length,
        activeListings: available.length,
        stageCounts,
        sourceCounts,
        leadsPerSm,
        smMap,
        avgDays,
        stale,
        aptsToday: aptsToday.length,
        recent,
      });
      setLoading(false);
    });
  }, [dealerId]);

  if (loading || !snapshot) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <p style={{ color: '#9CA3AF', fontSize: 13 }}>Loading overview…</p>
      </div>
    );
  }

  const mtd = pnl?.mtd || {};
  const lmtd = pnl?.lmtd || {};

  const revTrend = delta(Number(mtd.revenue || 0), Number(lmtd.revenue || 0));
  const gpTrend  = delta(Number(mtd.gross_profit || 0), Number(lmtd.gross_profit || 0));
  const unitTrend = delta(Number(mtd.units || 0), Number(lmtd.units || 0));

  // Pipeline chart data (exclude sold/lost for "active" view)
  const ACTIVE_STAGES = ['new','contacted','negotiating','presented','reserved','documents','hp_submitted'];
  const pipelineData = ACTIVE_STAGES
    .map(s => ({ stage: STAGE_LABELS[s] || s, count: snapshot.stageCounts[s] || 0, color: STAGE_COLORS[s] }))
    .filter(d => d.count > 0);

  // Source pie
  const sourceData = Object.entries(snapshot.sourceCounts)
    .map(([k, v]) => ({ name: k.replace(/_/g, ' '), value: v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Team panel
  const teamRows = scores.slice(0, 6).map(s => ({
    name: s.full_name || s.slug || 'Salesman',
    active: snapshot.leadsPerSm[s.salesman_id] || 0,
    closeRate: s.close_rate_pct || 0,
    avgGross: s.avg_gross || 0,
  }));

  // Sparkline for revenue
  const sparkData = (pnl?.sparkline || []).map(d => ({ day: d.day?.slice(5), rev: Number(d.revenue || 0) }));

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: '#111827' }}>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KpiCard icon={Layers} label="Open Leads" value={snapshot.activeLeads} sub="Excl. sold & lost" iconColor="#3B82F6" />
        <KpiCard icon={Car}    label="Active Listings" value={snapshot.activeListings} sub={`${snapshot.stale} stale 30d+`} iconColor="#8B5CF6" />
        <KpiCard icon={DollarSign} label="MTD Units Sold" value={mtd.units ?? '—'} sub="Month to date" trend={unitTrend} iconColor="#10B981" />
        <KpiCard icon={TrendingUp} label="MTD Gross Profit" value={fmt(mtd.gross_profit)} sub={mtd.avg_margin ? `${mtd.avg_margin}% margin` : undefined} trend={gpTrend} iconColor="#DC2626" />
      </div>

      {/* ── Revenue sparkline + Stock snapshot ── */}
      <div style={{ display: 'grid', gridTemplateColumns: sparkData.length ? '2fr 1fr' : '1fr', gap: 14, marginBottom: 20 }}>
        {sparkData.length > 0 && (
          <Panel>
            <SectionHeader title="Revenue — Last 30 Days" sub={`MTD: ${fmt(mtd.revenue)}  ·  prev: ${fmt(lmtd.revenue)}`} />
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={sparkData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #EAECF0', background: '#fff' }}
                  formatter={(v) => [fmt(v), 'Revenue']}
                />
                <Line type="monotone" dataKey="rev" stroke="#DC2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        )}

        <Panel>
          <SectionHeader title="Stock Snapshot" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Avg Days on Lot', value: `${snapshot.avgDays}d`, icon: Clock, color: '#F59E0B' },
              { label: 'Stale (30d+)', value: snapshot.stale, icon: Car, color: '#EF4444' },
              { label: 'Appts Today', value: snapshot.aptsToday, icon: Calendar, color: '#3B82F6' },
              { label: 'Capital Tied', value: fmt(pnl?.inventory?.capital_tied), icon: DollarSign, color: '#8B5CF6' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon style={{ width: 14, height: 14, color }} />
                  <span style={{ fontSize: 12, color: '#6B7280' }}>{label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── Pipeline + Source ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <Panel>
          <SectionHeader title="Lead Pipeline" sub="Active leads by stage" />
          {pipelineData.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>No active leads yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={pipelineData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} width={90} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #EAECF0' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={14}>
                  {pipelineData.map((entry) => (
                    <Cell key={entry.stage} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Lead Sources" sub="Where leads come from" />
          {sourceData.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>No leads yet.</p>
          ) : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" strokeWidth={0}>
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sourceData.map((s, i) => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: SOURCE_COLORS[i % SOURCE_COLORS.length], display: 'inline-block' }} />
                      <span style={{ fontSize: 11, color: '#374151', textTransform: 'capitalize' }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Team + Recent Leads ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 14 }}>
        <Panel>
          <SectionHeader title="Team On Duty" sub="Salesman · active leads · close rate" />
          {teamRows.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>No salesmen yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {teamRows.map((r) => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#F1F3F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#374151', flexShrink: 0 }}>
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</p>
                    <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>{r.closeRate.toFixed(0)}% close rate</p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>
                    {r.active}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Recent Leads" sub="Last 6 leads across all salesmen" />
          {snapshot.recent.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>No leads yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Customer', 'Stage', 'Salesman', 'When'].map(h => (
                      <th key={h} style={{ textAlign: 'left', paddingBottom: 8, color: '#9CA3AF', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snapshot.recent.map((l, i) => (
                    <tr key={l.id} style={{ borderTop: i > 0 ? '1px solid #F3F4F6' : undefined }}>
                      <td style={{ padding: '7px 0', color: '#111827', fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.customer_name || 'Unknown'}
                      </td>
                      <td style={{ padding: '7px 8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                          {STAGE_DOT(l.stage)}
                          <span style={{ color: '#374151' }}>{STAGE_LABELS[l.stage] || l.stage}</span>
                        </span>
                      </td>
                      <td style={{ padding: '7px 8px', color: '#6B7280', whiteSpace: 'nowrap' }}>{l.salesmanName}</td>
                      <td style={{ padding: '7px 0', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{timeAgo(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
