import React from "react";
import { color } from "../theme/tokens";

// T2-3 — structured, saved per-unit condition appraisal (not a reminder).
// Controlled component: `value` is the stored appraisal object (or null),
// `onChange` receives the recomputed object (or null when nothing is graded).
// Light theme to match the dealer dashboard. One grade is active per row, so
// the tinted state pill does not violate the "no stacked saturated accents"
// anti-slop rule.

export const APPRAISAL_AREAS = [
  { key: "exterior",     label: "Exterior / body & paint" },
  { key: "interior",     label: "Interior / upholstery" },
  { key: "engine",       label: "Engine" },
  { key: "transmission", label: "Transmission / gearbox" },
  { key: "suspension",   label: "Suspension & brakes" },
  { key: "electrical",   label: "Electrical & aircon" },
  { key: "tyres",        label: "Tyres" },
  { key: "documents",    label: "Documents (geran, service records)" },
];

export const GRADE_META = {
  good: { label: "Good", text: "#047857", bg: "#ECFDF5", border: "#A7F3D0" },
  fair: { label: "Fair", text: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  poor: { label: "Poor", text: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
};
const GRADES = ["good", "fair", "poor"];

// Overall letter grade derived from the per-area grades. Kept deterministic so
// the same appraisal always summarises the same way, in the form and on read.
export function deriveOverall(items) {
  const vals = Object.values(items || {}).map((v) => v?.grade).filter(Boolean);
  if (vals.length === 0) return { overall: null, attention_count: 0 };
  const poor = vals.filter((g) => g === "poor").length;
  const fair = vals.filter((g) => g === "fair").length;
  const overall = poor >= 2 ? "D" : poor === 1 ? "C" : fair >= 1 ? "B" : "A";
  return { overall, attention_count: poor + fair };
}

// Small read-only summary for stock rows / detail panels elsewhere.
export function summarizeAppraisal(appraisal) {
  if (!appraisal || !appraisal.overall) return null;
  const n = appraisal.attention_count || 0;
  return n === 0
    ? `Grade ${appraisal.overall} · all clear`
    : `Grade ${appraisal.overall} · ${n} area${n === 1 ? "" : "s"} need attention`;
}

const OVERALL_TINT = {
  A: { text: "#047857", bg: "#ECFDF5", border: "#A7F3D0" },
  B: { text: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  C: { text: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  D: { text: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
};

export default function AppraisalChecklist({ value, onChange }) {
  const items = value?.items || {};

  const emit = (nextItems) => {
    // Drop empty rows (no grade and no note) so a cleared appraisal serialises
    // to null rather than a bag of blanks.
    const cleaned = {};
    Object.entries(nextItems).forEach(([k, v]) => {
      if (v && (v.grade || (v.note && v.note.trim()))) cleaned[k] = v;
    });
    const graded = Object.values(cleaned).some((v) => v.grade);
    if (!graded) { onChange(null); return; }
    onChange({ items: cleaned, ...deriveOverall(cleaned) });
  };

  const setGrade = (key, grade) => {
    const cur = items[key] || {};
    // Tapping the active grade again clears it.
    const nextGrade = cur.grade === grade ? undefined : grade;
    emit({ ...items, [key]: { ...cur, grade: nextGrade } });
  };
  const setNote = (key, note) => emit({ ...items, [key]: { ...(items[key] || {}), note } });

  const { overall, attention_count } = deriveOverall(items);
  const tint = overall ? OVERALL_TINT[overall] : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: color.ink }}>Condition appraisal</span>
        {overall ? (
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: tint.text, background: tint.bg, border: `1px solid ${tint.border}` }}>
            Grade {overall}{attention_count > 0 ? ` · ${attention_count} to check` : " · all clear"}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: color.textMuted }}>Optional — grade what you inspected</span>
        )}
      </div>

      <div style={{ border: "1px solid #EAECF0", borderRadius: 10, overflow: "hidden" }}>
        {APPRAISAL_AREAS.map((area, i) => {
          const row = items[area.key] || {};
          const showNote = row.grade === "fair" || row.grade === "poor" || (row.note && row.note.length > 0);
          return (
            <div key={area.key} style={{ padding: "10px 12px", borderTop: i === 0 ? "none" : "1px solid #F1F2F4" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: color.ink, minWidth: 0 }}>{area.label}</span>
                <div style={{ display: "inline-flex", gap: 4, flexShrink: 0 }}>
                  {GRADES.map((g) => {
                    const active = row.grade === g;
                    const m = GRADE_META[g];
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGrade(area.key, g)}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
                          color: active ? m.text : "#6B7280",
                          background: active ? m.bg : "#fff",
                          border: `1px solid ${active ? m.border : "#EAECF0"}`,
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {showNote && (
                <input
                  value={row.note || ""}
                  onChange={(e) => setNote(area.key, e.target.value)}
                  placeholder="Defect note (optional) — e.g. front bumper scuff, needs respray"
                  style={{ marginTop: 8, width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 7, border: "1px solid #EAECF0", fontSize: 12, color: color.ink, background: "#fff", outline: "none", fontFamily: "inherit" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
