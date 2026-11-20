import React, { useEffect, useState } from "react";
import { platformClient as supabase } from "../../lib/platformClient";
import { humanLabel } from "../../utils/searchTracking";

// Drevo Ops — platform-wide marketplace funnel.
// Reads two superadmin-guarded RPCs (get_marketplace_funnel / get_marketplace_top)
// so no broad client SELECT touches analytics_events or leads.

const RANGES = [
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
];

// One sequential hue for the funnel flow — kept distinct from the red action
// chrome so data marks never read as buttons.
const DATA_HUE = "#60a5fa";

function pctDelta(cur, prev) {
  if (prev == null || prev === 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 100);
}

function Delta({ cur, prev, bad }) {
  const d = pctDelta(cur, prev);
  if (d == null) return <span style={{ fontSize: 11, color: "#4b5563" }}>—</span>;
  const up = d >= 0;
  // bad = a number where more is worse (searches that found nothing): flip the colours.
  const good = bad ? !up : up;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: good ? "#4ade80" : "#f87171" }}>
      {up ? "▲" : "▼"} {Math.abs(d)}%
    </span>
  );
}

function StatTile({ label, value, cur, prev, accent, bad }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "18px 20px", minWidth: 0 }}>
      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: accent || "#f0f0f0", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em", lineHeight: 1, wordBreak: "break-word", overflowWrap: "anywhere" }}>
        {value}
      </p>
      <div style={{ marginTop: 8 }}><Delta cur={cur} prev={prev} bad={bad} /> <span style={{ fontSize: 10, color: "#4b5563" }}>vs prev</span></div>
    </div>
  );
}

function num(n) {
  return Number(n || 0).toLocaleString("en-MY");
}

export default function FunnelTab() {
  const [range, setRange] = useState("30");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [top, setTop] = useState(null);
  const [landing, setLanding] = useState(null);
  const [search, setSearch] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      const to = new Date();
      const from = new Date(Date.now() - Number(range) * 86400000);
      const [f, t, l, sr] = await Promise.all([
        supabase.rpc("get_marketplace_funnel", { p_from: from.toISOString(), p_to: to.toISOString() }),
        supabase.rpc("get_marketplace_top", { p_from: from.toISOString(), p_to: to.toISOString(), p_limit: 8 }),
        supabase.rpc("get_landing_page_visits", { p_from: from.toISOString(), p_to: to.toISOString() }),
        // MET-1. Null until migration 20261120a is applied; the section then says so.
        supabase.rpc("get_marketplace_search", { p_from: from.toISOString(), p_to: to.toISOString(), p_limit: 8 }),
      ]);
      if (cancelled) return;
      if (f.error) { setErr(f.error.message); setLoading(false); return; }
      setFunnel(f.data);
      setTop(t.data || {});
      setLanding(l.data || null);
      setSearch(sr.error ? null : sr.data || null);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [range]);

  const prev = funnel?.prev || {};
  const stages = funnel ? [
    { label: "Store / page visits", value: funnel.visits, cur: funnel.visits, prevV: prev.visits, hint: "store_visit + page_view" },
    { label: "Car views", value: funnel.car_views, cur: funnel.car_views, prevV: prev.car_views, hint: "car_view" },
    { label: "Card clicks", value: funnel.card_clicks, cur: funnel.card_clicks, prevV: prev.card_clicks, hint: "card_click" },
    { label: "CTA clicks", value: funnel.cta, cur: funnel.cta, prevV: prev.cta, hint: "whatsapp + call + booking" },
    { label: "Leads created", value: funnel.leads, cur: funnel.leads, prevV: prev.leads, hint: "leads table" },
  ] : [];
  const maxV = stages.length ? Math.max(1, ...stages.map(s => s.value || 0)) : 1;

  // CTA -> lead conversion (headline efficiency metric).
  const ctaToLead = funnel && funnel.cta > 0 ? Math.round((funnel.leads / funnel.cta) * 100) : null;
  const viewToCta = funnel && funnel.car_views > 0 ? Math.round((funnel.cta / funnel.car_views) * 100) : null;

  return (
    <div>
      {/* Header + range picker */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Marketplace Funnel</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Platform-wide traffic → engagement → leads across every storefront on drevo.my</p>
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
        <div style={{ textAlign: "center", padding: 80, color: "#4b5563" }}>Loading funnel…</div>
      ) : err ? (
        <div style={{ textAlign: "center", padding: 60, color: "#f87171", fontSize: 13 }}>Error: {err}</div>
      ) : (
        <>
          {/* Headline tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
            <StatTile label="Visits" value={num(funnel.visits)} cur={funnel.visits} prev={prev.visits} />
            <StatTile label="Unique sessions" value={num(funnel.sessions)} cur={funnel.sessions} prev={null} accent="#93c5fd" />
            <StatTile label="CTA clicks" value={num(funnel.cta)} cur={funnel.cta} prev={prev.cta} accent="#c084fc" />
            <StatTile label="Leads" value={num(funnel.leads)} cur={funnel.leads} prev={prev.leads} accent="#4ade80" />
            <StatTile label="CTA → lead" value={ctaToLead == null ? "—" : `${ctaToLead}%`} cur={funnel.leads} prev={prev.leads} accent="#facc15" />
          </div>

          {/* Funnel bars with drop-off */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "22px 24px", marginBottom: 24 }}>
            <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 18 }}>Conversion funnel</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {stages.map((s, i) => {
                const w = Math.max(2, ((s.value || 0) / maxV) * 100);
                // Step conversion from the previous stage (how many carried through).
                const prevStage = i > 0 ? stages[i - 1].value || 0 : null;
                const stepPct = prevStage ? Math.round(((s.value || 0) / prevStage) * 100) : null;
                return (
                  <div key={s.label}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5, gap: 10 }}>
                      <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600 }}>
                        {s.label}
                        <span style={{ fontSize: 10, color: "#475569", fontWeight: 400, marginLeft: 8 }}>{s.hint}</span>
                      </span>
                      <span style={{ display: "flex", alignItems: "baseline", gap: 10, flexShrink: 0 }}>
                        {stepPct != null && (
                          <span style={{ fontSize: 11, color: stepPct >= 50 ? "#4ade80" : stepPct >= 20 ? "#facc15" : "#f87171", fontWeight: 700 }}>
                            {stepPct}%
                          </span>
                        )}
                        <span style={{ fontSize: 15, color: "#f1f5f9", fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.04em", minWidth: 52, textAlign: "right" }}>
                          {num(s.value)}
                        </span>
                        <Delta cur={s.cur} prev={s.prevV} />
                      </span>
                    </div>
                    <div style={{ height: 22, borderRadius: 5, background: "rgba(255,255,255,0.03)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${w}%`, borderRadius: 5, background: DATA_HUE, opacity: 0.85 - i * 0.1, transition: "width 0.4s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {viewToCta != null && (
              <p style={{ marginTop: 16, fontSize: 11, color: "#6b7280" }}>
                {viewToCta}% of car views convert to a CTA click · {ctaToLead == null ? "—" : `${ctaToLead}%`} of CTA clicks become a tracked lead
              </p>
            )}
          </div>

          {/* Top lists */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
            <TopTable title="Top cars" cols={["Car", "Views", "WA"]}
              rows={(top?.top_cars || []).map(c => [c.name, num(c.views), num(c.whatsapp)])}
              empty="No car views in range" />
            <TopTable title="Top dealers" cols={["Dealer", "Visits", "CTA"]}
              rows={(top?.top_dealers || []).map(d => [d.name, num(d.visits), num(d.cta)])}
              empty="No dealer traffic in range" />
            <TopTable title="Top traffic sources" cols={["Source", "Events"]}
              rows={(top?.top_sources || []).map(s => [s.source, num(s.events)])}
              empty="No traffic in range" />
          </div>

          {/* MET-1: what buyers ask for, and where the sign-in wall loses them. */}
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
              Search and sign-in wall
            </p>
            {!search ? (
              <p style={{ fontSize: 12, color: "#4b5563" }}>No search data yet (it starts once the analytics update is applied).</p>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
                  <StatTile label="Searches" value={num(search.searches)} cur={search.searches} prev={search.prev?.searches} accent="#93c5fd" />
                  <StatTile label="Found no car" value={search.searches > 0 ? `${Math.round((search.no_match / search.searches) * 100)}%` : "—"}
                    cur={search.no_match} prev={search.prev?.no_match} accent="#f87171" bad />
                  <StatTile label="Cars shown" value={num(search.impressions)} cur={search.impressions} prev={search.prev?.impressions} />
                  <StatTile label="Card click rate" value={search.impressions > 0 ? `${((search.card_clicks / search.impressions) * 100).toFixed(1)}%` : "—"}
                    cur={search.card_clicks} prev={search.prev?.card_clicks} accent="#c084fc" />
                  <StatTile label="Sign-in finished" value={search.signin_prompts > 0 ? `${Math.round((search.signin_done / search.signin_prompts) * 100)}%` : "—"}
                    cur={search.signin_done} prev={search.prev?.signin_done} accent="#4ade80" />
                  <StatTile label="Cars saved" value={num(search.saves)} cur={search.saves} prev={search.prev?.saves} accent="#facc15" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
                  <TopTable title="Top searches" cols={["Search", "Times", "No car"]}
                    rows={(search.top || []).map(r => [humanLabel(r.label), num(r.count), num(r.no_match)])}
                    empty="No searches in range" />
                  <TopTable title="Wanted, not found" cols={["Search", "Times"]}
                    rows={(search.top_no_match || []).map(r => [humanLabel(r.label), num(r.count)])}
                    empty="Every search found a car" />
                </div>
                <p style={{ marginTop: 10, fontSize: 11, color: "#4b5563" }}>
                  Counts only visitors who accepted analytics. Sign-in finished = people who were asked to sign in (chat, save) and did.
                </p>
              </>
            )}
          </div>

          {/* Marketing / signup landing pages — pre-signup traffic, kept
              separate from marketplace storefront visits above. */}
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
              Marketing pages
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
              <StatTile label="DrevoOS page (/shiftos)" value={num(landing?.shiftos?.visits)}
                cur={landing?.shiftos?.visits} prev={landing?.shiftos?.prev_visits} accent="#4ade80" />
              <StatTile label="For Salesmen page (/for-salesmen)" value={num(landing?.for_salesmen?.visits)}
                cur={landing?.for_salesmen?.visits} prev={landing?.for_salesmen?.prev_visits} accent="#facc15" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TopTable({ title, cols, rows, empty }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
      <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", padding: "16px 18px 10px" }}>{title}</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {cols.map((c, i) => (
                <th key={c} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 18px", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length} style={{ textAlign: "center", padding: 28, color: "#4b5563", fontSize: 12 }}>{empty}</td></tr>
            ) : rows.map((r, ri) => (
              <tr key={ri} style={{ borderBottom: ri < rows.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                {r.map((cell, ci) => (
                  <td key={ci} style={{ padding: "9px 18px", textAlign: ci === 0 ? "left" : "right",
                    color: ci === 0 ? "#e5e7eb" : "#9ca3af", fontWeight: ci === 0 ? 600 : 500,
                    maxWidth: ci === 0 ? 180 : "auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
