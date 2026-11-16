// The dealer dashboard's own CSS (cards, stat cards, settings sections, modals), injected by
// DashboardPage as one <style> tag. premiumLight rules live here and in src/theme/premiumLight.css.
import { premiumLight } from "../../theme/tokens";

export const DASHBOARD_STYLES = `

  *, *::before, *::after { box-sizing: border-box; }

  body { background: ${premiumLight.canvas}; color: #0F172A; font-family: system-ui, sans-serif; } /* premiumLight.canvas */

  /* ── Sidebar nav ── */
  .nav-item { transition: all 0.15s; border-radius: 7px; }
  .nav-item:hover:not(.nav-active) { background: #EAECF0 !important; color: #0F172A !important; }
  .nav-active { background: #E4E7EC !important; color: #111827 !important; font-weight: 600; }

  /* ── Cards ── */
  /* premiumLight (owner, 2026-11-16: "check the Overview tab, that's how it is now"): white, floating on a soft shadow, no border. */
  .dash-card { background: ${premiumLight.card}; border: none; border-radius: ${premiumLight.radius.card}px; box-shadow: ${premiumLight.shadow}; }
  .stat-card { background: ${premiumLight.card}; border: none; border-radius: ${premiumLight.radius.card}px; box-shadow: ${premiumLight.shadow}; transition: box-shadow 0.18s; }
  .stat-card:hover { box-shadow: ${premiumLight.shadowHover}; }

  /* ── Table rows ── */
  .data-row { transition: background 0.12s; }
  .data-row:hover { background: ${premiumLight.raised} !important; }

  /* ── Modals ── */
  .glass-modal, .modal-top { background: #FFFFFF; border: none; border-radius: ${premiumLight.radius.card}px; box-shadow: 0 20px 60px rgba(15,23,42,0.22); }

  /* ── Misc ── */
  /* ONE form-field recipe for every Settings screen (owner, 2026-11-16: Overview is the design): grey fill, no border, ink focus ring. */
  .settings-section :is(input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]), select, textarea) { background: #f5f6f8 !important; border: none !important; box-shadow: none !important; border-radius: 12px; color: #111827; }
  .settings-section :is(input, select, textarea):focus { outline: none; box-shadow: 0 0 0 2px rgba(17,24,39,0.18) !important; }
  .settings-section :is(input, select, textarea)::placeholder { color: #9ca3af; }
  .settings-section { background: ${premiumLight.card}; border: none; border-radius: ${premiumLight.radius.card}px; box-shadow: ${premiumLight.shadow}; overflow: hidden; }
  .table-wrap { position: relative; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .table-wrap::after { content:''; position:absolute; top:0; right:0; bottom:0; width:24px; background:linear-gradient(to left,rgba(247,248,250,0.9),transparent); pointer-events:none; }

  .btn-shimmer { position: relative; overflow: hidden; }
  .btn-shimmer::after { display:none; } /* no shimmer sweep on the dealer dashboard (flat red keys) */
  @keyframes shimmer { to { left:150%; } }

  .sold-btn:hover { background: #F1F3F5 !important; border-color: transparent !important; color: #047857 !important; }
  .discount-chip { transition: box-shadow 0.15s; }

  /* ── Gradient text (keep for charts/badges) ── */
  .grad-red    { background: linear-gradient(135deg,#dc2626,#f87171); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-blue   { background: linear-gradient(135deg,#2563eb,#60a5fa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-green  { background: linear-gradient(135deg,#16a34a,#4ade80); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-gold   { background: linear-gradient(135deg,#d97706,#fbbf24); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #9AA1AD; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }

  @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes hotpulse { 0%,100%{opacity:1}50%{opacity:.55} }
  .blue-glow { animation: hotpulse 2.2s ease-in-out infinite; }
`;
