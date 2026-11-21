import React, { useEffect, useState, useRef, useMemo, useCallback, startTransition, Suspense } from "react";
import { useModalHistory } from '../hooks/useModalHistory';
import SuspendedBanner from "../components/SuspendedBanner";
import ReportBugButton from "../components/ReportBugButton";
import { cdnImg, imgFallback } from "../utils/img";
import { buildCaption } from "../utils/sharePack";
import { createPortal } from 'react-dom';
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { logActivity } from "../utils/activityLog";
import { isWonDealBlock, offerUndoSale, relistCar } from "../utils/undoSale";
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
import { isFullAccessRole, tabCapability, TAB_NEEDS_MONEY } from "../lib/permissions";
import { useRoleRedirect } from "../hooks/useRoleRedirect";
import { establishSessionFromHandoff } from "../lib/authHandoff";
import AppLoader from "../components/AppLoader";
import DealerPendingApproval from "../components/DealerPendingApproval";
import { liveChannel } from "../lib/liveChannel";
import { T, iCls, getListingAge } from "./dashboard/shared";
import { DASHBOARD_STYLES as STYLES } from "./dashboard/styles";
import { AgeBadge, TabErrorBoundary, SubTabBar, SelectTick, Avatar } from "./dashboard/widgets";
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
const CarForm          = React.lazy(() => import("../components/CarForm"));
const AddCarForm       = React.lazy(() => import("../components/AddCarForm"));
import VerifyBadgePrompt from "../components/kyc/VerifyBadgePrompt";
const CRMPanel         = React.lazy(() => import("./CRMPanel"));
const HeroSlidesPage   = React.lazy(() => import("./xdrive/HeroSlidesPage"));
const LayoutEditor     = React.lazy(() => import("./dashboard/storefront/LayoutEditor"));
// Storefront > Delivery photos: only once migration 20261121b is applied (DB_PHASE_C).
const DeliveryPhotos   = React.lazy(() => import("./dashboard/storefront/DeliveryPhotos"));
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
import CostProcurementForm from "./dashboard/CostProcurementForm";
import PriceEditModal from "./dashboard/PriceEditModal";
import MarkSoldModal from "./dashboard/MarkSoldModal";
import { sellToBuyer, saleErrorText } from "./dashboard/closeSale";
import TeamTab from "./dashboard/TeamTab";
import ListingDetailDrawer from "./dashboard/ListingDetailDrawer";
import StockTab, { StockStatsStrip } from "./dashboard/StockTab";
import useSubscription from "../hooks/useSubscription";
import { getCategoryCfg } from "../utils/serviceCategories";
import InterestCell from "../components/inventory/InterestCell";
import CustomersTab from "../components/crm/CustomersTab";
import useHandover from "../hooks/useHandover";
import PushToggle from "../components/PushToggle";
import PushPromptStrip from "../components/chat/PushPromptStrip";
import { getPlanConfig, nextDealerPlan } from "../utils/planConfig";
import { color, border, radius, font } from "../theme/tokens";
import { getListingGaps } from "../utils/listingCompleteness";
import { useDealerSnapshot } from '../hooks/useDealerSnapshot';
import AiManagerCard from './dashboard/AiManagerCard';
import { usePersistentState } from '../hooks/usePersistentState';
import { premiumLight, premiumLight as PL } from '../theme/tokens';
import { useCarMoney } from '../hooks/useCarMoney';
import '../theme/premiumLight.css';
import ApprovalQueue from "../components/inventory/ApprovalQueue";
import { plWord } from "../theme/plStatus";
import { InventorySwitch, StatusPills, AddCarSheet, AddCarButton, INV_CARD, INV_INPUT, INV_GHOST_BTN, INV_MICRO } from "../components/inventory/InventoryUi";
import { WindowStickerSheet } from '../components/inventory/WindowSticker';
import { BulkBar, BulkPriceSheet } from '../components/inventory/BulkBar';
import { askSocialConsent } from '../components/social/askSocialConsent';
import { AutoPostButton, AutoPostSheet, useAutoPost } from "../components/autopost/AutoPost";
import { loginUrl } from "../config/site";
import {
  Car,
  LogOut,
  Trash2,
  X,
  TrendingUp,
  DollarSign,
  Menu,
  Building2,
  Users,
  Check,
  UserPlus,
  Tag,
  Flame,
  BarChart2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
  Search,
  Settings,
  Globe,
  Megaphone,
  Shield,
  ExternalLink,
  ChevronDown,
  Gauge,
  Bell,
  Package,
  CheckSquare,
  SlidersHorizontal,
  Download,
  ClipboardCheck,
} from "lucide-react";
import ProfileLoadError from "../components/ProfileLoadError";
import TeamBrokersSwitch from "../components/brokers/DealerBrokers";
import { DELIVERIES_OPEN } from "../utils/storefrontLayout";

// Cache namespace for the dealer dashboard (keys look like `dash_listings_<uid>`).
// Deliberately keyed on the AUTH uid, not the dealer id: a manager and their
// dealer resolve to the same dealer_id and would otherwise share one cache entry
// on a shared device. A few KB duplicated is the right trade for that.
const PANEL_CACHE_KEY = "dash";
// Listings shows this many cars, then a See more button adds this many again.
const LIST_PAGE = 30;

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
  const [storefrontSub, setStorefrontSub] = useState("layout"); // layout | hero | services
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
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE);
  const [copiedListingId, setCopiedListingId] = useState(null);
  const [userId, setUserId] = useState(seed.uid);
  const [salesmen,         setSalesmen]         = useState(() => seed.uid ? (readCache(`dash_salesmen_${seed.uid}`) || []) : []);
  const [assignDropdownId, setAssignDropdownId] = useState(null);
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
      layout:      { tab: "storefront", sub: ["storefront", "layout"] },
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
    const gone1 = listings.find((l) => l.id === id);
    setListings((p) => p.filter((l) => l.id !== id));
    if (detailListing?.id === id) setDetailListing(null);
    setDeleteId(null);
    toast.success(gone1 ? `Deleted ${[gone1.year, gone1.brand, gone1.model].filter(Boolean).join(" ")}` : "Listing deleted");
  };
  const handleAssign = async (listingId, salesmanId, name) => {
    setAssignDropdownId(null);
    // Check the car really changed before evicting other salesmen or logging it: a refused
    // write comes back as "0 rows, no error", and the screen used to say "Assigned" anyway.
    const { data: saved, error: assignErr } = await supabase.from("car_listings")
      .update({ assigned_to: salesmanId }).eq("id", listingId).select("id");
    if (assignErr || !saved?.length) {
      toast.error("Could not assign. Try again.");
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
    toast.success(`Assigned to ${name}`);
  };
  const handleUnassign = async (listingId) => {
    setAssignDropdownId(null);
    const { data: saved, error: unassignErr } = await supabase.from("car_listings")
      .update({ assigned_to: null }).eq("id", listingId).select("id");
    if (unassignErr || !saved?.length) {
      toast.error("Could not unassign. Try again.");
      return;
    }
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, assigned_to: null } : l))
    );
    const listing = listings.find(l => l.id === listingId);
    logActivity({ dealerId: userId, actor: profile, tableName: 'car_listings', recordId: listingId, action: 'unassigned', summary: `Unassigned — ${listing?.brand || ''} ${listing?.model || ''} ${listing?.year || ''}`.trim() });
    toast.success("Unassigned");
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
    // 10 cars at a time: one by one, publishing 175 cars took minutes.
    for (let i = 0; i < targets.length; i += 10) {
      const chunk = targets.slice(i, i + 10);
      const results = await Promise.all(chunk.map(l => supabase.from('car_listings').update({ status })
        .eq('id', l.id).in('status', ['available', 'reserved', 'unpublished']).select()));
      results.forEach(({ data, error }, j) => {
        const l = chunk[j];
        if (error || !data?.length) {
          failed++;
          if (error?.message?.includes('listing_cap_exceeded')) capHit = true;
          return;
        }
        ok++;
        updated[l.id] = data[0];
        logActivity({ dealerId: userId, actor: profile, tableName: 'car_listings', recordId: l.id, action: 'status_changed', summary: `Status ${l.status || 'available'} → ${status} (bulk) — ${l.brand || ''} ${l.model || ''} ${l.year || ''}`.trim(), fieldChanges: { status: { from: l.status || 'available', to: status } } });
      });
    }
    setListings(p => p.map(l => updated[l.id] ? { ...l, ...updated[l.id] } : l));
    setBulkBusy(false);
    exitSelect();
    // Publishing many cars: ask ONCE whether Drevo may feature them (SOCIAL-1), instead of once per car.
    // Own cars only, never one already answered, never a new-car card.
    if (status === 'available' && !profile?.dealer_id) {
      const askIds = Object.values(updated).filter(r => r.social_consent == null && !r.new_car_model_id).map(r => r.id);
      if (askIds.length) askSocialConsent({ ids: askIds, title: `${askIds.length} car${askIds.length === 1 ? '' : 's'}` });
    }
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
    toast.success(`Price updated to RM ${Number(u.selling_price || 0).toLocaleString("en-MY")}`);
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

  const handleMarkSold = async ({ soldBy = null, soldPrice = null, commission = null, leadId = null, newBuyer = null } = {}) => {
    if (!markSoldListing) return;
    setMarkSoldLoading(true);
    try {
      if (leadId || newBuyer) {
        // A real win (closeSale.js): the won trigger flips the car, makes the customer and
        // seeds the handover. A discount over the limit from a role that cannot approve
        // waits for the dealer instead.
        const res = await sellToBuyer({
          dealerId: getDealerIdFromProfile(profile), listingId: markSoldListing.id,
          leadId, newBuyer, soldBy, soldPrice,
        });
        if (res.status === "pending") {
          toast.success("Sent to the dealer to approve the price. The car is marked sold once they say yes.");
          setMarkSoldListing(null);
          setMarkSoldLoading(false);
          return;
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
      toast.success(leadId || newBuyer
        ? "Marked sold. The buyer is in Sold > Customers and the handover steps are ready."
        : "Marked sold.");
      // The merged listings state above feeds StockTab's P&L; TeamTab refetches
      // per-salesman gross on mount, so no out-of-scope refetch is needed here.
    } catch (e) {
      console.error(e);
      toast.error(saleErrorText(e));
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
      // Same once-only social ask as bulk publish (SOCIAL-1): a standing yes files it for Console > Social silently.
      if (!profile?.dealer_id && updated.social_consent == null && !updated.new_car_model_id) {
        askSocialConsent({ id: updated.id, title: `${l.year || ''} ${l.brand || ''} ${l.model || ''}`.trim() });
      }
      // Stay on Unpublished while there are more to go, so the next one is one tap away.
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
  useEffect(() => { setVisibleCount(LIST_PAGE); }, [statusFilter, searchQuery, filterMinPrice, filterMaxPrice, filterMinMileage, filterMaxMileage, filterCondition, filterTransmission, filterState]);

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
    storefront: { title: "Storefront", sub: "Design your site, its banner slides and your add-on products" },
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
    // A Supabase query is only sent once it is awaited or .then()-ed; without this it never left the browser.
    supabase.from('profiles').update({ onboarding_complete: true }).eq('id', userId)
      .then(({ error }) => { if (error) console.warn('onboarding_complete not saved', error.message); });
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
        <a href="https://wa.me/601111521742?text=Hi%2C%20I%20want%20to%20activate%20my%20DrevoOS%20subscription" target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#dc2626', padding: '4px 12px', borderRadius: 6, textDecoration: 'none' }}>
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
            }} aria-label="Notifications" style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: notifCount > 0 ? '#DC2626' : color.textMuted, padding: 4, minWidth: 40, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell className="w-4 h-4" />
              {notifCount > 0 && <span style={{ position: 'absolute', top: 4, right: 4, background: '#DC2626', color: '#fff', fontSize: 8, fontWeight: 800, borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{notifCount > 9 ? '9+' : notifCount}</span>}
            </button>
          </div>
          <ReportBugButton variant="inline" tapSize={40} context="Dealer Dashboard" userLabel={profile?.full_name || profile?.email || ""} />
          <button
            onClick={() => startTransition(() => setSidebarOpen(false))}
            aria-label="Close menu"
            className="lg:hidden p-1.5 rounded-lg transition-colors flex-shrink-0 flex items-center justify-center"
            style={{ color: color.textMuted, minWidth: 40, minHeight: 40 }}
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
            aria-label="Open menu"
            className="p-1.5 rounded-lg transition-all flex-shrink-0 flex items-center justify-center"
            style={{ color: color.textMuted, minWidth: 40, minHeight: 40 }}
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
          <ReportBugButton variant="inline" tapSize={40} context="Dealer Dashboard" userLabel={profile?.full_name || profile?.email || ""} />
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setNotifOpen(p => !p)}
              style={{
                position: 'relative', background: 'transparent',
                border: 'none', borderRadius: 8, padding: 6,
                minWidth: 40, minHeight: 40,
                cursor: 'pointer', color: notifCount > 0 ? '#DC2626' : color.textMuted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: 3, right: 3,
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
                    onPublish={statusFilter === 'unpublished' ? () => bulkStatus('available') : null}
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
                    {/* See more (owner, 2026-11-21): 30 at a time. The infinite-scroll watcher
                        it replaces stopped after the first page (its effect ran once, before the
                        list existed, so it watched nothing). */}
                    {visibleCount < filteredListings.length && (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 16px 20px' }}>
                        <button
                          onClick={() => setVisibleCount(c => c + LIST_PAGE)}
                          style={{ ...INV_GHOST_BTN, padding: '10px 18px', fontSize: 13 }}
                        >
                          See more ({Math.min(LIST_PAGE, filteredListings.length - visibleCount)} of {filteredListings.length - visibleCount} left)
                        </button>
                      </div>
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
                  { id: "layout",   label: "Design" },
                  { id: "hero",     label: "Banner slides" },
                  ...(DELIVERIES_OPEN ? [{ id: "deliveries", label: "Delivery photos" }] : []),
                  { id: "services", label: "Services & Add-ons" },
                ]}
              />
              {storefrontSub === "layout" && (
                <LayoutEditor dealerId={getDealerIdFromProfile(profile)} canEdit={getDealerIdFromProfile(profile) === profile?.id} />
              )}
              {DELIVERIES_OPEN && storefrontSub === "deliveries" && (
                <DeliveryPhotos dealerId={getDealerIdFromProfile(profile)} />
              )}
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

      {/* DrevoOS Studio — full-screen editor, mounted at page level so the
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
