import React from "react";
import { panel as C, panelType as T, panelRadius as R, withAlpha } from "../../theme/tokens";
import { followUpStatus } from "../../lib/leadsHelpers";

// One row of the "Follow-up needed" card, shared by Salesman Lite and Premium
// (they carried two copies that differed only in the click handler).
//
// The badge says WHY the lead is on the list — the reason from
// followUpStatus(), the same rule that put it there — so the rep reads what to
// do: never contacted, a reminder they set has lapsed, or the buyer went quiet.
// It is the only coloured thing on the row. Rows used to be tinted by pipeline
// stage and carry a coloured stage pill, a red "Xd ago" pill and a green WA
// button: four hues per row, six stages down the card, and no single signal.
// The stage is still there, as plain text.
//
// The age is measured from the last real contact (last_contacted_at, else
// created_at), the same clock the list uses. It used to read updated_at, which
// moves on any edit, so a buyer nobody had called could read "0d ago".
export default function FollowUpRow({ lead, stageText, carText, reasonText, onOpen, onWA, last }) {
  const status = followUpStatus(lead);
  const urgent = status.reason === "never_contacted";
  const h = status.sinceHours;
  const age = h < 1 ? "just now" : h < 24 ? `${Math.floor(h)}h` : `${Math.floor(h / 24)}d`;

  return (
    <div
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: last ? "none" : `1px solid ${C.line}`, cursor: "pointer" }}
    >
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.fillStrong, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.textSec, flexShrink: 0 }}>
        {(lead.buyer_name || "?")[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lead.buyer_name || "—"}
        </p>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 7, rowGap: 3, marginTop: 4, minWidth: 0 }}>
          {status.due && (
            <span
              style={{
                ...(urgent ? { background: withAlpha(C.danger, 0.1), border: `1px solid ${withAlpha(C.danger, 0.25)}`, color: C.dangerText } : { background: C.fillStrong, border: `1px solid ${C.borderStrong}`, color: C.textSec }),
                fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "1px 7px", borderRadius: R.sm, whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {reasonText || status.label} · {age}
            </span>
          )}
          <span style={{ fontSize: T.size.sm, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            {stageText} · {carText}
          </span>
        </div>
      </div>
      {lead.phone && onWA && (
        <button
          onClick={(e) => { e.stopPropagation(); onWA(); }}
          style={{ fontSize: T.size.sm, padding: "6px 12px", borderRadius: R.sm, cursor: "pointer", fontWeight: T.weight.semibold, flexShrink: 0, fontFamily: "inherit", background: "transparent", border: `1px solid ${C.borderStrong}`, color: C.text }}
        >
          WA
        </button>
      )}
    </div>
  );
}
