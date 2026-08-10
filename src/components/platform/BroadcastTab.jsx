import React, { useEffect, useMemo, useState } from "react";
import { platformClient as supabase } from "../../lib/platformClient";
import { PLAN_CONFIG } from "../../utils/planConfig";

// XDrive Ops — in-app broadcast (warnings/announcements). Fans out to every
// recipient's notification bell via the superadmin-guarded broadcast_notification
// RPC (one call, server-side fan-out). Email channel is intentionally deferred.

function planLabel(p) { return PLAN_CONFIG[p]?.label || p; }

// Three distinct salesman kinds (mirrors the AdminPage Salesmen tab grouping):
//   lite = standalone Salesman Lite, solo = solo Premium (no dealer),
//   team = Premium under a dealer (SalesmanPanel).
function salesmanKind(s) {
  if (s.plan === "salesman_lite") return { key: "lite", label: "Lite", color: "#fbbf24" };
  if (s.plan === "salesman_full" && !s.dealer_id) return { key: "solo", label: "Premium", color: "#c084fc" };
  if (s.plan === "salesman_full" && s.dealer_id) return { key: "team", label: "Under dealer", color: "#34d399" };
  return { key: "other", label: "Salesman", color: "#9ca3af" };
}

const SALES_SEGS = [
  { key: "all", label: "All" },
  { key: "lite", label: "Lite" },
  { key: "solo", label: "Premium" },
  { key: "team", label: "Under dealer" },
];

function timeAgo(str) {
  if (!str) return "—";
  const s = Math.floor((Date.now() - new Date(str)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function BroadcastTab({ dealers = [], salesmen = [] }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [salesSeg, setSalesSeg] = useState("all");
  const [plan, setPlan] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [pickSearch, setPickSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [history, setHistory] = useState([]);

  // Exclude the superadmin's own row from broadcast targets.
  const dealersOnly = useMemo(
    () => dealers.filter(d => d.role !== "superadmin" && d.is_active !== false),
    [dealers]
  );
  const salesmenActive = useMemo(() => salesmen.filter(s => s.is_active !== false), [salesmen]);

  const planOptions = useMemo(() => {
    const set = new Set();
    [...dealersOnly, ...salesmenActive].forEach(p => { if (p.plan) set.add(p.plan); });
    return [...set];
  }, [dealersOnly, salesmenActive]);

  // Everyone selectable for the hand-picked audience, each tagged by kind.
  const pickList = useMemo(() => {
    const rows = [
      ...dealersOnly.map(d => ({ id: d.id, name: d.dealership || d.full_name || d.email, sub: d.email, kindLabel: "Dealer", kindColor: "#60a5fa" })),
      ...salesmenActive.map(s => { const k = salesmanKind(s); return { id: s.id, name: s.full_name || s.email, sub: s.email, kindLabel: k.label, kindColor: k.color }; }),
    ];
    if (!pickSearch.trim()) return rows;
    const q = pickSearch.toLowerCase();
    return rows.filter(r => [r.name, r.sub].some(v => v && v.toLowerCase().includes(q)));
  }, [dealersOnly, salesmenActive, pickSearch]);

  // The audience value actually sent to the RPC (salesman segment resolves here).
  const effAudience = useMemo(() => {
    if (audience !== "salesmen" || salesSeg === "all") return audience;
    return salesSeg === "lite" ? "salesmen_lite" : salesSeg === "solo" ? "salesmen_solo" : "salesmen_team";
  }, [audience, salesSeg]);

  const estimate = useMemo(() => {
    if (audience === "all") return dealersOnly.length + salesmenActive.length;
    if (audience === "dealers") return dealersOnly.length;
    if (audience === "salesmen") {
      if (salesSeg === "all") return salesmenActive.length;
      return salesmenActive.filter(s => salesmanKind(s).key === salesSeg).length;
    }
    if (audience === "plan") return [...dealersOnly, ...salesmenActive].filter(p => p.plan === plan).length;
    if (audience === "ids") return selectedIds.size;
    return 0;
  }, [audience, salesSeg, plan, selectedIds, dealersOnly, salesmenActive]);

  async function loadHistory() {
    const { data } = await supabase
      .from("platform_broadcasts")
      .select("id, audience, plan, title, body, recipient_count, created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    setHistory(data || []);
  }
  useEffect(() => { loadHistory(); }, []);

  // Explain a disabled Send button instead of leaving it silently greyed out.
  const disabledReason = useMemo(() => {
    if (!title.trim()) return "Enter a title to send.";
    if (audience === "plan" && !plan) return "Choose a plan.";
    if (audience === "ids" && selectedIds.size === 0) return "Select at least one recipient.";
    if (estimate === 0) return "No active recipients match this audience.";
    return null;
  }, [title, audience, plan, selectedIds, estimate]);

  const canSend = !disabledReason && !sending;

  async function send() {
    setErr(null);
    setResult(null);
    setSending(true);
    const { data, error } = await supabase.rpc("broadcast_notification", {
      p_title: title.trim(),
      p_body: body.trim() || null,
      p_audience: effAudience,
      p_plan: audience === "plan" ? plan : null,
      p_ids: audience === "ids" ? [...selectedIds] : null,
    });
    setSending(false);
    if (error) { setErr(error.message); return; }
    setResult(data);
    setTitle(""); setBody(""); setSelectedIds(new Set());
    loadHistory();
  }

  const AUD = [
    { key: "all", label: "Everyone" },
    { key: "dealers", label: "Dealers" },
    { key: "salesmen", label: "Salesmen" },
    { key: "plan", label: "By plan" },
    { key: "ids", label: "Hand-picked" },
  ];

  const inputStyle = { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#f1f5f9", fontSize: 13, padding: "9px 12px", borderRadius: 8, outline: "none", fontFamily: "inherit" };

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Broadcast</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
          Send an in-app warning or announcement to users&apos; notification bells. Email channel is disabled until the Resend secret is set.
        </p>
      </div>

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "20px 22px", marginBottom: 24 }}>
        {/* Audience */}
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Audience</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {AUD.map(a => (
            <button key={a.key} onClick={() => setAudience(a.key)}
              style={{ fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                background: audience === a.key ? "rgba(220,38,38,0.14)" : "rgba(255,255,255,0.03)",
                border: audience === a.key ? "1px solid rgba(220,38,38,0.35)" : "1px solid rgba(255,255,255,0.08)",
                color: audience === a.key ? "#f87171" : "#9ca3af" }}>
              {a.label}
            </button>
          ))}
        </div>

        {/* Salesman segment sub-picker */}
        {audience === "salesmen" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {SALES_SEGS.map(seg => {
              const n = seg.key === "all" ? salesmenActive.length : salesmenActive.filter(s => salesmanKind(s).key === seg.key).length;
              const on = salesSeg === seg.key;
              return (
                <button key={seg.key} onClick={() => setSalesSeg(seg.key)}
                  style={{ fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
                    background: on ? "rgba(255,255,255,0.07)" : "transparent",
                    border: on ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.07)",
                    color: on ? "#e5e7eb" : "#6b7280" }}>
                  {seg.label} <span style={{ color: on ? "#9ca3af" : "#4b5563" }}>({n})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Plan sub-picker */}
        {audience === "plan" && (
          <select value={plan} onChange={e => setPlan(e.target.value)} style={{ ...inputStyle, cursor: "pointer", marginBottom: 14 }}>
            <option value="">Select a plan…</option>
            {planOptions.map(p => <option key={p} value={p}>{planLabel(p)}</option>)}
          </select>
        )}

        {/* Hand-picked sub-picker */}
        {audience === "ids" && (
          <div style={{ marginBottom: 14 }}>
            <input value={pickSearch} onChange={e => setPickSearch(e.target.value)} placeholder="Search dealers / salesmen…" style={{ ...inputStyle, marginBottom: 8 }} />
            <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8 }}>
              {pickList.length === 0 ? (
                <p style={{ padding: 16, textAlign: "center", color: "#4b5563", fontSize: 12 }}>No matches</p>
              ) : pickList.map(r => {
                const on = selectedIds.has(r.id);
                return (
                  <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer" }}>
                    <input type="checkbox" checked={on} onChange={e => setSelectedIds(prev => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(r.id); else next.delete(r.id);
                      return next;
                    })} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 12, color: "#e5e7eb", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                      <span style={{ display: "block", fontSize: 10, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</span>
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: r.kindColor, flexShrink: 0, whiteSpace: "nowrap" }}>{r.kindLabel}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Title */}
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120}
          placeholder="e.g. Scheduled maintenance tonight, 1–2am" style={{ ...inputStyle, marginBottom: 16 }} />

        {/* Body */}
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Message <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} maxLength={600}
          placeholder="Add detail shown under the title in the notification." style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5, marginBottom: 18 }} />

        {/* Send row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
          <button onClick={send} disabled={!canSend}
            style={{ fontSize: 13, fontWeight: 700, padding: "10px 24px", borderRadius: 9, cursor: canSend ? "pointer" : "not-allowed", fontFamily: "inherit",
              background: canSend ? "rgba(220,38,38,0.16)" : "rgba(255,255,255,0.03)",
              border: canSend ? "1px solid rgba(220,38,38,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: canSend ? "#f87171" : "#475569" }}>
            {sending ? "Sending…" : `Send to ${estimate} recipient${estimate === 1 ? "" : "s"}`}
          </button>
          {!sending && disabledReason && <span style={{ fontSize: 12, color: "#6b7280" }}>{disabledReason}</span>}
          {result && (
            <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>
              ✓ Sent — {result.dealers} dealer{result.dealers === 1 ? "" : "s"}, {result.salesmen} salesman{result.salesmen === 1 ? "" : "men"}
            </span>
          )}
          {err && <span style={{ fontSize: 12, color: "#f87171" }}>Error: {err}</span>}
        </div>
      </div>

      {/* History */}
      <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Recent broadcasts</p>
      {history.length === 0 ? (
        <p style={{ fontSize: 12, color: "#4b5563", padding: "16px 0" }}>No broadcasts sent yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {history.map(h => (
            <div key={h.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</p>
                <span style={{ fontSize: 10, color: "#475569", flexShrink: 0, whiteSpace: "nowrap" }}>{timeAgo(h.created_at)}</span>
              </div>
              {h.body && <p style={{ margin: "3px 0 0", fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.body}</p>}
              <p style={{ margin: "6px 0 0", fontSize: 10, color: "#6b7280" }}>
                <span style={{ color: "#9ca3af", fontWeight: 600 }}>{h.audience}{h.plan ? ` · ${planLabel(h.plan)}` : ""}</span>
                {" · "}{h.recipient_count} recipient{h.recipient_count === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
