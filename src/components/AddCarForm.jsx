import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Car, Banknote, ClipboardCheck, Camera, ArrowRight, ArrowLeft, Check,
  X, Upload, AlertTriangle, Globe, Lock, Plus, Trash2, Info,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { useProfile, getDealerIdFromProfile } from "../hooks/useProfile";
import { estimateRoadTax } from "../utils/roadTax";
import { lookupCarSpec } from "../utils/carSpecs";
import { decodeVin, isLikelyVin } from "../utils/vinDecode";
import { color } from "../theme/tokens";

// Official Malaysian transfer baseline (government rates, before runner markup)
const JPJ_GOVT_FEE = 100;
const PUSPAKOM_B5 = 30;

const MAKES = [
  "Perodua", "Proton", "Honda", "Toyota", "Nissan", "Mazda", "Mitsubishi",
  "Hyundai", "Kia", "BMW", "Mercedes-Benz", "Audi", "Volkswagen", "Lexus",
  "Subaru", "Suzuki", "Ford", "Volvo", "Other",
];
const BODY_TYPES = ["Sedan", "SUV", "Hatchback", "MPV", "Pickup", "Coupe", "Wagon", "Other"];
const SOURCES = ["Auction", "Direct Owner", "Trade-in", "Consignment", "Repossession", "Import", "Other"];
const CONDITIONS = ["Excellent", "Good", "Fair", "Needs work"];

const STEPS = [
  { id: 1, label: "Identity", Icon: Car },
  { id: 2, label: "Procurement", Icon: Banknote },
  { id: 3, label: "Pricing", Icon: ClipboardCheck },
  { id: 4, label: "Publish", Icon: Camera },
];

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const RM = (n) => `RM ${Math.round(n).toLocaleString()}`;

const blankForm = {
  // Identity
  plate_number: "", vin_number: "", brand: "", model: "", variant: "",
  year: "", engine_cc: "", transmission: "Auto", fuel_type: "Petrol",
  colour: "", mileage: "", body_type: "Sedan", is_recon: false,
  // Procurement
  purchase_price: "", purchase_date: new Date().toISOString().slice(0, 10),
  purchase_source: "Auction", encumbrance_status: "unknown",
  loan_settlement_amount: "", seller_contact: "",
  // Condition & pricing
  recon_cost: "", condition: "Good", condition_notes: "",
  b5_done: false, puspakom_b5_date: "",
  asking_price: "", min_price: "", commission_amount: "",
  warranty_months: "",
  // Publish
  images: [], description: "", original_price: "", publish: false,
  included_services: [],
};

// Module-level style constants and helper components.
// These MUST live outside AddCarForm — defining components inside a render
// function gives them a new identity every render, causing React to remount
// them on every keystroke (focus lost, one-char-at-a-time bug).
const INP = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #EAECF0", fontSize: 14, color: color.ink, background: "#fff", outline: "none", fontFamily: "inherit" };
const LBL = { fontSize: 12, fontWeight: 600, color: color.ink, marginBottom: 6, display: "block" };

const FormCtx = React.createContext(null);

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label style={LBL}>{label}{required && <span style={{ color: color.accent }}> *</span>}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: color.textMuted, marginTop: 4 }}>{hint}</p>}
    </div>
  );
}
function FText({ k, ph, type = "text" }) {
  const { form, setVal } = React.useContext(FormCtx);
  return <input style={INP} type={type} value={form[k]} placeholder={ph} onChange={(e) => setVal(k, e.target.value)} />;
}
function FSelect({ k, options }) {
  const { form, setVal } = React.useContext(FormCtx);
  return <select style={INP} value={form[k]} onChange={(e) => setVal(k, e.target.value)}>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
}

export default function AddCarForm({ onPublished, onStocked }) {
  const { profile } = useProfile();
  const dealerId = getDealerIdFromProfile(profile);

  const [form, setForm] = useState(blankForm);
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [decoded, setDecoded] = useState(false);
  const [decodingVin, setDecodingVin] = useState(false);
  const [vinResult, setVinResult] = useState(null); // "hit" | "miss" | null
  const photosRef = useRef(null);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setVal = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ── VIN decode (free NHTSA lookup) ─────────────────────────────────────────
  // Explicit user action: fills make/model/year/CC/body from the VIN. Best for
  // CBU units; national cars (Perodua/Proton) miss → fall back to manual + the
  // local carSpecs auto-fill that runs on make+model.
  const handleDecodeVin = async () => {
    setVinResult(null); setError("");
    if (!isLikelyVin(form.vin_number)) { setVinResult("invalid"); return; }
    setDecodingVin(true);
    const r = await decodeVin(form.vin_number);
    setDecodingVin(false);
    if (!r) { setVinResult("miss"); return; }
    const makeMatch = MAKES.find((m) => m.toLowerCase() === (r.make || "").toLowerCase()) || "Other";
    setForm((f) => ({
      ...f,
      brand: f.brand || makeMatch,
      model: f.model || r.model || "",
      year: f.year || (r.year || ""),
      engine_cc: String(f.engine_cc).trim() || (r.cc ? String(r.cc) : ""),
      body_type: r.body && BODY_TYPES.includes(r.body) ? r.body : f.body_type,
    }));
    setVinResult("hit");
  };

  // Local-model spec auto-fill: when make + model are both set, fill engine CC
  // and body type IF the dealer hasn't already typed them.
  useEffect(() => {
    const spec = lookupCarSpec(form.brand, form.model);
    if (!spec) { setDecoded(false); return; }
    setForm((f) => {
      const next = { ...f };
      let changed = false;
      if (!String(f.engine_cc).trim()) { next.engine_cc = String(spec.cc); changed = true; }
      if (BODY_TYPES.includes(spec.body) && f.body_type === "Sedan" && spec.body !== "Sedan") { next.body_type = spec.body; changed = true; }
      return changed ? next : f;
    });
    setDecoded(true);
  }, [form.brand, form.model]); // eslint-disable-line

  // ── Load dealer cost settings (silent auto-applied costs) ──────────────────
  useEffect(() => {
    if (!dealerId) return;
    supabase
      .from("dealer_cost_settings")
      .select("*")
      .eq("dealer_id", dealerId)
      .maybeSingle()
      .then(({ data }) => setSettings(data || {}));
  }, [dealerId]);

  // Pre-fill commission suggestion from dealer commission_config
  useEffect(() => {
    if (!profile?.commission_config || form.commission_amount) return;
    const cfg = profile.commission_config;
    const asking = num(form.asking_price);
    const purchase = num(form.purchase_price);
    let suggested = 0;
    if (cfg.type === "flat") suggested = num(cfg.value);
    else if (cfg.type === "percent_sale") suggested = asking * num(cfg.value) / 100;
    else suggested = Math.max(0, (asking - purchase)) * num(cfg.value) / 100; // percent_gross
    if (suggested > 0) setVal("commission_amount", String(Math.round(suggested)));
  }, [form.asking_price, form.purchase_price]); // eslint-disable-line

  // ── Live cost floor ────────────────────────────────────────────────────────
  const floor = useMemo(() => {
    const s = settings || {};
    const purchase = num(form.purchase_price);
    const recon = num(form.recon_cost);
    const roadTax = estimateRoadTax(form.engine_cc) || 0;
    const runner = num(s.runner_fee);
    const admin = num(s.admin_fee);
    const commission = num(form.commission_amount);
    const transfer = JPJ_GOVT_FEE + PUSPAKOM_B5 + runner;

    // daily holding cost: prefer floor-plan interest, else overhead/fleet
    let dailyHold = 0;
    if (num(s.floor_plan_rate) > 0 && purchase > 0) {
      dailyHold = purchase * (num(s.floor_plan_rate) / 100) / 365;
    } else if (num(s.monthly_overhead) > 0) {
      dailyHold = num(s.monthly_overhead) / Math.max(1, num(s.avg_fleet_size) || 20) / 30;
    }

    const asking = num(form.asking_price);
    const warrantyReserve = num(form.warranty_months) > 0
      ? asking * num(s.warranty_reserve_pct) / 100 : 0;

    const lines = [
      { label: "Purchase price", val: purchase },
      { label: "Recon estimate", val: recon },
      { label: "Transfer (JPJ + B5 + runner)", val: transfer, hint: runner > 0 ? "incl. runner fee from settings" : "govt rate only — set runner fee in settings" },
      { label: "Road tax (est. by CC)", val: roadTax, hint: roadTax ? null : "enter engine CC" },
      { label: "Admin / docs", val: admin, hint: admin > 0 ? "from settings" : null },
      { label: "Commission", val: commission },
    ];
    if (warrantyReserve > 0) lines.push({ label: "Warranty reserve", val: warrantyReserve, hint: "from settings" });

    const total = lines.reduce((a, l) => a + l.val, 0);
    const estGross = asking - total; // holding not yet accrued at intake
    return { lines, total, dailyHold, estGross, asking };
  }, [form, settings]);

  // ── Image upload (reuse car-images bucket) ─────────────────────────────────
  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const room = 30 - form.images.length;
    const accepted = files.slice(0, room);
    setUploading(true);
    try {
      const urls = [];
      for (const file of accepted) {
        const path = `stock/${dealerId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("car-images").upload(path, file);
        if (upErr) throw upErr;
        urls.push(supabase.storage.from("car-images").getPublicUrl(path).data.publicUrl);
      }
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch (err) {
      setError("Photo upload failed: " + err.message);
    }
    setUploading(false);
    if (photosRef.current) photosRef.current.value = "";
  };
  const removePhoto = (i) => setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }));

  // ── Included services (buyer-facing) ───────────────────────────────────────
  const addService = () => setForm((f) => ({ ...f, included_services: [...f.included_services, { name: "", category: "service", cost_price: "", selling_price: "" }] }));
  const updService = (i, k, v) => setForm((f) => { const a = [...f.included_services]; a[i] = { ...a[i], [k]: v }; return { ...f, included_services: a }; });
  const rmService = (i) => setForm((f) => ({ ...f, included_services: f.included_services.filter((_, j) => j !== i) }));
  const servicesCost = useMemo(() => form.included_services.reduce((a, s) => a + num(s.cost_price), 0), [form.included_services]);

  // ── Step validation ────────────────────────────────────────────────────────
  const stepValid = useCallback((s) => {
    if (s === 1) return form.brand && form.model && form.year && form.mileage !== "" && form.engine_cc !== "";
    if (s === 2) return num(form.purchase_price) > 0 && form.purchase_date && form.purchase_source;
    if (s === 3) return num(form.recon_cost) >= 0 && num(form.asking_price) > 0;
    if (s === 4) return !form.publish || form.images.length > 0;
    return true;
  }, [form]);

  const canSubmit = stepValid(1) && stepValid(2) && stepValid(3) && stepValid(4);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!dealerId) { setError("No dealer profile loaded."); return; }
    if (!canSubmit) { setError("Fill in all required fields before saving."); return; }
    setSaving(true); setError("");

    const stockCostFields = {
      purchase_price: num(form.purchase_price),
      recon_cost: num(form.recon_cost),
      purchase_date: form.purchase_date || null,
      purchase_source: form.purchase_source,
      encumbrance_status: form.encumbrance_status,
      puspakom_b5_date: form.b5_done && form.puspakom_b5_date ? form.puspakom_b5_date : null,
      notes: form.condition_notes || null,
    };

    try {
      if (form.publish) {
        // Listing-first: insert listing → trigger auto-creates stock_unit → patch costs
        const { data: listing, error: lErr } = await supabase
          .from("car_listings")
          .insert({
            dealer_id: dealerId,
            brand: form.brand, model: form.model, variant: form.variant || null,
            year: num(form.year), engine_cc: num(form.engine_cc) || null,
            transmission: form.transmission, fuel_type: form.fuel_type,
            body_type: form.body_type, colour: form.colour || null,
            mileage: num(form.mileage), plate_number: form.plate_number || null,
            vin_number: form.vin_number || null, is_recon: form.is_recon,
            condition: form.condition,
            selling_price: num(form.asking_price),
            original_price: num(form.original_price) || null,
            base_price: num(form.purchase_price),
            purchase_price: num(form.purchase_price),
            recon_cost: num(form.recon_cost),
            commission_amount: num(form.commission_amount),
            warranty_months: num(form.warranty_months) || null,
            included_services: form.included_services,
            included_services_cost: servicesCost,
            images: form.images,
            description: form.description || null,
            status: "available",
          })
          .select()
          .single();
        if (lErr) throw lErr;

        // Patch the auto-created stock unit with management/cost fields
        const { error: sErr } = await supabase
          .from("stock_units")
          .update(stockCostFields)
          .eq("listing_id", listing.id);
        if (sErr) throw sErr;

        onPublished?.(listing);
      } else {
        // Internal only: stock_unit directly, no public listing
        const { error: sErr } = await supabase.from("stock_units").insert({
          dealer_id: dealerId,
          brand: form.brand, model: form.model, variant: form.variant || null,
          year: num(form.year), engine_cc: num(form.engine_cc) || null,
          transmission: form.transmission, fuel_type: form.fuel_type,
          body_type: form.body_type, colour: form.colour || null,
          mileage: num(form.mileage), registration_number: form.plate_number || null,
          vin_number: form.vin_number || null, is_recon: form.is_recon,
          asking_price: num(form.asking_price),
          included_services: form.included_services,
          status: "in_stock",
          ...stockCostFields,
        });
        if (sErr) throw sErr;
        onStocked?.();
      }
    } catch (err) {
      setError(err.message || "Could not save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <FormCtx.Provider value={{ form, setVal }}>
    <div style={{ fontFamily: "'DM Sans',sans-serif" }}>
      {/* Step indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {STEPS.map((s) => {
          const done = s.id < step;
          const active = s.id === step;
          return (
            <button key={s.id} onClick={() => s.id < step && setStep(s.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8,
                border: active ? `1px solid ${color.accent}` : "1px solid #EAECF0",
                background: active ? "#FEF2F2" : done ? "#F0FDF4" : "#fff",
                cursor: s.id < step ? "pointer" : "default", flex: "1 1 auto", minWidth: 0,
              }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex",
                alignItems: "center", justifyContent: "center",
                background: active ? color.accent : done ? "#10B981" : "#F1F3F5",
                color: active || done ? "#fff" : color.textMuted,
              }}>
                {done ? <Check className="w-3 h-3" /> : <s.Icon className="w-3 h-3" />}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: active ? color.accent : done ? "#065F46" : color.textMuted, whiteSpace: "nowrap" }}>{s.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA", marginBottom: 16 }}>
          <AlertTriangle className="w-4 h-4" style={{ color: color.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#991B1B" }}>{error}</span>
        </div>
      )}

      {/* ── Step 1: Identity ── */}
      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>
          <Field label="Plate number" hint="Primary identifier"><FText k="plate_number" ph="WXY 1234" /></Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={LBL}>VIN / chassis</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...INP, flex: 1, textTransform: "uppercase" }} value={form.vin_number}
                placeholder="17-char VIN — auto-fills make, model, year, CC"
                onChange={(e) => { setVal("vin_number", e.target.value); setVinResult(null); }} />
              <button type="button" onClick={handleDecodeVin}
                disabled={decodingVin || !isLikelyVin(form.vin_number)}
                style={{ padding: "0 16px", borderRadius: 8, border: "none", whiteSpace: "nowrap",
                  background: isLikelyVin(form.vin_number) && !decodingVin ? color.accent : "#FCA5A5",
                  color: "#fff", fontSize: 13, fontWeight: 700, cursor: isLikelyVin(form.vin_number) && !decodingVin ? "pointer" : "default" }}>
                {decodingVin ? "Decoding…" : "Decode"}
              </button>
            </div>
            {vinResult === "hit" && <p style={{ fontSize: 11, color: "#059669", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><Check className="w-3 h-3" /> Decoded — review the fields below and edit if needed.</p>}
            {vinResult === "miss" && <p style={{ fontSize: 11, color: "#B45309", marginTop: 4 }}>Not found (common for Perodua/Proton). Pick make + model below — we will auto-fill CC.</p>}
            {vinResult === "invalid" && <p style={{ fontSize: 11, color: color.textMuted, marginTop: 4 }}>A standard VIN is 17 characters. Leave blank if unknown.</p>}
          </div>
          <Field label="Make" required><FSelect k="brand" options={["", ...MAKES]} /></Field>
          <Field label="Model" required><FText k="model" ph="Civic" /></Field>
          <Field label="Variant"><FText k="variant" ph="1.5 TC-P" /></Field>
          <Field label="Year" required><FText k="year" ph="2020" type="number" /></Field>
          <Field label="Engine CC" required hint={decoded ? "Auto-filled from model — edit if needed" : "Used to estimate road tax"}><FText k="engine_cc" ph="1498" type="number" /></Field>
          <Field label="Transmission"><FSelect k="transmission" options={["Auto", "Manual"]} /></Field>
          <Field label="Fuel"><FSelect k="fuel_type" options={["Petrol", "Diesel", "Hybrid", "Electric"]} /></Field>
          <Field label="Colour"><FText k="colour" ph="White" /></Field>
          <Field label="Mileage (km)" required><FText k="mileage" ph="45000" type="number" /></Field>
          <Field label="Body type"><FSelect k="body_type" options={BODY_TYPES} /></Field>
          <div style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "end", paddingBottom: 10 }}>
            <input type="checkbox" id="recon" checked={form.is_recon} onChange={(e) => setVal("is_recon", e.target.checked)} />
            <label htmlFor="recon" style={{ fontSize: 13, color: color.ink }}>Recond / imported unit</label>
          </div>
        </div>
      )}

      {/* ── Step 2: Procurement ── */}
      {step === 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>
          <Field label="Purchase price (RM)" required hint="Your acquisition cost"><FText k="purchase_price" ph="45000" type="number" /></Field>
          <Field label="Purchase date" required><FText k="purchase_date" type="date" /></Field>
          <Field label="Source" required><FSelect k="purchase_source" options={SOURCES} /></Field>
          <Field label="Encumbrance" required hint="Gates the handover workflow">
            <select style={INP} value={form.encumbrance_status} onChange={(e) => setVal("encumbrance_status", e.target.value)}>
              <option value="clear">Clear — no loan</option>
              <option value="under_hp">Under HP — loan outstanding</option>
              <option value="unknown">Unknown — to verify</option>
            </select>
          </Field>
          {form.encumbrance_status === "under_hp" && (
            <Field label="Loan settlement amount (RM)" hint="Outstanding to settle before transfer"><FText k="loan_settlement_amount" ph="32000" type="number" /></Field>
          )}
          <Field label="Seller name / contact"><FText k="seller_contact" ph="optional reference" /></Field>
        </div>
      )}

      {/* ── Step 3: Condition & Pricing ── */}
      {step === 3 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }} className="addcar-pricing">
          <div style={{ display: "grid", gap: 16 }}>
            <Field label="Recon estimate (RM)" required hint="Refine later via recon job cards"><FText k="recon_cost" ph="2500" type="number" /></Field>
            <Field label="Condition"><FSelect k="condition" options={CONDITIONS} /></Field>
            <Field label="Condition notes">
              <textarea style={{ ...INP, minHeight: 64, resize: "vertical" }} value={form.condition_notes}
                placeholder="Front bumper scratch, needs respray…" onChange={(e) => setVal("condition_notes", e.target.value)} />
            </Field>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id="b5done" checked={form.b5_done} onChange={(e) => setVal("b5_done", e.target.checked)} />
              <label htmlFor="b5done" style={{ fontSize: 13, color: color.ink }}>Puspakom B5 already done</label>
            </div>
            {form.b5_done && <Field label="B5 date"><FText k="puspakom_b5_date" type="date" /></Field>}
            <Field label="Asking price (RM)" required><FText k="asking_price" ph="55000" type="number" /></Field>
            <Field label="Min acceptable (RM)" hint="Private floor — never shown to buyers"><FText k="min_price" ph="52000" type="number" /></Field>
            <Field label="Commission (RM)" hint="Pre-filled from your commission config"><FText k="commission_amount" ph="0" type="number" /></Field>
            <Field label="Warranty offered (months)" hint="Triggers warranty reserve if set in settings"><FText k="warranty_months" ph="6" type="number" /></Field>
          </div>

          {/* Live cost floor */}
          <div style={{ background: "#F7F8FA", border: "1px solid #EAECF0", borderRadius: 12, padding: 18, position: "sticky", top: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: color.textMuted, marginBottom: 14 }}>Live cost floor</p>
            {floor.lines.map((l) => (
              <div key={l.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: color.ink }}>{l.label}</span>
                  {l.hint && <span style={{ display: "block", fontSize: 10, color: color.textMuted }}>{l.hint}</span>}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: color.ink, whiteSpace: "nowrap", marginLeft: 8 }}>{RM(l.val)}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #EAECF0", margin: "10px 0", paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: color.ink }}>Cost floor</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: color.ink }}>{RM(floor.total)}</span>
            </div>
            {floor.dailyHold > 0 && (
              <p style={{ fontSize: 11, color: color.textMuted, marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}>
                <Info className="w-3 h-3" /> Holding: {RM(floor.dailyHold)}/day accrues from today
              </p>
            )}
            <div style={{ background: "#fff", borderRadius: 8, padding: "12px 14px", border: `1px solid ${floor.estGross < 0 ? "#FECACA" : floor.estGross < floor.total * 0.08 ? "#FDE68A" : "#BBF7D0"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: color.textMuted }}>Asking</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: color.ink }}>{RM(floor.asking)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: color.ink }}>Est. gross</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: floor.estGross < 0 ? color.accent : floor.estGross < floor.total * 0.08 ? "#B45309" : "#059669" }}>{RM(floor.estGross)}</span>
              </div>
            </div>
            {num(form.min_price) > 0 && num(form.min_price) < floor.total && (
              <p style={{ fontSize: 11, color: color.accent, marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                <AlertTriangle className="w-3 h-3" /> Min price is below cost floor — you would lose money at floor.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Step 4: Photos & Publish ── */}
      {step === 4 && (
        <div style={{ display: "grid", gap: 20 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            padding: 16, borderRadius: 12, border: `1px solid ${form.publish ? color.accent : "#EAECF0"}`,
            background: form.publish ? "#FEF2F2" : "#fff",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {form.publish ? <Globe className="w-5 h-5" style={{ color: color.accent }} /> : <Lock className="w-5 h-5" style={{ color: color.textMuted }} />}
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: color.ink }}>{form.publish ? "Publish to marketplace" : "Keep internal only"}</p>
                <p style={{ fontSize: 12, color: color.textMuted }}>{form.publish ? "Live on your storefront + xdrive.my. Photos required." : "Saved to inventory + P&L only. Publish later when ready."}</p>
              </div>
            </div>
            <button onClick={() => setVal("publish", !form.publish)}
              style={{ width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", background: form.publish ? color.accent : "#D1D5DB", position: "relative", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 3, left: form.publish ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
            </button>
          </div>

          <div>
            <label style={LBL}>Photos {form.publish && <span style={{ color: color.accent }}>* (min 1 to publish)</span>}</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {form.images.map((url, i) => (
                <div key={i} style={{ position: "relative", width: 92, height: 70, borderRadius: 8, overflow: "hidden", border: "1px solid #EAECF0" }}>
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X className="w-3 h-3" /></button>
                </div>
              ))}
              <button onClick={() => photosRef.current?.click()} disabled={uploading}
                style={{ width: 92, height: 70, borderRadius: 8, border: "1px dashed #D1D5DB", background: "#F7F8FA", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: color.textMuted }}>
                <Upload className="w-4 h-4" />
                <span style={{ fontSize: 10 }}>{uploading ? "Uploading…" : "Add"}</span>
              </button>
              <input ref={photosRef} type="file" accept="image/*" multiple hidden onChange={handlePhotos} />
            </div>
          </div>

          <Field label="Short description" hint="Optional — shown on the public listing">
            <textarea style={{ ...INP, minHeight: 64, resize: "vertical" }} value={form.description}
              placeholder="One owner, full service record, accident-free…" onChange={(e) => setVal("description", e.target.value)} />
          </Field>
          <Field label="Original / 'was' price (RM)" hint="Shows a discount badge on the listing"><FText k="original_price" ph="58000" type="number" /></Field>

          {/* Included services */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={LBL}>Included services (buyer-facing)</label>
              <button onClick={addService} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: color.accent, background: "none", border: "none", cursor: "pointer" }}><Plus className="w-3 h-3" /> Add</button>
            </div>
            {form.included_services.map((s, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 30px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <input style={INP} placeholder="e.g. Tint, PPF, 1yr warranty" value={s.name} onChange={(e) => updService(i, "name", e.target.value)} />
                <input style={INP} type="number" placeholder="cost" value={s.cost_price} onChange={(e) => updService(i, "cost_price", e.target.value)} />
                <input style={INP} type="number" placeholder="price" value={s.selling_price} onChange={(e) => updService(i, "selling_price", e.target.value)} />
                <button onClick={() => rmService(i)} style={{ border: "none", background: "none", cursor: "pointer", color: color.textMuted }}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Nav buttons ── */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, gap: 12 }}>
        <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 18px", borderRadius: 8, border: "1px solid #EAECF0", background: "#fff", color: step === 1 ? "#D1D5DB" : color.ink, fontSize: 14, fontWeight: 600, cursor: step === 1 ? "default" : "pointer" }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {step < 4 ? (
          <button onClick={() => stepValid(step) ? setStep((s) => s + 1) : setError("Fill in all required fields to continue.")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 22px", borderRadius: 8, border: "none", background: stepValid(step) ? color.accent : "#FCA5A5", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={submit} disabled={saving || !canSubmit}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 24px", borderRadius: 8, border: "none", background: canSubmit && !saving ? color.accent : "#FCA5A5", color: "#fff", fontSize: 14, fontWeight: 700, cursor: canSubmit && !saving ? "pointer" : "default" }}>
            {saving ? "Saving…" : form.publish ? "Add & Publish" : "Add to Inventory"} <Check className="w-4 h-4" />
          </button>
        )}
      </div>

      <style>{`@media(max-width:760px){.addcar-pricing{grid-template-columns:1fr!important;}}`}</style>
    </div>
    </FormCtx.Provider>
  );
}
