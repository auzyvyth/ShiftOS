import React, { useEffect, useState } from "react";
import { platformClient as supabase } from "../../lib/platformClient";

// XDrive Ops — buyer-submitted listing reports from the public marketplace.
//
// Reads admin_list_listing_reports() and writes through
// admin_resolve_listing_report(); both are superadmin-guarded SECURITY DEFINER
// RPCs, so no broad SELECT policy on profiles/car_listings is needed for the
// reporter and seller identity shown here.
//
// Reports are INERT by design: nothing on this screen, and nothing behind it,
// penalises a listing or its dealer automatically. Report volume is never a
// signal — on a multi-dealer marketplace that would be a griefing vector
// (dealer A buries dealer B). Acting on a listing stays a separate, deliberate
// step in the review queue.

const REASON_LABELS = {
  sold_elsewhere:  "Already sold / unavailable",
  wrong_info:      "Wrong or misleading details",
  scam_suspicious: "Looks like a scam",
  duplicate:       "Duplicate listing",
  offensive:       "Offensive / inappropriate",
  other:           "Something else",
};

const STATUS_STYLE = {
  open:      { bg: "rgba(220,38,38,0.12)",   bd: "rgba(220,38,38,0.35)",  fg: "#f87171" },
  reviewing: { bg: "rgba(234,179,8,0.12)",   bd: "rgba(234,179,8,0.32)",  fg: "#fbbf24" },
  resolved:  { bg: "rgba(34,197,94,0.12)",   bd: "rgba(34,197,94,0.3)",   fg: "#4ade80" },
  dismissed: { bg: "rgba(255,255,255,0.05)", bd: "rgba(255,255,255,0.1)", fg: "#9ca3af" },
};

const FILTERS = ["open", "reviewing", "resolved", "dismissed", "all"];

function timeAgo(str) {
  if (!str) return "—";
  const s = Math.floor((Date.now() - new Date(str)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ReportsTab() {
  const [reports, setReports]   = useState([]);
  const [filter, setFilter]     = useState("open");
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState(null);
  const [actioning, setActioning] = useState(null);
  const [notes, setNotes]       = useState({});

  async function load() {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.rpc("admin_list_listing_reports", { p_status: null });
    if (error) { setErr(error.message); setLoading(false); return; }
    setReports(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function resolve(id, status) {
    setActioning(id);
    const { error } = await supabase.rpc("admin_resolve_listing_report", {
      p_report_id: id,
      p_status: status,
      p_admin_note: notes[id] || null,
    });
    setActioning(null);
    if (error) { setErr(error.message); return; }
    setNotes(n => { const next = { ...n }; delete next[id]; return next; });
    await load();
  }

  const shown = filter === "all" ? reports : reports.filter(r => r.status === filter);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Listing Reports</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
          Buyer-submitted reports from the public marketplace. Volume has no automatic effect on a listing or its seller — you decide.
        </p>
      </div>

      {err && (
        <div style={{ marginBottom: 14, padding: "10px 13px", borderRadius: 9, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", color: "#f87171", fontSize: 12 }}>
          {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map(f => {
          const n = f === "all" ? reports.length : reports.filter(r => r.status === f).length;
          const on = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: on ? 700 : 500, textTransform: "capitalize", cursor: "pointer", fontFamily: "inherit", background: on ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${on ? "rgba(220,38,38,0.35)" : "rgba(255,255,255,0.07)"}`, color: on ? "#f87171" : "#9ca3af" }}>
              {f} ({n})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#4b5563", fontSize: 13 }}>Loading…</div>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#4b5563", fontSize: 13, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
          No {filter === "all" ? "" : filter} reports.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shown.map(r => {
            const snap = r.listing_snapshot || {};
            const carName = [snap.year, snap.brand, snap.model, snap.variant].filter(Boolean).join(" ") || "Listing";
            const st = STATUS_STYLE[r.status] || STATUS_STYLE.dismissed;
            const busy = actioning === r.id;
            const isClosed = r.status === "resolved" || r.status === "dismissed";
            return (
              <div key={r.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
                      {REASON_LABELS[r.reason] || r.reason}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: "#6b7280" }}>{timeAgo(r.created_at)}</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.06em", background: st.bg, border: `1px solid ${st.bd}`, color: st.fg, flexShrink: 0 }}>
                    {r.status}
                  </span>
                </div>

                {r.note && (
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                    {r.note}
                  </p>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 14 }}>
                  <div>
                    <p style={{ margin: "0 0 3px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.09em", color: "#6b7280", fontWeight: 700 }}>Listing</p>
                    <p style={{ margin: 0, fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{carName}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>
                      {snap.selling_price ? `RM ${Number(snap.selling_price).toLocaleString("en-MY")}` : "Price n/a"}
                      {" · "}
                      {r.listing_exists
                        ? <span style={{ color: "#9ca3af" }}>{r.listing_status}</span>
                        : <span style={{ color: "#f87171" }}>deleted since report</span>}
                    </p>
                    {r.listing_exists && r.listing_slug && (
                      <a href={`/cars/${r.listing_slug}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: "#f87171", textDecoration: "none", fontWeight: 600 }}>
                        Open listing →
                      </a>
                    )}
                  </div>
                  <div>
                    <p style={{ margin: "0 0 3px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.09em", color: "#6b7280", fontWeight: 700 }}>Seller</p>
                    <p style={{ margin: 0, fontSize: 13, color: "#e2e8f0" }}>{r.dealer_name || "—"}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280", wordBreak: "break-all" }}>{r.dealer_email || ""}</p>
                    {r.dealer_subdomain && (
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>{r.dealer_subdomain}.xdrive.my</p>
                    )}
                  </div>
                  <div>
                    <p style={{ margin: "0 0 3px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.09em", color: "#6b7280", fontWeight: 700 }}>Reported by</p>
                    <p style={{ margin: 0, fontSize: 13, color: "#e2e8f0" }}>{r.reporter_name || "—"}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280", wordBreak: "break-all" }}>{r.reporter_email || ""}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: Number(r.reporter_total_reports) > 5 ? "#fbbf24" : "#6b7280" }}>
                      {r.reporter_total_reports} report{Number(r.reporter_total_reports) === 1 ? "" : "s"} all-time
                    </p>
                  </div>
                </div>

                {r.admin_note && (
                  <p style={{ margin: "0 0 12px", fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
                    Your note: {r.admin_note}
                  </p>
                )}

                {!isClosed ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <input
                      value={notes[r.id] || ""}
                      onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                      placeholder="Note (optional)"
                      className="adm-input"
                      style={{ flex: 1, minWidth: 160 }}
                    />
                    {r.status !== "reviewing" && (
                      <button disabled={busy} onClick={() => resolve(r.id, "reviewing")}
                        style={{ fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.28)", color: "#fbbf24", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: "inherit" }}>
                        Reviewing
                      </button>
                    )}
                    <button disabled={busy} onClick={() => resolve(r.id, "resolved")}
                      style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 8, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: "inherit" }}>
                      {busy ? "…" : "Valid — actioned"}
                    </button>
                    <button disabled={busy} onClick={() => resolve(r.id, "dismissed")}
                      style={{ fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: "inherit" }}>
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>Closed {timeAgo(r.resolved_at)}</span>
                    <button disabled={busy} onClick={() => resolve(r.id, "open")}
                      style={{ fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: busy ? "not-allowed" : "pointer", marginLeft: "auto", fontFamily: "inherit" }}>
                      Reopen
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
