import React, { useEffect, useState } from "react";
import { platformClient as supabase } from "../../lib/platformClient";
import { ENQUIRY_OPTIONS } from "../../config/sensusCopy";

// SENSUS-1: demo requests from /sensus-ai (migration 20261017a). Each one has
// already reached the owner as a Telegram + push alert (notify_ops); this is the
// list to work through. Kept apart from Prospects on purpose: those are XDrive
// signups, these are Sensus sales, and the prospect triggers would mislabel them.
// Messaging is a wa.me link the owner sends by hand.

const STATUSES = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "booked", label: "Demo booked" },
  { id: "demo_done", label: "Demo done" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];
const ENQ = Object.fromEntries(ENQUIRY_OPTIONS.map((o) => [o.id, o.label]));
const fmt = (d) => new Date(d).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

export default function SensusDemosTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("sensus_demo_requests")
      .select("id,name,dealership,role,phone,monthly_enquiries,note,source,status,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (e) setError(e.message); else { setRows(data || []); setError(""); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error: e } = await supabase.from("sensus_demo_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (e) { setRows(prev); setError(e.message); }
  };

  const wa = (r) => `https://wa.me/${r.phone}?text=${encodeURIComponent(`Hi ${r.name}, thanks for requesting a Sensus AI demo for ${r.dealership}. When suits you for 20 minutes this week?`)}`;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Requests from /sensus-ai. Each one also arrives as an ops alert.</div>
        <button onClick={load} style={{ background: "transparent", color: "inherit", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>Refresh</button>
      </div>
      {error && <div style={{ color: "#fca5a5", fontSize: 13 }}>Couldn't load: {error}</div>}
      {loading && !rows.length ? <div style={{ opacity: 0.6 }}>Loading...</div> : !rows.length && !error ? (
        <div style={{ opacity: 0.6 }}>No demo requests yet.</div>
      ) : rows.map((r) => (
        <div key={r.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, display: "grid", gap: 6, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{r.name}{r.role ? <span style={{ fontWeight: 400, opacity: 0.6 }}> · {r.role}</span> : null}</div>
              <div style={{ opacity: 0.75, fontSize: 14 }}>{r.dealership}</div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.55 }}>{fmt(r.created_at)}</div>
          </div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            +{r.phone} · Enquiries a month: {ENQ[r.monthly_enquiries] || "not given"}{r.source ? ` · from ${r.source}` : ""}
          </div>
          {r.note && <div style={{ fontSize: 13, opacity: 0.8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.note}</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} style={{ background: "#111318", color: "inherit", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 8px" }}>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <a href={wa(r)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#86efac" }}>WhatsApp</a>
          </div>
        </div>
      ))}
    </div>
  );
}
