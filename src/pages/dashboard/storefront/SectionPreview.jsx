// Storefront > Layout: a live preview of ONE section of the dealer's own site, drawn inside the
// editor, so a dealer sees a change (look, theme, heading font, banner background) without
// opening the site. It draws the REAL section component the site uses, with the dealer's real
// details and cars, so what shows here is what buyers get once it is saved.
//
// Why an iframe: the site's styles are written for a whole page (they set body and html, and the
// layouts answer to the screen's WIDTH). Drawn straight into the dashboard they would restyle
// the dashboard and could not show a phone. The frame is a real 375px (phone) or 1200px (desktop)
// screen, shrunk to fit with a CSS scale. It is read-only: links do nothing, and "Trade in" and
// "Check my loan" are off, so a dealer can't send a real enquiry to themselves from here.
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { publicClient } from "../../../supabaseClient";
import { withTimeout } from "../../../config/marketplaceConfig";
import { STOREFRONT_CAR_FIELDS } from "../../../utils/storefrontStock";
import { StorefrontStyles } from "../../../components/storefront/sections/ui";
import { SECTION_VERSIONS, SECTION_FALLBACK } from "../../../components/storefront/sections";
import { themeCss } from "../../../utils/storefrontTheme";
import { fontCss, fontSheet, sectionOn } from "../../../utils/storefrontLayout";

// A real screen for each device. The frame is always this tall (so "full screen" banners and
// vh-based sections draw as they do for a buyer); a shorter section crops to its own height.
export const PREVIEW_VIEW = { phone: { w: 375, h: 667 }, desktop: { w: 1200, h: 720 } };
const MIN_SHOWN = 120;

const isHotDeal = (c) => c.original_price > 0 && c.selling_price > 0 && c.selling_price <= c.original_price * 0.97;
const noop = () => {};
const COMPARE = { compareIds: [], addToCompare: noop, removeFromCompare: noop, isInCompare: () => false };

// The dealer's public details and live cars: the same reads the site makes (HomePage.jsx), through
// publicClient so a stale login can't hold them up. Loaded once, only when a preview is first opened.
const CACHE = new Map(); // subdomain -> data, so opening another section's preview is instant
function usePreviewData(subdomain) {
  const [data, setData] = useState(() => CACHE.get(subdomain) || null);
  useEffect(() => {
    if (!subdomain || data) return undefined;
    let live = true;
    (async () => {
      try {
        const { data: t } = await withTimeout(publicClient.rpc("get_dealer_profile_by_subdomain", { p_subdomain: subdomain }));
        const tenant = (Array.isArray(t) ? t[0] : t) || null;
        if (!tenant) { if (live) setData({ error: "Could not load your site details." }); return; }
        const [cars, sold] = await Promise.all([
          withTimeout(publicClient.from("public_car_listings").select(STOREFRONT_CAR_FIELDS, { count: "exact" })
            .eq("dealer_id", tenant.id).in("status", ["available", "reserved"]).order("created_at", { ascending: false }).limit(30)),
          withTimeout(publicClient.from("public_car_listings").select("id", { count: "exact", head: true })
            .eq("dealer_id", tenant.id).eq("status", "sold")),
        ]);
        const rows = (cars.data || []).map((c) => ({ ...c, dealer: tenant }));
        const soldCount = sold.count || 0;
        const loaded = {
          tenant,
          featured: rows.slice(0, 6),
          hotDeals: rows.filter(isHotDeal)
            .sort((a, b) => (b.original_price - b.selling_price) / b.original_price - (a.original_price - a.selling_price) / a.original_price)
            .slice(0, 6),
          stock: cars.count || rows.length,
          soldCount,
          soldDisplay: soldCount > 0 ? `${soldCount}+` : "0",
        };
        CACHE.set(subdomain, loaded);
        if (live) setData(loaded);
      } catch {
        if (live) setData({ error: "Could not load your site details. Try again in a moment." });
      }
    })();
    return () => { live = false; };
  }, [subdomain]); // eslint-disable-line react-hooks/exhaustive-deps
  return data;
}

export default function SectionPreview({ subdomain, id, variant, device, layout, theme, font, opts, brandAccent }) {
  const data = usePreviewData(subdomain);
  const frameRef = useRef(null);
  const holderRef = useRef(null);
  const rootRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [boxW, setBoxW] = useState(0);
  const [contentH, setContentH] = useState(PREVIEW_VIEW.phone.h);
  const view = PREVIEW_VIEW[device] || PREVIEW_VIEW.phone;

  useEffect(() => {
    const el = holderRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const scale = boxW ? Math.min(1, boxW / view.w) : 1;

  // The frame starts empty. Once loaded it gets the dashboard's own style sheets (the site's
  // Tailwind and font setup, the same files a buyer's page loads), and links and forms are
  // switched off at the top of the frame's document, before any click reaches a link.
  const onLoad = () => {
    const d = frameRef.current?.contentDocument;
    if (!d || d.body?.dataset.sfPrev) return;
    d.body.dataset.sfPrev = "1";
    document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => d.head.appendChild(n.cloneNode(true)));
    // Scroll-in fades and count-ups wait for the section to be on screen. Inside a frame that
    // is judged against the dashboard's own screen, so a preview below the fold would stay
    // blank: report everything as on screen at once.
    d.defaultView.IntersectionObserver = class {
      constructor(cb) { this.cb = cb; }
      observe(el) { setTimeout(() => this.cb([{ isIntersecting: true, intersectionRatio: 1, target: el }], this), 0); }
      unobserve() {}
      disconnect() {}
    };
    d.addEventListener("click", (e) => { if (e.target?.closest?.("a")) { e.preventDefault(); e.stopPropagation(); } }, true);
    d.addEventListener("submit", (e) => e.preventDefault(), true);
    setDoc(d);
  };

  // The section's own height (what a buyer scrolls past), measured inside the frame.
  useEffect(() => {
    const el = rootRef.current;
    const RO = doc?.defaultView?.ResizeObserver;
    if (!el || !RO) return undefined;
    const ro = new RO(() => setContentH(el.offsetHeight || MIN_SHOWN));
    ro.observe(el);
    setContentH(el.offsetHeight || MIN_SHOWN);
    return () => ro.disconnect();
  }, [doc, id, variant, device, data]);

  const ctx = useMemo(() => {
    if (!data?.tenant) return null;
    const t = data.tenant;
    return {
      look: opts, browseOn: sectionOn(layout, "browse"), tenant: t, siteName: t.site_name || t.dealership, carsBase: "/cars",
      ctaCtx: { type: "dealer", profile: t, ref: null },
      stock: data.stock, soldCount: data.soldCount, soldDisplay: data.soldDisplay, featured: data.featured, hotDeals: data.hotDeals,
      loading: false, compare: COMPARE, onTradeIn: noop, onLoanCheck: noop, preview: true,
    };
  }, [data, opts, layout]);

  const themeStr = themeCss(theme, brandAccent);
  const fontStr = fontCss(font);
  const fontHref = fontSheet(font);
  const Section = SECTION_VERSIONS[id]?.[variant] || SECTION_VERSIONS[id]?.a;
  const shownH = Math.min(Math.max(contentH, MIN_SHOWN), view.h);

  return (
    <div ref={holderRef} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      {data?.error ? (
        <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>{data.error}</p>
      ) : !ctx ? (
        <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>Loading your preview...</p>
      ) : (
        <div style={{ width: view.w * scale, height: shownH * scale, overflow: "hidden", borderRadius: 12,
          boxShadow: "0 0 0 1px rgba(17,24,39,0.10)", background: "#0C0C0E" }}>
          <iframe ref={frameRef} title={`Preview of this section on a ${device}`} srcDoc="<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>"
            onLoad={onLoad}
            style={{ width: view.w, height: view.h, border: 0, display: "block", transform: `scale(${scale})`, transformOrigin: "0 0" }} />
          {doc && Section && createPortal(
            <>
              <StorefrontStyles />
              {fontStr && <style>{fontStr}</style>}
              {fontHref && <link rel="stylesheet" href={fontHref} />}
              {themeStr && <style>{themeStr}</style>}
              <div ref={rootRef} style={{ display: "flow-root" }}>
                <Suspense fallback={SECTION_FALLBACK[id] || null}>
                  <Section {...ctx} />
                </Suspense>
              </div>
            </>,
            doc.body,
          )}
        </div>
      )}
    </div>
  );
}
