import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { NEW_CAR_BRANDS } from "../../utils/newCars";
import NewCarForm from "./NewCarForm";

// The first screen of Add car for a salesman: Used, Recon or New. Used and
// Recon open the used-car form with the condition already set; New asks the
// brand (Proton / Perodua / Toyota / BYD) and opens NewCarForm. Owner's call
// (2026-10-17): one Add car for everyone, because many new-car advisors also
// broker used and recon cars for other dealers.
//
// A seller holds ONE new-car brand (profiles.new_car_brand, checked by
// new_car_card_fill on every card). Picking a brand saves it on the profile;
// picking a different one from the one saved asks first.
//
// Rendered by CarForm and CarFormFast; `renderUsed(defaults)` is the caller's
// own used-car form so each keeps its layout.
//
// `dark` MUST match the sheet it sits in: Lite's add-car sheet is white
// (CarFormModal), Premium's is #0d1117 (ListingFormModal). Drawn for white on
// the dark sheet, the headings went dark-on-dark and the tiles glared white.
// Every text node sets its colour explicitly; nothing inherits from the sheet.
// Words: `carKind.*` in src/i18n/locales/{en,ms}.json.
export default function CarKindChooser({ profile, dark = false, onCreate, onOpenNewCars, renderUsed }) {
  const { t } = useTranslation();
  const tr = (k, o) => t(`carKind.${k}`, o);
  const th = dark
    ? { fg: "#f1f5f9", sub: "#9ca3af", line: "rgba(255,255,255,0.1)", tile: "rgba(255,255,255,0.04)", on: "rgba(220,38,38,0.12)", onLine: "rgba(220,38,38,0.5)" }
    : { fg: "#111827", sub: "#6b7280", line: "#e5e7eb", tile: "#fff", on: "rgba(220,38,38,0.06)", onLine: "#dc2626" };
  const [kind, setKind] = useState(null); // null | used | recon | new
  const [brand, setBrand] = useState(null); // brand confirmed for this listing
  const [switchTo, setSwitchTo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saved = profile?.new_car_brand || null;
  // A private seller sells their own car; a price-list card is not theirs to make.
  const canNew = profile?.seller_type !== "private";

  const back = () => { setKind(null); setBrand(null); setSwitchTo(null); setError(""); };

  const pickBrand = async (b) => {
    setError("");
    if (b === saved) { setBrand(b); return; }
    if (saved && switchTo !== b) { setSwitchTo(b); return; }
    setSaving(true);
    // Only the brand. seller_type stays as it is, so a broker who also sells
    // new stays a broker.
    const { error: e } = await supabase.from("profiles").update({ new_car_brand: b }).eq("id", profile.id);
    setSaving(false);
    if (e) { setError(tr("saveErr")); return; }
    setBrand(b);
  };

  const tile = (on) => ({
    display: "block", width: "100%", textAlign: "left", padding: "14px 14px", borderRadius: 12,
    cursor: "pointer", fontFamily: "inherit", color: th.fg,
    background: on ? th.on : th.tile, border: `1px solid ${on ? th.onLine : th.line}`,
  });
  const title = { margin: 0, fontSize: 15, fontWeight: 700, color: th.fg };
  const sub = { margin: "3px 0 0", fontSize: 12.5, color: th.sub, lineHeight: 1.5 };
  const backBtn = (
    <button type="button" onClick={back}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: th.sub, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: "0 0 10px" }}>
      <ChevronLeft size={15} /> {tr("back")}
    </button>
  );

  if (kind === "used" || kind === "recon") {
    return (
      <>
        {backBtn}
        {renderUsed(kind === "recon" ? { condition: "recon", isRecon: true } : { condition: "used", isRecon: false })}
      </>
    );
  }

  if (kind === "new" && brand) {
    return (
      <>
        {backBtn}
        <NewCarForm dark={dark} profile={{ ...profile, new_car_brand: brand }} onCreate={onCreate}
          onOpenNewCars={onOpenNewCars} onUseUsedForm={back} />
      </>
    );
  }

  if (kind === "new") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, color: th.fg }}>
        {backBtn}
        <p style={title}>{tr("which")}</p>
        <p style={{ ...sub, marginTop: -6 }}>{tr("whichHint")}</p>
        {NEW_CAR_BRANDS.map((b) => (
          <button key={b} type="button" disabled={saving} onClick={() => pickBrand(b)} style={tile(b === saved || b === switchTo)}>
            <p style={title}>{b}</p>
            {b === saved && <p style={sub}>{tr("yours")}</p>}
          </button>
        ))}
        {switchTo && (
          <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${th.line}`, background: th.tile }}>
            <p style={{ ...sub, marginTop: 0, color: th.fg }}>{tr("switchBody", { saved, to: switchTo })}</p>
            <button type="button" disabled={saving} onClick={() => pickBrand(switchTo)}
              style={{ ...tile(true), marginTop: 10, textAlign: "center", fontWeight: 700, padding: "10px 12px" }}>
              {saving ? tr("saving") : tr("switchBtn", { to: switchTo })}
            </button>
          </div>
        )}
        {error && <p style={{ ...sub, color: "#ef4444" }}>{error}</p>}
      </div>
    );
  }

  const kinds = [
    { key: "used", label: tr("used"), hint: tr("usedHint") },
    { key: "recon", label: tr("recon"), hint: tr("reconHint") },
    ...(canNew ? [{ key: "new", label: tr("new"), hint: tr("newHint") }] : []),
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, color: th.fg }}>
      <p style={title}>{tr("what")}</p>
      {kinds.map((k) => (
        <button key={k.key} type="button" onClick={() => setKind(k.key)} style={tile(false)}>
          <p style={title}>{k.label}</p>
          <p style={sub}>{k.hint}</p>
        </button>
      ))}
    </div>
  );
}
