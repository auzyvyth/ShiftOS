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
import { ChevronUp, ChevronDown, ExternalLink, Lock, Shuffle, Pipette } from "lucide-react";
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
const HEADER_PREVIEW_ID = "__header";
const FOOTER_PREVIEW_ID = "__footer"; // same value as SectionPreview.jsx (kept here so the editor does not load that file up front)

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
  { k: "centred", label: "Centred", note: "Your logo in the middle, the page links on its left and WhatsApp on its right (on a phone it is the usual bar)." },
];
// The footer (look option footer): every version shows only what you filled in Settings.
const FOOTER_OPTIONS = [
  { k: "classic", label: "Classic", note: "Four columns: about, page links, contact and social links." },
  { k: "compact", label: "Compact", note: "One slim row with your name, the page links and social icons. Short." },
  { k: "contact", label: "Visit us", note: "A band first with your address, hours and WhatsApp and Call buttons, then a slim row of links." },
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
  const toggle = (id) => setPreviewId(previewId === id ? null : id);

  // The live preview of the open row (screen switch + the frame).
  const previewPanel = (pid, variant) => (
    <div style={{ minWidth: 0, marginTop: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: PL.textMuted }}>Preview</span>
        <div className="sf-seg" role="group" aria-label="Preview screen">
          {[["phone", "Phone"], ["desktop", "Desktop"]].map(([k, name]) => (
            <button key={k} type="button" aria-pressed={device === k} onClick={() => setDevice(k)}>{name}</button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: PL.textMuted, lineHeight: 1.4, minWidth: 0 }}>
          Your real details and cars. It changes as you pick; nothing is saved until you press Save.
        </span>
      </div>
      <Suspense fallback={<p style={{ margin: 0, fontSize: 13, color: PL.textMuted }}>Loading your preview...</p>}>
        <SectionPreview subdomain={sub} id={pid} variant={variant} device={device} layout={layout}
          theme={theme} font={font} opts={opts} brandAccent={brandAccent} />
      </Suspense>
    </div>
  );

  // One labelled switch of choices with the note for the one picked.
  const choice = (label, ariaLabel, items, current, onPick) => (
    <div className="sf-look">
      <span style={{ fontSize: 12, fontWeight: 600, color: PL.textMuted }}>{label}</span>
      <div className="sf-seg" role="group" aria-label={ariaLabel}>
        {items.map(({ k, name }) => (
          <button key={k} type="button" aria-pressed={current === k} onClick={() => onPick(k)}>{name}</button>
        ))}
      </div>
      <span style={{ fontSize: 12, color: PL.textMuted, lineHeight: 1.4, minWidth: 0, flexBasis: "100%" }}>
        {items.find((x) => x.k === current)?.note}
      </span>
    </div>
  );
  const setOpt = (k) => (v) => { setOpts((p) => ({ ...p, [k]: v })); setStatus({ kind: "", text: "" }); };

  // One row of the page. `lead` = the move arrows or a lock label; `right` = the switch or "Always on".
  const item = ({ id, name, line, hint, lead, right, off, body }) => {
    const open = previewId === id && !off;
    return (
      <div key={id} className={`sf-item${open ? " open" : ""}`} style={{ opacity: off ? 0.6 : 1 }}>
        <div className="sf-item-top">
          {lead}
          <div className="sf-item-name" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: PL.text }}>{name}</div>
            <div style={{ fontSize: 12, color: hint ? PL.accentText : PL.textMuted, lineHeight: 1.4 }}>{hint || line}</div>
          </div>
          {right}
          {!off && (
            <button type="button" className="sf-edit" aria-expanded={open} onClick={() => toggle(id)}>
              {open ? "Close" : "Edit"} {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
        </div>
        {open && (
          <div className="sf-item-body">
            {body}
            {sub ? previewPanel(id, layout.find((r) => r.id === id)?.variant || "a")
              : <p style={{ margin: "12px 0 0", fontSize: 12, color: PL.textMuted }}>The preview needs your site address (Settings).</p>}
          </div>
        )}
      </div>
    );
  };

  const pageRows = [
    item({
      id: HEADER_PREVIEW_ID, name: "Header",
      line: `${HEADER_OPTIONS.find((h) => h.k === opts.header)?.label}: the bar on top of every page`,
      lead: <span className="sf-lead"><Lock size={13} /> Top</span>,
      right: <span style={{ fontSize: 12, color: PL.textMuted, flexShrink: 0 }}>Always on</span>,
      body: choice("Look", "Header", HEADER_OPTIONS.map((h) => ({ k: h.k, name: h.label, note: h.note })), opts.header, setOpt("header")),
    }),
    ...layout.map((r, i) => {
      const info = sectionInfo(r.id);
      const pinned = !!info.pin;
      const canUp = !pinned && i > 0 && !sectionInfo(layout[i - 1].id).pin;
      const canDown = !pinned && i < layout.length - 1 && !sectionInfo(layout[i + 1].id).pin;
      const isEmpty = r.on && empty[r.id];
      const versionName = VERSION_INFO[r.id]?.[r.variant]?.name;
      const o = r.on && VERSION_OPTIONS[r.id]?.[r.variant];
      return item({
        id: r.id, name: info.label, off: !r.on,
        line: !r.on ? "Switched off" : `${versionName ? `${versionName} · ` : ""}Shows: ${info.shows.charAt(0).toLowerCase()}${info.shows.slice(1)}`,
        hint: isEmpty ? EMPTY_HINT[r.id] || "Empty on your site now" : "",
        lead: pinned ? (
          <span className="sf-lead"><Lock size={13} /> {info.pin === "first" ? "First" : "Last"}</span>
        ) : (
          <span style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
            <button type="button" aria-label={`Move ${info.label} up`} disabled={!canUp} onClick={() => change(moveSection(layout, r.id, -1))} style={iconBtn(!canUp)}><ChevronUp size={16} /></button>
            <button type="button" aria-label={`Move ${info.label} down`} disabled={!canDown} onClick={() => change(moveSection(layout, r.id, 1))} style={iconBtn(!canDown)}><ChevronDown size={16} /></button>
          </span>
        ),
        right: info.locked
          ? <span style={{ fontSize: 12, color: PL.textMuted, flexShrink: 0 }}>Always on</span>
          : <Switch on={r.on} label={`Show ${info.label}`} onClick={() => change(toggleSection(layout, r.id))} />,
        body: (
          <>
            {VERSION_INFO[r.id] && choice("Look", `${info.label} look`,
              Object.entries(VERSION_INFO[r.id]).map(([v, meta]) => ({ k: v, name: meta.name, note: meta.note })),
              r.variant, (v) => change(setVariant(layout, r.id, v, AVAILABLE_VERSIONS)))}
            {o && choice(o.label, `${info.label} ${o.label.toLowerCase()}`,
              Object.entries(o.values).map(([v, name]) => ({ k: v, name, note: o.notes?.[v] })), opts[o.option], setOpt(o.option))}
            {!VERSION_INFO[r.id] && <p style={{ margin: 0, fontSize: 12, color: PL.textMuted, lineHeight: 1.5 }}>This section has one look. Switch it on or off, or move it, from the row above.</p>}
          </>
        ),
      });
    }),
    item({
      id: FOOTER_PREVIEW_ID, name: "Footer",
      line: `${FOOTER_OPTIONS.find((f) => f.k === opts.footer)?.label}: the bottom of every page`,
      lead: <span className="sf-lead"><Lock size={13} /> Bottom</span>,
      right: <span style={{ fontSize: 12, color: PL.textMuted, flexShrink: 0 }}>Always on</span>,
      body: choice("Look", "Footer", FOOTER_OPTIONS.map((f) => ({ k: f.k, name: f.label, note: f.note })), opts.footer, setOpt("footer")),
    }),
  ];

  return (
    <div className="sf-layout">
      <style>{`
        .sf-layout { display: flex; flex-direction: column; gap: 16px; max-width: 900px; }
        .sf-step { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 999px; background: ${PL.text}; color: #fff; font-size: 12px; font-weight: 700; margin-right: 8px; vertical-align: 1px; }
        .sf-item { border-radius: ${PL.radius.row}px; background: ${PL.raised}; }
        .sf-item + .sf-item { margin-top: 8px; }
        .sf-item-top { display: flex; align-items: center; gap: 10px; padding: 10px 12px; flex-wrap: wrap; }
        .sf-item.open { background: #fff; box-shadow: ${PL.shadow}; }
        .sf-item-body { padding: 2px 14px 16px; }
        .sf-lead { width: 76px; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: ${PL.textMuted}; flex-shrink: 0; }
        .sf-edit { display: inline-flex; align-items: center; gap: 4px; height: 34px; padding: 0 12px; border-radius: 10px; border: none; cursor: pointer;
          font-size: 13px; font-weight: 600; font-family: inherit; background: #fff; color: ${PL.text}; box-shadow: ${PL.shadow}; flex-shrink: 0; }
        .sf-item.open .sf-edit { background: ${PL.raised}; box-shadow: none; }
        /* Phone: the name gets its own full-width line, the arrows, switch and Edit sit under it. */
        @media (max-width: 600px) {
          .sf-item-name { order: -1; flex: 1 1 100% !important; }
          .sf-lead { width: auto; }
          .sf-edit { margin-left: auto; }
          .sf-item-body { padding: 2px 12px 14px; }
        }
        .sf-look { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 6px 0 2px; }
        .sf-seg { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 3px; border-radius: 10px; background: #e7e9ee; }
        .sf-seg button { border: none; background: transparent; color: ${PL.textSec}; font-size: 13px; font-weight: 600;
          padding: 7px 12px; border-radius: 8px; cursor: pointer; font-family: inherit; }
        .sf-seg button[aria-pressed="true"] { background: #fff; color: ${PL.text}; box-shadow: 0 1px 2px rgba(17,24,39,0.12); }
        .sf-presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
        .sf-preset { text-align: left; border: 2px solid transparent; background: ${PL.raised}; border-radius: ${PL.radius.row}px;
          padding: 10px 12px; cursor: pointer; font-family: inherit; }
        .sf-preset[aria-pressed="true"] { border-color: ${PL.text}; background: #fff; }
        .sf-savebar { position: sticky; bottom: 12px; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px;
          padding: 12px 16px; border-radius: ${PL.radius.card}px; background: #fff; box-shadow: 0 8px 30px rgba(17,24,39,0.16); }
        .sf-group { font-size: 12px; font-weight: 600; color: ${PL.textMuted}; margin: 0 0 8px; }
      `}</style>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 700, color: PL.text }}>Design your site</h3>
          <p style={{ margin: 0, fontSize: 13, color: PL.textMuted, lineHeight: 1.5 }}>
            Two steps: pick the style, then go down the page and pick what each part looks like. Nothing changes for buyers until you press Save.
          </p>
        </div>
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="pl-btn-grey"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", fontSize: 14, textDecoration: "none" }}>
            See the whole page <ExternalLink size={14} />
          </a>
        )}
      </div>

      <div style={card}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: PL.text }}><span className="sf-step">1</span>Style</h3>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <p className="sf-group" style={{ margin: 0 }}>Start from a ready-made look</p>
          <button type="button" className="pl-btn-grey" onClick={() => changeLook(shuffleLook(layout, font, AVAILABLE_VERSIONS))}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
            <Shuffle size={14} /> Shuffle
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
        <p style={{ margin: "8px 0 0", fontSize: 12, color: PL.textMuted }}>
          {preset ? "A ready-made look keeps your order, your on and off switches and your accent colour." : "Your own mix. A ready-made look changes the versions, heading font and options, not your order."}
        </p>

        <div style={{ borderTop: "1px solid rgba(17,24,39,0.06)", margin: "18px 0 0", paddingTop: 4 }}>
          <Colours theme={theme} look={look} brandAccent={brandAccent}
            onMode={(m) => { setTheme((t) => cleanTheme({ ...(t || {}), mode: m })); setStatus({ kind: "", text: "" }); }}
            onAccent={(hex) => { setTheme((t) => cleanTheme({ ...(t || {}), accent: hex })); setStatus({ kind: "", text: "" }); }}
            onResetAccent={() => { setTheme((t) => cleanTheme({ ...(t || {}), accent: null })); setStatus({ kind: "", text: "" }); }} />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", marginTop: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: PL.textMuted }}>Headings</span>
          <div className="sf-seg" role="group" aria-label="Heading font">
            {Object.entries(FONTS).map(([id, f]) => (
              <button key={id} type="button" aria-pressed={font === id} onClick={() => { setFont(id); setStatus({ kind: "", text: "" }); }}>{f.name}</button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: PL.textMuted, lineHeight: 1.4, minWidth: 0 }}>{FONTS[font].note}</span>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: PL.text }}><span className="sf-step">2</span>Your page, top to bottom</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: PL.textMuted, lineHeight: 1.5 }}>
          This list is your page in order. Tap Edit on a part to pick its look and see it right there. Use the arrows to move a part and the switch to hide it.
        </p>
        {pageRows}
        {!isDefaultLayout(layout, { font, theme, ...opts }) && (
          <button type="button" onClick={() => { changeLook({ layout: defaultLayout(), font: DEFAULT_FONT }); setTheme(null); setOpts(defaultOptions()); }}
            style={{ background: "none", border: "none", color: PL.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "14px 0 0" }}>
            Back to the usual layout
          </button>
        )}
        {columnMissing && (
          <p className="pl-note" style={{ margin: "14px 0 0", padding: "10px 12px", fontSize: 13, lineHeight: 1.5 }}>
            Saving a layout switches on after tonight's update. You can try it now with See the whole page.
          </p>
        )}
        {!canEdit && (
          <p className="pl-note" style={{ margin: "14px 0 0", padding: "10px 12px", fontSize: 13 }}>Only the owner can change the site layout.</p>
        )}
      </div>

      {(dirty || status.text) && (
        <div className="sf-savebar" role="status">
          <span style={{ flex: 1, minWidth: 160, fontSize: 13, fontWeight: 600, color: status.kind === "bad" ? PL.accentText : status.kind === "good" ? PL.up : PL.text }}>
            {status.text || "You have changes that are not saved yet."}
          </span>
          {dirty && (
            <>
              <button type="button" onClick={() => { setLayout(saved); setFont(savedFont); setTheme(savedTheme); setOpts(savedOpts); setStatus({ kind: "", text: "" }); }}
                style={{ background: "none", border: "none", color: PL.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "10px 4px" }}>
                Undo changes
              </button>
              <button type="button" onClick={save} disabled={!canEdit || columnMissing || saving}
                style={{ background: PL.accent, color: PL.onAccent, border: "none", borderRadius: 10, padding: "11px 22px", fontSize: 14, fontWeight: 700,
                  cursor: canEdit && !columnMissing ? "pointer" : "default", opacity: canEdit && !columnMissing ? 1 : 0.45 }}>
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
