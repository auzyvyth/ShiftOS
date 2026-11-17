import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useCachedFetch } from '../hooks/useCachedFetch';
import { Globe, TrendingUp, Eye, Share2 } from 'lucide-react';
import { premiumLight as PL } from '../theme/tokens';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush } from 'recharts';

// Analytics > Traffic (was "Performance" until 2026-11-16, plan step 4c). The WEBSITE only:
// visits, car views, WhatsApp taps, share platforms. How each salesman is doing moved to Team
// (`dashboard/TeamScoreboard.jsx`), so people are judged on one screen.

// ─── Sub-components ────────────────────────────────────────────────────────────

function PerfSectionHeader({ icon: Icon, label, desc, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      paddingBottom: 14, borderBottom: `1px solid ${PL.line}`, marginBottom: 16, gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: PL.raised,
          border: 'none',
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
      background: PL.raised, border: 'none',
      borderRadius: PL.radius.row, padding: '14px 16px', minWidth: 0,
    }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 800, color: valueColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, margin: '4px 0 0' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div style={{ padding: '28px 16px', textAlign: 'center', background: PL.raised, border: 'none', borderRadius: PL.radius.row }}>
      <Icon size={26} color="#d1d5db" style={{ margin: '0 auto 8px', display: 'block' }} />
      <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>{text}</p>
    </div>
  );
}

function SectionShell({ children }) {
  return (
    <section style={{ background: PL.card, border: 'none', borderRadius: PL.radius.card, padding: '18px 20px', boxShadow: PL.shadow }}>
      {children}
    </section>
  );
}

// Engagement chart series + a rich hover tooltip so dealers see every metric for
// the hovered day at once (not just one line).
// axis: high-volume traffic on the left, low-volume conversions on the right so
// bookings/calls/WhatsApp aren't crushed to zero under page-visit counts.
const ENG_SERIES = [
  { key: 'visits',   label: 'Page visits',    color: '#c4c8cf', axis: 'left', dash: '4 3' },
  { key: 'clicks',   label: 'Listing clicks', color: '#8b919c', axis: 'left', dash: '4 3' },
  { key: 'whatsapp', label: 'WhatsApp',       color: '#4b5563', axis: 'right' },
  { key: 'calls',    label: 'Calls',          color: '#9ca3af', axis: 'right' },
  { key: 'bookings', label: 'Bookings',       color: '#111827', axis: 'right' },
];

function EngagementTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload || {};
  const total = ENG_SERIES.reduce((s, x) => s + (Number(row[x.key]) || 0), 0);
  return (
    <div style={{ background: '#fff', border: 'none', borderRadius: 12, padding: '10px 12px', boxShadow: PL.shadow, fontFamily: "system-ui,sans-serif", minWidth: 180 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>{label}</p>
      {ENG_SERIES.map((s) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '2px 0' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />{s.label}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{Number(row[s.key]) || 0}</span>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${PL.line}`, marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Total events</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{total}</span>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PerformanceTab({ dealerId, listings = [] }) {
  const [range, setRange] = useState(30);

  // All four loads are cached (stale-while-revalidate, per-dealer) so the tab
  // paints instantly on revisit and refreshes in the background / daily.
  const { data: trafficRaw, loading: trafficLoading } = useCachedFetch(
    dealerId ? `perf:traffic:${dealerId}:${range}` : null,
    async () => {
      const since = new Date();
      since.setDate(since.getDate() - range);
      const { data, error } = await supabase
        .from('analytics_events')
        .select('event_type, created_at, session_id, car_id, car_name, metadata')
        .eq('dealer_id', dealerId)
        .gte('created_at', since.toISOString());
      if (error) throw error;
      return data || [];
    },
    { enabled: !!dealerId },
  );
  const trafficEvents = useMemo(() => trafficRaw || [], [trafficRaw]);

  const { data: eng, loading: engLoading } = useCachedFetch(
    dealerId ? `perf:eng:${dealerId}` : null,
    async () => {
      const [carRes, dailyRes] = await Promise.all([
        supabase.rpc('get_dealer_car_analytics', { p_dealer_id: dealerId }),
        supabase.rpc('get_dealer_daily_analytics', { p_dealer_id: dealerId }),
      ]);
      const err = carRes.error || dailyRes.error;
      if (err) throw err;
      return { car: carRes.data || [], daily: dailyRes.data || [] };
    },
    { enabled: !!dealerId },
  );
  const carStats = useMemo(() => eng?.car || [], [eng]);
  const daily = useMemo(() => eng?.daily || [], [eng]);

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

  const convColor = Number(traffic.conversion) >= 3 ? '#047857' : Number(traffic.conversion) >= 1 ? '#111827' : '#b91c1c';

  // ── Derived: engagement chart + salesman leaderboard ────────────────────────
  const engTotals = useMemo(() => ({
    clicks:   carStats.reduce((s, r) => s + (Number(r.views) || 0), 0),
    whatsapp: carStats.reduce((s, r) => s + (Number(r.whatsapp) || 0), 0),
    calls:    carStats.reduce((s, r) => s + (Number(r.calls) || 0), 0),
    bookings: daily.reduce((s, r) => s + (Number(r.bookings) || 0), 0),
    visits:   daily.reduce((s, r) => s + (Number(r.visits) || 0), 0),
  }), [carStats, daily]);

  const dailyChart = useMemo(() => {
    const rowMap = {};
    daily.forEach(r => { rowMap[r.date] = r; });
    const now = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (29 - i));
      const dateStr = d.toISOString().slice(0, 10);
      const r = rowMap[dateStr] || {};
      return {
        date:     d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }),
        visits:   Number(r.visits)   || 0,
        clicks:   Number(r.clicks)   || 0,
        whatsapp: Number(r.whatsapp) || 0,
        calls:    Number(r.calls)    || 0,
        bookings: Number(r.bookings) || 0,
      };
    });
  }, [daily]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "system-ui,sans-serif", minWidth: 0 }}>

      {/* ── Engagement Overview (chart on top) ─────────────────────────────────── */}
      <SectionShell>
        <PerfSectionHeader
          icon={TrendingUp}
          label="Engagement Overview"
          desc="Last 30 days · traffic on the left axis, conversions (WhatsApp/calls/bookings) on the right"
        />
        {/* Summary pills as a full-width wrapping row (kept out of the header so
            they never force horizontal overflow on mobile). */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {ENG_SERIES.map(({ key, label, color }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: PL.raised, border: 'none' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#6b7280' }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{engLoading ? '…' : (engTotals[key] ?? 0)}</span>
            </div>
          ))}
        </div>
        {engLoading ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>Loading chart…</div>
        ) : (
          <div style={{ width: '100%', minWidth: 0, overflowX: 'hidden' }}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dailyChart} margin={{ top: 4, right: 0, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceef1" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis yAxisId="left" allowDecimals={false} width={30} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" allowDecimals={false} width={26} tick={{ fontSize: 10, fill: '#111827' }} axisLine={false} tickLine={false} />
                <Tooltip content={<EngagementTooltip />} cursor={{ stroke: 'rgba(17,24,39,0.18)', strokeWidth: 1 }} />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingTop: 8 }} />
                <Brush dataKey="date" height={20} stroke="rgba(17,24,39,0.18)" fill="rgba(17,24,39,0.04)" travellerWidth={6} startIndex={Math.max(0, dailyChart.length - 14)} />
                {ENG_SERIES.map((s) => (
                  <Line key={s.key} yAxisId={s.axis} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeDasharray={s.dash} strokeWidth={s.key === 'bookings' ? 2.25 : 1.75} dot={false} activeDot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionShell>

      {/* Listings & Inventory was here: days on lot, capital tied up and aged cars, on two clocks
          of its own. Overview's stock block is the one place for those numbers (owner rule: each
          fact once), on carPnl's clock. */}

      {/* ── Website & Traffic ─────────────────────────────────────────────────── */}
      <SectionShell>
        <PerfSectionHeader
          icon={Globe}
          label="Website & Traffic"
          desc="Storefront visits, car page views, and WhatsApp conversion"
          right={
            <div style={{ display: 'inline-flex', gap: 2, padding: 3, background: PL.hover, borderRadius: 999 }}>
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => setRange(d)} style={{
                  padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: range === d ? 700 : 500,
                  cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                  background: range === d ? '#fff' : 'transparent',
                  boxShadow: range === d ? '0 1px 3px rgba(17,24,39,0.12)' : 'none',
                  color: range === d ? '#111827' : '#4b5563',
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
              <KpiTile label="WA Clicks" value={traffic.waClicks} sub="direct enquiries" valueColor="#111827" />
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
                      <div key={car.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: PL.raised, borderRadius: PL.radius.row, border: 'none' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? '#111827' : '#9ca3af', minWidth: 20, textAlign: 'right' }}>#{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{car.name}</p>
                          <div style={{ height: 4, background: '#fff', borderRadius: 2, marginTop: 5 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: i === 0 ? '#111827' : '#9ca3af', borderRadius: 2, transition: 'width 0.4s ease' }} />
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
              <div style={{ marginTop: 18, borderTop: `1px solid ${PL.line}`, paddingTop: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  <Share2 size={11} style={{ display: 'inline', marginRight: 4 }} />
                  Clicks by Share Platform — Last {range}d
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {traffic.byChannel.map((c) => {
                    const meta = {
                      whatsapp: { label: 'WhatsApp', color: '#111827' },
                      facebook: { label: 'Facebook', color: '#4b5563' },
                      tiktok:   { label: 'TikTok',   color: '#111827' },
                      copy:     { label: 'Copied link', color: '#6b7280' },
                    }[c.channel] || { label: c.channel, color: '#6b7280' };
                    const total = traffic.byChannel.reduce((s, x) => s + x.clicks, 0) || 1;
                    return (
                      <div key={c.channel} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: PL.raised, borderRadius: PL.radius.row, border: 'none' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', flex: 1 }}>{meta.label}</span>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>{Math.round((c.clicks / total) * 100)}%</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', width: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.clicks} click{c.clicks !== 1 ? 's' : ''}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#047857', width: 50, textAlign: 'right' }}>{c.waClicks} WA</span>
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
