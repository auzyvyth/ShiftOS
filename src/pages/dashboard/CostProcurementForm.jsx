import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import { color, border } from "../../theme/tokens";
import { Save } from "lucide-react";

const PROC_SOURCES = ["Auction", "Direct Owner", "Trade-in", "Consignment", "Repossession", "Import", "Other"];
const ENCUMBRANCE_OPTS = [
  { value: "clear",    label: "Clear (no loan)" },
  { value: "under_hp", label: "Under HP / loan" },
  { value: "unknown",  label: "Unknown" },
];

// Cost & procurement tab in the Edit Listing modal — edits the car's private
// stock_unit (purchase/recon/source/encumbrance/B5) that drives P&L, without
// touching the public listing (that's the CarForm tab). Auto-creates the stock
// row if one doesn't exist yet (e.g. legacy/imported listings).
export default function CostProcurementForm({ listing, dealerId, onClose }) {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    purchase_price: "", recon_cost: "", purchase_date: "", purchase_source: "Auction",
    encumbrance_status: "unknown", puspakom_b5_date: "", notes: "",
  });

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    supabase.from("stock_units").select("*").eq("listing_id", listing.id).maybeSingle()
      .then(({ data }) => {
        if (cancel) return;
        setRow(data || null);
        if (data) setForm({
          purchase_price: data.purchase_price ?? "",
          recon_cost: data.recon_cost ?? "",
          purchase_date: data.purchase_date || "",
          purchase_source: data.purchase_source || "Auction",
          encumbrance_status: data.encumbrance_status || "unknown",
          puspakom_b5_date: data.puspakom_b5_date || "",
          notes: data.notes || "",
        });
        setLoading(false);
      });
    return () => { cancel = true; };
  }, [listing.id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    const payload = {
      purchase_price: Number(form.purchase_price) || 0,
      recon_cost: Number(form.recon_cost) || 0,
      purchase_date: form.purchase_date || null,
      purchase_source: form.purchase_source || null,
      encumbrance_status: form.encumbrance_status,
      puspakom_b5_date: form.puspakom_b5_date || null,
      notes: form.notes || null,
    };
    let error;
    if (row) {
      ({ error } = await supabase.from("stock_units").update(payload).eq("id", row.id));
    } else {
      ({ error } = await supabase.from("stock_units").insert({
        ...payload, listing_id: listing.id, dealer_id: dealerId,
        brand: listing.brand, model: listing.model, year: listing.year,
        status: listing.status === "sold" ? "sold" : "in_stock",
      }));
    }
    setSaving(false);
    if (error) { toast.error("Save failed: " + error.message); return; }
    toast.success("Cost & procurement saved");
    onClose?.();
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "#6b7280", fontSize: 13 }}>Loading…</div>;

  const costBasis = (Number(form.purchase_price) || 0) + (Number(form.recon_cost) || 0);
  const ask = Number(listing.selling_price) || 0;
  const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 };
  const inp = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, color: "#111827", background: "#fff", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
        These figures stay private and drive your P&amp;L — buyers never see them. Public specs, photos and price are on the Listing details tab.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={lbl}>Purchase price (RM)</label><input type="number" value={form.purchase_price} onChange={set("purchase_price")} placeholder="0" style={inp} /></div>
        <div><label style={lbl}>Recon cost (RM)</label><input type="number" value={form.recon_cost} onChange={set("recon_cost")} placeholder="0" style={inp} /></div>
        <div><label style={lbl}>Purchase date</label><input type="date" value={form.purchase_date} onChange={set("purchase_date")} style={inp} /></div>
        <div><label style={lbl}>Source</label><select value={form.purchase_source} onChange={set("purchase_source")} style={inp}>{PROC_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label style={lbl}>Encumbrance</label><select value={form.encumbrance_status} onChange={set("encumbrance_status")} style={inp}>{ENCUMBRANCE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div><label style={lbl}>Puspakom B5 date</label><input type="date" value={form.puspakom_b5_date} onChange={set("puspakom_b5_date")} style={inp} /></div>
      </div>
      <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={set("notes")} placeholder="Condition notes, seller info…" style={{ ...inp, minHeight: 64, resize: "vertical" }} /></div>
      {costBasis > 0 && (
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", padding: "10px 14px", borderRadius: 10, background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 13 }}>
          <span style={{ color: "#6b7280" }}>Cost basis <strong style={{ color: "#111827" }}>RM {costBasis.toLocaleString()}</strong></span>
          {ask > 0 && <span style={{ color: "#6b7280" }}>Asking <strong style={{ color: "#111827" }}>RM {ask.toLocaleString()}</strong></span>}
          {ask > 0 && <span style={{ color: ask - costBasis >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>Spread RM {(ask - costBasis).toLocaleString()}</span>}
        </div>
      )}
      {!row && <p className="pl-note" style={{ fontSize: 12, margin: 0, padding: "8px 12px" }}>No stock record yet — saving will create one linked to this car.</p>}
      <button onClick={save} disabled={saving} style={{ alignSelf: "flex-start", padding: "10px 20px", borderRadius: 8, background: "#dc2626", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "Saving…" : "Save cost & procurement"}
      </button>
    </div>
  );
}
