import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { NEW_CAR_BRANDS, rm, groupByModel, priceBasis } from "../../utils/newCars";

// NEWCAR-1: a new-car advisor ticks which variants they sell. Rendered by BOTH
// Salesman Lite and Premium settings (one implementation, like ReferralCard).
//
// Prices are never typed here: they come from new_car_models (platform-run,
// console > Marketplace > New car prices) through get_my_new_car_catalogue,
// which also resolves the caller's price zone from their own state/city. So a
// Sabah advisor sees the Sabah price, and a zone with no price says so instead
// of quietly showing the Peninsular number.
//
// A seller who signed up as a broker can switch here: picking a brand sets
// seller_type='new_car'. Changing brand clears the old brand's ticks, since a
// Proton advisor's page listing Perodua variants would be wrong.

const card = { padding: 16, background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 };
const pill = (on) => ({
  flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
  fontSize: 12.5, fontWeight: 700,
  background: on ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.03)",
  border: `1px solid ${on ? "rgba(220,38,38,0.35)" : "rgba(255,255,255,0.08)"}`,
  color: on ? "#fca5a5" : "#d1d5db",
});

export default function MyNewModels({ profile, onProfileChange }) {
  const [brand, setBrand] = useState(profile?.seller_type === "new_car" ? profile?.new_car_brand || "" : "");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    setBrand(profile?.seller_type === "new_car" ? profile?.new_car_brand || "" : "");
  }, [profile?.seller_type, profile?.new_car_brand]);

  const load = useCallback(async (b) => {
    if (!b) { setRows([]); return; }
    setLoading(true);
    setError("");
    const { data, error: e } = await supabase.rpc("get_my_new_car_catalogue", { p_brand: b });
    if (e) setError("Couldn't load the price list. Try again in a moment.");
    else setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(brand); }, [brand, load]);

  const groups = useMemo(() => groupByModel(rows), [rows]);
  const zone = rows[0]?.price_zone || "peninsular";
  const picked = rows.filter((r) => r.selected).length;

  const chooseBrand = async (b) => {
    if (!profile?.id || b === brand) return;
    setBusy("brand");
    setError("");
    const { error: e } = await supabase.from("profiles").update({ seller_type: "new_car", new_car_brand: b }).eq("id", profile.id);
    if (e) { setBusy(null); setError("Couldn't save the brand. Try again."); return; }
    if (brand) await supabase.from("seller_new_models").delete().eq("seller_id", profile.id);
    setBusy(null);
    setBrand(b);
    onProfileChange?.({ seller_type: "new_car", new_car_brand: b });
  };

  const setPicked = async (ids, on) => {
    if (!profile?.id || !ids.length) return;
    setBusy(ids.join(","));
    setError("");
    const { error: e } = on
      ? await supabase.from("seller_new_models").upsert(ids.map((model_id) => ({ seller_id: profile.id, model_id })), { onConflict: "seller_id,model_id", ignoreDuplicates: true })
      : await supabase.from("seller_new_models").delete().eq("seller_id", profile.id).in("model_id", ids);
    setBusy(null);
    if (e) { setError("Couldn't save. Try again."); return; }
    setRows((rs) => rs.map((r) => (ids.includes(r.model_id) ? { ...r, selected: on } : r)));
  };

  return (
    <div style={card}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>New cars you sell</p>
      <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#9ca3af", lineHeight: 1.6 }}>
        {profile?.seller_type === "new_car"
          ? "Tick the models you sell. They show on your page with the official price for your area, and XDrive keeps the prices up to date."
          : "Sell new Proton, Perodua or Toyota? Pick your brand and your page shows the official prices for your area. No listings to type."}
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {NEW_CAR_BRANDS.map((b) => (
          <button key={b} type="button" disabled={busy === "brand"} onClick={() => chooseBrand(b)} style={pill(b === brand)}>{b}</button>
        ))}
      </div>
      {brand && picked > 0 && (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#6b7280" }}>Changing brand clears the models you ticked.</p>
      )}

      {error && <p role="alert" style={{ margin: "12px 0 0", fontSize: 12, color: "#fbbf24" }}>{error}</p>}

      {brand && (
        loading ? (
          <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "#6b7280" }}>Loading {brand} prices...</p>
        ) : rows.length === 0 ? (
          <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "#9ca3af", lineHeight: 1.6 }}>
            We're adding the {brand} price list. Your models appear here as soon as it's in.
          </p>
        ) : (
          <>
            <p style={{ margin: "14px 0 8px", fontSize: 11.5, color: "#6b7280" }}>
              {picked} of {rows.length} selected. {priceBasis(zone)}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {groups.map((g) => {
                const ids = g.variants.map((v) => v.model_id);
                const all = g.variants.every((v) => v.selected);
                return (
                  <div key={g.model} style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 12px", background: "rgba(255,255,255,0.02)" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", minWidth: 0 }}>{brand} {g.model}</span>
                      <button type="button" onClick={() => setPicked(ids, !all)} disabled={!!busy}
                        style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 12, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                        {all ? "Untick all" : "Tick all"}
                      </button>
                    </div>
                    {g.variants.map((v) => (
                      <label key={v.model_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}>
                        <input type="checkbox" checked={!!v.selected} disabled={!!busy} onChange={(e) => setPicked([v.model_id], e.target.checked)} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#e5e7eb" }}>{v.variant}</span>
                        <span style={{ fontSize: 12.5, color: v.price == null ? "#6b7280" : "#e5e7eb", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {rm(v.price) || "Not set for your area"}
                        </span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
            {profile?.slug && (
              <a href={`/s/${profile.slug}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 12, fontSize: 12.5, color: "#fca5a5", textDecoration: "none", fontWeight: 600 }}>
                See them on your page
              </a>
            )}
          </>
        )
      )}
    </div>
  );
}
