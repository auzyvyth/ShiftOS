import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../../supabaseClient";
import {
  Car,
  Eye,
  Clock,
  Users,
  MessageCircle,
  Shield,
  RefreshCw,
} from "lucide-react";

function normalizePath(p) {
  if (!p) return null;
  if (/^\/showroom\/.+/.test(p)) return "/showroom/:slug";
  if (/^\/cars\/.+/.test(p)) return "/cars/:slug";
  if (/^\/s\/.+/.test(p)) return "/s/:slug";
  return p;
}

function categorizeRef(ref) {
  if (!ref) return "Direct";
  if (/google\./i.test(ref)) return "Google";
  if (/facebook\.|fb\.com/i.test(ref)) return "Facebook";
  if (/instagram\./i.test(ref)) return "Instagram";
  if (/tiktok\./i.test(ref)) return "TikTok";
  if (/twitter\.|t\.co/i.test(ref)) return "Twitter / X";
  if (/whatsapp\./i.test(ref)) return "WhatsApp";
  if (/xdrive\.my/i.test(ref)) return "Internal";
  return "Other";
}

function MarketplaceAnalyticsTab({ profile }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsOwner(user?.id === '1e7bf24e-5b71-4c64-8d03-b60db5e59316');
    });
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const since = new Date(Date.now() - range * 86400000).toISOString();
      const { data } = await supabase
        .from("analytics_events")
        .select("event_type,session_id,page_path,referrer,car_name,time_spent,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (!cancelled) {
        setEvents(data || []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [range, isOwner]);

  const pageEvents = useMemo(
    () => events.filter(e => e.event_type === "page_view" || e.event_type === "store_visit"),
    [events]
  );
  const exitEvents = useMemo(
    () => events.filter(e => e.event_type === "page_exit" && e.time_spent > 0),
    [events]
  );
  const carViewEvents = useMemo(
    () => events.filter(e => e.event_type === "car_view"),
    [events]
  );
  const waEvents = useMemo(
    () => events.filter(e => e.event_type === "whatsapp_click"),
    [events]
  );

  const uniqueVisitors = useMemo(
    () => new Set(pageEvents.map(e => e.session_id).filter(Boolean)).size,
    [pageEvents]
  );
  const avgTimeSecs = useMemo(() => {
    if (!exitEvents.length) return null;
    return Math.round(exitEvents.reduce((s, e) => s + (e.time_spent || 0), 0) / exitEvents.length);
  }, [exitEvents]);
  const waConvPct = uniqueVisitors > 0
    ? ((waEvents.length / uniqueVisitors) * 100).toFixed(1)
    : "0.0";

  const pageBreakdown = useMemo(() => {
    const map = {};
    pageEvents.forEach(e => {
      const p = normalizePath(e.page_path);
      if (!p) return;
      if (!map[p]) map[p] = { visits: 0, sessions: new Set() };
      map[p].visits++;
      if (e.session_id) map[p].sessions.add(e.session_id);
    });
    const timeMap = {};
    exitEvents.forEach(e => {
      const p = normalizePath(e.page_path);
      if (!p) return;
      if (!timeMap[p]) timeMap[p] = [];
      timeMap[p].push(e.time_spent);
    });
    return Object.entries(map)
      .map(([path, v]) => ({
        path,
        visits: v.visits,
        unique: v.sessions.size,
        avgTime: timeMap[path]
          ? Math.round(timeMap[path].reduce((s, t) => s + t, 0) / timeMap[path].length)
          : null,
      }))
      .sort((a, b) => b.visits - a.visits);
  }, [pageEvents, exitEvents]);

  const sources = useMemo(() => {
    const map = {};
    pageEvents.forEach(e => {
      const src = categorizeRef(e.referrer);
      map[src] = (map[src] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [pageEvents]);
  const sourceMax = sources[0]?.count || 1;

  const topCars = useMemo(() => {
    const map = {};
    carViewEvents.forEach(e => {
      if (!e.car_name) return;
      map[e.car_name] = (map[e.car_name] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, views]) => ({ name, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [carViewEvents]);
  const carMax = topCars[0]?.views || 1;

  const trend = useMemo(() => {
    const map = {};
    pageEvents.forEach(e => {
      const d = e.created_at?.slice(0, 10);
      if (d) map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map)
      .map(([date, visits]) => ({ date: date.slice(5), visits }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [pageEvents]);

  function fmtTime(secs) {
    if (secs === null || secs === undefined) return "—";
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  }

  const cardStyle = { background: "#111827", border: "1px solid #1f2937" };
  const labelCls = "text-[10px] text-gray-500 uppercase tracking-widest font-medium mb-3";
  const pageMax = pageBreakdown[0]?.visits || 1;

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <Shield className="w-8 h-8 text-gray-700" />
        <p className="text-gray-500 text-sm">Access restricted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-white">Marketplace Analytics</h2>
          <p className="text-xs text-gray-500 mt-0.5">XDrive public traffic — all visitors, all pages</p>
        </div>
        <div className="flex gap-1.5">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                range === d ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-5 h-5 text-gray-600 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Page Visits", value: pageEvents.length, Icon: Eye, grad: "grad-blue" },
              { label: "Unique Visitors", value: uniqueVisitors, Icon: Users, grad: "grad-cyan" },
              { label: "Car Detail Views", value: carViewEvents.length, Icon: Car, grad: "grad-purple" },
              { label: "WhatsApp CVR", value: `${waConvPct}%`, Icon: MessageCircle, grad: "grad-green" },
            ].map(({ label, value, Icon, grad }) => (
              <div key={label} className="card-top relative rounded-xl p-4" style={cardStyle}>
                <Icon className="w-4 h-4 text-gray-600 mb-2" />
                <div className={`text-2xl font-bold ${grad}`}>{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {avgTimeSecs !== null && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-2.5" style={cardStyle}>
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-400">Avg time on page:</span>
              <span className="text-sm text-white font-semibold">{fmtTime(avgTimeSecs)}</span>
            </div>
          )}

          {trend.length > 0 && (
            <div className="card-top relative rounded-xl p-4" style={cardStyle}>
              <p className={labelCls}>Daily Visits</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: "#4b5563", fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: "#4b5563", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Line type="monotone" dataKey="visits" stroke="#dc2626" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-top relative rounded-xl p-4" style={cardStyle}>
              <p className={labelCls}>Pages</p>
              {pageBreakdown.length === 0 ? (
                <p className="text-gray-600 text-xs">No page data in this range</p>
              ) : (
                <div className="space-y-3">
                  {pageBreakdown.map(({ path, visits, unique, avgTime }) => (
                    <div key={path}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono text-gray-300 truncate max-w-[160px]">{path}</span>
                        <span className="text-gray-500 ml-2 shrink-0">
                          {visits} visits · {unique} uniq{avgTime ? ` · ${fmtTime(avgTime)}` : ""}
                        </span>
                      </div>
                      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-700 rounded-full"
                          style={{ width: `${(visits / pageMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-top relative rounded-xl p-4" style={cardStyle}>
              <p className={labelCls}>Traffic Sources</p>
              {sources.length === 0 ? (
                <p className="text-gray-600 text-xs">No referrer data in this range</p>
              ) : (
                <div className="space-y-3">
                  {sources.map(({ name, count }) => (
                    <div key={name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300">{name}</span>
                        <span className="text-gray-500">{count}</span>
                      </div>
                      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${(count / sourceMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {topCars.length > 0 && (
            <div className="card-top relative rounded-xl p-4" style={cardStyle}>
              <p className={labelCls}>Top Car Views</p>
              <div className="space-y-3">
                {topCars.map(({ name, views }, i) => (
                  <div key={name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-300">
                        <span className="text-gray-600 mr-1.5">{i + 1}.</span>
                        {name}
                      </span>
                      <span className="text-gray-500">{views} views</span>
                    </div>
                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${(views / carMax) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MarketplaceAnalyticsTab;
