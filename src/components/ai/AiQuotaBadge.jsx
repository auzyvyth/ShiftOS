import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

// Daily caps — MUST mirror salesman_ai_quota_ok() in the DB, or the badge lies
// about how many uses remain.
export const AI_QUOTA_LIMITS = { caption: 50, wa_reply: 50, rescore: 20, followup: 30 };

export default function AiQuotaBadge({ userId, feature, limit }) {
  const [used, setUsed] = useState(null);
  const cap = limit ?? AI_QUOTA_LIMITS[feature] ?? 50;

  useEffect(() => {
    if (!userId) return;
    const col = `${feature}_count`;
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from("ai_salesman_usage")
      .select(col)
      .eq("salesman_id", userId)
      .eq("date", today)
      .maybeSingle()
      .then(({ data }) => setUsed(data?.[col] ?? 0));
  }, [userId, feature]);

  if (used === null) return null;

  return (
    <span
      style={{
        fontSize: 10,
        color: used >= cap ? "#f87171" : "#4b5563",
        background: used >= cap ? "rgba(220,38,38,0.1)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${used >= cap ? "rgba(220,38,38,0.2)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 99,
        padding: "2px 8px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {used} / {cap} {feature} used today
    </span>
  );
}
