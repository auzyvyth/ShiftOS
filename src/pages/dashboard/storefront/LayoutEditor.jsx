// Storefront > Layout (STOREFRONT-2 stage 2, docs/STOREFRONT_PLAN.md): the dealer picks which
// sections of their own site (<sub>.drevo.my) show and in what order. Rules (pins, always-on
// sections, the saved shape) live in src/utils/storefrontLayout.js, shared with the page and
// the database check. Light dashboard look (premiumLight): white cards on a shadow, grey rows.
//
// The preview is two things: a page map here (the order, and which sections will be empty on
// the site today), and "See it on my site", which opens the real site with the unsaved layout
// in the link (HomePage.jsx reads ?layout=, buyers keep the saved one).
import { useEffect, useMemo, useState } from "react";
import { ChevronUp, ChevronDown, ExternalLink, Lock } from "lucide-react";
import { supabase } from "../../../supabaseClient";
import { premiumLight as PL } from "../../../theme/tokens";
import { getStorefrontUrl } from "../../../hooks/useTenant";
import { storefrontWhy, storefrontHow } from "../../../utils/storefrontCopy";
import {
  sectionInfo, cleanLayout, defaultLayout, toSaved, isDefaultLayout,
  moveSection, toggleSection, draftParam, setVariant,
} from "../../../utils/storefrontLayout";
import { AVAILABLE_VERSIONS, VERSION_INFO } from "../../../components/storefront/sections/versions";

const COLS = "subdomain, site_name, dealership, about_text, storefront_why, storefront_how, storefront_testimonials, hero_video_enabled, hero_video_url";

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

export default function LayoutEditor({ dealerId, canEdit }) {
  const [row, setRow] = useState(null);
  const [saved, setSaved] = useState(null);       // the cleaned layout as stored
  const [layout, setLayout] = useState(null);     // what is on screen
  const [columnMissing, setColumnMissing] = useState(false);
  const [status, setStatus] = useState({ kind: "", text: "" });
  const [saving, setSaving] = useState(false);

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
    })();
    return () => { live = false; };
  }, [dealerId]);

  const empty = useMemo(() => emptyNow(row), [row]);
  const dirty = layout && saved && JSON.stringify(layout) !== JSON.stringify(saved);

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

  const save = async () => {
    if (!canEdit || columnMissing || saving) return;
    setSaving(true);
    const value = isDefaultLayout(layout) ? null : toSaved(layout);  // toSaved keeps the chosen versions
    const { data, error } = await supabase.from("profiles").update({ storefront_layout: value }).eq("id", dealerId).select("id");
    setSaving(false);
    if (error || !data?.length) {
      setStatus({ kind: "bad", text: "Not saved. Check your connection and try again." });
      return;
    }
    setSaved(layout);
    setStatus({ kind: "good", text: "Saved. Your site shows this layout now." });
  };

  const sub = row?.subdomain;
  const previewUrl = sub ? getStorefrontUrl(sub, `/?layout=${encodeURIComponent(draftParam(layout))}`) : null;
  const shown = layout.filter((r) => r.on);

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
      `}</style>

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
          {!isDefaultLayout(layout) && (
            <button type="button" onClick={() => change(defaultLayout())}
              style={{ background: "none", border: "none", color: PL.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "11px 4px" }}>
              Back to the usual order
            </button>
          )}
        </div>
      </div>

      <div style={card} aria-label="Page map">
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: PL.text }}>Page map</h3>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: PL.textMuted }}>Top to bottom, as a buyer scrolls.</p>
        <div style={{ borderRadius: 16, background: "#0C0C0E", padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {shown.map((r) => {
            const tall = r.id === "hero" || r.id === "cars";
            const isEmpty = empty[r.id];
            return (
              <div key={r.id} style={{
                height: tall ? 64 : 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 600, letterSpacing: "0.02em",
                background: isEmpty ? "transparent" : "rgba(255,255,255,0.08)",
                border: isEmpty ? "1px dashed rgba(255,255,255,0.18)" : "none",
                color: isEmpty ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.8)",
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
