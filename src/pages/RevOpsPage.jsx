import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Users,
  Package,
  X,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtRM = (n) =>
  n == null ? '—' : `RM ${Number(n).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const daysAgo = (iso) =>
  iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : null;

const hoursAgo = (iso) =>
  iso ? Math.floor((Date.now() - new Date(iso)) / 3600000) : null;

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

const thirtyDaysAgo = () =>
  new Date(Date.now() - 30 * 86400000).toISOString();

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ h = 'h-8', w = 'w-full' }) {
  return (
    <div
      className={`${h} ${w} rounded-lg animate-pulse`}
      style={{ background: 'rgba(255,255,255,0.05)' }}
    />
  );
}

function MetricCard({ label, value, sub, loading, accentColor = '#3b82f6', icon: Icon }) {
  return (
    <div
      className="relative flex flex-col gap-1.5 p-4 rounded-lg stat-card"
      style={{
        background: 'linear-gradient(145deg,rgba(255,255,255,0.032),rgba(255,255,255,0.008))',
        border: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          {label}
        </span>
        {Icon && (
          <span
            className="flex items-center justify-center w-6 h-6 rounded-md"
            style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}
          >
            <Icon style={{ width: 13, height: 13, color: accentColor }} />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton h="h-8" w="w-3/4" />
      ) : (
        <span
          style={{
            fontFamily: "'Bebas Neue',cursive",
            fontSize: 28,
            letterSpacing: '0.04em',
            color: '#f8fafc',
            lineHeight: 1,
          }}
        >
          {value ?? '—'}
        </span>
      )}
      {sub && !loading && (
        <span style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{sub}</span>
      )}
    </div>
  );
}

function SectionCard({ title, children, loading, skeletonRows = 2 }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.022)',
        border: '1px solid rgba(255,255,255,0.055)',
      }}
    >
      {title && (
        <div
          className="px-5 py-3.5 flex items-center gap-2"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.048)' }}
        >
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
      )}
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <Skeleton key={i} h="h-6" />
            ))}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function AlertBanner({ type, message, onDismiss }) {
  const styles = {
    red: {
      bg: 'rgba(220,38,38,0.08)',
      border: 'rgba(220,38,38,0.22)',
      icon: '#ef4444',
      text: '#fca5a5',
    },
    amber: {
      bg: 'rgba(217,119,6,0.08)',
      border: 'rgba(217,119,6,0.22)',
      icon: '#fbbf24',
      text: '#fde68a',
    },
  };
  const s = styles[type] || styles.amber;
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-lg"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <AlertTriangle style={{ width: 15, height: 15, color: s.icon, flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 13, color: s.text, flex: 1, lineHeight: 1.5 }}>{message}</span>
      <button
        onClick={onDismiss}
        style={{ color: '#6b7280', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
      >
        <X style={{ width: 13, height: 13 }} />
      </button>
    </div>
  );
}

function SourcePill({ source, count }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full"
      style={{
        background: 'rgba(59,130,246,0.1)',
        border: '1px solid rgba(59,130,246,0.2)',
        fontSize: 11,
        color: '#93c5fd',
        fontWeight: 600,
      }}
    >
      {source}: {count}
    </span>
  );
}

function ResponseTimeDot({ minutes }) {
  if (minutes == null) return null;
  const color = minutes < 30 ? '#4ade80' : minutes < 120 ? '#fbbf24' : '#f87171';
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', marginRight: 4 }} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RevOpsPage({ userId }) {
  // ── Revenue data ────────────────────────────────────────────────────────────
  const [revData, setRevData] = useState(null);
  const [revLoading, setRevLoading] = useState(true);

  // ── Lead performance data ────────────────────────────────────────────────
  const [leadData, setLeadData] = useState(null);
  const [leadLoading, setLeadLoading] = useState(true);

  // ── Stock health data ────────────────────────────────────────────────────
  const [stockData, setStockData] = useState(null);
  const [stockLoading, setStockLoading] = useState(true);

  // ── Add-on revenue ───────────────────────────────────────────────────────
  const [addonData, setAddonData] = useState(null);
  const [addonLoading, setAddonLoading] = useState(true);

  // ── Analytics / Page Traffic ─────────────────────────────────────────────
  const [trafficData, setTrafficData] = useState(null);
  const [trafficLoading, setTrafficLoading] = useState(true);

  // ── Alerts ───────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());

  // ── Section 1: Revenue Overview ──────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      setRevLoading(true);

      const monthStart = startOfMonth();

      // Sold this month
      const { data: soldThisMonth } = await supabase
        .from('car_listings')
        .select('sold_price, gross_profit, purchase_price, recon_cost, included_services_cost')
        .eq('dealer_id', userId)
        .eq('status', 'sold')
        .gte('sold_date', monthStart);

      // Active listings for stock turn
      const { count: activeCount } = await supabase
        .from('car_listings')
        .select('id', { count: 'exact', head: true })
        .eq('dealer_id', userId)
        .neq('status', 'sold');

      // Active leads (pipeline value proxy)
      const { count: activeLeads } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('dealer_id', userId)
        .not('status', 'in', '("won","lost")');

      const revMTD = (soldThisMonth || []).reduce((s, r) => s + (Number(r.sold_price) || 0), 0);
      const gpMTD = (soldThisMonth || []).reduce((s, r) => {
        // Use stored gross_profit if available, otherwise compute including services cost
        const gp = r.gross_profit != null
          ? Number(r.gross_profit)
          : (Number(r.sold_price) || 0) - (Number(r.purchase_price) || 0) - (Number(r.recon_cost) || 0) - (Number(r.included_services_cost) || 0);
        return s + gp;
      }, 0);
      const unitsSoldMTD = (soldThisMonth || []).length;

      setRevData({
        revMTD,
        gpMTD,
        activeLeads: activeLeads ?? 0,
        unitsSoldMTD,
        activeCount: activeCount ?? 0,
      });
      setRevLoading(false);
    };
    fetch();
  }, [userId]);

  // ── Section 2: Lead Performance ──────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      setLeadLoading(true);
      const since = thirtyDaysAgo();

      const { data: leads } = await supabase
        .from('leads')
        .select('id, status, source, created_at, first_response_at')
        .eq('dealer_id', userId)
        .gte('created_at', since);

      const all = leads || [];
      const total = all.length;

      // Source breakdown — top 3
      const srcMap = {};
      all.forEach((l) => {
        const src = l.source || 'Unknown';
        srcMap[src] = (srcMap[src] || 0) + 1;
      });
      const topSources = Object.entries(srcMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      // Lead → viewing rate: leads where status moved past 'new'
      const advanced = all.filter((l) => l.status && l.status !== 'new').length;
      const viewingRate = total > 0 ? Math.round((advanced / total) * 100) : null;

      // Avg response time — only if first_response_at column exists on any row
      let avgResponseMin = null;
      const responded = all.filter((l) => l.first_response_at && l.created_at);
      if (responded.length > 0) {
        const totalMin = responded.reduce((s, l) => {
          const diff = (new Date(l.first_response_at) - new Date(l.created_at)) / 60000;
          return s + diff;
        }, 0);
        avgResponseMin = Math.round(totalMin / responded.length);
      }
      // TODO: if first_response_at column doesn't exist on leads, avgResponseMin stays null

      setLeadData({ total, topSources, viewingRate, avgResponseMin });
      setLeadLoading(false);
    };
    fetch();
  }, [userId]);

  // ── Section 3: Stock Health ──────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      setStockLoading(true);
      const { data: units } = await supabase
        .from('stock_units')
        .select('id, created_at, brand, model, year, asking_price, status, purchase_date')
        .eq('dealer_id', userId)
        .eq('status', 'in_stock');

      const all = units || [];
      const now = Date.now();

      const withAge = all.map((u) => {
        const ref = u.purchase_date || u.created_at;
        const days = ref ? Math.floor((now - new Date(ref)) / 86400000) : null;
        return { ...u, days };
      });

      const avgDays =
        withAge.filter((u) => u.days != null).length > 0
          ? Math.round(
              withAge.filter((u) => u.days != null).reduce((s, u) => s + u.days, 0) /
                withAge.filter((u) => u.days != null).length
            )
          : null;

      const aged45 = withAge.filter((u) => u.days != null && u.days > 45);
      const aged60 = withAge.filter((u) => u.days != null && u.days > 60);

      setStockData({ total: all.length, avgDays, aged45, aged60 });
      setStockLoading(false);
    };
    fetch();
  }, [userId]);

  // ── Section 5: Add-on Revenue ────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      setAddonLoading(true);
      const monthStart = startOfMonth();

      // All deal_products this month
      const { data: addonRows } = await supabase
        .from('deal_products')
        .select('id, sold_price, lead_id, product_id, dealer_products(name)')
        .eq('dealer_id', userId)
        .gte('created_at', monthStart);

      // Won leads this month (for attachment rate denominator)
      const { count: wonCount } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('dealer_id', userId)
        .in('stage', ['won', 'closed_won'])
        .gte('updated_at', monthStart);

      const rows = addonRows || [];
      const totalRevenue = rows.reduce((s, r) => s + Number(r.sold_price), 0);
      const uniqueLeads  = new Set(rows.filter(r => r.lead_id).map(r => r.lead_id));
      const avgPerDeal   = uniqueLeads.size > 0 ? Math.round(totalRevenue / uniqueLeads.size) : null;
      const attachRate   = wonCount > 0 ? Math.round((uniqueLeads.size / wonCount) * 100) : null;

      // Top 3 products by count
      const productCount = {};
      rows.forEach(r => {
        const name = r.dealer_products?.name || 'Unknown';
        productCount[name] = (productCount[name] || 0) + 1;
      });
      const topProducts = Object.entries(productCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      setAddonData({ totalRevenue, avgPerDeal, attachRate, topProducts, uniqueLeadCount: uniqueLeads.size });
      setAddonLoading(false);
    };
    fetch();
  }, [userId]);

  // ── Section 4: Page Traffic ──────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      setTrafficLoading(true);
      const since = thirtyDaysAgo();

      const [{ count: storeVisits }, { count: carViews }, { count: waClicks }, { count: linkVisits }, { data: carViewEvents }] = await Promise.all([
        supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('dealer_id', userId).eq('event_type', 'store_visit').gte('created_at', since),
        supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('dealer_id', userId).eq('event_type', 'car_view').gte('created_at', since),
        supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('dealer_id', userId).eq('event_type', 'whatsapp_click').gte('created_at', since),
        supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('dealer_id', userId).eq('event_type', 'link_visit').gte('created_at', since),
        supabase.from('analytics_events').select('car_id, car_name').eq('dealer_id', userId).eq('event_type', 'car_view').gte('created_at', since),
      ]);

      const totalPageVisits = (storeVisits || 0) + (linkVisits || 0);
      const conversionRate = totalPageVisits > 0
        ? ((( waClicks || 0) / totalPageVisits) * 100).toFixed(1)
        : '0.0';

      // Aggregate car views client-side
      const carViewMap = {};
      (carViewEvents || []).forEach(e => {
        if (!e.car_id) return;
        carViewMap[e.car_id] = {
          car_name: e.car_name || 'Unknown',
          views: (carViewMap[e.car_id]?.views || 0) + 1,
        };
      });
      const topCars = Object.entries(carViewMap)
        .map(([id, val]) => ({ car_id: id, ...val }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 5);

      setTrafficData({
        pageVisits: totalPageVisits,
        carViews: carViews || 0,
        waClicks: waClicks || 0,
        conversionRate,
        topCars,
      });
      setTrafficLoading(false);
    };
    fetch();
  }, [userId]);

  // ── Alerts ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      const newAlerts = [];

      // Alert 1 — Unresponded leads (only if first_response_at column exists)
      // We'll attempt the query and ignore gracefully if the column doesn't exist
      try {
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60000).toISOString();
        const { data: unresponded, error: respErr } = await supabase
          .from('leads')
          .select('id, created_at')
          .eq('dealer_id', userId)
          .is('first_response_at', null)
          .eq('status', 'new')
          .lt('created_at', thirtyMinsAgo);

        if (!respErr && unresponded && unresponded.length > 0) {
          const oldest = unresponded.reduce((a, b) =>
            new Date(a.created_at) < new Date(b.created_at) ? a : b
          );
          const hrs = hoursAgo(oldest.created_at);
          newAlerts.push({
            id: 'unresponded',
            type: 'red',
            message: `${unresponded.length} lead${unresponded.length > 1 ? 's' : ''} haven't been responded to — oldest is ${hrs}h ago`,
          });
        }
      } catch (_) {
        // first_response_at column may not exist — skip this alert
      }

      // Alert 2 — Aged stock
      const fortyfiveDaysAgo = new Date(Date.now() - 45 * 86400000).toISOString();
      const { count: agedCount } = await supabase
        .from('stock_units')
        .select('id', { count: 'exact', head: true })
        .eq('dealer_id', userId)
        .eq('status', 'in_stock')
        .lt('created_at', fortyfiveDaysAgo);

      if (agedCount && agedCount > 0) {
        newAlerts.push({
          id: 'aged_stock',
          type: 'amber',
          message: `${agedCount} unit${agedCount > 1 ? 's' : ''} have been in stock over 45 days — consider a price review`,
        });
      }

      // Alert 3 — No sales this month (after day 7)
      const dayOfMonth = new Date().getDate();
      if (dayOfMonth > 7) {
        const { count: salesCount } = await supabase
          .from('car_listings')
          .select('id', { count: 'exact', head: true })
          .eq('dealer_id', userId)
          .eq('status', 'sold')
          .gte('sold_date', startOfMonth());

        if (salesCount === 0) {
          newAlerts.push({
            id: 'no_sales',
            type: 'amber',
            message: 'No sales recorded this month yet',
          });
        }
      }

      setAlerts(newAlerts);
    };
    fetch();
  }, [userId]);

  const dismissAlert = (id) =>
    setDismissedAlerts((prev) => new Set([...prev, id]));

  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6"
      style={{ fontFamily: "'DM Sans',sans-serif" }}
    >
      {/* Header */}
      <div>
        <h1
          style={{
            fontFamily: "'Bebas Neue',cursive",
            fontSize: 32,
            letterSpacing: '0.06em',
            color: '#f8fafc',
            lineHeight: 1,
          }}
        >
          Revenue Operations
        </h1>
        <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
          Your dealership at a glance
        </p>
      </div>

      {/* ── Alerts strip ──────────────────────────────────────────────────── */}
      {visibleAlerts.length > 0 && (
        <div className="space-y-2">
          {visibleAlerts.map((a) => (
            <AlertBanner
              key={a.id}
              type={a.type}
              message={a.message}
              onDismiss={() => dismissAlert(a.id)}
            />
          ))}
        </div>
      )}

      {/* ── Section 1: Revenue Overview ──────────────────────────────────── */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Revenue Overview
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Revenue MTD"
            value={revData ? fmtRM(revData.revMTD) : null}
            loading={revLoading}
            icon={DollarSign}
            accentColor="#4ade80"
          />
          <MetricCard
            label="Gross Profit MTD"
            value={revData ? fmtRM(revData.gpMTD) : null}
            loading={revLoading}
            icon={TrendingUp}
            accentColor="#34d399"
          />
          <MetricCard
            label="Active Leads"
            value={revData ? String(revData.activeLeads) : null}
            sub="Pipeline count"
            loading={revLoading}
            icon={Users}
            accentColor="#60a5fa"
          />
          <MetricCard
            label="Stock Turn (30d)"
            value={
              revData
                ? `${revData.unitsSoldMTD} / ${revData.activeCount}`
                : null
            }
            sub="units sold / active"
            loading={revLoading}
            icon={Package}
            accentColor="#a78bfa"
          />
        </div>
      </div>

      {/* ── Section 2: Lead Performance ──────────────────────────────────── */}
      <SectionCard title="Lead Performance (30d)" loading={leadLoading} skeletonRows={3}>
        <div className="grid grid-cols-2 gap-4">
          {/* Total Leads */}
          <div className="flex flex-col gap-1">
            <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>
              Total Leads
            </span>
            <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 26, color: '#f8fafc' }}>
              {leadData?.total ?? '—'}
            </span>
          </div>

          {/* Lead → Viewing Rate */}
          <div className="flex flex-col gap-1">
            <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>
              Viewing Rate
            </span>
            <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 26, color: '#f8fafc' }}>
              {leadData?.viewingRate != null ? `${leadData.viewingRate}%` : '—'}
            </span>
            <span style={{ fontSize: 11, color: '#4b5563' }}>moved past new</span>
          </div>

          {/* By Source */}
          <div className="flex flex-col gap-2">
            <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>
              Top Sources
            </span>
            <div className="flex flex-wrap gap-1.5">
              {leadData?.topSources?.length > 0 ? (
                leadData.topSources.map(([src, cnt]) => (
                  <SourcePill key={src} source={src} count={cnt} />
                ))
              ) : (
                <span style={{ fontSize: 12, color: '#4b5563' }}>No data</span>
              )}
            </div>
          </div>

          {/* Avg Response Time */}
          <div className="flex flex-col gap-1">
            <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>
              Avg Response
            </span>
            {leadData?.avgResponseMin != null ? (
              <>
                <div className="flex items-center gap-1">
                  <ResponseTimeDot minutes={leadData.avgResponseMin} />
                  <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 26, color: '#f8fafc' }}>
                    {leadData.avgResponseMin}
                  </span>
                  <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'flex-end', paddingBottom: 3 }}>min avg</span>
                </div>
              </>
            ) : (
              <span style={{ fontSize: 12, color: '#4b5563' }}>
                {/* TODO: add first_response_at column to leads table to enable this metric */}
                No data
              </span>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Section 4: Page Traffic (30d) ───────────────────────────────── */}
      <SectionCard title="Page Traffic (30d)" loading={trafficLoading} skeletonRows={3}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>Store Visits</span>
            <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 26, color: '#f8fafc' }}>{trafficData?.pageVisits ?? '—'}</span>
            <span style={{ fontSize: 11, color: '#4b5563' }}>organic + referral</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>Car Views</span>
            <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 26, color: '#f8fafc' }}>{trafficData?.carViews ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>WA Clicks</span>
            <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 26, color: '#4ade80' }}>{trafficData?.waClicks ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>Conversion</span>
            <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 26, color: Number(trafficData?.conversionRate) >= 3 ? '#4ade80' : '#fbbf24' }}>
              {trafficData ? `${trafficData.conversionRate}%` : '—'}
            </span>
            <span style={{ fontSize: 11, color: '#4b5563' }}>WA / store visit</span>
          </div>
        </div>

        {/* Top cars by views */}
        {trafficData?.topCars?.length > 0 && (
          <div>
            <p style={{ fontSize: 11, color: '#4b5563', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 8 }}>Top Viewed Cars</p>
            <div className="space-y-1.5">
              {trafficData.topCars.map((c, i) => (
                <div key={c.car_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 11, color: '#4b5563', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, color: '#e5e7eb', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.car_name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', flexShrink: 0 }}>{c.views} view{c.views !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {!trafficLoading && trafficData?.carViews === 0 && (
          <p style={{ fontSize: 12, color: '#4b5563' }}>No car views recorded in the last 30 days.</p>
        )}
      </SectionCard>

      {/* ── Section 3: Stock Health ───────────────────────────────────────── */}
      <SectionCard title="Stock Health" loading={stockLoading} skeletonRows={4}>
        {stockData && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="flex flex-col gap-0.5">
                <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>In Stock</span>
                <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, color: '#f8fafc' }}>{stockData.total}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>Avg Days</span>
                <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, color: '#f8fafc' }}>
                  {stockData.avgDays != null ? stockData.avgDays : '—'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>
                  Aged &gt;45d
                </span>
                <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, color: stockData.aged45.length > 0 ? '#fbbf24' : '#f8fafc' }}>
                  {stockData.aged45.length}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>
                  Aged &gt;60d
                </span>
                <span
                  className={stockData.aged60.length > 0 ? 'flex items-center gap-1' : ''}
                  style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, color: stockData.aged60.length > 0 ? '#f87171' : '#f8fafc' }}
                >
                  {stockData.aged60.length > 0 && (
                    <AlertCircle style={{ width: 14, height: 14, color: '#f87171', flexShrink: 0 }} />
                  )}
                  {stockData.aged60.length}
                </span>
              </div>
            </div>

            {/* Aged units table */}
            {stockData.aged45.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: '#4b5563', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 8 }}>
                  Units Aged &gt;45 Days
                </p>
                <div
                  className="rounded-lg overflow-hidden"
                  style={{ border: '1px solid rgba(255,255,255,0.055)' }}
                >
                  {/* Table header */}
                  <div
                    className="grid gap-2 px-3 py-2 hidden sm:grid"
                    style={{
                      gridTemplateColumns: '1fr 1fr 60px 90px 100px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    {['Brand', 'Model', 'Year', 'Days', 'Asking'].map((h) => (
                      <span key={h} style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>
                        {h}
                      </span>
                    ))}
                  </div>
                  {stockData.aged45.map((u) => {
                    const isOld60 = u.days > 60;
                    const borderColor = isOld60 ? '#ef4444' : '#f59e0b';
                    return (
                      <div
                        key={u.id}
                        // TODO: link to stock unit when detail view is available
                        className="grid gap-2 px-3 py-2.5 items-center"
                        style={{
                          gridTemplateColumns: '1fr 1fr 60px 90px 100px',
                          borderLeft: `3px solid ${borderColor}`,
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: 'transparent',
                          cursor: 'default',
                        }}
                      >
                        <span style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 500 }}>{u.brand || '—'}</span>
                        <span style={{ fontSize: 13, color: '#9ca3af' }}>{u.model || '—'}</span>
                        <span style={{ fontSize: 13, color: '#9ca3af' }}>{u.year || '—'}</span>
                        <span style={{ fontSize: 13, color: isOld60 ? '#f87171' : '#fbbf24', fontWeight: 600 }}>
                          <Clock style={{ width: 11, height: 11, display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                          {u.days}d
                        </span>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                          {u.asking_price ? fmtRM(u.asking_price) : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stockData.aged45.length === 0 && (
              <p style={{ fontSize: 13, color: '#4b5563', textAlign: 'center', padding: '12px 0' }}>
                No units aged over 45 days
              </p>
            )}
          </>
        )}
      </SectionCard>

      {/* ── Section 5: Add-on Revenue (MTD) ──────────────────────────────── */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Add-on Revenue (MTD)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <MetricCard
            label="Add-on Revenue MTD"
            value={addonData ? fmtRM(addonData.totalRevenue) : null}
            loading={addonLoading}
            icon={Package}
            accentColor="#a78bfa"
          />
          <MetricCard
            label="Avg per Deal"
            value={addonData ? (addonData.avgPerDeal != null ? fmtRM(addonData.avgPerDeal) : '—') : null}
            sub={addonData ? `${addonData.uniqueLeadCount} deal${addonData.uniqueLeadCount !== 1 ? 's' : ''} with add-ons` : null}
            loading={addonLoading}
            icon={TrendingUp}
            accentColor="#60a5fa"
          />
          <MetricCard
            label="Attachment Rate"
            value={addonData ? (addonData.attachRate != null ? `${addonData.attachRate}%` : '—') : null}
            sub="of won deals this month"
            loading={addonLoading}
            icon={Users}
            accentColor={addonData?.attachRate != null ? (addonData.attachRate >= 20 ? '#4ade80' : '#fbbf24') : '#6b7280'}
          />
        </div>

        {/* Top products pills */}
        {!addonLoading && addonData?.topProducts?.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.055)' }}
          >
            <span style={{ fontSize: 11, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Top Products:</span>
            {addonData.topProducts.map(([name, count]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full"
                style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', fontSize: 11, color: '#c4b5fd', fontWeight: 600 }}
              >
                {name} × {count}
              </span>
            ))}
          </div>
        )}
        {!addonLoading && (!addonData || addonData.topProducts?.length === 0) && (
          <p style={{ fontSize: 12, color: '#4b5563' }}>No add-ons recorded this month.</p>
        )}
      </div>
    </div>
  );
}
