import React from 'react';

// The Premium page's colour + hierarchy pass (owner, 2026-11-25: "it sucks ... good hierarchy,
// good colouring, 60% white, 30% dark, 10% red, remove the upper lines"). Rules, from DESIGN.md:
//  - WHITE ground (the seller-colour wash of PAGE-PRO is gone), light warm-grey tiles for cards,
//    no card shadows: depth by tone, like the rest of Drevo.
//  - DARK = ink #0f1115 only, on big objects: the hero, the promo strip, the "Pick your model"
//    block and the calculator. On dark, a selected thing is WHITE; on light it is INK.
//  - RED = the seller's accent (Drevo red unless they picked one), ONLY on the main buttons, the
//    slider fill and an "ends soon" word. Never on a selected chip, a tick or an ornament.
//  - No decorative lines: no accent bars, no dashes before a label, no rules above a block.
//  - One heading system for every section: Bebas H2 + one muted line under it.
//  - Corners: cards 16, buttons 12, chips + segments 8. No pills on anything with text.
// Premium only: rendered next to SiteStyle, and every rule is under `.ap--pro`.
export default function PageLook() {
  return (
    <style>{`
      /* The light ground is the seller's own two colours + fade direction (groundPaint in pageSite.js, kept
         light so text stays readable). The page root sets --pl-g1 / --pl-g2 / --pl-gangle / --pl-tile inline. */
      .ap.ap--pro { --pl-g1: #ffffff; --pl-g2: #f6f5f1; --pl-tile: #f1f0eb; --ap-bg: var(--pl-g1); --ap-surf: var(--pl-tile);
        --pl-ink: #0f1115; --pl-tile2: rgba(15,17,21,.06); --pl-mute: #6b7280; --pl-d1: #0f1115; --pl-d2: #181b21; --pl-d3: #22262e;
        background: linear-gradient(var(--pl-gangle, 180deg), var(--pl-g1) 0%, var(--pl-g2) 100%); }

      /* Headings: one system */
      .ap--pro .ap-sec { margin: 56px 0 16px; }
      .ap--pro .ps { margin-top: 56px; }
      .ap--pro .ps-head { margin-bottom: 18px; }
      .ap--pro .ps-head h2, .ap--pro .ap-sec h2 { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: clamp(32px, 3.4vw, 46px); line-height: .95; letter-spacing: .015em; color: var(--pl-ink); }
      .ap--pro .ps-head p { margin-top: 8px; font-size: 14px; line-height: 1.5; color: var(--pl-mute); max-width: 52ch; }
      .ap--pro .pc-wrap { margin-top: 56px; }
      @media (max-width: 899px) {
        .ap--pro .ap-sec, .ap--pro .ps, .ap--pro .pc-wrap { margin-top: 40px; }
        .ap--pro .ps-head h2, .ap--pro .ap-sec h2 { font-size: 32px; }
      }

      /* Cards: light tiles, no shadow, no border */
      .ap--pro .ap-card, .ap--pro .ps-card { background: var(--pl-tile); box-shadow: none; border: none; border-radius: 16px; }
      .ap--pro .ap-car:hover { box-shadow: 0 0 0 1px rgba(15,17,21,.08); transform: none; }
      .ap--pro .ap-sticky { background: var(--pl-g1); box-shadow: 0 -1px 0 rgba(15,17,21,.06); }

      /* Buttons: the main one is the accent key (radius 12, never a pill); the second is ink outline */
      .ap--pro .ap-btn { border-radius: 12px; }
      .ap--pro .ps-wa { border-radius: 12px; background: linear-gradient(var(--ap-a), var(--ap-b2, var(--ap-a))); box-shadow: inset 0 1px 0 rgb(255 255 255 / .3), inset 0 -2px 0 rgb(9 10 12 / .25), 0 6px 16px rgba(var(--ap-rgb, 220 38 38), .28); }
      .ap--pro .ps-ghost { border-radius: 12px; border-color: rgba(15,17,21,.22); }

      /* Jump chips: no pills, light tiles, no shadow */
      .ap--pro .pn { background: linear-gradient(var(--pl-g1) 72%, transparent); }
      .ap--pro .pn a { border-radius: 8px; background: var(--pl-tile); box-shadow: none; font-weight: 700; }
      .ap--pro .pn a:hover { box-shadow: 0 0 0 1px rgba(15,17,21,.1); }
      .ap--pro .ap-brands button, .ap--pro .ap-seg { border-radius: 8px; }

      /* Hero: no rule above the numbers */
      .ap--pro .aph-stats { border-top: none; padding-top: 4px; }
      .ap--pro .aph-chips span { border-radius: 8px; }

      /* Promo strip: ink, the dots are the only red */
      .ap--pro .ps-tick { background: var(--pl-d1); border-radius: 12px; }

      /* Promos: one tile per promo, not lines */
      .ap--pro .ps-promos { display: grid; gap: 8px; }
      .ap--pro .ps-promos .ps-promo-row { background: var(--pl-tile); border-radius: 14px; border: none; }
      .ap--pro .ps-promo-row + .ps-promo-row { border-top: none; }
      .ap--pro .ps-pill { border-radius: 6px; background: rgba(15,17,21,.05); }

      /* Delivery: chips are 8, selected = ink */
      .ap--pro .ps-towns button, .ap--pro .ps-q-o button, .ap--pro .ps-steps button { border-radius: 8px; }

      /* About / Why / Track / Find: tiles, ink ticks, no rules */
      .ap--pro .ap-sold div + div { border-top: none; }
      .ap--pro .ap-sold div { padding: 12px 16px; }
      .ap--pro .ap-sold div:nth-child(even) { background: rgba(15,17,21,.03); }
      .ap--pro .ap-about-bio + .ap-facts { border-top: none; padding-top: 8px; }
      .ap--pro .ap-spec svg { background: var(--pl-ink); }
      .ap--pro .ap-promise span { color: rgba(15,17,21,.18); }

      /* Reviews: the sign-in ask is a plain ink-outline button, not a pink tinted pill */
      .ap--pro .ap-reviews { margin-top: 40px; }
      .ap--pro .ap-reviews button { background: #fff !important; color: var(--pl-ink) !important; border: 1px solid rgba(15,17,21,.22) !important; border-radius: 12px !important; }

      /* ---------- DARK: "Pick your model" is one ink block ---------- */
      .ap--pro .ps-dark { background: var(--pl-d1); color: #fff; border-radius: 24px; padding: 28px 24px 24px; }
      .ap--pro .ps-dark .ps-head h2 { color: #fff; }
      .ap--pro .ps-dark .ps-head p, .ap--pro .ps-dark .ps-fine { color: rgba(255,255,255,.6); }
      .ap--pro .ps-dark .ps-mtabs { border-bottom-color: rgba(255,255,255,.1); }
      .ap--pro .ps-dark .ps-mtabs button { color: rgba(255,255,255,.45); }
      .ap--pro .ps-dark .ps-mtabs button[aria-pressed="true"] { color: #fff; border-bottom-color: #fff; }
      .ap--pro .ps-dark .ps-card { background: var(--pl-d2); }
      .ap--pro .ps-dark .ps-media, .ap--pro .ps-dark .ps-shots { background: #E9E8E4; }
      .ap--pro .ps-dark .ps-stage { background: linear-gradient(180deg, #f1f0ec, #e6e4df); }
      .ap--pro .ps-dark .ps-mname, .ap--pro .ps-dark .ps-price, .ap--pro .ps-dark .ps-help-pick, .ap--pro .ps-dark .ps-help-price,
      .ap--pro .ps-dark .ps-q-t, .ap--pro .ps-dark .ps-help-h h3 { color: #fff; }
      .ap--pro .ps-dark .ps-mvar, .ap--pro .ps-dark .ps-est, .ap--pro .ps-dark .ps-lbl, .ap--pro .ps-dark .ps-colname,
      .ap--pro .ps-dark .ps-help-h p, .ap--pro .ps-dark .ps-q-l, .ap--pro .ps-dark .ps-help-price small { color: rgba(255,255,255,.58); }
      .ap--pro .ps-dark .ps-lbl b, .ap--pro .ps-dark .ps-help-facts { color: rgba(255,255,255,.86); }
      .ap--pro .ps-dark .ps-spec { background: transparent; gap: 6px; }
      .ap--pro .ps-dark .ps-spec div { background: var(--pl-d3); border-radius: 10px; }
      .ap--pro .ps-dark .ps-spec dt { color: rgba(255,255,255,.5); }
      .ap--pro .ps-dark .ps-spec dd { color: #fff; }
      .ap--pro .ps-dark .ps-var { background: var(--pl-d3); border-color: transparent; color: #fff; }
      .ap--pro .ps-dark .ps-var span:last-child { color: rgba(255,255,255,.65); }
      .ap--pro .ps-dark .ps-var[aria-checked="true"] { background: #fff; border-color: #fff; box-shadow: none; color: var(--pl-ink); }
      .ap--pro .ps-dark .ps-var[aria-checked="true"] span:last-child { color: #374151; }
      .ap--pro .ps-dark .ps-col { box-shadow: 0 0 0 1px rgba(255,255,255,.25) inset; }
      .ap--pro .ps-dark .ps-col[aria-checked="true"] { border-color: var(--pl-d2); outline-color: #fff; }
      .ap--pro .ps-dark .ps-note { background: var(--pl-d3); }
      .ap--pro .ps-dark .ps-note p:last-child { color: rgba(255,255,255,.82); }
      .ap--pro .ps-dark .ps-ghost { color: #fff; border-color: rgba(255,255,255,.3); }
      .ap--pro .ps-dark .ps-ask { color: #fff; }
      .ap--pro .ps-dark .ps-q, .ap--pro .ps-dark .ps-steps, .ap--pro .ps-dark .ps-help-r { border: none; }
      .ap--pro .ps-dark .ps-steps { color: rgba(255,255,255,.5); }
      .ap--pro .ps-dark .ps-steps button { color: #fff; border-color: rgba(255,255,255,.25); }
      .ap--pro .ps-dark .ps-q-o button { color: rgba(255,255,255,.86); border-color: rgba(255,255,255,.18); }
      .ap--pro .ps-dark .ps-q-o button[aria-checked="true"] { background: #fff; border-color: #fff; color: var(--pl-ink); }
      .ap--pro .ps-dark .ps-help-r { background: var(--pl-d3); border-radius: 14px; padding: 16px; }
      .ap--pro .ps-help-r { border: none; }
      .ap--pro .ps-q { border-top: none; }
      .ap--pro .ps-steps { border-top: none; }
      @media (min-width: 1000px) {
        .ap--pro .ps-dark { padding: 36px 36px 32px; }
        .ap--pro .ps-dark .ps-help-r { padding: 20px; }
      }
      @media (max-width: 899px) { .ap--pro .ps-dark { padding: 22px 14px 16px; border-radius: 20px; } }

      /* ---------- DARK: the calculator card; the answer is the one WHITE card inside it ---------- */
      .ap--pro .pc { background: var(--pl-d1); color: #fff; border-radius: 24px; }
      .ap--pro .pc-tabs { background: var(--pl-d2); }
      .ap--pro .pc-tabs button { color: rgba(255,255,255,.6); }
      .ap--pro .pc-tabs button[aria-pressed="true"] { background: #fff; color: var(--pl-ink); box-shadow: none; }
      .ap--pro .pc-car { background: var(--pl-d2); color: #fff; border-color: transparent; }
      .ap--pro .pc-car[aria-pressed="true"] { background: var(--pl-d3); border-color: #fff; box-shadow: none; }
      .ap--pro .pc-ph { background: #E9E8E4; }
      .ap--pro .pc-field { background: var(--pl-d2); }
      .ap--pro .pc-lbl, .ap--pro .pc-ticks { color: rgba(255,255,255,.55); }
      .ap--pro .pc-fh b { color: #fff; }
      .ap--pro .pc-range::-webkit-slider-runnable-track { background: linear-gradient(90deg, var(--ap-a, #dc2626) var(--pc-fill, 0%), rgba(255,255,255,.16) var(--pc-fill, 0%)); }
      .ap--pro .pc-range::-moz-range-track { background: rgba(255,255,255,.16); }
      .ap--pro .pc-seg { background: var(--pl-d3); }
      .ap--pro .pc-seg button { color: rgba(255,255,255,.65); }
      .ap--pro .pc-seg button[aria-checked="true"] { background: #fff; color: var(--pl-ink); box-shadow: none; }
      .ap--pro .pc-out { background: #fff; color: var(--pl-ink); border-radius: 16px; }
      .ap--pro .pc-k, .ap--pro .pc-sum, .ap--pro .pc-rows dt { color: var(--pl-mute); }
      .ap--pro .pc-big small { color: var(--pl-mute); }
      .ap--pro .pc-rows { border-top: none; padding-top: 4px; }
      .ap--pro .pc-link { background: var(--pl-ink); color: #fff; border-radius: 12px; }
      .ap--pro .pc-fine { color: rgba(255,255,255,.55); }
      .ap--pro .pc-none { color: var(--pl-ink); }
      .ap--pro .pc-fine[style] { color: rgba(255,255,255,.55); }
    `}</style>
  );
}
