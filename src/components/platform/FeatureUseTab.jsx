import React, { useEffect, useState } from "react";
import { platformClient as supabase } from "../../lib/platformClient";

// USAGE-1 (IDEA-43): which features do sellers use, so the owner knows what to improve or cut.
// Counts only, last 30 days, and only sellers who said yes to the popup (UsageConsentHost). The
// database does the counting (get_feature_usage, migration 20261120d): no name ever reaches this page.

export default function FeatureUseTab() {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading"); // loading | ok | notlive | error

  useEffect(() => {
    let live = true;
    supabase.rpc("get_feature_usage").then(({ data: d, error }) => {
      if (!live) return;
      if (error) { setState(error.code === "PGRST202" || error.code === "42883" ? "notlive" : "error"); return; }
      setData(d); setState("ok");
    });
    return () => { live = false; };
  }, []);

  const card = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px" };
  const head = (
    <div style={{ marginBottom: 14 }}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Feature use</p>
      <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#6b7280" }}>
        How many sellers used each feature in the last 30 days. Counts only, never a name, and only sellers who said yes to the question.
      </p>
    </div>
  );

  if (state === "loading") return <div>{head}<p style={{ color: "#4b5563", fontSize: 13 }}>Loading...</p></div>;
  if (state === "notlive") return <div>{head}<div style={card}><p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Not live yet: the database update <code>20261120d</code> has not been applied.</p></div></div>;
  if (state === "error") return <div>{head}<div style={card}><p style={{ margin: 0, fontSize: 13, color: "#f87171" }}>Could not load the counts. Try Refresh in a moment.</p></div></div>;

  const { said_yes = 0, said_no = 0, total = 0, features = [] } = data || {};
  const notAsked = Math.max(0, total - said_yes - said_no);
  const few = said_yes < 5;
  const max = Math.max(1, said_yes);

  return (
    <div>
      {head}
      <div style={{ ...card, marginBottom: 14, display: "flex", flexWrap: "wrap", gap: "6px 22px", fontSize: 13 }}>
        <span style={{ color: "#e5e7eb" }}><b>{said_yes}</b> of {total} sellers said yes</span>
        <span style={{ color: "#9ca3af" }}>{said_no} said no</span>
        <span style={{ color: "#9ca3af" }}>{notAsked} not answered yet</span>
      </div>
      {few && (
        <p role="note" style={{ margin: "0 0 14px", fontSize: 12.5, color: "#fbbf24", lineHeight: 1.5 }}>
          Only {said_yes} {said_yes === 1 ? "seller has" : "sellers have"} said yes, so these numbers say very little yet. Do not cut anything on this alone.
        </p>
      )}
      <div style={{ ...card, padding: "4px 16px" }}>
        {features.map((f) => (
          <div key={f.feature} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ flex: "0 0 190px", minWidth: 0, fontSize: 13, color: f.sellers ? "#e5e7eb" : "#6b7280" }}>{f.feature}</span>
            <span aria-hidden="true" style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.05)", overflow: "hidden", minWidth: 40 }}>
              <span style={{ display: "block", height: "100%", width: `${Math.round((f.sellers / max) * 100)}%`, background: "#9ca3af" }} />
            </span>
            <span style={{ flex: "0 0 92px", textAlign: "right", fontSize: 12.5, fontVariantNumeric: "tabular-nums", color: f.sellers ? "#e5e7eb" : "#6b7280" }}>
              {f.sellers ? `${f.sellers} ${f.sellers === 1 ? "seller" : "sellers"}` : "nobody"}
            </span>
          </div>
        ))}
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "#4b5563", lineHeight: 1.5 }}>
        "Nobody" means nobody who said yes used it in 30 days. Some features leave no record to count (Performance, Outreach, Feedback, Budget finder), so they are not listed.
      </p>
    </div>
  );
}
