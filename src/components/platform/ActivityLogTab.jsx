import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import InfoHint from "../ui/InfoHint";

// Security console — audit forensics. Reads two superadmin-guarded RPCs
// (get_activity_summary / get_activity_log). activity_log is written server-side by
// DB triggers/RPCs and by the dealer dashboard's logActivity(); a BEFORE INSERT
// trigger stamps session_id/ip/user_agent so each action ties to a login session
// (activity_log.session_id joins auth.sessions).

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
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px", minWidth: 0 }}>
      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: accent || "#f0f0f0", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em", lineHeight: 1.2 }}>{value}</p>
    </div>
  );
}

// action -> hue for the pill. Terminal / destructive actions read warmer.
function actionColor(a) {
  if (!a) return "#6b7280";
  if (/(delete|reject|unassigned|deactivat|unverif)/i.test(a)) return "#f87171";
  if (/(sold|approved|verified|paid|published|won)/i.test(a)) return "#4ade80";
  if (/(price|cost|commission|settings)/i.test(a)) return "#facc15";
  return "#93c5fd";
}

export default function ActivityLogTab() {
  const [range, setRange] = useState("7");
  const [actionFilter, setActionFilter] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      const from = new Date(Date.now() - Number(range) * 86400000).toISOString();
      const [s, l] = await Promise.all([
        supabase.rpc("get_activity_summary", { p_from: from }),
        supabase.rpc("get_activity_log", {
          p_from: from,
          p_limit: 500,
          p_action: actionFilter || null,
          p_table: tableFilter || null,
          p_anomaly_only: anomalyOnly,
        }),
      ]);
      if (cancelled) return;
      if (l.error) { setErr(l.error.message); setLoading(false); return; }
      setSummary(s.data || null);
      setRows(l.data || []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [range, actionFilter, tableFilter, anomalyOnly]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(e =>
      [e.summary, e.action, e.actor_name, e.actor_role, e.dealer_name, e.table_name, e.ip]
        .some(v => v && String(v).toLowerCase().includes(q)));
  }, [rows, search]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Activity Log
            <InfoHint title="What is this?" text="A tamper-proof diary of who did what across every dealer — price edits, sales, assignments, and more. Each row can be expanded to see exactly what changed and from which login/device. 'Anomaly' flags unusual actions (e.g. a big price drop or an off-hours edit) for a closer look." />
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Audit trail across every dealer — actor, session and device attributed</p>
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
        <div style={{ textAlign: "center", padding: 80, color: "#4b5563" }}>Loading activity…</div>
      ) : err ? (
        <div style={{ textAlign: "center", padding: 60, color: "#f87171", fontSize: 13 }}>Error: {err}</div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
            <Card label="Events · range" value={num(summary?.total)} />
            <Card label="Events · 24h" value={num(summary?.total_24h)} />
            <Card label="Anomalies" value={num(summary?.anomalies)} accent={summary?.anomalies > 0 ? "#f87171" : "#4ade80"} />
            <Card label="Actors" value={num(summary?.distinct_actors)} accent="#93c5fd" />
            <Card label="Sessions" value={num(summary?.distinct_sessions)} accent="#c084fc" />
          </div>

          {/* Breakdowns */}
          {(summary?.by_action?.length > 0 || summary?.top_actors?.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginBottom: 20 }}>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Top actions</p>
                {(summary.by_action || []).map(c => (
                  <div key={c.action} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <span style={{ fontSize: 12, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{c.action}</span>
                    <span style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0, whiteSpace: "nowrap" }}>{num(c.count)} <span style={{ color: "#475569", fontSize: 10 }}>· {timeAgo(c.last_seen)}</span></span>
                  </div>
                ))}
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Most active actors</p>
                {(summary.top_actors || []).map((r, i) => (
                  <div key={r.actor_id || `sys${i}`} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <span style={{ fontSize: 12, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{r.actor_name} <span style={{ color: "#475569", fontSize: 10 }}>· {r.actor_role || "—"}</span></span>
                    <span style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>{num(r.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search summary, actor, dealer, IP…"
              style={{ width: 280, maxWidth: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 12, padding: "6px 10px", borderRadius: 6, outline: "none", fontFamily: "inherit" }} />
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 12, padding: "6px 10px", borderRadius: 6, outline: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <option value="">All actions</option>
              {(summary?.by_action || []).map(a => (
                <option key={a.action} value={a.action}>{a.action}</option>
              ))}
            </select>
            <select value={tableFilter} onChange={e => setTableFilter(e.target.value)}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 12, padding: "6px 10px", borderRadius: 6, outline: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <option value="">All tables</option>
              {(summary?.by_table || []).map(t => (
                <option key={t.table_name} value={t.table_name}>{t.table_name}</option>
              ))}
            </select>
            <button onClick={() => setAnomalyOnly(v => !v)}
              style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                background: anomalyOnly ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${anomalyOnly ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.08)"}`,
                color: anomalyOnly ? "#f87171" : "#9ca3af" }}>
              Anomalies only
            </button>
            <span style={{ fontSize: 12, color: "#4b5563", marginLeft: "auto" }}>{filtered.length} shown</span>
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#374151" }}>
              <p style={{ fontSize: 14, color: "#4b5563" }}>No activity in this range.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(e => {
                const open = expanded === e.id;
                const anom = e.is_anomaly === true;
                return (
                  <div key={e.id} style={{
                    background: anom ? "rgba(239,68,68,0.06)" : "#0d1117",
                    border: `1px solid ${anom ? "rgba(239,68,68,0.22)" : "rgba(255,255,255,0.07)"}`,
                    borderRadius: 10, overflow: "hidden" }}>
                    <button onClick={() => setExpanded(open ? null : e.id)}
                      style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "12px 14px", fontFamily: "inherit", display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "rgba(255,255,255,0.05)", border: `1px solid ${actionColor(e.action)}55`, color: actionColor(e.action), fontFamily: "monospace" }}>
                            {e.action}
                          </span>
                          <span style={{ fontSize: 11, color: "#64748b" }}>{e.table_name}</span>
                          <span style={{ fontSize: 11, color: "#475569" }}>{timeAgo(e.created_at)}</span>
                          {anom && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }}>ANOMALY</span>}
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: "#e5e7eb", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: open ? "normal" : "nowrap" }}>
                          {e.summary || `${e.action} ${e.table_name}`}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6b7280" }}>
                          {e.actor_name || "system"}
                          {e.actor_role && <span style={{ color: "#475569" }}> · {e.actor_role}</span>}
                          {e.dealer_name && <span style={{ color: "#475569" }}> · {e.dealer_name}</span>}
                        </p>
                      </div>
                      <span style={{ color: "#475569", fontSize: 13, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
                    </button>

                    {open && (
                      <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        {anom && <Detail label="Anomaly reason" value={e.anomaly_reason} />}
                        <FieldChanges changes={e.field_changes} />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 4 }}>
                          <Detail label="IP" value={e.ip} mono />
                          <Detail label="Session id" value={e.session_id} mono />
                          <Detail label="Session started" value={e.session_started_at ? new Date(e.session_started_at).toLocaleString("en-MY") : null} />
                          <Detail label="Session last seen" value={e.session_last_seen ? new Date(e.session_last_seen).toLocaleString("en-MY") : null} />
                          <Detail label="Assurance level" value={e.session_aal} />
                          <Detail label="Record id" value={e.record_id} mono />
                        </div>
                        <Detail label="User agent" value={e.user_agent} mono />
                        <Detail label="When" value={new Date(e.created_at).toLocaleString("en-MY")} />
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

function FieldChanges({ changes }) {
  if (!changes || typeof changes !== "object" || Object.keys(changes).length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Field changes</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {Object.entries(changes).map(([k, v]) => {
          const before = v && typeof v === "object" ? (v.old ?? v.from) : undefined;
          const after = v && typeof v === "object" ? (v.new ?? v.to) : v;
          return (
            <div key={k} style={{ fontSize: 12, fontFamily: "monospace", color: "#cbd5e1", background: "rgba(255,255,255,0.03)", padding: "6px 10px", borderRadius: 6, wordBreak: "break-word" }}>
              <span style={{ color: "#94a3b8" }}>{k}</span>{" "}
              {before !== undefined && <><span style={{ color: "#f87171" }}>{String(before)}</span> <span style={{ color: "#475569" }}>→</span> </>}
              <span style={{ color: "#4ade80" }}>{String(after)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Detail({ label, value, mono }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-word" }}>
        {String(value)}
      </p>
    </div>
  );
}
