import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Pipette } from "lucide-react";
import { premiumDark as PD } from "../../theme/tokens";
import { PAGE_COLOR_PRESETS, PAGE_COLOR_DEFAULT, cleanHex, pagePalette } from "../../utils/pageAccent";

// The Premium page's ONE colour (PAGE-COLOR, owner 2026-11-28: "freely choose their hex, the page will
// follow, darker and lighter shades automatic, dark = white text, vice versa"). Any hex: typed, picked on
// the colour dial, or a quick swatch. Every shade and the text colour come from pagePalette, the same
// function the page uses, so this preview is what buyers see. A swatch saves on tap; a typed or dialled
// colour previews first and saves on "Use this colour".
export default function PageColorPicker({ value, saving, onSave }) {
  const { t } = useTranslation();
  const tr = (k, fallback, o) => t(`salesmanPremium.settings.pageColor.${k}`, { defaultValue: fallback, ...o });
  const current = cleanHex(value) || PAGE_COLOR_DEFAULT;
  const [trying, setTrying] = useState(null); // a colour being tried, not saved yet
  const [typed, setTyped] = useState(current);
  useEffect(() => { if (!trying) setTyped(current); }, [current, trying]);

  const shown = trying || current;
  const p = pagePalette(shown);
  const unsaved = !!trying && trying !== current;
  const badHex = typed.trim() !== "" && !cleanHex(typed);

  const tryColor = (hex) => { const c = cleanHex(hex); if (!c) return; setTrying(c); setTyped(c); };
  const swatch = (on) => ({ position: "relative", width: 36, height: 36, borderRadius: "50%", border: "none", padding: 0, flexShrink: 0,
    cursor: saving ? "wait" : "pointer", boxShadow: on ? `0 0 0 3px ${PD.card}, 0 0 0 5px ${PD.text}` : "inset 0 0 0 1px rgba(255,255,255,.16)", // the ring keeps a near-black pick visible on the dark card
    display: "flex", alignItems: "center", justifyContent: "center" });

  return (
    <div>
      {/* A slice of the real page in this colour: main button, a picked chip, the calculator answer, a link. */}
      <div aria-hidden="true" style={{ marginTop: 4, borderRadius: PD.radius.row, background: "#e9ebef", padding: 14, display: "grid", gap: 10, color: "#0a0a0b" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span style={{ height: 40, padding: "0 16px", borderRadius: 12, display: "inline-flex", alignItems: "center", background: p.accent, color: p.on, fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>
            {tr("previewButton", "WhatsApp me")}
          </span>
          <span style={{ height: 32, padding: "0 12px", borderRadius: 9, display: "inline-flex", alignItems: "center", background: p.accent, color: p.on, fontSize: 12.5, fontWeight: 600 }}>
            {tr("previewPicked", "Picked")}
          </span>
          <span style={{ height: 32, padding: "0 12px", borderRadius: 9, display: "inline-flex", alignItems: "center", border: "1px solid rgba(10,10,11,.2)", fontSize: 12.5, fontWeight: 600, color: "rgba(10,10,11,.66)" }}>
            {tr("previewOther", "Not picked")}
          </span>
        </div>
        <div style={{ borderRadius: 14, background: p.accent, color: p.on, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>RM 1,234 <small style={{ fontSize: 12, fontWeight: 500, opacity: 0.86 }}>{tr("previewMonth", "/ month")}</small></span>
          <span style={{ height: 30, padding: "0 12px", borderRadius: 9, display: "inline-flex", alignItems: "center", background: p.on, color: p.inv, fontSize: 11.5, fontWeight: 700 }}>{tr("previewAsk", "Ask me")}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: p.text }}>{tr("previewLink", "More about me")}</span>
      </div>

      {/* Quick picks + the colour dial */}
      <div role="radiogroup" aria-label={tr("title", "Page colour")} style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
        {PAGE_COLOR_PRESETS.map((hex) => {
          const on = shown === hex;
          return (
            <button key={hex} type="button" role="radio" aria-checked={on} aria-label={hex} title={hex} disabled={saving}
              onClick={() => { setTrying(null); setTyped(hex); if (hex !== current) onSave(hex); }}
              style={{ ...swatch(on), background: hex, color: pagePalette(hex).on }}>
              {on && <Check size={16} strokeWidth={3} />}
            </button>
          );
        })}
        <label title={tr("dial", "Any colour")} style={{ ...swatch(false), background: PD.raised, color: PD.textSec }}>
          <Pipette size={16} />
          <input type="color" aria-label={tr("dial", "Any colour")} value={shown.toLowerCase()} disabled={saving}
            onChange={(e) => tryColor(e.target.value)}
            style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer", border: "none", padding: 0 }} />
        </label>
      </div>

      {/* Type the exact hex (a brand colour from a logo, say) */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 8, background: cleanHex(typed) || shown, flexShrink: 0 }} />
        <input value={typed} aria-label={tr("hex", "Colour code")} aria-invalid={badHex} inputMode="text" autoCapitalize="characters" spellCheck={false} maxLength={7}
          onChange={(e) => { setTyped(e.target.value); const c = cleanHex(e.target.value); if (c) setTrying(c); }}
          placeholder="#1E40AF"
          style={{ width: 120, height: 40, boxSizing: "border-box", padding: "0 12px", borderRadius: 10, border: `1px solid ${badHex ? PD.accentText : PD.line}`, background: PD.raised, color: PD.text, fontFamily: "ui-monospace, monospace", fontSize: 16 }} />
        <span style={{ fontSize: 12, color: badHex ? PD.accentText : PD.textMuted, minWidth: 0 }}>
          {badHex ? tr("hexBad", "Type a colour like #1E40AF") : p.lightText ? tr("textWhite", "Words on it: white") : tr("textDark", "Words on it: black")}
        </span>
      </div>

      {unsaved && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => onSave(trying)} disabled={saving}
            style={{ height: 40, padding: "0 16px", borderRadius: PD.radius.pill, border: "none", background: p.accent, color: p.on, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer" }}>
            {saving ? tr("saving", "Saving...") : tr("useCustom", "Use this colour")}
          </button>
          <button type="button" onClick={() => { setTrying(null); setTyped(current); }} disabled={saving}
            style={{ height: 40, padding: "0 14px", borderRadius: PD.radius.pill, border: "none", background: PD.raised, color: PD.textSec, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {tr("cancel", "Cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
