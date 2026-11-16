import React, { useEffect, useState, useRef, useMemo, useCallback, startTransition, Component, Suspense } from "react";
import { useModalHistory } from '../hooks/useModalHistory';
import SuspendedBanner from "../components/SuspendedBanner";
import ReportBugButton from "../components/ReportBugButton";
import ShareMenu from "../components/ShareMenu";
import { cdnImg, imgFallback } from "../utils/img";
import { buildCaption } from "../utils/sharePack";
import { createPortal } from 'react-dom';
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { logActivity } from "../utils/activityLog";
import { isWonDealBlock, offerUndoSale, relistCar } from "../utils/undoSale";
import { suggestCommission, describeCommissionRule } from "../utils/commission";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import { getDealerIdFromProfile } from "../hooks/useProfile";
import {
  readCache,
  writeCache,
  redactProfileForCache,
  rememberPanelUid,
  seedPanelCache,
} from "../utils/panelCache";
import { getStorefrontUrl as buildStorefrontUrl } from "../hooks/useTenant";
import { usePermissions } from "../hooks/usePermissions";
import { isFullAccessRole, tabCapability, TAB_NEEDS_MONEY, ROLE_ENABLED_KEY } from "../lib/permissions";
import { useRoleRedirect } from "../hooks/useRoleRedirect";
import { establishSessionFromHandoff } from "../lib/authHandoff";
import AppLoader from "../components/AppLoader";
import DealerPendingApproval from "../components/DealerPendingApproval";
import { liveChannel } from "../lib/liveChannel";
import { T, iCls, SERVER_URL, getListingAge } from "./dashboard/shared";
import { AgeBadge, Sparkline } from "./dashboard/widgets";
class TabErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || '';
      if (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module')
      ) {
        window.location.reload();
        return null;
      }
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <p className="text-red-400 text-sm font-medium">This tab ran into an error.</p>
          <p className="text-gray-500 text-xs">{this.state.error?.message || "Unknown error"}</p>
          <button onClick={() => this.setState({ error: null })} className="text-xs px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
// Horizontal sub-tab switcher used inside merged tabs (Analytics, Storefront).
const INVENTORY_VIEW_KEY = "xd_inventory_view";
const INVENTORY_TABS = [
  { id: "listings", label: "Listings" },
  { id: "stock",    label: "Stock & costs" },
  { id: "market",   label: "Market demand" },
];
// Sold = what happens after the win: Handover | Customers | Documents, ONE nav
// item (owner, 2026-11-10), same shape as Inventory. Routes stay
// /dashboard/handover, /customers, /documents so every old link keeps working.
const SOLD_VIEW_KEY = "xd_sold_view";
const SOLD_TABS = [
  { id: "handover",  label: "Handover" },
  { id: "customers", label: "Customers" },
  { id: "documents", label: "Documents" },
];
const SOLD_IDS = new Set(SOLD_TABS.map(t => t.id));
function SubTabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 mb-3" style={{ borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '6px 11px', fontSize: 12.5, fontWeight: 500,
            borderBottom: active === t.id ? '2px solid #DC2626' : '2px solid transparent',
            color: active === t.id ? '#DC2626' : '#9AA1AD',
            background: 'none', border: 'none',
            cursor: 'pointer', transition: 'color 0.15s', marginBottom: -1,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
const CarForm          = React.lazy(() => import("../components/CarForm"));
const AddCarForm       = React.lazy(() => import("../components/AddCarForm"));
import VerifyBadgePrompt from "../components/kyc/VerifyBadgePrompt";
const FinancingCalculator = React.lazy(() => import("../components/FinancingCalculator"));
const LeadsPage        = React.lazy(() => import("./LeadsPage"));
const CRMPanel         = React.lazy(() => import("./CRMPanel"));
const HeroSlidesPage   = React.lazy(() => import("./xdrive/HeroSlidesPage"));
const RevOpsPage       = React.lazy(() => import("./RevOpsPage"));
const TikTokStudioV3   = React.lazy(() => import("../components/TikTokStudioV3"));
const ServicesPage     = React.lazy(() => import("./ServicesPage"));
const PerformanceTab   = React.lazy(() => import("../components/PerformanceTab"));
const HPBoard          = React.lazy(() => import("../components/HPBoard"));
const AuditTrail       = React.lazy(() => import("../components/reports/ReportSections").then(m => ({ default: m.AuditTrail })));
const OverviewTab      = React.lazy(() => import("../components/OverviewTab"));
const PostSaleBoard    = React.lazy(() => import("../components/postsale/PostSaleBoard"));
const MarketDemandTab  = React.lazy(() => import("../components/MarketDemandTab"));
const DocumentsTab      = React.lazy(() => import("./dashboard/DocumentsTab"));
import SettingsTab from "./dashboard/settings/SettingsTab";
import useSubscription from "../hooks/useSubscription";
import { isValidMyPhone, MY_PHONE_ERROR } from "../lib/phone";
import PhoneInput from "../components/ui/PhoneInput";
import { getCategoryCfg } from "../utils/serviceCategories";
import OwnerCarPanel from "../components/inventory/OwnerCarPanel";
import CarDetailsPanel, { CarSheetTabs } from "../components/inventory/CarDetailsPanel";
import InterestCell from "../components/inventory/InterestCell";
import CarAnalyticsPanel from "../components/inventory/CarAnalyticsPanel";
import CustomersTab from "../components/crm/CustomersTab";
import useHandover from "../hooks/useHandover";
import AppraisalChecklist from "../components/AppraisalChecklist";
import PushToggle from "../components/PushToggle";
import PushPromptStrip from "../components/chat/PushPromptStrip";
import { getPlanConfig, nextDealerPlan } from "../utils/planConfig";
import { color, border, radius, font } from "../theme/tokens";
import { getListingGaps } from "../utils/listingCompleteness";
import { useDealerSnapshot } from '../hooks/useDealerSnapshot';
import AiManagerCard from './dashboard/AiManagerCard';
import TeamScoreboard, { StatusWord, Avatar as PersonAvatar, personWord, fmtRM } from './dashboard/TeamScoreboard';
import SalesmanHealthSheet from '../components/team/SalesmanHealthSheet';
import { sellerTotals } from '../utils/ownerMoney';
import { useTeamScores } from '../hooks/useTeamScores';
import { usePersistentState } from '../hooks/usePersistentState';
import { premiumLight, premiumLight as PL } from '../theme/tokens';
import { useCarMoney } from '../hooks/useCarMoney';
import '../theme/premiumLight.css';
import ApprovalQueue from "../components/inventory/ApprovalQueue";
import { plWord, plPill } from '../theme/plStatus';
import { InventorySwitch, StatusPills, InvTile, AddCarSheet, AddCarButton, NeedsAttentionMenu, INV_CARD, INV_INPUT, INV_GHOST_BTN, INV_MICRO } from '../components/inventory/InventoryUi';
import { WindowStickerSheet } from '../components/inventory/WindowSticker';
import { BulkBar, BulkPriceSheet } from '../components/inventory/BulkBar';
import { AutoPostButton, AutoPostSheet, useAutoPost } from "../components/autopost/AutoPost";
import { calcMonthly, DEFAULT_EIR } from "../utils/financing";
import { loginUrl } from "../config/site";
import {
  Car,
  PlusCircle,
  LogOut,
  Trash2,
  X,
  TrendingUp,
  DollarSign,
  Menu,
  Building2,
  Clock,
  Users,
  Copy,
  Check,
  UserPlus,
  ToggleLeft,
  ToggleRight,
  Tag,
  Flame,
  BarChart2,
  Send,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
  Phone,
  Pencil,
  Clipboard,
  Search,
  Settings,
  Save,
  Lock,
  Globe,
  Megaphone,
  Facebook,
  Shield,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  Gauge,
  ChevronLeft,
  Calculator,
  Bell,
  Package,
  Banknote,
  Printer,
  CheckSquare,
  Wrench,
  Upload,
  SlidersHorizontal,
  Download,
  ClipboardCheck,
  Mail,
  Film,
  ShieldCheck,
} from "lucide-react";
import ProfileLoadError from "../components/ProfileLoadError";
import TeamBrokersSwitch from "../components/brokers/DealerBrokers";
import { loadBrokerCommission, brokerAmount } from "../lib/brokerCommission";
import { carPnl, daysHeld, AGEING_DAYS } from "../utils/carPnl";

// Cache namespace for the dealer dashboard (keys look like `dash_listings_<uid>`).
// Deliberately keyed on the AUTH uid, not the dealer id: a manager and their
// dealer resolve to the same dealer_id and would otherwise share one cache entry
// on a shared device. A few KB duplicated is the right trade for that.
const PANEL_CACHE_KEY = "dash";

// Which sidebar group owns each tab. Module scope on purpose: this was three
// identical copies in three scopes, so a new tab had to be added to all three
// or its group quietly stopped opening.
// Tabs whose content opens with its own heading (or a sub-tab bar naming it):
// the dashboard's title block is not drawn above them. Analytics > Revenue
// (RevOpsPage) and > Listings (AnalyticsTab) are handled by sub-tab.
const OWN_HEADING_TABS = new Set(["crm", "listings", "stock", "documents", "handover", "customers", "market", "storefront"]);

const TAB_TO_GROUP = {
  overview: "g_reports", analytics: "g_reports",
  crm: "g_sales",       hp: "g_sales",
  listings: "g_inventory", stock: "g_inventory", market: "g_inventory",
  handover: "g_operations", customers: "g_operations", documents: "g_operations",
  outreach: "g_growth", storefront: "g_growth",
  team: "g_admin",
};


// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `

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



// Inline SVG icon for the Hero Carousel sidebar nav item
const HeroCarouselIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </svg>
);

const PROC_SOURCES = ["Auction", "Direct Owner", "Trade-in", "Consignment", "Repossession", "Import", "Other"];
const ENCUMBRANCE_OPTS = [
  { value: "clear",    label: "Clear (no loan)" },
  { value: "under_hp", label: "Under HP / loan" },
  { value: "unknown",  label: "Unknown" },
];

// Cost & procurement tab in the Edit Listing modal — edits the car's private
// stock_unit (purchase/recon/source/encumbrance/B5) that drives P&L, without
// touching the public listing (that's the CarForm tab). Auto-creates the stock
// row if one doesn't exist yet (e.g. legacy/imported listings).
function CostProcurementForm({ listing, dealerId, onClose }) {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    purchase_price: "", recon_cost: "", purchase_date: "", purchase_source: "Auction",
    encumbrance_status: "unknown", puspakom_b5_date: "", notes: "",
  });

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    supabase.from("stock_units").select("*").eq("listing_id", listing.id).maybeSingle()
      .then(({ data }) => {
        if (cancel) return;
        setRow(data || null);
        if (data) setForm({
          purchase_price: data.purchase_price ?? "",
          recon_cost: data.recon_cost ?? "",
          purchase_date: data.purchase_date || "",
          purchase_source: data.purchase_source || "Auction",
          encumbrance_status: data.encumbrance_status || "unknown",
          puspakom_b5_date: data.puspakom_b5_date || "",
          notes: data.notes || "",
        });
        setLoading(false);
      });
    return () => { cancel = true; };
  }, [listing.id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    const payload = {
      purchase_price: Number(form.purchase_price) || 0,
      recon_cost: Number(form.recon_cost) || 0,
      purchase_date: form.purchase_date || null,
      purchase_source: form.purchase_source || null,
      encumbrance_status: form.encumbrance_status,
      puspakom_b5_date: form.puspakom_b5_date || null,
      notes: form.notes || null,
    };
    let error;
    if (row) {
      ({ error } = await supabase.from("stock_units").update(payload).eq("id", row.id));
    } else {
      ({ error } = await supabase.from("stock_units").insert({
        ...payload, listing_id: listing.id, dealer_id: dealerId,
        brand: listing.brand, model: listing.model, year: listing.year,
        status: listing.status === "sold" ? "sold" : "in_stock",
      }));
    }
    setSaving(false);
    if (error) { toast.error("Save failed: " + error.message); return; }
    toast.success("Cost & procurement saved");
    onClose?.();
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center", color: "#6b7280", fontSize: 13 }}>Loading…</div>;

  const costBasis = (Number(form.purchase_price) || 0) + (Number(form.recon_cost) || 0);
  const ask = Number(listing.selling_price) || 0;
  const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 };
  const inp = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, color: "#111827", background: "#fff", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
        These figures stay private and drive your P&amp;L — buyers never see them. Public specs, photos and price are on the Listing details tab.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={lbl}>Purchase price (RM)</label><input type="number" value={form.purchase_price} onChange={set("purchase_price")} placeholder="0" style={inp} /></div>
        <div><label style={lbl}>Recon cost (RM)</label><input type="number" value={form.recon_cost} onChange={set("recon_cost")} placeholder="0" style={inp} /></div>
        <div><label style={lbl}>Purchase date</label><input type="date" value={form.purchase_date} onChange={set("purchase_date")} style={inp} /></div>
        <div><label style={lbl}>Source</label><select value={form.purchase_source} onChange={set("purchase_source")} style={inp}>{PROC_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label style={lbl}>Encumbrance</label><select value={form.encumbrance_status} onChange={set("encumbrance_status")} style={inp}>{ENCUMBRANCE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div><label style={lbl}>Puspakom B5 date</label><input type="date" value={form.puspakom_b5_date} onChange={set("puspakom_b5_date")} style={inp} /></div>
      </div>
      <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={set("notes")} placeholder="Condition notes, seller info…" style={{ ...inp, minHeight: 64, resize: "vertical" }} /></div>
      {costBasis > 0 && (
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", padding: "10px 14px", borderRadius: 10, background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 13 }}>
          <span style={{ color: "#6b7280" }}>Cost basis <strong style={{ color: "#111827" }}>RM {costBasis.toLocaleString()}</strong></span>
          {ask > 0 && <span style={{ color: "#6b7280" }}>Asking <strong style={{ color: "#111827" }}>RM {ask.toLocaleString()}</strong></span>}
          {ask > 0 && <span style={{ color: ask - costBasis >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>Spread RM {(ask - costBasis).toLocaleString()}</span>}
        </div>
      )}
      {!row && <p style={{ fontSize: 12, color: "#b45309", margin: 0 }}>No stock record yet — saving will create one linked to this car.</p>}
      <button onClick={save} disabled={saving} style={{ alignSelf: "flex-start", padding: "10px 20px", borderRadius: 8, background: "#dc2626", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
        {saving ? "Saving…" : "Save cost & procurement"}
      </button>
    </div>
  );
}

function bucketGPByMonth(units, months = 6) {
  const result = Array(months).fill(0);
  const now = new Date();
  units.forEach(u => {
    // stock_units use sold_date (there is no sold_at on stock_units)
    if (!u.sold_date || !u.sold_price) return;
    const d = new Date(u.sold_date);
    const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthsAgo >= 0 && monthsAgo < months) {
      const gp = (u.sold_price || 0) - (u.purchase_price || 0) - (u.recon_cost || 0);
      result[months - 1 - monthsAgo] += gp;
    }
  });
  return result;
}

// ─── PriceEditModal ───────────────────────────────────────────────────────────
function PriceEditModal({ listing, onClose, onSave, profile, dealerId }) {
  useModalHistory(true, onClose);
  const cur = listing.selling_price || 0;
  const orig = listing.original_price || null;
  const [np, setNp] = useState(String(cur));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const npv = parseFloat(np) || 0;
  const ref = orig || cur;
  const disc = ref > npv ? ref - npv : 0;
  const pct = ref > 0 ? (disc / ref) * 100 : 0;
  const isHot = pct >= 3,
    isUp = npv > cur,
    isReset = orig && npv >= orig;

  const handleSave = async () => {
    setErr("");
    if (!npv || npv <= 0) {
      setErr("Enter a valid price");
      return;
    }
    if (npv === cur) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      let payload = { selling_price: npv };
      if (isReset) payload.original_price = null;
      else if (!orig && npv < cur) payload.original_price = cur;
      const { data, error } = await supabase
        .from("car_listings")
        .update(payload)
        .eq("id", listing.id)
        .select();
      if (error) throw error;
      const saved = data?.[0] ?? { ...listing, ...payload };
      logActivity({ dealerId, actor: profile, tableName: 'car_listings', recordId: listing.id, action: 'price_changed', summary: `Price changed from RM ${cur.toLocaleString()} to RM ${npv.toLocaleString()} — ${listing.brand} ${listing.model} ${listing.year}`, fieldChanges: { selling_price: { from: cur, to: npv } } });
      onSave(saved);
      onClose();
    } catch (e) {
      setErr(e.message);
    }
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.78)" }}
    >
      <div
        className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden"
        style={undefined}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={T.divider}
        >
          <div>
            <h3 className="font-semibold text-gray-900">Adjust Price</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {listing.brand} {listing.model} {listing.variant || ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Current price</span>
            <div className="flex items-center gap-2">
              {orig && (
                <span className="text-gray-600 line-through text-xs">
                  RM {orig.toLocaleString()}
                </span>
              )}
              <span className="font-semibold text-gray-900">
                RM {cur.toLocaleString()}
              </span>
              {orig && (
                <span className="text-gray-700 text-xs font-medium pl-well px-2 py-0.5 rounded-full">
                  -{Math.round(((orig - cur) / orig) * 100)}%
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
              New Selling Price (RM)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold pointer-events-none">
                RM
              </span>
              <input
                type="number"
                value={np}
                onChange={(e) => {
                  setNp(e.target.value);
                  setErr("");
                }}
                min="0"
                autoFocus
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 text-lg font-semibold focus:outline-none focus:border-red-400 transition-all"
              />
            </div>
          </div>
          {npv > 0 && npv !== cur && (
            <div
              className={`px-4 py-3 text-sm ${isUp ? "pl-note-bad" : "pl-note"}`}
            >
              {isReset && (
                <p className="font-medium">
                  Price raised — discount badge removed
                </p>
              )}
              {!isReset && isUp && (
                <p className="font-medium">
                  Price raised by RM {(npv - cur).toLocaleString()}
                </p>
              )}
              {!isReset && !isUp && (
                <>
                  <div className="flex items-center gap-2 font-semibold">
                    {isHot && <Flame className="w-4 h-4" />}
                    <span>
                      RM {disc.toLocaleString()} off ({pct.toFixed(1)}%)
                    </span>
                    {isHot && (
                      <span className="text-xs font-normal">Hot Deal!</span>
                    )}
                  </div>
                  <p className="text-xs opacity-70 mt-1">
                    {!orig
                      ? "Original price locked automatically"
                      : "Original stays locked"}
                  </p>
                  {isHot && (
                    <p className="text-xs opacity-70 mt-0.5">
                      Moves to Hot Deals
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {err && (
            <p className="pl-note-bad text-xs px-3 py-2">
              ⚠ {err}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-900 transition-all border border-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !npv || npv <= 0}
              className="btn-shimmer flex-1 flex items-center justify-center gap-2 px-4 py-2.5 disabled:opacity-40 rounded-xl text-sm text-white font-semibold"
              style={T.btnRed}
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Price"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MarkSoldModal ────────────────────────────────────────────────────────────
// Asks for the three things a sale needs and nothing else did: who sold it,
// what it actually sold for, and the commission. Without them 18 of 25 sold cars
// showed RM0 commission and 10 had no salesman, so commission and per-rep gross
// were wrong everywhere they are read. Each field starts from the car's own
// values, so a dealer who already filled them in just confirms.
// One popup for every "mark sold" on the dealer dashboard — the listings grid
// and the Stock tab both open it, so a sale always records who closed it, the
// price it went for and the commission. `showDate` + `cost` are the Stock tab's
// extras (it knows the purchase + recon cost; a margin rule needs it). A stock
// unit with no public listing has nowhere to store a closer or commission, so
// those two fields hide.
function MarkSoldModal({ listing, salesmen = [], onClose, onConfirm, loading, showDate = false, cost = null }) {
  useModalHistory(true, onClose);
  const hasListing = !!listing.id;
  const [soldDate, setSoldDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [soldBy, setSoldBy] = useState(listing.assigned_to || "");
  const [soldPrice, setSoldPrice] = useState(listing.selling_price != null ? String(listing.selling_price) : "");
  const [commission, setCommission] = useState(Number(listing.commission_amount) > 0 ? String(listing.commission_amount) : "");
  // No commission saved on the car -> fill it from the dealer's rule on the
  // price it actually sold for, and keep following that price until someone
  // types their own figure. A figure already on the car is kept as-is.
  const [commissionConfig, setCommissionConfig] = useState(null);
  // Who bought it: an open lead on this car. Picking one makes the sale a real win
  // (customer, handover steps, renewals); "no buyer" is a car sold off the platform.
  const [buyerLeads, setBuyerLeads] = useState([]);
  const [leadId, setLeadId] = useState("");
  useEffect(() => {
    if (!listing.id) return;
    supabase.from("leads").select("id, buyer_name, stage, salesman_id")
      .eq("car_listing_id", listing.id)
      .not("stage", "in", "(won,closed_won,lost,closed_lost)")
      .then(({ data }) => setBuyerLeads(data || []));
  }, [listing.id]);
  useEffect(() => {
    if (!listing.dealer_id) return;
    supabase.from("profiles").select("commission_config").eq("id", listing.dealer_id).maybeSingle()
      .then(({ data }) => setCommissionConfig(data?.commission_config || null));
  }, [listing.dealer_id]);
  const suggestedCommission = hasListing
    ? suggestCommission(commissionConfig, { sell: soldPrice, cost: cost ?? listing.base_price })
    : null;
  const lastAutoCommission = useRef(null);
  useEffect(() => {
    if (suggestedCommission == null) return;
    if (commission !== "" && commission !== lastAutoCommission.current) return;
    const next = String(suggestedCommission);
    lastAutoCommission.current = next;
    setCommission(next);
  }, [suggestedCommission]); // eslint-disable-line react-hooks/exhaustive-deps
  const fieldCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400";
  const labelCls = "block text-xs font-semibold text-gray-600 mb-1";
  const submit = () => onConfirm({
    soldBy: soldBy || null,
    soldPrice: soldPrice === "" ? null : Number(soldPrice),
    commission: commission === "" ? null : Number(commission),
    soldDate: soldDate || null,
    leadId: leadId || null,
  });
  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.78)" }}
    >
      <div
        className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md"
        style={undefined}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Mark as Sold?</h3>
            <p className="text-gray-500 text-xs mt-0.5">
              {listing.brand} {listing.model} {listing.variant || ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 mb-5">
          {hasListing && <div>
            <label className={labelCls}>Who bought it?</label>
            <select value={leadId} onChange={(e) => {
              setLeadId(e.target.value);
              const l = buyerLeads.find((x) => x.id === e.target.value);
              if (l?.salesman_id && !soldBy) setSoldBy(l.salesman_id);
            }} className={fieldCls}>
              <option value="">No buyer on file (sold elsewhere or walk-in)</option>
              {buyerLeads.map((l) => (
                <option key={l.id} value={l.id}>{l.buyer_name || "Unnamed buyer"} ({l.stage})</option>
              ))}
            </select>
            {!leadId && <p className="text-[11px] text-gray-500 mt-1">With no buyer, no customer record or handover steps are made.</p>}
          </div>}
          {hasListing && <div>
            <label className={labelCls}>Sold by</label>
            <select value={soldBy} onChange={(e) => setSoldBy(e.target.value)} className={fieldCls}>
              <option value="">No salesman (sold by the dealership)</option>
              {salesmen.map((sm) => (
                <option key={sm.id} value={sm.id}>{sm.full_name || sm.email || "Salesman"}</option>
              ))}
            </select>
          </div>}
          <div className={hasListing ? "grid grid-cols-2 gap-3" : ""}>
            <div>
              <label className={labelCls}>Sold for (RM)</label>
              <input type="number" inputMode="numeric" min="0" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} className={fieldCls} />
            </div>
            {hasListing && <div>
              <label className={labelCls}>Commission (RM)</label>
              <input type="number" inputMode="numeric" min="0" value={commission} placeholder="Not set" onChange={(e) => setCommission(e.target.value)} className={fieldCls} />
              {suggestedCommission != null && commission === String(suggestedCommission) && (
                <p className="text-[11px] text-gray-500 mt-1">From your rule ({describeCommissionRule(commissionConfig)})</p>
              )}
            </div>}
          </div>
          {showDate && (
            <div>
              <label className={labelCls}>Sold on</label>
              <input type="date" value={soldDate} onChange={(e) => setSoldDate(e.target.value)} className={fieldCls} />
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-900 transition-all border border-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="btn-shimmer flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg,#16a34a,#15803d)",
              boxShadow: "0 2px 10px rgba(22,163,74,0.3)",
            }}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Marking…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirm Sold
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TeamTab ──────────────────────────────────────────────────────────────────
function lastActiveText(ts) {
  if (!ts) return 'No activity yet';
  const mins = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  const d = Math.floor(mins / 1440);
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d}d ago`;
  return '30d+ ago';
}

// One wording for every refusal the invites / create-salesman functions send back.
function staffAddError(data) {
  switch (data?.error) {
    case "email_taken": return "That email already has an account.";
    case "seat_cap": return `Seat limit reached (${data.current}/${data.cap}). Upgrade your plan to add more team members.`;
    case "not_allowed": return "The owner has not let managers add staff.";
    case "manager_role_limit": return "Managers can add salesmen and admins only.";
    case "manager_role_off": return "This dealership has no manager role. Switch it on in Settings > Team first.";
    case "email_failed": return "The setup email could not be sent, so nothing was created. Try again.";
    default: return data?.message || data?.error || "Could not create the account.";
  }
}

export function TeamTab({ managerDealership, dealerId, profile }) {
  // Who may add staff: the owner always; a manager only with the owner's "Add staff" switch, and
  // then only salesmen and admins, with no password (they set their own from the email). The
  // invites / create-salesman functions enforce the same rules on the server.
  const isOwnerTeam = ["dealer", "owner", "superadmin"].includes(profile?.role);
  const { can: teamCan } = usePermissions(profile);
  const canAddStaff = isOwnerTeam || (profile?.role === "manager" && teamCan("add_staff"));
  // How each salesman is doing: the database's one judgement (_team_health). Feeds the table at
  // the top AND the status word on each card, so they can never disagree.
  const { scores: teamScores, byId: scoreById, loading: scoresLoading } = useTeamScores(dealerId);
  const showTeamMoney = teamCan("view_gross");
  // Persisted (IC material stripped) so the roster paints instantly; the
  // fetch below still replaces it. "loadingTeam" = nothing to show yet.
  const [salespeople, setSalespeople, teamCached] = usePersistentState(
    dealerId ? `team:${dealerId}` : null, [], { redact: (rows) => (rows || []).map(redactProfileForCache) },
  );
  const [teamFetching, setLoadingTeam] = useState(true);
  const loadingTeam = teamFetching && !teamCached;
  const [teamError, setTeamError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  useModalHistory(showAddForm, () => setShowAddForm(false), { isDirty: () => true });
  // "Do you have a manager?" = No (Settings > Team) takes Manager out of the add-staff choices.
  const [managerOn, setManagerOn] = useState(true);
  useEffect(() => {
    if (!dealerId) return;
    supabase.from('role_permissions').select('permissions').eq('dealer_id', dealerId).eq('role', 'manager').maybeSingle()
      .then(({ data }) => setManagerOn(data?.permissions?.[ROLE_ENABLED_KEY] !== false));
  }, [dealerId]);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [copiedPw, setCopiedPw] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  useModalHistory(!!deleteConfirmId, () => setDeleteConfirmId(null));
  const [newRole, setNewRole] = useState("salesman");
  const [openPersonId, setOpenPersonId] = useState(null); // whose sheet is open (Team > People)
  const [msgOpen, setMsgOpen] = useState(false);           // Message pop-up
  useModalHistory(msgOpen, () => setMsgOpen(false));
  useEffect(() => {
    if (!msgOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [msgOpen]);
  const [msgTarget, setMsgTarget] = useState('all');
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [msgDone, setMsgDone] = useState(false);
  const msgDoneTimer = useRef(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [slug, setSlug] = useState("");
  const [tempPw, setTempPw] = useState("");
  const [createdAccount, setCreatedAccount] = useState(null); // one-time password modal
  useModalHistory(!!createdAccount, () => setCreatedAccount(null));
  const [resendingId, setResendingId] = useState(null); // salesman id whose setup email is resending
  const [analyticsMap, setAnalyticsMap] = useState({});
  const [soldMap, setSoldMap] = useState({});
  const [lastActivityMap, setLastActivityMap] = useState({});
  const [activityCountMap, setActivityCountMap] = useState({});
  const [commissionApproveTarget, setCommissionApproveTarget] = useState(null); // salesman id
  useModalHistory(!!commissionApproveTarget, () => setCommissionApproveTarget(null));
  const [commissionPayTarget, setCommissionPayTarget] = useState(null);
  useModalHistory(!!commissionPayTarget, () => setCommissionPayTarget(null));
  const [commissionWorking, setCommissionWorking] = useState(false);
  const [assignedMap, setAssignedMap] = useState({}); // salesmanId -> [cars locked to them]
  const [openCars, setOpenCars] = useState([]);        // unassigned, unsold cars (assignable pool)
  const [assignPickerFor, setAssignPickerFor] = useState(null); // salesman id whose picker is open
  const [assignWorking, setAssignWorking] = useState(null);     // listing id mid-mutation

  const fetchAnalytics = async () => {
    if (!dealerId) return;
    const { data } = await supabase.rpc("get_dealer_slug_analytics", { p_dealer_id: dealerId, p_days: 30 }) // 30: the table says "last 30 days" (default is 90);
    if (!data) return;
    const map = {};
    data.forEach(({ slug, clicks, whatsapp }) => {
      if (slug) map[slug] = { clicks: Number(clicks) || 0, whatsapp: Number(whatsapp) || 0 };
    });
    setAnalyticsMap(map);
  };

  const fetchSoldPerSalesman = async () => {
    if (!dealerId) return;
    const { data, error } = await supabase
      .from("car_listings")
      // Cost comes from the stock record: a dealer car's listing holds no cost
      // (20261109f, batch 4 — salesmen can read listings, not stock).
      .select("assigned_to, commission_amount, commission_status, sold_price, selling_price, included_services_cost, stock_units(purchase_price, recon_cost)")
      .eq("dealer_id", dealerId)
      .eq("status", "sold")
      .not("assigned_to", "is", null);
    // This select once named a column that does not exist ("price"); PostgREST
    // rejected the whole query and every salesman showed 0 sold / RM0. Say so.
    if (error) { console.error("[TeamTab] sold per salesman:", error.message); return; }
    if (!data) return;
    const map = {};
    data.forEach((row) => {
      const { assigned_to, commission_amount, commission_status } = row;
      if (!map[assigned_to]) map[assigned_to] = { sold: 0, commission: 0, pending: 0, approved: 0, paid: 0, gross: 0 };
      map[assigned_to].sold += 1;
      const amt = Number(commission_amount) || 0;
      map[assigned_to].commission += amt;
      const cs = commission_status || 'pending';
      map[assigned_to][cs] = (map[assigned_to][cs] || 0) + amt;
      // Front gross per unit: sale - cost - recon - included services - commission.
      // Only counted when the stock record has a cost, so units with zero cost
      // don't show "full sale = profit".
      const su = Array.isArray(row.stock_units) ? row.stock_units[0] : row.stock_units;
      const cost = Number(su?.purchase_price) || 0;
      if (cost > 0) {
        const sale = Number(row.sold_price ?? row.selling_price) || 0;
        map[assigned_to].gross += sale - cost - (Number(su?.recon_cost) || 0) - (Number(row.included_services_cost) || 0) - amt;
      }
    });
    setSoldMap(map);
  };

  // Real activity per team member. This read activity_log alone, which only
  // THIS dashboard writes — nothing a salesman does lands there, so every
  // salesman older than 30 days showed "Inactive 30d+" however hard they worked.
  // get_team_activity also counts lead_activities (stage moves, calls,
  // WhatsApps, notes, claims) and seller chat replies. Counts only. Used for the NON-salesman
  // roles' cards; salesmen are judged by _team_health (useTeamScores).
  const fetchLastActivity = async () => {
    if (!dealerId) return;
    const { data, error } = await supabase.rpc('get_team_activity', { p_dealer_id: dealerId });
    if (error) { console.error('[TeamTab] team activity:', error.message); return; }
    const map = {};
    const counts = {};
    (data || []).forEach((r) => {
      map[r.user_id] = r.last_active_at;
      counts[r.user_id] = r.actions_30d || 0;
    });
    setLastActivityMap(map);
    setActivityCountMap(counts);
  };

  // Assigned-cars (exclusivity lock) per salesman. Sold units keep assigned_to as
  // the closer, but "responsibility" only means live inventory, so sold is excluded.
  const fetchAssignedCars = async () => {
    if (!dealerId) return;
    const { data } = await supabase
      .from("car_listings")
      .select("id, brand, model, year, status, assigned_to")
      .eq("dealer_id", dealerId)
      .neq("status", "sold");
    if (!data) return;
    const map = {};
    const open = [];
    data.forEach((c) => {
      if (c.assigned_to) (map[c.assigned_to] ||= []).push(c);
      else open.push(c);
    });
    const byName = (a, b) =>
      (a.brand || "").localeCompare(b.brand || "") || (a.model || "").localeCompare(b.model || "");
    Object.values(map).forEach((arr) => arr.sort(byName));
    open.sort(byName);
    setAssignedMap(map);
    setOpenCars(open);
  };

  // Mirror of the dealer-dash handleAssign exclusivity rule: locking a car to a rep
  // evicts every OTHER salesman's salesman_listings feature of it (retroactive lock).
  const handleAssignCar = async (listingId, salesmanId, name) => {
    setAssignWorking(listingId);
    const car = openCars.find((c) => c.id === listingId);
    // A refused write is "0 rows, no error": check a row came back before evicting anyone.
    const { data: saved, error } = await supabase
      .from("car_listings")
      .update({ assigned_to: salesmanId })
      .eq("id", listingId)
      .select("id");
    if (error || !saved?.length) toast.error("Could not assign. Try again.");
    else {
      await supabase.from("salesman_listings").delete()
        .eq("listing_id", listingId).neq("salesman_id", salesmanId);
      logActivity({ dealerId, actor: profile, tableName: 'car_listings', recordId: listingId, action: 'assigned', summary: `Assigned to ${name} — ${car?.brand || ''} ${car?.model || ''} ${car?.year || ''}`.trim(), fieldChanges: { assigned_to: { to: name } } });
      await fetchAssignedCars();
    }
    setAssignWorking(null);
    setAssignPickerFor(null);
  };

  const handleUnassignCar = async (listingId) => {
    setAssignWorking(listingId);
    const car = Object.values(assignedMap).flat().find((c) => c.id === listingId);
    const { data: saved, error } = await supabase
      .from("car_listings")
      .update({ assigned_to: null })
      .eq("id", listingId)
      .select("id");
    if (error || !saved?.length) toast.error("Could not unassign. Try again.");
    else {
      logActivity({ dealerId, actor: profile, tableName: 'car_listings', recordId: listingId, action: 'unassigned', summary: `Unassigned — ${car?.brand || ''} ${car?.model || ''} ${car?.year || ''}`.trim() });
      await fetchAssignedCars();
    }
    setAssignWorking(null);
  };

  const handleApproveCommission = async (salesmanId) => {
    setCommissionWorking(true);
    const { error } = await supabase
      .from('car_listings')
      .update({ commission_status: 'approved' })
      .eq('dealer_id', dealerId)
      .eq('assigned_to', salesmanId)
      .eq('status', 'sold')
      .eq('commission_status', 'pending');
    if (!error) {
      const s = salespeople.find(x => x.id === salesmanId);
      logActivity({ dealerId, actor: profile, tableName: 'car_listings', recordId: salesmanId, action: 'commission_approved', summary: `Commission payout approved for ${s?.full_name || salesmanId} — RM ${(soldMap[salesmanId]?.pending || 0).toLocaleString()}` });
      await fetchSoldPerSalesman();
    }
    setCommissionApproveTarget(null);
    setCommissionWorking(false);
  };

  const handleMarkCommissionPaid = async (salesmanId) => {
    setCommissionWorking(true);
    const { error } = await supabase
      .from('car_listings')
      .update({ commission_status: 'paid' })
      .eq('dealer_id', dealerId)
      .eq('assigned_to', salesmanId)
      .eq('status', 'sold')
      .eq('commission_status', 'approved');
    if (!error) {
      const s = salespeople.find(x => x.id === salesmanId);
      logActivity({ dealerId, actor: profile, tableName: 'car_listings', recordId: salesmanId, action: 'commission_paid', summary: `Commission marked as paid for ${s?.full_name || salesmanId} — RM ${(soldMap[salesmanId]?.approved || 0).toLocaleString()}` });
      await fetchSoldPerSalesman();
    }
    setCommissionPayTarget(null);
    setCommissionWorking(false);
  };

  useEffect(() => {
    fetchTeam();
    fetchAnalytics();
    fetchSoldPerSalesman();
    fetchLastActivity();
    fetchAssignedCars();
  }, [managerDealership, dealerId]); // dealerId must be here — fetchSold* guard on it


  const fetchTeam = async () => {
    if (!managerDealership) {
      setSalespeople([]);
      setTeamError("Dealership profile missing.");
      setLoadingTeam(false);
      return;
    }
    setLoadingTeam(true);
    setTeamError("");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["salesman","manager","accountant","fi_officer","admin"])
      .eq("dealer_id", dealerId)
      .order("created_at", { ascending: false });
    if (error) {
      setTeamError(error.message || "Failed to load team.");
      // Keep the cached roster on screen; the error line explains it is stale.
    } else setSalespeople(data || []);
    setLoadingTeam(false);
  };

  const slugify = (v) =>
    v
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");
  const handleNameChange = (v) => {
    setName(v);
    setSlug(slugify(v.trim().split(/\s+/)[0]));
  };
  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setSlug("");
    setTempPw("");
    setAddError("");
    setAddSuccess("");
    setNewRole("salesman");
  };

  const handleAdd = async () => {
    setAddError("");
    if (!canAddStaff) { setAddError("Only the owner can add staff."); return; }
    if (!isOwnerTeam && !["salesman", "admin"].includes(newRole)) { setAddError("You can add salesmen and admins only."); return; }
    const n = name.trim(),
      e = email.trim().toLowerCase(),
      s = slug.trim(),
      p = phone.trim() || null;
    if (!managerDealership) {
      setAddError("Dealership required.");
      return;
    }
    const isSalesman = newRole === "salesman";
    if (!n || !e || !s || (!isSalesman && isOwnerTeam && !tempPw)) {
      setAddError("All fields required.");
      return;
    }
    if (p && !isValidMyPhone(p)) {
      setAddError(MY_PHONE_ERROR);
      return;
    }
    if (!isSalesman && isOwnerTeam && tempPw.length < 8) {
      setAddError("Password min 8 chars.");
      return;
    }
    if (!/^[a-z0-9]+$/.test(s)) {
      setAddError("Slug: lowercase + numbers only.");
      return;
    }
    setAddLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Check seat cap before creating
      const { data: capCheck } = await supabase.rpc('check_seat_cap', { p_dealer_id: dealerId });
      if (capCheck && !capCheck.allowed) {
        setAddError(`Seat limit reached (${capCheck.current}/${capCheck.cap}). Upgrade your plan to add more team members.`);
        setAddLoading(false);
        return;
      }

      if (isSalesman) {
        // Auth-first salesman creation via edge function
        const res = await fetch(`${SERVER_URL}/create-salesman`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: e,
            full_name: n,
            phone: p,
            slug: s,
            dealer_id: dealerId,
            plan: "salesman_full",
            link: "set_password",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAddError(staffAddError(data));
          setAddLoading(false);
          return;
        }
        setShowAddForm(false);
        setCreatedAccount({ full_name: n, email: e, temp_password: data.temp_password, email_sent: data.email_sent, role: 'salesman' });
        await fetchTeam();
        resetForm();
      } else {
        // Non-salesman roles use existing invites function
        const res = await fetch(`${SERVER_URL}/invites`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            full_name: n,
            email: e,
            phone: p,
            dealership: managerDealership,
            dealer_id: dealerId,
            slug: s,
            password: isOwnerTeam ? tempPw : undefined,
            role: newRole,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAddError(staffAddError(data));
          setAddLoading(false);
          return;
        }
        setShowAddForm(false);
        // Same confirmation modal as salesman: shows "email sent" when the
        // invites function emailed a setup link, else the temp password to relay.
        setCreatedAccount({ full_name: n, email: e, temp_password: data.temp_password, email_sent: data.email_sent, role: newRole });
        setSalespeople((prev) => [data.invite, ...prev]);
        resetForm();
      }
    } catch {
      setAddError("Server unreachable.");
    }
    setAddLoading(false);
  };

  const copyLink = (s) => {
    navigator.clipboard.writeText(
      `${window.location.origin}/cars?ref=${s.slug}`,
    );
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const toggleActive = async (s) => {
    // Switching staff on or off is the owner's (owner-only list, Settings > Team).
    if (!["dealer", "owner", "superadmin"].includes(profile?.role)) { toast.error("Only the owner can do this."); return; }
    setTogglingId(s.id);
    const { data: saved, error } = await supabase
      .from("profiles")
      .update({ is_active: !s.is_active })
      .eq("id", s.id)
      .select("id");
    if (error || !saved?.length) toast.error("Could not save. Try again.");
    else
      setSalespeople((p) =>
        p.map((x) => (x.id === s.id ? { ...x, is_active: !s.is_active } : x)),
      );
    setTogglingId(null);
  };
  const deleteSalesman = async (id) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(`${SERVER_URL}/invites/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) setSalespeople((p) => p.filter((x) => x.id !== id));
    setDeleteConfirmId(null);
  };
  // Re-send the account-setup email to a salesman who hasn't finished onboarding.
  // The recovery link in the original email expires, so this regenerates a fresh
  // one via create-salesman's resend_setup action (no new account is created).
  const resendSetup = async (s) => {
    setResendingId(s.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SERVER_URL}/create-salesman`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: "resend_setup", email: s.email, link: "set_password" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.email_sent) toast.success(`Setup email resent to ${s.email}`);
      else if (res.ok) toast.error("Couldn't send the email — check the email address or try again.");
      else toast.error(data.error === "not_found" ? "Account not found." : "Resend failed.");
    } catch {
      toast.error("Server unreachable. Try again.");
    }
    setResendingId(null);
  };

  // A car sold, assigned or unassigned anywhere in the dealership refreshes the commission and
  // locked-car lists live (the all-time "cars sold" count that also lived here went with its tile).
  useEffect(() => {
    if (!managerDealership || !dealerId) return undefined;
    const ch = liveChannel(supabase, "team_sold")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "car_listings", filter: `dealer_id=eq.${dealerId}` },
        () => { fetchSoldPerSalesman(); fetchAssignedCars(); },
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [managerDealership, dealerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Team > People, 2026-11-16 design pass ──────────────────────────────────────────────
  const STAFF_ROLE_LABEL = { manager: 'Manager', admin: 'Admin', accountant: 'Accountant', fi_officer: 'F&I officer' };
  const teamSalesmen = salespeople.filter((p) => p.role === 'salesman');
  const teamOthers = salespeople.filter((p) => p.role !== 'salesman');
  const teamNeedLook = teamSalesmen.filter((p) => !p.setup_complete
    || (p.is_active !== false && (scoreById[p.id]?.issues || []).length > 0)).length;
  // Profit per salesman = Overview's engine grouped by seller, last 30 days, only with the money switch.
  const { money: teamMoney } = useCarMoney(showTeamMoney ? dealerId : null);
  const teamProfitBy = useMemo(() => (showTeamMoney && teamMoney
    ? sellerTotals(teamMoney.rows, Date.now() - 30 * 86400000, Date.now() + 1) : null), [showTeamMoney, teamMoney]);
  const openPerson = openPersonId ? salespeople.find((p) => p.id === openPersonId) || null : null;
  const isOwnerTeamRole = ["dealer", "owner", "superadmin"].includes(profile?.role);
  const canPayCommission = isOwnerTeamRole || profile?.role === 'manager';
  const canAssignCars = ['owner', 'dealer', 'superadmin', 'manager'].includes(profile?.role);
  // A tool that opens a confirm closes the sheet first (overlay rule 3).
  const closeAndRun = (fn) => () => { setOpenPersonId(null); fn(); };
  const TOOL = { background: PL.card, borderRadius: 16, boxShadow: PL.shadow, padding: '12px 14px' };
  const MICRO = { fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: PL.textMuted, fontWeight: 600, marginBottom: 8 };
  const greyBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 12.5 };
  const redBtn = { ...greyBtn, fontWeight: 600, color: '#fff', background: PL.accent, border: 'none', borderRadius: 10, cursor: 'pointer' };

  const renderPersonTools = (s) => {
    const sold = soldMap[s.id] || {};
    const cars = assignedMap[s.id] || [];
    return (
      <>
        {s.role === 'salesman' && !s.setup_complete && (
          <section>
            <div style={MICRO}>Setup</div>
            <div style={TOOL}>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: PL.text }}>
                <b>{s.email}</b> has not finished setting up their account. The setup link expires, so send a new one.
              </p>
              <button type="button" onClick={() => resendSetup(s)} disabled={resendingId === s.id} style={{ ...redBtn, opacity: resendingId === s.id ? 0.5 : 1 }}>
                <Mail style={{ width: 14, height: 14 }} /> {resendingId === s.id ? 'Sending...' : 'Resend setup email'}
              </button>
            </div>
          </section>
        )}

        {s.role === 'salesman' && sold.commission > 0 && (
          <section>
            <div style={MICRO}>Commission</div>
            <div style={TOOL}>
              {[['pending', 'Waiting for your approval'], ['approved', 'Approved, not paid yet'], ['paid', 'Paid']].map(([k, label]) => (sold[k] > 0 ? (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '3px 0' }}>
                  <span style={{ color: PL.textSec }}>{label}</span>
                  <b style={{ color: PL.text, fontVariantNumeric: 'tabular-nums' }}>{fmtRM(sold[k])}</b>
                </div>
              ) : null))}
              {canPayCommission && (sold.pending > 0 || sold.approved > 0) && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {sold.pending > 0 && <button type="button" style={redBtn} onClick={closeAndRun(() => setCommissionApproveTarget(s.id))}>Approve payout</button>}
                  {sold.approved > 0 && <button type="button" className="pl-btn-grey" style={greyBtn} onClick={closeAndRun(() => setCommissionPayTarget(s.id))}>Mark paid</button>}
                </div>
              )}
            </div>
          </section>
        )}

        {s.role === 'salesman' && (
          <section>
            <div style={MICRO}>Cars only {s.full_name?.split(' ')[0] || 'they'} can sell ({cars.length})</div>
            <div style={TOOL}>
              {cars.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {cars.map((c) => (
                    <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: PL.text, background: PL.raised, borderRadius: 8, padding: '5px 9px' }}>
                      <Lock style={{ width: 11, height: 11, color: PL.textMuted }} />
                      {c.brand} {c.model}{c.year ? ` · ${c.year}` : ''}
                      {c.status === 'reserved' && <span style={{ fontSize: 10, fontWeight: 700, color: PL.textSec }}>Reserved</span>}
                      {canAssignCars && (
                        <button type="button" onClick={() => handleUnassignCar(c.id)} disabled={assignWorking === c.id} title="Unassign" aria-label="Unassign"
                          style={{ display: 'inline-flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: PL.textMuted, opacity: assignWorking === c.id ? 0.4 : 1 }}>
                          <X style={{ width: 12, height: 12 }} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: PL.textMuted }}>None. Any salesman can sell any car, and whoever wins the buyer earns it.</p>
              )}
              {canAssignCars && (
                <button type="button" className="pl-btn-grey" style={{ ...greyBtn, marginTop: 10 }} onClick={() => setAssignPickerFor(assignPickerFor === s.id ? null : s.id)}>
                  <PlusCircle style={{ width: 14, height: 14 }} /> {assignPickerFor === s.id ? 'Close' : 'Lock a car to them'}
                </button>
              )}
              {canAssignCars && assignPickerFor === s.id && (
                <div style={{ marginTop: 8, borderRadius: 10, maxHeight: 200, overflowY: 'auto', background: PL.raised }}>
                  {openCars.length === 0 ? (
                    <p style={{ fontSize: 12, color: PL.textMuted, padding: '10px 12px', margin: 0 }}>No open cars to lock.</p>
                  ) : openCars.map((c, i) => (
                    <button type="button" key={c.id} onClick={() => handleAssignCar(c.id, s.id, s.full_name)} disabled={assignWorking === c.id}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'none', border: 'none', borderTop: i ? `1px solid ${PL.line}` : 'none', color: PL.text, fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}>
                      <Car style={{ width: 13, height: 13, color: PL.textMuted, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.brand} {c.model}{c.year ? ` · ${c.year}` : ''}</span>
                      {c.status === 'reserved' && <span style={{ fontSize: 10, fontWeight: 700, color: PL.textSec }}>Reserved</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {s.role === 'salesman' && s.slug && (
          <section>
            <div style={MICRO}>Their link</div>
            <div style={{ ...TOOL, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: PL.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                /cars?ref=<b style={{ color: PL.text }}>{s.slug}</b>
              </span>
              <button type="button" className="pl-btn-grey" style={greyBtn} onClick={() => copyLink(s)}>
                {copiedId === s.id ? <><Check style={{ width: 14, height: 14 }} /> Copied</> : <><Copy style={{ width: 14, height: 14 }} /> Copy</>}
              </button>
            </div>
          </section>
        )}

        {s.role !== 'salesman' && (
          <section>
            <div style={MICRO}>Last 30 days</div>
            <div style={{ ...TOOL, fontSize: 13, color: PL.textSec }}>
              <b style={{ color: PL.text }}>{activityCountMap[s.id] || 0}</b> actions in the dashboard
            </div>
          </section>
        )}

        {isOwnerTeamRole && (
          <section>
            <div style={MICRO}>Account</div>
            <div style={{ ...TOOL, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(s.role !== 'salesman' || s.setup_complete) && (
                <button type="button" className="pl-btn-grey" style={greyBtn} onClick={() => toggleActive(s)} disabled={togglingId === s.id}>
                  {s.is_active !== false ? <><ToggleRight style={{ width: 14, height: 14 }} /> Switch off</> : <><ToggleLeft style={{ width: 14, height: 14 }} /> Switch on</>}
                </button>
              )}
              <button type="button" className="pl-btn-grey" style={{ ...greyBtn, color: PL.accentText }} onClick={closeAndRun(() => setDeleteConfirmId(s.id))}>
                <Trash2 style={{ width: 14, height: 14 }} /> Remove
              </button>
            </div>
          </section>
        )}
      </>
    );
  };

  const inputCls =
    "w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 transition-all";

  return (
    <div className="space-y-4">
      {/* Top line (2026-11-16 design pass): who is on the team, who needs a look, and the two
          actions. Replaced the all-time "cars sold" tile (Overview has it), the "Salespeople" card
          header and the role tabs. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, flex: '1 1 160px', minWidth: 0, fontSize: 14, color: PL.textSec }}>
          <b style={{ color: PL.text }}>{teamSalesmen.length}</b> salesm{teamSalesmen.length === 1 ? 'an' : 'en'}
          {teamNeedLook > 0 && <> · <b style={{ color: PL.accentText }}>{teamNeedLook} need{teamNeedLook === 1 ? 's' : ''} a look</b></>}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="pl-btn-grey" onClick={() => setMsgOpen(true)} disabled={salespeople.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', fontSize: 13 }}>
          <Send style={{ width: 14, height: 14 }} /> Message
        </button>
        <button type="button" onClick={() => { setShowAddForm(true); resetForm(); }}
          disabled={!managerDealership || !canAddStaff}
          title={canAddStaff ? undefined : "Only the owner can add staff"}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', fontSize: 13, fontWeight: 600, color: '#fff', background: PL.accent, border: 'none', borderRadius: 10, cursor: 'pointer', opacity: !managerDealership || !canAddStaff ? 0.4 : 1 }}>
          <UserPlus style={{ width: 14, height: 14 }} /> Add staff
        </button>
        </div>
      </div>
      {teamError && <div className="pl-note-bad" style={{ padding: '10px 14px', borderRadius: 12, fontSize: 12 }}>{teamError}</div>}

      <section style={{ background: PL.card, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: '6px 0' }}>
        {loadingTeam ? (
          <p style={{ fontSize: 13, color: PL.textMuted, padding: '18px 16px', margin: 0 }}>Loading team...</p>
        ) : (
          <TeamScoreboard
            salesmen={teamSalesmen}
            scoreById={scoreById}
            loading={scoresLoading}
            profitBy={teamProfitBy}
            soldMap={soldMap}
            onOpen={(p) => setOpenPersonId(p.id)}
          />
        )}
        <p style={{ fontSize: 11.5, color: PL.textMuted, margin: '4px 16px 10px' }}>
          Last 30 days, counting only what each salesman did themselves. Tap a name for details and tools.
        </p>
      </section>

      {teamOthers.length > 0 && (
        <section>
          <p style={{ fontSize: 11, fontWeight: 700, color: PL.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '6px 4px 8px' }}>Other staff</p>
          <div style={{ background: PL.card, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: 4 }}>
            {teamOthers.map((s, i) => {
              const w = personWord(s);
              return (
                <div key={s.id} role="button" tabIndex={0} className="tsb-srow"
                  onClick={() => setOpenPersonId(s.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenPersonId(s.id); } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderBottom: i < teamOthers.length - 1 ? `1px solid ${PL.line}` : 'none', cursor: 'pointer', borderRadius: 12, opacity: s.is_active === false ? 0.6 : 1 }}>
                  <PersonAvatar person={s} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: PL.text }}>{s.full_name}</span>
                      {w.label && <StatusWord status={w.status} label={w.label} />}
                    </div>
                    <div style={{ fontSize: 12, color: PL.textMuted, marginTop: 1 }}>{STAFF_ROLE_LABEL[s.role] || 'Staff'} · Last active {lastActiveText(lastActivityMap[s.id])}</div>
                  </div>
                  <ChevronRight style={{ width: 16, height: 16, color: PL.textMuted, flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {openPerson && (
        <SalesmanHealthSheet
          person={openPerson.role === 'salesman'
            ? { ...(scoreById[openPerson.id] || {}), name: openPerson.full_name, avatar_url: openPerson.avatar_url }
            : { name: openPerson.full_name, avatar_url: openPerson.avatar_url }}
          staff={openPerson.role !== 'salesman' || !scoreById[openPerson.id]}
          word={personWord(openPerson, scoreById[openPerson.id]).label}
          subtitle={openPerson.role === 'salesman'
            ? (scoreById[openPerson.id] ? undefined : `Last active ${lastActiveText(lastActivityMap[openPerson.id])}`)
            : `${STAFF_ROLE_LABEL[openPerson.role] || 'Staff'} · Last active ${lastActiveText(lastActivityMap[openPerson.id])}`}
          onClose={() => setOpenPersonId(null)}
        >
          {renderPersonTools(openPerson)}
        </SalesmanHealthSheet>
      )}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md"
            style={undefined}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">Remove Salesman?</h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  Deletes their account and referral link permanently.
                </p>
              </div>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="text-gray-500 hover:text-gray-900 p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-900 transition-all border border-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteSalesman(deleteConfirmId)}
                className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                style={T.btnRed}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── One-time Password Modal ── */}
      {createdAccount && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md relative"
            style={{ background: "#fff", border: "1px solid #e5e7eb" }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: '#f5f6f8' }}
                >
                  <Check className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {({ salesman: 'Salesman', manager: 'Manager', admin: 'Admin', accountant: 'Accountant', fi_officer: 'F&I Officer' }[createdAccount.role] || 'Team member')} Added
                  </h3>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {createdAccount.email_sent
                      ? "Setup email sent"
                      : "Email couldn't be sent — share credentials"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreatedAccount(null)}
                className="text-gray-500 hover:text-gray-900 p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdAccount.email_sent ? (
              /* Happy path: setup link emailed — no password to relay. */
              <>
                <div
                  className="rounded-xl px-4 py-4 mb-4 text-center"
                  style={{ background: '#f5f6f8' }}
                >
                  <Mail className="w-7 h-7 text-emerald-600 mx-auto mb-2.5" />
                  <p className="text-gray-900 text-sm font-semibold mb-1">Email sent to {createdAccount.full_name}</p>
                  <p className="text-emerald-700 text-xs leading-relaxed">
                    We emailed <span className="font-semibold">{createdAccount.email}</span> a link to set their password and finish setup. Tell them to check their inbox (and spam) to activate their account.
                  </p>
                </div>
              </>
            ) : (
              /* Fallback: email delivery failed — fall back to sharing the temp
                 password so the salesman is never stranded. */
              <>
                <div
                  className="rounded-xl px-3.5 py-2.5 mb-4 flex items-start gap-2.5"
                  style={{ background: '#f5f6f8' }}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-700 text-xs leading-relaxed">
                    We couldn't send the setup email. Share this temporary password with <span className="font-semibold">{createdAccount.email}</span> — it <span className="font-semibold text-amber-800">won't be shown again</span>. They can change it from Settings after signing in.
                  </p>
                </div>
                <div className="rounded-xl px-3.5 py-3 mb-4" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Temporary Password</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdAccount.temp_password);
                        setCopiedPw(true);
                        setTimeout(() => setCopiedPw(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-all"
                      style={copiedPw
                        ? { color: "#34d399", background: '#f5f6f8' }
                        : { color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb" }}
                    >
                      {copiedPw ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                  </div>
                  <p className="text-gray-900 text-base font-mono font-bold tracking-widest">{createdAccount.temp_password}</p>
                </div>
              </>
            )}

            <button
              onClick={() => setCreatedAccount(null)}
              className="btn-shimmer w-full px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
              style={T.btnRed}
            >
              Done
            </button>
          </div>
        </div>
      )}
      {/* ── Message Team Panel ── */}
      {(() => {
        const MSG_ROLES = [
          { value: 'all',        label: 'Everyone',    color: '#111827' },
          { value: 'salesman',   label: 'Salesmen',    color: '#6b7280' },
          { value: 'manager',    label: 'Managers',    color: '#6b7280' },
          { value: 'accountant', label: 'Accountants', color: '#6b7280' },
          { value: 'fi_officer', label: 'F&I',         color: '#6b7280' },
          { value: 'admin',      label: 'Admins',      color: '#6b7280' },
        ];
        const recipients = salespeople.filter(s =>
          (msgTarget === 'all' || s.role === msgTarget) && s.is_active !== false
        );
        const sendToTeam = async () => {
          if (!msgText.trim() || recipients.length === 0 || msgSending) return;
          setMsgSending(true);
          const inserts = recipients.map(s => ({
            salesman_id: s.id,
            type: 'broadcast',
            title: 'Message from the owner',
            body: msgText.trim(),
          }));
          const { error } = await supabase.from('salesman_notifications').insert(inserts);
          setMsgSending(false);
          if (error) { toast.error('Failed to send: ' + error.message); return; }
          setMsgDone(true);
          setMsgText('');
          if (msgDoneTimer.current) clearTimeout(msgDoneTimer.current);
          msgDoneTimer.current = setTimeout(() => setMsgDone(false), 3000);
        };
        // A pop-up opened from Team's top line (it was a card that sat open under the team, always).
        if (!msgOpen) return null;
        return createPortal(
          <div onClick={() => setMsgOpen(false)} className="msg-wrap" style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <style>{`@media (min-width: 640px){.msg-wrap{align-items:center!important}.msg-card{border-radius:20px!important}}`}</style>
          <div className="msg-card" role="dialog" aria-modal="true" aria-label="Message your team" onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px 20px 0 0', boxShadow: PL.shadow }}>
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(17,24,39,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>Message your team</h2>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>Arrives as a notification in each person's app</p>
              </div>
              <button type="button" onClick={() => setMsgOpen(false)} aria-label="Close" style={{ border: 'none', background: PL.raised, borderRadius: 999, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X style={{ width: 16, height: 16, color: '#6b7280' }} />
              </button>
            </div>

            <div style={{ padding: '16px 20px' }}>
              {/* Role filter pills */}
              <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Send To</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {MSG_ROLES.map(({ value, label, color }) => {
                  const cnt = value === 'all'
                    ? salespeople.filter(s => s.is_active !== false).length
                    : salespeople.filter(s => s.role === value && s.is_active !== false).length;
                  if (!cnt && value !== 'all') return null; // no "Admins 0": only roles someone holds
                  return (
                    <button
                      key={value}
                      onClick={() => setMsgTarget(value)}
                      style={{
                        padding: '6px 14px', borderRadius: 20,
                        border: 'none',
                        background: msgTarget === value ? '#111827' : '#f5f6f8',
                        color: msgTarget === value ? '#fff' : '#4b5563',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        fontFamily: "system-ui,sans-serif",
                        display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                      }}
                    >
                      {value !== 'all' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />}
                      {label}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                        background: msgTarget === value ? 'rgba(255,255,255,0.18)' : '#fff',
                        color: msgTarget === value ? '#fff' : '#4b5563',
                      }}>{cnt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Recipient preview */}
              {recipients.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {recipients.map(s => (
                    <span key={s.id} style={{ fontSize: 11.5, color: '#4b5563', background: PL.raised, borderRadius: 6, padding: '3px 8px' }}>
                      {s.full_name}
                    </span>
                  ))}
                </div>
              )}

              {/* Message input */}
              <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Message</p>
              <textarea
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                rows={4}
                placeholder="Type your message here…"
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical',
                  background: '#f9fafb', border: '1px solid #e5e7eb',
                  borderRadius: 10, padding: '10px 12px', color: '#111827', fontSize: 13,
                  fontFamily: "system-ui,sans-serif", outline: 'none', lineHeight: 1.6,
                  marginBottom: 12,
                }}
              />

              <button
                onClick={sendToTeam}
                disabled={!msgText.trim() || recipients.length === 0 || msgSending}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px 16px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: "system-ui,sans-serif", fontSize: 14, fontWeight: 600,
                  border: 'none', transition: 'all 0.15s',
                  ...(msgDone
                    ? { background: '#f5f6f8', color: '#047857', border: 'none' }
                    : (!msgText.trim() || recipients.length === 0)
                      ? { background: '#f3f4f6', color: '#9ca3af', border: '1px solid #e5e7eb', cursor: 'not-allowed' }
                      : T.btnRed),
                }}
              >
                {msgDone ? (
                  <><Check style={{ width: 15, height: 15 }} /> Sent to {recipients.length} member{recipients.length !== 1 ? 's' : ''}</>
                ) : msgSending ? (
                  'Sending…'
                ) : (
                  <><Send style={{ width: 14, height: 14 }} /> Send to {recipients.length} member{recipients.length !== 1 ? 's' : ''}</>
                )}
              </button>
            </div>
          </div>
          </div>,
          document.body,
        );
      })()}

      {showAddForm && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col"
            style={undefined}
          >
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={T.divider}
            >
              <div>
                <h3 className="font-semibold text-gray-900">Add Salesman</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Create account and trackable referral link
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-500 hover:text-gray-900 p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {addSuccess ? (
                <div className="text-center py-8">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                    style={{
                      background: '#f5f6f8',
                    }}
                  >
                    <Check className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-emerald-700 font-semibold mb-1">
                    Salesman added!
                  </p>
                  <p className="text-gray-500 text-sm mb-6">{addSuccess}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-900 transition-all"
                      style={{ border: "1px solid #e5e7eb" }}
                    >
                      Done
                    </button>
                    <button
                      onClick={resetForm}
                      className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                      style={T.btnRed}
                    >
                      Add Another
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Role selector */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2.5">Select Role</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { role: 'salesman',   label: 'Salesman',    color: '#111827', desc: 'Sells cars, manages leads' },
                        { role: 'manager',    label: 'Manager',     color: '#111827', desc: 'Manages sales team' },
                        { role: 'accountant', label: 'Accountant',  color: '#111827', desc: 'Financial view only' },
                        { role: 'fi_officer', label: 'F&I Officer', color: '#111827', desc: 'Finance & insurance' },
                        { role: 'admin',      label: 'Admin',       color: '#111827', desc: 'Listings management' },
                      ].filter(({ role }) => (role !== 'manager' || managerOn) && (isOwnerTeam || role === 'salesman' || role === 'admin')).map(({ role, label, color, desc }) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setNewRole(role)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: newRole === role ? '#e4e7ec' : '#f5f6f8',
                            cursor: 'pointer',
                            fontFamily: "system-ui,sans-serif",
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: newRole === role ? color : '#374151' }}>{label}</span>
                          </div>
                          <p style={{ fontSize: 10, color: '#4b5563', margin: '2px 0 0', textAlign: 'left' }}>{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Ahmad bin Abdullah"
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        autoComplete="off"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                        Email *
                      </label>
                      <input
                        type="email"
                        placeholder="ahmad@autocity.my"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="off"
                        className={inputCls}
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        Please use a real email — password reset and account recovery links are sent here.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                        Phone
                      </label>
                      <PhoneInput value={phone} onChange={(v) => setPhone(v)} autoComplete="off" className={inputCls} prefixClassName="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-200 bg-gray-50 flex-shrink-0" inputClassName="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-900 text-sm px-3 py-2.5" />
                    </div>
                    {newRole !== "salesman" && isOwnerTeam && (
                      <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                          Temp Password *
                        </label>
                        <input
                          type="text"
                          placeholder="Min 8 characters"
                          value={tempPw}
                          onChange={(e) => setTempPw(e.target.value)}
                          autoComplete="off"
                          className={inputCls}
                        />
                      </div>
                    )}
                    {(newRole === "salesman" || !isOwnerTeam) && (
                      <div className="flex items-end">
                        <div
                          className="w-full rounded-xl px-3 py-2.5 text-xs text-emerald-700"
                          style={{
                            background: '#f5f6f8',
                          }}
                        >
                          {isOwnerTeam
                            ? "Password auto-generated — shown once after creation."
                            : "They get an email to set their own password. The owner is told."}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                      Unique Slug *
                    </label>
                    <div className="flex">
                      <span
                        className="rounded-l-xl px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap bg-gray-50"
                        style={{ border: "1px solid #e5e7eb", borderRight: "none" }}
                      >
                        /cars?ref=
                      </span>
                      <input
                        type="text"
                        placeholder="ahmad"
                        value={slug}
                        onChange={(e) => setSlug(slugify(e.target.value))}
                        autoComplete="off"
                        className="flex-1 rounded-r-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-400 transition-colors"
                        style={{ background: "#fff", border: "1px solid #e5e7eb" }}
                      />
                    </div>
                    <p className="text-xs text-gray-700 mt-1">
                      Auto-filled from first name. Lowercase + numbers only.
                    </p>
                  </div>
                  {addError && (
                    <div
                      className="rounded-xl px-3 py-2.5 text-red-600 text-xs"
                      style={{ background: '#f5f6f8' }}
                    >
                      {addError}
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-900 transition-all"
                      style={{ border: "1px solid #e5e7eb" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={addLoading}
                      className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-40"
                      style={T.btnRed}
                    >
                      {addLoading ? "Creating..." : newRole === "salesman" ? "Create Salesman" : "Add Team Member"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Commission Approve Confirmation */}
      {commissionApproveTarget && (() => {
        const s = salespeople.find(x => x.id === commissionApproveTarget);
        const amt = soldMap[commissionApproveTarget]?.pending || 0;
        return (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
            <div className="modal-top rounded-2xl p-6 w-full max-w-sm">
              <h3 className="font-semibold text-gray-900 mb-1">Approve Commission Payout?</h3>
              <p className="text-gray-500 text-sm mb-1">Salesman: <span className="font-semibold text-gray-800">{s?.full_name}</span></p>
              <p className="text-gray-500 text-sm mb-5">Pending amount: <span className="font-bold text-amber-600">RM {amt.toLocaleString()}</span></p>
              <div className="flex gap-3">
                <button onClick={() => setCommissionApproveTarget(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 border border-gray-200 hover:text-gray-900 transition-all">Cancel</button>
                <button
                  onClick={() => handleApproveCommission(commissionApproveTarget)}
                  disabled={commissionWorking}
                  className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                  style={{ background: '#d97706', border: 'none' }}
                >
                  {commissionWorking ? 'Approving…' : 'Approve Payout'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Commission Mark Paid Confirmation */}
      {commissionPayTarget && (() => {
        const s = salespeople.find(x => x.id === commissionPayTarget);
        const amt = soldMap[commissionPayTarget]?.approved || 0;
        return (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
            <div className="modal-top rounded-2xl p-6 w-full max-w-sm">
              <h3 className="font-semibold text-gray-900 mb-1">Mark Commission as Paid?</h3>
              <p className="text-gray-500 text-sm mb-1">Salesman: <span className="font-semibold text-gray-800">{s?.full_name}</span></p>
              <p className="text-gray-500 text-sm mb-5">Approved amount: <span className="font-bold text-emerald-600">RM {amt.toLocaleString()}</span></p>
              <div className="flex gap-3">
                <button onClick={() => setCommissionPayTarget(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 border border-gray-200 hover:text-gray-900 transition-all">Cancel</button>
                <button
                  onClick={() => handleMarkCommissionPaid(commissionPayTarget)}
                  disabled={commissionWorking}
                  className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                  style={{ background: '#16a34a', border: 'none' }}
                >
                  {commissionWorking ? 'Saving…' : 'Mark as Paid'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Helpers shared by ListingDetailDrawer ────────────────────────────────────
// Listings row: counted views + enquiry taps (WhatsApp, call, booking), last 30 days.
// null = still loading: a placeholder, never a 0.

function SelectTick({ on }) {
  return (
    <span style={{ position: 'absolute', top: 4, left: 4, zIndex: 1, width: 20, height: 20, borderRadius: 6, background: on ? premiumLight.text : '#fff', boxShadow: '0 0 0 1.5px ' + (on ? premiumLight.text : '#9ca3af'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {on && <Check style={{ width: 13, height: 13, color: '#fff' }} />}
    </span>
  );
}

function ListingDetailDrawer({
  listing, salesmen, salesmenById, onClose, onUpdate, onDelete,
  setEditListing, setPriceEditListing, setMarkSoldListing,
  setDeleteId, copyListing, copiedListingId, dealerSubdomain, dealerSlug, handleAssign, handleUnassign,
  handleStatus, updatingStatus, getListingAge, userId, profile, openStudio, openSticker, initialTab = 'specs',
}) {
  useModalHistory(true, onClose);
  const { can } = usePermissions(profile);
  const canViewCosts = can('view_cost');
  const [imgIdx, setImgIdx]       = useState(0);
  const [lbOpen, setLbOpen]       = useState(false);
  useModalHistory(lbOpen, () => setLbOpen(false));
  const [drawerTab, setDrawerTab] = useState(initialTab === 'owner' && !canViewCosts ? 'specs' : initialTab);
  const [ownerTool, setOwnerTool] = useState(null);
  useEffect(() => { if (drawerTab !== 'owner') setOwnerTool(null); }, [drawerTab]);
  const [showAssign, setShowAssign] = useState(false);
  const [calcOpen,  setCalcOpen]  = useState(false);
  useModalHistory(calcOpen, () => setCalcOpen(false));
  const [isMobile, setIsMobile]   = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const images = Array.isArray(listing.images) && listing.images.length > 0 ? listing.images : ['/placeholder-car.jpg'];
  const sp = listing.selling_price || listing.price || 0;
  const monthly = calcMonthly(sp);
  const isSold   = listing.status === 'sold';
  const age      = getListingAge(listing.created_at);
  const sCfg = ({ available: { dot: '#047857' }, reserved: { dot: '#6b7280' }, sold: { dot: '#9ca3af' } })[listing.status || 'available'] || { dot: '#047857' };

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { if (lbOpen) setLbOpen(false); else onClose(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lbOpen, onClose]);

  const btnBase = { width: '100%', background: '#ffffff', borderRadius: 6, padding: '11px 14px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'background 0.2s, border-color 0.2s', border: '1px solid #e5e7eb', fontFamily: "system-ui, sans-serif", color: '#374151' };

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', overflowY: 'auto', overscrollBehavior: 'contain' }}
        onClick={onClose}
      >
        {/* Panel */}
        <div
          style={{ position: 'relative', margin: isMobile ? 0 : '24px auto', maxWidth: isMobile ? '100vw' : 1100, width: isMobile ? '100vw' : 'calc(100vw - 48px)', height: isMobile ? '100dvh' : undefined, maxHeight: isMobile ? '100dvh' : 'calc(100vh - 48px)', background: '#FFFFFF', border: '1px solid #EAECF0', borderRadius: isMobile ? 0 : 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: "system-ui, sans-serif" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, width: 36, height: 36, borderRadius: 6, background: 'rgba(255,255,255,0.9)', border: '1px solid #e5e7eb', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>

          {/* Body */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0, overflowY: 'auto', flexDirection: isMobile ? 'column' : 'row' }}>
            {/* LEFT */}
            <div style={{ flex: 1, minWidth: 0, padding: isMobile ? 16 : 24, borderRight: isMobile ? 'none' : '1px solid #e5e7eb', overflowY: isMobile ? 'visible' : 'auto' }}>

              {/* One pop-up, three buttons (owner, 2026-11-12): Details | Owner | Analytics. Owner needs view_cost. */}
              <CarSheetTabs
                tabs={[{ id: 'specs', label: 'Details' }, ...(canViewCosts ? [{ id: 'owner', label: 'Owner · P&L' }] : []), { id: 'analytics', label: 'Analytics' }]}
                value={drawerTab === 'owner' || drawerTab === 'analytics' ? drawerTab : 'specs'}
                onChange={setDrawerTab}
              />

              {drawerTab === 'owner' && canViewCosts ? (
                <OwnerCarPanel
                  listing={listing} userId={userId} salesmenById={salesmenById}
                  tool={ownerTool} setTool={setOwnerTool}
                  onStatusChange={(s) => { handleStatus(listing.id, s); onUpdate({ ...listing, status: s }); }}
                  statusUpdating={updatingStatus === listing.id}
                  onMarkSold={() => setMarkSoldListing(listing)}
                />
              ) : drawerTab === 'analytics' ? (
                <CarAnalyticsPanel listing={listing} dealerId={getDealerIdFromProfile(profile)} />
              ) : (
              <CarDetailsPanel
                listing={listing} images={images} imgIdx={imgIdx} setImgIdx={setImgIdx}
                onOpenLightbox={() => setLbOpen(true)} isMobile={isMobile}
                monthlyText={monthly ? `Est. RM ${monthly.toLocaleString()}/mo · 90% loan · 7yr · ${DEFAULT_EIR}% EIR` : null}
              />
              )}
            </div>

            {/* RIGHT — dark premium sidebar */}
            <div style={{ flex: isMobile ? 'none' : '0 0 210px', width: isMobile ? '100%' : undefined, padding: isMobile ? '12px 16px 24px' : 20, display: 'flex', flexDirection: 'column', gap: 0, borderTop: isMobile ? '1px solid #e5e7eb' : 'none', borderLeft: isMobile ? 'none' : '1px solid #e5e7eb', background: '#fff' }}>
              <div style={{ background: 'transparent', borderRadius: 8, padding: isMobile ? 18 : '18px 0', display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr', gap: 8 }}>
                <p style={{ fontSize: 10, color: isMobile ? '#6b7280' : '#6b7280', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4, gridColumn: isMobile ? '1 / -1' : undefined }}>{drawerTab === 'owner' ? 'P&L Tools' : 'Actions'}</p>

                {/* Owner-mode: the per-car tools — each opens an editor with an explicit Save */}
                {drawerTab === 'owner' && canViewCosts && (
                  <>
                    {[
                      ['Edit Costs', DollarSign, () => setOwnerTool('prices')],
                      ['Recon Jobs', Wrench, () => setOwnerTool('recon')],
                      ['Ad Spend', Megaphone, () => setOwnerTool('ad')],
                      ['Compliance', Shield, () => setOwnerTool('compliance')],
                      ['Condition', ShieldCheck, () => setOwnerTool('appraisal')],
                      ['Activity', Clock, () => setOwnerTool('activity')],
                    ].map(([label, Icon, onClick]) => (
                      <button key={label} onClick={onClick} style={{ ...btnBase, border: '1px solid rgba(124,58,237,0.3)', color: '#7c3aed' }} onMouseEnter={e => e.currentTarget.style.background='#f9fafb'} onMouseLeave={e => e.currentTarget.style.background='#ffffff'}>
                        <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />{label}
                      </button>
                    ))}
                    {!isSold && (
                      <button onClick={() => setMarkSoldListing(listing)} style={{ ...btnBase, border: '1px solid rgba(5,150,105,0.3)', color: '#059669' }} onMouseEnter={e => e.currentTarget.style.background='#f9fafb'} onMouseLeave={e => e.currentTarget.style.background='#ffffff'}>
                        <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} />Mark as Sold
                      </button>
                    )}
                    <button onClick={() => setDrawerTab('specs')} style={{ ...btnBase, border: '1px solid #e5e7eb', color: '#6b7280' }} onMouseEnter={e => e.currentTarget.style.background='#f9fafb'} onMouseLeave={e => e.currentTarget.style.background='#ffffff'}>
                      <ChevronLeft style={{ width: 14, height: 14, flexShrink: 0 }} />Public Details
                    </button>
                  </>
                )}

                {drawerTab !== 'owner' && (<>
                {/* Edit */}
                <button onClick={() => { setEditListing(listing); }} style={{ ...btnBase, border: '1px solid rgba(37,99,235,0.3)', color: '#2563eb' }} onMouseEnter={e => e.currentTarget.style.background='#f9fafb'} onMouseLeave={e => e.currentTarget.style.background='#ffffff'}>
                  <Pencil style={{ width: 14, height: 14, flexShrink: 0 }} />Edit Listing
                </button>

                {/* Price — hidden on sold listings */}
                {!isSold && (
                  <button onClick={() => setPriceEditListing(listing)} style={{ ...btnBase, border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626' }} onMouseEnter={e => e.currentTarget.style.background='#f9fafb'} onMouseLeave={e => e.currentTarget.style.background='#ffffff'}>
                    <Tag style={{ width: 14, height: 14, flexShrink: 0 }} />Change Price
                  </button>
                )}

                {/* Costs & P&L — jump to the owner panel in this same detail page */}
                {canViewCosts && (
                  <button onClick={() => setDrawerTab('owner')} style={{ ...btnBase, border: '1px solid rgba(124,58,237,0.3)', color: drawerTab === 'owner' ? '#fff' : '#7c3aed', background: drawerTab === 'owner' ? '#7c3aed' : '#ffffff' }} onMouseEnter={e => { if (drawerTab !== 'owner') e.currentTarget.style.background='#f9fafb'; }} onMouseLeave={e => { if (drawerTab !== 'owner') e.currentTarget.style.background='#ffffff'; }}>
                    <DollarSign style={{ width: 14, height: 14, flexShrink: 0 }} />Costs &amp; P&amp;L
                  </button>
                )}

                {/* Copy */}
                <button onClick={() => copyListing(listing)} style={{ ...btnBase, border: '1px solid rgba(22,163,74,0.3)', color: copiedListingId === listing.id ? '#15803d' : '#16a34a' }} onMouseEnter={e => e.currentTarget.style.background='#f9fafb'} onMouseLeave={e => e.currentTarget.style.background='#ffffff'}>
                  {copiedListingId === listing.id ? <Check style={{ width: 14, height: 14, flexShrink: 0 }} /> : <Clipboard style={{ width: 14, height: 14, flexShrink: 0 }} />}
                  {copiedListingId === listing.id ? 'Copied!' : 'Copy Writing'}
                </button>

                {/* Share — per-platform tagged links */}
                <ShareMenu
                  label="Share Listing"
                  baseUrl={dealerSubdomain ? buildStorefrontUrl(dealerSubdomain, `/cars/${listing.slug}`) : `https://drevo.my/cars/${listing.slug}`}
                  refSlug={dealerSlug || ''}
                  style={{ ...btnBase, justifyContent: 'flex-start', width: '100%', border: '1px solid rgba(124,58,237,0.3)', color: '#7c3aed' }}
                  waCaption={(link) => [
                    `${listing.year} ${listing.brand} ${listing.model}${listing.variant ? ' ' + listing.variant : ''}`,
                    `RM ${Number(listing.selling_price || 0).toLocaleString()}`,
                    '',
                    link,
                  ].join('\n')}
                />

                {/* ShiftOS Studio — slide/content generator for this listing */}
                {openStudio && (
                  <button onClick={() => openStudio(listing)} style={{ ...btnBase, border: '1px solid rgba(219,39,119,0.3)', color: '#db2777' }} onMouseEnter={e => e.currentTarget.style.background='#f9fafb'} onMouseLeave={e => e.currentTarget.style.background='#ffffff'}>
                    <Film style={{ width: 14, height: 14, flexShrink: 0 }} />ShiftOS Studio
                  </button>
                )}

                {/* Financing Calculator — hidden on sold listings */}
                {!isSold && (
                  <button onClick={() => setCalcOpen(true)} style={{ ...btnBase, border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626' }} onMouseEnter={e => e.currentTarget.style.background='#f9fafb'} onMouseLeave={e => e.currentTarget.style.background='#ffffff'}>
                    <Calculator style={{ width: 14, height: 14, flexShrink: 0 }} />Financing Calc
                  </button>
                )}

                {/* Window sticker: an A4 page for the windscreen, QR to the car page */}
                {openSticker && !isSold && (
                  <button onClick={() => openSticker(listing)} style={{ ...btnBase, border: '1px solid #e5e7eb', color: '#111827' }} onMouseEnter={e => e.currentTarget.style.background='#f9fafb'} onMouseLeave={e => e.currentTarget.style.background='#ffffff'}>
                    <Printer style={{ width: 14, height: 14, flexShrink: 0 }} />Window Sticker
                  </button>
                )}

                {/* Assign */}
                <div style={{ position: 'relative', gridColumn: isMobile ? '1 / -1' : undefined }}>
                  <button onClick={() => setShowAssign(v => !v)} style={{ ...btnBase, border: '1px solid rgba(37,99,235,0.3)', color: '#2563eb' }} onMouseEnter={e => e.currentTarget.style.background='#f9fafb'} onMouseLeave={e => e.currentTarget.style.background='#ffffff'}>
                    <UserPlus style={{ width: 14, height: 14, flexShrink: 0 }} />Assign Salesman
                  </button>
                  {showAssign && (
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: 4, background: '#FFFFFF', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 60, overflow: 'hidden', padding: '4px 0' }}>
                      {listing.assigned_to && (
                        <button onClick={() => { handleUnassign(listing.id); setShowAssign(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                          <X style={{ width: 12, height: 12 }} />Unassign
                        </button>
                      )}
                      {salesmen.map(s => (
                        <button key={s.id} onClick={() => { handleAssign(listing.id, s.id, s.full_name); setShowAssign(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: listing.assigned_to === s.id ? '#F5F6F8' : 'none', border: 'none', color: listing.assigned_to === s.id ? '#DC2626' : '#374151', fontSize: 12, cursor: 'pointer' }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{(s.full_name || 'S')[0].toUpperCase()}</div>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name || 'Unknown'}</span>
                          {listing.assigned_to === s.id && <Check style={{ width: 11, height: 11, marginLeft: 'auto', flexShrink: 0 }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mark Sold */}
                {!isSold && (
                  <button onClick={() => setMarkSoldListing(listing)} style={{ ...btnBase, border: '1px solid rgba(5,150,105,0.3)', color: '#059669' }} onMouseEnter={e => e.currentTarget.style.background='#f9fafb'} onMouseLeave={e => e.currentTarget.style.background='#ffffff'}>
                    <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} />Mark as Sold
                  </button>
                )}

                {/* Delete */}
                <button onClick={() => { setDeleteId(listing.id); }} style={{ ...btnBase, border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626' }} onMouseEnter={e => e.currentTarget.style.background='#f9fafb'} onMouseLeave={e => e.currentTarget.style.background='#ffffff'}>
                  <Trash2 style={{ width: 14, height: 14, flexShrink: 0 }} />Delete Listing
                </button>
                </>)}

                {/* Metadata */}
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: 12, marginTop: 4, gridColumn: isMobile ? '1 / -1' : undefined }}>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px' }}>Listed {age === 0 ? 'today' : `${age} day${age !== 1 ? 's' : ''} ago`}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: sCfg.dot, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#374151', textTransform: 'capitalize' }}>{listing.status || 'available'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lbOpen && (
        <div
          onClick={() => setLbOpen(false)}
          className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {/* Close */}
          <button
            onClick={() => setLbOpen(false)}
            style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 8, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
          {/* Counter */}
          {images.length > 1 && (
            <span style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', fontSize: 12, color: '#9ca3af', background: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: '4px 12px' }}>
              {imgIdx + 1} / {images.length}
            </span>
          )}
          {/* Prev */}
          {images.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setImgIdx(i => (i - 1 + images.length) % images.length); }}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: 8, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft style={{ width: 22, height: 22 }} />
            </button>
          )}
          {/* Image */}
          <img
            src={images[imgIdx]}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 'calc(100vw - 120px)', maxHeight: '90vh', objectFit: 'contain', borderRadius: 4, display: 'block' }}
          />
          {/* Next */}
          {images.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setImgIdx(i => (i + 1) % images.length); }}
              style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: 8, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight style={{ width: 22, height: 22 }} />
            </button>
          )}
        </div>
      )}

      {/* Financing Calculator modal */}
      {calcOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setCalcOpen(false); }}
          className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "system-ui,sans-serif" }}
        >
          <div style={{ width: '100%', maxWidth: 860, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(17,24,39,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <p style={{ color: '#111827', fontWeight: 600, fontSize: 14, margin: '0 0 2px' }}>Financing &amp; Cost Calculator</p>
                <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>{listing.brand} {listing.model}{listing.variant ? ` ${listing.variant}` : ''}</p>
              </div>
              <button onClick={() => setCalcOpen(false)} style={{ background: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
              <FinancingCalculator
                initialPrice={listing.selling_price || listing.price}
                engineCc={listing.engine_cc}
                bodyType={listing.body_type}
                carName={`${listing.brand} ${listing.model}${listing.variant ? ` ${listing.variant}` : ''}`}
                carYear={listing.year ? String(listing.year) : ''}
                carColor={listing.colour || ''}
                carImage={listing.images?.length ? listing.images[0] : null}
                light
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── StockTab ─────────────────────────────────────────────────────────────────
// Quick-filter chips for the stock list (keys map to stockFilterFns predicates)
const STOCK_FILTER_CHIPS = [
  { key: 'missing_b7',  label: 'Missing B7' },
  { key: 'missing_b5',  label: 'Missing B5' },
  { key: 'no_plate',    label: 'No plate' },
  { key: 'no_vin',      label: 'No VIN' },
  { key: 'unpublished', label: 'Unpublished' },
  { key: 'under_hp',    label: 'Under HP' },
  { key: 'enc_unknown', label: 'Enc. unknown' },
  { key: 'aging',       label: 'Aging 60d+' },
  { key: 'loss',        label: 'In loss' },
];
const STOCK_SORT_OPTIONS = [
  { value: 'recent',      label: 'Newest' },
  { value: 'price_desc',  label: 'Price high→low' },
  { value: 'price_asc',   label: 'Price low→high' },
  { value: 'year_desc',   label: 'Year newest' },
  { value: 'year_asc',    label: 'Year oldest' },
  { value: 'profit_desc', label: 'Profit high→low' },
  { value: 'profit_asc',  label: 'Profit low→high' },
  { value: 'days_desc',   label: 'Longest in stock' },
];

// Shared stock P&L math — used by StockTab.netProfit AND the compact stats strip on
// the Listings tab, so both show the same figure as the per-unit P&L modal.
function stockCostBasis(u) {
  if (Number(u.purchase_price) > 0) return Number(u.purchase_price);
  return Number(u.car_listings?.base_price) || 0;
}
// Split version — returns the vehicle-only front gross and the F&I add-on net
// (back gross) separately, so callers that need to show them as distinct
// figures (e.g. "Car GP" vs "Add-on GP") don't have to duplicate this math.
// stockNetProfit() below is just front + addonNet for callers that only want
// one combined number (row badges, loss filter).
function stockNetProfitParts(u, ctx = {}) {
  const { ads = {}, handover = {}, addRev = {}, addCost = {}, broker = {} } = ctx;
  // `cfg` is null until dealer_cost_settings answers, and the cars paint first from the
  // device copy, so a default of {} (undefined only) was not enough: Stock crashed on reopen.
  const cfg = ctx.cfg || {};
  const cost = stockCostBasis(u);
  const c = u.car_listings || {};
  const isSold = u.status === 'sold';
  const revenue = isSold ? (Number(u.sold_price) || 0) : (Number(u.asking_price) || Number(c.selling_price) || 0);
  if (revenue === 0 && cost === 0) return null;
  if (isSold && !u.sold_price && cost === 0) return null;
  // The ONE profit engine (src/utils/carPnl.js); recon jobs are not loaded per row, so the
  // estimate stands in (effectiveRecon never goes below it).
  const p = carPnl({
    purchase: cost, reconEstimate: u.recon_cost, servicesCost: c.included_services_cost,
    commission: c.commission_amount, brokerCommission: broker[u.listing_id] || 0, adSpend: ads[u.id] || 0,
    handoverCost: handover[u.listing_id] ?? null,
    asking: Number(u.asking_price) || Number(c.selling_price) || 0, soldPrice: u.sold_price, isSold,
    startDate: u.purchase_date || u.created_at, soldDate: u.sold_date,
    engineCc: u.engine_cc || c.engine_cc, warrantyMonths: c.warranty_months, cfg,
  });
  const front = p.front;
  const aR = addRev[u.listing_id] || 0;
  const aC = addCost[u.listing_id] || 0;
  return { front, addonRevenue: aR, addonCost: aC, addonNet: aR - aC };
}
function stockNetProfit(u, ctx = {}) {
  const parts = stockNetProfitParts(u, ctx);
  return parts == null ? null : parts.front + parts.addonNet;
}

// The four tiles over Stock & costs. Every figure is the SAME sum Overview and Revenue show
// (useCarMoney -> ownerMoney -> carPnl): "Profit this month" used to be its own sum over
// stock_units, which counted a sold car with no buy price as pure profit and went by the stock
// record's sold date, and the day counts read the stale stored days_in_stock (wrong for most cars).
function StockStatsStrip({ dealerId, canSeeProfit = true }) {
  const { money: m } = useCarMoney(dealerId);
  const rm = (n) => 'RM ' + Math.round(Number(n || 0)).toLocaleString('en-MY');
  const mo = m?.month;
  const items = m ? [
    { label: 'Stock value', val: rm(m.stock.asking), sub: 'Asking prices, unsold cars' },
    { label: 'Avg days in stock', val: m.stock.avgDays == null ? '-' : String(m.stock.avgDays) },
    { label: 'Over 60 days', val: String(m.stock.over60), tone: m.stock.over60 > 0 ? 'bad' : undefined, sub: m.stock.over60 > 0 ? 'Cut the price or push them' : 'None ageing' },
    { label: 'Profit this month', val: rm(mo.gross), tone: mo.gross < 0 ? 'bad' : undefined,
      sub: mo.leftOut > 0 ? `${mo.leftOut} sold car${mo.leftOut === 1 ? '' : 's'} left out, no buy price`
        : mo.addonsGross ? `Cars ${rm(mo.carsGross)} · add-ons ${rm(mo.addonsGross)}` : undefined },
  ].filter((it) => canSeeProfit || it.label !== 'Profit this month') : Array.from({ length: canSeeProfit ? 4 : 3 }, () => ({}));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
      {items.map((it, i) => <InvTile key={i} label={it.label || ''} value={it.val} sub={it.sub} tone={it.tone} />)}
    </div>
  );
}
const StockTab = React.memo(function StockTab({ userId, listings, profile, salesmen = [], onPublishComplete, autoTool, onToolHandled, hideSummary = false, onAdd, onOpenListing }) {
  const navigate = useNavigate();
  const { can } = usePermissions(profile);
  // Persisted so the stock table paints last-known units instantly (no IC or
  // buyer data on stock_units). "loading" = nothing to show yet.
  const [units, setUnits, unitsCached] = usePersistentState(userId ? `stock:${userId}` : null, []);
  const [unitsFetching, setLoading] = useState(true);
  const loading = unitsFetching && !unitsCached;
  const [soldTarget, setSoldTarget] = useState(null);
  const [soldSaving, setSoldSaving] = useState(false);
  const [stockView, setStockView] = useState('available');
  const [visibleCount, setVisibleCount] = useState(30);
  const [historyUnit, setHistoryUnit] = useState(null);
  useModalHistory(!!historyUnit, () => setHistoryUnit(null));
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pnlUnit, setPnlUnit] = useState(null);
  useModalHistory(!!pnlUnit, () => setPnlUnit(null));
  const [pnlData, setPnlData] = useState(null);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [reconUnit, setReconUnit] = useState(null);
  useModalHistory(!!reconUnit, () => setReconUnit(null));
  const [reconJobs, setReconJobs] = useState([]);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconForm, setReconForm] = useState({ title: '', category: 'other', vendor: '', cost: '', eta_date: '', notes: '' });
  const [reconSaving, setReconSaving] = useState(false);
  const [showReconAdd, setShowReconAdd] = useState(false);
  // Advertising spend per unit (DMS-6)
  const [adUnit, setAdUnit] = useState(null);
  useModalHistory(!!adUnit, () => setAdUnit(null));
  const [adEntries, setAdEntries] = useState([]);
  const [adLoading, setAdLoading] = useState(false);
  const [adForm, setAdForm] = useState({ channel: 'mudah', amount: '', spent_at: new Date().toISOString().slice(0, 10), notes: '' });
  const [adSaving, setAdSaving] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  useModalHistory(showCsvImport, () => setShowCsvImport(false));
  const [showVendors, setShowVendors] = useState(false);
  useModalHistory(showVendors, () => setShowVendors(false));
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: '', category: 'workshop', contact: '', phone: '', address: '', notes: '' });
  const [vendorSaving, setVendorSaving] = useState(false);
  const [showVendorAdd, setShowVendorAdd] = useState(false);
  const [csvRows, setCsvRows] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [csvSaving, setCsvSaving] = useState(false);
  const csvInputRef = useRef(null);

  // ENT-8: inline price editing
  const [editPriceUnit, setEditPriceUnit] = useState(null);
  useModalHistory(!!editPriceUnit, () => setEditPriceUnit(null));
  const [editPriceForm, setEditPriceForm] = useState({ purchase_price: '', recon_cost: '' });
  const [editPriceSaving, setEditPriceSaving] = useState(false);

  const [publishingStockId, setPublishingStockId] = useState(null);
  const [detailUnit, setDetailUnit] = useState(null);
  useModalHistory(!!detailUnit, () => setDetailUnit(null));
  const [stockPublishListing, setStockPublishListing] = useState(null);
  useModalHistory(!!stockPublishListing, () => setStockPublishListing(null));
  // T2-3: condition appraisal draft for the detail drawer (edit-in-place).
  const [apprDraft, setApprDraft] = useState(null);
  const [apprSaving, setApprSaving] = useState(false);
  useEffect(() => { setApprDraft(detailUnit?.appraisal || null); }, [detailUnit]);
  // Search + filter + sort for the stock list
  const [stockSearch, setStockSearch] = useState('');
  const [stockFilters, setStockFilters] = useState(() => new Set());
  const [stockSort, setStockSort] = useState('recent');
  const toggleStockFilter = (k) => setStockFilters(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  // Lock body scroll while detail drawer or publish form is open
  useEffect(() => {
    if (!detailUnit && !stockPublishListing) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [detailUnit, stockPublishListing]);

  const handlePublishFromStock = async (u) => {
    if (publishingStockId) return;
    setPublishingStockId(u.id);
    try {
      let listing = null;
      if (!u.listing_id) {
        // No listing yet — create a minimal unpublished one from stock unit data
        const { data: newListing, error } = await supabase.from('car_listings').insert({
          dealer_id: userId,
          brand: u.brand || '',
          model: u.model || '',
          year: u.year || null,
          plate_number: u.registration_number || null,
          selling_price: u.asking_price || null,
          status: 'unpublished',
        }).select().single();
        if (error) {
          if (error.message?.includes('listing_cap_exceeded')) toast.error('Listing cap reached. Upgrade your plan to publish more cars.');
          else toast.error('Could not create listing: ' + error.message);
          return;
        }
        await supabase.from('stock_units').update({ listing_id: newListing.id }).eq('id', u.id).eq('dealer_id', userId);
        listing = newListing;
      } else {
        // Fetch the full listing row (joined car_listings select doesn't include id)
        const { data, error } = await supabase.from('car_listings').select('*').eq('id', u.listing_id).single();
        if (error || !data) { toast.error('Could not load listing details.'); return; }
        listing = data;
      }
      // Open CarForm so user can add photos, location, and other details before publishing
      setStockPublishListing(listing);
    } catch (e) {
      console.error('[handlePublishFromStock]', e);
      toast.error('Something went wrong.');
    } finally {
      setPublishingStockId(null);
    }
  };

  // Called by CarForm after saving details in the stock-publish flow
  const handleStockPublishSave = async (savedListing) => {
    const { error } = await supabase
      .from('car_listings')
      .update({ status: 'available' })
      .eq('id', savedListing.id);
    if (error) { toast.error('Could not publish: ' + error.message); return; }
    setStockPublishListing(null);
    setDetailUnit(null);
    fetchUnits();
    onPublishComplete?.({ ...savedListing, status: 'available' });
    logActivity({ dealerId: userId, actor: profile, tableName: 'car_listings', recordId: savedListing.id, action: 'published', summary: `Published from stock — ${savedListing.brand || ''} ${savedListing.model || ''} ${savedListing.year || ''}`.trim() });
    toast.success('Published to marketplace');
  };

  // Reset pagination when switching views or changing search/filters/sort
  useEffect(() => { setVisibleCount(30); }, [stockView, stockSearch, stockFilters, stockSort]);

  const fetchUnits = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stock_units')
      .select('*, car_listings(brand, model, variant, year, plate_number, base_price, selling_price, purchase_price, recon_cost, gross_profit, days_in_stock, sold_price, sold_date, status, images, mileage, transmission, fuel_type, body_type, colour, engine_cc, condition, vin_number, registration_date, previous_owners, road_tax_expiry, warranty_months, is_recon, auction_grade, interior_grade, import_country, commission_amount, included_services_cost)')
      .eq('dealer_id', userId)
      .order('created_at', { ascending: false });
    if (error) console.error('[StockTab] fetchUnits error:', error.message, error);
    setUnits(data || []);
    setLoading(false);
  };

  useEffect(() => { if (userId) fetchUnits(); }, [userId]);

  // Open the tool requested from the Listings "Tools" dropdown, then clear the signal.
  useEffect(() => {
    if (!autoTool) return;
    if (autoTool === 'csv') { setShowCsvImport(true); setCsvRows([]); setCsvError(''); }
    else if (autoTool === 'vendors') { setShowVendors(true); fetchVendors(); }
    onToolHandled?.();
  }, [autoTool]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dealer cost-floor settings → holding cost in P&L (DMS-4)
  const [costCfg, setCostCfg] = useState(null);
  useEffect(() => {
    if (!userId) return;
    supabase.from('dealer_cost_settings').select('*').eq('dealer_id', userId).maybeSingle()
      .then(({ data }) => setCostCfg(data || {}));
  }, [userId]);

  // Extra cost components so the list-level net P&L (loss flag + row badge) matches
  // the full per-unit P&L modal: ad spend (per stock unit), handover processing
  // (per listing), and F&I back-end (per listing). Without these the inline gross
  // was rosy — a 0-margin car with recon/ads/holding never tripped the loss filter.
  const [costExtras, setCostExtras] = useState({ ads: {}, handover: {}, addRev: {}, addCost: {}, broker: {} });
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [ads, tasks, dp, bc] = await Promise.all([
        supabase.from('ad_spend').select('stock_unit_id, amount').eq('dealer_id', userId),
        supabase.from('post_sale_tasks').select('listing_id, status, cost').eq('dealer_id', userId),
        supabase.from('deal_products').select('listing_id, sold_price, dealer_products(cost_price)').eq('dealer_id', userId),
        loadBrokerCommission(userId).catch(() => null), // BROKER-2: part of the one commission line
      ]);
      if (cancelled) return;
      const bk = {}; Object.entries(bc?.byCar || {}).forEach(([id, v]) => { bk[id] = v.amount; });
      const a = {}; (ads.data || []).forEach(r => { if (r.stock_unit_id) a[r.stock_unit_id] = (a[r.stock_unit_id] || 0) + (Number(r.amount) || 0); });
      const h = {}; (tasks.data || []).forEach(t => { if (t.status !== 'na' && t.listing_id) h[t.listing_id] = (h[t.listing_id] || 0) + (Number(t.cost) || 0); });
      const ar = {}; const ac = {};
      (dp.data || []).forEach(d => { if (d.listing_id) { ar[d.listing_id] = (ar[d.listing_id] || 0) + (Number(d.sold_price) || 0); ac[d.listing_id] = (ac[d.listing_id] || 0) + (Number(d.dealer_products?.cost_price) || 0); } });
      setCostExtras({ ads: a, handover: h, addRev: ar, addCost: ac, broker: bk });
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // carPnl's one clock (daysHeld): from the purchase date, else the day the stock record was
  // made, else the listing; stops on the sale. The stored days_in_stock was stale for most cars.
  const daysInStock = (u) => {
    const d = daysHeld(u.purchase_date || u.created_at || u.car_listings?.created_at, u.status === 'sold' ? u.sold_date : null);
    return d == null ? '—' : d;
  };

  const costBasis = (u) => {
    if (Number(u.purchase_price) > 0) return Number(u.purchase_price);
    return Number(u.car_listings?.base_price) || 0;
  };

  // True net P&L for the list view — mirrors the per-unit P&L modal (recon, included
  // services, commission, handover, holding, ad spend, F&I back-end). Drives the
  // "In loss" filter, the row Net badge and the Listings stats strip via one shared
  // helper so all three agree.
  // A role without "View gross profit" gets no profit anywhere in this tab: every row badge,
  // the "In loss" filter, the profit sorts and the P&L button read null (only a tile was hidden).
  const netProfit = (u) => (can('view_gross') ? stockNetProfit(u, {
    cfg: costCfg || {}, ads: costExtras.ads, handover: costExtras.handover,
    addRev: costExtras.addRev, addCost: costExtras.addCost, broker: costExtras.broker,
  }) : null);

  // Predicates for the quick-filter chips (each returns true = unit matches the filter)
  const stockFilterFns = {
    missing_b7:  u => !u.puspakom_b7_date,
    missing_b5:  u => !u.puspakom_b5_date,
    no_plate:    u => !(u.car_listings?.plate_number || u.registration_number),
    no_vin:      u => !(u.car_listings?.vin_number),
    unpublished: u => !u.listing_id || u.car_listings?.status === 'unpublished',
    under_hp:    u => (u.encumbrance_status || 'unknown') === 'under_hp',
    enc_unknown: u => (u.encumbrance_status || 'unknown') === 'unknown',
    aging:       u => u.status === 'in_stock' && typeof daysInStock(u) === 'number' && daysInStock(u) > AGEING_DAYS,
    loss:        u => { const g = netProfit(u); return g != null && g < 0; },
  };
  // Apply text search + active chip filters + sort to a list of units
  const applyStockFilters = (list) => {
    let out = list;
    const q = stockSearch.trim().toLowerCase();
    if (q) {
      out = out.filter(u => {
        const c = u.car_listings || {};
        const hay = [c.brand, c.model, c.variant, c.plate_number || u.registration_number, c.vin_number, u.brand, u.model]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    if (stockFilters.size) {
      out = out.filter(u => [...stockFilters].every(k => stockFilterFns[k]?.(u)));
    }
    if (stockSort !== 'recent') {
      const priceOf = u => stockView === 'sold' ? (Number(u.sold_price) || 0) : (Number(u.asking_price) || Number(u.car_listings?.selling_price) || 0);
      const yearOf  = u => Number(u.car_listings?.year || u.year) || 0;
      const daysOf  = u => { const d = daysInStock(u); return typeof d === 'number' ? d : 0; };
      const sorters = {
        price_desc:  (a, b) => priceOf(b) - priceOf(a),
        price_asc:   (a, b) => priceOf(a) - priceOf(b),
        year_desc:   (a, b) => yearOf(b) - yearOf(a),
        year_asc:    (a, b) => yearOf(a) - yearOf(b),
        profit_desc: (a, b) => (netProfit(b) || 0) - (netProfit(a) || 0),
        profit_asc:  (a, b) => (netProfit(a) || 0) - (netProfit(b) || 0),
        days_desc:   (a, b) => daysOf(b) - daysOf(a),
      };
      if (sorters[stockSort]) out = [...out].sort(sorters[stockSort]);
    }
    return out;
  };

  const now = new Date();
  const activeUnits = units.filter(u => u.status !== 'sold');
  const soldUnits = units.filter(u => u.status === 'sold');

  const thisMonth = soldUnits.filter(u => {
    if (!u.sold_date) return false;
    const d = new Date(u.sold_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalGP = thisMonth.reduce((s, u) => s + (netProfit(u) || 0), 0);
  // Sale price source of truth is car_listings.selling_price (edited via the
  // detail-drawer Adjust Price modal or CarForm); asking_price is a legacy
  // per-unit fallback only.
  const totalValue = activeUnits.reduce((s, u) => s + (Number(u.car_listings?.selling_price) || Number(u.asking_price) || 0), 0);
  // Revenue = realised sale price across all sold units (fall back to listing
  // price, then asking, if a pipeline-close didn't stamp a sold_price).
  const soldRevenue = soldUnits.reduce((s, u) => s + (Number(u.sold_price) || Number(u.car_listings?.selling_price) || Number(u.asking_price) || 0), 0);
  const unitsWithDays = activeUnits.filter(u => typeof daysInStock(u) === 'number');
  const avgDays = unitsWithDays.length
    ? Math.round(unitsWithDays.reduce((s, u) => s + daysInStock(u), 0) / unitsWithDays.length)
    : 0;
  const agingUnits = activeUnits.filter(u => {
    const days = daysInStock(u);
    return typeof days === 'number' && days > AGEING_DAYS;
  });
  const gpSparkData = bucketGPByMonth(units);

  // Same popup as the listings grid (MarkSoldModal). The stock_units write is
  // the sale: trg_sync_stock_sold_to_listing flips the car to sold with this
  // price + date, so no second car_listings status write here. Closer and
  // commission live on the car, so they are written first.
  const handleMarkSold = async ({ soldBy = null, soldPrice = null, commission = null, soldDate = null } = {}) => {
    setSoldSaving(true);
    const listingId = soldTarget.listing_id || null;
    if (listingId) {
      const carPatch = {};
      if (soldBy) carPatch.assigned_to = soldBy;
      if (commission != null) carPatch.commission_amount = commission;
      if (Object.keys(carPatch).length) {
        const { error: carErr } = await supabase.from('car_listings').update(carPatch).eq('id', listingId);
        if (carErr) {
          toast.error('Could not save the salesman or commission: ' + carErr.message);
          setSoldSaving(false);
          return;
        }
      }
    }
    const payload = {
      status: 'sold',
      sold_date: soldDate || new Date().toISOString().slice(0, 10),
      sold_price: soldPrice ?? 0,
    };
    const { error } = await supabase
      .from('stock_units')
      .update(payload)
      .eq('id', soldTarget.id)
      .eq('dealer_id', userId);
    if (error) {
      toast.error('Failed to mark as sold: ' + error.message);
      setSoldSaving(false);
      return;
    }
    const car = soldTarget.car_listings || {};
    logActivity({ dealerId: userId, actor: profile, tableName: 'stock_units', recordId: soldTarget.id, action: 'marked_sold', summary: `Stock unit sold${car.brand ? ` — ${car.brand} ${car.model} ${car.year}` : ''} · RM ${(payload.sold_price||0).toLocaleString()}` });
    if (listingId) {
      onPublishComplete?.({ id: listingId, status: 'sold', sold_price: payload.sold_price, sold_date: payload.sold_date,
        ...(soldBy ? { assigned_to: soldBy } : {}), ...(commission != null ? { commission_amount: commission } : {}) });
    }
    // Refetch — server-side triggers recompute days_in_stock/gross_profit/recon_cost etc.
    await fetchUnits();
    setSoldTarget(null);
    setSoldSaving(false);
  };

  // HP-3: PUSPAKOM B7 (hire-purchase inspection) — valid 30 days from inspection.
  // Show the inspection date WITH YEAR so a 2024/2025 cert is obviously stale, and
  // flag expired (red) / expiring (amber) loudly rather than a silent number.
  const puspakomStatus = (date) => {
    if (!date) return { label: 'B7 missing', color: '#6b7280', urgent: false };
    const issued = new Date(date);
    const d = issued.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
    const expires = new Date(issued); expires.setDate(expires.getDate() + 30);
    const daysLeft = Math.floor((expires - Date.now()) / 86400000);
    if (daysLeft < 0)  return { label: `B7 expired · ${d}`, color: '#ef4444', urgent: true };
    if (daysLeft <= 7) return { label: `B7 expires in ${daysLeft}d · ${d}`, color: '#f59e0b', urgent: true };
    return { label: `B7 valid ${daysLeft}d · ${d}`, color: '#22c55e', urgent: false };
  };
  const handleUpdatePuspakom = async (unit) => {
    const current = unit.puspakom_b7_date || '';
    const next = window.prompt('PUSPAKOM B7 inspection date (YYYY-MM-DD). Leave blank to clear.', current);
    if (next === null) return;
    const value = next.trim() || null;
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)))) {
      toast.error('Enter a valid date as YYYY-MM-DD (e.g. 2026-03-15)');
      return;
    }
    const { error } = await supabase.from('stock_units').update({ puspakom_b7_date: value }).eq('id', unit.id).eq('dealer_id', userId);
    if (error) { toast.error('Update failed'); return; }
    logActivity({ dealerId: userId, actor: profile, tableName: 'stock_units', recordId: unit.id, action: 'b7_updated', summary: `Puspakom B7 date set to ${value || 'cleared'}`, fieldChanges: { puspakom_b7_date: { from: unit.puspakom_b7_date, to: value } } });
    setUnits(p => p.map(u => u.id === unit.id ? { ...u, puspakom_b7_date: value } : u));
    setDetailUnit(prev => (prev && prev.id === unit.id) ? { ...prev, puspakom_b7_date: value } : prev);
    toast.success('PUSPAKOM B7 updated');
  };

  // ENT-1: PUSPAKOM B5 (ownership-transfer inspection) — no hard expiry, but a cert
  // older than ~12 months usually needs re-inspection before JPJ transfer, so show
  // the full date WITH YEAR and flag a stale one (amber) instead of a bare "done".
  const b5Status = (date) => {
    if (!date) return { label: 'B5 missing', color: '#6b7280' };
    const dt = new Date(date);
    const d = dt.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
    const months = Math.floor((Date.now() - dt) / (30 * 86400000));
    if (months >= 12) return { label: `B5 ${d} · stale`, color: '#f59e0b' };
    return { label: `B5 ${d}`, color: '#22c55e' };
  };
  const handleUpdateB5 = async (unit) => {
    const current = unit.puspakom_b5_date || '';
    const next = window.prompt('PUSPAKOM B5 inspection date (YYYY-MM-DD). Leave blank to clear.', current);
    if (next === null) return;
    const value = next.trim() || null;
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)))) {
      toast.error('Enter a valid date as YYYY-MM-DD (e.g. 2026-03-15)');
      return;
    }
    const { error } = await supabase.from('stock_units').update({ puspakom_b5_date: value }).eq('id', unit.id).eq('dealer_id', userId);
    if (error) { toast.error('Update failed'); return; }
    logActivity({ dealerId: userId, actor: profile, tableName: 'stock_units', recordId: unit.id, action: 'b5_updated', summary: `Puspakom B5 date set to ${value || 'cleared'}`, fieldChanges: { puspakom_b5_date: { from: unit.puspakom_b5_date, to: value } } });
    setUnits(p => p.map(u => u.id === unit.id ? { ...u, puspakom_b5_date: value } : u));
    setDetailUnit(prev => (prev && prev.id === unit.id) ? { ...prev, puspakom_b5_date: value } : prev);
    toast.success('PUSPAKOM B5 updated');
  };

  // ENT-1: Encumbrance status helpers
  const ENCUMBRANCE_CFG = {
    clear:    { label: 'Clear title',  color: '#22c55e' },
    under_hp: { label: 'Under HP',     color: '#ef4444' },
    unknown:  { label: 'Enc. unknown', color: '#f59e0b' },
  };
  const handleUpdateEncumbrance = async (unit) => {
    const options = ['clear', 'under_hp', 'unknown'];
    const current = unit.encumbrance_status || 'unknown';
    const next = options[(options.indexOf(current) + 1) % options.length];
    const { error } = await supabase.from('stock_units').update({ encumbrance_status: next }).eq('id', unit.id).eq('dealer_id', userId);
    if (error) { toast.error('Update failed'); return; }
    logActivity({ dealerId: userId, actor: profile, tableName: 'stock_units', recordId: unit.id, action: 'encumbrance_updated', summary: `Encumbrance status ${unit.encumbrance_status || 'unknown'} → ${next}`, fieldChanges: { encumbrance_status: { from: unit.encumbrance_status, to: next } } });
    setUnits(p => p.map(u => u.id === unit.id ? { ...u, encumbrance_status: next } : u));
    setDetailUnit(prev => (prev && prev.id === unit.id) ? { ...prev, encumbrance_status: next } : prev);
  };

  // T2-3: persist the condition appraisal from the detail drawer.
  const handleSaveAppraisal = async (unit) => {
    setApprSaving(true);
    const payload = apprDraft
      ? { ...apprDraft, appraised_at: new Date().toISOString(), appraised_by: userId }
      : null;
    const { error } = await supabase.from('stock_units').update({ appraisal: payload }).eq('id', unit.id).eq('dealer_id', userId);
    setApprSaving(false);
    if (error) { toast.error('Could not save appraisal'); return; }
    logActivity({ dealerId: userId, actor: profile, tableName: 'stock_units', recordId: unit.id, action: 'appraisal_updated', summary: payload ? `Condition appraisal saved — Grade ${payload.overall}` : 'Condition appraisal cleared' });
    setUnits(p => p.map(u => u.id === unit.id ? { ...u, appraisal: payload } : u));
    setDetailUnit(prev => (prev && prev.id === unit.id) ? { ...prev, appraisal: payload } : prev);
    toast.success('Appraisal saved');
  };

  const fetchPnl = async (unit) => {
    setPnlUnit(unit);
    setPnlData(null);
    setPnlLoading(true);
    const listingId = unit.listing_id || unit.car_listings?.id;
    let addons = [];
    let handoverTasks = [];
    let reconJobsList = [];
    let adSpendList = [];
    const [{ data: rj }, { data: ads }] = await Promise.all([
      supabase.from('recon_jobs').select('cost, status').eq('stock_unit_id', unit.id),
      supabase.from('ad_spend').select('amount').eq('stock_unit_id', unit.id),
    ]);
    reconJobsList = rj || [];
    adSpendList = ads || [];
    // BROKER-2: what an approved broker sale on this car owes the broker (one commission line).
    let pnlBroker = 0;
    try { pnlBroker = brokerAmount((await loadBrokerCommission(userId)).byCar, listingId); } catch { /* keep 0, the read failed */ }
    if (listingId) {
      const [{ data: dp }, { data: pst }] = await Promise.all([
        supabase
          .from('deal_products')
          .select('sold_price, dealer_products(name, cost_price)')
          .eq('listing_id', listingId)
          .eq('dealer_id', userId),
        supabase
          .from('post_sale_tasks')
          .select('step_key, status, cost')
          .eq('listing_id', listingId)
          .eq('dealer_id', userId),
      ]);
      addons = dp || [];
      handoverTasks = pst || [];
    }
    // The ONE profit engine (src/utils/carPnl.js): same numbers as the car pop-up's Owner button.
    const cl = unit.car_listings || {};
    const e = carPnl({
      purchase: unit.purchase_price, reconEstimate: unit.recon_cost, reconJobs: reconJobsList,
      servicesCost: cl.included_services_cost, commission: cl.commission_amount,
      brokerCommission: pnlBroker,
      handoverCost: handoverTasks.length ? handoverTasks.filter((t) => t.status !== 'na').reduce((s, t) => s + (Number(t.cost) || 0), 0) : null,
      adSpend: adSpendList.reduce((s, a) => s + (Number(a.amount) || 0), 0),
      addonRevenue: addons.reduce((s, a) => s + (Number(a.sold_price) || 0), 0),
      addonCost: addons.reduce((s, a) => s + (Number(a.dealer_products?.cost_price) || 0), 0),
      asking: Number(unit.asking_price) || Number(cl.selling_price) || 0, soldPrice: unit.sold_price,
      isSold: unit.status === 'sold', startDate: unit.purchase_date || unit.created_at, soldDate: unit.sold_date,
      engineCc: unit.engine_cc || cl.engine_cc, warrantyMonths: cl.warranty_months, cfg: costCfg || {},
    });
    const line = (k) => e.lines.find((l) => l.key === k)?.val || 0;
    setPnlData({
      purchasePrice: line('purchase'), reconCost: line('recon'),
      reconEst: Number(unit.recon_cost) || 0, reconActual: reconJobsList.reduce((s, j) => s + (Number(j.cost) || 0), 0),
      servicesCost: line('services'), commission: line('commission'),
      // Shown as one "Handover processing" line here: transfer (estimated until the deal), admin, warranty reserve.
      handoverCost: line('transfer') + line('admin') + line('warranty'),
      holdingCost: e.holding, holdingDays: e.days || 0, dailyHold: e.perDay.total, adSpend: line('ads'),
      addonRevenue: addons.reduce((s, a) => s + (Number(a.sold_price) || 0), 0), addonCost: addons.reduce((s, a) => s + (Number(a.dealer_products?.cost_price) || 0), 0),
      revenue: e.revenue, frontGross: e.front, backGross: e.back, totalCosts: e.costTotal + addons.reduce((s, a) => s + (Number(a.dealer_products?.cost_price) || 0), 0),
      netPnl: e.net, addons, isSold: e.isSold,
    });
    setPnlLoading(false);
  };

  const RECON_CATS = [
    { value: 'wash',        label: 'Wash & Detail' },
    { value: 'polish',      label: 'Polish / Paint' },
    { value: 'engine',      label: 'Engine / Mechanical' },
    { value: 'tyres',       label: 'Tyres' },
    { value: 'upholstery',  label: 'Upholstery / Interior' },
    { value: 'bodywork',    label: 'Bodywork / Dents' },
    { value: 'inspection',  label: 'Inspection' },
    { value: 'electrical',  label: 'Electrical' },
    { value: 'accessories', label: 'Accessories' },
    { value: 'other',       label: 'Other' },
  ];

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setCsvError('File must have a header row and at least one data row.'); setCsvRows([]); return; }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, '_'));
        const col = (alts) => headers.findIndex(h => alts.some(a => h.includes(a)));
        const iB  = col(['brand','make']);
        const iM  = col(['model']);
        const iY  = col(['year']);
        const iP  = col(['plate','reg']);
        const iCost = col(['purchase','cost','buying']);
        const iRecon = col(['recon']);
        const iAsk  = col(['asking','sell','price']);
        const rows = lines.slice(1).map((line, i) => {
          const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          return {
            _row: i + 2,
            brand:          iB  >= 0 ? cells[iB]  || '' : '',
            model:          iM  >= 0 ? cells[iM]  || '' : '',
            year:           iY  >= 0 ? cells[iY]  || '' : '',
            plate_number:   iP  >= 0 ? cells[iP]  || '' : '',
            purchase_price: iCost  >= 0 ? Number(cells[iCost])  || 0 : 0,
            recon_cost:     iRecon >= 0 ? Number(cells[iRecon]) || 0 : 0,
            asking_price:   iAsk   >= 0 ? Number(cells[iAsk])  || 0 : 0,
          };
        }).filter(r => r.brand || r.model);
        if (rows.length === 0) { setCsvError('No valid rows found. Ensure columns: brand/make, model, year.'); setCsvRows([]); return; }
        // Every car needs its buy price (a "purchase" / "cost" column). Rows without one are named,
        // and nothing imports until the file is fixed: a half-imported list is worse than none.
        const noCost = rows.filter(r => !(r.purchase_price > 0)).map(r => r._row);
        if (noCost.length) {
          setCsvError(iCost < 0
            ? 'Add a buy price column (named "purchase" or "cost") and upload again.'
            : `No buy price on row${noCost.length === 1 ? '' : 's'} ${noCost.slice(0, 12).join(', ')}${noCost.length > 12 ? '…' : ''}. Fill ${noCost.length === 1 ? 'it' : 'them'} in and upload again.`);
          setCsvRows([]); return;
        }
        setCsvError('');
        setCsvRows(rows);
      } catch { setCsvError('Failed to parse CSV. Please check the file format.'); setCsvRows([]); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCsvImport = async () => {
    if (!csvRows.length) return;
    setCsvSaving(true);
    const payload = csvRows.map(r => ({
      dealer_id: userId, status: 'in_stock',
      brand: r.brand || null, model: r.model || null, year: r.year ? Number(r.year) : null,
      registration_number: r.plate_number || null,
      purchase_price: r.purchase_price || 0,
      recon_cost: r.recon_cost || 0,
      asking_price: r.asking_price || 0,
      encumbrance_status: 'unknown',
    }));
    const { error } = await supabase.from('stock_units').insert(payload);
    if (error) { toast.error('Import failed: ' + error.message); }
    else {
      toast.success(`${payload.length} units imported`);
      setShowCsvImport(false);
      setCsvRows([]);
      fetchUnits();
    }
    setCsvSaving(false);
  };

  const VENDOR_CATS = [
    { value: 'workshop',    label: 'Workshop / Mechanic' },
    { value: 'tint',        label: 'Window Tint' },
    { value: 'bodywork',    label: 'Bodywork / Panel' },
    { value: 'upholstery',  label: 'Upholstery' },
    { value: 'electrical',  label: 'Electrical' },
    { value: 'inspection',  label: 'Inspection (PUSPAKOM)' },
    { value: 'accessories', label: 'Accessories' },
    { value: 'insurance',   label: 'Insurance' },
    { value: 'other',       label: 'Other' },
  ];

  const fetchVendors = async () => {
    setVendorsLoading(true);
    const { data } = await supabase.from('vendors').select('*').eq('dealer_id', userId).order('name', { ascending: true });
    setVendors(data || []);
    setVendorsLoading(false);
  };

  const handleAddVendor = async () => {
    if (!vendorForm.name.trim()) { toast.error('Enter vendor name'); return; }
    setVendorSaving(true);
    const { data, error } = await supabase.from('vendors').insert({
      dealer_id: userId, name: vendorForm.name.trim(), category: vendorForm.category,
      contact: vendorForm.contact.trim() || null, phone: vendorForm.phone.trim() || null,
      address: vendorForm.address.trim() || null, notes: vendorForm.notes.trim() || null,
    }).select().single();
    if (error) { toast.error('Failed to add vendor'); }
    else {
      logActivity({ dealerId: userId, actor: profile, tableName: 'vendors', recordId: data.id, action: 'created', summary: `Vendor added — ${data.name} (${data.category})` });
      setVendors(p => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowVendorAdd(false);
      setVendorForm({ name: '', category: 'workshop', contact: '', phone: '', address: '', notes: '' });
      toast.success('Vendor added');
    }
    setVendorSaving(false);
  };

  const handleToggleVendor = async (id, is_active) => {
    const { error } = await supabase.from('vendors').update({ is_active }).eq('id', id);
    if (!error) setVendors(p => p.map(v => v.id === id ? { ...v, is_active } : v));
  };

  const fetchReconJobs = async (unit) => {
    setReconUnit(unit);
    setReconJobs([]);
    setReconLoading(true);
    setShowReconAdd(false);
    setReconForm({ title: '', category: 'other', vendor: '', cost: '', eta_date: '', notes: '' });
    const { data } = await supabase
      .from('recon_jobs')
      .select('*')
      .eq('stock_unit_id', unit.id)
      .order('created_at', { ascending: true });
    setReconJobs(data || []);
    setReconLoading(false);
  };

  const openAdSpend = async (unit) => {
    setAdUnit(unit);
    setAdEntries([]);
    setAdLoading(true);
    setAdForm({ channel: 'mudah', amount: '', spent_at: new Date().toISOString().slice(0, 10), notes: '' });
    const { data } = await supabase.from('ad_spend').select('*').eq('stock_unit_id', unit.id).order('spent_at', { ascending: false });
    setAdEntries(data || []);
    setAdLoading(false);
  };
  const handleAddAdSpend = async () => {
    if (!adForm.amount || Number(adForm.amount) <= 0) { toast.error('Enter an amount'); return; }
    setAdSaving(true);
    const { data, error } = await supabase.from('ad_spend').insert({
      dealer_id: userId,
      stock_unit_id: adUnit.id,
      listing_id: adUnit.listing_id || null,
      channel: adForm.channel,
      amount: Number(adForm.amount),
      spent_at: adForm.spent_at || null,
      notes: adForm.notes.trim() || null,
    }).select().single();
    if (error) { toast.error('Failed to add spend'); }
    else {
      setAdEntries(p => [data, ...p]);
      setAdForm({ channel: 'mudah', amount: '', spent_at: new Date().toISOString().slice(0, 10), notes: '' });
    }
    setAdSaving(false);
  };
  const handleDeleteAdSpend = async (id) => {
    const { error } = await supabase.from('ad_spend').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    setAdEntries(p => p.filter(e => e.id !== id));
  };

  const handleAddReconJob = async () => {
    if (!reconForm.title.trim()) { toast.error('Enter a job title'); return; }
    setReconSaving(true);
    const { data, error } = await supabase.from('recon_jobs').insert({
      dealer_id: userId,
      stock_unit_id: reconUnit.id,
      title: reconForm.title.trim(),
      category: reconForm.category,
      vendor: reconForm.vendor.trim() || null,
      cost: reconForm.cost ? Number(reconForm.cost) : null,
      eta_date: reconForm.eta_date || null,
      notes: reconForm.notes.trim() || null,
      status: 'pending',
    }).select().single();
    if (error) { toast.error('Failed to add job'); }
    else {
      logActivity({ dealerId: userId, actor: profile, tableName: 'recon_jobs', recordId: data.id, action: 'created', summary: `Recon job — ${data.title}${data.cost ? ` · RM ${Number(data.cost).toLocaleString()}` : ''}${data.vendor ? ` · ${data.vendor}` : ''}` });
      setReconJobs(p => [...p, data]); setShowReconAdd(false); setReconForm({ title: '', category: 'other', vendor: '', cost: '', eta_date: '', notes: '' });
    }
    setReconSaving(false);
  };

  const handleReconStatus = async (jobId, newStatus) => {
    const patch = { status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null };
    const { error } = await supabase.from('recon_jobs').update(patch).eq('id', jobId);
    if (!error) setReconJobs(p => p.map(j => j.id === jobId ? { ...j, ...patch } : j));
  };

  const fetchHistory = async (unit) => {
    setHistoryUnit(unit);
    setHistoryLogs([]);
    setHistoryLoading(true);
    // A car's history is split across two record ids: the stock_unit (cost, sold,
    // compliance) and the linked car_listing (creation, price, status). Pull both
    // so the timeline is the full story, not half of it.
    const { data } = await supabase
      .from('activity_log')
      .select('actor_name, actor_role, action, summary, created_at')
      .eq('dealer_id', userId)
      .in('record_id', [unit.id, unit.listing_id].filter(Boolean))
      .order('created_at', { ascending: false })
      .limit(50);
    setHistoryLogs(data || []);
    setHistoryLoading(false);
  };

  const handleSavePrices = async () => {
    if (!editPriceUnit) return;
    if (!(Number(editPriceForm.purchase_price) > 0)) { toast.error('Enter the buy price. It cannot be empty or 0.'); return; }
    setEditPriceSaving(true);
    const patch = {
      purchase_price: Number(editPriceForm.purchase_price) || 0,
      recon_cost:     Number(editPriceForm.recon_cost)     || 0,
    };
    const { error } = await supabase.from('stock_units').update(patch).eq('id', editPriceUnit.id).eq('dealer_id', userId);
    if (!error) {
      const changes = [];
      const fc = {};
      if (patch.purchase_price !== (Number(editPriceUnit.purchase_price)||0)) { changes.push(`purchase RM ${(Number(editPriceUnit.purchase_price)||0).toLocaleString()} → RM ${patch.purchase_price.toLocaleString()}`); fc.purchase_price = { from: Number(editPriceUnit.purchase_price)||0, to: patch.purchase_price }; }
      if (patch.recon_cost     !== (Number(editPriceUnit.recon_cost)||0))     { changes.push(`recon RM ${(Number(editPriceUnit.recon_cost)||0).toLocaleString()} → RM ${patch.recon_cost.toLocaleString()}`); fc.recon_cost = { from: Number(editPriceUnit.recon_cost)||0, to: patch.recon_cost }; }
      if (changes.length) {
        logActivity({ dealerId: userId, actor: profile, tableName: 'stock_units', recordId: editPriceUnit.id, action: 'costs_updated', summary: `Costs updated — ${changes.join('; ')}`, fieldChanges: fc });
      }
      setUnits(u => u.map(x => x.id === editPriceUnit.id ? { ...x, ...patch } : x));
      setDetailUnit(prev => (prev && prev.id === editPriceUnit.id) ? { ...prev, ...patch } : prev);
      toast.success('Costs updated');
      setEditPriceUnit(null);
    } else {
      toast.error('Failed to save costs');
    }
    setEditPriceSaving(false);
  };

  const statusBadge = (s) => {
    const map = { in_stock: '#047857', sold: '#6b7280', reserved: '#4b5563' };
    const color = map[s] || '#6b7280';
    return <span style={{ fontSize: 10, fontWeight: 700, color, background: '#f5f6f8', borderRadius: 6, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s?.replace('_',' ') || '—'}</span>;
  };

  const summaryCards = [
    { label: 'Revenue (sold)',       val: `RM ${soldRevenue.toLocaleString()}`, Icon: Banknote,     grad: ''                          },
    { label: 'Stock Value',          val: `RM ${totalValue.toLocaleString()}`,  Icon: Banknote,      grad: ''                                                           },
    { label: 'Avg Days in Stock',    val: avgDays,                              Icon: Clock,         grad: avgDays > 60 ? 'text-red-700' : '' },
    { label: 'Gross Profit (month)', val: `RM ${totalGP.toLocaleString()}`,     Icon: TrendingUp,    grad: '', spark: gpSparkData, sparkColor: '#111827' },
    { label: 'Sold This Month',      val: thisMonth.length,                     Icon: CheckCircle2,  grad: ''                                                         },
    { label: 'Aging Stock (60d+)',   val: agingUnits.length,                    Icon: AlertTriangle, grad: agingUnits.length > 0 ? 'text-red-700' : ''              },
  ];

  return (
    <>
    <div className="space-y-6">
      {!hideSummary && <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
        {summaryCards.map(({ label, val, Icon: Ic, grad, spark, sparkColor }) => (
          <div key={label} className="stat-card card-top rounded-2xl overflow-hidden glass" style={{ position: 'relative' }}>
            {spark && (
              <div className="px-3.5 pt-3">
                <Sparkline data={spark} color={sparkColor || '#3b82f6'} width={120} height={32} />
              </div>
            )}
            <div className={spark ? 'p-3 sm:p-4 pt-2' : 'p-3 sm:p-4'}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-500 text-xs font-medium tracking-widest uppercase">{label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center pl-well"><Ic className="w-4 h-4" /></div>
              </div>
              <p className={`text-xl sm:text-2xl font-black leading-none tabular-nums ${grad || 'text-gray-900'}`}>{val}</p>
            </div>
          </div>
        ))}
      </div>}

      <div style={{ ...INV_CARD, overflow: 'hidden' }}>
        <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvFile} />
        {/* One card: search + sort + Needs attention + Add car, then the status
            pills, then the cars. Import CSV / AI import live in the Add car sheet. */}
        <div style={{ padding: '16px 16px 0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 0 }}>
            <Search style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: premiumLight.textMuted, pointerEvents: 'none' }} />
            <input value={stockSearch} onChange={e => setStockSearch(e.target.value)} placeholder="Search brand, model, plate, VIN"
              style={{ ...INV_INPUT, padding: '9px 30px 9px 32px' }} />
            {stockSearch && (
              <button onClick={() => setStockSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: premiumLight.textMuted, cursor: 'pointer', display: 'flex', padding: 0 }}><X style={{ width: 14, height: 14 }} /></button>
            )}
          </div>
          {onAdd && <AddCarButton onClick={onAdd} className="inv-add-last" />}
          <NeedsAttentionMenu
            checks={STOCK_FILTER_CHIPS.map(c => ({ ...c, count: (stockView === 'available' ? activeUnits : soldUnits).filter(u => stockFilterFns[c.key]?.(u)).length }))}
            active={stockFilters}
            onToggle={toggleStockFilter}
            onClear={() => setStockFilters(new Set())}
          />
          <select value={stockSort} onChange={e => setStockSort(e.target.value)} aria-label="Sort"
            style={{ ...INV_GHOST_BTN, width: 'auto', minWidth: 0, maxWidth: 160, flex: '1 1 90px', padding: '9px 10px', appearance: 'auto' }}>
            {STOCK_SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

        </div>
        <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <StatusPills
            active={stockView}
            onChange={setStockView}
            items={[
              { key: 'available', label: 'In stock', count: activeUnits.length },
              // Sold moves to the Sold tab once it exists (owner, 2026-11-09).
              { key: 'sold',      label: 'Sold',     count: soldUnits.length },
            ]}
          />
          <button onClick={() => { setShowVendors(true); fetchVendors(); }} style={{ ...INV_GHOST_BTN, background: 'transparent', padding: '7px 8px', color: premiumLight.textSec }}>
            <Wrench style={{ width: 14, height: 14 }} /> Vendors
          </button>
        </div>
        <div style={{ height: 1, background: premiumLight.line }} />
        <div>
          {loading ? (
            <p style={{ color: '#9ca3af', fontSize: 13, padding: '24px 20px' }}>Loading…</p>
          ) : units.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: 13, padding: '24px 20px' }}>No stock units yet.</p>
          ) : (() => {
            const baseUnits = stockView === 'available' ? activeUnits : soldUnits;
            const displayUnits = applyStockFilters(baseUnits);
            const visibleUnits = displayUnits.slice(0, visibleCount);
            const hasMore = displayUnits.length > visibleCount;
            const currentYear = new Date().getFullYear();
            const filtersActive = stockFilters.size > 0 || stockSearch.trim();
            return (
              <>
                {filtersActive && displayUnits.length > 0 && (
                  <p style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, padding: '8px 16px 0' }}>
                    {displayUnits.length} of {baseUnits.length} {baseUnits.length === 1 ? 'unit' : 'units'}
                  </p>
                )}
                {displayUnits.length === 0 ? (
                  <p style={{ color: '#6b7280', fontSize: 13, padding: '24px 20px' }}>{filtersActive ? 'No units match your search or filters.' : 'No units in this view.'}</p>
                ) : visibleUnits.map(u => {
                  const car = u.car_listings || { brand: u.brand, model: u.model, year: u.year, plate_number: u.registration_number };
                  const thumb = u.car_listings?.images?.[0] || null;
                  const gp = netProfit(u);
                  const days = daysInStock(u);
                  const daysNum = typeof days === 'number' ? days : 0;
                  const isAging = u.status === 'in_stock' && daysNum > AGEING_DAYS;
                  const carYear = car?.year ? Number(car.year) : null;
                  const carAge = carYear ? currentYear - carYear : null;
                  const plate = car.plate_number || u.registration_number;
                  const ps = puspakomStatus(u.puspakom_b7_date);
                  const b5 = b5Status(u.puspakom_b5_date);
                  const enc = ENCUMBRANCE_CFG[u.encumbrance_status || 'unknown'];
                  const isUnpublished = !u.listing_id || u.car_listings?.status === 'unpublished';
                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        // A stock car with a listing opens the SAME pop-up as Inventory (Owner button first);
                        // only a stock car with no listing keeps this older stock pop-up.
                        const l = u.listing_id && onOpenListing ? listings.find(x => x.id === u.listing_id) : null;
                        if (l) onOpenListing(l); else setDetailUnit(u);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                        borderBottom: `1px solid ${premiumLight.line}`, cursor: 'pointer',
                        background: 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = premiumLight.raised}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Thumbnail */}
                      <div style={{ width: 68, height: 50, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {thumb ? (
                          <img src={cdnImg(thumb, 160, 70)} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { if (!e.target.dataset.fb) { e.target.dataset.fb = '1'; e.target.src = thumb; } else { e.target.style.display = 'none'; } }} />
                        ) : (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h10l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
                            <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
                          </svg>
                        )}
                      </div>

                      {/* Info: name, one quiet line, price + days. The checks (B7, B5,
                          loan, published), grade and net profit open on tap in the car's
                          record (owner, 2026-11-09: "too crowded, details on click").
                          One red "N to sort" says there is something waiting there. */}
                      {(() => {
                        const toSort = u.status === 'in_stock'
                          ? [ps.color !== '#22c55e', b5.color !== '#22c55e', (u.encumbrance_status || 'unknown') === 'unknown', isUnpublished].filter(Boolean).length
                          : 0;
                        const meta = [carAge != null ? `${carAge}yr` : null, plate ? plate.toUpperCase() : null].filter(Boolean).join(' · ');
                        return (
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: premiumLight.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {car.brand} {car.model}
                              </p>
                              <p style={{ fontSize: 12, color: premiumLight.textMuted, margin: '3px 0 0', display: 'flex', gap: 6, minWidth: 0 }}>
                                <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta || 'No plate yet'}</span>
                                {toSort > 0 && <span style={{ flexShrink: 0, whiteSpace: 'nowrap', color: premiumLight.accentText, fontWeight: 600 }}>{toSort} to sort</span>}
                              </p>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <p style={{ fontSize: 14, fontWeight: 700, color: premiumLight.text, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                                RM {(stockView === 'available'
                                  ? (Number(u.asking_price) || Number(u.car_listings?.selling_price) || 0)
                                  : (Number(u.sold_price) || 0)).toLocaleString()}
                              </p>
                              <p style={{ fontSize: 12, margin: '3px 0 0', color: isAging ? premiumLight.accentText : premiumLight.textMuted, fontWeight: isAging ? 600 : 400 }}>
                                {stockView === 'available'
                                  ? (days !== '—' ? `${days} days` : '—')
                                  : (u.sold_date ? new Date(u.sold_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) : '—')}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                      <ChevronRight style={{ width: 16, height: 16, color: premiumLight.textMuted, flexShrink: 0 }} />
                    </div>
                  );
                })}
                {hasMore && (
                  <div style={{ padding: '14px', textAlign: 'center', borderTop: '1px solid rgba(17,24,39,0.06)' }}>
                    <button
                      onClick={() => setVisibleCount(c => c + 30)}
                      style={{ ...INV_GHOST_BTN }}
                    >
                      Load {Math.min(30, displayUnits.length - visibleCount)} more
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* ── Stock Unit Detail Drawer ── */}
      {detailUnit && createPortal((() => {
        const u = detailUnit;
        const car = u.car_listings || { brand: u.brand, model: u.model, year: u.year, plate_number: u.registration_number };
        const thumb = u.car_listings?.images?.[0] || null;
        const plate = car.plate_number || u.registration_number;
        const gp = netProfit(u);
        const days = daysInStock(u);
        const daysNum = typeof days === 'number' ? days : 0;
        const isAging = u.status === 'in_stock' && daysNum > AGEING_DAYS;
        const ps  = puspakomStatus(u.puspakom_b7_date);
        const b5  = b5Status(u.puspakom_b5_date);
        const enc = ENCUMBRANCE_CFG[u.encumbrance_status || 'unknown'];
        const isUnpublished = !u.listing_id || u.car_listings?.status === 'unpublished';
        const currentYear = new Date().getFullYear();
        const carYear = car?.year ? Number(car.year) : null;
        const carAge = carYear ? currentYear - carYear : null;

        // premiumLight (owner, 2026-11-09): every action is the same grey row with
        // ink words. Only the main action ('primary') is red. No per-row colours.
        const ACTION_BTN = (label, desc, kind, _bg, _border, onClick) => {
          const primary = kind === 'primary';
          return (
            <button onClick={onClick}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: primary ? premiumLight.accent : premiumLight.raised, border: 'none', borderRadius: premiumLight.radius.row, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: "system-ui,sans-serif", transition: 'background 0.15s' }}
              onMouseEnter={e => { if (!primary) e.currentTarget.style.background = premiumLight.hover; }} onMouseLeave={e => { if (!primary) e.currentTarget.style.background = premiumLight.raised; }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: primary ? '#fff' : premiumLight.text, margin: 0 }}>{label}</p>
                <p style={{ fontSize: 11, color: primary ? 'rgba(255,255,255,0.85)' : premiumLight.textMuted, margin: '2px 0 0' }}>{desc}</p>
              </div>
              <ChevronRight style={{ width: 15, height: 15, color: primary ? '#fff' : premiumLight.textMuted, flexShrink: 0 }} />
            </button>
          );
        };

        // Only show spec rows that have values
        const SPEC_ROWS = [
          { label: 'Variant',        val: car.variant || null },
          { label: 'Mileage',        val: car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null },
          { label: 'Transmission',   val: car.transmission || null },
          { label: 'Fuel Type',      val: car.fuel_type || null },
          { label: 'Body Type',      val: car.body_type || null },
          { label: 'Colour',         val: car.colour || null },
          { label: 'Engine',         val: car.engine_cc ? `${car.engine_cc} cc` : null },
          { label: 'Condition',      val: car.condition || null },
          { label: 'VIN',            val: car.vin_number || null },
          { label: 'Reg Date',       val: car.registration_date ? new Date(car.registration_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : null },
          { label: 'Prev. Owners',   val: car.previous_owners != null ? String(car.previous_owners) : null },
          { label: 'Road Tax Exp.',  val: car.road_tax_expiry ? new Date(car.road_tax_expiry).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : null },
          { label: 'Warranty',       val: car.warranty_months ? `${car.warranty_months} months` : null },
          { label: 'Auction Grade',  val: car.is_recon && car.auction_grade ? car.auction_grade : null },
          { label: 'Interior Grade', val: car.is_recon && car.interior_grade ? car.interior_grade : null },
          { label: 'Import',         val: car.import_country || null },
        ].filter(s => s.val);

        return (
          <div
            onClick={() => setDetailUnit(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 12 : 24, overscrollBehavior: 'contain' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: premiumLight.radius.card, width: '100%', maxWidth: isMobile ? 540 : 880,
                maxHeight: isMobile ? '88vh' : '90vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
                fontFamily: "system-ui,sans-serif",
              }}
            >
              {/* Drag handle pill — mobile only */}
              {isMobile && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
                </div>
              )}

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 14px', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                <div style={{ width: 72, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {thumb ? (
                    <img src={cdnImg(thumb, 160, 70)} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { if (!e.target.dataset.fb) { e.target.dataset.fb = '1'; e.target.src = thumb; } else { e.target.style.display = 'none'; } }} />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h10l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/></svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {car.brand} {car.model}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                    {car.year && <span style={{ fontSize: 12, color: '#6b7280' }}>{car.year}</span>}
                    {carAge != null && <span style={{ fontSize: 12, color: premiumLight.textMuted }}>· {carAge}yr</span>}
                    {plate ? (
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: premiumLight.textSec, background: premiumLight.raised, borderRadius: 6, padding: '2px 7px' }}>{plate.toUpperCase()}</span>
                    ) : (
                      <span style={{ fontSize: 10, color: '#9ca3af', border: '1px dashed #d1d5db', borderRadius: 4, padding: '1px 6px' }}>no plate</span>
                    )}
                    {isAging && <span style={{ fontSize: 11, fontWeight: 700, color: premiumLight.accentText }}>{daysNum}d in stock</span>}
                  </div>
                </div>
                <button onClick={() => setDetailUnit(null)} style={{ width: 30, height: 30, borderRadius: '50%', background: '#f3f4f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0 }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Financial stats strip */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${[1, can('view_cost') ? 1 : 0, can('view_gross') ? 1 : 0].reduce((a, b) => a + b)}, 1fr)`, gap: 1, background: '#f3f4f6', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                {[
                  { label: 'Asking',   val: (Number(u.asking_price) || Number(u.car_listings?.selling_price)) ? `RM ${(Number(u.asking_price) || Number(u.car_listings?.selling_price)).toLocaleString()}` : '—', color: '#111827' },
                  can('view_cost')  ? { label: 'Cost',    val: costBasis(u) > 0 ? `RM ${costBasis(u).toLocaleString()}` : '—', color: '#374151' } : null,
                  can('view_gross') ? { label: 'Net P&L', val: gp != null ? `${gp >= 0 ? '+' : '−'}RM ${Math.abs(gp).toLocaleString()}` : '—', color: gp == null ? premiumLight.textMuted : gp >= 0 ? premiumLight.up : premiumLight.accentText } : null,
                ].filter(Boolean).map((s, i) => (
                  <div key={i} style={{ background: '#fff', padding: '10px 14px', textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 2px' }}>{s.label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: s.color, margin: 0 }}>{s.val}</p>
                  </div>
                ))}
              </div>

              {/* Body — single column on mobile, two columns on desktop (wide, minimal scroll) */}
              <div style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: isMobile ? undefined : '1fr 1fr', alignItems: 'start' }}>
              {/* LEFT column: Car details spec grid — all fields from car_listings */}
              <div style={{ borderRight: isMobile ? 'none' : '1px solid #f3f4f6' }}>
              {SPEC_ROWS.length > 0 && (
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                  <p style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 10px' }}>Car Details</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 20px' }}>
                    {SPEC_ROWS.map((s, i) => (
                      <div key={i}>
                        <p style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                        <p style={{ fontSize: 12, color: '#111827', fontWeight: 500, margin: 0 }}>{s.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              </div>{/* /LEFT column */}
              {/* RIGHT column: certifications + actions */}
              <div>
              {/* Certifications & status — clickable to update inline */}
              {u.status === 'in_stock' && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                  <p style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 8px' }}>Certifications &amp; Status</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button onClick={() => handleUpdatePuspakom(u)} title="PUSPAKOM B7 — hire-purchase inspection, valid 30 days. Tap to update." style={plPill(ps.color)}>B7 · {ps.label.replace('B7 ', '')}</button>
                    <button onClick={() => handleUpdateB5(u)} title="PUSPAKOM B5 — ownership-transfer inspection. Tap to update." style={plPill(b5.color)}>B5 · {b5.label.replace('B5 ', '')}</button>
                    <button onClick={() => handleUpdateEncumbrance(u)} title="Tap to cycle: clear → under HP → unknown" style={plPill(enc.color)}>{enc.label}</button>
                    {isUnpublished && (
                      <button onClick={() => handlePublishFromStock(u)} disabled={publishingStockId === u.id}
                        style={{ ...plPill('#dc2626'), fontWeight: 700, cursor: publishingStockId === u.id ? 'default' : 'pointer', opacity: publishingStockId === u.id ? 0.6 : 1 }}>
                        {publishingStockId === u.id ? 'Publishing…' : 'Not published — tap to publish'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Actions — child modals open ON TOP of this drawer (z-10000 > z-9999) */}
              <div style={{ padding: '12px 16px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 2px' }}>Actions</p>
                {u.status === 'in_stock' && ACTION_BTN('Mark as Sold', 'Record the final sale price and close out this unit', 'primary', null, null, () => setSoldTarget(u))}
                {can('view_gross') && ACTION_BTN('View P&L',         'Full profit breakdown — cost, recon, commission, holding, add-ons', null, null, null, () => fetchPnl(u))}
                {ACTION_BTN('Recon Jobs',        'Log and track all reconditioning work and costs', null, null, null, () => fetchReconJobs(u))}
                {can('view_cost') && ACTION_BTN('Ad Spend',   'Track advertising spend (Mudah, Carsome, Facebook, etc.)', null, null, null, () => openAdSpend(u))}
                {can('view_cost') && ACTION_BTN('Edit Costs','Update purchase price and recon cost (sale price is set on the listing)', null, null, null, () => { setEditPriceUnit(u); setEditPriceForm({ purchase_price: String(u.purchase_price||''), recon_cost: String(u.recon_cost||'') }); })}
                {ACTION_BTN('Activity History',  'See all edits, updates, and status changes for this unit', null, null, null, () => fetchHistory(u))}
              </div>
              </div>{/* /RIGHT column */}
              </div>{/* /body grid */}

              {/* T2-3: editable condition appraisal (full width) */}
              <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(17,24,39,0.06)' }}>
                <AppraisalChecklist value={apprDraft} onChange={setApprDraft} />
                <div style={{ marginTop: 12 }}>
                  <button onClick={() => handleSaveAppraisal(u)} disabled={apprSaving}
                    style={{ fontSize: 13, fontWeight: 600, padding: '10px 18px', borderRadius: premiumLight.radius.row, cursor: apprSaving ? 'default' : 'pointer', color: '#fff', background: premiumLight.text, border: 'none', opacity: apprSaving ? 0.6 : 1 }}>
                    {apprSaving ? 'Saving…' : 'Save appraisal'}
                  </button>
                </div>
              </div>

              <div style={{ height: 16 }} />
            </div>
          </div>
        );
      })(), document.body)}

      {/* Mark Sold — the shared popup; the unit's own cost drives a margin rule */}
      {soldTarget && createPortal(
        <div style={{ position: 'relative', zIndex: 10000 }}>
          <MarkSoldModal
            listing={{
              ...(soldTarget.car_listings || {}),
              ...(listings.find(l => l.id === soldTarget.listing_id) || {}),
              id: soldTarget.listing_id || null,
              selling_price: soldTarget.asking_price ?? soldTarget.car_listings?.selling_price ?? null,
            }}
            salesmen={salesmen}
            showDate
            cost={(Number(soldTarget.purchase_price) || 0) + (Number(soldTarget.recon_cost) || 0) || null}
            onClose={() => setSoldTarget(null)}
            onConfirm={handleMarkSold}
            loading={soldSaving}
          />
        </div>
      , document.body)}

      {/* Stock Movement History Modal */}
      {historyUnit && createPortal(
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)', zIndex: 10000 }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <div>
                <h3 className="font-semibold text-gray-900">Movement History</h3>
                <p className="text-xs text-gray-500 mt-0.5">{historyUnit.car_listings?.brand} {historyUnit.car_listings?.model} {historyUnit.car_listings?.year}</p>
              </div>
              <button onClick={() => setHistoryUnit(null)} className="text-gray-500 hover:text-gray-900 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {historyLoading ? (
                <p className="text-gray-500 text-sm text-center py-8">Loading...</p>
              ) : historyLogs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No history recorded for this unit.</p>
              ) : (
                <div className="space-y-3">
                  {historyLogs.map((log, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: 5 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, color: '#111827', fontWeight: 500, margin: 0 }}>{log.summary}</p>
                        <p style={{ fontSize: 11, color: '#6b7280', margin: '3px 0 0' }}>
                          {log.actor_name}{log.actor_role ? ` · ${log.actor_role}` : ''}{' · '}
                          {new Date(log.created_at).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* Edit Costs Modal */}
      {editPriceUnit && createPortal(
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.78)', zIndex: 10000 }}>
          <div className="modal-top rounded-2xl w-full max-w-sm" style={{ background: '#fff' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900" style={{ fontSize: 15 }}>Edit Costs</h3>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{editPriceUnit.car_listings?.brand} {editPriceUnit.car_listings?.model} {editPriceUnit.car_listings?.year}</p>
              </div>
              <button onClick={() => setEditPriceUnit(null)} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {[['Purchase Price', 'purchase_price'], ['Recon Cost', 'recon_cost']].map(([label, key]) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">{label}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">RM</span>
                    <input type="number" value={editPriceForm[key]} onChange={e => setEditPriceForm(p => ({ ...p, [key]: e.target.value }))}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-red-400" />
                  </div>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditPriceUnit(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600">Cancel</button>
                <button onClick={handleSavePrices} disabled={editPriceSaving}
                  className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: '#111827', opacity: editPriceSaving ? 0.6 : 1 }}>
                  {editPriceSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* P&L Modal */}
      {pnlUnit && createPortal(
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)', zIndex: 10000 }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '80vh', background: '#fff' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900" style={{ fontSize: 15 }}>Unit P&L</h3>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {pnlUnit.car_listings?.brand} {pnlUnit.car_listings?.model} {pnlUnit.car_listings?.year}
                  {pnlUnit.car_listings?.plate_number || pnlUnit.registration_number ? ` · ${pnlUnit.car_listings?.plate_number || pnlUnit.registration_number}` : ''}
                </p>
              </div>
              <button onClick={() => { setPnlUnit(null); setPnlData(null); }} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {pnlLoading ? (
                <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
              ) : pnlData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* Plain-English verdict — tells the dealer what the number means and why */}
                  {(() => {
                    const v = pnlData;
                    const marginPct = v.revenue > 0 ? (v.netPnl / v.revenue) * 100 : 0;
                    const spread = v.revenue - v.purchasePrice;
                    const spreadPct = v.purchasePrice > 0 ? (spread / v.purchasePrice) * 100 : 0;
                    const loss = v.netPnl < 0;
                    const thin = !loss && marginPct < 5;
                    const reasons = [];
                    if (v.holdingCost > 0 && (v.holdingDays > 60 || v.holdingCost >= Math.abs(v.netPnl) * 0.4))
                      reasons.push(`RM ${v.holdingCost.toLocaleString()} carrying cost from ${v.holdingDays} days on the floor`);
                    if (spread <= v.purchasePrice * 0.03)
                      reasons.push(`only RM ${spread.toLocaleString()} markup over buy price (${spreadPct.toFixed(1)}%)`);
                    if (v.reconEst > 0 && v.reconActual > v.reconEst)
                      reasons.push(`recon overran the estimate by RM ${(v.reconActual - v.reconEst).toLocaleString()}`);
                    if (v.commission > 0 && v.commission >= Math.abs(v.netPnl) * 0.5)
                      reasons.push(`RM ${v.commission.toLocaleString()} sales commission`);
                    if (v.adSpend > 0 && v.adSpend >= Math.abs(v.netPnl) * 0.4)
                      reasons.push(`RM ${v.adSpend.toLocaleString()} ad spend`);
                    // premiumLight: one grey block; only the headline word carries the verdict.
                    const word = loss || thin ? premiumLight.accentText : premiumLight.up;
                    const tone = { bg: premiumLight.raised, bd: 'transparent', tx: premiumLight.textSec, ic: word, head: word };
                    const headline = loss
                      ? `Losing RM ${Math.abs(v.netPnl).toLocaleString()} on this unit`
                      : thin
                        ? `Slim RM ${v.netPnl.toLocaleString()} profit · ${marginPct.toFixed(1)}% margin`
                        : `Healthy RM ${v.netPnl.toLocaleString()} profit · ${marginPct.toFixed(1)}% margin`;
                    const body = reasons.length
                      ? (loss ? 'Driven by ' : 'Watch: ') + reasons.join('; ') + '.'
                      : loss
                        ? 'Costs have eaten through the asking price — reprice up or trim reconditioning.'
                        : `RM ${spread.toLocaleString()} spread over buy price survives all costs.`;
                    const aging = v.holdingDays > 60 && !v.isSold && v.dailyHold > 0;
                    return (
                      <div style={{ background: tone.bg, borderRadius: premiumLight.radius.row, padding: '12px 14px', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {loss ? <AlertTriangle style={{ width: 16, height: 16, color: tone.ic, flexShrink: 0 }} />
                                : <TrendingUp style={{ width: 16, height: 16, color: tone.ic, flexShrink: 0 }} />}
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: tone.head }}>{headline}</span>
                        </div>
                        <p style={{ fontSize: 12, color: tone.tx, opacity: 0.92, margin: '6px 0 0', lineHeight: 1.45 }}>{body}</p>
                        {aging && <p style={{ fontSize: 11, color: tone.tx, opacity: 0.82, margin: '5px 0 0', lineHeight: 1.4 }}>Aged {v.holdingDays} days — every extra day adds RM {Math.round(v.dailyHold).toLocaleString()}. Repricing to move it stops the bleed.</p>}
                        {!v.isSold && <p style={{ fontSize: 10.5, color: '#9ca3af', margin: '6px 0 0' }}>Projection based on the current asking price.</p>}
                      </div>
                    );
                  })()}
                  {/* Front end */}
                  <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Front End (Vehicle)</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: '#374151' }}>{pnlData.isSold ? 'Sale price' : 'Asking price'}</span>
                      <span style={{ color: '#111827', fontWeight: 600 }}>RM {pnlData.revenue.toLocaleString()}</span>
                    </div>
                    {[
                      ['Purchase price', pnlData.purchasePrice],
                      ['Recon cost', pnlData.reconCost],
                      ['Included services', pnlData.servicesCost],
                      ['Commission paid', pnlData.commission],
                      ['Handover processing', pnlData.handoverCost],
                      ['Advertising', pnlData.adSpend],
                      [`Holding (${pnlData.holdingDays}d)`, pnlData.holdingCost],
                    ].filter(([, v]) => v > 0).map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: '#6b7280' }}>{label}</span>
                        <span style={{ color: premiumLight.textSec }}>− RM {Number(val).toLocaleString()}</span>
                      </div>
                    ))}
                    {/* Recon estimate vs actual reconciliation (DMS-5) — only when an estimate was booked */}
                    {pnlData.reconActual > 0 && pnlData.reconEst > 0 && pnlData.reconActual !== pnlData.reconEst && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 2, marginBottom: 3, paddingLeft: 8 }}>
                        <span style={{ color: '#9ca3af' }}>↳ vs RM {pnlData.reconEst.toLocaleString()} estimate</span>
                        <span style={{ color: pnlData.reconActual > pnlData.reconEst ? premiumLight.accentText : premiumLight.up }}>
                          {pnlData.reconActual > pnlData.reconEst ? `+${(pnlData.reconActual - pnlData.reconEst).toLocaleString()} over` : `${(pnlData.reconEst - pnlData.reconActual).toLocaleString()} under`}
                        </span>
                      </div>
                    )}
                    {pnlData.holdingCost > 0 && (
                      <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 1, marginBottom: 2, paddingLeft: 8 }}>
                        ↳ RM {Math.round(pnlData.dailyHold).toLocaleString()}/day carrying cost
                      </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e5e7eb' }}>
                      <span style={{ color: '#374151' }}>Front gross</span>
                      <span style={{ color: pnlData.frontGross >= 0 ? premiumLight.up : premiumLight.accentText }}>
                        {pnlData.frontGross < 0 ? '− ' : ''}RM {Math.abs(pnlData.frontGross).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {/* Back end */}
                  {(pnlData.addonRevenue > 0 || pnlData.addonCost > 0) && (
                    <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Back End (F&I / Add-ons)</p>
                      {pnlData.addonRevenue > 0 && (
                        <>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Sold with ({pnlData.addons.length})</p>
                          {pnlData.addons.map((a, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                              <span style={{ color: '#374151' }}>{a.dealer_products?.name || 'Add-on'}</span>
                              <span style={{ color: '#111827', fontWeight: 600 }}>RM {(Number(a.sold_price) || 0).toLocaleString()}</span>
                            </div>
                          ))}
                        </>
                      )}
                      {pnlData.addonCost > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: '#6b7280' }}>Add-on cost</span>
                          <span style={{ color: premiumLight.textSec }}>− RM {pnlData.addonCost.toLocaleString()}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e5e7eb' }}>
                        <span style={{ color: '#374151' }}>Back gross</span>
                        <span style={{ color: pnlData.backGross >= 0 ? premiumLight.up : premiumLight.accentText }}>
                          {pnlData.backGross < 0 ? '− ' : ''}RM {Math.abs(pnlData.backGross).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Net */}
                  <div style={{ padding: '14px 0 4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Total Gross</span>
                      <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: pnlData.netPnl >= 0 ? premiumLight.up : premiumLight.accentText }}>
                        {pnlData.netPnl < 0 ? '− ' : ''}RM {Math.abs(pnlData.netPnl).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* Advertising Spend Modal (DMS-6) */}
      {adUnit && createPortal(
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)', zIndex: 10000 }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '88vh', background: '#fff' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900" style={{ fontSize: 15 }}>Advertising Spend</h3>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {adUnit.car_listings?.brand || adUnit.brand} {adUnit.car_listings?.model || adUnit.model} {adUnit.car_listings?.year || adUnit.year}
                  {adUnit.car_listings?.plate_number || adUnit.registration_number ? ` · ${adUnit.car_listings?.plate_number || adUnit.registration_number}` : ''}
                </p>
              </div>
              <button onClick={() => { setAdUnit(null); setAdEntries([]); }} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {/* Add form */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <select value={adForm.channel} onChange={e => setAdForm(f => ({ ...f, channel: e.target.value }))} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', appearance: 'none' }}>
                  {['mudah', 'carlist', 'facebook', 'tiktok', 'instagram', 'other'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
                <input type="number" value={adForm.amount} onChange={e => setAdForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount (RM)" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none' }} />
                <input type="date" value={adForm.spent_at} onChange={e => setAdForm(f => ({ ...f, spent_at: e.target.value }))} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none', colorScheme: 'light' }} />
                <input value={adForm.notes} onChange={e => setAdForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none' }} />
                <button onClick={handleAddAdSpend} disabled={adSaving} style={{ gridColumn: '1/-1', background: '#ec4899', color: '#fff', border: 'none', borderRadius: 6, padding: '9px', fontSize: 13, fontWeight: 600, cursor: adSaving ? 'default' : 'pointer' }}>{adSaving ? 'Adding…' : 'Add spend'}</button>
              </div>
              {/* List */}
              {adLoading ? (
                <p className="text-gray-500 text-sm text-center py-6">Loading…</p>
              ) : adEntries.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No advertising logged for this car yet.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f3f4f6', borderRadius: 8, marginBottom: 10, fontSize: 12 }}>
                    <span style={{ color: '#6b7280' }}>{adEntries.length} entr{adEntries.length === 1 ? 'y' : 'ies'}</span>
                    <span style={{ fontWeight: 700, color: '#111827' }}>Total: RM {adEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString()}</span>
                  </div>
                  {adEntries.map(e => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #f3f4f6', borderRadius: 8, marginBottom: 6 }}>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', textTransform: 'capitalize' }}>{e.channel}</span>
                        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{e.spent_at ? new Date(e.spent_at).toLocaleDateString('en-MY') : ''}</span>
                        {e.notes && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{e.notes}</p>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>RM {Number(e.amount).toLocaleString()}</span>
                        <button onClick={() => handleDeleteAdSpend(e.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* Recon Job Card Modal */}
      {reconUnit && createPortal(
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)', zIndex: 10000 }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '88vh', background: '#fff' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900" style={{ fontSize: 15 }}>Recon Job Card</h3>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {reconUnit.car_listings?.brand} {reconUnit.car_listings?.model} {reconUnit.car_listings?.year}
                  {reconUnit.car_listings?.plate_number || reconUnit.registration_number ? ` · ${reconUnit.car_listings?.plate_number || reconUnit.registration_number}` : ''}
                </p>
              </div>
              <button onClick={() => { setReconUnit(null); setReconJobs([]); }} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {reconLoading ? (
                <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
              ) : (
                <>
                  {/* Job list */}
                  {reconJobs.length === 0 && !showReconAdd && (
                    <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>No recon jobs yet.</p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {reconJobs.map(job => {
                      const statusColor = job.status === 'done' ? '#34d399' : job.status === 'in_progress' ? '#f59e0b' : '#9ca3af';
                      const cat = RECON_CATS.find(c => c.value === job.category)?.label || job.category;
                      return (
                        <div key={job.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>{job.title}</p>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: '#6b7280' }}>{cat}</span>
                                {job.vendor && <span style={{ fontSize: 10, color: '#6b7280' }}>· {job.vendor}</span>}
                                {job.cost != null && <span style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>RM {Number(job.cost).toLocaleString()}</span>}
                                {job.eta_date && <span style={{ fontSize: 10, color: '#9ca3af' }}>ETA {new Date(job.eta_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}</span>}
                              </div>
                            </div>
                            <select value={job.status} onChange={e => handleReconStatus(job.id, e.target.value)}
                              style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: '#eceef1', border: 'none', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', appearance: 'none', outline: 'none' }}>
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="done">Done</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary */}
                  {reconJobs.length > 0 && (() => {
                    const totalCost = reconJobs.reduce((s, j) => s + (Number(j.cost) || 0), 0);
                    const done = reconJobs.filter(j => j.status === 'done').length;
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f3f4f6', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                        <span style={{ color: '#6b7280' }}>{done}/{reconJobs.length} jobs done</span>
                        {totalCost > 0 && <span style={{ fontWeight: 600, color: '#111827' }}>Total: RM {totalCost.toLocaleString()}</span>}
                      </div>
                    );
                  })()}

                  {/* Add job form */}
                  {showReconAdd ? (
                    <div style={{ background: premiumLight.raised, borderRadius: premiumLight.radius.row, padding: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: premiumLight.textSec, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>New Recon Job</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input value={reconForm.title} onChange={e => setReconForm(f => ({ ...f, title: e.target.value }))} placeholder="Job title *" style={{ gridColumn: '1/-1', ...{ width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' } }} />
                        <select value={reconForm.category} onChange={e => setReconForm(f => ({ ...f, category: e.target.value }))} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', appearance: 'none' }}>
                          {RECON_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <input value={reconForm.vendor} onChange={e => setReconForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Vendor / workshop" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none' }} />
                        <input type="number" value={reconForm.cost} onChange={e => setReconForm(f => ({ ...f, cost: e.target.value }))} placeholder="Cost (RM)" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none' }} />
                        <input type="date" value={reconForm.eta_date} onChange={e => setReconForm(f => ({ ...f, eta_date: e.target.value }))} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none', colorScheme: 'light' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={() => setShowReconAdd(false)} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={handleAddReconJob} disabled={reconSaving} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#f59e0b', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: reconSaving ? 0.6 : 1 }}>
                          {reconSaving ? 'Saving…' : 'Add Job'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowReconAdd(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '9px', borderRadius: premiumLight.radius.row, background: premiumLight.raised, border: 'none', color: premiumLight.text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      + Add Recon Job
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* CSV Import Modal */}
      {showCsvImport && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '88vh', background: '#fff' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900" style={{ fontSize: 15 }}>Import Stock from CSV</h3>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Columns: brand/make, model, year, plate/reg, purchase_price, recon_cost, asking_price</p>
              </div>
              <button onClick={() => { setShowCsvImport(false); setCsvRows([]); setCsvError(''); }} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {csvRows.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
                  <button onClick={() => csvInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: premiumLight.raised, border: '2px dashed #d1d5db', borderRadius: premiumLight.radius.row, color: premiumLight.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <Upload style={{ width: 16, height: 16 }} />Choose CSV File
                  </button>
                  {csvError && <p style={{ fontSize: 12, color: '#dc2626', textAlign: 'center' }}>{csvError}</p>}
                  <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', maxWidth: 360 }}>
                    First row must be a header. Recognised columns: brand, make, model, year, plate, reg, purchase_price, cost, recon_cost, asking_price, selling_price.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{csvRows.length} units to import</span>
                    <button onClick={() => { setCsvRows([]); setCsvError(''); csvInputRef.current?.click(); }} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Change file</button>
                  </div>
                  <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                          {['Brand','Model','Year','Plate','Buy Price','Recon','Asking'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 20).map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                            {[r.brand, r.model, r.year, r.plate_number,
                              r.purchase_price ? `RM ${r.purchase_price.toLocaleString()}` : '—',
                              r.recon_cost ? `RM ${r.recon_cost.toLocaleString()}` : '—',
                              r.asking_price ? `RM ${r.asking_price.toLocaleString()}` : '—',
                            ].map((v, j) => (
                              <td key={j} style={{ padding: '7px 12px', color: v && v !== '—' ? '#111827' : '#9ca3af' }}>{v || '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {csvRows.length > 20 && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Showing first 20 of {csvRows.length} rows.</p>}
                </>
              )}
            </div>
            {csvRows.length > 0 && (
              <div className="p-5 border-t border-gray-100 flex gap-3">
                <button onClick={() => { setShowCsvImport(false); setCsvRows([]); }} style={{ flex: 1, padding: '9px', borderRadius: 8, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleCsvImport} disabled={csvSaving} style={{ flex: 2, padding: '9px', borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: csvSaving ? 0.6 : 1 }}>
                  {csvSaving ? 'Importing…' : `Import ${csvRows.length} Units`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vendors Modal */}
      {showVendors && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '88vh', background: '#fff' }}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900" style={{ fontSize: 15 }}>Vendor / Supplier Directory</h3>
              <button onClick={() => { setShowVendors(false); setShowVendorAdd(false); }} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {vendorsLoading ? (
                <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
              ) : (
                <>
                  {vendors.length === 0 && !showVendorAdd && (
                    <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>No vendors yet.</p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {vendors.map(v => {
                      const cat = VENDOR_CATS.find(c => c.value === v.category)?.label || v.category;
                      return (
                        <div key={v.id} style={{ background: v.is_active ? '#f9fafb' : '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', opacity: v.is_active ? 1 : 0.6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 3px' }}>{v.name}</p>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: '#6b7280' }}>
                                <span>{cat}</span>
                                {v.phone && <a href={`tel:${v.phone}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{v.phone}</a>}
                                {v.contact && <span>{v.contact}</span>}
                              </div>
                              {v.notes && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{v.notes}</p>}
                            </div>
                            <button onClick={() => handleToggleVendor(v.id, !v.is_active)} style={{ fontSize: 10, fontWeight: 600, color: v.is_active ? premiumLight.up : premiumLight.textMuted, background: premiumLight.raised, border: 'none', borderRadius: 999, padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}>
                              {v.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {showVendorAdd ? (
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>New Vendor</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input value={vendorForm.name} onChange={e => setVendorForm(f => ({ ...f, name: e.target.value }))} placeholder="Vendor name *" style={{ gridColumn: '1/-1', ...{ width: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' } }} />
                        <select value={vendorForm.category} onChange={e => setVendorForm(f => ({ ...f, category: e.target.value }))} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 12, outline: 'none', appearance: 'none' }}>
                          {VENDOR_CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <PhoneInput value={vendorForm.phone} onChange={v => setVendorForm(f => ({ ...f, phone: v }))} placeholder="Phone" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12 }} prefixStyle={{ padding: '0 4px 0 12px', color: '#6b7280' }} inputStyle={{ padding: '8px 12px 8px 0' }} />
                        <input value={vendorForm.contact} onChange={e => setVendorForm(f => ({ ...f, contact: e.target.value }))} placeholder="Contact person" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none' }} />
                        <input value={vendorForm.notes} onChange={e => setVendorForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes" style={{ gridColumn: '1/-1', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', fontSize: 12, outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={() => setShowVendorAdd(false)} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={handleAddVendor} disabled={vendorSaving} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#0369a1', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: vendorSaving ? 0.6 : 1 }}>
                          {vendorSaving ? 'Saving…' : 'Add Vendor'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowVendorAdd(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '9px', borderRadius: 8, background: '#f0f9ff', border: '1px dashed #7dd3fc', color: '#0369a1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      + Add Vendor
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Stock Publish — CarForm overlay (z-11000, above detail drawer z-9999 + child modals z-10000) */}
      {stockPublishListing && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 11000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: 920, background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(0,0,0,0.35)', minHeight: 'min-content', marginBottom: 20 }}>
            <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid rgba(17,24,39,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setStockPublishListing(null)} style={{ padding: '6px 10px', borderRadius: 8, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#374151', fontSize: 13, cursor: 'pointer' }}>← Back</button>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Complete listing — {stockPublishListing.brand} {stockPublishListing.model} {stockPublishListing.year}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>Add photos, location, and details. Saving will publish this car to your marketplace.</p>
              </div>
            </div>
            <div style={{ padding: '16px 20px 24px' }}>
              <React.Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading form…</div>}>
                <CarForm
                  listing={stockPublishListing}
                  defaultValues={{ state: profile?.state || '', city: profile?.city || '' }}
                  onBack={() => setStockPublishListing(null)}
                  onUpdate={handleStockPublishSave}
                />
              </React.Suspense>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
});

// ─── Customers Tab ───────────────────────────────────────────────────────────

function Avatar({ size = "md", profile }) {
  const sz = size === "lg" ? "w-9 h-9 text-sm" : "w-7 h-7 text-xs";
  if (profile?.avatar_url)
    return (
      <img
        src={profile.avatar_url}
        alt=""
        className={`${sz} rounded-full object-cover flex-shrink-0`}
      />
    );
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-bold flex-shrink-0`}
      style={{
        background: "#374151",
      }}
    >
      {(profile?.full_name || profile?.email || "A")[0].toUpperCase()}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const { tab: tabParam } = useParams();
  const location = useLocation();
  const { t } = useTranslation();
  // superadmin is intentionally excluded — the platform admin console lives at
  // /platform, so a superadmin who hits /dashboard is redirected there instead
  // of rendering an empty, onboarding-less dealer dashboard.
  const redirectByRole = useRoleRedirect(["dealer", "owner", "manager", "admin"]);
  const { status, trialEndsAt, loading: subLoading } = useSubscription();
  const trialDaysLeft = status === 'trial' && trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt) - Date.now()) / 86400000))
    : null;

  // First-frame cache seed. The dashboard had no persistent cache at all — the
  // one cached surface, useDealerSnapshot, is react-query with no persister, so
  // its cache dies with the tab and every PWA cold start started from zero. That
  // meant a spinner through session -> profiles.select(*) -> the four listing
  // queries, three serial round trips to ap-southeast-2, before any pixel.
  const [seed] = useState(() => seedPanelCache(PANEL_CACHE_KEY));

  const [listings, setListings] = useState(seed.listings);
  // A cached profile is enough to render; the fresh one lands moments later and
  // the role gate in loadSession re-runs against it.
  const [loading, setLoading] = useState(!seed.profile);
  // A failed read of our own profile (DB stall) shows ProfileLoadError, not /login.
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [activeTab, setActiveTab] = useState(tabParam || "overview");
  // The AI Sales Manager card on Overview. Closed on every visit: opening it runs the briefing.
  const [aiOpen, setAiOpen] = useState(false);
  const [analyticsSub, setAnalyticsSub] = useState(() => new URLSearchParams(window.location.search).get('sub') || 'revenue'); // revenue | performance
  const [storefrontSub, setStorefrontSub] = useState("hero");   // hero | services
  const [deleteId, setDeleteId] = useState(null);
  useModalHistory(!!deleteId, () => setDeleteId(null));
  const [reactivating, setReactivating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useModalHistory(sidebarOpen, () => setSidebarOpen(false));
  const [openGroups, setOpenGroups] = useState(() => {
    const gid = TAB_TO_GROUP[tabParam || "overview"];
    return gid ? new Set([gid]) : new Set();
  });
  // Refs to each sidebar group's wrapper div, so opening a group near the
  // bottom of the nav can scroll its expanded sub-items into view instead of
  // leaving them hidden below the nav's own scroll fold.
  const navGroupRefs = useRef({});
  const [priceEditListing, setPriceEditListing] = useState(null);
  const [markSoldListing, setMarkSoldListing] = useState(null);
  const [studioListing, setStudioListing] = useState(null);
  const [markSoldLoading, setMarkSoldLoading] = useState(false);
  const [profile, setProfile] = useState(seed.profile);
  // The owner's per-role switches (Settings > Team). Overview hides money a role is not allowed.
  const { can: canDo, loading: permsLoading } = usePermissions(profile);
  // Managers and admins use this dashboard; the owner's switches (Settings > Team) pick which tabs
  // they can open. Owners see everything. A money tab also needs its money switch.
  const isOwnerView = !profile || isFullAccessRole(profile.role);
  const tabAllowed = (id, sub) => {
    if (isOwnerView) return true;
    const cap = tabCapability(id, sub);
    if (!cap) return true;
    if (!canDo(cap)) return false;
    const money = TAB_NEEDS_MONEY[cap];
    return !money || canDo(money);
  };
  const [dealerSubdomain, setDealerSubdomain] = useState(null); // parent dealer's subdomain (used for manager/admin roles)
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [editListing, setEditListing] = useState(null);
  useModalHistory(!!editListing, () => setEditListing(null), { isDirty: () => true });
  const [editTab, setEditTab] = useState('listing'); // 'listing' (CarForm) | 'cost' (procurement)
  // Every time a different listing is opened, start on the Listing details tab.
  useEffect(() => { if (editListing) setEditTab('listing'); }, [editListing?.id]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("available");
  const [showFilters, setShowFilters] = useState(false);
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterMinMileage, setFilterMinMileage] = useState('');
  const [filterMaxMileage, setFilterMaxMileage] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterTransmission, setFilterTransmission] = useState('');
  const [filterState, setFilterState] = useState('');
  const [visibleCount, setVisibleCount] = useState(30);
  const sentinelRef = useRef(null);
  const [copiedListingId, setCopiedListingId] = useState(null);
  const [userId, setUserId] = useState(seed.uid);
  const [salesmen,         setSalesmen]         = useState(() => seed.uid ? (readCache(`dash_salesmen_${seed.uid}`) || []) : []);
  const [assignDropdownId, setAssignDropdownId] = useState(null);
  const [assignToast,      setAssignToast]      = useState(null);
  const [detailListing,    setDetailListing]    = useState(null);
  // Which button the car pop-up opens on: 'owner' from a Stock & costs row, else Details. Resets when it closes.
  const [detailInitialTab, setDetailInitialTab] = useState('specs');
  useEffect(() => { if (!detailListing) setDetailInitialTab('specs'); }, [detailListing]);
  // Net F&I add-on gross per listing (sold_price − cost) so the Listings table
  // Gross column reflects what a sold car actually earned, add-ons included.
  const [addonNetByListing, setAddonNetByListing] = useState({});
  // Stock tools (CSV import / vendors / add unit) are reached from the Listings
  // "Tools" dropdown now that Stock has no nav entry — this signals which to open.
  const [stockAutoTool,    setStockAutoTool]    = useState(null);
  const handleTabChangeRef = useRef(null);
  const [addCarOpen, setAddCarOpen] = useState(false);
  const [autoPostOpen, setAutoPostOpen] = useState(false);
  const [stickerCar, setStickerCar] = useState(null);
  // Select several cars and change them at once (INV-BULK).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const toggleSelected = (id) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const exitSelect = () => { setSelectMode(false); setSelectedIds(new Set()); };
  // Views + enquiries per car on the Listings rows (INV-INTEREST), last 30 days.
  // Kept on the device so the numbers paint at once; null = not loaded yet (a
  // placeholder shows, never a 0).
  const interestDealer = getDealerIdFromProfile(profile);
  const [carInterest, setCarInterest] = usePersistentState(interestDealer ? `inv_interest:${interestDealer}` : null, null);
  // Window-sticker scans per car, last 30 days. null = the database function is not
  // there yet (queued migration 20261110b) or has not answered: show nothing, never a 0.
  const [stickerScans, setStickerScans] = useState(null);
  const autoPost = useAutoPost(getDealerIdFromProfile(profile));
  // Inventory is ONE nav item with two pills, Listings | Stock (owner, 2026-11-09).
  // The nav item opens whichever pill the dealer last opened on this device, so
  // they choose what they see first by using it. Routes stay /dashboard/listings
  // and /dashboard/stock, so every old link and the Tools menu keep working.
  const openInventory = useCallback((view) => {
    try { localStorage.setItem(INVENTORY_VIEW_KEY, view); } catch { /* private mode */ }
    handleTabChangeRef.current?.(view);
  }, []);
  const lastInventoryView = () => {
    try { const v = localStorage.getItem(INVENTORY_VIEW_KEY); return v === "stock" || v === "market" ? v : "listings"; } catch { return "listings"; }
  };
  // ONE handover state for the Handover and Customers pills (CLAUDE.md "One post-sale
  // state"): Customers used to run its own post_sale_tasks query for the same %.
  // Loads only while a Sold pill is open, so no other tab gains a query.
  const soldHandover = useHandover(SOLD_IDS.has(activeTab) && userId ? getDealerIdFromProfile(profile) : null);
  const openSold = useCallback((view) => {
    try { localStorage.setItem(SOLD_VIEW_KEY, view); } catch { /* private mode */ }
    handleTabChangeRef.current?.(view);
  }, []);
  const lastSoldView = () => {
    try { const v = localStorage.getItem(SOLD_VIEW_KEY); return SOLD_IDS.has(v) ? v : "handover"; } catch { return "handover"; }
  };
  const [toolsMenuOpen,    setToolsMenuOpen]    = useState(false);
  const toolsBtnRef = useRef(null);
  const [toolsBtnRect, setToolsBtnRect] = useState(null);
  const [svcPopupListing,  setSvcPopupListing]  = useState(null);
  useModalHistory(!!svcPopupListing, () => setSvcPopupListing(null));
  const sidebarBellRef = useRef(null);
  const [sidebarBellRect, setSidebarBellRect] = useState(null);
  const closeNotif = () => { setNotifOpen(false); setSidebarBellRect(null); };
  // Cached per dealer so the bell shows its count on the first frame.
  const [notifications,    setNotifications]    = usePersistentState(userId ? `dash_notifs:${userId}` : null, []);
  const [notifOpen,        setNotifOpen]        = useState(false);
  useModalHistory(notifOpen, () => setNotifOpen(false));
  const [pendingStockListing, setPendingStockListing] = useState(null);
  useModalHistory(!!pendingStockListing, () => setPendingStockListing(null));
  const [pendingStockForm, setPendingStockForm] = useState({ purchase_price: '', purchase_date: '', purchase_source: '', recon_cost: '' });
  const [pendingStockSaving, setPendingStockSaving] = useState(false);
  const [prefillDocData,   setPrefillDocData]   = useState(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [onboardingCopied, setOnboardingCopied] = useState(false);
  const [onboardingToast,  setOnboardingToast]  = useState(false);
  const loadedUidRef = useRef(null);

  const planCfg     = getPlanConfig(profile?.plan);
  const nextPlan    = nextDealerPlan(profile?.plan);
  const nextPlanCfg = nextPlan ? getPlanConfig(nextPlan) : null;

  const getStorefrontUrl = () => {
    const sub = dealerSubdomain || profile?.subdomain;
    if (!sub) return 'https://drevo.my';
    // env-aware: real subdomain in prod, ?tenant= override on vercel preview/localhost.
    // (Superadmin with a subdomain still previews their own storefront.)
    return buildStorefrontUrl(sub);
  };

  useEffect(() => {
    const name = profile?.site_name || profile?.dealership || "Drevo";
    document.title = `${name} — Admin`;
  }, [profile]);

  useEffect(() => {
    if (sidebarOpen) {
      const y = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${y}px`;
      document.body.style.width = '100%';
    } else {
      const y = parseInt(document.body.style.top || '0', 10);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (y) window.scrollTo(0, -y);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const gid = TAB_TO_GROUP[activeTab];
    if (gid) setOpenGroups(prev => new Set([...prev, gid]));
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true;

    // Shared loader — called on first mount AND on every auth state change so
    // switching accounts always loads the correct owner's data.
    const loadSession = async (session) => {
      if (!session) { navigate("/login"); return; }
      // Block unconfirmed accounts from accessing the dashboard
      if (!session.user.email_confirmed_at) {
        navigate("/login?unconfirmed=1", { replace: true });
        return;
      }
      const uid = session.user.id;
      // Set ref immediately so onAuthStateChange SIGNED_IN guard works
      // even if setSession fires the event before this async fn completes.
      loadedUidRef.current = uid;

      // Reset to a clean slate before populating for this session.
      // Prevents any previous owner's branding from bleeding through.
      //
      // Skipped when the first-frame cache seed already belongs to THIS uid —
      // otherwise the reset immediately blanks the cached paint and puts the
      // spinner back, which is the whole thing the seed exists to remove. Any
      // other uid (a different account signed in on this device) still gets the
      // full wipe, so no previous owner's data survives.
      if (seed.uid !== uid) {
        setProfile(null);
        setListings([]);
        setAddonNetByListing({});
        setSalesmen([]);
        setLoading(true);
      }
      setUserId(uid);
      rememberPanelUid(PANEL_CACHE_KEY, uid);

      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      if (!active) return;
      // A timeout / server error is the database stalling, not a missing account.
      if (pErr) {
        setLoading(false);
        setProfileLoadFailed(true);
        return;
      }
      setProfileLoadFailed(false);

      if (p) {
        if (redirectByRole(p.role)) return;
        if (!["dealer", "admin", "manager", "owner"].includes(p.role)) {
          navigate("/login");
          return;
        }
        setProfile(p);
        // Cached so the NEXT cold start clears the loading gate on frame 1. The
        // role gate two lines up re-runs against the fresh row when it lands.
        writeCache(`${PANEL_CACHE_KEY}_profile_${uid}`, redactProfileForCache(p));
        const dealerId = getDealerIdFromProfile(p);
        setUserId(dealerId);
        // For manager/admin, subdomain lives on the parent dealer's profile row
        if ((p.role === 'manager' || p.role === 'admin') && p.dealer_id) {
          supabase.from('profiles').select('subdomain').eq('id', p.dealer_id).maybeSingle()
            .then(({ data }) => { if (data?.subdomain) setDealerSubdomain(data.subdomain); });
        } else {
          setDealerSubdomain(p.subdomain || null);
        }
      } else {
        navigate("/login");
        return;
      }

      const dealerId = getDealerIdFromProfile(p);
      const [{ data: cars, error: carsError }, { data: sm, error: smError }, { data: stockCost }, { data: dealProducts }] = await Promise.all([
        supabase
          .from("car_listings")
          .select("id,slug,brand,model,variant,year,base_price,selling_price,original_price,mileage,transmission,fuel_type,body_type,state,city,colour,condition,registration_date,specs,options,features,images,status,created_at,dealer_id,assigned_to,commission_amount,sold_at,included_services,included_services_cost,recon_cost,auction_grade,interior_grade,is_recon,import_country,auction_house,local_reg_date,chassis_status,damage_map,financing_type,payment_type,loan_eligible,engine_cc,horsepower,cylinders,doors,seats,fuel_consumption,previous_owners,plate_number,vin_number,engine_number,road_tax_expiry,warranty_months,deposit_amount,video_url,car_documents,reserved_by,reserved_at,acceleration,top_speed,boot_size,co2_emissions,safety_rating,insurance_group,geran_status,docs_verified,docs_verified_at")
          .eq("dealer_id", dealerId)
          .neq("status", "archived")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("role", "salesman")
          .eq("dealer_id", dealerId),
        // Cost basis lives on stock_units, not car_listings — merge it in so the
        // Listings tab Cost / Recon / Gross columns actually show data.
        supabase
          .from("stock_units")
          .select("listing_id, purchase_price, recon_cost")
          .eq("dealer_id", dealerId)
          .not("listing_id", "is", null),
        // F&I add-ons sold per car — net (sold_price − cost) folds into the row Gross.
        supabase
          .from("deal_products")
          .select("listing_id, sold_price, dealer_products(cost_price)")
          .eq("dealer_id", dealerId),
      ]);
      if (active) {
        const costBy = {};
        (stockCost || []).forEach((s) => { if (s.listing_id) costBy[s.listing_id] = s; });
        const merged = (cars || []).map((c) => {
          const sc = costBy[c.id];
          return sc ? { ...c, purchase_price: sc.purchase_price, recon_cost: sc.recon_cost } : c;
        });
        const addonNet = {};
        (dealProducts || []).forEach((d) => {
          if (!d.listing_id) return;
          addonNet[d.listing_id] = (addonNet[d.listing_id] || 0) + (Number(d.sold_price) || 0) - (Number(d.dealer_products?.cost_price) || 0);
        });
        setAddonNetByListing(addonNet);
        // A failed read (DB stall / timeout) keeps whatever is on screen — the
        // cached grid — instead of blanking it to "no cars".
        if (!carsError) setListings(merged);
        if (!smError) setSalesmen(sm || []);
        setLoading(false);
        // Cache the listings table + team roster for the next cold start. Skipped
        // on a failed read so one bad response can't overwrite a good cache with
        // an empty grid.
        if (!carsError) {
          writeCache(`${PANEL_CACHE_KEY}_listings_${uid}`, merged);
          if (!smError) writeCache(`${PANEL_CACHE_KEY}_salesmen_${uid}`, sm || []);
        }
      }
    };

    // Establish session first (cross-domain handoff or existing session) BEFORE
    // subscribing to auth events. A stale localStorage session on the subdomain
    // can trigger SIGNED_OUT during its failed auto-refresh — if we're already
    // subscribed when that fires, we'd redirect to drevo.my/login before our
    // new tokens even get a chance to run. establishSessionFromHandoff owns the
    // stale-session lock contention + guarded-retry logic (see authHandoff.js).
    let unsubscribe = () => {};

    (async () => {
      const { session, reloading } = await establishSessionFromHandoff(supabase);
      if (reloading || !active) return;

      if (!(session?.user?.id && session.user.id === loadedUidRef.current)) {
        loadSession(session);
      }

      // Subscribe AFTER session is established so stale-session SIGNED_OUT
      // events can't fire into the handler during the setup window.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
        if (event === 'SIGNED_IN') {
          if (s?.user?.id && s.user.id === loadedUidRef.current) return;
          loadSession(s);
        } else if (event === 'SIGNED_OUT') {
          window.location.href = loginUrl();
        }
      });
      unsubscribe = () => subscription.unsubscribe();
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    const ch = liveChannel(supabase, "dash_listings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "car_listings",
          filter: `dealer_id=eq.${userId}`,
        },
        (payload) => {
          setListings((prev) => {
            if (payload.eventType === "INSERT") {
              if (prev.some((l) => l.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            }
            if (payload.eventType === "UPDATE")
              return prev.map((l) =>
                l.id === payload.new.id ? { ...l, ...payload.new } : l,
              );
            if (payload.eventType === "DELETE")
              return prev.filter((l) => l.id !== payload.old.id);
            return prev;
          });
        },
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]);

  // ── Notifications realtime ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const reload = () =>
      supabase.from('dealer_notifications').select('*').eq('dealer_id', userId)
        .order('created_at', { ascending: false }).limit(20)
        .then(({ data, error }) => { if (!error) setNotifications(data || []); });
    reload();
    const ch = liveChannel(supabase, `notifs_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dealer_notifications', filter: `dealer_id=eq.${userId}` }, reload)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear(); // prevent stale branding from a previous session bleeding through
    window.location.href = loginUrl();
  };
  const handleNew = (l) => {
    // Dedup against the realtime INSERT event, which may have already prepended
    // this row before the optimistic add runs (causes a brief double listing).
    setListings((p) => (p.some((x) => x.id === l.id) ? p : [l, ...p]));
    navigate("/dashboard/listings", { replace: true });
    setActiveTab("listings");
    // Prompt to add stock purchase details
    setPendingStockListing(l);
    setPendingStockForm({ purchase_price: '', purchase_date: new Date().toISOString().slice(0,10), purchase_source: 'Direct Buy', recon_cost: '' });
    // The cost typed in CarForm is on the stock record the database made for this
    // car (a dealer car's listing holds no cost, 20261109f). Prefill from it.
    supabase.from('stock_units').select('purchase_price, recon_cost').eq('listing_id', l.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setPendingStockForm((f) => ({
          ...f,
          purchase_price: f.purchase_price || (Number(data.purchase_price) > 0 ? String(data.purchase_price) : ''),
          recon_cost: f.recon_cost || (Number(data.recon_cost) > 0 ? String(data.recon_cost) : ''),
        }));
      });
  };
  // AddCarForm already captures cost/procurement data, so no pending-stock prompt.
  const handleAddCarPublished = (l) => {
    // Dedup: the realtime car_listings INSERT subscription may race ahead and add
    // this same row, so guard against a duplicate render of the freshly-added car.
    setListings((p) => (p.some((x) => x.id === l.id) ? p : [l, ...p]));
    setAddMode(null);
    handleTabChange("listings");
    toast.success("Car added and published to your marketplace.");
  };

  // Phase 2 of the marketplace add flow: CarForm has saved all the details;
  // flip the listing to 'available' to publish it.
  const handleMarketplacePublish = async (savedListing) => {
    const { error } = await supabase
      .from('car_listings')
      .update({ status: 'available' })
      .eq('id', savedListing.id);
    if (error) { toast.error('Could not publish: ' + error.message); return; }
    setMarketplaceDraftListing(null);
    handleAddCarPublished({ ...savedListing, status: 'available' });
  };

  const handleAddCarStocked = () => {
    setAddMode(null);
    handleTabChange("stock");
    toast.success("Car added to your inventory.");
  };
  const [addMode, setAddMode] = useState(null); // null | 'marketplace' | 'internal'
  // The Add car pop-up: closing asks first (a half-filled car is lost otherwise; AddCarForm keeps a
  // draft on the device, the second step does not), Back asks the same (useModalHistory isDirty),
  // and the page under it does not scroll.
  const closeAddFlow = useCallback(() => {
    if (!window.confirm('Close this form? Anything not saved yet will be lost.')) return;
    setAddMode(null); setMarketplaceDraftListing(null);
  }, []);
  useModalHistory(!!addMode, () => { setAddMode(null); setMarketplaceDraftListing(null); }, { isDirty: () => true });
  useEffect(() => {
    if (!addMode) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [addMode]);
  const [marketplaceDraftListing, setMarketplaceDraftListing] = useState(null); // listing created by AddCarForm, awaiting CarForm continuation
  // `query` (optional) lands as ?key=value on the tab's URL, e.g.
  // handleTabChange("crm", { sub: "bookings" }) or { lead: <id> } to open one lead.
  const handleTabChange = useCallback((tab, query) => {
    startTransition(() => {
      setActiveTab(tab);
      setSidebarOpen(false);
      const qs = query ? new URLSearchParams(query).toString() : '';
      navigate(`/dashboard/${tab}${qs ? `?${qs}` : ''}`);
      // Keep the group containing this tab open in the sidebar
      const gid = TAB_TO_GROUP[tab];
      if (gid) setOpenGroups(prev => new Set([...prev, gid]));
    });
  }, [navigate]);
  handleTabChangeRef.current = handleTabChange;

  // A tab the owner has not opened to this role (a saved link, an old notification) goes to
  // Overview. Waits for the switches to load, or every tab would bounce for a moment.
  // REPLACES the history entry (Back must not land on the closed tab and bounce again), once per
  // closed tab (the ref), so a slow commit cannot push several entries.
  const bouncedFrom = useRef(null);
  const closedTab = !isOwnerView && !permsLoading && !!profile && !tabAllowed(activeTab, analyticsSub);
  useEffect(() => {
    if (!closedTab) { bouncedFrom.current = null; return; }
    if (bouncedFrom.current === activeTab) return;
    bouncedFrom.current = activeTab;
    setActiveTab('overview');
    navigate('/dashboard/overview', { replace: true });
  }, [closedTab, activeTab, navigate]);

  // Resolve legacy tab ids (now merged) to their new parent tab + sub-tab so
  // old deep-links and saved URLs don't render a blank pane.
  useEffect(() => {
    if (!tabParam) return;
    const ALIAS = {
      revops:      { tab: "analytics",    sub: ["analytics", "revenue"] },
      marketplace: { tab: "analytics",    sub: ["analytics", "performance"] },
      services:    { tab: "storefront", sub: ["storefront", "services"] },
      hero:        { tab: "storefront", sub: ["storefront", "hero"] },
      // AI Manager is a card on Overview now (2026-11-16): old links open Overview with it open.
      ai_manager:  { tab: "overview",   sub: [], openAi: true },
      // Adding a car is a pop-up now (2026-11-16): an old /dashboard/add link opens Inventory with
      // the Add car sheet. HP Board is a pill in Leads / CRM.
      add:         { tab: "listings",   sub: [], openAddSheet: true },
      hp:          { tab: "crm",        sub: ["crm", "hp"] },
      // GM Oversight was split up (2026-11-09): alerts -> Overview, targets +
      // what drove revenue -> Revenue, activity trail -> Team.
      oversight:   { tab: "overview",   sub: [] },
      // Merged into Leads / CRM. Old notifications (link_to) and saved URLs
      // still carry these; without the alias they open a blank pane.
      enquiries:   { tab: "crm", sub: [] },
      bookings:    { tab: "crm", sub: ["crm", "bookings"] },
      outreach:    { tab: "crm", sub: ["crm", "outreach"] },
    };
    const mapped = ALIAS[tabParam];
    if (mapped) {
      if (mapped.openAi) { setAiOpen(true); navigate("/dashboard/overview", { replace: true }); }
      if (mapped.openAddSheet) { setAddCarOpen(true); navigate("/dashboard/listings", { replace: true }); }
      if (mapped.sub[0] === "analytics") setAnalyticsSub(mapped.sub[1]);
      if (mapped.sub[0] === "storefront") setStorefrontSub(mapped.sub[1]);
      if (mapped.sub[0] === "crm") { navigate(`/dashboard/crm?sub=${mapped.sub[1]}`, { replace: true }); return; }
      if (activeTab !== mapped.tab) setActiveTab(mapped.tab);
      return;
    }
    if (tabParam !== activeTab) setActiveTab(tabParam);
  }, [tabParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // CRM sub-tab + a lead to open, read from the URL (/dashboard/crm?sub=bookings,
  // /dashboard/crm?lead=<id>) so Overview alerts land on the exact place.
  const teamTrail = useMemo(() => new URLSearchParams(location.search).get('trail') || 'all', [location.search]);
  const crmQuery = useMemo(() => {
    const p = new URLSearchParams(location.search);
    return { sub: p.get('sub'), lead: p.get('lead') };
  }, [location.search]);

  // Sync analyticsSub when the user navigates back/forward through sub-tab history entries
  useEffect(() => {
    if (tabParam !== 'analytics') return;
    const sub = new URLSearchParams(location.search).get('sub');
    if (sub === 'listings') { navigate('/dashboard/listings', { replace: true }); return; }
    if (sub && sub !== analyticsSub) setAnalyticsSub(sub);
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  // The cars on screen as a CSV (was Reports > Listings' export): price, days on lot, views + enquiry taps (30 days).
  const exportListingsCSV = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Brand', 'Model', 'Year', 'Plate', 'Status', 'Selling price (RM)', 'Days listed', 'Views (30d)', 'Enquiries (30d)'],
      ...filteredListings.map(l => [l.brand, l.model, l.year, l.plate_number, l.status || 'available', l.selling_price || 0,
        getListingAge(l.created_at), carInterest?.[l.id]?.views ?? '', carInterest?.[l.id]?.enq ?? ''])];
    const blob = new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `listings-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id) => {
    // Archive, never a hard DELETE: a real delete unlinks the car from 33 tables
    // and strips it off buyers' chats and leads. A car with a won deal is refused
    // by trg_guard_sold_car (offer Undo sale). Same rule as the Lite/Premium panels.
    const { data: gone, error } = await supabase
      .from("car_listings")
      .update({ status: "archived" })
      .eq("id", id)
      .eq("dealer_id", getDealerIdFromProfile(profile))  // explicit RLS guard
      .select("id");
    if (error) {
      console.error("Delete failed:", error.message);
      if (isWonDealBlock(error)) {
        setDeleteId(null);
        offerUndoSale(id, () => setListings(relistCar(id)));
        return;
      }
      toast.error("Could not delete listing: " + error.message);
      return;
    }
    if (!gone?.length) {
      // RLS refuses as "0 rows, no error".
      toast.error("Could not delete listing. You may not have permission.");
      return;
    }
    setListings((p) => p.filter((l) => l.id !== id));
    if (detailListing?.id === id) setDetailListing(null);
    setDeleteId(null);
  };
  const handleAssign = async (listingId, salesmanId, name) => {
    setAssignDropdownId(null);
    // Check the car really changed before evicting other salesmen or logging it: a refused
    // write comes back as "0 rows, no error", and the screen used to say "Assigned" anyway.
    const { data: saved, error: assignErr } = await supabase.from("car_listings")
      .update({ assigned_to: salesmanId }).eq("id", listingId).select("id");
    if (assignErr || !saved?.length) {
      setAssignToast({ listingId, msg: "Could not assign. Try again." });
      setTimeout(() => setAssignToast(null), 3000);
      return;
    }
    // Assignment is exclusive: evict any other salesmen who had featured this car
    // so it leaves their listings and the shared feature pool. The assignee keeps
    // it via assigned_to. (Salesman Lite rows have salesman_id = their own id too,
    // but those are scoped by dealer_id elsewhere — this only touches THIS dealer.)
    await supabase.from("salesman_listings").delete()
      .eq("listing_id", listingId).neq("salesman_id", salesmanId);
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, assigned_to: salesmanId } : l))
    );
    const listing = listings.find(l => l.id === listingId);
    logActivity({ dealerId: userId, actor: profile, tableName: 'car_listings', recordId: listingId, action: 'assigned', summary: `Assigned to ${name} — ${listing?.brand || ''} ${listing?.model || ''} ${listing?.year || ''}`.trim(), fieldChanges: { assigned_to: { to: name } } });
    setAssignToast({ listingId, msg: `Assigned to ${name}` });
    setTimeout(() => setAssignToast(null), 2000);
  };
  const handleUnassign = async (listingId) => {
    setAssignDropdownId(null);
    const { data: saved, error: unassignErr } = await supabase.from("car_listings")
      .update({ assigned_to: null }).eq("id", listingId).select("id");
    if (unassignErr || !saved?.length) {
      setAssignToast({ listingId, msg: "Could not unassign. Try again." });
      setTimeout(() => setAssignToast(null), 3000);
      return;
    }
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, assigned_to: null } : l))
    );
    const listing = listings.find(l => l.id === listingId);
    logActivity({ dealerId: userId, actor: profile, tableName: 'car_listings', recordId: listingId, action: 'unassigned', summary: `Unassigned — ${listing?.brand || ''} ${listing?.model || ''} ${listing?.year || ''}`.trim() });
    setAssignToast({ listingId, msg: "Unassigned" });
    setTimeout(() => setAssignToast(null), 2000);
  };
  useEffect(() => {
    if (activeTab !== 'listings' || !interestDealer) return undefined;
    let off = false;
    supabase.rpc('get_dealer_car_analytics', { p_dealer_id: interestDealer, p_days: 30 }).then(({ data, error }) => {
      if (off || error) return; // a failed read keeps what is on the device
      const m = {};
      (data || []).forEach(r => {
        m[r.car_id] = { views: Number(r.views) || 0, wa: Number(r.whatsapp) || 0, calls: Number(r.calls) || 0, bookings: Number(r.bookings) || 0, enq: (Number(r.whatsapp) || 0) + (Number(r.calls) || 0) + (Number(r.bookings) || 0) };
      });
      setCarInterest(m);
    });
    supabase.rpc('get_dealer_sticker_scans', { p_dealer_id: interestDealer, p_days: 30 }).then(({ data, error }) => {
      if (off || error) return;
      const m = {};
      (data || []).forEach(r => { m[r.car_id] = Number(r.scans) || 0; });
      setStickerScans(m);
    });
    return () => { off = true; };
  }, [activeTab, interestDealer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving Listings, or changing the status pill, drops the selection.
  useEffect(() => { exitSelect(); }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCars = listings.filter(l => selectedIds.has(l.id));

  // Bulk status. Sold cars are skipped (a sold car leaves 'sold' only through
  // undo_car_sale) and 'sold' is not offered at all. The .in() guard reads the
  // server's status, so a car sold elsewhere a second ago is not relisted.
  const bulkStatus = async (status) => {
    const targets = selectedCars.filter(l => l.status !== 'sold' && (l.status || 'available') !== status);
    const skippedSold = selectedCars.filter(l => l.status === 'sold').length;
    if (!targets.length) { toast(skippedSold ? 'Sold cars cannot be changed here.' : 'Those cars already have that status.'); return; }
    setBulkBusy(true);
    let ok = 0, failed = 0, capHit = false;
    const updated = {};
    for (const l of targets) {
      const { data, error } = await supabase.from('car_listings').update({ status })
        .eq('id', l.id).in('status', ['available', 'reserved', 'unpublished']).select();
      if (error || !data?.length) {
        failed++;
        if (error?.message?.includes('listing_cap_exceeded')) capHit = true;
        continue;
      }
      ok++;
      updated[l.id] = data[0];
      logActivity({ dealerId: userId, actor: profile, tableName: 'car_listings', recordId: l.id, action: 'status_changed', summary: `Status ${l.status || 'available'} → ${status} (bulk) — ${l.brand || ''} ${l.model || ''} ${l.year || ''}`.trim(), fieldChanges: { status: { from: l.status || 'available', to: status } } });
    }
    setListings(p => p.map(l => updated[l.id] ? { ...l, ...updated[l.id] } : l));
    setBulkBusy(false);
    exitSelect();
    if (capHit) toast.error(`Changed ${ok}. Your plan's listing limit stopped the rest.`);
    else if (failed) toast.error(`Changed ${ok}, ${failed} could not be changed. Try those again.`);
    else toast.success(`Changed ${ok} car${ok === 1 ? '' : 's'}${skippedSold ? `. Skipped ${skippedSold} sold` : ''}.`);
  };

  // Bulk price: the same rule as one car (PriceEditModal): a first drop keeps the
  // old price as original_price (the "was" price + hot deal), a price back at or
  // above it clears it.
  const bulkPrice = async (changes) => {
    setBulkBusy(true);
    let ok = 0, failed = 0;
    const updated = {};
    for (const { car, from, to } of changes) {
      const orig = car.original_price || null;
      const payload = { selling_price: to };
      if (orig && to >= orig) payload.original_price = null;
      else if (!orig && to < from) payload.original_price = from;
      const { data, error } = await supabase.from('car_listings').update(payload).eq('id', car.id).neq('status', 'sold').select();
      if (error || !data?.length) { failed++; continue; }
      ok++;
      updated[car.id] = data[0];
      logActivity({ dealerId: userId, actor: profile, tableName: 'car_listings', recordId: car.id, action: 'price_changed', summary: `Price changed from RM ${from.toLocaleString()} to RM ${to.toLocaleString()} (bulk) — ${car.brand} ${car.model} ${car.year}`, fieldChanges: { selling_price: { from, to } } });
    }
    setListings(p => p.map(l => updated[l.id] ? { ...l, ...updated[l.id] } : l));
    setBulkBusy(false);
    setBulkPriceOpen(false);
    exitSelect();
    if (failed) toast.error(`Changed ${ok} price${ok === 1 ? '' : 's'}, ${failed} failed. Try those again.`);
    else toast.success(`Changed ${ok} price${ok === 1 ? '' : 's'}.`);
  };

  const handleStatus = async (id, status) => {
    setUpdatingStatus(id);
    try {
      const { data, error } = await supabase
        .from("car_listings")
        .update({ status })
        .eq("id", id)
        .select();
      if (error) throw error;
      const listing = listings.find(l => l.id === id);
      const prevStatus = listing?.status || 'available';
      logActivity({ dealerId: userId, actor: profile, tableName: 'car_listings', recordId: id, action: 'status_changed', summary: `Status ${prevStatus} → ${status} — ${listing?.brand || ''} ${listing?.model || ''} ${listing?.year || ''}`.trim(), fieldChanges: { status: { from: prevStatus, to: status } } });
      setListings((p) =>
        p.map((l) => (l.id === id ? (data?.[0] ?? { ...l, status }) : l)),
      );
    } catch (e) {
      console.error(e);
      // A car with a won deal cannot leave 'sold' (trg_guard_sold_car). Offer
      // the one way out instead of failing silently, which is what let 12 won
      // deals end up pointing at relisted cars.
      if (isWonDealBlock(e)) offerUndoSale(id, () => setListings(relistCar(id)));
      else toast.error("Could not update the car's status. Try again.");
    } finally {
      setUpdatingStatus(null);
    }
  };
  const handlePriceSave = (u) => {
    setListings((p) => p.map((l) => (l.id === u.id ? { ...l, ...u } : l)));
    setDetailListing((prev) => (prev?.id === u.id ? { ...prev, ...u } : prev));
  };
  const handleUpdate = (u) => {
    // Merge (not replace) so fields the edit form doesn't manage — e.g. the
    // stock cost merged in at fetch — survive the save. Also sync the open detail
    // panel so edits show instantly instead of only after a close/reopen.
    setListings((p) => p.map((l) => (l.id === u.id ? { ...l, ...u } : l)));
    setDetailListing((prev) => (prev?.id === u.id ? { ...prev, ...u } : prev));
    setEditListing(null);
  };
  const handleProfileUpdate = (updated) => setProfile(updated);

  // Which Settings section the Verify-ID prompt should land on.
  const [settingsJump, setSettingsJump] = useState(null);

  const handleMarkSold = async ({ soldBy = null, soldPrice = null, commission = null, leadId = null } = {}) => {
    if (!markSoldListing) return;
    setMarkSoldLoading(true);
    try {
      if (leadId) {
        // A real win: the won trigger flips the car, makes the customer and seeds the handover.
        // close_deal_at_price records the price as the agreed price (batch 6a); a discount over
        // the limit from a role that cannot approve waits for the dealer instead.
        const { data: res, error: rpcErr } = await supabase.rpc("close_deal_at_price", {
          p_lead: leadId, p_agreed: soldPrice ?? null, p_closer: soldBy || null,
        });
        if (rpcErr && rpcErr.code !== "PGRST202") throw rpcErr;
        if (res?.status === "pending") {
          toast.success("Sent to the dealer to approve the price. The car is marked sold once they say yes.");
          setMarkSoldListing(null);
          setMarkSoldLoading(false);
          return;
        }
        if (rpcErr) {
          // Function not on the database yet (queued migration): the old write.
          const { data: won, error: winErr } = await supabase
            .from("leads").update({ stage: "won", ...(soldBy ? { salesman_id: soldBy } : {}) }).eq("id", leadId).select("id");
          if (winErr) throw winErr;
          if (!won?.length) throw new Error("lead update refused");
        }
      }
      const update = {
        status: "sold",
        sold_at: new Date().toISOString(),
        sold_price: soldPrice ?? markSoldListing.selling_price ?? null,
        sold_date: new Date().toISOString().slice(0, 10),
      };
      // Only write what the dealer actually gave — a blank never overwrites a
      // value already on the car.
      if (soldBy) update.assigned_to = soldBy;
      if (commission != null && !Number.isNaN(commission)) update.commission_amount = commission;
      const { data, error } = await supabase
        .from("car_listings")
        .update(update)
        .eq("id", markSoldListing.id)
        .select();
      if (error) throw error;
      const updated = data?.[0] ?? { ...markSoldListing, status: "sold" };
      logActivity({ dealerId: userId, actor: profile, tableName: 'car_listings', recordId: markSoldListing.id, action: 'marked_sold', summary: `Marked sold — ${markSoldListing.brand} ${markSoldListing.model} ${markSoldListing.year}` });
      setListings((p) => p.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
      setDetailListing((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
      setMarkSoldListing(null);
      // The merged listings state above feeds StockTab's P&L; TeamTab refetches
      // per-salesman gross on mount, so no out-of-scope refetch is needed here.
    } catch (e) {
      console.error(e);
      const m = String(e?.message || "");
      toast.error(m.includes("car_already_won")
        ? "This car is already sold to another buyer. Undo that sale first."
        : m.includes("bad_price") ? "Enter the price agreed with the buyer."
        : "Could not mark the car as sold. Try again.");
    }
    setMarkSoldLoading(false);
  };

  // Publish an internal (unpublished) car to the public marketplace — flips
  // status to 'available'; the public_car_listings view then exposes it.
  const [publishingId, setPublishingId] = useState(null);
  const handlePublishListing = async (l) => {
    if (!l || publishingId) return;
    setPublishingId(l.id);
    try {
      // Guard on the server-side current status, not the (possibly stale) local
      // `l.status` the button rendered off — e.g. a lead won elsewhere just flipped
      // this car to 'sold' but the dashboard listings array hasn't refetched yet.
      // Without this .eq, a stale click here silently re-lists an already-sold car.
      const { data, error } = await supabase
        .from("car_listings")
        .update({ status: "available" })
        .eq("id", l.id)
        .eq("status", "unpublished")
        .select();
      if (error) {
        if (error.message?.includes('listing_cap_exceeded')) {
          toast.error("Listing cap reached. Upgrade your plan to publish more cars.");
        } else {
          toast.error("Could not publish listing. Try again.");
        }
        throw error;
      }
      if (!data?.length) {
        // Row didn't match status='unpublished' anymore — someone/something else
        // (e.g. a won-lead sale) already moved it on. Refetch the real row instead
        // of trusting local state.
        const { data: fresh } = await supabase.from("car_listings").select("*").eq("id", l.id).single();
        if (fresh) {
          setListings((p) => p.map((x) => (x.id === fresh.id ? fresh : x)));
          if (detailListing?.id === fresh.id) setDetailListing(fresh);
        }
        toast.error(`${l.brand} ${l.model} ${l.year} is no longer unpublished (status: ${fresh?.status || 'unknown'}) — refreshed.`);
        setPublishingId(null);
        return;
      }
      const updated = data[0];
      logActivity({ dealerId: userId, actor: profile, tableName: 'car_listings', recordId: l.id, action: 'published', summary: `Published to marketplace — ${l.brand} ${l.model} ${l.year}` });
      setListings((p) => p.map((x) => (x.id === updated.id ? updated : x)));
      if (detailListing?.id === updated.id) setDetailListing(updated);
      toast.success(`${l.brand} ${l.model} ${l.year} is now live on your marketplace.`);
      setStatusFilter("available");
    } catch (e) {
      console.error('[handlePublishListing]', e);
    }
    setPublishingId(null);
  };

  const activeFilterCount = [filterMinPrice, filterMaxPrice, filterMinMileage, filterMaxMileage, filterCondition, filterTransmission, filterState].filter(Boolean).length;

  const clearFilters = () => { setFilterMinPrice(''); setFilterMaxPrice(''); setFilterMinMileage(''); setFilterMaxMileage(''); setFilterCondition(''); setFilterTransmission(''); setFilterState(''); };

  const filteredListings = useMemo(() => {
    let result = listings.filter((l) => (l.status || 'available') === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) =>
        (l.brand || "").toLowerCase().includes(q) ||
        (l.model || "").toLowerCase().includes(q) ||
        (l.variant || "").toLowerCase().includes(q) ||
        (l.vin || "").toLowerCase().includes(q) ||
        (l.vin_number || "").toLowerCase().includes(q) ||
        (l.plate_number || "").toLowerCase().includes(q)
      );
    }
    if (filterMinPrice)    result = result.filter(l => (l.selling_price || 0) >= Number(filterMinPrice));
    if (filterMaxPrice)    result = result.filter(l => (l.selling_price || 0) <= Number(filterMaxPrice));
    if (filterMinMileage)  result = result.filter(l => (l.mileage || 0) >= Number(filterMinMileage));
    if (filterMaxMileage)  result = result.filter(l => (l.mileage || 0) <= Number(filterMaxMileage));
    if (filterCondition)   result = result.filter(l => (l.condition || '').toLowerCase() === filterCondition);
    if (filterTransmission)result = result.filter(l => (l.transmission || '').toLowerCase() === filterTransmission.toLowerCase());
    if (filterState)       result = result.filter(l => (l.state || '') === filterState);
    return result;
  }, [listings, searchQuery, statusFilter, filterMinPrice, filterMaxPrice, filterMinMileage, filterMaxMileage, filterCondition, filterTransmission, filterState]);

  // Reset visible window whenever the filtered set changes
  useEffect(() => { setVisibleCount(30); }, [statusFilter, searchQuery, filterMinPrice, filterMaxPrice, filterMinMileage, filterMaxMileage, filterCondition, filterTransmission, filterState]);

  // Infinite scroll — expand visible window when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(c => c + 20); },
      { rootMargin: '300px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [activeTab]);

  const salesmenById = Object.fromEntries(salesmen.map((s) => [s.id, s]));

  const copyListing = (l) => {
    const dealer = {
      site_name: profile?.site_name,
      dealership: profile?.dealership,
      whatsapp_number: profile?.whatsapp_number,
      subdomain: dealerSubdomain || profile?.subdomain,
      slug: profile?.slug,
    };
    navigator.clipboard
      .writeText(buildCaption(l, dealer, "whatsapp").text)
      .then(() => {
        setCopiedListingId(l.id);
        setTimeout(() => setCopiedListingId(null), 2000);
      });
  };

  const reservedCount = listings.filter((l) => l.status === "reserved").length;
  const totalVal = listings.filter(l => l.status !== 'sold').reduce((s, l) => s + (l.selling_price || 0), 0);
  const hotCount = listings.filter(
    (l) =>
      l.original_price &&
      l.selling_price &&
      l.selling_price < l.original_price,
  ).length;

  const STATUS = {
    available: {
      word: premiumLight.up,
      label: "Available",
      dot: "bg-emerald-400",
      cls: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
      next: "reserved",
    },
    reserved: {
      word: premiumLight.text,
      label: "Reserved",
      dot: "bg-amber-400",
      cls: "bg-amber-400/10 text-amber-400 border-amber-400/20",
      next: "sold",
    },
    sold: {
      word: premiumLight.textMuted,
      label: "Sold",
      dot: "bg-red-400",
      cls: "bg-blue-400/10 text-blue-400 border-blue-400/20",
      next: "available",
    },
    unpublished: {
      word: premiumLight.textMuted,
      label: "Unpublished",
      dot: "bg-gray-400",
      cls: "bg-gray-400/10 text-gray-500 border-gray-400/20",
      next: "available",
    },
  };

  const StatusBadge = React.memo(({ listing }) => {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef(null);
    const s = listing.status || "available";
    const cfg = STATUS[s] || STATUS.available;
    const busy = updatingStatus === listing.id;

    React.useEffect(() => {
      if (!open) return;
      const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    return (
      <div ref={ref} className="relative inline-block">
        <button
          onClick={() => !busy && setOpen(o => !o)}
          disabled={busy}
          // premiumLight: one grey pill, the WORD carries the status colour.
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, border: 'none', background: premiumLight.raised, color: cfg.word, fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1, fontFamily: 'inherit' }}
        >
          {busy ? "…" : cfg.label}
          <ChevronDown style={{ width: 12, height: 12, color: premiumLight.textMuted }} />
        </button>
        {open && (
          <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 6, zIndex: 50, background: '#fff', borderRadius: 12, boxShadow: premiumLight.shadow, padding: 4, minWidth: 140 }}>
            {Object.entries(STATUS).map(([key, val]) => (
              <button
                key={key}
                onClick={() => { if (key !== s) handleStatus(listing.id, key); setOpen(false); }}
                style={{ display: 'flex', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: key === s ? 700 : 500, color: val.word, background: key === s ? premiumLight.raised : 'transparent', cursor: key === s ? 'default' : 'pointer', fontFamily: 'inherit' }}
              >
                {val.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  });

  const DiscountCell = React.memo(({ listing }) => {
    const op = listing.original_price || listing.previous_price || null,
      sp = listing.selling_price || listing.price || null;
    if (!op || !sp || op <= sp)
      return (
        <span className="grad-white font-semibold text-sm">
          RM {sp?.toLocaleString()}
        </span>
      );
    const pct = Math.round(((op - sp) / op) * 100),
      isHot = pct >= 3;
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <span className="grad-white font-semibold text-sm">
            RM {sp.toLocaleString()}
          </span>
          <span
            className={`discount-chip inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold border ${isHot ? "bg-gray-100 text-gray-900 border-transparent" : "bg-gray-100 text-red-700 border-transparent"}`}
          >
            {isHot && <Flame className="w-3 h-3" />}−{pct}%
          </span>
        </div>
        <p className="text-gray-600 text-xs line-through mt-0.5">
          RM {op.toLocaleString()}
        </p>
      </div>
    );
  });

  const condCls = (c) =>
    ({
      new: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
      recon:
        "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25",
      used: "bg-white/[0.06] text-gray-500 border border-white/10",
    })[c] || "bg-white/[0.06] text-gray-500 border border-white/10";

  const GRADE_COLORS = { S:'#a78bfa', 5:'#34d399', '4.5':'#6ee7b7', 4:'#fbbf24', '3.5':'#fb923c', 3:'#93c5fd', R:'#ef4444', RA:'#3b82f6', 2:'#1d4ed8', 1:'#1e3a8a' };
  const gradeColor = (g) => GRADE_COLORS[g] || '#6b7280';
  const fmtDate = (d) => { if (!d) return '—'; return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };

  // AI Manager's data loads only while its Overview card is OPEN (closed by default, so a plain
  // Overview visit costs no AI call). Its money lines come from the same engine as Overview
  // (useCarMoney), so the briefing quotes the numbers the owner sees.
  const onAiTab = activeTab === "overview" && aiOpen;
  const { snapshot: aiFacts } = useDealerSnapshot(userId, { enabled: onAiTab });
  const { money: aiMoney, failed: aiMoneyFailed } = useCarMoney(onAiTab ? getDealerIdFromProfile(profile) : null);
  // Memoised: AISalesManager fires its briefing from an effect keyed on `snapshot`, and a new
  // object every render cancelled its timer, so the briefing never ran. Money and days come from
  // the one engine and clock; money a role may not see is left out of the briefing; a failed money
  // read still lets the briefing run on the rest.
  const aiSeeGross = canDo('view_gross'), aiSeeCost = canDo('view_cost');
  const snapshot = useMemo(() => {
    if (!aiFacts || (!aiMoney && !aiMoneyFailed)) return null; // wait for the money (or its failure)
    const m = aiMoney;
    return {
      ...aiFacts,
      avgDaysOnLot: m?.stock.avgDays ?? null,
      staleCars: m ? m.stuck.filter(c => c.flag === 'ageing').map(c => ({ model: c.title, days: c.days, price: c.asking })) : [],
      totalGPThisMonth: m && aiSeeGross ? m.month.gross : null,
      gpLeftOut: m ? m.month.leftOut : 0,
      soldThisMonth: m ? m.month.units : null,
      totalStockValue: m && aiSeeCost ? m.stock.atCost : null,
    };
  }, [aiFacts, aiMoney, aiMoneyFailed, aiSeeGross, aiSeeCost]);

  const TITLES = {
    overview:  { title: "Overview", sub: "Dealership pulse at a glance" },
    listings: { title: "Listings", sub: "Manage your inventory" },
    team: { title: "Team", sub: "Manage salespeople" },
    analytics: ({
      revenue:     { title: "Revenue",     sub: "Sales, gross and add-on revenue" },
      performance: { title: "Traffic", sub: "Website visits, car views and WhatsApp taps" },
    })[analyticsSub] || { title: "Analytics", sub: "Listings, revenue & marketplace traffic" },
    settings: { title: "Settings", sub: "Dealership, front page & account" },
    crm: { title: "CRM", sub: "Pipeline, enquiries, bookings & leads" },
    storefront: { title: "Storefront", sub: "Homepage hero & add-on product catalogue" },
    stock: { title: "Stock", sub: "Vehicle stock units & cost tracking" },
    documents: { title: "Documents", sub: "Sales agreements & receipts" },
    customers:  { title: "Customers",        sub: "Buyer history, expiry tracking & remarketing" },
    handover:   { title: "Handover",         sub: "Post-sale processing: JPJ transfer, Puspakom, road tax & insurance" },
    market:     { title: "Market Demand",    sub: "What Malaysia registered last month, matched against your stock" },
  };

  const NAV_GROUPS = [
    {
      id: "g_reports", Icon: BarChart2, label: "Reports",
      items: [
        { id: "overview",  Icon: Gauge,       label: "Overview" },
        { id: "analytics", sub: "revenue",    Icon: DollarSign, label: "Revenue" },
        { id: "analytics", sub: "performance", Icon: TrendingUp, label: "Traffic" },
      ],
    },
    {
      id: "g_sales", Icon: TrendingUp, label: "Sales",
      items: [
        { id: "crm",  Icon: MessageCircle, label: "Leads / CRM" },
      ],
    },
    {
      id: "g_inventory", Icon: Package, label: "Inventory",
      items: [
        { id: "listings", Icon: Car,        label: "Inventory", badge: listings.length },
      ],
    },
    {
      id: "g_operations", Icon: ClipboardCheck, label: "After the sale",
      items: [
        { id: "handover",  Icon: ClipboardCheck, label: "Sold" },
      ],
    },
    {
      id: "g_growth", Icon: Megaphone, label: "Growth",
      items: [
        { id: "storefront", Icon: Globe,     label: "Storefront" },
      ],
    },
    {
      id: "g_admin", Icon: Users, label: "Admin",
      items: [
        { id: "team",      Icon: Users,  label: "Team" },
      ],
    },
  ];

  const toggleGroup = useCallback((gid) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid); else next.add(gid);
      return next;
    });
  }, []);


  const notifCount = notifications.filter(n => !n.is_read).length;
  const timeAgo = (iso) => {
    if (!iso) return '';
    const s = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  };
  const markNotifRead = async (n) => {
    if (n.is_read) return;
    await supabase.from('dealer_notifications').update({ is_read: true }).eq('id', n.id);
    setNotifications(p => p.map(x => x.id === n.id ? { ...x, is_read: true } : x));
  };
  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read).map(n => n.id);
    if (!unread.length) return;
    await supabase.from('dealer_notifications').update({ is_read: true }).in('id', unread);
    setNotifications(p => p.map(n => ({ ...n, is_read: true })));
  };

  // ── Onboarding completion check ─────────────────────────────────────────
  const onboardingItems = profile ? [
    { label: 'Account created',          done: true },
    { label: 'Add your first listing',   done: listings.length > 0,         action: () => handleTabChange('listings') },
    { label: 'Connect Telegram',         done: !!profile.telegram_bot_token, action: () => handleTabChange('settings') },
    { label: 'Share your storefront',    done: onboardingCopied,             isCopy: true },
  ] : [];
  const onboardingDoneCount = onboardingItems.filter(i => i.done).length;
  const allOnboardingDone   = onboardingDoneCount === onboardingItems.length;

  useEffect(() => {
    if (!allOnboardingDone || !userId || profile?.onboarding_complete) return;
    supabase.from('profiles').update({ onboarding_complete: true }).eq('id', userId);
    setOnboardingDismissed(true);
    setOnboardingToast(true);
    const id = setTimeout(() => setOnboardingToast(false), 5000);
    return () => clearTimeout(id);
  }, [allOnboardingDone]);

  const copyStorefrontOnboarding = () => {
    const url = profile?.subdomain ? buildStorefrontUrl(profile.subdomain) : 'https://drevo.my';
    navigator.clipboard.writeText(url).catch(() => {});
    setOnboardingCopied(true);
  };

  const showOnboardingBanner = profile && profile.onboarding_complete === false && !onboardingDismissed;

  if (profileLoadFailed) return <ProfileLoadError />;
  if (!profile) return <AppLoader theme="light" />;

  // MOBILE-7 follow-up: self-service restore within the 30-day grace window
  // after a delete-account soft delete (SettingsTab's Danger Zone). Same
  // restore_my_account() RPC as SalesmanLite's own gate — it checks the
  // window server-side, so this is only ever a thin UI around it.
  const handleReactivate = async () => {
    setReactivating(true);
    const { error } = await supabase.rpc('restore_my_account');
    if (error) {
      console.error('reactivate:', error);
      toast.error(
        error.message?.includes('restore_window_expired')
          ? 'The 30-day window to restore this account has passed.'
          : "Couldn't restore your account. Please try again.",
      );
      setReactivating(false);
      return;
    }
    window.location.reload();
  };

  if (profile.account_status === 'deleted') {
    const deletedAt = profile.deleted_at ? new Date(profile.deleted_at) : null;
    const daysLeft = deletedAt
      ? Math.max(0, 30 - Math.floor((Date.now() - deletedAt.getTime()) / 86400000))
      : 30;
    return (
      <div style={{ minHeight: '100vh', background: '#f5f6f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f5f6f8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <Trash2 size={24} color="#dc2626" />
          </div>
          <p className="text-gray-900 text-lg font-bold mb-2">Account scheduled for deletion</p>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            {daysLeft > 0
              ? `You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} left to restore this account before it's permanently deleted.`
              : "This account's restore window has ended."}
          </p>
          <button
            onClick={handleReactivate}
            disabled={reactivating}
            className="bg-red-600 text-white text-sm font-bold rounded-lg px-6 py-3 disabled:opacity-60"
          >
            {reactivating ? 'Restoring…' : 'Restore my account'}
          </button>
          <div>
            <button
              onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}
              className="mt-5 text-gray-400 text-xs underline bg-transparent border-none cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Paid dealer whose payment isn't yet confirmed — gate the whole dashboard
  // behind the pending/payment screen until an admin marks payment received.
  if (profile.role === 'dealer' && profile.payment_status === 'pending') {
    return (
      <DealerPendingApproval
        planKey={profile.plan}
        dealershipName={profile.dealership}
        email={profile.email}
        profileId={profile.id}
      />
    );
  }

  // Trial over — same QR screen as onboarding-era payments, in "expired"
  // dress. Auto-forwards when an admin flips subscription_status to active
  // (AdminPage "Mark as Active (Paid)").
  if (!subLoading && status === 'expired') return (
    <DealerPendingApproval
      variant="expired"
      planKey={profile.plan}
      dealershipName={profile.dealership}
      email={profile.email}
      profileId={profile.id}
    />
  );

  return (
    <>
    <SuspendedBanner />
    {trialDaysLeft !== null && ['dealer', 'owner'].includes(profile?.role) && (
      <div style={{ background: '#f5f6f8', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', fontFamily: 'system-ui,sans-serif' }}>
        <span style={{ fontSize: 13, color: trialDaysLeft <= 3 ? '#b91c1c' : '#374151', fontWeight: 600 }}>
          Free trial — {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left. Your data is safe either way.
        </span>
        <a href="https://wa.me/601111521742?text=Hi%2C%20I%20want%20to%20activate%20my%20ShiftOS%20subscription" target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#dc2626', padding: '4px 12px', borderRadius: 6, textDecoration: 'none' }}>
          Activate now
        </a>
      </div>
    )}
    <Helmet>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
    <style>{STYLES}</style>
    <div
      className="min-h-screen flex"
      style={{
        fontFamily: "system-ui,sans-serif",
        background: color.appBg,
        color: color.ink,
      }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => startTransition(() => setSidebarOpen(false))}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed top-0 left-0 h-dvh overflow-hidden z-30 flex flex-col w-full lg:w-60 transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: '#FFFFFF', borderRight: '1px solid #EAECF0' }}
      >
        <div className="flex-shrink-0 px-4 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
          <div className="flex-1 min-w-0">
            {/* Ink variant, not the supplied white one: this sidebar is a LIGHT
                surface (#EAECF0 borders, dark ink), so the white lockup would be
                invisible on it. Same artwork, wordmark recoloured to the
                dashboard's own text colour, red bar untouched. */}
            <img src="/drevo-logo-dark.png" alt="Drevo" width="688" height="120" style={{ height: 16, width: 'auto', display: 'block' }} />
            <p style={{ fontSize: 11, color: color.textMuted, marginTop: 1 }}>Drevo Dashboard</p>
          </div>
          {/* Bell */}
          <div ref={sidebarBellRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => {
              const rect = sidebarBellRef.current?.getBoundingClientRect() ?? null;
              setSidebarBellRect(notifOpen ? null : rect);
              setNotifOpen(p => !p);
            }} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: notifCount > 0 ? '#DC2626' : color.textMuted, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell className="w-4 h-4" />
              {notifCount > 0 && <span style={{ position: 'absolute', top: -2, right: -2, background: '#DC2626', color: '#fff', fontSize: 8, fontWeight: 800, borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{notifCount > 9 ? '9+' : notifCount}</span>}
            </button>
          </div>
          <ReportBugButton variant="inline" context="Dealer Dashboard" userLabel={profile?.full_name || profile?.email || ""} />
          <button
            onClick={() => startTransition(() => setSidebarOpen(false))}
            className="lg:hidden p-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{ color: color.textMuted }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-2 sm:p-3 mt-1" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => tabAllowed(i.id, i.sub)) })).filter((g) => g.items.length).map((group) => {
            if (group.direct) {
              return (
                <button
                  key={group.id}
                  onClick={() => handleTabChange(group.id)}
                  className={`nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === group.id ? "nav-active" : ""}`}
                  style={{ color: activeTab === group.id ? '#DC2626' : color.textMuted }}
                >
                  <group.Icon className="w-4 h-4 flex-shrink-0" />
                  {group.label}
                </button>
              );
            }
            const isOpen = openGroups.has(group.id);
            const hasActive = group.items.some(i => i.id === activeTab);
            return (
              <div key={group.id} ref={(el) => { navGroupRefs.current[group.id] = el; }}>
                <button
                  onClick={() => {
                    const opening = !isOpen;
                    toggleGroup(group.id);
                    if (opening) {
                      // Let the expanded sub-items render first, then scroll
                      // just enough for the whole group (button + its
                      // dropdown) to be visible in the nav's own scroll area.
                      requestAnimationFrame(() => {
                        navGroupRefs.current[group.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      });
                    }
                  }}
                  className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{ color: hasActive ? '#DC2626' : color.textMuted }}
                >
                  <group.Icon className="w-4 h-4 flex-shrink-0" />
                  <span style={{ flex: 1, textAlign: 'left' }}>{group.label}</span>
                  {hasActive && !isOpen && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2626', flexShrink: 0 }} />
                  )}
                  <ChevronRight
                    className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200"
                    style={{ color: color.textMuted, opacity: 0.5, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  />
                </button>
                {isOpen && (
                  <div style={{ marginTop: 1, marginLeft: 12, paddingLeft: 10, borderLeft: '1px solid #EAECF0', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {group.items.map(({ id, sub, Icon, label, badge }) => {
                      const isActive = (activeTab === id || (id === "listings" && (activeTab === "stock" || activeTab === "market")) || (id === "handover" && SOLD_IDS.has(activeTab))) && (!sub || analyticsSub === sub);
                      return (
                        <button
                          key={sub ? `${id}_${sub}` : id}
                          onClick={() => {
                          if (sub) {
                            setAnalyticsSub(sub);
                            setSidebarOpen(false);
                            startTransition(() => navigate(`/dashboard/${id}?sub=${sub}`));
                          } else if (id === "listings") {
                            openInventory(lastInventoryView());
                          } else if (id === "handover") {
                            openSold(lastSoldView());
                          } else {
                            handleTabChange(id);
                          }
                        }}
                          className={`nav-item w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? "nav-active" : ""}`}
                          style={{ color: isActive ? '#DC2626' : color.textMuted }}
                        >
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          {label}
                          {badge !== undefined && (
                            <span
                              className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums"
                              style={{ background: isActive ? '#FFFFFF' : '#F1F3F5', color: isActive ? '#111827' : color.textMuted }}
                            >
                              {badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ height: 1, background: '#EAECF0', margin: '6px 4px' }} />

          {profile?.role === 'superadmin' && (
            <a
              href="/platform"
              className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{ color: color.textMuted }}
            >
              <Shield className="w-4 h-4 flex-shrink-0" />
              Admin Panel
            </a>
          )}
        </nav>

        {/* ── Sidebar bottom ── */}
        <div className="shrink-0 p-3 space-y-1" style={{ borderTop: '1px solid rgba(17,24,39,0.06)' }}>
          {/* Profile row */}
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <Avatar size="lg" profile={profile} />
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 13, fontWeight: 600, color: color.ink }} className="truncate">
                {profile?.full_name || "—"}
              </p>
              <p style={{ fontSize: 11, color: color.textMuted }} className="truncate">
                {profile?.email || ""}
              </p>
            </div>
          </div>

          {/* Dealership link */}
          {profile?.dealership && (
            <a
              href={getStorefrontUrl()}
              target="_blank"
              rel="noopener noreferrer"
              title="Open your public storefront"
              className="flex items-center gap-2 rounded-lg px-3 py-2 mx-1 group"
              style={{ background: '#F7F8FA', textDecoration: 'none', transition: 'background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#E4E7EC'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F7F8FA'; }}
            >
              <Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#DC2626' }} />
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 12, fontWeight: 600, color: color.ink }} className="truncate">
                  {profile.dealership}
                </p>
                <p style={{ fontSize: 10, color: '#DC2626', marginTop: 1 }} className="truncate">
                  {(dealerSubdomain || profile.subdomain) ? `${dealerSubdomain || profile.subdomain}.drevo.my` : 'drevo.my'}
                </p>
              </div>
              <ExternalLink className="w-3 h-3 flex-shrink-0" style={{ color: '#DC2626', opacity: 0.6 }} />
            </a>
          )}

          {/* Plan tier chip */}
          {/* Billing is the owner's: staff never see the plan or the upgrade link. */}
          {isOwnerView && planCfg && profile?.plan && profile.plan !== 'superadmin' && (
            <div style={{ background: '#F7F8FA', border: '1px solid #EAECF0', borderRadius: 8, padding: '8px 10px', margin: '0 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: color.textMuted, textTransform: 'uppercase' }}>Plan</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#111827', background: '#F1F3F5', borderRadius: 4, padding: '1px 5px' }}>{planCfg.label}</span>
              </div>
              {nextPlanCfg && (
                <a href="mailto:support@xdrive.my?subject=Upgrade Plan" style={{ display: 'block', textAlign: 'center', marginTop: 6, fontSize: 10, fontWeight: 600, color: '#DC2626', textDecoration: 'none' }}>
                  Upgrade to {nextPlanCfg.label}
                </a>
              )}
            </div>
          )}

          {/* Settings */}
          <button
            onClick={() => handleTabChange("settings")}
            className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{ color: activeTab === "settings" ? '#DC2626' : color.textMuted }}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            Settings
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
            style={{ color: color.textMuted }}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 lg:ml-60 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <div
          className="lg:hidden sticky top-0 z-10 flex items-center gap-2 px-3 py-2.5"
          style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(17,24,39,0.06)', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
        >
          <button
            onClick={() => startTransition(() => setSidebarOpen(true))}
            className="p-1.5 rounded-lg transition-all flex-shrink-0"
            style={{ color: color.textMuted }}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Always visible, at the size the red "S" badge used to be. That
                badge was the only brand mark on this bar below sm (the wordmark
                was hidden there), so hiding both would leave a 375px dealer bar
                with no brand at all. One mark, the lockup — not a badge saying
                the same thing beside it. */}
            <img src="/drevo-logo-dark.png" alt="Drevo" width="688" height="120" style={{ height: 14, width: 'auto', display: 'block' }} />
          </div>
          <span style={{ fontSize: 12, color: color.textMuted }} className="truncate flex-1 min-w-0">
            {TITLES[activeTab]?.title}
          </span>
          <ReportBugButton variant="inline" context="Dealer Dashboard" userLabel={profile?.full_name || profile?.email || ""} />
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setNotifOpen(p => !p)}
              style={{
                position: 'relative', background: 'transparent',
                border: 'none', borderRadius: 8, padding: 6,
                cursor: 'pointer', color: notifCount > 0 ? '#DC2626' : color.textMuted,
                display: 'flex',
              }}
            >
              <Bell className="w-4 h-4" />
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -3,
                  background: '#DC2626', color: '#fff',
                  fontSize: 8, fontWeight: 800, borderRadius: '50%',
                  width: 14, height: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <>
                <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 50, width: 320, maxHeight: 420, overflowY: 'auto', background: '#FFFFFF', border: '1px solid #EAECF0', borderRadius: 12, boxShadow: '0 8px 32px rgba(15,23,42,0.12)', fontFamily: "system-ui, sans-serif" }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: color.ink }}>Notifications</span>
                    {notifCount > 0 && <button onClick={markAllRead} style={{ fontSize: 11, color: color.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Mark all read</button>}
                  </div>
                  {notifications.length === 0 ? (
                    <p style={{ fontSize: 13, color: color.textMuted, padding: '20px 16px', textAlign: 'center' }}>No notifications</p>
                  ) : notifications.slice(0, 10).map(n => (
                    <div key={n.id} onClick={() => { if (n.link_to) { handleTabChange(n.link_to); setNotifOpen(false); } markNotifRead(n); }} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(17,24,39,0.06)', cursor: n.link_to ? 'pointer' : 'default', background: n.is_read ? 'transparent' : '#F5F6F8', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#F7F8FA'} onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : '#F5F6F8'}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        {!n.is_read && <div style={{ width: 6, height: 6, background: '#DC2626', borderRadius: '50%', flexShrink: 0, marginTop: 5 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: color.ink, margin: '0 0 2px', lineHeight: 1.3 }}>{n.title || 'Notification'}</p>
                          {n.body && <p style={{ fontSize: 12, color: color.textMuted, margin: '0 0 4px', lineHeight: 1.4 }}>{n.body}</p>}
                          <p style={{ fontSize: 10, color: color.textMuted, margin: 0 }}>{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <Avatar profile={profile} />
        </div>

        {/* ── Onboarding Banner ── */}
        {showOnboardingBanner && (
          <div style={{ background: '#F5F6F8', padding: '14px 24px', fontFamily: "system-ui,sans-serif", position: 'sticky', top: 0, zIndex: 15 }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, background: '#FFFFFF', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckSquare className="w-3.5 h-3.5" style={{ color: '#374151' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: color.ink, margin: 0, lineHeight: 1.2 }}>Setup Progress</p>
                    <p style={{ fontSize: 11, color: '#92400E', margin: 0 }}>{onboardingDoneCount} of {onboardingItems.length} complete</p>
                  </div>
                </div>
                <button
                  onClick={() => setOnboardingDismissed(true)}
                  style={{ background: 'none', border: 'none', color: color.textMuted, cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div style={{ height: 4, background: '#E4E7EC', borderRadius: 4, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(onboardingDoneCount / onboardingItems.length) * 100}%`, background: '#111827', borderRadius: 4, transition: 'width 0.4s ease' }} />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {onboardingItems.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      if (item.isCopy) copyStorefrontOnboarding();
                      else if (item.action && !item.done) item.action();
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '6px 12px',
                      background: '#FFFFFF',
                      borderRadius: 8,
                      cursor: (!item.done || item.isCopy) ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!item.done || item.isCopy) e.currentTarget.style.background = '#F1F3F5'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
                  >
                    {item.done
                      ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#16A34A' }} />
                      : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid #D1D5DB', flexShrink: 0 }} />
                    }
                    <span style={{ fontSize: 12, color: item.done ? '#16A34A' : color.textMuted, fontWeight: item.done ? 500 : 400, whiteSpace: 'nowrap' }}>
                      {item.label}
                      {item.isCopy && item.done && ' ✓'}
                      {item.isCopy && !item.done && ' (click to copy)'}
                    </span>
                    {!item.done && item.action && <ChevronRight className="w-3 h-3 text-gray-600 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Congrats toast ── */}
        {onboardingToast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99, background: '#fff', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontFamily: "system-ui,sans-serif", animation: 'slideUp 0.3s ease' }}>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: color.ink, margin: 0 }}>Setup complete!</p>
              <p style={{ fontSize: 12, color: color.textMuted, margin: 0 }}>Your storefront is fully configured.</p>
            </div>
          </div>
        )}

        <div className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* The page title is said ONCE. Tabs that draw their own heading (or a
              sub-tab bar that names the page) skip this one; it used to sit on top
              of them, e.g. "Revenue" above "Revenue Operations" (owner, 2026-11-09). */}
          {TITLES[activeTab] && !(OWN_HEADING_TABS.has(activeTab) || (activeTab === "analytics" && analyticsSub !== "performance")) && (
          <div className="hidden sm:block mb-3 sm:mb-4">
            <h1 style={{ fontSize: 18, fontWeight: 700, color: color.ink, letterSpacing: '-0.01em', margin: 0 }}>
              {TITLES[activeTab]?.title}
            </h1>
            <p style={{ fontSize: 12, color: color.textMuted, marginTop: 2 }}>
              {TITLES[activeTab]?.sub}
            </p>
            <div className="mt-3 h-px" style={{ background: '#EAECF0' }} />
          </div>
          )}

          {/* Push is REQUIRED on the dealer account: no "Not now", and it sits
              above every tab until this device is subscribed. Both dealers had
              zero devices, so leads only reached them if the dashboard happened
              to be open. Dealer/owner only — dealer_notifications push to
              dealer_id alone, so a manager turning it on would receive nothing.
              Not on Settings, which already has the PushToggle card. */}
          {(profile?.role === "dealer" || profile?.role === "owner") && activeTab !== "settings" && (
            <PushPromptStrip
              t={{ panel: "#fff", border: "#e5e7eb", sub: "#374151" }}
              audience="dealer_home"
              boxed
              required
              userId={profile?.id}
            />
          )}

          {/* ── Overview Tab ── */}
          {activeTab === "overview" && userId && (
            <div className="space-y-4">
              {profile?.plan !== "dealer_starter" && tabAllowed("ai_manager") && (
                <AiManagerCard
                  open={aiOpen}
                  onToggle={() => setAiOpen(o => !o)}
                  snapshot={snapshot}
                  dealerName={profile?.dealership || profile?.site_name || "Your Dealership"}
                />
              )}
              <OverviewTab dealerId={getDealerIdFromProfile(profile)} onNavigate={handleTabChange} role={profile?.role} can={canDo} />
            </div>
          )}

          {/* ── Listings Tab ── */}
          {activeTab === "listings" && (
            <>
              <InventorySwitch tabs={INVENTORY_TABS.filter(t => tabAllowed(t.id))} active="listings" onChange={openInventory} />
              {/* The badge is worth nothing if nobody finds the upload step, and
                  Settings is the screen a dealer never opens. Jumps straight to
                  the Verified Badge section. */}
              <VerifyBadgePrompt
                profile={profile}
                theme="light"
                onStart={() => { setSettingsJump("verify"); handleTabChange("settings"); }}
              />

              {/* Cars a salesman drafted (DRAFTS-1): the owner, or a manager with "Approve listings". */}
              {(isOwnerView || canDo("approve_listings")) && (
                <ApprovalQueue
                  dealerId={getDealerIdFromProfile(profile)}
                  canSeeCost={isOwnerView || canDo("view_cost")}
                  onChanged={(id, status) => setListings((p) => p.map((x) => (x.id === id ? { ...x, status } : x)))}
                />
              )}

              {/* ── Listings panel ── one card: search, filters, the one Add car button,
                  the status pills, then the cars. No count tiles: the pills carry the counts. */}
              <div style={{ ...INV_CARD, overflow: 'hidden', fontFamily: "system-ui, sans-serif" }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 16px 0', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '1 1 100px', minWidth: 0 }}>
                      <Search style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: premiumLight.textMuted, pointerEvents: 'none' }} />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search cars"
                        style={{ ...INV_INPUT, padding: '9px 30px 9px 32px' }}
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} aria-label="Clear search" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: premiumLight.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                          <X style={{ width: 14, height: 14 }} />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setShowFilters(p => !p)}
                      style={{ ...INV_GHOST_BTN, background: showFilters || activeFilterCount > 0 ? premiumLight.text : premiumLight.raised, color: showFilters || activeFilterCount > 0 ? '#fff' : premiumLight.text }}
                    >
                      <SlidersHorizontal style={{ width: 14, height: 14 }} />
                      <span className="inv-sm-hide">Filters</span>
                      {activeFilterCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>{activeFilterCount}</span>}
                    </button>
                    <AutoPostButton onCount={autoPost.onCount} onClick={() => setAutoPostOpen(true)} />
                    <AddCarButton onClick={() => setAddCarOpen(true)} />
                  </div>
                  <AutoPostSheet
                    open={autoPostOpen}
                    onClose={() => setAutoPostOpen(false)}
                    state={autoPost.state}
                    onSetup={() => { setSettingsJump("autopost"); handleTabChange("settings"); }}
                  />

                  {/* ── Collapsible filter panel ── */}
                  {showFilters && (
                    <div style={{ margin: '12px 16px 0', padding: '14px 16px', background: premiumLight.raised, borderRadius: premiumLight.radius.row }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Min Price (RM)</label>
                          <input type="number" value={filterMinPrice} onChange={e => setFilterMinPrice(e.target.value)} placeholder="e.g. 20000" style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 7, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: "system-ui,sans-serif" }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Max Price (RM)</label>
                          <input type="number" value={filterMaxPrice} onChange={e => setFilterMaxPrice(e.target.value)} placeholder="e.g. 150000" style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 7, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: "system-ui,sans-serif" }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Min Mileage (km)</label>
                          <input type="number" value={filterMinMileage} onChange={e => setFilterMinMileage(e.target.value)} placeholder="e.g. 0" style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 7, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: "system-ui,sans-serif" }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Max Mileage (km)</label>
                          <input type="number" value={filterMaxMileage} onChange={e => setFilterMaxMileage(e.target.value)} placeholder="e.g. 100000" style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 7, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: "system-ui,sans-serif" }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Condition</label>
                          <select value={filterCondition} onChange={e => setFilterCondition(e.target.value)} style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 7, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: "system-ui,sans-serif" }}>
                            <option value="">All</option>
                            <option value="new">New</option>
                            <option value="used">Used</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Transmission</label>
                          <select value={filterTransmission} onChange={e => setFilterTransmission(e.target.value)} style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 7, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: "system-ui,sans-serif" }}>
                            <option value="">All</option>
                            <option value="Auto">Auto</option>
                            <option value="Manual">Manual</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>State</label>
                          <select value={filterState} onChange={e => setFilterState(e.target.value)} style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 7, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: "system-ui,sans-serif" }}>
                            <option value="">All States</option>
                            {['Johor','Kedah','Kelantan','Kuala Lumpur','Labuan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis','Pulau Pinang','Putrajaya','Sabah','Sarawak','Selangor','Terengganu'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      {activeFilterCount > 0 && (
                        <button onClick={clearFilters} style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: "system-ui,sans-serif" }}>
                          Clear all filters ({activeFilterCount})
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── Status pills ── */}
                  <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                    <StatusPills
                      active={statusFilter}
                      onChange={(k) => { setStatusFilter(k); setSelectedIds(new Set()); }}
                      items={[
                        { key: 'available', label: 'Available', count: listings.filter(l => (l.status || 'available') === 'available').length },
                        { key: 'reserved', label: 'Reserved', count: listings.filter(l => l.status === 'reserved').length },
                        // Sold moves to the Sold tab once it exists (owner, 2026-11-09).
                        { key: 'sold',     label: 'Sold',     count: listings.filter(l => l.status === 'sold').length },
                        { key: 'unpublished', label: 'Unpublished', count: listings.filter(l => l.status === 'unpublished').length },
                      ].filter(t => t.count > 0 || t.key === 'available' || t.key === statusFilter)}
                    />
                    </div>
                    {filteredListings.length > 0 && (
                      <button onClick={exportListingsCSV} title="Download the cars on screen as a CSV (price, days listed, views, enquiries)"
                        style={{ ...INV_GHOST_BTN, padding: '7px 12px', fontSize: 12, flexShrink: 0 }}>
                        <Download style={{ width: 13, height: 13 }} /><span className="inv-sm-hide">Export</span>
                      </button>
                    )}
                    {filteredListings.length > 0 && statusFilter !== 'sold' && (
                      <button
                        onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
                        style={{ ...INV_GHOST_BTN, padding: '7px 12px', fontSize: 12, flexShrink: 0, background: selectMode ? premiumLight.text : premiumLight.raised, color: selectMode ? '#fff' : premiumLight.text }}
                      >
                        {selectMode ? 'Done' : 'Select'}
                      </button>
                    )}
                  </div>
                  <BulkBar
                    count={selectedIds.size}
                    total={filteredListings.length}
                    busy={bulkBusy}
                    onSelectAll={() => setSelectedIds(new Set(filteredListings.map(l => l.id)))}
                    onClear={exitSelect}
                    onStatus={bulkStatus}
                    onPrice={() => setBulkPriceOpen(true)}
                  />
                  <BulkPriceSheet
                    open={bulkPriceOpen}
                    cars={selectedCars.filter(l => l.status !== 'sold')}
                    busy={bulkBusy}
                    onClose={() => setBulkPriceOpen(false)}
                    onApply={bulkPrice}
                  />
                  <div style={{ height: 1, background: premiumLight.line }} />

                {loading ? (
                  <div style={{ padding: 52, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>Loading…</div>
                ) : filteredListings.length === 0 ? (
                  <div style={{ padding: 52, textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: premiumLight.raised, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                      <Car style={{ width: 22, height: 22, color: premiumLight.textMuted }} />
                    </div>
                    <p style={{ color: '#4b5563', fontSize: 13, marginBottom: listings.length === 0 ? 16 : 0 }}>
                      {listings.length === 0 ? 'No listings yet' : `No ${statusFilter} listings`}
                    </p>
                    {listings.length === 0 && (
                      <AddCarButton onClick={() => setAddCarOpen(true)} label="Add your first car" />
                    )}
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                      {/* Cost / Recon / Gross columns removed (2026-11-09): a dealer's cost
                          lives on stock_units only (batch 4), so on car_listings they were
                          always blank. The Stock & costs pill shows them. */}
                      <table style={{ width: '100%', minWidth: 940, borderCollapse: 'collapse', fontFamily: "system-ui, sans-serif" }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${premiumLight.line}` }}>
                            {['', 'Vehicle', 'Price', 'Last 30 days', 'Year / Km', 'Grade', 'Seller', 'Age', 'Status'].map((h, i) => (
                              <th key={i} style={{ ...INV_MICRO, padding: '11px 16px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredListings.slice(0, visibleCount).map((l) => {
                            const isSold = l.status === 'sold';
                            const extGC = gradeColor(String(l.auction_grade));
                            const sp = l.selling_price || l.price || 0;
                            const op = l.original_price || l.previous_price || null;
                            const pct = op && op > sp ? Math.round(((op - sp) / op) * 100) : 0;
                            const isHot = pct >= 3;
                            return (
                              <tr
                                key={l.id}
                                onClick={() => (selectMode ? toggleSelected(l.id) : setDetailListing(l))}
                                style={{ borderBottom: `1px solid ${premiumLight.line}`, cursor: 'pointer', transition: 'background 0.12s', opacity: isSold ? 0.5 : 1, background: selectedIds.has(l.id) ? premiumLight.raised : undefined }}
                                onMouseEnter={e => e.currentTarget.style.background = premiumLight.raised}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                {/* Thumbnail */}
                                <td style={{ padding: '12px 8px 12px 16px', width: 84, position: 'relative' }}>
                                  {selectMode && <SelectTick on={selectedIds.has(l.id)} />}
                                  {l.images?.[0]
                                    ? <img src={cdnImg(l.images[0], 160, 70)} onError={imgFallback(l.images[0])} alt="" loading="lazy" decoding="async" style={{ width: 72, height: 48, borderRadius: 8, objectFit: 'cover', display: 'block', filter: isSold ? 'grayscale(0.7) brightness(0.7)' : 'none' }} />
                                    : <div style={{ width: 72, height: 48, borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car style={{ width: 16, height: 16, color: '#374151' }} /></div>
                                  }
                                </td>
                                {/* Vehicle */}
                                <td style={{ padding: '12px 16px', minWidth: 165 }}>
                                  <p style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0, fontWeight: 600 }}>{l.brand}</p>
                                  <p style={{ fontSize: 14, color: '#111827', fontWeight: 700, lineHeight: 1.25, margin: '3px 0 0' }}>{l.model}</p>
                                  {l.variant && <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{l.variant}</p>}
                                  {(l.vin || l.vin_number) && <p style={{ fontSize: 10, color: '#374151', margin: '3px 0 0', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{(l.vin || l.vin_number).trim()}</p>}
                                </td>
                                {/* Price */}
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                  <p style={{ fontSize: 14, color: '#111827', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>RM {sp.toLocaleString()}</p>
                                  {pct > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                      <span style={{ fontSize: 10, color: '#374151', textDecoration: 'line-through' }}>RM {op.toLocaleString()}</span>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: premiumLight.accentText, background: premiumLight.raised, borderRadius: 999, padding: '1px 7px' }}>−{pct}%</span>
                                    </div>
                                  )}
                                </td>
                                {/* Interest: counted views + enquiry taps, last 30 days */}
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                  <InterestCell stats={carInterest ? (carInterest[l.id] || { views: 0, enq: 0 }) : null} scans={stickerScans ? (stickerScans[l.id] || 0) : null} />
                                </td>
                                {/* Year / Km */}
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                  {l.year && <p style={{ fontSize: 13, color: '#374151', fontWeight: 600, margin: 0 }}>{l.year}</p>}
                                  {l.mileage
                                    ? <p style={{ fontSize: 11, color: '#6b7280', margin: l.year ? '2px 0 0' : 0 }}>{Number(l.mileage).toLocaleString()} km</p>
                                    : !l.year && <span style={{ color: '#374151', fontSize: 13 }}>—</span>
                                  }
                                </td>
                                {/* Grade */}
                                <td style={{ padding: '12px 16px' }}>
                                  {l.auction_grade
                                    ? <span style={{ fontSize: 12, fontWeight: 700, color: premiumLight.text, background: premiumLight.raised, borderRadius: 999, padding: '3px 9px', display: 'inline-block' }}>{l.auction_grade}</span>
                                    : l.condition
                                      ? <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>{l.condition}</span>
                                      : <span style={{ color: '#374151', fontSize: 12 }}>—</span>
                                  }
                                </td>
                                {/* Seller — only meaningful once sold (shows the salesman who closed
                                    the deal). Available cars aren't "assigned", so leave it blank. */}
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                  {(() => {
                                    if (!isSold) return <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>;
                                    const sm = l.assigned_to ? salesmenById[l.assigned_to] : null;
                                    if (!sm) return <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Dealer</span>;
                                    const nm = sm.full_name || 'Salesman';
                                    return (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                                          {sm.avatar_url ? <img src={sm.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : nm[0].toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>{nm}</span>
                                      </div>
                                    );
                                  })()}
                                </td>
                                {/* Age */}
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                  <AgeBadge createdAt={l.created_at} />
                                  <span style={{ display: 'block', fontSize: 10, color: '#374151', marginTop: 4 }}>{fmtDate(l.created_at)}</span>
                                </td>
                                {/* Status */}
                                <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                                  <StatusBadge listing={l} />
                                  {!isSold && (() => {
                                    const gaps = getListingGaps(l);
                                    if (gaps.length === 0) return null;
                                    return (
                                      <span
                                        title={`Missing: ${gaps.join(', ')}`}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10, fontWeight: 700, color: premiumLight.accentText, background: premiumLight.raised, borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap', width: 'fit-content', cursor: 'default' }}
                                      >
                                        <AlertCircle style={{ width: 10, height: 10 }} />
                                        Incomplete
                                      </span>
                                    );
                                  })()}
                                  {l.status === 'unpublished' && (
                                    <button
                                      onClick={e => { e.stopPropagation(); handlePublishListing(l); }}
                                      disabled={publishingId === l.id}
                                      style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10, fontWeight: 700, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 5, padding: '4px 9px', cursor: publishingId === l.id ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: publishingId === l.id ? 0.6 : 1 }}
                                    >
                                      <Globe style={{ width: 10, height: 10 }} />
                                      {publishingId === l.id ? 'Publishing…' : 'Publish'}
                                    </button>
                                  )}
                                  {Array.isArray(l.included_services) && l.included_services.length > 0 && (
                                    <button
                                      onClick={e => { e.stopPropagation(); setSvcPopupListing(l); }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10, color: premiumLight.textSec, background: premiumLight.raised, border: 'none', borderRadius: 999, padding: '2px 7px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    >
                                      <Tag style={{ width: 9, height: 9 }} />
                                      {l.included_services.length} svc
                                    </button>
                                  )}
                                  {(() => {
                                    const rtD = l.road_tax_expiry ? (new Date(l.road_tax_expiry) - Date.now()) / 86400000 : null;
                                    if (rtD === null || rtD > 30) return null;
                                    const c = rtD < 0 ? '#ef4444' : rtD <= 7 ? '#f97316' : '#fbbf24';
                                    const lbl = rtD < 0 ? 'Road tax exp.' : `RT ${Math.ceil(rtD)}d`;
                                    return <span style={{ display: 'block', width: 'fit-content', marginTop: 5, fontSize: 10, fontWeight: 700, color: plWord(c), background: premiumLight.raised, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>{lbl}</span>;
                                  })()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden">
                      {filteredListings.slice(0, visibleCount).map((l) => {
                        const isSold = l.status === 'sold';
                        const sp = l.selling_price || l.price || 0;
                        const op = l.original_price || l.previous_price || null;
                        const pct = op && op > sp ? Math.round(((op - sp) / op) * 100) : 0;
                        const isHot = pct >= 3;
                        return (
                          <div
                            key={l.id}
                            onClick={() => (selectMode ? toggleSelected(l.id) : setDetailListing(l))}
                            style={{ padding: '14px 16px', borderBottom: `1px solid ${premiumLight.line}`, opacity: isSold ? 0.55 : 1, cursor: 'pointer', background: selectedIds.has(l.id) ? premiumLight.raised : undefined }}
                          >
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative' }}>
                              {selectMode && <SelectTick on={selectedIds.has(l.id)} />}
                              {/* Image */}
                              {l.images?.[0]
                                ? <img src={cdnImg(l.images[0], 160, 70)} onError={imgFallback(l.images[0])} alt="" loading="lazy" decoding="async" style={{ width: 80, height: 60, borderRadius: 10, objectFit: 'cover', flexShrink: 0, filter: isSold ? 'grayscale(0.7) brightness(0.7)' : 'none' }} />
                                : <div style={{ width: 80, height: 60, borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car style={{ width: 18, height: 18, color: '#374151' }} /></div>
                              }
                              {/* Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, fontWeight: 600 }}>{l.brand}{l.year ? ` · ${l.year}` : ''}</p>
                                    <p style={{ fontSize: 15, color: '#111827', fontWeight: 700, lineHeight: 1.25, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.model}</p>
                                    {l.variant && <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.variant}</p>}
                                  </div>
                                  <span onClick={e => e.stopPropagation()} style={{ flexShrink: 0, marginTop: 1 }}>
                                    <StatusBadge listing={l} />
                                  </span>
                                </div>
                                {/* Price */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
                                  <span style={{ fontSize: 15, color: '#111827', fontWeight: 700, letterSpacing: '-0.01em' }}>RM {sp.toLocaleString()}</span>
                                  {pct > 0 && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: premiumLight.accentText, background: premiumLight.raised, borderRadius: 999, padding: '1px 7px' }}>−{pct}%</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Meta row — indented under image */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 9, paddingLeft: 92 }}>
                              {(l.vin || l.vin_number) && <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{(l.vin || l.vin_number).trim()}</span>}
                              {l.mileage && <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{Number(l.mileage).toLocaleString()} km</span>}
                              <div style={{ flexBasis: 'calc(100% + 92px)', margin: '4px 0 0 -92px' }}><InterestCell compact stats={carInterest ? (carInterest[l.id] || { views: 0, enq: 0 }) : null} scans={stickerScans ? (stickerScans[l.id] || 0) : null} /></div>
                              {l.state && <><span style={{ color: '#1f2937', fontSize: 10 }}>·</span><span style={{ fontSize: 11, color: '#6b7280' }}>{l.state}</span></>}
                              {(() => {
                                const sm = l.assigned_to ? salesmenById[l.assigned_to] : null;
                                const nm = sm?.full_name || null;
                                return (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: nm ? premiumLight.textSec : premiumLight.textMuted, background: premiumLight.raised, borderRadius: 999, padding: '2px 8px' }}>
                                    <UserPlus style={{ width: 9, height: 9 }} />{nm || 'Unassigned'}
                                  </span>
                                );
                              })()}
                              <AgeBadge createdAt={l.created_at} />
                              {!isSold && (() => {
                                const gaps = getListingGaps(l);
                                if (gaps.length === 0) return null;
                                return (
                                  <span title={`Missing: ${gaps.join(', ')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: premiumLight.accentText, background: premiumLight.raised, borderRadius: 999, padding: '1px 6px' }}>
                                    <AlertCircle style={{ width: 9, height: 9 }} />Incomplete
                                  </span>
                                );
                              })()}
                              {(() => {
                                const rtD = l.road_tax_expiry ? (new Date(l.road_tax_expiry) - Date.now()) / 86400000 : null;
                                if (rtD === null || rtD > 30) return null;
                                const c = rtD < 0 ? '#ef4444' : rtD <= 7 ? '#f97316' : '#fbbf24';
                                return <span style={{ fontSize: 10, fontWeight: 700, color: plWord(c), background: premiumLight.raised, borderRadius: 999, padding: '2px 8px' }}>{rtD < 0 ? 'RT exp.' : `RT ${Math.ceil(rtD)}d`}</span>;
                              })()}
                              {Array.isArray(l.included_services) && l.included_services.length > 0 && (
                                <button
                                  onClick={e => { e.stopPropagation(); setSvcPopupListing(l); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: premiumLight.textSec, background: premiumLight.raised, border: 'none', borderRadius: 999, padding: '2px 7px', cursor: 'pointer' }}
                                >
                                  <Tag style={{ width: 9, height: 9 }} />
                                  {l.included_services.length} svc
                                </button>
                              )}
                              {l.status === 'unpublished' && (
                                <button
                                  onClick={e => { e.stopPropagation(); handlePublishListing(l); }}
                                  disabled={publishingId === l.id}
                                  style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 4, padding: '3px 9px', cursor: publishingId === l.id ? 'default' : 'pointer', opacity: publishingId === l.id ? 0.6 : 1 }}
                                >
                                  <Globe style={{ width: 9, height: 9 }} />
                                  {publishingId === l.id ? 'Publishing…' : 'Publish'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {visibleCount < filteredListings.length && (
                      <div ref={sentinelRef} style={{ height: 1 }} />
                    )}
                    {selectedIds.size > 0 && <div style={{ height: 96 }} />}
                  </>
                )}
                </div>
              </div>
            </>
          )}

          <TabErrorBoundary>
          <React.Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-600 text-sm">Loading…</div>}>
          {/* Adding a car is a full-screen pop-up over the page (plan step 4d, 2026-11-16), opened from
              the Add car sheet's "Full listing" or "Stock only". It was the `add` tab: a page with its own
              picker that the sheet navigated to, and "Stock only" opened a second, nameless form. */}
          {addMode && createPortal(
            <div role="dialog" aria-modal="true" aria-label="Add a car" style={{ position: 'fixed', inset: 0, zIndex: 9000, background: PL.canvas, overflowY: 'auto' }}>
              <div style={{ position: 'sticky', top: 0, zIndex: 2, background: PL.canvas, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${PL.line}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: PL.text }}>{addMode === 'marketplace' ? 'Add a car' : 'Add a car to stock'}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 12, color: PL.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {addMode === 'marketplace' ? 'Goes on the marketplace once you publish' : 'Not on the marketplace until you list it'}
                  </p>
                </div>
                <button type="button" aria-label="Close" onClick={closeAddFlow}
                  style={{ border: 'none', background: PL.hover, borderRadius: 999, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <X style={{ width: 18, height: 18, color: PL.textSec }} />
                </button>
              </div>
              <div style={{ maxWidth: 860, margin: '0 auto', padding: '16px 12px 40px' }}>
                <div style={{ background: PL.card, borderRadius: PL.radius.card, boxShadow: PL.shadow, padding: '16px 14px' }}>
                  {addMode === 'marketplace' ? (
                    <>
                      {/* Where you are in the two steps: core details, then the listing */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                        {[['Core details', 'Car, buy price, asking price', !marketplaceDraftListing], ['Listing', 'Photos, location, features', !!marketplaceDraftListing]].map(([title, sub, on], i) => (
                          <div key={title} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: on ? PL.hover : PL.raised }}>
                            <span style={{ width: 24, height: 24, borderRadius: '50%', background: on ? PL.text : '#fff', color: on ? '#fff' : PL.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                              {i === 0 && marketplaceDraftListing ? <Check style={{ width: 12, height: 12, color: PL.up }} /> : i + 1}
                            </span>
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: on ? PL.text : PL.textMuted }}>{title}</span>
                              <span style={{ display: 'block', fontSize: 11, color: PL.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      {!marketplaceDraftListing ? (
                        <AddCarForm
                          mode="marketplace"
                          onContinueToCarForm={(l) => setMarketplaceDraftListing(l)}
                          onBack={closeAddFlow}
                          onPublished={handleAddCarPublished}
                          onStocked={handleAddCarStocked}
                        />
                      ) : (
                        <CarForm
                          listing={marketplaceDraftListing}
                          intakeDone
                          defaultValues={{ state: profile?.state || '', city: profile?.city || '' }}
                          onBack={() => setMarketplaceDraftListing(null)}
                          onUpdate={handleMarketplacePublish}
                        />
                      )}
                    </>
                  ) : (
                    <AddCarForm mode="internal" onBack={closeAddFlow} onPublished={handleAddCarPublished} onStocked={handleAddCarStocked} />
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )}
          {activeTab === "analytics" && (
            <>
              {/* No sub-tab bar: Revenue / Performance / Listings are already three
                  sidebar items, and the page title names the one that is open. */}
              {analyticsSub === "revenue" && userId && (
                <RevOpsPage userId={getDealerIdFromProfile(profile)} />
              )}
              {analyticsSub === "performance" && userId && (
                <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>}>
                  <PerformanceTab dealerId={getDealerIdFromProfile(profile)} listings={listings} />
                </Suspense>
              )}
            </>
          )}
          {activeTab === "team" && (
            <>
              <TeamBrokersSwitch
                canManage={["dealer", "owner"].includes(profile?.role)}
                dealerId={getDealerIdFromProfile(profile)}
                activity={(
                  /* Who did what, when (was GM Oversight's Activity Trail). Overview's "unusual
                     edits" alert opens it with ?trail=anomaly. */
                  <Suspense fallback={null}>
                    <AuditTrail
                      key={teamTrail}
                      dealerId={getDealerIdFromProfile(profile)}
                      initialFilter={teamTrail === "anomaly" ? "anomaly" : "all"}
                    />
                  </Suspense>
                )}
              >
                <TeamTab managerDealership={profile?.dealership} dealerId={getDealerIdFromProfile(profile)} profile={profile} />
              </TeamBrokersSwitch>
            </>
          )}
          {activeTab === "settings" && profile && (
            <SettingsTab
              profile={profile}
              onProfileUpdate={handleProfileUpdate}
              jumpTo={settingsJump}
              onOpenServices={() => { setStorefrontSub("services"); handleTabChange("storefront"); }}
            />
          )}
          {activeTab === "crm" && (
            <CRMPanel
              userId={userId}
              listings={listings}
              salesmen={salesmen}
              initialTab={crmQuery.sub}
              openLeadId={crmQuery.lead}
              onTabChange={(t) => navigate(`/dashboard/crm?sub=${t}`, { replace: true })}
              onOpenDoc={(data) => { setPrefillDocData(data); handleTabChange('documents'); }}
              hpBoard={tabAllowed('hp') ? (
                <Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Loading...</div>}>
                  <HPBoard dealerId={getDealerIdFromProfile(profile)} />
                </Suspense>
              ) : null}
            />
          )}
          {activeTab === "storefront" && userId && (
            <>
              <SubTabBar
                active={storefrontSub}
                onChange={setStorefrontSub}
                tabs={[
                  { id: "hero",     label: "Hero Carousel" },
                  { id: "services", label: "Services & Add-ons" },
                ]}
              />
              {storefrontSub === "hero" && (
                <HeroSlidesPage userId={userId} profile={profile} />
              )}
              {storefrontSub === "services" && (
                <ServicesPage userId={getDealerIdFromProfile(profile)} profile={profile} />
              )}
            </>
          )}
          {/* The one way to add a car, opened from both Inventory pills. */}
          <AddCarSheet
            open={addCarOpen}
            onClose={() => setAddCarOpen(false)}
            onFull={() => setAddMode("marketplace")}
            onStock={() => setAddMode("internal")}
            onCsv={() => { setStockAutoTool("csv"); handleTabChange("stock"); }}
            onAi={() => navigate("/dashboard/import-stock")}
          />
          {activeTab === "stock" && userId && (
            <>
              <InventorySwitch tabs={INVENTORY_TABS.filter(t => tabAllowed(t.id))} active="stock" onChange={openInventory} />
              {/* The money figures for the stock live here, once. StockTab's own
                  summary cards repeated them, so it is told to skip them. */}
              <StockStatsStrip dealerId={getDealerIdFromProfile(profile)} canSeeProfit={canDo('view_gross')} />
              <StockTab userId={userId} listings={listings} profile={profile} salesmen={salesmen} hideSummary onAdd={() => setAddCarOpen(true)}
                onOpenListing={(l) => { setDetailInitialTab('owner'); setDetailListing(l); }}
                autoTool={stockAutoTool} onToolHandled={() => setStockAutoTool(null)}
                onPublishComplete={(l) => setListings(p => p.some(x => x.id === l.id) ? p.map(x => x.id === l.id ? { ...x, ...l } : x) : [l, ...p])}
              />
            </>
          )}
          {SOLD_IDS.has(activeTab) && (
            <InventorySwitch tabs={SOLD_TABS} active={activeTab} onChange={openSold} />
          )}
          {activeTab === "documents" && (
            <DocumentsTab userId={userId} listings={listings} prefillDocData={prefillDocData} onClearPrefill={() => setPrefillDocData(null)} profile={profile} />
          )}
          {activeTab === "customers" && userId && (
            <CustomersTab dealerId={getDealerIdFromProfile(profile)} handover={soldHandover} />
          )}
          {activeTab === "handover" && userId && (
            <PostSaleBoard dealerId={getDealerIdFromProfile(profile)} controller={soldHandover} theme="plight" />
          )}
          {activeTab === "market" && userId && (
            <>
              <InventorySwitch tabs={INVENTORY_TABS.filter(t => tabAllowed(t.id))} active="market" onChange={openInventory} />
              <MarketDemandTab dealerId={getDealerIdFromProfile(profile)} />
            </>
          )}
          </React.Suspense>
          </TabErrorBoundary>
        </div>
      </main>

      {detailListing && (
        <ListingDetailDrawer
          key={detailListing.id}
          initialTab={detailInitialTab}
          listing={detailListing}
          salesmen={salesmen}
          salesmenById={salesmenById}
          onClose={() => setDetailListing(null)}
          onUpdate={(updated) => {
            setListings(p => p.map(l => l.id === updated.id ? updated : l));
            setDetailListing(updated);
          }}
          onDelete={(id) => {
            setListings(p => p.filter(l => l.id !== id));
            setDetailListing(null);
          }}
          setEditListing={setEditListing}
          setPriceEditListing={setPriceEditListing}
          setMarkSoldListing={setMarkSoldListing}
          setDeleteId={setDeleteId}
          openSticker={(l) => { setDetailListing(null); setStickerCar(l); }}
          copyListing={copyListing}
          copiedListingId={copiedListingId}
          dealerSubdomain={dealerSubdomain}
          dealerSlug={profile?.slug}
          handleAssign={handleAssign}
          handleUnassign={handleUnassign}
          handleStatus={handleStatus}
          updatingStatus={updatingStatus}
          getListingAge={getListingAge}
          userId={userId}
          profile={profile}
          openStudio={(l) => { setDetailListing(null); setStudioListing(l); }}
        />
      )}

      {/* ShiftOS Studio — full-screen editor, mounted at page level so the
          drawer's stacking context can't clip it (overlay rule #1) */}
      {studioListing && (
        <React.Suspense fallback={null}>
          <TikTokStudioV3 listing={studioListing} onClose={() => setStudioListing(null)} />
        </React.Suspense>
      )}

      {/* ── Sidebar notification dropdown (portal — escapes overflow-hidden sidebar) ── */}
      {notifOpen && sidebarBellRect && createPortal(
        <>
          <div onClick={closeNotif} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
          <div style={{
            position: 'fixed',
            top: sidebarBellRect.bottom + 8,
            left: Math.max(8, sidebarBellRect.right - 320),
            width: 320,
            maxHeight: 420,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            fontFamily: "system-ui, sans-serif",
            zIndex: 9999,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Notifications</span>
              {notifCount > 0 && <button onClick={markAllRead} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Mark all read</button>}
            </div>
            {notifications.length === 0 ? (
              <p style={{ fontSize: 13, color: '#4b5563', padding: '20px 16px', textAlign: 'center' }}>No notifications</p>
            ) : notifications.slice(0, 10).map(n => (
              <div key={n.id} onClick={() => { if (n.link_to) { handleTabChange(n.link_to); closeNotif(); } markNotifRead(n); }} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(17,24,39,0.06)', cursor: n.link_to ? 'pointer' : 'default', background: n.is_read ? 'transparent' : '#f9fafb' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {!n.is_read && <div style={{ width: 6, height: 6, background: '#dc2626', borderRadius: '50%', flexShrink: 0, marginTop: 5 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: '0 0 2px' }}>{n.title || 'Notification'}</p>
                    {n.body && <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px' }}>{n.body}</p>}
                    <p style={{ fontSize: 10, color: '#4b5563', margin: 0 }}>{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>,
        document.body
      )}

      {/* ── Services popup ── */}
      {svcPopupListing && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.78)' }}
          onClick={() => setSvcPopupListing(null)}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-sm overflow-hidden"
            style={{ background: '#0f1623', border: '1px solid #e5e7eb' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h3 className="font-semibold text-white text-sm">Included Services</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {svcPopupListing.brand} {svcPopupListing.model} {svcPopupListing.variant || ''}
                </p>
              </div>
              <button onClick={() => setSvcPopupListing(null)} className="text-gray-500 hover:text-gray-900 p-1 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Services list */}
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {(svcPopupListing.included_services || []).map((svc, i) => {
                const cfg = getCategoryCfg(svc.category);
                const CatIcon = cfg.icon;
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <CatIcon className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{svc.name}</p>
                      <p className="text-xs text-gray-500">{cfg.label}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                      RM {Number(svc.selling_price || 0).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Total footer */}
            {svcPopupListing.included_services_cost > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] bg-blue-500/5">
                <span className="text-xs text-gray-500 font-medium">Total value</span>
                <span className="text-sm font-bold text-blue-400">
                  RM {Number(svcPopupListing.included_services_cost).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Fast List modal ── */}
      {/* ── Delete modal ── */}
      {deleteId && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md"
            style={undefined}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">Delete Listing?</h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setDeleteId(null)}
                className="text-gray-500 hover:text-gray-900 p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-5">
              This removes the car from your inventory and your public page.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-900 transition-all border border-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                style={T.btnRed}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <WindowStickerSheet
        car={stickerCar}
        dealerName={profile?.dealership || profile?.site_name}
        scans={stickerCar && stickerScans ? (stickerScans[stickerCar.id] || 0) : null}
        onClose={() => setStickerCar(null)}
      />

      {priceEditListing && (
        <PriceEditModal
          listing={priceEditListing}
          onClose={() => setPriceEditListing(null)}
          onSave={handlePriceSave}
          profile={profile}
          dealerId={userId}
        />
      )}
      {/* Assign dropdown backdrop — closes any open assign dropdown */}
      {assignDropdownId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setAssignDropdownId(null)}
        />
      )}

      {/* Assign toast */}
      {assignToast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white"
          style={{
            background: "rgba(22,163,74,0.92)",
            border: "1px solid rgba(74,222,128,0.3)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <Check className="w-4 h-4 text-green-200" />
          {assignToast.msg}
        </div>
      )}

      {/* Edit listing modal */}
      {editListing && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col"
            style={undefined}
          >
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={T.divider}
            >
              <div>
                <h3 className="font-semibold text-gray-900">Edit Listing</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editListing.brand} {editListing.model}{" "}
                  {editListing.variant || ""}
                </p>
              </div>
              <button
                onClick={() => setEditListing(null)}
                className="text-gray-500 hover:text-gray-900 p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Tabs: public listing details (CarForm) vs cost/procurement (stock unit) */}
            <div className="flex gap-1 px-5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
              {[
                { key: 'listing', label: 'Listing details' },
                { key: 'cost',    label: 'Cost & procurement' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setEditTab(t.key)}
                  className="text-sm font-semibold px-3 py-2.5 transition-colors"
                  style={{
                    color: editTab === t.key ? '#dc2626' : '#6b7280',
                    borderBottom: `2px solid ${editTab === t.key ? '#dc2626' : 'transparent'}`,
                    marginBottom: -1,
                    background: 'none', border: 'none', borderBottomWidth: 2,
                    borderBottomStyle: 'solid',
                    borderBottomColor: editTab === t.key ? '#dc2626' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {editTab === 'listing' ? (
                <CarForm
                  listing={editListing}
                  onUpdate={handleUpdate}
                  onCreate={() => {}}
                />
              ) : (
                <CostProcurementForm
                  listing={editListing}
                  dealerId={getDealerIdFromProfile(profile)}
                  onClose={() => setEditListing(null)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {markSoldListing && (
        <MarkSoldModal
          listing={markSoldListing}
          salesmen={salesmen}
          // Cost from the stock record (overlaid onto the listing rows on load);
          // a dealer car's listing itself holds none (20261109f).
          cost={(Number(markSoldListing.purchase_price) || 0) + (Number(markSoldListing.recon_cost) || 0) || null}
          onClose={() => setMarkSoldListing(null)}
          onConfirm={handleMarkSold}
          loading={markSoldLoading}
        />
      )}

      {/* ── Post-listing stock purchase prompt ── */}
      {pendingStockListing && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-md flex flex-col" style={undefined}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <div>
                <h3 className="font-semibold text-gray-900">Add Purchase Details?</h3>
                <p className="text-gray-500 text-xs mt-0.5">{pendingStockListing.brand} {pendingStockListing.model} {pendingStockListing.year}</p>
              </div>
              <button onClick={() => setPendingStockListing(null)} className="text-gray-500 hover:text-gray-900 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Purchase Price (RM) *</label>
                  <input type="number" value={pendingStockForm.purchase_price} onChange={e => setPendingStockForm(p => ({ ...p, purchase_price: e.target.value }))} placeholder="0" className={iCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Purchase Date</label>
                  <input type="date" value={pendingStockForm.purchase_date} onChange={e => setPendingStockForm(p => ({ ...p, purchase_date: e.target.value }))} className={iCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Source</label>
                  <select value={pendingStockForm.purchase_source} onChange={e => setPendingStockForm(p => ({ ...p, purchase_source: e.target.value }))} className={iCls} style={{ background: '#fff' }}>
                    {['Auction','Direct Buy','Trade-in','Other'].map(s => <option key={s} value={s} style={{ background: '#fff' }}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Recon Cost (RM)</label>
                  <input type="number" value={pendingStockForm.recon_cost} onChange={e => setPendingStockForm(p => ({ ...p, recon_cost: e.target.value }))} placeholder="0" className={iCls} />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-white/[0.06] flex gap-3">
              <button onClick={() => setPendingStockListing(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-900 transition-all border border-gray-200">Skip</button>
              <button
                disabled={pendingStockSaving || !pendingStockForm.purchase_price}
                onClick={async () => {
                  setPendingStockSaving(true);
                  // Upsert: saving the car already made its stock record (trigger
                  // auto_create_stock_unit), so a plain insert hit the unique listing_id
                  // and the typed cost was silently lost.
                  const { error: stockErr } = await supabase.from('stock_units').upsert({
                    dealer_id: userId,
                    listing_id: pendingStockListing.id,
                    // Mirror car identity fields from the listing
                    brand:          pendingStockListing.brand,
                    model:          pendingStockListing.model,
                    year:           pendingStockListing.year,
                    variant:        pendingStockListing.variant,
                    colour:         pendingStockListing.colour,
                    mileage:        pendingStockListing.mileage,
                    transmission:   pendingStockListing.transmission,
                    fuel_type:      pendingStockListing.fuel_type,
                    body_type:      pendingStockListing.body_type,
                    engine_cc:      pendingStockListing.engine_cc,
                    is_recon:       pendingStockListing.is_recon,
                    import_country: pendingStockListing.import_country,
                    auction_grade:  pendingStockListing.auction_grade,
                    interior_grade: pendingStockListing.interior_grade,
                    auction_house:  pendingStockListing.auction_house,
                    vin_number:     pendingStockListing.vin_number,
                    asking_price:   pendingStockListing.selling_price,
                    // Purchase-specific fields from the modal form
                    purchase_price: Number(pendingStockForm.purchase_price) || 0,
                    purchase_date: pendingStockForm.purchase_date || null,
                    purchase_source: pendingStockForm.purchase_source || null,
                    recon_cost: Number(pendingStockForm.recon_cost) || 0,
                    status: 'in_stock',
                  }, { onConflict: 'listing_id' });
                  setPendingStockSaving(false);
                  if (stockErr) { toast.error('Could not save the stock details: ' + stockErr.message); return; }
                  setPendingStockListing(null);
                }}
                className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                style={T.btnRed}
              >
                {pendingStockSaving ? 'Saving...' : 'Add to Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
