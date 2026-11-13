import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  DollarSign,
  Users,
  Package,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { usePersistentState } from '../hooks/usePersistentState';
import { useCarMoney } from "../hooks/useCarMoney";
import { GoalTracker, RevenueBreakdown } from "../components/reports/ReportSections";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtRM = (n) =>
  n == null
    ? "—"
    : `RM ${Number(n).toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const daysAgo = (iso) =>
  iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : null;

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

const thirtyDaysAgo = () => new Date(Date.now() - 30 * 86400000).toISOString();

// ─── Sub-components ───────────────────────────────────────────────────────────

function Skeleton({ h = "h-8", w = "w-full" }) {
  return (
    <div
      className={`${h} ${w} rounded-lg animate-pulse`}
      style={{ background: "#E5E7EB" }}
    />
  );
}

function MetricCard({
  label,
  value,
  sub,
  loading,
  accentColor = "#3b82f6",
  icon: Icon,
}) {
  return (
    <div
      className="relative flex flex-col gap-1.5 p-4 rounded-lg stat-card"
      style={{
        background: "#FFFFFF",
        border: "1px solid #EAECF0",
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          style={{
            fontSize: 12,
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: 600,
          }}
        >
          {label}
        </span>
        {Icon && (
          <span
            className="flex items-center justify-center w-6 h-6 rounded-md"
            style={{
              background: `${accentColor}18`,
              border: `1px solid ${accentColor}30`,
            }}
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
            letterSpacing: "0.04em",
            color: "#111827",
            lineHeight: 1,
          }}
        >
          {value ?? "—"}
        </span>
      )}
      {sub && !loading && (
        <span style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function SectionCard({ title, children, loading, skeletonRows = 2 }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "#FFFFFF",
        border: "1px solid #EAECF0",
      }}
    >
      {title && (
        <div
          className="px-5 py-3.5 flex items-center gap-2"
          style={{ borderBottom: "1px solid #EAECF0" }}
        >
          <span className="text-sm font-semibold" style={{ color: "#111827" }}>{title}</span>
        </div>
      )}
      <div className="p-4 sm:p-5" style={{ minHeight: `${skeletonRows * 40}px` }}>
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


function SourcePill({ source, count }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full"
      style={{
        background: "rgba(59,130,246,0.1)",
        border: "1px solid rgba(59,130,246,0.2)",
        fontSize: 11,
        color: "#93c5fd",
        fontWeight: 600,
      }}
    >
      {source}: {count}
    </span>
  );
}

function ResponseTimeDot({ minutes }) {
  if (minutes == null) return null;
  const color =
    minutes < 30 ? "#4ade80" : minutes < 120 ? "#fbbf24" : "#f87171";
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
        marginRight: 4,
      }}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
// Alerts used to live here too; they are on Overview now (the ONE "needs you" list).
export default function RevOpsPage({ userId }) {
  // ── Revenue data ────────────────────────────────────────────────────────────
  // Every section persists its last result, so the tab paints the numbers it
  // showed last time; "loading" only means "nothing to show yet" (usePersistentState).
  const ck = (name) => (userId ? `revops_${name}:${userId}` : null);
  const [revCounts, setRevData] = usePersistentState(ck('rev'), null);
  // ONE "gross this month": the same carPnl() sum Overview shows (useCarMoney).
  const { money } = useCarMoney(userId);
  const mo = money?.month;
  const revData = revCounts && mo ? {
    ...revCounts,
    revMTD: mo.revenue,
    gpMTD: mo.gross,
    carsGross: mo.carsGross,
    costedRevenue: mo.costedRevenue,
    leftOut: mo.leftOut,
    unitsSoldMTD: mo.units,
  } : null;
  const [revFetching, setRevLoading] = useState(true);
  const revLoading = revFetching && !revData;

  // ── Lead performance data ────────────────────────────────────────────────
  const [leadData, setLeadData] = usePersistentState(ck('lead'), null);
  const [leadFetching, setLeadLoading] = useState(true);
  const leadLoading = leadFetching && !leadData;
  const [salesmanScores, setSalesmanScores] = usePersistentState(ck('scores'), []);

  // ── Add-on revenue ───────────────────────────────────────────────────────
  const [addonData, setAddonData] = usePersistentState(ck('addon'), null);
  const [addonFetching, setAddonLoading] = useState(true);
  const addonLoading = addonFetching && !addonData;

  // ── Section 1: Revenue Overview ──────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      setRevLoading(true);

      // Revenue / gross / units this month come from useCarMoney (the same sum of carPnl()
      // as Overview), not here. These two counts are all this read still does.
      const [{ count: activeCount, error: stockErr }, { count: activeLeads, error: leadsCountErr }] = await Promise.all([
        // Active listings for stock turn
        supabase
          .from("car_listings")
          .select("id", { count: "exact", head: true })
          .eq("dealer_id", userId)
          .neq("status", "sold"),
        // Active leads (pipeline value proxy) — exclude every terminal stage variant
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("dealer_id", userId)
          .not("stage", "in", "(won,closed_won,lost,closed_lost)"),
      ]);
      // A failed read keeps the numbers already on screen (saved copy); writing
      // zeros here showed "RM 0 this month" whenever the database was slow.
      if (stockErr || leadsCountErr) { setRevLoading(false); return; }

      setRevData({
        activeLeads: activeLeads ?? 0,
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

      const { data: leads, error: leadsErr } = await supabase
        .from("leads")
        .select("id, stage, lead_source, created_at, first_response_at")
        .eq("dealer_id", userId)
        .gte("created_at", since);
      if (leadsErr) console.error("[RevOps] leads fetch error:", leadsErr.message);
      if (leadsErr) { setLeadLoading(false); return; } // keep the saved numbers

      const all = leads || [];
      const total = all.length;

      // Source breakdown — top 3
      const srcMap = {};
      all.forEach((l) => {
        const src = l.lead_source || "Unknown";
        srcMap[src] = (srcMap[src] || 0) + 1;
      });
      const topSources = Object.entries(srcMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      // Worked rate: share of leads contacted/progressed past the 'new' stage
      const advanced = all.filter((l) => l.stage && l.stage !== "new").length;
      const viewingRate =
        total > 0 ? Math.round((advanced / total) * 100) : null;

      // Avg response time — only if first_response_at column exists on any row
      let avgResponseMin = null;
      const responded = all.filter((l) => l.first_response_at && l.created_at);
      if (responded.length > 0) {
        const totalMin = responded.reduce((s, l) => {
          const diff =
            (new Date(l.first_response_at) - new Date(l.created_at)) / 60000;
          return s + diff;
        }, 0);
        avgResponseMin = Math.round(totalMin / responded.length);
      }

      setLeadData({ total, topSources, viewingRate, avgResponseMin });

      const { data: scores, error: scoresErr } = await supabase.rpc('gm_salesman_scores', { p_dealer_id: userId });
      if (scoresErr) console.error("[RevOps] gm_salesman_scores error:", scoresErr.message);
      else setSalesmanScores(
        (scores || [])
          .filter(s => s.avg_response_min != null)
          .sort((a, b) => a.avg_response_min - b.avg_response_min)
      );

      setLeadLoading(false);
    };
    fetch();
  }, [userId]);

  // ── Section 3: Add-on Revenue ────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      setAddonLoading(true);
      const monthStart = startOfMonth();

      // Add-ons on deals WON this month — tie revenue to the deal's close date
      // (leads.updated_at when it flipped to won), not when the add-on row was
      // created, so add-ons attached before the close still count for sold cars.
      const { data: addonRows, error: addonErr } = await supabase
        .from("deal_products")
        .select("id, sold_price, lead_id, product_id, dealer_products(name), leads!inner(stage, updated_at)")
        .eq("dealer_id", userId)
        .in("leads.stage", ["won", "closed_won"])
        .gte("leads.updated_at", monthStart);
      if (addonErr) console.error("[RevOps] deal_products fetch error:", addonErr.message);
      if (addonErr) { setAddonLoading(false); return; } // keep the saved numbers

      // Won leads this month (for attachment rate denominator) — both won variants
      const { count: wonCount } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("dealer_id", userId)
        .in("stage", ["won", "closed_won"])
        .gte("updated_at", monthStart);

      const rows = addonRows || [];
      const totalRevenue = rows.reduce((s, r) => s + (Number(r.sold_price) || 0), 0);
      const uniqueLeads = new Set(
        rows.filter((r) => r.lead_id).map((r) => r.lead_id),
      );
      // avg per deal: divide revenue from lead-linked add-ons by the number of those
      // leads, so numerator and denominator cover the same rows
      const leadLinkedRevenue = rows
        .filter((r) => r.lead_id)
        .reduce((s, r) => s + (Number(r.sold_price) || 0), 0);
      const avgPerDeal =
        uniqueLeads.size > 0
          ? Math.round(leadLinkedRevenue / uniqueLeads.size)
          : null;
      const attachRate =
        wonCount > 0 ? Math.round((uniqueLeads.size / wonCount) * 100) : null;

      // Top 3 products by count
      const productCount = {};
      rows.forEach((r) => {
        const name = r.dealer_products?.name || "Unknown";
        productCount[name] = (productCount[name] || 0) + 1;
      });
      const topProducts = Object.entries(productCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      setAddonData({
        totalRevenue,
        avgPerDeal,
        attachRate,
        topProducts,
        uniqueLeadCount: uniqueLeads.size,
      });
      setAddonLoading(false);
    };
    fetch();
  }, [userId]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="w-full space-y-6"
      style={{ fontFamily: "system-ui,sans-serif" }}
    >
      {/* Header */}
      <div>
        <h1
          style={{
            fontFamily: "'Bebas Neue',cursive",
            fontSize: 32,
            letterSpacing: "0.06em",
            color: "#111827",
            lineHeight: 1,
          }}
        >
          Revenue
        </h1>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
          Sales, gross and add-on revenue
        </p>
      </div>

      {/* ── Section 1: Revenue Overview ──────────────────────────────────── */}
      {/* No "Revenue Overview" label: the page heading already says Revenue. */}
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Total Revenue This Month"
            value={revData ? fmtRM(revData.revMTD + (addonData?.totalRevenue || 0)) : null}
            sub="cars + add-ons & F&I"
            loading={revLoading || addonLoading}
            icon={DollarSign}
            accentColor="#4ade80"
          />
          <MetricCard
            label="Gross Profit This Month"
            value={revData ? fmtRM(revData.gpMTD) : null}
            sub={revData?.leftOut > 0 ? `${revData.leftOut} sold car${revData.leftOut === 1 ? '' : 's'} left out, no buy price` : "cars + add-ons, every cost counted"}
            loading={revLoading || !mo}
            icon={TrendingUp}
            accentColor="#34d399"
          />
          <MetricCard
            label="Active Leads"
            value={revData ? String(revData.activeLeads) : null}
            sub="Open pipeline · all time"
            loading={revLoading}
            icon={Users}
            accentColor="#60a5fa"
          />
          <MetricCard
            label="Stock Turn (MTD)"
            value={
              revData
                ? `${revData.unitsSoldMTD} / ${revData.activeCount}`
                : null
            }
            sub="sold this month / active"
            loading={revLoading}
            icon={Package}
            accentColor="#a78bfa"
          />
        </div>

        {/* What makes up the total — always visible under the headline so the
            contributors are readable without scrolling to the add-on section */}
        {revData && !addonLoading && (() => {
          const vehicleRev = revData.revMTD;
          const addonRev = addonData?.totalRevenue || 0;
          const totalRev = vehicleRev + addonRev;
          const addonPct = totalRev > 0 ? Math.round((addonRev / totalRev) * 100) : 0;
          const marginPct = revData.costedRevenue > 0 ? Math.round((revData.carsGross / revData.costedRevenue) * 100) : 0;
          return (
            <div
              className="grid grid-cols-3 gap-3 mt-3"
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "12px 16px",
              }}
            >
              <div className="flex flex-col gap-0.5" style={{ minWidth: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Vehicle Sales
                </span>
                <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, color: "#111827", lineHeight: 1.1 }}>
                  {fmtRM(vehicleRev)}
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>
                  {revData.unitsSoldMTD} unit{revData.unitsSoldMTD === 1 ? "" : "s"} sold
                </span>
              </div>
              <div className="flex flex-col gap-0.5" style={{ minWidth: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Add-ons & F&I
                </span>
                <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, color: "#111827", lineHeight: 1.1 }}>
                  {fmtRM(addonRev)}
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>
                  {addonPct}% of total revenue
                </span>
              </div>
              <div className="flex flex-col gap-0.5" style={{ minWidth: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Vehicle Margin
                </span>
                <span style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 22, color: "#111827", lineHeight: 1.1 }}>
                  {marginPct}%
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>
                  {fmtRM(revData.carsGross)} on the cars{revData.leftOut > 0 ? ` · ${revData.leftOut} left out, no buy price` : ''}
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Section 2: Lead Performance ──────────────────────────────────── */}
      <SectionCard
        title="Lead Performance (30d)"
        loading={leadLoading}
        skeletonRows={3}
      >
        <div className="grid grid-cols-2 gap-4">
          {/* Total Leads */}
          <div className="flex flex-col gap-1">
            <span
              style={{
                fontSize: 11,
                color: "#6b7280",
                textTransform: "uppercase",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              Total Leads
            </span>
            <span
              style={{
                fontFamily: "'Bebas Neue',cursive",
                fontSize: 26,
                color: "#111827",
              }}
            >
              {leadData?.total ?? "—"}
            </span>
          </div>

          {/* Lead → Viewing Rate */}
          <div className="flex flex-col gap-1">
            <span
              style={{
                fontSize: 11,
                color: "#6b7280",
                textTransform: "uppercase",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              Worked Rate
            </span>
            <span
              style={{
                fontFamily: "'Bebas Neue',cursive",
                fontSize: 26,
                color: "#111827",
              }}
            >
              {leadData?.viewingRate != null ? `${leadData.viewingRate}%` : "—"}
            </span>
            <span style={{ fontSize: 11, color: "#4b5563" }}>
              contacted past new
            </span>
          </div>

          {/* By Source */}
          <div className="flex flex-col gap-2">
            <span
              style={{
                fontSize: 11,
                color: "#6b7280",
                textTransform: "uppercase",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              Top Sources
            </span>
            <div className="flex flex-wrap gap-1.5">
              {leadData?.topSources?.length > 0 ? (
                leadData.topSources.map(([src, cnt]) => (
                  <SourcePill key={src} source={src} count={cnt} />
                ))
              ) : (
                <span style={{ fontSize: 12, color: "#4b5563" }}>No data</span>
              )}
            </div>
          </div>

          {/* Avg Response Time */}
          <div className="flex flex-col gap-1">
            <span
              style={{
                fontSize: 11,
                color: "#6b7280",
                textTransform: "uppercase",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              Avg Response
            </span>
            {leadData?.avgResponseMin != null ? (
              <>
                <div className="flex items-center gap-1">
                  <ResponseTimeDot minutes={leadData.avgResponseMin} />
                  <span
                    style={{
                      fontFamily: "'Bebas Neue',cursive",
                      fontSize: 26,
                      color: "#111827",
                    }}
                  >
                    {leadData.avgResponseMin}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      alignSelf: "flex-end",
                      paddingBottom: 3,
                    }}
                  >
                    min avg
                  </span>
                </div>
              </>
            ) : (
              <span style={{ fontSize: 12, color: "#4b5563" }}>
                No data
              </span>
            )}
          </div>
        </div>

        {salesmanScores.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>
              Response Time by Salesman
            </span>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {salesmanScores.map(s => {
                const mins = s.avg_response_min;
                const label = mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins}m`;
                const color = mins > 120 ? '#dc2626' : mins > 30 ? '#d97706' : '#16a34a';
                // bar width relative to the slowest responder in the set, not a magic constant
                const maxMins = Math.max(...salesmanScores.map(x => x.avg_response_min || 0), 1);
                const pct = Math.min(100, Math.round((mins / maxMins) * 100));
                return (
                  <div key={s.salesman_id || s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: '#374151', width: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name || '—'}
                    </span>
                    <div style={{ flex: 1, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: color }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 36, textAlign: 'right' }}>
                      {label}
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 60, textAlign: 'right' }}>
                      {s.leads_30d} leads
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>



      {/* ── Section 5: Add-on Revenue (MTD) ──────────────────────────────── */}
      <div>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#4b5563",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          Add-on Revenue This Month
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <MetricCard
            label="Add-on Revenue This Month"
            value={addonData ? fmtRM(addonData.totalRevenue) : null}
            loading={addonLoading}
            icon={Package}
            accentColor="#a78bfa"
          />
          <MetricCard
            label="Avg per Deal"
            value={
              addonData
                ? addonData.avgPerDeal != null
                  ? fmtRM(addonData.avgPerDeal)
                  : "—"
                : null
            }
            sub={
              addonData
                ? `${addonData.uniqueLeadCount} deal${addonData.uniqueLeadCount !== 1 ? "s" : ""} with add-ons`
                : null
            }
            loading={addonLoading}
            icon={TrendingUp}
            accentColor="#60a5fa"
          />
          <MetricCard
            label="% Deals With Add-ons"
            value={
              addonData
                ? addonData.attachRate != null
                  ? `${addonData.attachRate}%`
                  : "—"
                : null
            }
            sub="of won deals this month"
            loading={addonLoading}
            icon={Users}
            accentColor={
              addonData?.attachRate != null
                ? addonData.attachRate >= 20
                  ? "#4ade80"
                  : "#fbbf24"
                : "#6b7280"
            }
          />
        </div>

        {/* Top products pills */}
        {!addonLoading && addonData?.topProducts?.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-lg"
            style={{
              background: "#F7F8FA",
              border: "1px solid #EAECF0",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "#4b5563",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginRight: 4,
              }}
            >
              Top Products:
            </span>
            {addonData.topProducts.map(([name, count]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full"
                style={{
                  background: "rgba(167,139,250,0.1)",
                  border: "1px solid rgba(167,139,250,0.2)",
                  fontSize: 11,
                  color: "#c4b5fd",
                  fontWeight: 600,
                }}
              >
                {name} × {count}
              </span>
            ))}
          </div>
        )}
        {!addonLoading &&
          (!addonData || addonData.topProducts?.length === 0) && (
            <p style={{ fontSize: 12, color: "#4b5563" }}>
              No add-ons recorded this month.
            </p>
          )}
      </div>

      {/* ── Monthly targets + what drove revenue (moved from GM Oversight) ── */}
      <div>
        <p style={RO_LABEL}>Monthly Targets</p>
        <GoalTracker
          dealerId={userId}
          mtdRevenue={revData?.revMTD || 0}
          mtdProfit={revData?.gpMTD || 0}
          mtdUnits={revData?.unitsSoldMTD || 0}
        />
      </div>
      <div>
        <p style={RO_LABEL}>What Drove Revenue</p>
        <RevenueBreakdown dealerId={userId} />
      </div>
    </div>
  );
}

const RO_LABEL = { fontSize: 11, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" };
