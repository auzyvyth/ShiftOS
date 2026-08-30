import React from "react";
import { BarChart2, Plus, TrendingUp } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { panel as C, panelType as T, panelRadius as R } from "../../theme/tokens";
import ChannelBreakdown from "../../components/ChannelBreakdown";
import { CARD, CARD_HEADER, EYEBROW, STAT, SOFT } from "./shared";

// Analytics tab.
//
// Rebuilt off the shared panel tokens. It used to hardcode its own palette
// (#0d1117 cards, and #93c5fd / #4ade80 / #c084fc / #fbbf24 / #f87171 all live
// at once) so it was the one Premium tab that didn't look like the rest of the
// dashboard — six saturated hues stacked in one grid, which is exactly what the
// anti-slop rule in CLAUDE.md forbids. Colour now means something in only two
// places: money earned, and whether a conversion rate is good.
//
// Two other things were removed rather than restyled:
//   - The amber "This Month / Total Commission / All Time" band repeated three
//     figures the KPI grid above it already showed. Same numbers twice on one
//     screen is not emphasis, it's clutter.
//   - The WA-taps and CVR sparklines could never draw anything. `waD` is
//     hardcoded to zeros (the analytics RPC returns no daily WA breakdown) and
//     CVR is derived from it, so both were permanently blank 40px gaps. A chart
//     with no data source behind it is worse than a plain number, so they are
//     plain numbers now. Give the RPC a daily WA series and they can come back.
export default function AnalyticsTab({
 carStatsMap, enquiries, thisMonthSales, commission, soldCount, myListings,
 channelMap, commissionDetails, isMobile, onAddListing,
}) {
  // Area chart with a gradient fill, same shape as the Dashboard tab's traffic
  // and commission charts, so the two tabs read as one product. The old version
  // was a hand-rolled SVG polyline with a neon drop-shadow on a 40px canvas —
  // at that height the glow was most of what you saw.
  // `id` must be unique per rendered chart: several metrics share one hue, and
  // two <linearGradient> defs with the same id is a duplicate DOM id.
  const Spark = ({ data, hue, id }) => {
    const rows = (data || []).map((v, i) => ({ i, v }));
    if (!rows.length || rows.every((r) => r.v === 0)) {
      return <div style={{ height: 46, marginTop: 8 }} />;
    }
    const gid = `sparkFill-${id}`;
    return (
      <div style={{ height: 46, margin: "8px -4px -4px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={hue} stopOpacity={0.28} />
                <stop offset="100%" stopColor={hue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone" dataKey="v" stroke={hue} strokeWidth={1.75}
              fill={`url(#${gid})`} dot={false} isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const bucketArr7 = (arr) => {
    const b = Array(7).fill(0);
    const now = Date.now();
    (arr || []).forEach((e) => {
      const d = Math.floor((now - new Date(e.created_at).getTime()) / 86400000);
      if (d >= 0 && d < 7) b[6 - d] += 1;
    });
    return b;
  };

  // Daily views summed across every car (d0 = 6 days ago → d6 = today).
  const viewsD = Array(7).fill(0).map((_, i) =>
    Object.values(carStatsMap).reduce((s, v) => s + (v.daily?.[i] || 0), 0),
  );
  const enqD = bucketArr7(enquiries);
  const totalViews = Object.values(carStatsMap).reduce((s, v) => s + (v.views || 0), 0);
  const totalWA = Object.values(carStatsMap).reduce((s, v) => s + (v.enquiries || 0), 0);
  const cvrNum = totalViews > 0 ? (totalWA / totalViews) * 100 : 0;
  const cvr = totalViews > 0 ? cvrNum.toFixed(1) : null;

  // The one place a traffic number is allowed a colour: it's a verdict, not a
  // category. Below 5% of viewers tapping through is a listing problem.
  const cvrHue = cvrNum >= 10 ? C.success : cvrNum >= 5 ? C.warn : C.danger;
  const cvrLabel = cvrNum >= 10 ? "Strong" : cvrNum >= 5 ? "Fair" : "Low";

  const money = (n) => `RM ${Number(n || 0).toLocaleString("en-MY")}`;

  // Traffic metrics share ONE hue because they are one family. Distinguishing
  // them by colour would be decoration — the label already does that job.
  const TRAFFIC_HUE = C.info;

  const Metric = ({ label, value, sub, data, hue, badge, id }) => (
    <div style={{ ...CARD, padding: "14px 16px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={EYEBROW}>{label}</span>
        {badge}
      </div>
      <p style={{ ...STAT, margin: "6px 0 0", fontSize: T.size.statLg }}>{value}</p>
      {sub && <p style={{ margin: "3px 0 0", fontSize: T.size.sm, color: C.textMuted }}>{sub}</p>}
      {data && <Spark data={data} hue={hue || TRAFFIC_HUE} id={id} />}
    </div>
  );

  const hasListings = myListings.length > 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: T.size.xl, fontWeight: T.weight.bold, color: C.text, letterSpacing: T.track.tight }}>
          Performance
        </p>
        <span style={{ fontSize: T.size.sm, color: C.textMuted }}>Charts show the last 7 days</span>
      </div>

      {/* Sales first — it is the number the rep actually came for. One card, so
          the three figures read as one story instead of three competing tiles. */}
      <div style={{ ...CARD, padding: isMobile ? "16px" : "18px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: isMobile ? 20 : 40, flexWrap: "wrap" }}>
          <div>
            <p style={{ ...EYEBROW, margin: 0 }}>This month</p>
            <p style={{ ...STAT, margin: "5px 0 0", fontSize: T.size.hero }}>
              {thisMonthSales}
              <span style={{ fontSize: T.size.base, fontWeight: T.weight.normal, color: C.textMuted, marginLeft: 6 }}>sold</span>
            </p>
          </div>
          <div>
            <p style={{ ...EYEBROW, margin: 0 }}>Commission earned</p>
            <p style={{ ...STAT, margin: "5px 0 0", fontSize: T.size.hero, color: commission ? C.successText : C.text }}>
              {commission !== null ? money(commission) : "—"}
            </p>
          </div>
          <div>
            <p style={{ ...EYEBROW, margin: 0 }}>All time</p>
            <p style={{ ...STAT, margin: "5px 0 0", fontSize: T.size.hero }}>
              {soldCount}
              <span style={{ fontSize: T.size.base, fontWeight: T.weight.normal, color: C.textMuted, marginLeft: 6 }}>cars</span>
            </p>
          </div>
        </div>
      </div>

      {/* Traffic */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
        <Metric label="Listing views" value={totalViews} sub="All time" data={viewsD} id="views" />
        <Metric label="WhatsApp taps" value={totalWA} sub="All time" />
        <Metric
          label="Tap-through"
          value={cvr !== null ? `${cvr}%` : "—"}
          sub="Taps per view"
          badge={cvr !== null && (
            <span style={{ ...SOFT(cvrHue), fontSize: T.size.xs, fontWeight: T.weight.bold, padding: "2px 7px", borderRadius: R.pill }}>
              {cvrLabel}
            </span>
          )}
        />
        <Metric label="Enquiries" value={enquiries.length} sub="All messages" data={enqD} id="enq" />
      </div>

      {/* Nothing listed yet — every number above is a zero and no chart can
          have anything in it. Say the one thing that changes that. */}
      {!hasListings && (
        <div style={{ ...CARD, padding: "22px 20px", marginBottom: 12, textAlign: "center" }}>
          <TrendingUp size={20} color={C.textMuted} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text }}>
            No traffic to report yet
          </p>
          <p style={{ margin: "4px 0 0", fontSize: T.size.sm, color: C.textMuted, lineHeight: 1.5 }}>
            List your stock and this page fills in on its own — views, tap-through and where buyers came from.
          </p>
          {onAddListing && (
            <button
              onClick={onAddListing}
              style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, fontSize: T.size.base, fontWeight: T.weight.bold, padding: "9px 16px", borderRadius: R.md, background: C.accent, border: "none", color: C.onAccent, cursor: "pointer", fontFamily: "system-ui,sans-serif" }}
            >
              <Plus size={14} /> Add a listing
            </button>
          )}
        </div>
      )}

      {hasListings && (
        <div style={{ ...CARD, marginBottom: 12 }}>
          <div style={CARD_HEADER}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <BarChart2 size={13} /> Listing performance
            </span>
            <span style={{ fontSize: T.size.xs, fontWeight: T.weight.normal, letterSpacing: 0, textTransform: "none", color: C.textDim }}>
              All time
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 54px 54px 62px", padding: "8px 18px", borderBottom: `1px solid ${C.line}` }}>
            {["Car", "Views", "Taps", "Rate"].map((h) => (
              <p key={h} style={{ ...EYEBROW, margin: 0, textAlign: h === "Car" ? "left" : "center" }}>{h}</p>
            ))}
          </div>
          {myListings.map((car, idx) => {
            const s = carStatsMap[car.id] ?? {};
            const v = s.views || 0;
            const w = s.enquiries || 0;
            const rate = v > 0 ? (w / v) * 100 : null;
            const rateHue = rate === null ? C.textDim : rate >= 10 ? C.successText : rate >= 5 ? C.warnText : C.dangerText;
            return (
              <div
                key={car.id}
                style={{ display: "grid", gridTemplateColumns: "1fr 54px 54px 62px", padding: "10px 18px", alignItems: "center", borderBottom: idx < myListings.length - 1 ? `1px solid ${C.line}` : "none" }}
              >
                <p style={{ margin: 0, fontSize: T.size.base, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[car.year, car.brand, car.model].filter(Boolean).join(" ")}
                </p>
                <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, textAlign: "center" }}>{v}</p>
                <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, textAlign: "center" }}>{w}</p>
                <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: rateHue, textAlign: "center" }}>
                  {rate !== null ? `${rate.toFixed(1)}%` : "—"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Where the views and enquiries actually came from, summed across cars. */}
      {Object.keys(channelMap).length > 0 && (
        <div style={{ ...CARD, padding: 16, marginBottom: 12 }}>
          <ChannelBreakdown rows={Object.values(channelMap).flat()} metric="views" title="Traffic by platform" />
        </div>
      )}

      {commissionDetails.length > 0 && (
        <div style={CARD}>
          <div style={CARD_HEADER}><span>Recent sales</span></div>
          {commissionDetails.map((c, i) => (
            <div
              key={i}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: i < commissionDetails.length - 1 ? `1px solid ${C.line}` : "none" }}
            >
              <span style={{ fontSize: T.size.base, color: C.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {[c.year, c.brand, c.model].filter(Boolean).join(" ")}
              </span>
              <span style={{ flexShrink: 0, fontSize: T.size.base, fontWeight: T.weight.bold, color: C.successText }}>
                +{money(c.commission_amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
