// Shared style tokens, formatters and small components used across the
// Salesman Premium tabs. Split out of SalesmanPremium.jsx so tab files that
// live in this folder (DashboardTab.jsx, ListingsTab.jsx, ...) and the
// SalesmanPremium.jsx shell itself both import from one place instead of
// duplicating these — moved verbatim, no behaviour changes.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Flame, TrendingUp, Snowflake } from "lucide-react";
import { panel as C, panelType as T, panelRadius as R, withAlpha, premiumDark as PD } from "../../theme/tokens";
import "./premiumForm.css";
import { HIGH_VALUE_THRESHOLD } from "../../utils/financing";
import i18n from "../../i18n/config";
import { useModalHistory } from '../../hooks/useModalHistory';

// Module-scope strings read through i18n.t at the moment they are used, so a
// language switch repaints them on the next render (PREM-I18N-2). A getter
// object keeps every existing `LABELS[key]` call site working unchanged.
export const tp = (key, opts) => i18n.t(`salesmanPremium.${key}`, opts);
const translatedMap = (prefix, keys) =>
 Object.defineProperties({}, Object.fromEntries(keys.map((k) => [k, { enumerable: true, get: () => tp(`${prefix}.${k}`) }])));
// Pipeline stage name for display. Unknown stages fall back to the raw key
// with underscores spaced out, which is what every call site did before.
export const stageLabel = (stage) =>
 stage ? tp(`stages.${stage}`, { defaultValue: String(stage).replace(/_/g, " ") }) : "";

// Price visual weight — a RM45k car and a RM2.4M car shouldn't read at the
// same size/color; scale the price figure up for higher tiers so the card
// itself signals value at a glance. Ported from Salesman Lite's listing card.
export function priceStyle(sellingPrice) {
 const sp = Number(sellingPrice) || 0;
 if (sp >= 1000000) return { fontSize: 18, fontWeight: 800, color: C.warnText };
 if (sp >= HIGH_VALUE_THRESHOLD) return { fontSize: 16, fontWeight: 800, color: C.infoTextHi };
 return { fontSize: 14, fontWeight: 700, color: C.infoText };
}
// Soft tinted control (badge, pill) in a given state hue.
export const SOFT = (hue) => ({ background: withAlpha(hue, 0.1), border: `1px solid ${withAlpha(hue, 0.2)}`, color: hue });

// Shared card/pill/text shapes for the dashboard, ported from Lite so both
// panels use the same shapes off the same token module.
export const CARD = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, overflow: "hidden" };
export const CARD_HEADER = {
 padding: "13px 18px", borderBottom: `1px solid ${C.line}`,
 fontSize: T.size.sm, letterSpacing: T.track.label, textTransform: "uppercase", color: C.textMuted, fontWeight: T.weight.semibold,
 display: "flex", alignItems: "center", justifyContent: "space-between",
};
export const ROW_LINE = (show) => (show ? `1px solid ${C.line}` : "none");
export const EYEBROW = { fontSize: T.size.xs, fontWeight: T.weight.semibold, color: C.textMuted, textTransform: "uppercase", letterSpacing: T.track.label };
export const STAT = { fontWeight: T.weight.bold, color: C.text, letterSpacing: T.track.tight, lineHeight: 1 };

// The Monthly Goal card only ever shows THIS calendar month; this modal is
// one tap away for history instead of the figure just disappearing at a
// month boundary. Ported verbatim from Salesman Lite.
// One shell for every listing form on Salesman Premium — Fast list, Full form
// and Edit. All three used to render differently: Fast and Full were inline
// SECTIONS pushed above the listing grid (so the page behind stayed live and a
// stray tap or scroll interrupted a half-filled form), and Edit was a
// hand-rolled fixed overlay that was neither portalled nor body-locked. This
// is the single implementation — do not fork a fourth.
//
// Overlay rules: portalled to document.body (rule 1) and body scroll locked
// while open (rule 2). Deliberately NO backdrop-click / Escape close — these
// wrap a multi-step form and one stray tap should not bin what was typed; the
// x button is the only way out. Same reason the back gesture ASKS before
// closing it (useModalHistory isDirty), every time.
export function ListingFormModal({ open, onClose, title, subtitle, isMobile, children }) {
 useModalHistory(!!open, onClose, { isDirty: () => true });
 useEffect(() => {
 if (!open) return;
 document.body.style.overflow = "hidden";
 return () => { document.body.style.overflow = ""; };
 }, [open]);

 if (!open) return null;

 return createPortal(
 <div
 className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
 style={{ background: "rgba(0,0,0,0.78)" }}
 >
 {/* premiumDark sheet (SIMPLE-2). The form inside follows .pd-form
     (premiumForm.css); CarForm stays white everywhere else. */}
 <div
 style={{
 background: PD.card,
 borderRadius: isMobile ? `${PD.radius.card}px ${PD.radius.card}px 0 0` : PD.radius.card,
 width: "100%",
 maxWidth: 672,
 maxHeight: "92vh",
 display: "flex",
 flexDirection: "column",
 boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
 }}
 >
 <div
 style={{
 display: "flex",
 alignItems: "center",
 justifyContent: "space-between",
 gap: 12,
 padding: "16px 20px",
 borderBottom: `1px solid ${PD.line}`,
 flexShrink: 0,
 }}
 >
 <div style={{ minWidth: 0 }}>
 <p style={{ margin: 0, fontWeight: 700, color: PD.text, fontSize: 16 }}>{title}</p>
 {subtitle && (
 <p style={{ margin: "2px 0 0", fontSize: 12.5, color: PD.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</p>
 )}
 </div>
 <button
 onClick={onClose}
 aria-label={tp("common.close")}
 style={{ width: 36, height: 36, borderRadius: PD.radius.pill, background: PD.raised, border: "none", cursor: "pointer", color: PD.textSec, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
 >
 <X size={18} />
 </button>
 </div>
 <div className="pd-form" style={{ overflowY: "auto", flex: 1, padding: 20 }}>{children}</div>
 </div>
 </div>,
 document.body,
 );
}

export const timeAgo = (iso) => {
 if (!iso) return "—";
 const d = new Date(iso);
 if (isNaN(d.getTime())) return "—";
 const s = Math.floor((Date.now() - d) / 1000);
 if (s < 60) return tp("time.sAgo", { n: s });
 if (s < 3600) return tp("time.mAgo", { n: Math.floor(s / 60) });
 if (s < 86400) return tp("time.hAgo", { n: Math.floor(s / 3600) });
 return tp("time.dAgo", { n: Math.floor(s / 86400) });
};

// Minute-level relative time, never days — "just now", "12m ago", "1h 05m ago".
// Ported from Lite for the Inbox tab.
export const preciseAgo = (iso, now = Date.now(), L = {}) => {
 if (!iso) return "—";
 const ago = L.ago || "ago";
 const justNow = L.justNow || "just now";
 const d = new Date(iso);
 if (isNaN(d.getTime())) return "—";
 const totalMin = Math.floor((now - d.getTime()) / 60000);
 if (totalMin < 1) return justNow;
 if (totalMin < 60) return `${totalMin}m ${ago}`;
 const h = Math.floor(totalMin / 60);
 const m = totalMin % 60;
 return `${h}h ${String(m).padStart(2, "0")}m ${ago}`;
};
// Countdown toward a FUTURE moment (an upcoming appointment) — "in 2h 05m", "now".
export const preciseUntil = (iso, now = Date.now(), L = {}) => {
 if (!iso) return "";
 const inW = L.in || "in";
 const nowW = L.now || "now";
 const d = new Date(iso);
 if (isNaN(d.getTime())) return "";
 const totalMin = Math.floor((d.getTime() - now) / 60000);
 if (totalMin <= 0) return nowW;
 if (totalMin < 60) return `${inW} ${totalMin}m`;
 const h = Math.floor(totalMin / 60);
 const m = totalMin % 60;
 return `${inW} ${h}h ${String(m).padStart(2, "0")}m`;
};
export const timeLabels = translatedMap("time", ["ago", "justNow", "in", "now"]);
// One neutral chip for a lead whose stage doesn't map to a known hue.
export const STAGE_NEUTRAL = { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)", tx: "#cbd5e1" };
// Booking status labels for the Bookings tab.
export const STATUS_LABEL = translatedMap("bookingStatus", ["pending", "confirmed", "rescheduled", "cancelled", "completed", "no_show"]);

export const LEAD_STAGES = [
 "new",
 "contacted",
 "viewing_booked",
 "test_drive",
 "negotiating",
 "deposit_taken",
 "won",
 "lost",
 "closed_won",
 "closed_lost",
];

// bg/border/tx are the low-alpha tint used for pills. `solid` is the same
// hue at full strength, for surfaces that FILL with the stage colour (the
// leads pipeline rail) -- the 12%-alpha bg goes muddy used that way.
export const STAGE_COLOR = {
 new: {
 bg: "rgba(96,165,250,0.12)",
 border: "rgba(96,165,250,0.3)",
 tx: "#93c5fd",
 solid: "#3b82f6",
 },
 contacted: {
 bg: "rgba(251,191,36,0.12)",
 border: "rgba(251,191,36,0.3)",
 tx: "#fbbf24",
 solid: "#f59e0b",
 },
 viewing_booked: {
 bg: "rgba(167,139,250,0.12)",
 border: "rgba(167,139,250,0.3)",
 tx: "#c084fc",
 solid: "#8b5cf6",
 },
 test_drive: {
 bg: "rgba(52,211,153,0.12)",
 border: "rgba(52,211,153,0.3)",
 tx: "#34d399",
 solid: "#10b981",
 },
 negotiating: {
 bg: "rgba(251,146,60,0.12)",
 border: "rgba(251,146,60,0.3)",
 tx: "#fb923c",
 solid: "#f97316",
 },
 deposit_taken: {
 bg: "rgba(34,197,94,0.12)",
 border: "rgba(34,197,94,0.3)",
 tx: "#4ade80",
 solid: "#22c55e",
 },
 won: {
 bg: "rgba(34,197,94,0.18)",
 border: "rgba(34,197,94,0.4)",
 tx: "#4ade80",
 solid: "#16a34a",
 },
 lost: {
 bg: "rgba(107,114,128,0.12)",
 border: "rgba(107,114,128,0.3)",
 tx: "#9ca3af",
 solid: "#6b7280",
 },
 closed_won: {
 bg: "rgba(34,197,94,0.18)",
 border: "rgba(34,197,94,0.4)",
 tx: "#4ade80",
 solid: "#16a34a",
 },
 closed_lost: {
 bg: "rgba(107,114,128,0.12)",
 border: "rgba(107,114,128,0.3)",
 tx: "#9ca3af",
 solid: "#6b7280",
 },
};

export const STAGE_WEIGHT = {
 new: 1,
 contacted: 2,
 viewing_booked: 3,
 test_drive: 4,
 negotiating: 5,
 deposit_taken: 6,
};

export const getHeatScore = (lead) => {
 const stageWeight = STAGE_WEIGHT[lead.stage] || 0;
 const daysStale = lead.updated_at
? Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000)
 : 0;
 const penalty = Math.min(daysStale * 0.5, 3);
 const score = stageWeight - penalty;
 if (score >= 4) return { score, icon: Flame, label: "hot", color: "#f87171" };
 if (score >= 2) return { score, icon: TrendingUp, label: "warm", color: "#fbbf24" };
 return { score, icon: Snowflake, label: "cold", color: "#93c5fd" };
};

export const LOST_REASONS = ["Price", "Timing", "Competitor", "Ghost"];

// Two tabs now host a pair of sibling views (Inbox: bookings / lead history,
// Listings: cars / add-ons). One switcher, so they cannot drift apart.
export function SubTabs({ value, onChange, items }) {
 return (
 <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
 {items.map(({ key, label, badge, tourId }) => (
 <button
 key={key}
 data-tour-id={tourId}
 onClick={() => onChange(key)}
 style={{
 fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer",
 background: value === key ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.04)",
 border: `1px solid ${value === key ? "rgba(37,99,235,0.35)" : "rgba(255,255,255,0.08)"}`,
 color: value === key ? "#93c5fd" : "#6b7280",
 display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
 }}
 >
 {label}
 {badge > 0 && (
 <span style={{ fontSize: 10, fontWeight: 700, background: "#2563eb", color: "#fff", borderRadius: 99, padding: "0px 5px", minWidth: 16, textAlign: "center" }}>
 {badge}
 </span>
 )}
 </button>
 ))}
 </div>
 );
}
