import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, Car, DollarSign, Layers, Clock, Calendar, MessageCircle, ArrowRightLeft, FileText, UserPlus } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const STAGE_COLORS = {
  new: '#3B82F6', contacted: '#8B5CF6', negotiating: '#F59E0B',
  presented: '#06B6D4', reserved: '#10B981', documents: '#F97316',
  hp_submitted: '#EC4899', sold: '#22C55E', lost: '#EF4444',
};
const STAGE_LABELS = {
  new: 'New', contacted: 'Contacted', negotiating: 'Negotiating',
  presented: 'Presented', reserved: 'Reserved', documents: 'Documents',
  hp_submitted: 'HP Submitted', sold: 'Sold', lost: 'Lost',
};
const SOURCE_LABELS = {
  drevo_enquiry: 'Enquiry', walk_in: 'Walk-In', mudah: 'Mudah',
  carlist: 'Carlist', facebook: 'Facebook', tiktok: 'TikTok',
  instagram: 'Instagram', whatsapp: 'WhatsApp', referral: 'Referral',
  other: 'Other', manual: 'Manual',
};
const ROLE_LABELS = {
  salesman: null, manager: 'Manager', admin: 'Admin',
  accountant: 'Accounts', fi_officer: 'F&I', owner: 'Owner',
  dealer: 'Owner', superadmin: 'Owner',
};
const SOURCE_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#F97316', '#EC4899'];
const ACTIVE_STAGES = ['new','contacted','negotiating','presented','reserved','documents','hp_submitted'];
const AVATAR_COLORS = ['#3B82F6','#8B5CF6','#F59E0B','#10B981','#F97316','#EC4899','#DC2626','#06B6D4'];
const ACT_CFG = {
  whatsapp_sent:  { label: 'WhatsApp', icon: MessageCircle,   color: '#16A34A', bg: '#F0FDF4' },
  stage_changed:  { label: 'Stage',    icon: ArrowRightLeft,  color: '#3B82F6', bg: '#EFF6FF' },
  note_added:     { label: 'Note',     icon: FileText,        color: '#6B7280', bg: '#F9FAFB' },
  created:        { label: 'New lead', icon: UserPlus,        color: '#8B5CF6', bg: '#F5F3FF' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n == null || n === '' || isNaN(Number(n))) return '—';
  const v = Number(n);
  if (v >= 1_000_000) return `RM ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `RM ${(v / 1_000).toFixed(1)}K`;
  return `RM ${v.toLocaleString()}`;
}
function delta(val, prev) {
  if (!prev || prev === 0) return null;
  return ((val - prev) / prev) * 100;
}
function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts);
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function isActiveToday(ts) {
  if (!ts) return false;
  return (Date.now() - new Date(ts)) < 8 * 3600_000;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
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
      <p style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '12px 0 2px', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: 0 }}>{label}</p>
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

function SectionHeader({ title, sub, live }) {
  return (
    <div style={{ marginBottom: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: 0 }}>{title}</p>
        {sub && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>{sub}</p>}
      </div>
      {live && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#16A34A', fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Live
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OverviewTab({ dealerId }) {
  const [pnl, setPnl]           = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tick, setTick]         = useState(0);
  const subRef = useRef(null);

  // ── PnL RPC — independent, non-blocking ──────────────────────────────────
  useEffect(() => {
    if (!dealerId) return;
    supabase.rpc('gm_pnl_snapshot', { p_dealer_id: dealerId })
      .then(({ data }) => setPnl(data))
      .catch(() => {});
  }, [dealerId]);

  // ── Live data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dealerId) return;
    const now = Date.now();

    Promise.all([
      supabase.from('leads')
        .select('id, stage, lead_source, created_at, updated_at, buyer_name, salesman_id')
        .eq('dealer_id', dealerId)
        .order('updated_at', { ascending: false })
        .limit(300),
      supabase.from('car_listings')
        .select('id, status, created_at')
        .eq('dealer_id', dealerId),
      supabase.from('appointments')
        .select('id, appointment_date')
        .eq('dealer_id', dealerId)
        .gte('appointment_date', new Date().toISOString().slice(0, 10)),
      supabase.from('profiles')
        .select('id, full_name, slug, role')
        .or(`dealer_id.eq.${dealerId},id.eq.${dealerId}`)
        .in('role', ['salesman', 'manager', 'admin', 'accountant', 'fi_officer', 'owner', 'dealer', 'superadmin']),
      supabase.from('lead_activities')
        .select('id, activity_type, note, created_at, lead_id, created_by, to_stage, creator:created_by(full_name)')
        .eq('dealer_id', dealerId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]).then(([l, cl, apt, sm, acts]) => {
      const allLeads    = l.data    || [];
      const allListings = cl.data   || [];
      const aptsToday   = apt.data  || [];
      const staff       = sm.data   || [];
      const activities  = acts.data || [];

      const leadsById = Object.fromEntries(allLeads.map(l => [l.id, l]));

      const lastActivityByUser = {};
      for (const a of activities) {
        if (!a.created_by) continue;
        const cur = lastActivityByUser[a.created_by];
        if (!cur || new Date(a.created_at) > new Date(cur))
          lastActivityByUser[a.created_by] = a.created_at;
      }

      const activeLeads = allLeads.filter(l => !['sold','lost'].includes(l.stage));
      const leadsPerSm  = {};
      const lastLeadTouchSm = {};
      for (const l of allLeads) {
        if (!l.salesman_id) continue;
        if (activeLeads.includes(l)) leadsPerSm[l.salesman_id] = (leadsPerSm[l.salesman_id] || 0) + 1;
        const cur = lastLeadTouchSm[l.salesman_id];
        if (!cur || new Date(l.updated_at) > new Date(cur)) lastLeadTouchSm[l.salesman_id] = l.updated_at;
      }

      const stageCounts = {};
      for (const l of allLeads) stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1;

      const sourceCounts = {};
      for (const l of activeLeads) {
        const src = l.lead_source || 'unknown';
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      }

      const available = allListings.filter(c => c.status === 'available');
      const avgDays   = available.length
        ? Math.round(available.reduce((s, c) => s + (now - new Date(c.created_at)) / 86400000, 0) / available.length)
        : 0;
      const stale = available.filter(c => (now - new Date(c.created_at)) / 86400000 > 30).length;

      const teamRows = staff.map((s, idx) => {
        const lastAct = lastActivityByUser[s.id] || lastLeadTouchSm[s.id] || null;
        return {
          id: s.id,
          name: s.full_name || s.slug || 'Team',
          role: ROLE_LABELS[s.role] || null,
          active: leadsPerSm[s.id] || 0,
          isActive: isActiveToday(lastAct),
          lastActivity: lastAct,
          avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
        };
      }).sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return b.active - a.active;
      });

      const recentActivities = activities.slice(0, 12).map(a => ({
        ...a,
        lead: leadsById[a.lead_id] || null,
      }));

      setSnapshot({
        activeLeads: activeLeads.length,
        activeListings: available.length,
        stageCounts, sourceCounts, teamRows, avgDays, stale,
        aptsToday: aptsToday.length, recentActivities,
      });
    }).catch(() => {
      // Show empty state rather than hanging forever
      setSnapshot({
        activeLeads: 0, activeListings: 0, stageCounts: {}, sourceCounts: {},
        teamRows: [], avgDays: 0, stale: 0, aptsToday: 0, recentActivities: [],
      });
    }).finally(() => setLoading(false));
  }, [dealerId, tick]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dealerId) return;
    const bump = () => setTick(t => t + 1);
    subRef.current = supabase
      .channel(`overview-${dealerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads',          filter: `dealer_id=eq.${dealerId}` }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_activities', filter: `dealer_id=eq.${dealerId}` }, bump)
      .subscribe();
    return () => { subRef.current?.unsubscribe(); };
  }, [dealerId]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const mtd  = pnl?.mtd  || {};
  const lmtd = pnl?.lmtd || {};
  const unitTrend = delta(Number(mtd.units || 0), Number(lmtd.units || 0));
  const gpTrend   = delta(Number(mtd.gross_profit || 0), Number(lmtd.gross_profit || 0));

  const pipelineData = snapshot
    ? ACTIVE_STAGES.map(s => ({ stage: STAGE_LABELS[s], count: snapshot.stageCounts[s] || 0, color: STAGE_COLORS[s] })).filter(d => d.count > 0)
    : [];

  const sourceData = snapshot
    ? Object.entries(snapshot.sourceCounts)
        .map(([k, v]) => ({ name: SOURCE_LABELS[k] || k.replace(/_/g, ' '), value: v }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
    : [];

  const sparkData = (pnl?.sparkline || []).map(d => ({ day: d.day?.slice(5), rev: Number(d.revenue || 0) }));

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <style>{`
          @keyframes ov-shimmer { 0%,100%{opacity:1} 50%{opacity:0.45} }
          .ov-skel { background:#F3F4F6; border-radius:6px; animation:ov-shimmer 1.4s ease-in-out infinite; }
          @media(max-width:640px){.ov-kpi-grid{grid-template-columns:1fr 1fr !important}}
        `}</style>
        <div className="ov-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #EAECF0', borderRadius: 12, padding: '18px 20px' }}>
              <div className="ov-skel" style={{ width: 36, height: 36, borderRadius: 9, marginBottom: 12 }} />
              <div className="ov-skel" style={{ width: '60%', height: 22, marginBottom: 8 }} />
              <div className="ov-skel" style={{ width: '40%', height: 11 }} />
            </div>
          ))}
        </div>
        <p style={{ color: '#9CA3AF', fontSize: 12, textAlign: 'center' }}>Loading overview…</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: '#111827', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`
        @media (max-width: 768px) {
          .ov-kpi-grid   { grid-template-columns: 1fr 1fr !important; }
          .ov-rev-stock  { grid-template-columns: 1fr !important; }
          .ov-pipe-src   { grid-template-columns: 1fr !important; }
          .ov-team-conv  { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .ov-kpi-grid   { grid-template-columns: 1fr 1fr !important; }
          .ov-conv-table { font-size: 11px !important; }
          .ov-conv-col-hide { display: none !important; }
        }
      `}</style>

      {/* ── KPI Row ── */}
      <div className="ov-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <KpiCard icon={Layers}     label="Open Leads"       value={snapshot.activeLeads}    sub="Active pipeline"                                                iconColor="#3B82F6" />
        <KpiCard icon={Car}        label="Active Listings"  value={snapshot.activeListings}  sub={snapshot.stale ? `${snapshot.stale} stale 30d+` : 'All fresh'} iconColor="#8B5CF6" />
        <KpiCard icon={DollarSign} label="MTD Units Sold"   value={mtd.units ?? 0}           sub="Month to date" trend={unitTrend}                              iconColor="#10B981" />
        <KpiCard icon={TrendingUp} label="MTD Gross"        value={fmt(mtd.gross_profit)}    sub={mtd.avg_margin ? `${mtd.avg_margin}% margin` : 'No sales yet'} trend={gpTrend} iconColor="#DC2626" />
      </div>

      {/* ── Revenue + Stock ── */}
      <div className="ov-rev-stock" style={{ display: 'grid', gridTemplateColumns: sparkData.length ? '2fr 1fr' : '1fr', gap: 14 }}>
        {sparkData.length > 0 && (
          <Panel>
            <SectionHeader title="Revenue — Last 30 Days" sub={`MTD ${fmt(mtd.revenue)}  ·  prev ${fmt(lmtd.revenue)}`} />
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={sparkData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #EAECF0', background: '#fff' }} formatter={(v) => [fmt(v), 'Revenue']} />
                <Line type="monotone" dataKey="rev" stroke="#DC2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        )}
        <Panel>
          <SectionHeader title="Stock Snapshot" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {[
              { label: 'Avg Days on Lot', value: `${snapshot.avgDays}d`,               icon: Clock,      color: '#F59E0B' },
              { label: 'Stale (30d+)',    value: snapshot.stale,                        icon: Car,        color: '#EF4444' },
              { label: 'Appts Today',     value: snapshot.aptsToday,                    icon: Calendar,   color: '#3B82F6' },
              { label: 'Capital Tied',    value: fmt(pnl?.inventory?.capital_tied),     icon: DollarSign, color: '#8B5CF6' },
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

      {/* ── Pipeline + Sources ── */}
      <div className="ov-pipe-src" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Panel>
          <SectionHeader title="Lead Pipeline" sub="Active leads by stage" live />
          {pipelineData.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>No active leads yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(140, pipelineData.length * 28)}>
              <BarChart data={pipelineData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} width={90} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #EAECF0' }} />
                <Bar dataKey="count" radius={[0, 5, 5, 0]} maxBarSize={14}>
                  {pipelineData.map((e) => <Cell key={e.stage} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel>
          <SectionHeader title="Lead Sources" sub="Where your leads come from" />
          {sourceData.length === 0 ? (
            <div>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>No leads yet.</p>
              <p style={{ fontSize: 11, color: '#D1D5DB', marginTop: 4, lineHeight: 1.5 }}>
                Source is set when a salesman adds a lead — Walk-In, WhatsApp, Facebook, Mudah, Carlist, TikTok, Instagram, Referral.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flexShrink: 0 }}>
                <ResponsiveContainer width={100} height={100}>
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={28} outerRadius={46} dataKey="value" strokeWidth={0}>
                      {sourceData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {sourceData.map((s, i) => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: SOURCE_COLORS[i % SOURCE_COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#374151' }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Team on Duty + Recent Conversations ── */}
      <div className="ov-team-conv" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14 }}>

        {/* Team panel */}
        <Panel style={{ padding: '18px 16px' }}>
          <SectionHeader title="Team on Duty" sub={`${snapshot.teamRows.filter(r => r.isActive).length} online now`} live />
          {snapshot.teamRows.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>No team members found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {snapshot.teamRows.map((r) => (
                <div key={r.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', borderRadius: 8, transition: 'background 0.15s', cursor: 'default' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F7F8FA'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: r.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: r.isActive ? '#22C55E' : '#9CA3AF', border: '2px solid #fff' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</p>
                      {r.role && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#6B7280', background: '#F3F4F6', borderRadius: 4, padding: '1px 5px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{r.role}</span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: r.isActive ? '#16A34A' : '#9CA3AF' }}>
                        {r.isActive ? 'Online' : (r.lastActivity ? timeAgo(r.lastActivity) : 'Away')}
                      </span>
                      {r.active > 0 && (
                        <>
                          <span style={{ color: '#D1D5DB' }}>•</span>
                          <span style={{ color: '#374151', fontWeight: 600 }}>{r.active} assigned</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Recent Conversations */}
        <Panel>
          <SectionHeader title="Recent Conversations" sub="WhatsApp sends, stage changes, notes" live />
          {snapshot.recentActivities.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>No activity yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {snapshot.recentActivities.map((a, i) => {
                const cfg  = ACT_CFG[a.activity_type] || ACT_CFG.note_added;
                const Icon = cfg.icon;
                const who  = a.creator?.full_name || 'Salesman';
                const cust = a.lead?.buyer_name || 'Unknown';
                const stage = a.to_stage ? STAGE_LABELS[a.to_stage] || a.to_stage : null;
                const note  = a.note ? (a.note.length > 48 ? a.note.slice(0, 45) + '…' : a.note) : null;
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderTop: i > 0 ? '1px solid #F3F4F6' : undefined }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Icon style={{ width: 13, height: 13, color: cfg.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{cust}</span>
                        <span style={{ fontSize: 11, color: '#6B7280' }}>
                          {a.activity_type === 'whatsapp_sent' && 'WhatsApp sent'}
                          {a.activity_type === 'stage_changed' && (stage ? `→ ${stage}` : 'stage changed')}
                          {a.activity_type === 'note_added' && (note || 'note added')}
                          {a.activity_type === 'created' && 'lead created'}
                          {!ACT_CFG[a.activity_type] && (note || a.activity_type.replace(/_/g, ' '))}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: '1px 0 0' }}>{who} · {timeAgo(a.created_at)}</p>
                    </div>
                    <span className="ov-conv-col-hide" style={{ fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.bg, borderRadius: 5, padding: '2px 7px', flexShrink: 0, alignSelf: 'center' }}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
