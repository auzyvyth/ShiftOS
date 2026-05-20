import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function AiQuotaBadge({ userId, feature, limit = 50 }) {
  const [used, setUsed] = useState(null);

  useEffect(() => {
    if (!userId) return;
    const col = `${feature}_count`;
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from("ai_salesman_usage")
      .select(col)
      .eq("salesman_id", userId)
      .eq("usage_date", today)
      .maybeSingle()
      .then(({ data }) => setUsed(data?.[col] ?? 0));
  }, [userId, feature]);

  if (used === null) return null;

  return (
    <span
      style={{
        fontSize: 10,
        color: used >= limit ? "#f87171" : "#4b5563",
        background: used >= limit ? "rgba(220,38,38,0.1)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${used >= limit ? "rgba(220,38,38,0.2)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 99,
        padding: "2px 8px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {used} / {limit} {feature} used today
    </span>
  );
}
