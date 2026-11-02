import React, { useEffect, useMemo, useRef, useState } from "react";
import { useModalHistory } from '../hooks/useModalHistory';
import { createPortal } from "react-dom";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import ReferralCard from "../components/referral/ReferralCard";
import MyNewModels from "../components/newcar/MyNewModels";
import PremiumUpgradeCard from "../components/premium/PremiumUpgradeCard";
import ChangePasswordCard from "../components/account/ChangePasswordCard";
import { claimStoredInvite } from "../utils/invite";
import { isWonDealBlock, offerUndoSale, relistCar, reopenWonLeads } from "../utils/undoSale";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import { readHandoffTokens, clearHandoffTokens } from "../lib/authHandoff";
import { routeForRole } from "../hooks/useRoleRedirect";
import { isPremiumSalesman } from "../utils/salesmanPlan";
import { normalizePhone, toPlus60, isValidMyPhone, MY_PHONE_ERROR } from "../lib/phone";
import PhoneInput from "../components/ui/PhoneInput";
import { cdnImg } from "../utils/img";
import { compressImageFile } from "../utils/compressImage";
import { copyListingCaption } from "../utils/copyListingCaption";
import { SITE_URL } from "../config/site";
import { usePersistentState } from "../hooks/usePersistentState";
import { useSellerFeedback } from "../hooks/useSellerFeedback";
import { carNextStep, pickSilentCar } from "../utils/carCoach";
import DashboardTab from "./salesmanLite/DashboardTab";
import ListingsTab from "./salesmanLite/ListingsTab";
import "./salesmanLite/keys.css";
import ShareTour from "../components/coach/ShareTour";
import { PRIVATE_CAR_LIMIT, isPrivateLimitError, statusAfterWrite } from "../utils/privateCars";
import CarDetailPopup from "../components/CarDetailPopup";
import { hydrateLeadInto } from "../utils/leadHydrate";
import { getDealerIdFromProfile } from "../hooks/useProfile";
import {
  panel as C,
  panelType as T,
  panelRadius as R,
  premiumDark as PD,
  withAlpha,
} from "../theme/tokens";
import { compareFollowUp, isLeadStale, lastTouch, followUpStatus, FOLLOW_UP_REASON, localDateKey } from "../lib/leadsHelpers";
import FollowUpRow from "../components/crm/FollowUpRow";
import ServicesAddonsTab from "../components/salesman/ServicesAddonsTab";
import SalesmanLiteHelp from "../components/SalesmanLiteHelp";
import ShareMenu from "../components/ShareMenu";
import ReportBugButton from "../components/ReportBugButton";
import PushToggle from "../components/PushToggle";
import VerifyIdentity from "../components/kyc/VerifyIdentity";
import SellerIdCard from "../components/kyc/SellerIdCard";
import WonVariantPick from "../components/newcar/WonVariantPick";
import AccountApprovedBanner from "../components/AccountApprovedBanner";
import SuspendedBanner from "../components/SuspendedBanner";
import { PremiumEndedBanner } from "../components/premium/PremiumStatusBanner";
import { PLAN_CONFIG } from "../utils/planConfig";
import SellerInbox from "../components/chat/SellerInbox";
import ChatSheet from "../components/chat/ChatSheet";
import PushPromptStrip, { PANEL_THEME } from "../components/chat/PushPromptStrip";
import NotificationPanel from "../components/notifications/NotificationPanel";
import { starterTasksAllDone, hasBioLinkVisit } from "../components/onboarding/StarterTasks";
import { markStarterTask } from "../utils/starterTasks";
import { useChatThreads } from "../hooks/useChat";
import { hasUnreadRejection } from "../utils/listingReview";
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
  Trash2,
  Send,
  Pencil,
  Settings,
  Bell,
  TrendingUp,
  Calendar,
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
  ThumbsUp,
  ThumbsDown,
  Star,
} from "lucide-react";
import { liveChannel } from "../lib/liveChannel";
import { AreaChart, Area, ResponsiveContainer, Tooltip as RTooltip, XAxis } from "recharts";
import {
  readCache,
  writeCache,
  redactLeadsForCache,
  redactProfileForCache,
  clearPanelDataCache,
  rememberPanelUid,
  seedPanelCache,
} from "../utils/panelCache";
import { refreshListingFromNotice } from "../utils/listingNotice";
import AvailabilityEditor from "../components/AvailabilityEditor";
import ProfileLoadError from "../components/ProfileLoadError";
const LoanPosterSheet = React.lazy(() => import("../components/poster/LoanPosterSheet"));
// The add/edit form (with photo drag-and-drop and the chassis decoder) loads
// when it opens, not with the dashboard.
const CarForm = React.lazy(() => import("../components/CarForm"));
const SellerFeedbackTab = React.lazy(() => import("../components/feedback/SellerFeedbackTab"));

// Cache namespace for this panel (keys look like `slite_leads_<uid>`).
const PANEL_CACHE_KEY = "slite";

// The pipeline card renders lead.car_listings, so every path that puts a lead
// into state has to carry this join — not just the bootstrap fetch.
const LEAD_SELECT =
  "*, car_listings(brand, model, year, variant, selling_price, images, vin_number, mileage, transmission, fuel_type, plate_number, slug)";

// Lazy-load JSZip from CDN once, only when a salesman actually downloads photos.
let _jszipPromise = null;
function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (_jszipPromise) return _jszipPromise;
  _jszipPromise = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => res(window.JSZip);
    s.onerror = rej;
    document.body.appendChild(s);
  });
  return _jszipPromise;
}

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
  // Back asks first: it wraps a multi-step form.
  useModalHistory(true, onClose, { isDirty: () => true });
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

// "Give them something worth keeping" — a lightweight celebration sheet that
// fires right after a deal closes (handleMarkWon) — as "Goal smashed" when that
// win is the one that crosses the monthly target — offering to share the
// mini-storefront link via the existing ShareMenu channels. Deliberately never
// shows the commission figure — that stays private, only the win + a link to
// the salesman's other listings goes out. Portal + body-scroll lock per the
// app's overlay rules; own × / overlay-click close; the back gesture closes it too
// (useModalHistory).
function WinShareCard({ prompt, onClose, slug }) {
  useModalHistory(!!prompt, onClose);
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
              style={{ width: "100%", justifyContent: "center", padding: "13px 16px", fontSize: 14, fontWeight: 700, background: "#dc2626", border: "1px solid #dc2626", color: "#fff", borderRadius: 12 }}
            />
            <button onClick={onClose} style={{ width: "100%", padding: "10px", borderRadius: 10, background: "transparent", border: "none", color: "#9ca3af", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
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
// lock per the app's overlay rules; own × / overlay-click close; the back gesture closes it too
// (useModalHistory).
function ConfirmBookingModal({ apt, message, onChangeMessage, onClose, onSend, onMoveToPipeline }) {
  useModalHistory(!!apt, onClose);
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
// close controls; the back gesture closes it too (useModalHistory).
function LogoutConfirmModal({ open, onClose, onConfirm }) {
  useModalHistory(!!open, onClose);
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
  useModalHistory(!!lead, onClose);
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
const VALID_LITE_TABS = ["dashboard", "listings", "leads", "enquiries", "chat", "feedback", "performance", "services", "settings", "help"];

// Settings sections, one subject each. Mirrors Premium's SETTINGS_GROUPS
// (SalesmanPremium.jsx:200) so the two panels are the same screen with
// different fields. Order is by how often a seller needs it, not by how the
// fields happen to sit in the file.
const LITE_SETTINGS_NAV = [
  { key: "profile", labelKey: "salesmanLite.settings.navProfile", fallback: "Profile" },
  { key: "contact", labelKey: "salesmanLite.settings.navContact", fallback: "Contact & Location" },
  { key: "selling", labelKey: "salesmanLite.settings.navSelling", fallback: "Selling" },
  { key: "newcars", labelKey: "salesmanLite.settings.navNewCars", fallback: "New cars" },
  { key: "alerts", labelKey: "salesmanLite.settings.navAlerts", fallback: "Alerts" },
  { key: "premium", labelKey: "salesmanLite.settings.navPremium", fallback: "Premium" },
  { key: "refer", labelKey: "salesmanLite.settings.navRefer", fallback: "Refer a seller" },
  { key: "account", labelKey: "salesmanLite.settings.navAccount", fallback: "Account" },
];

// Top-bar door to Premium. One red accent, small: it sits beside the bell, so
// it must not shout over the panel's own primary action.
function GoPremiumButton({ onClick, compact }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Go Premium"
      style={{
        display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
        background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.35)",
        borderRadius: 8, color: "#fca5a5", padding: compact ? "8px 8px" : "8px 12px",
        fontSize: compact ? 11 : 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        marginRight: compact ? 0 : 6, whiteSpace: "nowrap",
      }}
    >
      {/* Phone: text only. The bar already holds the logo + four icon
          buttons, and a 360px screen has ~60px left for this. */}
      {!compact && <Sparkles size={13} />} {compact ? "Premium" : "Go Premium"}
    </button>
  );
}

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

  // First-frame cache seed. Everything below initialises from what this device
  // already knows about the last signed-in user, so the panel paints on frame 1
  // instead of after getSession() -> profiles.select() -> the data queries (three
  // serial round trips to ap-southeast-2 before a single pixel). The live
  // bootstrap below overwrites all of it, and clears it if the real uid differs.
  const [seed] = useState(() => seedPanelCache(PANEL_CACHE_KEY));

  const [profile, setProfile] = useState(seed.profile);
  // A seller who signed up through someone's invite link (?invite=) gets it
  // attached once the panel knows who they are. claim_referral decides if it
  // counts; nothing here can set referred_by directly (src/utils/invite.js).
  useEffect(() => { if (profile?.id) claimStoredInvite(); }, [profile?.id]);
  const [userId, setUserId] = useState(seed.uid);
  // A cached profile is enough to render the panel; the fresh one lands moments
  // later and every access gate below (pending / deleted / wrong role) re-runs
  // against it. Without a cached profile this is the old blocking spinner.
  const [loading, setLoading] = useState(!seed.profile);
  // A failed read of our own profile (DB stall) shows ProfileLoadError, not /login.
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
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
  // The one door to Premium (owner, 2026-10-05): the top-bar button and the
  // listing-cap prompt both open Settings > Premium (PremiumUpgradeCard), the
  // single upgrade screen. Never build a second one.
  function goPremium() {
    setShowAddForm(false);
    setSettingsNav("premium");
    switchTab("settings");
  }

  function switchTab(tab) {
    setActiveTab(tab);
  }

  // No IC gate here any more (owner, 2026-10-12: less friction while we grow).
  // Typing an IC number checked nothing, and the real check, the MyKad photos
  // behind is_verified, earns the Verified badge and does not gate listings
  // (20261017b). SellerIdCard invites them to get verified.
  function openAddListing() {
    setShowAddForm(true);
  }

  // listings
  const [myListings, setMyListings] = useState(seed.listings);
  // Questions, reviews and likes on this seller's cars (FEEDBACK-1). One copy
  // for the nav badge and the Feedback tab. Free on Lite: it is a buyer
  // reaching the seller, and Lite never gates that.
  const feedback = useSellerFeedback(userId, myListings.map((c) => c.id));
  const [listingCopied, setListingCopied] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  // The IC number and MyKad photos are asked for in ONE place: the step-by-step
  // VerifyIdentity flow at the top of Settings > Profile (owner, 2026-10-12).

  // leads
  const [leads, setLeads] = useState(seed.leads || []);
  const [staleLeads, setStaleLeads] = useState([]);
  // "Reward the comeback" — true for this session only, when the salesman is
  // opening Lite after a 3+ day gap. Swaps the stale-leads scold in the
  // greeting for a welcome-back line instead (see the profile-load effect
  // that sets this, and personalizedLine in renderDashboard).
  const [isReturning, setIsReturning] = useState(false);
  const [leadsLoading, setLeadsLoading] = useState(!seed.leads);
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
  const saveGoal = (patch) => {
    const next = { ...goal, ...patch };
    setGoal(next);
    if (!userId) return;
    localStorage.setItem(`slite_goal_${userId}`, JSON.stringify(next));
    supabase.from("profiles").update({ lite_goal: next }).eq("id", userId).then(({ error }) => {
      if (error) console.error("saveGoal:", error);
    });
  };

  // The "Goal smashed" card is NOT fired from an effect on page load any more.
  // It used to open on its own the moment the page loaded over target, and
  // people closed it by reflex thinking it was something else. It now fires
  // only in handleMarkWon, on the win that actually crosses the target.

  // settings
  const [settingsForm, setSettingsForm] = useState({
    full_name: "",
    whatsapp_number: "",
    telegram_chat_id: "",
    city: "",
    state: "",
    location: "",
    // The bio buyers read on the mini page. Lite scored the seller on having
    // one but gave them nowhere to write it, and scored the wrong column
    // (about_text, the dealer-storefront "About us") — the mini page and
    // Premium both read `bio`. One field, one column, both panels.
    bio: "",
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
  // Which Settings subject is open. Defaults to the first rather than to a
  // menu: on desktop the rail is always visible, and on mobile the pill row
  // is, so there is never a state where the seller is looking at nothing.
  // ?section=<key> opens a settings section directly (the /plans Premium card
  // sends a signed-in Lite seller to ?section=premium).
  const [settingsNav, setSettingsNav] = useState(() => {
    const s = new URLSearchParams(window.location.search).get("section");
    return LITE_SETTINGS_NAV.some((n) => n.key === s) ? s : "profile";
  });
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

  // listings sort/filter — reset whenever user navigates to the listings tab:
  // to the tab a notification tap asked for, else to Rejected while a rejection
  // is still unread (it is the one thing on this page that needs the seller),
  // else Available.
  const [sortBy, setSortBy] = useState("newest");
  const [filterStatus, setFilterStatus] = useState("available");
  const listingFilterIntent = useRef(null);
  const listingStatusRef = useRef({});
  useEffect(() => {
    if (activeTab !== "listings") return;
    setFilterStatus(listingFilterIntent.current || (hasUnreadRejection(notifications, myListings) ? "rejected" : "available"));
    listingFilterIntent.current = null;
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
  // Lock body scroll while the booking-detail popup is open (overlay rule).
  useEffect(() => {
    if (!bookingDetailId) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [bookingDetailId]);

  // per-listing analytics (carStatsMap)
  // Saved on the device so the dashboard numbers paint instantly; as plain
  // state every open showed 0 views / 0 visits / 0 taps until the requests
  // came back one by one.
  const [carStatsMap, setCarStatsMap, carStatsCached] = usePersistentState(userId ? `sl_carstats:${userId}` : null, {});
  // per-car share-channel breakdown: { [car_id]: [{ channel, views, enquiries }] }
  const [channelMap, setChannelMap] = useState({});
  // Mini-page (/s/:slug) footprint stats: { visits, cardClicks, byChannel: [{ channel, visits, card_clicks }] }
  const [minipageStats, setMinipageStats, minipageCached] = usePersistentState(
    userId ? `sl_minipage:${userId}` : null, { visits: 0, cardClicks: 0, byChannel: [] },
  );
  // The numbers show together: the saved copy if there is one, else
  // placeholders until every request behind them has answered.
  const [trafficFetched, setTrafficFetched] = useState(false);
  const trafficReady = trafficFetched || (carStatsCached && minipageCached);
  const [shareTourCar, setShareTourCar] = useState(null); // COACH-1 share tour target

  // car detail popup
  const [selectedCar, setSelectedCar] = useState(null);
  const [carDetailImgIdx, setCarDetailImgIdx] = useState(0);
  const [carDetailTab, setCarDetailTab] = useState("specs");
  const [carDetailLbOpen, setCarDetailLbOpen] = useState(false);
  const [editListing, setEditListing] = useState(null);

  // tour
  const [tourStep, setTourStep] = useState(null);
  // Session-only: hiding the finished starter card should not need a DB write,
  // and it comes back on the next visit only while there is still work in it
  // (the card renders its own "you're set up" state once all three are done).
  const [starterHidden, setStarterHidden] = useState(false);
  // Whether the listings query has actually come back. `loading` flips as soon
  // as the PROFILE resolves, while listings are a separate, later fetch that
  // seeds from an empty cache — so the starter checklist rendered with
  // listingCount 0 and told a fully set-up seller to add their first car, for
  // the fraction of a second before the real count landed. That flash is the
  // "it still appears for a second every time I log in" report.
  const [listingsLoaded, setListingsLoaded] = useState(false);
  // Cars hidden because Premium lapsed with more live cars than Lite allows
  // (sweep_premium_lapses, migration 20261019a). They are status 'unpublished'
  // in the DB but show under Available, blacked out, so the seller can still
  // see them and their numbers. Renewal unlocks them server side.
  const [lockedIds, setLockedIds] = useState(() => new Set());
  // apply_my_premium_lapse (20261031a) locks a just-lapsed seller's extra cars
  // NOW instead of waiting for the daily sweep, then returns the locked ids.
  // Until that migration is live it errors and we fall back to the plain read.
  useEffect(() => {
    if (!listingsLoaded || !userId) return;
    let alive = true;
    const toIds = (data, key) => new Set((data || []).map((r) => (typeof r === "string" ? r : r[key])));
    (async () => {
      let { data, error } = await supabase.rpc("apply_my_premium_lapse");
      let ids = error ? null : toIds(data, "apply_my_premium_lapse");
      if (error) {
        ({ data, error } = await supabase.rpc("get_my_locked_listings"));
        // Missing function (migration not applied yet) = nothing locked.
        if (!error) ids = toIds(data, "get_my_locked_listings");
      }
      if (!alive || !ids) return;
      setLockedIds(ids);
      // A car locked by this very call still says "available" in our list.
      if (ids.size) setMyListings((p) => p.map((c) => (ids.has(c.id) && c.status !== "unpublished" ? { ...c, status: "unpublished" } : c)));
    })();
    return () => { alive = false; };
  }, [listingsLoaded, userId]);
  const isLockedCar = (c) => c.status === "unpublished" && lockedIds.has(c.id);
  // Status of every car as we last saw it — the realtime handler compares
  // against this because Supabase does not send the old row.
  useEffect(() => {
    listingStatusRef.current = Object.fromEntries(myListings.map((c) => [c.id, c.status]));
  }, [myListings]);
  // Data can arrive after the seller is already on Listings (first load, or a
  // rejection landing live). Jump to Rejected once per session when it does.
  const rejectionLanded = useRef(false);
  useEffect(() => {
    if (rejectionLanded.current || activeTab !== "listings" || !listingsLoaded) return;
    if (hasUnreadRejection(notifications, myListings)) {
      rejectionLanded.current = true;
      setFilterStatus("rejected");
    }
  }, [activeTab, listingsLoaded, notifications, myListings]);

  // Dismissal is PERSISTED, not component state. It was `useState(false)` with
  // nothing written anywhere, so the card came back on every single login no
  // matter what the seller had finished or dismissed. It goes in
  // profiles.starter_tasks, the same place `minipage_visited` already lives.
  const dismissStarterTasks = () => {
    setStarterHidden(true);
    markStarterTask(userId, "dismissed", profile?.starter_tasks);
  };

  // Finishing all three retires the card for good. Waits for `listingsLoaded`
  // for the same reason the render does — before that, `listingCount` is 0 and
  // "all done" is unanswerable.
  //
  // Deliberately does NOT touch local `profile` state: writing the flag back
  // would unmount the card mid-session, so the seller would never see the
  // "you're set up" state they just earned. It stays for this visit and is
  // gone on the next load, which is what "disappears and never loads again"
  // actually means.
  useEffect(() => {
    if (!userId || !listingsLoaded) return;
    if (profile?.starter_tasks?.dismissed) return;
    if (!starterTasksAllDone({ profile, listingCount: myListings.length, noBio: true, bioLinkSeen: hasBioLinkVisit(minipageStats.byChannel) })) return;
    markStarterTask(userId, "dismissed", profile?.starter_tasks);
  }, [userId, listingsLoaded, profile, myListings.length, minipageStats.byChannel]);

  // Opening your own mini page is the one starter task nothing else can prove,
  // so the click that does it is what records it. Used by the starter card AND
  // by the mini-page link in the hero — either one counts, because both are the
  // seller looking at their own storefront.
  const openMyMinipage = async () => {
    if (profile?.slug) window.open(`/s/${profile.slug}`, "_blank", "noopener,noreferrer");
    const next = await markStarterTask(userId, "minipage_visited", profile?.starter_tasks);
    setProfile((p) => (p ? { ...p, starter_tasks: next } : p));
  };
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
    // Publishing a private car goes to review first (PRIVATE-1), like a new car.
    const shownStatus = statusAfterWrite(car, newStatus);
    setMyListings((p) => p.map((c) => c.id === car.id ? { ...c, status: shownStatus, sold_at: optimisticSoldAt } : c));
    // Use RPC to avoid PostgREST bug with GENERATED ALWAYS columns (gross_profit)
    const { error: statusErr } = await supabase.rpc("update_listing_status", {
      p_listing_id: car.id,
      p_status:     newStatus,
      p_dealer_id:  userId,
    });
    if (statusErr) {
      console.error("updateListingStatus:", statusErr);
      setMyListings((p) => p.map((c) => c.id === car.id ? { ...c, status: prevStatus, sold_at: prevSoldAt } : c));
      if (isWonDealBlock(statusErr)) {
        offerUndoSale(car.id, () => {
          setMyListings(relistCar(car.id));
          setLeads(reopenWonLeads(car.id));
          refreshCommissionData();
        });
      } else if (isPrivateLimitError(statusErr)) {
        toast.error(t("privateCars.limit", { n: PRIVATE_CAR_LIMIT }));
      } else {
        toast.error(t("salesmanLite.toast.statusUpdateFailed"));
      }
      return;
    }
    if (shownStatus === "pending_approval") toast.success(t("privateCars.sentForReview"));
    writeCache(`slite_listings_${userId}`, myListings.map((c) => c.id === car.id ? { ...c, status: shownStatus, sold_at: optimisticSoldAt } : c));
    // Keep the "This Month" revenue/commission card in sync when selling from the Listings tab
    refreshCommissionData();
  };

  // delete listing
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // listing action overflow menu
  const [actionMenuCarId, setActionMenuCarId] = useState(null);
  const [posterCar, setPosterCar] = useState(null); // Loan poster sheet target (4 free cars a month)

  // "Delete" ARCHIVES the car (status='archived'), never a hard DELETE: that
  // unlinked the car from every lead and chat and passed the 8s limit on a
  // slow database (2026-10-18). Archived cars are hidden here, on the
  // marketplace and from the listing cap. One request per car at a time.
  const [deletingId, setDeletingId] = useState(null);
  const handleDeleteListing = async (carId) => {
    if (deletingId) return;
    setDeletingId(carId);
    // .select() returns the rows actually changed: RLS turns a refused update
    // into "0 rows, no error", and the car came back on the next load.
    const { data: archived, error } = await supabase
      .from("car_listings")
      .update({ status: "archived" })
      .eq("id", carId)
      .eq("dealer_id", userId)
      .select("id");
    setDeletingId(null);
    if (!error && !archived?.length) {
      toast.error(t("salesmanLite.toast.listingDeleteFailed"));
      return;
    }
    if (error) {
      console.error("handleDeleteListing:", error);
      if (isWonDealBlock(error)) {
        // Same way out as the status menu: a car with a won deal stays sold.
        offerUndoSale(carId, () => {
          setMyListings(relistCar(carId));
          setLeads(reopenWonLeads(carId));
          refreshCommissionData();
        });
      } else {
        toast.error(t(error.code === "57014" ? "salesmanLite.toast.listingDeleteBusy" : "salesmanLite.toast.listingDeleteFailed"));
      }
      return;
    }
    setMyListings((p) => {
      const next = p.filter((c) => c.id !== carId);
      writeCache(`slite_listings_${userId}`, next);
      return next;
    });
    setConfirmDeleteId(null);
    toast.success(t("salesmanLite.toast.listingDeleted"));
  };

  const downloadListingImages = async (car) => {
    const imgs = Array.isArray(car.images) ? car.images.filter(Boolean) : [];
    if (imgs.length === 0) { toast.error("No images on this listing"); return; }
    const base = [car.year, car.brand, car.model].filter(Boolean).join("-").replace(/\s+/g, "-") || "car";
    if (imgs.length === 1) {
      try {
        const resp = await fetch(imgs[0]);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const ext = ((blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg")).split("+")[0];
        a.href = url; a.download = `${base}.${ext}`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        toast.success("Saved photo");
      } catch { toast.error("Couldn't download image"); }
      return;
    }
    const tId = toast.loading(`Zipping ${imgs.length} photos…`);
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      let ok = 0;
      await Promise.all(imgs.map(async (src, i) => {
        try {
          const resp = await fetch(src);
          const blob = await resp.blob();
          const ext = ((blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg")).split("+")[0];
          zip.file(`${base}-${i + 1}.${ext}`, blob);
          ok++;
        } catch { /* skip a failed image */ }
      }));
      if (ok === 0) { toast.error("Couldn't download images", { id: tId }); return; }
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url; a.download = `${base}-photos.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Saved ${ok} photo${ok > 1 ? "s" : ""} as zip`, { id: tId });
    } catch {
      toast.error("Couldn't build zip", { id: tId });
    }
  };

  // quick brief
  const [quickBriefCar, setQuickBriefCar] = useState(null);
  const [briefCopied, setBriefCopied] = useState(false);

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
  // Back gesture closes the open overlay instead of switching tab under it
  // (useModalHistory, one shared stack). The small sheets defined at the top
  // of this file and the shared ones (studio, poster, chat) register inside.
  useModalHistory(!!drawerLeadId, () => setDrawerLeadId(null));
  useModalHistory(!!bookingDetailId, () => setBookingDetailId(null));
  useModalHistory(deleteModalOpen, () => setDeleteModalOpen(false));
  useModalHistory(!!wonPrompt, () => setWonPrompt(null));
  useModalHistory(!!testDriveConfirm, () => setTestDriveConfirm(null));
  useModalHistory(telegramSetupModal, () => setTelegramSetupModal(false));
  useModalHistory(!!quickBriefCar, () => setQuickBriefCar(null));
  useModalHistory(!!depositModal, () => setDepositModal(null));
  useModalHistory(!!linkCarLeadId, () => setLinkCarLeadId(null));
  useModalHistory(notifOpen, () => setNotifOpen(false));
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCopied, setDepositCopied] = useState(false);

  const channelRef = useRef(null);
  // Set by the unmount cleanup below; read by the async bootstrap before it
  // subscribes, so a dead mount never leaves a channel behind.
  const rtCancelledRef = useRef(false);
  const [appointments, setAppointments] = useState(seed.appts);
  const [pastOpen, setPastOpen] = useState(false);
  const [enquiries, setEnquiries] = useState(seed.enquiries);
  // analyticsEvents removed — aggregation now done server-side via get_salesman_analytics RPC

  // Cache helpers (readCache/writeCache/redactLeadsForCache) live in
  // ../utils/panelCache — a local copy here is exactly why Premium never got
  // the lead redaction rule.
  //
  // The old precacheImages() was DELETED, not moved. It opened a Cache Storage
  // bucket ("slite-images-v1") and eagerly downloaded the first two photos of
  // every listing on each load — but nothing ever read that bucket back. There
  // is no service-worker fetch handler for it, so the bytes were fetched,
  // stored and never served: pure bandwidth competing with the queries the user
  // is actually waiting for. Car photos are now cached by the service worker's
  // runtime route (vite.config.js), which caches what the panel actually
  // renders and serves it back cache-first.

  // Hours-per-stage before a lead counts as needing follow-up.
  // Indexed by lead.stage; falls back to 48h for unknown stages.
  // Leads needing a call — ONE definition, shared with Premium, Salesmanpanel
  // and the dealer board (`isLeadStale` in lib/leadsHelpers). Lite used to keep
  // its own byte-identical copy of FOLLOW_UP_HOURS plus this filter, which is
  // how the two drifted apart in the first place. The shared rule also fixes
  // the column: staleness is measured from `last_contacted_at` (falling back to
  // `created_at`), not `updated_at` — editing a note is not contacting a buyer.
  // Sorted worst-first so every surface agrees on the order.
  useEffect(() => {
    const now = Date.now();
    setStaleLeads(
      leads.filter((l) => isLeadStale(l, now)).sort((a, b) => compareFollowUp(a, b, now)),
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
        bio: profile.bio || "",
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
      // The first-frame seed was keyed on the LAST user on this device. If a
      // different account signed in since, everything painted from it belongs
      // to someone else — blank it before the fresh data lands.
      if (seed.uid && seed.uid !== uid) {
        setProfile(null);
        setMyListings([]);
        setLeads([]);
        setEnquiries([]);
        setAppointments([]);
        setLoading(true);
      }
      rememberPanelUid(PANEL_CACHE_KEY, uid);

      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("id, email, role, is_active, plan_expires_at, payment_status, slug, dealership, site_name, whatsapp_number, brand_color, avatar_url, cover_url, job_title, telegram_chat_id, dealer_id, full_name, plan, city, state, location, bio, starter_tasks, ic_hash, ic_last4, ic_verified_at, ic_deadline, created_at, account_status, approval_status, rejection_reason, is_verified, kyc_submitted_at, deleted_at, instagram, tiktok, facebook, website, lite_goal, onboarding_complete, onboarding_tour_done, seller_type, new_car_brand")
        .eq("id", uid)
        .maybeSingle();

      // A timeout / server error is the database stalling, not a missing
      // account: the session is fine, so never bounce to /login for it.
      if (profileErr) {
        console.error("fetchProfile:", profileErr);
        setLoading(false);
        setProfileLoadFailed(true);
        return;
      }
      if (!profileData) {
        setLoading(false);
        navigate("/login");
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

      // Send a non-salesman to THEIR home surface, from the one shared map.
      // This used to be a local copy that had no `buyer` key and defaulted to
      // "/dashboard", so a shopper who reached this page was handed the dealer
      // dashboard instead of /account.
      if (role !== "salesman") {
        navigate(routeForRole(role), { replace: true });
        return;
      }

      if (profileData.dealer_id) {
        navigate("/salesman", { replace: true });
        return;
      }

      // Premium standalone accounts go to their own page — by the SAME rule the
      // Premium panel checks on arrival (isPremiumSalesman, which mirrors the
      // DB's is_salesman_premium()). This used to test plan === "salesman_full"
      // alone while Premium also requires payment/expiry, so an account with the
      // plan but not the entitlement (a fresh signup awaiting payment, or an
      // expired one) bounced Lite -> Premium -> Lite forever.
      if (isPremiumSalesman(profileData)) {
        navigate("/salesman-premium", { replace: true });
        return;
      }

      // Final guard: never let a half-onboarded salesman (no name/IC/phone yet)
      // sit in the dashboard, no matter how they got here. Every routing path
      // upstream should already catch this, but this is the last line of defence
      // right at the dashboard door.
      if (profileData.onboarding_complete === false) {
        // No tier in the URL: the wizard resumes the plan saved on the account
        // (user_metadata.tier). Hard-coding /lite here downgraded every
        // half-finished Premium signup that reopened the app.
        navigate("/salesman-onboarding", { replace: true });
        return;
      }

      setProfile(profileData);
      setLoading(false);
      // Cached so the NEXT cold start can clear the loading gate on frame 1.
      // The gates above (pending / deleted / wrong role / wrong plan) all re-run
      // against this same shape when the fresh row lands, so a cached profile
      // can only ever bring the panel forward, never past an access check.
      writeCache(`${PANEL_CACHE_KEY}_profile_${uid}`, redactProfileForCache(profileData));

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

      // Seed from cache. For the common case the useState initialisers at the
      // top already did this on frame 1 — this covers the first load after a
      // different account signed in on the same device, where the frame-1 seed
      // was for the wrong uid and got blanked above.
      if (seed.uid !== uid) {
        const cachedListings = readCache(`${PANEL_CACHE_KEY}_listings_${uid}`);
        if (cachedListings) setMyListings(cachedListings);
        const cachedLeads = readCache(`${PANEL_CACHE_KEY}_leads_${uid}`);
        if (cachedLeads) { setLeads(cachedLeads); setLeadsLoading(false); }
        const cachedEnquiries = readCache(`${PANEL_CACHE_KEY}_enquiries_${uid}`);
        if (cachedEnquiries) setEnquiries(cachedEnquiries);
        const cachedAppts = readCache(`${PANEL_CACHE_KEY}_appts_${uid}`);
        if (cachedAppts) setAppointments(cachedAppts);
      }

      // fetch listings with full columns for car detail popup
      Promise.all([
        supabase
          .from("car_listings")
          .select(
            // Must include every column CarForm's edit prefill reads, or editing a
            // listing silently blanks those fields and Save fails (e.g. "base price
            // not set"). See CarForm pre-fill effect for the full list.
            "id, slug, year, brand, model, variant, selling_price, original_price, base_price, purchase_price, status, images, colour, mileage, transmission, fuel_type, body_type, features, options, specs, city, state, condition, engine_cc, horsepower, cylinders, doors, seats, fuel_consumption, created_at, included_services, included_services_cost, recon_cost, sold_at, commission_amount, rejection_reason, is_recon, auction_grade, interior_grade, import_country, auction_house, local_reg_date, chassis_status, damage_map, video_url, car_documents, registration_date, plate_number, vin_number, previous_owners, road_tax_expiry, loan_eligible, payment_type, warranty_months, deposit_amount, new_car_model_id",
          )
          .eq("assigned_to", uid).neq("status", "archived"),
        supabase
          .from("car_listings")
          .select(
            // Must include every column CarForm's edit prefill reads, or editing a
            // listing silently blanks those fields and Save fails (e.g. "base price
            // not set"). See CarForm pre-fill effect for the full list.
            "id, slug, year, brand, model, variant, selling_price, original_price, base_price, purchase_price, status, images, colour, mileage, transmission, fuel_type, body_type, features, options, specs, city, state, condition, engine_cc, horsepower, cylinders, doors, seats, fuel_consumption, created_at, included_services, included_services_cost, recon_cost, sold_at, commission_amount, rejection_reason, is_recon, auction_grade, interior_grade, import_country, auction_house, local_reg_date, chassis_status, damage_map, video_url, car_documents, registration_date, plate_number, vin_number, previous_owners, road_tax_expiry, loan_eligible, payment_type, warranty_months, deposit_amount, new_car_model_id",
          )
          .eq("dealer_id", uid).neq("status", "archived"),
      ]).then(([r1, r2]) => {
        setListingsLoaded(true);
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

      // Analytics: call server-side RPC — Postgres aggregates, browser receives one row per car.
      // trafficDone reveals the dashboard numbers once analytics and the
      // mini-page totals have answered (or failed); the timer covers a
      // stalled database.
      const trafficTimer = setTimeout(() => setTrafficFetched(true), 12000);
      const trafficDone = () => { clearTimeout(trafficTimer); setTrafficFetched(true); };
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
              })
              .finally(trafficDone);
          } else {
            trafficDone();
          }
        }, trafficDone);

      // fetch leads. A failed read (a stalled DB times out, 2026-10-24) keeps the
      // leads already on screen and on the device: it used to set [] and write []
      // over the saved copy, so a seller's pipeline vanished mid-stall. One quiet
      // retry first.
      const leadsQuery = () => supabase
        .from("leads")
        .select(LEAD_SELECT)
        .eq("salesman_id", uid)
        .or("is_deleted.eq.false,is_deleted.is.null")
        .order("updated_at", { ascending: false });
      leadsQuery()
        .then(async (first) => {
          let { data: lds, error: ldsErr } = first;
          if (ldsErr) {
            await new Promise((r) => setTimeout(r, 4000));
            ({ data: lds, error: ldsErr } = await leadsQuery());
          }
          if (ldsErr) {
            console.error("fetchLeads:", ldsErr);
            setLeadsLoading(false);
            return;
          }
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
                  .select(LEAD_SELECT)
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
            // The lead itself is the DB trigger's job, NOT this handler's. The
            // AFTER INSERT trigger enquiry_to_lead on whatsapp_enquiries has
            // already created it (and resolved the rep through
            // resolve_lead_salesman, the one resolver) by the time this echo
            // arrives. This used to insert a second one whenever it lost the
            // race, with dealer_id hardcoded null and salesman_id set inline —
            // re-implementing attribution the exact way CLAUDE.md forbids. When
            // it WON the race it found the trigger's row, added nothing to
            // state, and the lead only appeared after a refresh.
            if (row.lead_id) {
              await hydrateLeadInto(setLeads, row.lead_id, LEAD_SELECT);
            } else if (phone) {
              const { data: made } = await supabase.from("leads")
                .select("id").eq("salesman_id", uid).eq("phone", phone)
                .order("created_at", { ascending: false }).limit(1);
              if (made?.length) await hydrateLeadInto(setLeads, made[0].id, LEAD_SELECT);
            }
            const { error: rtConvertErr } = await supabase.from("whatsapp_enquiries").update({ status: "converted" }).eq("id", row.id);
            if (rtConvertErr) console.error("realtimeConvertEnquiry:", rtConvertErr);
            setEnquiries((p) => p.map((e) => e.id === row.id ? { ...e, status: "converted" } : e));
          };

          // liveChannel (IO-2): Broadcast from the database instead of
          // postgres_changes, which kept Realtime polling the DB nonstop. It never
          // adds a callback to an already-joined channel, so an orphaned earlier
          // mount can no longer make .on() throw (what freshChannel used to fix).
          if (channelRef.current) supabase.removeChannel(channelRef.current);
          if (!rtCancelledRef.current) {
          const liteChannel = liveChannel(supabase, "salesman-lite-rt-" + uid)
            .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `salesman_id=eq.${uid}` },
              (payload) => {
                // Dedup the realtime echo: an optimistic insert (e.g.
                // autoUpsertLeadFromAppt) already added this lead WITH its joined
                // car_listings; the raw echo row has no join, so adding it again
                // rendered the same lead twice — once with a car, once without.
                // If we already hold it, merge (keep the richer joined fields).
                if (payload.eventType === "INSERT") {
                  // Show it immediately (raw row, no car on it yet)...
                  setLeads((p) => p.some((l) => l.id === payload.new.id) ? p.map((l) => l.id === payload.new.id ? { ...payload.new, ...l } : l) : [payload.new, ...p]);
                  // ...then fill in the car. Realtime only ever sends the flat
                  // table row, so without this every lead created server-side
                  // (WhatsApp tap, enquiry, chat) sat in the pipeline with no
                  // car attached until the next full page load.
                  hydrateLeadInto(setLeads, payload.new.id, LEAD_SELECT);
                }
                if (payload.eventType === "UPDATE") setLeads((p) => p.map((l) => l.id === payload.new.id ? { ...l, ...payload.new } : l));
                if (payload.eventType === "DELETE") setLeads((p) => p.filter((l) => l.id !== payload.old.id));
              },
            )
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "salesman_notifications", filter: `salesman_id=eq.${uid}` },
              (payload) => {
                toast(payload.new.title, { description: payload.new.body });
                setNotifications((p) => [payload.new, ...p]);
                // An approved / rejected car moves tab now, not on the next reload.
                refreshListingFromNotice(supabase, payload.new, setMyListings);
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
                // payload.old carries only the primary key (car_listings has the
                // default replica identity), so the status BEFORE this update has to
                // come from our own copy. Reading payload.old.status never matched,
                // which is why an approval or rejection arrived with no toast and the
                // car just vanished from the Pending tab.
                const prevStatus = listingStatusRef.current[payload.new.id];
                setMyListings((p) => {
                  // An archived car (deleted from another tab) leaves the list.
                  const next = p.map((c) => c.id === payload.new.id ? { ...c, ...payload.new } : c).filter((c) => c.status !== "archived");
                  writeCache(`slite_listings_${uid}`, next);
                  return next;
                });
                if (payload.new.status === "available" && prevStatus === "pending_approval") {
                  setFilterStatus("available");
                  toast.success(t("salesmanLite.toast.listingApproved"), { description: t("salesmanLite.toast.listingApprovedDesc", { car: `${payload.new.brand} ${payload.new.model}` }) });
                }
                if (payload.new.status === "rejected" && prevStatus === "pending_approval") {
                  setFilterStatus("rejected");
                  toast.error(t("salesmanLite.toast.listingRejected"), { description: t("salesmanLite.toast.listingRejectedDesc", { car: `${payload.new.brand} ${payload.new.model}` }) });
                }
              },
            )
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "car_listings", filter: `assigned_to=eq.${uid}` },
              (payload) => {
                setMyListings((p) => p.map((c) => c.id === payload.new.id ? { ...c, ...payload.new } : c).filter((c) => c.status !== "archived"));
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

  // Sole seller, no salesman under them to pay a commission to (a "salesman"
  // in that role would be a broker instead) — their commission IS their
  // margin: selling price minus base price. No dealer commission_config
  // applies here (that's for a salesman a dealer employs).
  const suggestedCommission = (car) => {
    const base = Number(car.base_price);
    const sell = Number(car.selling_price);
    return !isNaN(base) && !isNaN(sell) && sell > base ? sell - base : null;
  };

  // Auto-fill commission (= margin) on any listing missing it — covers listings
  // created before this became automatic, so Monthly Goal / commission stats
  // don't silently zero out on real wins. Never touches a listing that already
  // has a value (including an intentional 0 — that's a real decision, not a
  // gap). Tracks processed ids so it fires once per listing, not on every
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
  }, [myListings]);

  // Live minute tick — keeps inbox "Xh Ym ago" / "in Xh Ym" labels current
  // without a reload. 60s cadence is enough for minute-granular display.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  // Every tab shows from day one (owner, 2026-10-25, SIMPLE-2, same as Premium).
  // SIMPLE-1 hid Leads, Inbox and Performance until there was something behind
  // them; the owner asked for simpler tabs instead of fewer. A seller with no car
  // who opens Leads, Inbox or Performance gets the "list a car first" screen
  // (gatedLocked), which is the nudge they need.
  const hasInbox = (appointments || []).length > 0 || (enquiries || []).length > 0;
  // No buyer has reached this seller yet: the dashboard drops every card that
  // would be zeros (renderDashboard), and the tour skips what that hides.
  const startingOut = leads.length === 0 && !hasInbox;
  // One entry per tour step: the key names its copy (salesmanLite.tour.steps.*),
  // the anchor says which tab it opens and what it rings. Only steps whose link
  // or button is on screen are kept (the Chat and Add-ons cards wait for the
  // first buyer, see startingOut).
  const TOUR_PLAN = [
    { key: "welcome" },
    { key: "dashboard", anchor: { tab: "dashboard" } },
    { key: "listings", anchor: { tab: "listings" } },
    { key: "leads", anchor: { tab: "leads" } },
    { key: "inbox", anchor: { tab: "enquiries" } },
    { key: "bookings", anchor: { tab: "enquiries", targetId: "bookings", onSwitch: () => setInboxSubTab("bookings") } },
    { key: "feedback", anchor: { tab: "feedback" } },
    { key: "performance", anchor: { tab: "performance" } },
    { key: "chat", anchor: { tab: "dashboard", targetId: "chat" }, show: !startingOut },
    { key: "services", anchor: { tab: "dashboard", targetId: "services" }, show: !startingOut },
    { key: "settings", anchor: { tab: "settings" } },
    { key: "help", anchor: { tab: "settings", targetId: "help" } },
  ].filter((st) => st.show !== false);
  const tourPlanKey = TOUR_PLAN.map((st) => st.key).join(",");

  useEffect(() => {
    if (tourStep === null) { setTourTarget(null); return; }
    // Index-aligned with TOUR_STEPS (both come from TOUR_PLAN). Most steps switch to a tab and highlight that
    // same tab's nav anchor — but chat/services now live as quick-access buttons on
    // the Dashboard (not their own nav slot), and help now lives inside Settings, so
    // those three track a target id separate from the tab they switch to.
    const anchor = TOUR_PLAN[tourStep]?.anchor;
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
    // Re-measure (no scrollIntoView) while this step is up, so the ring keeps
    // tracking the real button through any layout shift that happens after the
    // initial measure — a banner (account-approved, IC, suspension) sliding
    // in/out above it, a notification loading in, a resize. It used to measure
    // once and freeze, so the ring drifted off the button whenever something
    // above it changed height. The existing 0.28s CSS transition on the ring's
    // position turns each correction into a smooth follow instead of a jump.
    const reposition = () => {
      const el = document.querySelector(`[data-tour-id="${targetId}"]`);
      if (el) setTourTarget(el.getBoundingClientRect());
    };
    const interval = setInterval(reposition, 200);
    window.addEventListener("resize", reposition);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
      window.removeEventListener("resize", reposition);
    };
  }, [tourStep, tourPlanKey]);

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
      const options = { body: names, tag: 'slite-followup', icon: '/shiftos-notif-icon.png', badge: '/shiftos-notif-badge.png' };
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
    // Signing out must not leave this rep's buyer list cached on the device.
    clearPanelDataCache();
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
      // Deleting the account must not leave the buyer list behind on the device.
      clearPanelDataCache();
      navigate("/login");
    } catch (e) {
      console.error("delete-account:", e);
      toast.error(t("salesmanLite.dangerZone.deleteFailed"));
      setDeleting(false);
    }
  };

  // Self-service restore within the grace window, via restore_my_account().
  //
  // This used to write account_status/is_active/deleted_at straight to the row.
  // prevent_profile_privilege_escalation reverts the first two for anyone who
  // is not a superadmin, so the update "succeeded" with no error and the user
  // stayed locked out -- but deleted_at DID get cleared, and
  // purge-deleted-accounts selects `deleted_at < cutoff`, which a NULL never
  // matches. The account could then be neither restored nor purged. The RPC
  // checks the 30-day window server-side and is the only sanctioned path.
  const handleReactivate = async () => {
    if (!userId) return;
    setReactivating(true);
    const { error } = await supabase.rpc("restore_my_account");
    if (error) {
      console.error("reactivate:", error);
      toast.error(
        error.message?.includes("restore_window_expired")
          ? t("salesmanLite.deletedGate.reactivateExpired")
          : t("salesmanLite.deletedGate.reactivateFailed"),
      );
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
    if (!isValidMyPhone(editPhoneVal)) { toast.error(t("salesmanLite.toast.phoneTooShort", { defaultValue: "That does not look like a full phone number" })); return; }
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
      dealer_id: lead?.dealer_id ?? getDealerIdFromProfile(profile),
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
      .update({ stage: "won", updated_at: now, ...(wonPrompt.variantId ? { new_car_model_id: wonPrompt.variantId } : {}) })
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
    // A new-car card is the model's display card, not a car that sells: the DB
    // trigger has already moved the lead onto a sold unit (new_car_unit_on_won),
    // so the card itself is never marked sold here.
    const isNewCarCard = !!myListings.find((c) => c.id === lead.car_listing_id)?.new_car_model_id;
    if (lead.car_listing_id && !isNewCarCard) {
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
    // One card per win: "Goal smashed" when THIS win carries the month over
    // the target (once per month per device), otherwise "Deal closed".
    const nowD = new Date();
    const monthCommission = (rows) => rows
      .filter((c) => c.status === "sold" && c.sold_at)
      .filter((c) => {
        const d = new Date(c.sold_at);
        return d.getFullYear() === nowD.getFullYear() && d.getMonth() === nowD.getMonth();
      })
      .reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
    const afterWin = myListings.map((c) => (c.id === lead.car_listing_id ? { ...c, status: "sold", sold_at: now } : c));
    const goalFlag = `slite_goal_shared_${userId}_${nowD.getFullYear()}-${nowD.getMonth()}`;
    let goalAlreadyShown = false;
    try { goalAlreadyShown = !!localStorage.getItem(goalFlag); } catch { /* storage blocked */ }
    const crossedGoal = goal.target > 0
      && monthCommission(myListings) < goal.target
      && monthCommission(afterWin) >= goal.target;
    if (crossedGoal && !goalAlreadyShown) {
      try { localStorage.setItem(goalFlag, "1"); } catch { /* storage blocked */ }
      setShareWinPrompt({ kind: "goal" });
    } else {
      setShareWinPrompt({ kind: "deal", carLabel });
    }
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
      // Open the tab the car is actually on — the list defaults to Available,
      // so a rejected car was invisible after tapping its own notification.
      case "new_question":
      case "new_review":
      case "like_first":
      case "like_digest":
        switchTab("feedback");
        break;
      case "listing_approved":
        listingFilterIntent.current = "available";
        switchTab("listings");
        setFilterStatus("available");
        break;
      case "listing_rejected":
        listingFilterIntent.current = "rejected";
        switchTab("listings");
        setFilterStatus("rejected");
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
        .from("leads").select("id, stage, car_listing_id").eq("id", apt.lead_id).maybeSingle();
      if (linked) existing = linked;
    }
    if (!existing) {
      if (!phone) return;
      const { data: existingRows, error: lookErr } = await supabase
        .from("leads").select("id, stage, buyer_name, car_listing_id").eq("salesman_id", userId).eq("phone", phone)
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
      // A booking always comes from one listing, so a lead adopted by a booking
      // should carry that car. Fill-when-blank only: a lead that already names a
      // car keeps it, so re-booking never silently repoints an existing deal.
      const attachCar = !existing.car_listing_id && apt.car_listing_id ? apt.car_listing_id : null;
      // Advance a lead that's behind the booking stage into it. ALSO revive a
      // dead (lost) lead — the buyer just booked a fresh viewing, so it belongs
      // back in "Booked". A won lead is left alone (don't un-close a sale). This
      // was the silent gap: a lost buyer who re-booked never re-entered the
      // pipeline because lost sits AFTER viewing_booked in LEAD_STAGES.
      const revive = existing.stage === "lost" || existing.stage === "closed_lost";
      if (curIdx < viewIdx || revive) {
        const { error: updErr } = await supabase.from("leads")
          .update({ stage: "viewing_booked", updated_at: new Date().toISOString(),
                    ...(attachCar ? { car_listing_id: attachCar } : {}) })
          .eq("id", existing.id);
        if (updErr) {
          console.error("autoUpsertLeadFromAppt advance:", updErr);
          toast.error(t("salesmanLite.toast.stageUpdateFailed"));
          return;
        }
        // The lead may not be in local state (a revived/terminal lead can be
        // filtered out of the board) — refetch it so it shows immediately.
        setLeads((p) => p.some((l) => l.id === existing.id)
          ? p.map((l) => l.id === existing.id ? { ...l, stage: "viewing_booked", ...(attachCar ? { car_listing_id: attachCar } : {}) } : l)
          : p);
        // Re-read with the join so the newly attached car actually renders.
        if (attachCar) await hydrateLeadInto(setLeads, existing.id, LEAD_SELECT);
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
        salesman_id: userId, dealer_id: getDealerIdFromProfile(profile),
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
        dealer_id: lead.dealer_id ?? getDealerIdFromProfile(profile),
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
        salesman_id: userId, dealer_id: getDealerIdFromProfile(profile),
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
    const link = `${SITE_URL}/showroom/${car.slug}?ref=${profile?.slug || ""}`;
    // "wa" = the full caption (copyListingCaption: buildCopyText for used/recon,
    // the BM price-list caption for a new-car card), with the salesman's
    // referral link appended so buyer taps come back to this rep.
    if (type === "wa") copyListingCaption(car, link).catch(() => {});
    else navigator.clipboard.writeText(link);
    setListingCopied((prev) => ({ ...prev, [car.id]: type }));
    setTimeout(
      () => setListingCopied((prev) => ({ ...prev, [car.id]: null })),
      1500,
    );
  };

  // COACH-1: each car's ONE next step + the dashboard's silent car. Rules live
  // in src/utils/carCoach.js (shared with Premium); the inputs are already
  // loaded here: traffic (carStatsMap), questions + saves (useSellerFeedback).
  const coachExtra = (car) => ({
    unanswered: feedback.threads.filter((q) => q.listing_id === car.id && !q.answered).length,
    likes: Number(feedback.likes.find((l) => l.listing_id === car.id)?.likes) || 0,
  });
  const coachFor = (car) => (trafficReady ? carNextStep(car, carStatsMap[car.id], coachExtra(car)) : null);
  const silentPick = trafficReady ? pickSilentCar(myListings, carStatsMap, coachExtra) : null;
  const startShareTour = (car) => {
    setFilterStatus("available");
    setShareTourCar(car.id);
    setActiveTab("listings");
  };
  // Share: the phone's share sheet when there is one, else copy the link.
  const shareCarLink = async (car) => {
    const url = `${SITE_URL}/showroom/${car.slug}?ref=${encodeURIComponent(profile?.slug || "")}&src=share`;
    const title = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* closed the sheet */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); } catch { window.prompt("Copy this link", url); }
  };
  const onCoach = (action, car) => {
    if (action === "answer") setActiveTab("feedback");
    else if (action === "edit") setEditListing(car);
    else if (action === "share") shareCarLink(car);
    else if (action === "tour") startShareTour(car);
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
      badge: leads.filter((l) => !TERMINAL_STAGES.includes(l.stage)).length || null,
    },
    {
      tab: "enquiries",
      label: t("salesmanLite.tabs.inbox"),
      icon: <MessageSquare style={{ width: 14, height: 14 }} />,
      badge: (enquiries.filter((e) => e.status === "new").length + pendingBookingsCount) || null,
    },
    {
      tab: "feedback",
      label: t("salesmanLite.tabs.feedback"),
      icon: <Star style={{ width: 14, height: 14 }} />,
      badge: feedback.unanswered || null,
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
      badge: leads.filter((l) => !TERMINAL_STAGES.includes(l.stage)).length || null,
    },
    {
      tab: "enquiries",
      label: t("salesmanLite.tabs.inbox"),
      icon: <MessageSquare size={18} />,
      badge: (enquiries.filter((e) => e.status === "new").length + pendingBookingsCount) || null,
    },
    { tab: "feedback", label: t("salesmanLite.tabs.feedbackMobile"), icon: <Star size={18} />, badge: feedback.unanswered || null },
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

  // ── Profile completeness score ───────────────────────────────────────────
  const profileScore = () => {
    const checks = [
      { pts: 35, ok: !!(avatarUrl), label: "Add a profile photo", field: "avatar" },
      { pts: 35, ok: !!(profile?.whatsapp_number), label: "Add your WhatsApp number", field: "whatsapp_number" },
      { pts: 30, ok: !!(profile?.full_name), label: "Add your name", field: "full_name" },
      // Bio + social links left the score with the basic page (2026-10-13):
      // Lite has no field for them and the page would not show them.
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
    // Placeholders, never 0s, until the traffic numbers and the car list are
    // both in; then every number appears at once.
    const statsReady = trafficReady && (listingsLoaded || !!seed.profile);
    // Lead counts and the greeting line ("pipeline is clear") wait for leads.
    const leadsReady = !leadsLoading && (listingsLoaded || !!seed.profile);
    const perfCarName = (car) => [car.year, car.brand, car.model].filter(Boolean).join(" ");
    const isNewUser = myListings.length === 0 && leads.length === 0;

    // Pipeline-stage accent hues — used to colour-code the Follow-up rows so you
    // can see at a glance where each cold lead sits in the funnel.

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
    // Jump from an agenda row to its pipeline lead with the same red glow. Appointments
    // aren't joined to leads, so match by phone; fall back to the Bookings tab when
    // there's no lead yet (e.g. an unconfirmed booking).
    const goToLeadForAppt = (a) => {
      const ph = normalizePhone(a.buyer_phone);
      const lead = ph ? leads.find((l) => normalizePhone(l.phone) === ph) : null;
      if (lead) { setActiveTab("leads"); setMobileLeadStage(lead.stage); triggerGlow([lead.id]); }
      else { switchTab("enquiries"); setInboxSubTab("bookings"); }
    };

    // Commission, monthly goal and the "best car to push" card left Lite with
    // the 2026-10-13 trim (Premium has them); only the live-car list stays.
    const available = myListings.filter(c => c.status === "available");

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

    // The stale pill used to live in the hero: jump to whichever stage actually
    // has an overdue lead (mobile shows one stage at a time), then glow them so
    // the eye lands on exactly which cards need attention.
    const onStaleClick = () => {
      const activeStageOrder = LEAD_STAGES.filter((s) => !["lost", "closed_lost", "closed_won"].includes(s));
      const firstStaleStage = activeStageOrder.find((s) => staleLeads.some((l) => l.stage === s));
      if (firstStaleStage) setMobileLeadStage(firstStaleStage);
      switchTab("leads");
      triggerGlow(staleLeads.map((l) => l.id));
    };

    // Drawing lives in src/pages/salesmanLite/DashboardTab.jsx (premiumDark,
    // 2026-11-01). Everything it shows is computed above; nothing here changed.
    return (
      <DashboardTab
        isMobile={isMobile}
        profile={profile}
        leadsReady={leadsReady}
        statsReady={statsReady}
        startingOut={startingOut}
        headline={personalizedLine}
        noLiveCars={available.length === 0}
        staleCount={staleLeads.length}
        onStaleClick={onStaleClick}
        numbers={{
          pipeline: activeLeads.length,
          live: available.length,
          closedMonth: closedThisMonth.length,
          views: totalViews || 0,
          taps: totalWATaps || 0,
          cvr: overallCVR,
          visits: minipageStats.visits || 0,
        }}
        missedAppts={missedAppts}
        agendaAppts={agendaAppts}
        agendaFollowUps={agendaFollowUps}
        onApptClick={goToLeadForAppt}
        onFollowUpClick={(l) => { setActiveTab("leads"); setMobileLeadStage(l.stage); triggerGlow([l.id]); }}
        listingStats={listingStats}
        carName={perfCarName}
        channelRows={minipageStats.byChannel.map((r) => ({ channel: r.channel, views: Number(r.visits) || 0, enquiries: Number(r.card_clicks) || 0 }))}
        onCopyLink={() => { navigator.clipboard.writeText(`${SITE_URL}/s/${profile.slug}`); toast.success(t("salesmanLite.toast.storeLinkCopied")); }}
        onOpenMinipage={openMyMinipage}
        chatUnread={chatUnread}
        onChat={() => switchTab("chat")}
        onServices={() => switchTab("services")}
        onPremium={goPremium}
        showStarter={listingsLoaded && !starterHidden && !profile?.starter_tasks?.dismissed}
        listingCount={myListings.length}
        bioLinkSeen={hasBioLinkVisit(minipageStats.byChannel)}
        onAddListing={() => { switchTab("listings"); setTimeout(openAddListing, 100); }}
        onDismissStarter={dismissStarterTasks}
        showSilent={trafficReady}
        silentPick={silentPick}
        onShowMe={startShareTour}
      />
    );
  };

  // ── RENDER PERFORMANCE ────────────────────────────────────────────────────

  const renderListings = () => {
    // Drawing lives in src/pages/salesmanLite/ListingsTab.jsx (premiumDark,
    // 2026-11-01). The add form and every handler stay here, unchanged.
    return (
      <ListingsTab
        isMobile={isMobile}
        profile={profile}
        myListings={myListings}
        carStatsMap={carStatsMap}
        isLockedCar={isLockedCar}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        sortBy={sortBy}
        setSortBy={setSortBy}
        showAddForm={showAddForm}
        onToggleAdd={() => (showAddForm ? setShowAddForm(false) : openAddListing())}
        onAddListing={openAddListing}
        onBackToDashboard={() => switchTab("dashboard")}
        onCopyPageLink={() => { navigator.clipboard.writeText(`${SITE_URL}/s/${profile.slug}`); toast.success(t("salesmanLite.toast.linkCopied")); }}
        addForm={(
          <>
        {showAddForm && (
          <CarFormModal title={t("salesmanLite.listings.addListing")} onClose={() => setShowAddForm(false)}>
            <React.Suspense fallback={<p style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>{t("salesmanLite.drawer.loading")}</p>}>
            <CarForm
              sellerProfile={profile}
              onUpgrade={goPremium}
              onOpenNewCars={() => { setShowAddForm(false); setSettingsNav("newcars"); setActiveTab("settings"); }}
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
            </React.Suspense>
          </CarFormModal>
        )}
          </>
        )}
        statusMenuCarId={statusMenuCarId}
        setStatusMenuCarId={setStatusMenuCarId}
        actionMenuCarId={actionMenuCarId}
        setActionMenuCarId={setActionMenuCarId}
        confirmDeleteId={confirmDeleteId}
        setConfirmDeleteId={setConfirmDeleteId}
        deletingId={deletingId}
        onOpenDetail={(car) => { setSelectedCar(car); setCarDetailImgIdx(0); setCarDetailTab("specs"); }}
        onEdit={setEditListing}
        updateListingStatus={updateListingStatus}
        coachFor={coachFor}
        onCoach={onCoach}
        listingCopied={listingCopied}
        handleListingCopy={handleListingCopy}
        onBrief={(car) => { setQuickBriefCar(car); setBriefCopied(false); }}
        onPoster={setPosterCar}
        onPremium={goPremium}
        lockedCap={PLAN_CONFIG.salesman_lite?.listingCap ?? 10}
        downloadListingImages={downloadListingImages}
        handleDeleteListing={handleDeleteListing}
      />
    );
  };

  // ── RENDER LEADS ──────────────────────────────────────────────────────────
  // The closing is intentionally at the myListings.map level; the outer
  // (() => { ... })().map() chain closes correctly.

  const renderLeads = () => {
    // Leads tab, redesigned 2026-11-01 in `premiumDark` (PD), the same look as
    // Premium's Leads: tone not borders, red only as a fill (the next-stage
    // button), mint the only green. Every control the old tab had is kept.
    // The lead-source bar is now one neutral line of counts (it was purple /
    // amber / blue). Dropped as a repeat: the card's "Stage: X · n/7" line (the
    // picked stage pill names it; the progress bar shows where).
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

    // Where leads came from: bucket by whatever lead_source values appear (not a
    // fixed whitelist), so no real source is dropped from the total. Lite has no
    // other place that says this (Performance is a locked Premium panel).
    const SRC_LABELS = { whatsapp: t("salesmanLite.leads.srcWhatsapp"), enquiry: t("salesmanLite.leads.srcEnquiry"), drevo_enquiry: t("salesmanLite.leads.srcEnquiry"), walk_in: t("salesmanLite.leads.srcWalkIn"), referral: t("salesmanLite.leads.srcReferral"), manual: t("salesmanLite.leads.srcManual") };
    const srcMap = {};
    leads.forEach((l) => {
      const label = SRC_LABELS[l.lead_source || "manual"] || l.lead_source;
      srcMap[label] = (srcMap[label] || 0) + 1;
    });
    const srcRows = Object.entries(srcMap).sort((a, b) => b[1] - a[1]);

    // pre-compute heat scores once — avoids O(n log n) recomputation inside sort comparators
    const heatMap = new Map(searchedLeads.map((l) => [l.id, getHeatScore(l)]));
    const staleIdSet = new Set(staleLeads.map((l) => l.id));

    const activeStages = LEAD_STAGES.filter(
      (s) => s !== "lost" && s !== "closed_lost" && s !== "closed_won",
    );
    const lostLeads = searchedLeads.filter(
      (l) => l.stage === "lost" || l.stage === "closed_lost",
    );

    // Shared shapes (premiumDark: a tone, no border).
    const leadBtn = { display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 12.5, fontWeight: 600, height: 36, padding: "0 12px", borderRadius: PD.radius.pill, background: PD.raised, border: "none", color: PD.text, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", boxSizing: "border-box" };
    const tag = { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 600, borderRadius: PD.radius.pill, padding: "2px 8px", background: PD.raised, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em" };
    const label = { margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: PD.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" };
    const panelBtn = { fontSize: 12.5, height: 36, padding: "0 14px", borderRadius: PD.radius.pill, background: PD.raised, border: "none", color: PD.textSec, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" };
    const field = { width: "100%", background: PD.raised, border: "none", borderRadius: PD.radius.row, color: PD.text, fontSize: 13, padding: "10px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" };
    const heatColor = (h) => (h === "hot" ? PD.accentText : h === "warm" ? PD.text : PD.textMuted);

    // Unconfirmed bookings (pending appointments) have no pipeline lead yet by
    // design — they live in the Bookings tab until confirmed. A single banner
    // under the search bar jumps there (pendingBookingsCount drives it).

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
      const followUpOverdue = lead.follow_up_at && new Date(lead.follow_up_at).getTime() <= Date.now();
      const initials = (lead.buyer_name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
      const quiet = lead.updated_at && Date.now() - new Date(lead.updated_at).getTime() > 48 * 3600 * 1000;

      return (
        <div
          key={lead.id}
          className={glowLeadIds.has(lead.id) ? "slite-lead-glow" : undefined}
          style={{ position: "relative", background: PD.card, borderRadius: PD.radius.card, overflow: "hidden", minWidth: 0 }}
        >
          <div style={{ padding: "16px 16px 0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: PD.raised, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 600, color: PD.textSec }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: PD.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lead.buyer_name || "—"}
                  </p>
                  {/* Heat + add-on share this slot in normal flow, so both never overlap. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    {leadIdsWithAddons.has(lead.id) && (
                      <span title="This deal has a paid add-on attached" style={{ ...tag, color: PD.textSec }}>
                        <Package size={9} /> Add-on
                      </span>
                    )}
                    {!heat.terminal && (
                      <span title="Lead urgency — based on pipeline stage and how recently this lead moved" style={{ ...tag, color: heatColor(heat.label) }}>
                        {t("salesmanLite.heat." + heat.label, { defaultValue: heat.label })}
                      </span>
                    )}
                  </div>
                </div>
                {(carName || carPrice) && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 3, gap: 8 }}>
                    {carName && <p style={{ margin: 0, fontSize: 12.5, color: PD.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{carName}</p>}
                    {carPrice && <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: PD.text, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{carPrice}</p>}
                  </div>
                )}
                {lead.updated_at && (
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: quiet ? PD.accentText : PD.textMuted }}>
                    {lastTouch(lead).label}: {timeAgo(lastTouch(lead).at)}
                  </p>
                )}
                {lead.last_call_outcome && (() => {
                  // Outcomes are information, not alarms: mint only for the positive one.
                  const OUTCOME = { answered: { icon: CheckCircle, label: "Answered", color: PD.up }, no_answer: { icon: PhoneOff, label: "No Answer", color: PD.textSec }, callback_requested: { icon: RefreshCw, label: "Callback", color: PD.textSec }, voicemail: { icon: Voicemail, label: "Voicemail", color: PD.textSec } };
                  const o = OUTCOME[lead.last_call_outcome];
                  if (!o) return null;
                  return (
                    <span style={{ ...tag, textTransform: "none", letterSpacing: 0, marginTop: 6, color: o.color }}>
                      <o.icon size={10} /> {o.label}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Progress: the bar alone, the stage pill above already names the stage. */}
            <div title={`${t("salesmanLite.leads.stage")}: ${stageLabel(normalizedStage || "new")}${currentProgressIdx >= 0 ? ` · ${currentProgressIdx + 1}/${progressStages.length}` : ""}`}
              style={{ display: "flex", gap: 3, marginBottom: 12 }}>
              {progressStages.map((s, i) => (
                <div key={s} style={{ flex: 1, height: 3, borderRadius: 99, background: i < currentProgressIdx ? PD.textMuted : i === currentProgressIdx ? PD.text : PD.raised }} />
              ))}
            </div>

            {followUpOverdue && (
              <div style={{ background: PD.raised, borderRadius: PD.radius.row, color: PD.accentText, fontSize: 12, padding: "8px 12px", marginBottom: 12 }}>
                {t("salesmanLite.leads.followUp")}: {timeAgo(lead.follow_up_at)}
              </div>
            )}
          </div>

          {/* ACTIONS — exactly 3 buttons. On a phone the next-stage button gets its
              own line: "Viewing Ditempah" + "Pautkan Kereta" do not fit one row. */}
          <div style={{ display: "flex", flexWrap: isMobile ? "wrap" : "nowrap", gap: 6, padding: "0 16px 16px" }}>
            {lead.stage !== "won" && lead.stage !== "closed_won" && (
              <button className="lk-red" onClick={() => advanceLeadStage(lead, nextStage)}
                style={{ ...leadBtn, flex: isMobile ? "1 0 100%" : "1 0 auto", height: isMobile ? 42 : 36, fontSize: isMobile ? 13.5 : 12.5, background: undefined, color: PD.onAccent, textTransform: "capitalize", whiteSpace: "nowrap" }}>
                → {stageLabel(nextStage || "won")}
              </button>
            )}
            {lead.phone && (
              <a href={`tel:${(lead.phone || "").replace(/\D/g, "")}`} title="Call" aria-label="Call lead"
                style={{ ...leadBtn, flexShrink: 0, width: 40, padding: 0, color: PD.textSec }}>
                <Phone size={14} />
              </a>
            )}
            {/* A buyer who chatted in the app is reachable HERE (a guest never gave
                a phone). Chat takes the WhatsApp slot: this row is capped at three,
                and WhatsApp is one tap away in the detail panel. */}
            {leadThread ? (
              <button
                onClick={() => setChatSheet({ threadId: leadThread.id, buyerName: lead.buyer_name || "Buyer", carLabel: carName })}
                title={t("salesmanLite.leads.openChat", { defaultValue: "Open the in-app chat with this buyer" })}
                style={{ ...leadBtn, flex: 1, minWidth: 0 }}
              >
                <MessageSquare size={12} />
                {t("salesmanLite.leads.chat", { defaultValue: "Chat" })}
                {leadThread.seller_unread > 0 && (
                  <span style={{ minWidth: 16, height: 16, borderRadius: 99, background: PD.accent, color: PD.onAccent, fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                    {leadThread.seller_unread}
                  </span>
                )}
              </button>
            ) : lead.phone ? (
              <button
                onClick={() => {
                  const waCarName = car ? `${car.brand} ${car.model}` : "kereta tu";
                  const isStale = lead.updated_at && Date.now() - new Date(lead.updated_at).getTime() > 48 * 3600 * 1000;
                  // New leads get a full first-contact message with the car details;
                  // later stages keep the short nudges.
                  const isNew = lead.stage === "new";
                  const msg = isNew
                    ? buildNewLeadWa(lead, car)
                    : isStale
                    ? `Hi ${lead.buyer_name || "kawan"}! Ada orang lain tengah tanya pasal ${waCarName} ni — kalau you still interested, jom lock dulu sebelum terlambat 🔒`
                    : `Hi ${lead.buyer_name || "kawan"}! Macam mana, still interested dalam ${waCarName} tu? Jom kita discuss lagi 😊`;
                  setWaModalMessage(msg);
                  setWaModalLead(lead);
                }}
                style={{ ...leadBtn, flex: 1, minWidth: 0 }}
              >
                <MessageCircle size={12} /> WhatsApp
              </button>
            ) : !lead.car_listing_id ? (
              <button onClick={() => setLinkCarLeadId(lead.id)} style={{ ...leadBtn, flex: 1, minWidth: 0, color: PD.textSec }}>
                <Car size={12} /> {t("salesmanLite.leads.linkCar")}
              </button>
            ) : null}
            <button onClick={() => setDrawerLeadId(lead.id)} title="Open lead details" aria-label="Open lead details"
              style={{ ...leadBtn, flexShrink: 0, width: 40, padding: 0, color: PD.textSec, fontSize: 14, letterSpacing: "0.05em" }}>
              ···
            </button>
          </div>
        </div>
      );
    };

    return (
      <div style={{ color: PD.text }}>
        <style>{`
          @keyframes slite-lead-glow {
            0%   { box-shadow: 0 0 0 0 ${withAlpha(PD.accent, 0.55)}; }
            70%  { box-shadow: 0 0 0 12px ${withAlpha(PD.accent, 0)}; }
            100% { box-shadow: 0 0 0 0 ${withAlpha(PD.accent, 0)}; }
          }
          .slite-lead-glow { animation: slite-lead-glow 1s ease-out; }
          @media (prefers-reduced-motion: reduce) { .slite-lead-glow { animation: none; outline: 2px solid ${PD.accent}; } }
        `}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {t("salesmanLite.leads.pipeline")} <span style={{ color: PD.textMuted, fontWeight: 500 }}>{leads.filter((l) => l.stage !== "lost" && l.stage !== "closed_lost" && l.stage !== "closed_won").length}</span>
          </p>
          <button className="lk-red" onClick={() => setShowAddLead(true)}
            style={{ height: 40, padding: "0 16px", display: "flex", alignItems: "center", gap: 6, border: "none", borderRadius: PD.radius.pill, color: PD.onAccent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            <Plus size={14} /> {t("salesmanLite.header.addLead")}
          </button>
        </div>

        {/* Where leads came from: one line, only when there is more than one source. */}
        {srcRows.length > 1 && (
          <p style={{ margin: "-4px 0 12px", fontSize: 12.5, color: PD.textMuted, lineHeight: 1.6 }}>
            {srcRows.map(([label, n], i) => (
              <span key={label} style={{ whiteSpace: "nowrap" }}>
                {i > 0 && " · "}{label} <strong style={{ color: PD.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{n}</strong>
              </span>
            ))}
          </p>
        )}

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: PD.textMuted, pointerEvents: "none" }} />
          <input
            value={leadSearch}
            onChange={(e) => setLeadSearch(e.target.value)}
            placeholder={t("salesmanLite.leads.searchPlaceholder")}
            style={{ width: "100%", height: 42, background: PD.card, border: "none", borderRadius: PD.radius.pill, color: PD.text, fontSize: 14, padding: "0 38px 0 38px", outline: "none", boxSizing: "border-box", fontFamily: "inherit", colorScheme: "dark" }}
          />
          {leadSearch && (
            <button onClick={() => setLeadSearch("")} aria-label="Clear search" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: PD.textMuted, cursor: "pointer", padding: 4, display: "flex" }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Pending bookings have no pipeline lead yet: one row jumps to Bookings. */}
        {pendingBookingsCount > 0 && (
          <button
            onClick={() => { switchTab("enquiries"); setInboxSubTab("bookings"); }}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginBottom: 12, height: 44, padding: "0 16px", borderRadius: PD.radius.pill, background: PD.card, border: "none", color: PD.text, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", textAlign: "left", boxSizing: "border-box" }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: PD.accent, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t("salesmanLite.booked.pendingBanner", { count: pendingBookingsCount, defaultValue: `${pendingBookingsCount} booking${pendingBookingsCount > 1 ? "s" : ""} pending confirmation` })}
            </span>
            <ChevronRight size={15} color={PD.textMuted} style={{ flexShrink: 0 }} />
          </button>
        )}

        {/* Stage pills: wrap onto a second row (no sideways scroll). A count goes
            red with "!" when that stage holds a lead needing follow-up, and
            opening the stage pulses those leads. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {activeStages.map((stage) => {
            const stageLeadsForPill = searchedLeads.filter((l) => l.stage === stage);
            const count = stageLeadsForPill.length;
            const staleInStage = stageLeadsForPill.filter((l) => staleIdSet.has(l.id));
            const needsFollowUp = staleInStage.length > 0;
            const isActive = mobileLeadStage === stage;
            return (
              <button
                key={stage}
                onClick={() => { setMobileLeadStage(stage); triggerGlow(staleInStage.map((l) => l.id)); }}
                style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 13px", borderRadius: PD.radius.pill, fontSize: 13, fontWeight: isActive ? 600 : 500, cursor: "pointer", fontFamily: "inherit", background: isActive ? PD.text : PD.raised, border: "none", color: isActive ? PD.card : PD.textSec, textTransform: "capitalize", whiteSpace: "nowrap" }}
              >
                {stageLabel(stage)}
                <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: needsFollowUp ? (isActive ? PD.accent : PD.accentText) : isActive ? PD.card : PD.textMuted, opacity: isActive && !needsFollowUp ? 0.7 : 1 }}>
                  {count}{needsFollowUp ? "!" : ""}
                </span>
              </button>
            );
          })}
        </div>

        {/* Cards for the selected stage: one column on a phone, two on desktop.
            The page scrolls, never an inner scroller. */}
        {(() => {
          const stageLeads = searchedLeads
            .filter((l) => l.stage === mobileLeadStage)
            .sort((a, b) => (heatMap.get(b.id)?.score ?? 0) - (heatMap.get(a.id)?.score ?? 0));
          if (stageLeads.length === 0) {
            return (
              <div style={{ height: 96, borderRadius: PD.radius.card, background: PD.card, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 13, color: PD.textMuted }}>Empty</span>
              </div>
            );
          }
          return (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 10, alignItems: "start" }}>
              {stageLeads.map((lead) => renderLeadCard(lead))}
            </div>
          );
        })()}

        {lostLeads.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <button onClick={() => setLostOpen((o) => !o)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: "6px 0", fontFamily: "inherit" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: PD.textSec }}>Lost ({lostLeads.length})</span>
              <ChevronRight size={14} color={PD.textMuted} style={{ transform: lostOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
            </button>
            {lostOpen && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
                {lostLeads.map((lead) => (
                  <div key={lead.id} style={{ background: PD.card, borderRadius: PD.radius.row, padding: "12px 14px", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: PD.textSec, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {lead.buyer_name || "—"}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        {lead.loss_reason && (
                          <span style={{ ...tag, textTransform: "none", letterSpacing: 0, color: PD.textSec }}>{lead.loss_reason}</span>
                        )}
                        <button onClick={() => setDeleteConfirmId(lead.id)} title="Delete lead" aria-label="Delete lead"
                          style={{ background: "transparent", border: "none", color: PD.textMuted, cursor: "pointer", padding: 6, display: "flex", alignItems: "center" }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: 11.5, color: PD.textMuted }}>{timeAgo(lead.created_at)}</p>
                    {deleteConfirmId === lead.id && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12.5, color: PD.accentText, fontWeight: 600 }}>{t("salesmanLite.leads.deleteQ")}</span>
                        <button onClick={() => handleDeleteLead(lead.id)}
                          style={{ fontSize: 12, height: 32, padding: "0 14px", borderRadius: PD.radius.pill, background: PD.accent, border: "none", color: PD.onAccent, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>
                          {t("salesmanLite.leads.yes")}
                        </button>
                        <button onClick={() => setDeleteConfirmId(null)}
                          style={{ fontSize: 12, height: 32, padding: "0 14px", borderRadius: PD.radius.pill, background: PD.raised, border: "none", color: PD.textSec, cursor: "pointer", fontFamily: "inherit" }}>
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

        {/* ── LEAD DETAIL PANEL ── */}
        {drawerLeadId && (() => {
          const pl = leads.find(l => l.id === drawerLeadId);
          if (!pl) return null;
          const plCar = pl.car_listings;
          const plCarName = plCar ? [plCar.year, plCar.brand, plCar.model].filter(Boolean).join(" ") : null;
          const plCarPrice = plCar?.selling_price ? `RM ${Number(plCar.selling_price).toLocaleString("en-MY")}` : null;
          const plHeat = getHeatScore(pl);
          const plInitials = (pl.buyer_name || "?").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
          const plThread = threadByLead.get(pl.id) || null;
          const plIsPromptingLost = lostPromptId === pl.id;
          const plIsConfirmingDelete = deleteConfirmId === pl.id;
          const close = () => { setDrawerLeadId(null); setEditingNoteId(null); setExpandedActivityLeadId(null); setLostPromptId(null); setDeleteConfirmId(null); };
          const row = { display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: PD.raised, border: "none", width: "100%", textAlign: "left", fontFamily: "inherit", boxSizing: "border-box" };
          return (
            <>
              <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} />
              <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50, width: 400, maxWidth: "100vw", background: PD.card, color: PD.text, display: "flex", flexDirection: "column" }}>

                {/* header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "16px 20px", borderBottom: `1px solid ${PD.line}`, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: PD.raised, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 700, color: PD.text }}>{plInitials}</div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.buyer_name || "—"}</p>
                      <p style={{ margin: "1px 0 0", fontSize: 12, color: PD.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plCarName || pl.phone || t("salesmanLite.drawer.noCarLinkedShort")}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {!plHeat.terminal && (
                      <span style={{ ...tag, color: heatColor(plHeat.label) }}>{plHeat.label}</span>
                    )}
                    <span style={{ ...tag, color: PD.textSec, textTransform: "capitalize", letterSpacing: 0 }}>{stageLabel(pl.stage)}</span>
                    <button onClick={close} aria-label="Close" style={{ background: PD.raised, border: "none", cursor: "pointer", color: PD.textSec, borderRadius: 99, padding: 8, display: "flex" }}>
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* The car: image, name, price, and the specs needed to answer fast. */}
                {plCar ? (
                  <div style={{ padding: "14px 20px", borderBottom: `1px solid ${PD.line}`, display: "flex", gap: 12 }}>
                    {(() => {
                      const img = Array.isArray(plCar.images) ? plCar.images.find(Boolean) : null;
                      return img ? (
                        <img src={cdnImg(img, 200)} alt={plCarName || "Car"}
                          onClick={() => plCar.slug && window.open(`/cars/${plCar.slug}`, "_blank")}
                          style={{ width: 88, height: 66, borderRadius: PD.radius.row, objectFit: "cover", flexShrink: 0, cursor: plCar.slug ? "pointer" : "default" }} />
                      ) : (
                        <div style={{ width: 88, height: 66, borderRadius: PD.radius.row, flexShrink: 0, background: PD.raised, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Car size={22} color={PD.textMuted} />
                        </div>
                      );
                    })()}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[plCar.year, plCar.brand, plCar.model, plCar.variant].filter(Boolean).join(" ") || plCarName}
                      </p>
                      {plCarPrice && <p style={{ margin: "3px 0 0", fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{plCarPrice}</p>}
                      <p style={{ margin: "5px 0 0", fontSize: 12, color: PD.textSec }}>
                        {[carAgeLabel(plCar.year), plCar.mileage ? `${Number(plCar.mileage).toLocaleString("en-MY")} km` : null, plCar.transmission].filter(Boolean).join(" · ")}
                      </p>
                      {(plCar.vin_number || plCar.plate_number) && (
                        <p style={{ margin: "3px 0 0", fontSize: 11, color: PD.textMuted, fontFamily: "monospace" }}>
                          {[plCar.plate_number && `${t("salesmanLite.drawer.plateLabel")} ${plCar.plate_number}`, plCar.vin_number && `${t("salesmanLite.drawer.vinLabel")} ${plCar.vin_number}`].filter(Boolean).join("  ·  ")}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "12px 20px", borderBottom: `1px solid ${PD.line}`, display: "flex", alignItems: "center", gap: 8 }}>
                    <Car size={14} color={PD.textMuted} />
                    <span style={{ fontSize: 12.5, color: PD.textMuted }}>{t("salesmanLite.drawer.noCarLinkedRow")}</span>
                  </div>
                )}

                {/* scrollable body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18, WebkitOverflowScrolling: "touch" }}>

                  {/* CONTACT: a chat lead arrives with no number, so the empty row matters most. */}
                  <div>
                    <p style={label}>{t("salesmanLite.drawer.contact", { defaultValue: "Contact" })}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, borderRadius: PD.radius.row, overflow: "hidden" }}>
                      {plThread && (
                        <button onClick={() => setChatSheet({ threadId: plThread.id, buyerName: pl.buyer_name || "Buyer", carLabel: plCarName })} style={{ ...row, cursor: "pointer" }}>
                          <MessageSquare size={13} color={PD.textSec} style={{ flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: PD.text }}>{t("salesmanLite.drawer.inAppChat", { defaultValue: "In-app chat" })}</span>
                          {plThread.seller_unread > 0 && (
                            <span style={{ flexShrink: 0, minWidth: 18, height: 18, borderRadius: 99, background: PD.accent, color: PD.onAccent, fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                              {plThread.seller_unread}
                            </span>
                          )}
                          <ChevronRight size={14} color={PD.textMuted} style={{ flexShrink: 0 }} />
                        </button>
                      )}
                      <div style={row}>
                        <Phone size={13} color={PD.textSec} style={{ flexShrink: 0 }} />
                        {editPhoneLeadId === pl.id ? (
                          <>
                            <PhoneInput
                              autoFocus
                              value={editPhoneVal}
                              onChange={setEditPhoneVal}
                              onKeyDown={(e) => { if (e.key === "Enter") saveLeadPhone(pl.id); if (e.key === "Escape") setEditPhoneLeadId(null); }}
                              aria-label={t("salesmanLite.drawer.phoneLabel", { defaultValue: "Buyer phone number" })}
                              style={{ flex: 1, minWidth: 0, background: PD.hover, border: "none", borderRadius: PD.radius.pill, color: PD.text, fontSize: 13, padding: "6px 10px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                              prefixStyle={{ padding: "0 3px 0 0" }}
                              inputStyle={{ padding: 0 }}
                            />
                            <button onClick={() => saveLeadPhone(pl.id)} disabled={phoneSavingId === pl.id}
                              style={{ flexShrink: 0, fontSize: 12, height: 30, padding: "0 12px", borderRadius: PD.radius.pill, background: PD.accent, border: "none", color: PD.onAccent, cursor: "pointer", fontWeight: 600, fontFamily: "inherit", opacity: phoneSavingId === pl.id ? 0.5 : 1 }}>
                              {phoneSavingId === pl.id ? "…" : t("salesmanLite.drawer.save")}
                            </button>
                            <button onClick={() => setEditPhoneLeadId(null)} aria-label={t("salesmanLite.drawer.cancel")}
                              style={{ flexShrink: 0, background: "none", border: "none", color: PD.textMuted, cursor: "pointer", padding: 4, display: "flex" }}>
                              <X size={14} />
                            </button>
                          </>
                        ) : pl.phone ? (
                          <>
                            <a href={`tel:${pl.phone}`} style={{ flex: 1, minWidth: 0, fontSize: 13, color: PD.text, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{pl.phone}</a>
                            <button onClick={() => { setEditPhoneLeadId(pl.id); setEditPhoneVal(pl.phone || ""); }} aria-label={t("salesmanLite.drawer.editPhone", { defaultValue: "Edit phone number" })}
                              style={{ flexShrink: 0, background: "none", border: "none", color: PD.textMuted, cursor: "pointer", padding: 4, display: "flex" }}>
                              <Pencil size={12} />
                            </button>
                            {!isValidMyPhone(pl.phone) && (
                              <span style={{ flexShrink: 0, fontSize: 12, color: PD.accentText }}>{t("salesmanLite.drawer.phoneLooksWrong", { defaultValue: "Check this number" })}</span>
                            )}
                            {isValidMyPhone(pl.phone) && (
                              <a href={`https://wa.me/${(() => { const dg = String(pl.phone).replace(/\D/g, ""); return dg.startsWith("6") ? dg : "6" + dg; })()}`} target="_blank" rel="noopener noreferrer"
                                style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, fontSize: 12, fontWeight: 600, height: 28, padding: "0 10px", borderRadius: PD.radius.pill, background: PD.hover, color: PD.up, textDecoration: "none" }}>
                                <MessageCircle size={11} /> WhatsApp
                              </a>
                            )}
                          </>
                        ) : (
                          <button onClick={() => { setEditPhoneLeadId(pl.id); setEditPhoneVal(""); }}
                            style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, color: PD.textSec, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                            <Plus size={12} />
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
                    <p style={label}>{t("salesmanLite.drawer.notes")}</p>
                    {editingNoteId === pl.id ? (
                      <div>
                        <textarea autoFocus value={editNoteVal} onChange={e => setEditNoteVal(e.target.value)} rows={3} style={{ ...field, resize: "none" }} />
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <button onClick={() => saveLeadNote(pl.id)} disabled={notesSavingId === pl.id} style={{ ...panelBtn, background: PD.accent, color: PD.onAccent, fontWeight: 600, opacity: notesSavingId === pl.id ? 0.5 : 1 }}>{notesSavingId === pl.id ? "…" : t("salesmanLite.drawer.save")}</button>
                          <button onClick={() => setEditingNoteId(null)} style={panelBtn}>{t("salesmanLite.drawer.cancel")}</button>
                        </div>
                      </div>
                    ) : pl.notes ? (
                      <p onClick={() => { setEditingNoteId(pl.id); setEditNoteVal(pl.notes || ""); }} style={{ margin: 0, fontSize: 13.5, color: PD.textSec, lineHeight: 1.5, cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 8, background: PD.raised, borderRadius: PD.radius.row, padding: "10px 12px" }}>
                        <Pencil size={12} style={{ flexShrink: 0, marginTop: 3 }} /> <span>"{pl.notes}"</span>
                      </p>
                    ) : (
                      <button onClick={() => { setEditingNoteId(pl.id); setEditNoteVal(""); }} style={{ ...panelBtn, width: "100%", height: 40 }}>
                        <Pencil size={12} /> {t("salesmanLite.drawer.addNote")}
                      </button>
                    )}
                  </div>

                  {/* Tools. Reminders + call log and the loan check are Premium
                      (shown locked, they open the one upgrade screen). The old
                      flat-rate loan calculator is gone (HP Act 2026). */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { if (expandedActivityLeadId === pl.id) setExpandedActivityLeadId(null); else fetchLeadActivities(pl.id); }}
                      style={{ ...panelBtn, background: expandedActivityLeadId === pl.id ? PD.hover : PD.raised, color: expandedActivityLeadId === pl.id ? PD.text : PD.textSec }}>
                      <History size={12} /> {t("salesmanLite.drawer.history")}
                    </button>
                    {pl.stage === "deposit_taken" && (
                      <button onClick={() => { setDepositModal(pl); setDepositAmount(""); setDepositCopied(false); }} style={panelBtn}>
                        {t("salesmanLite.drawer.receipt")}
                      </button>
                    )}
                    <button onClick={() => setLinkCarLeadId(pl.id)} style={panelBtn}>
                      <Car size={12} /> {pl.car_listing_id ? t("salesmanLite.drawer.changeCar") : t("salesmanLite.drawer.linkCar")}
                    </button>
                    <button type="button" className="lk-prem" onClick={goPremium} style={{ ...panelBtn, color: PD.text }}>
                      <Lock size={12} color={PD.accentText} /> {t("salesmanLite.premiumRow.leadTools")}
                    </button>
                    <button type="button" className="lk-prem" onClick={goPremium} style={{ ...panelBtn, color: PD.text }}>
                      <Lock size={12} color={PD.accentText} /> {t("salesmanLite.premiumRow.loanCheck")}
                    </button>
                  </div>

                  {/* Activity timeline */}
                  {expandedActivityLeadId === pl.id && (
                    <div style={{ background: PD.raised, borderRadius: PD.radius.row, padding: "12px 14px" }}>
                      <p style={label}>{t("salesmanLite.drawer.activityHistory")}</p>
                      {activitiesLoadingId === pl.id ? (
                        <p style={{ fontSize: 12.5, color: PD.textMuted, margin: 0 }}>{t("salesmanLite.drawer.loading")}</p>
                      ) : (leadActivities[pl.id] || []).length === 0 ? (
                        <p style={{ fontSize: 12.5, color: PD.textMuted, margin: 0 }}>{t("salesmanLite.drawer.noActivity")}</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {(leadActivities[pl.id] || []).map((act, i) => {
                            const ActIcon = act.activity_type === "whatsapp_sent" ? MessageSquare : act.activity_type === "call_logged" ? Phone : act.activity_type === "stage_changed" ? RefreshCw : Pencil;
                            return (
                              <div key={act.id || i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                <ActIcon size={13} style={{ flexShrink: 0, marginTop: 2, color: PD.textMuted }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: 13, color: PD.textSec }}>{act.activity_type === "stage_changed" ? `${act.from_stage ? stageLabel(act.from_stage) : "?"} → ${act.to_stage ? stageLabel(act.to_stage) : "?"}` : act.note || act.activity_type}</p>
                                  <p style={{ margin: 0, fontSize: 11.5, color: PD.textMuted }}>{timeAgo(act.created_at)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add-ons: paid upsells from the seller's own catalogue, on this deal (deal_products). */}
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                      <p style={{ ...label, margin: 0 }}>{t("salesmanLite.drawer.addons.title")}</p>
                      {dealAddons.length > 0 && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: PD.text, fontVariantNumeric: "tabular-nums" }}>
                          RM {dealAddons.reduce((s, a) => s + Number(a.sold_price), 0).toLocaleString("en-MY")}
                        </span>
                      )}
                    </div>
                    {addonsLoading ? (
                      <p style={{ fontSize: 12.5, color: PD.textMuted, margin: 0 }}>{t("salesmanLite.drawer.loading")}</p>
                    ) : (
                      <>
                        {dealAddons.map((a) => (
                          <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", marginBottom: 4, background: PD.raised, borderRadius: PD.radius.row }}>
                            <span style={{ fontSize: 13, color: PD.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.dealer_products?.name || "—"}</span>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: PD.text, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>RM {Number(a.sold_price).toLocaleString("en-MY")}</span>
                            <button onClick={() => handleRemoveAddon(a.id)} aria-label="Remove add-on" style={{ background: "none", border: "none", cursor: "pointer", color: PD.textMuted, display: "flex", padding: 4, flexShrink: 0 }}>
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                        {!showAttachAddon ? (
                          <button onClick={() => { setShowAttachAddon(true); setAddonForm({ product_id: "", sold_price: "" }); }} style={{ ...panelBtn, width: "100%", height: 40, justifyContent: "center", color: PD.text, fontWeight: 600 }}>
                            <Plus size={12} /> {t("salesmanLite.drawer.addons.attachCta")}
                          </button>
                        ) : (
                          <div style={{ background: PD.raised, borderRadius: PD.radius.row, padding: 12 }}>
                            {addonCatalogue.length === 0 ? (
                              <p style={{ fontSize: 12.5, color: PD.textSec, margin: "0 0 8px" }}>{t("salesmanLite.drawer.addons.empty")}</p>
                            ) : (
                              <>
                                <select
                                  value={addonForm.product_id}
                                  onChange={(e) => { const sel = addonCatalogue.find((p) => p.id === e.target.value); setAddonForm((f) => ({ ...f, product_id: e.target.value, sold_price: sel ? String(sel.selling_price) : f.sold_price })); }}
                                  style={{ ...field, background: PD.hover, marginBottom: 6 }}
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
                                  style={{ ...field, background: PD.hover, marginBottom: 8 }}
                                />
                              </>
                            )}
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => setShowAttachAddon(false)} style={{ ...panelBtn, flex: 1, justifyContent: "center", background: PD.hover }}>{t("salesmanLite.drawer.cancel")}</button>
                              {addonCatalogue.length > 0 && (
                                <button onClick={handleAttachAddon} disabled={attachingAddon || !addonForm.product_id || !addonForm.sold_price} style={{ ...panelBtn, flex: 1, justifyContent: "center", background: PD.accent, color: PD.onAccent, fontWeight: 600, opacity: (!addonForm.product_id || !addonForm.sold_price || attachingAddon) ? 0.5 : 1 }}>
                                  {attachingAddon ? t("salesmanLite.drawer.addons.adding") : t("salesmanLite.drawer.addons.submit")}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div style={{ borderTop: `1px solid ${PD.line}` }} />

                  {/* Lost / Delete */}
                  {plIsPromptingLost ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, color: PD.textSec, fontWeight: 600, marginRight: 2 }}>{t("salesmanLite.drawer.whyLost")}</span>
                      {LOST_REASONS.map(r => (
                        <button key={r} onClick={() => handleLostReason(pl.id, r)} disabled={lostSavingId === pl.id} style={{ ...panelBtn, height: 32, opacity: lostSavingId === pl.id ? 0.5 : 1 }}>
                          {lostSavingId === pl.id ? "…" : t("salesmanLite.drawer.lostReasons." + r.toLowerCase())}
                        </button>
                      ))}
                      <button onClick={() => setLostPromptId(null)} aria-label="Cancel" style={{ ...panelBtn, height: 32, background: "transparent", color: PD.textMuted }}>✕</button>
                    </div>
                  ) : plIsConfirmingDelete ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, color: PD.accentText, fontWeight: 600 }}>{t("salesmanLite.drawer.deleteLeadQ")}</span>
                      <button onClick={() => handleDeleteLead(pl.id)} disabled={deletingLeadId === pl.id} style={{ ...panelBtn, background: PD.accent, color: PD.onAccent, fontWeight: 600, opacity: deletingLeadId === pl.id ? 0.5 : 1 }}>{deletingLeadId === pl.id ? "…" : t("salesmanLite.drawer.yesDelete")}</button>
                      <button onClick={() => setDeleteConfirmId(null)} style={panelBtn}>{t("salesmanLite.drawer.no")}</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      {pl.stage !== "won" && pl.stage !== "closed_won" && (
                        <button onClick={() => { setDeleteConfirmId(null); setLostPromptId(pl.id); }} style={{ ...panelBtn, color: PD.accentText }}>
                          {t("salesmanLite.drawer.markLost")}
                        </button>
                      )}
                      <button onClick={() => { setLostPromptId(null); setDeleteConfirmId(pl.id); }} style={{ ...panelBtn, color: PD.textMuted }}>
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
    // never disappears. Only PURE enquiries (no lead yet on that phone) are
    // appended, so a brand-new, not-yet-converted enquiry still surfaces with
    // its quick actions. Redesigned 2026-11-01 in premiumDark (PD): one tone per
    // tag, the word carries the meaning (New = red, it needs a reply).
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
    const tag = { fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: PD.radius.pill, flexShrink: 0, background: PD.raised, whiteSpace: "nowrap" };
    const smallBtn = { fontSize: 12.5, fontWeight: 600, height: 36, padding: "0 14px", borderRadius: PD.radius.pill, border: "none", cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 };

    return (
    <div style={{ color: PD.text }}>
      <p style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
        {t("salesmanLite.inbox.leadHistory")} <span style={{ color: PD.textMuted, fontWeight: 500 }}>{historyItems.length}</span>
      </p>
      {historyItems.length === 0 && (
        <div style={{ padding: "44px 24px", textAlign: "center", background: PD.card, borderRadius: PD.radius.card }}>
          <MessageSquare size={28} color={PD.textMuted} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t("salesmanLite.inbox.noLeadHistory")}</p>
          <p style={{ margin: "6px 0 16px", fontSize: 13, color: PD.textSec }}>{t("salesmanLite.inbox.noLeadHistorySub")}</p>
          <button onClick={() => setActiveTab("listings")} style={{ ...smallBtn, background: PD.raised, color: PD.text }}>
            {t("salesmanLite.inbox.goToListings")}
          </button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[...historyItems].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((enq) => {
          const car = enq.car_listings;
          const isNew = enq.status === "new";
          const matchedLead = enq._lead || leadByPhone.get(normalizePhone(enq.buyer_phone));
          const liveStage = matchedLead?.stage;
          const isExpanded = expandedEnqId === enq.id;
          return (
            <div
              key={enq.id}
              onClick={() => setExpandedEnqId(isExpanded ? null : enq.id)}
              style={{ background: PD.card, borderRadius: PD.radius.row + 4, padding: isNew ? "14px 16px" : "11px 16px", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: isNew ? PD.text : PD.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {enq.buyer_name || "—"}
                </p>
                {isNew ? (
                  <span style={{ ...tag, color: PD.accentText }}>{t("salesmanLite.inbox.new")}</span>
                ) : liveStage ? (
                  <span style={{ ...tag, color: PD.textSec, textTransform: "capitalize" }}>{liveStage.replace(/_/g, " ")}</span>
                ) : (
                  <span style={{ ...tag, color: PD.textSec }}>{t("salesmanLite.inbox.convertedToLead")}</span>
                )}
              </div>
              {car && (
                <p style={{ margin: "0 0 2px", fontSize: 12.5, color: PD.textSec }}>
                  {[car.year, car.brand, car.model].filter(Boolean).join(" ")}
                </p>
              )}
              {(isNew || isExpanded) && enq.buyer_message && (
                <div style={{ margin: "8px 0", padding: "9px 12px", background: PD.raised, borderRadius: PD.radius.row }}>
                  <p style={{ margin: 0, fontSize: 13, color: PD.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {enq.buyer_message}
                  </p>
                </div>
              )}
              {(isNew || isExpanded) && enq.buyer_phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 6px" }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: PD.textSec, display: "inline-flex", alignItems: "center", gap: 5, fontVariantNumeric: "tabular-nums" }}><Phone size={12} /> {enq.buyer_phone}</p>
                  {isExpanded && (
                    <a
                      href={`https://wa.me/${enq.buyer_phone.replace(/\D/g, "").replace(/^0/, "6")}?text=${encodeURIComponent(`Hi ${enq.buyer_name || ""}! 😊`)}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: 12, fontWeight: 600, height: 28, padding: "0 10px", display: "inline-flex", alignItems: "center", borderRadius: PD.radius.pill, background: PD.raised, color: PD.up, textDecoration: "none" }}
                    >WA</a>
                  )}
                </div>
              )}
              <p style={{ margin: isNew ? "2px 0 10px" : "2px 0 0", fontSize: 11.5, color: PD.textMuted }}>
                {preciseAgo(enq.created_at, nowTick, timeLabels)}
              </p>
              {/* Actions — unreplied only, max 2 */}
              {isNew && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {enq.buyer_phone && (
                    <button
                      className="lk-red"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const phone = enq.buyer_phone.replace(/\D/g, "");
                        const enqCar = enq.car_listings;
                        const carName = enqCar ? `${enqCar.brand} ${enqCar.model}` : "kereta";
                        const msg = encodeURIComponent(`Hi ${enq.buyer_name || ""}! Thank you for your enquiry on the ${carName}. I'm here to help — when would be a good time to chat? 😊`);
                        // Persist first, WhatsApp hand-off last — navigating the
                        // current tab to WhatsApp can suspend the page before
                        // pending writes finish.
                        await supabase.from("whatsapp_enquiries").update({ status: "responded" }).eq("id", enq.id);
                        setEnquiries((p) => p.map((x) => x.id === enq.id ? { ...x, status: "responded" } : x));
                        await autoCreateLeadFromEnq(enq);
                        window.location.href = `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${msg}`;
                      }}
                      style={{ ...smallBtn, color: PD.onAccent }}
                    >
                      <MessageCircle size={13} /> {t("salesmanLite.inbox.waReply")}
                    </button>
                  )}
                  {enq.buyer_phone && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenTemplateId(openTemplateId === enq.id ? null : enq.id); }}
                      style={{ ...smallBtn, background: openTemplateId === enq.id ? PD.hover : PD.raised, color: openTemplateId === enq.id ? PD.text : PD.textSec }}
                    >
                      {t("salesmanLite.inbox.templates")} ▾
                    </button>
                  )}
                </div>
              )}
              {isNew && openTemplateId === enq.id && (
                <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    { key: "chat", label: t("salesmanLite.inbox.templateChat") },
                    { key: "test_drive", label: t("salesmanLite.inbox.templateTestDrive") },
                    { key: "budget", label: t("salesmanLite.inbox.templateBudget") },
                    { key: "deposit", label: t("salesmanLite.inbox.templateDeposit") },
                  ].map(({ key, label }) => {
                    const toastKey = enq.id + "_" + key;
                    const sent = templateToast === toastKey;
                    return (
                      <button
                        key={key}
                        onClick={() => fireTemplate(enq, key)}
                        style={{ textAlign: "left", fontSize: 13, padding: "10px 12px", borderRadius: PD.radius.row, background: PD.raised, border: "none", color: sent ? PD.up : PD.text, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        {sent ? `✓ ${t("salesmanLite.inbox.sent")}` : label}
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

    // One tone for every status tag; the WORD carries the meaning (premiumDark,
    // same rule as Premium's Inbox). No amber / purple / orange.
    const statusTone = {
      pending: PD.accentText, confirmed: PD.up, rescheduled: PD.text,
      cancelled: PD.textMuted, completed: PD.textSec, no_show: PD.textSec,
    };
    const statusTag = (status) => (
      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: PD.radius.pill, background: PD.raised, color: statusTone[status] || PD.textSec, textTransform: "capitalize", flexShrink: 0, whiteSpace: "nowrap" }}>
        {t("salesmanLite.inbox.status." + status, { defaultValue: status })}
      </span>
    );

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

    // Pending bookings are requests, not commitments yet: their own section (any
    // date); only once confirmed do they join Today/Upcoming/Past.
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

    const btn = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 38, padding: "0 14px", borderRadius: PD.radius.pill, background: PD.raised, border: "none", color: PD.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", boxSizing: "border-box" };

    // Compact card, sized like the pipeline lead card. `hideTag`: a card inside
    // "Awaiting confirmation" / "Confirmed upcoming" does not repeat its state
    // (the section heading says it).
    const renderApptCard = (apt, hideTag) => {
      const car = apt.car_listings;
      const { dateStr, timeStr } = fmtAptDate(apt.appointment_date);
      const isFuture = apt.appointment_date && new Date(apt.appointment_date) > new Date(nowTick);
      const carTitle = car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : "No car linked";
      const carPrice = car?.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : null;
      const initials = (apt.buyer_name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
      const phone = (apt.buyer_phone || "").replace(/\D/g, "");
      // A booking can be confirmed while it's still a live request.
      const canConfirm = apt.status !== "confirmed" && apt.status !== "cancelled" && apt.status !== "completed";

      return (
        <div key={apt.id} style={{ background: PD.card, borderRadius: PD.radius.card, overflow: "hidden", minWidth: 0 }}>
          <div style={{ padding: "16px 16px 0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: PD.raised, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 600, color: PD.textSec }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: PD.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{apt.buyer_name || "Unknown Buyer"}</p>
                    {aptIsNew(apt.created_at) && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: PD.raised, color: PD.accentText, flexShrink: 0 }}>NEW</span>
                    )}
                  </div>
                  {!hideTag && statusTag(apt.status)}
                </div>
                {(carTitle || carPrice) && (
                  <div
                    onClick={(e) => { if (car?.slug) { e.stopPropagation(); window.open(`/cars/${car.slug}`, "_blank"); } }}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 3, gap: 8, cursor: car?.slug ? "pointer" : "default" }}
                  >
                    <p style={{ margin: 0, fontSize: 12.5, color: PD.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textDecoration: car?.slug ? "underline" : "none", textDecorationColor: "rgba(163,169,181,0.35)" }}>{carTitle}</p>
                    {carPrice && <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: PD.text, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{carPrice}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Date line — the one highlighted fact on the card */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: PD.text, height: 30, padding: "0 12px", borderRadius: PD.radius.pill, background: PD.raised, fontVariantNumeric: "tabular-nums" }}>
                <Calendar size={13} color={PD.textSec} /> {dateStr}{timeStr ? ` · ${timeStr}` : ""}
              </span>
              {isFuture && <span style={{ fontSize: 12, fontWeight: 600, color: PD.textSec }}>{preciseUntil(apt.appointment_date, nowTick, timeLabels)}</span>}
              {apt.remind_at && !apt.remind_sent && <Bell size={12} color={PD.textSec} />}
            </div>
          </div>

          {/* Action row — primary + call + ··· details, like the lead card */}
          <div style={{ display: "flex", gap: 6, padding: "0 16px 16px" }}>
            {canConfirm && apt.buyer_phone && (
              <button className="lk-red" onClick={() => openConfirmModal(apt)} title="Confirm this booking and message the buyer on WhatsApp"
                style={{ ...btn, flex: 1, minWidth: 0, background: undefined, color: PD.onAccent }}>
                <Check size={14} /> {t("salesmanLite.inbox.confirmBooking")}
              </button>
            )}
            {canConfirm && !apt.buyer_phone && (
              <button className="lk-red" onClick={async () => { await updateApptStatus(apt.id, "confirmed"); await autoUpsertLeadFromAppt(apt); await scheduleAptReminder(apt); }} title="Mark appointment as confirmed"
                style={{ ...btn, flex: 1, minWidth: 0, background: undefined, color: PD.onAccent }}>
                <Check size={14} /> {t("salesmanLite.inbox.confirmBooking")}
              </button>
            )}
            {apt.status === "confirmed" && apt.buyer_phone && (
              <button onClick={() => {
                  const p = apt.buyer_phone.replace(/\D/g, "");
                  const msg = buildReminderMessage(apt);
                  window.location.href = `https://wa.me/${p.startsWith("6") ? p : "6" + p}?text=${encodeURIComponent(msg)}`;
                }} title="Send WhatsApp reminder message to buyer"
                style={{ ...btn, flex: 1, minWidth: 0 }}>
                <MessageCircle size={13} /> {t("salesmanLite.inbox.message")}
              </button>
            )}
            {phone && (
              <a href={`tel:${phone}`} title="Call" aria-label="Call buyer" style={{ ...btn, flexShrink: 0, width: 40, padding: 0, color: PD.textSec }}>
                <Phone size={14} />
              </a>
            )}
            <button onClick={() => setBookingDetailId(apt.id)} title="Booking details" aria-label="Booking details"
              style={{ ...btn, flexShrink: 0, width: 40, padding: 0, color: PD.textSec, fontSize: 14, letterSpacing: "0.05em" }}>
              ···
            </button>
          </div>
        </div>
      );
    };

    // Full booking detail popup — opened from a card's ···. Car + VIN + notes and
    // the secondary actions (reschedule / reminder / cancel). Portal per the
    // overlay rules; tapping the backdrop or × closes it.
    const secBtn = { ...btn, flex: 1, minWidth: 0, padding: "0 8px", color: PD.textSec };
    const panelBox = { marginTop: 4, padding: "12px 14px", background: PD.raised, borderRadius: PD.radius.row };
    const pickerInput = { width: "100%", background: PD.hover, border: "none", borderRadius: PD.radius.row, color: PD.text, fontSize: 13, padding: "10px 12px", outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 8, colorScheme: "dark" };
    const renderBookingDetailModal = () => {
      const apt = appointments.find((a) => a.id === bookingDetailId);
      if (!apt) return null;
      const car = apt.car_listings;
      const { dateStr, timeStr } = fmtAptDate(apt.appointment_date);
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
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", background: PD.card, color: PD.text, borderRadius: "22px 22px 0 0", padding: 20, boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 16 }}>
              {statusTag(apt.status)}
              <button onClick={close} aria-label="Close" style={{ width: 34, height: 34, borderRadius: 99, background: PD.raised, border: "none", color: PD.textSec, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} />
              </button>
            </div>

            {/* Car — tapping it opens the listing. */}
            <div
              onClick={() => car?.slug && window.open(`/cars/${car.slug}`, "_blank")}
              style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16, cursor: car?.slug ? "pointer" : "default" }}
            >
              {carImg ? (
                <img src={carImg} alt="" style={{ width: 84, height: 64, objectFit: "cover", borderRadius: PD.radius.row, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 84, height: 64, borderRadius: PD.radius.row, flexShrink: 0, background: PD.raised, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Car size={20} color={PD.textMuted} />
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, textDecoration: car?.slug ? "underline" : "none", textDecorationColor: "rgba(242,244,247,0.3)" }}>{carTitle}</p>
                {carVariant && <p style={{ margin: "0 0 3px", fontSize: 12, color: PD.textSec }}>{carVariant}</p>}
                {carPrice && <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{carPrice}</p>}
                {carVin && <p style={{ margin: 0, fontSize: 11, color: PD.textMuted, fontFamily: "ui-monospace, monospace" }}>{car?.vin_number ? "VIN " : "Plate "}{carVin}</p>}
              </div>
            </div>

            {/* Buyer */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>{apt.buyer_name || "Unknown Buyer"}</p>
              {apt.buyer_phone && <p style={{ margin: "0 0 4px", fontSize: 13, color: PD.textSec, display: "inline-flex", alignItems: "center", gap: 6, fontVariantNumeric: "tabular-nums" }}><Phone size={13} /> {apt.buyer_phone}</p>}
              {apt.notes && <p style={{ margin: "4px 0 0", fontSize: 13, color: PD.textSec, fontStyle: "italic" }}>&quot;{apt.notes}&quot;</p>}
            </div>

            {/* Date */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "12px 16px", borderRadius: PD.radius.row, background: PD.raised, marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: PD.textSec, display: "inline-flex", alignItems: "center", gap: 6 }}><Calendar size={13} /> {dateStr}</span>
              {timeStr && <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{timeStr}</span>}
              {isFuture && <span style={{ fontSize: 12, fontWeight: 600, color: PD.textSec }}>{preciseUntil(apt.appointment_date, nowTick, timeLabels)}</span>}
            </div>

            {/* Reminder indicator */}
            {apt.remind_at && !apt.remind_sent ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: PD.radius.row, background: PD.raised, marginBottom: 12 }}>
                <Bell size={13} color={PD.up} />
                <span style={{ fontSize: 12, color: PD.text, flex: 1 }}>
                  {t("salesmanLite.inbox.reminderLabel")}: {new Date(apt.remind_at).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })} {new Date(apt.remind_at).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <button onClick={() => clearReminder(apt)} aria-label="Clear reminder" style={{ background: "none", border: "none", color: PD.textMuted, fontSize: 12, cursor: "pointer", padding: 4 }}>✕</button>
              </div>
            ) : apt.remind_sent ? (
              <p style={{ fontSize: 12, color: PD.textMuted, margin: "0 0 12px", display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={12} /> {t("salesmanLite.inbox.reminderSent")}</p>
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
                {/* Telegram booking reminders are Premium (2026-10-13); the
                    appointment-reminder cron also skips Lite sellers. */}
                <button className="lk-prem" style={{ ...secBtn, color: PD.text }} onClick={goPremium}><Lock size={13} color={PD.accentText} /> {t("salesmanLite.inbox.setReminder")}</button>
                <button style={{ ...secBtn, color: PD.accentText }} onClick={() => { setCancelConfirmId(apt.id); setReschedulingAptId(null); setReminderPickerAptId(null); }}><X size={13} /> {t("salesmanLite.inbox.cancelAppt")}</button>
              </div>
            )}

            {/* Expand: reschedule date picker */}
            {isRescheduling && (
              <div style={panelBox}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 12.5, color: PD.text, fontWeight: 600 }}>{t("salesmanLite.inbox.chooseNewTime")}</p>
                  <button onClick={() => { setReschedulingAptId(null); setRescheduleDate(""); }} title={t("salesmanLite.inbox.cancel")} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: PD.textMuted, cursor: "pointer", padding: 0, flexShrink: 0 }}>
                    <X size={14} />
                  </button>
                </div>
                <input type="datetime-local" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} style={pickerInput} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setReschedulingAptId(null); setRescheduleDate(""); }} style={{ ...btn, flex: 1, background: PD.hover, color: PD.textSec }}>
                    {t("salesmanLite.inbox.cancel")}
                  </button>
                  <button className="lk-red" onClick={async () => {
                      if (!rescheduleDate) return;
                      const newDate = new Date(rescheduleDate);
                      const remindAt = new Date(newDate.getTime() - 60 * 60 * 1000).toISOString();
                      await supabase.from("appointments").update({ appointment_date: newDate.toISOString(), status: "rescheduled", remind_at: remindAt, remind_sent: false }).eq("id", apt.id);
                      setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, appointment_date: newDate.toISOString(), status: "rescheduled", remind_at: remindAt, remind_sent: false } : a));
                      setReschedulingAptId(null);
                      setRescheduleDate("");
                      toast.success(t("salesmanLite.toast.appointmentRescheduled"));
                    }}
                    style={{ ...btn, flex: 2, background: undefined, color: PD.onAccent }}>
                    {t("salesmanLite.inbox.saveNewTime")}
                  </button>
                </div>
              </div>
            )}

            {/* Expand: Telegram reminder time picker */}
            {isReminderPicking && (
              <div style={panelBox}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 11, color: PD.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("salesmanLite.inbox.scheduleReminderTitle")}</p>
                  <button onClick={() => { setReminderPickerAptId(null); setSelectedRemindAt(null); }} title={t("salesmanLite.inbox.cancel")} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: PD.textMuted, cursor: "pointer", padding: 0, flexShrink: 0 }}>
                    <X size={14} />
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
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
                        style={{ fontSize: 12, height: 30, padding: "0 12px", borderRadius: 99, cursor: "pointer", border: "none", fontFamily: "inherit", background: active ? PD.text : PD.hover, color: active ? PD.card : PD.textSec }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <input type="datetime-local"
                  value={selectedRemindAt ? selectedRemindAt.toISOString().slice(0, 16) : ""}
                  onChange={(e) => e.target.value && setSelectedRemindAt(new Date(e.target.value))}
                  style={pickerInput}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setReminderPickerAptId(null); setSelectedRemindAt(null); }} style={{ ...btn, flex: 1, background: PD.hover, color: PD.textSec }}>
                    {t("salesmanLite.inbox.cancel")}
                  </button>
                  <button onClick={() => selectedRemindAt && saveReminder(apt, selectedRemindAt)}
                    disabled={!selectedRemindAt || reminderSaving}
                    style={{ ...btn, flex: 2, background: selectedRemindAt ? PD.accent : PD.hover, color: selectedRemindAt ? PD.onAccent : PD.textMuted, cursor: selectedRemindAt ? "pointer" : "not-allowed", opacity: reminderSaving ? 0.6 : 1 }}>
                    {reminderSaving ? t("salesmanLite.inbox.saving") : t("salesmanLite.inbox.setReminder")}
                  </button>
                </div>
              </div>
            )}

            {/* Expand: cancel confirmation */}
            {isCancelConfirm && (
              <div style={panelBox}>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: PD.accentText, fontWeight: 600 }}>{t("salesmanLite.inbox.cancelConfirmQ")}</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setCancelConfirmId(null)} style={{ ...btn, flex: 1, background: PD.hover, color: PD.textSec }}>
                    {t("salesmanLite.inbox.keepIt")}
                  </button>
                  <button onClick={async () => { await updateApptStatus(apt.id, "cancelled"); setCancelConfirmId(null); setBookingDetailId(null); }}
                    style={{ ...btn, flex: 2, background: PD.accent, color: PD.onAccent }}>
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

    const heading = (color, Icon, text, n) => (
      <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={12} /> {text} <span style={{ color: PD.textMuted }}>{n}</span>
      </p>
    );
    const grid = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 10, alignItems: "start" };

    return (
      <div style={{ color: PD.text }}>
        {renderBookingDetailModal()}
        <p style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
          {t("salesmanLite.inbox.bookings")} <span style={{ color: PD.textMuted, fontWeight: 500 }}>{confirmedApts.length}</span>
        </p>
        {appointments.length === 0 && (
          <div style={{ padding: "44px 24px", textAlign: "center", background: PD.card, borderRadius: PD.radius.card }}>
            <Calendar size={28} color={PD.textMuted} style={{ marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t("salesmanLite.inbox.noBookings")}</p>
            <p style={{ margin: "6px 0 16px", fontSize: 13, color: PD.textSec }}>{t("salesmanLite.inbox.noBookingsSub")}</p>
            <button onClick={() => setActiveTab("listings")} style={{ ...btn, display: "inline-flex" }}>
              {t("salesmanLite.inbox.shareListing")}
            </button>
          </div>
        )}
        {/* Awaiting confirmation — requests, not yet real bookings */}
        {pendingApts.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            {heading(PD.accentText, Clock, t("salesmanLite.inbox.awaitingConfirmation"), pendingApts.length)}
            <div style={grid}>{pendingApts.map((a) => renderApptCard(a, true))}</div>
          </div>
        )}
        {todayApts.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            {heading(PD.text, Calendar, t("salesmanLite.inbox.today"), todayApts.length)}
            <div style={grid}>{todayApts.map((a) => renderApptCard(a, false))}</div>
          </div>
        )}
        {upcomingApts.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            {heading(PD.up, Check, t("salesmanLite.inbox.confirmedUpcoming"), upcomingApts.length)}
            <div style={grid}>{upcomingApts.map((a) => renderApptCard(a, a.status === "confirmed"))}</div>
          </div>
        )}
        {/* Past — collapsed by default */}
        {pastApts.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setPastOpen((o) => !o)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: "6px 0", fontFamily: "inherit" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: PD.textSec }}>{t("salesmanLite.inbox.past")} ({pastApts.length})</span>
              <ChevronRight size={14} color={PD.textMuted} style={{ transform: pastOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
            </button>
            {pastOpen && (
              <div style={{ ...grid, marginTop: 8 }}>
                {pastApts.map((apt) => {
                  const car = apt.car_listings;
                  const { dateStr, timeStr } = fmtAptDate(apt.appointment_date);
                  const carLabel = car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : null;
                  // A past booking left open (pending/confirmed/rescheduled) would
                  // otherwise say "Confirmed" forever: offer the two real outcomes.
                  const needsOutcome = !["cancelled", "completed", "no_show"].includes(apt.status);
                  return (
                    <div key={apt.id} style={{ background: PD.card, borderRadius: PD.radius.row + 4, padding: "12px 16px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: PD.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {apt.buyer_name || "—"}
                        </p>
                        {statusTag(apt.status)}
                      </div>
                      <p style={{ margin: "0 0 2px", fontSize: 12.5, color: PD.textMuted, display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Calendar size={12} /> {dateStr}{timeStr && ` · ${timeStr}`}
                      </p>
                      {(carLabel || apt.buyer_phone) && (
                        <p style={{ margin: 0, fontSize: 12, color: PD.textMuted, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          {carLabel && (
                            <span onClick={() => car?.slug && window.open(`/cars/${car.slug}`, "_blank")}
                              style={{ cursor: car?.slug ? "pointer" : "default", textDecoration: car?.slug ? "underline" : "none", textDecorationColor: "rgba(132,139,152,0.5)" }}>
                              {carLabel}
                            </span>
                          )}
                          {carLabel && apt.buyer_phone && <span>·</span>}
                          {apt.buyer_phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Phone size={11} /> {apt.buyer_phone}</span>}
                        </p>
                      )}
                      {needsOutcome && (
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          <button onClick={() => setAptStatus(apt, "completed")} style={{ ...btn, height: 32, fontSize: 12, color: PD.up }}>
                            {t("salesmanLite.inbox.markCompleted")}
                          </button>
                          <button onClick={() => setAptStatus(apt, "no_show")} style={{ ...btn, height: 32, fontSize: 12, color: PD.textSec }}>
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
    // premiumDark (PD), the same language as Premium's Settings (2026-11-01):
    // tone not borders, one red fill (Save), mint only for "connected".
    const inputStyle = {
      width: "100%",
      background: PD.raised,
      border: "none",
      borderRadius: PD.radius.row,
      color: PD.text,
      fontSize: 14,
      padding: "11px 14px",
      outline: "none",
      boxSizing: "border-box",
      fontFamily: "inherit",
      colorScheme: "dark",
    };
    const cardStyle = { padding: 18, background: PD.card, borderRadius: PD.radius.card };
    const sectionLabelStyle = { margin: "0 0 14px", fontSize: 11, fontWeight: 600, color: PD.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" };
    const lbl = { fontSize: 12, color: PD.textSec, display: "block", marginBottom: 6 };
    const hint = { margin: "6px 0 0", fontSize: 11.5, color: PD.textMuted, lineHeight: 1.5 };
    const softBtn = { display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: PD.radius.pill, background: PD.raised, border: "none", color: PD.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };

    // Strip the country code AND any leading trunk 0 — a MY mobile under +60 is
    // written without the leading 0 (011… -> +6011…). Without the /^0+/ strip a
    // stored value could carry an extra 0 (+60011…), which is an invalid number
    // and breaks WhatsApp links + enquiries.

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
      const phone = toPlus60(settingsForm.whatsapp_number);
      if (phone && !isValidMyPhone(phone, { mobileOnly: true })) { toast.error(MY_PHONE_ERROR); return; }
      setSettingsSaving(true);
      const { error: saveProfileErr } = await supabase
        .from("profiles")
        .update({
          full_name: settingsForm.full_name,
          whatsapp_number: phone,
          telegram_chat_id: settingsForm.telegram_chat_id || null,
          city: settingsForm.city || null,
          state: settingsForm.state || null,
          location: settingsForm.location || null,
          bio: settingsForm.bio.trim() || null,
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
        bio: settingsForm.bio.trim() || null,
        instagram: settingsForm.instagram || null,
        tiktok: settingsForm.tiktok || null,
        facebook: settingsForm.facebook || null,
        website: settingsForm.website || null,
      }));
      setSettingsForm((p) => ({ ...p, whatsapp_number: phone }));
      toast.success(t("salesmanLite.toast.profileUpdated"));
    };

    const initials = (profile?.full_name || profile?.slug || "S")[0].toUpperCase();

    const snav = settingsNav;

    // Lifted out of the tree because three sections own profile fields and all
    // three need it. The form state lives on the page, not in the section, so
    // switching section never drops what was typed and saving from any of them
    // persists everything — same contract as Premium's Settings.
    const saveBtn = (
          <button
            className="lk-red"
            onClick={handleSave}
            disabled={settingsSaving}
            style={{ alignSelf: "flex-start", height: 42, padding: "0 22px", borderRadius: PD.radius.pill, border: "none", color: PD.onAccent, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: settingsSaving ? "not-allowed" : "pointer" }}
          >
            {settingsSaving ? t("salesmanLite.settings.savingBtn") : t("salesmanLite.settings.saveBtn")}
          </button>
    );

    return (
      <div style={{ maxWidth: isMobile ? 560 : 880, margin: "0 auto", width: "100%", boxSizing: "border-box", color: PD.text }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {t("salesmanLite.settings.title")}
          </p>
          {/* Manual/help — parked here, next to the settings the user is most
              likely to need it while filling in. The tour rings it. */}
          <button data-tour-id="help" onClick={() => setActiveTab("help")} style={{ ...softBtn, color: PD.textSec, flexShrink: 0 }}>
            <BookOpen size={13} /> {t("salesmanLite.tabs.help")}
          </button>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {/* Grouped sections: a rail on desktop, a pill row on a phone. */}
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 0 : 24, alignItems: "flex-start" }}>
          <div
            role="tablist"
            style={isMobile
              ? { display: "flex", gap: 6, overflowX: "auto", width: "100%", paddingBottom: 12, marginBottom: 10, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }
              : { display: "flex", flexDirection: "column", gap: 2, width: 200, flexShrink: 0, position: "sticky", top: 16, background: PD.card, borderRadius: PD.radius.card, padding: 10, boxSizing: "border-box" }}
          >
            {LITE_SETTINGS_NAV.map(({ key, labelKey, fallback }) => {
              const on = snav === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setSettingsNav(key)}
                  style={isMobile
                    ? { whiteSpace: "nowrap", flexShrink: 0, height: 34, padding: "0 14px", borderRadius: PD.radius.pill, fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "inherit", border: "none", background: on ? PD.text : PD.raised, color: on ? PD.card : PD.textSec }
                    : { textAlign: "left", whiteSpace: "nowrap", height: 40, padding: "0 12px", borderRadius: 12, fontSize: 13.5, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "inherit", border: "none", background: on ? PD.raised : "transparent", color: on ? PD.text : PD.textSec }}
                >
                  {t(labelKey, { defaultValue: fallback })}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, minWidth: 0, width: "100%", maxWidth: 600, display: "flex", flexDirection: "column", gap: 14 }}>
            {snav === "profile" && (
              <>
          {/* The ONE place a seller is asked for ID (owner, 2026-10-12), step by
              step: Get verified -> IC number -> MyKad photos. It earns the
              Verified badge (cars go live without it, 20261017b). */}
          <VerifyIdentity
            theme="premium"
            profile={profile}
            userId={userId}
            onIcSaved={() => setProfile((p) => ({ ...p, ic_hash: "set", ic_verified_at: new Date().toISOString(), ic_deadline: null }))}
            onSubmitted={() =>
              setProfile((p) => ({ ...p, kyc_submitted_at: new Date().toISOString() }))
            }
          />
          {/* Photo */}
          <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 16 }}>
            <button
              type="button"
              onClick={() => !avatarUploading && avatarInputRef.current?.click()}
              disabled={avatarUploading}
              title={t("salesmanLite.settings.changePhotoTitle")}
              aria-label={t("salesmanLite.settings.changePhoto")}
              style={{ position: "relative", flexShrink: 0, width: 72, height: 72, padding: 0, borderRadius: "50%", border: "none", background: PD.hover, overflow: "hidden", cursor: avatarUploading ? "default" : "pointer" }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                : <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", fontSize: 28, fontWeight: 700, color: PD.text }}>{initials}</span>}
              {avatarUploading && (
                <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)" }}>
                  <span style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                </span>
              )}
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.full_name || profile?.slug || t("salesmanLite.settings.yourName")}</p>
              <p style={{ ...hint, margin: "3px 0 10px" }}>{t("salesmanLite.settings.photoSubtext")}</p>
              <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading} style={softBtn}>
                {avatarUploading ? t("salesmanLite.settings.uploading") : t("salesmanLite.settings.changePhoto")}
              </button>
            </div>
          </div>
          {/* Banner, bio and social links are the Premium page (2026-10-13).
              get_salesman_by_slug returns them NULL for a Lite seller, so a field
              here would save something the page never shows. */}
          <button type="button" className="lk-prem" onClick={goPremium}
            style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, width: "100%", border: "none", color: PD.text, cursor: "pointer", fontFamily: "inherit", textAlign: "left", boxSizing: "border-box" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 10, background: PD.raised, flexShrink: 0 }}>
              <Lock size={14} color={PD.accentText} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{t("salesmanLite.premiumRow.pageTitle")}</span>
              <span style={{ display: "block", marginTop: 2, fontSize: 12, color: PD.textSec, lineHeight: 1.5 }}>{t("salesmanLite.premiumRow.pageSub")}</span>
            </span>
            <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: PD.accentText, whiteSpace: "nowrap" }}>{t("salesmanLite.premiumRow.cta")}</span>
          </button>
          {/* Profile basics */}
          <div style={cardStyle}>
            <p style={sectionLabelStyle}>{t("salesmanLite.settings.profileSection")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={lbl}>{t("salesmanLite.settings.fullName")}</label>
                <input
                  value={settingsForm.full_name}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder={t("salesmanLite.settings.fullNamePlaceholder")}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={lbl}>{t("salesmanLite.settings.whatsapp")}</label>
                <PhoneInput
                  mobileOnly
                  value={settingsForm.whatsapp_number}
                  onChange={(v) => setSettingsForm((p) => ({ ...p, whatsapp_number: v }))}
                  style={{ background: PD.raised, border: "none", borderRadius: PD.radius.row, overflow: "hidden" }}
                  prefixStyle={{ padding: "11px 12px", fontSize: 14, color: PD.textSec, background: PD.hover }}
                  inputStyle={{ ...inputStyle, background: "transparent", borderRadius: 0, flex: 1, width: "auto", minWidth: 0 }}
                />
                <p style={hint}>{t("salesmanLite.settings.whatsappHint")}</p>
              </div>
              <div>
                <label style={lbl}>{t("salesmanLite.settings.slug")}</label>
                <input value={profile?.slug || ""} readOnly style={{ ...inputStyle, color: PD.textMuted, cursor: "not-allowed", background: "transparent", boxShadow: `inset 0 0 0 1px ${PD.line}` }} />
                <p style={hint}>{t("salesmanLite.settings.slugHint")}</p>
              </div>
            </div>
          </div>
            {saveBtn}
              </>
            )}
            {snav === "contact" && (
              <>
          <div style={cardStyle}>
            <p style={sectionLabelStyle}>{t("salesmanLite.settings.locationSection")}</p>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: isMobile ? "wrap" : "nowrap" }}>
              <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                <label style={lbl}>{t("salesmanLite.settings.city")}</label>
                <input value={settingsForm.city} onChange={(e) => setSettingsForm((p) => ({ ...p, city: e.target.value }))} placeholder={t("salesmanLite.settings.cityPlaceholder")} style={inputStyle} />
              </div>
              <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                <label style={lbl}>{t("salesmanLite.settings.state")}</label>
                <select value={settingsForm.state} onChange={(e) => setSettingsForm((p) => ({ ...p, state: e.target.value }))}
                  style={{ ...inputStyle, appearance: "none" }}>
                  <option value="">{t("salesmanLite.settings.stateSelect")}</option>
                  {["Johor","Kedah","Kelantan","Kuala Lumpur","Labuan","Melaka","Negeri Sembilan","Pahang","Penang","Perak","Perlis","Putrajaya","Sabah","Sarawak","Selangor","Terengganu"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label style={lbl}>{t("salesmanLite.settings.address")}</label>
              <input value={settingsForm.location} onChange={(e) => setSettingsForm((p) => ({ ...p, location: e.target.value }))} placeholder={t("salesmanLite.settings.addressPlaceholder")} style={inputStyle} />
              <p style={hint}>{t("salesmanLite.settings.addressHint")}</p>
            </div>
          </div>
            {saveBtn}
              </>
            )}
            {snav === "selling" && (
              <>
          {/* Viewing availability — buyers can only book the days/times set here.
              theme="premium" drops the card's own title, so it is said here. */}
          <div style={cardStyle}>
            <p style={sectionLabelStyle}>{t("availability.title")}</p>
            <AvailabilityEditor ownerId={userId} dealerId={userId} theme="premium" />
          </div>
          {/* Selling terms — a standalone agent sells their own cars, so the buyer
              questions the dealer dashboard answers (is my deposit safe, what else
              do I pay) have to be answerable here too. */}
          <div style={cardStyle}>
            <p style={sectionLabelStyle}>{t("salesmanLite.settings.sellingTermsSection")}</p>
            <p style={{ ...hint, margin: "-8px 0 14px" }}>{t("salesmanLite.settings.sellingTermsHint")}</p>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>{t("salesmanLite.settings.depositPolicy")}</label>
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
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>{t("salesmanLite.settings.depositTerms")}</label>
              <input
                value={settingsForm.deposit_terms}
                onChange={(e) => setSettingsForm((p) => ({ ...p, deposit_terms: e.target.value }))}
                placeholder={t("salesmanLite.settings.depositTermsPlaceholder")}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={lbl}>{t("salesmanLite.settings.processingFee")}</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: PD.textMuted, pointerEvents: "none" }}>RM</span>
                <input
                  value={settingsForm.processing_fee}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, processing_fee: e.target.value.replace(/[^0-9.]/g, "") }))}
                  placeholder={t("salesmanLite.settings.processingFeePlaceholder")}
                  inputMode="decimal"
                  style={{ ...inputStyle, paddingLeft: 44 }}
                />
              </div>
              <p style={hint}>{t("salesmanLite.settings.processingFeeHint")}</p>
            </div>
          </div>
            {saveBtn}
              </>
            )}
            {snav === "alerts" && (
              <>
          {/* Push notifications — works with the app closed. */}
          <PushToggle userId={userId} theme="premium" style={{ padding: 18 }} />
          {/* Telegram sits beside the push toggle: the same decision ("where do
              alerts reach me"). */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <label style={{ ...lbl, marginBottom: 0, display: "inline-flex", alignItems: "center", gap: 6 }}><Send size={12} /> {t("salesmanLite.settings.telegram")}</label>
              {profile?.telegram_chat_id
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: PD.up }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: PD.up }} />{t("salesmanLite.settings.telegramConnected")}</span>
                : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: PD.textMuted }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: PD.textMuted }} />{t("salesmanLite.settings.telegramNotSet")}</span>
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
              style={{ ...softBtn, marginTop: 10, cursor: (tgTesting || !settingsForm.telegram_chat_id.trim()) ? "not-allowed" : "pointer", opacity: (tgTesting || !settingsForm.telegram_chat_id.trim()) ? 0.55 : 1 }}
            >
              <Send size={13} /> {tgTesting ? t("salesmanLite.settings.telegramTesting") : t("salesmanLite.settings.telegramTest")}
            </button>
            <p style={{ ...hint, lineHeight: 1.6 }}>
              {t("salesmanLite.settings.telegramHint").split("@userinfobot").map((part, i) =>
                i === 0 ? part : <React.Fragment key={i}><a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" style={{ color: PD.text, textDecoration: "underline", textDecorationColor: "rgba(242,244,247,0.35)" }}>@userinfobot</a>{part}</React.Fragment>
              )}
            </p>
          </div>
              </>
            )}
            {snav === "premium" && <PremiumUpgradeCard profile={profile} cars={myListings} onRefer={() => setSettingsNav("refer")} />}
            {snav === "refer" && <ReferralCard slug={profile?.slug} theme="premium" />}
            {snav === "newcars" && <MyNewModels theme="premium" profile={profile} onProfileChange={(patch) => setProfile((p) => ({ ...p, ...patch }))} onCardsAdded={(cars) => setMyListings((p) => [...cars, ...p])} />}
            {snav === "account" && (
              <>
          {/* theme="premium" drops the password card's own title; this section
              holds three things, so it is said here. */}
          <div>
            <p style={{ ...sectionLabelStyle, margin: "0 0 8px 4px" }}>{t("changePassword.title", { defaultValue: "Password" })}</p>
            <ChangePasswordCard theme="premium" />
          </div>
          <div style={cardStyle}>
            <p style={{ ...sectionLabelStyle, marginBottom: 8 }}>{t("salesmanLite.settings.language")}</p>
            <p style={{ ...hint, margin: "0 0 12px" }}>{t("salesmanLite.settings.languageSubtext")}</p>
            <div style={{ display: "flex", gap: 6 }}>
              {[{ code: "en", label: "English" }, { code: "ms", label: "Malay" }].map(({ code, label }) => {
                const on = i18n.language === code;
                return (
                  <button key={code} onClick={() => i18n.changeLanguage(code)}
                    style={{ height: 36, padding: "0 18px", borderRadius: PD.radius.pill, fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "inherit", border: "none", background: on ? PD.text : PD.raised, color: on ? PD.card : PD.textSec }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Danger zone — self-service account deletion. Red TEXT only. */}
          <div style={cardStyle}>
            <p style={{ ...sectionLabelStyle, marginBottom: 6, color: PD.accentText }}>{t("salesmanLite.dangerZone.title")}</p>
            <p style={{ ...hint, margin: "0 0 14px", maxWidth: 460, fontSize: 12.5, color: PD.textSec }}>{t("salesmanLite.dangerZone.subtext")}</p>
            <button onClick={() => { setDeleteConfirmText(""); setDeleteModalOpen(true); }} style={{ ...softBtn, color: PD.accentText }}>
              <Trash2 size={13} /> {t("salesmanLite.dangerZone.deleteBtn")}
            </button>
          </div>
              </>
            )}
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
              setWaModalLead(null);
              toast(t("salesmanLite.toast.waSent"), {
                description: t("salesmanLite.toast.waSentDesc"),
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

  const TOUR_ICONS = {
    welcome: Zap, dashboard: LayoutGrid, listings: Car, leads: Users, inbox: MessageSquare,
    bookings: Calendar, feedback: Star, performance: BarChart2, chat: MessageCircle, services: Package,
    settings: Settings, help: BookOpen,
  };
  const TOUR_STEPS = TOUR_PLAN.map(({ key }) => ({
    icon: TOUR_ICONS[key],
    title: t(`salesmanLite.tour.steps.${key}.title`),
    body: t(`salesmanLite.tour.steps.${key}.body`),
  }));

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

  // Counted as seen once it has been on screen for 3s, not only on close:
  // closing the app mid-tour recorded nothing, so it replayed on every launch
  // (2026-10-18). The grace keeps an instant reload or redirect from using it up.
  const tourOpen = tourStep !== null;
  useEffect(() => {
    if (!tourOpen || !userId) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(`slite_tour_seen_${userId}`, '1'); } catch {}
      supabase.from("profiles").update({ onboarding_tour_done: true }).eq("id", userId)
        .then(({ error }) => { if (error) console.error("tourSeen:", error); });
    }, 3000);
    return () => clearTimeout(timer);
  }, [tourOpen, userId]);

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

  // Performance and Add-ons are Premium (2026-10-13). The tabs stay reachable
  // (the tour walks through them) and say what Premium adds here, with the one
  // door to the upgrade screen. Per-car views + WhatsApp taps stay free on the
  // dashboard ("My Performance").
  const renderPremiumPanel = (kind) => {
    const cfg = {
      performance: { Icon: BarChart2, title: t("salesmanLite.premiumPanel.perfTitle"), sub: t("salesmanLite.premiumPanel.perfSub") },
      services:    { Icon: Package,   title: t("salesmanLite.premiumPanel.servicesTitle"), sub: t("salesmanLite.premiumPanel.servicesSub") },
    }[kind];
    const Icon = cfg.Icon;
    return (
      <div style={{ maxWidth: 420, margin: "0 auto", textAlign: "center", padding: isMobile ? "56px 20px" : "72px 24px" }}>
        <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 18px" }}>
          <div className="lk-prem" style={{ width: 64, height: 64, borderRadius: 18, background: PD.card, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={26} strokeWidth={1.5} style={{ color: PD.textSec }} />
          </div>
          <div style={{ position: "absolute", right: -6, bottom: -6, width: 26, height: 26, borderRadius: 9, background: "#dc2626", border: "3px solid #080a12", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Lock size={12} strokeWidth={2.5} style={{ color: "#fff" }} />
          </div>
        </div>
        <p style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "#f1f5f9" }}>{cfg.title}</p>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{cfg.sub}</p>
        <button
          className="lk-red"
          onClick={goPremium}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, height: 44, padding: "0 24px", borderRadius: 999, border: "none", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
        >
          <Sparkles size={15} /> {t("salesmanLite.premiumPanel.cta")}
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

    // Portalled (overlay rule 1): rendered in place, a transformed or
    // overflow-clipped ancestor can clip or re-anchor a position:fixed bubble.
    return createPortal(
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
              rest of the intro (and the whole panel) runs in. Picking one only
              switches the language; Start moves on. It used to also jump to
              step 2, which moved the bubble from the middle of the screen down
              onto the nav in the same tap, so a second tap on "Malay" (the
              Malay text arrives a beat later, so it looks like nothing
              happened) landed on the new bubble's Skip / X and ended the tour
              for good (2026-10-12: the owner's test account had
              onboarding_tour_done=true minutes after signup). */}
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
                      onClick={() => i18n.changeLanguage(code)}
                      style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                        background: active ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.1)"}`,
                        color: active ? "#fff" : "#94a3b8", transition: "all 0.15s" }}
                      aria-pressed={active}
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

          {/* Buttons — on the welcome step Start is the one red button; the
              language pick above it is a choice, not the way forward. */}
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
            {isWelcome && (
            <button
              onClick={() => setTourStep(1)}
              style={{ padding: "7px 16px", borderRadius: 7, background: "#dc2626", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {t("salesmanLite.tour.start", { defaultValue: "Start" })}
            </button>
            )}
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
      </>,
      document.body,
    );
  };

  if (profileLoadFailed) return <ProfileLoadError />;

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
            <div>
              <img src="/logo-shiftos.png" alt="ShiftOS" width="354" height="59" style={{ height: 15, width: "auto", display: "block" }} />
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
            gap: isMobile ? 6 : 12,
          }}
        >
          {isMobile ? (
            <>
              <img src="/logo-shiftos.png" alt="ShiftOS" width="354" height="59" style={{ height: 15, width: "auto", display: "block" }} />
              <div style={{ flex: 1 }} />
              <GoPremiumButton onClick={goPremium} compact={isMobile} />
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
              <GoPremiumButton onClick={goPremium} compact={isMobile} />
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
            position: "relative",
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
          {/* COACH-1 share tour: rings the car's Link button on Listings. */}
          {shareTourCar && activeTab === "listings" && (
            <ShareTour carId={shareTourCar} mode="copy" lang={i18n.language} onClose={() => setShareTourCar(null)} />
          )}
          <SuspendedBanner />
          {/* Premium lapsed: one line saying so, and how many cars it hid. */}
          {activeTab !== "settings" && (
            <PremiumEndedBanner profile={profile} lockedCount={myListings.filter(isLockedCar).length} onRenew={goPremium} />
          )}
          {/* Review status, the ID check and the IC number used to be three
              stacked banners on first landing; SellerIdCard is the one card
              (with one button to the next missing step) for all of them. */}
          {/* Not on Settings: Profile there opens with the full Get verified
              flow, and two identical asks on one screen is the clutter this
              card exists to remove. */}
          {activeTab !== "settings" && <SellerIdCard
            profile={profile}
            t={t}
            onUploadId={() => { setSettingsNav("profile"); switchTab("settings"); }}
          />}
          {/* The "you're approved" moment used to have no announcement at all —
              the under-review banner above just quietly stops rendering once
              approval_status flips, so a seller had to notice its absence.
              This reads the account_approved notification decide_user_approval
              now inserts and stays up until the seller dismisses it, not just
              for a few seconds. */}
          <AccountApprovedBanner
            notification={notifications.find((n) => n.type === "account_approved" && !n.is_read)}
            onDismiss={(id) => markNotifsSeen([id])}
          />

          {/* Push had no proactive ask anywhere outside a chat thread, so the
              only way a seller ever turned it on was finding PushToggle in
              Settings — the one screen a rep never opens. A signup therefore
              got no enquiry, booking or message alerts and no sign that was
              even a setting. Mounted OUTSIDE the tab switch on purpose: it
              stays put as they move around the panel (REQUIRED: no dismiss
              button), and it stops rendering for good the moment push
              is actually on. */}
          {/* Not on the chat tab — SellerInbox mounts its own copy above the
              thread list, and two identical asks on one screen is worse than
              none. */}
          {activeTab !== "chat" && (
            <PushPromptStrip t={PANEL_THEME} audience="seller_home" boxed required />
          )}

          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "listings" && renderListings()}
          {activeTab === "leads" && (gatedLocked ? renderLockedPanel("leads") : renderLeads())}
          {activeTab === "performance" && renderPremiumPanel("performance")}
          {activeTab === "enquiries" && (gatedLocked ? renderLockedPanel("enquiries") : (
            <div>
              {/* Sub-tab switch: same pills as Listings / Leads (premiumDark). */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {[
                  { key: "bookings", label: t("salesmanLite.inbox.bookings", { defaultValue: "Bookings" }), badge: pendingBookingsCount },
                  { key: "enquiries", label: t("salesmanLite.inbox.leadHistory", { defaultValue: "Lead History" }), badge: enquiries.filter((e) => e.status === "new").length },
                ].map(({ key, label, badge }) => {
                  const on = inboxSubTab === key;
                  return (
                    <button
                      key={key}
                      data-tour-id={key === "bookings" ? "bookings" : undefined}
                      onClick={() => { setInboxSubTab(key); }}
                      style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 16px", borderRadius: PD.radius.pill, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: on ? 600 : 500, background: on ? PD.text : PD.raised, color: on ? PD.card : PD.textSec }}
                    >
                      {label}
                      {badge > 0 && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, background: PD.accent, color: PD.onAccent, borderRadius: 99, padding: "0 6px", minWidth: 18, lineHeight: "18px", textAlign: "center" }}>
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
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
              fullHeight
              bottomInset={isMobile ? 80 : 24}
            />
          ))}
          {activeTab === "feedback" && (
            <React.Suspense fallback={<p style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>{t("salesmanLite.drawer.loading")}</p>}>
              <SellerFeedbackTab feedback={feedback} listings={myListings} sellerName={profile?.full_name || profile?.slug} theme="dark" />
            </React.Suspense>
          )}
          {activeTab === "services" && renderPremiumPanel("services")}
          {activeTab === "settings" && renderSettings()}
          {activeTab === "help" && <SalesmanLiteHelp />}
        </div>
      </div>

      {/* No floating "+" on Leads (2026-11-01): it duplicated the tab's own
          "Add lead" button and sat over each card's ··· button on a phone. */}

      {renderAddLeadModal()}
      {renderWAModal()}
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
              {wonLead.car_listing_id && (
                <WonVariantPick listingId={wonLead.car_listing_id} value={wonPrompt.variantId}
                  onChange={(id) => setWonPrompt((p) => (p ? { ...p, variantId: id } : p))} />
              )}
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
              // Same gap Premium had: Edit lived only on the listing card, so
              // opening a car and wanting to change something meant closing
              // the popup and finding the card again. Popup closes first —
              // two overlays must never be open at once (overlay rule 3).
              key: "edit",
              label: (<><Pencil size={13} style={{ flexShrink: 0 }} /> Edit</>),
              color: C.infoText,
              bg: "rgba(59,130,246,0.08)",
              border: "rgba(59,130,246,0.25)",
              onClick: () => { const car = selectedCar; setSelectedCar(null); setEditListing(car); },
            },
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
                onClick={() => { setTelegramSetupModal(false); setSettingsNav("alerts"); switchTab("settings"); }}
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
          <React.Suspense fallback={<p style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>{t("salesmanLite.drawer.loading")}</p>}>
          <CarForm
            sellerProfile={profile}
            listing={editListing}
            onUpdate={(updated) => {
              setMyListings((p) =>
                p.map((l) => (l.id === updated.id ? updated : l)),
              );
              setEditListing(null);
            }}
            onCreate={() => {}}
          />
          </React.Suspense>
        </CarFormModal>
      )}

      {posterCar && (
        <React.Suspense fallback={null}>
          <LoanPosterSheet car={posterCar} seller={profile} onClose={() => setPosterCar(null)} onUpgrade={goPremium} />
        </React.Suspense>
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
