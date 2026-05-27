import React, { lazy, Suspense, useEffect, useState, useRef, useMemo } from "react";
import SuspendedBanner from "../components/SuspendedBanner";
import { createPortal } from 'react-dom';
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import { getDealerIdFromProfile } from "../hooks/useProfile";
import { useRoleRedirect } from "../hooks/useRoleRedirect";
import { useWebPush } from "../hooks/useWebPush";
import SciFiLoader from "../components/SciFiLoader";
import { getCategoryCfg } from "../utils/serviceCategories";
import useSubscription from "../hooks/useSubscription";
import { useDealerSnapshot } from '../hooks/useDealerSnapshot';

// Lazy-loaded tab components (code split — only load when tab is visited)
const CRMPanel          = lazy(() => import('./CRMPanel'));
const RevOpsPage        = lazy(() => import('./RevOpsPage'));
const ServicesPage      = lazy(() => import('./ServicesPage'));
const CarForm           = lazy(() => import('../components/CarForm'));
const CarFormFast       = lazy(() => import('../components/CarFormFast'));
const HeroSlidesPage    = lazy(() => import('./xdrive/HeroSlidesPage'));
const AISalesManager    = lazy(() => import('../components/AISalesManager'));
const TikTokStudioV3    = lazy(() => import('../components/TikTokStudioV3'));
const AnalyticsTab      = lazy(() => import('./dashboard/AnalyticsTab'));
const MarketplaceTab    = lazy(() => import('./dashboard/MarketplaceTab'));
const TeamTab           = lazy(() => import('./dashboard/TeamTab'));
const SettingsTab       = lazy(() => import('./dashboard/SettingsTab'));
const StockTab          = lazy(() => import('./dashboard/StockTab'));
const DocumentsTab      = lazy(() => import('./dashboard/DocumentsTab'));
const OutreachHub       = lazy(() => import('./dashboard/OutreachHub'));
const ListingDetailDrawer = lazy(() => import('./dashboard/ListingDetailDrawer'));
const PriceEditModal    = lazy(() => import('./dashboard/PriceEditModal'));
const MarkSoldModal     = lazy(() => import('./dashboard/MarkSoldModal'));
import {
  Car,
  PlusCircle,
  LogOut,
  Home,
  Trash2,
  X,
  TrendingUp,
  DollarSign,
  Eye,
  Menu,
  Building2,
  Clock,
  Users,
  Copy,
  Check,
  Link,
  UserPlus,
  ToggleLeft,
  ToggleRight,
  Video,
  Tag,
  Flame,
  BarChart2,
  BarChart3,
  Send,
  Bot,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
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
  Instagram,
  Facebook,
  Shield,
  KeyRound,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Palette,
  Inbox,
  Gauge,
  Droplets,
  MapPin,
  ChevronLeft,
  ZoomIn,
  Calculator,
  Bell,
  Package,
  Calendar,
  FileText,
  Banknote,
  Printer,
  CheckSquare,
  Wrench,
  Upload,
  Snowflake,
} from "lucide-react";

const SERVER_URL = "https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1";
const MAX_DEALERSHIP_CHANGES = 2;

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  .grad-red    { background: linear-gradient(135deg,#93c5fd,#fb923c); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-blue   { background: linear-gradient(135deg,#60a5fa,#3b82f6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-cyan   { background: linear-gradient(135deg,#67e8f9,#38bdf8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-green  { background: linear-gradient(135deg,#6ee7b7,#34d399); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-purple { background: linear-gradient(135deg,#d8b4fe,#a78bfa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-gold   { background: linear-gradient(135deg,#fde68a,#fbbf24); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .grad-white  { background: linear-gradient(135deg,#f8fafc,#94a3b8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }

  .card-top::before { content:''; position:absolute; top:0; left:16px; right:16px; height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.06) 35%,rgba(255,255,255,0.03) 65%,transparent); pointer-events:none; z-index:1; }
  .modal-top::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent 8%,rgba(255,255,255,0.07) 38%,rgba(255,255,255,0.04) 68%,transparent 92%); border-radius:16px 16px 0 0; pointer-events:none; z-index:2; }

  .nav-item { border-left:2px solid transparent; transition:all 0.15s; }
  .nav-item:hover:not(.nav-active) { background:rgba(255,255,255,0.04)!important; border-left-color:rgba(255,255,255,0.1); }
  .nav-active { background:rgba(220,38,38,0.08)!important; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border-left:2px solid #dc2626!important; box-shadow:inset 0 1px 0 rgba(220,38,38,0.08),inset 0 -1px 0 rgba(0,0,0,0.1); }

  .stat-card { transition:transform 0.18s,box-shadow 0.18s; }
  .stat-card:hover { transform:translateY(-2px); box-shadow:0 14px 32px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.08); }

  .data-row { border-left:2px solid transparent; transition:background 0.12s,border-left-color 0.12s; }
  .data-row:hover { background:rgba(255,255,255,0.025)!important; border-left-color:rgba(255,255,255,0.12); }


  @keyframes hotpulse { 0%,100%{opacity:1}50%{opacity:.55} }
  .blue-glow { animation:hotpulse 2.2s ease-in-out infinite; }
  .blue-glow { animation:hotpulse 2.2s ease-in-out infinite; }

  .discount-chip { transition:box-shadow 0.15s; }
  .discount-chip:hover { box-shadow:0 0 10px rgba(255,255,255,0.08); }

  .btn-shimmer { position:relative; overflow:hidden; }
  .btn-shimmer::after { content:''; position:absolute; top:0; left:-80%; width:50%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent); animation:shimmer 3s ease infinite; }
  @keyframes shimmer { to { left:150%; } }

  .sold-btn:hover { background:rgba(34,197,94,0.15) !important; border-color:rgba(34,197,94,0.45) !important; color:#4ade80 !important; }

  .settings-section { position:relative; background:rgba(255,255,255,0.022); border:1px solid rgba(255,255,255,0.08); border-radius:16px; overflow:hidden; }
  .settings-section::before { content:''; position:absolute; top:0; left:16px; right:16px; height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.06) 35%,rgba(255,255,255,0.03) 65%,transparent); pointer-events:none; }

  .table-wrap { position:relative; overflow-x:auto; -webkit-overflow-scrolling:touch; }
  .table-wrap::after { content:''; position:absolute; top:0; right:0; bottom:0; width:28px; background:linear-gradient(to left,rgba(8,10,18,0.85),transparent); pointer-events:none; border-radius:0 8px 8px 0; }

  .glass { background:rgba(255,255,255,0.045); backdrop-filter:blur(24px) saturate(180%); -webkit-backdrop-filter:blur(24px) saturate(180%); border:1px solid rgba(255,255,255,0.1); box-shadow:0 8px 32px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.12),inset 0 -1px 0 rgba(0,0,0,0.2); }
  .glass-blue { background:rgba(59,130,246,0.08); backdrop-filter:blur(24px) saturate(180%); -webkit-backdrop-filter:blur(24px) saturate(180%); border:1px solid rgba(59,130,246,0.18); box-shadow:0 8px 32px rgba(0,0,0,0.35),inset 0 1px 0 rgba(59,130,246,0.2),inset 0 -1px 0 rgba(0,0,0,0.15); }
  .glass-pill { background:rgba(255,255,255,0.08); backdrop-filter:blur(16px) saturate(160%); -webkit-backdrop-filter:blur(16px) saturate(160%); border:1px solid rgba(255,255,255,0.12); box-shadow:inset 0 1px 0 rgba(255,255,255,0.1),0 4px 16px rgba(0,0,0,0.3); }
  .glass-modal, .modal-top { background:rgba(8,12,22,0.75); backdrop-filter:blur(40px) saturate(200%); -webkit-backdrop-filter:blur(40px) saturate(200%); border:1px solid rgba(255,255,255,0.09); box-shadow:0 40px 80px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.08); }

  ::-webkit-scrollbar { width:4px; height:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:4px; }
  ::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.2); }

  @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
`;

const T = {
  card: {
    position: 'relative',
    background: 'linear-gradient(145deg, rgba(255,255,255,0.032), rgba(255,255,255,0.008))',
    border: '1px solid rgba(255,255,255,0.055)',
    backdropFilter: 'blur(12px)',
  },
  cardDark: {
    position: 'relative',
    background: 'rgba(8,10,18,0.95)',
    border: '1px solid rgba(255,255,255,0.055)',
  },
  modal: {
    position: 'relative',
    background: 'rgba(5,7,14,0.99)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 40px 80px rgba(0,0,0,0.8)',
  },
  divider: { borderBottom: '1px solid rgba(255,255,255,0.048)' },
  btnRed: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(29,78,216,0.95))',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 12px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
};

const iCls =
  "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/10 transition-all";
const taCls =
  "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/10 transition-all resize-none";

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

function getListingAge(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt)) / 86400000);
}

const AgeBadge = React.memo(function AgeBadge({ createdAt }) {
  const d = getListingAge(createdAt);
  if (d < 15)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
        <Clock className="w-3 h-3" />
        {d === 0 ? "Today" : `${d}d`}
      </span>
    );
  if (d < 25)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">
        <Clock className="w-3 h-3" />
        {d}d
      </span>
    );
  if (d < 30)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-400/10 text-orange-400 border border-orange-400/20">
        <Clock className="w-3 h-3" />
        {d}d
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-400/10 text-blue-400 border border-blue-400/20">
      <Clock className="w-3 h-3" />
      {d}d
    </span>
  );
});

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data = [], color = '#3b82f6', width = 80, height = 28 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const gradId = `sg-${color.replace('#', '')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${gradId})`} />
    </svg>
  );
}

function bucketByDay(events, eventTypes, days = 14) {
  const result = Array(days).fill(0);
  const now = Date.now();
  events.forEach(e => {
    if (!eventTypes.includes(e.event_type)) return;
    const daysAgo = Math.floor((now - new Date(e.created_at)) / 86400000);
    if (daysAgo < days) result[days - 1 - daysAgo]++;
  });
  return result;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const redirectByRole = useRoleRedirect("dealer");
  const { status, loading: subLoading } = useSubscription();

  const { tab: urlTab } = useParams();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(urlTab || "listings");
  useEffect(() => {
    if (urlTab && urlTab !== activeTab) setActiveTab(urlTab);
  }, [urlTab]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showFastModal, setShowFastModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tiktokListing, setTiktokListing] = useState(null);
  const [priceEditListing, setPriceEditListing] = useState(null);
  const [markSoldListing, setMarkSoldListing] = useState(null);
  const [markSoldLoading, setMarkSoldLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [editListing, setEditListing] = useState(null);
  const [adjustedStaleIds, setAdjustedStaleIds] = useState(new Set());
  const handleStaleAdjusted = (id) => setAdjustedStaleIds(prev => new Set([...prev, id]));
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("available");
  const [listingsVisible, setListingsVisible] = useState(20);
  const [copiedListingId, setCopiedListingId] = useState(null);
  const [userId, setUserId] = useState(null);
  useWebPush(userId);
  const [salesmen,         setSalesmen]         = useState([]);
  const [assignDropdownId, setAssignDropdownId] = useState(null);
  const [assignToast,      setAssignToast]      = useState(null);
  const [detailListing,    setDetailListing]    = useState(null);
  const [svcPopupListing,  setSvcPopupListing]  = useState(null);
  const sidebarBellRef = useRef(null);
  const [sidebarBellRect, setSidebarBellRect] = useState(null);
  const closeNotif = () => { setNotifOpen(false); setSidebarBellRect(null); };
  const [notifications,    setNotifications]    = useState([]);
  const [notifOpen,        setNotifOpen]        = useState(false);
  const [pendingStockListing, setPendingStockListing] = useState(null);
  const [pendingStockForm, setPendingStockForm] = useState({ purchase_price: '', purchase_date: '', purchase_source: '', recon_cost: '' });
  const [pendingStockSaving, setPendingStockSaving] = useState(false);
  const [prefillDocData,   setPrefillDocData]   = useState(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [onboardingCopied, setOnboardingCopied] = useState(false);
  const [onboardingToast,  setOnboardingToast]  = useState(false);
  const loadedUidRef = useRef(null);

  const getStorefrontUrl = () => {
    if (!profile?.subdomain || profile?.role === 'superadmin') {
      return 'https://xdrive.my';
    }
    return `https://${profile.subdomain}.xdrive.my`;
  };

  useEffect(() => {
    const name = profile?.site_name || profile?.dealership || "XDrive";
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
      setProfile(null);
      setListings([]);
      setSalesmen([]);
      setLoading(true);
      setUserId(uid);

      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)   // always scoped to the live session user
        .maybeSingle();
      if (!active) return;

      if (p) {
        if (redirectByRole(p.role)) return;
        if (!["dealer", "superadmin", "admin", "manager", "owner"].includes(p.role)) {
          navigate("/login");
          return;
        }
        setProfile(p);
        // Correct dealer ID for manager/admin roles (their uid ≠ dealer_id)
        const dealerId = getDealerIdFromProfile(p);
        setUserId(dealerId);
      } else {
        navigate("/login");
        return;
      }

      const dealerId = getDealerIdFromProfile(p);
      const { data: cars, error: carsError } = await supabase
        .from("car_listings")
        .select("*")
        .eq("dealer_id", dealerId)
        .order("created_at", { ascending: false });
      if (active) setListings(carsError ? [] : cars || []);

      const { data: sm } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("role", "salesman")
        .eq("dealer_id", dealerId);
      if (active) {
        setSalesmen(sm || []);
        setLoading(false);
      }
    };

    // Establish session first (cross-domain handoff or existing session) BEFORE
    // subscribing to auth events. A stale localStorage session on the subdomain
    // can trigger SIGNED_OUT during its failed auto-refresh — if we're already
    // subscribed when that fires, we'd redirect to xdrive.my/login before our
    // new tokens even get a chance to run.
    const _params = new URLSearchParams(window.location.search);
    const _at = _params.get('_at');
    const _rt = _params.get('_rt');
    let unsubscribe = () => {};

    (async () => {
      let session;
      if (_at && _rt) {
        window.history.replaceState({}, '', window.location.pathname);
        const { data } = await supabase.auth.setSession({ access_token: _at, refresh_token: _rt });
        if (!active) return;
        session = data?.session ?? null;
      } else {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        session = data?.session ?? null;
      }

      if (!active) return;
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
          window.location.href = 'https://xdrive.my/login';
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
    const ch = supabase
      .channel("dash_listings")
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
        .then(({ data }) => setNotifications(data || []));
    reload();
    const ch = supabase.channel(`notifs_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dealer_notifications', filter: `dealer_id=eq.${userId}` }, reload)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear(); // prevent stale branding from a previous session bleeding through
    window.location.href = 'https://xdrive.my/login';
  };
  const handleNew = (l) => {
    setListings((p) => [l, ...p]);
    navigate("/dashboard/listings");
    // Prompt to add stock purchase details
    setPendingStockListing(l);
    setPendingStockForm({ purchase_price: '', purchase_date: new Date().toISOString().slice(0,10), purchase_source: 'Direct Buy', recon_cost: '' });
  };
  const handleTabChange = (tab) => {
    navigate(`/dashboard/${tab}`);
    setSidebarOpen(false);
  };
  const handleDelete = async (id) => {
    const { error } = await supabase
      .from("car_listings")
      .delete()
      .eq("id", id)
      .eq("dealer_id", userId);  // explicit RLS guard
    if (error) {
      console.error("Delete failed:", error.message);
      toast.error("Could not delete listing: " + error.message);
      return;
    }
    setListings((p) => p.filter((l) => l.id !== id));
    if (detailListing?.id === id) setDetailListing(null);
    setDeleteId(null);
  };
  const handleAssign = async (listingId, salesmanId, name) => {
    setAssignDropdownId(null);
    await supabase.from("car_listings").update({ assigned_to: salesmanId }).eq("id", listingId);
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, assigned_to: salesmanId } : l))
    );
    setAssignToast({ listingId, msg: `Assigned to ${name}` });
    setTimeout(() => setAssignToast(null), 2000);
  };
  const handleUnassign = async (listingId) => {
    setAssignDropdownId(null);
    await supabase.from("car_listings").update({ assigned_to: null }).eq("id", listingId);
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, assigned_to: null } : l))
    );
    setAssignToast({ listingId, msg: "Unassigned" });
    setTimeout(() => setAssignToast(null), 2000);
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
      setListings((p) =>
        p.map((l) => (l.id === id ? (data?.[0] ?? { ...l, status }) : l)),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingStatus(null);
    }
  };
  const handlePriceSave = (u) =>
    setListings((p) => p.map((l) => (l.id === u.id ? u : l)));
  const handleUpdate = (u) => {
    setListings((p) => p.map((l) => (l.id === u.id ? u : l)));
    // Mark as adjusted only after a real save — not when the form is merely opened
    if (editListing && getListingAge(editListing.created_at) >= 30) {
      handleStaleAdjusted(u.id);
    }
    setEditListing(null);
  };
  const handleProfileUpdate = (updated) => setProfile(updated);

  const handleMarkSold = async () => {
    if (!markSoldListing) return;
    setMarkSoldLoading(true);
    try {
      const { data, error } = await supabase
        .from("car_listings")
        .update({ status: "sold", sold_at: new Date().toISOString() })
        .eq("id", markSoldListing.id)
        .select();
      if (error) throw error;
      const updated = data?.[0] ?? { ...markSoldListing, status: "sold" };
      setListings((p) => p.map((l) => (l.id === updated.id ? updated : l)));
      setMarkSoldListing(null);
    } catch (e) {
      console.error(e);
    }
    setMarkSoldLoading(false);
  };

  const filteredListings = useMemo(() => {
    let result = listings.filter((l) =>
      (l.status || 'available') === statusFilter
    );
    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase();
    return result.filter((l) =>
      (l.brand || "").toLowerCase().includes(q) ||
      (l.model || "").toLowerCase().includes(q) ||
      (l.variant || "").toLowerCase().includes(q) ||
      (l.vin || "").toLowerCase().includes(q) ||
      (l.vin_number || "").toLowerCase().includes(q)
    );
  }, [listings, searchQuery, statusFilter]);

  useEffect(() => { setListingsVisible(20); }, [statusFilter, searchQuery]);

  const pagedListings = filteredListings.slice(0, listingsVisible);

  const salesmenById = Object.fromEntries(salesmen.map((s) => [s.id, s]));

  const copyListing = (l) => {
    const lines = [
      `🚗 ${l.year} ${l.brand} ${l.model}${l.variant ? " " + l.variant : ""}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `📋 DETAILS`,
      l.mileage ? `• Mileage: ${Number(l.mileage).toLocaleString()} km` : null,
      l.engine_cc
        ? `• Engine: ${Number(l.engine_cc).toLocaleString()} cc`
        : null,
      l.transmission ? `• Transmission: ${l.transmission}` : null,
      l.colour ? `• Colour: ${l.colour}` : null,
      l.condition
        ? `• Condition: ${l.condition.charAt(0).toUpperCase() + l.condition.slice(1)}`
        : null,
      l.city || l.state
        ? `• Location: ${[l.city, l.state].filter(Boolean).join(", ")}`
        : null,
      l.vin_number ? `• VIN: ${l.vin_number}` : null,
      ``,
      `💰 PRICE: RM ${(l.selling_price || 0).toLocaleString()}`,
      l.original_price && l.original_price > l.selling_price
        ? `(Was: RM ${l.original_price.toLocaleString()} | Save RM ${(l.original_price - l.selling_price).toLocaleString()})`
        : null,
    ];
    if (l.features) lines.push(``, `✨ FEATURES`, l.features);
    if (l.specs) lines.push(``, `🔧 SPECS`, l.specs);
    if (l.options) lines.push(``, `📝 ABOUT`, l.options);
    const tags = [
      l.brand,
      l.model,
      l.condition,
      l.state,
      "UsedCars",
      "Malaysia",
      "CarForSale",
    ]
      .filter(Boolean)
      .map((t) => `#${t.replace(/\s+/g, "")}`)
      .join(" ");
    lines.push(``, tags);
    navigator.clipboard
      .writeText(lines.filter((x) => x !== null).join("\n"))
      .then(() => {
        setCopiedListingId(l.id);
        setTimeout(() => setCopiedListingId(null), 2000);
      });
  };

  const soldCount = listings.filter((l) => l.status === "sold").length;
  const totalVal = listings.filter(l => l.status !== 'sold').reduce((s, l) => s + (l.selling_price || 0), 0);
  const hotCount = listings.filter(
    (l) =>
      l.original_price &&
      l.selling_price &&
      l.selling_price < l.original_price,
  ).length;
  const soldSpark = bucketByDay(
    listings.filter(l => l.status === 'sold' && l.sold_at).map(l => ({ event_type: 'sold', created_at: l.sold_at })),
    ['sold']
  );

  const STATUS = {
    available: {
      label: "Available",
      dot: "bg-emerald-400",
      cls: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
      next: "reserved",
    },
    reserved: {
      label: "Reserved",
      dot: "bg-amber-400",
      cls: "bg-amber-400/10 text-amber-400 border-amber-400/20",
      next: "sold",
    },
    sold: {
      label: "Sold",
      dot: "bg-red-400",
      cls: "bg-blue-400/10 text-blue-400 border-blue-400/20",
      next: "available",
    },
  };

  const StatusBadge = React.memo(({ listing }) => {
    const s = listing.status || "available",
      cfg = STATUS[s] || STATUS.available,
      busy = updatingStatus === listing.id;
    return (
      <button
        onClick={() => handleStatus(listing.id, cfg.next)}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-all ${cfg.cls} ${busy ? "opacity-50 cursor-wait" : "hover:opacity-75 cursor-pointer"}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${busy ? "animate-pulse bg-gray-400" : cfg.dot}`}
        />
        {busy ? "…" : cfg.label}
      </button>
    );
  });

  const Avatar = ({ size = "md" }) => {
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
          background: "linear-gradient(135deg, rgba(59,130,246,0.8), rgba(99,102,241,0.8))",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.15)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
        }}
      >
        {(profile?.full_name || profile?.email || "A")[0].toUpperCase()}
      </div>
    );
  };

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
            className={`discount-chip inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold border ${isHot ? "bg-blue-500/15 text-blue-400 border-blue-500/25 blue-glow" : "bg-amber-500/15 text-amber-400 border-amber-500/25"}`}
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

  const { snapshot, loading: snapshotLoading } = useDealerSnapshot(userId);

  const TITLES = {
    listings: { title: "Listings", sub: "Manage your inventory" },
    add: { title: "Add Listing", sub: "Upload a new car" },
    team: { title: "Team", sub: "Manage salespeople" },
    analytics: { title: "Analytics", sub: "Performance & AI advisor" },
    marketplace: { title: "Marketplace", sub: "XDrive traffic & visitor analytics" },
    settings: { title: "Settings", sub: "Dealership, front page & account" },
    crm: { title: "CRM", sub: "Pipeline, enquiries, bookings & leads" },
    hero: {
      title: "Hero Carousel",
      sub: "Manage your XDrive homepage spotlight — up to 5 slides",
    },
    stock: { title: "Stock", sub: "Vehicle stock units & cost tracking" },
    documents: { title: "Documents", sub: "Sales agreements & receipts" },
    revops:    { title: "RevOps",    sub: "Revenue operations & deal health" },
    services:  { title: "Services",  sub: "Add-ons & product catalogue" },
    ai_manager: { title: "AI Sales Manager", sub: "Your always-on senior sales advisor" },
    outreach:   { title: "Outreach Hub",     sub: "Lead campaigns & WhatsApp automation" },
  };

  const NAV = [
    { id: "listings", Icon: Car, label: "Listings", badge: listings.length },
    { id: "add", Icon: PlusCircle, label: "Add Listing" },
    { id: "crm", Icon: MessageCircle, label: "CRM" },
    { id: "analytics", Icon: BarChart2, label: "Analytics" },
    { id: "marketplace", Icon: Globe, label: "Marketplace" },
    { id: "outreach",   Icon: Megaphone, label: "Outreach Hub",     badge: null },
    { id: "ai_manager", Icon: Bot, label: "AI Sales Manager" },
    { id: "team", Icon: Users, label: "Team" },
    { id: "hero", Icon: HeroCarouselIcon, label: "Hero Carousel" },
    { id: "stock", Icon: Package, label: "Stock" },
    { id: "documents", Icon: FileText, label: "Documents" },
    { id: "revops",   Icon: BarChart3, label: "RevOps" },
    { id: "services", Icon: Wrench,   label: "Services & Add-ons" },
  ];

  const STAT_CARDS = [
    {
      label: "Total Listings",
      val: listings.length,
      sub: "Active inventory",
      grad: "grad-cyan",
      Icon: Car,
      glow: "rgba(103,232,249,0.13)",
    },
    {
      label: "Sold",
      val: soldCount,
      sub: "Cars sold all time",
      grad: "grad-green",
      Icon: CheckCircle2,
      glow: "rgba(110,231,183,0.13)",
      spark: soldSpark,
      sparkColor: '#34d399',
    },
    {
      label: "Total Value",
      val: `RM ${totalVal.toLocaleString()}`,
      sub: "Combined price",
      grad: "grad-purple",
      Icon: DollarSign,
      glow: "rgba(216,180,254,0.13)",
    },
    {
      label: "Hot Deals",
      val: hotCount,
      sub: hotCount > 0 ? "On homepage" : "No discounts",
      grad: hotCount > 0 ? "grad-red" : "",
      Icon: Flame,
      glow: hotCount > 0 ? "rgba(248,113,113,0.18)" : "rgba(255,255,255,0.03)",
    },
  ];

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
    setTimeout(() => setOnboardingToast(false), 5000);
  }, [allOnboardingDone]);

  const copyStorefrontOnboarding = () => {
    const url = profile?.subdomain ? `https://${profile.subdomain}.xdrive.my` : 'https://xdrive.my';
    navigator.clipboard.writeText(url).catch(() => {});
    setOnboardingCopied(true);
  };

  const showOnboardingBanner = profile && profile.onboarding_complete === false && !onboardingDismissed;

  if (!profile) return <SciFiLoader />;

  if (!subLoading && status === 'expired') return (
    <div style={{ background: '#0d0d0d', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", gap: 16 }}>
      <p style={{ color: 'white', fontSize: 22, fontWeight: 600 }}>Your trial has ended</p>
      <p style={{ color: '#6b7280', fontSize: 14 }}>Contact us to activate your ShiftOS subscription.</p>
      <a href="https://wa.me/60174155191" style={{ background: '#3b82f6', color: 'white', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Upgrade Now</a>
    </div>
  );

  return (
    <>
    <SuspendedBanner />
    <Helmet>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
    <style>{STYLES}</style>
    <div
      className="min-h-screen text-white flex"
      style={{
        fontFamily: "'DM Sans',sans-serif",
        background:
          "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px), radial-gradient(ellipse 80% 50% at 0% 0%, rgba(30,58,138,0.08) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(49,46,129,0.06) 0%, transparent 55%), #05070e",
        backgroundSize: "24px 24px, auto, auto",
      }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/65 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed h-dvh overflow-hidden z-30 flex flex-col w-60 transition-transform duration-300 ease-in-out lg:translate-x-0 glass ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex-shrink-0 px-4 py-4 flex items-center gap-3" style={T.divider}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              boxShadow: "0 0 18px rgba(59,130,246,0.42), 0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            S
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black tracking-wider text-sm grad-blue">
              ShiftOS
            </p>
            <p className="text-xs text-gray-600 mt-px">XDrive Admin</p>
          </div>
          {/* Bell in sidebar header */}
          <div ref={sidebarBellRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => {
              const rect = sidebarBellRef.current?.getBoundingClientRect() ?? null;
              setSidebarBellRect(notifOpen ? null : rect);
              setNotifOpen(p => !p);
            }} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: notifCount > 0 ? '#93c5fd' : '#4b5563', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell className="w-4 h-4" />
              {notifCount > 0 && <span style={{ position: 'absolute', top: -2, right: -2, background: '#3b82f6', color: '#fff', fontSize: 8, fontWeight: 800, borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #0a0a0e' }}>{notifCount > 9 ? '9+' : notifCount}</span>}
            </button>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-gray-600 hover:text-white rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-2 sm:p-3 space-y-px mt-1">
          {NAV.map(({ id, Icon, label, badge }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`nav-item w-full flex items-center gap-3 px-3 py-2 sm:py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === id ? "nav-active text-white" : "text-gray-500 hover:text-white"}`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${activeTab === id ? "text-blue-400" : ""}`}
              />
              {label}
              {badge !== undefined && (
                <span
                  className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold tabular-nums ${activeTab === id ? "text-blue-300 bg-blue-950/70" : "text-gray-600 bg-white/[0.05]"}`}
                >
                  {badge}
                </span>
              )}
            </button>
          ))}
          {profile?.role === 'superadmin' && (
            <a
              href="/platform"
              className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-white transition-all"
            >
              <Shield className="w-4 h-4 flex-shrink-0" />
              Admin Panel
            </a>
          )}
          <button
            onClick={() => window.open(getStorefrontUrl(), '_blank')}
            className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-white transition-all"
          >
            <Home className="w-4 h-4 flex-shrink-0" />
            View Site
            <Eye className="w-3 h-3 ml-auto opacity-40" />
          </button>
        </nav>

        {/* ── Sidebar bottom: profile + settings + logout ── */}
        <div
          className="shrink-0 p-3 space-y-1 border-t border-gray-800"
          style={{}}
        >
          {/* Profile row */}
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <Avatar size="lg" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {profile?.full_name || "—"}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {profile?.email || ""}
              </p>
            </div>
          </div>

          {/* Dealership chip */}
          {profile?.dealership && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 mx-1"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <Building2 className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-gray-300 truncate flex-1">
                {profile.dealership}
              </p>
            </div>
          )}

          {/* ✅ Settings button — sits right under username */}
          <button
            onClick={() => handleTabChange("settings")}
            className={`nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === "settings" ? "nav-active text-white" : "text-gray-500 hover:text-white"}`}
          >
            <Settings
              className={`w-4 h-4 flex-shrink-0 ${activeTab === "settings" ? "text-red-500" : ""}`}
            />
            Settings
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-white hover:bg-white/[0.04] transition-all"
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
          className="lg:hidden sticky top-0 z-10 flex items-center gap-2 px-3 py-2.5 backdrop-blur-xl"
          style={{
            background: 'rgba(5,7,14,0.7)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.03)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/[0.05] rounded-lg transition-all flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div
              className="w-5 h-5 rounded flex items-center justify-center font-black text-xs"
              style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 0 8px rgba(220,38,38,0.3)' }}
            >
              S
            </div>
            <span className="font-bold text-white text-xs tracking-tight hidden xs:inline">ShiftOS</span>
          </div>
          <span className="text-gray-500 text-xs truncate flex-1 min-w-0">
            {TITLES[activeTab]?.title}
          </span>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setNotifOpen(p => !p)}
              style={{
                position: 'relative',
                background: 'transparent',
                border: 'none', borderRadius: 8, padding: 6,
                cursor: 'pointer',
                color: notifCount > 0 ? '#f3f4f6' : '#6b7280',
                display: 'flex',
              }}
            >
              <Bell className="w-4 h-4" />
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -3,
                  background: '#dc2626', color: '#fff',
                  fontSize: 8, fontWeight: 800, borderRadius: '50%',
                  width: 14, height: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid #05070e',
                }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <>
                <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 50, width: 320, maxHeight: 420, overflowY: 'auto', background: '#111118', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', fontFamily: "'DM Sans', sans-serif" }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6' }}>Notifications</span>
                    {notifCount > 0 && <button onClick={markAllRead} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Mark all read</button>}
                  </div>
                  {notifications.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#4b5563', padding: '20px 16px', textAlign: 'center' }}>No notifications</p>
                  ) : notifications.slice(0, 10).map(n => (
                    <div key={n.id} onClick={() => { if (n.link_to) { handleTabChange(n.link_to); setNotifOpen(false); } markNotifRead(n); }} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: n.link_to ? 'pointer' : 'default', background: n.is_read ? 'transparent' : 'rgba(255,255,255,0.03)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(255,255,255,0.03)'}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        {!n.is_read && <div style={{ width: 6, height: 6, background: '#dc2626', borderRadius: '50%', flexShrink: 0, marginTop: 5 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', margin: '0 0 2px', lineHeight: 1.3 }}>{n.title || 'Notification'}</p>
                          {n.body && <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px', lineHeight: 1.4 }}>{n.body}</p>}
                          <p style={{ fontSize: 10, color: '#4b5563', margin: 0 }}>{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <Avatar />
        </div>

        {/* ── Onboarding Banner ── */}
        {showOnboardingBanner && (
          <div style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 24px', fontFamily: "'DM Sans',sans-serif", position: 'sticky', top: 0, zIndex: 15 }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckSquare className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', margin: 0, lineHeight: 1.2 }}>Setup Progress</p>
                    <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{onboardingDoneCount} of {onboardingItems.length} complete</p>
                  </div>
                </div>
                <button
                  onClick={() => setOnboardingDismissed(true)}
                  style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(onboardingDoneCount / onboardingItems.length) * 100}%`, background: 'linear-gradient(90deg,#dc2626,#ef4444)', borderRadius: 4, transition: 'width 0.4s ease' }} />
              </div>

              {/* Checklist */}
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
                      background: item.done ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${item.done ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 8,
                      cursor: (!item.done || item.isCopy) ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!item.done || item.isCopy) e.currentTarget.style.borderColor = item.done ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.18)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = item.done ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'; }}
                  >
                    {item.done
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                    }
                    <span style={{ fontSize: 12, color: item.done ? '#6ee7b7' : '#9ca3af', fontWeight: item.done ? 500 : 400, whiteSpace: 'nowrap' }}>
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
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99, background: '#111118', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontFamily: "'DM Sans',sans-serif", animation: 'slideUp 0.3s ease' }}>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', margin: 0 }}>Setup complete!</p>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Your storefront is fully configured.</p>
            </div>
          </div>
        )}

        <div className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <div className="hidden sm:block mb-4 sm:mb-6">
            <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
              {TITLES[activeTab]?.title}
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-0.5">
              {TITLES[activeTab]?.sub}
            </p>
            <div
              className="mt-4 h-px"
              style={{
                background:
                  "linear-gradient(90deg,rgba(59,130,246,0.4),rgba(99,102,241,0.2) 38%,transparent 65%)",
              }}
            />
          </div>

          <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#4b5563", fontSize: 13 }}>Loading…</div>}>
          {/* ── Listings Tab ── */}
          {activeTab === "listings" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
                {STAT_CARDS.map(({ label, val, sub, grad, Icon, glow, spark, sparkColor }) => (
                  <div
                    key={label}
                    className="stat-card card-top rounded-2xl overflow-hidden glass"
                    style={{ position: 'relative' }}
                  >
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          "radial-gradient(circle at 95% 5%, rgba(59,130,246,0.05) 0%, transparent 50%)",
                      }}
                    />
                    {spark && (
                      <div className="relative px-3.5 pt-3">
                        <Sparkline data={spark} color={sparkColor || '#3b82f6'} width={120} height={32} />
                      </div>
                    )}
                    <div className={spark ? 'p-3 sm:p-4 pt-2 relative' : 'p-3 sm:p-4 relative'}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-gray-500 text-xs font-medium tracking-widest uppercase">
                          {label}
                        </p>
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: glow,
                            boxShadow: `0 0 14px ${glow}`,
                          }}
                        >
                          <Icon className="w-4 h-4 opacity-80" />
                        </div>
                      </div>
                      <p
                        className={`text-xl sm:text-3xl font-black leading-none tabular-nums ${grad || "text-white"}`}
                      >
                        {val}
                      </p>
                      <p className="text-xs text-gray-600 mt-1 relative truncate">
                        {sub}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Listings panel ── */}
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(8,12,20,0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', fontFamily: "'DM Sans', sans-serif" }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#f9fafb', fontFamily: "'DM Sans', sans-serif", margin: 0, lineHeight: 1 }}>My Listings</h2>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 6, padding: '2px 8px', lineHeight: 1.5 }}>
                        {filteredListings.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#4b5563', pointerEvents: 'none' }} />
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search…"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '7px 10px 7px 28px', fontSize: 13, color: '#f3f4f6', fontFamily: "'DM Sans', sans-serif", outline: 'none', width: 160 }}
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                            <X style={{ width: 13, height: 13 }} />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setShowFastModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#dc2626', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        ⚡ Fast
                      </button>
                      <button
                        onClick={() => navigate("/dashboard/add")}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.28)', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#f87171', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.18)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,38,38,0.1)'}
                      >
                        <PlusCircle style={{ width: 14, height: 14 }} />
                        Full Form
                      </button>
                    </div>
                  </div>

                  {/* ── Status filter tabs ── */}
                  <div style={{ display: 'flex', gap: 0, padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginTop: 14 }}>
                    {[
                      { key: 'available', label: 'Available', count: listings.filter(l => (l.status || 'available') === 'available').length },
                      { key: 'reserved', label: 'Reserved', count: listings.filter(l => l.status === 'reserved').length },
                      { key: 'sold',     label: 'Sold',     count: listings.filter(l => l.status === 'sold').length },
                    ].map(({ key, label, count }) => (
                      <button
                        key={key}
                        onClick={() => setStatusFilter(key)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '10px 16px', fontSize: 13,
                          fontWeight: statusFilter === key ? 600 : 400,
                          fontFamily: "'DM Sans', sans-serif",
                          color: statusFilter === key ? '#f9fafb' : '#4b5563',
                          borderBottom: statusFilter === key ? '2px solid #dc2626' : '2px solid transparent',
                          marginBottom: -1,
                          display: 'flex', alignItems: 'center', gap: 7,
                          transition: 'color 0.15s',
                        }}
                      >
                        {label}
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 4, lineHeight: 1.6,
                          background: statusFilter === key ? 'rgba(220,38,38,0.12)' : 'rgba(255,255,255,0.04)',
                          color: statusFilter === key ? '#f87171' : '#374151',
                        }}>
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>

                {loading ? (
                  <div style={{ padding: 52, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>Loading…</div>
                ) : filteredListings.length === 0 ? (
                  <div style={{ padding: 52, textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                      <Car style={{ width: 22, height: 22, color: 'rgba(220,38,38,0.45)' }} />
                    </div>
                    <p style={{ color: '#4b5563', fontSize: 13, marginBottom: listings.length === 0 ? 16 : 0 }}>
                      {listings.length === 0 ? 'No listings yet' : `No ${statusFilter} listings`}
                    </p>
                    {listings.length === 0 && (
                      <button onClick={() => navigate("/dashboard/add")} style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.22)', borderRadius: 8, padding: '8px 20px', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Add your first car
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Sans', sans-serif" }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {['', 'Vehicle', 'Price', 'Year / Km', 'Grade', 'Age', 'Status'].map((h, i) => (
                              <th key={i} style={{ padding: '11px 16px', fontSize: 10, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#374151', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pagedListings.map((l) => {
                            const isSold = l.status === 'sold';
                            const extGC = gradeColor(String(l.auction_grade));
                            const sp = l.selling_price || l.price || 0;
                            const op = l.original_price || l.previous_price || null;
                            const pct = op && op > sp ? Math.round(((op - sp) / op) * 100) : 0;
                            const isHot = pct >= 3;
                            return (
                              <tr
                                key={l.id}
                                onClick={() => setDetailListing(l)}
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.12s', opacity: isSold ? 0.5 : 1 }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                {/* Thumbnail */}
                                <td style={{ padding: '12px 8px 12px 16px', width: 84 }}>
                                  {l.images?.[0]
                                    ? <img src={l.images[0]} alt="" style={{ width: 72, height: 48, borderRadius: 8, objectFit: 'cover', display: 'block', filter: isSold ? 'grayscale(0.7) brightness(0.7)' : 'none' }} />
                                    : <div style={{ width: 72, height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car style={{ width: 16, height: 16, color: '#374151' }} /></div>
                                  }
                                </td>
                                {/* Vehicle */}
                                <td style={{ padding: '12px 16px', minWidth: 165 }}>
                                  <p style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0, fontWeight: 600 }}>{l.brand}</p>
                                  <p style={{ fontSize: 14, color: '#f9fafb', fontWeight: 700, lineHeight: 1.25, margin: '3px 0 0' }}>{l.model}</p>
                                  {l.variant && <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0' }}>{l.variant}</p>}
                                  {(l.vin || l.vin_number) && <p style={{ fontSize: 10, color: '#374151', margin: '3px 0 0', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{(l.vin || l.vin_number).trim()}</p>}
                                </td>
                                {/* Price */}
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                  <p style={{ fontSize: 14, color: '#f9fafb', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>RM {sp.toLocaleString()}</p>
                                  {pct > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                      <span style={{ fontSize: 10, color: '#374151', textDecoration: 'line-through' }}>RM {op.toLocaleString()}</span>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: isHot ? '#60a5fa' : '#fbbf24', background: isHot ? 'rgba(96,165,250,0.1)' : 'rgba(251,191,36,0.1)', border: `1px solid ${isHot ? 'rgba(96,165,250,0.2)' : 'rgba(251,191,36,0.2)'}`, borderRadius: 4, padding: '0 5px' }}>−{pct}%</span>
                                    </div>
                                  )}
                                </td>
                                {/* Year / Km */}
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                  {l.year && <p style={{ fontSize: 13, color: '#d1d5db', fontWeight: 600, margin: 0 }}>{l.year}</p>}
                                  {l.mileage
                                    ? <p style={{ fontSize: 11, color: '#6b7280', margin: l.year ? '2px 0 0' : 0 }}>{Number(l.mileage).toLocaleString()} km</p>
                                    : !l.year && <span style={{ color: '#374151', fontSize: 13 }}>—</span>
                                  }
                                </td>
                                {/* Grade */}
                                <td style={{ padding: '12px 16px' }}>
                                  {l.auction_grade
                                    ? <span style={{ fontSize: 11, fontWeight: 700, color: extGC, background: `${extGC}15`, border: `1px solid ${extGC}28`, borderRadius: 5, padding: '2px 8px', display: 'inline-block' }}>{l.auction_grade}</span>
                                    : l.condition
                                      ? <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>{l.condition}</span>
                                      : <span style={{ color: '#374151', fontSize: 12 }}>—</span>
                                  }
                                </td>
                                {/* Age */}
                                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                  <AgeBadge createdAt={l.created_at} />
                                  <span style={{ display: 'block', fontSize: 10, color: '#374151', marginTop: 4 }}>{fmtDate(l.created_at)}</span>
                                </td>
                                {/* Status */}
                                <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                                  <StatusBadge listing={l} />
                                  {Array.isArray(l.included_services) && l.included_services.length > 0 && (
                                    <button
                                      onClick={e => { e.stopPropagation(); setSvcPopupListing(l); }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10, color: '#60a5fa', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    >
                                      <Tag style={{ width: 9, height: 9 }} />
                                      {l.included_services.length} svc
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden">
                      {pagedListings.map((l) => {
                        const isSold = l.status === 'sold';
                        const sp = l.selling_price || l.price || 0;
                        const op = l.original_price || l.previous_price || null;
                        const pct = op && op > sp ? Math.round(((op - sp) / op) * 100) : 0;
                        const isHot = pct >= 3;
                        return (
                          <div
                            key={l.id}
                            onClick={() => setDetailListing(l)}
                            style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: isSold ? 0.55 : 1, cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                              {/* Image */}
                              {l.images?.[0]
                                ? <img src={l.images[0]} alt="" style={{ width: 80, height: 60, borderRadius: 10, objectFit: 'cover', flexShrink: 0, filter: isSold ? 'grayscale(0.7) brightness(0.7)' : 'none' }} />
                                : <div style={{ width: 80, height: 60, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car style={{ width: 18, height: 18, color: '#374151' }} /></div>
                              }
                              {/* Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                  <div style={{ minWidth: 0 }}>
                                    <p style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, fontWeight: 600 }}>{l.brand}{l.year ? ` · ${l.year}` : ''}</p>
                                    <p style={{ fontSize: 15, color: '#f9fafb', fontWeight: 700, lineHeight: 1.25, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.model}</p>
                                    {l.variant && <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.variant}</p>}
                                  </div>
                                  <span onClick={e => e.stopPropagation()} style={{ flexShrink: 0, marginTop: 1 }}>
                                    <StatusBadge listing={l} />
                                  </span>
                                </div>
                                {/* Price */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
                                  <span style={{ fontSize: 15, color: '#f9fafb', fontWeight: 700, letterSpacing: '-0.01em' }}>RM {sp.toLocaleString()}</span>
                                  {pct > 0 && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: isHot ? '#60a5fa' : '#fbbf24', background: isHot ? 'rgba(96,165,250,0.1)' : 'rgba(251,191,36,0.1)', border: `1px solid ${isHot ? 'rgba(96,165,250,0.2)' : 'rgba(251,191,36,0.2)'}`, borderRadius: 4, padding: '1px 6px' }}>−{pct}%</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Meta row — indented under image */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 9, paddingLeft: 92 }}>
                              {(l.vin || l.vin_number) && <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{(l.vin || l.vin_number).trim()}</span>}
                              {l.mileage && <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{Number(l.mileage).toLocaleString()} km</span>}
                              {l.state && <><span style={{ color: '#1f2937', fontSize: 10 }}>·</span><span style={{ fontSize: 11, color: '#6b7280' }}>{l.state}</span></>}
                              <AgeBadge createdAt={l.created_at} />
                              {Array.isArray(l.included_services) && l.included_services.length > 0 && (
                                <button
                                  onClick={e => { e.stopPropagation(); setSvcPopupListing(l); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#60a5fa', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}
                                >
                                  <Tag style={{ width: 9, height: 9 }} />
                                  {l.included_services.length} svc
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {filteredListings.length > listingsVisible && (
                      <div style={{ padding: '16px 20px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <button
                          onClick={() => setListingsVisible(p => p + 20)}
                          style={{ padding: '10px 32px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'background .15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                        >
                          See more · {filteredListings.length - listingsVisible} remaining
                        </button>
                      </div>
                    )}
                  </>
                )}
                </div>
              </div>
            </>
          )}

          {activeTab === "add" && (
            <div className="card-top rounded-xl p-4 sm:p-6" style={T.cardDark}>
              <CarForm onCreate={handleNew} />
            </div>
          )}
          {activeTab === "analytics" && (
            <AnalyticsTab
              listings={listings}
              profile={profile}
              onEditListing={setEditListing}
              onStaleAdjusted={handleStaleAdjusted}
              adjustedStaleIds={adjustedStaleIds}
            />
          )}
          {activeTab === "marketplace" && (
            <MarketplaceAnalyticsTab profile={profile} />
          )}
          {activeTab === "ai_manager" && snapshot && (
            <AISalesManager
              snapshot={snapshot}
              dealerName={profile?.dealership || profile?.site_name || "Your Dealership"}
            />
          )}
          {activeTab === "ai_manager" && !snapshot && (
            <div className="flex items-center justify-center h-64 text-gray-600 text-sm">
              Loading dealer data...
            </div>
          )}
          {activeTab === "team" && (
            <TeamTab managerDealership={profile?.dealership} dealerId={getDealerIdFromProfile(profile)} />
          )}
          {activeTab === "settings" && profile && (
            <SettingsTab
              profile={profile}
              onProfileUpdate={handleProfileUpdate}
            />
          )}
          {activeTab === "crm" && (
            <CRMPanel
              userId={userId}
              listings={listings}
              salesmen={salesmen}
              onOpenDoc={(data) => { setPrefillDocData(data); handleTabChange('documents'); }}
            />
          )}
          {activeTab === "hero" && userId && (
            <HeroSlidesPage userId={userId} profile={profile} />
          )}
          {activeTab === "stock" && userId && (
            <StockTab userId={userId} listings={listings} />
          )}
          {activeTab === "documents" && (
            <DocumentsTab userId={userId} listings={listings} prefillDocData={prefillDocData} onClearPrefill={() => setPrefillDocData(null)} profile={profile} />
          )}
          {activeTab === "revops" && userId && (
            <RevOpsPage userId={userId} onNavigateToStock={() => navigate("/dashboard/stock")} />
          )}
          {activeTab === "services" && userId && (
            <ServicesPage userId={userId} />
          )}
          {activeTab === "outreach" && userId && (
            <OutreachHub dealerId={userId} listings={listings} />
          )}
          </Suspense>
        </div>
      </main>

      <Suspense fallback={null}>
      {detailListing && (
        <ListingDetailDrawer
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
          setTiktokListing={setTiktokListing}
          setPriceEditListing={setPriceEditListing}
          setMarkSoldListing={setMarkSoldListing}
          setDeleteId={setDeleteId}
          copyListing={copyListing}
          copiedListingId={copiedListingId}
          handleAssign={handleAssign}
          handleUnassign={handleUnassign}
          handleStatus={handleStatus}
          updatingStatus={updatingStatus}
          getListingAge={getListingAge}
        />
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
            background: '#111118',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            fontFamily: "'DM Sans', sans-serif",
            zIndex: 9999,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6' }}>Notifications</span>
              {notifCount > 0 && <button onClick={markAllRead} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Mark all read</button>}
            </div>
            {notifications.length === 0 ? (
              <p style={{ fontSize: 13, color: '#4b5563', padding: '20px 16px', textAlign: 'center' }}>No notifications</p>
            ) : notifications.slice(0, 10).map(n => (
              <div key={n.id} onClick={() => { if (n.link_to) { handleTabChange(n.link_to); closeNotif(); } markNotifRead(n); }} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: n.link_to ? 'pointer' : 'default', background: n.is_read ? 'transparent' : 'rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {!n.is_read && <div style={{ width: 6, height: 6, background: '#dc2626', borderRadius: '50%', flexShrink: 0, marginTop: 5 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6', margin: '0 0 2px' }}>{n.title || 'Notification'}</p>
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
            style={{ background: '#0f1623', border: '1px solid rgba(255,255,255,0.08)' }}
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
              <button onClick={() => setSvcPopupListing(null)} className="text-gray-500 hover:text-white p-1 transition-colors">
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
                      <p className="text-sm font-medium text-white truncate">{svc.name}</p>
                      <p className="text-xs text-gray-500">{cfg.label}</p>
                    </div>
                    <span className="text-sm font-semibold text-white whitespace-nowrap">
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
      {showFastModal && (
        <div onClick={() => setShowFastModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0d1117', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', fontFamily: "'DM Sans',sans-serif" }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>⚡ Fast List</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#4b5563' }}>2 steps — live in 30 seconds</p>
              </div>
              <button onClick={() => setShowFastModal(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, color: '#6b7280', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <CarFormFast
              onCreate={(car) => {
                setShowFastModal(false);
                toast.success("Listed! Add more details anytime.");
              }}
            />
          </div>
        </div>
      )}

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
                <h3 className="font-semibold text-white">Delete Listing?</h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setDeleteId(null)}
                className="text-gray-500 hover:text-white p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-5">
              This will permanently remove the car listing from your inventory.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
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

      {priceEditListing && (
        <PriceEditModal
          listing={priceEditListing}
          onClose={() => setPriceEditListing(null)}
          onSave={handlePriceSave}
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

      {tiktokListing && (
        <TikTokStudioV3
          listing={tiktokListing}
          onClose={() => setTiktokListing(null)}
        />
      )}

      {/* Edit listing modal */}
      {editListing && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
            style={undefined}
          >
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={T.divider}
            >
              <div>
                <h3 className="font-semibold text-white">Edit Listing</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editListing.brand} {editListing.model}{" "}
                  {editListing.variant || ""}
                </p>
              </div>
              <button
                onClick={() => setEditListing(null)}
                className="text-gray-500 hover:text-white p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              <CarForm
                listing={editListing}
                onUpdate={handleUpdate}
                onCreate={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {markSoldListing && (
        <MarkSoldModal
          listing={markSoldListing}
          onClose={() => setMarkSoldListing(null)}
          onConfirm={handleMarkSold}
          loading={markSoldLoading}
        />
      )}
      </Suspense>

      {/* ── Post-listing stock purchase prompt ── */}
      {pendingStockListing && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-md flex flex-col" style={undefined}>
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <div>
                <h3 className="font-semibold text-white">Add Purchase Details?</h3>
                <p className="text-gray-500 text-xs mt-0.5">{pendingStockListing.brand} {pendingStockListing.model} {pendingStockListing.year}</p>
              </div>
              <button onClick={() => setPendingStockListing(null)} className="text-gray-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
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
                  <select value={pendingStockForm.purchase_source} onChange={e => setPendingStockForm(p => ({ ...p, purchase_source: e.target.value }))} className={iCls} style={{ background: 'rgba(255,255,255,0.05)' }}>
                    {['Auction','Direct Buy','Trade-in','Other'].map(s => <option key={s} value={s} style={{ background: '#111118' }}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Recon Cost (RM)</label>
                  <input type="number" value={pendingStockForm.recon_cost} onChange={e => setPendingStockForm(p => ({ ...p, recon_cost: e.target.value }))} placeholder="0" className={iCls} />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-white/[0.06] flex gap-3">
              <button onClick={() => setPendingStockListing(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>Skip</button>
              <button
                disabled={pendingStockSaving || !pendingStockForm.purchase_price}
                onClick={async () => {
                  setPendingStockSaving(true);
                  await supabase.from('stock_units').insert({
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
                  });
                  setPendingStockSaving(false);
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
