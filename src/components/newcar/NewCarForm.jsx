import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, ChevronLeft, ImagePlus, X } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { getDealerIdFromProfile } from "../../hooks/useProfile";
import { groupByModel, rm, priceBasis } from "../../utils/newCars";

// NEWCAR-1: the add-car form for a new-car advisor (Proton / Perodua / Toyota).
// Rendered by CarForm and CarFormFast in place of the used-car form when
// profile.seller_type === 'new_car' (owner, 2026-10-08).
//
// A card is a normal car_listings row with new_car_model_id set, so it gets the
// same card, copy tools and performance stats as a used car. What the advisor
// does NOT type: brand, model, variant, price. The DB trigger new_car_card_fill
// copies them from new_car_models, priced for the advisor's zone, and re-prices
// the card whenever the console price changes. The advisor adds what only they
// have: their own photos (brochure images belong to the brand), colour, words.
//
// One card per variant (owner's call): the monthly maths, the presenter's #N
// and the stats all line up 1 to 1.

const MAX_PHOTOS = 20;
const BUCKET = "car-images";

const themes = {
  light: { fg: "#111827", sub: "#6b7280", line: "#e5e7eb", card: "#fff", soft: "#f9fafb", input: "#fff", on: "rgba(220,38,38,0.06)", onLine: "#dc2626" },
  dark:  { fg: "#f1f5f9", sub: "#9ca3af", line: "rgba(255,255,255,0.1)", card: "rgba(255,255,255,0.03)", soft: "rgba(255,255,255,0.04)", input: "rgba(255,255,255,0.05)", on: "rgba(220,38,38,0.12)", onLine: "rgba(220,38,38,0.5)" },
};

// DB exception -> plain words. A new code needs a line here.
function saveError(e) {
  const m = `${e?.message || ""} ${e?.code || ""}`;
  if (m.includes("new_car_no_price_for_zone")) return "There is no official price for your area yet. XDrive adds it soon; try again later.";
  if (m.includes("new_car_wrong_brand")) return "This model is not from the brand on your profile. Change your brand in Settings > New cars.";
  if (m.includes("new_car_model_unavailable")) return "This variant was just taken off the price list. Pick another one.";
  if (m.includes("23505") || m.includes("one_card_per_variant")) return "You already have a card for this variant.";
  if (m.includes("new_car_model_id") && m.includes("column")) return "New-car cards switch on after tonight's update. Try again tomorrow.";
  if (m.includes("subscription_inactive")) return "Your plan has ended. Activate it to add cards.";
  return "Couldn't save. Try again.";
}

const compress = (file, maxWidth = 1400, quality = 0.82) => new Promise((resolve) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(url);
    const scale = Math.min(1, maxWidth / img.width);
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((b) => resolve(b ? new File([b], "photo.jpg", { type: "image/jpeg" }) : file), "image/jpeg", quality);
  };
  img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
  img.src = url;
});

export default function NewCarForm({ profile, listing, onCreate, onUpdate, onUseUsedForm, onOpenNewCars, dark = false }) {
  const th = dark ? themes.dark : themes.light;
  const brand = profile?.new_car_brand || "";
  const editing = !!listing;
  const [rows, setRows] = useState(null);
  const [taken, setTaken] = useState(new Set());
  const [loadErr, setLoadErr] = useState("");
  const [model, setModel] = useState(editing ? listing.model : "");
  const [pick, setPick] = useState(editing ? listing.new_car_model_id : null);
  const [photos, setPhotos] = useState(editing ? (listing.images || []).filter(Boolean) : []); // urls
  const [uploading, setUploading] = useState(0);
  const [colour, setColour] = useState(editing ? listing.colour || "" : "");
  const [desc, setDesc] = useState(editing ? listing.description || "" : "");
  const [saving, setSaving] = useState(false);
  const [editLoaded, setEditLoaded] = useState(!editing);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (!brand || editing) return;
    let alive = true;
    const dealerId = getDealerIdFromProfile(profile);
    Promise.all([
      supabase.rpc("get_my_new_car_catalogue", { p_brand: brand }),
      supabase.from("car_listings").select("new_car_model_id")
        .eq("dealer_id", dealerId).not("new_car_model_id", "is", null)
        .eq("new_car_unit", false).not("status", "in", "(sold,archived)"),
    ]).then(([cat, mine]) => {
      if (!alive) return;
      if (cat.error) { setLoadErr("Couldn't load the price list. Try again in a moment."); setRows([]); return; }
      setRows(cat.data || []);
      // Before tonight's migration the column does not exist: no cards yet.
      if (!mine.error) setTaken(new Set((mine.data || []).map((r) => r.new_car_model_id)));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, editing, profile?.id]);

  // Editing: read the card's own fields fresh. The panels' listing selects do
  // not all carry description, and saving a blank would wipe it.
  useEffect(() => {
    if (!editing) return;
    let alive = true;
    supabase.from("car_listings").select("images, colour, description").eq("id", listing.id).maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        setEditLoaded(true);
        setPhotos((data.images || []).filter(Boolean));
        setColour(data.colour || "");
        setDesc(data.description || "");
      });
    return () => { alive = false; };
  }, [editing, listing?.id]);

  const groups = useMemo(() => groupByModel(rows || []), [rows]);
  const variants = groups.find((g) => g.model === model)?.variants || [];
  const chosen = (rows || []).find((r) => r.model_id === pick);

  const addFiles = async (files) => {
    const list = Array.from(files || []).slice(0, MAX_PHOTOS - photos.length);
    if (!list.length || !profile?.id) return;
    setError("");
    setUploading((n) => n + list.length);
    await Promise.all(list.map(async (file) => {
      try {
        const small = await compress(file);
        const path = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error: e } = await supabase.storage.from(BUCKET).upload(path, small, { upsert: true, contentType: "image/jpeg", cacheControl: "31536000" });
        if (e) throw e;
        const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        setPhotos((p) => [...p, url]);
      } catch {
        setError("A photo failed to upload. Add it again.");
      } finally {
        setUploading((n) => n - 1);
      }
    }));
  };

  const canSave = (editing ? editLoaded : chosen?.price != null) && photos.length > 0 && uploading === 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    const fields = { images: photos, colour: colour.trim() || null, description: desc.trim() || null };
    try {
      if (editing) {
        const { data, error: e } = await supabase.from("car_listings").update(fields).eq("id", listing.id).select("*").single();
        if (e) throw e;
        onUpdate?.(data);
      } else {
        // brand / model / variant / price are overwritten by new_car_card_fill;
        // they are sent only because the columns are NOT NULL in the payload check.
        const { data, error: e } = await supabase.from("car_listings").insert([{
          ...fields,
          dealer_id: getDealerIdFromProfile(profile),
          assigned_to: profile.id,
          new_car_model_id: chosen.model_id,
          brand, model: chosen.model, variant: chosen.variant,
          selling_price: chosen.price,
          condition: "new",
          state: profile.state || null,
          city: profile.city || null,
          // Salesmen's listings are reviewed, the same as the used-car form.
          status: profile.role === "salesman" ? "pending_approval" : "available",
        }]).select("*").single();
        if (e) throw e;
        onCreate?.(data);
      }
    } catch (e) {
      setError(saveError(e));
    }
    setSaving(false);
  };

  const box = { background: th.card, border: `1px solid ${th.line}`, borderRadius: 12 };
  const h = { margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: th.fg };
  const sub = { margin: 0, fontSize: 12.5, color: th.sub, lineHeight: 1.55 };
  const tile = (on, off) => ({
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%",
    padding: "11px 12px", borderRadius: 10, cursor: off ? "default" : "pointer", fontFamily: "inherit", textAlign: "left",
    background: on ? th.on : th.input, border: `1px solid ${on ? th.onLine : th.line}`, color: th.fg, opacity: off ? 0.55 : 1,
  });
  const input = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${th.line}`, background: th.input, color: th.fg, fontSize: 14, fontFamily: "inherit" };

  if (!brand) {
    return (
      <div style={{ ...box, padding: 16 }}>
        <p style={h}>Pick your brand first</p>
        <p style={sub}>Choose Proton, Perodua or Toyota in Settings &gt; New cars, then come back.</p>
        {onOpenNewCars && <button type="button" onClick={onOpenNewCars} style={{ ...tile(true), marginTop: 12, justifyContent: "center", fontWeight: 600 }}>Open New cars settings</button>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, color: th.fg }}>
      {/* 1. Which car. Locked when editing: changing the variant is a new card. */}
      <div style={{ ...box, padding: 14 }}>
        {editing ? (
          <>
            <p style={h}>{listing.brand} {listing.model} {listing.variant}</p>
            <p style={sub}>Official price {rm(listing.selling_price)}. XDrive keeps it in line with {listing.brand}'s price list. To sell another variant, add a new card.</p>
          </>
        ) : rows === null ? (
          <p style={sub}>Loading {brand} models...</p>
        ) : loadErr ? (
          <p style={{ ...sub, color: "#f59e0b" }}>{loadErr}</p>
        ) : rows.length === 0 ? (
          <p style={sub}>We're adding the {brand} price list. You can make cards as soon as it's in.</p>
        ) : !model ? (
          <>
            <p style={h}>Which {brand} model?</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))", gap: 8 }}>
              {groups.map((g) => (
                <button key={g.model} type="button" style={tile(false)} onClick={() => { setModel(g.model); setPick(null); }}>
                  <span style={{ fontWeight: 700, minWidth: 0 }}>{g.model}</span>
                  <span style={{ fontSize: 11.5, color: th.sub, flexShrink: 0 }}>{g.variants.length}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button type="button" onClick={() => { setModel(""); setPick(null); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, marginBottom: 8, color: th.sub, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
              <ChevronLeft size={14} /> All models
            </button>
            <p style={h}>Which {brand} {model}?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {variants.map((v) => {
                const has = taken.has(v.model_id);
                const noPrice = v.price == null;
                const off = has || noPrice;
                return (
                  <button key={v.model_id} type="button" disabled={off} style={tile(pick === v.model_id, off)} onClick={() => setPick(v.model_id)}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 600 }}>{v.variant}</span>
                      {has && <span style={{ fontSize: 11.5, color: th.sub }}>Already on your page</span>}
                      {!has && noPrice && <span style={{ fontSize: 11.5, color: th.sub }}>No price for your area yet</span>}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {rm(v.price) || "-"}
                      {pick === v.model_id && <Check size={15} color="#dc2626" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <p style={{ ...sub, fontSize: 11.5, marginTop: 8 }}>{priceBasis(rows[0]?.price_zone)} You can't change it: it's {brand}'s price, and XDrive updates it for every advisor.</p>
          </>
        )}
      </div>

      {/* 2. Their own photos. Required: a card without one is the "no photo" problem. */}
      {(editing || chosen) && (
        <div style={{ ...box, padding: 14 }}>
          <p style={h}>Your photos of this car</p>
          <p style={{ ...sub, marginBottom: 10 }}>
            Use your own: the car in your showroom, a customer handover, a test drive. Real photos from you get more replies than brochure pictures, and {brand}'s brochure images belong to {brand}.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))", gap: 8 }}>
            {photos.map((u, i) => (
              <div key={u} style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 8, overflow: "hidden", background: th.soft }}>
                <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {i === 0 && <span style={{ position: "absolute", left: 4, bottom: 4, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: "rgba(0,0,0,0.6)", color: "#fff" }}>Cover</span>}
                <button type="button" aria-label="Remove photo" onClick={() => setPhotos((p) => p.filter((x) => x !== u))}
                  style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 12, border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={13} />
                </button>
              </div>
            ))}
            {Array.from({ length: uploading }).map((_, i) => (
              <div key={`u${i}`} style={{ aspectRatio: "4 / 3", borderRadius: 8, background: th.soft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: th.sub }}>Uploading</div>
            ))}
            {photos.length + uploading < MAX_PHOTOS && (
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ aspectRatio: "4 / 3", borderRadius: 8, border: `1.5px dashed ${photos.length ? th.line : "#dc2626"}`, background: "transparent", color: photos.length ? th.sub : "#dc2626", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600 }}>
                {photos.length ? <ImagePlus size={18} /> : <Camera size={18} />}
                {photos.length ? "Add more" : "Add your photo"}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </div>
      )}

      {/* 3. The words. Optional: the card already has the official name and price. */}
      {(editing || chosen) && (
        <div style={{ ...box, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: th.sub }}>
            Colours you can get (optional)
            <input style={input} value={colour} onChange={(e) => setColour(e.target.value)} placeholder="e.g. Snow White, Armour Silver" maxLength={120} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600, color: th.sub }}>
            What you offer (optional)
            <textarea style={{ ...input, minHeight: 96, resize: "vertical" }} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000}
              placeholder="Delivery time, trade-in, help with the loan, what's in stock this month. Don't promise a loan approval or a rebate that has ended." />
          </label>
        </div>
      )}

      {error && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "#f87171" }}>{error}</p>}

      {(editing || chosen) && (
        <button type="button" onClick={save} disabled={!canSave}
          style={{ height: 46, borderRadius: 12, border: "none", background: canSave ? "#dc2626" : th.soft, color: canSave ? "#fff" : th.sub, fontSize: 15, fontWeight: 700, cursor: canSave ? "pointer" : "default", fontFamily: "inherit" }}>
          {saving ? "Saving..." : editing ? "Save changes" : photos.length ? "Put it on my page" : "Add a photo to continue"}
        </button>
      )}

      {!editing && onUseUsedForm && (
        <button type="button" onClick={onUseUsedForm}
          style={{ background: "none", border: "none", color: th.sub, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", alignSelf: "center" }}>
          Selling a used or recon car? Use the used-car form
        </button>
      )}
    </div>
  );
}
