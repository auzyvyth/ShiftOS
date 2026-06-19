import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Users, Car, Globe, AlertTriangle, TrendingUp, Eye, Share2 } from 'lucide-react';

const fmtRM = (n) =>
  `RM ${Number(n || 0).toLocaleString('en-MY', { maximumFractionDigits: 0 })}`;
const fmtRMShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `RM ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `RM ${(v / 1_000).toFixed(0)}k`;
  return `RM ${v}`;
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function PerfSectionHeader({ icon: Icon, label, desc, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      paddingBottom: 12, borderBottom: '1px solid #e5e7eb', marginBottom: 16, gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'linear-gradient(135deg,#f9fafb,#f3f4f6)',
          border: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={17} color="#374151" />
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>{label}</p>
          {desc && <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{desc}</p>}
        </div>
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

function KpiTile({ label, value, sub, valueColor = '#111827', warn = false }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${warn ? 'rgba(251,191,36,0.35)' : '#e5e7eb'}`,
      borderRadius: 10, padding: '12px 14px', minWidth: 0,
      ...(warn && { background: 'rgba(254,252,232,0.6)' }),
    }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: valueColor, fontFamily: "'Bebas Neue',cursive", lineHeight: 1.15, margin: '4px 0 0' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  );
}

function ScoreBar({ score }) {
  const color = score >= 75 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  const pct = Math.min(100, Math.max(0, score));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: 48, height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 22, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{score}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div style={{ padding: '28px 16px', textAlign: 'center', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 10 }}>
      <Icon size={26} color="#d1d5db" style={{ margin: '0 auto 8px', display: 'block' }} />
      <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>{text}</p>
    </div>
  );
}

function SectionShell({ children }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
      {children}
    </section>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PerformanceTab({ dealerId, listings = [] }) {
  // Team
  const [scores, setScores] = useState([]);
  const [teamLoading, setTeamLoading] = useState(true);

  // Stock
  const [stock, setStock] = useState([]);
  const [stockLoading, setStockLoading] = useState(true);

  // Traffic
  const [trafficEvents, setTrafficEvents] = useState([]);
  const [range, setRange] = useState(30);
  const [trafficLoading, setTrafficLoading] = useState(true);

  useEffect(() => {
    if (!dealerId) return;
    supabase.rpc('gm_salesman_scores', { p_dealer_id: dealerId })
      .then(({ data }) => { setScores(data || []); setTeamLoading(false); });
  }, [dealerId]);

  useEffect(() => {
    if (!dealerId) return;
    supabase
      .from('stock_units')
      .select('id, purchase_date, status, purchase_price, recon_cost, brand, model, year, asking_price')
      .eq('dealer_id', dealerId)
      .neq('status', 'sold')
      .then(({ data }) => { setStock(data || []); setStockLoading(false); });
  }, [dealerId]);

  useEffect(() => {
    if (!dealerId) return;
    setTrafficLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - range);
    supabase
      .from('analytics_events')
      .select('event_type, created_at, session_id, car_id, car_name, metadata')
      .eq('dealer_id', dealerId)
      .gte('created_at', since.toISOString())
      .then(({ data }) => { setTrafficEvents(data || []); setTrafficLoading(false); });
  }, [dealerId, range]);

  // ── Derived: listings metrics ──────────────────────────────────────────────
  const listingMetrics = useMemo(() => {
    const now = Date.now();
    const active = listings.filter(l => l.status === 'available');
    const avgDays = active.length
      ? Math.round(active.reduce((s, l) => s + (now - new Date(l.created_at)) / 86_400_000, 0) / active.length)
      : 0;
    const stale30 = active.filter(l => (now - new Date(l.created_at)) / 86_400_000 > 30).length;
    const stale60 = active.filter(l => (now - new Date(l.created_at)) / 86_400_000 > 60).length;
    return { total: active.length, avgDays, stale30, stale60 };
  }, [listings]);

  // ── Derived: stock metrics ─────────────────────────────────────────────────
  const stockMetrics = useMemo(() => {
    const now = Date.now();
    const daysIn = u => u.purchase_date ? (now - new Date(u.purchase_date)) / 86_400_000 : 0;
    const capital = stock.reduce((s, u) => s + (Number(u.purchase_price) || 0) + (Number(u.recon_cost) || 0), 0);
    const aged45 = stock.filter(u => daysIn(u) > 45);
    const aged60 = stock.filter(u => daysIn(u) > 60);
    return { total: stock.length, capital, aged45, aged60 };
  }, [stock]);

  // ── Derived: traffic metrics ───────────────────────────────────────────────
  const traffic = useMemo(() => {
    const visits = new Set(
      trafficEvents.filter(e => e.event_type === 'store_visit' || e.event_type === 'link_visit').map(e => e.session_id)
    ).size;
    const carViews = trafficEvents.filter(e => e.event_type === 'car_view').length;
    const waClicks = trafficEvents.filter(e => e.event_type === 'whatsapp_click').length;
    const conversion = visits > 0 ? ((waClicks / visits) * 100).toFixed(1) : '0.0';

    const viewMap = {};
    trafficEvents.filter(e => e.event_type === 'car_view' && e.car_name).forEach(e => {
      viewMap[e.car_name] = (viewMap[e.car_name] || 0) + 1;
    });
    const topCars = Object.entries(viewMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    // Share-channel breakdown: events that arrived via a ?src= tagged share link.
    const chMap = {};
    trafficEvents.forEach(e => {
      const ch = e.metadata?.channel;
      if (!ch) return;
      if (!chMap[ch]) chMap[ch] = { clicks: 0, waClicks: 0 };
      chMap[ch].clicks += 1;
      if (e.event_type === 'whatsapp_click') chMap[ch].waClicks += 1;
    });
    const byChannel = Object.entries(chMap)
      .map(([channel, v]) => ({ channel, ...v }))
      .sort((a, b) => b.clicks - a.clicks);

    return { visits, carViews, waClicks, conversion, topCars, byChannel };
  }, [trafficEvents]);

  const convColor = Number(traffic.conversion) >= 3 ? '#16a34a' : Number(traffic.conversion) >= 1 ? '#d97706' : '#dc2626';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'DM Sans',sans-serif" }}>

      {/* ── Team Performance ──────────────────────────────────────────────────── */}
      <SectionShell>
        <PerfSectionHeader
          icon={Users}
          label="Team Performance"
          desc="Salesman scores, conversion rates & response times — last 30 days"
          right={
            teamLoading ? null :
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', background: '#f3f4f6', borderRadius: 6, padding: '3px 10px' }}>
              {scores.length} active
            </span>
          }
        />
        {teamLoading ? (
          <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</p>
          </div>
        ) : scores.length === 0 ? (
          <EmptyState icon={Users} text="No salesman activity recorded yet." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['#', 'Salesman', 'Score', 'Conv.', 'Response', 'Avg GP', 'Docs', 'Leads (30d)'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h === '#' || h === 'Salesman' ? 'left' : 'right', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scores.map((s, i) => (
                  <tr key={s.id || i} style={{ borderBottom: i < scores.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: i === 0 ? '#dc2626' : '#9ca3af', width: 28 }}>#{i + 1}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        {s.avatar_url
                          ? <img src={s.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: 28, height: 28, borderRadius: 14, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#374151', flexShrink: 0 }}>{(s.name || '?')[0].toUpperCase()}</div>
                        }
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap' }}>{s.name || '—'}</span>
                        {i === 0 && <span style={{ fontSize: 9, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}><ScoreBar score={s.score || 0} /></td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{s.conv_rate != null ? `${s.conv_rate}%` : '—'}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums', color: s.avg_response_min > 120 ? '#dc2626' : s.avg_response_min > 60 ? '#d97706' : '#16a34a' }}>
                      {s.avg_response_min != null ? (s.avg_response_min < 60 ? `${s.avg_response_min}m` : `${Math.round(s.avg_response_min / 60)}h`) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{s.avg_gp != null ? fmtRMShort(s.avg_gp) : '—'}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{s.doc_rate_pct != null ? `${s.doc_rate_pct}%` : '—'}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{s.won_30d != null ? `${s.won_30d}/${s.leads_30d ?? s.won_30d}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionShell>

      {/* ── Listings & Inventory ──────────────────────────────────────────────── */}
      <SectionShell>
        <PerfSectionHeader
          icon={Car}
          label="Listings & Inventory"
          desc="Active stock, days on lot, capital exposure & aged unit alerts"
          right={
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', background: '#f3f4f6', borderRadius: 6, padding: '3px 10px' }}>
              {listingMetrics.total} active
            </span>
          }
        />
        {/* Listing health grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
          <KpiTile label="Active Listings" value={listingMetrics.total} sub="available to sell" />
          <KpiTile
            label="Avg Days on Lot"
            value={listingMetrics.avgDays}
            sub="all active cars"
            valueColor={listingMetrics.avgDays > 45 ? '#d97706' : '#111827'}
            warn={listingMetrics.avgDays > 45}
          />
          <KpiTile
            label="Stale 30d+"
            value={listingMetrics.stale30}
            sub="consider repricing"
            valueColor={listingMetrics.stale30 > 0 ? '#d97706' : '#16a34a'}
            warn={listingMetrics.stale30 > 0}
          />
          <KpiTile
            label="Stale 60d+"
            value={listingMetrics.stale60}
            sub="urgent — price drop"
            valueColor={listingMetrics.stale60 > 0 ? '#dc2626' : '#16a34a'}
            warn={listingMetrics.stale60 > 0}
          />
        </div>
        {/* Stock grid */}
        {!stockLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <KpiTile label="Units in Stock" value={stockMetrics.total} sub="unsold physical units" />
            <KpiTile label="Capital Tied Up" value={fmtRM(stockMetrics.capital)} sub="purchase + recon cost" valueColor="#4f46e5" />
            <KpiTile
              label="Aged >45 Days"
              value={stockMetrics.aged45.length}
              sub={stockMetrics.aged60.length > 0 ? `${stockMetrics.aged60.length} critical >60d` : 'all under 60 days'}
              valueColor={stockMetrics.aged45.length > 0 ? '#d97706' : '#16a34a'}
              warn={stockMetrics.aged45.length > 0}
            />
          </div>
        )}
        {/* Aged units list */}
        {!stockLoading && stockMetrics.aged60.length > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              <AlertTriangle size={11} style={{ display: 'inline', marginRight: 4 }} />
              Aged Over 60 Days — Act Now
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {stockMetrics.aged60.map(u => {
                const days = u.purchase_date ? Math.floor((Date.now() - new Date(u.purchase_date)) / 86_400_000) : null;
                return (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 8, borderLeft: '3px solid #ef4444' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{[u.year, u.brand, u.model].filter(Boolean).join(' ') || 'Unit'}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }}>{days != null ? `${days}d` : '—'}</span>
                    {u.asking_price && <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtRM(u.asking_price)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionShell>

      {/* ── Website & Traffic ─────────────────────────────────────────────────── */}
      <SectionShell>
        <PerfSectionHeader
          icon={Globe}
          label="Website & Traffic"
          desc="Storefront visits, car page views, and WhatsApp conversion"
          right={
            <div style={{ display: 'flex', gap: 3 }}>
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => setRange(d)} style={{
                  padding: '4px 11px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', border: '1px solid',
                  borderColor: range === d ? '#dc2626' : '#e5e7eb',
                  background: range === d ? '#fef2f2' : '#fff',
                  color: range === d ? '#dc2626' : '#6b7280',
                  transition: 'all 0.12s',
                }}>
                  {d}d
                </button>
              ))}
            </div>
          }
        />
        {trafficLoading ? (
          <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading traffic data…</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              <KpiTile label="Store Visits" value={traffic.visits} sub={`last ${range} days`} />
              <KpiTile label="Car Views" value={traffic.carViews} sub="detail page views" />
              <KpiTile label="WA Clicks" value={traffic.waClicks} sub="direct enquiries" valueColor="#16a34a" />
              <KpiTile
                label="Conversion"
                value={`${traffic.conversion}%`}
                sub="visits → WA click"
                valueColor={convColor}
                warn={Number(traffic.conversion) < 1}
              />
            </div>
            {traffic.topCars.length > 0 ? (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  <Eye size={11} style={{ display: 'inline', marginRight: 4 }} />
                  Top Viewed Cars — Last {range}d
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {traffic.topCars.map((car, i) => {
                    const maxV = traffic.topCars[0].count;
                    const pct = Math.round((car.count / maxV) * 100);
                    return (
                      <div key={car.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#fafafa', borderRadius: 8, border: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? '#dc2626' : '#9ca3af', minWidth: 20, textAlign: 'right' }}>#{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{car.name}</p>
                          <div style={{ height: 3, background: '#e5e7eb', borderRadius: 2, marginTop: 4 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: i === 0 ? '#dc2626' : '#3b82f6', borderRadius: 2, transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{car.count} views</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState icon={TrendingUp} text={`No traffic recorded in the last ${range} days.`} />
            )}
            {traffic.byChannel.length > 0 && (
              <div style={{ marginTop: 18, borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  <Share2 size={11} style={{ display: 'inline', marginRight: 4 }} />
                  Clicks by Share Platform — Last {range}d
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {traffic.byChannel.map((c) => {
                    const meta = {
                      whatsapp: { label: 'WhatsApp', color: '#25D366' },
                      facebook: { label: 'Facebook', color: '#1877F2' },
                      tiktok:   { label: 'TikTok',   color: '#111827' },
                      copy:     { label: 'Copied link', color: '#6b7280' },
                    }[c.channel] || { label: c.channel, color: '#6b7280' };
                    const total = traffic.byChannel.reduce((s, x) => s + x.clicks, 0) || 1;
                    return (
                      <div key={c.channel} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#fafafa', borderRadius: 8, border: '1px solid #f3f4f6' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', flex: 1 }}>{meta.label}</span>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>{Math.round((c.clicks / total) * 100)}%</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', width: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.clicks} click{c.clicks !== 1 ? 's' : ''}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', width: 50, textAlign: 'right' }}>{c.waClicks} WA</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </SectionShell>
    </div>
  );
}
