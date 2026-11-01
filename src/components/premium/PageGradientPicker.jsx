import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Pipette } from "lucide-react";
import { premiumDark as PD } from "../../theme/tokens";
import { PAGE_GRADIENTS, PAGE_COLOR_DEFAULT, findGradient, gradientTheme } from "../../utils/pageAccent";

// The Premium page's gradient (PAGE-PRO, owner 2026-11-01: "let the user set the
// colours, a tasteful gradient"). Curated pairs, or Custom: ONE colour, and the
// partner is worked out (pageAccent.js partnerColor), so no pick can clash.
// A preset saves on tap; a custom colour previews live and saves on "Use this".
export default function PageGradientPicker({ value, saving, onSave }) {
  const { t } = useTranslation();
  const tr = (k, fallback, o) => t(`salesmanPremium.settings.pageColor.${k}`, { defaultValue: fallback, ...o });
  const current = value || PAGE_COLOR_DEFAULT;
  const isCustom = !findGradient(current);
  const [custom, setCustom] = useState(isCustom ? current : null); // a colour being tried, not saved yet
  const shown = custom || current;
  const theme = gradientTheme(shown);
  const preset = findGradient(shown);
  const name = preset ? tr(`names.${preset.name.toLowerCase()}`, preset.name) : tr("custom", "Custom");
  const unsaved = custom && custom.toUpperCase() !== current.toUpperCase();

  const swatch = (on) => ({ position: "relative", width: 38, height: 38, borderRadius: "50%", border: "none", padding: 0, cursor: saving ? "wait" : "pointer", boxShadow: on ? `0 0 0 3px ${PD.card}, 0 0 0 5px ${PD.text}` : "none", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" });

  return (
    <div>
      {/* What the page will look like: the banner and the main button. */}
      <div aria-hidden="true" style={{ borderRadius: PD.radius.row, overflow: "hidden", background: theme.css, height: 92, position: "relative", marginTop: 4 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgb(0 0 0 / .18))" }} />
        <span style={{ position: "absolute", left: 14, bottom: 12, height: 34, padding: "0 16px", borderRadius: 18, display: "inline-flex", alignItems: "center", fontSize: 13, fontWeight: 600, color: "#fff",
          background: `linear-gradient(${theme.accent}, ${theme.dark})`, boxShadow: "inset 0 2px 0 rgb(255 255 255 / .40), inset 0 -3px 0 rgb(9 10 12 / .28), 0 2px 3px rgb(9 10 12 / .40), 0 8px 18px rgb(9 10 12 / .30)" }}>
          WhatsApp
        </span>
        <span style={{ position: "absolute", right: 12, top: 10, fontSize: 12, fontWeight: 600, color: "rgb(255 255 255 / .9)" }}>{name}</span>
      </div>

      <div role="radiogroup" aria-label={tr("title", "Page colour")} style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
        {PAGE_GRADIENTS.map((g) => {
          const on = !custom && current.toUpperCase() === g.from;
          const label = tr(`names.${g.name.toLowerCase()}`, g.name);
          return (
            <button key={g.from} type="button" role="radio" aria-checked={on} aria-label={label} title={label} disabled={saving}
              onClick={() => { setCustom(null); if (!on) onSave(g.from); }}
              style={{ ...swatch(on), background: gradientTheme(g.from).css }}>
              {on && <Check size={16} strokeWidth={3} />}
            </button>
          );
        })}
        {/* Custom: the native colour picker sits invisibly over the swatch. */}
        <label title={tr("custom", "Custom")} style={{ ...swatch(!!custom || isCustom), background: isCustom || custom ? theme.css : PD.raised, color: isCustom || custom ? "#fff" : PD.textSec }}>
          <Pipette size={16} />
          <input type="color" aria-label={tr("custom", "Custom")} value={shown.toLowerCase()} disabled={saving}
            onChange={(e) => setCustom(e.target.value.toUpperCase())}
            style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer", border: "none", padding: 0 }} />
        </label>
      </div>

      {unsaved && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => onSave(custom)} disabled={saving}
            style={{ height: 38, padding: "0 16px", borderRadius: PD.radius.pill, border: "none", background: PD.accent, color: PD.onAccent, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer" }}>
            {saving ? tr("saving", "Saving...") : tr("useCustom", "Use this colour")}
          </button>
          <button type="button" onClick={() => setCustom(isCustom ? current : null)} disabled={saving}
            style={{ height: 38, padding: "0 14px", borderRadius: PD.radius.pill, border: "none", background: PD.raised, color: PD.textSec, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {tr("cancel", "Cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
