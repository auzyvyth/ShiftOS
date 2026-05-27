import React, { useState, useEffect, useRef, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush, ResponsiveContainer } from "recharts";
import { supabase } from "../../supabaseClient";
import { getDealerIdFromProfile } from "../../hooks/useProfile";
import {
  Car,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart2,
  Bot,
  Send,
  ChevronRight,
} from "lucide-react";

const SERVER_URL = "https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1";

const T = {
  cardDark: {
    position: 'relative',
    background: 'rgba(8,10,18,0.95)',
    border: '1px solid rgba(255,255,255,0.055)',
  },
  divider: { borderBottom: '1px solid rgba(255,255,255,0.048)' },
  btnRed: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(29,78,216,0.95))',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 12px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
};

export function getListingAge(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt)) / 86400000);
}

function Sparkline({ data = [], color = '#3b82f6', width = 80, height = 28 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const gradId = `sg-${color.replace('#', '')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${gradId})`} />
    </svg>
  );
}

const AgeBadge = React.memo(function AgeBadge({ createdAt }) {
  const d = getListingAge(createdAt);
  if (d < 15)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
        <Clock className="w-3 h-3" />
        {d === 0 ? "Today" : `${d}d`}
      </span>
    );
  if (d < 25)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">
        <Clock className="w-3 h-3" />
        {d}d
      </span>
    );
  if (d < 30)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-400/10 text-orange-400 border border-orange-400/20">
        <Clock className="w-3 h-3" />
        {d}d
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-400/10 text-blue-400 border border-blue-400/20">
      <Clock className="w-3 h-3" />
      {d}d
    </span>
  );
});

function AnalyticsTab({ listings, profile, onEditListing, onStaleAdjusted, adjustedStaleIds }) {
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

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  useEffect(() => {
    if (!profile?.id) return;
    const dealerId = getDealerIdFromProfile(profile);
    if (!dealerId) return;
    // Also pull events where dealer_id is null but car_id belongs to this dealer
    // (covers main-domain visits where dealer_id wasn't attached to store_visit)
    Promise.all([
      supabase
        .from("analytics_events")
        .select("*")
        .eq("dealer_id", dealerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("car_listings")
        .select("id")
        .eq("dealer_id", dealerId)
        .in("status", ["available", "reserved", "sold"]),
    ]).then(([eventsRes, listingsRes]) => {
      const directEvents = eventsRes.data || [];
      const dealerCarIds = new Set((listingsRes.data || []).map(l => l.id));
      // No-dealer_id events that reference one of this dealer's cars (deduped by id)
      const seenIds = new Set(directEvents.map(e => e.id));
      setEvents(directEvents);
      setEventsLoading(false);
      // Fetch orphan events (null dealer_id but car_id matches) separately to avoid large OR query
      if (dealerCarIds.size > 0) {
        supabase
          .from("analytics_events")
          .select("*")
          .is("dealer_id", null)
          .in("car_id", [...dealerCarIds])
          .order("created_at", { ascending: false })
          .then(({ data }) => {
            const extras = (data || []).filter(e => !seenIds.has(e.id));
            if (extras.length > 0) setEvents(prev => [...prev, ...extras]);
          });
      }
    });
  }, [profile?.id]);
  const totalClicks = events.filter(
    (e) => e.event_type === "link_visit" || e.event_type === "car_view" || e.event_type === "card_click",
  ).length;
  const totalWa = events.filter(
    (e) => e.event_type === "whatsapp_click",
  ).length;
  const totalCalls = events.filter((e) => e.event_type === "call_click").length;
  const totalBookings = events.filter((e) => e.event_type === "booking_click").length;
  const storeVisits = events.filter((e) =>
    e.event_type === "store_visit" || e.event_type === "car_view" || e.event_type === "page_view"
  ).length;

  const buildDailyChart = (evts, days = 30) => {
    const result = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
      const dayEvents = evts.filter(e => e.created_at?.slice(0, 10) === dateStr);
      result.push({
        date:     label,
        visits:   dayEvents.filter(e => ['store_visit', 'car_view', 'page_view'].includes(e.event_type)).length,
        clicks:   dayEvents.filter(e => ['link_visit', 'card_click'].includes(e.event_type)).length,
        whatsapp: dayEvents.filter(e => e.event_type === 'whatsapp_click').length,
        calls:    dayEvents.filter(e => e.event_type === 'call_click').length,
        bookings: dayEvents.filter(e => e.event_type === 'booking_click').length,
      });
    }
    return result;
  };

  const dailyChart = useMemo(() => buildDailyChart(events), [events]);

  const carStatsMap = useMemo(() => {
    const map = {};
    events.forEach(e => {
      if (!e.car_id) return;
      if (!map[e.car_id]) map[e.car_id] = { views: 0, whatsapp: 0, calls: 0, bookings: 0 };
      if (['car_view', 'link_visit', 'card_click'].includes(e.event_type)) map[e.car_id].views++;
      if (e.event_type === 'whatsapp_click') map[e.car_id].whatsapp++;
      if (e.event_type === 'call_click') map[e.car_id].calls++;
      if (e.event_type === 'booking_click') map[e.car_id].bookings++;
    });
    Object.values(map).forEach(s => {
      const leads = s.whatsapp + s.calls;
      s.cvr = s.views > 0 ? ((leads / s.views) * 100).toFixed(1) + '%' : '—';
    });
    return map;
  }, [events]);

  const bySlug = events.reduce((acc, e) => {
    if (!acc[e.salesman_slug])
      acc[e.salesman_slug] = { clicks: 0, whatsapp: 0 };
    if (e.event_type === "link_visit" || e.event_type === "car_view")
      acc[e.salesman_slug].clicks++;
    if (e.event_type === "whatsapp_click")
      acc[e.salesman_slug].whatsapp++;
    return acc;
  }, {});
  const topSalesmen = Object.entries(bySlug).sort(
    (a, b) => b[1].whatsapp - a[1].whatsapp,
  );

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
      const res = await fetch(`${SERVER_URL}/ai/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: ctx(),
          messages: history,
        }),
      });
      const data = await res.json();
      let reply = "Could not generate a response.";
      if (Array.isArray(data?.content))
        reply = data.content.find((b) => b.type === "text")?.text || reply;
      else if (data?.completion) reply = data.completion;
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
      spark: Array(14).fill(0),
      sparkColor: '#34d399',
    },
    {
      label: "Avg. Age",
      val: `${avgAge}d`,
      sub: avgAge >= 30 ? "⚠ Aging" : "Healthy",
      grad: avgAge >= 30 ? "grad-gold" : "grad-white",
      icon: <Clock className="w-4 h-4" />,
      glow: avgAge >= 30 ? "rgba(251,191,36,0.14)" : "rgba(255,255,255,0.03)",
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
                className={`text-xl sm:text-3xl font-black leading-none tabular-nums ${grad || "text-white"}`}
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
      <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
        {/* Header + summary pills */}
        <div className="flex items-center justify-between p-4 flex-wrap gap-3" style={T.divider}>
          <div>
            <h2 className="font-semibold text-white text-sm">Engagement Overview</h2>
            <p className="text-xs text-gray-600 mt-0.5">Last 30 days · drag the range slider to zoom into any period</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Page Visits', val: storeVisits,   color: '#94a3b8' },
              { label: 'Clicks',      val: totalClicks,   color: '#67e8f9' },
              { label: 'WhatsApp',    val: totalWa,       color: '#4ade80' },
              { label: 'Bookings',    val: totalBookings, color: '#fbbf24' },
              { label: 'Calls',       val: totalCalls,    color: '#c084fc' },
            ].map(({ label, val, color }) => (
              <div key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-xs font-bold text-white tabular-nums">
                  {eventsLoading ? '…' : val}
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* Chart */}
        <div className="p-4 pt-2">
          {eventsLoading ? (
            <div className="flex items-center justify-center h-52 text-gray-600 text-sm">Loading chart…</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: '#4b5563' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f1117',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                  }}
                  itemStyle={{ color: '#e5e7eb' }}
                  labelStyle={{ color: '#9ca3af', marginBottom: 4 }}
                  cursor={{ stroke: 'rgba(59,130,246,0.2)', strokeWidth: 1 }}
                />
                <Legend
                  iconType="circle"
                  iconSize={6}
                  wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingTop: 8 }}
                />
                <Brush
                  dataKey="date"
                  height={20}
                  stroke="rgba(59,130,246,0.3)"
                  fill="rgba(59,130,246,0.05)"
                  travellerWidth={6}
                  startIndex={Math.max(0, dailyChart.length - 14)}
                />
                <Line type="monotone" dataKey="visits"   stroke="#94a3b8" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                <Line type="monotone" dataKey="clicks"   stroke="#67e8f9" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                <Line type="monotone" dataKey="whatsapp" stroke="#4ade80" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                <Line type="monotone" dataKey="bookings" stroke="#fbbf24" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                <Line type="monotone" dataKey="calls"    stroke="#c084fc" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      {topSalesmen.length > 0 && (
        <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
          <div className="flex items-center gap-2 p-4" style={T.divider}>
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <p className="font-semibold text-white text-sm">
              Salesman Performance
            </p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {topSalesmen.map(([slug, { clicks, whatsapp }], i) => (
              <div key={slug} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xs text-gray-600 w-4 tabular-nums">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    /{slug}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500">
                      <span className="text-sky-400 font-semibold">
                        {clicks}
                      </span>{" "}
                      clicks
                    </span>
                    <span className="text-xs text-gray-500">
                      <span className="text-green-400 font-semibold">
                        {whatsapp}
                      </span>{" "}
                      whatsapp
                    </span>
                  </div>
                </div>
                {whatsapp > 0 && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: "rgba(74,222,128,0.1)",
                      border: "1px solid rgba(74,222,128,0.2)",
                      color: "#4ade80",
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {(() => {
        const visibleStale = stale.filter(l => !(adjustedStaleIds || new Set()).has(l.id));
        const adjustedStale = stale.filter(l => (adjustedStaleIds || new Set()).has(l.id));
        return (
          <>
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
                  <p className="text-amber-300 text-sm font-semibold">
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
                            src={l.images[0]}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover bg-gray-800 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-white text-sm font-medium">
                            {l.brand} {l.model}
                          </p>
                          <p className="text-gray-500 text-xs">
                            RM {l.selling_price?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 text-xs font-semibold bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
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
                  <p className="text-emerald-300 text-sm font-semibold">
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
                            src={l.images[0]}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover bg-gray-800 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-white text-sm font-medium">
                            {l.brand} {l.model}
                          </p>
                          <p className="text-gray-500 text-xs">
                            RM {l.selling_price?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 text-xs font-semibold bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
                          {getListingAge(l.created_at)}d · adjusted
                        </span>
                        {onEditListing && (
                          <button
                            onClick={() => onEditListing(l)}
                            className="text-xs px-2.5 py-1 rounded-lg transition-all"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              color: "#6b7280",
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = "#e5e7eb"}
                            onMouseLeave={e => e.currentTarget.style.color = "#6b7280"}
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
          .lp-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.05); }
          /* ── desktop table ── */
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
          .lp-th { padding:10px 14px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:rgba(107,114,128,0.8); text-align:left; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.05); }
          .lp-row { border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.15s; }
          .lp-row:last-child { border-bottom:none; }
          .lp-row:hover { background:rgba(255,255,255,0.025); }
          .lp-row.stale { background:rgba(251,191,36,0.03); }
          .lp-row.stale:hover { background:rgba(251,191,36,0.06); }
          .lp-td { padding:13px 14px; vertical-align:middle; }
          .lp-stat { display:inline-flex; align-items:center; justify-content:center; min-width:32px; height:24px; padding:0 8px; border-radius:6px; font-size:12px; font-weight:700; tabular-nums; letter-spacing:0.02em; }
          .lp-stat.sky  { background:rgba(56,189,248,0.1);  color:#38bdf8; border:1px solid rgba(56,189,248,0.18); }
          .lp-stat.green{ background:rgba(34,197,94,0.1);   color:#4ade80; border:1px solid rgba(34,197,94,0.18); }
          .lp-stat.purple{ background:rgba(168,85,247,0.1); color:#c084fc; border:1px solid rgba(168,85,247,0.18); }
          .lp-stat.amber{ background:rgba(251,191,36,0.1);  color:#fbbf24; border:1px solid rgba(251,191,36,0.18); }
          .lp-stat.dim  { background:rgba(255,255,255,0.03); color:rgba(75,85,99,0.9); border:1px solid rgba(255,255,255,0.06); }
          .lp-vehicle-img { width:44px; height:34px; object-fit:cover; border-radius:6px; flex-shrink:0; background:#111827; }
          .lp-vehicle-placeholder { width:44px; height:34px; border-radius:6px; flex-shrink:0; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); }
          /* ── mobile cards ── */
          .lp-cards { display:none; padding:12px; gap:10px; flex-direction:column; }
          .lp-card { border-radius:10px; overflow:hidden; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); transition:border-color 0.15s; }
          .lp-card.stale { border-color:rgba(251,191,36,0.2); background:rgba(251,191,36,0.02); }
          .lp-card-top { display:flex; align-items:center; gap:12px; padding:12px 14px 10px; }
          .lp-card-img { width:52px; height:40px; object-fit:cover; border-radius:6px; flex-shrink:0; background:#111827; }
          .lp-card-placeholder { width:52px; height:40px; border-radius:6px; flex-shrink:0; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); }
          .lp-card-stats { display:grid; grid-template-columns:repeat(5,1fr); gap:1px; background:rgba(255,255,255,0.05); border-top:1px solid rgba(255,255,255,0.05); }
          .lp-card-stat { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:9px 4px; background:rgba(6,12,20,0.6); gap:2px; }
          .lp-card-stat-val { font-size:13px; font-weight:800; tabular-nums; letter-spacing:0.02em; }
          .lp-card-stat-lbl { font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:#374151; }
          @media(max-width:640px) {
            .lp-table-wrap { display:none !important; }
            .lp-cards { display:flex !important; }
          }
        `}</style>

        {/* ── header ── */}
        <div className="lp-header">
          <div>
            <h2 style={{ fontSize:14, fontWeight:700, color:'white', margin:0, letterSpacing:'-0.01em' }}>Listing Performance</h2>
            <p style={{ fontSize:11, color:'#374151', margin:'2px 0 0', letterSpacing:'0.01em' }}>Sorted by views · traffic activates once listings go live</p>
          </div>
          <span style={{ fontSize:11, fontWeight:600, color:'#374151', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:6, padding:'4px 10px' }}>
            {listings.length} listing{listings.length !== 1 ? 's' : ''}
          </span>
        </div>

        {listings.length === 0 ? (
          <div style={{ padding:'48px 20px', textAlign:'center', color:'#374151', fontSize:13 }}>
            No listings to analyse yet
          </div>
        ) : (() => {
          const sorted = [...listings].sort((a, b) => {
            const aViews = carStatsMap[a.id]?.views || 0;
            const bViews = carStatsMap[b.id]?.views || 0;
            return bViews - aViews;
          });
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
                    {sorted.map((l) => {
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
                              {l.images?.[0]
                                ? <img src={l.images[0]} alt="" className="lp-vehicle-img" />
                                : <div className="lp-vehicle-placeholder" />
                              }
                              <div style={{ minWidth:0 }}>
                                <p style={{ fontSize:13, fontWeight:700, color:'white', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.01em' }}>
                                  {l.brand} {l.model}
                                </p>
                                <p style={{ fontSize:11, color:'#4b5563', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  {l.variant || l.year || '—'}
                                </p>
                              </div>
                            </div>
                          </td>
                          {/* Price */}
                          <td className="lp-td">
                            <p style={{ fontSize:13, fontWeight:800, color:'#f3f4f6', margin:0, letterSpacing:'-0.02em', tabularNums:true }}>
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
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── mobile cards ── */}
              <div className="lp-cards">
                {sorted.map((l) => {
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
                          ? <img src={l.images[0]} alt="" className="lp-card-img" />
                          : <div className="lp-card-placeholder" />
                        }
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6 }}>
                            <div style={{ minWidth:0 }}>
                              <p style={{ fontSize:13, fontWeight:800, color:'white', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.01em' }}>
                                {l.brand} {l.model}
                              </p>
                              <p style={{ fontSize:11, color:'#4b5563', margin:'1px 0 0' }}>
                                {l.variant || l.year || '—'}
                              </p>
                            </div>
                            <span style={{ fontSize:10, fontWeight:700, color:statusColor, background:`${statusColor}18`, border:`1px solid ${statusColor}30`, borderRadius:20, padding:'2px 8px', flexShrink:0, letterSpacing:'0.06em', textTransform:'capitalize' }}>
                              {statusKey}
                            </span>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5 }}>
                            <span style={{ fontSize:14, fontWeight:800, color:'#f3f4f6', letterSpacing:'-0.02em' }}>
                              RM {l.selling_price?.toLocaleString() || '—'}
                            </span>
                            <AgeBadge createdAt={l.created_at} />
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
            </>
          );
        })()}
      </div>
      <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
        <button
          onClick={() => setChatOpen((v) => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: "rgba(59,130,246,0.1)",
                border: "1px solid rgba(59,130,246,0.18)",
                boxShadow: "0 0 12px rgba(59,130,246,0.12)",
              }}
            >
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-left">
              <p className="text-white text-sm font-semibold">
                AI Performance Advisor
              </p>
              <p className="text-gray-600 text-xs mt-0.5">
                Ask anything about your inventory & performance
              </p>
            </div>
          </div>
          <ChevronRight
            className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${chatOpen ? "rotate-90" : ""}`}
          />
        </button>
        {chatOpen && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="h-72 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {m.role === "assistant" && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: "rgba(59,130,246,0.12)",
                        border: "1px solid rgba(59,130,246,0.18)",
                      }}
                    >
                      <Bot className="w-3 h-3 text-blue-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role === "user" ? "text-white rounded-tr-sm" : "text-gray-300 rounded-tl-sm"}`}
                    style={
                      m.role === "user"
                        ? {
                            background:
                              "linear-gradient(135deg,#3b82f6,#1d4ed8)",
                            boxShadow: "0 2px 8px rgba(59,130,246,0.22)",
                          }
                        : {
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }
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
                    style={{
                      background: "rgba(59,130,246,0.12)",
                      border: "1px solid rgba(59,130,246,0.18)",
                    }}
                  >
                    <Bot className="w-3 h-3 text-blue-400" />
                  </div>
                  <div
                    className="px-3.5 py-3 rounded-2xl rounded-tl-sm"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 bg-blue-500/40 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
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
                    className="text-xs px-3 py-1.5 rounded-full text-gray-500 hover:text-white transition-all"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            <div
              className="p-3 flex gap-2 items-end"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
            >
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask about your listings, pricing, leads…"
                className="flex-1 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none resize-none transition-colors"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  maxHeight: "120px",
                }}
                onFocus={(e) =>
                  (e.target.style.borderColor = "rgba(59,130,246,0.4)")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgba(255,255,255,0.08)")
                }
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
    </div>
  );
}

export default AnalyticsTab;
