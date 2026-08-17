import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import { SERVICE_CATEGORY_OPTIONS } from "../../utils/serviceCategories";

// Personal product catalogue for standalone salesmen (Lite/Premium). Writes to
// the same `dealer_products` table the full dealer dashboard uses — a Lite
// salesman's dealer_id resolves to their own profile.id (getDealerIdFromProfile),
// so rows created here show up automatically in CarForm's "Included Services"
// picker (CarForm.jsx ~line 1148) with zero extra wiring.

const CATEGORIES = SERVICE_CATEGORY_OPTIONS;
const EMPTY_FORM = { name: "", category: "protection", cost_price: "", selling_price: "", description: "", is_active: true };
const CARD = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 };

const fmtRM = (n) => (n == null ? "—" : `RM ${Number(n).toLocaleString("en-MY")}`);
const startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString(); };
const catCfg = (v) => CATEGORIES.find((c) => c.value === v) || CATEGORIES[CATEGORIES.length - 1];

function marginPct(sell, cost) {
  if (!sell) return null;
  return (((Number(sell) - (Number(cost) || 0)) / Number(sell)) * 100).toFixed(1);
}
function marginColor(pct) {
  if (pct == null) return "#6b7280";
  if (pct >= 40) return "#4ade80";
  if (pct >= 20) return "#fbbf24";
  return "#f87171";
}

function CatBadge({ category }) {
  const cfg = catCfg(category);
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

export default function ServicesAddonsTab({ dealerId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchProducts = async () => {
    if (!dealerId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("dealer_products")
      .select("*")
      .eq("dealer_id", dealerId)
      .order("created_at", { ascending: false });
    if (error) console.error("[ServicesAddonsTab] dealer_products fetch error:", error.message);
    setProducts(data || []);
    setLoading(false);
  };

  const fetchSummary = async () => {
    if (!dealerId) return;
    const monthStart = startOfMonth();
    const { data: addonRows, error: addonErr } = await supabase
      .from("deal_products")
      .select("id, sold_price, lead_id")
      .eq("dealer_id", dealerId)
      .gte("created_at", monthStart);
    if (addonErr) console.error("[ServicesAddonsTab] deal_products fetch error:", addonErr.message);
    const { count: wonCount, error: wonErr } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("dealer_id", dealerId)
      .in("stage", ["won", "closed_won"])
      .gte("updated_at", monthStart);
    if (wonErr) console.error("[ServicesAddonsTab] won leads count error:", wonErr.message);

    const rows = addonRows || [];
    const totalRevenue = rows.reduce((s, r) => s + (Number(r.sold_price) || 0), 0);
    const uniqueLeads = new Set(rows.filter((r) => r.lead_id).map((r) => r.lead_id));
    const attachRate = wonCount > 0 ? Math.round((uniqueLeads.size / wonCount) * 100) : null;
    setSummary({ totalRevenue, dealsWithAddons: uniqueLeads.size, attachRate });
  };

  useEffect(() => {
    fetchProducts();
    fetchSummary();
  }, [dealerId]);

  const openAdd = () => { setForm(EMPTY_FORM); setEditTarget(null); setPanelOpen(true); };
  const openEdit = (p) => {
    setForm({
      name: p.name,
      category: p.category,
      cost_price: String(p.cost_price ?? ""),
      selling_price: String(p.selling_price),
      description: p.description || "",
      is_active: p.is_active,
    });
    setEditTarget(p);
    setPanelOpen(true);
  };
  const closePanel = () => { setPanelOpen(false); setEditTarget(null); setForm(EMPTY_FORM); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.selling_price) {
      toast.error("Name and selling price are required");
      return;
    }
    setSaving(true);
    const payload = {
      dealer_id: dealerId,
      name: form.name.trim(),
      category: form.category,
      cost_price: Number(form.cost_price) || 0,
      selling_price: Number(form.selling_price),
      description: form.description.trim() || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };
    try {
      if (editTarget) {
        await supabase.from("dealer_products").update(payload).eq("id", editTarget.id);
      } else {
        await supabase.from("dealer_products").insert(payload);
      }
      await fetchProducts();
      closePanel();
      toast.success(editTarget ? "Product updated" : "Product added");
    } catch {
      toast.error("Save failed");
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    await supabase.from("dealer_products").delete().eq("id", id);
    setProducts((p) => p.filter((x) => x.id !== id));
    toast.success("Deleted");
  };

  const handleToggle = async (p) => {
    const updated = { is_active: !p.is_active };
    await supabase.from("dealer_products").update(updated).eq("id", p.id);
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...updated } : x)));
  };

  return (
    <div style={{ fontFamily: "system-ui,sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, letterSpacing: "0.05em", color: "#f1f5f9", margin: 0 }}>
            Services &amp; Add-ons
          </h2>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
            Products buyers can add to a deal — appears as "Included Services" when you create a listing
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: "linear-gradient(135deg,#dc2626,#b91c1c)", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}
        >
          <Plus size={13} /> Add Product
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Add-on Revenue (Month)", value: fmtRM(summary?.totalRevenue) },
          { label: "Deals w/ Add-ons", value: summary?.dealsWithAddons ?? "—" },
          { label: "Attach Rate", value: summary?.attachRate != null ? `${summary.attachRate}%` : "—" },
        ].map((s) => (
          <div key={s.label} style={{ ...CARD, padding: "12px 14px", minWidth: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.label}
            </p>
            <p style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 20, color: "#f1f5f9", margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ ...CARD, padding: 14 }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 56, borderRadius: 10, background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 12px" }}>
            <Package size={28} style={{ color: "#374151", margin: "0 auto 10px" }} />
            <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 4px" }}>No products yet</p>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 14px" }}>
              Add tint, warranty, insurance or accessory packages buyers can attach to a deal.
            </p>
            <button
              onClick={openAdd}
              style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.35)", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Add your first product
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {products.map((p) => {
              const pct = marginPct(p.selling_price, p.cost_price);
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{p.name}</span>
                      <CatBadge category={p.category} />
                      {!p.is_active && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.06)", color: "#6b7280" }}>
                          Inactive
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "#6b7280" }}>Cost: {fmtRM(p.cost_price)}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>Sell: {fmtRM(p.selling_price)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: marginColor(pct) }}>{pct != null ? `${pct}%` : "—"} margin</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <button onClick={() => handleToggle(p)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                      {p.is_active ? <ToggleRight size={22} style={{ color: "#4ade80" }} /> : <ToggleLeft size={22} style={{ color: "#4b5563" }} />}
                    </button>
                    <button onClick={() => openEdit(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 2 }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 2 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {panelOpen && (
        <ProductPanel form={form} setForm={setForm} editTarget={editTarget} saving={saving} onSave={handleSave} onClose={closePanel} />
      )}
    </div>
  );
}

function ProductPanel({ form, setForm, editTarget, saving, onSave, onClose }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const inp = { width: "100%", background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", color: "#e5e7eb", fontSize: 13, fontFamily: "system-ui,sans-serif", outline: "none", boxSizing: "border-box" };
  const label = { display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 };
  const mPct = marginPct(form.selling_price, form.cost_price);

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      className="sm:!items-center sm:!p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px 16px 0 0", padding: 22, width: "100%", maxWidth: 440, maxHeight: "92vh", overflowY: "auto", fontFamily: "system-ui,sans-serif" }}
        className="sm:!rounded-2xl"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{editTarget ? "Edit Product" : "Add Product"}</p>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#9ca3af" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={label}>Name *</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Paint Protection Film" style={inp} />
          </div>
          <div>
            <label style={label}>Category *</label>
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={inp}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={label}>Cost Price (RM)</label>
              <input type="number" min="0" value={form.cost_price} onChange={(e) => setForm((p) => ({ ...p, cost_price: e.target.value }))} placeholder="0" style={inp} />
            </div>
            <div>
              <label style={label}>Selling Price (RM) *</label>
              <input type="number" min="0" value={form.selling_price} onChange={(e) => setForm((p) => ({ ...p, selling_price: e.target.value }))} placeholder="0" style={inp} />
            </div>
          </div>
          {form.selling_price && (
            <p style={{ fontSize: 12, fontWeight: 600, color: marginColor(mPct), margin: "-8px 0 0" }}>Margin: {mPct}%</p>
          )}
          <div>
            <label style={label}>Description (optional)</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Short description…" rows={3} style={{ ...inp, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ fontSize: 13, color: "#9ca3af" }}>Active</span>
            <button onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
              {form.is_active ? <ToggleRight size={26} style={{ color: "#4ade80" }} /> : <ToggleLeft size={26} style={{ color: "#4b5563" }} />}
            </button>
          </div>
        </div>

        <button
          onClick={onSave}
          disabled={saving}
          style={{ width: "100%", marginTop: 18, padding: 11, borderRadius: 8, background: "linear-gradient(135deg,#dc2626,#b91c1c)", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving…" : editTarget ? "Save Changes" : "Add Product"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
