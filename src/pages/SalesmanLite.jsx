import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import { readHandoffTokens, clearHandoffTokens } from "../lib/authHandoff";
import { normalizePhone } from "../lib/phone";
import { freshChannel } from "../lib/realtime";
import { cdnImg } from "../utils/img";
import { compressImageFile } from "../utils/compressImage";
import CarForm, { buildCopyText } from "../components/CarForm";
import CarDetailPopup from "../components/CarDetailPopup";
import { getDealerIdFromProfile } from "../hooks/useProfile";
import {
  panel as C,
  panelType as T,
  panelRadius as R,
  panelStageHue,
  withAlpha,
} from "../theme/tokens";
import ServicesAddonsTab from "../components/salesman/ServicesAddonsTab";
import SalesmanLiteHelp from "../components/SalesmanLiteHelp";
import ChannelBreakdown from "../components/ChannelBreakdown";
import ShareMenu from "../components/ShareMenu";
import ReportBugButton from "../components/ReportBugButton";
import PushToggle from "../components/PushToggle";
import VerifyIdentity from "../components/kyc/VerifyIdentity";
import AccountReviewBanner from "../components/AccountReviewBanner";
import SuspendedBanner from "../components/SuspendedBanner";
import SellerInbox from "../components/chat/SellerInbox";
import ChatSheet from "../components/chat/ChatSheet";
import NotificationPanel from "../components/notifications/NotificationPanel";
import { useChatThreads } from "../hooks/useChat";
import {
  LogOut,
  Copy,
  Check,
  ShieldCheck,
  Car,
  Plus,
  User,
  Phone,
  X,
  Lock,
  LayoutGrid,
  Users,
  MessageSquare,
  MessageCircle,
  Link as LinkIcon,
  ExternalLink,
  Trash2,
  Send,
  Pencil,
  ClipboardPen,
  Settings,
  Bell,
  TrendingUp,
  Calendar,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Droplets,
  Palette,
  Gauge,
  Sparkles,
  Eye,
  PhoneCall,
  History,
  Search,
  DollarSign,
  Clock,
  BarChart2,
  BarChart2 as BarChart2Icon,
  Target,
  Award,
  Zap,
  Flame,
  Snowflake,
  Pin,
  PhoneOff,
  RefreshCw,
  Voicemail,
  CheckCircle,
  BookOpen,
  Package,
  Camera,
  ThumbsUp,
  ThumbsDown,
  Store,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip as RTooltip, XAxis } from "recharts";
import { HIGH_VALUE_THRESHOLD } from "../utils/financing";
import AvailabilityEditor from "../components/AvailabilityEditor";

// Price visual weight — a RM45k car and a RM2.4M car shouldn't read at the
// same size/color; scale the price figure up for higher tiers so the card
// itself signals value at a glance.
function priceStyle(sellingPrice) {
  const sp = Number(sellingPrice) || 0;
  if (sp >= 1000000) return { fontSize: 18, fontWeight: 800, color: C.warnText };
  if (sp >= HIGH_VALUE_THRESHOLD) return { fontSize: 16, fontWeight: 800, color: C.infoTextHi };
  return { fontSize: 14, fontWeight: 700, color: C.infoText };
}

// Shared style helpers for the dark salesman panel — module scope so every
// render* function in this file uses the same card/pill/text shapes instead
// of each redefining its own.
const CARD = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, overflow: "hidden" };
const CARD_HEADER = {
  padding: "13px 18px", borderBottom: `1px solid ${C.line}`,
  fontSize: T.size.sm, letterSpacing: T.track.label, textTransform: "uppercase", color: C.textMuted, fontWeight: T.weight.semibold,
  display: "flex", alignItems: "center", justifyContent: "space-between",
};
// Row divider inside a card — one value, was five (0.04→0.08) doing the same job.
const ROW_LINE = (show) => (show ? `1px solid ${C.line}` : "none");
// Eyebrow: the small uppercase label above a value. Semibold, never bold —
// bold is reserved for the number it labels.
const EYEBROW = { fontSize: T.size.xs, fontWeight: T.weight.semibold, color: C.textMuted, textTransform: "uppercase", letterSpacing: T.track.label };
// The one big number in a card.
const STAT = { fontWeight: T.weight.bold, color: C.text, letterSpacing: T.track.tight, lineHeight: 1 };
// Soft tinted control (WA button, badge, pill) in a given state hue.
const SOFT = (hue) => ({ background: withAlpha(hue, 0.1), border: `1px solid ${withAlpha(hue, 0.2)}`, color: hue });

function useWindowSize() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

// Canonical Malaysian phone form (digits, leading 60) — matches the app's own
// normalizePhone imported from ../lib/phone (canonical 60… form, matches the DB
// normalize trigger) so auto-converted leads dedup reliably regardless of input.

const timeAgo = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// Inbox countdown — deliberately NEVER collapses to days. "2d ago" hides
// whether a lead has been sitting 25h or 71h; a salesman needs the real hour
// count to know how cold a lead is. Always resolves to minutes (and hours once
// past 60m), e.g. "43m ago", "5h 12m ago", "51h 03m ago". `now` is passed in
// (a ticking value) so callers re-render every minute for a live countdown.
// `L` carries the localized words (ago / justNow) — the numbers stay universal.
const preciseAgo = (iso, now = Date.now(), L = {}) => {
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

// Countdown toward a FUTURE moment (e.g. an upcoming appointment), same
// minute-level, never-days philosophy — "in 2h 05m", "in 40m", "now".
const preciseUntil = (iso, now = Date.now(), L = {}) => {
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

const LEAD_STAGES = [
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

// One neutral chip for every in-flight stage — progression is encoded by the
// card's progress bar + position counter, not a rainbow (the old 6-hue map
// collided with heat/outcome/action colors and taught nothing). Color is
// reserved for meaning: green = money stages (deposit/won), gray = lost,
// red = attention (stale "!") — applied at the render sites, not here.
const STAGE_NEUTRAL = {
  bg: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.12)",
  tx: "#cbd5e1",
};
const STAGE_COLOR = {
  new: STAGE_NEUTRAL,
  contacted: STAGE_NEUTRAL,
  viewing_booked: STAGE_NEUTRAL,
  test_drive: STAGE_NEUTRAL,
  negotiating: STAGE_NEUTRAL,
  deposit_taken: {
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.3)",
    tx: "#4ade80",
  },
  won: {
    bg: "rgba(34,197,94,0.18)",
    border: "rgba(34,197,94,0.4)",
    tx: "#4ade80",
  },
  lost: {
    bg: "rgba(107,114,128,0.12)",
    border: "rgba(107,114,128,0.3)",
    tx: "#9ca3af",
  },
  closed_won: {
    bg: "rgba(34,197,94,0.18)",
    border: "rgba(34,197,94,0.4)",
    tx: "#4ade80",
  },
  closed_lost: {
    bg: "rgba(107,114,128,0.12)",
    border: "rgba(107,114,128,0.3)",
    tx: "#9ca3af",
  },
};

const STAGE_WEIGHT = {
  new: 1,
  contacted: 2,
  viewing_booked: 3,
  test_drive: 4,
  negotiating: 5,
  deposit_taken: 6,
};

const TERMINAL_STAGES = ["won", "closed_won", "lost", "closed_lost"];

// Engagement temperature is only meaningful WHILE a lead is in flight. A
// closed deal (won or lost) has no urgency to signal, so we mark it terminal
// and the render sites drop the hot/warm/cold pill entirely — showing "cold"
// on a Won deal (the old bug: terminal stages have no STAGE_WEIGHT → score 0)
// read as a contradiction.
const getHeatScore = (lead) => {
  const terminal = TERMINAL_STAGES.includes(lead.stage)
    ? (lead.stage === "won" || lead.stage === "closed_won" ? "won" : "lost")
    : null;
  const stageWeight = STAGE_WEIGHT[lead.stage] || 0;
  const daysStale = lead.updated_at
    ? Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000)
    : 0;
  const penalty = Math.min(daysStale * 0.5, 3);
  const score = stageWeight - penalty;
  if (score >= 4) return { score, terminal, icon: Flame,     label: "hot",  color: "#f87171" };
  if (score >= 2) return { score, terminal, icon: TrendingUp, label: "warm", color: "#fbbf24" };
  return          {         score, terminal, icon: Snowflake,  label: "cold", color: "#93c5fd" };
};

const LOST_REASONS = ["Price", "Timing", "Competitor", "Ghost"];

// Human car age from registration year, for the lead drawer's car block.
const carAgeLabel = (year) => {
  const y = Number(year);
  if (!y || y < 1950) return null;
  const age = new Date().getFullYear() - y;
  if (age <= 0) return "Brand new";
  return `${age} year${age !== 1 ? "s" : ""} old`;
};

// First-contact WhatsApp message for a NEW lead — pre-fills the full car detail
// they enquired on (name, price, mileage, transmission, VIN, plate) so the
// salesman can send a complete, professional reply in one tap instead of
// re-typing it. Bahasa-rojak to match the other pipeline templates.
const buildNewLeadWa = (lead, car) => {
  const name = lead.buyer_name || "kawan";
  if (!car) {
    return `Hi ${name}! Terima kasih sebab enquire. Boleh saya tahu kereta mana yang you berkenan? Saya boleh bagi full details, harga & arrange viewing. 😊`;
  }
  const rm = (n) => `RM ${Number(n).toLocaleString("en-MY")}`;
  const title = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
  const specLine = [
    car.mileage ? `${Number(car.mileage).toLocaleString("en-MY")} km` : null,
    car.transmission,
    car.fuel_type,
  ].filter(Boolean).join(" · ");
  const lines = [
    `Hi ${name}! Terima kasih sebab enquire tentang kereta ni 👇`,
    "",
    `🚗 ${title}`,
  ];
  if (car.selling_price) lines.push(`💰 ${rm(car.selling_price)}`);
  if (specLine) lines.push(`📊 ${specLine}`);
  if (car.plate_number) lines.push(`🔖 Plate: ${car.plate_number}`);
  if (car.vin_number) lines.push(`🔑 VIN: ${car.vin_number}`);
  lines.push("");
  lines.push("Kereta ni masih available. Bila you free untuk viewing atau test drive? Saya boleh arrange terus. 😊");
  return lines.join("\n");
};

function StatusBadge({ status }) {
  const styles = {
    available: "bg-green-500/15 text-green-400 border-green-500/30",
    reserved: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    pending: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize flex-shrink-0 ${styles[status] ?? "bg-gray-700 text-gray-400 border-gray-600"}`}
    >
      {status}
    </span>
  );
}

// Shared CarForm popup — used for both Add and Edit so the two flows can never
// drift apart. White card (matches the dealer dashboard's own CarForm modals —
// DashboardPage's .modal-top / Stock Publish overlay — CarForm is a light-themed
// component regardless of the page it's embedded in) over a dark backdrop, full
// screen on mobile with no rounded corners or gap, centered capped-height card on
// desktop. Portal + body-scroll-lock per the app's overlay rules.
function CarFormModal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex sm:items-center sm:justify-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.82)" }}
    >
      <div className="w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-2xl bg-white sm:rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-[15px] truncate">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 p-1 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// Previous-month commission popup — standalone component (not a plain function
// called mid-render) because it needs its own useEffect for the body-scroll
// lock; renderDashboard() below is only invoked when the dashboard tab is
// active, so a hook inside it would violate the Rules of Hooks. Own overlay-
// click / × close, so per the app's overlay rules it does NOT register
// useModalHistory — that's reserved for primary drawers.
function PrevMonthModal({ open, onClose, monthLabel, commission, count, trendPct, trendLabel }) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, maxWidth: 340, width: "100%", fontFamily: "system-ui,sans-serif" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>{monthLabel}</p>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", padding: 4, display: "flex" }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ margin: "0 0 4px", fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>Commission earned</p>
        <p style={{ margin: "0 0 6px", fontSize: 32, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.03em", lineHeight: 1 }}>
          RM {commission.toLocaleString("en-MY")}
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#6b7280" }}>{count} car{count !== 1 ? "s" : ""} sold</p>
        {trendPct !== null ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 99, background: trendPct >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: trendPct >= 0 ? "#4ade80" : "#f87171" }}>{trendPct >= 0 ? "↑" : "↓"} {Math.abs(trendPct)}%</span>
            <span style={{ fontSize: 11, color: "#6b7280" }}>vs {trendLabel}</span>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 11, color: "#374151" }}>No data from {trendLabel} to compare against.</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

// "Give them something worth keeping" — a lightweight celebration sheet that
// fires right after a deal closes (handleMarkWon) or a monthly goal is hit
// (see the goal-smashed effect near saveGoal), offering to share the
// mini-storefront link via the existing ShareMenu channels. Deliberately never
// shows the commission figure — that stays private, only the win + a link to
// the salesman's other listings goes out. Portal + body-scroll lock per the
// app's overlay rules; own × / overlay-click close, so it does NOT register
// useModalHistory.
function WinShareCard({ prompt, onClose, slug }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!prompt) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [prompt]);

  if (!prompt) return null;
  const isGoal = prompt.kind === "goal";
  const storeUrl = slug ? `https://xdrive.my/s/${slug}` : null;

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 env(safe-area-inset-bottom)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#0d1117", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "24px 24px 32px", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={22} style={{ color: "#f87171" }} />
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", padding: 4, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>
          {isGoal ? t("salesmanLite.win.goalTitle") : t("salesmanLite.win.dealTitle")}
        </p>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>
          {isGoal ? t("salesmanLite.win.goalSubtitle") : (prompt.carLabel || t("salesmanLite.win.dealSubtitleGeneric"))}
        </p>
        {storeUrl ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ShareMenu
              baseUrl={storeUrl}
              refSlug={slug}
              waCaption={(url) => `${isGoal ? t("salesmanLite.win.shareGoalCaption") : t("salesmanLite.win.shareDealCaption")}:\n${url}`}
              dark
              label={t("salesmanLite.win.shareCta")}
              style={{ width: "100%", justifyContent: "center", padding: "13px 16px", fontSize: 14, fontWeight: 700 }}
            />
            <button onClick={onClose} style={{ width: "100%", padding: "10px", borderRadius: 10, background: "transparent", border: "none", color: "#4b5563", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {t("salesmanLite.win.notNow")}
            </button>
          </div>
        ) : (
          <button onClick={onClose} style={{ width: "100%", padding: "13px 16px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {t("salesmanLite.win.close")}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

// Confirm-booking modal — shows the buyer + car + date at full clarity, with an
// editable WhatsApp message the salesman sends to the buyer. "Send" opens
// WhatsApp AND marks the booking confirmed (via onSend). Portal + body-scroll
// lock per the app's overlay rules; own × / overlay-click close so it does NOT
// register useModalHistory.
function ConfirmBookingModal({ apt, message, onChangeMessage, onClose, onSend, onMoveToPipeline }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!apt) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [apt]);

  if (!apt) return null;
  const car = apt.car_listings;
  const carImg = Array.isArray(car?.images) ? car.images[0] : null;
  const carTitle = car ? [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ") : "No car linked";
  const carPrice = car?.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : null;
  const aptDate = apt.appointment_date ? new Date(apt.appointment_date) : null;
  const dateStr = aptDate ? aptDate.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" }) : "—";
  const timeStr = aptDate ? aptDate.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }) : "";

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}
      className="sm:!items-center sm:!p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px 16px 0 0", padding: 22, width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", fontFamily: "system-ui,sans-serif" }}
        className="sm:!rounded-2xl"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{t("salesmanLite.confirmModal.title")}</p>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 4, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* Buyer + car + date summary */}
        <div style={{ display: "flex", gap: 12, padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 14 }}>
          {carImg ? (
            <img src={carImg} alt="" style={{ width: 72, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0, border: "1px solid rgba(255,255,255,0.08)" }} />
          ) : (
            <div style={{ width: 72, height: 56, borderRadius: 8, flexShrink: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Car size={20} color="#374151" />
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{apt.buyer_name || "Unknown Buyer"}</p>
            <p style={{ margin: "0 0 3px", fontSize: 12, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{carTitle}</p>
            {carPrice && <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 700, color: "#4ade80" }}>{carPrice}</p>}
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#bfdbfe", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Calendar size={12} /> {dateStr}{timeStr && ` · ${timeStr}`}
            </p>
          </div>
        </div>

        {/* Editable message */}
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("salesmanLite.confirmModal.messageLabel")}</p>
        <textarea
          value={message}
          onChange={(e) => onChangeMessage(e.target.value)}
          rows={5}
          style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#e5e7eb", fontSize: 13, lineHeight: 1.5, padding: "11px 13px", outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "system-ui, sans-serif", marginBottom: 14 }}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onMoveToPipeline}
            style={{ flex: 1, padding: "11px 0", borderRadius: 9, fontSize: 13, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontFamily: "inherit" }}
          >
            {t("salesmanLite.confirmModal.moveToPipeline")}
          </button>
          <button
            onClick={onSend}
            disabled={!apt.buyer_phone || !message.trim()}
            style={{ flex: 2, padding: "11px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "rgba(37,211,102,0.16)", border: "1px solid rgba(37,211,102,0.45)", color: "#4ade80", cursor: apt.buyer_phone && message.trim() ? "pointer" : "not-allowed", opacity: apt.buyer_phone && message.trim() ? 1 : 0.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "inherit" }}
          >
            <MessageCircle size={15} /> {t("salesmanLite.confirmModal.send")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Logout confirmation — a small guard so an accidental tap on the header
// logout icon doesn't sign the salesman out mid-task. Own × / overlay-click
// close controls, so it does NOT register useModalHistory (per overlay rules).
function LogoutConfirmModal({ open, onClose, onConfirm }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, width: "100%", maxWidth: 360, padding: 24, fontFamily: "system-ui, sans-serif" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <LogOut size={17} style={{ color: "#f87171" }} />
          </div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{t("salesmanLite.logout.title")}</p>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>{t("salesmanLite.logout.body")}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#d1d5db", cursor: "pointer", fontFamily: "inherit" }}
          >
            {t("salesmanLite.logout.cancel")}
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "#dc2626", border: "none", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
          >
            {t("salesmanLite.logout.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Seller-initiated booking modal — when the salesman moves a lead into the
// booking stage, this asks "Confirm this lead's booking at ..." and captures
// the date/time (defaults pre-filled, editable). Confirming creates a CONFIRMED
// appointment → Confirmed Upcoming. Portal + body-scroll lock; own close.
function SellerBookingModal({ lead, dateValue, onChangeDate, onClose, onConfirm, saving }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!lead) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [lead]);

  if (!lead) return null;
  const car = lead.car_listings;
  const carImg = Array.isArray(car?.images) ? car.images[0] : null;
  const carTitle = car ? [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ") : "No car linked";
  const carPrice = car?.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : null;

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}
      className="sm:!items-center sm:!p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px 16px 0 0", padding: 22, width: "100%", maxWidth: 440, maxHeight: "92vh", overflowY: "auto", fontFamily: "system-ui,sans-serif" }}
        className="sm:!rounded-2xl"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{t("salesmanLite.sellerBooking.title")}</p>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 4, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
          {t("salesmanLite.sellerBooking.subtitle")}
        </p>

        <div style={{ display: "flex", gap: 12, padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 14 }}>
          {carImg ? (
            <img src={carImg} alt="" style={{ width: 64, height: 50, objectFit: "cover", borderRadius: 8, flexShrink: 0, border: "1px solid rgba(255,255,255,0.08)" }} />
          ) : (
            <div style={{ width: 64, height: 50, borderRadius: 8, flexShrink: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Car size={18} color="#374151" />
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{lead.buyer_name || "Unknown Buyer"}</p>
            <p style={{ margin: "0 0 3px", fontSize: 12, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{carTitle}</p>
            {carPrice && <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#4ade80" }}>{carPrice}</p>}
          </div>
        </div>

        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("salesmanLite.sellerBooking.dateLabel")}</p>
        <input
          type="datetime-local"
          value={dateValue}
          onChange={(e) => onChangeDate(e.target.value)}
          style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#e5e7eb", fontSize: 14, padding: "12px 13px", outline: "none", boxSizing: "border-box", fontFamily: "system-ui, sans-serif", marginBottom: 16 }}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "11px 0", borderRadius: 9, fontSize: 13, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontFamily: "inherit" }}
          >
            {t("salesmanLite.sellerBooking.cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={!dateValue || saving}
            style={{ flex: 2, padding: "11px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "rgba(34,197,94,0.16)", border: "1px solid rgba(34,197,94,0.45)", color: "#4ade80", cursor: dateValue && !saving ? "pointer" : "not-allowed", opacity: dateValue && !saving ? 1 : 0.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "inherit" }}
          >
            <Check size={15} /> {saving ? t("salesmanLite.sellerBooking.confirming") : t("salesmanLite.sellerBooking.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Top-level Lite tabs, each backed by its own /salesman-lite/:tab route.
// Anything not in this list falls back to the dashboard.
const VALID_LITE_TABS = ["dashboard", "listings", "leads", "enquiries", "chat", "performance", "services", "settings", "help"];

export default function SalesmanLite() {
  const navigate = useNavigate();
  const isMobile = useWindowSize() < 768;
  const { t, i18n } = useTranslation();
  // Localized words for the minute-level relative-time helpers (numbers stay
  // universal); recomputed each render so a language switch takes effect live.
  const timeLabels = {
    ago: t("salesmanLite.time.ago"),
    justNow: t("salesmanLite.time.justNow"),
    in: t("salesmanLite.time.in"),
    now: t("salesmanLite.time.now"),
  };
  // Localized pipeline-stage label; falls back to the de-underscored raw value
  // for any stage not in the map.
  const stageLabel = (s) => t("salesmanLite.stages." + s, { defaultValue: (s || "").replace(/_/g, " ") });

  const [profile, setProfile] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  // Unread buyer-chat count for the nav badge. Deliberately a second hook
  // instance rather than lifting state out of SellerInbox — each gets its own
  // realtime channel, and the badge stays live while the tab is closed.
  const { threads: chatThreads, totalUnread: chatUnread } = useChatThreads({ salesmanId: userId });
  // chat_threads.lead_id is written by the DB trigger when a buyer's first
  // message creates the lead. These rows are already loaded for the badge
  // above, so the pipeline learns which leads have a live conversation (and
  // what is unread) without a single extra query.
  const threadByLead = new Map();
  // One lead can have MORE than one thread — a buyer who chats about a second
  // car gets a second thread that dedups onto the same lead. These rows arrive
  // ordered by last_message_at desc, so the first one seen is the live one.
  chatThreads.forEach((th) => { if (th.lead_id && !threadByLead.has(th.lead_id)) threadByLead.set(th.lead_id, th); });
  const [chatSheet, setChatSheet] = useState(null);
  // Each Lite tab is its own route (/salesman-lite/:tab) so tab switches push
  // browser history — the phone Back button / swipe-back returns to the previous
  // tab instead of exiting the whole app (and landing on the sign-in page). The
  // route is the single source of truth for the active tab; `setActiveTab`
  // navigates so every existing call site keeps working unchanged.
  const { tab: routeTab } = useParams();
  const activeTab = VALID_LITE_TABS.includes(routeTab) ? routeTab : "dashboard";
  const setActiveTab = (tab) => navigate(`/salesman-lite/${tab}`);
  // Bookings are the primary inbox surface (real appointments to act on);
  // enquiries are demoted to a "Lead History" log behind them.
  const [inboxSubTab, setInboxSubTab] = useState("bookings");
  const [reschedulingAptId, setReschedulingAptId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  // Confirm-booking modal: holds the appointment being confirmed + the editable
  // WhatsApp message text the salesman sends to the buyer.
  const [confirmBookingApt, setConfirmBookingApt] = useState(null);
  const [confirmBookingMsg, setConfirmBookingMsg] = useState("");
  // Seller-initiated booking: when the salesman moves a lead into the booking
  // stage, this holds the lead + the chosen date/time so we can create a
  // CONFIRMED appointment (→ Confirmed Upcoming) instead of a pending request.
  const [sellerBookingLead, setSellerBookingLead] = useState(null);
  const [sellerBookingDate, setSellerBookingDate] = useState("");
  const [sellerBookingSaving, setSellerBookingSaving] = useState(false);
  // Ticks once a minute so inbox relative-time labels stay live to the minute.
  const [nowTick, setNowTick] = useState(Date.now());
  // Logout confirmation — guard against accidental taps on the header logout icon.
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  // Danger Zone — self-service account deletion (soft delete + 30-day grace).
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  // Tabs whose data is seeded entirely by the salesman's own listings. They stay
  // reachable at all times (the intro tour walks through them, and a user can
  // browse them) but render a locked preview state until the first car is listed
  // — see renderLockedPanel + the content switch. The lock is intentionally NOT
  // enforced in switchTab: blocking navigation here is what made the tour and the
  // lock fight each other (tour → switchTab('leads') → forced back to listings).
  function switchTab(tab) {
    setActiveTab(tab);
  }

  // Gate every "add a listing" entry point on IC being on file — a car can't be
  // listed anonymously. If IC is missing, prompt for it inline instead of opening
  // the form.
  function openAddListing() {
    if (profile && !profile.ic_hash) {
      setIcGateVal("");
      setIcGateOpen(true);
      return;
    }
    setShowAddForm(true);
  }

  async function saveIcAndList() {
    const digits = (icGateVal || "").replace(/\D/g, "");
    if (digits.length !== 12) { toast.error(t("salesmanLite.toast.icInvalid")); return; }
    setIcGateSaving(true);
    try {
      // Hash + store server-side (set_my_ic): the IC is never persisted in
      // plaintext, only a per-user-salted SHA-256 hash. We ignore the returned
      // last-4 — the badge shows verified status only, no digits.
      const { error } = await supabase.rpc("set_my_ic", { p_ic: digits });
      if (error) throw error;
      // Don't stash the last-4 in client state — the badge shows verified
      // status only, so there's no reason to hold IC digits in the browser.
      setProfile((p) => ({ ...p, ic_hash: "set", ic_verified_at: new Date().toISOString(), ic_deadline: null }));
      setIcGateOpen(false);
      // Only jump into the add-listing form when the gate was opened from that
      // flow — the 1-week enforcement gate can fire with no form pending.
      if (icEnforced) setShowAddForm(false); else setShowAddForm(true);
      toast.success(t("salesmanLite.toast.icVerified"));
    } catch (e) {
      const msg = e.message === "invalid_ic" ? t("salesmanLite.toast.icInvalid") : (e.message || t("salesmanLite.toast.icSaveFailed"));
      toast.error(msg);
    } finally {
      setIcGateSaving(false);
    }
  }

  // listings
  const [myListings, setMyListings] = useState([]);
  const [listingCopied, setListingCopied] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [commissionConfig, setCommissionConfig] = useState(null); // dealer's commission rule, same source CarForm uses
  // IC gate — no anonymous selling: a car can't be listed until the seller's IC
  // is on file. IC is optional at signup (1-week grace) but this blocks the
  // actual listing action until verified.
  const [icGateOpen, setIcGateOpen] = useState(false);
  const [icGateVal, setIcGateVal] = useState("");
  const [icGateSaving, setIcGateSaving] = useState(false);
  // 1-week KYC enforcement: 7 days after signup, a salesman with no IC on file
  // is hard-blocked until they verify (stored hashed). Before then IC is optional
  // (only the listing action is gated). Keyed on the account's created_at.
  const icEnforced = !!(
    profile && !profile.ic_hash && profile.created_at &&
    (Date.now() - new Date(profile.created_at).getTime()) >= 7 * 86400000
  );
  useEffect(() => {
    if (icEnforced) { setIcGateVal(""); setIcGateOpen(true); }
  }, [icEnforced]);
  useEffect(() => {
    if (!icGateOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [icGateOpen]);

  // leads
  const [leads, setLeads] = useState([]);
  const [staleLeads, setStaleLeads] = useState([]);
  // "Reward the comeback" — true for this session only, when the salesman is
  // opening Lite after a 3+ day gap. Swaps the stale-leads scold in the
  // greeting for a welcome-back line instead (see the profile-load effect
  // that sets this, and personalizedLine in renderDashboard).
  const [isReturning, setIsReturning] = useState(false);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [lostOpen, setLostOpen] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [addLeadForm, setAddLeadForm] = useState({
    buyer_name: "",
    phone: "",
    notes: "",
    car_listing_id: "",
    stage: "new",
    buyer_state: "",
  });
  const [addLeadSaving, setAddLeadSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [testDriveConfirm, setTestDriveConfirm] = useState(null); // { lead, nextStage }
  const [wonPrompt, setWonPrompt] = useState(null); // { lead }
  const [wonSaving, setWonSaving] = useState(false);
  const [shareWinPrompt, setShareWinPrompt] = useState(null); // { kind: 'deal'|'goal', carLabel? } — drives WinShareCard
  const [deletingLeadId, setDeletingLeadId] = useState(null);
  const [lostPromptId, setLostPromptId] = useState(null);
  const [lostSavingId, setLostSavingId] = useState(null);
  const [drawerLeadId, setDrawerLeadId] = useState(null);
  // When the drawer opens, auto-expand the activity timeline for that lead.
  useEffect(() => {
    setExpandedActivityLeadId(drawerLeadId || null);
  }, [drawerLeadId]);
  // Deal add-ons — attach a product from the salesman's own catalogue
  // (Services tab, dealer_products) to this lead as a paid upsell, tracked in
  // deal_products. Distinct from included_services on a car listing, which is
  // a free perk bundled into the sale — this is the paid-attach counterpart
  // the Services tab already promises exists.
  const [dealAddons, setDealAddons] = useState([]);
  // Lead ids that have at least one deal_products row — powers the small
  // blue "Add-on" badge on the pipeline card, fetched once alongside leads
  // rather than per-card (a full-catalogue fetch per card would be N+1).
  const [leadIdsWithAddons, setLeadIdsWithAddons] = useState(() => new Set());
  const [addonCatalogue, setAddonCatalogue] = useState([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [showAttachAddon, setShowAttachAddon] = useState(false);
  const [addonForm, setAddonForm] = useState({ product_id: "", sold_price: "" });
  const [attachingAddon, setAttachingAddon] = useState(false);
  useEffect(() => {
    if (!drawerLeadId) { setDealAddons([]); setAddonCatalogue([]); setShowAttachAddon(false); return; }
    const dealerId = getDealerIdFromProfile(profile);
    if (!dealerId) return;
    setAddonsLoading(true);
    Promise.all([
      supabase.from("dealer_products").select("id, name, category, selling_price").eq("dealer_id", dealerId).eq("is_active", true).order("name"),
      supabase.from("deal_products").select("id, sold_price, product_id, dealer_products(name, category)").eq("lead_id", drawerLeadId),
    ]).then(([catRes, dealRes]) => {
      setAddonCatalogue(catRes.data || []);
      setDealAddons(dealRes.data || []);
      setAddonsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerLeadId]);
  const handleAttachAddon = async () => {
    if (!drawerLeadId || !addonForm.product_id || !addonForm.sold_price) return;
    const pl = leads.find((l) => l.id === drawerLeadId);
    setAttachingAddon(true);
    const { data, error } = await supabase
      .from("deal_products")
      .insert({
        dealer_id: getDealerIdFromProfile(profile),
        lead_id: drawerLeadId,
        listing_id: pl?.car_listing_id || null,
        product_id: addonForm.product_id,
        sold_price: Number(addonForm.sold_price),
      })
      .select("id, sold_price, product_id, dealer_products(name, category)")
      .single();
    setAttachingAddon(false);
    if (error) { toast.error(t("salesmanLite.drawer.addons.attachFailed")); return; }
    if (data) setDealAddons((p) => [...p, data]);
    setAddonForm({ product_id: "", sold_price: "" });
    setShowAttachAddon(false);
    toast.success(t("salesmanLite.drawer.addons.attached"));
    setLeadIdsWithAddons((p) => new Set(p).add(drawerLeadId));
  };
  const handleRemoveAddon = async (id) => {
    await supabase.from("deal_products").delete().eq("id", id);
    setDealAddons((p) => {
      const next = p.filter((a) => a.id !== id);
      // Last add-on on this lead just got removed — drop the pipeline badge.
      if (next.length === 0 && drawerLeadId) {
        setLeadIdsWithAddons((s) => { const n = new Set(s); n.delete(drawerLeadId); return n; });
      }
      return next;
    });
  };
  const [stageSavingId, setStageSavingId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editPhoneLeadId, setEditPhoneLeadId] = useState(null);
  const [editPhoneVal, setEditPhoneVal] = useState("");
  const [phoneSavingId, setPhoneSavingId] = useState(null);
  const [editNoteVal, setEditNoteVal] = useState("");
  const [notesSavingId, setNotesSavingId] = useState(null);
  const [waModalLead, setWaModalLead] = useState(null);
  const [waModalMsg, setWaModalMessage] = useState("");
  // Lead search
  const [leadSearch, setLeadSearch] = useState("");
  // Activity timeline
  const [leadActivities, setLeadActivities] = useState({});
  const [expandedActivityLeadId, setExpandedActivityLeadId] = useState(null);
  const [activitiesLoadingId, setActivitiesLoadingId] = useState(null);
  // Call logging
  const [logCallLeadId, setLogCallLeadId] = useState(null);
  const [callOutcome, setCallOutcome] = useState("answered");
  const [callNote, setCallNote] = useState("");
  const [callSaving, setCallSaving] = useState(false);
  // Follow-up scheduler
  const [followUpModalLead, setFollowUpModalLead] = useState(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpSaving, setFollowUpSaving] = useState(false);
  // Performance-tab coaching nudges: collapsed by default (they otherwise push
  // the KPIs below the fold), expand one at a time on tap.
  const [openNudgeKeys, setOpenNudgeKeys] = useState(() => new Set());
  const toggleNudge = (key) => setOpenNudgeKeys((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  // Commission
  const [commissionData, setCommissionData] = useState({ total: 0, revenue: 0, count: 0 });

  // Goal panel
  const [goal, setGoal] = useState({ target: 0, focusCarId: null, earningsTarget: 0 });
  const [goalEditing, setGoalEditing] = useState(false);
  const [goalDraft, setGoalDraft] = useState(0);
  const [showPrevMonth, setShowPrevMonth] = useState(false);
  const saveGoal = (patch) => {
    const next = { ...goal, ...patch };
    setGoal(next);
    if (!userId) return;
    localStorage.setItem(`slite_goal_${userId}`, JSON.stringify(next));
    supabase.from("profiles").update({ lite_goal: next }).eq("id", userId).then(({ error }) => {
      if (error) console.error("saveGoal:", error);
    });
  };

  // "Give them something worth keeping" — fires the WinShareCard once per
  // calendar month per user, the moment commission earned this month first
  // reaches the goal target. localStorage flag prevents re-opening on every
  // reload/render once it's already been shown for this month.
  useEffect(() => {
    if (!userId || !goal.target || goal.target <= 0) return;
    const now = new Date();
    const soldThisMonth = myListings
      .filter((c) => c.status === "sold" && c.sold_at)
      .filter((c) => {
        const d = new Date(c.sold_at);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
    if (soldThisMonth < goal.target) return;
    const flagKey = `slite_goal_shared_${userId}_${now.getFullYear()}-${now.getMonth()}`;
    if (localStorage.getItem(flagKey)) return;
    localStorage.setItem(flagKey, "1");
    setShareWinPrompt({ kind: "goal" });
  }, [myListings, goal.target, userId]);

  // settings
  const [settingsForm, setSettingsForm] = useState({
    full_name: "",
    whatsapp_number: "",
    telegram_chat_id: "",
    city: "",
    state: "",
    location: "",
    instagram: "",
    tiktok: "",
    facebook: "",
    website: "",
    // Selling terms buyers see on every listing. A standalone agent owns their
    // own listings, so these have to live here — the dealer dashboard settings
    // they were first built in are a surface this account never sees.
    deposit_policy: "",
    deposit_terms: "",
    processing_fee: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  // Avatar cache is keyed by user id (set once profile loads) so it never
  // bleeds across salesmen sharing a device. Profile fetch repopulates it.
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef(null);
  const pendingStageRef = useRef({});
  const [cancelConfirmId, setCancelConfirmId] = useState(null);
  const [editingReminder, setEditingReminder] = useState(null);
  const [reminderMsg, setReminderMsg] = useState("");
  const [reminderPickerAptId, setReminderPickerAptId] = useState(null);
  // Bookings-tab detail popup (compact card → tap ··· to open full details +
  // secondary actions), mirroring the lead card's ··· → drawer pattern.
  const [bookingDetailId, setBookingDetailId] = useState(null);
  const [selectedRemindAt, setSelectedRemindAt] = useState(null);
  const [reminderSaving, setReminderSaving] = useState(false);

  // notifications
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  // telegram setup nudge modal
  const [telegramSetupModal, setTelegramSetupModal] = useState(false);
  const [tgTesting, setTgTesting] = useState(false);

  // browser push notifications + batch WA
  const [browserNotifPerm, setBrowserNotifPerm] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(() =>
    localStorage.getItem('slite_notif_banner_dismissed') === '1'
  );
  const [batchWALeads, setBatchWALeads] = useState(null); // null = closed, array = queue
  const [batchWAIdx, setBatchWAIdx] = useState(0);
  const [batchWAMsg, setBatchWAMsg] = useState("");

  // enquiry templates
  const [openTemplateId, setOpenTemplateId] = useState(null);
  const [templateToast, setTemplateToast] = useState(null);

  // listings sort/filter — reset to "available" whenever user navigates to the listings tab
  const [sortBy, setSortBy] = useState("newest");
  const [filterStatus, setFilterStatus] = useState("available");
  useEffect(() => { if (activeTab === "listings") setFilterStatus("available"); }, [activeTab]);
  // Lock body scroll while the booking-detail popup is open (overlay rule).
  useEffect(() => {
    if (!bookingDetailId) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [bookingDetailId]);

  // per-listing analytics (carStatsMap)
  const [carStatsMap, setCarStatsMap] = useState({});
  // per-car share-channel breakdown: { [car_id]: [{ channel, views, enquiries }] }
  const [channelMap, setChannelMap] = useState({});
  // Mini-page (/s/:slug) footprint stats: { visits, cardClicks, byChannel: [{ channel, visits, card_clicks }] }
  const [minipageStats, setMinipageStats] = useState({ visits: 0, cardClicks: 0, byChannel: [] });
  const [cvrHover, setCvrHover] = useState(null);

  // car detail popup
  const [selectedCar, setSelectedCar] = useState(null);
  const [carDetailImgIdx, setCarDetailImgIdx] = useState(0);
  const [carDetailTab, setCarDetailTab] = useState("specs");
  const [carDetailLbOpen, setCarDetailLbOpen] = useState(false);
  const [editListing, setEditListing] = useState(null);

  // tour
  const [tourStep, setTourStep] = useState(null);
  const [tourTarget, setTourTarget] = useState(null);

  // listing status change
  const [statusMenuCarId, setStatusMenuCarId] = useState(null);

  const updateListingStatus = async (car, newStatus) => {
    setStatusMenuCarId(null);
    const prevStatus = car.status;
    const prevSoldAt = car.sold_at ?? null;
    // Optimistically stamp sold_at so commission goal/count pick the deal up immediately
    // (the DB trigger stamp_sold_at sets the authoritative value, backfilled via realtime).
    const optimisticSoldAt = newStatus === "sold" ? (prevSoldAt || new Date().toISOString()) : prevSoldAt;
    setMyListings((p) => p.map((c) => c.id === car.id ? { ...c, status: newStatus, sold_at: optimisticSoldAt } : c));
    // Use RPC to avoid PostgREST bug with GENERATED ALWAYS columns (gross_profit)
    const { error: statusErr } = await supabase.rpc("update_listing_status", {
      p_listing_id: car.id,
      p_status:     newStatus,
      p_dealer_id:  userId,
    });
    if (statusErr) {
      console.error("updateListingStatus:", statusErr);
      setMyListings((p) => p.map((c) => c.id === car.id ? { ...c, status: prevStatus, sold_at: prevSoldAt } : c));
      toast.error(t("salesmanLite.toast.statusUpdateFailed"));
      return;
    }
    writeCache(`slite_listings_${userId}`, myListings.map((c) => c.id === car.id ? { ...c, status: newStatus, sold_at: optimisticSoldAt } : c));
    // Keep the "This Month" revenue/commission card in sync when selling from the Listings tab
    refreshCommissionData();
  };

  // delete listing
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // listing action overflow menu
  const [actionMenuCarId, setActionMenuCarId] = useState(null);

  const handleDeleteListing = async (carId) => {
    const { error } = await supabase
      .from("car_listings")
      .delete()
      .eq("id", carId)
      .eq("dealer_id", userId);
    if (error) {
      console.error("handleDeleteListing:", error);
      toast.error(t("salesmanLite.toast.listingDeleteFailed"));
      return;
    }
    setMyListings((p) => p.filter((c) => c.id !== carId));
    writeCache(`slite_listings_${userId}`, myListings.filter((c) => c.id !== carId));
    setConfirmDeleteId(null);
    toast.success(t("salesmanLite.toast.listingDeleted"));
  };

  // quick brief
  const [quickBriefCar, setQuickBriefCar] = useState(null);
  const [briefCopied, setBriefCopied] = useState(false);

  // loan calculator
  const [loanCalcLead, setLoanCalcLead] = useState(null);
  const [loanPrice, setLoanPrice] = useState("");
  const [loanDown, setLoanDown] = useState("10");
  const [loanRate, setLoanRate] = useState("3.5");
  const [loanYears, setLoanYears] = useState("7");

  // enquiry expand
  const [expandedEnqId, setExpandedEnqId] = useState(null);

  // mobile lead stage filter
  const [mobileLeadStage, setMobileLeadStage] = useState("new");

  // Pipeline "glow" — briefly highlights the leads that triggered a jump here
  // (from a stage pill/header, or the dashboard's Overdue button) so the user's
  // eye lands on exactly which cards need a follow-up, not just "somewhere in
  // this stage/tab."
  const [glowLeadIds, setGlowLeadIds] = useState(() => new Set());
  const glowTimeoutRef = useRef(null);
  const triggerGlow = (ids) => {
    if (!ids || ids.length === 0) return;
    if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current);
    setGlowLeadIds(new Set(ids));
    glowTimeoutRef.current = setTimeout(() => setGlowLeadIds(new Set()), 1000);
  };

  // link car to lead
  const [linkCarLeadId, setLinkCarLeadId] = useState(null);

  // deposit receipt
  const [depositModal, setDepositModal] = useState(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCopied, setDepositCopied] = useState(false);

  const channelRef = useRef(null);
  // Set by the unmount cleanup below; read by the async bootstrap before it
  // subscribes, so a dead mount never leaves a channel behind.
  const rtCancelledRef = useRef(false);
  const [appointments, setAppointments] = useState([]);
  const [pastOpen, setPastOpen] = useState(false);
  const [enquiries, setEnquiries] = useState([]);
  // analyticsEvents removed — aggregation now done server-side via get_salesman_analytics RPC

  // ── local cache helpers ────────────────────────────────────────────────────
  const CACHE_TTL = 30 * 60 * 1000; // 30 min
  const readCache = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      return Date.now() - ts < CACHE_TTL ? data : null;
    } catch (e) { console.error("readCache:", e); return null; }
  };
  const writeCache = (key, data) => {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch (e) { console.error("writeCache:", e); }
  };
  // Buyer IC and home address are identity documents, not UI-necessary for the
  // stale-while-refetching preview this cache exists for — strip them before
  // they sit in localStorage, which has no expiry of its own (the 30-min TTL
  // above only stops the app from TRUSTING a stale read, it never deletes the
  // entry). Live in-memory state (setLeads) still gets the real values.
  const redactLeadsForCache = (rows) =>
    (rows || []).map(({ buyer_ic, buyer_address, ...rest }) => rest);
  const precacheImages = (listings) => {
    if (!("caches" in window)) return;
    const urls = listings.flatMap((c) => (Array.isArray(c.images) ? c.images.slice(0, 2) : [])).filter(Boolean);
    if (!urls.length) return;
    caches.open("slite-images-v1").then(async (cache) => {
      // batch 4 at a time to avoid saturating bandwidth on first load
      for (let i = 0; i < urls.length; i += 4) {
        await Promise.all(urls.slice(i, i + 4).map((url) =>
          cache.match(url).then((hit) => { if (!hit) return cache.add(url).catch(() => {}); })
        ));
      }
    }).catch(() => {});
  };

  // Hours-per-stage before a lead counts as needing follow-up.
  // Indexed by lead.stage; falls back to 48h for unknown stages.
  const FOLLOW_UP_HOURS = {
    new: 5,
    contacted: 24,
    viewing_booked: 48,
    test_drive: 24,
    negotiating: 48,
    deposit_taken: 72,
  };

  useEffect(() => {
    const now = Date.now();
    setStaleLeads(
      leads.filter((l) => {
        const closed = ["won","lost","closed_won","closed_lost"].includes(l.stage);
        if (closed) return false;
        const overdueFollowUp = l.follow_up_at && new Date(l.follow_up_at).getTime() <= now;
        const hours = FOLLOW_UP_HOURS[l.stage] ?? 48;
        const cutoff = now - hours * 60 * 60 * 1000;
        const stale = l.updated_at && new Date(l.updated_at).getTime() < cutoff;
        return overdueFollowUp || stale;
      }),
    );
  }, [leads]);

  useEffect(() => {
    if (profile) {
      setSettingsForm({
        full_name: profile.full_name || "",
        whatsapp_number: profile.whatsapp_number || "",
        telegram_chat_id: profile.telegram_chat_id || "",
        city: profile.city || "",
        state: profile.state || "",
        location: profile.location || "",
        instagram: profile.instagram || "",
        tiktok: profile.tiktok || "",
        facebook: profile.facebook || "",
        website: profile.website || "",
        deposit_policy: profile.deposit_policy || "",
        deposit_terms: profile.deposit_terms || "",
        processing_fee: profile.processing_fee != null ? String(profile.processing_fee) : "",
      });
      const av = profile.avatar_url || "";
      setAvatarUrl(av);
      if (av && profile.id) localStorage.setItem(`salesman_lite_avatar_${profile.id}`, av);
      setCoverUrl(profile.cover_url || "");
      setSettingsForm((p) => ({ ...p, telegram_chat_id: profile.telegram_chat_id || "" }));
    }
  }, [profile]);

  // auth + profile
  useEffect(() => {
    // Cross-domain session handoff: strip tokens from URL immediately on detection
    // (before any async work) to minimise exposure in referrer headers and history.
    const { at: _at, rt: _rt } = readHandoffTokens();
    if (_at || _rt) {
      clearHandoffTokens();
    }
    const sessionPromise = _at && _rt
      ? supabase.auth.setSession({ access_token: _at, refresh_token: _rt })
          .then(() => supabase.auth.getSession())
      : supabase.auth.getSession();

    sessionPromise.then(async ({ data, error }) => {
      try {
      if (error || !data.session) {
        if (error) console.error("getSession:", error);
        setLoading(false);
        navigate("/login");
        return;
      }

      const uid = data.session.user.id;
      setUserId(uid);

      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("id, email, role, slug, dealership, site_name, whatsapp_number, brand_color, avatar_url, cover_url, telegram_chat_id, dealer_id, full_name, plan, city, state, location, ic_hash, ic_last4, ic_verified_at, ic_deadline, created_at, account_status, approval_status, rejection_reason, is_verified, kyc_submitted_at, deleted_at, instagram, tiktok, facebook, website, lite_goal, onboarding_complete, onboarding_tour_done")
        .eq("id", uid)
        .maybeSingle();

      if (profileErr) console.error("fetchProfile:", profileErr);
      if (!profileData) {
        setLoading(false);
        navigate("/login");
        return;
      }

      if (profileData.account_status === "pending") {
        setProfile(profileData);
        setLoading(false);
        return;
      }

      // Soft-deleted account (within the 30-day grace) — short-circuit to the
      // reactivate gate instead of loading the panel as an inactive user.
      if (profileData.account_status === "deleted") {
        setProfile(profileData);
        setUserId(profileData.id);
        setLoading(false);
        return;
      }

      const role = profileData.role;
      const ROLE_ROUTES = {
        superadmin: "/dashboard",
        dealer: "/dashboard",
        owner: "/dashboard",
        manager: "/manager",
        accountant: "/accountant",
        fi_officer: "/fi",
        admin: "/admin",
      };

      if (role !== "salesman") {
        navigate(ROLE_ROUTES[role] ?? "/dashboard", { replace: true });
        return;
      }

      if (profileData.dealer_id) {
        navigate("/salesman", { replace: true });
        return;
      }

      // Premium standalone accounts go to their own page
      if (profileData.plan === "salesman_full") {
        navigate("/salesman-premium", { replace: true });
        return;
      }

      // Final guard: never let a half-onboarded salesman (no name/IC/phone yet)
      // sit in the dashboard, no matter how they got here. Every routing path
      // upstream should already catch this, but this is the last line of defence
      // right at the dashboard door.
      if (profileData.onboarding_complete === false) {
        navigate("/salesman-onboarding/lite", { replace: true });
        return;
      }

      setProfile(profileData);
      setLoading(false);

      // "Reward the comeback" — detect a 3+ day gap since the last visit so
      // the greeting welcomes the salesman back instead of leading with a
      // stale-leads scold. Pure client-side (localStorage), no schema change.
      try {
        const lastVisitKey = `slite_last_visit_${uid}`;
        const lastVisit = Number(localStorage.getItem(lastVisitKey) || 0);
        if (lastVisit && Date.now() - lastVisit >= 3 * 24 * 60 * 60 * 1000) {
          setIsReturning(true);
        }
        localStorage.setItem(lastVisitKey, String(Date.now()));
      } catch {}

      if (profileData.lite_goal) {
        setGoal(prev => ({ ...prev, ...profileData.lite_goal }));
        localStorage.setItem(`slite_goal_${uid}`, JSON.stringify(profileData.lite_goal));
      } else {
        try {
          const cached = JSON.parse(localStorage.getItem(`slite_goal_${uid}`));
          if (cached) {
            setGoal(prev => ({ ...prev, ...cached }));
            supabase.from("profiles").update({ lite_goal: cached }).eq("id", uid).then(() => {});
          }
        } catch {}
      }

      if (
        !profileData.onboarding_tour_done &&
        !localStorage.getItem(`slite_tour_seen_${uid}`)
      ) {
        // Do NOT mark it seen here — only dismissTour() sets that, once the user
        // actually finishes/closes the tour. Setting it on trigger meant an
        // interrupted first landing (a reload, a redirect) permanently suppressed
        // the tour even though onboarding_tour_done was still false. The DB flag is
        // the real guard; this runs on first landing and keeps showing until done.
        setTourStep(0);
      }

      // seed from cache immediately so UI is instant
      const cachedListings = readCache(`slite_listings_${uid}`);
      if (cachedListings) setMyListings(cachedListings);
      const cachedLeads = readCache(`slite_leads_${uid}`);
      if (cachedLeads) { setLeads(cachedLeads); setLeadsLoading(false); }
      const cachedEnquiries = readCache(`slite_enquiries_${uid}`);
      if (cachedEnquiries) setEnquiries(cachedEnquiries);
      const cachedAppts = readCache(`slite_appts_${uid}`);
      if (cachedAppts) setAppointments(cachedAppts);

      // fetch listings with full columns for car detail popup
      Promise.all([
        supabase
          .from("car_listings")
          .select(
            // Must include every column CarForm's edit prefill reads, or editing a
            // listing silently blanks those fields and Save fails (e.g. "base price
            // not set"). See CarForm pre-fill effect for the full list.
            "id, slug, year, brand, model, variant, selling_price, original_price, base_price, purchase_price, status, images, colour, mileage, transmission, fuel_type, body_type, features, options, specs, city, state, condition, engine_cc, horsepower, cylinders, doors, seats, fuel_consumption, created_at, included_services, included_services_cost, recon_cost, sold_at, commission_amount, rejection_reason, is_recon, auction_grade, interior_grade, import_country, auction_house, local_reg_date, chassis_status, damage_map, video_url, car_documents, registration_date, plate_number, vin_number, previous_owners, road_tax_expiry, loan_eligible, payment_type, warranty_months, deposit_amount, sambung_monthly, sambung_months_left, sambung_balance, sambung_deposit, sambung_bank",
          )
          .eq("assigned_to", uid),
        supabase
          .from("car_listings")
          .select(
            // Must include every column CarForm's edit prefill reads, or editing a
            // listing silently blanks those fields and Save fails (e.g. "base price
            // not set"). See CarForm pre-fill effect for the full list.
            "id, slug, year, brand, model, variant, selling_price, original_price, base_price, purchase_price, status, images, colour, mileage, transmission, fuel_type, body_type, features, options, specs, city, state, condition, engine_cc, horsepower, cylinders, doors, seats, fuel_consumption, created_at, included_services, included_services_cost, recon_cost, sold_at, commission_amount, rejection_reason, is_recon, auction_grade, interior_grade, import_country, auction_house, local_reg_date, chassis_status, damage_map, video_url, car_documents, registration_date, plate_number, vin_number, previous_owners, road_tax_expiry, loan_eligible, payment_type, warranty_months, deposit_amount, sambung_monthly, sambung_months_left, sambung_balance, sambung_deposit, sambung_bank",
          )
          .eq("dealer_id", uid),
      ]).then(([r1, r2]) => {
        if (r1.error) console.error("fetchListings(assigned_to):", r1.error);
        if (r2.error) console.error("fetchListings(dealer_id):", r2.error);
        const seen = new Set();
        const merged = [...(r1.data || []), ...(r2.data || [])]
          .filter((c) => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setMyListings(merged);
        writeCache(`slite_listings_${uid}`, merged);
        precacheImages(merged);
        // Commission earned this month from sold listings (salesman earns commission, not vehicle gross)
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        supabase
          .from("car_listings")
          .select("commission_amount, selling_price, sold_at")
          .eq("dealer_id", uid)
          .eq("status", "sold")
          .gte("sold_at", monthStart)
          .then(({ data: soldThisMonth }) => {
            const rows = soldThisMonth || [];
            const revenue    = rows.reduce((s, l) => s + (Number(l.selling_price) || 0), 0);
            const commission = rows.reduce((s, l) => s + (Number(l.commission_amount) || 0), 0);
            setCommissionData({ total: commission, revenue, count: rows.length });
          });
      });

      // Analytics: call server-side RPC — Postgres aggregates, browser receives one row per car
      supabase.rpc("get_salesman_analytics", { p_dealer_id: uid })
        .then(({ data, error: evtsErr }) => {
          if (evtsErr) console.error("fetchAnalytics:", evtsErr);
          const map = {};
          (data || []).forEach(row => {
            map[row.car_id] = {
              views:    Number(row.views)     || 0,
              enquiries: Number(row.enquiries) || 0,
              daily:    [row.d0, row.d1, row.d2, row.d3, row.d4, row.d5, row.d6],
              waDaily:  [row.w0, row.w1, row.w2, row.w3, row.w4, row.w5, row.w6],
            };
          });
          setCarStatsMap(map);

          // Share-channel breakdown (which platform each view/enquiry came from),
          // scoped to this Lite salesman's own slug. Untagged/organic → 'direct'.
          // Pass p_car_ids: null => count ALL-TIME across every car ever tagged to
          // this slug, deduped by session. Previously this passed `Object.keys(map)`
          // — the cars from get_salesman_analytics's rolling 30-day window — so when
          // a car's last view aged past 30 days it dropped out of the set and took
          // all its historical "direct" views with it, making the count fall
          // day-over-day (the 67 -> 65 bug). A slug-scoped all-time count only grows.
          if (profileData.slug) {
            supabase
              .rpc("get_salesman_channel_breakdown", { p_car_ids: null, p_slug: profileData.slug })
              .then(({ data: chRows, error: chErr }) => {
                if (chErr) { console.error("fetchChannelBreakdown:", chErr); return; }
                const chMap = {};
                (chRows || []).forEach(r => {
                  (chMap[r.car_id] = chMap[r.car_id] || []).push({
                    channel:   r.channel || "direct",
                    views:     Number(r.views)     || 0,
                    enquiries: Number(r.enquiries) || 0,
                  });
                });
                setChannelMap(chMap);
              });

            // Mini-page footprints (page visits + card clicks) broken down by
            // the platform each visitor arrived through.
            supabase
              .rpc("get_salesman_minipage_stats", { p_slug: profileData.slug })
              .then(({ data: mpRows, error: mpErr }) => {
                if (mpErr) { console.error("fetchMinipageStats:", mpErr); return; }
                const rows = mpRows || [];
                setMinipageStats({
                  visits:     rows.reduce((s, r) => s + (Number(r.visits) || 0), 0),
                  cardClicks: rows.reduce((s, r) => s + (Number(r.card_clicks) || 0), 0),
                  byChannel:  rows,
                });
              });
          }
        });

      // fetch leads
      supabase
        .from("leads")
        .select("*, car_listings(brand, model, year, variant, selling_price, images, vin_number, mileage, transmission, fuel_type, plate_number, slug)")
        .eq("salesman_id", uid)
        .or("is_deleted.eq.false,is_deleted.is.null")
        .order("updated_at", { ascending: false })
        .then(({ data: lds, error: ldsErr }) => {
          if (ldsErr) console.error("fetchLeads:", ldsErr);
          const fetchedLeads = lds || [];
          setLeads(fetchedLeads);
          setLeadsLoading(false);
          writeCache(`slite_leads_${uid}`, redactLeadsForCache(fetchedLeads));

          // Which of these leads already have a paid add-on attached — feeds
          // the pipeline card badge (see leadIdsWithAddons).
          supabase
            .from("deal_products")
            .select("lead_id")
            .eq("dealer_id", getDealerIdFromProfile(profileData))
            .then(({ data: addonRows, error: addonErr }) => {
              if (addonErr) { console.error("fetchLeadAddonFlags:", addonErr); return; }
              setLeadIdsWithAddons(new Set((addonRows || []).map((r) => r.lead_id).filter(Boolean)));
            });

          // fetch enquiries after leads are settled to avoid race-condition overwrite
          supabase
            .from("whatsapp_enquiries")
            .select(
              "id, buyer_name, buyer_phone, buyer_message, status, created_at, updated_at, listing_id, car_listings(brand, model, year)",
            )
            .or(`dealer_id.eq.${uid},salesman_id.eq.${uid}`)
            .order("created_at", { ascending: false })
            .then(async ({ data: enqs, error: enqsErr }) => {
              if (enqsErr) console.error("fetchEnquiries:", enqsErr);
              const all = enqs || [];
              setEnquiries(all);
              writeCache(`slite_enquiries_${uid}`, all);
              const pending = all.filter((e) => e.status === "new");
              if (!pending.length) return;
              // Deduplicate within the batch first (phone+listing key) before any DB call
              const batchSeen = new Set();
              const dedupedPending = pending.filter((e) => {
                const key = `${normalizePhone(e.buyer_phone)}::${e.listing_id || ""}`;
                if (batchSeen.has(key)) return false;
                batchSeen.add(key);
                return true;
              });
              // Run conversions sequentially to avoid concurrent duplicate-check races
              const newLeads = [];
              for (const e of dedupedPending) {
                const enqPhone = normalizePhone(e.buyer_phone);
                if (!enqPhone && !e.listing_id) continue;
                if (enqPhone) {
                  // Dedup on normalized phone alone (a buyer is one lead per
                  // salesman regardless of which car they first enquired on).
                  const { data: existing, error: existingErr } = await supabase
                    .from("leads")
                    .select("id")
                    .eq("salesman_id", uid)
                    .eq("phone", enqPhone)
                    .limit(1);
                  if (existingErr) console.error("checkExistingLead:", existingErr);
                  if (existing && existing.length) continue;
                }
                const { data, error: insertLeadErr } = await supabase
                  .from("leads")
                  .insert({
                    salesman_id: uid,
                    dealer_id: null,
                    buyer_name: e.buyer_name || "Unknown",
                    phone: enqPhone,
                    notes: e.buyer_message || null,
                    car_listing_id: e.listing_id || null,
                    stage: "new",
                    lead_source: "enquiry",
                    is_deleted: false,
                  })
                  .select()
                  .single();
                if (insertLeadErr) console.error("insertLeadFromEnquiry:", insertLeadErr);
                if (data) newLeads.push(data);
              }
              if (newLeads.length) setLeads((p) => [...newLeads, ...p]);
              const ids = pending.map((e) => e.id);
              const { error: convertEnqErr } = await supabase
                .from("whatsapp_enquiries")
                .update({ status: "converted" })
                .in("id", ids);
              if (convertEnqErr) console.error("convertEnquiries:", convertEnqErr);
              setEnquiries((p) =>
                p.map((e) => (ids.includes(e.id) ? { ...e, status: "converted" } : e)),
              );
            });

          // shared enquiry INSERT handler — deduplicates across both filter channels
          const handleEnquiryInsert = async (row) => {
            setEnquiries((p) => p.find((e) => e.id === row.id) ? p : [row, ...p]);
            toast(t("salesmanLite.toast.newEnquiry"), { description: row.buyer_name || t("salesmanLite.toast.someoneEnquired") });
            if (!row.buyer_phone && !row.listing_id) return;
            const phone = normalizePhone(row.buyer_phone);
            if (phone) {
              const { data: dupLead } = await supabase.from("leads").select("id").eq("salesman_id", uid).eq("phone", phone).limit(1);
              if (!dupLead || !dupLead.length) {
                const { data: newLead, error: rtInsertErr } = await supabase.from("leads").insert({
                  salesman_id: uid, dealer_id: null,
                  buyer_name: row.buyer_name || null, phone,
                  notes: row.buyer_message || null, car_listing_id: row.listing_id || null,
                  stage: "new", lead_source: "enquiry", is_deleted: false,
                }).select().single();
                if (rtInsertErr) console.error("realtimeInsertLead:", rtInsertErr);
                if (newLead) setLeads((p) => [newLead, ...p]);
              }
            }
            const { error: rtConvertErr } = await supabase.from("whatsapp_enquiries").update({ status: "converted" }).eq("id", row.id);
            if (rtConvertErr) console.error("realtimeConvertEnquiry:", rtConvertErr);
            setEnquiries((p) => p.map((e) => e.id === row.id ? { ...e, status: "converted" } : e));
          };

          // freshChannel drops any stale channel still holding this topic. Without
          // that, a channel orphaned by an earlier mount (unmounted mid-bootstrap,
          // so the cleanup ran before channelRef was ever set) is handed back by
          // supabase.channel() already joined, and the first .on("postgres_changes")
          // throws "cannot add postgres_changes callbacks ... after subscribe()".
          if (channelRef.current) supabase.removeChannel(channelRef.current);
          if (!rtCancelledRef.current) {
          const liteChannel = freshChannel("salesman-lite-rt-" + uid)
            .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `salesman_id=eq.${uid}` },
              (payload) => {
                // Dedup the realtime echo: an optimistic insert (e.g.
                // autoUpsertLeadFromAppt) already added this lead WITH its joined
                // car_listings; the raw echo row has no join, so adding it again
                // rendered the same lead twice — once with a car, once without.
                // If we already hold it, merge (keep the richer joined fields).
                if (payload.eventType === "INSERT") setLeads((p) => p.some((l) => l.id === payload.new.id) ? p.map((l) => l.id === payload.new.id ? { ...payload.new, ...l } : l) : [payload.new, ...p]);
                if (payload.eventType === "UPDATE") setLeads((p) => p.map((l) => l.id === payload.new.id ? { ...l, ...payload.new } : l));
                if (payload.eventType === "DELETE") setLeads((p) => p.filter((l) => l.id !== payload.old.id));
              },
            )
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "salesman_notifications", filter: `salesman_id=eq.${uid}` },
              (payload) => {
                toast(payload.new.title, { description: payload.new.body });
                setNotifications((p) => [payload.new, ...p]);
              },
            )
            .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_enquiries", filter: `salesman_id=eq.${uid}` },
              async (payload) => {
                if (payload.eventType === "INSERT") await handleEnquiryInsert(payload.new);
                if (payload.eventType === "UPDATE") setEnquiries((p) => p.map((e) => e.id === payload.new.id ? { ...e, ...payload.new } : e));
              },
            )
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "car_listings", filter: `dealer_id=eq.${uid}` },
              (payload) => {
                setMyListings((p) => p.map((c) => c.id === payload.new.id ? { ...c, ...payload.new } : c));
                writeCache(`slite_listings_${uid}`, myListings.map((c) => c.id === payload.new.id ? { ...c, ...payload.new } : c));
                if (payload.new.status === "available" && payload.old?.status === "pending_approval") {
                  setFilterStatus("available");
                  toast.success(t("salesmanLite.toast.listingApproved"), { description: t("salesmanLite.toast.listingApprovedDesc", { car: `${payload.new.brand} ${payload.new.model}` }) });
                }
                if (payload.new.status === "rejected" && payload.old?.status === "pending_approval") {
                  setFilterStatus("rejected");
                  toast.error(t("salesmanLite.toast.listingRejected"), { description: t("salesmanLite.toast.listingRejectedDesc", { car: `${payload.new.brand} ${payload.new.model}` }) });
                }
              },
            )
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "car_listings", filter: `assigned_to=eq.${uid}` },
              (payload) => {
                setMyListings((p) => p.map((c) => c.id === payload.new.id ? { ...c, ...payload.new } : c));
              },
            )
            .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `salesman_id=eq.${uid}` },
              async (payload) => {
                if (payload.eventType === "INSERT") {
                  // Dedup: a seller-initiated booking is added optimistically, so
                  // guard against the realtime echo double-listing it.
                  setAppointments((p) => p.find((a) => a.id === payload.new.id) ? p : [payload.new, ...p]);
                  // Only a PENDING booking is a genuine inbound request to badge/
                  // announce — a confirmed one the seller just created themselves
                  // shouldn't fire "New booking!" or bump the Awaiting counter.
                  if (payload.new.status === "pending") {
                    toast(t("salesmanLite.toast.newBooking"), { description: payload.new.buyer_name || t("salesmanLite.toast.newAppointment") });
                  }
                  // NB: do NOT auto-create a pipeline lead here. A booking stays a
                  // pending request in the Bookings tab until the salesman confirms
                  // and contacts the buyer — only then (sendConfirmBooking ->
                  // autoUpsertLeadFromAppt) is the lead created at 'viewing_booked'.
                  // Creating it on the booking INSERT is what put a raw booking into
                  // both the Bookings tab and the pipeline at once.
                }
                if (payload.eventType === "UPDATE") setAppointments((p) => p.map((a) => a.id === payload.new.id ? { ...a, ...payload.new } : a));
              },
            );

          // Unmounted while this bootstrap chain was still running -> drop the
          // channel instead of joining one the cleanup can no longer reach.
          if (rtCancelledRef.current) {
            supabase.removeChannel(liteChannel);
          } else {
            channelRef.current = liteChannel;
            liteChannel.subscribe();
          }
          }
        });

      // fetch appointments
      supabase
        .from("appointments")
        .select("id, buyer_name, buyer_phone, appointment_date, status, notes, car_listing_id, created_at, remind_at, remind_sent, car_listings(id, brand, model, year, variant, selling_price, images, vin_number, plate_number, mileage, transmission, slug)")
        .eq("salesman_id", uid)
        .order("appointment_date", { ascending: false })
        .then(({ data: apts, error: aptsErr }) => {
          if (aptsErr) { console.error("fetchAppointments:", aptsErr); toast.error(t("salesmanLite.toast.bookingsLoadFailed")); return; }
          const appts = apts || [];
          setAppointments(appts);
          writeCache(`slite_appts_${uid}`, appts);
        });

      // fetch notifications
      supabase
        .from("salesman_notifications")
        // type + ref_id are what turn a row into a link to the thing it is
        // about. They were always on the table; not selecting them is why every
        // notification rendered as dead plain text.
        .select("id, type, ref_id, title, body, is_read, created_at")
        .eq("salesman_id", uid)
        .order("created_at", { ascending: false })
        .limit(30)
        .then(({ data: notifs }) => setNotifications(notifs || []));

      } catch (err) {
        console.error("SalesmanLite boot error:", err);
        setLoading(false);
        navigate("/login");
      }
    });

    // Watch for sign-out events only (token refresh is handled by getSession above)
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate("/login");
    });
    return () => authSub.unsubscribe();
    // Mount-once by design — `navigate` is only called imperatively in here
    // (login/role redirects), never reacted to. Depending on it was the real
    // cause of the first-run tour's "loops back to the language chooser"
    // bug: useNavigate() returns a NEW function identity on every route change
    // in this react-router-dom version, so with `[navigate]` this entire
    // ~470-line effect (session + profile fetch, tour-trigger check, listings/
    // leads/enquiries/appointments fetch) re-ran on EVERY switchTab() call —
    // including every step of the tour itself, since each step navigates to a
    // new tab. Re-running re-fetched the profile, saw onboarding_tour_done
    // still false (nothing marks it done until dismissTour()), and reset
    // tourStep back to 0 — mid-tour, every single step. Collapsing the
    // /salesman-lite routes into one (see App.jsx) fixed a real but separate
    // remount bug; it did not fix this one, since no remount is needed to
    // reset tourStep — just this effect re-running. Also means every tab
    // click, for every user, was silently re-fetching this entire payload
    // from scratch — this fix removes that too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      rtCancelledRef.current = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  // Dealer's commission rule — same source CarForm's "Suggested commission" reads,
  // via the canonical dealer-id resolver (must mirror getDealerIdFromProfile /
  // get_my_dealer_id() exactly — see CLAUDE.md; a hand-rolled dealerId here has
  // bitten this app twice before).
  useEffect(() => {
    const dealerId = getDealerIdFromProfile(profile);
    if (!dealerId) return;
    supabase.from("profiles").select("commission_config").eq("id", dealerId).maybeSingle()
      .then(({ data }) => setCommissionConfig(data?.commission_config || null));
  }, [profile?.id, profile?.dealer_id, profile?.role]);

  // Mirrors CarForm's "Suggested commission" formula exactly (flat / % of sale /
  // % of margin over base price), defaulting to 10% of margin like CarForm does
  // when no explicit commission_config row exists.
  const suggestedCommission = (car) => {
    const base = Number(car.base_price);
    const sell = Number(car.selling_price);
    const margin = !isNaN(base) && !isNaN(sell) && sell > base ? sell - base : null;
    const cfg = commissionConfig || { type: "percent_gross", value: 10 };
    if (cfg.type === "flat" && cfg.value > 0) return Math.round(cfg.value);
    if (cfg.type === "percent_sale" && !isNaN(sell) && sell > 0 && cfg.value > 0) return Math.round(sell * cfg.value / 100 / 50) * 50;
    if (margin && cfg.value > 0) return Math.round(margin * cfg.value / 100 / 50) * 50;
    return null;
  };

  // Auto-fill commission on any listing missing it — the manual "My commission"
  // box was the only way to set this, so unfilled boxes silently zeroed out
  // Monthly Goal / commission stats on real wins. Never touches a listing that
  // already has a value (including an intentional 0 — that's a real decision,
  // not a gap). Tracks processed ids so it fires once per listing, not on every
  // myListings state update.
  const commissionBackfilledRef = useRef(new Set());
  useEffect(() => {
    const toFill = myListings.filter(c => c.commission_amount == null && !commissionBackfilledRef.current.has(c.id));
    toFill.forEach(car => {
      commissionBackfilledRef.current.add(car.id);
      const suggested = suggestedCommission(car);
      if (suggested == null) return;
      supabase.from("car_listings").update({ commission_amount: suggested }).eq("id", car.id)
        .then(({ error }) => {
          if (error) return;
          setMyListings(prev => prev.map(c => c.id === car.id ? { ...c, commission_amount: suggested } : c));
        });
    });
  }, [myListings, commissionConfig]);

  // Live minute tick — keeps inbox "Xh Ym ago" / "in Xh Ym" labels current
  // without a reload. 60s cadence is enough for minute-granular display.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (tourStep === null) { setTourTarget(null); return; }
    // Index-aligned with TOUR_STEPS. Most steps switch to a tab and highlight that
    // same tab's nav anchor — but chat/services now live as quick-access buttons on
    // the Dashboard (not their own nav slot), and help now lives inside Settings, so
    // those three track a target id separate from the tab they switch to.
    const TOUR_ANCHORS = [
      null,
      { tab: "dashboard" },
      { tab: "listings" },
      { tab: "leads" },
      { tab: "enquiries" },
      { tab: "enquiries", targetId: "bookings", onSwitch: () => setInboxSubTab("bookings") },
      { tab: "performance" },
      { tab: "dashboard", targetId: "chat" },
      { tab: "dashboard", targetId: "services" },
      { tab: "settings" },
      { tab: "settings", targetId: "help" },
    ];
    const anchor = TOUR_ANCHORS[tourStep];
    if (!anchor) { setTourTarget(null); return; }
    switchTab(anchor.tab);
    anchor.onSwitch?.();
    // The bookings step highlights the actual Bookings sub-tab pill (data-tour-id
    // "bookings"), not the Enquiries nav again — so it visibly "opens" the booking
    // tab rather than pointing at the same sidebar item as the previous step. The
    // pill only mounts after the enquiries tab renders, so give it a touch longer.
    const targetId = anchor.targetId || anchor.tab;
    // Chat/services/help now sit inside the scrollable content area (dashboard
    // quick-access row, settings header) instead of the always-visible nav, so a
    // prior tab's scroll position can leave them off-screen — scroll them into
    // view before measuring, or the highlight ring (and the bubble anchored to it)
    // ends up pointing at a rect outside the viewport and reads as clipped.
    const measure = () => {
      const el = document.querySelector(`[data-tour-id="${targetId}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "auto" });
      setTourTarget(el.getBoundingClientRect());
    };
    const t = setTimeout(measure, targetId === "bookings" ? 140 : 80);
    return () => clearTimeout(t);
  }, [tourStep]);

  // Browser notification: fire when user returns to tab and has stale leads
  useEffect(() => {
    if (browserNotifPerm !== 'granted') return;
    const handler = async () => {
      if (document.hidden || staleLeads.length === 0) return;
      // Throttle: at most one follow-up notification per 24h per browser.
      // Without this the handler re-fires on EVERY visibilitychange (tab return,
      // phone unlock, in-app navigation), which Chrome flags as notification spam.
      const THROTTLE_MS = 24 * 60 * 60 * 1000;
      const last = Number(localStorage.getItem('slite_last_followup_notif') || 0);
      if (Date.now() - last < THROTTLE_MS) return;
      localStorage.setItem('slite_last_followup_notif', String(Date.now()));
      const names = staleLeads.slice(0, 3).map(l => l.buyer_name || 'Unknown').join(', ');
      const title = `${staleLeads.length} lead${staleLeads.length !== 1 ? 's' : ''} need follow-up`;
      const options = { body: names, tag: 'slite-followup' };
      try {
        // Pages controlled by a service worker (PWA) can't use `new Notification` —
        // it throws "Illegal constructor"; must go through the SW registration instead.
        const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
        if (reg && reg.showNotification) {
          reg.showNotification(title, options);
        } else {
          new Notification(title, options);
        }
      } catch {
        // notification not critical — ignore failures silently
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [browserNotifPerm, staleLeads]);

  const requestBrowserNotif = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setBrowserNotifPerm(perm);
    setNotifBannerDismissed(true);
    localStorage.setItem('slite_notif_banner_dismissed', '1');
  };

  const dismissNotifBanner = () => {
    setNotifBannerDismissed(true);
    localStorage.setItem('slite_notif_banner_dismissed', '1');
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("signOut:", error);
    navigate("/login");
  };

  // Danger Zone: soft-delete this account (reversible for 30 days). The
  // delete-account edge function flips the caller's own profile to
  // account_status='deleted' + is_active=false + deleted_at=now(); the cars and
  // public page hide immediately and a daily cron hard-purges after the grace
  // window. Sign out globally so no lingering session re-enters the panel.
  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account");
      if (error || (data && data.error)) {
        console.error("delete-account:", error || data?.error);
        toast.error(t("salesmanLite.dangerZone.deleteFailed"));
        setDeleting(false);
        return;
      }
      await supabase.auth.signOut({ scope: "global" });
      navigate("/login");
    } catch (e) {
      console.error("delete-account:", e);
      toast.error(t("salesmanLite.dangerZone.deleteFailed"));
      setDeleting(false);
    }
  };

  // Self-service restore within the grace window: clear the deletion flags on the
  // caller's own row, then hard-reload so every downstream fetch re-runs clean.
  const handleReactivate = async () => {
    if (!userId) return;
    setReactivating(true);
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: "active", is_active: true, deleted_at: null })
      .eq("id", userId);
    if (error) {
      console.error("reactivate:", error);
      toast.error(t("salesmanLite.deletedGate.reactivateFailed"));
      setReactivating(false);
      return;
    }
    window.location.reload();
  };

  // Lock body scroll while the delete-confirm modal is open (overlay rule 2).
  useEffect(() => {
    if (!deleteModalOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [deleteModalOpen]);

  const updateLeadStage = async (leadId, stage) => {
    setStageSavingId(leadId);
    const oldStage = leads.find((l) => l.id === leadId)?.stage ?? null;
    const dealerId = leads.find((l) => l.id === leadId)?.dealer_id ?? null;
    const { error: stageErr } = await supabase
      .from("leads")
      .update({ stage, updated_at: new Date().toISOString() })
      .eq("id", leadId);
    setStageSavingId(null);
    if (stageErr) {
      console.error("updateLeadStage:", stageErr);
      toast.error(t("salesmanLite.toast.stageUpdateFailed"));
      return;
    }
    const { error: actErr } = await supabase.from("lead_activities").insert({
      lead_id: leadId,
      activity_type: "stage_changed",
      from_stage: oldStage,
      to_stage: stage,
      created_by: userId,
      dealer_id: dealerId,
    });
    if (actErr) console.error("updateLeadStage activity:", actErr);
    setLeads((p) => p.map((l) => (l.id === leadId ? { ...l, stage } : l)));
  };

  const advanceLeadStage = (lead, newStage, force = false) => {
    if (!newStage) return;
    if (!force && lead.stage === "test_drive") { setTestDriveConfirm({ lead, nextStage: newStage }); return; }
    // Intercept won → show confirm modal instead of the undo-timer flow
    if (newStage === "won") {
      if (pendingStageRef.current[lead.id]) {
        clearTimeout(pendingStageRef.current[lead.id].timer);
        delete pendingStageRef.current[lead.id];
      }
      setWonPrompt({ lead });
      return;
    }
    // Intercept a seller-initiated move into the booking stage → ask for the
    // date/time up front, then create a CONFIRMED appointment (the seller set
    // it up, so it skips "Awaiting Confirmation" and lands in Confirmed
    // Upcoming). Organic bookings from the car page take the /api/booking path
    // (status 'pending') and never reach here, so they stay in Awaiting.
    if (newStage === "viewing_booked" && !force) {
      if (pendingStageRef.current[lead.id]) {
        clearTimeout(pendingStageRef.current[lead.id].timer);
        delete pendingStageRef.current[lead.id];
      }
      setSellerBookingDate(defaultBookingSlot());
      setSellerBookingLead(lead);
      return;
    }
    const oldStage = lead.stage;
    const leadId = lead.id;
    const buyerName = lead.buyer_name || "Lead";
    // cancel any in-flight pending change for this lead
    if (pendingStageRef.current[leadId]) {
      clearTimeout(pendingStageRef.current[leadId].timer);
    }
    // optimistic local update
    setLeads((p) => p.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l)));
    const timer = setTimeout(() => {
      delete pendingStageRef.current[leadId];
      updateLeadStage(leadId, newStage);
    }, 4500);
    pendingStageRef.current[leadId] = { timer, oldStage };
    toast(`${buyerName} → ${stageLabel(newStage)}`, {
      action: {
        label: t("salesmanLite.toast.undo"),
        onClick: () => {
          clearTimeout(pendingStageRef.current[leadId]?.timer);
          delete pendingStageRef.current[leadId];
          setLeads((p) => p.map((l) => (l.id === leadId ? { ...l, stage: oldStage } : l)));
        },
      },
      duration: 4500,
    });
  };

  const pingWA = (lead) => {
    const car = lead.car_listings;
    const carName = car ? `${car.brand} ${car.model}` : "kereta tu";
    const name = lead.buyer_name || "kawan";
    const defaultMsg = `Hi ${name}! Macam mana, still interested dalam ${carName} tu? Jom kita discuss lagi — saya boleh tolong cari yang terbaik untuk you 😊`;
    setWaModalLead(lead);
    setWaModalMessage(defaultMsg);
  };

  // A chat lead from a guest buyer starts with NO phone — they never gave one.
  // This puts the number on the record the moment they share it in the chat.
  // updated_at only: saving a number is not a contact event, and last_contacted_at
  // is what the follow-up lists run on.
  const saveLeadPhone = async (leadId) => {
    const digits = editPhoneVal.replace(/\D/g, "");
    if (digits.length < 9) { toast.error(t("salesmanLite.toast.phoneTooShort", { defaultValue: "That does not look like a full phone number" })); return; }
    setPhoneSavingId(leadId);
    // trg_leads_normalize_phone rewrites this to the 60xxxxxxxxx form on write,
    // so read the row back instead of trusting what was typed — de-dup and every
    // wa.me link downstream compare against the stored form.
    const { data, error } = await supabase
      .from("leads")
      .update({ phone: editPhoneVal.trim(), updated_at: new Date().toISOString() })
      .eq("id", leadId)
      .select("phone")
      .maybeSingle();
    setPhoneSavingId(null);
    if (error) { console.error("saveLeadPhone:", error); toast.error(t("salesmanLite.toast.phoneSaveFailed", { defaultValue: "Failed to save phone number" })); return; }
    const stored = data?.phone || editPhoneVal.trim();
    setLeads((p) => p.map((l) => (l.id === leadId ? { ...l, phone: stored } : l)));
    setEditPhoneLeadId(null);
  };

  const saveLeadNote = async (leadId) => {
    setNotesSavingId(leadId);
    const { error } = await supabase.from("leads").update({ notes: editNoteVal, updated_at: new Date().toISOString() }).eq("id", leadId);
    setNotesSavingId(null);
    if (error) { console.error("saveLeadNote:", error); toast.error(t("salesmanLite.toast.noteSaveFailed")); return; }
    const ts = new Date().toISOString();
    setLeads((p) => p.map((l) => l.id === leadId ? { ...l, notes: editNoteVal, updated_at: ts } : l));
    setEditingNoteId(null);
  };

  const fetchLeadActivities = async (leadId) => {
    if (leadActivities[leadId]) { setExpandedActivityLeadId(leadId); return; }
    setActivitiesLoadingId(leadId);
    const { data, error } = await supabase
      .from("lead_activities")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) console.error("fetchLeadActivities:", error);
    setLeadActivities((p) => ({ ...p, [leadId]: data || [] }));
    setActivitiesLoadingId(null);
    setExpandedActivityLeadId(leadId);
  };

  const logCall = async () => {
    if (!logCallLeadId) return;
    setCallSaving(true);
    const lead = leads.find((l) => l.id === logCallLeadId);
    const { error } = await supabase.from("lead_activities").insert({
      lead_id: logCallLeadId,
      activity_type: "called",
      note: `${callOutcome}${callNote ? ` — ${callNote}` : ""}`,
      created_by: userId,
      dealer_id: lead?.dealer_id ?? null,
    });
    if (error) { console.error("logCall:", error); toast.error(t("salesmanLite.toast.callLogFailed")); setCallSaving(false); return; }
    const { error: leadUpdErr } = await supabase.from("leads").update({ updated_at: new Date().toISOString(), last_call_outcome: callOutcome }).eq("id", logCallLeadId);
    if (leadUpdErr) console.error("logCall lead update:", leadUpdErr);
    setLeads((p) => p.map((l) => l.id === logCallLeadId ? { ...l, updated_at: new Date().toISOString(), last_call_outcome: callOutcome } : l));
    setLeadActivities((p) => { const n = { ...p }; delete n[logCallLeadId]; return n; });
    toast.success(t("salesmanLite.toast.callLogged"));
    setCallSaving(false);
    setLogCallLeadId(null);
    setCallNote("");
    setCallOutcome("answered");
  };

  const saveFollowUp = async (leadId, date) => {
    setFollowUpSaving(true);
    const { error } = await supabase.from("leads").update({ follow_up_at: date || null, updated_at: new Date().toISOString() }).eq("id", leadId);
    setFollowUpSaving(false);
    if (error) { console.error("saveFollowUp:", error); toast.error(t("salesmanLite.toast.reminderSaveFailed")); return; }
    setLeads((p) => p.map((l) => l.id === leadId ? { ...l, follow_up_at: date || null } : l));
    setFollowUpModalLead(null);
    toast.success(date ? t("salesmanLite.toast.followUpSet") : t("salesmanLite.toast.reminderCleared"));
  };

  const handleDeleteLead = async (leadId) => {
    setDeletingLeadId(leadId);
    const { error: delErr } = await supabase.from("leads").update({ is_deleted: true }).eq("id", leadId);
    setDeletingLeadId(null);
    if (delErr) {
      console.error("handleDeleteLead:", delErr);
      toast.error(t("salesmanLite.toast.leadDeleteFailed"));
      return;
    }
    setLeads((p) => p.filter((l) => l.id !== leadId));
    setDeleteConfirmId(null);
  };

  const handleLinkCar = async (leadId, carId) => {
    const { error: linkErr } = await supabase
      .from("leads")
      .update({ car_listing_id: carId, updated_at: new Date().toISOString() })
      .eq("id", leadId);
    if (linkErr) {
      console.error("handleLinkCar:", linkErr);
      toast.error(t("salesmanLite.toast.carLinkFailed"));
      return;
    }
    const car = myListings.find((c) => c.id === carId);
    setLeads((p) => p.map((l) =>
      l.id === leadId
        ? { ...l, car_listing_id: carId, car_listings: car
            ? { brand: car.brand, model: car.model, year: car.year, selling_price: car.selling_price }
            : l.car_listings }
        : l
    ));
    setLinkCarLeadId(null);
    toast.success(t("salesmanLite.toast.carLinked"));
  };

  const handleLostReason = async (leadId, reason) => {
    const lead = leads.find((l) => l.id === leadId);
    const oldStage = lead?.stage ?? null;
    const dealerId = lead?.dealer_id ?? null;
    const now = new Date().toISOString();
    setLostSavingId(leadId);
    const { error: lostErr } = await supabase
      .from("leads")
      .update({ stage: "lost", loss_reason: reason, updated_at: now })
      .eq("id", leadId);
    setLostSavingId(null);
    if (lostErr) {
      console.error("handleLostReason:", lostErr);
      toast.error(t("salesmanLite.toast.lostMarkFailed"));
      return;
    }
    const { error: lostActErr } = await supabase.from("lead_activities").insert({
      lead_id: leadId,
      activity_type: "stage_changed",
      from_stage: oldStage,
      to_stage: "lost",
      note: `Lost reason: ${reason}`,
      created_by: userId,
      dealer_id: dealerId,
    });
    if (lostActErr) console.error("handleLostReason activity:", lostActErr);
    setLeads((p) =>
      p.map((l) =>
        l.id === leadId
          ? { ...l, stage: "lost", loss_reason: reason, updated_at: now }
          : l,
      ),
    );
    setLostPromptId(null);
  };

  const refreshCommissionData = async () => {
    if (!userId) return;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data } = await supabase
      .from("car_listings")
      .select("commission_amount, selling_price, sold_at")
      .eq("dealer_id", userId)
      .eq("status", "sold")
      .gte("sold_at", monthStart);
    const rows = data || [];
    const revenue    = rows.reduce((s, l) => s + (Number(l.selling_price) || 0), 0);
    const commission = rows.reduce((s, l) => s + (Number(l.commission_amount) || 0), 0);
    setCommissionData({ total: commission, revenue, count: rows.length });
  };

  const handleMarkWon = async () => {
    if (!wonPrompt) return;
    const { lead } = wonPrompt;
    const leadId = lead.id;
    const dealerId = lead.dealer_id ?? null;
    const now = new Date().toISOString();
    setWonSaving(true);

    // 1. Mark lead as won
    const { error: leadErr } = await supabase
      .from("leads")
      .update({ stage: "won", updated_at: now })
      .eq("id", leadId);
    if (leadErr) {
      console.error("handleMarkWon lead:", leadErr);
      toast.error(t("salesmanLite.toast.wonMarkFailed"));
      setWonSaving(false);
      return;
    }

    // 2. Log activity
    const { error: actErr } = await supabase.from("lead_activities").insert({
      lead_id: leadId,
      activity_type: "stage_changed",
      from_stage: lead.stage,
      to_stage: "won",
      created_by: userId,
      dealer_id: dealerId,
    });
    if (actErr) console.error("handleMarkWon activity:", actErr);

    // 3. Mark linked car listing as sold
    if (lead.car_listing_id) {
      const { error: carErr } = await supabase
        .from("car_listings")
        .update({ status: "sold", sold_at: now })
        .eq("id", lead.car_listing_id);
      if (carErr) {
        console.error("handleMarkWon car listing:", carErr);
        toast.error(t("salesmanLite.toast.wonButSoldFailed"));
      } else {
        // Mark sold in place (not remove) — the Monthly Goal panel counts
        // myListings rows with status:'sold' + sold_at this calendar month;
        // filtering the row out here made every win invisible to that count
        // until the next full reload refetched it from the DB.
        setMyListings(p => p.map(c => c.id === lead.car_listing_id ? { ...c, status: "sold", sold_at: now } : c));
        await refreshCommissionData();
      }
    }

    // 4. Update local leads
    setLeads(p => p.map(l => l.id === leadId ? { ...l, stage: "won", updated_at: now } : l));

    setWonSaving(false);
    setWonPrompt(null);

    const car = lead.car_listings;
    const carLabel = car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : null;
    toast.success(carLabel ? t("salesmanLite.toast.wonWithCar", { car: carLabel }) : t("salesmanLite.toast.wonNoCar"));
    setShareWinPrompt({ kind: "deal", carLabel });
  };

  // ── notifications ──────────────────────────────────────────────────────────

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Rows the panel reports as actually seen on screen (see NotificationPanel).
  // Batched: one write per scroll burst, not one per row.
  const markNotifsSeen = async (ids) => {
    const fresh = ids.filter((id) => notifications.some((n) => n.id === id && !n.is_read));
    if (!fresh.length) return;
    setNotifications((p) => p.map((n) => (fresh.includes(n.id) ? { ...n, is_read: true } : n)));
    const { error: readErr } = await supabase
      .from("salesman_notifications")
      .update({ is_read: true })
      .in("id", fresh);
    // Put the dots back rather than leaving the badge lying about what is read.
    if (readErr) {
      console.error("markNotifsSeen:", readErr);
      setNotifications((p) => p.map((n) => (fresh.includes(n.id) ? { ...n, is_read: false } : n)));
    }
  };

  // A notification is about something that lives on a page. ref_id per type is
  // verified in NOTIF_TARGETS (NotificationPanel.jsx); anything without a target
  // (broadcasts) never reaches here because the panel doesn't make it clickable.
  const openNotif = (n) => {
    setNotifOpen(false);
    switch (n.type) {
      case "chat_message":
        // ref_id IS the thread id, so the sheet opens without a lookup.
        setChatSheet({ threadId: n.ref_id, buyerName: n.title || "Buyer" });
        break;
      case "new_booking":
      case "booking_unconfirmed":
        switchTab("enquiries");
        setInboxSubTab("bookings");
        break;
      case "new_enquiry":
        switchTab("enquiries");
        setInboxSubTab("enquiries");
        break;
      case "listing_approved":
      case "listing_rejected":
        switchTab("listings");
        break;
      default:
        break;
    }
  };

  const markAllNotifsRead = async () => {
    const ids = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    const { error: readAllErr } = await supabase
      .from("salesman_notifications")
      .update({ is_read: true })
      .in("id", ids);
    if (readAllErr) console.error("markAllNotifsRead:", readAllErr);
    setNotifications((p) => p.map((n) => ({ ...n, is_read: true })));
  };

  // ── enquiry templates ──────────────────────────────────────────────────────

  const buildTemplate = (enq, key) => {
    const car = enq.car_listings;
    const carName = car ? `${car.brand} ${car.model}` : "kereta tu";
    const name = enq.buyer_name || "kawan";
    const templates = {
      chat: `Hi ${name}! Saya tengok you ada enquiry pasal ${carName}. Boleh kita chat sekejap? Saya ada details lagi yang boleh share 😊`,
      test_drive: `Hi ${name}! Best tak kalau you cuba drive sendiri ${carName} tu dulu? Test drive free je — bila you free? 🚗`,
      budget: `Hi ${name}! Thanks for your interest in ${carName}. Boleh tahu budget range you macam mana? Saya try cari yang paling sesuai untuk you 💪`,
      deposit: `Hi ${name}! Just to update, ada beberapa orang interested dalam ${carName} ni. Kalau nak reserve, boleh deposit kecik dulu — kereta terus hold untuk you 🔒`,
    };
    return templates[key] || "";
  };

  const fireTemplate = async (enq, key) => {
    const msg = buildTemplate(enq, key);
    navigator.clipboard.writeText(msg).catch((e) => { console.error("clipboard write:", e); });
    setTemplateToast(enq.id + "_" + key);
    setTimeout(() => setTemplateToast(null), 2000);
    setOpenTemplateId(null);
    // Persist first, WhatsApp hand-off last — navigating the current tab to
    // WhatsApp can suspend the page before pending writes finish.
    if (enq.status === "new") {
      await supabase.from("whatsapp_enquiries").update({ status: "responded" }).eq("id", enq.id);
      setEnquiries((p) => p.map((e) => e.id === enq.id ? { ...e, status: "responded" } : e));
      await autoCreateLeadFromEnq(enq);
    }
    const phone = (enq.buyer_phone || "").replace(/\D/g, "");
    if (phone) {
      window.location.href = `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${encodeURIComponent(msg)}`;
    }
  };

  // ── appointment status ─────────────────────────────────────────────────────

  const updateApptStatus = async (apptId, status) => {
    const { error: apptErr } = await supabase.from("appointments").update({ status }).eq("id", apptId);
    if (apptErr) {
      console.error("updateApptStatus:", apptErr);
      toast.error(t("salesmanLite.toast.appointmentUpdateFailed"));
      return;
    }
    setAppointments((p) => p.map((a) => (a.id === apptId ? { ...a, status } : a)));
  };

  const scheduleAptReminder = async (apt) => {
    if (!apt.appointment_date) return;
    const remindAt = new Date(new Date(apt.appointment_date).getTime() - 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("appointments").update({ remind_at: remindAt, remind_sent: false }).eq("id", apt.id);
    if (error) { console.error("scheduleAptReminder:", error); toast.error(t("salesmanLite.toast.reminderSetFailed")); return; }
    setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, remind_at: remindAt, remind_sent: false } : a));
  };

  const autoUpsertLeadFromAppt = async (apt) => {
    const phone = normalizePhone(apt.buyer_phone);
    // Prefer the lead this booking is already tied to. Falling straight to a
    // phone match picks only the single newest lead with that number, so a
    // duplicate (e.g. an old "won" sibling) could be returned and left alone —
    // silently skipping the advance and leaving the real booking out of Booked.
    let existing = null;
    if (apt.lead_id) {
      const { data: linked } = await supabase
        .from("leads").select("id, stage").eq("id", apt.lead_id).maybeSingle();
      if (linked) existing = linked;
    }
    if (!existing) {
      if (!phone) return;
      const { data: existingRows, error: lookErr } = await supabase
        .from("leads").select("id, stage, buyer_name").eq("salesman_id", userId).eq("phone", phone)
        .order("created_at", { ascending: false });
      if (lookErr) console.error("autoUpsertLeadFromAppt lookup:", lookErr);
      // Only adopt an existing lead when it unambiguously belongs to THIS
      // booking: a name match, or a single lead on that phone. Blindly taking
      // the newest lead with the number pulled an unrelated buyer (e.g. a
      // different "Ahmad" sharing a reused/test number) into Viewing Booked.
      // When it's ambiguous we fall through and create a fresh lead instead.
      const nameKey = (apt.buyer_name || "").trim().toLowerCase();
      existing =
        (nameKey && existingRows?.find((r) => (r.buyer_name || "").trim().toLowerCase() === nameKey)) ||
        (existingRows?.length === 1 ? existingRows[0] : null) ||
        null;
      // Tie the booking to the lead we adopted so a later confirm matches by id.
      if (existing && !apt.lead_id) {
        await supabase.from("appointments").update({ lead_id: existing.id }).eq("id", apt.id);
        setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, lead_id: existing.id } : a));
      }
    }
    const viewIdx = LEAD_STAGES.indexOf("viewing_booked");
    if (existing) {
      const curIdx = LEAD_STAGES.indexOf(existing.stage);
      // Advance a lead that's behind the booking stage into it. ALSO revive a
      // dead (lost) lead — the buyer just booked a fresh viewing, so it belongs
      // back in "Booked". A won lead is left alone (don't un-close a sale). This
      // was the silent gap: a lost buyer who re-booked never re-entered the
      // pipeline because lost sits AFTER viewing_booked in LEAD_STAGES.
      const revive = existing.stage === "lost" || existing.stage === "closed_lost";
      if (curIdx < viewIdx || revive) {
        const { error: updErr } = await supabase.from("leads")
          .update({ stage: "viewing_booked", updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (updErr) {
          console.error("autoUpsertLeadFromAppt advance:", updErr);
          toast.error(t("salesmanLite.toast.stageUpdateFailed"));
          return;
        }
        // The lead may not be in local state (a revived/terminal lead can be
        // filtered out of the board) — refetch it so it shows immediately.
        setLeads((p) => p.some((l) => l.id === existing.id)
          ? p.map((l) => l.id === existing.id ? { ...l, stage: "viewing_booked" } : l)
          : p);
        if (!leads.some((l) => l.id === existing.id)) {
          const { data: full } = await supabase.from("leads")
            .select("*, car_listings(id, brand, model, year, variant, selling_price, images, slug)")
            .eq("id", existing.id).single();
          if (full) setLeads((p) => p.some((l) => l.id === full.id) ? p.map((l) => l.id === full.id ? full : l) : [full, ...p]);
        }
        toast.success(t("salesmanLite.toast.movedToViewingBooked"));
      }
    } else {
      const { data: newLead, error: insErr } = await supabase.from("leads").insert({
        salesman_id: userId, dealer_id: null,
        buyer_name: apt.buyer_name || "Unknown", phone,
        car_listing_id: apt.car_listing_id || null,
        stage: "viewing_booked", lead_source: "manual", is_deleted: false,
      }).select("*, car_listings(id, brand, model, year, variant, selling_price, images, slug)").single();
      if (insErr) {
        console.error("autoUpsertLeadFromAppt insert:", insErr);
        toast.error(t("salesmanLite.toast.stageUpdateFailed"));
        return;
      }
      if (newLead) {
        // Upsert-by-id: if the realtime echo raced ahead and already added this
        // lead (as a join-less raw row), replace it with the richer joined row
        // instead of prepending a second card.
        setLeads((p) => p.some((l) => l.id === newLead.id) ? p.map((l) => l.id === newLead.id ? newLead : l) : [newLead, ...p]);
        toast.success(t("salesmanLite.toast.createdAtViewingBooked"));
        // Tie the booking to the lead it just created so a later confirm/advance
        // matches by id instead of re-inserting a duplicate off the phone.
        if (!apt.lead_id) {
          await supabase.from("appointments").update({ lead_id: newLead.id }).eq("id", apt.id);
          setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, lead_id: newLead.id } : a));
        }
      }
    }
  };

  // Prefilled (editable) confirmation message + modal opener. Component-scope so
  // BOTH the Bookings tab and the unconfirmed-booking cards surfaced in the
  // Booked pipeline stage open the exact same confirm flow (sendConfirmBooking).
  const buildConfirmBookingMsg = (apt) => {
    const car = apt.car_listings;
    const carName = car ? [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ") : "the car";
    const aptDate = apt.appointment_date ? new Date(apt.appointment_date) : null;
    const dateStr = aptDate ? aptDate.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" }) : "";
    const timeStr = aptDate ? aptDate.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }) : "";
    const when = dateStr ? ` on ${dateStr}${timeStr ? ` at ${timeStr}` : ""}` : "";
    return `Hi ${apt.buyer_name || ""}! Your viewing for the ${carName} is confirmed${when}. See you then! Let me know if anything changes. 😊`;
  };
  const openConfirmBookingModal = (apt) => {
    setConfirmBookingMsg(buildConfirmBookingMsg(apt));
    setConfirmBookingApt(apt);
  };

  // Confirm-booking modal "Send" — persist the confirm + lead advance FIRST,
  // then hand off to WhatsApp. WhatsApp-first backgrounds the page on mobile
  // before the writes fire, which left confirmed bookings out of the Booked
  // pipeline stage. Navigating the current tab (instead of opening a new one)
  // hands off straight to the WhatsApp app on mobile instead of surfacing a
  // WhatsApp Web tab.
  const sendConfirmBooking = async () => {
    const apt = confirmBookingApt;
    if (!apt || !apt.buyer_phone) return;
    const phone = apt.buyer_phone.replace(/\D/g, "");
    const waPhone = phone.startsWith("6") ? phone : "6" + phone;
    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(confirmBookingMsg)}`;
    setConfirmBookingApt(null);
    setConfirmBookingMsg("");
    await updateApptStatus(apt.id, "confirmed");
    await autoUpsertLeadFromAppt(apt);
    scheduleAptReminder(apt);
    toast.success(t("salesmanLite.toast.bookingConfirmed"));
    window.location.href = waUrl;
  };

  // Confirm-booking modal "Move to Pipeline" — confirms the booking and
  // advances the lead without sending a WhatsApp message, for when the
  // salesman has already reached the buyer another way.
  const moveConfirmBookingToPipeline = async () => {
    const apt = confirmBookingApt;
    if (!apt) return;
    setConfirmBookingApt(null);
    setConfirmBookingMsg("");
    await updateApptStatus(apt.id, "confirmed");
    await autoUpsertLeadFromAppt(apt);
    scheduleAptReminder(apt);
    toast.success(t("salesmanLite.toast.bookingConfirmed"));
  };

  // Default seller-booking slot: tomorrow 11:00, formatted for datetime-local.
  const defaultBookingSlot = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(11, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Confirm a seller-initiated booking: move the lead into the booking stage AND
  // create a CONFIRMED appointment at the chosen slot so it shows in the
  // Bookings tab under Confirmed Upcoming. Optimistic add is de-duplicated by
  // the appointments realtime handler (guards on id).
  const confirmSellerBooking = async () => {
    const lead = sellerBookingLead;
    if (!lead || !sellerBookingDate) return;
    const dt = new Date(sellerBookingDate);
    if (isNaN(dt.getTime())) { toast.error(t("salesmanLite.toast.pickValidDateTime")); return; }
    setSellerBookingSaving(true);
    // Move the lead into the booking stage (writes leads.stage + activity).
    await updateLeadStage(lead.id, "viewing_booked");
    const remindAt = new Date(dt.getTime() - 60 * 60 * 1000).toISOString();
    const { data: apptRow, error: apptErr } = await supabase
      .from("appointments")
      .insert({
        salesman_id: userId,
        dealer_id: lead.dealer_id ?? null,
        lead_id: lead.id,
        car_listing_id: lead.car_listing_id ?? null,
        buyer_name: lead.buyer_name ?? null,
        buyer_phone: lead.phone ?? null,
        appointment_date: dt.toISOString(),
        booking_type: "viewing",
        status: "confirmed",
        remind_at: remindAt,
        remind_sent: false,
      })
      .select("id, buyer_name, buyer_phone, appointment_date, status, notes, car_listing_id, created_at, remind_at, remind_sent, car_listings(id, brand, model, year, variant, selling_price, images, vin_number, plate_number, mileage, transmission, slug)")
      .single();
    setSellerBookingSaving(false);
    if (apptErr) { console.error("confirmSellerBooking:", apptErr); toast.error(t("salesmanLite.toast.bookingCreateFailed")); return; }
    if (apptRow) setAppointments((p) => p.find((a) => a.id === apptRow.id) ? p : [apptRow, ...p]);
    setSellerBookingLead(null);
    setSellerBookingDate("");
    toast.success(t("salesmanLite.toast.bookingConfirmedFor", { when: dt.toLocaleDateString(i18n.language === "ms" ? "ms-MY" : "en-MY", { weekday: "short", day: "numeric", month: "short" }) + " " + dt.toLocaleTimeString(i18n.language === "ms" ? "ms-MY" : "en-MY", { hour: "2-digit", minute: "2-digit" }) }));
  };

  const autoCreateLeadFromEnq = async (enq) => {
    const phone = normalizePhone(enq.buyer_phone);
    if (!phone) return;
    const { data: existingRows } = await supabase
      .from("leads").select("id").eq("salesman_id", userId).eq("phone", phone).limit(1);
    if (!existingRows || !existingRows.length) {
      const { data: newLead } = await supabase.from("leads").insert({
        salesman_id: userId, dealer_id: null,
        buyer_name: enq.buyer_name || "Unknown", phone,
        notes: enq.buyer_message || null, car_listing_id: enq.listing_id || null,
        stage: "new", lead_source: "enquiry", is_deleted: false,
      }).select().single();
      if (newLead) setLeads((p) => [newLead, ...p]);
    }
  };

  const handleAddLead = async () => {
    setAddLeadSaving(true);
    const { data, error: addLeadErr } = await supabase
      .from("leads")
      .insert({
        dealer_id: null,
        salesman_id: userId,
        assigned_to: userId,
        buyer_name: addLeadForm.buyer_name,
        phone: normalizePhone(addLeadForm.phone),
        notes: addLeadForm.notes,
        car_listing_id: addLeadForm.car_listing_id || null,
        stage: "new",
        lead_source: "manual",
        is_deleted: false,
        loss_reason: null,
        buyer_state: addLeadForm.buyer_state || null,
      })
      .select()
      .single();
    if (addLeadErr) {
      console.error("handleAddLead:", addLeadErr);
      toast.error(t("salesmanLite.toast.addLeadFailed"));
      setAddLeadSaving(false);
      return;
    }
    if (data) {
      const linkedCar = data.car_listing_id ? myListings.find((c) => c.id === data.car_listing_id) : null;
      const enriched = linkedCar
        ? { ...data, car_listings: { brand: linkedCar.brand, model: linkedCar.model, year: linkedCar.year, selling_price: linkedCar.selling_price } }
        : data;
      setLeads((p) => [enriched, ...p]);
    }
    setAddLeadSaving(false);
    setShowAddLead(false);
    setAddLeadForm({
      buyer_name: "",
      phone: "",
      notes: "",
      car_listing_id: "",
      stage: "new",
      buyer_state: "",
    });
  };

  const handleListingCopy = (car, type) => {
    const link = `https://xdrive.my/showroom/${car.slug}?ref=${profile?.slug || ""}`;
    let text = link;
    if (type === "wa") {
      // Full-length, structured listing copy — same rich formatter the CarForm
      // final step uses (specs, pricing, features, about, hashtags) — with the
      // salesman's referral link appended so buyer taps come back to this rep.
      text = `${buildCopyText(car)}\n👉 ${link}`;
    }
    navigator.clipboard.writeText(text);
    setListingCopied((prev) => ({ ...prev, [car.id]: type }));
    setTimeout(
      () => setListingCopied((prev) => ({ ...prev, [car.id]: null })),
      1500,
    );
  };

  // ── TABS ──────────────────────────────────────────────────────────────────

  // Pending bookings the salesman hasn't confirmed yet — a real inbound request
  // sitting in the Bookings tab. Derived from live appointment state (not the
  // session-only newBookingsCount, which resets to 0 on reload) so the Inbox
  // badge reflects DB truth across reloads, exactly like the Leads badge does.
  const pendingBookingsCount = appointments.filter((a) => a.status === "pending").length;

  const TABS_DESKTOP = [
    {
      tab: "dashboard",
      label: t("salesmanLite.tabs.dashboard"),
      icon: <LayoutGrid style={{ width: 14, height: 14 }} />,
    },
    {
      tab: "listings",
      label: t("salesmanLite.tabs.listings"),
      icon: <Car style={{ width: 14, height: 14 }} />,
      badge: myListings.length || null,
    },
    {
      tab: "leads",
      label: t("salesmanLite.tabs.leads"),
      icon: <User style={{ width: 14, height: 14 }} />,
      badge: leads.filter((l) => l.stage !== "lost").length || null,
    },
    {
      tab: "enquiries",
      label: t("salesmanLite.tabs.inbox"),
      icon: <MessageSquare style={{ width: 14, height: 14 }} />,
      badge: (enquiries.filter((e) => e.status === "new").length + pendingBookingsCount) || null,
    },
    {
      tab: "performance",
      label: t("salesmanLite.tabs.performance"),
      icon: <BarChart2 style={{ width: 14, height: 14 }} />,
    },
    {
      tab: "settings",
      label: t("salesmanLite.tabs.settings"),
      icon: <Settings style={{ width: 14, height: 14 }} />,
    },
  ];

  const TABS_MOBILE = [
    { tab: "dashboard", label: t("salesmanLite.tabs.dashboard"), icon: <LayoutGrid size={18} /> },
    {
      tab: "listings",
      label: t("salesmanLite.tabs.listingsMobile"),
      icon: <Car size={18} />,
      badge: myListings.length || null,
    },
    {
      tab: "leads",
      label: t("salesmanLite.tabs.leads"),
      icon: <User size={18} />,
      badge: leads.filter((l) => l.stage !== "lost").length || null,
    },
    {
      tab: "enquiries",
      label: t("salesmanLite.tabs.inbox"),
      icon: <MessageSquare size={18} />,
      badge: (enquiries.filter((e) => e.status === "new").length + pendingBookingsCount) || null,
    },
    { tab: "performance", label: t("salesmanLite.tabs.performanceMobile"), icon: <BarChart2 size={18} /> },
    { tab: "settings", label: t("salesmanLite.tabs.settings"), icon: <Settings size={18} /> },
  ];

  // ── NOTIFICATION PANEL ────────────────────────────────────────────────────

  // Markup lives in the shared component (Premium renders the same one). This
  // page only owns where each notification goes.
  const renderNotifPanel = () =>
    notifOpen && (
      <NotificationPanel
        notifications={notifications}
        unreadCount={unreadCount}
        isMobile={isMobile}
        timeAgo={timeAgo}
        onSeen={markNotifsSeen}
        onMarkAllRead={markAllNotifsRead}
        onOpen={openNotif}
        onClose={() => setNotifOpen(false)}
      />
    );

  // ── Memoised dashboard analytics (avoids recompute on every render) ─────────
  const listingStats = useMemo(() => {
    const enqByListingId = new Map();
    for (const e of enquiries) {
      if (!e.listing_id) continue;
      enqByListingId.set(e.listing_id, (enqByListingId.get(e.listing_id) || 0) + 1);
    }
    return myListings.map((car) => {
      const stats   = carStatsMap[car.id] ?? {};
      const views   = stats.views     || 0;
      const waTaps  = stats.enquiries || 0;
      const enqCount = enqByListingId.get(car.id) || 0;
      const cvr = views > 0 ? (waTaps / views) * 100 : null;
      return { car, views, waTaps, enqCount, cvr };
    });
  }, [myListings, carStatsMap, enquiries]);

  const dashboardCVR = useMemo(() => {
    const vals = Object.values(carStatsMap);
    const totalViews   = vals.reduce((s, v) => s + (v.views     || 0), 0);
    const totalWATaps  = vals.reduce((s, v) => s + (v.enquiries || 0), 0);
    const overallCVR   = totalViews > 0 ? ((totalWATaps / totalViews) * 100).toFixed(1) : null;
    const bestCVRStat  = listingStats.reduce((best, s) => (s.cvr !== null && (best === null || s.cvr > best.cvr)) ? s : best, null);
    return { totalViews, totalWATaps, overallCVR, bestCVRStat };
  }, [carStatsMap, listingStats]);

  // ── RENDER DASHBOARD ──────────────────────────────────────────────────────

  // ── Listing completeness score ──────────────────────────────────────────
  const listingScore = (car) => {
    const checks = [
      { pts: 25, ok: Array.isArray(car.images) && car.images.length >= 3, hint: `${Math.max(0, 3 - (car.images?.length || 0))} more photo${Math.max(0, 3 - (car.images?.length || 0)) !== 1 ? "s" : ""}` },
      { pts: 15, ok: Array.isArray(car.images) && car.images.length >= 1, hint: "add a photo" },
      { pts: 15, ok: !!car.selling_price, hint: "set a price" },
      { pts: 10, ok: !!car.mileage, hint: "add mileage" },
      { pts: 10, ok: !!car.colour, hint: "add colour" },
      { pts: 10, ok: !!car.variant, hint: "add variant" },
      { pts: 10, ok: !!car.state, hint: "add location" },
      { pts: 5,  ok: !!car.condition, hint: "add condition" },
    ];
    const earned = checks.reduce((s, c) => s + (c.ok ? c.pts : 0), 0);
    const total   = checks.reduce((s, c) => s + c.pts, 0);
    const missing = checks.filter(c => !c.ok).map(c => c.hint);
    return { pct: Math.round((earned / total) * 100), missing };
  };

  // ── Profile completeness score ───────────────────────────────────────────
  const profileScore = () => {
    const checks = [
      { pts: 25, ok: !!(avatarUrl), label: "Add a profile photo", field: "avatar" },
      { pts: 25, ok: !!(profile?.whatsapp_number), label: "Add your WhatsApp number", field: "whatsapp_number" },
      { pts: 20, ok: !!(profile?.full_name), label: "Add your name", field: "full_name" },
      { pts: 15, ok: !!(profile?.about_text), label: "Write a short bio", field: "about_text" },
      { pts: 15, ok: !!(profile?.instagram || profile?.tiktok), label: "Link Instagram or TikTok", field: "instagram" },
    ];
    const earned = checks.reduce((s, c) => s + (c.ok ? c.pts : 0), 0);
    return { pct: earned, missing: checks.filter(c => !c.ok) };
  };

  const renderDashboard = () => {
    const activeLeads = leads.filter(
      (l) => l.stage !== "lost" && l.stage !== "closed_lost" && l.stage !== "closed_won" && l.stage !== "won",
    );
    // "Ditutup"/Closed KPI is documented (SalesmanLiteHelp) as leads marked won
    // OR lost THIS CALENDAR MONTH — it must not silently become an all-time count.
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const closedThisMonth = leads.filter((l) =>
      ["won", "closed_won", "lost", "closed_lost"].includes(l.stage) &&
      l.updated_at && new Date(l.updated_at) >= monthStart,
    );
    const todayAppts = appointments.filter((a) => {
      if (!a.appointment_date) return false;
      const d = new Date(a.appointment_date);
      if (isNaN(d)) return false;
      const today = new Date();
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).length;
    const { totalViews, totalWATaps, overallCVR, bestCVRStat } = dashboardCVR;
    const cvrColor = (cvr) => cvr >= 10 ? C.success : cvr >= 5 ? C.warn : C.danger;
    const perfCarName = (car) => [car.year, car.brand, car.model].filter(Boolean).join(" ");
    const isNewUser = myListings.length === 0 && leads.length === 0;

    const STEP_CIRCLE = (done) => {
      const hue = done ? C.success : C.accent;
      return {
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: T.size.base, fontWeight: T.weight.bold,
        background: withAlpha(hue, 0.14),
        border: `1px solid ${withAlpha(hue, 0.24)}`,
        color: done ? C.success : C.danger,
      };
    };

    // Pipeline-stage accent hues — used to colour-code the Follow-up rows so you
    // can see at a glance where each cold lead sits in the funnel.
    const stageHue = (s) => panelStageHue[s] || panelStageHue.fallback;

    // Today's agenda — grouped by urgency, dates keyed on the LOCAL calendar (not
    // UTC) so an early-morning appointment isn't bucketed into the wrong day.
    const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const todayKey = dayKey(new Date());
    const apptDay = (a) => a.appointment_date ? dayKey(new Date(a.appointment_date)) : null;
    const apptOpen = (s) => !["cancelled", "completed", "done", "no_show"].includes((s || "").toLowerCase());
    const fuKey = (v) => v ? (v.length <= 10 ? v.slice(0, 10) : dayKey(new Date(v))) : null;
    const agendaAppts = appointments.filter((a) => apptDay(a) === todayKey && apptOpen(a.status));
    // Missed = an appointment whose day is already past but was never closed out
    // (still pending/confirmed). These were previously invisible, which is why an
    // old appointment read as if it were "today".
    const missedAppts = appointments
      .filter((a) => { const k = apptDay(a); return k && k < todayKey && apptOpen(a.status); })
      .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
      .slice(0, 10);
    const agendaFollowUps = leads.filter((l) => fuKey(l.follow_up_at) === todayKey && !["won", "lost", "closed_won", "closed_lost"].includes(l.stage));
    const hasAgenda = agendaAppts.length > 0 || missedAppts.length > 0 || agendaFollowUps.length > 0;
    // Jump from an agenda row to its pipeline lead with the same red glow. Appointments
    // aren't joined to leads, so match by phone; fall back to the Bookings tab when
    // there's no lead yet (e.g. an unconfirmed booking).
    const goToLeadForAppt = (a) => {
      const ph = normalizePhone(a.buyer_phone);
      const lead = ph ? leads.find((l) => normalizePhone(l.phone) === ph) : null;
      if (lead) { setActiveTab("leads"); setMobileLeadStage(lead.stage); triggerGlow([lead.id]); }
      else { switchTab("enquiries"); setInboxSubTab("bookings"); }
    };

    // Goal panel data — commission earned this month (sum of commission_amount on sold listings)
    const soldThisMonth = myListings
      .filter(c => {
        if (c.status !== "sold" || !c.sold_at) return false;
        const d = new Date(c.sold_at);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
    const soldCountThisMonth = myListings.filter(c => {
      if (c.status !== "sold" || !c.sold_at) return false;
      const d = new Date(c.sold_at);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;

    // Previous-month commission — the Monthly Goal card only ever shows THIS
    // calendar month (by design — it resets with the month, same as the "Xd
    // left in <month>" label), which reads as a bug the moment a sale lands
    // near a month boundary. This feeds the "Previous month" popup so that
    // history is one tap away instead of just disappearing.
    const soldInMonth = (year, month) => myListings.filter(c => {
      if (c.status !== "sold" || !c.sold_at) return false;
      const d = new Date(c.sold_at);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const prevMonthDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const twoMonthsAgoDate = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1);
    const prevMonthSold = soldInMonth(prevMonthDate.getFullYear(), prevMonthDate.getMonth());
    const twoMonthsAgoSold = soldInMonth(twoMonthsAgoDate.getFullYear(), twoMonthsAgoDate.getMonth());
    const prevMonthCommission = prevMonthSold.reduce((s, c) => s + (Number(c.commission_amount) || 0), 0);
    const twoMonthsAgoCommission = twoMonthsAgoSold.reduce((s, c) => s + (Number(c.commission_amount) || 0), 0);
    const prevMonthTrendPct = twoMonthsAgoCommission > 0
      ? Math.round(((prevMonthCommission - twoMonthsAgoCommission) / twoMonthsAgoCommission) * 100)
      : (prevMonthCommission > 0 ? 100 : null);

    // Sales Overview sparkline — commission earned per day, trailing 14 days,
    // compared against the 14 days before that (rolling window, not calendar
    // month, so the trend line and % delta stay meaningful on day 1 of a month).
    const DAY_MS = 86400000;
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    // Local calendar date on both sides of the comparison. sold_at is a UTC
    // timestamp; deriving the day-key via `local midnight -> toISOString()`
    // converts back to UTC and silently shifts the date back a day for any
    // timezone ahead of UTC (e.g. MYT, UTC+8) — a same-day sale then never
    // matches its own key, the running total stays 0, and the whole card
    // (gated on trendTotal > 0) disappears. Using getFullYear/Month/Date on
    // both the generated key and the parsed sold_at keeps them in the same
    // (local) calendar, regardless of timezone.
    const toLocalDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const soldWithCommission = myListings.filter(c => c.status === "sold" && c.sold_at);
    const commissionOnDay = (dateKey) => soldWithCommission
      .filter(c => toLocalDateKey(new Date(c.sold_at)) === dateKey)
      .reduce((s, c) => s + (Number(c.commission_amount) || 0), 0);
    // Per-day commission (NOT cumulative). A cumulative line only ever climbs and
    // then sits flat at the top forever once a deal lands, which read as broken
    // ("stays flat on top"). Daily values spike on the day a deal is won and drop
    // back to baseline after — the line actually moves. trendTotal is summed
    // separately below so the ↑/↓ delta badge still reflects the 14-day total.
    const commissionTrend = Array.from({ length: 14 }, (_, i) => {
      const key = toLocalDateKey(new Date(todayMidnight.getTime() - (13 - i) * DAY_MS));
      return { d: key, val: commissionOnDay(key) };
    });
    const trendTotal = commissionTrend.reduce((s, p) => s + p.val, 0);
    const prevTrendTotal = Array.from({ length: 14 }, (_, i) =>
      commissionOnDay(toLocalDateKey(new Date(todayMidnight.getTime() - (27 - i) * DAY_MS))),
    ).reduce((s, v) => s + v, 0);
    const trendDelta = prevTrendTotal > 0
      ? Math.round(((trendTotal - prevTrendTotal) / prevTrendTotal) * 100)
      : (trendTotal > 0 ? 100 : null);
    const available = myListings.filter(c => c.status === "available");
    const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
    const pct = goal.target > 0 ? Math.min((soldThisMonth / goal.target) * 100, 100) : 0;
    // One source for the goal's state colour — the % badge, the progress bar and
    // the "smashed" line all read from it, so they can never disagree.
    const goalHue = pct >= 100 ? C.success : pct >= 60 ? C.info : C.danger;
    const goalHueText = pct >= 100 ? C.successText : pct >= 60 ? C.infoText : C.dangerText;
    const focusCar = goal.focusCarId ? myListings.find(c => c.id === goal.focusCarId && c.status === "available") : null;
    const scoreCar = (c) => {
      const s = carStatsMap[c?.id] || {};
      return (s.views || 0) * 2 + (s.enquiries || 0) * 5;
    };
    const autoFocus = !focusCar && available.length > 0
      ? available.reduce((best, c) => (scoreCar(c) > scoreCar(best) ? c : best), available[0])
      : null;
    const highlighted = focusCar || autoFocus;

    const greetingWord = (() => {
      const h = new Date().getHours();
      return h < 12 ? t("salesmanLite.greeting.morning") : h < 17 ? t("salesmanLite.greeting.afternoon") : t("salesmanLite.greeting.evening");
    })();
    const personalizedLine = isNewUser
      ? t("salesmanLite.dash.newUser")
      : isReturning
      ? (staleLeads.length > 0
          ? t("salesmanLite.dash.welcomeBack", { count: staleLeads.length })
          : t("salesmanLite.dash.welcomeBackClear"))
      : staleLeads.length > 0
      ? t("salesmanLite.dash.stale", { count: staleLeads.length })
      : todayAppts > 0
      ? t("salesmanLite.dash.today", { count: todayAppts })
      : activeLeads.length > 0
      ? t("salesmanLite.dash.motion", { count: activeLeads.length })
      : t("salesmanLite.dash.clear");

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Hero: greeting + live portfolio value ── */}
        <div style={{ ...CARD, position: "relative", overflow: "hidden", padding: isMobile ? "20px 18px" : "26px 28px", background: `linear-gradient(135deg, ${C.surface} 0%, ${C.surfaceRaised} 100%)` }}>
          <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${withAlpha(C.accent, 0.14)} 0%, transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: T.size.xl, fontWeight: T.weight.bold, color: C.text, letterSpacing: "-0.3px" }}>
                {greetingWord}, {profile?.full_name?.split(" ")[0] || "there"}.
              </p>
              <p style={{ margin: "5px 0 0", fontSize: T.size.base, color: C.textSec, maxWidth: 440 }}>
                {personalizedLine}
              </p>
            </div>
            {staleLeads.length > 0 && (
              <button
                onClick={() => {
                  // Jump straight to whichever stage actually has an overdue
                  // lead (mobile shows one stage at a time), then glow them
                  // so the eye lands on exactly which cards need attention.
                  const activeStageOrder = LEAD_STAGES.filter((s) => !["lost", "closed_lost", "closed_won"].includes(s));
                  const firstStaleStage = activeStageOrder.find((s) => staleLeads.some((l) => l.stage === s));
                  if (firstStaleStage) setMobileLeadStage(firstStaleStage);
                  switchTab("leads");
                  triggerGlow(staleLeads.map((l) => l.id));
                }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: R.pill, background: withAlpha(C.danger, 0.08), border: `1px solid ${withAlpha(C.danger, 0.18)}`, flexShrink: 0, cursor: "pointer", fontFamily: "inherit" }}
              >
                <Bell size={11} color={C.danger} strokeWidth={2.5} />
                <span style={{ fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.dangerText }}>{staleLeads.length} {t("salesmanLite.kpi.overdue")}</span>
              </button>
            )}
          </div>
          {/* Live snapshot merged into the hero — compact 30-day stats + the
              shareable mini-page link. Portfolio value removed (not actionable). */}
          {available.length > 0 && (
            <div style={{ position: "relative", marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 18 : 28, flexWrap: "wrap" }}>
                {[
                  { label: t("salesmanLite.dash.buyerViews"), value: totalViews || 0, color: C.text },
                  { label: t("salesmanLite.dash.pageVisits"), value: minipageStats.visits || 0, color: C.infoText },
                  { label: t("salesmanLite.dash.waTaps"), value: totalWATaps || 0, color: C.successText },
                  { label: t("salesmanLite.kpi.liveListings"), value: available.length, color: C.text },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ ...STAT, fontSize: isMobile ? T.size.stat : T.size.statLg, color }}>{value}</span>
                    <span style={EYEBROW}>{label}</span>
                  </div>
                ))}
                <span style={{ ...EYEBROW, display: "inline-flex", alignItems: "center", gap: 5, marginLeft: "auto", fontWeight: T.weight.normal }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.success }} />
                  {t("salesmanLite.dash.days30")}
                </span>
              </div>
              {profile?.slug && (
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                  <button
                    onClick={() => { navigator.clipboard.writeText(`https://xdrive.my/s/${profile.slug}`); toast.success(t("salesmanLite.toast.storeLinkCopied")); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px", minWidth: 0, fontSize: T.size.sm, padding: "9px 12px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, cursor: "pointer", fontWeight: T.weight.medium, fontFamily: "inherit" }}
                  >
                    <LinkIcon size={11} />
                    <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>xdrive.my/s/{profile.slug}</span>
                    <span style={{ fontSize: T.size.xs, color: C.textMuted, flexShrink: 0 }}>{t("salesmanLite.dash.copy")}</span>
                  </button>
                  <a
                    href={`/s/${profile.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("salesmanLite.dash.openMinipageTitle")}
                    style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px", minWidth: 0, fontSize: T.size.sm, padding: "9px 12px", borderRadius: R.md, background: withAlpha(C.info, 0.07), border: `1px solid ${withAlpha(C.info, 0.2)}`, color: C.infoText, textDecoration: "none", fontWeight: T.weight.semibold, fontFamily: "inherit" }}
                  >
                    <ExternalLink size={11} />
                    <span style={{ flex: 1 }}>{t("salesmanLite.dash.openMinipage")}</span>
                    <ChevronRight size={11} style={{ flexShrink: 0, opacity: 0.5 }} />
                  </a>
                  {/* Marketplace = the public XDrive homepage (all dealers'
                      listings), distinct from the agent's own mini-page above.
                      Kept neutral (not blue) so it doesn't compete with the
                      mini-page link for attention — this is a secondary jump-off. */}
                  <a
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("salesmanLite.dash.openMarketplaceTitle")}
                    style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 180px", minWidth: 0, fontSize: T.size.sm, padding: "9px 12px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, textDecoration: "none", fontWeight: T.weight.medium, fontFamily: "inherit" }}
                  >
                    <Store size={11} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("salesmanLite.dash.openMarketplace")}</span>
                    <ChevronRight size={11} style={{ flexShrink: 0, opacity: 0.5 }} />
                  </a>
                  {/* Per-platform share: each option tags the link with ?src=<channel>
                      so a click's origin is attributed reliably (not just guessed
                      from the in-app browser). Always points at the real xdrive.my
                      domain and carries ?ref so downstream car-page leads credit
                      this agent. */}
                  <ShareMenu
                    baseUrl={`https://xdrive.my/s/${profile.slug}`}
                    refSlug={profile.slug}
                    waCaption={(url) => `${t("salesmanLite.dash.shareMyListingsCaption")}:\n${url}`}
                    dark
                    label={t("salesmanLite.dash.share")}
                    style={{ flex: "1 1 120px", justifyContent: "center", padding: "9px 12px", fontSize: T.size.sm }}
                  />
                </div>
              )}
              {/* Where the mini-page footprints came from (Instagram / Facebook /
                  TikTok / WhatsApp / …), so the agent knows which channel works. */}
              {minipageStats.byChannel.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
                  <ChannelBreakdown
                    rows={minipageStats.byChannel.map((r) => ({ channel: r.channel, views: Number(r.visits) || 0, enquiries: Number(r.card_clicks) || 0 }))}
                    metric="views"
                    title={t("salesmanLite.dash.minipageTrafficBy")}
                    viewsLabel="visits"
                    enquiriesLabel="clicks"
                    compact
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat & Add-ons moved out of the footer/sidebar nav — they don't need a
            permanent nav slot, so they live here instead, one tap below the
            mini-page stats. Still reachable, just not competing for nav space. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <button
            data-tour-id="chat"
            onClick={() => switchTab("chat")}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: R.lg, background: C.surface, border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left", minWidth: 0 }}
          >
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: R.md, background: withAlpha(C.info, 0.1), color: C.infoText, flexShrink: 0 }}>
              <MessageCircle size={15} />
              {chatUnread ? <span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: C.danger, border: `1.5px solid ${C.surface}` }} /> : null}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("salesmanLite.tabs.chat")}</span>
            <ChevronRight size={13} style={{ flexShrink: 0, opacity: 0.4, color: C.textMuted }} />
          </button>
          <button
            data-tour-id="services"
            onClick={() => switchTab("services")}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: R.lg, background: C.surface, border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left", minWidth: 0 }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: R.md, background: withAlpha(C.success, 0.1), color: C.successText, flexShrink: 0 }}>
              <Package size={15} />
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t("salesmanLite.tabs.services", { defaultValue: "Services" })}</span>
            <ChevronRight size={13} style={{ flexShrink: 0, opacity: 0.4, color: C.textMuted }} />
          </button>
        </div>

        {/* Dashboard body — 2-up grid on desktop, single column on mobile.
            Per-card CSS `order` puts the KPI strip + My Performance first without
            moving them in source; the KPI strip spans both columns. */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 16, alignItems: "start" }}>

        {/* ── Follow-up Needed ── */}
        {staleLeads.length > 0 && (
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: R.sm, background: withAlpha(C.danger, 0.12), color: C.danger, flexShrink: 0 }}>
                  <Bell size={12} strokeWidth={2.5} />
                </span>
                <span>{t("salesmanLite.dash.followUpNeeded")}</span>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, borderRadius: R.pill, background: withAlpha(C.danger, 0.15), color: C.dangerText, fontSize: T.size.xs, fontWeight: T.weight.bold, padding: "0 5px" }}>{staleLeads.length}</span>
              </div>
              {staleLeads.some(l => l.phone) && (
                <button onClick={() => { setBatchWALeads(staleLeads.filter(l => l.phone)); setBatchWAIdx(0); }}
                  style={{ ...SOFT(C.success), fontSize: T.size.xs, padding: "4px 10px", borderRadius: R.sm, cursor: "pointer", fontWeight: T.weight.semibold, fontFamily: "inherit", textTransform: "none", letterSpacing: 0 }}>
                  {t("salesmanLite.dash.waAll")}
                </button>
              )}
            </div>
            <div>
              {staleLeads.slice(0, 8).map((lead, i, arr) => {
                const car = lead.car_listings;
                const daysSince = Math.floor((Date.now() - new Date(lead.updated_at)) / 86400000);
                const hue = stageHue(lead.stage);
                return (
                  <div
                    key={lead.id}
                    onClick={() => { setActiveTab("leads"); setMobileLeadStage(lead.stage); triggerGlow([lead.id]); }}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: ROW_LINE(i < arr.length - 1), background: withAlpha(hue, 0.07), cursor: "pointer" }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.fillStrong, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.textSec, flexShrink: 0 }}>
                      {(lead.buyer_name || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.buyer_name || "—"}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                        <span style={{ fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "1px 7px", borderRadius: R.sm, background: withAlpha(hue, 0.13), border: `1px solid ${withAlpha(hue, 0.33)}`, color: hue, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{stageLabel(lead.stage || "new")}</span>
                        <span style={{ fontSize: T.size.sm, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{car ? `${car.brand} ${car.model}` : t("salesmanLite.dash.noCar")}</span>
                      </div>
                    </div>
                    <span style={{ ...SOFT(C.dangerText), fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "3px 8px", borderRadius: R.pill, flexShrink: 0 }}>{daysSince}d ago</span>
                    {lead.phone && (
                      <button onClick={(e) => { e.stopPropagation(); pingWA(lead); }} style={{ ...SOFT(C.success), fontSize: T.size.sm, padding: "5px 12px", borderRadius: R.sm, cursor: "pointer", fontWeight: T.weight.semibold, flexShrink: 0, fontFamily: "inherit" }}>WA</button>
                    )}
                  </div>
                );
              })}
              {staleLeads.length > 8 && (
                <button
                  onClick={() => { setActiveTab("leads"); triggerGlow(staleLeads.map((l) => l.id)); }}
                  style={{ display: "block", width: "100%", textAlign: "center", padding: "10px 18px", fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.textSec, background: C.fillSubtle, border: "none", borderTop: `1px solid ${C.line}`, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {t("salesmanLite.dash.viewAllFollowUps", { defaultValue: `+${staleLeads.length - 8} more in pipeline`, count: staleLeads.length - 8 })}
                </button>
              )}
            </div>
            {!notifBannerDismissed && browserNotifPerm === 'default' && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderTop: `1px solid ${C.line}`, background: C.fillSubtle }}>
                <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted, flex: 1 }}>{t("salesmanLite.dash.notifyColdLeads")}</p>
                {/* Was indigo (#818cf8) — a fifth saturated hue on this screen that
                    carried no meaning of its own. Uses the shared info blue now. */}
                <button onClick={requestBrowserNotif} style={{ ...SOFT(C.infoText), fontSize: T.size.xs, padding: "4px 10px", borderRadius: R.sm, cursor: "pointer", fontWeight: T.weight.semibold, fontFamily: "inherit" }}>{t("salesmanLite.dash.enable")}</button>
                <button onClick={dismissNotifBanner} style={{ fontSize: T.size.lg, padding: "0 4px", background: "none", border: "none", color: C.textDim, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
            )}
          </div>
        )}

        {/* ── Today's Agenda ── */}
        {hasAgenda && (
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span>{t("salesmanLite.dash.todaysAgenda")}</span>
              <span>{new Date().toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })}</span>
            </div>
            <div style={{ padding: "6px 0" }}>
              {/* Missed — past appointments still open. Most urgent, shown first,
                  with the actual date so a last-week slot never reads as "today". */}
              {missedAppts.map((a) => (
                <div key={a.id} onClick={() => goToLeadForAppt(a)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: R.sm, background: withAlpha(C.danger, 0.12), color: C.danger, flexShrink: 0 }}>
                    <History size={13} strokeWidth={2.5} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.buyer_name || "—"}</p>
                    <p style={{ margin: 0, fontSize: T.size.sm, color: C.dangerText }}>{t("salesmanLite.dash.missedAppt", { defaultValue: "Missed appointment" })}{a.car_listings ? ` · ${a.car_listings.brand} ${a.car_listings.model}` : ""}</p>
                  </div>
                  <span style={{ fontSize: T.size.sm, color: C.dangerText, fontWeight: T.weight.semibold, flexShrink: 0 }}>{a.appointment_date ? new Date(a.appointment_date).toLocaleDateString("en-MY", { day: "numeric", month: "short" }) : "—"}</span>
                </div>
              ))}
              {/* Today's appointments */}
              {agendaAppts.map((a) => (
                <div key={a.id} onClick={() => goToLeadForAppt(a)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: R.sm, background: withAlpha(C.info, 0.12), color: C.info, flexShrink: 0 }}>
                    <Calendar size={13} strokeWidth={2.5} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.buyer_name || "—"}</p>
                    <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted }}>{t("salesmanLite.dash.testDrive")}{a.car_listings ? ` · ${a.car_listings.brand} ${a.car_listings.model}` : ""}</p>
                  </div>
                  <span style={{ fontSize: T.size.sm, color: C.infoText, fontWeight: T.weight.semibold, flexShrink: 0 }}>{a.appointment_date ? new Date(a.appointment_date).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                </div>
              ))}
              {/* Today's scheduled follow-ups */}
              {agendaFollowUps.map((l) => (
                <div key={l.id} onClick={() => { setActiveTab("leads"); setMobileLeadStage(l.stage); triggerGlow([l.id]); }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: R.sm, background: withAlpha(C.warn, 0.12), color: C.warn, flexShrink: 0 }}>
                    <Clock size={13} strokeWidth={2.5} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.buyer_name || "—"}</p>
                    <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted }}>{t("salesmanLite.dash.scheduledFollowUp")} · {l.car_listings ? `${l.car_listings.brand} ${l.car_listings.model}` : t("salesmanLite.dash.noCar")}</p>
                  </div>
                  <span style={{ fontSize: T.size.sm, color: C.warnText, fontWeight: T.weight.semibold, flexShrink: 0 }}>Today</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── My Performance (context, not action) — sits right below the KPI strip ── */}
        <div style={{ ...CARD, order: -1 }}>
          <div style={CARD_HEADER}>
            <span>{t("salesmanLite.dash.myPerformance")}</span>
            <span>{t("salesmanLite.dash.days30")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderBottom: `1px solid ${C.line}` }}>
            {[
              { label: t("salesmanLite.dash.views"), value: totalViews || 0 },
              { label: t("salesmanLite.dash.waTaps"), value: totalWATaps || 0 },
              { label: t("salesmanLite.dash.cvr"), value: overallCVR !== null ? `${overallCVR}%` : "—" },
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{ padding: "16px 18px", borderRight: i < arr.length - 1 ? `1px solid ${C.line}` : "none" }}>
                <p style={{ ...EYEBROW, margin: "0 0 4px" }}>{label}</p>
                <p style={{ ...STAT, margin: 0, fontSize: T.size.stat }}>{value}</p>
              </div>
            ))}
          </div>
          {listingStats.length > 0 && (
            <div>
              {[...listingStats].sort((a, b) => (b.cvr ?? -1) - (a.cvr ?? -1)).map(({ car, views, waTaps, cvr }, idx, arr) => {
                const isHot = views > 20 && cvr >= 10;
                const isWarm = !isHot && views > 5 && cvr >= 5;
                const img = car.images?.[0];
                return (
                  <div key={car.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: ROW_LINE(idx < arr.length - 1) }}>
                    {img ? (
                      <img src={img} alt="" style={{ width: 40, height: 40, borderRadius: R.md, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: R.md, background: C.fill, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Car size={16} color={C.textDim} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 2px", fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{perfCarName(car)}</p>
                      <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted }}>{views} view{views !== 1 ? "s" : ""} · {waTaps} WA tap{waTaps !== 1 ? "s" : ""}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ margin: "0 0 3px", fontSize: T.size.base, fontWeight: T.weight.bold, color: cvr !== null ? cvrColor(cvr) : C.textDim }}>
                        {cvr !== null ? `${cvr.toFixed(1)}%` : "—"}
                      </p>
                      {/* "TOP VIEWS"/"RISING" (ad performance), not "HOT"/"WARM" — those words
                          already mean buyer urgency on lead cards (red/amber there); reusing
                          them here in green/yellow for a different metric reads as contradictory. */}
                      {isHot && <span title="High views and click-through — one of your best-performing ads" style={{ ...SOFT(C.successText), fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "1px 5px", borderRadius: R.sm, whiteSpace: "nowrap" }}>TOP VIEWS</span>}
                      {isWarm && <span title="Views and click-through picking up" style={{ ...SOFT(C.warnText), fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "1px 5px", borderRadius: R.sm, whiteSpace: "nowrap" }}>RISING</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {listingStats.length === 0 && (
            <p style={{ margin: 0, padding: "16px 18px", fontSize: T.size.base, color: C.textMuted }}>No listing data yet — publish a car to start tracking.</p>
          )}
        </div>

        {/* ── KPI strip — separated stat tiles (spans full grid width, top) ── */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: 10, order: -2, gridColumn: "1 / -1" }}>
          {[
            { label: t("salesmanLite.kpi.pipeline"), value: activeLeads.length, accent: C.info, Icon: Users },
            { label: t("salesmanLite.kpi.liveListings"), value: myListings.filter(c => c.status === "available").length, accent: C.success, Icon: Car },
            { label: t("salesmanLite.kpi.followUps"), value: staleLeads.length, accent: staleLeads.length > 0 ? C.danger : C.textDim, Icon: Bell },
            { label: t("salesmanLite.kpi.todayAppts"), value: todayAppts, accent: C.info, Icon: Calendar },
            { label: t("salesmanLite.kpi.closed"), value: closedThisMonth.length, accent: C.success, Icon: CheckCircle },
          ].map(({ label, value, accent, Icon }) => (
            <div key={label} style={{ ...CARD, padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: R.sm, background: withAlpha(accent, 0.1), color: accent }}>
                <Icon size={13} strokeWidth={2.5} />
              </span>
              <p style={{ ...STAT, margin: 0, fontSize: T.size.stat }}>{value}</p>
              <p style={{ ...EYEBROW, margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* ── Goal ── */}
        <div style={CARD}>
            <div style={CARD_HEADER}>
              <span>{t("salesmanLite.dash.monthlyGoal")}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>{daysLeft}d left in {new Date().toLocaleDateString("en-MY",{month:"short"})}</span>
                <button
                  onClick={() => setShowPrevMonth(true)}
                  title="This card only tracks the current month — see history"
                  style={{ fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "3px 8px", borderRadius: R.pill, background: C.fill, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit", textTransform: "none", letterSpacing: 0 }}
                >
                  Previous month
                </button>
              </div>
            </div>
            <div style={{ padding: 18 }}>
              {goalEditing ? (
                <div>
                  <p style={{ margin: "0 0 10px", fontSize: T.size.sm, color: C.textMuted }}>{t("salesmanLite.goal.setTarget", { month: new Date().toLocaleDateString(i18n.language === "ms" ? "ms-MY" : "en-MY", { month: "long" }) })}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: T.size.base, color: C.textSec, fontWeight: T.weight.semibold }}>RM</span>
                    <input type="number" min="0" step="500" value={goalDraft} onChange={e => setGoalDraft(Number(e.target.value))}
                      style={{ width: 100, background: C.fillStrong, border: `1px solid ${C.borderStrong}`, borderRadius: R.sm, padding: "6px 10px", color: C.text, fontSize: T.size.lg, fontWeight: T.weight.bold, fontFamily: "inherit" }} autoFocus />
                    <button onClick={() => { saveGoal({ target: goalDraft }); setGoalEditing(false); }} style={{ fontSize: T.size.base, padding: "6px 14px", borderRadius: R.sm, background: C.accent, border: "none", color: C.onAccent, cursor: "pointer", fontWeight: T.weight.semibold, fontFamily: "inherit" }}>{t("salesmanLite.goal.save")}</button>
                    <button onClick={() => setGoalEditing(false)} style={{ fontSize: T.size.sm, padding: "6px 10px", borderRadius: R.sm, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{t("salesmanLite.goal.cancel")}</button>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: T.size.xs, color: C.textDim }}>{t("salesmanLite.goal.perCarHint")}</p>
                </div>
              ) : goal.target > 0 ? (
                <div>
                  {/* Commission earned + compact % badge (replaced the big ring) */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ ...EYEBROW, margin: "0 0 2px" }}>{t("salesmanLite.goal.commissionEarned")}</p>
                      <p style={{ ...STAT, margin: "0 0 2px", fontSize: T.size.hero }}>
                        RM {soldThisMonth.toLocaleString("en-MY")}
                      </p>
                      <p style={{ margin: 0, fontSize: T.size.sm, color: C.textMuted }}>{t("salesmanLite.goal.ofGoal", { target: goal.target.toLocaleString("en-MY"), count: soldCountThisMonth })}</p>
                    </div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: R.pill, fontSize: T.size.sm, fontWeight: T.weight.bold, flexShrink: 0,
                      background: withAlpha(goalHue, 0.12), color: goalHueText }}>
                      {Math.round(pct)}% {t("salesmanLite.goal.done")}
                    </span>
                  </div>
                  {/* Thin progress bar — the small "percentage to goal" visual that
                      replaced the oversized ring. */}
                  <div style={{ height: 5, borderRadius: R.pill, background: C.fillStrong, overflow: "hidden", margin: "10px 0 8px" }}>
                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: R.pill, background: goalHue, transition: "width 0.6s ease" }} />
                  </div>
                  {pct >= 100
                    ? <p style={{ margin: "0 0 10px", fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.successText }}>{t("salesmanLite.goal.smashed")}</p>
                    : <p style={{ margin: "0 0 10px", fontSize: T.size.sm, color: C.textMuted }}>{t("salesmanLite.goal.toGo", { amount: (goal.target - soldThisMonth).toLocaleString("en-MY"), left: daysLeft > 0 ? t("salesmanLite.goal.daysLeft", { count: daysLeft }) : t("salesmanLite.goal.lastDay") })}</p>
                  }
                  {/* Commission trendline — merged in from the old Sales Overview
                      card. Daily (per-day) values so it rises on a won day and drops
                      back after, instead of a cumulative line pinned to the top. */}
                  {trendTotal > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                        <p style={{ ...EYEBROW, margin: 0 }}>Commission — last 14 days</p>
                        {trendDelta !== null && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: R.pill, fontSize: T.size.xs, fontWeight: T.weight.bold,
                            background: withAlpha(trendDelta >= 0 ? C.success : C.danger, 0.12),
                            color: trendDelta >= 0 ? C.successText : C.dangerText }}>
                            {trendDelta >= 0 ? "↑" : "↓"} {Math.abs(trendDelta)}%
                          </span>
                        )}
                      </div>
                      <div style={{ height: 70, margin: "4px -8px -6px" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={commissionTrend} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
                            <defs>
                              <linearGradient id="sliteCommissionFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={C.accent} stopOpacity={0.35} />
                                <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="d" hide />
                            <RTooltip
                              cursor={{ stroke: C.borderStrong }}
                              contentStyle={{ background: C.surfaceRaised, border: `1px solid ${C.borderStrong}`, borderRadius: R.md, fontSize: T.size.sm }}
                              labelStyle={{ color: C.textSec }}
                              itemStyle={{ color: C.dangerText }}
                              labelFormatter={(v) => {
                                const [y, m, day] = v.split("-").map(Number);
                                return new Date(y, m - 1, day).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
                              }}
                              formatter={(v) => [`RM ${Number(v).toLocaleString("en-MY")}`, "Commission"]}
                            />
                            <Area type="monotone" dataKey="val" stroke={C.dangerText} strokeWidth={2} fill="url(#sliteCommissionFill)" dot={false} activeDot={{ r: 4, fill: C.dangerText }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  <button onClick={() => { setGoalDraft(goal.target); setGoalEditing(true); }} style={{ fontSize: T.size.xs, padding: "3px 10px", borderRadius: R.sm, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{t("salesmanLite.goal.editTarget")}</button>
                </div>
              ) : (
                <button onClick={() => { setGoalDraft(5000); setGoalEditing(true); }} style={{ width: "100%", padding: "14px", borderRadius: R.md, background: withAlpha(C.accent, 0.06), border: `1px dashed ${withAlpha(C.accent, 0.2)}`, color: C.danger, fontSize: T.size.base, fontWeight: T.weight.semibold, cursor: "pointer", fontFamily: "inherit" }}>
                  {t("salesmanLite.goal.setGoalCta")}
                </button>
              )}

              {/* Focus car */}
              {highlighted && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ ...EYEBROW, margin: 0 }}>
                      {focusCar ? <><Pin size={9} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }} />{t("salesmanLite.goal.pinned")}</> : <><Zap size={9} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }} />{t("salesmanLite.goal.bestToPush")}</>}
                    </p>
                    {focusCar && (
                      <button onClick={() => saveGoal({ focusCarId: null })} style={{ fontSize: T.size.xs, padding: "2px 7px", borderRadius: R.sm, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{t("salesmanLite.goal.unpin")}</button>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {highlighted.images?.[0] ? (
                      <img src={highlighted.images[0]} alt="" style={{ width: 52, height: 40, objectFit: "cover", borderRadius: R.md, flexShrink: 0, border: `1px solid ${C.line}` }} />
                    ) : (
                      <div style={{ width: 52, height: 40, borderRadius: R.md, background: C.fill, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Car size={18} color={C.textDim} /></div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[highlighted.year, highlighted.brand, highlighted.model].filter(Boolean).join(" ")}
                      </p>
                      <p style={{ margin: "1px 0 0", fontSize: T.size.sm, color: C.textSec, fontWeight: T.weight.semibold }}>
                        {highlighted.selling_price ? `RM ${Number(highlighted.selling_price).toLocaleString("en-MY")}` : "—"}
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => handleListingCopy(highlighted, "wa")} style={{ ...SOFT(C.success), fontSize: T.size.xs, padding: "4px 10px", borderRadius: R.sm, cursor: "pointer", fontFamily: "inherit", fontWeight: T.weight.semibold }}>WA</button>
                      {!focusCar && (
                        <button onClick={() => saveGoal({ focusCarId: highlighted.id })} style={{ fontSize: T.size.xs, padding: "4px 10px", borderRadius: R.sm, background: C.fill, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{t("salesmanLite.goal.pin")}</button>
                      )}
                    </div>
                  </div>
                  {available.length > 1 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                      {available.filter(c => c.id !== highlighted.id).slice(0, 4).map(c => (
                        <button key={c.id} onClick={() => saveGoal({ focusCarId: c.id })} style={{ fontSize: T.size.xs, padding: "3px 9px", borderRadius: R.sm, background: C.fillSubtle, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.brand} {c.model}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        {/* Earnings Target card removed — merged into the single Monthly Goal (commission) above */}

        {/* "This Month" commission-earned card removed — it duplicated the
           commission-earned figure already shown in the Monthly Goal panel
           above. Revenue/avg-per-deal live in the Performance tab. */}

        {/* ── Onboarding ── */}
        {isNewUser && !profile?.onboarding_tour_done && (
          <div style={{ ...CARD, border: `1px solid ${withAlpha(C.accent, 0.15)}` }}>
            <div style={CARD_HEADER}><span>{t("salesmanLite.dash.getStarted")}</span></div>
            <div style={{ padding: 18 }}>
              <p style={{ margin: "0 0 16px", fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text }}>{t("salesmanLite.checklist.intro")}</p>
              {[
                { num: 1, done: myListings.length > 0, title: t("salesmanLite.checklist.step1Title"), sub: t("salesmanLite.checklist.step1Sub"), ctaLabel: t("salesmanLite.checklist.step1Cta"), ctaAction: () => { switchTab("listings"); setTimeout(openAddListing, 100); }, locked: false },
                { num: 2, done: myListings.length > 0, title: t("salesmanLite.checklist.step2Title"), sub: t("salesmanLite.checklist.step2Sub"), ctaLabel: t("salesmanLite.checklist.step2Cta"), ctaAction: () => switchTab("listings"), locked: myListings.length === 0 },
                { num: 3, done: leads.length > 0, title: t("salesmanLite.checklist.step3Title"), sub: t("salesmanLite.checklist.step3Sub"), ctaLabel: t("salesmanLite.checklist.step3Cta"), ctaAction: () => switchTab("leads"), locked: myListings.length === 0 },
              ].map((step, idx) => (
                <div key={step.num}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: idx > 0 ? "14px 0 0" : "0" }}>
                    <div style={STEP_CIRCLE(step.done)}>{step.done ? "✓" : step.num}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text }}>{step.title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: T.size.sm, color: C.textMuted, lineHeight: 1.5 }}>{step.sub}</p>
                    </div>
                    {step.locked
                      ? <span style={{ fontSize: T.size.xs, color: C.textDim, flexShrink: 0, paddingTop: 3 }}>{t("salesmanLite.dash.step1First")}</span>
                      : <button onClick={step.ctaAction} style={{ ...SOFT(C.accent), color: C.danger, fontSize: T.size.sm, padding: "5px 12px", borderRadius: R.sm, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>{step.ctaLabel}</button>
                    }
                  </div>
                  {idx < 2 && <div style={{ height: 1, background: C.line, margin: "14px 0 0" }} />}
                </div>
              ))}
              <button onClick={dismissTour} style={{ marginTop: 16, background: "none", border: "none", color: C.textDim, fontSize: T.size.xs, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>{t("salesmanLite.dash.dismiss")}</button>
            </div>
          </div>
        )}
        </div>

        <PrevMonthModal
          open={showPrevMonth}
          onClose={() => setShowPrevMonth(false)}
          monthLabel={prevMonthDate.toLocaleDateString("en-MY", { month: "long", year: "numeric" })}
          commission={prevMonthCommission}
          count={prevMonthSold.length}
          trendPct={prevMonthTrendPct}
          trendLabel={twoMonthsAgoDate.toLocaleDateString("en-MY", { month: "short" })}
        />

      </div>
    );
  };

  // ── RENDER PERFORMANCE ────────────────────────────────────────────────────

  const renderPerformance = () => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const monthAgo = now - 30 * 86400000;

    // Stage classification
    const ACTIVE_STAGES = ["new","contacted","viewing_booked","test_drive","negotiating","deposit_taken"];
    const WON_STAGES = ["won","closed_won"];
    const LOST_STAGES = ["lost","closed_lost"];
    const FUNNEL_STAGES = ["new","contacted","viewing_booked","test_drive","negotiating","deposit_taken"];
    const FUNNEL_LABELS = { new: stageLabel("new"), contacted: stageLabel("contacted"), viewing_booked: stageLabel("viewing_booked"), test_drive: stageLabel("test_drive"), negotiating: stageLabel("negotiating"), deposit_taken: stageLabel("deposit_taken") };

    const allLeads = leads;
    const activeLeads = allLeads.filter(l => ACTIVE_STAGES.includes(l.stage));
    const wonLeads = allLeads.filter(l => WON_STAGES.includes(l.stage));
    const lostLeads = allLeads.filter(l => LOST_STAGES.includes(l.stage));
    const closedLeads = [...wonLeads, ...lostLeads];

    // Close rate
    const closeRate = closedLeads.length > 0 ? Math.round((wonLeads.length / closedLeads.length) * 100) : null;
    const overallRate = allLeads.length > 0 ? Math.round((wonLeads.length / allLeads.length) * 100) : null;

    // This month
    const monthWon = wonLeads.filter(l => new Date(l.updated_at) >= new Date(now - 30 * 86400000));
    const monthLeads = allLeads.filter(l => new Date(l.created_at) >= new Date(now - 30 * 86400000));
    const monthCloseRate = monthLeads.length > 0 ? Math.round((monthWon.length / monthLeads.length) * 100) : null;

    // This week
    const weekLeads = allLeads.filter(l => new Date(l.created_at).getTime() >= weekAgo);
    const weekWon = wonLeads.filter(l => new Date(l.updated_at).getTime() >= weekAgo);

    // Stale / follow-up
    const staleCount = staleLeads.length;
    const leadsFollowedUpThisWeek = activeLeads.filter(l => l.follow_up_at && new Date(l.follow_up_at).getTime() >= weekAgo).length;
    const leadsWithNoFollowUp = activeLeads.filter(l => !l.follow_up_at).length;

    // Avg days to close (won leads only, from created to updated)
    const closingTimes = wonLeads
      .filter(l => l.created_at && l.updated_at)
      .map(l => (new Date(l.updated_at) - new Date(l.created_at)) / 86400000);
    const avgDaysToClose = closingTimes.length > 0
      ? Math.round(closingTimes.reduce((a, b) => a + b, 0) / closingTimes.length)
      : null;

    // Lead source breakdown
    const sourceMap = {};
    allLeads.forEach(l => {
      const src = l.lead_source || "manual";
      if (!sourceMap[src]) sourceMap[src] = { total: 0, won: 0 };
      sourceMap[src].total++;
      if (WON_STAGES.includes(l.stage)) sourceMap[src].won++;
    });
    const sources = Object.entries(sourceMap).sort((a, b) => b[1].total - a[1].total);

    // Pipeline funnel counts
    const funnelCounts = FUNNEL_STAGES.map(s => ({
      stage: s,
      label: FUNNEL_LABELS[s],
      count: allLeads.filter(l => l.stage === s).length,
    }));
    const funnelMax = Math.max(...funnelCounts.map(f => f.count), 1);

    // Lead aging — active leads by days in pipeline
    const leadAging = activeLeads.map(l => ({
      id: l.id,
      name: l.buyer_name || "—",
      stage: l.stage,
      days: Math.floor((now - new Date(l.created_at).getTime()) / 86400000),
      car: l.car_listings,
    })).sort((a, b) => b.days - a.days);

    // WA activity proxy — leads updated in last 7 days (indicates contact)
    const contactedThisWeek = activeLeads.filter(l =>
      new Date(l.updated_at).getTime() >= weekAgo
    ).length;

    // Coaching nudges — rule-based
    const nudges = [];
    if (staleCount > 0) nudges.push({
      key: "stale",
      type: "warn",
      icon: <Clock size={14} />,
      title: t("salesmanLite.perf.nudgeStaleTitle", { count: staleCount }),
      body: t("salesmanLite.perf.nudgeStaleBody", { count: staleCount }),
      cta: t("salesmanLite.perf.nudgeGoToLeads"),
      ctaAction: () => setActiveTab("leads"),
    });
    if (leadsWithNoFollowUp > 2) nudges.push({
      key: "no_followup",
      type: "warn",
      icon: <Target size={14} />,
      title: t("salesmanLite.perf.nudgeNoFollowupTitle", { count: leadsWithNoFollowUp }),
      body: t("salesmanLite.perf.nudgeNoFollowupBody"),
      cta: t("salesmanLite.perf.nudgeSetFollowups"),
      ctaAction: () => setActiveTab("leads"),
    });
    if (contactedThisWeek === 0 && activeLeads.length > 0) nudges.push({
      key: "no_contact",
      type: "warn",
      icon: <Zap size={14} />,
      title: t("salesmanLite.perf.nudgeNoContactTitle"),
      body: t("salesmanLite.perf.nudgeNoContactBody", { count: activeLeads.length }),
      cta: t("salesmanLite.perf.nudgeContactLeads"),
      ctaAction: () => setActiveTab("leads"),
    });
    if (closeRate !== null && closeRate < 20 && closedLeads.length >= 3) nudges.push({
      key: "low_close",
      type: "tip",
      icon: <TrendingUp size={14} />,
      title: t("salesmanLite.perf.nudgeLowCloseTitle", { rate: closeRate }),
      body: t("salesmanLite.perf.nudgeLowCloseBody"),
      cta: null,
    });
    if (avgDaysToClose !== null && avgDaysToClose > 21) nudges.push({
      key: "slow_close",
      type: "tip",
      icon: <Clock size={14} />,
      title: t("salesmanLite.perf.nudgeSlowCloseTitle", { days: avgDaysToClose }),
      body: t("salesmanLite.perf.nudgeSlowCloseBody"),
      cta: null,
    });
    if (nudges.length === 0 && wonLeads.length > 0) nudges.push({
      key: "on_track",
      type: "good",
      icon: <Award size={14} />,
      title: t("salesmanLite.perf.nudgeOnTrackTitle"),
      body: t("salesmanLite.perf.nudgeOnTrackBody", { count: wonLeads.length, won: wonLeads.length, active: activeLeads.length }),
      cta: null,
    });

    const CARD = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" };
    const CARD_HEADER = {
      padding: "13px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
      fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    };
    const nudgeColor = { warn: { bg: "rgba(239,68,68,0.07)", border: "rgba(239,68,68,0.18)", icon: "#ef4444", title: "#f87171" }, tip: { bg: "rgba(59,130,246,0.07)", border: "rgba(59,130,246,0.18)", icon: "#3b82f6", title: "#93c5fd" }, good: { bg: "rgba(34,197,94,0.07)", border: "rgba(34,197,94,0.18)", icon: "#22c55e", title: "#86efac" } };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Header ── */}
        <div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.3px" }}>{t("salesmanLite.perf.header")}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#475569" }}>{t("salesmanLite.perf.headerSub")}</p>
        </div>

        {/* ── Coaching nudges (collapsed by default — tap a row to reveal) ── */}
        {nudges.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {nudges.map((n) => {
              const c = nudgeColor[n.type];
              const open = openNudgeKeys.has(n.key);
              return (
                <div key={n.key} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <button
                    onClick={() => toggleNudge(n.key)}
                    aria-expanded={open}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                  >
                    <span style={{ color: c.icon, flexShrink: 0, display: "flex" }}>{n.icon}</span>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: c.title, flex: 1, minWidth: 0 }}>{n.title}</p>
                    {open
                      ? <ChevronUp size={16} style={{ color: c.icon, flexShrink: 0 }} />
                      : <ChevronDown size={16} style={{ color: c.icon, flexShrink: 0 }} />}
                  </button>
                  {open && (
                    <div className="slite-nudge-reveal" style={{ padding: "0 14px 14px" }}>
                      <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>{n.body}</p>
                      {n.cta && (
                        <button onClick={n.ctaAction} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>{n.cta} →</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Close Rate ── */}
        <div style={CARD}>
          <div style={CARD_HEADER}>
            <span>{t("salesmanLite.perf.closeRate")}</span>
            <span>{t("salesmanLite.perf.allTime")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)" }}>
            {[
              { label: t("salesmanLite.perf.totalLeads"), value: allLeads.length, note: t("salesmanLite.perf.everCreated") },
              { label: t("salesmanLite.perf.closedWon"), value: wonLeads.length, note: t("salesmanLite.perf.dealsDone"), color: "#22c55e" },
              { label: t("salesmanLite.perf.closedLost"), value: lostLeads.length, note: t("salesmanLite.perf.didntConvert"), color: "#ef4444" },
              { label: t("salesmanLite.perf.closeRate"), value: closeRate !== null ? `${closeRate}%` : "—", note: t("salesmanLite.perf.closeRateFormula"), color: closeRate === null ? "#475569" : closeRate >= 40 ? "#22c55e" : closeRate >= 20 ? "#eab308" : "#ef4444" },
            ].map(({ label, value, note, color }, i, arr) => (
              <div key={label} style={{
                padding: "18px 20px",
                borderRight: !isMobile && i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                borderBottom: isMobile && i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}>
                <p style={{ margin: "0 0 4px", fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
                <p style={{ margin: "0 0 3px", fontSize: 26, fontWeight: 700, color: color || "#f1f5f9", letterSpacing: "-0.04em", lineHeight: 1 }}>{value ?? "—"}</p>
                <p style={{ margin: 0, fontSize: 10, color: "#374151" }}>{note}</p>
              </div>
            ))}
          </div>
          {/* This month strip */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{t("salesmanLite.perf.thisMonth")}</span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{t("salesmanLite.perf.newLeadsCount", { count: monthLeads.length })}</span>
            <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{t("salesmanLite.perf.wonCount", { count: monthWon.length })}</span>
            {monthCloseRate !== null && <span style={{ fontSize: 12, color: monthCloseRate >= 30 ? "#22c55e" : "#eab308", fontWeight: 700 }}>{t("salesmanLite.perf.closeRatePct", { count: monthCloseRate })}</span>}
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{t("salesmanLite.perf.leadsThisWeek", { count: weekLeads.length })}</span>
          </div>
        </div>

        {/* ── Pipeline Funnel ── */}
        <div style={CARD}>
          <div style={CARD_HEADER}>
            <span>{t("salesmanLite.perf.pipelineFunnel")}</span>
            <span>{t("salesmanLite.perf.activeCount", { count: activeLeads.length })}</span>
          </div>
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            {funnelCounts.map(({ stage, label, count }) => {
              const pct = funnelMax > 0 ? (count / funnelMax) * 100 : 0;
              const stageColors = { new: "#3b82f6", contacted: "#eab308", viewing_booked: "#a78bfa", test_drive: "#34d399", negotiating: "#fb923c", deposit_taken: "#22c55e" };
              const color = stageColors[stage] || "#94a3b8";
              return (
                <div key={stage} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <p style={{ margin: 0, fontSize: 11, color: "#475569", width: isMobile ? 76 : 100, flexShrink: 0, textAlign: "right" }}>{label}</p>
                  <div style={{ flex: 1, height: 22, background: "rgba(255,255,255,0.04)", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(pct, count > 0 ? 4 : 0)}%`, background: color, borderRadius: 6, opacity: 0.8, transition: "width 0.4s ease" }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: count > 0 ? "#f1f5f9" : "#374151", width: 24, textAlign: "right", flexShrink: 0 }}>{count}</p>
                </div>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ margin: 0, fontSize: 11, color: "#475569", width: isMobile ? 76 : 100, flexShrink: 0, textAlign: "right" }}>{t("salesmanLite.perf.won")}</p>
              <div style={{ flex: 1, height: 22, background: "rgba(34,197,94,0.08)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min((wonLeads.length / funnelMax) * 100, 100)}%`, background: "#22c55e", borderRadius: 6, transition: "width 0.4s ease" }} />
              </div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#22c55e", width: 24, textAlign: "right", flexShrink: 0 }}>{wonLeads.length}</p>
            </div>
          </div>
        </div>

        {/* ── Follow-up Habit ── */}
        <div style={CARD}>
          <div style={CARD_HEADER}>
            <span>{t("salesmanLite.perf.followUpHabits")}</span>
            <span>{t("salesmanLite.perf.days7")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)" }}>
            {[
              { label: t("salesmanLite.perf.activeLeads"), value: activeLeads.length, note: t("salesmanLite.perf.inPipelineNow") },
              { label: t("salesmanLite.perf.contactedThisWeek"), value: contactedThisWeek, note: t("salesmanLite.perf.leadsUpdated"), color: contactedThisWeek > 0 ? "#22c55e" : "#ef4444" },
              { label: t("salesmanLite.perf.noFollowUpSet"), value: leadsWithNoFollowUp, note: t("salesmanLite.perf.noDateScheduled"), color: leadsWithNoFollowUp > 0 ? "#ef4444" : "#22c55e" },
              { label: t("salesmanLite.perf.overdue"), value: staleCount, note: t("salesmanLite.perf.noContact48"), color: staleCount > 0 ? "#ef4444" : "#22c55e" },
            ].map(({ label, value, note, color }, i, arr) => (
              <div key={label} style={{
                padding: "16px 20px",
                borderRight: !isMobile && i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                borderBottom: isMobile && i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}>
                <p style={{ margin: "0 0 4px", fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
                <p style={{ margin: "0 0 3px", fontSize: 26, fontWeight: 700, color: color || "#f1f5f9", letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</p>
                <p style={{ margin: 0, fontSize: 10, color: "#374151" }}>{note}</p>
              </div>
            ))}
          </div>
          {activeLeads.length > 0 && contactedThisWeek === 0 && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 18px", background: "rgba(239,68,68,0.04)" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>{t("salesmanLite.perf.habitNone", { count: activeLeads.length })}</p>
            </div>
          )}
          {activeLeads.length > 0 && contactedThisWeek > 0 && contactedThisWeek < activeLeads.length && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 18px", background: "rgba(234,179,8,0.03)" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#eab308" }}>{t("salesmanLite.perf.habitSome", { done: contactedThisWeek, total: activeLeads.length })}</p>
            </div>
          )}
        </div>

        {/* ── Speed to Close ── */}
        {(avgDaysToClose !== null || wonLeads.length > 0) && (
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span>{t("salesmanLite.perf.speedConversion")}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)" }}>
              {[
                { label: t("salesmanLite.perf.avgDaysToClose"), value: avgDaysToClose !== null ? `${avgDaysToClose}d` : "—", note: avgDaysToClose !== null ? (avgDaysToClose <= 14 ? t("salesmanLite.perf.fastClose") : avgDaysToClose <= 30 ? t("salesmanLite.perf.normalPace") : t("salesmanLite.perf.urgencyTactics")) : t("salesmanLite.perf.closeMoreToSee"), color: avgDaysToClose === null ? "#475569" : avgDaysToClose <= 14 ? "#22c55e" : avgDaysToClose <= 30 ? "#eab308" : "#ef4444" },
                { label: t("salesmanLite.perf.dealsClosedTotal"), value: wonLeads.length, note: t("salesmanLite.perf.allTime"), color: wonLeads.length > 0 ? "#22c55e" : "#475569" },
                { label: t("salesmanLite.perf.activePipeline"), value: activeLeads.length, note: t("salesmanLite.perf.lostAllTime", { count: lostLeads.length }), color: "#3b82f6" },
              ].map(({ label, value, note, color }, i, arr) => (
                <div key={label} style={{ padding: "18px 20px", borderRight: !isMobile && i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", borderBottom: isMobile && i < 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
                  <p style={{ margin: "0 0 3px", fontSize: 26, fontWeight: 700, color, letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</p>
                  <p style={{ margin: 0, fontSize: 10, color: "#374151" }}>{note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Lead Source ── */}
        {sources.length > 0 && (
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span>{t("salesmanLite.perf.leadSources")}</span>
              <span>{t("salesmanLite.perf.whereFrom")}</span>
            </div>
            <div style={{ padding: "0" }}>
              {sources.map(([src, { total, won }], i) => {
                const srcRate = total > 0 ? Math.round((won / total) * 100) : 0;
                const srcLabels = { enquiry: t("salesmanLite.leads.srcEnquiry"), manual: t("salesmanLite.perf.srcManualAdd"), whatsapp: "WhatsApp", facebook: "Facebook", tiktok: "TikTok", referral: t("salesmanLite.leads.srcReferral"), other: t("salesmanLite.perf.srcOther") };
                return (
                  <div key={src} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderBottom: i < sources.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: i % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{srcLabels[src] || src}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", maxWidth: 120 }}>
                          <div style={{ height: "100%", width: `${srcRate}%`, background: srcRate >= 30 ? "#22c55e" : srcRate >= 15 ? "#eab308" : "#3b82f6", borderRadius: 99 }} />
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>{t("salesmanLite.perf.closeRatePct", { count: srcRate })}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{total}</p>
                      <p style={{ margin: 0, fontSize: 10, color: "#22c55e" }}>{t("salesmanLite.perf.wonCount", { count: won })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Traffic by platform (share-channel attribution) ── */}
        {Object.keys(channelMap).length > 0 && (
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span>{t("salesmanLite.perf.trafficSources")}</span>
              <span>{t("salesmanLite.perf.whichPlatform")}</span>
            </div>
            <div style={{ padding: "16px 18px" }}>
              <ChannelBreakdown rows={Object.values(channelMap).flat()} metric="views" title="" />
            </div>
          </div>
        )}

        {/* ── Lead Aging ── */}
        {leadAging.length > 0 && (
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span>{t("salesmanLite.perf.leadAging")}</span>
              <span>{t("salesmanLite.perf.oldestFirst")}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px 60px", padding: "8px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {[t("salesmanLite.perf.colLead"), t("salesmanLite.perf.colStage"), t("salesmanLite.perf.colInPipeline"), t("salesmanLite.perf.colAction")].map((h, i) => (
                <p key={h} style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: i > 0 ? "center" : "left" }}>{h}</p>
              ))}
            </div>
            {leadAging.slice(0, 8).map((l, idx) => {
              const stageC = STAGE_COLOR[l.stage] || { bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)", tx: "#94a3b8" };
              const ageColor = l.days > 21 ? "#ef4444" : l.days > 10 ? "#eab308" : "#94a3b8";
              return (
                <div key={idx} onClick={() => { setActiveTab("leads"); setMobileLeadStage(l.stage); triggerGlow([l.id]); }} style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px 60px", padding: "11px 18px", alignItems: "center", borderBottom: idx < Math.min(leadAging.length, 8) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: idx % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent", cursor: "pointer" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</p>
                    {l.car && <p style={{ margin: 0, fontSize: 10, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.car.brand} {l.car.model}</p>}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: stageC.bg, border: `1px solid ${stageC.border}`, color: stageC.tx, textTransform: "capitalize" }}>{stageLabel(l.stage || "new")}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: ageColor, textAlign: "center" }}>{l.days}d</p>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 10, color: "#475569" }}>→ {t("salesmanLite.tabs.leads")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Empty state ── */}
        {allLeads.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <BarChart2 size={32} strokeWidth={1.5} style={{ color: "#475569", margin: "0 auto 8px", display: "block" }} />
            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{t("salesmanLite.perf.noDataYet")}</p>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#475569" }}>{t("salesmanLite.perf.noDataSub")}</p>
            <button onClick={() => setActiveTab("listings")} style={{ fontSize: 12, padding: "8px 18px", borderRadius: 8, background: "#dc2626", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>{t("salesmanLite.perf.goToListings")}</button>
          </div>
        )}

      </div>
    );
  };

  // ── RENDER LISTINGS ───────────────────────────────────────────────────────

  const renderListings = () => {
    const enriched = myListings.map((car) => {
      const stats = carStatsMap[car.id] ?? {};
      const views = stats.views || 0;
      const enqs = stats.enquiries || 0;
      const daily = stats.daily || [0,0,0,0,0,0,0];
      const cvr = views > 0 ? (enqs / views) * 100 : null;
      const isHot = cvr !== null && cvr > 6 && views > 3;
      const isStale = views > 10 && (cvr === null || cvr === 0);
      return { car, views, enqs, daily, cvr, isHot, isStale };
    });

    const hotCount = enriched.filter((e) => e.isHot).length;
    const staleCount = enriched.filter((e) => e.isStale).length;
    const activeCount = myListings.filter(
      (c) => c.status === "available",
    ).length;

    const normStatus = (s) => {
      if (!s || s === "active") return "available";
      return s;
    };
    const filtered = enriched.filter((e) => normStatus(e.car.status) === filterStatus);

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "price_desc") return (b.car.selling_price || 0) - (a.car.selling_price || 0);
      if (sortBy === "price_asc")  return (a.car.selling_price || 0) - (b.car.selling_price || 0);
      if (sortBy === "oldest")     return new Date(a.car.created_at) - new Date(b.car.created_at);
      return new Date(b.car.created_at) - new Date(a.car.created_at); // newest (default)
    });

    // Two cars can share the exact same year/brand/model/variant (e.g. two
    // identical trims bought in one batch) and be visually indistinguishable
    // in the grid. Only surface a disambiguator (colour / plate) on cards
    // whose title actually collides with a sibling — no point cluttering
    // every card with extra text when names are already unique.
    const nameCounts = {};
    sorted.forEach(({ car }) => {
      const n = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
      nameCounts[n] = (nameCounts[n] || 0) + 1;
    });

    const SEL_STYLE = (active) => ({
      fontSize: T.size.sm,
      padding: "5px 11px",
      borderRadius: R.sm,
      cursor: "pointer",
      background: active ? withAlpha(C.accent, 0.12) : C.line,
      border: active
        ? `1px solid ${withAlpha(C.accent, 0.3)}`
        : `1px solid ${C.border}`,
      color: active ? C.dangerText : C.textMuted,
      fontWeight: active ? T.weight.semibold : T.weight.normal,
    });

    return (
      <div>
        {/* Header row with Add button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: T.size.lg,
              fontWeight: T.weight.semibold,
              color: C.text,
            }}
          >
            {t("salesmanLite.listings.title")} ({myListings.length})
          </p>
          <button
            onClick={() => (showAddForm ? setShowAddForm(false) : openAddListing())}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: C.accent,
              border: "none",
              borderRadius: R.md,
              color: C.onAccent,
              fontSize: T.size.base,
              fontWeight: T.weight.semibold,
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            <Plus size={13} /> {showAddForm ? t("salesmanLite.listings.cancel") : t("salesmanLite.listings.addListing")}
          </button>
        </div>

        {/* Store exposure bar */}
        {!showAddForm && profile?.slug && myListings.filter(c => c.status === "available").length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px", padding: "7px 12px", borderRadius: R.md, background: withAlpha(C.success, 0.04), border: `1px solid ${withAlpha(C.success, 0.13)}` }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.success, flexShrink: 0 }} />
            <span style={{ fontSize: T.size.xs, color: C.textMuted, flex: 1 }}>
              Your listings are <strong style={{ color: C.success }}>live on XDrive</strong> — buyers can find you at xdrive.my/s/{profile.slug}
            </span>
            <button
              onClick={() => { navigator.clipboard.writeText(`https://xdrive.my/s/${profile.slug}`); toast.success(t("salesmanLite.toast.linkCopied")); }}
              style={{ ...SOFT(C.success), fontSize: T.size.xs, padding: "4px 10px", borderRadius: R.sm, cursor: "pointer", fontWeight: T.weight.semibold, whiteSpace: "nowrap", fontFamily: "inherit" }}
            >
              {t("salesmanLite.listings.copyLink")}
            </button>
          </div>
        )}

        {/* Listing quality banner */}
        {!showAddForm && myListings.filter(c => c.status === "available").length > 0 && (() => {
          const scores = myListings.filter(c => c.status === "available").map(c => listingScore(c).pct);
          const avg = Math.round(scores.reduce((s, p) => s + p, 0) / scores.length);
          if (avg >= 80) return null;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px", padding: "9px 14px", borderRadius: R.md, background: withAlpha(C.warn, 0.04), border: `1px solid ${withAlpha(C.warn, 0.15)}` }}>
              <BarChart2 size={13} style={{ flexShrink: 0, color: C.warnText }} />
              <p style={{ margin: 0, fontSize: T.size.sm, color: C.textSec, flex: 1 }}>Your listings average <strong style={{ color: C.warnText }}>{avg}% quality</strong>. Complete listings get 3× more views.</p>
            </div>
          );
        })()}

        {showAddForm && (
          <CarFormModal title={t("salesmanLite.listings.addListing")} onClose={() => setShowAddForm(false)}>
            <CarForm
              onCreate={(car) => {
                setMyListings((p) => [car, ...p]);
                setShowAddForm(false);
                toast.success(t("salesmanLite.toast.listingPublished"));
                if (profile?.telegram_chat_id) {
                  const carName = [car.year, car.brand, car.model].filter(Boolean).join(" ");
                  supabase.auth.getSession().then(({ data: { session } }) => {
                    supabase.functions.invoke("send-telegram", {
                      body: {
                        dealer_id: userId,
                        channel_id: profile.telegram_chat_id,
                        message: `Your listing is now live on XDrive!\n\n${carName}${car.selling_price ? `\nRM ${Number(car.selling_price).toLocaleString("en-MY")}` : ""}`,
                      },
                      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
                    }).catch(() => {});
                  });
                }
              }}
            />
          </CarFormModal>
        )}

        {myListings.length > 0 && !showAddForm && (
          <>
            {/* Status tabs */}
            <div style={{ borderBottom: `1px solid ${C.border}`, marginBottom: 0 }}>
              <div
                style={{
                  display: "flex",
                  gap: 0,
                  overflowX: "auto",
                  scrollbarWidth: "none",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {[
                  { key: "pending_approval", label: t("salesmanLite.listings.status.pending"),   count: myListings.filter((c) => c.status === "pending_approval").length },
                  { key: "rejected",         label: t("salesmanLite.listings.status.rejected"),  count: myListings.filter((c) => c.status === "rejected").length },
                  { key: "available",        label: t("salesmanLite.listings.status.available"), count: myListings.filter((c) => (c.status || "available") === "available").length },
                  { key: "reserved",         label: t("salesmanLite.listings.status.reserved"),  count: myListings.filter((c) => c.status === "reserved").length },
                  { key: "sold",             label: t("salesmanLite.listings.status.sold"),      count: myListings.filter((c) => c.status === "sold").length },
                ].map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setFilterStatus(key)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "10px 13px",
                      fontSize: T.size.base,
                      fontWeight: filterStatus === key ? T.weight.semibold : T.weight.normal,
                      fontFamily: "system-ui, sans-serif",
                      color: filterStatus === key ? C.text : C.textDim,
                      borderBottom: filterStatus === key ? `2px solid ${C.accent}` : "2px solid transparent",
                      marginBottom: -1,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "color 0.15s",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {label}
                    <span
                      style={{
                        fontSize: T.size.sm,
                        fontWeight: T.weight.bold,
                        padding: "1px 6px",
                        borderRadius: 4,
                        lineHeight: 1.6,
                        background: filterStatus === key ? withAlpha(C.accent, 0.12) : C.fill,
                        color: filterStatus === key ? C.dangerText : C.textDim,
                      }}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sort row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                padding: "10px 0 14px",
              }}
            >
              <span style={{ fontSize: T.size.sm, color: C.textDim, marginRight: 2 }}>{t("salesmanLite.listings.sort")}</span>
              <button style={SEL_STYLE(sortBy === "newest")} onClick={() => setSortBy("newest")}>{t("salesmanLite.listings.sortNewest")}</button>
              <button style={SEL_STYLE(sortBy === "price_desc")} onClick={() => setSortBy("price_desc")}>{t("salesmanLite.listings.sortPriceDesc")}</button>
              <button style={SEL_STYLE(sortBy === "price_asc")} onClick={() => setSortBy("price_asc")}>{t("salesmanLite.listings.sortPriceAsc")}</button>
              {hotCount > 0 && (
                <span style={{ fontSize: T.size.sm, color: C.danger, fontWeight: T.weight.semibold, marginLeft: "auto" }}>{hotCount} {t("salesmanLite.heat.hot")}</span>
              )}
              {staleCount > 0 && (
                <span style={{ fontSize: T.size.sm, color: C.textMuted, fontWeight: T.weight.medium }}>{staleCount} stale</span>
              )}
            </div>
          </>
        )}

        {myListings.length === 0 && !showAddForm ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: "52px 24px",
              background: C.surface,
              border: `1px dashed ${C.borderStrong}`,
              borderRadius: R.lg,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: C.fill,
                border: `1px solid ${C.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Car size={24} color={C.textDim} />
            </div>
            <p
              style={{
                margin: 0,
                fontSize: T.size.lg,
                fontWeight: T.weight.semibold,
                color: C.textDim,
              }}
            >
              No listings yet
            </p>
            <p
              style={{
                margin: 0,
                fontSize: T.size.base,
                color: C.textDim,
                textAlign: "center",
                maxWidth: 260,
                lineHeight: 1.6,
              }}
            >
              Add your first car using the button above.
            </p>
            <button
              onClick={openAddListing}
              style={{ marginTop: 14, fontSize: T.size.base, fontWeight: T.weight.semibold, padding: "9px 20px", borderRadius: R.md, background: C.accent, border: "none", color: C.onAccent, cursor: "pointer" }}
            >
              + Add Listing
            </button>
            <button
              onClick={() => switchTab("dashboard")}
              style={{ marginTop: 8, fontSize: T.size.sm, padding: "7px 16px", borderRadius: R.md, background: "none", border: "none", color: C.textDim, cursor: "pointer" }}
            >
              ← Back to Dashboard
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 0",
              color: C.textDim,
              fontSize: T.size.base,
            }}
          >
            No {filterStatus} listings.
          </div>
        ) : (
          <div
            onClick={() => { setStatusMenuCarId(null); setActionMenuCarId(null); }}
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "1fr"
                : "repeat(auto-fill,minmax(260px,1fr))",
              gap: 14,
            }}
          >
            {sorted.map(({ car, views, enqs, cvr, isHot, isStale }) => {
              const isSold     = car.status === "sold";
              const isReserved = car.status === "reserved";
              const isPending  = car.status === "pending_approval";
              const isRejected = car.status === "rejected";
              const isInactive = isSold || isPending || isRejected;
              const cvrFill    = cvr !== null ? Math.min(cvr * 10, 100) : 0;
              const img  = car.images?.[0];
              const name = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
              const price = car.selling_price
                ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}`
                : "—";
              const disambiguator = nameCounts[name] > 1
                ? [car.colour, car.plate_number ? `Plate …${car.plate_number.slice(-4)}` : null].filter(Boolean).join(" · ")
                : null;
              const cvrLabel   = cvr !== null ? cvr.toFixed(1) : "0";
              const isHovering = cvrHover === car.id;
              const openDetail = () => { setSelectedCar(car); setCarDetailImgIdx(0); setCarDetailTab("specs"); };
              return (
                <div
                  key={car.id}
                  style={{
                    background: C.surface,
                    border: isSold
                      ? `1px solid ${C.fillStrong}`
                      : isReserved
                        ? `1px solid ${withAlpha(C.warn, 0.22)}`
                        : isPending
                          ? `1px solid ${withAlpha(C.warn, 0.18)}`
                          : isRejected
                            ? `1px solid ${withAlpha(C.danger, 0.22)}`
                            : `1px solid ${C.border}`,
                    borderRadius: R.lg,
                    overflow: "hidden",
                    opacity: isSold ? 0.62 : 1,
                    transition: "opacity 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  {/* Image */}
                  {img ? (
                    <img
                      src={img}
                      alt={name}
                      onClick={openDetail}
                      style={{
                        width: "100%",
                        height: 150,
                        objectFit: "cover",
                        cursor: "pointer",
                        filter: isSold ? "grayscale(0.75) brightness(0.6)" : "none",
                      }}
                    />
                  ) : (
                    <div
                      onClick={openDetail}
                      style={{
                        width: "100%",
                        height: 150,
                        background: C.fill,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        filter: isSold ? "grayscale(0.75) brightness(0.6)" : "none",
                      }}
                    >
                      <Car size={32} color={C.textDim} />
                    </div>
                  )}

                  {/* Status indicator — compact single-line strip */}
                  {(isSold || isReserved || isPending || isRejected) && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 12px",
                      borderBottom: `1px solid ${
                        isRejected  ? withAlpha(C.danger, 0.18) :
                        isSold      ? withAlpha(C.textMuted, 0.15) :
                                      withAlpha(C.warn, 0.15)
                      }`,
                      background: `${
                        isRejected  ? withAlpha(C.danger, 0.05) :
                        isSold      ? withAlpha(C.textMuted, 0.07) :
                                      withAlpha(C.warn, 0.05)
                      }`,
                    }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                        background: isRejected ? C.dangerText : isSold ? C.textMuted : C.warnText,
                      }} />
                      <span style={{
                        fontSize: T.size.xs, fontWeight: T.weight.semibold,
                        color: isRejected ? C.dangerText : isSold ? C.textSec : C.warnText,
                      }}>
                        {isSold ? t("salesmanLite.listings.status.sold") : isReserved ? t("salesmanLite.listings.status.reserved") : isPending ? t("salesmanLite.listings.status.pendingApproval") : t("salesmanLite.listings.status.rejected")}
                      </span>
                      {isSold && car.sold_at && (
                        <span style={{ fontSize: T.size.xs, color: C.textDim }}>
                          · {new Date(car.sold_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}
                        </span>
                      )}
                      {isPending && (
                        <span style={{ fontSize: T.size.xs, color: C.textMuted }}>· not visible to buyers yet</span>
                      )}
                      {isRejected && car.rejection_reason && (
                        <span style={{ fontSize: T.size.xs, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          · {car.rejection_reason}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Live on XDrive bar — only for available listings */}
                  {!isSold && !isReserved && !isPending && !isRejected && (
                    <div style={{ background: withAlpha(C.success, 0.05), borderBottom: `1px solid ${withAlpha(C.success, 0.13)}`, padding: "4px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.success, flexShrink: 0 }} />
                      <span style={{ fontSize: T.size.xs, fontWeight: T.weight.bold, color: C.success, letterSpacing: "0.1em", textTransform: "uppercase" }}>Live on XDrive</span>
                      <span style={{ marginLeft: "auto", fontSize: T.size.xs, color: C.textDim }}>{views > 0 ? `${views} view${views !== 1 ? "s" : ""}` : "accepting buyers"}</span>
                    </div>
                  )}

                  <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
                    {/* Title + badge row */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                      <p
                        onClick={openDetail}
                        style={{
                          margin: 0,
                          fontSize: T.size.base,
                          fontWeight: T.weight.semibold,
                          color: isSold ? C.textMuted : C.text,
                          lineHeight: 1.3,
                          flex: 1,
                          marginRight: 8,
                          cursor: "pointer",
                        }}
                      >
                        {name}
                        {disambiguator && (
                          <span style={{ display: "block", fontSize: T.size.xs, fontWeight: T.weight.normal, color: C.textMuted, marginTop: 2 }}>
                            {disambiguator}
                          </span>
                        )}
                      </p>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        {(() => {
                          const curStatus = normStatus(car.status || "available");
                          const dotColor = curStatus === "reserved" ? C.warnText : curStatus === "sold" ? C.textSec : C.successText;
                          const locked = isPending || isRejected;
                          const open = statusMenuCarId === car.id;
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (locked) return; // locked until the dealer approves/rejects the listing
                                setStatusMenuCarId(open ? null : car.id);
                              }}
                              title={locked ? undefined : "Change listing status"}
                              style={{
                                display: "flex", alignItems: "center", gap: 6,
                                padding: "4px 6px 4px 9px", borderRadius: R.sm,
                                background: open ? C.fillStrong : C.line,
                                border: `1px solid ${open ? C.borderStrong : C.border}`,
                                cursor: locked ? "not-allowed" : "pointer",
                                opacity: locked ? 0.5 : 1,
                              }}
                            >
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                              <span style={{ fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.text, textTransform: "capitalize" }}>{car.status || "available"}</span>
                              {!locked && <ChevronDown size={13} color={C.textSec} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />}
                            </button>
                          );
                        })()}
                        {!isPending && !isRejected && statusMenuCarId === car.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50, background: C.surfaceRaised, border: `1px solid ${C.borderStrong}`, borderRadius: R.md, overflow: "hidden", minWidth: 146, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
                          >
                            <p style={{ margin: 0, padding: "8px 12px 6px", fontSize: T.size.xs, fontWeight: T.weight.bold, letterSpacing: T.track.label, textTransform: "uppercase", color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>Set this listing to</p>
                            {[
                              { key: "available", label: "Available", color: C.successText, hint: "Live for buyers" },
                              { key: "reserved",  label: "Reserved",  color: C.warnText, hint: "Deposit / on hold" },
                              { key: "sold",      label: "Sold",      color: C.textSec, hint: "Deal closed" },
                            ].map(({ key, label, color, hint }) => {
                              const active = normStatus(car.status || "available") === key;
                              return (
                                <button
                                  key={key}
                                  onClick={() => updateListingStatus(car, key)}
                                  style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 12px", background: active ? C.fillStrong : "none", border: "none", cursor: "pointer", textAlign: "left" }}
                                >
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                                  <span style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: T.size.base, color: active ? C.text : C.textSec, fontWeight: active ? T.weight.bold : T.weight.medium }}>{label}</span>
                                    <span style={{ fontSize: T.size.xs, color: C.textMuted }}>{hint}</span>
                                  </span>
                                  {active && <Check size={13} color={C.successText} style={{ flexShrink: 0 }} />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Price — scaled by tier so higher-value cars read heavier */}
                    <p style={{ margin: "0 0 6px", lineHeight: 1, ...(isSold ? { fontSize: T.size.base, fontWeight: T.weight.bold, color: C.textDim } : priceStyle(car.selling_price)) }}>
                      {price}
                    </p>

                    {/* My commission input — RM prefix + field share one height
                        (alignItems: stretch) so the addon never reads shorter
                        than the number box. */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: T.size.xs, color: C.textDim, whiteSpace: "nowrap" }}>My commission:</span>
                      <div style={{ display: "flex", alignItems: "stretch", gap: 0, flex: 1 }}>
                        <span style={{ display: "flex", alignItems: "center", fontSize: T.size.sm, color: C.textMuted, padding: "0 8px", background: C.fill, border: `1px solid ${C.border}`, borderRight: "none", borderRadius: `${R.sm}px 0 0 ${R.sm}px` }}>RM</span>
                        <input
                          key={`comm-${car.id}-${car.commission_amount ?? "x"}`}
                          type="number"
                          min="0"
                          step="100"
                          placeholder="0"
                          defaultValue={car.commission_amount != null ? car.commission_amount : ""}
                          onBlur={async e => {
                            const val = e.target.value === "" ? null : Number(e.target.value);
                            if (val === (car.commission_amount ?? null)) return;
                            await supabase.from("car_listings").update({ commission_amount: val }).eq("id", car.id);
                            setMyListings(prev => prev.map(c => c.id === car.id ? { ...c, commission_amount: val } : c));
                            refreshCommissionData();
                          }}
                          style={{ flex: 1, minWidth: 0, width: 0, background: C.fill, border: `1px solid ${C.border}`, borderLeft: "none", borderRadius: `0 ${R.sm}px ${R.sm}px 0`, padding: "5px 8px", color: car.commission_amount ? C.infoText : C.textMuted, fontSize: T.size.base, fontWeight: car.commission_amount ? T.weight.bold : T.weight.normal, fontFamily: "inherit", outline: "none", lineHeight: 1.2, boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    {/* Meta */}
                    <p style={{ margin: "0 0 8px", fontSize: T.size.sm, color: C.textDim }}>
                      {[
                        car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null,
                        car.engine_cc ? `${Number(car.engine_cc).toLocaleString()}cc` : null,
                        car.transmission,
                        car.colour,
                      ].filter(Boolean).join(" · ")}
                    </p>

                    {/* Listing completeness bar */}
                    {!isSold && (() => {
                      const { pct, missing } = listingScore(car);
                      if (pct >= 90) return null;
                      const barColor = pct >= 70 ? C.warnText : C.dangerText;
                      return (
                        <div style={{ marginBottom: 8 }} title={missing.length ? `Improve: ${missing.join(", ")}` : ""}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: T.size.xs, color: C.textDim }}>Listing quality</span>
                            <span style={{ fontSize: T.size.xs, color: barColor, fontWeight: T.weight.semibold }}>{pct}%</span>
                          </div>
                          <div style={{ height: 3, borderRadius: R.pill, background: C.fillStrong, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: R.pill }} />
                          </div>
                          {missing.length > 0 && (
                            <p style={{ margin: "3px 0 0", fontSize: T.size.xs, color: C.textDim }}>+ {missing[0]}</p>
                          )}
                        </div>
                      );
                    })()}

                    {/* CVR bar — hidden for sold */}
                    {!isSold && (
                      <div
                        style={{ marginBottom: 10, position: "relative" }}
                        onMouseEnter={() => setCvrHover(car.id)}
                        onMouseLeave={() => setCvrHover(null)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <span style={{ fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text }}>
                            <span style={{ color: C.text, fontWeight: T.weight.bold }}>{views}</span> views · <span style={{ color: C.text, fontWeight: T.weight.bold }}>{enqs}</span> enquiries
                          </span>
                          {isHot && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: T.size.sm, color: C.danger, fontWeight: T.weight.semibold }}><Flame size={12} /> Hot</span>}
                          {isStale && !isHot && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: T.size.sm, color: C.textSec }}><Clock size={12} /> Stale</span>}
                        </div>
                        <div style={{ height: 4, borderRadius: R.pill, background: C.fillStrong, overflow: "visible" }}>
                          <div style={{ height: "100%", width: `${cvrFill}%`, background: isHot ? C.danger : C.textDim, borderRadius: R.pill, transition: "width 0.3s" }} />
                        </div>
                        {isHovering && (
                          <div style={{
                            position: "absolute", bottom: "calc(100% + 6px)", left: 0,
                            background: C.surfaceRaised, border: `1px solid ${C.borderStrong}`,
                            borderRadius: R.sm, padding: "5px 10px", fontSize: T.size.sm, color: C.text,
                            whiteSpace: "nowrap", zIndex: 10, pointerEvents: "none",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                          }}>
                            {views} views · {enqs} enquiries ·{" "}
                            <span style={{ color: isHot ? C.danger : C.infoText, fontWeight: T.weight.semibold }}>
                              {cvrLabel}% CVR
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Photo nudge — fewer than 3 photos hurts views */}
                    {!isSold && (!car.images || car.images.length < 3) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, padding: "5px 8px", borderRadius: R.sm, background: withAlpha(C.warn, 0.05), border: `1px solid ${withAlpha(C.warn, 0.14)}` }}>
                        <Camera size={11} style={{ flexShrink: 0, color: C.warn }} />
                        <span style={{ fontSize: T.size.xs, color: C.warn, flex: 1 }}>
                          Add {Math.max(0, 3 - (car.images?.length || 0))} more photo{Math.max(0, 3 - (car.images?.length || 0)) !== 1 ? "s" : ""} — listings with 3+ photos get 3× more views
                        </span>
                        <button onClick={() => setEditListing(car)} style={{ ...SOFT(C.warnText), fontSize: T.size.xs, padding: "2px 7px", borderRadius: R.sm, cursor: "pointer", fontWeight: T.weight.bold, whiteSpace: "nowrap", fontFamily: "inherit" }}>Fix</button>
                      </div>
                    )}

                    {/* Action bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: "auto" }}>
                      {isSold ? (
                        <>
                          <button onClick={openDetail} style={{ flex: 1, fontSize: T.size.sm, padding: "6px 0", borderRadius: R.sm, background: C.fill, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer" }}>
                            View
                          </button>
                        </>
                      ) : isPending ? (
                        <>
                          {/* Pending — only allow editing while waiting for approval */}
                          <button onClick={openDetail} style={{ flex: 1, fontSize: T.size.sm, padding: "6px 0", borderRadius: R.sm, background: C.fill, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer" }}>
                            View
                          </button>
                          <button onClick={() => setEditListing(car)} style={{ ...SOFT(C.info), color: C.infoText, flex: 1, fontSize: T.size.sm, padding: "6px 0", borderRadius: R.sm, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                            <Pencil size={10} /> Edit
                          </button>
                        </>
                      ) : isRejected ? (
                        <>
                          {/* Rejected — prompt to fix and resubmit */}
                          <button onClick={() => setEditListing(car)} style={{ ...SOFT(C.accent), color: C.dangerText, flex: 1, fontSize: T.size.sm, fontWeight: T.weight.semibold, padding: "6px 0", borderRadius: R.sm, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                            <Pencil size={10} /> Edit & Resubmit
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Copy link */}
                          <button
                            onClick={() => handleListingCopy(car, "link")}
                            title="Copy link"
                            style={{ flex: 1, fontSize: T.size.sm, padding: "6px 0", borderRadius: R.sm, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: listingCopied[car.id] === "link" ? withAlpha(C.success, 0.12) : C.fill, border: `1px solid ${C.border}`, color: listingCopied[car.id] === "link" ? C.successText : C.textSec }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            {listingCopied[car.id] === "link" ? "Copied" : "Link"}
                          </button>
                          {/* WA */}
                          <button
                            onClick={() => handleListingCopy(car, "wa")}
                            title="Copy caption"
                            style={{ flex: 1, fontSize: T.size.sm, padding: "6px 0", borderRadius: R.sm, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: listingCopied[car.id] === "wa" ? withAlpha(C.success, 0.12) : withAlpha(C.success, 0.06), border: `1px solid ${withAlpha(C.success, 0.15)}`, color: listingCopied[car.id] === "wa" ? C.successText : C.success }}
                          >
                            <ClipboardPen size={11} />
                            {listingCopied[car.id] === "wa" ? "Copied" : "Caption"}
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => setEditListing(car)}
                            style={{ ...SOFT(C.info), color: C.infoText, flex: 1, fontSize: T.size.sm, padding: "6px 0", borderRadius: R.sm, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                          >
                            <Pencil size={10} /> Edit
                          </button>
                        </>
                      )}

                      {/* ··· overflow */}
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActionMenuCarId(actionMenuCarId === car.id ? null : car.id); setConfirmDeleteId(null); }}
                          title="More actions"
                          aria-label="More actions"
                          style={{ width: 30, height: 30, borderRadius: R.sm, background: C.fill, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: T.size.base, letterSpacing: 1 }}
                        >
                          ···
                        </button>
                        {actionMenuCarId === car.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ position: "absolute", bottom: "calc(100% + 6px)", right: 0, zIndex: 60, background: C.surfaceRaised, border: `1px solid ${C.borderStrong}`, borderRadius: R.md, overflow: "hidden", minWidth: 140, boxShadow: "0 8px 28px rgba(0,0,0,0.6)" }}
                          >
                            {!isSold && (
                              <>
                                <button onClick={() => { setQuickBriefCar(car); setBriefCopied(false); setActionMenuCarId(null); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", color: C.textSec, fontSize: T.size.base, textAlign: "left" }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                  Brief
                                </button>
                                <div style={{ height: 1, background: C.line, margin: "2px 0" }} />
                              </>
                            )}
                            {confirmDeleteId === car.id ? (
                              <div style={{ padding: "8px 14px", display: "flex", gap: 6 }}>
                                <button onClick={() => handleDeleteListing(car.id)} style={{ flex: 1, fontSize: T.size.sm, padding: "5px 0", borderRadius: R.sm, background: withAlpha(C.danger, 0.2), border: `1px solid ${withAlpha(C.danger, 0.4)}`, color: C.dangerText, cursor: "pointer", fontWeight: T.weight.bold }}>Delete</button>
                                <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, fontSize: T.size.sm, padding: "5px 0", borderRadius: R.sm, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer" }}>Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteId(car.id)} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", color: C.danger, fontSize: T.size.base, textAlign: "left" }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── RENDER LEADS ──────────────────────────────────────────────────────────
  // The closing is intentionally at the myListings.map level; the outer
  // (() => { ... })().map() chain closes correctly.

  const renderLeads = () => {
    const searchedLeads = leadSearch.trim()
      ? leads.filter((l) => {
          const q = leadSearch.toLowerCase();
          return (
            (l.buyer_name || "").toLowerCase().includes(q) ||
            (l.phone || "").includes(q) ||
            (l.notes || "").toLowerCase().includes(q)
          );
        })
      : leads;

    // Lead source breakdown — bucket by whatever lead_source values actually
    // appear (not a fixed whitelist), so sources outside an old hardcoded list
    // (e.g. real 'whatsapp'/'walk_in'/'referral'/'drevo_enquiry' rows) aren't
    // silently dropped from the total. Mirrors the dynamic bucketing already
    // used for the Prestasi lead-source card below.
    const SRC_LABELS = { whatsapp: t("salesmanLite.leads.srcWhatsapp"), enquiry: t("salesmanLite.leads.srcEnquiry"), drevo_enquiry: t("salesmanLite.leads.srcEnquiry"), walk_in: t("salesmanLite.leads.srcWalkIn"), referral: t("salesmanLite.leads.srcReferral"), manual: t("salesmanLite.leads.srcManual") };
    const SRC_COLORS = { whatsapp: C.successText, enquiry: C.dangerText, drevo_enquiry: C.dangerText, walk_in: "#a78bfa", referral: C.warnText, manual: C.textMuted };
    const FALLBACK_COLORS = ["#60a5fa", "#f472b6", C.stale, "#34d399"];
    const srcMap = {};
    leads.forEach(l => {
      const s = l.lead_source || "manual";
      srcMap[s] = (srcMap[s] || 0) + 1;
    });
    const srcTotal = leads.length;
    const srcCfg = Object.keys(srcMap).map((key, i) => ({
      key,
      label: SRC_LABELS[key] || key,
      color: SRC_COLORS[key] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    }));

    // pre-compute heat scores once — avoids O(n log n) recomputation inside sort comparators
    const heatMap = new Map(searchedLeads.map((l) => [l.id, getHeatScore(l)]));
    const staleIdSet = new Set(staleLeads.map((l) => l.id));

    const activeStages = LEAD_STAGES.filter(
      (s) => s !== "lost" && s !== "closed_lost" && s !== "closed_won",
    );
    const lostLeads = searchedLeads.filter(
      (l) => l.stage === "lost" || l.stage === "closed_lost",
    );

    // Unconfirmed bookings (pending appointments) have no pipeline lead yet by
    // design — they live in the Bookings tab until confirmed. Rather than mixing
    // a non-lead card into the Booked stage, we surface a single "confirmation
    // pending" banner under the search bar that jumps straight to the Bookings
    // tab (see below). pendingBookingsCount (component scope) drives its badge.

    const renderLeadCard = (lead) => {
      const car = lead.car_listings;
      const carName = car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : null;
      const carPrice = car?.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : null;
      const progressStages = ["new","contacted","viewing_booked","test_drive","negotiating","deposit_taken","won"];
      const normalizedStage = lead.stage === "closed_won" ? "won" : lead.stage;
      const currentProgressIdx = progressStages.indexOf(normalizedStage);
      const stageIdx = LEAD_STAGES.indexOf(lead.stage);
      const nextStage = LEAD_STAGES.filter(
        (s) => s !== "lost" && s !== "closed_won" && s !== "closed_lost",
      ).find((s) => LEAD_STAGES.indexOf(s) > stageIdx);
      const heat = getHeatScore(lead);
      const leadThread = threadByLead.get(lead.id) || null;
      const isConfirmingDelete = deleteConfirmId === lead.id;
      const isPromptingLost = lostPromptId === lead.id;
      const followUpOverdue = lead.follow_up_at && new Date(lead.follow_up_at).getTime() <= Date.now();
      const initials = (lead.buyer_name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
      const heatStyle = heat.label === "hot"
        ? { bg: withAlpha(C.dangerText, 0.12), color: C.dangerText }
        : heat.label === "warm"
        ? { bg: withAlpha(C.warn, 0.12), color: C.warnText }
        : { bg: C.line, color: C.textMuted };

      return (
        <div
          key={lead.id}
          className={glowLeadIds.has(lead.id) ? "slite-lead-glow" : undefined}
          style={{
            position: "relative",
            background: C.surfaceRaised,
            border: `1px solid ${C.borderStrong}`,
            borderRadius: R.md,
            overflow: "hidden",
          }}
        >
          {/* ── HEADER ── */}
          <div style={{ padding: "12px 14px 0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
              {/* Avatar */}
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: withAlpha(C.infoText, 0.15), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.infoTextHi }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <p style={{ margin: 0, fontSize: T.size.lg, fontWeight: T.weight.bold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lead.buyer_name || "—"}
                  </p>
                  {/* Top-right corner badges — heat + add-on flag share this
                      slot via normal flow (not position:absolute) so a lead
                      that's both hot AND has an add-on doesn't overlap. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    {leadIdsWithAddons.has(lead.id) && (
                      <span title="This deal has a paid add-on attached" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: T.size.xs, fontWeight: T.weight.bold, borderRadius: R.pill, padding: "2px 7px", background: withAlpha(C.infoText, 0.15), border: `1px solid ${withAlpha(C.infoText, 0.35)}`, color: C.infoTextHi, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        <Package size={9} /> Add-on
                      </span>
                    )}
                    {!heat.terminal && (
                      <span title="Lead urgency — based on pipeline stage and how recently this lead moved" style={{ fontSize: T.size.xs, borderRadius: R.pill, padding: "2px 8px", background: heatStyle.bg, color: heatStyle.color, whiteSpace: "nowrap", flexShrink: 0, fontWeight: T.weight.bold, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {t("salesmanLite.heat." + heat.label, { defaultValue: heat.label })}
                      </span>
                    )}
                  </div>
                </div>
                {(carName || carPrice) && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 3, gap: 8 }}>
                    {carName && <p style={{ margin: 0, fontSize: T.size.sm, color: C.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{carName}</p>}
                    {carPrice && <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.bold, color: C.text, flexShrink: 0 }}>{carPrice}</p>}
                  </div>
                )}
                {lead.updated_at && (
                  <p style={{ margin: "3px 0 0", fontSize: T.size.sm, color: Date.now() - new Date(lead.updated_at).getTime() > 48 * 3600 * 1000 ? C.stale : C.textSec }}>
                    Last contact: {timeAgo(lead.updated_at)}
                  </p>
                )}
                {lead.last_call_outcome && (() => {
                  // Outcomes are information, not alarms — neutral chips with the icon
                  // carrying the distinction. Green only for the positive one.
                  const OUTCOME = { answered: { icon: CheckCircle, label: "Answered", color: C.successText }, no_answer: { icon: PhoneOff, label: "No Answer", color: C.textSec }, callback_requested: { icon: RefreshCw, label: "Callback", color: C.textSec }, voicemail: { icon: Voicemail, label: "Voicemail", color: C.textSec } };
                  const o = OUTCOME[lead.last_call_outcome];
                  if (!o) return null;
                  return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 3, fontSize: T.size.xs, fontWeight: T.weight.semibold, padding: "2px 7px", borderRadius: R.pill, background: `${o.color}15`, border: `1px solid ${o.color}40`, color: o.color }}>
                      <o.icon size={10} /> {o.label}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Progress bar — 7 segments; filled = brand red so deal progress is
                the card's one colored data element (gray-then-white read as disabled) */}
            <div style={{ marginBottom: followUpOverdue ? 8 : 12 }}>
              <div style={{ display: "flex", gap: 3, marginBottom: 5 }}>
                {progressStages.map((s, i) => (
                  <div key={s} style={{ flex: 1, height: 3, borderRadius: R.pill, background: i < currentProgressIdx ? withAlpha(C.accent, 0.55) : i === currentProgressIdx ? C.accent : C.border }} />
                ))}
              </div>
              <p style={{ margin: 0, fontSize: T.size.sm, color: C.textSec }}>
                {t("salesmanLite.leads.stage")}: <span style={{ color: C.text, fontWeight: T.weight.bold, textTransform: "capitalize" }}>{stageLabel(normalizedStage || "new")}</span>
                {currentProgressIdx >= 0 && <span style={{ color: C.textSec }}> · {currentProgressIdx + 1}/{progressStages.length}</span>}
              </p>
            </div>

            {/* Follow-up warning */}
            {followUpOverdue && (
              <div style={{ background: withAlpha(C.stale, 0.08), border: `1px solid ${withAlpha(C.stale, 0.22)}`, borderRadius: R.md, color: C.stale, fontSize: T.size.sm, padding: "6px 10px", marginBottom: 12 }}>
                {t("salesmanLite.leads.followUp")}: {timeAgo(lead.follow_up_at)}
              </div>
            )}
          </div>

          {/* ── ACTIONS — exactly 3 buttons ── */}
          <div style={{ display: "flex", gap: 6, padding: "0 14px 12px" }}>
            {lead.stage !== "won" && lead.stage !== "closed_won" && (
              <button
                onClick={() => advanceLeadStage(lead, nextStage)}
                style={{ flex: 1, fontSize: T.size.sm, fontWeight: T.weight.semibold, padding: "6px 12px", borderRadius: R.md, background: withAlpha(C.accent, 0.12), border: `1px solid ${withAlpha(C.accent, 0.22)}`, color: C.dangerText, cursor: "pointer", textAlign: "center", textTransform: "capitalize" }}
              >
                → {stageLabel(nextStage || "won")}
              </button>
            )}
            {lead.phone && (
              <a
                href={`tel:${(lead.phone || "").replace(/\D/g, "")}`}
                title="Call"
                aria-label="Call lead"
                style={{ flexShrink: 0, fontSize: T.size.sm, padding: "6px 10px", borderRadius: R.md, background: C.line, border: `1px solid ${C.borderStrong}`, color: C.textSec, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Phone size={13} />
              </a>
            )}
            {/* A buyer who chatted in the app is reachable HERE, and a guest buyer
                is reachable nowhere else — they never gave a phone. The in-app
                chat takes the WhatsApp slot rather than sitting beside it: this
                row is capped at three buttons, and WhatsApp is one tap away in
                the detail panel. */}
            {leadThread ? (
              <button
                onClick={() => setChatSheet({ threadId: leadThread.id, buyerName: lead.buyer_name || "Buyer", carLabel: carName })}
                title={t("salesmanLite.leads.openChat", { defaultValue: "Open the in-app chat with this buyer" })}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: T.size.sm, fontWeight: T.weight.semibold, padding: "6px 12px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.borderStrong}`, color: C.text, cursor: "pointer", fontFamily: "inherit" }}
              >
                <MessageSquare size={12} />
                {t("salesmanLite.leads.chat", { defaultValue: "Chat" })}
                {leadThread.seller_unread > 0 && (
                  <span style={{ minWidth: 15, height: 15, borderRadius: 99, background: C.accent, color: "#fff", fontSize: T.size.xs, fontWeight: T.weight.bold, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                    {leadThread.seller_unread}
                  </span>
                )}
              </button>
            ) : lead.phone ? (
              <button
                onClick={() => {
                  const waCarName = car ? `${car.brand} ${car.model}` : "kereta tu";
                  const isStale = lead.updated_at && Date.now() - new Date(lead.updated_at).getTime() > 48 * 3600 * 1000;
                  // New leads get a full first-contact message with all the car
                  // details they enquired on; later stages keep the short nudges.
                  const isNew = lead.stage === "new";
                  const msg = isNew
                    ? buildNewLeadWa(lead, car)
                    : isStale
                    ? `Hi ${lead.buyer_name || "kawan"}! Ada orang lain tengah tanya pasal ${waCarName} ni — kalau you still interested, jom lock dulu sebelum terlambat 🔒`
                    : `Hi ${lead.buyer_name || "kawan"}! Macam mana, still interested dalam ${waCarName} tu? Jom kita discuss lagi 😊`;
                  setWaModalMessage(msg);
                  setWaModalLead(lead);
                }}
                style={{ flex: 1, fontSize: T.size.sm, fontWeight: T.weight.semibold, padding: "6px 12px", borderRadius: R.md, background: withAlpha(C.success, 0.10), border: `1px solid ${withAlpha(C.success, 0.25)}`, color: C.successText, cursor: "pointer", textAlign: "center" }}
              >
                WhatsApp
              </button>
            ) : !lead.car_listing_id ? (
              <button
                onClick={() => setLinkCarLeadId(lead.id)}
                style={{ flex: 1, fontSize: T.size.sm, padding: "6px 12px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, cursor: "pointer", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
              >
                <Car size={12} /> {t("salesmanLite.leads.linkCar")}
              </button>
            ) : null}
            <button
              onClick={() => setDrawerLeadId(lead.id)}
              title="Open lead details"
              aria-label="Open lead details"
              style={{ flexShrink: 0, fontSize: T.size.base, padding: "6px 10px", borderRadius: R.md, background: C.line, border: `1px solid ${C.border}`, color: C.textSec, cursor: "pointer", letterSpacing: "0.05em", lineHeight: 1 }}
            >
              ···
            </button>
          </div>
        </div>
      );
    };

    return (
      <div>
        <style>{`
          @keyframes slite-lead-glow {
            0%   { box-shadow: 0 0 0 0 ${withAlpha(C.accent, 0.55)}; border-color: ${withAlpha(C.accent, 0.7)}; }
            70%  { box-shadow: 0 0 0 12px ${withAlpha(C.accent, 0)}; border-color: ${withAlpha(C.accent, 0.7)}; }
            100% { box-shadow: 0 0 0 0 ${withAlpha(C.accent, 0)}; border-color: ${C.border}; }
          }
          .slite-lead-glow { animation: slite-lead-glow 1s ease-out; }
        `}</style>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: T.size.lg,
              fontWeight: T.weight.semibold,
              color: C.text,
            }}
          >
            {t("salesmanLite.leads.pipeline")} ({leads.filter((l) => l.stage !== "lost" && l.stage !== "closed_lost" && l.stage !== "closed_won").length})
          </p>
          <button
            onClick={() => setShowAddLead(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: C.accent,
              border: "none",
              borderRadius: R.md,
              color: C.onAccent,
              fontSize: T.size.sm,
              fontWeight: T.weight.semibold,
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            <Plus size={13} /> {t("salesmanLite.header.addLead")}
          </button>
        </div>

        {/* Lead source breakdown */}
        {srcTotal > 0 && srcCfg.length > 1 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", borderRadius: R.sm, overflow: "hidden", height: 6, marginBottom: 8 }}>
              {srcCfg.map(({ key, color }) => (
                <div key={key} style={{ flex: srcMap[key], background: color }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {srcCfg.map(({ key, label, color }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: T.size.sm, color: C.textMuted }}>{label} <strong style={{ color: C.text }}>{srcMap[key]}</strong></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search bar */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textDim, pointerEvents: "none" }} />
          <input
            value={leadSearch}
            onChange={(e) => setLeadSearch(e.target.value)}
            placeholder={t("salesmanLite.leads.searchPlaceholder")}
            style={{ width: "100%", background: C.fill, border: `1px solid ${C.border}`, borderRadius: R.md, color: C.text, fontSize: T.size.base, padding: "8px 10px 8px 30px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          />
          {leadSearch && (
            <button onClick={() => setLeadSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 2 }}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Confirmation-pending banner — pending bookings have no pipeline lead
            yet; instead of a non-lead card inside the Booked stage, one tappable
            banner surfaces the count and jumps straight to the Bookings tab. */}
        {pendingBookingsCount > 0 && (
          <button
            onClick={() => { switchTab("enquiries"); setInboxSubTab("bookings"); }}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", marginBottom: 12, padding: "9px 12px", borderRadius: R.md, background: withAlpha(C.warn, 0.10), border: `1px solid ${withAlpha(C.warn, 0.3)}`, color: C.warnText, cursor: "pointer", fontSize: T.size.sm, fontWeight: T.weight.semibold, fontFamily: "inherit", textAlign: "left" }}
          >
            <Clock size={14} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              {t("salesmanLite.booked.pendingBanner", { count: pendingBookingsCount, defaultValue: `${pendingBookingsCount} booking${pendingBookingsCount > 1 ? "s" : ""} pending confirmation` })}
            </span>
            <ChevronRight size={15} style={{ flexShrink: 0 }} />
          </button>
        )}

        <>
            {/* Pill filter row (same on every screen size — no horizontal-scroll
                kanban) — wraps onto a second row instead of scrolling sideways,
                so every stage is visible without a swipe. Each pill's count
                badge turns red with a "!" when that stage has a lead needing
                follow-up, so you don't have to click into every stage to find
                out. */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "2px 0 10px", marginBottom: 12 }}>
              {activeStages.map((stage) => {
                const stageLeadsForPill = searchedLeads.filter((l) => l.stage === stage);
                const count = stageLeadsForPill.length;
                const staleInStage = stageLeadsForPill.filter((l) => staleIdSet.has(l.id));
                const needsFollowUp = staleInStage.length > 0;
                const isActive = mobileLeadStage === stage;
                return (
                  <button
                    key={stage}
                    onClick={() => {
                      setMobileLeadStage(stage);
                      triggerGlow(staleInStage.map((l) => l.id));
                    }}
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 12px",
                      borderRadius: R.pill,
                      fontSize: T.size.sm,
                      fontWeight: isActive ? 600 : 400,
                      cursor: "pointer",
                      background: isActive ? withAlpha(C.accent, 0.12) : C.fill,
                      border: isActive ? `1px solid ${withAlpha(C.accent, 0.3)}` : `1px solid ${C.border}`,
                      color: isActive ? C.dangerText : C.textSec,
                      textTransform: "capitalize",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {stageLabel(stage)}
                    <span style={{
                      fontSize: T.size.xs,
                      fontWeight: T.weight.bold,
                      color: needsFollowUp ? C.dangerText : isActive ? C.dangerText : C.textMuted,
                      background: needsFollowUp ? withAlpha(C.danger, 0.18) : isActive ? withAlpha(C.accent, 0.12) : C.fillStrong,
                      border: needsFollowUp ? `1px solid ${withAlpha(C.danger, 0.4)}` : "none",
                      borderRadius: R.pill,
                      padding: "0px 6px",
                      lineHeight: 1.6,
                    }}>
                      {count}{needsFollowUp ? "!" : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Vertical card list for the selected stage */}
            {(() => {
              const stageLeads = searchedLeads
                .filter((l) => l.stage === mobileLeadStage)
                .sort((a, b) => (heatMap.get(b.id)?.score ?? 0) - (heatMap.get(a.id)?.score ?? 0));
              if (stageLeads.length === 0) {
                return (
                  <div style={{ height: 60, borderRadius: R.md, border: `1px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: T.size.sm, color: C.textDim }}>Empty</span>
                  </div>
                );
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {stageLeads.map((lead) => renderLeadCard(lead))}
                </div>
              );
            })()}
        </>

        {lostLeads.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <button
              onClick={() => setLostOpen((o) => !o)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "6px 0",
              }}
            >
              <span
                style={{
                  fontSize: T.size.xs,
                  fontWeight: T.weight.bold,
                  color: C.textDim,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Lost ({lostLeads.length})
              </span>
              <span style={{ fontSize: T.size.sm, color: C.textDim }}>
                {lostOpen ? "▲" : "▼"}
              </span>
            </button>
            {lostOpen && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {lostLeads.map((lead) => (
                  <div
                    key={lead.id}
                    style={{
                      background: C.surfaceRaised,
                      border: `1px solid ${C.borderStrong}`,
                      borderRadius: R.md,
                      padding: "10px 12px",
                      opacity: 0.7,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: T.size.sm,
                          fontWeight: T.weight.semibold,
                          color: C.textSec,
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {lead.buyer_name || "—"}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        {lead.loss_reason && (
                          <span
                            style={{
                              fontSize: T.size.xs,
                              padding: "1px 7px",
                              borderRadius: R.pill,
                              background: withAlpha(C.textSec, 0.08),
                              border: `1px solid ${withAlpha(C.textSec, 0.2)}`,
                              color: C.textSec,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {lead.loss_reason}
                          </span>
                        )}
                        <button
                          onClick={() => setDeleteConfirmId(lead.id)}
                          title="Delete lead"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: C.textDim,
                            cursor: "pointer",
                            padding: 2,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: T.size.xs,
                        color: C.textDim,
                      }}
                    >
                      {timeAgo(lead.created_at)}
                    </p>
                    {deleteConfirmId === lead.id && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: T.size.sm,
                            color: C.dangerText,
                            fontWeight: T.weight.semibold,
                          }}
                        >
                          {t("salesmanLite.leads.deleteQ")}
                        </span>
                        <button
                          onClick={() => handleDeleteLead(lead.id)}
                          style={{
                            fontSize: T.size.xs,
                            padding: "6px 11px",
                            borderRadius: R.sm,
                            background: withAlpha(C.danger, 0.12),
                            border: `1px solid ${withAlpha(C.danger, 0.3)}`,
                            color: C.dangerText,
                            cursor: "pointer",
                            fontWeight: T.weight.semibold,
                          }}
                        >
                          {t("salesmanLite.leads.yes")}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          style={{
                            fontSize: T.size.xs,
                            padding: "6px 11px",
                            borderRadius: R.sm,
                            background: C.line,
                            border: `1px solid ${C.border}`,
                            color: C.textMuted,
                            cursor: "pointer",
                          }}
                        >
                          {t("salesmanLite.leads.no")}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── LEAD DETAIL SIDEBAR ── */}
        {drawerLeadId && (() => {
          const pl = leads.find(l => l.id === drawerLeadId);
          if (!pl) return null;
          const plCar = pl.car_listings;
          const plCarName = plCar ? [plCar.year, plCar.brand, plCar.model].filter(Boolean).join(" ") : null;
          const plCarPrice = plCar?.selling_price ? `RM ${Number(plCar.selling_price).toLocaleString("en-MY")}` : null;
          const plHeat = getHeatScore(pl);
          const plHeatStyle = plHeat.label === "hot" ? { bg: withAlpha(C.dangerText, 0.12), color: C.dangerText } : plHeat.label === "warm" ? { bg: withAlpha(C.warn, 0.12), color: C.warnText } : { bg: C.line, color: C.textMuted };
          const plInitials = (pl.buyer_name || "?").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
          const plThread = threadByLead.get(pl.id) || null;
          const plIsPromptingLost = lostPromptId === pl.id;
          const plIsConfirmingDelete = deleteConfirmId === pl.id;
          const close = () => { setDrawerLeadId(null); setEditingNoteId(null); setExpandedActivityLeadId(null); setLostPromptId(null); setDeleteConfirmId(null); };
          return (
            <>
              {/* backdrop */}
              <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} />
              {/* panel */}
              <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50, width: 400, maxWidth: "100vw", background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>

                {/* header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: withAlpha(C.infoText, 0.15), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: T.size.base, fontWeight: T.weight.bold, color: C.infoTextHi }}>{plInitials}</div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: T.size.lg, fontWeight: T.weight.bold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.buyer_name || "—"}</p>
                      <p style={{ margin: "1px 0 0", fontSize: T.size.sm, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plCarName || pl.phone || t("salesmanLite.drawer.noCarLinkedShort")}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {!plHeat.terminal && (
                      <span style={{ fontSize: T.size.xs, fontWeight: T.weight.bold, borderRadius: R.pill, padding: "2px 8px", background: plHeatStyle.bg, color: plHeatStyle.color }}>{plHeat.label}</span>
                    )}
                    <span style={{ fontSize: T.size.xs, fontWeight: T.weight.semibold, borderRadius: R.sm, padding: "2px 8px", background: C.line, color: C.textSec, textTransform: "capitalize" }}>{stageLabel(pl.stage)}</span>
                    <button onClick={close} style={{ background: C.line, border: "none", cursor: "pointer", color: C.textSec, borderRadius: R.md, padding: 6, display: "flex" }}>
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Car enquired-on block — image, name, price, and the specs a
                    salesman needs to answer fast (age, mileage, VIN, plate). */}
                {plCar ? (
                  <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.fillStrong}`, background: C.fillSubtle, display: "flex", gap: 12 }}>
                    {(() => {
                      const img = Array.isArray(plCar.images) ? plCar.images.find(Boolean) : null;
                      return img ? (
                        <img
                          src={cdnImg(img, 200)}
                          alt={plCarName || "Car"}
                          onClick={() => plCar.slug && window.open(`/cars/${plCar.slug}`, "_blank")}
                          style={{ width: 88, height: 66, borderRadius: R.md, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.border}`, cursor: plCar.slug ? "pointer" : "default" }}
                        />
                      ) : (
                        <div style={{ width: 88, height: 66, borderRadius: R.md, flexShrink: 0, background: C.fill, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Car size={22} style={{ color: C.textDim }} />
                        </div>
                      );
                    })()}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: T.size.base, fontWeight: T.weight.semibold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[plCar.year, plCar.brand, plCar.model, plCar.variant].filter(Boolean).join(" ") || plCarName}
                      </p>
                      {plCarPrice && <p style={{ margin: "3px 0 0", fontSize: T.size.lg, fontWeight: T.weight.bold, color: C.text }}>{plCarPrice}</p>}
                      <p style={{ margin: "5px 0 0", fontSize: T.size.sm, color: C.textSec }}>
                        {[carAgeLabel(plCar.year), plCar.mileage ? `${Number(plCar.mileage).toLocaleString("en-MY")} km` : null, plCar.transmission].filter(Boolean).join(" · ")}
                      </p>
                      {(plCar.vin_number || plCar.plate_number) && (
                        <p style={{ margin: "3px 0 0", fontSize: T.size.xs, color: C.textMuted, fontFamily: "monospace" }}>
                          {[plCar.plate_number && `${t("salesmanLite.drawer.plateLabel")} ${plCar.plate_number}`, plCar.vin_number && `${t("salesmanLite.drawer.vinLabel")} ${plCar.vin_number}`].filter(Boolean).join("  ·  ")}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "10px 20px", borderBottom: `1px solid ${C.fillStrong}`, background: C.fillSubtle, display: "flex", alignItems: "center", gap: 8 }}>
                    <Car size={14} style={{ color: C.textDim }} />
                    <span style={{ fontSize: T.size.sm, color: C.textMuted }}>{t("salesmanLite.drawer.noCarLinkedRow")}</span>
                  </div>
                )}

                {/* scrollable body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, WebkitOverflowScrolling: "touch" }}>

                  {/* CONTACT — this panel used to show the phone only as a grey
                      subtitle under the name, with no way to add or fix one. A
                      chat lead arrives with no number at all, so the empty row
                      is the one that matters. */}
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: T.size.xs, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{t("salesmanLite.drawer.contact", { defaultValue: "Contact" })}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1, borderRadius: R.md, overflow: "hidden", border: `1px solid ${C.border}` }}>
                      {plThread && (
                        <button
                          onClick={() => setChatSheet({ threadId: plThread.id, buyerName: pl.buyer_name || "Buyer", carLabel: plCarName })}
                          style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", background: C.fillSubtle, border: "none", width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}
                        >
                          <MessageSquare size={12} color={C.textMuted} style={{ flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: T.size.sm, color: C.text }}>{t("salesmanLite.drawer.inAppChat", { defaultValue: "In-app chat" })}</span>
                          {plThread.seller_unread > 0 && (
                            <span style={{ flexShrink: 0, minWidth: 17, height: 17, borderRadius: 99, background: C.accent, color: "#fff", fontSize: T.size.xs, fontWeight: T.weight.bold, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                              {plThread.seller_unread}
                            </span>
                          )}
                          <ChevronRight size={13} color={C.textDim} style={{ flexShrink: 0 }} />
                        </button>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", background: C.fillSubtle }}>
                        <Phone size={12} color={C.textMuted} style={{ flexShrink: 0 }} />
                        {editPhoneLeadId === pl.id ? (
                          <>
                            <input
                              autoFocus
                              type="tel"
                              inputMode="tel"
                              value={editPhoneVal}
                              onChange={(e) => setEditPhoneVal(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveLeadPhone(pl.id); if (e.key === "Escape") setEditPhoneLeadId(null); }}
                              placeholder="012 345 6789"
                              aria-label={t("salesmanLite.drawer.phoneLabel", { defaultValue: "Buyer phone number" })}
                              style={{ flex: 1, minWidth: 0, background: C.line, border: `1px solid ${withAlpha(C.accent, 0.3)}`, borderRadius: R.sm, color: C.text, fontSize: T.size.sm, padding: "5px 9px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                            />
                            <button onClick={() => saveLeadPhone(pl.id)} disabled={phoneSavingId === pl.id}
                              style={{ flexShrink: 0, fontSize: T.size.sm, padding: "5px 11px", borderRadius: R.sm, background: withAlpha(C.accent, 0.12), border: `1px solid ${withAlpha(C.accent, 0.22)}`, color: C.dangerText, cursor: "pointer", fontWeight: T.weight.semibold, fontFamily: "inherit", opacity: phoneSavingId === pl.id ? 0.5 : 1 }}>
                              {phoneSavingId === pl.id ? "\u2026" : t("salesmanLite.drawer.save")}
                            </button>
                            <button onClick={() => setEditPhoneLeadId(null)} aria-label={t("salesmanLite.drawer.cancel")}
                              style={{ flexShrink: 0, background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 2, display: "flex" }}>
                              <X size={13} />
                            </button>
                          </>
                        ) : pl.phone ? (
                          <>
                            <a href={`tel:${pl.phone}`} style={{ flex: 1, minWidth: 0, fontSize: T.size.sm, color: C.text, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.phone}</a>
                            <button onClick={() => { setEditPhoneLeadId(pl.id); setEditPhoneVal(pl.phone || ""); }} aria-label={t("salesmanLite.drawer.editPhone", { defaultValue: "Edit phone number" })}
                              style={{ flexShrink: 0, background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 2, display: "flex" }}>
                              <Pencil size={11} />
                            </button>
                            {String(pl.phone).replace(/\D/g, "").length >= 9 && (
                              <a href={`https://wa.me/${(() => { const dg = String(pl.phone).replace(/\D/g, ""); return dg.startsWith("6") ? dg : "6" + dg; })()}`} target="_blank" rel="noopener noreferrer"
                                style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, fontSize: T.size.sm, padding: "3px 8px", borderRadius: R.sm, background: withAlpha(C.success, 0.1), border: `1px solid ${withAlpha(C.success, 0.25)}`, color: C.successText, textDecoration: "none" }}>
                                <MessageCircle size={10} /> WhatsApp
                              </a>
                            )}
                          </>
                        ) : (
                          <button onClick={() => { setEditPhoneLeadId(pl.id); setEditPhoneVal(""); }}
                            style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, color: C.textMuted, fontSize: T.size.sm, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                            <Plus size={11} />
                            {plThread
                              ? t("salesmanLite.drawer.addPhoneWhenShared", { defaultValue: "Add their number when they share it" })
                              : t("salesmanLite.drawer.addPhone", { defaultValue: "Add phone number" })}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: T.size.xs, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{t("salesmanLite.drawer.notes")}</p>
                    {editingNoteId === pl.id ? (
                      <div>
                        <textarea autoFocus value={editNoteVal} onChange={e => setEditNoteVal(e.target.value)} rows={3} style={{ width: "100%", background: C.line, border: `1px solid ${withAlpha(C.accent, 0.3)}`, borderRadius: R.md, color: C.text, fontSize: T.size.base, padding: "8px 11px", resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button onClick={() => saveLeadNote(pl.id)} disabled={notesSavingId === pl.id} style={{ fontSize: T.size.sm, padding: "7px 14px", borderRadius: R.md, background: withAlpha(C.accent, 0.12), border: `1px solid ${withAlpha(C.accent, 0.22)}`, color: C.dangerText, cursor: "pointer", fontWeight: T.weight.semibold, opacity: notesSavingId === pl.id ? 0.5 : 1 }}>{notesSavingId === pl.id ? "…" : t("salesmanLite.drawer.save")}</button>
                          <button onClick={() => setEditingNoteId(null)} style={{ fontSize: T.size.sm, padding: "7px 14px", borderRadius: R.md, background: C.line, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer" }}>{t("salesmanLite.drawer.cancel")}</button>
                        </div>
                      </div>
                    ) : pl.notes ? (
                      <p onClick={() => { setEditingNoteId(pl.id); setEditNoteVal(pl.notes || ""); }} style={{ margin: 0, fontSize: T.size.base, color: C.textSec, fontStyle: "italic", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                        <Pencil size={12} /> "{pl.notes}"
                      </p>
                    ) : (
                      <button onClick={() => { setEditingNoteId(pl.id); setEditNoteVal(""); }} style={{ fontSize: T.size.base, padding: "8px 12px", borderRadius: R.md, background: C.fillSubtle, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit", width: "100%" }}>
                        <Pencil size={12} /> {t("salesmanLite.drawer.addNote")}
                      </button>
                    )}
                  </div>

                  {/* Tool row 1 */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { const price = pl.car_listings?.selling_price || ""; setLoanPrice(String(price)); setLoanCalcLead(pl); }} style={{ fontSize: T.size.sm, padding: "7px 12px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <DollarSign size={12} /> {t("salesmanLite.drawer.loanCalc")}
                    </button>
                    <button onClick={() => { setLogCallLeadId(pl.id); setCallOutcome("answered"); setCallNote(""); }} style={{ fontSize: T.size.sm, padding: "7px 12px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <PhoneCall size={12} /> {t("salesmanLite.drawer.logCall")}
                    </button>
                    <button onClick={() => { setFollowUpModalLead(pl); setFollowUpDate(pl.follow_up_at ? pl.follow_up_at.slice(0,10) : ""); }} style={{ fontSize: T.size.sm, padding: "7px 12px", borderRadius: R.md, background: pl.follow_up_at ? withAlpha(C.warn, 0.12) : C.fill, border: pl.follow_up_at ? `1px solid ${withAlpha(C.warn, 0.3)}` : `1px solid ${C.border}`, color: pl.follow_up_at ? C.warnText : C.textSec, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <Clock size={12} /> {t("salesmanLite.drawer.setReminder")}
                    </button>
                  </div>

                  {/* Tool row 2 */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { if (expandedActivityLeadId === pl.id) setExpandedActivityLeadId(null); else fetchLeadActivities(pl.id); }} style={{ fontSize: T.size.sm, padding: "7px 12px", borderRadius: R.md, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", background: expandedActivityLeadId === pl.id ? withAlpha(C.infoText, 0.12) : C.fill, border: `1px solid ${expandedActivityLeadId === pl.id ? withAlpha(C.infoText, 0.3) : C.border}`, color: expandedActivityLeadId === pl.id ? C.infoTextHi : C.textSec }}>
                      <History size={12} /> {t("salesmanLite.drawer.history")}
                    </button>
                    {pl.stage === "deposit_taken" && (
                      <button onClick={() => { setDepositModal(pl); setDepositAmount(""); setDepositCopied(false); }} style={{ fontSize: T.size.sm, padding: "7px 12px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, cursor: "pointer", fontFamily: "inherit" }}>
                        {t("salesmanLite.drawer.receipt")}
                      </button>
                    )}
                    <button onClick={() => setLinkCarLeadId(pl.id)} style={{ fontSize: T.size.sm, padding: "7px 12px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <Car size={12} /> {pl.car_listing_id ? t("salesmanLite.drawer.changeCar") : t("salesmanLite.drawer.linkCar")}
                    </button>
                  </div>

                  {/* Activity timeline */}
                  {expandedActivityLeadId === pl.id && (
                    <div style={{ background: C.fillSubtle, border: `1px solid ${C.fillStrong}`, borderRadius: R.md, padding: "12px 14px" }}>
                      <p style={{ margin: "0 0 10px", fontSize: T.size.xs, fontWeight: T.weight.bold, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("salesmanLite.drawer.activityHistory")}</p>
                      {activitiesLoadingId === pl.id ? (
                        <p style={{ fontSize: T.size.sm, color: C.textDim, margin: 0 }}>{t("salesmanLite.drawer.loading")}</p>
                      ) : (leadActivities[pl.id] || []).length === 0 ? (
                        <p style={{ fontSize: T.size.sm, color: C.textDim, margin: 0 }}>{t("salesmanLite.drawer.noActivity")}</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {(leadActivities[pl.id] || []).map((act, i) => {
                            const ActIcon = act.activity_type === "whatsapp_sent" ? MessageSquare : act.activity_type === "call_logged" ? Phone : act.activity_type === "stage_changed" ? RefreshCw : Pencil;
                            return (
                              <div key={act.id || i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                <ActIcon size={13} style={{ flexShrink: 0, marginTop: 2, color: C.textMuted }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: T.size.base, color: C.textSec }}>{act.activity_type === "stage_changed" ? `${act.from_stage ? stageLabel(act.from_stage) : "?"} → ${act.to_stage ? stageLabel(act.to_stage) : "?"}` : act.note || act.activity_type}</p>
                                  <p style={{ margin: 0, fontSize: T.size.sm, color: C.textDim }}>{timeAgo(act.created_at)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add-ons — paid upsells from the salesman's own catalogue,
                      attached to this specific deal (deal_products). */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <p style={{ margin: 0, fontSize: T.size.xs, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{t("salesmanLite.drawer.addons.title")}</p>
                      {dealAddons.length > 0 && (
                        <span style={{ fontSize: T.size.sm, fontWeight: T.weight.bold, color: C.dangerText }}>
                          RM {dealAddons.reduce((s, a) => s + Number(a.sold_price), 0).toLocaleString("en-MY")}
                        </span>
                      )}
                    </div>
                    {addonsLoading ? (
                      <p style={{ fontSize: T.size.sm, color: C.textDim, margin: 0 }}>{t("salesmanLite.drawer.loading")}</p>
                    ) : (
                      <>
                        {dealAddons.map((a) => (
                          <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", marginBottom: 4, background: C.fillSubtle, border: `1px solid ${C.border}`, borderRadius: R.md }}>
                            <span style={{ fontSize: T.size.base, color: C.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.dealer_products?.name || "—"}</span>
                            <span style={{ fontSize: T.size.sm, fontWeight: T.weight.semibold, color: C.dangerText, flexShrink: 0 }}>RM {Number(a.sold_price).toLocaleString("en-MY")}</span>
                            <button onClick={() => handleRemoveAddon(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, display: "flex", padding: 2, flexShrink: 0 }}>
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                        {!showAttachAddon ? (
                          <button onClick={() => { setShowAttachAddon(true); setAddonForm({ product_id: "", sold_price: "" }); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, width: "100%", fontSize: T.size.sm, fontWeight: T.weight.semibold, padding: "8px 12px", borderRadius: R.md, background: withAlpha(C.accent, 0.08), border: `1px solid ${withAlpha(C.accent, 0.22)}`, color: C.dangerText, cursor: "pointer", fontFamily: "inherit" }}>
                            <Plus size={12} /> {t("salesmanLite.drawer.addons.attachCta")}
                          </button>
                        ) : (
                          <div style={{ background: C.fillSubtle, border: `1px solid ${C.border}`, borderRadius: R.md, padding: 12 }}>
                            {addonCatalogue.length === 0 ? (
                              <p style={{ fontSize: T.size.sm, color: C.textMuted, margin: "0 0 8px" }}>{t("salesmanLite.drawer.addons.empty")}</p>
                            ) : (
                              <>
                                <select
                                  value={addonForm.product_id}
                                  onChange={(e) => { const sel = addonCatalogue.find((p) => p.id === e.target.value); setAddonForm((f) => ({ ...f, product_id: e.target.value, sold_price: sel ? String(sel.selling_price) : f.sold_price })); }}
                                  style={{ width: "100%", background: C.line, border: `1px solid ${C.borderStrong}`, borderRadius: R.md, padding: "8px 10px", color: C.text, fontSize: T.size.sm, fontFamily: "inherit", marginBottom: 6, boxSizing: "border-box" }}
                                >
                                  <option value="">{t("salesmanLite.drawer.addons.selectProduct")}</option>
                                  {addonCatalogue.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name} — RM {Number(p.selling_price).toLocaleString("en-MY")}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min="0"
                                  value={addonForm.sold_price}
                                  onChange={(e) => setAddonForm((f) => ({ ...f, sold_price: e.target.value }))}
                                  placeholder={t("salesmanLite.drawer.addons.pricePlaceholder")}
                                  style={{ width: "100%", background: C.line, border: `1px solid ${C.borderStrong}`, borderRadius: R.md, padding: "8px 10px", color: C.text, fontSize: T.size.sm, fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box" }}
                                />
                              </>
                            )}
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => setShowAttachAddon(false)} style={{ flex: 1, padding: "7px", borderRadius: R.md, background: C.line, border: `1px solid ${C.border}`, color: C.textMuted, fontSize: T.size.sm, cursor: "pointer", fontFamily: "inherit" }}>{t("salesmanLite.drawer.cancel")}</button>
                              {addonCatalogue.length > 0 && (
                                <button onClick={handleAttachAddon} disabled={attachingAddon || !addonForm.product_id || !addonForm.sold_price} style={{ flex: 1, padding: "7px", borderRadius: R.md, background: C.accent, border: "none", color: C.onAccent, fontSize: T.size.sm, fontWeight: T.weight.semibold, cursor: "pointer", opacity: (!addonForm.product_id || !addonForm.sold_price || attachingAddon) ? 0.5 : 1, fontFamily: "inherit" }}>
                                  {attachingAddon ? t("salesmanLite.drawer.addons.adding") : t("salesmanLite.drawer.addons.submit")}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop: `1px solid ${C.fillStrong}` }} />

                  {/* Lost / Delete zone */}
                  {plIsPromptingLost ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: T.size.sm, color: C.textSec, fontWeight: T.weight.semibold, marginRight: 2 }}>{t("salesmanLite.drawer.whyLost")}</span>
                      {LOST_REASONS.map(r => (
                        <button key={r} onClick={() => handleLostReason(pl.id, r)} disabled={lostSavingId === pl.id} style={{ fontSize: T.size.sm, padding: "6px 10px", borderRadius: R.pill, background: withAlpha(C.textSec, 0.08), border: `1px solid ${withAlpha(C.textSec, 0.2)}`, color: C.textSec, cursor: "pointer", opacity: lostSavingId === pl.id ? 0.5 : 1, fontFamily: "inherit" }}>
                          {lostSavingId === pl.id ? "…" : t("salesmanLite.drawer.lostReasons." + r.toLowerCase())}
                        </button>
                      ))}
                      <button onClick={() => setLostPromptId(null)} style={{ fontSize: T.size.sm, padding: "6px 10px", background: "transparent", border: "none", color: C.textDim, cursor: "pointer" }}>✕</button>
                    </div>
                  ) : plIsConfirmingDelete ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: T.size.base, color: C.dangerText, fontWeight: T.weight.semibold }}>{t("salesmanLite.drawer.deleteLeadQ")}</span>
                      <button onClick={() => handleDeleteLead(pl.id)} disabled={deletingLeadId === pl.id} style={{ fontSize: T.size.sm, padding: "7px 14px", borderRadius: R.md, background: withAlpha(C.danger, 0.12), border: `1px solid ${withAlpha(C.danger, 0.3)}`, color: C.dangerText, cursor: "pointer", fontWeight: T.weight.semibold, opacity: deletingLeadId === pl.id ? 0.5 : 1, fontFamily: "inherit" }}>{deletingLeadId === pl.id ? "…" : t("salesmanLite.drawer.yesDelete")}</button>
                      <button onClick={() => setDeleteConfirmId(null)} style={{ fontSize: T.size.sm, padding: "7px 14px", borderRadius: R.md, background: C.line, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{t("salesmanLite.drawer.no")}</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      {pl.stage !== "won" && pl.stage !== "closed_won" && (
                        <button onClick={() => { setDeleteConfirmId(null); setLostPromptId(pl.id); }} style={{ fontSize: T.size.base, padding: "8px 14px", borderRadius: R.md, background: withAlpha(C.danger, 0.06), border: `1px solid ${withAlpha(C.danger, 0.3)}`, color: C.dangerText, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                          {t("salesmanLite.drawer.markLost")}
                        </button>
                      )}
                      <button onClick={() => { setLostPromptId(null); setDeleteConfirmId(pl.id); }} style={{ fontSize: T.size.base, padding: "8px 14px", borderRadius: R.md, background: C.fill, border: `1px solid ${C.border}`, color: C.textDim, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                        <Trash2 size={13} /> {t("salesmanLite.drawer.delete")}
                      </button>
                    </div>
                  )}

                </div>
              </div>
            </>
          );
        })()}

      </div>
    );
  };

  // ── RENDER ENQUIRIES ─────────────────────────────────────────────────────

  const renderEnquiries = () => {
    // Lead History log — LEAD-CENTRIC: every lead is its own entry so a new lead
    // never disappears. Previously this listed enquiries first and only added
    // leads whose phone wasn't already in the enquiry set, so multiple leads
    // sharing a phone (or any lead whose phone matched an old enquiry) collapsed
    // behind a single enquiry row and looked "missing". Now every lead shows,
    // and only PURE enquiries (no lead yet on that phone) are appended so a
    // brand-new, not-yet-converted enquiry still surfaces with its quick actions.
    const leadByPhone = new Map();
    leads.forEach((l) => {
      const p = normalizePhone(l.phone);
      if (p && !leadByPhone.has(p)) leadByPhone.set(p, l);
    });
    const leadPhones = new Set(leads.map((l) => normalizePhone(l.phone)).filter(Boolean));
    const leadItems = leads.map((l) => ({
      id: `lead_${l.id}`,
      buyer_name: l.buyer_name,
      buyer_phone: l.phone,
      buyer_message: l.notes,
      status: "has_lead",
      created_at: l.created_at,
      car_listings: l.car_listings,
      _lead: l,
    }));
    const pureEnquiries = enquiries.filter((e) => {
      const p = normalizePhone(e.buyer_phone);
      return !p || !leadPhones.has(p);
    });
    const historyItems = [...pureEnquiries, ...leadItems];

    return (
    <div>
      <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>
        {t("salesmanLite.inbox.leadHistory")} ({historyItems.length})
      </p>
      {historyItems.length === 0 && (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#374151" }}>
          <MessageSquare size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: 13 }}>{t("salesmanLite.inbox.noLeadHistory")}</p>
          <p style={{ margin: "6px 0 14px", fontSize: 12, color: "#374151" }}>{t("salesmanLite.inbox.noLeadHistorySub")}</p>
          <button onClick={() => setActiveTab("listings")} style={{ fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 8, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.22)", color: "#f87171", cursor: "pointer" }}>
            {t("salesmanLite.inbox.goToListings")}
          </button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[...historyItems].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((enq) => {
          const car = enq.car_listings;
          const isNew = enq.status === "new";
          const matchedLead = enq._lead || leadByPhone.get(normalizePhone(enq.buyer_phone));
          const liveStage = matchedLead?.stage;
          const stageC = liveStage ? (STAGE_COLOR[liveStage] || STAGE_NEUTRAL) : null;
          const isExpanded = expandedEnqId === enq.id;
          return (
            <div
              key={enq.id}
              onClick={() => setExpandedEnqId(isExpanded ? null : enq.id)}
              style={{
                background: "#0d1117",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10,
                padding: isNew ? "12px 14px" : "8px 14px",
                opacity: isNew ? 1 : 0.85,
                cursor: "pointer",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>
                  {enq.buyer_name || "—"}
                </p>
                {isNew ? (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, flexShrink: 0, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", color: "#93c5fd" }}>
                    {t("salesmanLite.inbox.new")}
                  </span>
                ) : liveStage ? (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, flexShrink: 0, background: stageC.bg, border: `1px solid ${stageC.border}`, color: stageC.tx, textTransform: "capitalize" }}>
                    {liveStage.replace(/_/g, " ")}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, flexShrink: 0, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80", textTransform: "capitalize" }}>
                    {t("salesmanLite.inbox.convertedToLead")}
                  </span>
                )}
              </div>
              {/* Car name */}
              {car && (
                <p style={{ margin: "0 0 4px", fontSize: 12, color: "#9ca3af" }}>
                  {[car.year, car.brand, car.model].filter(Boolean).join(" ")}
                </p>
              )}
              {/* Message — always show when expanded or new */}
              {(isNew || isExpanded) && enq.buyer_message && (
                <div style={{ margin: "4px 0 8px", padding: "8px 11px", background: "rgba(255,255,255,0.05)", borderRadius: 6 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {enq.buyer_message}
                  </p>
                </div>
              )}
              {/* Phone — show when new or expanded */}
              {(isNew || isExpanded) && enq.buyer_phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px" }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#6b7280", display: "inline-flex", alignItems: "center", gap: 5 }}><Phone size={12} /> {enq.buyer_phone}</p>
                  {isExpanded && (
                    <a
                      href={`https://wa.me/${enq.buyer_phone.replace(/\D/g, "").replace(/^0/, "6")}?text=${encodeURIComponent(`Hi ${enq.buyer_name || ""}! 😊`)}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#4ade80", textDecoration: "none" }}
                    >WA</a>
                  )}
                </div>
              )}
              {/* Timestamp */}
              <p style={{ margin: isNew ? "0 0 8px" : 0, fontSize: 11, color: "#4b5563" }}>
                {preciseAgo(enq.created_at, nowTick, timeLabels)}
              </p>
              {/* Action buttons — unreplied only, max 2 */}
              {isNew && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {enq.buyer_phone && (
                    <button
                      onClick={async () => {
                        const phone = enq.buyer_phone.replace(/\D/g, "");
                        const enqCar = enq.car_listings;
                        const carName = enqCar ? `${enqCar.brand} ${enqCar.model}` : "kereta";
                        const msg = encodeURIComponent(`Hi ${enq.buyer_name || ""}! Thank you for your enquiry on the ${carName}. I'm here to help — when would be a good time to chat? 😊`);
                        // Persist first, WhatsApp hand-off last — navigating the
                        // current tab to WhatsApp can suspend the page before
                        // pending writes finish.
                        await supabase.from("whatsapp_enquiries").update({ status: "responded" }).eq("id", enq.id);
                        setEnquiries((p) => p.map((e) => e.id === enq.id ? { ...e, status: "responded" } : e));
                        await autoCreateLeadFromEnq(enq);
                        window.location.href = `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${msg}`;
                      }}
                      style={{ fontSize: 10, padding: "6px 11px", borderRadius: 6, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#4ade80", cursor: "pointer" }}
                    >
                      {t("salesmanLite.inbox.waReply")}
                    </button>
                  )}
                  {enq.buyer_phone && (
                    <button
                      onClick={() => setOpenTemplateId(openTemplateId === enq.id ? null : enq.id)}
                      style={{ fontSize: 10, padding: "6px 11px", borderRadius: 6, background: openTemplateId === enq.id ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${openTemplateId === enq.id ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.08)"}`, color: openTemplateId === enq.id ? "#f87171" : "#6b7280", cursor: "pointer" }}
                    >
                      {t("salesmanLite.inbox.templates")} ▾
                    </button>
                  )}
                </div>
              )}
              {/* Template picker */}
              {isNew && openTemplateId === enq.id && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    { key: "chat", label: t("salesmanLite.inbox.templateChat"), color: "#4ade80" },
                    { key: "test_drive", label: t("salesmanLite.inbox.templateTestDrive"), color: "#60a5fa" },
                    { key: "budget", label: t("salesmanLite.inbox.templateBudget"), color: "#fbbf24" },
                    { key: "deposit", label: t("salesmanLite.inbox.templateDeposit"), color: "#f87171" },
                  ].map(({ key, label, color }) => {
                    const toastKey = enq.id + "_" + key;
                    return (
                      <button
                        key={key}
                        onClick={() => fireTemplate(enq, key)}
                        style={{ textAlign: "left", fontSize: 11, padding: "7px 10px", borderRadius: 7, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: templateToast === toastKey ? color : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        {templateToast === toastKey ? `✓ ${t("salesmanLite.inbox.sent")}` : label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    );
  };

  // ── RENDER BOOKINGS ───────────────────────────────────────────────────────

  const renderBookings = () => {
    const aptIsToday = (iso) => {
      if (!iso) return false;
      const d = new Date(iso), t = new Date();
      return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
    };
    const aptIsNew = (iso) => iso && Date.now() - new Date(iso).getTime() < 2 * 60 * 60 * 1000;

    const statusColors = {
      pending:     { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",  tx: "#fbbf24" },
      confirmed:   { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)",   tx: "#4ade80" },
      rescheduled: { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)", tx: "#c084fc" },
      cancelled:   { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)",   tx: "#f87171" },
      completed:   { bg: "rgba(107,114,128,0.12)", border: "rgba(107,114,128,0.3)", tx: "#9ca3af" },
      no_show:     { bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.3)",  tx: "#fb923c" },
    };

    const setAptStatus = async (apt, status) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", apt.id);
      if (error) { toast.error(t("salesmanLite.toast.bookingUpdateFailed")); return; }
      setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, status } : a));
    };

    const buildReminderMessage = (apt) => {
      const aptDate = new Date(apt.appointment_date);
      const dateStr = aptDate.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" });
      const timeStr = aptDate.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
      return `Hi ${apt.buyer_name || ""}! Just a reminder for your appointment on ${dateStr}${timeStr ? ` at ${timeStr}` : ""}. See you then! 😊`;
    };

    // Prefilled (editable) confirmation message for the Confirm Booking modal.
    // Delegates to the component-scope builder so the Bookings tab and the
    // unconfirmed-booking cards in the Booked pipeline stage never drift apart.
    const buildConfirmMessage = buildConfirmBookingMsg;

    const openConfirmModal = (apt) => {
      setConfirmBookingMsg(buildConfirmMessage(apt));
      setConfirmBookingApt(apt);
      setReschedulingAptId(null);
      setCancelConfirmId(null);
      setReminderPickerAptId(null);
    };

    const fmtAptDate = (iso) => {
      if (!iso) return { dateStr: "—", timeStr: "" };
      const d = new Date(iso);
      if (isNaN(d)) return { dateStr: "—", timeStr: "" };
      return {
        dateStr: d.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" }),
        timeStr: d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }),
      };
    };

    const asc = (a, b) => new Date(a.appointment_date) - new Date(b.appointment_date);
    const newestBooked = (a, b) => new Date(b.created_at) - new Date(a.created_at);
    const newestApt = (a, b) => new Date(b.appointment_date) - new Date(a.appointment_date);

    // Pending bookings are requests, not commitments yet — a window-shopper
    // tap shouldn't sit on the calendar next to real confirmed viewings. They
    // get their own always-visible section (any date) so the salesman can
    // still act on them; only once confirmed do they join Today/Upcoming/Past.
    const pendingApts = appointments.filter((a) => a.status === "pending").sort(newestBooked);
    const confirmedApts = appointments.filter((a) => a.status !== "pending" && a.status !== "cancelled");
    const todayApts = confirmedApts.filter((a) => aptIsToday(a.appointment_date)).sort(asc);
    const upcomingApts = confirmedApts.filter((a) => {
      if (!a.appointment_date) return false;
      const d = new Date(a.appointment_date);
      return !isNaN(d) && !aptIsToday(a.appointment_date) && d > new Date();
    }).sort(newestBooked);
    const pastApts = confirmedApts.filter((a) => {
      if (!a.appointment_date) return false;
      const d = new Date(a.appointment_date);
      return !isNaN(d) && !aptIsToday(a.appointment_date) && d < new Date();
    }).sort(newestApt);

    const calcRemindAt = (apt, offsetKey) => {
      const aptDate = new Date(apt.appointment_date);
      if (offsetKey === "day_before") {
        const d = new Date(aptDate); d.setDate(d.getDate() - 1); d.setHours(9, 0, 0, 0); return d;
      }
      if (offsetKey === "two_days") {
        const d = new Date(aptDate); d.setDate(d.getDate() - 2); d.setHours(9, 0, 0, 0); return d;
      }
      const mins = { "1h": -60, "2h": -120 };
      return new Date(aptDate.getTime() + (mins[offsetKey] ?? -60) * 60000);
    };

    const saveReminder = async (apt, remindAt) => {
      setReminderSaving(true);
      const { error } = await supabase.from("appointments").update({ remind_at: remindAt.toISOString(), remind_sent: false }).eq("id", apt.id);
      setReminderSaving(false);
      if (error) { toast.error(t("salesmanLite.toast.reminderSaveFailed")); return; }
      setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, remind_at: remindAt.toISOString(), remind_sent: false } : a));
      setReminderPickerAptId(null);
      setSelectedRemindAt(null);
      toast.success(t("salesmanLite.toast.telegramReminderSet", { time: remindAt.toLocaleTimeString(i18n.language === "ms" ? "ms-MY" : "en-MY", { hour: "2-digit", minute: "2-digit" }) }));
    };

    const clearReminder = async (apt) => {
      await supabase.from("appointments").update({ remind_at: null, remind_sent: false }).eq("id", apt.id);
      setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, remind_at: null } : a));
    };

    const renderApptCard = (apt) => {
      const car = apt.car_listings;
      const { dateStr, timeStr } = fmtAptDate(apt.appointment_date);
      const sc = statusColors[apt.status] || statusColors.pending;
      const isRescheduled = apt.status === "rescheduled";
      const isFuture = apt.appointment_date && new Date(apt.appointment_date) > new Date(nowTick);
      const carTitle = car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : "No car linked";
      const carPrice = car?.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : null;
      const initials = (apt.buyer_name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
      const phone = (apt.buyer_phone || "").replace(/\D/g, "");
      // A booking can be confirmed while it's still a live request.
      const canConfirm = apt.status !== "confirmed" && apt.status !== "cancelled" && apt.status !== "completed";

      // Compact card, sized like the pipeline lead card: header (buyer + status),
      // car + price line, one highlighted date line, then a slim action row.
      // Full details (car image, VIN, notes) + secondary actions (reschedule,
      // reminder, cancel) live behind the ··· detail popup, mirroring the lead
      // card's ··· → drawer.
      return (
        <div key={apt.id} style={{ background: "#1b2431", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px 0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(96,165,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 600, color: "#93c5fd" }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{apt.buyer_name || "Unknown Buyer"}</p>
                    {aptIsNew(apt.created_at) && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.35)", color: "#f87171", flexShrink: 0 }}>NEW</span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 99, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.tx, textTransform: "capitalize", flexShrink: 0 }}>
                    {t("salesmanLite.inbox.status." + apt.status, { defaultValue: apt.status })}
                  </span>
                </div>
                {(carTitle || carPrice) && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 3, gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{carTitle}</p>
                    {carPrice && <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#f8fafc", flexShrink: 0 }}>{carPrice}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Date line — the one highlighted data element on the card */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: isRescheduled ? "#c084fc" : "#bfdbfe", padding: "4px 10px", borderRadius: 7, background: isRescheduled ? "rgba(167,139,250,0.12)" : "rgba(96,165,250,0.12)", border: `1px solid ${isRescheduled ? "rgba(167,139,250,0.35)" : "rgba(96,165,250,0.28)"}` }}>
                <Calendar size={13} /> {dateStr}{timeStr ? ` · ${timeStr}` : ""}
              </span>
              {isFuture && <span style={{ fontSize: 11, fontWeight: 600, color: "#4ade80" }}>{preciseUntil(apt.appointment_date, nowTick, timeLabels)}</span>}
              {apt.remind_at && !apt.remind_sent && <Bell size={12} color="#fbbf24" />}
            </div>
          </div>

          {/* Action row — primary CTA + call + ··· details, like the lead card */}
          <div style={{ display: "flex", gap: 6, padding: "0 14px 12px" }}>
            {canConfirm && apt.buyer_phone && (
              <button onClick={() => openConfirmModal(apt)} title="Confirm this booking and message the buyer on WhatsApp"
                style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 7, background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.38)", color: "#4ade80", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <Check size={13} /> {t("salesmanLite.inbox.confirmBooking")}
              </button>
            )}
            {canConfirm && !apt.buyer_phone && (
              <button onClick={async () => { await updateApptStatus(apt.id, "confirmed"); await autoUpsertLeadFromAppt(apt); await scheduleAptReminder(apt); }} title="Mark appointment as confirmed"
                style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 7, background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.38)", color: "#4ade80", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <Check size={13} /> {t("salesmanLite.inbox.confirmBooking")}
              </button>
            )}
            {apt.status === "confirmed" && apt.buyer_phone && (
              <button onClick={() => {
                  const p = apt.buyer_phone.replace(/\D/g, "");
                  const msg = buildReminderMessage(apt);
                  window.location.href = `https://wa.me/${p.startsWith("6") ? p : "6" + p}?text=${encodeURIComponent(msg)}`;
                }} title="Send WhatsApp reminder message to buyer"
                style={{ flex: 1, fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 7, background: "rgba(37,211,102,0.10)", border: "1px solid rgba(37,211,102,0.28)", color: "#4ade80", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <MessageCircle size={13} /> {t("salesmanLite.inbox.message")}
              </button>
            )}
            {phone && (
              <a href={`tel:${phone}`} title="Call" aria-label="Call buyer"
                style={{ flexShrink: 0, fontSize: 11, padding: "6px 10px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Phone size={13} />
              </a>
            )}
            <button onClick={() => setBookingDetailId(apt.id)} title="Booking details" aria-label="Booking details"
              style={{ flexShrink: 0, fontSize: 13, padding: "6px 10px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", letterSpacing: "0.05em", lineHeight: 1 }}>
              ···
            </button>
          </div>
        </div>
      );
    };

    // Full booking detail popup — opened from a card's ··· button. Holds the car
    // image + VIN + notes and the secondary actions (reschedule / set reminder /
    // cancel) so the card itself stays compact. Portal + body-scroll-lock per the
    // overlay rules; tapping the backdrop or × closes it.
    const secBtn = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
    const renderBookingDetailModal = () => {
      const apt = appointments.find((a) => a.id === bookingDetailId);
      if (!apt) return null;
      const car = apt.car_listings;
      const { dateStr, timeStr } = fmtAptDate(apt.appointment_date);
      const sc = statusColors[apt.status] || statusColors.pending;
      const isRescheduling = reschedulingAptId === apt.id;
      const isReminderPicking = reminderPickerAptId === apt.id;
      const isCancelConfirm = cancelConfirmId === apt.id;
      const notCancelled = apt.status !== "cancelled" && apt.status !== "completed";
      const anyExpander = isRescheduling || isReminderPicking || isCancelConfirm;
      const carImg = Array.isArray(car?.images) ? car.images[0] : null;
      const carTitle = car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : "No car linked";
      const carVariant = car?.variant || "";
      const carVin = car?.vin_number || car?.plate_number || "";
      const carPrice = car?.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : null;
      const isFuture = apt.appointment_date && new Date(apt.appointment_date) > new Date(nowTick);
      const close = () => { setBookingDetailId(null); setReschedulingAptId(null); setReminderPickerAptId(null); setCancelConfirmId(null); setRescheduleDate(""); setSelectedRemindAt(null); };

      return createPortal(
        <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", background: "#1b2431", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px 16px 0 0", padding: 20, fontFamily: "system-ui, sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 99, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.tx, textTransform: "capitalize" }}>
                {t("salesmanLite.inbox.status." + apt.status, { defaultValue: apt.status })}
              </span>
              <button onClick={close} aria-label="Close" style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} />
              </button>
            </div>

            {/* Car */}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14 }}>
              {carImg ? (
                <img src={carImg} alt="" style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 8, flexShrink: 0, border: "1px solid rgba(255,255,255,0.1)" }} />
              ) : (
                <div style={{ width: 84, height: 64, borderRadius: 8, flexShrink: 0, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Car size={20} color="#4b5563" />
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{carTitle}</p>
                {carVariant && <p style={{ margin: "0 0 3px", fontSize: 12, color: "#93c5fd" }}>{carVariant}</p>}
                {carPrice && <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 700, color: "#4ade80" }}>{carPrice}</p>}
                {carVin && <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>{car?.vin_number ? "VIN " : "Plate "}{carVin}</p>}
              </div>
            </div>

            {/* Buyer */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{apt.buyer_name || "Unknown Buyer"}</p>
              {apt.buyer_phone && <p style={{ margin: "0 0 4px", fontSize: 13, color: "#cbd5e1", display: "inline-flex", alignItems: "center", gap: 6 }}><Phone size={13} /> {apt.buyer_phone}</p>}
              {apt.notes && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>&quot;{apt.notes}&quot;</p>}
            </div>

            {/* Date */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "10px 14px", borderRadius: 10, background: "rgba(96,165,250,0.10)", border: "1px solid rgba(96,165,250,0.28)", marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#bfdbfe", display: "inline-flex", alignItems: "center", gap: 6 }}><Calendar size={14} /> {dateStr}</span>
              {timeStr && <span style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>{timeStr}</span>}
              {isFuture && <span style={{ fontSize: 12, fontWeight: 600, color: "#4ade80" }}>{preciseUntil(apt.appointment_date, nowTick, timeLabels)}</span>}
            </div>

            {/* Reminder indicator */}
            {apt.remind_at && !apt.remind_sent ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 7, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)", marginBottom: 12 }}>
                <Bell size={12} color="#4ade80" />
                <span style={{ fontSize: 11, color: "#4ade80", flex: 1 }}>
                  {t("salesmanLite.inbox.reminderLabel")}: {new Date(apt.remind_at).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })} {new Date(apt.remind_at).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <button onClick={() => clearReminder(apt)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 11, cursor: "pointer", padding: 0 }}>✕</button>
              </div>
            ) : apt.remind_sent ? (
              <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 12px", display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={11} /> {t("salesmanLite.inbox.reminderSent")}</p>
            ) : null}

            {/* Secondary actions */}
            {notCancelled && !anyExpander && (
              <div style={{ display: "flex", gap: 6 }}>
                <button style={secBtn} onClick={() => {
                  const existing = apt.appointment_date ? new Date(apt.appointment_date) : new Date();
                  const pad = (n) => String(n).padStart(2, "0");
                  setRescheduleDate(`${existing.getFullYear()}-${pad(existing.getMonth() + 1)}-${pad(existing.getDate())}T${pad(existing.getHours())}:${pad(existing.getMinutes())}`);
                  setReschedulingAptId(apt.id); setCancelConfirmId(null); setReminderPickerAptId(null);
                }}><RefreshCw size={13} /> {t("salesmanLite.inbox.move")}</button>
                <button style={secBtn} onClick={() => {
                  if (!profile?.telegram_chat_id) { setTelegramSetupModal(true); return; }
                  setReminderPickerAptId(apt.id); setSelectedRemindAt(null); setCancelConfirmId(null); setReschedulingAptId(null);
                }}><Bell size={13} color={apt.remind_at ? "#fbbf24" : undefined} /> {t("salesmanLite.inbox.setReminder")}</button>
                <button style={{ ...secBtn, color: "#f87171" }} onClick={() => { setCancelConfirmId(apt.id); setReschedulingAptId(null); setReminderPickerAptId(null); }}><X size={13} /> {t("salesmanLite.inbox.cancelAppt")}</button>
              </div>
            )}

            {/* Expand: reschedule date picker */}
            {isRescheduling && (
              <div style={{ marginTop: 4, padding: "10px 12px", background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <p style={{ margin: 0, fontSize: 11, color: "#c084fc", fontWeight: 600 }}>{t("salesmanLite.inbox.chooseNewTime")}</p>
                  <button onClick={() => { setReschedulingAptId(null); setRescheduleDate(""); }} title={t("salesmanLite.inbox.cancel")} style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                    <X size={14} />
                  </button>
                </div>
                <input type="datetime-local" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 7, color: "#e5e7eb", fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box", fontFamily: "system-ui, sans-serif", marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setReschedulingAptId(null); setRescheduleDate(""); }}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>
                    {t("salesmanLite.inbox.cancel")}
                  </button>
                  <button onClick={async () => {
                      if (!rescheduleDate) return;
                      const newDate = new Date(rescheduleDate);
                      const remindAt = new Date(newDate.getTime() - 60 * 60 * 1000).toISOString();
                      await supabase.from("appointments").update({ appointment_date: newDate.toISOString(), status: "rescheduled", remind_at: remindAt, remind_sent: false }).eq("id", apt.id);
                      setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, appointment_date: newDate.toISOString(), status: "rescheduled", remind_at: remindAt, remind_sent: false } : a));
                      setReschedulingAptId(null);
                      setRescheduleDate("");
                      toast.success(t("salesmanLite.toast.appointmentRescheduled"));
                    }}
                    style={{ flex: 2, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.35)", color: "#c084fc", cursor: "pointer" }}>
                    {t("salesmanLite.inbox.saveNewTime")}
                  </button>
                </div>
              </div>
            )}

            {/* Expand: Telegram reminder time picker */}
            {isReminderPicking && (
              <div style={{ marginTop: 4, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>{t("salesmanLite.inbox.scheduleReminderTitle")}</p>
                  <button onClick={() => { setReminderPickerAptId(null); setSelectedRemindAt(null); }} title={t("salesmanLite.inbox.cancel")} style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                    <X size={14} />
                  </button>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                  {[
                    { key: "1h", label: t("salesmanLite.inbox.reminderBefore1h") },
                    { key: "2h", label: t("salesmanLite.inbox.reminderBefore2h") },
                    { key: "day_before", label: t("salesmanLite.inbox.reminderDayBefore") },
                    { key: "two_days", label: t("salesmanLite.inbox.reminderTwoDays") },
                  ].map(({ key, label }) => {
                    const rt = calcRemindAt(apt, key);
                    const active = selectedRemindAt && rt.getTime() === selectedRemindAt.getTime();
                    return (
                      <button key={key} onClick={() => setSelectedRemindAt(rt)}
                        style={{ fontSize: 11, padding: "4px 10px", borderRadius: 99, cursor: "pointer",
                          background: active ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.05)",
                          border: active ? "1px solid rgba(96,165,250,0.4)" : "1px solid rgba(255,255,255,0.08)",
                          color: active ? "#93c5fd" : "#6b7280" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <input type="datetime-local"
                  value={selectedRemindAt ? selectedRemindAt.toISOString().slice(0, 16) : ""}
                  onChange={(e) => e.target.value && setSelectedRemindAt(new Date(e.target.value))}
                  style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#e5e7eb", fontSize: 12, padding: "7px 10px", outline: "none", marginBottom: 8, fontFamily: "inherit", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setReminderPickerAptId(null); setSelectedRemindAt(null); }}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>
                    {t("salesmanLite.inbox.cancel")}
                  </button>
                  <button onClick={() => selectedRemindAt && saveReminder(apt, selectedRemindAt)}
                    disabled={!selectedRemindAt || reminderSaving}
                    style={{ flex: 2, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 600,
                      background: selectedRemindAt ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
                      border: selectedRemindAt ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)",
                      color: selectedRemindAt ? "#4ade80" : "#374151",
                      cursor: selectedRemindAt ? "pointer" : "not-allowed",
                      opacity: reminderSaving ? 0.6 : 1 }}>
                    {reminderSaving ? t("salesmanLite.inbox.saving") : t("salesmanLite.inbox.setReminder")}
                  </button>
                </div>
              </div>
            )}

            {/* Expand: cancel confirmation */}
            {isCancelConfirm && (
              <div style={{ marginTop: 4, padding: "10px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8 }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#f87171" }}>{t("salesmanLite.inbox.cancelConfirmQ")}</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setCancelConfirmId(null)}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>
                    {t("salesmanLite.inbox.keepIt")}
                  </button>
                  <button onClick={async () => { await updateApptStatus(apt.id, "cancelled"); setCancelConfirmId(null); setBookingDetailId(null); }}
                    style={{ flex: 2, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", cursor: "pointer" }}>
                    {t("salesmanLite.inbox.cancelAppt")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      );
    };

    return (
      <div>
        {renderBookingDetailModal()}
        <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>
          {t("salesmanLite.inbox.bookings")} ({confirmedApts.length})
        </p>
        {appointments.length === 0 && (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#374151" }}>
            <Phone size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: 13 }}>{t("salesmanLite.inbox.noBookings")}</p>
            <p style={{ margin: "6px 0 14px", fontSize: 12, color: "#374151" }}>{t("salesmanLite.inbox.noBookingsSub")}</p>
            <button onClick={() => setActiveTab("listings")} style={{ fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 8, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.22)", color: "#f87171", cursor: "pointer" }}>
              {t("salesmanLite.inbox.shareListing")}
            </button>
          </div>
        )}
        {/* Awaiting Confirmation — requests, not yet real bookings */}
        {pendingApts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5 }}>
              <Clock size={11} color="#fbbf24" /> {t("salesmanLite.inbox.awaitingConfirmation")} ({pendingApts.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingApts.map(renderApptCard)}
            </div>
          </div>
        )}
        {/* Today */}
        {todayApts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5 }}>
              <Calendar size={11} color="#fbbf24" /> {t("salesmanLite.inbox.today")} ({todayApts.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {todayApts.map(renderApptCard)}
            </div>
          </div>
        )}
        {/* Confirmed Upcoming */}
        {upcomingApts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5 }}>
              <Check size={11} color="#4ade80" /> {t("salesmanLite.inbox.confirmedUpcoming")} ({upcomingApts.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcomingApts.map(renderApptCard)}
            </div>
          </div>
        )}
        {/* Past — collapsed by default */}
        {pastApts.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setPastOpen((o) => !o)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "6px 0", width: "100%" }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {t("salesmanLite.inbox.past")} ({pastApts.length})
              </span>
              <span style={{ fontSize: 12, color: "#374151" }}>{pastOpen ? "▲" : "▼"}</span>
            </button>
            {pastOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {pastApts.map((apt) => {
                  const car = apt.car_listings;
                  const { dateStr, timeStr } = fmtAptDate(apt.appointment_date);
                  const sc = statusColors[apt.status] || statusColors.pending;
                  const carLabel = car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : null;
                  // A past booking left in an open status (pending/confirmed/rescheduled)
                  // has no automatic terminal state — it would otherwise say "Confirmed"
                  // forever. Offer the two real outcomes explicitly.
                  const needsOutcome = !["cancelled", "completed", "no_show"].includes(apt.status);
                  return (
                    <div key={apt.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 14px", opacity: 0.65 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {apt.buyer_name || "—"}
                        </p>
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, flexShrink: 0, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.tx, textTransform: "capitalize" }}>
                          {t("salesmanLite.inbox.status." + apt.status, { defaultValue: apt.status })}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 2px", fontSize: 12, color: "#6b7280", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Calendar size={12} /> {dateStr}{timeStr && ` · ${timeStr}`}
                      </p>
                      {(carLabel || apt.buyer_phone) && (
                        <p style={{ margin: 0, fontSize: 11, color: "#4b5563", display: "inline-flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          {carLabel}
                          {carLabel && apt.buyer_phone && <span>·</span>}
                          {apt.buyer_phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Phone size={11} /> {apt.buyer_phone}</span>}
                        </p>
                      )}
                      {needsOutcome && (
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <button
                            onClick={() => setAptStatus(apt, "completed")}
                            style={{ fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80", cursor: "pointer", fontFamily: "inherit" }}
                          >
                            {t("salesmanLite.inbox.markCompleted")}
                          </button>
                          <button
                            onClick={() => setAptStatus(apt, "no_show")}
                            style={{ fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.25)", color: "#fb923c", cursor: "pointer", fontFamily: "inherit" }}
                          >
                            {t("salesmanLite.inbox.noShow")}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── RENDER SETTINGS ──────────────────────────────────────────────────────

  const renderSettings = () => {
    const inputStyle = {
      width: "100%",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 8,
      color: "#e5e7eb",
      fontSize: 13,
      padding: "10px 12px",
      outline: "none",
      boxSizing: "border-box",
      fontFamily: "system-ui, sans-serif",
    };
    // Shared card + section-heading styling so every settings group reads as
    // one consistent, scannable block instead of loose fields hugging the sidebar.
    const cardStyle = { padding: 16, background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 };
    const sectionLabelStyle = { margin: "0 0 12px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" };

    // Strip the country code AND any leading trunk 0 — a MY mobile under +60 is
    // written without the leading 0 (011… -> +6011…). Without the /^0+/ strip a
    // stored value could carry an extra 0 (+60011…), which is an invalid number
    // and breaks WhatsApp links + enquiries.
    const localPhone = (settingsForm.whatsapp_number || "").replace(/^\+?60/, "").replace(/^0+/, "");

    const handleAvatarUpload = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) { toast.error(t("salesmanLite.toast.selectImageFile")); return; }
      setAvatarUploading(true);
      const compressed = await compressImageFile(file, { maxDim: 800 });
      const path = `${userId}/avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
      if (upErr) {
        toast.error(t("salesmanLite.toast.uploadFailed", { msg: upErr.message }));
        setAvatarUploading(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust the URL we PERSIST, not just the local preview — the storage
      // path is fixed (avatar.jpg) so upsert overwrites the same file. Saving
      // the bare URL meant every future reader (including the public mini
      // page) kept requesting the same URL string forever, so browsers/CDNs
      // kept serving the OLD cached image after a re-upload even though the
      // DB row and storage object were both updated correctly.
      const bustedUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: avatarProfileErr } = await supabase.from("profiles").update({ avatar_url: bustedUrl }).eq("id", userId);
      setAvatarUploading(false);
      if (avatarProfileErr) {
        console.error("handleAvatarUpload profile update:", avatarProfileErr);
        toast.error(t("salesmanLite.toast.photoSaveFailed"));
        return;
      }
      setAvatarUrl(bustedUrl);
      if (userId) localStorage.setItem(`salesman_lite_avatar_${userId}`, bustedUrl);
      setProfile((p) => ({ ...p, avatar_url: bustedUrl }));
      toast.success(t("salesmanLite.toast.profilePhotoUpdated"));
    };

    const handleCoverUpload = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) { toast.error(t("salesmanLite.toast.selectImageFile")); return; }
      setCoverUploading(true);
      const compressed = await compressImageFile(file, { maxDim: 1600 });
      const path = `${userId}/cover.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
      if (upErr) {
        toast.error(t("salesmanLite.toast.uploadFailed", { msg: upErr.message }));
        setCoverUploading(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      // Persist the busted URL (see handleAvatarUpload) — cover.jpg is a fixed
      // path, so without a changing query string every future reader (incl.
      // the public mini page) keeps re-requesting the same cached image.
      const bustedUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: coverProfileErr } = await supabase.from("profiles").update({ cover_url: bustedUrl }).eq("id", userId);
      setCoverUploading(false);
      if (coverProfileErr) {
        console.error("handleCoverUpload profile update:", coverProfileErr);
        toast.error(t("salesmanLite.toast.photoSaveFailed"));
        return;
      }
      setCoverUrl(bustedUrl);
      setProfile((p) => ({ ...p, cover_url: bustedUrl }));
      toast.success(t("salesmanLite.toast.coverPhotoUpdated"));
    };

    // Send a test message to the salesman's own Telegram chat. Solo Lite accounts
    // have no bot token of their own, so send-telegram falls back to the platform
    // bot — the chat id typed here is the only thing the user has to get right.
    // Saves it first so a test that works is a test of what gets persisted.
    const testTelegramConnection = async () => {
      const chatId = (settingsForm.telegram_chat_id || "").trim();
      if (!chatId) { toast.error(t("salesmanLite.toast.telegramNeedChatId")); return; }
      setTgTesting(true);
      try {
        const { error: chatIdErr } = await supabase
          .from("profiles").update({ telegram_chat_id: chatId }).eq("id", userId);
        if (chatIdErr) {
          console.error("testTelegramConnection save:", chatIdErr);
          toast.error(t("salesmanLite.toast.telegramTestFailed"));
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        const { data } = await supabase.functions.invoke("send-telegram", {
          body: {
            dealer_id: getDealerIdFromProfile(profile),
            channel_id: chatId,
            message: t("salesmanLite.toast.telegramTestBody", { name: profile?.full_name || "ShiftOS" }),
          },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        });
        if (data?.ok) {
          setProfile((p) => ({ ...p, telegram_chat_id: chatId }));
          toast.success(t("salesmanLite.toast.telegramTestSent"));
        } else if (data?.error === "not_started") {
          toast.error(t("salesmanLite.toast.telegramNotStarted", { bot: data.bot_username ? "@" + data.bot_username : t("salesmanLite.toast.telegramTheBot") }));
        } else if (data?.error === "no_token") {
          toast.error(t("salesmanLite.toast.telegramNoToken"));
        } else {
          toast.error(data?.description || t("salesmanLite.toast.telegramTestFailed"));
        }
      } catch (err) {
        console.error("testTelegramConnection:", err);
        toast.error(t("salesmanLite.toast.telegramNetworkError"));
      } finally {
        setTgTesting(false);
      }
    };

    const handleSave = async () => {
      setSettingsSaving(true);
      const cleanLocal = localPhone.replace(/\D/g, "").replace(/^0+/, "");
      const phone = cleanLocal ? "+60" + cleanLocal : "";
      const { error: saveProfileErr } = await supabase
        .from("profiles")
        .update({
          full_name: settingsForm.full_name,
          whatsapp_number: phone,
          telegram_chat_id: settingsForm.telegram_chat_id || null,
          city: settingsForm.city || null,
          state: settingsForm.state || null,
          location: settingsForm.location || null,
          instagram: settingsForm.instagram || null,
          tiktok: settingsForm.tiktok || null,
          facebook: settingsForm.facebook || null,
          website: settingsForm.website || null,
          deposit_policy: settingsForm.deposit_policy || null,
          deposit_terms: settingsForm.deposit_terms.trim() || null,
          processing_fee:
            String(settingsForm.processing_fee).trim() === ""
              ? null
              : Number(settingsForm.processing_fee) || 0,
        })
        .eq("id", userId);
      setSettingsSaving(false);
      if (saveProfileErr) {
        console.error("handleSave:", saveProfileErr);
        toast.error(t("salesmanLite.toast.profileSaveFailed"));
        return;
      }
      setProfile((p) => ({
        ...p,
        full_name: settingsForm.full_name,
        whatsapp_number: phone,
        telegram_chat_id: settingsForm.telegram_chat_id || null,
        city: settingsForm.city || null,
        state: settingsForm.state || null,
        location: settingsForm.location || null,
        instagram: settingsForm.instagram || null,
        tiktok: settingsForm.tiktok || null,
        facebook: settingsForm.facebook || null,
        website: settingsForm.website || null,
      }));
      setSettingsForm((p) => ({ ...p, whatsapp_number: phone }));
      toast.success(t("salesmanLite.toast.profileUpdated"));
    };

    const initials = (profile?.full_name || profile?.slug || "S")[0].toUpperCase();

    return (
      <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>
            {t("salesmanLite.settings.title")}
          </p>
          {/* Manual/help — moved off the footer/sidebar nav (it doesn't need its
              own permanent slot) and parked here, next to the settings the user
              is most likely to need it while filling in. */}
          <button
            data-tour-id="help"
            onClick={() => setActiveTab("help")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
          >
            <BookOpen size={13} /> {t("salesmanLite.tabs.help")}
          </button>
        </div>

        {/* Avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, padding: "16px", background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
          <div
            style={{ position: "relative", flexShrink: 0, cursor: avatarUploading ? "default" : "pointer" }}
            onClick={() => !avatarUploading && avatarInputRef.current?.click()}
            title={t("salesmanLite.settings.changePhotoTitle")}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="Profile" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.1)", display: "block" }} />
              : <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, color: "#fff", border: "2px solid rgba(255,255,255,0.1)" }}>
                  {initials}
                </div>
            }
            {/* Hover / loading overlay */}
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: avatarUploading ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}
              onMouseEnter={e => { if (!avatarUploading) e.currentTarget.style.background = "rgba(0,0,0,0.45)"; }}
              onMouseLeave={e => { if (!avatarUploading) e.currentTarget.style.background = "rgba(0,0,0,0)"; }}
            >
              {avatarUploading
                ? <div style={{ width: 22, height: 22, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0, transition: "opacity 0.2s" }} className="avatar-cam-icon"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              }
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{profile?.full_name || profile?.slug || t("salesmanLite.settings.yourName")}</p>
            <p style={{ margin: "3px 0 8px", fontSize: 11, color: "#4b5563" }}>{t("salesmanLite.settings.photoSubtext")}</p>
            <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer" }}>
              {avatarUploading ? t("salesmanLite.settings.uploading") : t("salesmanLite.settings.changePhoto")}
            </button>
          </div>
        </div>

        {/* Cover photo — banner shown behind your profile photo on your public XDrive page */}
        <div style={{ marginBottom: 24, padding: "16px", background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
          <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{t("salesmanLite.settings.coverPhoto")}</p>
          <p style={{ margin: "0 0 10px", fontSize: 11, color: "#4b5563" }}>{t("salesmanLite.settings.coverSubtext")}</p>
          <div
            onClick={() => !coverUploading && coverInputRef.current?.click()}
            style={{ position: "relative", width: "100%", height: 90, borderRadius: 8, overflow: "hidden", cursor: coverUploading ? "default" : "pointer", background: coverUrl ? `center / cover no-repeat url(${coverUrl})` : "linear-gradient(135deg, #2a3142 0%, #1b202b 55%, #10131b 100%)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: coverUploading ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.25)" }}>
              {coverUploading
                ? <div style={{ width: 22, height: 22, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                : <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{coverUrl ? t("salesmanLite.settings.changeCover") : t("salesmanLite.settings.addCover")}</span>
              }
            </div>
            <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverUpload} />
          </div>
        </div>

        {/* Viewing availability — buyers can only book the days/times set here */}
        <div style={{ marginBottom: 24, padding: 16, background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
          <AvailabilityEditor ownerId={userId} dealerId={userId} dark />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Identity verification — earns the public Verified badge. Sits first
              because it is the one thing here that changes how buyers see every
              listing. Purely opt-in: skipping it just means no badge. */}
          <VerifyIdentity
            profile={profile}
            userId={userId}
            onSubmitted={() =>
              setProfile((p) => ({ ...p, kyc_submitted_at: new Date().toISOString() }))
            }
          />

          {/* Profile basics */}
          <div style={cardStyle}>
            <p style={sectionLabelStyle}>{t("salesmanLite.settings.profileSection")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>{t("salesmanLite.settings.fullName")}</label>
            <input
              value={settingsForm.full_name}
              onChange={(e) => setSettingsForm((p) => ({ ...p, full_name: e.target.value }))}
              placeholder={t("salesmanLite.settings.fullNamePlaceholder")}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>{t("salesmanLite.settings.whatsapp")}</label>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, overflow: "hidden" }}>
              <span style={{ padding: "10px 12px", fontSize: 13, color: "#6b7280", background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap", flexShrink: 0 }}>+60</span>
              <input
                type="tel"
                value={localPhone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
                  setSettingsForm((p) => ({ ...p, whatsapp_number: digits ? "+60" + digits : "" }));
                }}
                placeholder="123456789"
                style={{ ...inputStyle, background: "transparent", border: "none", borderRadius: 0, flex: 1, width: "auto" }}
              />
            </div>
            <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>{t("salesmanLite.settings.whatsappHint")}</p>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: "#6b7280", display: "inline-flex", alignItems: "center", gap: 5 }}><Send size={11} /> {t("salesmanLite.settings.telegram")}</label>
              {profile?.telegram_chat_id
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "#4ade80" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />{t("salesmanLite.settings.telegramConnected")}</span>
                : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "#4b5563" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4b5563", display: "inline-block" }} />{t("salesmanLite.settings.telegramNotSet")}</span>
              }
            </div>
            <input
              value={settingsForm.telegram_chat_id}
              onChange={(e) => setSettingsForm((p) => ({ ...p, telegram_chat_id: e.target.value }))}
              placeholder={t("salesmanLite.settings.telegramPlaceholder")}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={testTelegramConnection}
              disabled={tgTesting || !settingsForm.telegram_chat_id.trim()}
              style={{
                marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 8,
                background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)",
                color: "#93c5fd", fontFamily: "inherit",
                cursor: (tgTesting || !settingsForm.telegram_chat_id.trim()) ? "not-allowed" : "pointer",
                opacity: (tgTesting || !settingsForm.telegram_chat_id.trim()) ? 0.55 : 1,
              }}
            >
              <Send size={13} /> {tgTesting ? t("salesmanLite.settings.telegramTesting") : t("salesmanLite.settings.telegramTest")}
            </button>
            <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151", lineHeight: 1.6 }}>
              {t("salesmanLite.settings.telegramHint").split("@userinfobot").map((part, i) =>
                i === 0 ? part : <React.Fragment key={i}><a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" style={{ color: "#93c5fd", textDecoration: "none" }}>@userinfobot</a>{part}</React.Fragment>
              )}
            </p>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>{t("salesmanLite.settings.slug")}</label>
            <input
              value={profile?.slug || ""}
              readOnly
              style={{ ...inputStyle, color: "#4b5563", cursor: "not-allowed", background: "rgba(255,255,255,0.02)" }}
            />
            <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>{t("salesmanLite.settings.slugHint")}</p>
          </div>
            </div>
          </div>

          {/* Push notifications — works with the app closed, unlike the in-tab
              Notification API banner used elsewhere in this file. */}
          <PushToggle userId={userId} theme="dark" style={cardStyle} />

          {/* Selling terms — a standalone agent sells their own cars, so the buyer
              questions the dealer dashboard answers (is my deposit safe, what else
              do I pay) have to be answerable here too. Without these the listing
              tells the buyer to ask, which is honest but loses the sale's momentum. */}
          <div style={{ ...cardStyle, marginBottom: 24 }}>
            <p style={sectionLabelStyle}>{t("salesmanLite.settings.sellingTermsSection")}</p>
            <p style={{ margin: "-6px 0 12px", fontSize: 11, color: "#4b5563", lineHeight: 1.5 }}>
              {t("salesmanLite.settings.sellingTermsHint")}
            </p>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5 }}>{t("salesmanLite.settings.depositPolicy")}</label>
              <select
                value={settingsForm.deposit_policy}
                onChange={(e) => setSettingsForm((p) => ({ ...p, deposit_policy: e.target.value }))}
                style={{ ...inputStyle, appearance: "none" }}
              >
                <option value="">{t("salesmanLite.settings.depositPolicySelect")}</option>
                <option value="refundable">{t("salesmanLite.settings.depositRefundable")}</option>
                <option value="refundable_on_loan_rejection">{t("salesmanLite.settings.depositLoanRejected")}</option>
                <option value="non_refundable">{t("salesmanLite.settings.depositNonRefundable")}</option>
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5 }}>{t("salesmanLite.settings.depositTerms")}</label>
              <input
                value={settingsForm.deposit_terms}
                onChange={(e) => setSettingsForm((p) => ({ ...p, deposit_terms: e.target.value }))}
                placeholder={t("salesmanLite.settings.depositTermsPlaceholder")}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5 }}>{t("salesmanLite.settings.processingFee")}</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#6b7280", pointerEvents: "none" }}>RM</span>
                <input
                  value={settingsForm.processing_fee}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, processing_fee: e.target.value.replace(/[^0-9.]/g, "") }))}
                  placeholder={t("salesmanLite.settings.processingFeePlaceholder")}
                  inputMode="decimal"
                  style={{ ...inputStyle, paddingLeft: 40 }}
                />
              </div>
              <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151", lineHeight: 1.5 }}>{t("salesmanLite.settings.processingFeeHint")}</p>
            </div>
          </div>

          {/* Location + IC */}
          <div style={cardStyle}>
            <p style={sectionLabelStyle}>{t("salesmanLite.settings.locationSection")}</p>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5 }}>{t("salesmanLite.settings.city")}</label>
                <input value={settingsForm.city} onChange={(e) => setSettingsForm((p) => ({ ...p, city: e.target.value }))} placeholder={t("salesmanLite.settings.cityPlaceholder")} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5 }}>{t("salesmanLite.settings.state")}</label>
                <select value={settingsForm.state} onChange={(e) => setSettingsForm((p) => ({ ...p, state: e.target.value }))}
                  style={{ ...inputStyle, appearance: "none" }}>
                  <option value="">{t("salesmanLite.settings.stateSelect")}</option>
                  {["Johor","Kedah","Kelantan","Kuala Lumpur","Labuan","Melaka","Negeri Sembilan","Pahang","Penang","Perak","Perlis","Putrajaya","Sabah","Sarawak","Selangor","Terengganu"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5 }}>{t("salesmanLite.settings.address")}</label>
              <input value={settingsForm.location} onChange={(e) => setSettingsForm((p) => ({ ...p, location: e.target.value }))} placeholder={t("salesmanLite.settings.addressPlaceholder")} style={inputStyle} />
              <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>{t("salesmanLite.settings.addressHint")}</p>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5 }}>{t("salesmanLite.settings.icNumber")} <span style={{ color: "#4b5563" }}>{t("salesmanLite.settings.icPrivate")}</span></label>
              {/* IC is verify-only: stored hashed via set_my_ic, never editable as
                  plaintext, and never read back to the client. Verified rows
                  show a status badge only (no digits); unverified show a button
                  that opens the hashing gate. */}
              {profile?.ic_hash ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 13px", borderRadius: 8, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
                  <ShieldCheck size={15} style={{ color: "#22c55e", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 600 }}>{t("salesmanLite.settings.icVerified")}</span>
                </div>
              ) : (
                <button
                  onClick={() => { setIcGateVal(""); setIcGateOpen(true); }}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 13px", borderRadius: 8, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", width: "100%" }}
                >
                  <ShieldCheck size={15} style={{ flexShrink: 0 }} /> {t("salesmanLite.settings.icVerifyBtn")}
                </button>
              )}
              <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>{t("salesmanLite.settings.icHint")}</p>
            </div>
          </div>

          {/* Social links */}
          <div style={cardStyle}>
            <p style={sectionLabelStyle}>{t("salesmanLite.settings.socialSection")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { key: "instagram", label: "Instagram", placeholder: "@yourusername", prefix: "instagram.com/" },
                { key: "tiktok",    label: "TikTok",    placeholder: "@yourusername", prefix: "tiktok.com/@" },
                { key: "facebook",  label: "Facebook",  placeholder: "username or page name", prefix: "facebook.com/" },
                { key: "website",   label: "Website",   placeholder: "https://yoursite.com", prefix: null },
              ].map(({ key, label, placeholder, prefix }) => (
                <div key={key}>
                  <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5 }}>{label}</label>
                  <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, overflow: "hidden" }}>
                    {prefix && (
                      <span style={{ padding: "10px 10px", fontSize: 11, color: "#4b5563", background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap", flexShrink: 0 }}>{prefix}</span>
                    )}
                    <input
                      value={settingsForm[key]}
                      onChange={(e) => setSettingsForm((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ ...inputStyle, background: "transparent", border: "none", borderRadius: 0, flex: 1, width: "auto" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Language toggle */}
          <div style={cardStyle}>
            <p style={{ ...sectionLabelStyle, marginBottom: 8 }}>{t("salesmanLite.settings.language")}</p>
            <p style={{ margin: "0 0 10px", fontSize: 11, color: "#374151" }}>{t("salesmanLite.settings.languageSubtext")}</p>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ code: "en", label: "English" }, { code: "ms", label: "Malay" }].map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => i18n.changeLanguage(code)}
                  style={{
                    padding: "7px 18px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: i18n.language === code ? "#dc2626" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${i18n.language === code ? "#dc2626" : "rgba(255,255,255,0.1)"}`,
                    color: i18n.language === code ? "#fff" : "#9ca3af",
                    transition: "all 0.15s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <style>{`@keyframes spin{to{transform:rotate(360deg)}} div:hover .avatar-cam-icon{opacity:1!important}`}</style>
          <button
            onClick={handleSave}
            disabled={settingsSaving}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              background: "#dc2626",
              border: "none",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: settingsSaving ? "not-allowed" : "pointer",
              opacity: settingsSaving ? 0.6 : 1,
            }}
          >
            {settingsSaving ? t("salesmanLite.settings.savingBtn") : t("salesmanLite.settings.saveBtn")}
          </button>

          {/* Danger Zone — self-service account deletion */}
          <div style={{ ...cardStyle, border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.03)", marginTop: 8 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "rgba(248,113,113,0.7)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {t("salesmanLite.dangerZone.title")}
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6b7280", lineHeight: 1.6, maxWidth: 460 }}>
              {t("salesmanLite.dangerZone.subtext")}
            </p>
            <button
              onClick={() => { setDeleteConfirmText(""); setDeleteModalOpen(true); }}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid rgba(248,113,113,0.4)",
                color: "#f87171",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t("salesmanLite.dangerZone.deleteBtn")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── DELETE ACCOUNT MODAL ──────────────────────────────────────────────────
  const renderDeleteModal = () =>
    deleteModalOpen &&
    createPortal(
      <div
        onClick={() => !deleting && setDeleteModalOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(2px)",
          zIndex: 1000,
          display: "flex",
          alignItems: isMobile ? "flex-end" : "center",
          justifyContent: "center",
          padding: isMobile ? 0 : 20,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: isMobile ? "16px 16px 0 0" : 14,
            width: isMobile ? "100%" : 440,
            maxWidth: "100%",
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>
              {t("salesmanLite.dangerZone.modalTitle")}
            </p>
            <button
              onClick={() => !deleting && setDeleteModalOpen(false)}
              style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}
            >
              <X size={20} />
            </button>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#9ca3af", lineHeight: 1.65 }}>
            {t("salesmanLite.dangerZone.modalBody")}
          </p>
          <ul style={{ margin: "0 0 16px", paddingLeft: 18, fontSize: 12.5, color: "#9ca3af", lineHeight: 1.7 }}>
            <li>{t("salesmanLite.dangerZone.point1")}</li>
            <li>{t("salesmanLite.dangerZone.point2")}</li>
            <li>{t("salesmanLite.dangerZone.point3")}</li>
          </ul>
          <label style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
            {t("salesmanLite.dangerZone.confirmLabel")}
          </label>
          <input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE"
            autoFocus
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              color: "#e5e7eb",
              fontSize: 14,
              padding: "10px 12px",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "system-ui, sans-serif",
              letterSpacing: "0.05em",
              marginBottom: 18,
            }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
              style={{
                flex: 1,
                padding: "11px 14px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#d1d5db",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t("salesmanLite.dangerZone.cancel")}
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting || deleteConfirmText.trim().toUpperCase() !== "DELETE"}
              style={{
                flex: 1,
                padding: "11px 14px",
                borderRadius: 8,
                background: "#dc2626",
                border: "none",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: deleting || deleteConfirmText.trim().toUpperCase() !== "DELETE" ? "not-allowed" : "pointer",
                opacity: deleting || deleteConfirmText.trim().toUpperCase() !== "DELETE" ? 0.5 : 1,
                fontFamily: "inherit",
              }}
            >
              {deleting ? t("salesmanLite.dangerZone.deleting") : t("salesmanLite.dangerZone.confirmDelete")}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  // ── ADD LEAD MODAL ────────────────────────────────────────────────────────

  const renderAddLeadModal = () =>
    showAddLead && (
      <div
        onClick={() => setShowAddLead(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.78)",
          zIndex: 999,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#111827",
            borderRadius: isMobile ? "16px 16px 0 0" : 12,
            width: isMobile ? "100%" : 480,
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#f1f5f9",
                }}
              >
                {t("salesmanLite.addLead.title")}
              </p>
              <button
                onClick={() => setShowAddLead(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6b7280",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { key: "buyer_name", label: t("salesmanLite.addLead.name"), placeholder: t("salesmanLite.addLead.namePlaceholder") },
                {
                  key: "phone",
                  label: t("salesmanLite.addLead.phone"),
                  placeholder: t("salesmanLite.addLead.phonePlaceholder"),
                },
                { key: "notes", label: t("salesmanLite.addLead.notes"), placeholder: t("salesmanLite.addLead.notesPlaceholder") },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    {label}
                  </label>
                  <input
                    value={addLeadForm[key]}
                    onChange={(e) =>
                      setAddLeadForm((p) => ({ ...p, [key]: e.target.value }))
                    }
                    placeholder={placeholder}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      color: "#e5e7eb",
                      fontSize: 13,
                      padding: "9px 12px",
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "system-ui, sans-serif",
                    }}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>
                  {t("salesmanLite.addLead.carOptional")}
                </label>
                <select
                  value={addLeadForm.car_listing_id}
                  onChange={(e) => setAddLeadForm((p) => ({ ...p, car_listing_id: e.target.value }))}
                  style={{ width: "100%", background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e5e7eb", fontSize: 13, padding: "9px 12px", outline: "none", fontFamily: "system-ui, sans-serif" }}
                >
                  <option value="">{t("salesmanLite.addLead.noCarSelected")}</option>
                  {myListings.filter((c) => c.status !== "sold").map((c) => (
                    <option key={c.id} value={c.id}>
                      {[c.year, c.brand, c.model, c.variant].filter(Boolean).join(" ")} — RM {Number(c.selling_price || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 11,
                    color: "#6b7280",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  {t("salesmanLite.addLead.stateOptional")}
                </label>
                <select
                  value={addLeadForm.buyer_state}
                  onChange={(e) =>
                    setAddLeadForm((p) => ({ ...p, buyer_state: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    background: "#111827",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "#e5e7eb",
                    fontSize: 13,
                    padding: "9px 12px",
                    outline: "none",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  <option value="">{t("salesmanLite.addLead.selectState")}</option>
                  {["Johor","Kedah","Kelantan","Kuala Lumpur","Labuan","Melaka","Negeri Sembilan","Pahang","Penang","Perak","Perlis","Putrajaya","Sabah","Sarawak","Selangor","Terengganu"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleAddLead}
              disabled={!addLeadForm.buyer_name || addLeadSaving}
              style={{
                marginTop: 20,
                width: "100%",
                padding: "10px",
                borderRadius: 8,
                background: "#dc2626",
                border: "none",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                opacity: !addLeadForm.buyer_name || addLeadSaving ? 0.6 : 1,
              }}
            >
              {addLeadSaving ? t("salesmanLite.addLead.saving") : t("salesmanLite.addLead.add")}
            </button>
          </div>
        </div>
      </div>
    );

  // ── LOG CALL MODAL ────────────────────────────────────────────────────────

  const renderLogCallModal = () => logCallLeadId && (() => {
    const lead = leads.find((l) => l.id === logCallLeadId);
    const OUTCOMES = [
      { key: "answered", label: t("salesmanLite.logCall.answered"), icon: CheckCircle, color: "#4ade80" },
      { key: "no_answer", label: t("salesmanLite.logCall.noAnswer"), icon: PhoneOff, color: "#f87171" },
      { key: "callback_requested", label: t("salesmanLite.logCall.callbackRequested"), icon: RefreshCw, color: "#fbbf24" },
      { key: "voicemail", label: t("salesmanLite.logCall.voicemail"), icon: Voicemail, color: "#94a3b8" },
    ];
    return (
      <div onClick={() => setLogCallLeadId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px 16px 0 0", padding: "20px 20px 32px", width: "100%", maxWidth: 480 }}>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{t("salesmanLite.logCall.title")}</p>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "#4b5563" }}>{lead?.buyer_name || "—"} · {lead?.phone || "—"}</p>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("salesmanLite.logCall.outcome")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {OUTCOMES.map((o) => (
              <button key={o.key} onClick={() => setCallOutcome(o.key)} style={{ padding: "10px 12px", borderRadius: 9, fontSize: 12, fontWeight: 600, textAlign: "left", cursor: "pointer", background: callOutcome === o.key ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", border: callOutcome === o.key ? `1px solid ${o.color}40` : "1px solid rgba(255,255,255,0.07)", color: callOutcome === o.key ? o.color : "#6b7280", display: "flex", alignItems: "center", gap: 7 }}>
                <o.icon size={14} style={{ flexShrink: 0 }} /> {o.label}
              </button>
            ))}
          </div>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("salesmanLite.logCall.noteOptional")}</p>
          <input value={callNote} onChange={(e) => setCallNote(e.target.value)} placeholder={t("salesmanLite.logCall.notePlaceholder")} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, color: "#e5e7eb", fontSize: 13, padding: "10px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setLogCallLeadId(null)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("salesmanLite.logCall.cancel")}</button>
            <button onClick={logCall} disabled={callSaving} style={{ flex: 2, padding: "11px 0", borderRadius: 10, background: "#dc2626", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: callSaving ? "not-allowed" : "pointer", opacity: callSaving ? 0.6 : 1 }}>
              {callSaving ? t("salesmanLite.logCall.saving") : t("salesmanLite.logCall.title")}
            </button>
          </div>
        </div>
      </div>
    );
  })();

  // ── BATCH WA MODAL ─────────────────────────────────────────────────────────

  // Auto-populate the blast message when the current lead changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!batchWALeads) return;
    const current = batchWALeads[batchWAIdx];
    if (!current) return;
    const car = current.car_listings;
    const carName = car ? `${car.brand} ${car.model}` : 'kereta tu';
    const hours = FOLLOW_UP_HOURS[current.stage] ?? 48;
    const isStale = current.updated_at && Date.now() - new Date(current.updated_at).getTime() > hours * 3600 * 1000;
    setBatchWAMsg(isStale
      ? `Hi ${current.buyer_name || 'kawan'}! Ada orang lain tengah tanya pasal ${carName} ni — kalau you still interested, jom lock dulu sebelum terlambat 🔒`
      : `Hi ${current.buyer_name || 'kawan'}! Macam mana, still interested dalam ${carName} tu? Jom kita discuss lagi 😊`
    );
  }, [batchWALeads, batchWAIdx]);

  const renderBatchWAModal = () => {
    if (!batchWALeads || batchWALeads.length === 0) return null;
    const current = batchWALeads[batchWAIdx];
    if (!current) return null;
    const car = current.car_listings;
    const waPhone = (current.phone || '').replace(/\D/g, '');
    const waNum = waPhone.startsWith('6') ? waPhone : '6' + waPhone;
    const advance = () => {
      if (batchWAIdx < batchWALeads.length - 1) setBatchWAIdx(i => i + 1);
      else setBatchWALeads(null);
    };
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px 16px 0 0", padding: "20px 20px 32px", width: "100%", maxWidth: 480 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{t("salesmanLite.batchWa.title")}</p>
            <span style={{ fontSize: 12, color: "#4b5563" }}>{batchWAIdx + 1} / {batchWALeads.length}</span>
          </div>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {batchWALeads.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i < batchWAIdx ? "#4ade80" : i === batchWAIdx ? "#fbbf24" : "rgba(255,255,255,0.08)" }} />
            ))}
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{current.buyer_name || "—"}</p>
            <p style={{ margin: 0, fontSize: 11, color: "#4b5563" }}>
              {car ? `${car.brand} ${car.model}` : t("salesmanLite.batchWa.noCarLinked")} · {t("salesmanLite.batchWa.lastContact", { time: timeAgo(current.updated_at) })}
            </p>
          </div>
          {/* Editable message */}
          <textarea
            value={batchWAMsg}
            onChange={e => setBatchWAMsg(e.target.value)}
            rows={4}
            style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontSize: 12, color: "#d1d5db", lineHeight: 1.6, padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", outline: "none", fontFamily: "inherit", marginBottom: 14 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(batchWAMsg)}`, "_blank"); advance(); }}
              style={{ flex: 2, padding: "11px", borderRadius: 9, background: "#25D366", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              {t("salesmanLite.batchWa.waLead", { name: current.buyer_name?.split(' ')[0] || t("salesmanLite.loanCalc.leadFallback") })}
            </button>
            <button
              onClick={advance}
              style={{ flex: 1, padding: "11px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              {t("salesmanLite.batchWa.skip")}
            </button>
          </div>
          <button onClick={() => setBatchWALeads(null)} style={{ width: "100%", marginTop: 10, padding: "8px", background: "none", border: "none", color: "#374151", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            {t("salesmanLite.batchWa.stop")}
          </button>
        </div>
      </div>
    );
  };

  // ── FOLLOW-UP MODAL ────────────────────────────────────────────────────────

  const renderFollowUpModal = () => followUpModalLead && (
    <div onClick={() => setFollowUpModalLead(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px 16px 0 0", padding: "20px 20px 32px", width: "100%", maxWidth: 480 }}>
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{t("salesmanLite.followUp.title")}</p>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#4b5563" }}>{followUpModalLead.buyer_name || "—"}</p>
        <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("salesmanLite.followUp.remindOn")}</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {[
            { label: t("salesmanLite.followUp.tomorrow"), days: 1 },
            { label: t("salesmanLite.followUp.in2days"), days: 2 },
            { label: t("salesmanLite.followUp.in3days"), days: 3 },
            { label: t("salesmanLite.followUp.nextWeek"), days: 7 },
          ].map(({ label, days }) => {
            const d = new Date(); d.setDate(d.getDate() + days);
            const val = d.toISOString().slice(0, 10);
            return (
              <button key={label} onClick={() => setFollowUpDate(val)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, cursor: "pointer", background: followUpDate === val ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.04)", border: followUpDate === val ? "1px solid rgba(251,191,36,0.4)" : "1px solid rgba(255,255,255,0.08)", color: followUpDate === val ? "#fbbf24" : "#6b7280", fontWeight: followUpDate === val ? 600 : 400 }}>
                {label}
              </button>
            );
          })}
        </div>
        <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, color: "#e5e7eb", fontSize: 13, padding: "10px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: followUpDate ? 6 : 14 }} />
        {/* Native date inputs render per browser locale (can show mm/dd/yyyy). Echo the
            chosen date in Malaysian dd/mm/yyyy so it's never misread. */}
        {followUpDate && (
          <p style={{ margin: "0 0 14px", fontSize: 11, color: "#9ca3af" }}>
            {t("salesmanLite.followUp.reminderSetFor")} <span style={{ color: "#e5e7eb", fontWeight: 600 }}>{followUpDate.split("-").reverse().join("/")}</span>
          </p>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          {followUpModalLead.follow_up_at && (
            <button onClick={() => saveFollowUp(followUpModalLead.id, null)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("salesmanLite.followUp.clear")}</button>
          )}
          <button onClick={() => setFollowUpModalLead(null)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("salesmanLite.followUp.cancel")}</button>
          <button onClick={() => followUpDate && saveFollowUp(followUpModalLead.id, followUpDate)} disabled={!followUpDate || followUpSaving} style={{ flex: 2, padding: "11px 0", borderRadius: 10, background: "#dc2626", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: (!followUpDate || followUpSaving) ? "not-allowed" : "pointer", opacity: (!followUpDate || followUpSaving) ? 0.5 : 1 }}>
            {followUpSaving ? t("salesmanLite.followUp.saving") : t("salesmanLite.followUp.setReminder")}
          </button>
        </div>
      </div>
    </div>
  );

  // ── WA MESSAGE MODAL ──────────────────────────────────────────────────────

  const renderWAModal = () =>
    waModalLead && (
      <div
        onClick={() => setWaModalLead(null)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.78)",
          zIndex: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 16px",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#111827",
            borderRadius: 12,
            width: "90%",
            maxWidth: 440,
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 600,
                color: "#f1f5f9",
              }}
            >
              {t("salesmanLite.waModal.title")}
            </p>
            <button
              onClick={() => setWaModalLead(null)}
              style={{
                background: "none",
                border: "none",
                color: "#6b7280",
                cursor: "pointer",
                padding: 2,
              }}
            >
              <X size={18} />
            </button>
          </div>
          <textarea
            value={waModalMsg}
            onChange={(e) => setWaModalMessage(e.target.value)}
            rows={5}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "#e5e7eb",
              fontSize: 13,
              padding: "10px 12px",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "system-ui, sans-serif",
              resize: "vertical",
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={async () => {
              const now = new Date().toISOString();
              const { error: waTouchErr } = await supabase
                .from("leads").update({ updated_at: now }).eq("id", waModalLead.id);
              if (waTouchErr) { console.error("waModal leads update:", waTouchErr); toast.error(t("salesmanLite.toast.messageLogFailed")); return; }
              const { error: waActErr } = await supabase.from("lead_activities").insert({
                lead_id: waModalLead.id, activity_type: "whatsapp_sent",
                note: "WA message sent", created_by: userId,
                dealer_id: waModalLead.dealer_id ?? null,
              });
              if (waActErr) console.error("waModal activity insert:", waActErr);
              setStaleLeads((p) => p.filter((l) => l.id !== waModalLead.id));
              setLeads((p) => p.map((l) => l.id === waModalLead.id ? { ...l, updated_at: now } : l));
              const savedLeadId = waModalLead.id;
              setWaModalLead(null);
              toast(t("salesmanLite.toast.waSent"), {
                description: t("salesmanLite.toast.waSentDesc"),
                action: { label: t("salesmanLite.toast.waSentAction"), onClick: () => { setLogCallLeadId(savedLeadId); setCallOutcome("answered"); setCallNote(""); } },
                duration: 5000,
              });
              const phone = (waModalLead.phone || "").replace(/\D/g, "");
              if (phone) {
                window.location.href = `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${encodeURIComponent(waModalMsg)}`;
              }
            }}
            disabled={!waModalMsg.trim() || !waModalLead.phone}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "10px",
              borderRadius: 8,
              background: "#16a34a",
              border: "none",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor:
                !waModalMsg.trim() || !waModalLead.phone
                  ? "not-allowed"
                  : "pointer",
              opacity: !waModalMsg.trim() || !waModalLead.phone ? 0.6 : 1,
            }}
          >
            {t("salesmanLite.waModal.send")}
          </button>
          {!waModalLead.phone && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 11,
                color: "#f87171",
                textAlign: "center",
              }}
            >
              {t("salesmanLite.waModal.noPhone")}
            </p>
          )}
        </div>
      </div>
    );

  // ── TOUR ─────────────────────────────────────────────────────────────────

  const TOUR_STEPS = [
    { icon: Zap,          title: t("salesmanLite.tour.steps.welcome.title"),     body: t("salesmanLite.tour.steps.welcome.body") },
    { icon: LayoutGrid,   title: t("salesmanLite.tour.steps.dashboard.title"),   body: t("salesmanLite.tour.steps.dashboard.body") },
    { icon: Car,          title: t("salesmanLite.tour.steps.listings.title"),    body: t("salesmanLite.tour.steps.listings.body") },
    { icon: Users,        title: t("salesmanLite.tour.steps.leads.title"),       body: t("salesmanLite.tour.steps.leads.body") },
    { icon: MessageSquare, title: t("salesmanLite.tour.steps.inbox.title"),      body: t("salesmanLite.tour.steps.inbox.body") },
    { icon: Calendar,     title: t("salesmanLite.tour.steps.bookings.title"),    body: t("salesmanLite.tour.steps.bookings.body") },
    { icon: BarChart2,    title: t("salesmanLite.tour.steps.performance.title"), body: t("salesmanLite.tour.steps.performance.body") },
    { icon: MessageCircle, title: t("salesmanLite.tour.steps.chat.title"),       body: t("salesmanLite.tour.steps.chat.body") },
    { icon: Package,      title: t("salesmanLite.tour.steps.services.title"),    body: t("salesmanLite.tour.steps.services.body") },
    { icon: Settings,     title: t("salesmanLite.tour.steps.settings.title"),    body: t("salesmanLite.tour.steps.settings.body") },
    { icon: BookOpen,     title: t("salesmanLite.tour.steps.help.title"),        body: t("salesmanLite.tour.steps.help.body") },
  ];

  const dismissTour = async () => {
    // Mark seen locally the moment they close it, so a slow/failed DB write never
    // makes the tour re-pop on the next mount within this session.
    try { if (userId) localStorage.setItem(`slite_tour_seen_${userId}`, '1'); } catch {}
    setTourStep(null);
    setTourTarget(null);
    setProfile((p) => ({ ...p, onboarding_tour_done: true }));
    const { error: tourErr } = await supabase
      .from("profiles").update({ onboarding_tour_done: true }).eq("id", userId);
    if (tourErr) console.error("dismissTour:", tourErr);
  };

  // Locked preview shown on a listing-gated tab (leads / inbox / performance)
  // once the intro tour is done but before the salesman has listed a single car.
  // Same lock badge across all three; copy is tailored per tab. Suppressed while
  // the tour is running so the intro can show each panel in full.
  const renderLockedPanel = (kind) => {
    const cfg = {
      leads:       { Icon: Users,         title: t("salesmanLite.locked.leadsTitle"),  sub: t("salesmanLite.locked.leadsSub") },
      enquiries:   { Icon: MessageSquare, title: t("salesmanLite.locked.inboxTitle"),  sub: t("salesmanLite.locked.inboxSub") },
      chat:        { Icon: MessageCircle, title: t("salesmanLite.locked.chatTitle", { defaultValue: "No chats yet" }), sub: t("salesmanLite.locked.chatSub", { defaultValue: "List your first car. Buyers can message you straight from the listing, and every conversation lands here." }) },
      performance: { Icon: BarChart2,     title: t("salesmanLite.locked.perfTitle"),   sub: t("salesmanLite.locked.perfSub") },
    }[kind];
    const Icon = cfg.Icon;
    return (
      <div style={{ maxWidth: 420, margin: "0 auto", textAlign: "center", padding: isMobile ? "56px 20px" : "72px 24px" }}>
        <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 18px" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={26} strokeWidth={1.5} style={{ color: "#475569" }} />
          </div>
          <div style={{ position: "absolute", right: -6, bottom: -6, width: 26, height: 26, borderRadius: 9, background: "#dc2626", border: "3px solid #080a12", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Lock size={12} strokeWidth={2.5} style={{ color: "#fff" }} />
          </div>
        </div>
        <p style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "#f1f5f9" }}>{cfg.title}</p>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{cfg.sub}</p>
        <button
          onClick={() => { switchTab("listings"); setTimeout(openAddListing, 100); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, padding: "11px 22px", borderRadius: 10, background: "#dc2626", border: "none", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
        >
          <Plus size={16} /> {t("salesmanLite.locked.cta")}
        </button>
      </div>
    );
  };

  const renderTour = () => {
    if (tourStep === null) return null;
    const step = TOUR_STEPS[tourStep];
    const isLast = tourStep === TOUR_STEPS.length - 1;
    const isWelcome = tourStep === 0;

    // Compute bubble position from the measured target rect
    let bubbleStyle = {};
    let arrowEl = null;
    const PAD = 12;
    const BUBBLE_W = isMobile ? Math.min(320, window.innerWidth - 32) : 300;

    if (!tourTarget || isWelcome) {
      // Center on screen for welcome step or if target not found
      bubbleStyle = {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: BUBBLE_W,
        zIndex: 1002,
      };
    } else if (isMobile) {
      // Mobile: most steps highlight the bottom nav, so the bubble sits ABOVE the
      // tab. But some anchors (e.g. the Bookings sub-tab pill) now live near the top
      // of the screen — anchoring above them pushes the bubble off the top edge and
      // clips it. So flip BELOW the target whenever there isn't enough room above,
      // keeping the whole bubble in frame on any device height.
      const centerX = tourTarget.left + tourTarget.width / 2;
      const bubbleLeft = Math.max(8, Math.min(centerX - BUBBLE_W / 2, window.innerWidth - BUBBLE_W - 8));
      // Rough bubble height — only used to decide above vs below; exact value not critical.
      const EST_BUBBLE_H = 250;
      const roomAbove = tourTarget.top - PAD;
      const placeBelow = roomAbove < EST_BUBBLE_H + 8;
      bubbleStyle = {
        position: "fixed",
        ...(placeBelow
          ? { top: Math.max(8, Math.min(tourTarget.bottom + PAD, window.innerHeight - EST_BUBBLE_H - 8)) }
          : { bottom: window.innerHeight - tourTarget.top + PAD }),
        left: bubbleLeft,
        width: BUBBLE_W,
        zIndex: 1002,
      };
      // Arrow points toward the tab: up when the bubble sits below it, down when above.
      const arrowLeft = centerX - bubbleLeft - 8;
      arrowEl = (
        <div style={{
          position: "absolute",
          ...(placeBelow ? { top: -8 } : { bottom: -8 }),
          left: Math.max(12, Math.min(arrowLeft, BUBBLE_W - 28)),
          width: 0,
          height: 0,
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          ...(placeBelow
            ? { borderBottom: "8px solid #1e2d3d" }
            : { borderTop: "8px solid #1e2d3d" }),
        }} />
      );
    } else {
      // Desktop: sidebar at left → bubble sits to the right of the highlighted item.
      // But anchors that aren't in the sidebar (e.g. the Bookings sub-tab pill) can
      // sit far right, where a right-side bubble would overflow the viewport — so
      // flip it to the LEFT of the target when there isn't room on the right.
      const topPos = Math.max(8, Math.min(tourTarget.top + tourTarget.height / 2 - 80, window.innerHeight - 220));
      const placeLeft = tourTarget.right + PAD + BUBBLE_W > window.innerWidth - 8;
      bubbleStyle = {
        position: "fixed",
        top: topPos,
        left: placeLeft
          ? Math.max(8, tourTarget.left - PAD - BUBBLE_W)
          : tourTarget.right + PAD,
        width: BUBBLE_W,
        zIndex: 1002,
      };
      // Arrow points toward the item: left when the bubble is on its right, right when on its left.
      arrowEl = (
        <div style={{
          position: "absolute",
          ...(placeLeft ? { right: -8 } : { left: -8 }),
          top: Math.min(60, tourTarget.height / 2 + 8),
          width: 0,
          height: 0,
          borderTop: "8px solid transparent",
          borderBottom: "8px solid transparent",
          ...(placeLeft
            ? { borderLeft: "8px solid #1e2d3d" }
            : { borderRight: "8px solid #1e2d3d" }),
        }} />
      );
    }

    return (
      <>
        {/* Highlight ring around the target nav item — soft glow, gentle pulse,
            rounded to match the nav item rather than a hard red box. */}
        {tourTarget && !isWelcome && (
          <div
            style={{
              position: "fixed",
              left: tourTarget.left - 6,
              top: tourTarget.top - 6,
              width: tourTarget.width + 12,
              height: tourTarget.height + 12,
              borderRadius: isMobile ? 16 : 13,
              border: "1.5px solid rgba(248,113,113,0.85)",
              background: "rgba(220,38,38,0.07)",
              pointerEvents: "none",
              zIndex: 1001,
              transition: "left 0.28s cubic-bezier(0.4,0,0.2,1), top 0.28s cubic-bezier(0.4,0,0.2,1), width 0.28s cubic-bezier(0.4,0,0.2,1), height 0.28s cubic-bezier(0.4,0,0.2,1)",
              animation: "tourRing 1.9s ease-in-out infinite",
            }}
          />
        )}

        {/* Bubble */}
        <div
          style={{
            ...bubbleStyle,
            background: "linear-gradient(180deg, #141c2b 0%, #0f1622 100%)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 16,
            padding: "18px 18px 15px",
            boxShadow: "0 18px 50px rgba(0,0,0,0.65), 0 0 0 1px rgba(220,38,38,0.12)",
            animation: "tourPop 0.2s ease",
          }}
        >
          <style>{`
            @keyframes tourPop{from{opacity:0;transform:${isWelcome ? "translate(-50%,-48%)" : "scale(0.96)"}}to{opacity:1;transform:${isWelcome ? "translate(-50%,-50%)" : "scale(1)"}}}
            @keyframes tourRing{0%,100%{box-shadow:0 0 0 3px rgba(220,38,38,0.14), 0 0 18px 2px rgba(220,38,38,0.22)}50%{box-shadow:0 0 0 5px rgba(220,38,38,0.22), 0 0 30px 6px rgba(220,38,38,0.38)}}
          `}</style>
          {arrowEl}

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <step.icon size={15} style={{ color: "#f87171" }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  {t("salesmanLite.tour.progress", { current: tourStep + 1, total: TOUR_STEPS.length })}
                </p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{step.title}</p>
              </div>
            </div>
            <button onClick={dismissTour} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}><X size={14} /></button>
          </div>

          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6 }}>
            {step.body}
          </p>

          {/* Welcome step doubles as the language chooser — pick the language the
              rest of the intro (and the whole panel) runs in. */}
          {isWelcome && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "center" }}>
                Choose your language · Pilih bahasa anda
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ code: "en", label: "English" }, { code: "ms", label: "Malay" }].map(({ code, label }) => {
                  const active = i18n.language === code;
                  return (
                    <button
                      key={code}
                      onClick={() => { i18n.changeLanguage(code); setTourStep(1); }}
                      style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                        background: active ? "#dc2626" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${active ? "#dc2626" : "rgba(255,255,255,0.12)"}`,
                        color: active ? "#fff" : "#cbd5e1", transition: "all 0.15s" }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {TOUR_STEPS.map((_, i) => (
              <div key={i} style={{ height: 2, flex: i === tourStep ? 2 : 1, borderRadius: 99, background: i <= tourStep ? "#dc2626" : "rgba(255,255,255,0.08)", transition: "flex 0.25s" }} />
            ))}
          </div>

          {/* Buttons — on the welcome step the language buttons above are the
              primary action, so only a quiet Skip shows here. */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {tourStep > 0 && (
              <button onClick={() => setTourStep((s) => s - 1)} style={{ padding: "7px 12px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", fontSize: 12, cursor: "pointer" }}>
                {t("salesmanLite.tour.back")}
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={dismissTour} style={{ background: "none", border: "none", color: "#4b5563", fontSize: 11, cursor: "pointer", padding: "7px 6px" }}>
              {t("salesmanLite.tour.skip")}
            </button>
            {!isWelcome && (
            <button
              onClick={() => isLast ? dismissTour() : setTourStep((s) => s + 1)}
              style={{ padding: "7px 16px", borderRadius: 7, background: "#dc2626", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {isLast ? t("salesmanLite.tour.done") : t("salesmanLite.tour.next")}
            </button>
            )}
          </div>
        </div>
      </>
    );
  };

  // ── LOADING ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#05070e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.08)",
            borderTopColor: "#dc2626",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── LEGACY PENDING GATE (account_status) ──────────────────────────────────
  if (profile?.account_status === "pending") {
    return (
      <div style={{ minHeight: "100vh", background: "#05070e", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 28 }}>⏳</div>
          <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.8rem", letterSpacing: 2, color: "#fff", marginBottom: 8 }}>Pending Approval</h2>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, marginBottom: 24 }}>
            Your account is under review. We verify every agent before they can list cars — usually within 24 hours. You'll get a WhatsApp message once you're approved.
          </p>
          <p style={{ fontSize: 12, color: "#4b5563" }}>Questions? WhatsApp us at <a href="https://wa.me/60123456789" style={{ color: "#93c5fd", textDecoration: "none" }}>+60 12-345 6789</a></p>
          <button onClick={handleLogout} style={{ marginTop: 24, fontSize: 12, color: "#4b5563", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Sign out</button>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── SCHEDULED-DELETION GATE (self-service restore within 30-day grace) ─────
  if (profile?.account_status === "deleted") {
    const deletedAt = profile.deleted_at ? new Date(profile.deleted_at) : null;
    const daysLeft = deletedAt
      ? Math.max(0, 30 - Math.floor((Date.now() - deletedAt.getTime()) / 86400000))
      : 30;
    return (
      <div style={{ minHeight: "100vh", background: "#05070e", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 28 }}>🗑️</div>
          <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.8rem", letterSpacing: 2, color: "#fff", marginBottom: 8 }}>
            {t("salesmanLite.deletedGate.title")}
          </h2>
          <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.7, marginBottom: 24 }}>
            {t("salesmanLite.deletedGate.body", { days: daysLeft })}
          </p>
          <button
            onClick={handleReactivate}
            disabled={reactivating}
            style={{ padding: "11px 22px", borderRadius: 8, background: "#dc2626", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: reactivating ? "not-allowed" : "pointer", opacity: reactivating ? 0.6 : 1, fontFamily: "inherit" }}
          >
            {reactivating ? t("salesmanLite.deletedGate.reactivating") : t("salesmanLite.deletedGate.reactivate")}
          </button>
          <div>
            <button onClick={handleLogout} style={{ marginTop: 20, fontSize: 12, color: "#4b5563", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              {t("salesmanLite.deletedGate.signOut")}
            </button>
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── MAIN RENDER ───────────────────────────────────────────────────────────

  // Listing-gated tabs render a locked preview once the intro tour is finished
  // and no car has been listed yet. During the tour (tourStep !== null) the lock
  // lifts so the intro can show every panel in full.
  const gatedLocked = myListings.length === 0 && tourStep === null && !loading;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        color: "#fff",
      }}
    >
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        @keyframes slite-nudge-reveal{ from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .slite-nudge-reveal{ animation: slite-nudge-reveal 0.2s ease; }
      `}</style>

      {/* ── Nav ── */}
      {isMobile ? (
        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            height: 60,
            background: "#080a12",
            borderTop: "0.5px solid rgba(255,255,255,0.07)",
            display: "flex",
          }}
        >
          {TABS_MOBILE.map(({ tab, label, icon, badge }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                data-tour-id={tab}
                onClick={() => switchTab(tab)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: isActive ? "#f87171" : "#4b5563",
                  position: "relative",
                  padding: "6px 0",
                }}
              >
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      top: 5,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 3,
                      height: 3,
                      borderRadius: 99,
                      background: "#dc2626",
                    }}
                  />
                )}
                <div style={{ position: "relative" }}>
                  {icon}
                  {badge ? (
                    <span
                      style={{
                        position: "absolute",
                        top: -2,
                        right: -2,
                        width: 6,
                        height: 6,
                        background: "#ef4444",
                        borderRadius: "50%",
                      }}
                    />
                  ) : null}
                </div>
                {isActive && (
                  <span
                    style={{ fontSize: 9, color: "#f87171", lineHeight: 1 }}
                  >
                    {label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      ) : (
        <nav
          style={{
            width: 200,
            flexShrink: 0,
            background: "#080a12",
            borderRight: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            position: "sticky",
            top: 0,
            height: "100vh",
          }}
        >
          {/* Logo */}
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                background: "#dc2626",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontFamily: "'Bebas Neue', sans-serif",
                fontWeight: 700,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              S
            </div>
            <div>
              <p
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 15,
                  letterSpacing: "2px",
                  color: "#fff",
                  lineHeight: 1,
                  margin: 0,
                }}
              >
                SHIFTOS
              </p>
              <p
                style={{
                  fontSize: 10,
                  color: "#4b5563",
                  marginTop: 2,
                  marginBottom: 0,
                }}
              >
                · Lite Panel
              </p>
            </div>
          </div>

          {/* Nav items */}
          <p
            style={{
              fontSize: 10,
              color: "#374151",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "12px 16px 4px",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Main
          </p>
          {TABS_DESKTOP.map(({ tab, label, icon, badge }) => (
            <button
              key={tab}
              data-tour-id={tab}
              onClick={() => switchTab(tab)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 16px",
                margin: "1px 8px",
                borderRadius: 8,
                cursor: "pointer",
                background:
                  activeTab === tab ? "rgba(220,38,38,0.12)" : "transparent",
                border:
                  activeTab === tab
                    ? "0.5px solid rgba(220,38,38,0.2)"
                    : "0.5px solid transparent",
                color: activeTab === tab ? "#f87171" : "#6b7280",
                fontSize: 13,
                fontWeight: 500,
                width: "calc(100% - 16px)",
                textAlign: "left",
              }}
            >
              {icon}
              <span style={{ flex: 1 }}>{label}</span>
              {badge ? (
                <span
                  style={{
                    fontSize: 10,
                    background: "rgba(220,38,38,0.15)",
                    border: "1px solid rgba(220,38,38,0.22)",
                    color: "#f87171",
                    borderRadius: 99,
                    padding: "1px 6px",
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          ))}

          {/* Profile + logout */}
          <div
            style={{
              marginTop: "auto",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "rgba(220,38,38,0.15)",
                border: "1px solid rgba(220,38,38,0.22)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "#f87171",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                : (profile?.full_name || profile?.slug || "S")[0].toUpperCase()
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#e5e7eb",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {profile?.full_name || profile?.slug || "Salesman"}
              </p>
              <p style={{ fontSize: 10, color: "#4b5563", margin: 0 }}>lite</p>
            </div>
            <button
              onClick={() => setLogoutConfirmOpen(true)}
              title="Log out"
              aria-label="Log out"
              style={{
                background: "transparent",
                border: "none",
                color: "#4b5563",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </nav>
      )}

      {/* ── Content ── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: "#05070e",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Topbar */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "rgba(5,7,14,0.92)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: isMobile ? "12px 16px" : "14px 24px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {isMobile ? (
            <>
              <div
                style={{
                  width: 28,
                  height: 28,
                  background: "#dc2626",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                S
              </div>
              <p
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 15,
                  letterSpacing: "2px",
                  color: "#fff",
                  margin: 0,
                }}
              >
                SHIFTOS
              </p>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setNotifOpen((v) => !v)}
                title="Notifications"
                aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
                style={{
                  position: "relative",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  color: "#64748b",
                  padding: "8px 10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  marginRight: 6,
                }}
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: 5,
                      right: 5,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#ef4444",
                    }}
                  />
                )}
              </button>
              <ReportBugButton variant="inline" context="Salesman Lite" userLabel={profile?.full_name || profile?.email || ""} />
              <button
                onClick={() => setTourStep(0)}
                title="Show tour"
                aria-label="Show tour"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  color: "#64748b",
                  padding: "8px 10px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                ?
              </button>
              <button
                onClick={() => setLogoutConfirmOpen(true)}
                title="Log out"
                aria-label="Log out"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  color: "#64748b",
                  padding: "8px 10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <LogOut size={15} />
              </button>
            </>
          ) : (
<>
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 600,
                    color: "#f1f5f9",
                    letterSpacing: "-0.3px",
                  }}
                >
                  {(() => {
                    const h = new Date().getHours();
                    return h < 12
                      ? t("salesmanLite.greeting.morning")
                      : h < 17
                        ? t("salesmanLite.greeting.afternoon")
                        : t("salesmanLite.greeting.evening");
                  })()}
                  , {profile?.full_name?.split(" ")[0] || "there"}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: 2,
                  }}
                >
                  {new Date().toLocaleDateString("en-MY", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}{" "}
                  · {t("salesmanLite.header.litePanel")}
                </p>
              </div>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                title="Notifications"
                aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
                style={{
                  position: "relative",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  color: "#64748b",
                  padding: "8px 10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  marginRight: 6,
                }}
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: 5,
                      right: 5,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#ef4444",
                    }}
                  />
                )}
              </button>
              <ReportBugButton variant="inline" context="Salesman Lite" userLabel={profile?.full_name || profile?.email || ""} />
              <button
                onClick={() => setShowAddLead(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#dc2626",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "8px 14px",
                  cursor: "pointer",
                }}
              >
                <Plus size={14} /> {t("salesmanLite.header.addLead")}
              </button>
            </>
          )}
        </div>

        {/* Page content */}
        <div
          style={{
            padding: isMobile ? "16px 12px" : 24,
            flex: 1,
            paddingBottom: isMobile ? 80 : 24,
          }}
        >
          {/* Account review status. Deliberately a banner on every tab, not a
              blocking gate: a seller under review can and should keep building
              their listings, so the work is ready the moment they're approved.
              A rejection always carries the reason — being told "no" with no
              way to fix it is what turns a seller into a support ticket. */}
          {/* Suspension used to be invisible here: the seller lost the
              marketplace but kept a working dashboard with no explanation (A5). */}
          <SuspendedBanner />
          <AccountReviewBanner profile={profile} />

          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "listings" && renderListings()}
          {activeTab === "leads" && (gatedLocked ? renderLockedPanel("leads") : renderLeads())}
          {activeTab === "performance" && (gatedLocked ? renderLockedPanel("performance") : renderPerformance())}
          {activeTab === "enquiries" && (gatedLocked ? renderLockedPanel("enquiries") : (
            <div>
              {/* Sub-tab switcher */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {[
                  { key: "bookings", label: t("salesmanLite.inbox.bookings", { defaultValue: "Bookings" }), badge: pendingBookingsCount },
                  { key: "enquiries", label: t("salesmanLite.inbox.leadHistory", { defaultValue: "Lead History" }), badge: enquiries.filter((e) => e.status === "new").length },
                ].map(({ key, label, badge }) => (
                  <button
                    key={key}
                    data-tour-id={key === "bookings" ? "bookings" : undefined}
                    onClick={() => { setInboxSubTab(key); }}
                    style={{
                      fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                      background: inboxSubTab === key ? "rgba(220,38,38,0.15)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${inboxSubTab === key ? "rgba(220,38,38,0.35)" : "rgba(255,255,255,0.08)"}`,
                      color: inboxSubTab === key ? "#f87171" : "#6b7280",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    {label}
                    {badge > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: "#dc2626", color: "#fff", borderRadius: 99, padding: "0px 5px", minWidth: 16, textAlign: "center" }}>
                        {badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {inboxSubTab === "enquiries" ? renderEnquiries() : renderBookings()}
            </div>
          ))}
          {/* Buyer chat. Same component Premium uses — Lite gets the identical
              inbox, realtime, ticks and number-masking, minus the AI bar, which
              is replaced by the upgrade strip inside the thread. */}
          {activeTab === "chat" && (gatedLocked ? renderLockedPanel("chat") : (
            <SellerInbox
              salesmanId={userId}
              theme="dark"
              aiAssist={false}
              aiUpgrade
            />
          ))}
          {activeTab === "services" && (
            <ServicesAddonsTab dealerId={getDealerIdFromProfile(profile)} />
          )}
          {activeTab === "settings" && renderSettings()}
          {activeTab === "help" && <SalesmanLiteHelp />}
        </div>
      </div>

      {/* FAB — mobile leads tab */}
      {isMobile && activeTab === "leads" && (
        <button
          onClick={() => setShowAddLead(true)}
          style={{
            position: "fixed",
            bottom: 72,
            right: 16,
            zIndex: 40,
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "#dc2626",
            border: "none",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
          }}
        >
          <Plus size={20} />
        </button>
      )}

      {renderAddLeadModal()}
      {renderWAModal()}
      {renderLogCallModal()}
      {renderBatchWAModal()}
      {renderDeleteModal()}
      <LogoutConfirmModal
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
      />
      <ConfirmBookingModal
        apt={confirmBookingApt}
        message={confirmBookingMsg}
        onChangeMessage={setConfirmBookingMsg}
        onClose={() => { setConfirmBookingApt(null); setConfirmBookingMsg(""); }}
        onSend={sendConfirmBooking}
        onMoveToPipeline={moveConfirmBookingToPipeline}
      />
      <SellerBookingModal
        lead={sellerBookingLead}
        dateValue={sellerBookingDate}
        onChangeDate={setSellerBookingDate}
        onClose={() => { setSellerBookingLead(null); setSellerBookingDate(""); }}
        onConfirm={confirmSellerBooking}
        saving={sellerBookingSaving}
      />

      {/* IC gate — required before a car can be listed, and hard-enforced 2 weeks
          after signup (icEnforced). Stored HASHED (set_my_ic), never plaintext. */}
      {icGateOpen && (
        <div
          onClick={() => { if (!icGateSaving && !icEnforced) setIcGateOpen(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#111827", borderRadius: 12, width: "90%", maxWidth: 420, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(220,38,38,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ShieldCheck size={18} style={{ color: "#f87171" }} />
              </div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
                {icEnforced ? "Verify your IC to continue" : "Verify your IC to list cars"}
              </p>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>
              {icEnforced
                ? "Your 1-week grace period is up. Verify your MyKad IC to keep using your dashboard — it's required for every active seller on xdrive.my."
                : "Buyers need to know they're dealing with a real, accountable seller. Enter your MyKad IC once — it's required before any car goes live on xdrive.my."}
            </p>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", marginBottom: 7 }}>IC Number (MyKad)</label>
            <input
              autoFocus
              value={icGateVal}
              onChange={(e) => setIcGateVal(e.target.value.replace(/[^\d-]/g, ""))}
              placeholder="901231-10-1234"
              maxLength={14}
              onKeyDown={(e) => { if (e.key === "Enter") saveIcAndList(); }}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#e5e7eb", fontSize: 15, padding: "11px 13px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
            />
            <p style={{ margin: "7px 0 0", fontSize: 11, color: "#6b7280" }}>12 digits · stored hashed (never in plaintext), verification only.</p>
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button
                onClick={saveIcAndList}
                disabled={icGateSaving || icGateVal.replace(/\D/g, "").length !== 12}
                style={{ flex: 1, fontSize: 13, fontWeight: 700, padding: "11px", borderRadius: 8, background: "#dc2626", border: "none", color: "#fff", cursor: "pointer", opacity: icGateSaving || icGateVal.replace(/\D/g, "").length !== 12 ? 0.5 : 1 }}
              >
                {icGateSaving ? "Verifying…" : "Verify & continue"}
              </button>
              {!icEnforced && (
                <button
                  onClick={() => !icGateSaving && setIcGateOpen(false)}
                  style={{ fontSize: 13, fontWeight: 600, padding: "11px 16px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer" }}
                >
                  Later
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Test Drive outcome confirmation ── */}
      {testDriveConfirm && (() => {
        const { lead: tdLead, nextStage: tdNext } = testDriveConfirm;
        const car = tdLead.car_listings;
        const carName = car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : null;
        const fullCar = tdLead.car_listing_id ? myListings.find((c) => c.id === tdLead.car_listing_id) : null;
        const dismiss = () => setTestDriveConfirm(null);
        const viewCar = () => {
          dismiss();
          setSelectedCar(fullCar);
          setCarDetailImgIdx(0);
          setCarDetailTab("specs");
        };
        const proceed = () => {
          dismiss();
          advanceLeadStage(tdLead, tdNext, true);
        };
        const markLost = () => {
          dismiss();
          setLostPromptId(tdLead.id);
        };
        return (
          <div onClick={dismiss} style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 env(safe-area-inset-bottom)" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#0d1117", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "24px 24px 36px", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none" }}>
              {/* icon */}
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Car size={22} style={{ color: "#93c5fd" }} /></div>
              <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>How did the test drive go?</p>
              <p style={{ margin: "0 0 24px", fontSize: 13, color: "#6b7280", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>{tdLead.buyer_name || "Buyer"} · {carName || "no car linked"}</span>
                {fullCar && (
                  <button
                    onClick={viewCar}
                    style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", color: "#93c5fd", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    View car
                  </button>
                )}
              </p>
              {/* options */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={proceed}
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}
                >
                  <ThumbsUp size={20} style={{ flexShrink: 0, color: "#f87171" }} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: "#f1f5f9" }}>They're interested — move forward</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>Advance to {tdNext.replace(/_/g, " ")}</p>
                  </div>
                </button>
                <button
                  onClick={markLost}
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}
                >
                  <ThumbsDown size={20} style={{ flexShrink: 0, color: "#9ca3af" }} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: "#9ca3af" }}>Not interested</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#4b5563" }}>Mark as lost</p>
                  </div>
                </button>
                <button onClick={dismiss} style={{ width: "100%", padding: "10px", borderRadius: 10, background: "transparent", border: "none", color: "#4b5563", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* ── Won Sale confirmation ── */}
      {wonPrompt && (() => {
        const { lead: wonLead } = wonPrompt;
        const car = wonLead.car_listings;
        const carName = car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : null;
        const carPrice = car?.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : null;
        const dismiss = () => setWonPrompt(null);
        return (
          <div onClick={dismiss} style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 env(safe-area-inset-bottom)" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#0d1117", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "24px 24px 36px", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Award size={22} style={{ color: "#4ade80" }} /></div>
              <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Confirm Won Sale</p>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>
                {wonLead.buyer_name || "Buyer"}{carName ? ` · ${carName}` : ""}
                {carPrice ? ` · ${carPrice}` : ""}
              </p>
              {car ? (
                <div style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#4ade80", fontWeight: 600 }}>
                    The listing will be marked as <strong>Sold</strong> with today's date.
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
                    Your profit dashboard will update automatically.
                  </p>
                </div>
              ) : (
                <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#fbbf24" }}>
                    No car linked to this lead — only the lead stage will be updated.
                    Link a car first to also mark it as sold.
                  </p>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={handleMarkWon}
                  disabled={wonSaving}
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: wonSaving ? "rgba(34,197,94,0.06)" : "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: wonSaving ? "#4b5563" : "#22c55e", fontSize: 14, fontWeight: 700, cursor: wonSaving ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                >
                  {wonSaving ? "Saving…" : car ? "Confirm — Mark Listing as Sold" : "Confirm Won"}
                </button>
                <button onClick={dismiss} disabled={wonSaving} style={{ width: "100%", padding: "10px", borderRadius: 10, background: "transparent", border: "none", color: "#4b5563", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <WinShareCard
        prompt={shareWinPrompt}
        onClose={() => setShareWinPrompt(null)}
        slug={profile?.slug}
      />

      {renderFollowUpModal()}
      {renderNotifPanel()}
      {selectedCar && (
        <CarDetailPopup
          selectedCar={selectedCar} carStatsMap={carStatsMap}
          carDetailImgIdx={carDetailImgIdx} carDetailTab={carDetailTab} carDetailLbOpen={carDetailLbOpen}
          isMobile={isMobile}
          setCarDetailImgIdx={setCarDetailImgIdx} setCarDetailTab={setCarDetailTab}
          setCarDetailLbOpen={setCarDetailLbOpen} setSelectedCar={setSelectedCar}
          actions={[
            {
              key: "link",
              label: (<><Copy size={13} style={{ flexShrink: 0 }} /> Copy Link</>),
              color: listingCopied[selectedCar.id] === "link" ? "#4ade80" : "#9ca3af",
              bg: listingCopied[selectedCar.id] === "link" ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
              border: listingCopied[selectedCar.id] === "link" ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)",
              onClick: () => handleListingCopy(selectedCar, "link"),
            },
            {
              key: "wa",
              label: (<><MessageSquare size={13} style={{ flexShrink: 0 }} /> {listingCopied[selectedCar.id] === "wa" ? "✓ Copied!" : "WA Caption"}</>),
              color: listingCopied[selectedCar.id] === "wa" ? "#4ade80" : "#9ca3af",
              bg: listingCopied[selectedCar.id] === "wa" ? "rgba(34,197,94,0.08)" : "rgba(37,211,102,0.06)",
              border: listingCopied[selectedCar.id] === "wa" ? "rgba(34,197,94,0.3)" : "rgba(37,211,102,0.2)",
              onClick: () => handleListingCopy(selectedCar, "wa"),
            },
          ]}
        />
      )}
      {renderTour()}

      {/* Telegram setup nudge modal */}
      {telegramSetupModal && (
        <div
          onClick={() => setTelegramSetupModal(false)}
          style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 24, maxWidth: 340, width: "100%", fontFamily: "system-ui, sans-serif" }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Send size={20} style={{ color: "#93c5fd" }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Connect Telegram</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280" }}>Required to schedule appointment reminders</p>
              </div>
            </div>

            {/* Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {[
                { n: "1", text: <>Open Telegram and search <strong style={{ color: "#93c5fd" }}>@userinfobot</strong></> },
                { n: "2", text: <>Send <strong style={{ color: "#e5e7eb" }}>/start</strong> — the bot replies with your ID number</> },
                { n: "3", text: <>Go to <strong style={{ color: "#e5e7eb" }}>Settings → Telegram Notifications</strong> and paste the ID</> },
              ].map(({ n, text }) => (
                <div key={n} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)", color: "#93c5fd", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{n}</span>
                  <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>{text}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setTelegramSetupModal(false)}
                style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}
              >
                Not now
              </button>
              <button
                onClick={() => { setTelegramSetupModal(false); switchTab("settings"); }}
                style={{ flex: 2, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.35)", color: "#93c5fd", cursor: "pointer" }}
              >
                Go to Settings →
              </button>
            </div>
          </div>
        </div>
      )}

      {editListing && (
        <CarFormModal
          title="Edit Listing"
          subtitle={[editListing.brand, editListing.model, editListing.variant || ""].filter(Boolean).join(" ")}
          onClose={() => setEditListing(null)}
        >
          <CarForm
            listing={editListing}
            onUpdate={(updated) => {
              setMyListings((p) =>
                p.map((l) => (l.id === updated.id ? updated : l)),
              );
              setEditListing(null);
            }}
            onCreate={() => {}}
          />
        </CarFormModal>
      )}

      {/* ── Quick Brief Modal ── */}
      {quickBriefCar && (() => {
        const car = quickBriefCar;
        const name = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
        const price = car.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : "P.O.R";
        const monthly = car.selling_price ? Math.round(car.selling_price * 0.9 * 1.245 / 84) : null;
        const link = car.slug ? `https://xdrive.my/cars/${car.slug}?ref=${profile?.slug || ""}` : null;
        const brief = [
          `🚗 *${name}*`,
          `💰 ${price}${monthly ? ` (est. RM ${monthly.toLocaleString()}/mo)` : ""}`,
          car.mileage ? `📍 ${Number(car.mileage).toLocaleString()} km` : null,
          car.engine_cc ? `🔧 ${Number(car.engine_cc).toLocaleString()}cc` : null,
          car.transmission ? `⚙️ ${car.transmission}` : null,
          car.colour ? `🎨 ${car.colour}` : null,
          car.condition ? `✅ Condition: ${car.condition}` : null,
          car.city || car.state ? `📌 ${[car.city, car.state].filter(Boolean).join(", ")}` : null,
          link ? `\n🔗 ${link}` : null,
        ].filter(Boolean).join("\n");
        return (
          <div onClick={() => setQuickBriefCar(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#111827", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 480, padding: 24, paddingBottom: 36 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ margin: 0, fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}>Quick Brief</p>
                <button onClick={() => setQuickBriefCar(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}><X size={18} /></button>
              </div>
              <textarea
                readOnly
                value={brief}
                rows={10}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#e5e7eb", fontSize: 13, lineHeight: 1.7, padding: "10px 12px", resize: "none", outline: "none", fontFamily: "inherit" }}
              />
              <button
                onClick={() => { navigator.clipboard.writeText(brief); setBriefCopied(true); setTimeout(() => setBriefCopied(false), 2000); }}
                style={{ marginTop: 12, width: "100%", padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, background: briefCopied ? "rgba(34,197,94,0.15)" : "rgba(56,189,248,0.15)", border: `1px solid ${briefCopied ? "rgba(34,197,94,0.4)" : "rgba(56,189,248,0.4)"}`, color: briefCopied ? "#4ade80" : "#38bdf8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {briefCopied ? <><Check size={14}/> Copied!</> : <><Copy size={14}/> Copy Brief</>}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Loan Calculator Modal ── */}
      {loanCalcLead && (() => {
        const car = loanCalcLead.car_listings;
        const p = parseFloat(loanPrice) || 0;
        const downAmt = p * (parseFloat(loanDown) / 100);
        const principal = p - downAmt;
        const r = parseFloat(loanRate) / 100;
        const y = parseFloat(loanYears);
        const monthly = principal > 0 && y > 0 ? Math.round(principal * (1 + r * y) / (y * 12)) : null;
        const tenures = [5, 7, 9];
        return (
          <div onClick={() => setLoanCalcLead(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#111827", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 480, padding: 24, paddingBottom: 36 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <p style={{ margin: 0, fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}>{t("salesmanLite.loanCalc.title")}</p>
                <button onClick={() => setLoanCalcLead(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}><X size={18} /></button>
              </div>
              {car && <p style={{ margin: "0 0 14px", fontSize: 11, color: "#4b5563" }}>{loanCalcLead.buyer_name || t("salesmanLite.loanCalc.leadFallback")} · {car.year} {car.brand} {car.model}</p>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[
                  { label: t("salesmanLite.loanCalc.price"), value: loanPrice, set: setLoanPrice, placeholder: "e.g. 85000" },
                  { label: t("salesmanLite.loanCalc.downPayment"), value: loanDown, set: setLoanDown, placeholder: "e.g. 10" },
                  { label: t("salesmanLite.loanCalc.interestRate"), value: loanRate, set: setLoanRate, placeholder: "e.g. 3.5" },
                  { label: t("salesmanLite.loanCalc.tenure"), value: loanYears, set: setLoanYears, placeholder: "e.g. 7" },
                ].map(({ label, value, set, placeholder }) => (
                  <div key={label}>
                    <p style={{ margin: "0 0 4px", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                    <input
                      type="number"
                      value={value}
                      onChange={e => set(e.target.value)}
                      placeholder={placeholder}
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f1f5f9", fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                ))}
              </div>
              {monthly !== null && (
                <>
                  <div style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 10, textAlign: "center" }}>
                    <p style={{ margin: "0 0 2px", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("salesmanLite.loanCalc.estMonthly")}</p>
                    <p style={{ margin: 0, fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#fbbf24", letterSpacing: 1 }}>RM {monthly.toLocaleString()}</p>
                    <p style={{ margin: 0, fontSize: 10, color: "#4b5563" }}>{loanYears}{t("salesmanLite.loanCalc.yrs")} · {loanRate}% · {loanDown}% {t("salesmanLite.loanCalc.down")}</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                    {tenures.map(yr => {
                      const m = Math.round(principal * (1 + r * yr) / (yr * 12));
                      return (
                        <div key={yr} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                          <p style={{ margin: "0 0 2px", fontSize: 9, color: "#4b5563", textTransform: "uppercase" }}>{yr} {t("salesmanLite.loanCalc.yrs")}</p>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e5e7eb" }}>RM {m.toLocaleString()}</p>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => {
                      const car = loanCalcLead.car_listings;
                      const carName = car ? `${car.year} ${car.brand} ${car.model}` : "the car";
                      const msg = `Hi ${loanCalcLead.buyer_name || ""}! Based on ${carName} at RM ${Number(loanPrice).toLocaleString()}, here's your rough monthly:\n\n${tenures.map(t => `• ${t} tahun: RM ${Math.round(principal*(1+r*t)/(t*12)).toLocaleString()}/bulan`).join("\n")}\n\n(${loanDown}% down, ${loanRate}% interest rate)\n\nBoleh kita discuss further? 😊`;
                      setWaModalMessage(msg);
                      setWaModalLead(loanCalcLead);
                      setLoanCalcLead(null);
                    }}
                    style={{ marginTop: 12, width: "100%", padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24", cursor: "pointer" }}
                  >
                    {t("salesmanLite.loanCalc.sendViaWhatsapp")}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Deposit Receipt Modal ── */}
      {depositModal && (() => {
        const lead = depositModal;
        const car = lead.car_listings;
        const carName = car ? `${car.year || ""} ${car.brand} ${car.model}`.trim() : "Vehicle";
        const today = new Date().toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" });
        const receipt = [
          `📋 *DEPOSIT RECEIPT*`,
          `━━━━━━━━━━━━━━━━━━`,
          `Date: ${today}`,
          `Buyer: ${lead.buyer_name || "—"}`,
          lead.phone ? `Contact: ${lead.phone}` : null,
          ``,
          `Vehicle: ${carName}`,
          car?.selling_price ? `Agreed Price: RM ${Number(car.selling_price).toLocaleString("en-MY")}` : null,
          `Deposit Paid: RM ${depositAmount || "___"}`,
          ``,
          `This deposit confirms the buyer's intention to purchase the above vehicle. Balance payable upon completion of sale.`,
          ``,
          `Salesman: ${profile?.full_name || "—"}`,
          profile?.whatsapp_number ? `Contact: ${profile.whatsapp_number}` : null,
        ].filter(s => s !== null).join("\n");
        return (
          <div onClick={() => setDepositModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#111827", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 480, padding: 24, paddingBottom: 36 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <p style={{ margin: 0, fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}>{t("salesmanLite.deposit.title")}</p>
                <button onClick={() => setDepositModal(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}><X size={18} /></button>
              </div>
              <p style={{ margin: "0 0 14px", fontSize: 11, color: "#4b5563" }}>{lead.buyer_name || t("salesmanLite.deposit.leadFallback")} · {carName}</p>
              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: "0 0 4px", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("salesmanLite.deposit.depositAmount")}</p>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f1f5f9", fontSize: 14, padding: "10px 12px", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <textarea readOnly value={receipt} rows={12} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#e5e7eb", fontSize: 12, lineHeight: 1.7, padding: "10px 12px", resize: "none", outline: "none", fontFamily: "inherit", marginBottom: 12 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  onClick={() => { navigator.clipboard.writeText(receipt); setDepositCopied(true); setTimeout(() => setDepositCopied(false), 2000); }}
                  style={{ padding: "10px 0", borderRadius: 10, fontSize: 12, fontWeight: 700, background: depositCopied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${depositCopied ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.12)"}`, color: depositCopied ? "#4ade80" : "#9ca3af", cursor: "pointer" }}
                >
                  {depositCopied ? t("salesmanLite.deposit.copied") : t("salesmanLite.deposit.copyText")}
                </button>
                <button
                  onClick={() => {
                    const phone = (lead.phone || "").replace(/\D/g, "");
                    if (phone) window.location.href = `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${encodeURIComponent(receipt)}`;
                    setDepositModal(null);
                  }}
                  style={{ padding: "10px 0", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.3)", color: "#4ade80", cursor: "pointer" }}
                >
                  {t("salesmanLite.deposit.sendViaWa")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* ── Link Car Modal ── */}
      {linkCarLeadId && (() => {
        const lead = leads.find((l) => l.id === linkCarLeadId);
        const available = myListings.filter((c) => c.status !== "sold");
        return (
          <div onClick={() => setLinkCarLeadId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#111827", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 480, padding: 20, paddingBottom: 36 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <p style={{ margin: 0, fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}>{t("salesmanLite.linkCar.title")}</p>
                <button onClick={() => setLinkCarLeadId(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}><X size={18} /></button>
              </div>
              {lead?.buyer_name && (
                <p style={{ margin: "0 0 14px", fontSize: 11, color: "#4b5563" }}>{lead.buyer_name}</p>
              )}
              {available.length === 0 ? (
                <p style={{ fontSize: 12, color: "#4b5563", textAlign: "center", padding: "24px 0" }}>{t("salesmanLite.linkCar.noListings")}</p>
              ) : (
                <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                  {available.map((car) => {
                    const img = car.images?.[0];
                    const name = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
                    const isLinked = lead?.car_listing_id === car.id;
                    return (
                      <div key={car.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: `1px solid ${isLinked ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10 }}>
                        {img
                          ? <img src={img} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                          : <div style={{ width: 48, height: 48, borderRadius: 6, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Car size={20} color="#374151" /></div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                          {car.selling_price && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#60a5fa" }}>RM {Number(car.selling_price).toLocaleString("en-MY")}</p>}
                        </div>
                        {isLinked
                          ? <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 600, flexShrink: 0 }}>{t("salesmanLite.linkCar.linked")}</span>
                          : <button onClick={() => handleLinkCar(linkCarLeadId, car.id)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.22)", color: "#f87171", cursor: "pointer", flexShrink: 0, fontWeight: 600 }}>{t("salesmanLite.linkCar.link")}</button>
                        }
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}
      {/* One in-app conversation, over whatever tab you are on. Mounted at page
          level (not inside the leads render) so the pipeline card, the lead
          panel and anything added later open the same sheet. Lite gets the
          locked AI strip inside the thread, same as the inbox. */}
      {chatSheet && (
        <ChatSheet
          threadId={chatSheet.threadId}
          buyerName={chatSheet.buyerName}
          carLabel={chatSheet.carLabel}
          theme="dark"
          aiAssist={false}
          aiUpgrade
          onClose={() => setChatSheet(null)}
        />
      )}

    </div>
  );
}
