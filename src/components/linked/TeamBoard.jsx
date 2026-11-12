// Linked-Premium "Team" tab: cars sold this month per salesman at the dealership.
// Names are shared, deals stay private (counts only). Moved from the old dealer
// SalesmanPanel (renderTeam), with two fixes found in the 2026-11-11 audit:
//  - suspended / deleted salesmen are left out (they used to sit on the board)
//  - the month starts on the 1st in Malaysia time, not the device's clock
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { premiumDark as PD } from "../../theme/tokens";

// 00:00 on the 1st of this month in Malaysia (UTC+8, no daylight saving), as an ISO string.
export function malaysiaMonthStartIso(now = new Date()) {
  const my = new Date(now.getTime() + 8 * 3600 * 1000);
  return new Date(Date.UTC(my.getUTCFullYear(), my.getUTCMonth(), 1) - 8 * 3600 * 1000).toISOString();
}

export default function TeamBoard({ dealerId, userId }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!dealerId) return undefined;
    let live = true;
    (async () => {
      const [{ data: team, error: tErr }, { data: sold, error: sErr }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, slug")
          .eq("dealer_id", dealerId).eq("role", "salesman")
          .or("is_active.is.null,is_active.eq.true")
          .or("account_status.is.null,account_status.neq.deleted"),
        supabase.from("car_listings").select("assigned_to")
          .eq("dealer_id", dealerId).eq("status", "sold").gte("sold_at", malaysiaMonthStartIso()),
      ]);
      if (!live) return;
      if (tErr || sErr) { setError(true); setRows([]); return; }
      const counts = {};
      (sold || []).forEach((c) => { if (c.assigned_to) counts[c.assigned_to] = (counts[c.assigned_to] || 0) + 1; });
      const list = (team || []).map((t) => ({ id: t.id, name: t.full_name || t.slug || "Salesman", units: counts[t.id] || 0, isMe: t.id === userId }))
        .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name));
      setRows(list);
    })();
    return () => { live = false; };
  }, [dealerId, userId]);

  const max = Math.max(1, ...(rows || []).map((r) => r.units));

  return (
    <div style={{ maxWidth: 760 }}>
      <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: PD.text }}>Team</p>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: PD.textMuted }}>Cars sold this month by each salesman. Names are shared, deals stay private.</p>
      {rows === null ? (
        <div style={{ background: PD.card, borderRadius: PD.radius.card, padding: 16, fontSize: 13, color: PD.textMuted }}>Loading...</div>
      ) : error ? (
        <div style={{ background: PD.card, borderRadius: PD.radius.card, padding: 16, fontSize: 13, color: PD.accentText }}>Could not load the team. Try again in a moment.</div>
      ) : rows.length === 0 ? (
        <div style={{ background: PD.card, borderRadius: PD.radius.card, padding: "40px 16px", textAlign: "center", fontSize: 14, color: PD.textMuted }}>
          <Users size={28} style={{ margin: "0 auto 10px", display: "block" }} />
          No teammates yet.
        </div>
      ) : (
        <div style={{ background: PD.card, borderRadius: PD.radius.card, padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 12px", borderRadius: PD.radius.row, background: r.isMe ? PD.raised : "transparent" }}>
              <span style={{ width: 22, textAlign: "center", fontSize: 14, fontWeight: 700, color: i < 3 && r.units > 0 ? PD.text : PD.textMuted, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: PD.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.name}{r.isMe ? <span style={{ color: PD.textMuted, fontWeight: 500 }}> · You</span> : null}
                </p>
                <div style={{ marginTop: 6, height: 4, borderRadius: 99, background: PD.hover, overflow: "hidden" }}>
                  <div style={{ width: `${(r.units / max) * 100}%`, height: "100%", borderRadius: 99, background: r.isMe ? PD.accent : PD.textMuted }} />
                </div>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: PD.text, fontVariantNumeric: "tabular-nums" }}>
                {r.units}<span style={{ fontSize: 11, color: PD.textMuted, fontWeight: 600, marginLeft: 4 }}>sold</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
