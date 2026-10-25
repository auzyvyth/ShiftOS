import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { NEW_CAR_BRANDS, rm, groupByModel, priceBasis } from "../../utils/newCars";
import { premiumDark as PD } from "../../theme/tokens";
import StarterModelPicker, { useStarterModels, addCardsSummary } from "./StarterModelPicker";

// NEWCAR-1: a new-car advisor's models. Rendered by BOTH
// Salesman Lite and Premium settings (one implementation, like ReferralCard).
//
// Prices are never typed here: they come from new_car_models (platform-run,
// console > Marketplace > New car prices) through get_my_new_car_catalogue,
// which also resolves the caller's price zone from their own state/city. So a
// Sabah advisor sees the Sabah price, and a zone with no price says so instead
// of quietly showing the Peninsular number.
//
// The price list is READ-ONLY. Since NEWCAR-2 (owner, 2026-10-22) the advisor
// can also tick models here to get a card each with the platform's photos
// (new_car_add_cards): the same picker signup shows, for accounts made in the
// console and advisors who signed up before it. Add car still makes a card
// with their own photos.
//
// A seller who signed up as a broker can switch here: picking a brand sets
// seller_type='new_car'.

// theme="premium" (Salesman Premium, premiumDark): no outlines, the picked
// brand is a solid red chip, no amber, and no heading (the Settings section
// above it is "New Cars"). Lite passes nothing and keeps LEGACY.
const LEGACY = {
  card: { padding: 16, background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 },
  text: "#f1f5f9", sec: "#9ca3af", muted: "#6b7280", row: "#e5e7eb",
  pillOn: { background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.35)", color: "#fca5a5" },
  pillOff: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#d1d5db" },
  group: { border: "1px solid rgba(255,255,255,0.07)" }, groupHead: "rgba(255,255,255,0.02)", line: "rgba(255,255,255,0.05)",
  idle: { background: "rgba(255,255,255,0.06)", color: "#6b7280" }, warn: "#fbbf24", ok: "#86efac",
};
const PREMIUM = {
  card: { padding: 18, background: PD.card, borderRadius: PD.radius.card },
  text: PD.text, sec: PD.textSec, muted: PD.textMuted, row: PD.text,
  pillOn: { background: PD.accent, border: "1px solid transparent", color: PD.onAccent },
  pillOff: { background: PD.raised, border: "1px solid transparent", color: PD.textSec },
  group: { background: PD.raised }, groupHead: "transparent", line: PD.line,
  idle: { background: PD.raised, color: PD.textMuted }, warn: PD.accentText, ok: PD.up,
};
const pill = (K, on) => ({
  flex: "1 1 72px", minWidth: 0, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
  fontSize: 12.5, fontWeight: 700,
  ...(on ? K.pillOn : K.pillOff),
});

export default function MyNewModels({ profile, onProfileChange, onCardsAdded, theme }) {
  const prem = theme === "premium";
  const K = prem ? PREMIUM : LEGACY;
  const [brand, setBrand] = useState(profile?.new_car_brand || "");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    setBrand(profile?.new_car_brand || "");
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

  // Models this seller already has a live card for: not offered again.
  const starterModels = useStarterModels(brand);
  const [listed, setListed] = useState(null);
  const [ticked, setTicked] = useState([]);
  const [added, setAdded] = useState("");
  const loadListed = useCallback(async () => {
    if (!profile?.id || !brand) { setListed(new Set()); return; }
    const { data } = await supabase.from("car_listings").select("model")
      .eq("assigned_to", profile.id).eq("brand", brand).eq("new_car_unit", false)
      .not("new_car_model_id", "is", null).not("status", "in", "(sold,archived)");
    setListed(new Set((data || []).map((r) => r.model)));
  }, [profile?.id, brand]);
  useEffect(() => { setTicked([]); setAdded(""); loadListed(); }, [loadListed]);

  const addCards = async () => {
    if (!ticked.length) return;
    setBusy("cards");
    setError("");
    const { data, error: e } = await supabase.rpc("new_car_add_cards", { p_models: ticked });
    if (e) { setBusy(null); setError("Couldn't add them. Try again in a moment."); return; }
    const names = (data || []).filter((r) => r.result === "added").map((r) => r.model);
    if (names.length && onCardsAdded) {
      const { data: cars } = await supabase.from("car_listings").select("*")
        .eq("assigned_to", profile.id).eq("brand", brand).eq("stock_photos", true).in("model", names);
      if (cars?.length) onCardsAdded(cars);
    }
    setAdded(addCardsSummary(data));
    setTicked([]);
    setBusy(null);
    loadListed();
  };
  const zone = rows[0]?.price_zone || "peninsular";

  const chooseBrand = async (b) => {
    if (!profile?.id || b === brand) return;
    setBusy("brand");
    setError("");
    // A broker who also sells new stays a broker (owner, 2026-10-17); this
    // used to set seller_type 'new_car' and quietly drop the broker side.
    const sellerType = profile.seller_type === "broker" ? "broker" : "new_car";
    const { error: e } = await supabase.from("profiles").update({ seller_type: sellerType, new_car_brand: b }).eq("id", profile.id);
    if (e) { setBusy(null); setError("Couldn't save the brand. Try again."); return; }
    setBusy(null);
    setBrand(b);
    onProfileChange?.({ seller_type: sellerType, new_car_brand: b });
  };

  return (
    <div style={K.card}>
      {!prem && <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: K.text }}>New cars you sell</p>}
      <p style={{ margin: 0, fontSize: 12.5, color: K.sec, lineHeight: 1.6 }}>
        {profile?.new_car_brand
          ? "Your page shows the models you add. Tick them below, or use Add car to list one with your own photos. Prices come from this list and stay up to date by themselves."
          : "Sell new Proton, Perodua, Toyota, BYD or Honda? Pick your brand, then add the models you sell from Add car. You never type a price."}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {NEW_CAR_BRANDS.map((b) => (
          <button key={b} type="button" disabled={busy === "brand"} onClick={() => chooseBrand(b)} style={pill(K, b === brand)}>{b}</button>
        ))}
      </div>

      {error && <p role="alert" style={{ margin: "12px 0 0", fontSize: 12, color: K.warn }}>{error}</p>}

      {brand && listed && starterModels?.some((m) => !listed.has(m.model)) && (
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: K.text }}>Put models on your page</p>
          <StarterModelPicker brand={brand} models={starterModels} value={ticked} onChange={setTicked} exclude={listed} />
          <button type="button" disabled={!ticked.length || busy === "cards"} onClick={addCards}
            style={{ marginTop: 10, width: "100%", padding: "10px 12px", borderRadius: 9, border: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
              cursor: ticked.length ? "pointer" : "default", ...(ticked.length ? { background: "#dc2626", color: "#fff" } : K.idle) }}>
            {busy === "cards" ? "Adding..." : ticked.length ? `Put ${ticked.length} on my page` : "Tick the models you sell"}
          </button>
        </div>
      )}
      {added && <p role="status" style={{ margin: "10px 0 0", fontSize: 12.5, color: K.ok, lineHeight: 1.55 }}>{added}</p>}

      {brand && (
        loading ? (
          <p style={{ margin: "14px 0 0", fontSize: 12.5, color: K.muted }}>Loading {brand} prices...</p>
        ) : rows.length === 0 ? (
          <p style={{ margin: "14px 0 0", fontSize: 12.5, color: K.sec, lineHeight: 1.6 }}>
            We're adding the {brand} price list. Your models appear here as soon as it's in.
          </p>
        ) : (
          <>
            <p style={{ margin: "14px 0 8px", fontSize: 11.5, color: K.muted }}>
              Official price list. {priceBasis(zone)}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {groups.map((g) => {
                return (
                  <div key={g.model} style={{ ...K.group, borderRadius: prem ? PD.radius.row : 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 12px", background: K.groupHead }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: K.text, minWidth: 0 }}>{brand} {g.model}</span>
                    </div>
                    {g.variants.map((v) => (
                      <div key={v.model_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: `1px solid ${K.line}` }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: K.row }}>{v.variant}</span>
                        <span style={{ fontSize: 12.5, color: v.price == null ? K.muted : K.row, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {rm(v.price) || "Not set for your area"}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )
      )}
    </div>
  );
}
