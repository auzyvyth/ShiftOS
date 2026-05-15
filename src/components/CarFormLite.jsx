import React, { useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useProfile } from "../hooks/useProfile";
import { Upload, X, ChevronLeft, ChevronRight } from "lucide-react";

const MAKES = ["Perodua","Proton","Toyota","Honda","Mazda","Mitsubishi","Nissan","Hyundai","Kia","BMW","Mercedes-Benz","Audi","Volkswagen","Ford","Subaru","Suzuki","Isuzu","Peugeot","Renault","Volvo","Other"];
const STATES = ["Johor","Kedah","Kelantan","Kuala Lumpur","Labuan","Melaka","Negeri Sembilan","Pahang","Penang","Perak","Perlis","Putrajaya","Sabah","Sarawak","Selangor","Terengganu"];
const TRANSMISSIONS = ["Auto","Manual","CVT","DCT"];
const FUEL_TYPES = ["Petrol","Diesel","Hybrid","Electric","PHEV"];
const BODY_TYPES = ["Sedan","SUV","Hatchback","MPV","Pickup Truck","Coupe","Convertible","Van","4WD","Others"];
const COLOURS = ["White","Silver","Grey","Black","Red","Blue","Green","Brown","Gold","Orange","Yellow","Purple","Other"];
const CONDITIONS = ["used","new","reconditioned"];
const YEARS = Array.from({ length: 35 }, (_, i) => String(new Date().getFullYear() - i));

const BUCKET = "car-images";

const FIELD = {
  padding: "9px 12px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#e5e7eb",
  fontSize: 13,
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "'DM Sans', sans-serif",
};

const SEL = { ...FIELD, appearance: "none", WebkitAppearance: "none", cursor: "pointer" };
const LBL = { fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5 };
const ERR = { fontSize: 11, color: "#f87171", marginTop: 4 };

export default function CarFormLite({ onCreate }) {
  const { profile } = useProfile();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [images, setImages] = useState([]);       // File objects
  const [previews, setPreviews] = useState([]);   // object URLs

  const [f, setF] = useState({
    brand: "", model: "", variant: "", year: String(new Date().getFullYear()),
    colour: "", condition: "used", transmission: "Auto", fuel_type: "Petrol",
    body_type: "Sedan", mileage: "", selling_price: "", state: "", city: "",
    description: "",
  });

  const inp = useRef(null);
  const upd = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));

  const addImages = (files) => {
    const arr = Array.from(files).slice(0, 10 - images.length);
    setImages(p => [...p, ...arr]);
    setPreviews(p => [...p, ...arr.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (i) => {
    URL.revokeObjectURL(previews[i]);
    setImages(p => p.filter((_, j) => j !== i));
    setPreviews(p => p.filter((_, j) => j !== i));
  };

  const canNext = () => {
    if (step === 1) return images.length > 0;
    if (step === 2) return f.brand && f.model && f.year && f.colour && f.condition && f.transmission && f.fuel_type && f.body_type;
    if (step === 3) return f.mileage && f.selling_price && f.state;
    return true;
  };

  const handleSubmit = async () => {
    if (!profile) return;
    setError(""); setSaving(true);

    try {
      // Upload images
      const urls = await Promise.all(images.map(async (file) => {
        const ext = file.name.split(".").pop();
        const path = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return publicUrl;
      }));

      const { data, error: insErr } = await supabase
        .from("car_listings")
        .insert([{
          dealer_id: profile.id,
          assigned_to: profile.id,
          status: "available",
          images: urls,
          brand: f.brand,
          model: f.model,
          variant: f.variant || null,
          year: parseInt(f.year),
          colour: f.colour,
          condition: f.condition,
          transmission: f.transmission,
          fuel_type: f.fuel_type,
          body_type: f.body_type,
          mileage: parseInt(f.mileage) || 0,
          selling_price: parseFloat(f.selling_price),
          base_price: parseFloat(f.selling_price),
          state: f.state || null,
          city: f.city || null,
        }])
        .select()
        .single();

      if (insErr) throw insErr;
      previews.forEach(p => URL.revokeObjectURL(p));
      onCreate(data);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const STEPS = ["Photos", "Details", "Pricing", "Review"];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: "#e5e7eb" }}>
      {/* Step bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              height: 3, width: "100%", borderRadius: 99,
              background: i < step ? "#2563eb" : "rgba(255,255,255,0.08)",
              transition: "background .3s",
            }} />
            <span style={{ fontSize: 9, color: i < step ? "#93c5fd" : "#374151", letterSpacing: ".06em", textTransform: "uppercase" }}>{s}</span>
          </div>
        ))}
      </div>

      {/* Step 1 — Photos */}
      {step === 1 && (
        <div>
          <input ref={inp} type="file" accept="image/*" multiple style={{ display: "none" }}
            onChange={e => { addImages(e.target.files); e.target.value = ""; }} />

          {previews.length === 0 ? (
            <div onClick={() => inp.current?.click()}
              style={{ border: "1.5px dashed rgba(255,255,255,0.12)", borderRadius: 10, padding: "40px 20px",
                textAlign: "center", cursor: "pointer", background: "rgba(255,255,255,0.02)" }}>
              <Upload size={24} style={{ color: "#4b5563", marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: 13, color: "#4b5563" }}>Tap to upload photos</p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#374151" }}>Up to 10 images · JPG, PNG, WEBP</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {previews.map((src, i) => (
                <div key={i} style={{ position: "relative", aspectRatio: "4/3", borderRadius: 8, overflow: "hidden", background: "#111" }}>
                  <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => removeImage(i)}
                    style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%",
                      background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                    <X size={11} />
                  </button>
                  {i === 0 && <span style={{ position: "absolute", bottom: 4, left: 4, fontSize: 9,
                    background: "#2563eb", color: "#fff", padding: "2px 6px", borderRadius: 99 }}>COVER</span>}
                </div>
              ))}
              {previews.length < 10 && (
                <div onClick={() => inp.current?.click()}
                  style={{ aspectRatio: "4/3", borderRadius: 8, border: "1.5px dashed rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                    background: "rgba(255,255,255,0.02)" }}>
                  <Upload size={18} style={{ color: "#4b5563" }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Details */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={LBL}>Make *</label>
              <select style={SEL} value={f.brand} onChange={upd("brand")}>
                <option value="">Select make</option>
                {MAKES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Year *</label>
              <select style={SEL} value={f.year} onChange={upd("year")}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={LBL}>Model *</label>
            <input style={FIELD} value={f.model} onChange={upd("model")} placeholder="e.g. Myvi, Civic, X5" />
          </div>
          <div>
            <label style={LBL}>Variant</label>
            <input style={FIELD} value={f.variant} onChange={upd("variant")} placeholder="e.g. 1.5 Executive" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={LBL}>Colour *</label>
              <select style={SEL} value={f.colour} onChange={upd("colour")}>
                <option value="">Select colour</option>
                {COLOURS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Condition *</label>
              <select style={SEL} value={f.condition} onChange={upd("condition")}>
                {CONDITIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Transmission *</label>
              <select style={SEL} value={f.transmission} onChange={upd("transmission")}>
                {TRANSMISSIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Fuel *</label>
              <select style={SEL} value={f.fuel_type} onChange={upd("fuel_type")}>
                {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={LBL}>Body Type *</label>
            <select style={SEL} value={f.body_type} onChange={upd("body_type")}>
              {BODY_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Step 3 — Pricing */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={LBL}>Selling Price (RM) *</label>
            <input style={FIELD} type="number" value={f.selling_price} onChange={upd("selling_price")} placeholder="e.g. 45000" />
          </div>
          <div>
            <label style={LBL}>Mileage (km) *</label>
            <input style={FIELD} type="number" value={f.mileage} onChange={upd("mileage")} placeholder="e.g. 82000" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={LBL}>State *</label>
              <select style={SEL} value={f.state} onChange={upd("state")}>
                <option value="">Select state</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>City</label>
              <input style={FIELD} value={f.city} onChange={upd("city")} placeholder="e.g. Subang Jaya" />
            </div>
          </div>
        </div>
      )}

      {/* Step 4 — Review */}
      {step === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {previews[0] && (
            <img src={previews[0]} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 10, marginBottom: 4 }} />
          )}
          {[
            ["Car", `${f.year} ${f.brand} ${f.model}${f.variant ? " " + f.variant : ""}`],
            ["Colour", f.colour], ["Condition", f.condition],
            ["Transmission", f.transmission], ["Fuel", f.fuel_type],
            ["Mileage", f.mileage ? `${Number(f.mileage).toLocaleString()} km` : "—"],
            ["Price", f.selling_price ? `RM ${Number(f.selling_price).toLocaleString("en-MY")}` : "—"],
            ["Location", [f.city, f.state].filter(Boolean).join(", ") || "—"],
            ["Photos", `${images.length} image${images.length !== 1 ? "s" : ""}`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12,
              padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ color: "#6b7280" }}>{k}</span>
              <span style={{ color: "#e5e7eb", fontWeight: 500 }}>{v}</span>
            </div>
          ))}
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#4b5563", lineHeight: 1.6 }}>
            This listing will appear on <span style={{ color: "#93c5fd" }}>xdrive.my</span> immediately after publishing.
          </p>
          {error && <p style={ERR}>⚠ {error}</p>}
        </div>
      )}

      {/* Nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, gap: 10 }}>
        {step > 1 ? (
          <button onClick={() => setStep(s => s - 1)}
            style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#6b7280",
              fontSize: 12, padding: "8px 14px", cursor: "pointer" }}>
            <ChevronLeft size={14} /> Back
          </button>
        ) : <div />}

        {step < 4 ? (
          <button onClick={() => canNext() && setStep(s => s + 1)} disabled={!canNext()}
            style={{ display: "flex", alignItems: "center", gap: 4, background: canNext() ? "#2563eb" : "rgba(37,99,235,0.3)",
              border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600,
              padding: "8px 18px", cursor: canNext() ? "pointer" : "not-allowed" }}>
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: 6, background: saving ? "rgba(37,99,235,0.5)" : "#2563eb",
              border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700,
              padding: "10px 22px", cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Publishing…" : "Publish Listing ⚡"}
          </button>
        )}
      </div>
    </div>
  );
}
