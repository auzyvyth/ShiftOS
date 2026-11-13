import { useEffect, useState, useRef, useMemo } from "react";
import { cdnImg, imgFallback } from "../../utils/img";
import { supabase } from "../../supabaseClient";
import { callClaudeChat } from "../../lib/callClaude";
import { getDealerIdFromProfile } from "../../hooks/useProfile";
import { usePermissions } from "../../hooks/usePermissions";
import { T, getListingAge } from "./shared";
import { AgeBadge, Sparkline } from "./widgets";
import { getListingGaps } from "../../utils/listingCompleteness";
import { Car, Clock, Send, Bot, ChevronRight, AlertCircle, CheckCircle2, Search, Download } from "lucide-react";

// ─── AnalyticsTab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ listings, profile, salesmen = [], onEditListing, onSelectListing, onStaleAdjusted, adjustedStaleIds }) {
  const { can } = usePermissions(profile);
  // SF-2b: map reserved_by -> salesman first name for the Reserved badge sub-label
  // (dealer-only surface; never exposed to public storefront visitors).
  const salesmanFirstName = (id) => {
    if (!id) return null;
    const full = salesmen.find((s) => s.id === id)?.full_name;
    return full ? full.split(' ')[0] : null;
  };
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hi! I'm your performance advisor. I can see your inventory and help with pricing, leads, and conversions. What would you like to know?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const endRef = useRef(null);
  useEffect(() => {
    if (chatOpen) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  const [carStatsRows, setCarStatsRows] = useState([]);
  const [slugStatsRows, setSlugStatsRows] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [lpSearch, setLpSearch] = useState('');
  const [lpVisible, setLpVisible] = useState(20);
  useEffect(() => {
    if (!profile?.id) return;
    const dealerId = getDealerIdFromProfile(profile);
    if (!dealerId) return;
    Promise.all([
      supabase.rpc("get_dealer_car_analytics", { p_dealer_id: dealerId }),
      supabase.rpc("get_dealer_slug_analytics", { p_dealer_id: dealerId }),
    ]).then(([carRes, slugRes]) => {
      setCarStatsRows(carRes.data || []);
      setSlugStatsRows(slugRes.data || []);
      setEventsLoading(false);
    });
  }, [profile?.id]);

  const carStatsMap = useMemo(() => {
    const map = {};
    carStatsRows.forEach(r => {
      const views = Number(r.views) || 0;
      const wa = Number(r.whatsapp) || 0;
      const calls = Number(r.calls) || 0;
      map[r.car_id] = {
        views,
        whatsapp: wa,
        calls,
        bookings: Number(r.bookings) || 0,
        cvr: views > 0 ? (((wa + calls) / views) * 100).toFixed(1) + '%' : '—',
      };
    });
    return map;
  }, [carStatsRows]);

  const bySlug = useMemo(() => {
    const acc = {};
    slugStatsRows.forEach(r => {
      if (r.slug) acc[r.slug] = { clicks: Number(r.clicks) || 0, whatsapp: Number(r.whatsapp) || 0 };
    });
    return acc;
  }, [slugStatsRows]);

  const dealerSlugs = new Set(salesmen.map(s => s.slug).filter(Boolean));
  const topSalesmen = Object.entries(bySlug)
    .filter(([slug]) => slug && slug.trim() && (dealerSlugs.size === 0 || dealerSlugs.has(slug)))
    .sort((a, b) => b[1].whatsapp - a[1].whatsapp);

  const total = listings.length;
  const active = listings.filter(
    (l) => (l.status || 'available') === 'available',
  ).length;
  const sold = listings.filter((l) => l.status === "sold").length;
  const hot = listings.filter((l) => {
    const op = l.original_price,
      sp = l.selling_price;
    return op && sp && sp <= op * 0.97;
  }).length;
  const avgAge = total
    ? Math.round(
        listings.reduce((s, l) => s + getListingAge(l.created_at), 0) / total,
      )
    : 0;
  const stale = listings.filter(
    (l) =>
      getListingAge(l.created_at) >= 30 && (l.status || 'available') === 'available',
  );

  // A listing is "incomplete" when it's missing info a buyer needs to trust
  // it. Bulk/AI import leaves several of these blank, so these are the cars
  // to finish before they can actually sell. Sold cars are excluded.
  // (Shared with the Inventory tab badge and CarForm's publish gate — see
  // utils/listingCompleteness.js — so "complete" means the same thing everywhere.)
  const listingGaps = getListingGaps;
  const incomplete = listings.filter(
    (l) => (l.status || 'available') !== 'sold' && listingGaps(l).length > 0,
  );

  const exportAnalyticsCSV = () => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const toCSV = (rows) => rows.map(r => r.map(esc).join(',')).join('\n');

    // Sheet 1: Listing performance
    const listingMap = {};
    listings.forEach(l => { listingMap[l.slug] = l; });
    const lpHeader = ['Brand','Model','Year','Plate','Status','Selling Price (RM)','Days Listed','Views','WhatsApp','Calls','Bookings'];
    const lpRows = carStatsRows.map(r => {
      const l = listings.find(li => li.id === r.car_id) || {};
      return [l.brand||'', l.model||'', l.year||'', l.plate_number||'', l.status||'available', l.selling_price||0, getListingAge(l.created_at), r.views||0, r.whatsapp||0, r.calls||0, r.bookings||0];
    });
    const lpCSV = toCSV([lpHeader, ...lpRows]);

    // Sheet 2: Salesman leaderboard
    const slHeader = ['Salesman Slug','WhatsApp Contacts','Listing Clicks'];
    const slRows = topSalesmen.map(([slug, d]) => [slug, d.whatsapp, d.clicks]);
    const slCSV = toCSV([slHeader, ...slRows]);

    const date = new Date().toISOString().slice(0,10);
    const full = `LISTING PERFORMANCE — ${date}\n${lpCSV}\n\n\nSALESMAN LEADERBOARD — ${date}\n${slCSV}`;
    const blob = new Blob([full], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `analytics-${date}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const ctx = () => {
    const s = listings
      .slice(0, 20)
      .map(
        (l) =>
          `${l.brand} ${l.model}|RM${l.selling_price?.toLocaleString()}|${getListingAge(l.created_at)}d|${l.status || "available"}|${l.condition}|${l.mileage ? l.mileage.toLocaleString() + "km" : "-"}|${l.state || "-"}${l.original_price ? `|was RM${l.original_price.toLocaleString()}` : ""}`,
      )
      .join("\n");
    return `AI performance advisor for ShiftOS, Malaysian car dealer SaaS.\nDealer: ${profile?.dealership || "Unknown"}. Total:${total} Active:${active} Sold:${sold} HotDeals:${hot} AvgAge:${avgAge}d Stale:${stale.length}\nListings:\n${s}\nBe concise, actionable. Under 200 words.`;
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages((p) => [...p, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const history = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: msg },
      ];
      const reply = await callClaudeChat(history, ctx(), "sales_manager");
      setMessages((p) => [...p, { role: "assistant", content: reply }]);
    } catch {
      setMessages((p) => [
        ...p,
        { role: "assistant", content: "Connection error. Try again." },
      ]);
    }
    setLoading(false);
  };

  const PROMPTS = [
    "Why aren't my listings converting?",
    "Which car should I reprice?",
    "Any I should remove?",
    "How to write better listings?",
  ];
  // Last 14 days of sold units, bucketed by day, for the Sold KPI sparkline.
  const soldSpark = useMemo(() => {
    const buckets = Array(14).fill(0);
    const now = new Date();
    listings.forEach((l) => {
      if (l.status !== 'sold' || !l.sold_at) return;
      const days = Math.floor((now - new Date(l.sold_at)) / 86_400_000);
      if (days >= 0 && days < 14) buckets[13 - days] += 1;
    });
    return buckets;
  }, [listings]);

  const kpis = [
    {
      label: "Active",
      val: active,
      sub: `of ${total} total`,
      grad: "grad-cyan",
      icon: <Car className="w-4 h-4" />,
      glow: "rgba(103,232,249,0.14)",
    },
    {
      label: "Sold",
      val: sold,
      sub: "all time",
      grad: "grad-green",
      icon: <CheckCircle2 className="w-4 h-4" />,
      glow: "rgba(110,231,183,0.14)",
      spark: soldSpark,
      sparkColor: '#34d399',
    },
    {
      label: "Avg. Age",
      val: `${avgAge}d`,
      sub: avgAge >= 30 ? "⚠ Aging" : "Healthy",
      grad: avgAge >= 30 ? "grad-gold" : "grad-white",
      icon: <Clock className="w-4 h-4" />,
      glow: avgAge >= 30 ? "rgba(251,191,36,0.08)" : "transparent",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {kpis.map(({ label, val, sub, grad, icon, glow, spark, sparkColor }) => (
          <div
            key={label}
            className="stat-card card-top rounded-2xl overflow-hidden glass"
            style={{ position: 'relative' }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 100% 0%, rgba(59,130,246,0.05) 0%, transparent 55%)`,
              }}
            />
            {spark && (
              <div className="relative px-3.5 pt-3">
                <Sparkline data={spark} color={sparkColor || '#3b82f6'} width={120} height={32} />
              </div>
            )}
            <div className={spark ? 'p-3 sm:p-4 pt-2 relative' : 'p-3 sm:p-4 relative'}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-500 text-xs font-medium tracking-widest uppercase">
                  {label}
                </p>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: glow, boxShadow: `0 0 12px ${glow}` }}
                >
                  {icon}
                </div>
              </div>
              <p
                className={`text-xl sm:text-3xl font-black leading-none tabular-nums ${grad || "text-gray-900"}`}
              >
                {val}
              </p>
              <p className="text-xs text-gray-700 mt-1.5 hidden sm:block">
                {sub}
              </p>
            </div>
          </div>
        ))}
      </div>
      {(() => {
        const visibleStale = stale.filter(l => !(adjustedStaleIds || new Set()).has(l.id));
        const adjustedStale = stale.filter(l => (adjustedStaleIds || new Set()).has(l.id));
        return (
          <>
            {incomplete.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: "rgba(239,68,68,0.04)",
                  border: "1px solid rgba(239,68,68,0.14)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <p className="text-red-700 text-sm font-semibold">
                    {incomplete.length} listing{incomplete.length > 1 ? "s" : ""} incomplete — missing key info buyers need to see
                  </p>
                </div>
                <div className="space-y-2">
                  {incomplete.slice(0, 8).map((l) => {
                    const gaps = listingGaps(l);
                    return (
                      <div
                        key={l.id}
                        className="flex items-center justify-between py-2 gap-3"
                        style={{ borderBottom: "1px solid rgba(239,68,68,0.08)" }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {l.images?.[0] ? (
                            <img src={cdnImg(l.images[0], 64, 70)} onError={imgFallback(l.images[0])} alt="" loading="lazy" decoding="async" className="w-8 h-8 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-gray-900 text-sm font-medium truncate">
                              {l.brand} {l.model} {l.year || ""}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {gaps.map((g) => (
                                <span key={g} className="text-red-700 text-[10px] font-semibold bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                                  No {g}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        {onEditListing && (
                          <button
                            onClick={() => onEditListing(l)}
                            className="text-xs font-semibold px-3 py-1 rounded-lg transition-all flex-shrink-0"
                            style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: "#dc2626" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.2)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(220,38,38,0.1)"; }}
                          >
                            Finish
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {incomplete.length > 8 && (
                    <p className="text-xs text-gray-500 pt-1">+{incomplete.length - 8} more incomplete</p>
                  )}
                </div>
              </div>
            )}
            {visibleStale.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: "rgba(251,191,36,0.04)",
                  border: "1px solid rgba(251,191,36,0.12)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <p className="text-amber-700 text-sm font-semibold">
                    {visibleStale.length} listing{visibleStale.length > 1 ? "s" : ""} aging 30+ days — needs attention
                  </p>
                </div>
                <div className="space-y-2">
                  {visibleStale.slice(0, 5).map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between py-2"
                      style={{ borderBottom: "1px solid rgba(251,191,36,0.07)" }}
                    >
                      <div className="flex items-center gap-3">
                        {l.images?.[0] ? (
                          <img
                            src={cdnImg(l.images[0], 64, 70)}
                            onError={imgFallback(l.images[0])}
                            loading="lazy"
                            decoding="async"
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-gray-900 text-sm font-medium">
                            {l.brand} {l.model}
                          </p>
                          <p className="text-gray-500 text-xs">
                            RM {l.selling_price?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-700 text-xs font-semibold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          {getListingAge(l.created_at)}d
                        </span>
                        {onEditListing && (
                          <button
                            onClick={() => {
                              onEditListing(l);
                            }}
                            className="text-xs font-semibold px-3 py-1 rounded-lg transition-all"
                            style={{
                              background: "rgba(59,130,246,0.1)",
                              border: "1px solid rgba(59,130,246,0.25)",
                              color: "#93c5fd",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(59,130,246,0.2)"; e.currentTarget.style.borderColor = "rgba(59,130,246,0.45)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(59,130,246,0.1)"; e.currentTarget.style.borderColor = "rgba(59,130,246,0.25)"; }}
                          >
                            Adjust
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {adjustedStale.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: "rgba(34,197,94,0.03)",
                  border: "1px solid rgba(34,197,94,0.15)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <p className="text-emerald-700 text-sm font-semibold">
                    {adjustedStale.length} listing{adjustedStale.length > 1 ? "s" : ""} adjusted — 30+ days old, repriced or updated
                  </p>
                </div>
                <div className="space-y-2">
                  {adjustedStale.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between py-2"
                      style={{ borderBottom: "1px solid rgba(34,197,94,0.07)" }}
                    >
                      <div className="flex items-center gap-3">
                        {l.images?.[0] ? (
                          <img
                            src={cdnImg(l.images[0], 64, 70)}
                            onError={imgFallback(l.images[0])}
                            loading="lazy"
                            decoding="async"
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-gray-900 text-sm font-medium">
                            {l.brand} {l.model}
                          </p>
                          <p className="text-gray-500 text-xs">
                            RM {l.selling_price?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-700 text-xs font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          {getListingAge(l.created_at)}d · adjusted
                        </span>
                        {onEditListing && (
                          <button
                            onClick={() => onEditListing(l)}
                            className="text-xs px-2.5 py-1 rounded-lg transition-all"
                            style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#6b7280" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                            onMouseLeave={e => e.currentTarget.style.background = "#f9fafb"}
                          >
                            Edit again
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}
      <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
        <style>{`
          .lp-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid #e5e7eb; }
          .lp-table-wrap { display:block; }
          .lp-table { width:100%; border-collapse:collapse; table-layout:fixed; }
          .lp-table colgroup col:nth-child(1) { width:22%; }
          .lp-table colgroup col:nth-child(2) { width:14%; }
          .lp-table colgroup col:nth-child(3) { width:9%; }
          .lp-table colgroup col:nth-child(4) { width:9%; }
          .lp-table colgroup col:nth-child(5) { width:10%; }
          .lp-table colgroup col:nth-child(6) { width:9%; }
          .lp-table colgroup col:nth-child(7) { width:10%; }
          .lp-table colgroup col:nth-child(8) { width:8%; }
          .lp-table colgroup col:nth-child(9) { width:9%; }
          .lp-th { padding:10px 14px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#6b7280; text-align:left; background:#f9fafb; border-bottom:1px solid #e5e7eb; }
          .lp-row { border-bottom:1px solid #f3f4f6; transition:background 0.15s; }
          .lp-row:last-child { border-bottom:none; }
          .lp-row:hover { background:#f9fafb; }
          .lp-row.stale { background:#fffbeb; }
          .lp-row.stale:hover { background:#fef3c7; }
          .lp-td { padding:13px 14px; vertical-align:middle; }
          .lp-stat { display:inline-flex; align-items:center; justify-content:center; min-width:32px; height:24px; padding:0 8px; border-radius:6px; font-size:12px; font-weight:700; letter-spacing:0.02em; }
          .lp-stat.sky   { background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; }
          .lp-stat.green { background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; }
          .lp-stat.purple{ background:#faf5ff; color:#7e22ce; border:1px solid #e9d5ff; }
          .lp-stat.amber { background:#fffbeb; color:#b45309; border:1px solid #fde68a; }
          .lp-stat.dim   { background:#f9fafb; color:#9ca3af; border:1px solid #e5e7eb; }
          .lp-vehicle-img { width:44px; height:34px; object-fit:cover; border-radius:6px; flex-shrink:0; background:#f3f4f6; }
          .lp-vehicle-placeholder { width:44px; height:34px; border-radius:6px; flex-shrink:0; background:#f3f4f6; border:1px solid #e5e7eb; }
          .lp-cards { display:none; padding:12px; gap:10px; flex-direction:column; }
          .lp-card { border-radius:10px; overflow:hidden; background:#fff; border:1px solid #e5e7eb; transition:border-color 0.15s; }
          .lp-card.stale { border-color:#fde68a; background:#fffbeb; }
          .lp-card-top { display:flex; align-items:center; gap:12px; padding:12px 14px 10px; }
          .lp-card-img { width:52px; height:40px; object-fit:cover; border-radius:6px; flex-shrink:0; background:#f3f4f6; }
          .lp-card-placeholder { width:52px; height:40px; border-radius:6px; flex-shrink:0; background:#f3f4f6; border:1px solid #e5e7eb; }
          .lp-card-stats { display:grid; grid-template-columns:repeat(5,1fr); gap:1px; background:#e5e7eb; border-top:1px solid #e5e7eb; }
          .lp-card-stat { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:9px 4px; background:#fff; gap:2px; }
          .lp-card-stat-val { font-size:13px; font-weight:800; letter-spacing:0.02em; }
          .lp-card-stat-lbl { font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:#9ca3af; }
          @media(max-width:640px) {
            .lp-table-wrap { display:none !important; }
            .lp-cards { display:flex !important; }
          }
        `}</style>

        {/* ── header ── */}
        <div className="lp-header">
          <div>
            <h2 style={{ fontSize:14, fontWeight:700, color:'#111827', margin:0, letterSpacing:'-0.01em' }}>Listing Performance</h2>
            <p style={{ fontSize:11, color:'#6b7280', margin:'2px 0 0', letterSpacing:'0.01em' }}>Sorted by views · traffic activates once listings go live</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {can('export_data') && <button
              onClick={exportAnalyticsCSV}
              disabled={eventsLoading || carStatsRows.length === 0}
              style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'#374151', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:7, padding:'5px 10px', cursor: eventsLoading || carStatsRows.length === 0 ? 'not-allowed' : 'pointer', opacity: eventsLoading || carStatsRows.length === 0 ? 0.5 : 1, fontFamily:"system-ui,sans-serif" }}
              title="Export listing performance + salesman leaderboard as CSV"
            >
              <Download style={{ width:12, height:12 }} />
              Export CSV
            </button>}
            <span style={{ fontSize:11, fontWeight:600, color:'#6b7280', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:6, padding:'4px 10px' }}>
              {listings.length} listing{listings.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ── search bar ── */}
        <div style={{ padding:'0 20px 14px', position:'relative' }}>
          <Search style={{ position:'absolute', left:32, top:'50%', transform:'translateY(-50%)', width:14, height:14, color:'#9ca3af', pointerEvents:'none' }} />
          <input
            value={lpSearch}
            onChange={e => { setLpSearch(e.target.value); setLpVisible(20); }}
            placeholder="Search brand, model, variant, VIN, price or date…"
            style={{ width:'100%', boxSizing:'border-box', paddingLeft:38, paddingRight:12, paddingTop:8, paddingBottom:8, border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, color:'#111827', background:'#f9fafb', outline:'none', fontFamily:"system-ui,sans-serif" }}
          />
        </div>

        {listings.length === 0 ? (
          <div style={{ padding:'48px 20px', textAlign:'center', color:'#374151', fontSize:13 }}>
            No listings to analyse yet
          </div>
        ) : (() => {
          const allSorted = [...listings].sort((a, b) => {
            const aViews = carStatsMap[a.id]?.views || 0;
            const bViews = carStatsMap[b.id]?.views || 0;
            return bViews - aViews;
          });
          const lpQ = lpSearch.trim().toLowerCase();
          const filtered = lpQ
            ? allSorted.filter(l => [
                l.brand, l.model, l.variant, l.year,
                l.vin_number, l.plate_number,
                l.selling_price, l.selling_price != null ? Number(l.selling_price).toLocaleString() : '',
                l.created_at ? new Date(l.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
                l.created_at ? String(l.created_at).slice(0, 10) : '',
              ].filter(Boolean).join(' ').toLowerCase().includes(lpQ))
            : allSorted;
          const sorted = filtered.slice(0, lpVisible);
          const hasMore = filtered.length > lpVisible;
          return (
            <>
              {/* ── desktop table ── */}
              <div className="lp-table-wrap">
                <table className="lp-table">
                  <colgroup>
                    <col /><col /><col /><col /><col /><col /><col /><col /><col />
                  </colgroup>
                  <thead>
                    <tr>
                      {['Vehicle','Price','Age','Views','WhatsApp','Calls','Bookings','CVR','Status'].map(h => (
                        <th key={h} className="lp-th">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((l, i) => {
                      const stats  = carStatsMap[l.id] || {};
                      const views  = stats.views    || 0;
                      const wa     = stats.whatsapp  || 0;
                      const calls  = stats.calls     || 0;
                      const books  = stats.bookings  || 0;
                      const cvr    = stats.cvr;
                      const cvrNum = parseFloat(cvr);
                      const isStale = getListingAge(l.created_at) >= 30;
                      const statusKey = l.status || 'available';
                      const statusCls = statusKey === 'available' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                        : statusKey === 'reserved' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                        : 'bg-blue-400/10 text-blue-400 border-blue-400/20';
                      return (
                        <tr key={l.id} className={`lp-row${isStale ? ' stale' : ''}`}>
                          {/* Vehicle */}
                          <td className="lp-td">
                            <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                              <span style={{ fontSize:12, fontWeight:700, color:'#9ca3af', width:18, textAlign:'right', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{i + 1}</span>
                              {l.images?.[0]
                                ? <img src={cdnImg(l.images[0], 96, 70)} alt="" className="lp-vehicle-img" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = l.images[0]; }} />
                                : <div className="lp-vehicle-placeholder" />
                              }
                              <div style={{ minWidth:0 }}>
                                <p style={{ fontSize:13, fontWeight:700, color:'#111827', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.01em' }}>
                                  {onSelectListing ? (
                                    <span role="button" tabIndex={0}
                                       onClick={() => onSelectListing(l)}
                                       onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectListing(l); } }}
                                       style={{ color:'inherit', textDecoration:'none', cursor:'pointer' }}
                                       onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.textDecoration = 'underline'; }}
                                       onMouseLeave={e => { e.currentTarget.style.color = 'inherit'; e.currentTarget.style.textDecoration = 'none'; }}>
                                      {l.brand} {l.model}
                                    </span>
                                  ) : (<>{l.brand} {l.model}</>)}
                                </p>
                                <p style={{ fontSize:11, color:'#4b5563', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  {l.variant || l.year || '—'}
                                </p>
                                {(l.vin_number || l.plate_number) && (
                                  <p style={{ fontSize:10, color:'#9ca3af', margin:'1px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums', letterSpacing:'0.02em' }}>
                                    {l.vin_number || l.plate_number}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* Price */}
                          <td className="lp-td">
                            <p style={{ fontSize:13, fontWeight:800, color:'#111827', margin:0, letterSpacing:'-0.02em', tabularNums:true }}>
                              RM {l.selling_price?.toLocaleString() || '—'}
                            </p>
                          </td>
                          {/* Age */}
                          <td className="lp-td">
                            <AgeBadge createdAt={l.created_at} />
                          </td>
                          {/* Views */}
                          <td className="lp-td">
                            <span className={`lp-stat ${views > 0 ? 'sky' : 'dim'}`}>
                              {eventsLoading ? '…' : views}
                            </span>
                          </td>
                          {/* WhatsApp */}
                          <td className="lp-td">
                            <span className={`lp-stat ${wa > 0 ? 'green' : 'dim'}`}>
                              {eventsLoading ? '…' : wa}
                            </span>
                          </td>
                          {/* Calls */}
                          <td className="lp-td">
                            <span className={`lp-stat ${calls > 0 ? 'purple' : 'dim'}`}>
                              {eventsLoading ? '…' : calls}
                            </span>
                          </td>
                          {/* Bookings */}
                          <td className="lp-td">
                            <span className={`lp-stat ${books > 0 ? 'amber' : 'dim'}`}>
                              {eventsLoading ? '…' : books}
                            </span>
                          </td>
                          {/* CVR */}
                          <td className="lp-td">
                            <span style={{ fontSize:12, fontWeight:700, color: cvrNum > 5 ? '#34d399' : cvrNum > 0 ? '#fbbf24' : '#374151' }}>
                              {eventsLoading ? '…' : (cvr || '—')}
                            </span>
                          </td>
                          {/* Status */}
                          <td className="lp-td">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusCls}`} style={{ letterSpacing:'0.04em', textTransform:'capitalize' }}>
                              {statusKey}
                            </span>
                            {statusKey === 'reserved' && salesmanFirstName(l.reserved_by) && (
                              <p style={{ fontSize:10, color:'#6b7280', margin:'3px 0 0' }}>
                                by {salesmanFirstName(l.reserved_by)}
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── mobile cards ── */}
              <div className="lp-cards">
                {sorted.map((l, i) => {
                  const stats  = carStatsMap[l.id] || {};
                  const views  = stats.views    || 0;
                  const wa     = stats.whatsapp  || 0;
                  const calls  = stats.calls     || 0;
                  const books  = stats.bookings  || 0;
                  const cvr    = stats.cvr;
                  const cvrNum = parseFloat(cvr);
                  const isStale = getListingAge(l.created_at) >= 30;
                  const statusKey = l.status || 'available';
                  const statusColor = statusKey === 'available' ? '#4ade80' : statusKey === 'reserved' ? '#fbbf24' : '#60a5fa';
                  return (
                    <div key={l.id} className={`lp-card${isStale ? ' stale' : ''}`}>
                      {/* top row */}
                      <div className="lp-card-top">
                        {l.images?.[0]
                          ? <img src={cdnImg(l.images[0], 160, 70)} alt="" className="lp-card-img" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = l.images[0]; }} />
                          : <div className="lp-card-placeholder" />
                        }
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6 }}>
                            <div style={{ minWidth:0 }}>
                              <p style={{ fontSize:13, fontWeight:800, color:'#111827', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.01em' }}>
                                <span style={{ color:'#9ca3af', fontWeight:700 }}>{i + 1}.</span>{' '}
                                {onSelectListing ? (
                                  <span role="button" tabIndex={0}
                                     onClick={() => onSelectListing(l)}
                                     onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectListing(l); } }}
                                     style={{ color:'inherit', textDecoration:'none', cursor:'pointer' }}
                                     onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.textDecoration = 'underline'; }}
                                     onMouseLeave={e => { e.currentTarget.style.color = 'inherit'; e.currentTarget.style.textDecoration = 'none'; }}>
                                    {l.brand} {l.model}
                                  </span>
                                ) : (<>{l.brand} {l.model}</>)}
                              </p>
                              <p style={{ fontSize:11, color:'#4b5563', margin:'1px 0 0' }}>
                                {l.variant || l.year || '—'}
                              </p>
                              {(l.vin_number || l.plate_number) && (
                                <p style={{ fontSize:10, color:'#9ca3af', margin:'1px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums' }}>
                                  {l.vin_number || l.plate_number}
                                </p>
                              )}
                            </div>
                            <span style={{ fontSize:10, fontWeight:700, color:statusColor, background:`${statusColor}18`, border:`1px solid ${statusColor}30`, borderRadius:20, padding:'2px 8px', flexShrink:0, letterSpacing:'0.06em', textTransform:'capitalize' }}>
                              {statusKey}
                            </span>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5 }}>
                            <span style={{ fontSize:14, fontWeight:800, color:'#111827', letterSpacing:'-0.02em' }}>
                              RM {l.selling_price?.toLocaleString() || '—'}
                            </span>
                            <AgeBadge createdAt={l.created_at} />
                            {statusKey === 'reserved' && salesmanFirstName(l.reserved_by) && (
                              <span style={{ fontSize:10, color:'#6b7280' }}>Reserved by {salesmanFirstName(l.reserved_by)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* stats strip */}
                      <div className="lp-card-stats">
                        {[
                          { label:'Views',    val: views,  color:'#38bdf8' },
                          { label:'WhatsApp', val: wa,     color:'#4ade80' },
                          { label:'Calls',    val: calls,  color:'#c084fc' },
                          { label:'Bookings', val: books,  color:'#fbbf24' },
                          { label:'CVR',      val: eventsLoading ? '…' : (cvr || '—'), color: cvrNum > 5 ? '#34d399' : cvrNum > 0 ? '#fbbf24' : '#374151', raw: true },
                        ].map(({ label, val, color, raw }) => (
                          <div key={label} className="lp-card-stat">
                            <span className="lp-card-stat-val" style={{ color: (raw ? true : val > 0) ? color : '#374151' }}>
                              {eventsLoading && !raw ? '…' : val}
                            </span>
                            <span className="lp-card-stat-lbl">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {hasMore && (
                <div style={{ padding:'14px 20px', textAlign:'center', borderTop:'1px solid #f3f4f6', display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                  <button
                    onClick={() => setLpVisible(v => v + 40)}
                    style={{ padding:'8px 24px', borderRadius:8, background:'#f9fafb', border:'1px solid #e5e7eb', color:'#374151', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"system-ui,sans-serif" }}
                  >
                    Load more ({filtered.length - lpVisible} remaining)
                  </button>
                  <button
                    onClick={() => setLpVisible(filtered.length)}
                    style={{ padding:'8px 24px', borderRadius:8, background:'#fff', border:'1px solid #e5e7eb', color:'#dc2626', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"system-ui,sans-serif" }}
                  >
                    Show all {filtered.length}
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </div>
      {profile?.plan === "dealer_pro" && (
      <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
        <button
          onClick={() => setChatOpen((v) => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}
            >
              <Bot className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="text-gray-900 text-sm font-semibold">
                AI Performance Advisor
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                Ask anything about your inventory & performance
              </p>
            </div>
          </div>
          <ChevronRight
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${chatOpen ? "rotate-90" : ""}`}
          />
        </button>
        {chatOpen && (
          <div style={{ borderTop: "1px solid #e5e7eb" }}>
            <div className="h-72 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {m.role === "assistant" && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}
                    >
                      <Bot className="w-3 h-3 text-blue-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role === "user" ? "text-white rounded-tr-sm" : "text-gray-700 rounded-tl-sm"}`}
                    style={
                      m.role === "user"
                        ? { background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", boxShadow: "0 2px 8px rgba(59,130,246,0.22)" }
                        : { background: "#f9fafb", border: "1px solid #e5e7eb" }
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}
                  >
                    <Bot className="w-3 h-3 text-blue-600" />
                  </div>
                  <div className="px-3.5 py-3 rounded-2xl rounded-tl-sm" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            {messages.length === 1 && (
              <div className="px-4 pb-3 flex flex-wrap gap-2">
                {PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="text-xs px-3 py-1.5 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all"
                    style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            <div className="p-3 flex gap-2 items-end" style={{ borderTop: "1px solid #e5e7eb" }}>
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder="Ask about your listings, pricing, leads…"
                className="flex-1 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none resize-none transition-colors"
                style={{ background: "#fff", border: "1px solid #e5e7eb", maxHeight: "120px" }}
                onFocus={(e) => (e.target.style.borderColor = "#93c5fd")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="btn-shimmer w-9 h-9 flex items-center justify-center disabled:opacity-30 rounded-xl flex-shrink-0"
                style={T.btnRed}
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

export default AnalyticsTab;
