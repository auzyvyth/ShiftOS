import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
  TrendingUp, TrendingDown, AlertTriangle, Activity, Users,
  Target, Clock, Award, Eye, ChevronRight, RefreshCw,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';

const fmtRM = (n) => 'RM ' + Math.round(Number(n || 0)).toLocaleString('en-MY');
const fmtRMShort = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e6) return 'RM ' + (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return 'RM ' + (v / 1e3).toFixed(1) + 'k';
  return 'RM ' + v.toFixed(0);
};
const fmtPct = (a, b) => {
  if (!b || b === 0) return null;
  return Math.round(((a - b) / b) * 100);
};
const fmtAgo = (ts) => {
  const d = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  return Math.floor(d / 86400) + 'd ago';
};

// ─── KPI Hero Card ────────────────────────────────────────────────────────────
function HeroKPI({ label, value, prev, format = fmtRMShort, hint, sparkline }) {
  const delta = prev != null ? fmtPct(value, prev) : null;
  const up = delta != null && delta >= 0;

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 14,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minHeight: 130,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <p style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.08em', fontWeight: 500, textTransform: 'uppercase', margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
        {format(value)}
      </p>
      {delta != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {up
            ? <TrendingUp style={{ width: 13, height: 13, color: '#16a34a' }} />
            : <TrendingDown style={{ width: 13, height: 13, color: '#dc2626' }} />}
          <span style={{ fontSize: 12, color: up ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
            {up ? '+' : ''}{delta}%
          </span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>vs last month</span>
        </div>
      )}
      {hint && !delta && <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{hint}</p>}
      {sparkline && sparkline.length > 0 && (
        <div style={{ position: 'absolute', right: 0, bottom: 0, height: 50, width: '60%', opacity: 0.4 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkline}>
              <Line type="monotone" dataKey="rev" stroke={up ? '#16a34a' : '#6b7280'} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function Section({ title, subtitle, action, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Exception Alerts ─────────────────────────────────────────────────────────
function ExceptionAlerts({ alerts }) {
  const items = [];
  if (alerts.loss_makers?.length) items.push({ icon: AlertTriangle, label: `${alerts.loss_makers.length} listing(s) priced below cost`, severity: 'high', detail: alerts.loss_makers.slice(0, 3).map(l => l.name).join(', ') });
  if (alerts.stuck_hp > 0) items.push({ icon: Clock, label: `${alerts.stuck_hp} HP submission(s) stuck >7 days`, severity: 'high' });
  if (alerts.expired_b7 > 0) items.push({ icon: AlertTriangle, label: `${alerts.expired_b7} unit(s) with expired PUSPAKOM B7`, severity: 'high' });
  if (alerts.missing_b7 > 0) items.push({ icon: AlertTriangle, label: `${alerts.missing_b7} unit(s) missing PUSPAKOM B7`, severity: 'med' });
  if (alerts.cold_leads > 0) items.push({ icon: Clock, label: `${alerts.cold_leads} lead(s) with no activity 5+ days`, severity: 'med' });
  if (alerts.anomalies_7d > 0) items.push({ icon: Eye, label: `${alerts.anomalies_7d} anomalous edit(s) in last 7 days`, severity: 'low' });

  if (items.length === 0) {
    return (
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 16, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Award style={{ width: 17, height: 17, color: '#16a34a' }} />
        </div>
        <div>
          <p style={{ fontWeight: 600, color: '#15803d', margin: 0, fontSize: 14 }}>All clear</p>
          <p style={{ fontSize: 12, color: '#16a34a', margin: '2px 0 0' }}>No exceptions detected.</p>
        </div>
      </div>
    );
  }

  const severityColor = { high: '#dc2626', med: '#d97706', low: '#6b7280' };
  const severityBg    = { high: '#fef2f2', med: '#fffbeb', low: '#f9fafb' };
  const severityBorder = { high: '#fecaca', med: '#fde68a', low: '#e5e7eb' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{
          background: severityBg[it.severity],
          border: `1px solid ${severityBorder[it.severity]}`,
          borderRadius: 10,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <it.icon style={{ width: 16, height: 16, color: severityColor[it.severity], flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{it.label}</p>
            {it.detail && <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.detail}</p>}
          </div>
          <ChevronRight style={{ width: 14, height: 14, color: '#9ca3af', flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Salesman Scoreboard ──────────────────────────────────────────────────────
function SalesmanScores({ scores }) {
  if (!scores || scores.length === 0) {
    return <p style={{ fontSize: 13, color: '#9ca3af', padding: '20px 0' }}>No salesman activity yet.</p>;
  }
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            {['#', 'Salesman', 'Score', 'Conv.', 'Response', 'Avg GP', 'Docs', 'Leads'].map((h, i) => (
              <th key={h} style={{ padding: '11px 16px', fontSize: 10, color: '#6b7280', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scores.map((s, i) => {
            const scoreColor = s.score >= 75 ? '#16a34a' : s.score >= 50 ? '#d97706' : '#dc2626';
            return (
              <tr key={s.id} style={{ borderBottom: i === scores.length - 1 ? 'none' : '1px solid #f3f4f6' }}>
                <td style={{ padding: '14px 16px', color: '#9ca3af', fontWeight: 600 }}>{i + 1}</td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {s.avatar_url
                      ? <img src={s.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover' }} />
                      : <div style={{ width: 28, height: 28, borderRadius: 14, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 11, fontWeight: 600 }}>{(s.name || '?').slice(0, 1)}</div>}
                    <span style={{ color: '#111827', fontWeight: 500 }}>{s.name || '—'}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 36, height: 6, background: '#f3f4f6', borderRadius: 3 }}>
                      <div style={{ width: `${s.score}%`, height: '100%', borderRadius: 3, background: scoreColor }} />
                    </div>
                    <span style={{ color: scoreColor, fontWeight: 700, fontSize: 13, minWidth: 24, textAlign: 'right' }}>{s.score}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right', color: '#374151', fontWeight: 500 }}>{s.conv_rate}%</td>
                <td style={{ padding: '14px 16px', textAlign: 'right', color: s.avg_response_min > 60 ? '#d97706' : '#374151' }}>
                  {s.avg_response_min ? (s.avg_response_min >= 60 ? Math.round(s.avg_response_min / 60) + 'h' : s.avg_response_min + 'm') : '—'}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right', color: '#374151', fontWeight: 500 }}>{fmtRMShort(s.avg_gp)}</td>
                <td style={{ padding: '14px 16px', textAlign: 'right', color: '#374151' }}>{s.doc_rate_pct}%</td>
                <td style={{ padding: '14px 16px', textAlign: 'right', color: '#374151' }}>{s.won_30d}/{s.leads_30d}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Audit Trail ──────────────────────────────────────────────────────────────
function AuditTrail({ dealerId }) {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all'); // all | anomaly | car_listings | leads | deal_financing | stock_units
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
      {loading ? (
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
function GoalTracker({ dealerId, mtdRevenue, mtdProfit, mtdUnits }) {
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
          { label: 'Revenue', actual: mtdRevenue, target: goal?.target_revenue, fmt: fmtRMShort, ring: rRev },
          { label: 'Profit', actual: mtdProfit, target: goal?.target_profit, fmt: fmtRMShort, ring: rProf },
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

// ─── Revenue Trend Chart ──────────────────────────────────────────────────────
function RevenueTrend({ sparkline }) {
  if (!sparkline || sparkline.length === 0) return null;
  const fmt = (val) => {
    if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(0) + 'k';
    return val.toFixed(0);
  };
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px' }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 14px' }}>Revenue · last 30 days</p>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkline} margin={{ top: 5, right: 8, bottom: 5, left: 0 }}>
            <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} tickFormatter={(v) => new Date(v).getDate()} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={fmt} width={45} />
            <RTooltip
              contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
              labelFormatter={(v) => new Date(v).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
              formatter={(v) => [fmtRM(v), 'Revenue']}
            />
            <Line type="monotone" dataKey="rev" stroke="#111827" strokeWidth={2} dot={{ r: 2, fill: '#111827' }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OversightTab({ dealerId }) {
  const [pnl, setPnl] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!dealerId) return;
    setLoading(true);
    Promise.all([
      supabase.rpc('gm_pnl_snapshot', { p_dealer_id: dealerId }),
      supabase.rpc('gm_exception_alerts', { p_dealer_id: dealerId }),
      supabase.rpc('gm_salesman_scores', { p_dealer_id: dealerId }),
    ]).then(([p, e, s]) => {
      setPnl(p.data);
      setAlerts(e.data);
      setScores(s.data || []);
      setLoading(false);
    });
  }, [dealerId, refreshKey]);

  if (loading || !pnl) {
    return (
      <div style={{ background: '#fafafa', minHeight: '100vh', margin: '-24px', padding: 40 }}>
        <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading oversight…</p>
      </div>
    );
  }

  return (
    <div style={{ background: '#fafafa', minHeight: '100vh', margin: '-24px', padding: '32px 36px', fontFamily: "'DM Sans', sans-serif", color: '#111827' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid #e5e7eb' }}>
        <div>
          <p style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.12em', fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>Command Center</p>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: '4px 0 0', letterSpacing: '-0.02em' }}>GM Oversight</h1>
        </div>
        <button onClick={() => setRefreshKey(k => k + 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#374151', cursor: 'pointer', fontWeight: 500 }}>
          <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
        </button>
      </div>

      {/* Hero KPIs */}
      <Section title="Live Performance" subtitle="Real-time view of the dealership pulse">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <HeroKPI label="Revenue (MTD)"   value={pnl.mtd.revenue}      prev={pnl.lmtd.revenue}      sparkline={pnl.sparkline} />
          <HeroKPI label="Gross Profit"    value={pnl.mtd.gross_profit} prev={pnl.lmtd.gross_profit} hint={`${pnl.mtd.avg_margin}% margin`} />
          <HeroKPI label="Units Sold"      value={pnl.mtd.units}        prev={pnl.lmtd.units}        format={(v) => v.toString()} />
          <HeroKPI label="Capital Tied"    value={pnl.inventory.capital_tied} hint={`${pnl.inventory.in_stock} units · ${pnl.inventory.aged_60} aged 60d+`} />
        </div>
      </Section>

      {/* Goal Tracker */}
      <Section title="Monthly Targets" subtitle="Pace tracking against your goals">
        <GoalTracker
          dealerId={dealerId}
          mtdRevenue={Number(pnl.mtd.revenue)}
          mtdProfit={Number(pnl.mtd.gross_profit)}
          mtdUnits={Number(pnl.mtd.units)}
        />
      </Section>

      {/* Revenue trend */}
      <Section title="Revenue Trend" subtitle="Daily revenue over the past 30 days">
        <RevenueTrend sparkline={pnl.sparkline} />
      </Section>

      {/* Exception Alerts */}
      <Section title="Eyes Here" subtitle="Issues requiring your attention">
        <ExceptionAlerts alerts={alerts} />
      </Section>

      {/* Salesman Scores */}
      <Section title="Team Performance" subtitle="30-day rolling salesman quality scores">
        <SalesmanScores scores={scores} />
      </Section>

      {/* Audit Trail */}
      <Section title="Activity Trail" subtitle="Who did what, when. Anomalies surface automatically.">
        <AuditTrail dealerId={dealerId} />
      </Section>
    </div>
  );
}
