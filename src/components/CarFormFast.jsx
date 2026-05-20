import React, { useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useProfile } from "../hooks/useProfile";
import { getDealerIdFromProfile } from "../hooks/useProfile";
import { Camera, Upload, X, Zap } from "lucide-react";

const MAKES = ["Perodua","Proton","Toyota","Honda","Mazda","Mitsubishi","Nissan","Hyundai","Kia","BMW","Mercedes-Benz","Audi","Volkswagen","Ford","Subaru","Suzuki","Isuzu","Peugeot","Renault","Volvo","Other"];
const STATES = ["Johor","Kedah","Kelantan","Kuala Lumpur","Labuan","Melaka","Negeri Sembilan","Pahang","Penang","Perak","Perlis","Putrajaya","Sabah","Sarawak","Selangor","Terengganu"];
const YEARS = Array.from({ length: 35 }, (_, i) => String(new Date().getFullYear() - i));
const BUCKET = "car-images";

const S = {
  field: {
    padding: "11px 13px", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
    color: "#e5e7eb", fontSize: 14, width: "100%", outline: "none",
    boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif",
    WebkitAppearance: "none", appearance: "none",
  },
  label: { fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" },
  err: { fontSize: 12, color: "#f87171", marginTop: 6, textAlign: "center" },
};

export default function CarFormFast({ onCreate }) {
  const { profile } = useProfile();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [f, setF] = useState({
    brand: "", model: "", year: String(new Date().getFullYear()),
    selling_price: "", state: "",
  });

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const upd = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));

  const addFiles = (files) => {
    const arr = Array.from(files).slice(0, 10 - images.length);
    setImages(p => [...p, ...arr]);
    setPreviews(p => [...p, ...arr.map(file => URL.createObjectURL(file))]);
  };

  const removeImage = (i) => {
    URL.revokeObjectURL(previews[i]);
    setImages(p => p.filter((_, j) => j !== i));
    setPreviews(p => p.filter((_, j) => j !== i));
  };

  const canProceed = step === 1
    ? images.length > 0
    : f.brand && f.model && f.year && f.selling_price && f.state;

  const handleSubmit = async () => {
    if (!profile || !canProceed) return;
    setError(""); setSaving(true);
    try {
      const urls = await Promise.all(images.map(async (file) => {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return publicUrl;
      }));

      const dealerId = getDealerIdFromProfile(profile);
      const { data, error: insErr } = await supabase
        .from("car_listings")
        .insert([{
          dealer_id: dealerId,
          assigned_to: profile.id,
          status: "available",
          images: urls,
          brand: f.brand,
          model: f.model,
          year: parseInt(f.year),
          selling_price: parseFloat(f.selling_price),
          base_price: parseFloat(f.selling_price),
          state: f.state,
          condition: "used",
          transmission: "Auto",
          fuel_type: "Petrol",
          body_type: "Sedan",
        }])
        .select()
        .single();

      if (insErr) throw insErr;
      previews.forEach(p => URL.revokeObjectURL(p));
      onCreate(data);
    } catch (e) {
      setError(e.message || "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: "#e5e7eb" }}>

      {/* Progress bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {["Photos", "Details"].map((label, i) => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{
              height: 3, borderRadius: 99, marginBottom: 5,
              background: i < step ? "#dc2626" : "rgba(255,255,255,0.08)",
              transition: "background 0.3s",
            }} />
            <span style={{ fontSize: 10, color: i < step ? "#fca5a5" : "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Step 1 — Photos */}
      {step === 1 && (
        <div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment"
            style={{ display: "none" }} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={galleryRef} type="file" accept="image/*" multiple
            style={{ display: "none" }} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />

          {previews.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button type="button" onClick={() => cameraRef.current?.click()}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  border: "1.5px dashed rgba(220,38,38,0.4)", borderRadius: 14, padding: "28px 20px",
                  background: "rgba(220,38,38,0.05)", cursor: "pointer", color: "#fca5a5", fontSize: 15, fontWeight: 600 }}>
                <Camera size={24} /> Take Photo
              </button>
              <button type="button" onClick={() => galleryRef.current?.click()}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  border: "1.5px dashed rgba(255,255,255,0.1)", borderRadius: 14, padding: "16px 20px",
                  background: "rgba(255,255,255,0.02)", cursor: "pointer", color: "#6b7280", fontSize: 13 }}>
                <Upload size={18} /> Choose from Gallery
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                {previews.map((src, i) => (
                  <div key={i} style={{ position: "relative", aspectRatio: "4/3", borderRadius: 10, overflow: "hidden", background: "#111" }}>
                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" onClick={() => removeImage(i)}
                      style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%",
                        background: "rgba(0,0,0,0.75)", border: "none", color: "#fff", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                      <X size={12} />
                    </button>
                    {i === 0 && <span style={{ position: "absolute", bottom: 4, left: 4, fontSize: 9,
                      background: "#dc2626", color: "#fff", padding: "2px 6px", borderRadius: 99, fontWeight: 700 }}>COVER</span>}
                  </div>
                ))}
                {previews.length < 10 && (
                  <button type="button" onClick={() => cameraRef.current?.click()}
                    style={{ aspectRatio: "4/3", borderRadius: 10, border: "1.5px dashed rgba(255,255,255,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                      background: "rgba(255,255,255,0.02)" }}>
                    <Camera size={20} style={{ color: "#4b5563" }} />
                  </button>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "#4b5563", textAlign: "center" }}>{previews.length} photo{previews.length !== 1 ? "s" : ""} added</p>
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Essentials */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={S.label}>Brand *</label>
              <select style={S.field} value={f.brand} onChange={upd("brand")}>
                <option value="">Select</option>
                {MAKES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Year *</label>
              <select style={S.field} value={f.year} onChange={upd("year")}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={S.label}>Model *</label>
            <input style={S.field} value={f.model} onChange={upd("model")} placeholder="e.g. Myvi, Civic, Hilux" />
          </div>
          <div>
            <label style={S.label}>Price (RM) *</label>
            <input style={S.field} type="number" inputMode="numeric" value={f.selling_price} onChange={upd("selling_price")} placeholder="e.g. 45000" />
          </div>
          <div>
            <label style={S.label}>State *</label>
            <select style={S.field} value={f.state} onChange={upd("state")}>
              <option value="">Select state</option>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "#4b5563", lineHeight: 1.6 }}>
            Listed immediately as <span style={{ color: "#4ade80" }}>available</span>. You can add mileage, colour, and more details after.
          </p>
          {error && <p style={S.err}>⚠ {error}</p>}
        </div>
      )}

      {/* Nav */}
      <div style={{ display: "flex", justifyContent: step > 1 ? "space-between" : "flex-end", marginTop: 22, gap: 10 }}>
        {step > 1 && (
          <button type="button" onClick={() => { setError(""); setStep(1); }}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
              color: "#6b7280", fontSize: 13, padding: "10px 18px", cursor: "pointer" }}>
            ← Back
          </button>
        )}
        {step === 1 ? (
          <button type="button" onClick={() => setStep(2)} disabled={!canProceed}
            style={{ display: "flex", alignItems: "center", gap: 6, background: canProceed ? "#dc2626" : "rgba(220,38,38,0.25)",
              border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700,
              padding: "10px 22px", cursor: canProceed ? "pointer" : "not-allowed" }}>
            Next →
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={saving || !canProceed}
            style={{ display: "flex", alignItems: "center", gap: 6,
              background: (saving || !canProceed) ? "rgba(220,38,38,0.3)" : "#dc2626",
              border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700,
              padding: "12px 24px", cursor: (saving || !canProceed) ? "not-allowed" : "pointer" }}>
            <Zap size={15} />
            {saving ? "Publishing…" : "Publish Now"}
          </button>
        )}
      </div>
    </div>
  );
}
