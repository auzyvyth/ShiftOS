import React, { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { cdnImg } from "../../utils/img";

// NEWCAR-2: "Which models do you sell?" One implementation, used by signup
// (SalesmanOnboarding) and Settings > New cars (MyNewModels).
//
// Lists only models that have platform photos (new_car_model_media, set in the
// console) AND at least one active variant, because new_car_add_cards makes a
// card only for those. No price here: the card takes the price for the seller's
// own area, which signup does not know yet.

export function useStarterModels(brand) {
  const [models, setModels] = useState(null); // null = loading
  useEffect(() => {
    let alive = true;
    if (!brand) { setModels([]); return undefined; }
    setModels(null);
    Promise.all([
      supabase.from("new_car_model_media").select("model, images").eq("brand", brand),
      supabase.from("new_car_models").select("model").eq("brand", brand).eq("is_active", true),
    ]).then(([media, rows]) => {
      if (!alive) return;
      if (media.error || rows.error) { setModels([]); return; }
      const count = {};
      for (const r of rows.data || []) count[r.model] = (count[r.model] || 0) + 1;
      setModels((media.data || [])
        .filter((m) => count[m.model] && m.images?.length)
        .map((m) => ({ model: m.model, photo: m.images[0], variants: count[m.model] }))
        .sort((a, b) => a.model.localeCompare(b.model)));
    });
    return () => { alive = false; };
  }, [brand]);
  return models;
}

export default function StarterModelPicker({ brand, models, value, onChange, exclude }) {
  const shown = useMemo(() => (models || []).filter((m) => !exclude?.has(m.model)), [models, exclude]);
  if (!brand || !shown.length) return null;
  const picked = new Set(value || []);
  const toggle = (m) => {
    const next = new Set(picked);
    if (next.has(m)) next.delete(m); else next.add(m);
    onChange([...next]);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 8 }}>
      {shown.map((m) => {
        const on = picked.has(m.model);
        return (
          <button key={m.model} type="button" aria-pressed={on} onClick={() => toggle(m.model)}
            style={{
              position: "relative", padding: 0, borderRadius: 10, overflow: "hidden", cursor: "pointer",
              fontFamily: "inherit", textAlign: "left", minWidth: 0,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${on ? "rgba(220,38,38,0.6)" : "rgba(255,255,255,0.09)"}`,
            }}>
            <img src={cdnImg(m.photo, 300, 65)} alt="" loading="lazy"
              style={{ display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover", background: "#111827" }} />
            <span aria-hidden="true" style={{
              position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 999,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: on ? "#dc2626" : "rgba(0,0,0,0.45)", border: on ? "none" : "1px solid rgba(255,255,255,0.5)",
            }}>
              {on && <Check size={13} color="#fff" strokeWidth={3} />}
            </span>
            <span style={{ display: "block", padding: "7px 9px 8px" }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {brand} {m.model}
              </span>
              <span style={{ display: "block", fontSize: 11, color: "#9ca3af" }}>
                {m.variants === 1 ? "1 variant" : `${m.variants} variants`}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// What new_car_add_cards said, in one sentence for the seller.
export function addCardsSummary(rows) {
  const by = (r) => (rows || []).filter((x) => x.result === r).map((x) => x.model);
  const added = by("added");
  const noArea = by("no_price_for_area");
  const failed = (rows || []).filter((x) => !["added", "already_listed", "no_price_for_area"].includes(x.result)).map((x) => x.model);
  const parts = [];
  if (added.length) parts.push(`${added.join(", ")} ${added.length === 1 ? "is" : "are"} on your page.`);
  if (noArea.length) parts.push(`${noArea.join(", ")}: no official price for your area yet, so ${noArea.length === 1 ? "it was" : "they were"} not added.`);
  if (failed.length) parts.push(`${failed.join(", ")} could not be added. Try again from Add car.`);
  return parts.join(" ");
}
