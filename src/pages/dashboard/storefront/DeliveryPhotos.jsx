// Storefront > Delivery photos (STOREFRONT-2 stage 4 phase C): the dealer's handover photos for
// the "Happy customers" section of their site. Exists only once DB_PHASE_C is on
// (storefrontLayout.js DELIVERIES_OPEN): before that the table and the upload folder rules
// (migration 20261121b) are not there.
//
// The law (PDPA 2010, checked 2026-11-21, docs/STOREFRONT_PLAN.md phase C): a buyer's photo is
// their personal data, so publishing it needs their consent, recorded, and they can withdraw it.
// So Upload stays off until the dealer ticks that the buyer agreed (and says how: in writing or
// on WhatsApp); the database stamps who ticked and when, and keeps no name, phone or plate.
// Delete is one tap, for when a buyer asks. The words are the car + the month + a short
// caption, checked by the ONE rules file, src/utils/deliveryCaption.js (same as the SQL).
// Photos are re-encoded on the device (compressImage.js), which also drops the camera's
// location data. Light dashboard look (premiumLight): white cards on a shadow, grey rows,
// one red button.
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { supabase } from "../../../supabaseClient";
import { premiumLight as PL } from "../../../theme/tokens";
import { compressImageFile, photoExt } from "../../../utils/compressImage";
import { cdnImg } from "../../../utils/img";
import {
  CAPTION_MAX, CAR_NAME_MAX, DELIVERY_CAP, SITE_SHOWS, cleanCaption, cleanCarName, textProblem,
  monthValue, monthLabel, deliveryFolder, deliveryPathOf,
} from "../../../utils/deliveryCaption";

const card = { background: PL.card, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: 20, minWidth: 0 };
const label = { display: "block", fontSize: 12, fontWeight: 600, color: PL.textMuted, margin: "0 0 6px" };
const input = {
  width: "100%", boxSizing: "border-box", border: "none", borderRadius: PL.radius.row, background: PL.raised,
  padding: "11px 12px", fontSize: 14, color: PL.text, fontFamily: "inherit", outline: "none",
};
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const ERRORS = {
  consent_required: "Tick that the buyer agreed first.",
  future_month: "Pick this month or an earlier one.",
  delivery_cap: `You have ${DELIVERY_CAP} photos, the most there can be. Delete an old one first.`,
};

export default function DeliveryPhotos({ dealerId }) {
  const [rows, setRows] = useState(null);
  const [loadErr, setLoadErr] = useState(false);
  const [soldCars, setSoldCars] = useState([]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [carName, setCarName] = useState("");
  const [month, setMonth] = useState(thisMonth);
  const [caption, setCaption] = useState("");
  const [how, setHow] = useState("whatsapp");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ kind: "", text: "" });
  const [deleting, setDeleting] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    const { data, error } = await supabase.from("storefront_deliveries")
      .select("id, photo_url, caption, car_name, delivered_month, consent_at, consent_how")
      .eq("dealer_id", dealerId)
      .order("delivered_month", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) { setLoadErr(true); setRows((r) => r || []); return; }
    setLoadErr(false);
    setRows(data || []);
  };

  useEffect(() => {
    if (!dealerId) return undefined;
    let live = true;
    load();
    // Cars sold in the last 12 months, offered as the car name (the dealer can type any other).
    const since = new Date(Date.now() - 365 * 86400000).toISOString();
    supabase.from("car_listings").select("brand, model, variant, year, sold_at")
      .eq("dealer_id", dealerId).eq("status", "sold").gte("sold_at", since)
      .order("sold_at", { ascending: false }).limit(40)
      .then(({ data }) => { if (live && Array.isArray(data)) setSoldCars(data); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerId]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const suggestions = useMemo(() => {
    const seen = new Map();
    for (const c of soldCars) {
      const name = cleanCarName([c.year, c.brand, c.model, c.variant].filter(Boolean).join(" "));
      if (name && !seen.has(name)) seen.set(name, String(c.sold_at || "").slice(0, 7));
    }
    return seen;
  }, [soldCars]);

  const carProblem = carName ? textProblem(carName, { max: CAR_NAME_MAX, required: true }) : "";
  const capProblem = textProblem(caption, { max: CAPTION_MAX });
  const monthOk = !!monthValue(month);
  const full = (rows?.length || 0) >= DELIVERY_CAP;
  const ready = !!file && !!cleanCarName(carName) && !carProblem && !capProblem && monthOk && agreed && !busy && !full;

  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { setStatus({ kind: "bad", text: "Pick a photo (JPG, PNG or WebP)." }); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStatus({ kind: "", text: "" });
  };

  const changeCar = (v) => {
    setCarName(v);
    const m = suggestions.get(v);
    if (m) setMonth(m);
  };

  const reset = () => {
    setFile(null); setPreview(""); setCarName(""); setCaption(""); setAgreed(false); setMonth(thisMonth());
  };

  const upload = async () => {
    if (!ready) return;
    setBusy(true);
    setStatus({ kind: "", text: "Uploading..." });
    let path = null;
    try {
      const blob = await compressImageFile(file, { maxDim: 1600, quality: 0.82 });
      const type = blob.type || "image/jpeg";
      path = `${deliveryFolder(dealerId)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${photoExt({ type })}`;
      const up = await supabase.storage.from("car-images").upload(path, blob, { contentType: type, upsert: false });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("car-images").getPublicUrl(path);
      const { data: auth } = await supabase.auth.getUser();
      // consent_at / consent_by: the database overwrites both with now() and the signed-in user.
      const { data, error } = await supabase.from("storefront_deliveries").insert({
        dealer_id: dealerId,
        photo_url: pub.publicUrl,
        car_name: cleanCarName(carName),
        caption: cleanCaption(caption) || null,
        delivered_month: monthValue(month),
        consent_at: new Date().toISOString(),
        consent_by: auth?.user?.id,
        consent_how: how,
      }).select("id");
      if (error || !data?.length) throw error || new Error("not saved");
      path = null;
      reset();
      setStatus({ kind: "good", text: "Added. It shows on your site now (if Happy customers is on in Layout)." });
      await load();
    } catch (err) {
      const code = Object.keys(ERRORS).find((k) => String(err?.message || "").includes(k));
      setStatus({ kind: "bad", text: code ? ERRORS[code] : "Not uploaded. Check your connection and try again." });
    } finally {
      // The row did not save: take the file back out so nothing sits in storage without consent.
      if (path) supabase.storage.from("car-images").remove([path]).catch(() => {});
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (deleting) return;
    setDeleting(row.id);
    const { data, error } = await supabase.from("storefront_deliveries").delete().eq("id", row.id).select("id");
    setDeleting(null);
    if (error || !data?.length) { setStatus({ kind: "bad", text: "Not deleted. Try again." }); return; }
    const p = deliveryPathOf(row.photo_url, dealerId);
    if (p) supabase.storage.from("car-images").remove([p]).catch(() => {});
    setRows((rs) => (rs || []).filter((r) => r.id !== row.id));
    setStatus({ kind: "good", text: "Deleted. It is off your site now." });
  };

  return (
    <div className="sf-deliv" style={{ display: "grid", gap: 16 }}>
      <style>{`
        .sf-deliv-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
        .sf-deliv-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
        @media (max-width: 900px) { .sf-deliv-grid { grid-template-columns: minmax(0, 1fr); } }
        @media (max-width: 480px) { .sf-deliv-list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } }
      `}</style>
      <div className="sf-deliv-grid">
        <div style={card}>
          <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: PL.text }}>Add a delivery photo</h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: PL.textMuted, lineHeight: 1.5 }}>
            Shows in "Happy customers" on your site: the photo, the car and the month. Only with the buyer's OK.
          </p>

          <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            style={{ width: "100%", border: "none", borderRadius: PL.radius.row, background: PL.raised, cursor: "pointer",
              padding: 0, overflow: "hidden", display: "block", aspectRatio: preview ? "4 / 3" : undefined }}>
            {preview
              ? <img src={preview} alt="The photo you picked" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              : (
                <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 12px", color: PL.textSec }}>
                  <ImagePlus size={22} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Pick a photo</span>
                  <span style={{ fontSize: 12, color: PL.textMuted }}>Cover the number plate or leave it out of the shot.</span>
                </span>
              )}
          </button>
          {preview && (
            <button type="button" className="pl-btn-grey" onClick={() => fileRef.current?.click()} disabled={busy}
              style={{ marginTop: 8, padding: "8px 12px", fontSize: 13 }}>Pick another</button>
          )}

          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <div>
              <label style={label} htmlFor="sfd-car">Car</label>
              <input id="sfd-car" style={input} list="sfd-sold" value={carName} maxLength={CAR_NAME_MAX}
                placeholder="e.g. 2020 Honda City 1.5 V" onChange={(e) => changeCar(e.target.value)} />
              <datalist id="sfd-sold">{[...suggestions.keys()].map((n) => <option key={n} value={n} />)}</datalist>
              {carProblem && <p style={{ margin: "6px 0 0", fontSize: 12, color: PL.accentText }}>{carProblem}</p>}
            </div>
            <div>
              <label style={label} htmlFor="sfd-month">Month handed over</label>
              <input id="sfd-month" type="month" style={input} value={month} max={thisMonth()} onChange={(e) => setMonth(e.target.value)} />
              {!monthOk && <p style={{ margin: "6px 0 0", fontSize: 12, color: PL.accentText }}>Pick this month or an earlier one.</p>}
            </div>
            <div>
              <label style={label} htmlFor="sfd-cap">Caption (optional)</label>
              <input id="sfd-cap" style={input} value={caption} maxLength={CAPTION_MAX}
                placeholder="e.g. Drive safe!" onChange={(e) => setCaption(e.target.value)} />
              <p style={{ margin: "6px 0 0", fontSize: 12, color: capProblem ? PL.accentText : PL.textMuted }}>
                {capProblem || `${caption.length}/${CAPTION_MAX}. No buyer names, phone numbers or plates.`}
              </p>
            </div>

            <div style={{ borderRadius: PL.radius.row, background: PL.raised, padding: 12 }}>
              <span style={{ ...label, marginBottom: 8 }}>How did the buyer agree?</span>
              <div role="radiogroup" aria-label="How the buyer agreed" style={{ display: "inline-flex", gap: 6, padding: 4, borderRadius: PL.radius.row, background: "#fff", flexWrap: "wrap" }}>
                {[["whatsapp", "On WhatsApp"], ["written", "In writing"]].map(([k, t]) => (
                  <button key={k} type="button" role="radio" aria-checked={how === k} onClick={() => setHow(k)}
                    style={{ border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600,
                      background: how === k ? PL.text : "transparent", color: how === k ? "#fff" : PL.textSec }}>{t}</button>
                ))}
              </div>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 1, accentColor: PL.text, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: PL.text, lineHeight: 1.5 }}>
                  The buyer agreed {how === "whatsapp" ? "on WhatsApp" : "in writing"} to this photo being shown on our
                  website, and I have kept that message.
                </span>
              </label>
              <p style={{ margin: "8px 0 0 28px", fontSize: 12, color: PL.textMuted, lineHeight: 1.5 }}>
                If they later ask you to take it down, delete it here. We save who ticked this and when.
              </p>
            </div>

            <button type="button" onClick={upload} disabled={!ready}
              style={{ background: ready ? PL.accent : "#e5e7eb", color: ready ? PL.onAccent : "#9ca3af", border: "none",
                borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: ready ? "pointer" : "default" }}>
              {busy ? "Uploading..." : "Upload"}
            </button>
            {!ready && !busy && (
              <p style={{ margin: 0, fontSize: 12, color: PL.textMuted }}>
                {full ? ERRORS.delivery_cap
                  : !file ? "Pick a photo first."
                    : !cleanCarName(carName) ? "Type the car."
                      : !agreed ? "Tick that the buyer agreed to turn Upload on." : ""}
              </p>
            )}
            {status.text && (
              <p role="status" style={{ margin: 0, fontSize: 13, color: status.kind === "bad" ? PL.accentText : status.kind === "good" ? PL.up : PL.textMuted }}>
                {status.text}
              </p>
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: PL.text }}>On your site</h3>
            {rows && rows.length > 0 && (
              <span style={{ fontSize: 12, color: PL.textMuted, fontVariantNumeric: "tabular-nums" }}>
                {rows.length} of {DELIVERY_CAP}{rows.length > SITE_SHOWS ? `, newest ${SITE_SHOWS} shown` : ""}
              </span>
            )}
          </div>
          {rows === null ? (
            <p style={{ margin: 0, fontSize: 14, color: PL.textMuted }}>Loading your photos...</p>
          ) : loadErr ? (
            <p style={{ margin: 0, fontSize: 14, color: PL.accentText }}>Could not load your photos. Try again in a moment.</p>
          ) : rows.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: PL.textMuted, lineHeight: 1.5 }}>
              No photos yet. Your site hides "Happy customers" until you add one.
            </p>
          ) : (
            <div className="sf-deliv-list">
              {rows.map((r) => (
                <div key={r.id} style={{ borderRadius: PL.radius.row, background: PL.raised, overflow: "hidden", minWidth: 0 }}>
                  <div style={{ aspectRatio: "4 / 3", background: "#e5e7eb" }}>
                    <img src={cdnImg(r.photo_url, 320, 70)} alt={r.car_name} loading="lazy"
                      onError={(e) => { if (e.currentTarget.src !== r.photo_url) e.currentTarget.src = r.photo_url; }}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                  <div style={{ padding: "8px 10px 10px", display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: PL.text, lineHeight: 1.3, overflow: "hidden", overflowWrap: "anywhere",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{r.car_name}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: PL.textMuted }}>{monthLabel(r.delivered_month)}</p>
                    </div>
                    <button type="button" aria-label={`Delete the ${r.car_name} photo`} title="Delete" onClick={() => remove(r)}
                      disabled={deleting === r.id}
                      style={{ width: 32, height: 32, flexShrink: 0, display: "grid", placeItems: "center", border: "none",
                        borderRadius: 8, background: "#fff", color: PL.textSec, cursor: "pointer" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
