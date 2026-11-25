import React from 'react';

// ONE style block for the Premium page's own sections (promos, model picker,
// delivery), rendered once by SalesmanProfilePage. Classes are `ps-` prefixed.
// Colours come from the page's own variables (--ap-surf, the seller's accent via
// --ap-a), never a hardcoded brand colour, so the seller's page colour carries.
export default function SiteStyle() {
  return (
    <style>{`
      .ps { --ps-ink: #0f1115; --ps-mute: #6b7280; --ps-line: rgba(15,17,21,.08); --ps-a: var(--ap-a, #dc2626); margin-top: 24px; }
      /* Rows (owner, 2026-11-25: "everything is too wide"): half sections go two to a row on a wide
         screen, a lone half section is capped at half the width, never stretched. */
      .ps-row { display: grid; grid-template-columns: minmax(0, 1fr); }
      .ps-row > * { min-width: 0; }
      @media (min-width: 1000px) {
        .ps-row--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 28px; align-items: start; }
        .ps-row--half { max-width: calc(50% - 14px); }
      }
      .ps *, .ps *::before, .ps *::after { box-sizing: border-box; }
      .ps-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin: 0 0 14px; }
      .ps-head h2 { font-family: 'Bebas Neue', sans-serif; font-weight: 400; font-size: clamp(28px, 3vw, 40px); line-height: .95; letter-spacing: .015em; color: var(--ps-ink); }
      .ps-head p { font-size: 13px; color: var(--ps-mute); margin-top: 6px; max-width: 46ch; line-height: 1.5; }
      .ps-card { background: var(--ap-surf, #fff); border-radius: 18px; box-shadow: 0 1px 2px rgba(15,23,42,.08), 0 8px 24px rgba(15,23,42,.05); }
      .ps-fine { font-size: 12px; color: var(--ps-mute); line-height: 1.5; margin-top: 10px; }
      .ps-wa { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 12px; border: none; background: var(--ps-a); color: #fff !important; font: 700 14px/1 var(--xd-font-body); text-decoration: none; cursor: pointer; white-space: nowrap; }
      .ps-wa svg { width: 16px; height: 16px; }
      .ps-wa:active { translate: 0 1px; }
      .ps-ghost { display: inline-flex; align-items: center; justify-content: center; height: 44px; padding: 0 16px; border-radius: 12px; border: 1px solid rgba(15,17,21,.16); background: transparent; color: var(--ps-ink); font: 700 14px/1 var(--xd-font-body); text-decoration: none; cursor: pointer; }

      /* Ticker: an ink strip under the hero. Moves slowly; still and scrollable under reduced motion. */
      .ps-tick { overflow: hidden; background: #0f1115; color: #fff; border-radius: 14px; margin: 16px 0 0; }
      .ps-tick-track { display: flex; width: max-content; animation: ps-tick 38s linear infinite; }
      .ps-tick:hover .ps-tick-track { animation-play-state: paused; }
      .ps-tick-it { display: inline-flex; align-items: center; gap: 10px; padding: 12px 22px; font-size: 13.5px; font-weight: 600; white-space: nowrap; }
      .ps-tick-it i { width: 6px; height: 6px; border-radius: 50%; background: var(--ps-a); flex-shrink: 0; }
      @keyframes ps-tick { to { transform: translateX(-50%); } }
      @media (prefers-reduced-motion: reduce) { .ps-tick { overflow-x: auto; } .ps-tick-track { animation: none; } }

      /* Promo board */
      .ps-promo-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 14px; align-items: center; padding: 14px 16px; }
      .ps-promo-row + .ps-promo-row { border-top: 1px solid var(--ps-line); }
      .ps-pm { font-size: 16px; font-weight: 800; color: var(--ps-ink); overflow-wrap: anywhere; }
      .ps-pt { grid-column: 1; font-size: 14px; color: #374151; line-height: 1.45; overflow-wrap: anywhere; }
      .ps-pp { text-align: right; font-size: 17px; font-weight: 800; color: var(--ps-ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .ps-pp small { display: block; font-size: 11px; font-weight: 600; color: var(--ps-mute); }
      .ps-end { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
      .ps-pill { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; background: #f1f2f4; font-size: 12px; font-weight: 700; color: #374151; }
      .ps-pill b { color: var(--ps-a); }
      .ps-ask { font-size: 13px; font-weight: 700; color: var(--ps-ink); text-decoration: underline; text-underline-offset: 3px; background: none; border: none; padding: 6px 0; cursor: pointer; font-family: inherit; }

      /* Model picker */
      .ps-model { display: grid; grid-template-columns: minmax(0, 1fr); }
      .ps-media { overflow: hidden; border-radius: 18px 18px 0 0; background: #e4e7ea; }
      .ps-stage { position: relative; background: linear-gradient(180deg, #eef0f2, #e4e7ea); aspect-ratio: 16 / 10; max-height: 340px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
      .ps-stage img { width: 100%; height: 100%; object-fit: contain; }
      .ps-stage-tag { position: absolute; left: 14px; top: 14px; height: 26px; padding: 0 10px; display: inline-flex; align-items: center; border-radius: 999px; background: rgba(15,17,21,.82); color: #fff; font-size: 12px; font-weight: 700; }
      .ps-info { padding: 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .ps-lbl { font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--ps-mute); margin-bottom: 8px; }
      .ps-vars { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
      .ps-var { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(15,17,21,.12); background: transparent; font-family: inherit; text-align: left; cursor: pointer; color: var(--ps-ink); }
      .ps-var span:first-child { font-size: 13px; font-weight: 700; overflow-wrap: anywhere; min-width: 0; }
      .ps-var span:last-child { font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; color: #374151; white-space: nowrap; }
      .ps-var[aria-checked="true"] { border-color: var(--ps-a); box-shadow: inset 0 0 0 1px var(--ps-a); }
      .ps-cols { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
      .ps-col { width: 34px; height: 34px; border-radius: 50%; border: 2px solid transparent; padding: 0; cursor: pointer; box-shadow: 0 0 0 1px rgba(15,17,21,.18) inset; }
      .ps-col[aria-checked="true"] { border-color: #fff; outline: 2px solid var(--ps-ink); }
      .ps-colname { font-size: 13px; font-weight: 600; color: #374151; margin-left: 4px; }
      .ps-price { font-size: clamp(24px, 5vw, 30px); font-weight: 800; color: var(--ps-ink); font-variant-numeric: tabular-nums; line-height: 1; }
      .ps-price small { display: block; font-size: 12.5px; font-weight: 600; color: var(--ps-mute); margin-top: 8px; }
      .ps-btns { display: flex; gap: 10px; flex-wrap: wrap; }
      .ps-btns > * { flex: 1 1 160px; }
      @media (min-width: 900px) {
        .ps-model { grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); }
        .ps-media { border-radius: 18px 0 0 18px; align-self: start; position: sticky; top: 64px; }
        .ps-stage { aspect-ratio: 4 / 3; max-height: 380px; }
        .ps-info { padding: 20px; }
      }

      /* Model tabs: name over "from RM", an ink bar under the picked one */
      .ps-mtabs { display: flex; gap: 22px; overflow-x: auto; scrollbar-width: none; margin: 0 0 14px; border-bottom: 1px solid var(--ps-line); }
      .ps-mtabs::-webkit-scrollbar { display: none; }
      .ps-mtabs button { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 4px 0 12px; border: none; background: none; cursor: pointer; font-family: inherit; text-align: left; color: #9ca3af; border-bottom: 3px solid transparent; margin-bottom: -1px; }
      .ps-mtabs button b { font-size: 15px; font-weight: 800; letter-spacing: .01em; }
      .ps-mtabs button span { font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
      .ps-mtabs button[aria-pressed="true"] { color: var(--ps-ink); border-bottom-color: var(--ps-a); }
      .ps-shots { display: flex; gap: 8px; padding: 10px 14px 14px; overflow-x: auto; scrollbar-width: none; background: #e4e7ea; }
      .ps-shots::-webkit-scrollbar { display: none; }
      .ps-shots button { flex: 0 0 auto; width: 64px; height: 44px; padding: 0; border-radius: 8px; overflow: hidden; border: 2px solid transparent; background: #fff; cursor: pointer; opacity: .7; }
      .ps-shots button[aria-pressed="true"] { border-color: var(--ps-ink); opacity: 1; }
      .ps-shots img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .ps-mhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .ps-mhead .ps-price { text-align: right; white-space: nowrap; }
      .ps-est { font-size: 12.5px; font-weight: 600; color: var(--ps-mute); line-height: 1.45; margin-top: -6px; }
      .ps-mname { font-size: clamp(20px, 4.4vw, 24px); font-weight: 800; color: var(--ps-ink); line-height: 1.1; }
      .ps-mvar { font-size: 13.5px; font-weight: 600; color: var(--ps-mute); margin-top: 4px; }
      .ps-lbl b { font-weight: 700; letter-spacing: 0; text-transform: none; color: var(--ps-ink); font-size: 13px; }
      .ps-spec { display: grid; gap: 1px; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)) !important; background: var(--ps-line); border-radius: 12px; overflow: hidden; margin: 0; }
      .ps-spec div { background: var(--ap-surf, #fff); padding: 10px 12px; min-width: 0; }
      .ps-spec dt { font-size: 10.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--ps-mute); }
      .ps-spec dd { margin: 4px 0 0; font-size: 15px; font-weight: 800; color: var(--ps-ink); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
      .ps-note { padding: 12px 14px; border-radius: 12px; background: #f4f5f7; }
      .ps-note p:last-child { font-size: 14px; color: #374151; line-height: 1.55; overflow-wrap: anywhere; }
      .ps-note .ps-lbl { margin-bottom: 4px; }

      /* "Not sure which model?" */
      .ps-help { margin-top: 18px; padding: 18px; display: grid; gap: 4px; }
      .ps-help-h h3 { font-size: clamp(20px, 4.6vw, 26px); font-weight: 800; color: var(--ps-ink); margin: 2px 0 4px; line-height: 1.15; }
      .ps-help-h p:last-child { font-size: 13.5px; color: var(--ps-mute); line-height: 1.5; }
      .ps-q { display: grid; gap: 8px; padding: 14px 0; border-top: 1px solid var(--ps-line); }
      .ps-q-l { font-size: 10.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--ps-mute); }
      .ps-q-t { font-size: 15px; font-weight: 700; color: var(--ps-ink); margin-bottom: 8px; }
      .ps-q-o { display: flex; flex-wrap: wrap; gap: 8px; }
      .ps-q-o button { min-height: 40px; padding: 8px 14px; border-radius: 10px; border: 1px solid rgba(15,17,21,.16); background: transparent; font: 600 13.5px/1.25 var(--xd-font-body); color: #374151; cursor: pointer; text-align: left; }
      .ps-q-o button[aria-checked="true"] { background: #0f1115; border-color: #0f1115; color: #fff; }
      .ps-help .ps-btns > * { flex: 0 1 230px; }
      .ps-help-r { border-top: 1px solid var(--ps-line); padding-top: 14px; }
      .ps-help-pick { font-size: clamp(24px, 6vw, 32px); font-weight: 800; color: var(--ps-ink); line-height: 1.1; }
      .ps-help-facts { font-size: 13.5px; color: #374151; margin-top: 6px; }
      .ps-help-price { font-size: 17px; font-weight: 800; color: var(--ps-ink); margin-top: 8px; font-variant-numeric: tabular-nums; }
      .ps-help-price small { font-size: 12.5px; font-weight: 600; color: var(--ps-mute); }
      .ps-help-l { min-width: 0; }
      @media (min-width: 1000px) {
        .ps-help { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); column-gap: 32px; align-items: start; }
        .ps-help-r { border-top: none; border-left: 1px solid var(--ps-line); padding: 4px 0 0 32px; position: sticky; top: 70px; }
      }
      @media (min-width: 900px) { .ps-help { padding: 24px; } .ps-q { grid-template-columns: 110px minmax(0, 1fr); gap: 16px; } .ps-q-t { margin-bottom: 10px; } }

      /* Phone: one question at a time; wide screens show them all */
      .ps-steps { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0 2px; border-top: 1px solid var(--ps-line); font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--ps-mute); }
      .ps-steps span:last-child { display: flex; gap: 6px; }
      .ps-steps button { min-height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid rgba(15,17,21,.16); background: transparent; font: 700 12.5px/1 var(--xd-font-body); letter-spacing: 0; text-transform: none; color: var(--ps-ink); cursor: pointer; }
      .ps-steps button:disabled { opacity: .35; cursor: default; }
      @media (max-width: 999px) { .ps-q { display: none; border-top: none; padding: 8px 0 6px; } .ps-q.on { display: grid; } .ps-q-l { display: none; } }
      @media (min-width: 1000px) { .ps-steps { display: none; } }

      @media (max-width: 899px) {
        .ps-model { overflow: hidden; }
        .ps-media { position: relative; }
        .ps-stage { aspect-ratio: 16 / 10; max-height: 230px; }
        .ps-shots { position: absolute; left: 10px; bottom: 10px; padding: 0; gap: 6px; background: transparent; }
        .ps-shots button { width: 42px; height: 30px; border-radius: 6px; border-color: rgba(255,255,255,.7); opacity: .85; }
        .ps-shots button[aria-pressed="true"] { border-color: #fff; opacity: 1; box-shadow: 0 0 0 2px var(--ps-ink); }
        .ps-info { padding: 14px; gap: 10px; }
        .ps-spec { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .ps-spec div { padding: 7px 10px; }
        .ps-spec dd { font-size: 14px; }
        .ps-vars { display: flex; overflow-x: auto; gap: 6px; margin: 0 -14px; padding: 0 14px 4px; scroll-snap-type: x proximity; scrollbar-width: none; }
        .ps-vars::-webkit-scrollbar { display: none; }
        .ps-var { flex: 0 0 auto; width: auto; min-width: 128px; scroll-snap-align: start; }
        .ps-col { width: 30px; height: 30px; }
        .ps-note p:last-child { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .ps-btns { flex-wrap: nowrap; gap: 8px; }
        .ps-btns > * { flex: 1 1 0; min-width: 0; padding: 0 10px; font-size: 13px; white-space: normal; line-height: 1.15; height: 46px; }
        .ps-help { padding: 14px; }
        .ps-help-h h3 { font-size: 20px; }
        .ps-help-h p:last-child { display: none; }
        .ps-q-o button { min-height: 38px; padding: 6px 12px; font-size: 13px; }
        .ps-mtabs { gap: 18px; margin-bottom: 10px; }
      }

      /* Delivery */
      .ps-del { padding: 18px; display: grid; gap: 16px; }
      .ps-towns { display: flex; flex-wrap: wrap; gap: 8px; }
      .ps-towns button { height: 38px; padding: 0 16px; border-radius: 999px; border: 1px solid rgba(15,17,21,.14); background: transparent; font: 700 13.5px/1 var(--xd-font-body); color: #374151; cursor: pointer; }
      .ps-towns button[aria-pressed="true"] { background: #0f1115; border-color: #0f1115; color: #fff; }
      .ps-route { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; }
      .ps-route i { height: 2px; border-radius: 2px; background: repeating-linear-gradient(90deg, rgba(15,17,21,.3) 0 6px, transparent 6px 12px); }
      .ps-route b { font-size: 13px; color: var(--ps-ink); overflow-wrap: anywhere; max-width: 28vw; }
      .ps-dot { width: 12px; height: 12px; border-radius: 50%; border: 3px solid var(--ps-ink); background: #fff; }
      .ps-dot--end { background: var(--ps-a); border-color: var(--ps-a); }
      .ps-big { display: flex; gap: 28px; flex-wrap: wrap; }
      .ps-big div b { display: block; font-size: clamp(34px, 8vw, 46px); font-weight: 800; line-height: 1; color: var(--ps-ink); font-variant-numeric: tabular-nums; }
      .ps-big div span { font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--ps-mute); }
      .ps-big small { font-size: 18px; font-weight: 700; color: var(--ps-mute); }
    `}</style>
  );
}
