import React from "react";
import { Car, BarChart2 } from "lucide-react";
import ChannelBreakdown from "../../components/ChannelBreakdown";

// Analytics tab — split out of SalesmanPremium.jsx (was `renderAnalytics`) so
// it lazy-loads instead of shipping in the initial bundle. Read-only tab, no
// setters. Body moved verbatim; only the wrapper (closure -> real component
// taking named props) and these imports are new.
export default function AnalyticsTab({
 carStatsMap, enquiries, thisMonthSales, commission, soldCount, myListings,
 channelMap, commissionDetails, isMobile,
}) {
  const Spark = ({ data, color }) => {
   if (!data || data.every(v => v === 0)) return <div style={{ height: 40 }} />;
   const max = Math.max(...data, 1);
   const w = 100, h = 40;
   const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 4 - ((v / max) * (h - 10)),
   ]);
   const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
   const area = `${line} L${w},${h} L0,${h} Z`;
   const uid = color.replace(/[^0-9a-f]/gi, "").slice(0, 6);
   return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 40, display: "block", marginTop: 10, overflow: "visible" }}>
     <defs>
      <linearGradient id={`ag${uid}`} x1="0" y1="0" x2="0" y2="1">
       <stop offset="0%" stopColor={color} stopOpacity="0.28" />
       <stop offset="100%" stopColor={color} stopOpacity="0.02" />
      </linearGradient>
     </defs>
     <path d={area} fill={`url(#ag${uid})`} />
     <path d={line} stroke={color} strokeWidth="2" fill="none" style={{ filter: `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 2px ${color})` }} />
     <circle cx={pts[pts.length - 1][0].toFixed(1)} cy={pts[pts.length - 1][1].toFixed(1)} r="2.5" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
   );
  };

  const bucket7 = (evts, type) => {
   const b = Array(7).fill(0);
   const now = Date.now();
   evts.forEach(e => {
    if (type && e.event_type !== type) return;
    const d = Math.floor((now - new Date(e.created_at).getTime()) / 86400000);
    if (d >= 0 && d < 7) b[6 - d]++;
   });
   return b;
  };

  const bucketArr7 = (arr) => {
   const b = Array(7).fill(0);
   const now = Date.now();
   (arr || []).forEach(e => {
    const d = Math.floor((now - new Date(e.created_at).getTime()) / 86400000);
    if (d >= 0 && d < 7) b[6 - d]++;
   });
   return b;
  };

  // Sum daily arrays from carStatsMap (d0=6daysAgo → d6=today)
  const viewsD = Array(7).fill(0).map((_, i) =>
    Object.values(carStatsMap).reduce((s, v) => s + (v.daily?.[i] || 0), 0)
  );
  const waD = Array(7).fill(0); // WA daily breakdown not available from RPC; show zeros
  const enqD = bucketArr7(enquiries);
  const totalViews = Object.values(carStatsMap).reduce((s, v) => s + (v.views     || 0), 0);
  const totalWA    = Object.values(carStatsMap).reduce((s, v) => s + (v.enquiries || 0), 0);
  const cvr = totalViews > 0 ? ((totalWA / totalViews) * 100).toFixed(1) : "0";
  const cvrNum = Number(cvr);
  const cvrColor = cvrNum >= 10 ? "#4ade80" : cvrNum >= 5 ? "#fbbf24" : "#f87171";
  const cvrD = viewsD.map((v, i) => v > 0 ? (waD[i] / v) * 100 : 0);

  const KPI = ({ label, value, data, color, sub }) => (
   <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px 12px", position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: `radial-gradient(ellipse at top left, ${color}18 0%, transparent 70%)`, pointerEvents: "none" }} />
    <p style={{ margin: 0, fontSize: 9, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>{label}</p>
    <p style={{ margin: "5px 0 0", fontSize: 34, fontFamily: "'Bebas Neue',sans-serif", color, lineHeight: 1 }}>{value}</p>
    {sub && <p style={{ margin: "2px 0 0", fontSize: 10, color: "#374151" }}>{sub}</p>}
    <Spark data={data} color={color} />
   </div>
  );

  return (
   <div>
    <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Performance Overview</p>

    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
     <KPI label="Listing Views" value={totalViews} data={viewsD} color="#93c5fd" sub="30-day total" />
     <KPI label="WA Taps" value={totalWA} data={waD} color="#4ade80" sub="30-day total" />
     <KPI label="CVR" value={`${cvr}%`} data={cvrD} color={cvrColor} sub="WA / Views" />
     <KPI label="Enquiries" value={enquiries.length} data={enqD} color="#c084fc" sub="All messages" />
     <KPI label="This Month" value={thisMonthSales} data={Array(7).fill(0)} color="#fbbf24" sub="Cars sold" />
     <KPI label="Commission" value={commission !== null ? `RM ${Number(commission).toLocaleString()}` : "—"} data={Array(7).fill(0)} color="#4ade80" sub="All time" />
    </div>

    <div style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 12, padding: "16px 20px", marginBottom: 16, display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center" }}>
     <div>
      <p style={{ margin: 0, fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>This Month</p>
      <p style={{ margin: "3px 0 0", fontSize: 40, fontFamily: "'Bebas Neue',sans-serif", color: "#fbbf24", lineHeight: 1 }}>{thisMonthSales} <span style={{ fontSize: 16, color: "#6b7280" }}>sold</span></p>
     </div>
     {commission !== null && (
      <div>
       <p style={{ margin: 0, fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>Total Commission</p>
       <p style={{ margin: "3px 0 0", fontSize: 40, fontFamily: "'Bebas Neue',sans-serif", color: "#4ade80", lineHeight: 1 }}>RM {Number(commission).toLocaleString()}</p>
      </div>
     )}
     <div>
      <p style={{ margin: 0, fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>All Time</p>
      <p style={{ margin: "3px 0 0", fontSize: 40, fontFamily: "'Bebas Neue',sans-serif", color: "#e5e7eb", lineHeight: 1 }}>{soldCount} <span style={{ fontSize: 16, color: "#6b7280" }}>cars</span></p>
     </div>
    </div>

    {myListings.length > 0 && (
     <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
       <BarChart2 size={13} color="#4b5563" />
       <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Listing Performance</p>
       <span style={{ fontSize: 9, marginLeft: "auto", color: "#374151" }}>All time</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 50px 50px 60px", padding: "6px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
       {["Car", "Views", "WA", "CVR"].map(h => (
        <p key={h} style={{ margin: 0, fontSize: 9, color: "#374151", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: h !== "Car" ? "center" : "left" }}>{h}</p>
       ))}
      </div>
      {myListings.length === 0 ? (
       <p style={{ margin: 0, padding: "20px 0", textAlign: "center", fontSize: 12, color: "#374151" }}>No listings yet.</p>
      ) : myListings.map(car => {
       const s = carStatsMap[car.id] ?? {};
       const v = s.views || 0;
       const w = s.enquiries || 0;
       const c = v > 0 ? ((w / v) * 100).toFixed(1) : null;
       const cc = c !== null ? (Number(c) >= 10 ? "#4ade80" : Number(c) >= 5 ? "#fbbf24" : "#f87171") : "#374151";
       return (
        <div key={car.id} style={{ display: "grid", gridTemplateColumns: "1fr 50px 50px 60px", padding: "9px 16px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
         <p style={{ margin: 0, fontSize: 11, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[car.year, car.brand, car.model].filter(Boolean).join(" ")}</p>
         <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#93c5fd", textAlign: "center" }}>{v}</p>
         <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#4ade80", textAlign: "center" }}>{w}</p>
         <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: cc, textAlign: "center" }}>{c !== null ? `${c}%` : "—"}</p>
        </div>
       );
      })}
     </div>
    )}

    {/* Traffic by platform — which channel (Instagram/Facebook/Direct/…) every
        listing's views and enquiries actually came from, summed across all cars. */}
    {Object.keys(channelMap).length > 0 && (
     <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px", marginBottom: 16 }}>
      <ChannelBreakdown rows={Object.values(channelMap).flat()} metric="views" title="Traffic by Platform" />
     </div>
    )}

    {commissionDetails.length > 0 && (
     <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
       <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Recent Sales</p>
      </div>
      {commissionDetails.map((c, i) => (
       <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
        <span style={{ fontSize: 12, color: "#e5e7eb" }}>{[c.year, c.brand, c.model].filter(Boolean).join(" ")}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>+RM {Number(c.commission_amount || 0).toLocaleString()}</span>
       </div>
      ))}
     </div>
    )}
   </div>
  );
}
