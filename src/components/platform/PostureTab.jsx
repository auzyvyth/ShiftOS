import React, { useEffect, useState } from "react";
import { platformClient as supabase } from "../../lib/platformClient";
import InfoHint from "../ui/InfoHint";

// Security console — posture dashboard. Reads the superadmin-guarded
// get_security_posture RPC, which computes live DB checks (RLS coverage, owner-run
// views, storage privacy, audit-log lockdown) and reads the security_posture
// attestation table for out-of-band checks (headers, Sentry masking, leaked-password,
// dependency audit) that CI / an edge function keeps current.

const STATUS = {
  ok:      { color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.25)",  dot: "#4ade80", label: "OK" },
  warn:    { color: "#facc15", bg: "rgba(250,204,21,0.08)",  border: "rgba(250,204,21,0.25)",  dot: "#facc15", label: "Review" },
  fail:    { color: "#f87171", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",    dot: "#f87171", label: "Fail" },
  unknown: { color: "#9ca3af", bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.1)",  dot: "#6b7280", label: "Unknown" },
};

const ORDER = { fail: 0, warn: 1, unknown: 2, ok: 3 };

function timeAgo(str) {
  if (!str) return null;
  const s = Math.floor((Date.now() - new Date(str)) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function PostureTab() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [checks, setChecks] = useState([]);
  const [expanded, setExpanded] = useState(null);

  async function load() {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.rpc("get_security_posture");
    if (error) { setErr(error.message); setLoading(false); return; }
    setChecks(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const counts = checks.reduce((a, c) => { a[c.status] = (a[c.status] || 0) + 1; return a; }, {});
  const groups = {};
  for (const c of checks) (groups[c.category] = groups[c.category] || []).push(c);
  const sortedChecks = arr => [...arr].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Security Posture
            <InfoHint title="How to read this" text="A health check of the app's security. Green = good, Yellow = worth a look, Red = fix it, Grey = can't auto-check / not applicable. Cards marked 'live' are re-checked against the database every time you open this screen; the rest are 'attested' facts (like website settings) with a last-updated time. Tap any card for what to do about it." />
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Live checks + attestations of the platform's hardening state</p>
        </div>
        <button onClick={load}
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 12, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
          ↻ Re-check
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#4b5563" }}>Running checks…</div>
      ) : err ? (
        <div style={{ textAlign: "center", padding: 60, color: "#f87171", fontSize: 13 }}>Error: {err}</div>
      ) : (
        <>
          {/* Roll-up */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
            {["fail", "warn", "unknown", "ok"].map(k => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, background: STATUS[k].bg, border: `1px solid ${STATUS[k].border}`, borderRadius: 10, padding: "8px 14px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS[k].dot }} />
                <span style={{ fontSize: 20, fontWeight: 700, color: STATUS[k].color, fontFamily: "'Bebas Neue',sans-serif" }}>{counts[k] || 0}</span>
                <span style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>{STATUS[k].label}</span>
              </div>
            ))}
          </div>

          {Object.keys(groups).sort().map(cat => (
            <div key={cat} style={{ marginBottom: 22 }}>
              <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 10 }}>{cat}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
                {sortedChecks(groups[cat]).map(c => {
                  const st = STATUS[c.status] || STATUS.unknown;
                  const open = expanded === c.key;
                  return (
                    <div key={c.key} onClick={() => setExpanded(open ? null : c.key)}
                      style={{ background: st.bg, border: `1px solid ${st.border}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{c.label}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: st.color, fontWeight: 600 }}>{c.value}</p>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: st.color, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
                          {c.live ? "live" : (timeAgo(c.checked_at) || "attested")}
                        </span>
                      </div>
                      {open && c.detail && (
                        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#cbd5e1", lineHeight: 1.5, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                          {c.detail}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <p style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>Tap a card for the remediation note. "live" checks run against the DB on each load; the rest are attestations updated out-of-band.</p>
        </>
      )}
    </div>
  );
}
