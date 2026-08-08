import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../../supabaseClient";

// Security console — login sessions. Reads the superadmin-guarded get_active_sessions
// RPC (auth.sessions joined to profiles, enriched with each session's logged-action
// count). Shows who is logged in, from where, on which device, and what they did.

function num(n) { return Number(n || 0).toLocaleString("en-MY"); }

function timeAgo(str) {
  if (!str) return "—";
  const s = Math.floor((Date.now() - new Date(str)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Rough device label from a user-agent string.
function device(ua) {
  if (!ua) return "Unknown device";
  if (/iphone|ipad|ios/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/macintosh|mac os/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

function Card({ label, value, accent }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px", minWidth: 0 }}>
      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: accent || "#f0f0f0", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em", lineHeight: 1.2 }}>{value}</p>
    </div>
  );
}

export default function SessionsTab() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [hideExpired, setHideExpired] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.rpc("get_active_sessions", { p_limit: 500 });
    if (error) { setErr(error.message); setLoading(false); return; }
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    let r = rows;
    if (hideExpired) r = r.filter(s => !s.expired);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(s => [s.user_name, s.user_email, s.user_role, s.dealer_name, s.ip, s.user_agent]
        .some(v => v && String(v).toLowerCase().includes(q)));
    }
    return r;
  }, [rows, search, hideExpired]);

  const stats = useMemo(() => {
    const live = rows.filter(s => !s.expired);
    return {
      active: live.length,
      users: new Set(live.map(s => s.user_id)).size,
      ips: new Set(live.map(s => s.ip).filter(Boolean)).size,
      admins: live.filter(s => s.user_role === "superadmin").length,
    };
  }, [rows]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Sessions &amp; Logins</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Current login sessions across the platform — user, device, location</p>
        </div>
        <button onClick={load}
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 12, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#4b5563" }}>Loading sessions…</div>
      ) : err ? (
        <div style={{ textAlign: "center", padding: 60, color: "#f87171", fontSize: 13 }}>Error: {err}</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
            <Card label="Active sessions" value={num(stats.active)} />
            <Card label="Signed-in users" value={num(stats.users)} accent="#93c5fd" />
            <Card label="Unique IPs" value={num(stats.ips)} accent="#c084fc" />
            <Card label="Superadmin sessions" value={num(stats.admins)} accent={stats.admins > 0 ? "#facc15" : "#f0f0f0"} />
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user, dealer, IP, device…"
              style={{ width: 280, maxWidth: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 12, padding: "6px 10px", borderRadius: 6, outline: "none", fontFamily: "inherit" }} />
            <button onClick={() => setHideExpired(v => !v)}
              style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                background: hideExpired ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${hideExpired ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.08)"}`,
                color: hideExpired ? "#f87171" : "#9ca3af" }}>
              {hideExpired ? "Hiding expired" : "Showing expired"}
            </button>
            <span style={{ fontSize: 12, color: "#4b5563", marginLeft: "auto" }}>{visible.length} shown</span>
          </div>

          {visible.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#374151" }}>
              <p style={{ fontSize: 14, color: "#4b5563" }}>No sessions match.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visible.map(s => {
                const open = expanded === s.id;
                const admin = s.user_role === "superadmin";
                return (
                  <div key={s.id} style={{ background: "#0d1117", border: `1px solid ${admin ? "rgba(250,204,21,0.22)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, overflow: "hidden" }}>
                    <button onClick={() => setExpanded(open ? null : s.id)}
                      style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "12px 14px", fontFamily: "inherit", display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 600 }}>{s.user_name || "unknown"}</span>
                          {s.user_role && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: admin ? "rgba(250,204,21,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${admin ? "rgba(250,204,21,0.35)" : "rgba(255,255,255,0.1)"}`, color: admin ? "#facc15" : "#9ca3af" }}>{s.user_role}</span>}
                          {s.expired && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280" }}>EXPIRED</span>}
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>
                          {device(s.user_agent)} · {s.ip || "no ip"}
                          {s.dealer_name && <span style={{ color: "#475569" }}> · {s.dealer_name}</span>}
                          {" · "}<span style={{ color: "#475569" }}>seen {timeAgo(s.last_seen)}</span>
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        {s.action_count > 0 && <span style={{ fontSize: 11, color: "#93c5fd" }}>{num(s.action_count)} actions</span>}
                        <span style={{ color: "#475569", fontSize: 13 }}>{open ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {open && (
                      <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 4 }}>
                          <Detail label="Email" value={s.user_email} mono />
                          <Detail label="IP" value={s.ip} mono />
                          <Detail label="Assurance level" value={s.aal} />
                          <Detail label="Signed in" value={s.created_at ? new Date(s.created_at).toLocaleString("en-MY") : null} />
                          <Detail label="Last seen" value={s.last_seen ? new Date(s.last_seen).toLocaleString("en-MY") : null} />
                          <Detail label="Expires" value={s.not_after ? new Date(s.not_after).toLocaleString("en-MY") : null} />
                          <Detail label="Logged actions" value={s.action_count != null ? String(s.action_count) : null} />
                          <Detail label="Last action" value={s.last_action_at ? new Date(s.last_action_at).toLocaleString("en-MY") : null} />
                        </div>
                        <Detail label="Session id" value={s.id} mono />
                        <Detail label="User agent" value={s.user_agent} mono />
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
