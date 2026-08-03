import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../../supabaseClient";

// XDrive Ops — client error monitoring. Reads two superadmin-guarded RPCs
// (get_error_summary / get_error_logs). Errors are captured by src/utils/logError.js
// from the global unhandledrejection handler + the React error boundary.

const RANGES = [
  { key: "1", label: "24h" },
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
];

function num(n) { return Number(n || 0).toLocaleString("en-MY"); }

function timeAgo(str) {
  if (!str) return "—";
  const s = Math.floor((Date.now() - new Date(str)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Card({ label, value, accent }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: accent || "#f0f0f0", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em", lineHeight: 1 }}>{value}</p>
    </div>
  );
}

export default function ErrorsTab() {
  const [range, setRange] = useState("7");
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [blocking, setBlocking] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      const from = new Date(Date.now() - Number(range) * 86400000).toISOString();
      const [s, l] = await Promise.all([
        supabase.rpc("get_error_summary"),
        supabase.rpc("get_error_logs", { p_from: from, p_limit: 300, p_role: roleFilter || null }),
      ]);
      if (cancelled) return;
      if (l.error) { setErr(l.error.message); setLoading(false); return; }
      setSummary(s.data || null);
      setLogs(l.data || []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [range, roleFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(e =>
      [e.error_message, e.error_code, e.context, e.user_email, e.dealer_name]
        .some(v => v && String(v).toLowerCase().includes(q)));
  }, [logs, search]);

  async function toggleBlock(e) {
    // Blocked == is_active false. Unblock -> true; block -> false.
    const currentlyBlocked = e.user_active === false;
    const active = currentlyBlocked;
    setBlocking(e.user_id);
    const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", e.user_id);
    setBlocking(null);
    if (!error) {
      setLogs(prev => prev.map(x => x.user_id === e.user_id ? { ...x, user_active: active } : x));
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Error Monitoring</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Client errors captured across every session — user &amp; dealer attributed</p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 3 }}>
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit",
                background: range === r.key ? "rgba(220,38,38,0.15)" : "transparent",
                color: range === r.key ? "#f87171" : "#9ca3af" }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#4b5563" }}>Loading errors…</div>
      ) : err ? (
        <div style={{ textAlign: "center", padding: 60, color: "#f87171", fontSize: 13 }}>Error: {err}</div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
            <Card label="Errors · 24h" value={num(summary?.total_24h)} accent={summary?.total_24h > 0 ? "#f87171" : "#4ade80"} />
            <Card label="Errors · 7d" value={num(summary?.total_7d)} />
            <Card label="Users affected · 7d" value={num(summary?.users_7d)} accent="#facc15" />
            <Card label="Top error code" value={summary?.by_code?.[0]?.code || "—"} accent="#c084fc" />
          </div>

          {/* By code + by role breakdown */}
          {(summary?.by_code?.length > 0 || summary?.by_role?.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginBottom: 20 }}>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Top codes · 7d</p>
                {(summary.by_code || []).map(c => (
                  <div key={c.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <span style={{ fontSize: 12, color: "#cbd5e1", fontFamily: "monospace" }}>{c.code}</span>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>{num(c.count)} <span style={{ color: "#475569", fontSize: 10 }}>· {timeAgo(c.last_seen)}</span></span>
                  </div>
                ))}
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>By role · 7d</p>
                {(summary.by_role || []).map(r => (
                  <div key={r.role} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <span style={{ fontSize: 12, color: "#cbd5e1" }}>{r.role}</span>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>{num(r.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search message, code, user…"
              style={{ width: 280, maxWidth: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 12, padding: "6px 10px", borderRadius: 6, outline: "none", fontFamily: "inherit" }} />
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 12, padding: "6px 10px", borderRadius: 6, outline: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <option value="">All roles</option>
              {(summary?.by_role || []).map(r => (
                <option key={r.role} value={r.role === "unknown" ? "" : r.role}>{r.role}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: "#4b5563", marginLeft: "auto" }}>{filtered.length} shown</span>
          </div>

          {/* Error list */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#374151" }}>
              <p style={{ fontSize: 14, color: "#4b5563" }}>No errors in this range. Nothing is on fire.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(e => {
                const open = expanded === e.id;
                const blocked = e.user_active === false;
                return (
                  <div key={e.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden" }}>
                    <button onClick={() => setExpanded(open ? null : e.id)}
                      style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "12px 14px", fontFamily: "inherit", display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontFamily: "monospace" }}>
                            {e.error_code || "uncoded"}
                          </span>
                          <span style={{ fontSize: 11, color: "#475569" }}>{timeAgo(e.created_at)}</span>
                          {e.role && <span style={{ fontSize: 10, color: "#6b7280" }}>· {e.role}</span>}
                          {blocked && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }}>USER BLOCKED</span>}
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: "#e5e7eb", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: open ? "normal" : "nowrap" }}>
                          {e.error_message}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6b7280" }}>
                          {e.user_email || (e.user_id ? "unknown user" : "anonymous")}
                          {e.dealer_name && <span style={{ color: "#475569" }}> · {e.dealer_name}</span>}
                        </p>
                      </div>
                      <span style={{ color: "#475569", fontSize: 13, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
                    </button>

                    {open && (
                      <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <Detail label="Context" value={e.context} />
                        <Detail label="URL" value={e.metadata?.url} mono />
                        <Detail label="User agent" value={e.metadata?.ua} mono />
                        {e.query_info?.stack && <Detail label="Stack" value={e.query_info.stack} mono pre />}
                        {e.metadata && Object.keys(e.metadata).filter(k => !["url", "ua"].includes(k)).length > 0 && (
                          <Detail label="Metadata" value={JSON.stringify(Object.fromEntries(Object.entries(e.metadata).filter(([k]) => !["url", "ua"].includes(k))), null, 2)} mono pre />
                        )}
                        {e.user_id && (
                          <div style={{ marginTop: 12 }}>
                            <button
                              disabled={blocking === e.user_id}
                              onClick={() => toggleBlock(e)}
                              style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
                                background: blocked ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)",
                                border: `1px solid ${blocked ? "rgba(74,222,128,0.25)" : "rgba(239,68,68,0.25)"}`,
                                color: blocked ? "#4ade80" : "#f87171", opacity: blocking === e.user_id ? 0.6 : 1 }}>
                              {blocking === e.user_id ? "…" : blocked ? "Unblock user" : "Block this user"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Detail({ label, value, mono, pre }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", fontFamily: mono ? "monospace" : "inherit", whiteSpace: pre ? "pre-wrap" : "normal", wordBreak: "break-word",
        background: pre ? "rgba(255,255,255,0.03)" : "none", padding: pre ? "10px 12px" : 0, borderRadius: pre ? 7 : 0, maxHeight: pre ? 240 : "auto", overflow: "auto" }}>
        {value}
      </p>
    </div>
  );
}
