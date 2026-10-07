import React, { useCallback, useEffect, useMemo, useState } from "react";
import { platformClient as supabase } from "../../lib/platformClient";
import { NEW_CAR_BRANDS, PRICE_ZONES, rm, fmtDate, groupByModel, newModelPath, isHttpUrl } from "../../utils/newCars";

// NEWCAR-1: the one place official new-car prices are typed in.
//
// new_car_models is superadmin-write (RLS), and every advisor's mini page and
// the public model pages read it, so a price fixed here is fixed everywhere.
// Rows are HIDDEN, never deleted: a delete cascades through seller_new_models
// and silently unticks the variant for every advisor who sells it.
//
// Only Peninsular is required. A zone left blank shows buyers there "ask the
// advisor" -- never the Peninsular number, which they cannot get.

const EMPTY = {
  id: null, brand: "Perodua", model: "", variant: "",
  price_peninsular: "", price_sabah_sarawak: "", price_labuan: "", price_langkawi: "",
  effective_from: new Date().toISOString().slice(0, 10), source_url: "", is_active: true,
};

const inp = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, fontSize: 13,
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#f1f5f9",
  fontFamily: "inherit", outline: "none",
};
const lbl = { display: "block", margin: "0 0 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280" };

function toNum(v) {
  const s = String(v ?? "").replace(/[^\d.]/g, "");
  return s ? Number(s) : null;
}

export default function NewCarPricesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brand, setBrand] = useState("Perodua");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: e } = await supabase
      .from("new_car_models")
      .select("*")
      .order("model").order("sort_order").order("price_peninsular");
    if (e) setError(e.message);
    else setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => groupByModel(rows.filter((r) => r.brand === brand)), [rows, brand]);
  const counts = useMemo(() => {
    const c = {};
    for (const r of rows) c[r.brand] = (c[r.brand] || 0) + 1;
    return c;
  }, [rows]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async () => {
    const payload = {
      brand: form.brand,
      model: form.model.trim(),
      variant: form.variant.trim(),
      price_peninsular: toNum(form.price_peninsular),
      price_sabah_sarawak: toNum(form.price_sabah_sarawak),
      price_labuan: toNum(form.price_labuan),
      price_langkawi: toNum(form.price_langkawi),
      effective_from: form.effective_from,
      source_url: form.source_url.trim() || null,
      is_active: !!form.is_active,
    };
    if (!payload.model || !payload.variant) { setError("Model and variant are required."); return; }
    if (!payload.price_peninsular) { setError("The Peninsular price is required."); return; }
    if (!payload.effective_from) { setError("Pick the date the price took effect."); return; }
    if (payload.source_url && !isHttpUrl(payload.source_url)) { setError("The source link must start with http:// or https://."); return; }
    setSaving(true);
    setError("");
    const q = form.id
      ? supabase.from("new_car_models").update(payload).eq("id", form.id)
      : supabase.from("new_car_models").insert(payload);
    const { error: e } = await q;
    setSaving(false);
    if (e) {
      setError(e.code === "23505" ? `${payload.brand} ${payload.model} ${payload.variant} is already in the list. Edit that row instead.` : e.message);
      return;
    }
    setBrand(payload.brand);
    setForm(null);
    load();
  };

  const toggleActive = async (r) => {
    const { error: e } = await supabase.from("new_car_models").update({ is_active: !r.is_active }).eq("id", r.id);
    if (e) setError(e.message);
    else load();
  };

  const edit = (r) => setForm({
    ...EMPTY, ...r,
    price_peninsular: r.price_peninsular ?? "", price_sabah_sarawak: r.price_sabah_sarawak ?? "",
    price_labuan: r.price_labuan ?? "", price_langkawi: r.price_langkawi ?? "",
    source_url: r.source_url || "",
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>New car prices</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", maxWidth: 620, lineHeight: 1.5 }}>
            The brand's official on-the-road price (without insurance) per variant. Every new-car advisor's page reads this list,
            so a change here updates all of them. Copy prices from the brand's own price list and paste its link as the source.
          </p>
        </div>
        {!form && (
          <button type="button" onClick={() => setForm({ ...EMPTY, brand })}
            style={{ padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "#dc2626", border: "none", color: "#fff" }}>
            Add variant
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: "10px 13px", borderRadius: 9, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", color: "#f87171", fontSize: 12 }}>
          {error}
        </div>
      )}

      {form && (
        <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{form.id ? "Edit variant" : "Add variant"}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <div>
              <span style={lbl}>Brand</span>
              <select value={form.brand} onChange={set("brand")} style={inp} disabled={!!form.id}>
                {NEW_CAR_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <span style={lbl}>Model</span>
              <input value={form.model} onChange={set("model")} placeholder="e.g. Bezza" style={inp} />
            </div>
            <div>
              <span style={lbl}>Variant</span>
              <input value={form.variant} onChange={set("variant")} placeholder="e.g. 1.3 X" style={inp} />
            </div>
            {PRICE_ZONES.map((z) => (
              <div key={z.key}>
                <span style={lbl}>{z.label} (RM){z.key === "peninsular" ? " *" : ""}</span>
                <input value={form[z.col]} onChange={set(z.col)} inputMode="numeric" placeholder={z.key === "peninsular" ? "e.g. 43980" : "Leave blank if unknown"} style={inp} />
              </div>
            ))}
            <div>
              <span style={lbl}>Price from *</span>
              <input type="date" value={form.effective_from} onChange={set("effective_from")} style={inp} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={lbl}>Source link</span>
              <input value={form.source_url} onChange={set("source_url")} placeholder="Brand's official price list URL" style={inp} />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12, color: "#cbd5e1" }}>
            <input type="checkbox" checked={!!form.is_active} onChange={set("is_active")} />
            Show to advisors and buyers
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button type="button" onClick={save} disabled={saving}
              style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "#dc2626", border: "none", color: "#fff", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => { setForm(null); setError(""); }}
              style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit", background: "none", border: "1px solid rgba(255,255,255,0.12)", color: "#9ca3af" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {NEW_CAR_BRANDS.map((b) => {
          const on = b === brand;
          return (
            <button key={b} type="button" onClick={() => setBrand(b)}
              style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit", background: on ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${on ? "rgba(220,38,38,0.35)" : "rgba(255,255,255,0.07)"}`, color: on ? "#f87171" : "#9ca3af" }}>
              {b} ({counts[b] || 0})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#4b5563", fontSize: 13 }}>Loading...</div>
      ) : groups.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#6b7280", fontSize: 13, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
          No {brand} prices yet. Advisors who sell {brand} see an empty list until you add some.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groups.map((g) => (
            <div key={g.model} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9", minWidth: 0 }}>{brand} {g.model}</p>
                {g.variants.some((v) => v.is_active) && (
                  <a href={newModelPath(brand, g.model)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#f87171", textDecoration: "none", flexShrink: 0 }}>Public page</a>
                )}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                  <thead>
                    <tr style={{ color: "#6b7280", textAlign: "left" }}>
                      <th style={{ padding: "8px 14px", fontWeight: 600 }}>Variant</th>
                      {PRICE_ZONES.map((z) => <th key={z.key} style={{ padding: "8px 10px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>{z.label}</th>)}
                      <th style={{ padding: "8px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>From</th>
                      <th style={{ padding: "8px 14px" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {g.variants.map((r) => (
                      <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)", color: r.is_active ? "#e2e8f0" : "#6b7280" }}>
                        <td style={{ padding: "9px 14px", whiteSpace: "nowrap" }}>
                          {r.variant}
                          {!r.is_active && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#9ca3af" }}>HIDDEN</span>}
                        </td>
                        {PRICE_ZONES.map((z) => (
                          <td key={z.key} style={{ padding: "9px 10px", textAlign: "right", whiteSpace: "nowrap", color: r[z.col] == null ? "#4b5563" : undefined }}>
                            {rm(r[z.col]) || "not set"}
                          </td>
                        ))}
                        <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
                          {isHttpUrl(r.source_url) ? <a href={r.source_url} target="_blank" rel="noreferrer" style={{ color: "#f87171", textDecoration: "none" }}>{fmtDate(r.effective_from)}</a> : fmtDate(r.effective_from)}
                        </td>
                        <td style={{ padding: "9px 14px", whiteSpace: "nowrap", textAlign: "right" }}>
                          <button type="button" onClick={() => edit(r)} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Edit</button>
                          <button type="button" onClick={() => toggleActive(r)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                            {r.is_active ? "Hide" : "Show"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
