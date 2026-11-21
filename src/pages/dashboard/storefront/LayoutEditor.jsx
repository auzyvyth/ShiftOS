// Storefront > Layout (STOREFRONT-2 stage 2, docs/STOREFRONT_PLAN.md): the dealer picks which
// sections of their own site (<sub>.drevo.my) show and in what order. Rules (pins, always-on
// sections, the saved shape) live in src/utils/storefrontLayout.js, shared with the page and
// the database check. Light dashboard look (premiumLight): white cards on a shadow, grey rows.
//
// The preview is two things: a page map here (the order, and which sections will be empty on
// the site today), and "See it on my site", which opens the real site with the unsaved layout
// in the link (HomePage.jsx reads ?layout=, buyers keep the saved one).
// Stage 4: "Your look" on top: four named looks (presets), Shuffle, the heading font and the
// site's theme (Dark or Light) and accent colour (storefrontTheme.js).
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ChevronUp, ChevronDown, ExternalLink, Lock, Shuffle, Pipette, Eye } from "lucide-react";
import { supabase } from "../../../supabaseClient";
import { premiumLight as PL } from "../../../theme/tokens";
import { getStorefrontUrl } from "../../../hooks/useTenant";
import { storefrontWhy, storefrontHow } from "../../../utils/storefrontCopy";
import {
  sectionInfo, cleanLayout, defaultLayout, toSaved, isDefaultLayout,
  moveSection, toggleSection, draftParam, setVariant,
  cleanFont, DEFAULT_FONT, FONTS, PRESETS, applyPreset, presetOf, shuffleLook,
  cleanOptions, defaultOptions,
} from "../../../utils/storefrontLayout";
import { AVAILABLE_VERSIONS, VERSION_INFO, VERSION_OPTIONS } from "../../../components/storefront/sections/versions";
import { themeOf, cleanTheme, resolveTheme, modeOf } from "../../../utils/storefrontTheme";
import { chosenPageColor, PAGE_COLOR_DEFAULT } from "../../../utils/pageAccent";
import { accentTheme } from "../../../utils/liveAccent";

// The live section preview draws the real site sections: load it only when a dealer opens one.
const SectionPreview = lazy(() => import("./SectionPreview"));
const HEADER_PREVIEW_ID = "__header"; // same value as SectionPreview.jsx (kept here so the editor does not load that file up front)

const COLS = "subdomain, site_name, dealership, about_text, storefront_why, storefront_how, storefront_testimonials, hero_video_enabled, hero_video_url, brand_color";

// Sections that will draw nothing today because the dealer has not written them yet.
// Car-driven ones (hot deals, numbers) are not guessed here.
function emptyNow(row) {
  if (!row) return {};
  const testimonials = Array.isArray(row.storefront_testimonials)
    ? row.storefront_testimonials.filter((t) => t?.text?.trim())
    : [];
  return {
    video: !(row.hero_video_enabled && row.hero_video_url),
    about: !row.about_text?.trim(),
    why: !storefrontWhy(row.storefront_why, row.site_name),
    how: !storefrontHow(row.storefront_how),
    testimonials: testimonials.length === 0,
  };
}

// Why a switched-on section is empty on the site today, and where to fix it.
const EMPTY_HINT = {
  video: "Empty on your site now: switch your video on in Settings",
  about: "Empty on your site now: write your About text in Settings",
  why: "Empty on your site now: write your reasons in Settings",
  how: "Empty on your site now: write your steps in Settings",
  testimonials: "Empty on your site now: add one in Settings",
};

const card = { background: PL.card, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: 20, minWidth: 0 };
const iconBtn = (disabled) => ({
  width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 10, border: "none",
  background: PL.raised, color: disabled ? "#c4c8cf" : PL.text, cursor: disabled ? "default" : "pointer",
});

function Switch({ on, onClick, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      style={{ width: 44, height: 26, borderRadius: 999, border: "none", padding: 3, cursor: "pointer", flexShrink: 0,
        background: on ? PL.text : "#d1d5db", transition: "background .15s" }}>
      <span style={{ display: "block", width: 20, height: 20, borderRadius: 999, background: "#fff",
        transform: on ? "translateX(18px)" : "none", transition: "transform .15s" }} />
    </button>
  );
}

// The site's theme (owner, 2026-11-20): Dark or Light, nothing in between, plus one optional
// accent (buttons and lines). Each theme is a fixed palette in storefrontTheme.js; the accent is
// darkened there until white text on it reads, and the swatch shows the colour the site will use.
// The header (look option `header`): every page of the site shows it, not only the home page.
const HEADER_OPTIONS = [
  { k: "classic", label: "Classic", note: "Your logo, the menu and WhatsApp." },
  { k: "showroom", label: "Showroom", note: "Adds a thin bar on top with your address, hours, phone and social links (only what you filled in Settings; phone and hours on phones), and makes Browse Cars a coloured button." },
];
const MODE_OPTIONS = [
  { k: "dark", label: "Dark", swatch: ["#0C0C0E", "#111113"] },
  { k: "light", label: "Light", swatch: ["#F3F5F9", "#FFFFFF"] },
];
function Colours({ theme, look, brandAccent, onMode, onAccent, onResetAccent }) {
  const mode = modeOf(theme);
  const accent = look?.accent || brandAccent;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 14px" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: PL.textMuted }}>Theme</span>
        <div role="radiogroup" aria-label="Site theme" style={{ display: "inline-flex", gap: 6, padding: 4, borderRadius: PL.radius.row, background: PL.raised }}>
          {MODE_OPTIONS.map((o) => {
            const on = mode === o.k;
            return (
              <button key={o.k} type="button" role="radio" aria-checked={on} onClick={() => onMode(o.k)}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 6px", borderRadius: 10, border: "none",
                  cursor: "pointer", background: on ? "#fff" : "transparent", boxShadow: on ? PL.shadow : "none",
                  fontSize: 13, fontWeight: 600, color: on ? PL.text : PL.textSec }}>
                <span aria-hidden style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                  background: `linear-gradient(135deg, ${o.swatch[0]} 50%, ${o.swatch[1]} 50%)`,
                  boxShadow: "inset 0 0 0 1px rgba(17,24,39,0.14)" }} />
                {o.label}
              </button>
            );
          })}
        </div>
        <label style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 12px 6px 6px",
          borderRadius: PL.radius.row, background: PL.raised, cursor: "pointer", minWidth: 0 }}>
          <span aria-hidden style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: accent,
            boxShadow: "inset 0 0 0 1px rgba(17,24,39,0.12)", display: "grid", placeItems: "center", color: "#fff" }}>
            {!theme?.accent && <Pipette size={13} />}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: PL.text }}>Accent</span>
            <span style={{ display: "block", fontSize: 11, color: PL.textMuted }}>{theme?.accent ? accent : "Your brand colour"}</span>
          </span>
          <input type="color" aria-label="Accent colour" value={(theme?.accent || accent).toLowerCase()} onChange={(e) => onAccent(e.target.value)}
            style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer", border: "none", padding: 0 }} />
        </label>
        {theme?.accent && (
          <button type="button" onClick={onResetAccent}
            style={{ background: "none", border: "none", color: PL.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 4px" }}>
            Use my brand colour
          </button>
        )}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: PL.textMuted, lineHeight: 1.5 }}>
        {mode === "light"
          ? "Light: a soft grey page with white cards. Your top banner stays a dark photo band."
          : "Dark: the usual dark site."}
        {" "}The accent colours your buttons and lines.
        {look?.adjusted.accent && " It was darkened a little so white text on your buttons reads. The swatch shows the colour your site will use."}
      </p>
    </div>
  );
}

export default function LayoutEditor({ dealerId, canEdit }) {
  const [row, setRow] = useState(null);
  const [saved, setSaved] = useState(null);       // the cleaned layout as stored
  const [layout, setLayout] = useState(null);     // what is on screen
  const [savedFont, setSavedFont] = useState(DEFAULT_FONT);
  const [font, setFont] = useState(DEFAULT_FONT);
  const [savedTheme, setSavedTheme] = useState(null);
  const [theme, setTheme] = useState(null);       // { mode?, accent? } or null
  const [savedOpts, setSavedOpts] = useState(defaultOptions);
  const [opts, setOpts] = useState(defaultOptions); // look options (storefrontLayout.js OPTIONS)
  const [columnMissing, setColumnMissing] = useState(false);
  const [status, setStatus] = useState({ kind: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState(null);   // the one section whose live preview is open
  const [device, setDevice] = useState("phone");

  useEffect(() => {
    if (!dealerId) return;
    let live = true;
    (async () => {
      let { data, error } = await supabase.from("profiles").select(`${COLS}, storefront_layout`).eq("id", dealerId).maybeSingle();
      // Before tonight's migration the column does not exist: show the default, saving waits.
      if (error && /storefront_layout/.test(error.message || "")) {
        if (live) setColumnMissing(true);
        ({ data, error } = await supabase.from("profiles").select(COLS).eq("id", dealerId).maybeSingle());
      }
      if (!live) return;
      if (error) { setStatus({ kind: "bad", text: "Could not load your site settings. Try again in a moment." }); return; }
      const clean = cleanLayout(data?.storefront_layout, AVAILABLE_VERSIONS);
      setRow(data || {});
      setSaved(clean);
      setLayout(clean);
      setSavedFont(cleanFont(data?.storefront_layout));
      setFont(cleanFont(data?.storefront_layout));
      setSavedTheme(themeOf(data?.storefront_layout));
      setTheme(themeOf(data?.storefront_layout));
      setSavedOpts(cleanOptions(data?.storefront_layout));
      setOpts(cleanOptions(data?.storefront_layout));
    })();
    return () => { live = false; };
  }, [dealerId]);

  const empty = useMemo(() => emptyNow(row), [row]);
  const dirty = layout && saved && (font !== savedFont || JSON.stringify(theme) !== JSON.stringify(savedTheme) ||
    JSON.stringify(opts) !== JSON.stringify(savedOpts) ||
    JSON.stringify(layout) !== JSON.stringify(saved));
  // With no accent picked the site uses the brand colour (shared.js accentOf), so does this preview.
  const brandAccent = accentTheme(chosenPageColor(row) || PAGE_COLOR_DEFAULT).accent;
  const look = resolveTheme(theme, brandAccent);

  if (!layout) {
    return (
      <div style={card}>
        <p style={{ margin: 0, color: status.kind === "bad" ? PL.accentText : PL.textMuted, fontSize: 14 }}>
          {status.text || "Loading your site layout..."}
        </p>
      </div>
    );
  }

  const change = (next) => { setLayout(next); setStatus({ kind: "", text: "" }); };
  // A ready look may also set the look options and the theme mode (applyPreset); Shuffle only
  // versions + font. The accent is never touched.
  const changeLook = ({ layout: l, font: f, options, mode }) => {
    setLayout(l); setFont(f);
    if (options) setOpts(options);
    if (mode) setTheme((t) => cleanTheme({ ...(t || {}), mode }));
    setStatus({ kind: "", text: "" });
  };
  const preset = presetOf(layout, font, AVAILABLE_VERSIONS, { options: opts, mode: modeOf(theme) });

  const save = async () => {
    if (!canEdit || columnMissing || saving) return;
    setSaving(true);
    // Called without the version list on purpose: toSaved keeps the chosen versions.
    const value = isDefaultLayout(layout, { font, theme, ...opts }) ? null : toSaved(layout, { font, theme, ...opts });
    const { data, error } = await supabase.from("profiles").update({ storefront_layout: value }).eq("id", dealerId).select("id");
    setSaving(false);
    if (error || !data?.length) {
      setStatus({ kind: "bad", text: "Not saved. Check your connection and try again." });
      return;
    }
    setSaved(layout);
    setSavedFont(font);
    setSavedTheme(theme);
    setSavedOpts(opts);
    setStatus({ kind: "good", text: "Saved. Your site shows this layout now." });
  };

  const sub = row?.subdomain;
  const previewUrl = sub ? getStorefrontUrl(sub, `/?layout=${encodeURIComponent(draftParam(layout, { font, theme, ...opts }))}`) : null;
  const shown = layout.filter((r) => r.on);

  // The live preview block (screen switch + the frame) for a section, or the header ("__header").
  const previewPanel = (pid, variant) => (
    <div style={{ flexBasis: "100%", minWidth: 0, paddingTop: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: PL.textMuted }}>Live preview</span>
        <div className="sf-seg" role="group" aria-label="Preview screen">
          {[["phone", "Phone"], ["desktop", "Desktop"]].map(([k, name]) => (
            <button key={k} type="button" aria-pressed={device === k} onClick={() => setDevice(k)}>{name}</button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: PL.textMuted, lineHeight: 1.4, minWidth: 0 }}>
          Your real details and cars. Changes above show here at once; nothing is saved until you press Save.
        </span>
      </div>
      <Suspense fallback={<p style={{ margin: 0, fontSize: 13, color: PL.textMuted }}>Loading your preview...</p>}>
        <SectionPreview subdomain={sub} id={pid} variant={variant} device={device} layout={layout}
          theme={theme} font={font} opts={opts} brandAccent={brandAccent} />
      </Suspense>
    </div>
  );


  return (
    <div className="sf-layout">
      <style>{`
        .sf-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
        @media (min-width: 900px) { .sf-layout { grid-template-columns: minmax(0, 1fr) 300px; align-items: start; } }
        .sf-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 12px; border-radius: ${PL.radius.row}px; background: ${PL.raised}; }
        .sf-row + .sf-row { margin-top: 8px; }
        .sf-look { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 4px 0 2px; }
        .sf-seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: #e7e9ee; }
        .sf-seg button { border: none; background: transparent; color: ${PL.textSec}; font-size: 13px; font-weight: 600;
          padding: 7px 12px; border-radius: 8px; cursor: pointer; font-family: inherit; }
        .sf-seg button[aria-pressed="true"] { background: #fff; color: ${PL.text}; box-shadow: 0 1px 2px rgba(17,24,39,0.12); }
        .sf-presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
        .sf-preset { text-align: left; border: 2px solid transparent; background: ${PL.raised}; border-radius: ${PL.radius.row}px;
          padding: 10px 12px; cursor: pointer; font-family: inherit; }
        .sf-preset[aria-pressed="true"] { border-color: ${PL.text}; background: #fff; }
      `}</style>

      <div style={{ ...card, gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: PL.text }}>Your look</h3>
            <p style={{ margin: 0, fontSize: 13, color: PL.textMuted, lineHeight: 1.5 }}>
              Pick a ready look, or Shuffle for a new mix. Your order and the sections you switched off stay as they are.
            </p>
          </div>
          <button type="button" className="pl-btn-grey" onClick={() => changeLook(shuffleLook(layout, font, AVAILABLE_VERSIONS))}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", fontSize: 14, cursor: "pointer" }}>
            <Shuffle size={15} /> Shuffle
          </button>
        </div>
        <div className="sf-presets" role="group" aria-label="Ready looks">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="sf-preset" aria-pressed={preset === p.id}
              onClick={() => changeLook(applyPreset(layout, p.id, AVAILABLE_VERSIONS))}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: PL.text }}>{p.name}</span>
              <span style={{ display: "block", fontSize: 12, color: PL.textMuted, lineHeight: 1.4, marginTop: 2 }}>{p.note}</span>
            </button>
          ))}
        </div>
        {!preset && <p style={{ margin: "10px 0 0", fontSize: 12, color: PL.textMuted }}>Your own mix.</p>}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", marginTop: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: PL.textMuted }}>Headings</span>
          <div className="sf-seg" role="group" aria-label="Heading font">
            {Object.entries(FONTS).map(([id, f]) => (
              <button key={id} type="button" aria-pressed={font === id} onClick={() => { setFont(id); setStatus({ kind: "", text: "" }); }}>
                {f.name}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: PL.textMuted, lineHeight: 1.4, minWidth: 0 }}>{FONTS[font].note}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", marginTop: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: PL.textMuted }}>Header</span>
          <div className="sf-seg" role="group" aria-label="Header">
            {HEADER_OPTIONS.map((h) => (
              <button key={h.k} type="button" aria-pressed={opts.header === h.k}
                onClick={() => { setOpts((p) => ({ ...p, header: h.k })); setStatus({ kind: "", text: "" }); }}>
                {h.label}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: PL.textMuted, lineHeight: 1.4, minWidth: 0 }}>
            {HEADER_OPTIONS.find((h) => h.k === opts.header)?.note}
          </span>
          {sub && (
            <button type="button" aria-pressed={previewId === HEADER_PREVIEW_ID}
              aria-label={`${previewId === HEADER_PREVIEW_ID ? "Close" : "Open"} the live preview of the header`}
              onClick={() => setPreviewId(previewId === HEADER_PREVIEW_ID ? null : HEADER_PREVIEW_ID)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 10, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                background: previewId === HEADER_PREVIEW_ID ? PL.text : PL.raised, color: previewId === HEADER_PREVIEW_ID ? "#fff" : PL.text }}>
              <Eye size={15} /> Preview
            </button>
          )}
        </div>
        {previewId === HEADER_PREVIEW_ID && sub && <div style={{ marginTop: 12 }}>{previewPanel(HEADER_PREVIEW_ID, "a")}</div>}
        <Colours theme={theme} look={look} brandAccent={brandAccent}
          onMode={(m) => { setTheme((t) => cleanTheme({ ...(t || {}), mode: m })); setStatus({ kind: "", text: "" }); }}
          onAccent={(hex) => { setTheme((t) => cleanTheme({ ...(t || {}), accent: hex })); setStatus({ kind: "", text: "" }); }}
          onResetAccent={() => { setTheme((t) => cleanTheme({ ...(t || {}), accent: null })); setStatus({ kind: "", text: "" }); }} />
      </div>

      <div style={card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: PL.text }}>Your site's sections</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: PL.textMuted, lineHeight: 1.5 }}>
          Turn sections on or off and move them up or down. Your cars and Get in touch always show.
        </p>

        {layout.map((r, i) => {
          const info = sectionInfo(r.id);
          const pinned = !!info.pin;
          const canUp = !pinned && i > 0 && !sectionInfo(layout[i - 1].id).pin;
          const canDown = !pinned && i < layout.length - 1 && !sectionInfo(layout[i + 1].id).pin;
          const isEmpty = r.on && empty[r.id];
          return (
            <div key={r.id} className="sf-row" style={{ opacity: r.on ? 1 : 0.55 }}>
              {pinned ? (
                <span style={{ width: 76, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: PL.textMuted, flexShrink: 0 }}>
                  <Lock size={13} /> {info.pin === "first" ? "Stays first" : "Stays last"}
                </span>
              ) : (
                <span style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
                  <button type="button" aria-label={`Move ${info.label} up`} disabled={!canUp} onClick={() => change(moveSection(layout, r.id, -1))} style={iconBtn(!canUp)}>
                    <ChevronUp size={16} />
                  </button>
                  <button type="button" aria-label={`Move ${info.label} down`} disabled={!canDown} onClick={() => change(moveSection(layout, r.id, 1))} style={iconBtn(!canDown)}>
                    <ChevronDown size={16} />
                  </button>
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: PL.text }}>{info.label}</div>
                <div style={{ fontSize: 12, color: isEmpty ? PL.accentText : PL.textMuted, lineHeight: 1.4 }}>
                  {isEmpty ? EMPTY_HINT[r.id] || "Empty on your site now" : `Shows: ${info.shows.charAt(0).toLowerCase()}${info.shows.slice(1)}`}
                </div>
              </div>
              {r.on && sub && (
                <button type="button" aria-pressed={previewId === r.id} aria-label={`${previewId === r.id ? "Close" : "Open"} the live preview of ${info.label}`}
                  onClick={() => setPreviewId(previewId === r.id ? null : r.id)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 10, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 600, flexShrink: 0, fontFamily: "inherit",
                    background: previewId === r.id ? PL.text : "#fff", color: previewId === r.id ? "#fff" : PL.text, boxShadow: previewId === r.id ? "none" : PL.shadow }}>
                  <Eye size={15} /> Preview
                </button>
              )}
              {info.locked ? (
                <span style={{ fontSize: 12, color: PL.textMuted, flexShrink: 0 }}>Always on</span>
              ) : (
                <Switch on={r.on} label={`Show ${info.label}`} onClick={() => change(toggleSection(layout, r.id))} />
              )}
              {VERSION_INFO[r.id] && r.on && (
                <div className="sf-look">
                  <span style={{ fontSize: 12, fontWeight: 600, color: PL.textMuted }}>Look</span>
                  <div className="sf-seg" role="group" aria-label={`${info.label} look`}>
                    {Object.entries(VERSION_INFO[r.id]).map(([v, meta]) => (
                      <button key={v} type="button" aria-pressed={r.variant === v}
                        onClick={() => change(setVariant(layout, r.id, v, AVAILABLE_VERSIONS))}>
                        {meta.name}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: PL.textMuted, lineHeight: 1.4, minWidth: 0 }}>
                    {VERSION_INFO[r.id][r.variant]?.note}
                  </span>
                </div>
              )}
              {r.on && VERSION_OPTIONS[r.id]?.[r.variant] && (() => {
                const o = VERSION_OPTIONS[r.id][r.variant];
                return (
                  <div className="sf-look">
                    <span style={{ fontSize: 12, fontWeight: 600, color: PL.textMuted }}>{o.label}</span>
                    <div className="sf-seg" role="group" aria-label={`${info.label} ${o.label.toLowerCase()}`}>
                      {Object.entries(o.values).map(([v, name]) => (
                        <button key={v} type="button" aria-pressed={opts[o.option] === v}
                          onClick={() => { setOpts((p) => ({ ...p, [o.option]: v })); setStatus({ kind: "", text: "" }); }}>
                          {name}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: PL.textMuted, lineHeight: 1.4, minWidth: 0 }}>{o.notes?.[opts[o.option]]}</span>
                  </div>
                );
              })()}
              {r.on && previewId === r.id && sub && previewPanel(r.id, r.variant)}
            </div>
          );
        })}

        {status.text && (
          <p role="status" style={{ margin: "14px 0 0", fontSize: 13, color: status.kind === "bad" ? PL.accentText : status.kind === "good" ? PL.up : PL.textMuted }}>
            {status.text}
          </p>
        )}
        {columnMissing && (
          <p className="pl-note" style={{ margin: "14px 0 0", padding: "10px 12px", fontSize: 13, lineHeight: 1.5 }}>
            Saving a layout switches on after tonight's update. You can try it now with See it on my site.
          </p>
        )}
        {!canEdit && (
          <p className="pl-note" style={{ margin: "14px 0 0", padding: "10px 12px", fontSize: 13 }}>
            Only the owner can change the site layout.
          </p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={save} disabled={!dirty || !canEdit || columnMissing || saving}
            style={{ background: PL.accent, color: PL.onAccent, border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700,
              cursor: dirty && canEdit && !columnMissing ? "pointer" : "default", opacity: dirty && canEdit && !columnMissing ? 1 : 0.45 }}>
            {saving ? "Saving..." : "Save layout"}
          </button>
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="pl-btn-grey"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 16px", fontSize: 14, textDecoration: "none" }}>
              See it on my site <ExternalLink size={14} />
            </a>
          )}
          {!isDefaultLayout(layout, { font, theme, ...opts }) && (
            <button type="button" onClick={() => { changeLook({ layout: defaultLayout(), font: DEFAULT_FONT }); setTheme(null); setOpts(defaultOptions()); }}
              style={{ background: "none", border: "none", color: PL.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "11px 4px" }}>
              Back to the usual layout
            </button>
          )}
        </div>
      </div>

      <div style={card} aria-label="Page map">
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: PL.text }}>Page map</h3>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: PL.textMuted }}>
          Top to bottom, as a buyer scrolls. Headings: {FONTS[font].name}.
        </p>
        <div style={{ borderRadius: 16, background: look?.bg || "#0C0C0E", padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {shown.map((r) => {
            const tall = r.id === "hero" || r.id === "cars";
            const isEmpty = empty[r.id];
            return (
              <div key={r.id} style={{
                height: tall ? 64 : 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 600, letterSpacing: "0.02em",
                background: isEmpty ? "transparent" : look?.card || "rgba(255,255,255,0.08)",
                border: isEmpty ? `1px dashed ${look?.border || "rgba(255,255,255,0.18)"}` : look?.border ? `1px solid ${look.border}` : "none",
                color: isEmpty ? look?.muted || "rgba(255,255,255,0.35)" : look?.text || "rgba(255,255,255,0.8)",
              }}>
                {sectionInfo(r.id).label}{VERSION_INFO[r.id] ? `: ${VERSION_INFO[r.id][r.variant]?.name}` : ""}{isEmpty ? " (empty)" : ""}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
