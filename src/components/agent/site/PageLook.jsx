import React, { useEffect } from 'react';

// The Premium page's look (owner, 2026-11-26: "I wanted it like this", a black advisor site he sent).
// We take its ORGANISATION and colouring, never its words or photos. Rules:
//  - BLACK page, white words. No rounded cards: square corners and 1px hairlines between things.
//  - Type by contrast: labels are tiny, light, wide-spaced capitals; the answer under them is big and
//    bold. Headings are a wide face, a bold part then a light part ("PICK YOUR <light>MODEL</light>").
//  - The main button is WHITE with black words. The seller's colour is only a small accent: the
//    slider, the picked tab's underline, the promo dots. Never a big coloured block or a glow.
//  - Things that float over the page (top buttons, section menu, bottom bar) are frosted glass.
// Premium only: rendered beside SiteStyle, every rule is under `.ap--pro`. The wide face (Archivo,
// expanded) loads only here, so Lite pages and the rest of Drevo never download it.
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,300;125,500;125,700;125,800&display=swap';

export default function PageLook() {
  useEffect(() => {
    if (document.querySelector('link[data-pl-font]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = FONT_HREF; l.dataset.plFont = '1';
    document.head.appendChild(l);
  }, []);
  return (
    <style>{`
      .ap.ap--pro { --k0: #0a0a0b; --k1: #111113; --k2: #18181b; --line: rgba(255,255,255,.12); --line2: rgba(255,255,255,.22);
        --t1: #ffffff; --t2: rgba(255,255,255,.72); --t3: rgba(255,255,255,.5);
        --wide: 'Archivo', var(--xd-font-body); --ap-bg: var(--k0); --ap-surf: var(--k1);
        background: var(--k0); color: var(--t1); }
      .ap--pro * { scrollbar-color: #333 transparent; }

      /* ---------- Type ---------- */
      .ap--pro .ap-sec h2, .ap--pro .ps-head h2 { font-family: var(--wide); font-stretch: 125%; font-weight: 800; text-transform: uppercase;
        font-size: clamp(22px, 2.6vw, 34px); line-height: 1.05; letter-spacing: -.005em; color: var(--t1); }
      .ap--pro .ps-head h2 span, .ap--pro .ap-sec h2 small { font-weight: 300; }
      .ap--pro .ap-sec h2 > span { font-family: var(--xd-font-body); font-weight: 400; font-size: .5em; color: var(--t3); vertical-align: middle; }
      .ap--pro .ps-head p { margin-top: 10px; font-size: 14px; line-height: 1.55; color: var(--t2); max-width: 54ch; }
      /* The label: tiny, light, wide-spaced capitals. The value under it carries the weight. */
      .ap--pro .ps-lbl, .ap--pro .ps-spec dt, .ap--pro .pc-lbl, .ap--pro .pc-k, .ap--pro .aph-stats span, .ap--pro .ps-q-l,
      .ap--pro .ps-big div span, .ap--pro .ps-steps, .ap--pro .ap-live-h, .ap--pro .ap-eyebrow {
        font-family: var(--wide); font-stretch: 125%; font-size: 10.5px !important; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; color: var(--t3) !important; }
      .ap--pro .ps-lbl b { font-family: var(--wide); color: var(--t1); letter-spacing: .12em; }
      .ap--pro .ap-sec { margin: 64px 0 18px; }
      .ap--pro .ps, .ap--pro .pc-wrap { margin-top: 64px; }
      @media (max-width: 899px) {
        .ap--pro .ap-sec, .ap--pro .ps, .ap--pro .pc-wrap { margin-top: 44px; }
        .ap--pro .ap-sec h2, .ap--pro .ps-head h2 { font-size: 22px; }
      }

      /* ---------- Surfaces: hairlines, square ---------- */
      .ap--pro .ap-card, .ap--pro .ps-card { background: transparent; border: 1px solid var(--line); border-radius: 0; box-shadow: none; }
      .ap--pro .ap-car { border-radius: 0; }
      .ap--pro .ap-car:hover { box-shadow: none; transform: none; border-color: var(--line2); }
      .ap--pro .ap-ph, .ap--pro .ap-live-ph { background: var(--k1); border-radius: 0; }
      .ap--pro .ap-cn, .ap--pro .ap-bhead, .ap--pro .ap-pr b, .ap--pro .ap-mo b, .ap--pro .ap-sold span:first-child, .ap--pro .ap-ml b,
      .ap--pro .ap-ml span, .ap--pro .ap-who b, .ap--pro .ap-foot a, .ap--pro .ap-promise p, .ap--pro .ap-spec, .ap--pro .ap-more { color: var(--t1); }
      .ap--pro .ap-cs, .ap--pro .ap-mo, .ap--pro .ap-st, .ap--pro .ap-sold span:last-child, .ap--pro .ap-who, .ap--pro .ap-foot,
      .ap--pro .ap-safe p, .ap--pro .ap-bhead span, .ap--pro .ap-about-bio { color: var(--t2); }
      .ap--pro .ap-pr { border-top-color: var(--line); }
      .ap--pro .ap-ov { border-radius: 0; background: rgba(0,0,0,.7); }
      .ap--pro .ap-sold div + div { border-top: 1px solid var(--line); }
      .ap--pro .ap-sold div:nth-child(even) { background: transparent; }
      .ap--pro .ap-sold div { padding: 12px 16px; }
      .ap--pro .ap-facts li { background: transparent; border: 1px solid var(--line); border-radius: 0; color: var(--t1); }
      .ap--pro .ap-facts svg { color: var(--t1); }
      .ap--pro .ap-about-bio + .ap-facts { border-top: 1px solid var(--line); padding-top: 16px; }
      .ap--pro .ap-spec svg { background: #fff; color: #0a0a0b; border-radius: 0; }
      .ap--pro .ap-promise span { color: var(--line2); }
      .ap--pro .ap-terms, .ap--pro .ap-terms * { color: var(--t2); }
      .ap--pro .ap-map iframe { filter: grayscale(1) invert(.92) contrast(.9); }
      .ap--pro .ap-reviews { margin-top: 44px; }
      .ap--pro .ap-reviews, .ap--pro .ap-reviews p, .ap--pro .ap-reviews span, .ap--pro .ap-reviews h2, .ap--pro .ap-reviews h3 { color: var(--t1) !important; }
      .ap--pro .ap-reviews [style*="background"] { background: transparent !important; }
      .ap--pro .ap-reviews button { background: transparent !important; color: var(--t1) !important; border: 1px solid var(--line2) !important; border-radius: 0 !important; }

      /* Switches, brand tabs, sort */
      .ap--pro .ap-seg { background: transparent; border: 1px solid var(--line); border-radius: 0; }
      .ap--pro .ap-seg button { color: var(--t2); }
      .ap--pro .ap-seg button[aria-pressed="true"], .ap--pro .ap-brands button[aria-pressed="true"] { background: #fff; color: #0a0a0b; border-color: #fff; }
      .ap--pro .ap-brands button { border-radius: 0; background: transparent !important; color: var(--t2); border-color: var(--line); }
      .ap--pro .ap-brands button[aria-pressed="true"] { background: #fff !important; }

      /* ---------- Buttons ---------- */
      .ap--pro .ap-btn, .ap--pro .ps-wa { border-radius: 0 !important; background: #fff !important; color: #0a0a0b !important; box-shadow: none !important;
        font-family: var(--wide); font-stretch: 125%; font-weight: 700 !important; font-size: 12.5px !important; letter-spacing: .1em; text-transform: uppercase; }
      .ap--pro .ap-btn:hover, .ap--pro .ps-wa:hover { background: #e9e9ea !important; }
      .ap--pro .ap-btn:active, .ap--pro .ps-wa:active { translate: 0 1px; }
      .ap--pro .ps-ghost { border-radius: 0; background: transparent; color: var(--t1); border-color: var(--line2);
        font-family: var(--wide); font-stretch: 125%; font-weight: 700; font-size: 12.5px; letter-spacing: .1em; text-transform: uppercase; }
      .ap--pro .ps-ask { color: var(--t1); }

      /* ---------- Hero ---------- */
      .ap--pro .aph { border-radius: 0; background: var(--k0); border: 1px solid var(--line); }
      .ap--pro .aph-glow { background: radial-gradient(circle, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 65%); }
      .ap--pro .aph--cover::before { background: linear-gradient(180deg, rgba(10,10,11,.6), rgba(10,10,11,.94) 58%); }
      .ap--pro .aph-me { border-radius: 0; box-shadow: 0 30px 60px rgba(0,0,0,.6), 0 0 0 1px var(--line2); }
      .ap--pro .aph-pic--cut .aph-me { box-shadow: none; }
      .ap--pro .aph-mono { background: var(--k2); color: var(--t1); }
      .ap--pro .aph-chips span { border-radius: 0; border-color: var(--line2); background: transparent; font-family: var(--wide); font-stretch: 125%;
        font-size: 10.5px; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: var(--t2); }
      .ap--pro .aph-role { font-family: var(--wide); font-stretch: 125%; font-size: 11px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; color: var(--t3); }
      .ap--pro .aph .aph-name { font-family: var(--wide); font-stretch: 125%; font-weight: 800; text-transform: uppercase; letter-spacing: -.01em;
        font-size: clamp(30px, 8.6vw, 68px); line-height: .98; }
      .ap--pro .aph .aph-name .ap-last { font-weight: 300; }
      .ap--pro .aph-ico { border-radius: 0; background: transparent; border-color: var(--line2); }
      .ap--pro .aph-stats b { font-family: var(--wide); font-stretch: 125%; font-weight: 800; font-size: 26px; letter-spacing: -.01em; }
      .ap--pro .aph-stats b.aph-small { font-family: var(--xd-font-body); font-weight: 600; font-size: 14px; }
      .ap--pro .aph-stats { border-top: 1px solid var(--line); padding-top: 14px; }
      /* Frosted glass on what floats over the photo */
      .ap--pro .ap-back, .ap--pro .ap-share { background: rgba(255,255,255,.12) !important; color: #fff !important; border: 1px solid rgba(255,255,255,.18) !important;
        -webkit-backdrop-filter: blur(14px) saturate(1.4); backdrop-filter: blur(14px) saturate(1.4); box-shadow: none !important; border-radius: 0 !important; }
      .ap--pro .ap-back:active, .ap--pro .ap-share:active { background: rgba(255,255,255,.2) !important; translate: 0 1px; }

      /* ---------- Section menu + bottom bar: frosted strips ---------- */
      .ap--pro .pn { background: rgba(10,10,11,.72); -webkit-backdrop-filter: blur(16px) saturate(1.4); backdrop-filter: blur(16px) saturate(1.4);
        border-bottom: 1px solid var(--line); gap: 0; padding: 0; margin: 0 0 4px; }
      .ap--pro .pn a { height: 46px; padding: 0 16px; border-radius: 0; background: transparent; box-shadow: none; color: var(--t2);
        font-family: var(--wide); font-stretch: 125%; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
      .ap--pro .pn a:hover { background: transparent; color: var(--t1); box-shadow: inset 0 -2px 0 var(--ap-a); }
      .ap--pro .ap-sticky { background: rgba(10,10,11,.78) !important; -webkit-backdrop-filter: blur(16px) saturate(1.4); backdrop-filter: blur(16px) saturate(1.4);
        border-top: 1px solid var(--line); box-shadow: none; }
      .ap--pro .ap-sticky .ap-mini { border-radius: 0; background: var(--k2); }
      .ap--pro .ap-sticky .ap-btn { padding: 0 18px; }

      /* ---------- Promos + ticker ---------- */
      .ap--pro .ps-tick { background: transparent; border-radius: 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
      .ap--pro .ps-tick-it { font-family: var(--wide); font-stretch: 125%; font-size: 11px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; }
      .ap--pro .ps-tick-it i { border-radius: 0; background: var(--ap-a); }
      .ap--pro .ps-promos { display: block; border-top: 1px solid var(--line); }
      .ap--pro .ps-promos .ps-promo-row, .ap--pro .ps-promo-row { background: transparent; border: none; border-bottom: 1px solid var(--line); border-radius: 0; padding: 16px 0; }
      .ap--pro .ps-pm, .ap--pro .ps-pp { color: var(--t1); }
      .ap--pro .ps-pt, .ap--pro .ps-fine, .ap--pro .ps-pp small { color: var(--t2); }
      .ap--pro .ps-pill { border-radius: 0; background: transparent; border: 1px solid var(--line); color: var(--t2); }
      .ap--pro .ps-pill b { color: var(--t1); }

      /* ---------- Delivery ---------- */
      .ap--pro .ps-del { padding: 20px; }
      .ap--pro .ps-towns button { border-radius: 0; background: transparent; border-color: var(--line2); color: var(--t2); }
      .ap--pro .ps-towns button[aria-pressed="true"] { background: #fff; border-color: #fff; color: #0a0a0b; }
      .ap--pro .ps-route b, .ap--pro .ps-big div b { color: var(--t1); }
      .ap--pro .ps-big div b { font-family: var(--wide); font-stretch: 125%; font-weight: 800; }
      .ap--pro .ps-route i { background: repeating-linear-gradient(90deg, var(--line2) 0 6px, transparent 6px 12px); }
      .ap--pro .ps-dot { border-color: #fff; background: var(--k0); border-radius: 0; }
      .ap--pro .ps-dot--end { background: var(--ap-a); border-color: var(--ap-a); }

      /* ---------- Pick your model (the page is black now, so the block is just a section) ---------- */
      .ap--pro .ps-dark { background: transparent; color: var(--t1); border-radius: 0; padding: 0; }
      .ap--pro .ps-dark .ps-head h2 { color: var(--t1); }
      .ap--pro .ps-mtabs { border-bottom-color: var(--line); }
      .ap--pro .ps-mtabs button { color: var(--t3); }
      .ap--pro .ps-mtabs button b { font-family: var(--wide); font-stretch: 125%; font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
      .ap--pro .ps-mtabs button[aria-pressed="true"] { color: var(--t1); border-bottom-color: var(--ap-a); }
      .ap--pro .ps-dark .ps-card, .ap--pro .ps-model { background: transparent; border: 1px solid var(--line); }
      .ap--pro .ps-media, .ap--pro .ps-dark .ps-media, .ap--pro .ps-dark .ps-shots, .ap--pro .ps-shots { background: var(--k0); border-radius: 0; }
      .ap--pro .ps-stage, .ap--pro .ps-dark .ps-stage { background: radial-gradient(ellipse 70% 55% at 50% 38%, #2b2b2f 0%, #141416 55%, #0a0a0b 100%); }
      .ap--pro .ps-stage-tag { border-radius: 0; background: transparent; border: 1px solid var(--line2); font-family: var(--wide); font-stretch: 125%;
        font-size: 10px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; }
      .ap--pro .ps-shots button { border-radius: 0; }
      .ap--pro .ps-mname, .ap--pro .ps-price, .ap--pro .ps-help-pick, .ap--pro .ps-help-price, .ap--pro .ps-q-t, .ap--pro .ps-help-h h3 { color: var(--t1); }
      .ap--pro .ps-mname, .ap--pro .ps-help-pick, .ap--pro .ps-help-h h3 { font-family: var(--wide); font-stretch: 125%; font-weight: 800; text-transform: uppercase; letter-spacing: -.005em; }
      .ap--pro .ps-price { font-family: var(--wide); font-stretch: 125%; font-weight: 800; letter-spacing: -.01em; }
      .ap--pro .ps-mvar, .ap--pro .ps-est, .ap--pro .ps-colname, .ap--pro .ps-help-h p, .ap--pro .ps-help-price small, .ap--pro .ps-help-facts { color: var(--t2); }
      .ap--pro .ps-spec { background: transparent; gap: 0; border-radius: 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
      .ap--pro .ps-spec div, .ap--pro .ps-dark .ps-spec div { background: transparent; border-radius: 0; padding: 12px 14px 12px 0; }
      .ap--pro .ps-spec div + div { border-left: 1px solid var(--line); padding-left: 14px; }
      .ap--pro .ps-spec dd { color: var(--t1); font-weight: 700; }
      .ap--pro .ps-var, .ap--pro .ps-dark .ps-var { background: transparent; border: none; border-bottom: 1px solid var(--line); border-radius: 0; color: var(--t2); }
      .ap--pro .ps-var span:last-child, .ap--pro .ps-dark .ps-var span:last-child { color: var(--t2); }
      .ap--pro .ps-var[aria-checked="true"], .ap--pro .ps-dark .ps-var[aria-checked="true"] { background: rgba(255,255,255,.06); border-color: var(--line); box-shadow: inset 2px 0 0 #fff; color: var(--t1); }
      .ap--pro .ps-var[aria-checked="true"] span:last-child { color: var(--t1); }
      .ap--pro .ps-col, .ap--pro .ps-dark .ps-col { box-shadow: 0 0 0 1px rgba(255,255,255,.25) inset; }
      .ap--pro .ps-col[aria-checked="true"], .ap--pro .ps-dark .ps-col[aria-checked="true"] { border-color: var(--k0); outline: 1px solid #fff; }
      .ap--pro .ps-note, .ap--pro .ps-dark .ps-note { background: transparent; border-left: 1px solid var(--line2); border-radius: 0; padding: 4px 0 4px 14px; }
      .ap--pro .ps-note p:last-child { color: var(--t2); }

      /* ---------- Not sure which model ---------- */
      .ap--pro .ps-help { background: transparent; border: 1px solid var(--line); }
      .ap--pro .ps-q { border-top: 1px solid var(--line) !important; }
      .ap--pro .ps-q-o button, .ap--pro .ps-steps button { border-radius: 0; background: transparent; color: var(--t2); border-color: var(--line2); }
      .ap--pro .ps-q-o button[aria-checked="true"] { background: #fff; border-color: #fff; color: #0a0a0b; }
      .ap--pro .ps-help-r, .ap--pro .ps-dark .ps-help-r { background: transparent; border: 1px solid var(--line) !important; border-radius: 0; padding: 16px; }

      /* ---------- Calculator ---------- */
      .ap--pro .pc { background: transparent; color: var(--t1); border-radius: 0; border: 1px solid var(--line); }
      .ap--pro .pc-tabs { background: transparent; border: 1px solid var(--line); border-radius: 0; }
      .ap--pro .pc-tabs button { color: var(--t2); border-radius: 0; }
      .ap--pro .pc-tabs button[aria-pressed="true"] { background: #fff; color: #0a0a0b; box-shadow: none; }
      .ap--pro .pc-car { background: transparent; color: var(--t1); border: 1px solid var(--line); border-radius: 0; }
      .ap--pro .pc-car[aria-pressed="true"] { background: rgba(255,255,255,.06); border-color: #fff; box-shadow: none; }
      .ap--pro .pc-ph { background: var(--k1); }
      .ap--pro .pc-n { border-radius: 0; }
      .ap--pro .pc-field { background: transparent; border-radius: 0; border-bottom: 1px solid var(--line); }
      .ap--pro .pc-fh b { color: var(--t1); }
      .ap--pro .pc-ticks { color: var(--t3); }
      .ap--pro .pc-range::-webkit-slider-runnable-track { background: linear-gradient(90deg, var(--ap-a, #dc2626) var(--pc-fill, 0%), rgba(255,255,255,.16) var(--pc-fill, 0%)); }
      .ap--pro .pc-range::-moz-range-track { background: rgba(255,255,255,.16); }
      .ap--pro .pc-seg { background: transparent; border: 1px solid var(--line); border-radius: 0; }
      .ap--pro .pc-seg button { color: var(--t2); border-radius: 0; }
      .ap--pro .pc-seg button[aria-checked="true"] { background: #fff; color: #0a0a0b; box-shadow: none; }
      .ap--pro .pc-out { background: #fff; color: #0a0a0b; border-radius: 0; }
      .ap--pro .pc-out .pc-k { color: rgba(10,10,11,.5) !important; }
      .ap--pro .pc-big { font-family: var(--wide); font-stretch: 125%; font-weight: 800; }
      .ap--pro .pc-sum, .ap--pro .pc-rows dt, .ap--pro .pc-big small { color: rgba(10,10,11,.55); }
      .ap--pro .pc-rows { border-top: 1px solid rgba(10,10,11,.1); padding-top: 10px; }
      .ap--pro .pc-link { background: #0a0a0b; color: #fff; border-radius: 0; font-family: var(--wide); font-stretch: 125%; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; }
      .ap--pro .pc-fine, .ap--pro .pc-fine[style] { color: var(--t3); }
      .ap--pro .pc-none { color: var(--t1); }
    `}</style>
  );
}
