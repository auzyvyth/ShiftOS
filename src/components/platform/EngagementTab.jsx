import React, { useEffect, useState } from "react";
import { platformClient as supabase } from "../../lib/platformClient";
import InfoHint from "../ui/InfoHint";

// XDrive Ops — app engagement, as opposed to FunnelTab's marketplace-buyer
// traffic. Reads the superadmin-guarded RPC get_platform_engagement so no
// broad client SELECT touches push_subscriptions (owner-only RLS — a
// superadmin .from() read comes back an EMPTY ARRAY WITH NO ERROR, same trap
// documented in BuyersTab.jsx) or auth.users (anon key cannot select it).

const RANGES = [
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
];

function pctDelta(cur, prev) {
  if (prev == null || prev === 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 100);
}

function Delta({ cur, prev }) {
  const d = pctDelta(cur, prev);
  if (d == null) return <span style={{ fontSize: 11, color: "#4b5563" }}>—</span>;
  const up = d >= 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: up ? "#4ade80" : "#f87171" }}>
      {up ? "▲" : "▼"} {Math.abs(d)}%
    </span>
  );
}

function StatTile({ label, value, cur, prev, sub, accent }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "18px 20px", minWidth: 0 }}>
      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: accent || "#f0f0f0", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em", lineHeight: 1, wordBreak: "break-word", overflowWrap: "anywhere" }}>
        {value}
      </p>
      <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        {cur !== undefined && <><Delta cur={cur} prev={prev} /> <span style={{ fontSize: 10, color: "#4b5563" }}>vs prev</span></>}
        {sub && <span style={{ fontSize: 10, color: "#4b5563" }}>{sub}</span>}
      </div>
    </div>
  );
}

function num(n) {
  return Number(n || 0).toLocaleString("en-MY");
}

function Section({ title, hint, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, display: "flex", alignItems: "center" }}>
        {title}
        {hint && <InfoHint text={hint} />}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

export default function EngagementTab() {
  const [range, setRange] = useState("30");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      const to = new Date();
      const from = new Date(Date.now() - Number(range) * 86400000);
      const { data, error } = await supabase.rpc("get_platform_engagement", {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (cancelled) return;
      if (error) { setErr(error.message); setLoading(false); return; }
      setData(data);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [range]);

  const push = data?.push || {};
  const pwa = data?.pwa || {};
  const ops = data?.ops || {};
  const activePct = ops.total_accounts > 0 ? Math.round((ops.active_in_range / ops.total_accounts) * 100) : null;
  const pushPct = ops.total_accounts > 0 ? Math.round((push.total_users / ops.total_accounts) * 100) : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Engagement</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>How dealers and salesmen actually use the app — not marketplace buyer traffic (see Funnel for that)</p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 3 }}>
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit",
                background: range === r.key ? "rgba(220,38,38,0.15)" : "transparent",
                color: range === r.key ? "#f87171" : "#9ca3af", transition: "all 0.15s" }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#4b5563" }}>Loading engagement…</div>
      ) : err ? (
        <div style={{ textAlign: "center", padding: 60, color: "#f87171", fontSize: 13 }}>Error: {err}</div>
      ) : (
        <>
          <Section title="Active accounts" hint="Dealers, salesmen and staff who signed in during the selected range, out of every non-buyer account on the platform. Buyer accounts are covered separately in the Buyers tab.">
            <StatTile label="Active in range" value={num(ops.active_in_range)} cur={ops.active_in_range} prev={ops.prev_active}
              sub={activePct != null ? `${activePct}% of ${num(ops.total_accounts)} accounts` : null} accent="#4ade80" />
            <StatTile label="Total operator accounts" value={num(ops.total_accounts)} accent="#93c5fd" />
          </Section>

          <Section title="Push notifications" hint="Devices subscribed to web push (send-push edge function). A dealer or salesman with the app open on two phones counts as two devices but one user.">
            <StatTile label="Subscribed users" value={num(push.total_users)}
              sub={pushPct != null ? `${pushPct}% of ${num(ops.total_accounts)} accounts` : null} accent="#c084fc" />
            <StatTile label="Subscribed devices" value={num(push.total_devices)} accent="#c084fc" />
            <StatTile label="New devices in range" value={num(push.new_devices)} cur={push.new_devices} prev={push.prev_new_devices} accent="#facc15" />
          </Section>

          <Section title="Add to home screen" hint="Counts a real install: the Android 'appinstalled' event, or (since iOS has no such event) the first time the app is launched in standalone/home-screen mode on a device that hasn't been counted yet. One-time per device — reinstalling the same device does not double count.">
            <StatTile label="Total installs" value={num(pwa.total_installs)} accent="#4ade80" />
            <StatTile label="New installs in range" value={num(pwa.new_installs)} cur={pwa.new_installs} prev={pwa.prev_new_installs} accent="#facc15" />
          </Section>
        </>
      )}
    </div>
  );
}
