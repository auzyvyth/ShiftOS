import React, { useEffect } from 'react';

// The Premium page's look (owner, 2026-11-26: "I wanted it like this", a black advisor site he sent).
// We take its ORGANISATION and colouring, never its words or photos. Rules:
//  - WHITE page, ink words, 1px hairlines (owner, 2026-11-26, after a day in black). The hero stays a dark photo
//    band. Whatever is picked (a car, a variant, a tab, a chip) fills solid INK (the seller's colour) with words that read on it, never an outline. Outlined boxes have Apple's squircle corners (owner,
//    2026-11-26): `corner-shape: squircle` where the browser draws it, plain rounding elsewhere (--r-*).
//  - Type by contrast: labels are tiny, thin, spaced capitals in Inter (owner, 2026-11-26: Archivo expanded read unprofessional). The BOLD type
//    is the marketplace's (owner, 2026-11-26): headings in Bebas Neue, numbers and buttons in Outfit bold.
//    A heading is a bold part then a light grey part ("PICK YOUR <light>MODEL</light>").
//  - Main buttons and everything PICKED wear the SELLER'S colour (PAGE-COLOR, owner 2026-11-28; it was fixed Drevo
//    red). --ink and friends come from pagePalette (src/utils/pageAccent.js): the words on it are white or near-black,
//    whichever reads, so never write #fff on --ink here: use --on-ink / --on-rgb, and --ink-inv on an --on-ink tile.
//  - Things that float over the page (top buttons, section menu, bottom bar) are frosted glass.
// Premium only: rendered beside SiteStyle, every rule is under `.ap--pro`. The label face (Inter)
// loads only here, so Lite pages and the rest of Drevo never download it.
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap';

export default function PageLook() {
  useEffect(() => {
    if (document.querySelector('link[data-pl-font]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = FONT_HREF; l.dataset.plFont = '1';
    document.head.appendChild(l);
  }, []);
  // The page is white edge to edge: body is the marketplace's near-black, which showed as a strip above the hero.
  useEffect(() => {
    // index.css paints body with !important, so this must be important too.
    const b = document.body, was = b.style.getPropertyValue('background-color'), prio = b.style.getPropertyPriority('background-color');
    b.style.setProperty('background-color', '#e9ebef', 'important');
    return () => { if (was) b.style.setProperty('background-color', was, prio); else b.style.removeProperty('background-color'); };
  }, []);
  return (
    <style>{`
      .ap.ap--pro { --k0: #e9ebef; --k1: #f6f7f9; --k2: #dcdfe5; --line: rgba(10,10,11,.1); --line2: rgba(10,10,11,.2);
        --t1: #0a0a0b; --t2: rgba(10,10,11,.66); --t3: rgba(10,10,11,.48); --ink: var(--ap-a, #dc2626); --ink-2: var(--ap-b2, #b91c1c); --ink-3: var(--ap-b3, #991b1b); --on-ink: var(--ap-on, #ffffff); --on-rgb: var(--ap-on-rgb, 255,255,255); --ink-inv: var(--ap-inv, #dc2626);
        --wide: 'Inter', var(--xd-font-body); --head: 'Bebas Neue', var(--xd-font-body); --bold: var(--xd-font-body);
        --r-card: 16px; --r-btn: 12px; --r-chip: 9px; --ap-bg: var(--k0); --ap-surf: var(--k1);
        background: var(--k0); color: var(--t1); }
      .ap--pro * { scrollbar-color: #c8c8cc transparent; }

      /* ---------- Type ---------- */
      .ap--pro .ap-sec h2, .ap--pro .ps-head h2 { font-family: var(--head); font-weight: 400; text-transform: uppercase;
        font-size: clamp(28px, 3.2vw, 42px); line-height: 1; letter-spacing: .02em; color: var(--t1); }
      .ap--pro .ps-head h2 span, .ap--pro .ap-sec h2 small { font-family: var(--head); font-weight: 400; font-size: 1em; letter-spacing: inherit; color: var(--t3); }
      .ap--pro .ap-sec h2 > span { font-family: var(--xd-font-body); font-weight: 400; font-size: .5em; color: var(--t3); vertical-align: middle; }
      .ap--pro .ps-head p { margin-top: 10px; font-size: 14px; line-height: 1.55; color: var(--t2); max-width: 54ch; }
      /* The label: tiny, light, wide-spaced capitals. The value under it carries the weight. */
      .ap--pro .ps-lbl, .ap--pro .ps-spec dt, .ap--pro .pc-lbl, .ap--pro .pc-k, .ap--pro .aph-stats span, .ap--pro .ps-q-l,
      .ap--pro .ps-big div span, .ap--pro .ps-steps, .ap--pro .ap-live-h, .ap--pro .ap-eyebrow {
        font-family: var(--wide); font-size: 10.5px !important; font-weight: 400; letter-spacing: .16em; text-transform: uppercase; color: var(--t3) !important; }
      .ap--pro .ps-lbl b { font-family: var(--bold); font-weight: 700; color: var(--t1); letter-spacing: .12em; }
      .ap--pro .ap-sec { margin: 64px 0 18px; }
      .ap--pro .ps, .ap--pro .pc-wrap { margin-top: 64px; }
      @media (max-width: 899px) {
        .ap--pro .ap-sec, .ap--pro .ps, .ap--pro .pc-wrap { margin-top: 44px; }
        .ap--pro .ap-sec h2, .ap--pro .ps-head h2 { font-size: 28px; }
      }

      /* ---------- Surfaces: hairlines, square ---------- */
      .ap--pro .ap-card, .ap--pro .ps-card { background: transparent; border: 1px solid var(--line); border-radius: var(--r-card); box-shadow: none; }
      .ap--pro .ap-car { border-radius: var(--r-card); }
      .ap--pro .ap-car:hover { box-shadow: none; transform: none; border-color: var(--line2); }
      .ap--pro .ap-ph, .ap--pro .ap-live-ph { background: var(--k1); border-radius: var(--r-card); }
      .ap--pro .ap-cn, .ap--pro .ap-bhead, .ap--pro .ap-pr b, .ap--pro .ap-mo b, .ap--pro .ap-sold span:first-child, .ap--pro .ap-ml b,
      .ap--pro .ap-ml span, .ap--pro .ap-who b, .ap--pro .ap-foot a, .ap--pro .ap-promise p, .ap--pro .ap-spec, .ap--pro .ap-more { color: var(--t1); }
      .ap--pro .ap-cs, .ap--pro .ap-mo, .ap--pro .ap-st, .ap--pro .ap-sold span:last-child, .ap--pro .ap-who, .ap--pro .ap-foot,
      .ap--pro .ap-safe p, .ap--pro .ap-bhead span, .ap--pro .ap-about-bio { color: var(--t2); }
      .ap--pro .ap-pr { border-top-color: var(--line); }
      .ap--pro .ap-ov { border-radius: var(--r-card); background: rgba(0,0,0,.7); }
      .ap--pro .ap-sold div + div { border-top: 1px solid var(--line); }
      .ap--pro .ap-sold div:nth-child(even) { background: transparent; }
      .ap--pro .ap-sold div { padding: 12px 16px; }
      .ap--pro .ap-facts li { background: transparent; border: 1px solid var(--line); border-radius: var(--r-chip); color: var(--t1); }
      .ap--pro .ap-facts svg { color: var(--t1); }
      .ap--pro .ap-about-bio + .ap-facts { border-top: 1px solid var(--line); padding-top: 16px; }
      .ap--pro .ap-spec svg { background: var(--ink); color: var(--on-ink); border-radius: var(--r-chip); }
      .ap--pro .ap-promise span { color: var(--line2); }
      .ap--pro .ap-terms, .ap--pro .ap-terms * { color: var(--t2); }
      .ap--pro .ap-map iframe { filter: grayscale(1); }
      .ap--pro .ap-reviews { margin-top: 44px; }
      .ap--pro .ap-reviews, .ap--pro .ap-reviews p, .ap--pro .ap-reviews span, .ap--pro .ap-reviews h2, .ap--pro .ap-reviews h3 { color: var(--t1) !important; }
      .ap--pro .ap-reviews [style*="background"] { background: transparent !important; }
      .ap--pro .ap-reviews button { background: transparent !important; color: var(--t1) !important; border: 1px solid var(--line2) !important; border-radius: var(--r-btn) !important; }

      /* Switches, brand tabs, sort */
      .ap--pro .ap-seg { background: transparent; border: 1px solid var(--line); border-radius: var(--r-chip); }
      .ap--pro .ap-seg button { color: var(--t2); }
      .ap--pro .ap-seg button[aria-pressed="true"], .ap--pro .ap-brands button[aria-pressed="true"] { background: var(--ink); color: var(--on-ink); border-color: var(--ink); }
      .ap--pro .ap-brands button { border-radius: var(--r-chip); background: transparent !important; color: var(--t2); border-color: var(--line); }
      .ap--pro .ap-brands button[aria-pressed="true"] { background: var(--ink) !important; }

      /* ---------- Buttons ---------- */
      .ap--pro .ap-btn, .ap--pro .ps-wa { border-radius: var(--r-btn) !important; background: var(--ink) !important; color: var(--on-ink) !important; box-shadow: none !important;
        font-family: var(--bold); font-weight: 700 !important; font-size: 12.5px !important; letter-spacing: .1em; text-transform: uppercase; }
      /* Long seller / town names: the label wraps inside the button instead of running past it. */
      .ap--pro .pc-out .ap-btn, .ap--pro .ps-wa { box-sizing: border-box; max-width: 100%; height: auto !important; min-height: 48px; padding: 12px 16px; white-space: normal !important; overflow: visible !important; text-align: center; line-height: 1.3 !important; letter-spacing: .06em; overflow-wrap: anywhere; }
      .ap--pro .pc-out .ap-btn span { white-space: normal; overflow: visible; text-overflow: clip; }
      .ap--pro .ps-del > * { min-width: 0; }
      .ap--pro .ps-del > div > .ps-wa { display: flex; width: 100%; }
      .ap--pro .ap-btn:hover, .ap--pro .ps-wa:hover { background: var(--ink-2) !important; }
      
      .ap--pro .ap-btn:active, .ap--pro .ps-wa:active { translate: 0 1px; background: var(--ink-3) !important; }
      .ap--pro .ps-ghost { border-radius: var(--r-btn); background: transparent; color: var(--t1); border-color: var(--line2);
        font-family: var(--bold); font-weight: 700; font-size: 12.5px; letter-spacing: .1em; text-transform: uppercase; }
      .ap--pro .ps-ask { color: var(--t1); }

      /* ---------- Hero ---------- */
      /* The hero stays a DARK photo band on the white page: white words over the cover photo need the dark fade. */
      .ap--pro .aph { --k0: #0a0a0b; --k1: #111113; --k2: #18181b; --line: rgba(255,255,255,.12); --line2: rgba(255,255,255,.22);
        --t1: #ffffff; --t2: rgba(255,255,255,.72); --t3: rgba(255,255,255,.5); color: var(--t1);
        border-radius: var(--r-card); background: var(--k0); border: none; }
      .ap--pro .aph-glow { background: radial-gradient(circle, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 65%); }
      .ap--pro .aph--cover::before { background: linear-gradient(180deg, rgba(10,10,11,.6), rgba(10,10,11,.94) 58%); }
      .ap--pro .aph-me { border-radius: var(--r-card); box-shadow: 0 30px 60px rgba(0,0,0,.6), 0 0 0 1px var(--line2); }
      .ap--pro .aph-pic--cut .aph-me { box-shadow: none; }
      .ap--pro .aph-mono { background: var(--k2); color: var(--t1); }
      .ap--pro .aph-chips span { border-radius: var(--r-chip); border-color: var(--line2); background: transparent; font-family: var(--wide);
        font-size: 10.5px; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: var(--t2); }
      .ap--pro .aph-role { font-family: var(--wide); font-size: 11px; font-weight: 400; letter-spacing: .16em; text-transform: uppercase; color: var(--t3); }
      .ap--pro .aph .aph-name { font-family: var(--head); font-weight: 400; text-transform: uppercase; letter-spacing: .015em;
        font-size: clamp(40px, 11vw, 86px); line-height: .92; }
      .ap--pro .aph .aph-name .ap-last { font-family: inherit; font-weight: inherit; font-size: inherit; letter-spacing: inherit; }
      .ap--pro .aph-ico { border-radius: var(--r-chip); background: transparent; border-color: var(--line2); }
      .ap--pro .aph-stats b { font-family: var(--bold); font-weight: 700; font-size: 26px; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
      .ap--pro .aph-stats b.aph-small { font-family: var(--xd-font-body); font-weight: 600; font-size: 14px; }
      .ap--pro .aph-stats { border-top: 1px solid var(--line); padding-top: 14px; }
      /* Frosted glass on what floats over the photo */
      .ap--pro .ap-back, .ap--pro .ap-share { background: rgba(255,255,255,.12) !important; color: #fff !important; border: 1px solid rgba(255,255,255,.18) !important;
        -webkit-backdrop-filter: blur(14px) saturate(1.4); backdrop-filter: blur(14px) saturate(1.4); box-shadow: none !important; border-radius: var(--r-btn) !important; }
      .ap--pro .ap-back:active, .ap--pro .ap-share:active { background: rgba(255,255,255,.2) !important; translate: 0 1px; }

      /* ---------- Section menu + bottom bar: frosted strips ---------- */
      .ap--pro .pn { background: rgba(255,255,255,.82); -webkit-backdrop-filter: blur(16px) saturate(1.4); backdrop-filter: blur(16px) saturate(1.4);
        border-bottom: 1px solid var(--line); gap: 0; padding: 0; margin: 0 0 4px; }
      .ap--pro .pn a { height: 46px; padding: 0 16px; border-radius: var(--r-btn); background: transparent; box-shadow: none; color: var(--t2);
        font-family: var(--bold); font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
      .ap--pro .pn a:hover { background: transparent; color: var(--t1); box-shadow: inset 0 -2px 0 var(--ap-t, var(--ap-a)); }
      .ap--pro .ap-sticky { background: rgba(255,255,255,.84) !important; -webkit-backdrop-filter: blur(16px) saturate(1.4); backdrop-filter: blur(16px) saturate(1.4);
        border-top: 1px solid var(--line); box-shadow: none; }
      .ap--pro .ap-sticky .ap-mini { border-radius: var(--r-card); background: var(--ink); color: var(--on-ink); }
      .ap--pro .ap-sticky .ap-btn { padding: 0 18px; }

      /* ---------- Promos + ticker ---------- */
      .ap--pro .ps-tick { color: var(--t1); background: transparent; border-radius: 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
      .ap--pro .ps-tick-it { color: var(--t1); font-family: var(--wide); font-size: 11px; font-weight: 400; letter-spacing: .14em; text-transform: uppercase; }
      .ap--pro .ps-tick-it i { border-radius: var(--r-chip); background: var(--ap-a); }
      .ap--pro .ps-promos { display: block; border-top: 1px solid var(--line); }
      .ap--pro .ps-promos .ps-promo-row, .ap--pro .ps-promo-row { background: transparent; border: none; border-bottom: 1px solid var(--line); border-radius: 0; padding: 16px 0; }
      .ap--pro .ps-pm, .ap--pro .ps-pp { color: var(--t1); }
      .ap--pro .ps-pt, .ap--pro .ps-fine, .ap--pro .ps-pp small { color: var(--t2); }
      .ap--pro .ps-pill { border-radius: var(--r-chip); background: transparent; border: 1px solid var(--line); color: var(--t2); }
      .ap--pro .ps-pill b { color: var(--t1); }

      /* ---------- Delivery ---------- */
      .ap--pro .ps-del { padding: 20px; }
      .ap--pro .ps-towns button { border-radius: var(--r-chip); background: transparent; border-color: var(--line2); color: var(--t2); }
      .ap--pro .ps-towns button[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--on-ink); }
      .ap--pro .ps-route b, .ap--pro .ps-big div b { color: var(--t1); }
      .ap--pro .ps-big div b { font-family: var(--bold); font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
      .ap--pro .ps-route i { background: repeating-linear-gradient(90deg, var(--line2) 0 6px, transparent 6px 12px); }
      .ap--pro .ps-dot { border-color: var(--ink); background: var(--k0); border-radius: var(--r-chip); }
      .ap--pro .ps-dot--end { background: var(--ap-a); border-color: var(--ap-a); }

      /* ---------- Pick your model (the page itself is the surface, so the block is just a section) ---------- */
      .ap--pro .ps-dark { background: transparent; color: var(--t1); border-radius: 0; padding: 0; }
      .ap--pro .ps-dark .ps-head h2 { color: var(--t1); }
      .ap--pro .ps-mtabs { border-bottom-color: var(--line); }
      .ap--pro .ps-mtabs button { color: var(--t3); }
      .ap--pro .ps-mtabs button b { font-family: var(--bold); font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
      .ap--pro .ps-mtabs button[aria-pressed="true"] { color: var(--t1); border-bottom-color: var(--ap-t, var(--ap-a)); }
      .ap--pro .ps-dark .ps-card, .ap--pro .ps-model { background: transparent; border: 1px solid var(--line); }
      .ap--pro .ps-media, .ap--pro .ps-dark .ps-media, .ap--pro .ps-dark .ps-shots, .ap--pro .ps-shots { background: var(--k0); border-radius: var(--r-card); }
      .ap--pro .ps-stage, .ap--pro .ps-dark .ps-stage { background: radial-gradient(ellipse 70% 55% at 50% 38%, #ffffff 0%, #f1f1f3 55%, #e6e6e9 100%); }
      .ap--pro .ps-stage-tag { border-radius: var(--r-chip); background: transparent; border: 1px solid var(--line2); font-family: var(--wide);
        font-size: 10px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; }
      .ap--pro .ps-shots button { border-radius: var(--r-chip); }
      .ap--pro .ps-mname, .ap--pro .ps-price, .ap--pro .ps-help-pick, .ap--pro .ps-help-price, .ap--pro .ps-q-t, .ap--pro .ps-help-h h3 { color: var(--t1); }
      .ap--pro .ps-mname, .ap--pro .ps-help-pick, .ap--pro .ps-help-h h3 { font-family: var(--head); font-weight: 400; text-transform: uppercase; letter-spacing: .02em; }
      .ap--pro .ps-price { font-family: var(--bold); font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
      .ap--pro .ps-mvar, .ap--pro .ps-est, .ap--pro .ps-colname, .ap--pro .ps-help-h p, .ap--pro .ps-help-price small, .ap--pro .ps-help-facts { color: var(--t2); }
      .ap--pro .ps-spec { background: transparent; gap: 0; border-radius: 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
      .ap--pro .ps-spec div, .ap--pro .ps-dark .ps-spec div { background: transparent; border-radius: 0; padding: 12px 14px 12px 0; }
      .ap--pro .ps-spec div + div { border-left: 1px solid var(--line); padding-left: 14px; }
      .ap--pro .ps-spec dd { color: var(--t1); font-weight: 700; }
      .ap--pro .ps-var, .ap--pro .ps-dark .ps-var { background: transparent; border: none; border-bottom: 1px solid var(--line); border-radius: 0; color: var(--t2); }
      .ap--pro .ps-var span:last-child, .ap--pro .ps-dark .ps-var span:last-child { color: var(--t2); }
      .ap--pro .ps-var[aria-checked="true"], .ap--pro .ps-dark .ps-var[aria-checked="true"] { background: var(--ink); border-color: var(--ink); box-shadow: none; color: var(--on-ink); }
      .ap--pro .ps-var[aria-checked="true"] span:last-child { color: var(--on-ink); }
      .ap--pro .ps-col, .ap--pro .ps-dark .ps-col { box-shadow: 0 0 0 1px rgba(10,10,11,.18) inset; }
      .ap--pro .ps-col[aria-checked="true"], .ap--pro .ps-dark .ps-col[aria-checked="true"] { border-color: var(--k0); outline: 1.5px solid var(--ink); }
      .ap--pro .ps-note, .ap--pro .ps-dark .ps-note { background: transparent; border-left: 1px solid var(--line2); border-radius: 0; padding: 4px 0 4px 14px; }
      .ap--pro .ps-note p:last-child { color: var(--t2); }

      /* ---------- Not sure which model ---------- */
      .ap--pro .ps-help { background: transparent; border: 1px solid var(--line); }
      .ap--pro .ps-q { border-top: 1px solid var(--line) !important; }
      .ap--pro .ps-q-o button, .ap--pro .ps-steps button { border-radius: var(--r-chip); background: transparent; color: var(--t2); border-color: var(--line2); }
      .ap--pro .ps-q-o button[aria-checked="true"] { background: var(--ink); border-color: var(--ink); color: var(--on-ink); }
      .ap--pro .ps-help-r, .ap--pro .ps-dark .ps-help-r { background: transparent; border: 1px solid var(--line) !important; border-radius: var(--r-card); padding: 16px; }

      /* ---------- Calculator ---------- */
      .ap--pro .pc { background: transparent; color: var(--t1); border-radius: var(--r-card); border: 1px solid var(--line); }
      .ap--pro .pc-tabs { background: transparent; border: 1px solid var(--line); border-radius: var(--r-chip); }
      .ap--pro .pc-tabs button { color: var(--t2); border-radius: var(--r-chip); }
      .ap--pro .pc-tabs button[aria-pressed="true"] { background: var(--ink); color: var(--on-ink); box-shadow: none; }
      .ap--pro .pc-car { background: transparent; color: var(--t1); border: 1px solid var(--line); border-radius: var(--r-card); }
      /* The picked car: the WHOLE card turns ink (owner, 2026-11-26: an outline "looks cheap") */
      .ap--pro .pc-car[aria-pressed="true"] { background: transparent; border-color: transparent; color: var(--on-ink); box-shadow: none; }
      /* No coloured ring round the photo (owner, 2026-11-26: "remove top outline"): only the name + price part fills */
      .ap--pro .pc-car[aria-pressed="true"] .pc-ct { background: var(--ink); }
      .ap--pro .pc-car[aria-pressed="true"] .pc-n { background: var(--on-ink); color: var(--ink-inv); }
      .ap--pro .pc-ph { background: var(--k1); }
      .ap--pro .pc-n { border-radius: var(--r-chip); }
      .ap--pro .pc-field { background: transparent; border-radius: 0; border-bottom: 1px solid var(--line); }
      .ap--pro .pc-fh b { color: var(--t1); }
      .ap--pro .pc-ticks { color: var(--t3); }
      .ap--pro .pc-range::-webkit-slider-runnable-track { background: linear-gradient(90deg, var(--ap-a, #dc2626) var(--pc-fill, 0%), rgba(10,10,11,.12) var(--pc-fill, 0%)); }
      .ap--pro .pc-range::-moz-range-track { background: rgba(10,10,11,.12); }
      .ap--pro .pc-seg { background: transparent; border: 1px solid var(--line); border-radius: var(--r-chip); }
      .ap--pro .pc-seg button { color: var(--t2); border-radius: var(--r-chip); }
      .ap--pro .pc-seg button[aria-checked="true"] { background: var(--ink); color: var(--on-ink); box-shadow: none; }
      /* The answer is the black band */
      .ap--pro .pc-out { background: var(--ink); color: var(--on-ink); border-radius: var(--r-card); }
      .ap--pro .pc-out .pc-k { color: rgba(var(--on-rgb), .92) !important; text-shadow: var(--ap-shadow, none); }
      .ap--pro .pc-big { font-family: var(--bold); font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
      .ap--pro .pc-sum, .ap--pro .pc-rows dt, .ap--pro .pc-big small { color: rgba(var(--on-rgb), .86); }
      .ap--pro .pc-rows { border-top: 1px solid rgba(var(--on-rgb), .3); padding-top: 10px; }
      /* A main button INSIDE the coloured answer band inverts (it was colour on colour, invisible). */
      .ap--pro .pc-out .ap-btn { background: var(--on-ink) !important; color: var(--ink-inv) !important; }
      .ap--pro .pc-out .ap-btn:hover { background: var(--on-ink) !important; opacity: .9; }
      .ap--pro .pc-link { background: var(--on-ink); color: var(--ink-inv); border-radius: var(--r-btn); font-family: var(--wide); font-size: 12px; letter-spacing: .1em; text-transform: uppercase; }
      .ap--pro .pc-fine, .ap--pro .pc-fine[style] { color: var(--t3); }
      .ap--pro .pc-none { color: var(--t1); }
      /* Apple's continuous corners where the browser can draw them (corner-shape), round corners elsewhere.
         A squircle reads smaller than a circle arc of the same radius, so the radius grows with it. */
      @supports (corner-shape: squircle) {
        .ap.ap--pro { --r-card: 26px; --r-btn: 20px; --r-chip: 15px; }
        .ap--pro .ap-card, .ap--pro .ps-card, .ap--pro .ap-car, .ap--pro .ap-ph, .ap--pro .ap-live-ph, .ap--pro .ap-ov, .ap--pro .ap-facts li,
        .ap--pro .ap-spec svg, .ap--pro .ap-reviews button, .ap--pro .ap-seg, .ap--pro .ap-brands button, .ap--pro .ap-btn, .ap--pro .ps-wa,
        .ap--pro .ps-ghost, .ap--pro .aph, .ap--pro .aph-me, .ap--pro .aph-chips span, .ap--pro .aph-ico, .ap--pro .ap-back, .ap--pro .ap-share,
        .ap--pro .pn a, .ap--pro .ap-sticky .ap-mini, .ap--pro .ps-tick-it i, .ap--pro .ps-pill, .ap--pro .ps-towns button, .ap--pro .ps-dot,
        .ap--pro .ps-media, .ap--pro .ps-shots, .ap--pro .ps-stage-tag, .ap--pro .ps-shots button, .ap--pro .ps-q-o button, .ap--pro .ps-steps button,
        .ap--pro .ps-help-r, .ap--pro .pc, .ap--pro .pc-tabs, .ap--pro .pc-tabs button, .ap--pro .pc-car, .ap--pro .pc-n, .ap--pro .pc-seg,
        .ap--pro .pc-seg button, .ap--pro .pc-out, .ap--pro .pc-link, .ap--pro .cfg-sq { corner-shape: squircle; }
      }
    `}</style>
  );
}
