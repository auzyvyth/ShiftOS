import React, { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "../supabaseClient";
import CarForm from "../components/CarForm";
import { getCategoryCfg } from "../utils/serviceCategories";
import TikTokStudioV3 from "../components/TikTokStudioV3";
import {
  LogOut,
  Copy,
  Check,
  Car,
  Plus,
  User,
  Phone,
  X,
  LayoutGrid,
  Users,
  MessageSquare,
  Link as LinkIcon,
  GitMerge,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Send,
  Pencil,
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
  Target,
  Award,
  Zap,
} from "lucide-react";

function useWindowSize() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

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

const STAGE_COLOR = {
  new: {
    bg: "rgba(96,165,250,0.12)",
    border: "rgba(96,165,250,0.3)",
    tx: "#93c5fd",
  },
  contacted: {
    bg: "rgba(251,191,36,0.12)",
    border: "rgba(251,191,36,0.3)",
    tx: "#fbbf24",
  },
  viewing_booked: {
    bg: "rgba(167,139,250,0.12)",
    border: "rgba(167,139,250,0.3)",
    tx: "#c084fc",
  },
  test_drive: {
    bg: "rgba(52,211,153,0.12)",
    border: "rgba(52,211,153,0.3)",
    tx: "#34d399",
  },
  negotiating: {
    bg: "rgba(251,146,60,0.12)",
    border: "rgba(251,146,60,0.3)",
    tx: "#fb923c",
  },
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

const getHeatScore = (lead) => {
  const stageWeight = STAGE_WEIGHT[lead.stage] || 0;
  const daysStale = lead.updated_at
    ? Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000)
    : 0;
  const penalty = Math.min(daysStale * 0.5, 3);
  const score = stageWeight - penalty;
  if (score >= 4) return { score, emoji: "🔥", label: "hot", color: "#f87171" };
  if (score >= 2)
    return { score, emoji: "🟡", label: "warm", color: "#fbbf24" };
  return { score, emoji: "🧊", label: "cold", color: "#93c5fd" };
};

const LOST_REASONS = ["Price", "Timing", "Competitor", "Ghost"];

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

export default function SalesmanLite() {
  const navigate = useNavigate();
  const isMobile = useWindowSize() < 768;

  const [profile, setProfile] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const [inboxSubTab, setInboxSubTab] = useState("enquiries");
  const [reschedulingAptId, setReschedulingAptId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  function switchTab(tab) {
    if (tab === "enquiries") setNewBookingsCount(0);
    setActiveTab(tab);
  }

  // listings
  const [myListings, setMyListings] = useState([]);
  const [listingCopied, setListingCopied] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);

  // leads
  const [leads, setLeads] = useState([]);
  const [staleLeads, setStaleLeads] = useState([]);
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
  const [deletingLeadId, setDeletingLeadId] = useState(null);
  const [lostPromptId, setLostPromptId] = useState(null);
  const [lostSavingId, setLostSavingId] = useState(null);
  const [drawerLeadId, setDrawerLeadId] = useState(null);
  const [stageSavingId, setStageSavingId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
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
  // Commission
  const [commissionData, setCommissionData] = useState({ total: 0, count: 0 });

  // Goal panel
  const [goal, setGoal] = useState({ target: 0, focusCarId: null });
  const [goalEditing, setGoalEditing] = useState(false);
  const [goalDraft, setGoalDraft] = useState(0);
  const saveGoal = (patch) => {
    const next = { ...goal, ...patch };
    setGoal(next);
    if (userId) localStorage.setItem(`slite_goal_${userId}`, JSON.stringify(next));
  };

  // settings
  const [settingsForm, setSettingsForm] = useState({
    full_name: "",
    whatsapp_number: "",
    telegram_chat_id: "",
    city: "",
    state: "",
    ic_number: "",
    instagram: "",
    tiktok: "",
    facebook: "",
    website: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(
    () => localStorage.getItem("salesman_lite_avatar") || ""
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);
  const broadcastCancelRef = useRef(false);
  const pendingStageRef = useRef({});
  const [cancelConfirmId, setCancelConfirmId] = useState(null);
  const [editingReminder, setEditingReminder] = useState(null);
  const [reminderMsg, setReminderMsg] = useState("");
  const [reminderPickerAptId, setReminderPickerAptId] = useState(null);
  const [selectedRemindAt, setSelectedRemindAt] = useState(null);
  const [reminderSaving, setReminderSaving] = useState(false);

  // notifications
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  // browser push notifications + batch WA
  const [browserNotifPerm, setBrowserNotifPerm] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(() =>
    localStorage.getItem('slite_notif_banner_dismissed') === '1'
  );
  const [batchWALeads, setBatchWALeads] = useState(null); // null = closed, array = queue
  const [batchWAIdx, setBatchWAIdx] = useState(0);

  // enquiry templates
  const [openTemplateId, setOpenTemplateId] = useState(null);
  const [templateToast, setTemplateToast] = useState(null);

  // listings sort/filter
  const [sortBy, setSortBy] = useState("newest");
  const [filterStatus, setFilterStatus] = useState("available");

  // per-listing analytics (carStatsMap)
  const [carStatsMap, setCarStatsMap] = useState({});
  const [cvrHover, setCvrHover] = useState(null);

  // car detail popup
  const [selectedCar, setSelectedCar] = useState(null);
  const [carDetailImgIdx, setCarDetailImgIdx] = useState(0);
  const [carDetailTab, setCarDetailTab] = useState("specs");
  const [carDetailLbOpen, setCarDetailLbOpen] = useState(false);

  // TikTok Studio
  const [tiktokListing, setTiktokListing] = useState(null);
  const [editListing, setEditListing] = useState(null);

  // tour
  const [tourStep, setTourStep] = useState(null);
  const [tourTarget, setTourTarget] = useState(null);

  // broadcast
  const [broadcastCar, setBroadcastCar] = useState(null);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastProgress, setBroadcastProgress] = useState(null);
  const [broadcastDone, setBroadcastDone] = useState(false);

  // AI caption
  const [aiCaptionCar, setAiCaptionCar] = useState(null);
  const [aiCaptions, setAiCaptions] = useState({});
  const [aiCaptionLoading, setAiCaptionLoading] = useState(false);
  const [aiCaptionTab, setAiCaptionTab] = useState("wa");
  const [captionCopied, setCaptionCopied] = useState(false);

  // boost placeholder
  const [boostCarId, setBoostCarId] = useState(null);
  const [boostWaitlisted, setBoostWaitlisted] = useState(false);

  // merge
  const [mergeCode, setMergeCode] = useState("");
  const [mergeStatus, setMergeStatus] = useState("idle");
  const [mergeMsg, setMergeMsg] = useState("");

  // listing status change
  const [statusMenuCarId, setStatusMenuCarId] = useState(null);

  const updateListingStatus = async (car, newStatus) => {
    setStatusMenuCarId(null);
    const prevStatus = car.status;
    setMyListings((p) => p.map((c) => c.id === car.id ? { ...c, status: newStatus } : c));
    // Use RPC to avoid PostgREST bug with GENERATED ALWAYS columns (gross_profit)
    const { error: statusErr } = await supabase.rpc("update_listing_status", {
      p_listing_id: car.id,
      p_status:     newStatus,
      p_dealer_id:  userId,
    });
    if (statusErr) {
      console.error("updateListingStatus:", statusErr);
      setMyListings((p) => p.map((c) => c.id === car.id ? { ...c, status: prevStatus } : c));
      toast.error("Failed to update status");
      return;
    }
    writeCache(`slite_listings_${userId}`, myListings.map((c) => c.id === car.id ? { ...c, status: newStatus } : c));
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
      toast.error("Failed to delete listing");
      return;
    }
    setMyListings((p) => p.filter((c) => c.id !== carId));
    writeCache(`slite_listings_${userId}`, myListings.filter((c) => c.id !== carId));
    setConfirmDeleteId(null);
    toast.success("Listing deleted");
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

  // objection playbook
  const [playbookLeadId, setPlaybookLeadId] = useState(null);
  const [copiedScriptLine, setCopiedScriptLine] = useState(null);

  // enquiry expand
  const [expandedEnqId, setExpandedEnqId] = useState(null);

  // mobile lead stage filter
  const [mobileLeadStage, setMobileLeadStage] = useState("new");

  // link car to lead
  const [linkCarLeadId, setLinkCarLeadId] = useState(null);

  // deposit receipt
  const [depositModal, setDepositModal] = useState(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCopied, setDepositCopied] = useState(false);

  const channelRef = useRef(null);
  const [appointments, setAppointments] = useState([]);
  const [pastOpen, setPastOpen] = useState(false);
  const [enquiries, setEnquiries] = useState([]);
  const [analyticsEvents, setAnalyticsEvents] = useState([]);

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

  // stale leads (48h no contact) + overdue follow-ups
  useEffect(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const now = Date.now();
    setStaleLeads(
      leads.filter((l) => {
        const closed = ["won","lost","closed_won","closed_lost"].includes(l.stage);
        if (closed) return false;
        const overdueFollowUp = l.follow_up_at && new Date(l.follow_up_at).getTime() <= now;
        const stale48h = l.updated_at && new Date(l.updated_at).getTime() < cutoff;
        return overdueFollowUp || stale48h;
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
        ic_number: profile.ic_number || "",
        instagram: profile.instagram || "",
        tiktok: profile.tiktok || "",
        facebook: profile.facebook || "",
        website: profile.website || "",
      });
      const av = profile.avatar_url || "";
      setAvatarUrl(av);
      if (av) localStorage.setItem("salesman_lite_avatar", av);
      setSettingsForm((p) => ({ ...p, telegram_chat_id: profile.telegram_chat_id || "" }));
    }
  }, [profile]);

  // auth + profile
  useEffect(() => {
    // getSession() properly awaits any in-progress token refresh before returning,
    // so it always reflects the true final auth state — no login flash.
    supabase.auth.getSession().then(async ({ data, error }) => {
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
        .select("id, role, slug, dealership, site_name, whatsapp_number, brand_color, avatar_url, telegram_chat_id, dealer_id, full_name, plan, telegram_bot_token, city, state, ic_number, account_status, instagram, tiktok, facebook, website")
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
      if (profileData.plan === "salesman_premium") {
        navigate("/salesman-premium", { replace: true });
        return;
      }

      setProfile(profileData);
      setLoading(false);

      if (
        !profileData.onboarding_tour_done &&
        profileData.created_at &&
        Date.now() - new Date(profileData.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
      ) setTourStep(0);

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
            "id, slug, year, brand, model, variant, selling_price, original_price, status, images, colour, mileage, transmission, fuel_type, body_type, features, options, city, state, condition, engine_cc, created_at, included_services, included_services_cost, sold_at",
          )
          .eq("assigned_to", uid),
        supabase
          .from("car_listings")
          .select(
            "id, slug, year, brand, model, variant, selling_price, original_price, status, images, colour, mileage, transmission, fuel_type, body_type, features, options, city, state, condition, engine_cc, created_at, included_services, included_services_cost, sold_at",
          )
          .eq("dealer_id", uid),
      ]).then(([r1, r2]) => {
        if (r1.error) { console.error("fetchListings(assigned_to):", r1.error); toast.error(`Listings error: ${r1.error.message}`); }
        if (r2.error) { console.error("fetchListings(dealer_id):", r2.error); toast.error(`Listings error: ${r2.error.message}`); }
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
        // Profit this month from sold listings (salesman-lite owns listings as dealer)
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        supabase
          .from("car_listings")
          .select("gross_profit, selling_price, purchase_price, recon_cost, included_services_cost, sold_at")
          .eq("dealer_id", uid)
          .eq("status", "sold")
          .gte("sold_at", monthStart)
          .then(({ data: soldThisMonth }) => {
            const rows = soldThisMonth || [];
            const revenue  = rows.reduce((s, l) => s + (Number(l.selling_price) || 0), 0);
            const purchase = rows.reduce((s, l) => s + (Number(l.purchase_price) || 0), 0);
            const recon    = rows.reduce((s, l) => s + (Number(l.recon_cost) || 0), 0);
            const services = rows.reduce((s, l) => s + (Number(l.included_services_cost) || 0), 0);
            const profit   = rows.reduce((s, l) => {
              const gp = l.gross_profit != null
                ? Number(l.gross_profit)
                : (Number(l.selling_price) || 0) - (Number(l.purchase_price) || 0) - (Number(l.recon_cost) || 0) - (Number(l.included_services_cost) || 0);
              return s + gp;
            }, 0);
            setCommissionData({ total: profit, revenue, purchase, recon, services, count: rows.length });
          });
      });

      // Single analytics fetch — all-time, all fields needed for both 30d chart and CVR map
      const slug = profileData.slug;
      if (slug) {
        const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        supabase
          .from("analytics_events")
          .select("event_type, car_id, car_name, created_at, session_id")
          .eq("salesman_slug", slug)
          .gte("created_at", cutoff30)
          .then(({ data: allEvts, error: evtsErr }) => {
            if (evtsErr) console.error("fetchAnalyticsEvents:", evtsErr);
            const evts = allEvts || [];
            setAnalyticsEvents(evts);
            // build per-listing CVR map (all-time, session-deduped)
            const now = Date.now();
            const DAY_MS = 86400000;
            const map = {};
            const viewedKeys = new Set();
            const contactedKeys = new Set();
            evts.forEach((e) => {
              if (!e.car_id) return;
              if (!map[e.car_id]) map[e.car_id] = { views: 0, enquiries: 0, daily: [0,0,0,0,0,0,0] };
              const key = `${e.car_id}:${e.session_id || e.car_id}`;
              if (["car_view", "link_visit"].includes(e.event_type)) {
                if (!viewedKeys.has(key)) {
                  viewedKeys.add(key);
                  map[e.car_id].views++;
                  const daysAgo = Math.floor((now - new Date(e.created_at).getTime()) / DAY_MS);
                  if (daysAgo >= 0 && daysAgo < 7) map[e.car_id].daily[6 - daysAgo]++;
                }
              }
              if (["whatsapp_click", "call_click"].includes(e.event_type)) {
                if (!contactedKeys.has(key)) { contactedKeys.add(key); map[e.car_id].enquiries++; }
              }
            });
            setCarStatsMap(map);
          });
      }

      // fetch leads
      supabase
        .from("leads")
        .select("*, car_listings(brand, model, year, selling_price)")
        .eq("salesman_id", uid)
        .or("is_deleted.eq.false,is_deleted.is.null")
        .order("updated_at", { ascending: false })
        .then(({ data: lds, error: ldsErr }) => {
          if (ldsErr) console.error("fetchLeads:", ldsErr);
          const fetchedLeads = lds || [];
          setLeads(fetchedLeads);
          setLeadsLoading(false);
          writeCache(`slite_leads_${uid}`, fetchedLeads);

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
                const key = `${e.buyer_phone || ""}::${e.listing_id || ""}`;
                if (batchSeen.has(key)) return false;
                batchSeen.add(key);
                return true;
              });
              // Run conversions sequentially to avoid concurrent duplicate-check races
              const newLeads = [];
              for (const e of dedupedPending) {
                if (!e.buyer_phone && !e.listing_id) continue;
                if (e.listing_id && e.buyer_phone) {
                  const { data: existing, error: existingErr } = await supabase
                    .from("leads")
                    .select("id")
                    .eq("salesman_id", uid)
                    .eq("car_listing_id", e.listing_id)
                    .eq("phone", e.buyer_phone)
                    .maybeSingle();
                  if (existingErr) console.error("checkExistingLead:", existingErr);
                  if (existing) continue;
                }
                const { data, error: insertLeadErr } = await supabase
                  .from("leads")
                  .insert({
                    salesman_id: uid,
                    dealer_id: null,
                    buyer_name: e.buyer_name || "Unknown",
                    phone: e.buyer_phone || "",
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
            toast("New enquiry!", { description: row.buyer_name || "Someone enquired" });
            if (!row.buyer_phone && !row.listing_id) return;
            const phone = (row.buyer_phone || "").replace(/\D/g, "");
            if (phone) {
              const { data: dupLead } = await supabase.from("leads").select("id").eq("salesman_id", uid).is("dealer_id", null).eq("phone", phone).maybeSingle();
              if (!dupLead) {
                const { data: newLead, error: rtInsertErr } = await supabase.from("leads").insert({
                  salesman_id: uid, dealer_id: null,
                  buyer_name: row.buyer_name || null, phone: row.buyer_phone || null,
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

          if (channelRef.current) supabase.removeChannel(channelRef.current);
          channelRef.current = supabase
            .channel("salesman-lite-rt-" + uid)
            .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `salesman_id=eq.${uid}` },
              (payload) => {
                if (payload.eventType === "INSERT") setLeads((p) => [payload.new, ...p]);
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
            .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `salesman_id=eq.${uid}` },
              async (payload) => {
                if (payload.eventType === "INSERT") {
                  setAppointments((p) => [payload.new, ...p]);
                  setNewBookingsCount((c) => c + 1);
                  toast("New booking!", { description: payload.new.buyer_name || "New appointment" });
                  const phone = (payload.new.buyer_phone || "").replace(/\D/g, "");
                  if (phone) {
                    const { data: existing } = await supabase.from("leads").select("id").eq("salesman_id", uid).is("dealer_id", null).eq("phone", phone).maybeSingle();
                    if (!existing) {
                      const { data: newLead } = await supabase.from("leads").insert({
                        salesman_id: uid, dealer_id: null,
                        buyer_name: payload.new.buyer_name || null, phone: payload.new.buyer_phone || null,
                        car_listing_id: payload.new.car_listing_id || null,
                        stage: "new", lead_source: "manual", is_deleted: false,
                      }).select().single();
                      if (newLead) setLeads((p) => [newLead, ...p]);
                    }
                  }
                }
                if (payload.eventType === "UPDATE") setAppointments((p) => p.map((a) => a.id === payload.new.id ? { ...a, ...payload.new } : a));
              },
            )
            .subscribe();
        });

      // fetch appointments
      supabase
        .from("appointments")
        .select("id, buyer_name, buyer_phone, appointment_date, status, notes, car_listing_id, created_at, car_listings(brand, model, year)")
        .eq("salesman_id", uid)
        .order("appointment_date", { ascending: false })
        .then(({ data: apts, error: aptsErr }) => {
          if (aptsErr) { console.error("fetchAppointments:", aptsErr); toast.error("Could not load bookings"); return; }
          const appts = apts || [];
          setAppointments(appts);
          writeCache(`slite_appts_${uid}`, appts);
        });

      // fetch notifications
      supabase
        .from("salesman_notifications")
        .select("id, title, body, is_read, created_at")
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
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  useEffect(() => {
    if (tourStep === null) { setTourTarget(null); return; }
    const TOUR_TABS = [null, "dashboard", "listings", "leads", "enquiries", "bookings", "merge"];
    const tab = TOUR_TABS[tourStep];
    if (!tab) { setTourTarget(null); return; }
    switchTab(tab);
    const measure = () => {
      const el = document.querySelector(`[data-tour-id="${tab}"]`);
      if (el) setTourTarget(el.getBoundingClientRect());
    };
    const t = setTimeout(measure, 60);
    return () => clearTimeout(t);
  }, [tourStep]);

  useEffect(() => {
    if (!userId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`slite_goal_${userId}`));
      if (saved) setGoal(saved);
    } catch {}
  }, [userId]);

  // Browser notification: fire when user returns to tab and has stale leads
  useEffect(() => {
    if (browserNotifPerm !== 'granted') return;
    const handler = () => {
      if (document.hidden || staleLeads.length === 0) return;
      const names = staleLeads.slice(0, 3).map(l => l.buyer_name || 'Unknown').join(', ');
      new Notification(`${staleLeads.length} lead${staleLeads.length !== 1 ? 's' : ''} need follow-up`, {
        body: names,
        tag: 'slite-followup',
      });
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
      toast.error("Failed to update lead stage");
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
    toast(`${buyerName} → ${newStage.replace(/_/g, " ")}`, {
      action: {
        label: "Undo",
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

  const saveLeadNote = async (leadId) => {
    setNotesSavingId(leadId);
    const { error } = await supabase.from("leads").update({ notes: editNoteVal, updated_at: new Date().toISOString() }).eq("id", leadId);
    setNotesSavingId(null);
    if (error) { console.error("saveLeadNote:", error); toast.error("Failed to save note"); return; }
    setLeads((p) => p.map((l) => l.id === leadId ? { ...l, notes: editNoteVal } : l));
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
      activity_type: "call_logged",
      note: `${callOutcome}${callNote ? ` — ${callNote}` : ""}`,
      created_by: userId,
      dealer_id: lead?.dealer_id ?? null,
    });
    if (error) { console.error("logCall:", error); toast.error(`Log call error: ${error.message}`); setCallSaving(false); return; }
    await supabase.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", logCallLeadId);
    setLeads((p) => p.map((l) => l.id === logCallLeadId ? { ...l, updated_at: new Date().toISOString() } : l));
    setLeadActivities((p) => { const n = { ...p }; delete n[logCallLeadId]; return n; });
    toast.success("Call logged");
    setCallSaving(false);
    setLogCallLeadId(null);
    setCallNote("");
    setCallOutcome("answered");
  };

  const saveFollowUp = async (leadId, date) => {
    setFollowUpSaving(true);
    const { error } = await supabase.from("leads").update({ follow_up_at: date || null, updated_at: new Date().toISOString() }).eq("id", leadId);
    setFollowUpSaving(false);
    if (error) { console.error("saveFollowUp:", error); toast.error(`Reminder error: ${error.message}`); return; }
    setLeads((p) => p.map((l) => l.id === leadId ? { ...l, follow_up_at: date || null } : l));
    setFollowUpModalLead(null);
    toast.success(date ? "Follow-up reminder set" : "Reminder cleared");
  };

  const handleDeleteLead = async (leadId) => {
    setDeletingLeadId(leadId);
    const { error: delErr } = await supabase.from("leads").update({ is_deleted: true }).eq("id", leadId);
    setDeletingLeadId(null);
    if (delErr) {
      console.error("handleDeleteLead:", delErr);
      toast.error("Failed to delete lead");
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
      toast.error("Failed to link car");
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
    toast.success("Car linked to lead!");
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
      toast.error("Failed to mark lead as lost");
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

  // ── notifications ──────────────────────────────────────────────────────────

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markNotifRead = async (notif) => {
    if (notif.is_read) return;
    const { error: readErr } = await supabase
      .from("salesman_notifications")
      .update({ is_read: true })
      .eq("id", notif.id);
    if (readErr) console.error("markNotifRead:", readErr);
    setNotifications((p) =>
      p.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
    );
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
    const phone = (enq.buyer_phone || "").replace(/\D/g, "");
    if (phone) {
      window.open(
        `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${encodeURIComponent(msg)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
    setTemplateToast(enq.id + "_" + key);
    setTimeout(() => setTemplateToast(null), 2000);
    setOpenTemplateId(null);
    if (enq.status === "new") {
      await supabase.from("whatsapp_enquiries").update({ status: "responded" }).eq("id", enq.id);
      setEnquiries((p) => p.map((e) => e.id === enq.id ? { ...e, status: "responded" } : e));
      await autoCreateLeadFromEnq(enq);
    }
  };

  // ── appointment status ─────────────────────────────────────────────────────

  const updateApptStatus = async (apptId, status) => {
    const { error: apptErr } = await supabase.from("appointments").update({ status }).eq("id", apptId);
    if (apptErr) {
      console.error("updateApptStatus:", apptErr);
      toast.error("Failed to update appointment");
      return;
    }
    setAppointments((p) => p.map((a) => (a.id === apptId ? { ...a, status } : a)));
  };

  const scheduleAptReminder = async (apt) => {
    if (!apt.appointment_date) return;
    const remindAt = new Date(new Date(apt.appointment_date).getTime() - 60 * 60 * 1000).toISOString();
    await supabase.from("appointments").update({ remind_at: remindAt, remind_sent: false }).eq("id", apt.id);
    setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, remind_at: remindAt, remind_sent: false } : a));
  };

  const autoUpsertLeadFromAppt = async (apt) => {
    const phone = (apt.buyer_phone || "").replace(/\D/g, "");
    if (!phone) return;
    const { data: existing } = await supabase
      .from("leads").select("id, stage").eq("salesman_id", userId).is("dealer_id", null).eq("phone", phone).maybeSingle();
    if (existing) {
      const curIdx = LEAD_STAGES.indexOf(existing.stage);
      const viewIdx = LEAD_STAGES.indexOf("viewing_booked");
      if (curIdx < viewIdx) {
        await supabase.from("leads").update({ stage: "viewing_booked" }).eq("id", existing.id);
        setLeads((p) => p.map((l) => l.id === existing.id ? { ...l, stage: "viewing_booked" } : l));
        toast.success("Lead moved to Viewing Booked!");
      }
    } else {
      const { data: newLead } = await supabase.from("leads").insert({
        salesman_id: userId, dealer_id: null,
        buyer_name: apt.buyer_name || "Unknown", phone: apt.buyer_phone || "",
        car_listing_id: apt.car_listing_id || null,
        stage: "viewing_booked", lead_source: "manual", is_deleted: false,
      }).select().single();
      if (newLead) { setLeads((p) => [newLead, ...p]); toast.success("Lead created at Viewing Booked!"); }
    }
  };

  const autoCreateLeadFromEnq = async (enq) => {
    const phone = (enq.buyer_phone || "").replace(/\D/g, "");
    if (!phone) return;
    const { data: existing } = await supabase
      .from("leads").select("id").eq("salesman_id", userId).is("dealer_id", null).eq("phone", phone).maybeSingle();
    if (!existing) {
      const { data: newLead } = await supabase.from("leads").insert({
        salesman_id: userId, dealer_id: null,
        buyer_name: enq.buyer_name || "Unknown", phone: enq.buyer_phone || "",
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
        phone: addLeadForm.phone,
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
      toast.error("Failed to add lead");
      setAddLeadSaving(false);
      return;
    }
    if (data) setLeads((p) => [data, ...p]);
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

  const handleMerge = async () => {
    if (!mergeCode.trim()) return;
    setMergeStatus("pending");
    setMergeMsg("");

    const { data, error: inviteErr } = await supabase
      .from("dealer_invites")
      .select("dealer_id, expires_at, used")
      .eq("code", mergeCode.trim().toUpperCase())
      .maybeSingle();

    if (inviteErr) console.error("handleMerge invite lookup:", inviteErr);
    if (!data || data.used || new Date(data.expires_at) < new Date()) {
      setMergeStatus("error");
      setMergeMsg("Invalid or expired invite code.");
      return;
    }

    const { error: rpcErr } = await supabase.rpc("use_dealer_invite", {
      invite_code: mergeCode.trim().toUpperCase(),
    });
    if (rpcErr) {
      console.error("handleMerge rpc:", rpcErr);
      setMergeStatus("error");
      setMergeMsg("Merge failed. Please try again or contact support.");
      return;
    }

    setMergeStatus("success");
    setMergeMsg("Merged! Redirecting to full dashboard...");
    const keysToDelete = [
      `slite_listings_${profile.id}`,
      `slite_leads_${profile.id}`,
      `slite_enquiries_${profile.id}`,
      `slite_appts_${profile.id}`,
      `slite_last_seen_enq_${profile.id}`,
      "salesman_lite_avatar",
    ];
    keysToDelete.forEach(k => localStorage.removeItem(k));
    setMyListings([]);
    setLeads([]);
    setEnquiries([]);
    setAppointments([]);
    setTimeout(() => navigate("/salesman"), 2500);
  };

  const handleListingCopy = (car, type) => {
    const link = `https://xdrive.my/showroom/${car.slug}?ref=${profile?.slug || ""}`;
    let text = link;
    if (type === "wa") {
      const price = Number(car.selling_price || 0);
      text = [
        `🚗 ${car.year} ${car.brand} ${car.model}${car.variant ? " " + car.variant : ""}`,
        `💰 RM ${price.toLocaleString()}`,
        `📍 ${car.city || car.location || "Malaysia"}`,
        `🔢 ${car.mileage ? Number(car.mileage).toLocaleString() + " km" : "—"} · ${car.colour || "—"} · ${car.transmission || "—"}`,
        ``,
        `✅ Condition: ${car.condition || "Good"}`,
        ``,
        `Berminat? Whatsapp saya sekarang 👇`,
        link,
      ].join("\n");
    }
    navigator.clipboard.writeText(text);
    setListingCopied((prev) => ({ ...prev, [car.id]: type }));
    setTimeout(
      () => setListingCopied((prev) => ({ ...prev, [car.id]: null })),
      1500,
    );
  };

  const generateAiCaptions = async (car, force = false) => {
    setAiCaptionCar(car);
    setAiCaptionTab("wa");
    setCaptionCopied(false);
    const existing = aiCaptions[car.id];
    if (!force && existing && !existing.wa?.startsWith("Couldn't")) return;
    if (aiCaptionLoading) return; // block re-entry including Regenerate
    const AI_CAP_KEY = "slite_ai_cap_count";
    const AI_CAP_DATE = "slite_ai_cap_date";
    const today = new Date().toDateString();
    const savedDate = sessionStorage.getItem(AI_CAP_DATE);
    const count = savedDate === today ? parseInt(sessionStorage.getItem(AI_CAP_KEY) || "0", 10) : 0;
    if (count >= 10) { toast.error("AI caption limit reached for today (10/10)"); return; }
    sessionStorage.setItem(AI_CAP_DATE, today);
    sessionStorage.setItem(AI_CAP_KEY, String(count + 1));
    setAiCaptionLoading(true);
    const name = [car.year, car.brand, car.model, car.variant]
      .filter(Boolean)
      .join(" ");
    const price = car.selling_price
      ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}`
      : null;
    const mileage = car.mileage
      ? `${Number(car.mileage).toLocaleString()} km`
      : null;
    const prompt = `You are a car dealer social media assistant in Malaysia. Generate two captions for this car listing in JSON format only.

Car: ${name}${price ? `, ${price}` : ""}${mileage ? `, ${mileage}` : ""}${car.transmission ? `, ${car.transmission}` : ""}${car.colour ? `, ${car.colour}` : ""}

Return valid JSON only (no markdown, no code block), exactly this shape:
{"wa":"<WhatsApp caption — friendly Manglish, 3–5 lines, includes price, condition, CTA to WhatsApp. Use emojis.>","tiktok":"<TikTok caption — punchy, 1–2 lines max, hype energy, relevant hashtags at end>"}`;
    try {
      const { data, error } = await supabase.functions.invoke("ai-proxy", {
        body: { prompt },
      });
      if (error) throw error;
      const raw =
        data?.reply ?? data?.content ?? data?.text ?? data?.message ?? "{}";
      const parsed = JSON.parse(raw);
      setAiCaptions((p) => ({ ...p, [car.id]: parsed }));
    } catch (e) {
      console.error("generateAiCaption:", e);
      setAiCaptions((p) => ({
        ...p,
        [car.id]: {
          wa: "Couldn't generate caption. Please try again.",
          tiktok: "Couldn't generate caption. Please try again.",
        },
      }));
    } finally {
      setAiCaptionLoading(false);
    }
  };

  const openBroadcast = (car) => {
    const name = [car.year, car.brand, car.model, car.variant]
      .filter(Boolean)
      .join(" ");
    const price = car.selling_price
      ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}`
      : null;
    const link = car.slug ? `https://xdrive.my/cars/${car.slug}?ref=${profile?.slug || ""}` : null;
    const msg = [
      `Hi! 👋 Tengok ni — ${name} dah ada dalam lineup kita!`,
      price ? `💰 Harga: ${price}` : null,
      `Kereta ni memang worth it — jangan sampai kena kebas orang lain 😬`,
      link ? `🔗 Details: ${link}` : null,
      `\nInterested? Whatsapp saya terus, boleh discuss!`,
    ]
      .filter(Boolean)
      .join("\n");
    setBroadcastCar(car);
    setBroadcastMsg(msg);
    setBroadcastProgress(null);
    setBroadcastDone(false);
  };

  const runBroadcast = (eligibleLeads) => {
    const msgSnapshot = broadcastMsg;
    const capped = eligibleLeads.slice(0, 10);
    broadcastCancelRef.current = false;
    setBroadcastProgress({ current: 0, total: capped.length });
    capped.forEach((lead, i) => {
      setTimeout(() => {
        if (broadcastCancelRef.current) return;
        const phone = (lead.phone || "").replace(/\D/g, "");
        if (phone) {
          window.open(
            `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${encodeURIComponent(msgSnapshot)}`,
            "_blank",
            "noopener,noreferrer",
          );
        }
        setBroadcastProgress({ current: i + 1, total: capped.length });
        if (i === capped.length - 1) setBroadcastDone(true);
      }, i * 600);
    });
  };

  // ── TABS ──────────────────────────────────────────────────────────────────

  const TABS_DESKTOP = [
    {
      tab: "dashboard",
      label: "Dashboard",
      icon: <LayoutGrid style={{ width: 14, height: 14 }} />,
    },
    {
      tab: "listings",
      label: "My Listings",
      icon: <Car style={{ width: 14, height: 14 }} />,
      badge: myListings.length || null,
    },
    {
      tab: "leads",
      label: "Leads",
      icon: <User style={{ width: 14, height: 14 }} />,
      badge: leads.filter((l) => l.stage !== "lost").length || null,
    },
    {
      tab: "enquiries",
      label: "Inbox",
      icon: <MessageSquare style={{ width: 14, height: 14 }} />,
      badge: (enquiries.filter((e) => e.status === "new").length + newBookingsCount) || null,
    },
    {
      tab: "performance",
      label: "Performance",
      icon: <BarChart2 style={{ width: 14, height: 14 }} />,
    },
    {
      tab: "merge",
      label: "Join Dealership",
      icon: <GitMerge style={{ width: 14, height: 14 }} />,
    },
    {
      tab: "settings",
      label: "Settings",
      icon: <Settings style={{ width: 14, height: 14 }} />,
    },
  ];

  const TABS_MOBILE = [
    { tab: "dashboard", label: "Dashboard", icon: <LayoutGrid size={18} /> },
    {
      tab: "listings",
      label: "Listings",
      icon: <Car size={18} />,
      badge: myListings.length || null,
    },
    {
      tab: "leads",
      label: "Leads",
      icon: <User size={18} />,
      badge: leads.filter((l) => l.stage !== "lost").length || null,
    },
    {
      tab: "enquiries",
      label: "Inbox",
      icon: <MessageSquare size={18} />,
      badge: (enquiries.filter((e) => e.status === "new").length + newBookingsCount) || null,
    },
    { tab: "performance", label: "Stats", icon: <BarChart2 size={18} /> },
    { tab: "merge", label: "Merge", icon: <GitMerge size={18} /> },
    { tab: "settings", label: "Settings", icon: <Settings size={18} /> },
  ];

  // ── NOTIFICATION PANEL ────────────────────────────────────────────────────

  const renderNotifPanel = () =>
    notifOpen && (
      <div
        onClick={() => setNotifOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 998,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={isMobile ? {
            position: "fixed",
            bottom: 0, left: 0, right: 0,
            maxHeight: "70dvh",
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "16px 16px 0 0",
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
          } : {
            position: "fixed",
            top: 58,
            right: 24,
            width: 320,
            maxHeight: 420,
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: "#f1f5f9",
              }}
            >
              Notifications{" "}
              {unreadCount > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    background: "#ef4444",
                    color: "#fff",
                    borderRadius: 99,
                    padding: "1px 6px",
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </p>
            {unreadCount > 0 && (
              <button
                onClick={markAllNotifsRead}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 10,
                  color: "#60a5fa",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.length === 0 && (
              <p
                style={{
                  margin: 0,
                  padding: "24px 16px",
                  fontSize: 12,
                  color: "#4b5563",
                  textAlign: "center",
                }}
              >
                No notifications yet.
              </p>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markNotifRead(n)}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: n.is_read
                    ? "transparent"
                    : "rgba(96,165,250,0.06)",
                  cursor: "pointer",
                }}
              >
                <p
                  style={{
                    margin: "0 0 2px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: n.is_read ? "#9ca3af" : "#f1f5f9",
                  }}
                >
                  {n.title}
                </p>
                {n.body && (
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: 11,
                      color: "#4b5563",
                    }}
                  >
                    {n.body}
                  </p>
                )}
                <p style={{ margin: 0, fontSize: 10, color: "#374151" }}>
                  {timeAgo(n.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

  // ── Memoised dashboard analytics (avoids recompute on every render) ─────────
  const listingStats = useMemo(() => {
    // pre-group events by car_id for O(1) lookup — avoids O(n×m) filter per listing
    const evtsByCarId = new Map();
    for (const e of analyticsEvents) {
      if (!e.car_id) continue;
      if (!evtsByCarId.has(e.car_id)) evtsByCarId.set(e.car_id, []);
      evtsByCarId.get(e.car_id).push(e);
    }
    const enqByListingId = new Map();
    for (const e of enquiries) {
      if (!e.listing_id) continue;
      enqByListingId.set(e.listing_id, (enqByListingId.get(e.listing_id) || 0) + 1);
    }
    return myListings.map((car) => {
      const carEvts = evtsByCarId.get(car.id) || [];
      const viewSessions = new Set(carEvts.filter((e) => ["car_view", "link_visit"].includes(e.event_type)).map((e) => e.session_id || e.car_id));
      const waSessions = new Set(carEvts.filter((e) => ["whatsapp_click", "call_click"].includes(e.event_type)).map((e) => e.session_id || e.car_id));
      const views = viewSessions.size;
      const waTaps = waSessions.size;
      const enqCount = enqByListingId.get(car.id) || 0;
      const cvr = views > 0 ? (waTaps / views) * 100 : null;
      return { car, views, waTaps, enqCount, cvr };
    });
  }, [myListings, analyticsEvents, enquiries]);

  const dashboardCVR = useMemo(() => {
    const totalViews = new Set(analyticsEvents.filter((e) => ["car_view", "link_visit"].includes(e.event_type)).map((e) => e.session_id || e.car_id)).size;
    const totalWATaps = new Set(analyticsEvents.filter((e) => ["whatsapp_click", "call_click"].includes(e.event_type)).map((e) => e.session_id || e.car_id)).size;
    const overallCVR = totalViews > 0 ? ((totalWATaps / totalViews) * 100).toFixed(1) : null;
    const bestCVRStat = listingStats.reduce((best, s) => (s.cvr !== null && (best === null || s.cvr > best.cvr)) ? s : best, null);
    return { totalViews, totalWATaps, overallCVR, bestCVRStat };
  }, [analyticsEvents, listingStats]);

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
    const wonLeads = leads.filter((l) => l.stage === "won" || l.stage === "closed_won");
    const todayAppts = appointments.filter((a) => {
      if (!a.appointment_date) return false;
      const d = new Date(a.appointment_date);
      if (isNaN(d)) return false;
      const today = new Date();
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }).length;
    const { totalViews, totalWATaps, overallCVR, bestCVRStat } = dashboardCVR;
    const cvrColor = (cvr) => cvr >= 10 ? "#22c55e" : cvr >= 5 ? "#eab308" : "#ef4444";
    const perfCarName = (car) => [car.year, car.brand, car.model].filter(Boolean).join(" ");
    const isNewUser = myListings.length === 0 && leads.length === 0;

    const STEP_CIRCLE = (done) => ({
      width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 700,
      background: done ? "rgba(34,197,94,0.15)" : "rgba(220,38,38,0.12)",
      border: done ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(220,38,38,0.2)",
      color: done ? "#22c55e" : "#ef4444",
    });

    // Today's agenda items
    const todayStr = new Date().toISOString().slice(0, 10);
    const agendaAppts = appointments.filter((a) => a.appointment_date?.slice(0, 10) === todayStr);
    const agendaFollowUps = leads.filter((l) => l.follow_up_at?.slice(0, 10) === todayStr && !["won","lost","closed_won","closed_lost"].includes(l.stage));
    const agendaStale = staleLeads.filter((l) => !l.follow_up_at);
    const hasAgenda = agendaAppts.length > 0 || agendaFollowUps.length > 0 || agendaStale.length > 0;

    // Goal panel data
    const soldThisMonth = myListings.filter(c => {
      if (c.status !== "sold" || !c.sold_at) return false;
      const d = new Date(c.sold_at);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    const available = myListings.filter(c => c.status === "available");
    const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
    const pct = goal.target > 0 ? Math.min((soldThisMonth / goal.target) * 100, 100) : 0;
    const focusCar = goal.focusCarId ? myListings.find(c => c.id === goal.focusCarId && c.status === "available") : null;
    const autoFocus = !focusCar && available.length > 0
      ? available.reduce((best, c) => {
          const s = listingStats[c.id] || {};
          const score = (s.views || 0) * 2 + (s.enquiries || 0) * 5;
          const bestScore = (listingStats[best?.id]?.views || 0) * 2 + (listingStats[best?.id]?.enquiries || 0) * 5;
          return score > bestScore ? c : best;
        }, available[0])
      : null;
    const highlighted = focusCar || autoFocus;

    // SVG ring
    const R = 44, STROKE = 6, CIRC = 2 * Math.PI * R;

    // Shared card style
    const CARD = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" };
    const CARD_HEADER = {
      padding: "13px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
      fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Greeting ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.3px" }}>
              {(() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })()}, {profile?.full_name?.split(" ")[0] || "there"}.
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#475569" }}>
              {new Date().toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          {staleLeads.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 99, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#ef4444" }}>{staleLeads.length} overdue</span>
            </div>
          )}
        </div>

        {/* ── KPI strip ── */}
        <div style={{ ...CARD, overflow: "visible" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(5,1fr)" }}>
            {[
              { label: "Pipeline", value: activeLeads.length, accent: "#3b82f6", first: true },
              { label: "Live Listings", value: myListings.filter(c => c.status === "available").length, accent: "#22c55e" },
              { label: "Follow-ups", value: staleLeads.length, accent: staleLeads.length > 0 ? "#ef4444" : "#475569" },
              { label: "Today's Appts", value: todayAppts, accent: "#3b82f6" },
              { label: "Closed", value: wonLeads.length, accent: "#22c55e" },
            ].map(({ label, value, accent, first }, i, arr) => (
              <div key={label} style={{
                padding: "18px 20px", position: "relative",
                borderRight: !isMobile && i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                borderBottom: isMobile && i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}>
                {first && <div style={{ position: "absolute", left: 0, top: "22%", bottom: "22%", width: 3, borderRadius: "0 3px 3px 0", background: "#3b82f6" }} />}
                <p style={{ margin: "0 0 5px", fontSize: 28, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</p>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Goal + Marketplace Pulse ── */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "3fr 2fr", gap: 16 }}>
          {/* Goal */}
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span>Monthly Goal</span>
              <span>{daysLeft}d left in {new Date().toLocaleDateString("en-MY",{month:"short"})}</span>
            </div>
            <div style={{ padding: 18 }}>
              {goalEditing ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Target:</span>
                  <input type="number" min="1" max="99" value={goalDraft} onChange={e => setGoalDraft(Number(e.target.value))}
                    style={{ width: 60, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 8px", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }} autoFocus />
                  <span style={{ fontSize: 12, color: "#6b7280" }}>cars</span>
                  <button onClick={() => { saveGoal({ target: goalDraft }); setGoalEditing(false); }} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "#dc2626", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>Set</button>
                  <button onClick={() => setGoalEditing(false)} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                </div>
              ) : goal.target > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  {/* SVG ring */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <svg width={100} height={100} style={{ transform: "rotate(-90deg)" }}>
                      <circle cx={50} cy={50} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} />
                      <circle cx={50} cy={50} r={R} fill="none"
                        stroke={pct >= 100 ? "#22c55e" : pct >= 60 ? "#3b82f6" : "#ef4444"}
                        strokeWidth={STROKE} strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct / 100)}
                        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#f1f5f9", lineHeight: 1 }}>{Math.round(pct)}%</p>
                      <p style={{ margin: 0, fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>done</p>
                    </div>
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.04em", lineHeight: 1 }}>
                      {soldThisMonth}<span style={{ fontSize: 16, color: "#475569", fontWeight: 500 }}> / {goal.target}</span>
                    </p>
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: "#475569" }}>cars sold this month</p>
                    {pct >= 100
                      ? <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#22c55e" }}>🎉 Goal smashed!</p>
                      : <p style={{ margin: "0 0 8px", fontSize: 11, color: "#475569" }}>{goal.target - soldThisMonth} more · {daysLeft > 0 ? `~${((goal.target - soldThisMonth) / daysLeft).toFixed(1)}/day` : "last day!"}</p>
                    }
                    <button onClick={() => { setGoalDraft(goal.target); setGoalEditing(true); }} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#475569", cursor: "pointer", fontFamily: "inherit" }}>Edit target</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setGoalDraft(5); setGoalEditing(true); }} style={{ width: "100%", padding: "14px", borderRadius: 10, background: "rgba(220,38,38,0.06)", border: "1px dashed rgba(220,38,38,0.2)", color: "#ef4444", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  + Set a monthly target
                </button>
              )}

              {/* Focus car */}
              {highlighted && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ margin: 0, fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                      {focusCar ? "📌 Pinned" : "⚡ Best to push"}
                    </p>
                    {focusCar && (
                      <button onClick={() => saveGoal({ focusCarId: null })} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#475569", cursor: "pointer", fontFamily: "inherit" }}>Unpin</button>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {highlighted.images?.[0] ? (
                      <img src={highlighted.images[0]} alt="" style={{ width: 52, height: 40, objectFit: "cover", borderRadius: 8, flexShrink: 0, border: "1px solid rgba(255,255,255,0.06)" }} />
                    ) : (
                      <div style={{ width: 52, height: 40, borderRadius: 8, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Car size={18} color="#374151" /></div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[highlighted.year, highlighted.brand, highlighted.model].filter(Boolean).join(" ")}
                      </p>
                      <p style={{ margin: "1px 0 0", fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>
                        {highlighted.selling_price ? `RM ${Number(highlighted.selling_price).toLocaleString("en-MY")}` : "—"}
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => handleListingCopy(highlighted, "wa")} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>WA</button>
                      {!focusCar && (
                        <button onClick={() => saveGoal({ focusCarId: highlighted.id })} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#475569", cursor: "pointer", fontFamily: "inherit" }}>Pin</button>
                      )}
                    </div>
                  </div>
                  {available.length > 1 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                      {available.filter(c => c.id !== highlighted.id).slice(0, 4).map(c => (
                        <button key={c.id} onClick={() => saveGoal({ focusCarId: c.id })} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#475569", cursor: "pointer", fontFamily: "inherit", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.brand} {c.model}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Marketplace Pulse */}
          {myListings.filter(c => c.status === "available").length > 0 && (
            <div style={CARD}>
              <div style={CARD_HEADER}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "live-glow 2s ease-in-out infinite" }} />
                  <span>Live</span>
                </div>
                <span>30 days</span>
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
                  {[
                    { label: "Buyer Views", value: totalViews || 0 },
                    { label: "WA Taps", value: totalWATaps || 0, green: true },
                    { label: "Live Listings", value: myListings.filter(c => c.status === "available").length },
                  ].map(({ label, value, green }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <p style={{ margin: 0, fontSize: 12, color: "#475569" }}>{label}</p>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: green ? "#22c55e" : "#f1f5f9", letterSpacing: "-0.03em" }}>{value}</p>
                    </div>
                  ))}
                </div>
                {profile?.slug && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(`https://xdrive.my/s/${profile.slug}`); toast.success("Store link copied — share it with buyers!"); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", fontSize: 11, padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#94a3b8", cursor: "pointer", fontWeight: 500, fontFamily: "inherit" }}
                  >
                    <LinkIcon size={11} />
                    <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>xdrive.my/s/{profile.slug}</span>
                    <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>Copy</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Follow-up Needed ── */}
        {staleLeads.length > 0 && (
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
                <span>Follow-up Needed</span>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, borderRadius: 99, background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 10, fontWeight: 800, padding: "0 5px" }}>{staleLeads.length}</span>
              </div>
              {staleLeads.some(l => l.phone) && (
                <button onClick={() => { setBatchWALeads(staleLeads.filter(l => l.phone)); setBatchWAIdx(0); }}
                  style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e", cursor: "pointer", fontWeight: 700, fontFamily: "inherit", textTransform: "none", letterSpacing: 0 }}>
                  WA All
                </button>
              )}
            </div>
            <div>
              {staleLeads.map((lead, i) => {
                const car = lead.car_listings;
                const daysSince = Math.floor((Date.now() - new Date(lead.updated_at)) / 86400000);
                return (
                  <div key={lead.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: i < staleLeads.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: i % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#94a3b8", flexShrink: 0 }}>
                      {(lead.buyer_name || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.buyer_name || "—"}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>{car ? `${car.brand} ${car.model}` : "No car"}</p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 99, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", flexShrink: 0 }}>{daysSince}d ago</span>
                    {lead.phone && (
                      <button onClick={() => pingWA(lead)} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 7, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e", cursor: "pointer", fontWeight: 600, flexShrink: 0, fontFamily: "inherit" }}>WA</button>
                    )}
                  </div>
                );
              })}
            </div>
            {!notifBannerDismissed && browserNotifPerm === 'default' && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
                <p style={{ margin: 0, fontSize: 11, color: "#475569", flex: 1 }}>Get notified when leads go cold</p>
                <button onClick={requestBrowserNotif} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Enable</button>
                <button onClick={dismissNotifBanner} style={{ fontSize: 14, padding: "0 4px", background: "none", border: "none", color: "#374151", cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
            )}
          </div>
        )}

        {/* ── Today's Agenda ── */}
        {hasAgenda && (
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span>Today's Agenda</span>
              <span>{new Date().toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })}</span>
            </div>
            <div style={{ padding: "6px 0" }}>
              {agendaAppts.map((a) => (
                <div key={a.id} onClick={() => setActiveTab("bookings")} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6", flexShrink: 0, boxShadow: "0 0 0 3px rgba(59,130,246,0.15)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{a.buyer_name || "—"}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>Test drive</p>
                  </div>
                  <span style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600, flexShrink: 0 }}>{a.appointment_date ? new Date(a.appointment_date).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                </div>
              ))}
              {agendaFollowUps.map((l) => (
                <div key={l.id} onClick={() => setActiveTab("leads")} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#eab308", flexShrink: 0, boxShadow: "0 0 0 3px rgba(234,179,8,0.15)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{l.buyer_name || "—"}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>Scheduled follow-up · {l.car_listings ? `${l.car_listings.brand} ${l.car_listings.model}` : "no car"}</p>
                  </div>
                  <span style={{ fontSize: 11, color: "#eab308", fontWeight: 600, flexShrink: 0 }}>Today</span>
                </div>
              ))}
              {agendaStale.slice(0, 3).map((l) => (
                <div key={l.id} onClick={() => pingWA(l)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", cursor: "pointer" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", flexShrink: 0, boxShadow: "0 0 0 3px rgba(239,68,68,0.15)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{l.buyer_name || "—"}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>No contact · {timeAgo(l.updated_at)}</p>
                  </div>
                  <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600, flexShrink: 0 }}>WA</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── This Month Analytics ── */}
        {commissionData.count > 0 && (
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span>This Month</span>
              <span>{commissionData.count} deal{commissionData.count !== 1 ? "s" : ""} closed</span>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: "0 0 2px", fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>Net Profit</p>
                <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: commissionData.total >= 0 ? "#22c55e" : "#ef4444", letterSpacing: "-0.04em", lineHeight: 1 }}>
                  RM {commissionData.total.toLocaleString("en-MY")}
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
                {[
                  { label: "Revenue", value: commissionData.revenue, color: "#3b82f6" },
                  { label: "Purchase Cost", value: commissionData.purchase, color: "#94a3b8" },
                  { label: "Recon Cost", value: commissionData.recon, color: "#94a3b8" },
                  { label: "Services", value: commissionData.services, color: "#94a3b8" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: "12px 14px", background: "#0d1117" }}>
                    <p style={{ margin: "0 0 3px", fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color }}>{value > 0 ? `RM ${value.toLocaleString("en-MY")}` : "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── My Performance ── */}
        <div style={CARD}>
          <div style={CARD_HEADER}>
            <span>My Performance</span>
            <span>30 days</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              { label: "Views", value: totalViews || 0 },
              { label: "WA Taps", value: totalWATaps || 0 },
              { label: "CVR", value: overallCVR !== null ? `${overallCVR}%` : "—" },
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{ padding: "16px 18px", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <p style={{ margin: "0 0 4px", fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
                <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</p>
              </div>
            ))}
          </div>
          {listingStats.length > 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 50px 50px 70px", padding: "8px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["Listing", "Views", "WA", "CVR"].map((h, i) => (
                  <p key={h} style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: i > 0 ? "center" : "left" }}>{h}</p>
                ))}
              </div>
              {[...listingStats].sort((a, b) => (b.cvr ?? -1) - (a.cvr ?? -1)).map(({ car, views, waTaps, cvr }, idx, arr) => {
                const isHot = views > 20 && cvr >= 10;
                const isWarm = !isHot && views > 5 && cvr >= 5;
                return (
                  <div key={car.id} style={{ display: "grid", gridTemplateColumns: "1fr 50px 50px 70px", padding: "11px 18px", alignItems: "center", borderBottom: idx < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: idx % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, color: "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{perfCarName(car)}</p>
                      {isHot && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", flexShrink: 0 }}>HOT</span>}
                      {isWarm && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(234,179,8,0.1)", color: "#eab308", border: "1px solid rgba(234,179,8,0.2)", flexShrink: 0 }}>WARM</span>}
                    </div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f1f5f9", textAlign: "center" }}>{views}</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f1f5f9", textAlign: "center" }}>{waTaps}</p>
                    <div style={{ textAlign: "center" }}>
                      {cvr !== null
                        ? <span style={{ fontSize: 11, fontWeight: 700, color: cvrColor(cvr) }}>{cvr.toFixed(1)}%</span>
                        : <span style={{ fontSize: 11, color: "#374151" }}>—</span>
                      }
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {listingStats.length === 0 && (
            <p style={{ margin: 0, padding: "16px 18px", fontSize: 12, color: "#475569" }}>No listing data yet — publish a car to start tracking.</p>
          )}
        </div>

        {/* ── Onboarding ── */}
        {isNewUser && !profile?.onboarding_tour_done && (
          <div style={{ ...CARD, border: "1px solid rgba(220,38,38,0.15)" }}>
            <div style={CARD_HEADER}><span>Get Started</span></div>
            <div style={{ padding: 18 }}>
              <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>Here's how to make your first sale:</p>
              {[
                { num: 1, done: myListings.length > 0, title: "Add your first listing", sub: "Upload photos, set price, publish to XDrive marketplace.", ctaLabel: "Add Listing →", ctaAction: () => { switchTab("listings"); setTimeout(() => setShowAddForm(true), 100); }, locked: false },
                { num: 2, done: myListings.length > 0, title: "Share your listing link", sub: "Blast it on WhatsApp groups, Facebook, TikTok.", ctaLabel: "Go to Listings →", ctaAction: () => switchTab("listings"), locked: myListings.length === 0 },
                { num: 3, done: leads.length > 0, title: "Track your leads", sub: "Every enquiry auto-converts to a lead.", ctaLabel: "View Pipeline →", ctaAction: () => switchTab("leads"), locked: myListings.length === 0 },
              ].map((step, idx) => (
                <div key={step.num}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: idx > 0 ? "14px 0 0" : "0" }}>
                    <div style={STEP_CIRCLE(step.done)}>{step.done ? "✓" : step.num}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{step.title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{step.sub}</p>
                    </div>
                    {step.locked
                      ? <span style={{ fontSize: 10, color: "#374151", flexShrink: 0, paddingTop: 3 }}>Step 1 first</span>
                      : <button onClick={step.ctaAction} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 7, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", color: "#ef4444", cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>{step.ctaLabel}</button>
                    }
                  </div>
                  {idx < 2 && <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "14px 0 0" }} />}
                </div>
              ))}
              <button onClick={dismissTour} style={{ marginTop: 16, background: "none", border: "none", color: "#374151", fontSize: 10, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Dismiss</button>
            </div>
          </div>
        )}

        {/* ── Upgrade nudge ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 18px", ...CARD }}>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Join a dealership</p>
            <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>Get an invite code from your dealer to unlock the full panel.</p>
          </div>
          <button onClick={() => setActiveTab("merge")} style={{ fontSize: 11, padding: "8px 16px", borderRadius: 8, background: "#dc2626", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap", fontFamily: "inherit" }}>
            Enter Code →
          </button>
        </div>

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
    const FUNNEL_LABELS = { new:"New", contacted:"Contacted", viewing_booked:"Viewing", test_drive:"Test Drive", negotiating:"Negotiating", deposit_taken:"Deposit" };

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
      type: "warn",
      icon: <Clock size={14} />,
      title: `${staleCount} lead${staleCount !== 1 ? "s" : ""} need follow-up now`,
      body: `You haven't contacted ${staleCount} lead${staleCount !== 1 ? "s" : ""} in over 48 hours. A quick WhatsApp message today keeps deals alive — most buyers go cold within 72 hours of first enquiry.`,
      cta: "Go to Leads",
      ctaAction: () => setActiveTab("leads"),
    });
    if (leadsWithNoFollowUp > 2) nudges.push({
      type: "warn",
      icon: <Target size={14} />,
      title: `${leadsWithNoFollowUp} leads have no follow-up date set`,
      body: `Set a follow-up date on each lead so you never forget to reach out. Salesmen who schedule follow-ups close 2× more deals than those who don't.`,
      cta: "Set follow-ups",
      ctaAction: () => setActiveTab("leads"),
    });
    if (contactedThisWeek === 0 && activeLeads.length > 0) nudges.push({
      type: "warn",
      icon: <Zap size={14} />,
      title: "No leads contacted this week",
      body: `You have ${activeLeads.length} active lead${activeLeads.length !== 1 ? "s" : ""} but haven't moved any forward this week. Even a 2-minute check-in message can re-spark a deal. Follow up every 2–3 days to stay top of mind.`,
      cta: "Contact leads",
      ctaAction: () => setActiveTab("leads"),
    });
    if (closeRate !== null && closeRate < 20 && closedLeads.length >= 3) nudges.push({
      type: "tip",
      icon: <TrendingUp size={14} />,
      title: `Your close rate is ${closeRate}% — here's how to improve it`,
      body: `Top salesmen close 30–50% of qualified leads. Focus on leads in the Negotiating and Deposit stages first. Ask buyers what's stopping them and address it directly.`,
      cta: null,
    });
    if (avgDaysToClose !== null && avgDaysToClose > 21) nudges.push({
      type: "tip",
      icon: <Clock size={14} />,
      title: `Your average deal takes ${avgDaysToClose} days to close`,
      body: `Deals that go past 3 weeks often stall. Create urgency — remind buyers about limited stock, upcoming price changes, or offer a test drive to speed up decisions.`,
      cta: null,
    });
    if (nudges.length === 0 && wonLeads.length > 0) nudges.push({
      type: "good",
      icon: <Award size={14} />,
      title: "You're on track — keep the momentum",
      body: `${wonLeads.length} deal${wonLeads.length !== 1 ? "s" : ""} closed and ${activeLeads.length} still in pipeline. Keep following up every 2–3 days and you'll stay ahead.`,
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
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.3px" }}>Your Performance</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#475569" }}>Close rate, pipeline health, follow-up habits — all in one place.</p>
        </div>

        {/* ── Coaching nudges ── */}
        {nudges.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {nudges.map((n, i) => {
              const c = nudgeColor[n.type];
              return (
                <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: c.icon, flexShrink: 0 }}>{n.icon}</span>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: c.title }}>{n.title}</p>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>{n.body}</p>
                  {n.cta && (
                    <button onClick={n.ctaAction} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>{n.cta} →</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Close Rate ── */}
        <div style={CARD}>
          <div style={CARD_HEADER}>
            <span>Close Rate</span>
            <span>all time</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)" }}>
            {[
              { label: "Total Leads", value: allLeads.length, note: "ever created" },
              { label: "Closed Won", value: wonLeads.length, note: "deals done", color: "#22c55e" },
              { label: "Closed Lost", value: lostLeads.length, note: "didn't convert", color: "#ef4444" },
              { label: "Close Rate", value: closeRate !== null ? `${closeRate}%` : "—", note: "won ÷ (won+lost)", color: closeRate === null ? "#475569" : closeRate >= 40 ? "#22c55e" : closeRate >= 20 ? "#eab308" : "#ef4444" },
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
            <span style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>This Month</span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{monthLeads.length} new leads</span>
            <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{monthWon.length} won</span>
            {monthCloseRate !== null && <span style={{ fontSize: 12, color: monthCloseRate >= 30 ? "#22c55e" : "#eab308", fontWeight: 700 }}>{monthCloseRate}% close rate</span>}
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{weekLeads.length} leads this week</span>
          </div>
        </div>

        {/* ── Pipeline Funnel ── */}
        <div style={CARD}>
          <div style={CARD_HEADER}>
            <span>Pipeline Funnel</span>
            <span>{activeLeads.length} active</span>
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
              <p style={{ margin: 0, fontSize: 11, color: "#475569", width: isMobile ? 76 : 100, flexShrink: 0, textAlign: "right" }}>Won</p>
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
            <span>Follow-up Habits</span>
            <span>7 days</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)" }}>
            {[
              { label: "Active Leads", value: activeLeads.length, note: "in pipeline now" },
              { label: "Contacted This Week", value: contactedThisWeek, note: "leads updated", color: contactedThisWeek > 0 ? "#22c55e" : "#ef4444" },
              { label: "No Follow-up Set", value: leadsWithNoFollowUp, note: "no date scheduled", color: leadsWithNoFollowUp > 0 ? "#ef4444" : "#22c55e" },
              { label: "Overdue", value: staleCount, note: "48h+ no contact", color: staleCount > 0 ? "#ef4444" : "#22c55e" },
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
              <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>You've done <strong>no follow-ups this week</strong>. You have {activeLeads.length} leads in pipeline — follow up every 2–3 days to close more deals.</p>
            </div>
          )}
          {activeLeads.length > 0 && contactedThisWeek > 0 && contactedThisWeek < activeLeads.length && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 18px", background: "rgba(234,179,8,0.03)" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#eab308" }}>You contacted {contactedThisWeek} of {activeLeads.length} leads this week. Try to touch every active lead at least once every 3 days.</p>
            </div>
          )}
        </div>

        {/* ── Speed to Close ── */}
        {(avgDaysToClose !== null || wonLeads.length > 0) && (
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span>Speed &amp; Conversion</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)" }}>
              {[
                { label: "Avg Days to Close", value: avgDaysToClose !== null ? `${avgDaysToClose}d` : "—", note: avgDaysToClose !== null ? (avgDaysToClose <= 14 ? "fast close" : avgDaysToClose <= 30 ? "normal pace" : "consider urgency tactics") : "close more deals to see this", color: avgDaysToClose === null ? "#475569" : avgDaysToClose <= 14 ? "#22c55e" : avgDaysToClose <= 30 ? "#eab308" : "#ef4444" },
                { label: "Deals Closed Total", value: wonLeads.length, note: "all time", color: wonLeads.length > 0 ? "#22c55e" : "#475569" },
                { label: "Active Pipeline", value: activeLeads.length, note: `${lostLeads.length} lost all time`, color: "#3b82f6" },
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
              <span>Lead Sources</span>
              <span>where buyers come from</span>
            </div>
            <div style={{ padding: "0" }}>
              {sources.map(([src, { total, won }], i) => {
                const srcRate = total > 0 ? Math.round((won / total) * 100) : 0;
                const srcLabels = { enquiry: "XDrive Enquiry", manual: "Manual Add", whatsapp: "WhatsApp", facebook: "Facebook", tiktok: "TikTok", referral: "Referral", other: "Other" };
                return (
                  <div key={src} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderBottom: i < sources.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: i % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{srcLabels[src] || src}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", maxWidth: 120 }}>
                          <div style={{ height: "100%", width: `${srcRate}%`, background: srcRate >= 30 ? "#22c55e" : srcRate >= 15 ? "#eab308" : "#3b82f6", borderRadius: 99 }} />
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>{srcRate}% close rate</p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{total}</p>
                      <p style={{ margin: 0, fontSize: 10, color: "#22c55e" }}>{won} won</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Lead Aging ── */}
        {leadAging.length > 0 && (
          <div style={CARD}>
            <div style={CARD_HEADER}>
              <span>Lead Aging</span>
              <span>oldest first</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px 60px", padding: "8px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {["Buyer", "Stage", "In Pipeline", "Action"].map((h, i) => (
                <p key={h} style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: i > 0 ? "center" : "left" }}>{h}</p>
              ))}
            </div>
            {leadAging.slice(0, 8).map((l, idx) => {
              const stageC = STAGE_COLOR[l.stage] || { bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)", tx: "#94a3b8" };
              const ageColor = l.days > 21 ? "#ef4444" : l.days > 10 ? "#eab308" : "#94a3b8";
              return (
                <div key={idx} onClick={() => setActiveTab("leads")} style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px 60px", padding: "11px 18px", alignItems: "center", borderBottom: idx < Math.min(leadAging.length, 8) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: idx % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent", cursor: "pointer" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</p>
                    {l.car && <p style={{ margin: 0, fontSize: 10, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.car.brand} {l.car.model}</p>}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: stageC.bg, border: `1px solid ${stageC.border}`, color: stageC.tx, textTransform: "capitalize" }}>{(l.stage || "new").replace(/_/g, " ")}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: ageColor, textAlign: "center" }}>{l.days}d</p>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 10, color: "#475569" }}>→ Leads</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Empty state ── */}
        {allLeads.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 32 }}>📊</p>
            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>No data yet</p>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#475569" }}>Add your first listing and start collecting leads to see your performance stats.</p>
            <button onClick={() => setActiveTab("listings")} style={{ fontSize: 12, padding: "8px 18px", borderRadius: 8, background: "#dc2626", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>Go to Listings →</button>
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

    const normStatus = (s) => s === "active" ? "available" : s;
    const filtered = enriched.filter((e) => normStatus(e.car.status || "available") === filterStatus);

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "price_desc") return (b.car.selling_price || 0) - (a.car.selling_price || 0);
      if (sortBy === "price_asc")  return (a.car.selling_price || 0) - (b.car.selling_price || 0);
      if (sortBy === "oldest")     return new Date(a.car.created_at) - new Date(b.car.created_at);
      return new Date(b.car.created_at) - new Date(a.car.created_at); // newest (default)
    });

    const SEL_STYLE = (active) => ({
      fontSize: 11,
      padding: "5px 11px",
      borderRadius: 7,
      cursor: "pointer",
      background: active ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.05)",
      border: active
        ? "1px solid rgba(220,38,38,0.3)"
        : "1px solid rgba(255,255,255,0.08)",
      color: active ? "#f87171" : "#6b7280",
      fontWeight: active ? 600 : 400,
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
              fontSize: 16,
              fontWeight: 600,
              color: "#f1f5f9",
            }}
          >
            My Listings ({myListings.length})
          </p>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#dc2626",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            <Plus size={13} /> {showAddForm ? "Cancel" : "Add Listing"}
          </button>
        </div>

        {/* Store exposure bar */}
        {!showAddForm && profile?.slug && myListings.filter(c => c.status === "available").length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px", padding: "7px 12px", borderRadius: 8, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.13)" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", flexShrink: 0, animation: "pulse-green 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 10, color: "#6b7280", flex: 1 }}>
              Your listings are <strong style={{ color: "#10b981" }}>live on XDrive</strong> — buyers can find you at xdrive.my/s/{profile.slug}
            </span>
            <button
              onClick={() => { navigator.clipboard.writeText(`https://xdrive.my/s/${profile.slug}`); toast.success("Link copied!"); }}
              style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "inherit" }}
            >
              Copy Link
            </button>
          </div>
        )}

        {/* Listing quality banner */}
        {!showAddForm && myListings.filter(c => c.status === "available").length > 0 && (() => {
          const scores = myListings.filter(c => c.status === "available").map(c => listingScore(c).pct);
          const avg = Math.round(scores.reduce((s, p) => s + p, 0) / scores.length);
          if (avg >= 80) return null;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px", padding: "9px 14px", borderRadius: 9, background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.15)" }}>
              <span style={{ fontSize: 13 }}>📊</span>
              <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", flex: 1 }}>Your listings average <strong style={{ color: "#fbbf24" }}>{avg}% quality</strong>. Complete listings get 3× more views.</p>
            </div>
          );
        })()}

        {showAddForm && (
          <div
            style={{
              marginBottom: 24,
              background: "#0d1117",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <CarForm
              onCreate={(car) => {
                setMyListings((p) => [car, ...p]);
                setShowAddForm(false);
                toast.success("Listing published!");
              }}
            />
          </div>
        )}

        {myListings.length > 0 && !showAddForm && (
          <>
            {/* Status tabs — same pattern as DashboardPage listings panel */}
            <div
              style={{
                display: "flex",
                gap: 0,
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                marginBottom: 0,
              }}
            >
              {[
                { key: "available", label: "Available", count: myListings.filter((c) => (c.status || "available") === "available").length },
                { key: "reserved",  label: "Reserved", count: myListings.filter((c) => c.status === "reserved").length },
                { key: "sold",      label: "Sold",     count: myListings.filter((c) => c.status === "sold").length },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilterStatus(key)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: filterStatus === key ? 600 : 400,
                    fontFamily: "'DM Sans', sans-serif",
                    color: filterStatus === key ? "#f9fafb" : "#4b5563",
                    borderBottom: filterStatus === key ? "2px solid #dc2626" : "2px solid transparent",
                    marginBottom: -1,
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    transition: "color 0.15s",
                  }}
                >
                  {label}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "1px 7px",
                      borderRadius: 4,
                      lineHeight: 1.6,
                      background: filterStatus === key ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.04)",
                      color: filterStatus === key ? "#f87171" : "#374151",
                    }}
                  >
                    {count}
                  </span>
                </button>
              ))}

              {/* Hot / stale pills pushed to the right */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, paddingRight: 4 }}>
                {hotCount > 0 && (
                  <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>🔥 {hotCount} hot</span>
                )}
                {staleCount > 0 && (
                  <span style={{ fontSize: 11, color: "#6b7280" }}>💤 {staleCount} stale</span>
                )}
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
              <span style={{ fontSize: 11, color: "#4b5563", marginRight: 2 }}>Sort:</span>
              <button style={SEL_STYLE(sortBy === "newest")} onClick={() => setSortBy("newest")}>Newest</button>
              <button style={SEL_STYLE(sortBy === "price_desc")} onClick={() => setSortBy("price_desc")}>Price ↓</button>
              <button style={SEL_STYLE(sortBy === "price_asc")} onClick={() => setSortBy("price_asc")}>Price ↑</button>
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
              background: "#0d1117",
              border: "1px dashed rgba(255,255,255,0.1)",
              borderRadius: 14,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Car size={24} color="#374151" />
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 600,
                color: "#4b5563",
              }}
            >
              No listings yet
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "#374151",
                textAlign: "center",
                maxWidth: 260,
                lineHeight: 1.6,
              }}
            >
              Add your first car using the button above.
            </p>
            <button
              onClick={() => setEditListing({})}
              style={{ marginTop: 14, fontSize: 13, fontWeight: 600, padding: "9px 20px", borderRadius: 9, background: "#dc2626", border: "none", color: "#fff", cursor: "pointer" }}
            >
              + Add Listing
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 0",
              color: "#374151",
              fontSize: 13,
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
            {sorted.map(({ car, views, enqs, daily, cvr, isHot, isStale }) => {
              const isSold     = car.status === "sold";
              const isReserved = car.status === "reserved";
              const cvrFill    = cvr !== null ? Math.min(cvr * 10, 100) : 0;
              const img  = car.images?.[0];
              const name = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
              const price = car.selling_price
                ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}`
                : "—";
              const cvrLabel   = cvr !== null ? cvr.toFixed(1) : "0";
              const isHovering = cvrHover === car.id;
              const openDetail = () => { setSelectedCar(car); setCarDetailImgIdx(0); setCarDetailTab("specs"); };
              return (
                <div
                  key={car.id}
                  style={{
                    background: "#0d1117",
                    border: isSold
                      ? "1px solid rgba(255,255,255,0.04)"
                      : isReserved
                        ? "1px solid rgba(251,191,36,0.22)"
                        : "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12,
                    overflow: "hidden",
                    opacity: isSold ? 0.62 : 1,
                    transition: "opacity 0.2s",
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
                        background: "rgba(255,255,255,0.04)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        filter: isSold ? "grayscale(0.75) brightness(0.6)" : "none",
                      }}
                    >
                      <Car size={32} color="#374151" />
                    </div>
                  )}

                  {/* Sold stamp overlay bar */}
                  {isSold && (
                    <div style={{
                      background: "rgba(107,114,128,0.18)",
                      borderBottom: "1px solid rgba(107,114,128,0.2)",
                      padding: "5px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        ✓ Sold
                      </span>
                      {car.sold_at && (
                        <span style={{ fontSize: 10, color: "#4b5563" }}>
                          · {new Date(car.sold_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Reserved banner */}
                  {isReserved && (
                    <div style={{
                      background: "rgba(251,191,36,0.07)",
                      borderBottom: "1px solid rgba(251,191,36,0.15)",
                      padding: "5px 14px",
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        🔒 Reserved
                      </span>
                    </div>
                  )}

                  {/* Live on XDrive bar — only for available listings */}
                  {!isSold && !isReserved && (
                    <div style={{ background: "rgba(16,185,129,0.05)", borderBottom: "1px solid rgba(16,185,129,0.13)", padding: "4px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", flexShrink: 0, animation: "pulse-green 2s ease-in-out infinite" }} />
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase" }}>Live on XDrive</span>
                      <span style={{ marginLeft: "auto", fontSize: 9, color: "#374151" }}>{views > 0 ? `${views} view${views !== 1 ? "s" : ""}` : "accepting buyers"}</span>
                    </div>
                  )}

                  <div style={{ padding: "12px 14px" }}>
                    {/* Title + badge row */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                      <p
                        onClick={openDetail}
                        style={{
                          margin: 0,
                          fontSize: 13,
                          fontWeight: 600,
                          color: isSold ? "#6b7280" : "#e5e7eb",
                          lineHeight: 1.3,
                          flex: 1,
                          marginRight: 8,
                          cursor: "pointer",
                        }}
                      >
                        {name}
                      </p>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setStatusMenuCarId(statusMenuCarId === car.id ? null : car.id); }}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize cursor-pointer ${
                            ["available"].includes(car.status || "available") ? "bg-green-500/15 text-green-400 border-green-500/30" :
                            car.status === "reserved" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" :
                            car.status === "sold" ? "bg-gray-700 text-gray-400 border-gray-600" :
                            "bg-gray-700 text-gray-400 border-gray-600"
                          }`}
                        >
                          {car.status || "available"} ▾
                        </button>
                        {statusMenuCarId === car.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50, background: "#1e2433", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, overflow: "hidden", minWidth: 110, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
                          >
                            {[
                              { key: "available", label: "Available", color: "#4ade80" },
                              { key: "reserved",  label: "Reserved",  color: "#fbbf24" },
                              { key: "sold",      label: "Sold",      color: "#9ca3af" },
                            ].map(({ key, label, color }) => (
                              <button
                                key={key}
                                onClick={() => updateListingStatus(car, key)}
                                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: normStatus(car.status || "available") === key ? "rgba(255,255,255,0.06)" : "none", border: "none", cursor: "pointer", textAlign: "left" }}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: normStatus(car.status || "available") === key ? "#f1f5f9" : "#6b7280", fontWeight: normStatus(car.status || "available") === key ? 600 : 400 }}>{label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Price */}
                    <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: isSold ? "#4b5563" : "#60a5fa" }}>
                      {price}
                    </p>

                    {/* Meta */}
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: "#4b5563" }}>
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
                      const barColor = pct >= 70 ? "#fbbf24" : "#f87171";
                      return (
                        <div style={{ marginBottom: 8 }} title={missing.length ? `Improve: ${missing.join(", ")}` : ""}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 9, color: "#4b5563" }}>Listing quality</span>
                            <span style={{ fontSize: 9, color: barColor, fontWeight: 600 }}>{pct}%</span>
                          </div>
                          <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 99 }} />
                          </div>
                          {missing.length > 0 && (
                            <p style={{ margin: "3px 0 0", fontSize: 9, color: "#374151" }}>+ {missing[0]}</p>
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
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: "#4b5563" }}>
                            {views} views · {enqs} enquiries
                          </span>
                          {isHot && <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>🔥 Hot</span>}
                          {isStale && !isHot && <span style={{ fontSize: 10, color: "#6b7280" }}>💤 Stale</span>}
                        </div>
                        <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "visible" }}>
                          <div style={{ height: "100%", width: `${cvrFill}%`, background: isHot ? "#ef4444" : "#4b5563", borderRadius: 99, transition: "width 0.3s" }} />
                        </div>
                        {isHovering && (
                          <div style={{
                            position: "absolute", bottom: "calc(100% + 6px)", left: 0,
                            background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 7, padding: "5px 10px", fontSize: 11, color: "#e2e8f0",
                            whiteSpace: "nowrap", zIndex: 10, pointerEvents: "none",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                          }}>
                            {views} views · {enqs} enquiries ·{" "}
                            <span style={{ color: isHot ? "#ef4444" : "#60a5fa", fontWeight: 600 }}>
                              {cvrLabel}% CVR
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 7-day sparkline */}
                    {!isSold && (() => {
                      const total = daily.reduce((s, v) => s + v, 0);
                      if (total === 0) return null;
                      const peak = Math.max(...daily, 1);
                      const days = ["M","T","W","T","F","S","S"];
                      return (
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 24, marginBottom: 10 }}>
                          {daily.map((v, i) => (
                            <div key={i} title={`${days[i]}: ${v} view${v !== 1 ? "s" : ""}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                              <div style={{ width: "100%", height: Math.max(2, Math.round((v / peak) * 18)), background: v > 0 ? "#3b82f6" : "rgba(255,255,255,0.06)", borderRadius: 2 }} />
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Photo nudge — fewer than 3 photos hurts views */}
                    {!isSold && (!car.images || car.images.length < 3) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, padding: "5px 8px", borderRadius: 6, background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.14)" }}>
                        <span style={{ fontSize: 11, flexShrink: 0 }}>📷</span>
                        <span style={{ fontSize: 10, color: "#d97706", flex: 1 }}>
                          Add {Math.max(0, 3 - (car.images?.length || 0))} more photo{Math.max(0, 3 - (car.images?.length || 0)) !== 1 ? "s" : ""} — listings with 3+ photos get 3× more views
                        </span>
                        <button onClick={() => setEditListing(car)} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 5, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap", fontFamily: "inherit" }}>Fix</button>
                      </div>
                    )}

                    {/* Action bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 10, marginTop: 2 }}>
                      {isSold ? (
                        <>
                          <button onClick={openDetail} style={{ flex: 1, fontSize: 11, padding: "6px 0", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>
                            View
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Copy link */}
                          <button
                            onClick={() => handleListingCopy(car, "link")}
                            title="Copy link"
                            style={{ flex: 1, fontSize: 11, padding: "6px 0", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: listingCopied[car.id] === "link" ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: listingCopied[car.id] === "link" ? "#4ade80" : "#9ca3af" }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            {listingCopied[car.id] === "link" ? "Copied" : "Link"}
                          </button>
                          {/* WA */}
                          <button
                            onClick={() => handleListingCopy(car, "wa")}
                            title="Copy WA caption"
                            style={{ flex: 1, fontSize: 11, padding: "6px 0", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: listingCopied[car.id] === "wa" ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", color: listingCopied[car.id] === "wa" ? "#4ade80" : "#6b9" }}
                          >
                            <MessageCircle size={11} />
                            {listingCopied[car.id] === "wa" ? "Copied" : "WA"}
                          </button>
                          {/* Boost */}
                          <button
                            onClick={() => { setBoostCarId(car.id); setBoostWaitlisted(false); }}
                            title="Boost listing"
                            style={{ flex: 1, fontSize: 11, padding: "6px 0", borderRadius: 7, background: "rgba(168,85,247,0.06)", border: "1px dashed rgba(168,85,247,0.25)", color: "#a78bfa", cursor: "pointer", opacity: 0.75, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}
                          >
                            ⚡ Boost
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => setEditListing(car)}
                            style={{ flex: 1, fontSize: 11, padding: "6px 0", borderRadius: 7, background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.18)", color: "#64b4ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                          >
                            <Pencil size={10} /> Edit
                          </button>
                        </>
                      )}

                      {/* ··· overflow */}
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActionMenuCarId(actionMenuCarId === car.id ? null : car.id); setConfirmDeleteId(null); }}
                          style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, letterSpacing: 1 }}
                        >
                          ···
                        </button>
                        {actionMenuCarId === car.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ position: "absolute", bottom: "calc(100% + 6px)", right: 0, zIndex: 60, background: "#141a26", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden", minWidth: 140, boxShadow: "0 8px 28px rgba(0,0,0,0.6)" }}
                          >
                            {!isSold && (
                              <>
                                <button onClick={() => { setQuickBriefCar(car); setBriefCopied(false); setActionMenuCarId(null); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 12, textAlign: "left" }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                  Brief
                                </button>
                                {!isReserved && (
                                  <button onClick={() => { openBroadcast(car); setActionMenuCarId(null); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", color: "#fb923c", fontSize: 12, textAlign: "left" }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/></svg>
                                    Broadcast
                                  </button>
                                )}
                                <button onClick={() => { generateAiCaptions(car); setActionMenuCarId(null); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", color: "#c084fc", fontSize: 12, textAlign: "left" }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                                  AI Caption
                                </button>
                                <button onClick={() => { setTiktokListing(car); setActionMenuCarId(null); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", color: "#f87171", fontSize: 12, textAlign: "left" }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.17 8.17 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>
                                  TikTok
                                </button>
                                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />
                              </>
                            )}
                            {confirmDeleteId === car.id ? (
                              <div style={{ padding: "8px 14px", display: "flex", gap: 6 }}>
                                <button onClick={() => handleDeleteListing(car.id)} style={{ flex: 1, fontSize: 11, padding: "5px 0", borderRadius: 6, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", cursor: "pointer", fontWeight: 700 }}>Delete</button>
                                <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, fontSize: 11, padding: "5px 0", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280", cursor: "pointer" }}>Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteId(car.id)} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 12, textAlign: "left" }}>
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

  // ── CAR DETAIL POPUP ──────────────────────────────────────────────────────

  const renderCarDetailPopup = () => {
    const car = selectedCar;
    if (!car) return null;
    const parseTags = (str) => {
      if (!str) return [];
      return str
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    };
    const images =
      Array.isArray(car.images) && car.images.length > 0 ? car.images : [];
    const sp = car.selling_price || 0;
    const op = car.original_price || null;
    const saving = op && op > sp ? op - sp : 0;
    const monthly =
      sp > 0 ? Math.round((sp * 0.9 * (1 + (3.5 / 100) * 7)) / (7 * 12)) : null;
    const stats = carStatsMap[car.id] ?? {};
    const views = stats.views || 0;
    const enqs = stats.enquiries || 0;
    const cvr = views > 0 ? ((enqs / views) * 100).toFixed(1) : null;
    const features = parseTags(car.features);
    const options = parseTags(car.options);

    const close = () => {
      setSelectedCar(null);
      setCarDetailImgIdx(0);
      setCarDetailTab("specs");
      setCarDetailLbOpen(false);
    };

    const navBtn = (side, onClick) => (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{
          position: "absolute",
          [side]: 8,
          top: "50%",
          transform: "translateY(-50%)",
          width: 30,
          height: 30,
          borderRadius: 6,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "#9ca3af",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {side === "left" ? (
          <ChevronLeft size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
      </button>
    );

    const actionBtn = (label, color, bg, border, onClick) => (
      <button
        onClick={onClick}
        style={{
          width: "100%",
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 6,
          padding: "10px 12px",
          fontSize: 12,
          fontWeight: 500,
          color,
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {label}
      </button>
    );

    return (
      <>
        <div
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.82)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              margin: isMobile ? 0 : "24px auto",
              maxWidth: isMobile ? "100vw" : 1000,
              width: isMobile ? "100vw" : "calc(100vw - 48px)",
              height: isMobile ? "100svh" : undefined,
              maxHeight: isMobile ? "100svh" : "calc(100vh - 48px)",
              background: "rgba(11,11,15,0.99)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: isMobile ? 0 : 8,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <button
              onClick={close}
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                zIndex: 10,
                width: 36,
                height: 36,
                borderRadius: 6,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#9ca3af",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>

            <div
              style={{
                display: "flex",
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              {/* LEFT — gallery + details */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: isMobile ? 16 : 24,
                  borderRight: isMobile
                    ? "none"
                    : "1px solid rgba(255,255,255,0.08)",
                  overflowY: isMobile ? "visible" : "auto",
                }}
              >
                {images.length > 0 ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <div
                      style={{
                        width: 60,
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                        maxHeight: isMobile ? 180 : 300,
                        overflowY: "auto",
                      }}
                    >
                      {images.map((img, i) => (
                        <div
                          key={i}
                          onClick={() => setCarDetailImgIdx(i)}
                          style={{
                            width: 60,
                            height: 44,
                            borderRadius: 4,
                            cursor: "pointer",
                            flexShrink: 0,
                            background: "#0d0d0d",
                            border:
                              i === carDetailImgIdx
                                ? "1px solid rgba(220,38,38,0.4)"
                                : "1px solid rgba(255,255,255,0.08)",
                            overflow: "hidden",
                            opacity: i === carDetailImgIdx ? 1 : 0.45,
                          }}
                        >
                          <img
                            src={img}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              display: "block",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        position: "relative",
                        background: "#0d0d0d",
                        borderRadius: 6,
                        overflow: "hidden",
                        height: isMobile ? 180 : 300,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={images[carDetailImgIdx]}
                        alt=""
                        onClick={() => setCarDetailLbOpen(true)}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                          cursor: "zoom-in",
                          display: "block",
                        }}
                      />
                      {images.length > 1 && (
                        <>
                          {navBtn("left", () =>
                            setCarDetailImgIdx(
                              (i) => (i - 1 + images.length) % images.length,
                            ),
                          )}
                          {navBtn("right", () =>
                            setCarDetailImgIdx((i) => (i + 1) % images.length),
                          )}
                        </>
                      )}
                      <button
                        onClick={() => setCarDetailLbOpen(true)}
                        style={{
                          position: "absolute",
                          bottom: 8,
                          right: 8,
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: "rgba(0,0,0,0.55)",
                          backdropFilter: "blur(8px)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "#9ca3af",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ZoomIn size={13} />
                      </button>
                      {images.length > 1 && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: 8,
                            left: 8,
                            fontSize: 10,
                            color: "#9ca3af",
                            background: "rgba(0,0,0,0.55)",
                            borderRadius: 4,
                            padding: "2px 7px",
                          }}
                        >
                          {carDetailImgIdx + 1} / {images.length}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      height: isMobile ? 160 : 260,
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Car size={40} color="#374151" />
                  </div>
                )}

                {/* Car header */}
                <div style={{ marginTop: 18 }}>
                  <p
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.15em",
                      margin: 0,
                    }}
                  >
                    {car.brand}
                  </p>
                  <p
                    style={{
                      fontSize: 22,
                      fontWeight: 300,
                      color: "#f3f4f6",
                      margin: "4px 0 0",
                      lineHeight: 1.2,
                    }}
                  >
                    {car.model}
                    {car.variant ? ` ${car.variant}` : ""}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      margin: "6px 0 0",
                    }}
                  >
                    {[car.year, car.body_type, car.transmission, car.fuel_type]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {(car.city || car.state) && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        margin: "4px 0 0",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <MapPin size={11} />{" "}
                      {[car.city, car.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>

                {/* Price */}
                <div style={{ marginTop: 12 }}>
                  <p
                    style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: 32,
                      color: "#f3f4f6",
                      margin: 0,
                      lineHeight: 1,
                    }}
                  >
                    {sp ? `RM ${sp.toLocaleString("en-MY")}` : "—"}
                  </p>
                  {saving > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "#374151",
                          textDecoration: "line-through",
                        }}
                      >
                        RM {op.toLocaleString("en-MY")}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "#f87171",
                          background: "rgba(220,38,38,0.1)",
                          border: "1px solid rgba(220,38,38,0.2)",
                          borderRadius: 4,
                          padding: "1px 6px",
                        }}
                      >
                        SAVE RM {saving.toLocaleString("en-MY")}
                      </span>
                    </div>
                  )}
                  {monthly > 0 && (
                    <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      Est. RM {monthly.toLocaleString()}/mo · 90% loan · 7yr ·
                      3.5% p.a.
                    </p>
                  )}
                </div>

                {/* Specs strip */}
                <div
                  style={{
                    display: "flex",
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    margin: "16px 0",
                    padding: "12px 0",
                    gap: 0,
                    overflowX: "auto",
                  }}
                >
                  {[
                    {
                      Icon: Gauge,
                      label: "Mileage",
                      value: car.mileage
                        ? `${Number(car.mileage).toLocaleString()} km`
                        : "—",
                    },
                    {
                      Icon: Settings,
                      label: "Engine",
                      value: car.engine_cc
                        ? `${Number(car.engine_cc).toLocaleString()} cc`
                        : "—",
                    },
                    {
                      Icon: ChevronRight,
                      label: "Transmission",
                      value: car.transmission || "—",
                    },
                    {
                      Icon: Droplets,
                      label: "Fuel",
                      value: car.fuel_type || "—",
                    },
                    {
                      Icon: Palette,
                      label: "Colour",
                      value: car.colour || "—",
                    },
                  ].map(({ Icon, label, value }, i, arr) => (
                    <div
                      key={label}
                      style={{
                        flex: "1 0 70px",
                        textAlign: "center",
                        padding: "0 10px",
                        borderRight:
                          i < arr.length - 1
                            ? "1px solid rgba(255,255,255,0.05)"
                            : "none",
                      }}
                    >
                      <Icon
                        size={13}
                        color="#6b7280"
                        style={{ marginBottom: 4 }}
                      />
                      <p
                        style={{
                          fontSize: 9,
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: "#6b7280",
                          marginBottom: 3,
                        }}
                      >
                        {label}
                      </p>
                      <p style={{ fontSize: 12, color: "#f3f4f6", margin: 0 }}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div
                  style={{
                    display: "flex",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    marginBottom: 16,
                  }}
                >
                  {["specs", "features", "options"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setCarDetailTab(tab)}
                      style={{
                        padding: "8px 16px",
                        fontSize: 12,
                        color: carDetailTab === tab ? "#f3f4f6" : "#6b7280",
                        background: "none",
                        border: "none",
                        borderBottom:
                          carDetailTab === tab
                            ? "2px solid #ef4444"
                            : "2px solid transparent",
                        cursor: "pointer",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                {carDetailTab === "specs" && (
                  <div>
                    {[
                      { k: "Year", v: car.year || "—" },
                      { k: "Condition", v: car.condition || "—" },
                      { k: "Body Type", v: car.body_type || "—" },
                      { k: "Colour", v: car.colour || "—" },
                      {
                        k: "Mileage",
                        v: car.mileage
                          ? `${Number(car.mileage).toLocaleString()} km`
                          : "—",
                      },
                      { k: "Transmission", v: car.transmission || "—" },
                      { k: "Fuel Type", v: car.fuel_type || "—" },
                      {
                        k: "Location",
                        v:
                          [car.city, car.state].filter(Boolean).join(", ") ||
                          "—",
                      },
                    ].map(({ k, v }) => (
                      <div
                        key={k}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "10px 0",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          {k}
                        </span>
                        <span style={{ fontSize: 13, color: "#9ca3af" }}>
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {carDetailTab === "features" && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {features.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#6b7280" }}>
                        No features listed.
                      </p>
                    ) : (
                      features.map((f, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 12,
                            color: "#9ca3af",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 4,
                            padding: "4px 10px",
                          }}
                        >
                          {f}
                        </span>
                      ))
                    )}
                  </div>
                )}

                {carDetailTab === "options" && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {options.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#6b7280" }}>
                        No options listed.
                      </p>
                    ) : (
                      options.map((o, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 12,
                            color: "#9ca3af",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 4,
                            padding: "4px 10px",
                          }}
                        >
                          {o}
                        </span>
                      ))
                    )}
                  </div>
                )}

                {/* What's Included */}
                {Array.isArray(car.included_services) && car.included_services.length > 0 && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: "#6b7280", fontWeight: 700, marginBottom: 10 }}>What's Included</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {car.included_services.map((svc, i) => {
                        const cfg = getCategoryCfg(svc.category);
                        const CatIcon = cfg.icon;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: `${cfg.color}12`, border: `1px solid ${cfg.color}30`, borderRadius: 8, padding: "6px 12px" }}>
                            <CatIcon size={12} style={{ color: cfg.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: cfg.color, fontWeight: 600 }}>{svc.name}</span>
                          </div>
                        );
                      })}
                    </div>
                    {car.included_services_cost > 0 && (
                      <p style={{ fontSize: 11, color: "#6b7280", marginTop: 10 }}>
                        Est. add-on value: <span style={{ color: "#60a5fa", fontWeight: 700 }}>RM {Number(car.included_services_cost).toLocaleString("en-MY")}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT — actions + CVR */}
              <div
                style={{
                  flex: isMobile ? "none" : "0 0 200px",
                  width: isMobile ? "100%" : undefined,
                  padding: isMobile ? "12px 16px 32px" : 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  borderTop: isMobile
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "none",
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    color: "#6b7280",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    margin: "0 0 4px",
                  }}
                >
                  Actions
                </p>
                {actionBtn(
                  <>
                    <Copy size={13} style={{ flexShrink: 0 }} /> Copy Link
                  </>,
                  listingCopied[car.id] === "link" ? "#4ade80" : "#9ca3af",
                  listingCopied[car.id] === "link"
                    ? "rgba(34,197,94,0.08)"
                    : "rgba(255,255,255,0.04)",
                  listingCopied[car.id] === "link"
                    ? "rgba(34,197,94,0.3)"
                    : "rgba(255,255,255,0.08)",
                  () => handleListingCopy(car, "link"),
                )}
                {actionBtn(
                  <>
                    <MessageSquare size={13} style={{ flexShrink: 0 }} /> {listingCopied[car.id] === "wa" ? "✓ Copied!" : "WA Caption"}
                  </>,
                  listingCopied[car.id] === "wa" ? "#4ade80" : "#9ca3af",
                  listingCopied[car.id] === "wa" ? "rgba(34,197,94,0.08)" : "rgba(37,211,102,0.06)",
                  listingCopied[car.id] === "wa" ? "rgba(34,197,94,0.3)" : "rgba(37,211,102,0.2)",
                  () => handleListingCopy(car, "wa"),
                )}
                {actionBtn(
                  <>
                    <Sparkles size={13} style={{ flexShrink: 0 }} /> AI Caption
                  </>,
                  "#c084fc",
                  "rgba(168,85,247,0.08)",
                  "rgba(168,85,247,0.25)",
                  () => {
                    generateAiCaptions(car);
                    close();
                  },
                )}
                {actionBtn(
                  <>
                    <Bell size={13} style={{ flexShrink: 0 }} /> Broadcast
                  </>,
                  "#fb923c",
                  "rgba(249,115,22,0.08)",
                  "rgba(249,115,22,0.25)",
                  () => {
                    openBroadcast(car);
                    close();
                  },
                )}
                {actionBtn(
                  <>
                    <Eye size={13} style={{ flexShrink: 0 }} /> TikTok Studio
                  </>,
                  "#f87171",
                  "rgba(239,68,68,0.08)",
                  "rgba(239,68,68,0.25)",
                  () => {
                    setTiktokListing(car);
                    close();
                  },
                )}

                {/* Performance */}
                <div
                  style={{
                    marginTop: 8,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 6,
                    padding: 12,
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      color: "#6b7280",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      margin: "0 0 8px",
                    }}
                  >
                    Performance
                  </p>
                  {[
                    { label: "Views", val: views, color: "#60a5fa" },
                    { label: "Enquiries", val: enqs, color: "#fbbf24" },
                    {
                      label: "CVR",
                      val: cvr !== null ? `${cvr}%` : "—",
                      color: "#4ade80",
                    },
                  ].map(({ label, val, color }) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#6b7280" }}>
                        {label}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color }}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Status */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 6,
                    padding: 12,
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      color: "#6b7280",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      margin: "0 0 6px",
                    }}
                  >
                    Status
                  </p>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "capitalize",
                      color:
                        car.status === "available"
                          ? "#4ade80"
                          : car.status === "sold"
                            ? "#9ca3af"
                            : "#fbbf24",
                    }}
                  >
                    {car.status || "available"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lightbox */}
        {carDetailLbOpen && images.length > 0 && (
          <div
            onClick={() => setCarDetailLbOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 300,
              background: "rgba(0,0,0,0.96)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => setCarDetailLbOpen(false)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                width: 40,
                height: 40,
                borderRadius: 8,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#e5e5e5",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              <X size={18} />
            </button>
            {images.length > 1 && (
              <span
                style={{
                  position: "absolute",
                  top: 20,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 12,
                  color: "#9ca3af",
                  background: "rgba(0,0,0,0.5)",
                  borderRadius: 20,
                  padding: "4px 12px",
                }}
              >
                {carDetailImgIdx + 1} / {images.length}
              </span>
            )}
            {images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCarDetailImgIdx(
                    (i) => (i - 1 + images.length) % images.length,
                  );
                }}
                style={{
                  position: "absolute",
                  left: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#e5e5e5",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronLeft size={22} />
              </button>
            )}
            <img
              src={images[carDetailImgIdx]}
              alt=""
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "calc(100vw - 120px)",
                maxHeight: "90vh",
                objectFit: "contain",
                borderRadius: 4,
                display: "block",
              }}
            />
            {images.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCarDetailImgIdx((i) => (i + 1) % images.length);
                }}
                style={{
                  position: "absolute",
                  right: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#e5e5e5",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronRight size={22} />
              </button>
            )}
          </div>
        )}
      </>
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

    // lead source breakdown
    const srcMap = { enquiry: 0, manual: 0, booking: 0, xdrive: 0 };
    leads.forEach(l => {
      const s = l.lead_source || "manual";
      srcMap[s] = (srcMap[s] || 0) + 1;
    });
    const srcTotal = leads.length;
    const srcCfg = [
      { key: "enquiry",  label: "WhatsApp",  color: "#4ade80" },
      { key: "booking",  label: "Booking",   color: "#60a5fa" },
      { key: "xdrive",   label: "XDrive",    color: "#f87171" },
      { key: "manual",   label: "Manual",    color: "#6b7280" },
    ].filter(s => srcMap[s.key] > 0);

    // pre-compute heat scores once — avoids O(n log n) recomputation inside sort comparators
    const heatMap = new Map(searchedLeads.map((l) => [l.id, getHeatScore(l)]));

    const activeStages = LEAD_STAGES.filter(
      (s) => s !== "lost" && s !== "closed_lost" && s !== "closed_won",
    );
    const lostLeads = searchedLeads.filter(
      (l) => l.stage === "lost" || l.stage === "closed_lost",
    );

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
      const isConfirmingDelete = deleteConfirmId === lead.id;
      const isPromptingLost = lostPromptId === lead.id;
      const followUpOverdue = lead.follow_up_at && new Date(lead.follow_up_at).getTime() <= Date.now();
      const initials = (lead.buyer_name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
      const heatStyle = heat.label === "hot"
        ? { bg: "rgba(248,113,113,0.12)", color: "#f87171" }
        : heat.label === "warm"
        ? { bg: "rgba(251,191,36,0.12)", color: "#fbbf24" }
        : { bg: "rgba(255,255,255,0.05)", color: "#6b7280" };

      return (
        <div
          key={lead.id}
          style={{
            background: "#0d1117",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {/* ── HEADER ── */}
          <div style={{ padding: "12px 14px 0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
              {/* Avatar */}
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(96,165,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 600, color: "#93c5fd" }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lead.buyer_name || "—"}
                  </p>
                  <span style={{ fontSize: 10, borderRadius: 99, padding: "2px 8px", background: heatStyle.bg, color: heatStyle.color, whiteSpace: "nowrap", flexShrink: 0, fontWeight: 600 }}>
                    {heat.label}
                  </span>
                </div>
                {(carName || carPrice) && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2, gap: 8 }}>
                    {carName && <p style={{ margin: 0, fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{carName}</p>}
                    {carPrice && <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#60a5fa", flexShrink: 0 }}>{carPrice}</p>}
                  </div>
                )}
                {lead.updated_at && (
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: Date.now() - new Date(lead.updated_at).getTime() > 48 * 3600 * 1000 ? "#fb923c" : "#374151" }}>
                    Last contact: {timeAgo(lead.updated_at)}
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar — 7 segments */}
            <div style={{ marginBottom: followUpOverdue ? 8 : 12 }}>
              <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
                {progressStages.map((s, i) => (
                  <div key={s} style={{ flex: 1, height: 3, borderRadius: 99, background: i < currentProgressIdx ? "#9ca3af" : i === currentProgressIdx ? "#f1f5f9" : "rgba(255,255,255,0.08)" }} />
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 10, color: "#4b5563" }}>
                Stage: <span style={{ color: "#9ca3af", fontWeight: 600 }}>{(normalizedStage || "new").replace(/_/g, " ")}</span>
                {currentProgressIdx >= 0 && <span style={{ color: "#374151" }}> · {currentProgressIdx + 1}/{progressStages.length}</span>}
              </p>
            </div>

            {/* Follow-up warning */}
            {followUpOverdue && (
              <div style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.22)", borderRadius: 7, color: "#fb923c", fontSize: 11, padding: "6px 10px", marginBottom: 12 }}>
                Follow-up: {timeAgo(lead.follow_up_at)}
              </div>
            )}
          </div>

          {/* ── ACTIONS — exactly 3 buttons ── */}
          <div style={{ display: "flex", gap: 6, padding: "0 14px 12px" }}>
            {lead.stage !== "won" && lead.stage !== "closed_won" && (
              <button
                onClick={() => advanceLeadStage(lead, nextStage)}
                style={{ flex: 1, fontSize: 11, padding: "6px 12px", borderRadius: 7, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.22)", color: "#f87171", cursor: "pointer", textAlign: "center" }}
              >
                → {(nextStage || "won").replace(/_/g, " ")}
              </button>
            )}
            {lead.phone && (
              <a
                href={`tel:${(lead.phone || "").replace(/\D/g, "")}`}
                style={{ flexShrink: 0, fontSize: 11, padding: "6px 10px", borderRadius: 7, background: "rgba(96,165,250,0.10)", border: "1px solid rgba(96,165,250,0.25)", color: "#93c5fd", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                📞
              </a>
            )}
            {lead.phone ? (
              <button
                onClick={() => {
                  const waCarName = car ? `${car.brand} ${car.model}` : "kereta tu";
                  const isStale = lead.updated_at && Date.now() - new Date(lead.updated_at).getTime() > 48 * 3600 * 1000;
                  const msg = isStale
                    ? `Hi ${lead.buyer_name || "kawan"}! Ada orang lain tengah tanya pasal ${waCarName} ni — kalau you still interested, jom lock dulu sebelum terlambat 🔒`
                    : `Hi ${lead.buyer_name || "kawan"}! Macam mana, still interested dalam ${waCarName} tu? Jom kita discuss lagi 😊`;
                  setWaModalMessage(msg);
                  setWaModalLead(lead);
                }}
                style={{ flex: 1, fontSize: 11, padding: "6px 12px", borderRadius: 7, background: "rgba(37,211,102,0.10)", border: "1px solid rgba(37,211,102,0.25)", color: "#4ade80", cursor: "pointer", textAlign: "center" }}
              >
                WA
              </button>
            ) : !lead.car_listing_id ? (
              <button
                onClick={() => setLinkCarLeadId(lead.id)}
                style={{ flex: 1, fontSize: 11, padding: "6px 12px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer", textAlign: "center" }}
              >
                🚗 Link Car
              </button>
            ) : null}
            <button
              onClick={() => setDrawerLeadId(lead.id)}
              style={{ flexShrink: 0, fontSize: 13, padding: "6px 10px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", letterSpacing: "0.05em", lineHeight: 1 }}
            >
              ···
            </button>
          </div>
        </div>
      );
    };

    return (
      <div>
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
              fontSize: 16,
              fontWeight: 600,
              color: "#f1f5f9",
            }}
          >
            Lead Pipeline ({leads.filter((l) => l.stage !== "lost" && l.stage !== "closed_lost" && l.stage !== "closed_won").length})
          </p>
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
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            <Plus size={13} /> Add Lead
          </button>
        </div>

        {/* Lead source breakdown */}
        {srcTotal > 0 && srcCfg.length > 1 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 6, marginBottom: 8 }}>
              {srcCfg.map(({ key, color }) => (
                <div key={key} style={{ flex: srcMap[key], background: color }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {srcCfg.map(({ key, label, color }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: "#6b7280" }}>{label} <strong style={{ color: "#9ca3af" }}>{srcMap[key]}</strong></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search bar */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4b5563", pointerEvents: "none" }} />
          <input
            value={leadSearch}
            onChange={(e) => setLeadSearch(e.target.value)}
            placeholder="Search by name or phone…"
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#e5e7eb", fontSize: 13, padding: "8px 10px 8px 30px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          />
          {leadSearch && (
            <button onClick={() => setLeadSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#4b5563", cursor: "pointer", padding: 2 }}>
              <X size={13} />
            </button>
          )}
        </div>

        {isMobile ? (
          <>
            {/* Mobile: pill filter row */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", padding: "2px 0 10px", marginBottom: 12 }}>
              {activeStages.map((stage) => {
                const sc = STAGE_COLOR[stage] || {};
                const count = searchedLeads.filter((l) => l.stage === stage).length;
                const isActive = mobileLeadStage === stage;
                return (
                  <button
                    key={stage}
                    onClick={() => setMobileLeadStage(stage)}
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 12px",
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: isActive ? 600 : 400,
                      cursor: "pointer",
                      background: isActive ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.04)",
                      border: isActive ? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(255,255,255,0.08)",
                      color: isActive ? "#f87171" : "#4b5563",
                      textTransform: "capitalize",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {stage.replace(/_/g, " ")}
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: isActive ? (sc.tx || "#f87171") : "#374151",
                      background: isActive ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.06)",
                      borderRadius: 99,
                      padding: "0px 6px",
                      lineHeight: 1.6,
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Mobile: vertical card list for selected stage */}
            {(() => {
              const stageLeads = searchedLeads
                .filter((l) => l.stage === mobileLeadStage)
                .sort((a, b) => (heatMap.get(b.id)?.score ?? 0) - (heatMap.get(a.id)?.score ?? 0));
              if (stageLeads.length === 0) {
                return (
                  <div style={{ height: 60, borderRadius: 10, border: "1px dashed rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 11, color: "#374151" }}>Empty</span>
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
        ) : (
          /* Desktop: horizontal kanban scroll */
          <div
            style={{
              display: "flex",
              gap: 12,
              overflowX: "auto",
              paddingBottom: 8,
            }}
          >
            {activeStages.map((stage) => {
              const sc = STAGE_COLOR[stage] || {};
              const stageLeads = searchedLeads
                .filter((l) => l.stage === stage)
                .sort((a, b) => (heatMap.get(b.id)?.score ?? 0) - (heatMap.get(a.id)?.score ?? 0));
              return (
                <div
                  key={stage}
                  style={{ minWidth: stageLeads.length === 0 ? 80 : 200, flexShrink: 0 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: sc.tx || "#9ca3af", textTransform: "capitalize" }}>
                      {stage.replace(/_/g, " ")}
                    </span>
                    <span style={{ fontSize: 10, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.tx, borderRadius: 99, padding: "1px 6px" }}>
                      {stageLeads.length}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {stageLeads.length === 0 && (
                      <div style={{ height: 60, borderRadius: 10, border: "1px dashed rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 11, color: "#374151" }}>Empty</span>
                      </div>
                    )}
                    {stageLeads.map((lead) => renderLeadCard(lead))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#4b5563",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Lost ({lostLeads.length})
              </span>
              <span style={{ fontSize: 12, color: "#374151" }}>
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
                      background: "#0d1117",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      opacity: 0.65,
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
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#9ca3af",
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
                              fontSize: 10,
                              padding: "1px 7px",
                              borderRadius: 99,
                              background: "rgba(148,163,184,0.08)",
                              border: "1px solid rgba(148,163,184,0.2)",
                              color: "#cbd5e1",
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
                            color: "#4b5563",
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
                        fontSize: 10,
                        color: "#374151",
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
                            fontSize: 11,
                            color: "#f87171",
                            fontWeight: 600,
                          }}
                        >
                          Delete?
                        </span>
                        <button
                          onClick={() => handleDeleteLead(lead.id)}
                          style={{
                            fontSize: 10,
                            padding: "6px 11px",
                            borderRadius: 5,
                            background: "rgba(239,68,68,0.12)",
                            border: "1px solid rgba(239,68,68,0.3)",
                            color: "#f87171",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          style={{
                            fontSize: 10,
                            padding: "6px 11px",
                            borderRadius: 5,
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "#6b7280",
                            cursor: "pointer",
                          }}
                        >
                          No
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
          const plHeatStyle = plHeat.label === "hot" ? { bg: "rgba(248,113,113,0.12)", color: "#f87171" } : plHeat.label === "warm" ? { bg: "rgba(251,191,36,0.12)", color: "#fbbf24" } : { bg: "rgba(255,255,255,0.05)", color: "#6b7280" };
          const plInitials = (pl.buyer_name || "?").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
          const plIsPromptingLost = lostPromptId === pl.id;
          const plIsConfirmingDelete = deleteConfirmId === pl.id;
          const pbCar = pl.car_listings;
          const pbCarName = pbCar ? `${pbCar.year || ""} ${pbCar.brand} ${pbCar.model}`.trim() : "this car";
          const pbStage = pl.stage;
          const scripts = {
            price: { label: "Price too high", color: "#f87171", lines: [`"Let's look at what you're actually paying monthly — at 90% loan over 7 years, that's roughly RM ${pbCar?.selling_price ? Math.round(pbCar.selling_price * 0.9 * 1.245 / 84).toLocaleString() : "X"}/mo. That's less than a phone plan upgrade."`, `"What's your target price? Let me see what I can work out — I want to make this happen for you."`, `"This is already ${pbCar?.original_price && pbCar.original_price > pbCar.selling_price ? `RM ${(pbCar.original_price - pbCar.selling_price).toLocaleString()} below asking` : "market price"}. The value is there."`] },
            mileage: { label: "High mileage concern", color: "#fb923c", lines: [`"Mileage matters less than service history. A well-maintained ${pbCarName} at ${pbCar?.mileage ? Number(pbCar.mileage).toLocaleString() + "km" : "this mileage"} beats a low-km car that's been neglected."`, `"These engines are built to go 300k+ km with regular service. The price already reflects the mileage."`, `"I can help you run a CARFAX/JPJ check so you can see exactly what this car's been through."`] },
            timing: { label: "Not ready yet", color: "#fbbf24", lines: [`"Totally understand — what would need to change for you to feel ready? Is it financing, or something else?"`, `"I can hold this for you with a small refundable deposit while you sort things out. No pressure."`, `"Just so you know — cars at this price point move fast. I'd hate for you to miss it and find something worse for more money."`] },
            trust: { label: "Not sure / need to think", color: "#f87171", lines: [`"What specific questions can I answer right now? Let's remove all the uncertainty together."`, `"I'm not here to rush you — but I want to make sure you have everything you need to decide confidently."`, `"Can I send you a full brief on this car — specs, loan estimate, everything — so you have it all in one place?"`] },
          };
          const close = () => { setDrawerLeadId(null); setEditingNoteId(null); setPlaybookLeadId(null); setExpandedActivityLeadId(null); setLostPromptId(null); setDeleteConfirmId(null); };
          return (
            <>
              {/* backdrop */}
              <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} />
              {/* panel */}
              <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50, width: 400, maxWidth: "100vw", background: "#0d1117", borderLeft: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", fontFamily: "'DM Sans', sans-serif" }}>

                {/* header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(96,165,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 700, color: "#93c5fd" }}>{plInitials}</div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.buyer_name || "—"}</p>
                      <p style={{ margin: "1px 0 0", fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plCarName || pl.phone || "No car linked"}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "2px 8px", background: plHeatStyle.bg, color: plHeatStyle.color }}>{plHeat.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, borderRadius: 6, padding: "2px 8px", background: "rgba(255,255,255,0.05)", color: "#9ca3af", textTransform: "capitalize" }}>{pl.stage?.replace(/_/g," ")}</span>
                    <button onClick={close} style={{ background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", color: "#9ca3af", borderRadius: 8, padding: 6, display: "flex" }}>
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* price strip */}
                {plCarPrice && (
                  <div style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#60a5fa" }}>{plCarPrice}</p>
                  </div>
                )}

                {/* scrollable body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, WebkitOverflowScrolling: "touch" }}>

                  {/* Notes */}
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>Notes</p>
                    {editingNoteId === pl.id ? (
                      <div>
                        <textarea autoFocus value={editNoteVal} onChange={e => setEditNoteVal(e.target.value)} rows={3} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, color: "#e5e7eb", fontSize: 13, padding: "8px 11px", resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button onClick={() => saveLeadNote(pl.id)} disabled={notesSavingId === pl.id} style={{ fontSize: 12, padding: "7px 14px", borderRadius: 7, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.22)", color: "#f87171", cursor: "pointer", fontWeight: 600, opacity: notesSavingId === pl.id ? 0.5 : 1 }}>{notesSavingId === pl.id ? "…" : "Save"}</button>
                          <button onClick={() => setEditingNoteId(null)} style={{ fontSize: 12, padding: "7px 14px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>Cancel</button>
                        </div>
                      </div>
                    ) : pl.notes ? (
                      <p onClick={() => { setEditingNoteId(pl.id); setEditNoteVal(pl.notes || ""); }} style={{ margin: 0, fontSize: 13, color: "#9ca3af", fontStyle: "italic", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                        <Pencil size={12} /> "{pl.notes}"
                      </p>
                    ) : (
                      <button onClick={() => { setEditingNoteId(pl.id); setEditNoteVal(""); }} style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit", width: "100%" }}>
                        <Pencil size={12} /> Add note…
                      </button>
                    )}
                  </div>

                  {/* Tool row 1 */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { const price = pl.car_listings?.selling_price || ""; setLoanPrice(String(price)); setLoanCalcLead(pl); }} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <DollarSign size={12} /> Loan calc
                    </button>
                    <button onClick={() => { setLogCallLeadId(pl.id); setCallOutcome("answered"); setCallNote(""); }} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <PhoneCall size={12} /> Log call
                    </button>
                    <button onClick={() => { setFollowUpModalLead(pl); setFollowUpDate(pl.follow_up_at ? pl.follow_up_at.slice(0,10) : ""); }} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, background: pl.follow_up_at ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)", border: pl.follow_up_at ? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(255,255,255,0.08)", color: pl.follow_up_at ? "#fbbf24" : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      <Clock size={12} /> Set reminder
                    </button>
                  </div>

                  {/* Tool row 2 */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { setExpandedActivityLeadId(null); setPlaybookLeadId(playbookLeadId === pl.id ? null : pl.id); }} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", background: playbookLeadId === pl.id ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${playbookLeadId === pl.id ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.08)"}`, color: playbookLeadId === pl.id ? "#c084fc" : "#9ca3af" }}>
                      Scripts
                    </button>
                    <button onClick={() => { setPlaybookLeadId(null); if (expandedActivityLeadId === pl.id) setExpandedActivityLeadId(null); else fetchLeadActivities(pl.id); }} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", background: expandedActivityLeadId === pl.id ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${expandedActivityLeadId === pl.id ? "rgba(96,165,250,0.3)" : "rgba(255,255,255,0.08)"}`, color: expandedActivityLeadId === pl.id ? "#93c5fd" : "#9ca3af" }}>
                      <History size={12} /> History
                    </button>
                    {pl.stage === "deposit_taken" && (
                      <button onClick={() => { setDepositModal(pl); setDepositAmount(""); setDepositCopied(false); }} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}>
                        Receipt
                      </button>
                    )}
                    <button onClick={() => setLinkCarLeadId(pl.id)} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                      🚗 {pl.car_listing_id ? "Change Car" : "Link Car"}
                    </button>
                  </div>

                  {/* Activity timeline */}
                  {expandedActivityLeadId === pl.id && (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "12px 14px" }}>
                      <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em" }}>Activity History</p>
                      {activitiesLoadingId === pl.id ? (
                        <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>Loading…</p>
                      ) : (leadActivities[pl.id] || []).length === 0 ? (
                        <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>No activity yet.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {(leadActivities[pl.id] || []).map((act, i) => {
                            const icon = act.activity_type === "whatsapp_sent" ? "💬" : act.activity_type === "call_logged" ? "📞" : act.activity_type === "stage_changed" ? "🔄" : "📝";
                            return (
                              <div key={act.id || i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>{act.activity_type === "stage_changed" ? `${act.from_stage || "?"} → ${act.to_stage || "?"}` : act.note || act.activity_type}</p>
                                  <p style={{ margin: 0, fontSize: 11, color: "#374151" }}>{timeAgo(act.created_at)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Objection Scripts */}
                  {playbookLeadId === pl.id && ["negotiating","viewing_booked","test_drive","contacted"].includes(pbStage) && (
                    <div style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 8, padding: "12px 14px" }}>
                      <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, color: "#c084fc", textTransform: "uppercase", letterSpacing: "0.08em" }}>Objection Scripts</p>
                      {Object.entries(scripts).map(([key, s]) => (
                        <div key={key} style={{ marginBottom: 10 }}>
                          <p style={{ margin: "0 0 5px", fontSize: 11, fontWeight: 600, color: s.color }}>{s.label}</p>
                          {s.lines.map((line, lineIdx) => {
                            const lineKey = `${pl.id}-${key}-${lineIdx}`;
                            const isCopied = copiedScriptLine === lineKey;
                            return (
                              <div key={lineIdx} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4, overflowX: "hidden" }}>
                                <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.55, flex: 1, minWidth: 0, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{line}</p>
                                <button onClick={() => { navigator.clipboard.writeText(line.replace(/^"|"$/g,"")); setCopiedScriptLine(lineKey); setTimeout(() => setCopiedScriptLine(null), 1500); }} style={{ background: "none", border: "none", color: isCopied ? "#4ade80" : "#4b5563", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                                  {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Divider */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

                  {/* Lost / Delete zone */}
                  {plIsPromptingLost ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginRight: 2 }}>Why lost?</span>
                      {LOST_REASONS.map(r => (
                        <button key={r} onClick={() => handleLostReason(pl.id, r)} disabled={lostSavingId === pl.id} style={{ fontSize: 11, padding: "6px 10px", borderRadius: 99, background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)", color: "#cbd5e1", cursor: "pointer", opacity: lostSavingId === pl.id ? 0.5 : 1, fontFamily: "inherit" }}>
                          {lostSavingId === pl.id ? "…" : r}
                        </button>
                      ))}
                      <button onClick={() => setLostPromptId(null)} style={{ fontSize: 11, padding: "6px 10px", background: "transparent", border: "none", color: "#4b5563", cursor: "pointer" }}>✕</button>
                    </div>
                  ) : plIsConfirmingDelete ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, color: "#f87171", fontWeight: 600 }}>Delete this lead?</span>
                      <button onClick={() => handleDeleteLead(pl.id)} disabled={deletingLeadId === pl.id} style={{ fontSize: 12, padding: "7px 14px", borderRadius: 7, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", cursor: "pointer", fontWeight: 600, opacity: deletingLeadId === pl.id ? 0.5 : 1, fontFamily: "inherit" }}>{deletingLeadId === pl.id ? "…" : "Yes, delete"}</button>
                      <button onClick={() => setDeleteConfirmId(null)} style={{ fontSize: 12, padding: "7px 14px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>No</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      {pl.stage !== "won" && pl.stage !== "closed_won" && (
                        <button onClick={() => { setDeleteConfirmId(null); setLostPromptId(pl.id); }} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                          Mark as lost
                        </button>
                      )}
                      <button onClick={() => { setLostPromptId(null); setDeleteConfirmId(pl.id); }} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#4b5563", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                        <Trash2 size={13} /> Delete
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

  const renderEnquiries = () => (
    <div>
      <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>
        Enquiries ({enquiries.length})
      </p>
      {enquiries.length === 0 && (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#374151" }}>
          <MessageSquare size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: 13 }}>No enquiries yet.</p>
          <p style={{ margin: "6px 0 14px", fontSize: 12, color: "#374151" }}>Share your listing link to start getting enquiries.</p>
          <button onClick={() => setActiveTab("listings")} style={{ fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 8, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.22)", color: "#f87171", cursor: "pointer" }}>
            Go to Listings →
          </button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[...enquiries].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((enq) => {
          const car = enq.car_listings;
          const isNew = enq.status === "new";
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
                    New
                  </span>
                ) : (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, flexShrink: 0, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80", textTransform: "capitalize" }}>
                    Converted → Lead
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
                <div style={{ margin: "4px 0 8px", padding: "8px 11px", background: "rgba(255,255,255,0.05)", borderLeft: "3px solid rgba(96,165,250,0.5)", borderRadius: "0 6px 6px 0" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {enq.buyer_message}
                  </p>
                </div>
              )}
              {/* Phone — show when new or expanded */}
              {(isNew || isExpanded) && enq.buyer_phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px" }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>📞 {enq.buyer_phone}</p>
                  {isExpanded && (
                    <a
                      href={`https://wa.me/${enq.buyer_phone.replace(/\D/g, "").replace(/^0/, "6")}?text=${encodeURIComponent(`Hi ${enq.buyer_name || ""}! 😊`)}`}
                      target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#4ade80", textDecoration: "none" }}
                    >WA</a>
                  )}
                </div>
              )}
              {/* Timestamp */}
              <p style={{ margin: isNew ? "0 0 8px" : 0, fontSize: 11, color: "#4b5563" }}>
                {timeAgo(enq.created_at)}
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
                        window.open(`https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${msg}`, "_blank", "noopener,noreferrer");
                        await supabase.from("whatsapp_enquiries").update({ status: "responded" }).eq("id", enq.id);
                        setEnquiries((p) => p.map((e) => e.id === enq.id ? { ...e, status: "responded" } : e));
                        await autoCreateLeadFromEnq(enq);
                      }}
                      style={{ fontSize: 10, padding: "6px 11px", borderRadius: 6, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#4ade80", cursor: "pointer" }}
                    >
                      WA Reply
                    </button>
                  )}
                  {enq.buyer_phone && (
                    <button
                      onClick={() => setOpenTemplateId(openTemplateId === enq.id ? null : enq.id)}
                      style={{ fontSize: 10, padding: "6px 11px", borderRadius: 6, background: openTemplateId === enq.id ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${openTemplateId === enq.id ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.08)"}`, color: openTemplateId === enq.id ? "#f87171" : "#6b7280", cursor: "pointer" }}
                    >
                      Templates ▾
                    </button>
                  )}
                </div>
              )}
              {/* Template picker */}
              {isNew && openTemplateId === enq.id && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    { key: "chat", label: "Let's Chat", color: "#4ade80" },
                    { key: "test_drive", label: "Book Test Drive", color: "#60a5fa" },
                    { key: "budget", label: "What's Budget?", color: "#fbbf24" },
                    { key: "deposit", label: "Deposit to Hold", color: "#f87171" },
                  ].map(({ key, label, color }) => {
                    const toastKey = enq.id + "_" + key;
                    return (
                      <button
                        key={key}
                        onClick={() => fireTemplate(enq, key)}
                        style={{ textAlign: "left", fontSize: 11, padding: "7px 10px", borderRadius: 7, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: templateToast === toastKey ? color : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        {templateToast === toastKey ? "✓ Sent!" : label}
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
    };

    const buildReminderMessage = (apt) => {
      const aptDate = new Date(apt.appointment_date);
      const dateStr = aptDate.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" });
      const timeStr = aptDate.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
      return `Hi ${apt.buyer_name || ""}! Just a reminder for your appointment on ${dateStr}${timeStr ? ` at ${timeStr}` : ""}. See you then! 😊`;
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

    const todayApts = appointments.filter((a) => aptIsToday(a.appointment_date) && a.status !== "cancelled").sort(asc);
    const upcomingApts = appointments.filter((a) => {
      if (!a.appointment_date) return false;
      const d = new Date(a.appointment_date);
      return !isNaN(d) && !aptIsToday(a.appointment_date) && d > new Date();
    }).sort(newestBooked);
    const pastApts = appointments.filter((a) => {
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
      if (error) { toast.error("Failed to set reminder"); return; }
      setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, remind_at: remindAt.toISOString(), remind_sent: false } : a));
      setReminderPickerAptId(null);
      setSelectedRemindAt(null);
      toast.success("Reminder set — Telegram fires " + remindAt.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }));
    };

    const clearReminder = async (apt) => {
      await supabase.from("appointments").update({ remind_at: null, remind_sent: false }).eq("id", apt.id);
      setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, remind_at: null } : a));
    };

    const renderApptCard = (apt) => {
      const car = apt.car_listings;
      const { dateStr, timeStr } = fmtAptDate(apt.appointment_date);
      const sc = statusColors[apt.status] || statusColors.pending;
      const isEditing = editingReminder === apt.id;

      return (
        <div key={apt.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px" }}>
          {/* Name row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {apt.buyer_name || "—"}
              </p>
              {aptIsNew(apt.created_at) && (
                <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171", flexShrink: 0, letterSpacing: "0.05em" }}>
                  NEW
                </span>
              )}
            </div>
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, flexShrink: 0, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.tx, textTransform: "capitalize" }}>
              {apt.status}
            </span>
          </div>
          {/* Booked timestamp */}
          {apt.created_at && (
            <p style={{ margin: "0 0 4px", fontSize: 10, color: "#374151" }}>
              Booked {timeAgo(apt.created_at)} · {new Date(apt.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
          {/* Appointment date/time — prominent */}
          <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>
            📅 {dateStr}{timeStr && ` · ${timeStr}`}
          </p>
          {/* Car */}
          {car && (
            <p style={{ margin: "0 0 4px", fontSize: 11, color: "#6b7280" }}>
              {[car.year, car.brand, car.model].filter(Boolean).join(" ")}
            </p>
          )}
          {/* Phone */}
          {apt.buyer_phone && (
            <p style={{ margin: "0 0 4px", fontSize: 11, color: "#4b5563" }}>
              📞 {apt.buyer_phone}
            </p>
          )}
          {/* Notes */}
          {apt.notes && (
            <p style={{ margin: "0 0 8px", fontSize: 10, color: "#4b5563", fontStyle: "italic" }}>
              "{apt.notes}"
            </p>
          )}
          {/* Reminder status */}
          {apt.remind_at && !apt.remind_sent ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 7, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", marginBottom: 8 }}>
              <Bell size={12} color="#4ade80" />
              <span style={{ fontSize: 11, color: "#4ade80", flex: 1 }}>
                Telegram · {new Date(apt.remind_at).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })} at {new Date(apt.remind_at).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <button onClick={() => clearReminder(apt)} style={{ background: "none", border: "none", color: "#f87171", fontSize: 10, cursor: "pointer", padding: 0 }}>Clear</button>
            </div>
          ) : apt.remind_sent ? (
            <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 8 }}>✓ Reminder sent</div>
          ) : null}
          {/* Actions */}
          {isEditing ? (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={reminderMsg}
                onChange={(e) => setReminderMsg(e.target.value)}
                rows={3}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, color: "#e5e7eb", fontSize: 13, padding: "9px 10px", resize: "vertical", lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", marginBottom: 6 }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={async () => {
                    const phone = apt.buyer_phone.replace(/\D/g, "");
                    window.open(`https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${encodeURIComponent(reminderMsg)}`, "_blank", "noopener,noreferrer");
                    setEditingReminder(null);
                    if (apt.status === "pending") { await updateApptStatus(apt.id, "confirmed"); await autoUpsertLeadFromAppt(apt); await scheduleAptReminder(apt); }
                  }}
                  style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#4ade80", cursor: "pointer", fontWeight: 600 }}
                >
                  Send
                </button>
                <button
                  onClick={() => setEditingReminder(null)}
                  style={{ fontSize: 12, padding: "6px 11px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : reschedulingAptId === apt.id ? (
            <div style={{ marginTop: 8 }}>
              <p style={{ margin: "0 0 6px", fontSize: 12, color: "#9ca3af" }}>Pick a new date &amp; time:</p>
              <input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 8, color: "#e5e7eb", fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={async () => {
                    if (!rescheduleDate) return;
                    const newDate = new Date(rescheduleDate);
                    const remindAt = new Date(newDate.getTime() - 60 * 60 * 1000).toISOString();
                    await supabase.from("appointments").update({ appointment_date: newDate.toISOString(), status: "rescheduled", remind_at: remindAt, remind_sent: false }).eq("id", apt.id);
                    setAppointments((p) => p.map((a) => a.id === apt.id ? { ...a, appointment_date: newDate.toISOString(), status: "rescheduled", remind_at: remindAt, remind_sent: false } : a));
                    setReschedulingAptId(null);
                    setRescheduleDate("");
                    toast.success("Appointment rescheduled!");
                  }}
                  style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", color: "#c084fc", cursor: "pointer", fontWeight: 600 }}
                >
                  Confirm Reschedule
                </button>
                <button
                  onClick={() => { setReschedulingAptId(null); setRescheduleDate(""); }}
                  style={{ fontSize: 12, padding: "6px 11px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              {/* Telegram reminder chip picker */}
              {reminderPickerAptId === apt.id ? (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                  <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>Send Telegram reminder</p>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                    {[
                      { key: "1h",        label: "1 hour before" },
                      { key: "2h",        label: "2 hours before" },
                      { key: "day_before", label: "Day before (9am)" },
                      { key: "two_days",  label: "2 days before" },
                    ].map(({ key, label }) => {
                      const t = calcRemindAt(apt, key);
                      const active = selectedRemindAt && t.getTime() === selectedRemindAt.getTime();
                      return (
                        <button key={key} onClick={() => setSelectedRemindAt(t)}
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
                      Cancel
                    </button>
                    <button onClick={() => selectedRemindAt && saveReminder(apt, selectedRemindAt)}
                      disabled={!selectedRemindAt || reminderSaving}
                      style={{ flex: 2, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 600,
                        background: selectedRemindAt ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
                        border: selectedRemindAt ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)",
                        color: selectedRemindAt ? "#4ade80" : "#374151",
                        cursor: selectedRemindAt ? "pointer" : "not-allowed",
                        opacity: reminderSaving ? 0.6 : 1 }}>
                      {reminderSaving ? "Saving…" : "Set reminder"}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setReminderPickerAptId(apt.id); setSelectedRemindAt(null); setEditingReminder(null); }}
                  style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, cursor: "pointer", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                  <Bell size={11} /> Set reminder
                </button>
              )}
              {/* Primary: WA Reminder */}
              {apt.buyer_phone && (
                <button
                  onClick={() => { setEditingReminder(apt.id); setReminderMsg(buildReminderMessage(apt)); }}
                  style={{ width: "100%", fontSize: 12, fontWeight: 600, padding: "8px 0", borderRadius: 7, background: "rgba(37,211,102,0.10)", border: "1px solid rgba(37,211,102,0.25)", color: "#4ade80", cursor: "pointer", marginBottom: 6 }}
                >
                  Send WA Reminder
                </button>
              )}
              {/* Secondary: status actions */}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {apt.status !== "confirmed" && (
                  <button onClick={async () => { await updateApptStatus(apt.id, "confirmed"); await autoUpsertLeadFromAppt(apt); await scheduleAptReminder(apt); }} style={{ fontSize: 11, padding: "5px 11px", borderRadius: 6, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80", cursor: "pointer" }}>
                    Confirm
                  </button>
                )}
                {apt.status !== "rescheduled" && (
                  <button
                    onClick={() => {
                      const existing = apt.appointment_date ? new Date(apt.appointment_date) : new Date();
                      const pad = (n) => String(n).padStart(2, "0");
                      const local = `${existing.getFullYear()}-${pad(existing.getMonth()+1)}-${pad(existing.getDate())}T${pad(existing.getHours())}:${pad(existing.getMinutes())}`;
                      setRescheduleDate(local);
                      setReschedulingAptId(apt.id);
                      setEditingReminder(null);
                    }}
                    style={{ fontSize: 11, padding: "5px 11px", borderRadius: 6, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", color: "#c084fc", cursor: "pointer" }}
                  >
                    Reschedule
                  </button>
                )}
                {apt.status !== "cancelled" && (
                  cancelConfirmId === apt.id ? (
                    <>
                      <button onClick={async () => { await updateApptStatus(apt.id, "cancelled"); setCancelConfirmId(null); }} style={{ fontSize: 11, padding: "5px 11px", borderRadius: 6, background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.5)", color: "#f87171", cursor: "pointer", fontWeight: 600 }}>
                        Confirm Cancel
                      </button>
                      <button onClick={() => setCancelConfirmId(null)} style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setCancelConfirmId(apt.id)} style={{ fontSize: 11, padding: "5px 11px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", cursor: "pointer" }}>
                      Cancel
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div>
        <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>
          Bookings ({appointments.length})
        </p>
        {appointments.length === 0 && (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#374151" }}>
            <Phone size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: 13 }}>No bookings yet.</p>
            <p style={{ margin: "6px 0 14px", fontSize: 12, color: "#374151" }}>Bookings appear when customers book a test drive from your listing.</p>
            <button onClick={() => setActiveTab("listings")} style={{ fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 8, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.22)", color: "#f87171", cursor: "pointer" }}>
              Share a Listing →
            </button>
          </div>
        )}
        {/* Today */}
        {todayApts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5 }}>
              <Calendar size={11} color="#fbbf24" /> Today ({todayApts.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {todayApts.map(renderApptCard)}
            </div>
          </div>
        )}
        {/* Upcoming */}
        {upcomingApts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5 }}>
              <Calendar size={11} color="#60a5fa" /> Upcoming ({upcomingApts.length})
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
                Past ({pastApts.length})
              </span>
              <span style={{ fontSize: 12, color: "#374151" }}>{pastOpen ? "▲" : "▼"}</span>
            </button>
            {pastOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {pastApts.map((apt) => {
                  const car = apt.car_listings;
                  const { dateStr, timeStr } = fmtAptDate(apt.appointment_date);
                  const sc = statusColors[apt.status] || statusColors.pending;
                  const carPhone = [car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : null, apt.buyer_phone ? `📞 ${apt.buyer_phone}` : null].filter(Boolean).join("  ·  ");
                  return (
                    <div key={apt.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 14px", opacity: 0.65 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {apt.buyer_name || "—"}
                        </p>
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, flexShrink: 0, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.tx, textTransform: "capitalize" }}>
                          {apt.status}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 2px", fontSize: 12, color: "#6b7280" }}>
                        📅 {dateStr}{timeStr && ` · ${timeStr}`}
                      </p>
                      {carPhone && (
                        <p style={{ margin: 0, fontSize: 11, color: "#4b5563" }}>{carPhone}</p>
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
      fontFamily: "'DM Sans', sans-serif",
    };

    const localPhone = (settingsForm.whatsapp_number || "").replace(/^\+?60/, "");

    const handleAvatarUpload = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
      if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
      setAvatarUploading(true);
      const ext = file.name.split(".").pop();
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) {
        toast.error("Upload failed: " + upErr.message);
        setAvatarUploading(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const bustedUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: avatarProfileErr } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
      if (avatarProfileErr) console.error("handleAvatarUpload profile update:", avatarProfileErr);
      setAvatarUrl(bustedUrl);
      localStorage.setItem("salesman_lite_avatar", bustedUrl);
      setProfile((p) => ({ ...p, avatar_url: bustedUrl }));
      setAvatarUploading(false);
      toast.success("Profile photo updated");
    };

    const handleSave = async () => {
      setSettingsSaving(true);
      const phone = "+60" + localPhone.replace(/\D/g, "");
      const { error: saveProfileErr } = await supabase
        .from("profiles")
        .update({
          full_name: settingsForm.full_name,
          whatsapp_number: phone,
          telegram_chat_id: settingsForm.telegram_chat_id || null,
          city: settingsForm.city || null,
          state: settingsForm.state || null,
          ic_number: settingsForm.ic_number || null,
          instagram: settingsForm.instagram || null,
          tiktok: settingsForm.tiktok || null,
          facebook: settingsForm.facebook || null,
          website: settingsForm.website || null,
        })
        .eq("id", userId);
      if (saveProfileErr) console.error("handleSave:", saveProfileErr);
      setProfile((p) => ({
        ...p,
        full_name: settingsForm.full_name,
        whatsapp_number: phone,
        telegram_chat_id: settingsForm.telegram_chat_id || null,
        city: settingsForm.city || null,
        state: settingsForm.state || null,
        ic_number: settingsForm.ic_number || null,
        instagram: settingsForm.instagram || null,
        tiktok: settingsForm.tiktok || null,
        facebook: settingsForm.facebook || null,
        website: settingsForm.website || null,
      }));
      setSettingsForm((p) => ({ ...p, whatsapp_number: phone }));
      setSettingsSaving(false);
      toast.success("Profile updated");
    };

    const initials = (profile?.full_name || profile?.slug || "S")[0].toUpperCase();

    return (
      <div style={{ maxWidth: 480 }}>
        <p style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>
          Profile Settings
        </p>

        {/* Avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, padding: "16px", background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
          <div
            style={{ position: "relative", flexShrink: 0, cursor: avatarUploading ? "default" : "pointer" }}
            onClick={() => !avatarUploading && avatarInputRef.current?.click()}
            title="Change profile photo"
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
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{profile?.full_name || profile?.slug || "Your Name"}</p>
            <p style={{ margin: "3px 0 8px", fontSize: 11, color: "#4b5563" }}>Shown on your listings & profile page</p>
            <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer" }}>
              {avatarUploading ? "Uploading…" : "Change photo"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Full Name</label>
            <input
              value={settingsForm.full_name}
              onChange={(e) => setSettingsForm((p) => ({ ...p, full_name: e.target.value }))}
              placeholder="Your full name"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>WhatsApp Number</label>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, overflow: "hidden" }}>
              <span style={{ padding: "10px 12px", fontSize: 13, color: "#6b7280", background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap", flexShrink: 0 }}>+60</span>
              <input
                type="tel"
                value={localPhone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  setSettingsForm((p) => ({ ...p, whatsapp_number: "+60" + digits }));
                }}
                placeholder="123456789"
                style={{ ...inputStyle, background: "transparent", border: "none", borderRadius: 0, flex: 1, width: "auto" }}
              />
            </div>
            <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>Malaysia country code pre-applied. Enter digits only.</p>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: "#6b7280" }}>✈️ Telegram Notifications</label>
              {profile?.telegram_chat_id
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "#4ade80" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />Connected</span>
                : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "#4b5563" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4b5563", display: "inline-block" }} />Not set</span>
              }
            </div>
            <input
              value={settingsForm.telegram_chat_id}
              onChange={(e) => setSettingsForm((p) => ({ ...p, telegram_chat_id: e.target.value }))}
              placeholder="e.g. 123456789"
              style={inputStyle}
            />
            <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151", lineHeight: 1.6 }}>
              How to get your Chat ID: Open Telegram → search{" "}
              <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" style={{ color: "#93c5fd", textDecoration: "none" }}>@userinfobot</a>
              {" "}→ send /start → copy the Id: number shown.
            </p>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Username / Slug</label>
            <input
              value={profile?.slug || ""}
              readOnly
              style={{ ...inputStyle, color: "#4b5563", cursor: "not-allowed", background: "rgba(255,255,255,0.02)" }}
            />
            <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>Contact support to change your username.</p>
          </div>

          {/* Location + IC */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>Location & Identity</p>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5 }}>City</label>
                <input value={settingsForm.city} onChange={(e) => setSettingsForm((p) => ({ ...p, city: e.target.value }))} placeholder="Kuala Lumpur" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5 }}>State</label>
                <select value={settingsForm.state} onChange={(e) => setSettingsForm((p) => ({ ...p, state: e.target.value }))}
                  style={{ ...inputStyle, appearance: "none" }}>
                  <option value="">Select state</option>
                  {["Johor","Kedah","Kelantan","Kuala Lumpur","Labuan","Melaka","Negeri Sembilan","Pahang","Penang","Perak","Perlis","Putrajaya","Sabah","Sarawak","Selangor","Terengganu"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5 }}>IC Number <span style={{ color: "#4b5563" }}>(private — admin only)</span></label>
              <input value={settingsForm.ic_number} onChange={(e) => setSettingsForm((p) => ({ ...p, ic_number: e.target.value }))} placeholder="e.g. 901231-14-1234" style={inputStyle} />
              <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>Required for verification. Never shown publicly.</p>
            </div>
          </div>

          {/* Social links */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>Social Links</p>
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
            {settingsSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    );
  };

  // ── RENDER MERGE ──────────────────────────────────────────────────────────

  const renderMerge = () => (
    <div style={{ maxWidth: 480 }}>
      <p
        style={{
          margin: "0 0 6px",
          fontSize: 16,
          fontWeight: 600,
          color: "#f1f5f9",
        }}
      >
        Join a Dealership
      </p>
      <p
        style={{
          margin: "0 0 24px",
          fontSize: 13,
          color: "#4b5563",
          lineHeight: 1.6,
        }}
      >
        Got an invite code from your dealer? Enter it below to merge your
        account into their ShiftOS system.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          value={mergeCode}
          onChange={(e) => setMergeCode(e.target.value.toUpperCase())}
          placeholder="Enter invite code e.g. DEALER-XXXX"
          disabled={mergeStatus === "pending" || mergeStatus === "success"}
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
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
        <button
          onClick={handleMerge}
          disabled={
            !mergeCode.trim() ||
            mergeStatus === "pending" ||
            mergeStatus === "success"
          }
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            background: mergeStatus === "success" ? "#16a34a" : "#dc2626",
            border: "none",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            opacity: !mergeCode.trim() || mergeStatus === "pending" ? 0.6 : 1,
          }}
        >
          {mergeStatus === "pending"
            ? "Verifying..."
            : mergeStatus === "success"
              ? "Merged!"
              : "Request Merge"}
        </button>
      </div>

      {mergeStatus === "error" && (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8,
          }}
        >
          <AlertCircle size={14} style={{ color: "#f87171", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>
            {mergeMsg}
          </p>
        </div>
      )}

      {mergeStatus === "success" && (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 8,
          }}
        >
          <CheckCircle2 size={14} style={{ color: "#4ade80", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: "#4ade80" }}>
            {mergeMsg}
          </p>
        </div>
      )}

      <p
        style={{
          marginTop: 24,
          fontSize: 12,
          color: "#374151",
          lineHeight: 1.6,
        }}
      >
        Don't have a code? Ask your dealer to generate one from their ShiftOS
        Settings panel.
      </p>
    </div>
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
                Add Lead
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
                { key: "buyer_name", label: "Name", placeholder: "Buyer name" },
                {
                  key: "phone",
                  label: "Phone",
                  placeholder: "e.g. 0123456789",
                },
                { key: "notes", label: "Notes", placeholder: "Any notes..." },
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
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>
                  Car (optional)
                </label>
                <select
                  value={addLeadForm.car_listing_id}
                  onChange={(e) => setAddLeadForm((p) => ({ ...p, car_listing_id: e.target.value }))}
                  style={{ width: "100%", background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e5e7eb", fontSize: 13, padding: "9px 12px", outline: "none", fontFamily: "'DM Sans', sans-serif" }}
                >
                  <option value="">— no car selected —</option>
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
                  State (optional)
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
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <option value="">— select state —</option>
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
              {addLeadSaving ? "Saving..." : "Add Lead"}
            </button>
          </div>
        </div>
      </div>
    );

  // ── LOG CALL MODAL ────────────────────────────────────────────────────────

  const renderLogCallModal = () => logCallLeadId && (() => {
    const lead = leads.find((l) => l.id === logCallLeadId);
    const OUTCOMES = [
      { key: "answered", label: "✅ Answered", color: "#4ade80" },
      { key: "no_answer", label: "📵 No Answer", color: "#f87171" },
      { key: "callback_requested", label: "🔁 Callback Requested", color: "#fbbf24" },
      { key: "voicemail", label: "📬 Left Voicemail", color: "#94a3b8" },
    ];
    return (
      <div onClick={() => setLogCallLeadId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px 16px 0 0", padding: "20px 20px 32px", width: "100%", maxWidth: 480 }}>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Log Call</p>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "#4b5563" }}>{lead?.buyer_name || "—"} · {lead?.phone || "—"}</p>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Outcome</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {OUTCOMES.map((o) => (
              <button key={o.key} onClick={() => setCallOutcome(o.key)} style={{ padding: "10px 12px", borderRadius: 9, fontSize: 12, fontWeight: 600, textAlign: "left", cursor: "pointer", background: callOutcome === o.key ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", border: callOutcome === o.key ? `1px solid ${o.color}40` : "1px solid rgba(255,255,255,0.07)", color: callOutcome === o.key ? o.color : "#6b7280" }}>
                {o.label}
              </button>
            ))}
          </div>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Note (optional)</p>
          <input value={callNote} onChange={(e) => setCallNote(e.target.value)} placeholder="e.g. Will visit showroom Saturday" style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, color: "#e5e7eb", fontSize: 13, padding: "10px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setLogCallLeadId(null)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={logCall} disabled={callSaving} style={{ flex: 2, padding: "11px 0", borderRadius: 10, background: "#dc2626", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: callSaving ? "not-allowed" : "pointer", opacity: callSaving ? 0.6 : 1 }}>
              {callSaving ? "Saving…" : "Log Call"}
            </button>
          </div>
        </div>
      </div>
    );
  })();

  // ── BATCH WA MODAL ─────────────────────────────────────────────────────────

  const renderBatchWAModal = () => {
    if (!batchWALeads || batchWALeads.length === 0) return null;
    const current = batchWALeads[batchWAIdx];
    if (!current) return null;
    const car = current.car_listings;
    const waPhone = (current.phone || '').replace(/\D/g, '');
    const waNum = waPhone.startsWith('6') ? waPhone : '6' + waPhone;
    const carName = car ? `${car.brand} ${car.model}` : 'kereta tu';
    const isStale = current.updated_at && Date.now() - new Date(current.updated_at).getTime() > 48 * 3600 * 1000;
    const msg = isStale
      ? `Hi ${current.buyer_name || 'kawan'}! Ada orang lain tengah tanya pasal ${carName} ni — kalau you still interested, jom lock dulu sebelum terlambat 🔒`
      : `Hi ${current.buyer_name || 'kawan'}! Macam mana, still interested dalam ${carName} tu? Jom kita discuss lagi 😊`;
    const advance = () => {
      if (batchWAIdx < batchWALeads.length - 1) setBatchWAIdx(i => i + 1);
      else setBatchWALeads(null);
    };
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px 16px 0 0", padding: "20px 20px 32px", width: "100%", maxWidth: 480 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Follow-up Blast</p>
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
              {car ? `${car.brand} ${car.model}` : "No car linked"} · Last contact {timeAgo(current.updated_at)}
            </p>
          </div>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "#6b7280", lineHeight: 1.6, padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
            {msg}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, "_blank"); advance(); }}
              style={{ flex: 2, padding: "11px", borderRadius: 9, background: "#25D366", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              WA {current.buyer_name?.split(' ')[0] || 'Lead'} →
            </button>
            <button
              onClick={advance}
              style={{ flex: 1, padding: "11px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              Skip
            </button>
          </div>
          <button onClick={() => setBatchWALeads(null)} style={{ width: "100%", marginTop: 10, padding: "8px", background: "none", border: "none", color: "#374151", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            Stop — done for now
          </button>
        </div>
      </div>
    );
  };

  // ── FOLLOW-UP MODAL ────────────────────────────────────────────────────────

  const renderFollowUpModal = () => followUpModalLead && (
    <div onClick={() => setFollowUpModalLead(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px 16px 0 0", padding: "20px 20px 32px", width: "100%", maxWidth: 480 }}>
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Set Follow-up Reminder</p>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#4b5563" }}>{followUpModalLead.buyer_name || "—"}</p>
        <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Remind me on</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {[
            { label: "Tomorrow", days: 1 },
            { label: "In 2 days", days: 2 },
            { label: "In 3 days", days: 3 },
            { label: "Next week", days: 7 },
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
        <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, color: "#e5e7eb", fontSize: 13, padding: "10px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14 }} />
        <div style={{ display: "flex", gap: 8 }}>
          {followUpModalLead.follow_up_at && (
            <button onClick={() => saveFollowUp(followUpModalLead.id, null)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Clear</button>
          )}
          <button onClick={() => setFollowUpModalLead(null)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => followUpDate && saveFollowUp(followUpModalLead.id, followUpDate)} disabled={!followUpDate || followUpSaving} style={{ flex: 2, padding: "11px 0", borderRadius: 10, background: "#dc2626", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: (!followUpDate || followUpSaving) ? "not-allowed" : "pointer", opacity: (!followUpDate || followUpSaving) ? 0.5 : 1 }}>
            {followUpSaving ? "Saving…" : "Set Reminder"}
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
              Send WA Message
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
              fontFamily: "'DM Sans', sans-serif",
              resize: "vertical",
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={async () => {
              const now = new Date().toISOString();
              const { error: waTouchErr } = await supabase
                .from("leads").update({ updated_at: now }).eq("id", waModalLead.id);
              if (waTouchErr) { console.error("waModal leads update:", waTouchErr); toast.error("Failed to log message"); return; }
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
              toast("WA sent!", {
                description: "Did you also call them?",
                action: { label: "Log Call", onClick: () => { setLogCallLeadId(savedLeadId); setCallOutcome("answered"); setCallNote(""); } },
                duration: 5000,
              });
              const phone = (waModalLead.phone || "").replace(/\D/g, "");
              if (phone) {
                window.open(
                  `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${encodeURIComponent(waModalMsg)}`,
                  "_blank", "noopener,noreferrer",
                );
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
            Send
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
              No phone number on this lead.
            </p>
          )}
        </div>
      </div>
    );

  // ── TOUR ─────────────────────────────────────────────────────────────────

  const TOUR_STEPS = [
    { emoji: "👋", title: "Welcome to ShiftOS Lite", body: "Quick 30-second tour. Each step takes you to the real panel so you can see it live." },
    { emoji: "📊", title: "Dashboard", body: "Your command centre — KPIs, stale follow-up nudges, listing performance, and recent activity all in one view." },
    { emoji: "🚗", title: "My Listings", body: "Add your cars here. Each card shows views, WA taps, and a CVR bar. 🔥 = buyers are clicking. 💤 = needs a refresh or price drop." },
    { emoji: "👥", title: "Leads", body: "Track every buyer: New → Contacted → Test Drive → Won. Heat scores show who needs attention. Ping stale leads straight to WhatsApp." },
    { emoji: "💬", title: "Enquiries", body: "Buyers who messaged through your listing cards land here. Reply with templates or convert them into pipeline leads in one tap." },
    { emoji: "📅", title: "Bookings", body: "Viewing appointments appear here. Confirm, cancel, or send a WA reminder without leaving the app." },
    { emoji: "🔗", title: "Join a Dealership", body: "Have an invite code from your dealer? Enter it here to unlock the full panel — shared stock, team leads, commission tracking and more." },
  ];

  const dismissTour = async () => {
    const { error: tourErr } = await supabase
      .from("profiles").update({ onboarding_tour_done: true }).eq("id", userId);
    if (tourErr) { console.error("dismissTour:", tourErr); return; }
    setTourStep(null);
    setTourTarget(null);
    setProfile((p) => ({ ...p, onboarding_tour_done: true }));
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
      // Mobile: nav at bottom → bubble sits above the highlighted tab
      const centerX = tourTarget.left + tourTarget.width / 2;
      const bubbleLeft = Math.max(8, Math.min(centerX - BUBBLE_W / 2, window.innerWidth - BUBBLE_W - 8));
      bubbleStyle = {
        position: "fixed",
        bottom: window.innerHeight - tourTarget.top + PAD,
        left: bubbleLeft,
        width: BUBBLE_W,
        zIndex: 1002,
      };
      // Arrow pointing down toward the tab
      const arrowLeft = centerX - bubbleLeft - 8;
      arrowEl = (
        <div style={{
          position: "absolute",
          bottom: -8,
          left: Math.max(12, Math.min(arrowLeft, BUBBLE_W - 28)),
          width: 0,
          height: 0,
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: "8px solid #1e2d3d",
        }} />
      );
    } else {
      // Desktop: sidebar at left → bubble sits to the right of the highlighted item
      const topPos = Math.max(8, Math.min(tourTarget.top + tourTarget.height / 2 - 80, window.innerHeight - 220));
      bubbleStyle = {
        position: "fixed",
        top: topPos,
        left: tourTarget.right + PAD,
        width: BUBBLE_W,
        zIndex: 1002,
      };
      // Arrow pointing left toward the sidebar item
      arrowEl = (
        <div style={{
          position: "absolute",
          left: -8,
          top: Math.min(60, tourTarget.height / 2 + 8),
          width: 0,
          height: 0,
          borderTop: "8px solid transparent",
          borderBottom: "8px solid transparent",
          borderRight: "8px solid #1e2d3d",
        }} />
      );
    }

    return (
      <>
        {/* Highlight ring around the target nav item — no backdrop */}
        {tourTarget && !isWelcome && (
          <div
            style={{
              position: "fixed",
              left: tourTarget.left - 3,
              top: tourTarget.top - 3,
              width: tourTarget.width + 6,
              height: tourTarget.height + 6,
              borderRadius: isMobile ? 8 : 10,
              border: "2px solid #dc2626",
              boxShadow: "0 0 0 4px rgba(220,38,38,0.18), 0 0 16px rgba(220,38,38,0.2)",
              pointerEvents: "none",
              zIndex: 1001,
              transition: "all 0.25s ease",
            }}
          />
        )}

        {/* Bubble */}
        <div
          style={{
            ...bubbleStyle,
            background: "#111827",
            border: "1px solid rgba(220,38,38,0.22)",
            borderRadius: 14,
            padding: "18px 18px 14px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
            animation: "tourPop 0.18s ease",
          }}
        >
          <style>{`@keyframes tourPop{from{opacity:0;transform:${isWelcome ? "translate(-50%,-48%)" : "scale(0.95)"}}to{opacity:1;transform:${isWelcome ? "translate(-50%,-50%)" : "scale(1)"}}}`}</style>
          {arrowEl}

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ fontSize: 20 }}>{step.emoji}</span>
              <div>
                <p style={{ margin: 0, fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  {tourStep + 1} / {TOUR_STEPS.length}
                </p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{step.title}</p>
              </div>
            </div>
            <button onClick={dismissTour} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 2 }}>✕</button>
          </div>

          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6 }}>
            {step.body}
          </p>

          {/* Progress bar */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {TOUR_STEPS.map((_, i) => (
              <div key={i} style={{ height: 2, flex: i === tourStep ? 2 : 1, borderRadius: 99, background: i <= tourStep ? "#dc2626" : "rgba(255,255,255,0.08)", transition: "flex 0.25s" }} />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {tourStep > 0 && (
              <button onClick={() => setTourStep((s) => s - 1)} style={{ padding: "7px 12px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", fontSize: 12, cursor: "pointer" }}>
                ← Back
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={dismissTour} style={{ background: "none", border: "none", color: "#4b5563", fontSize: 11, cursor: "pointer", padding: "7px 6px" }}>
              Skip
            </button>
            <button
              onClick={() => isLast ? dismissTour() : setTourStep((s) => s + 1)}
              style={{ padding: "7px 16px", borderRadius: 7, background: "#dc2626", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {isLast ? "Got it 🎉" : "Next →"}
            </button>
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

  // ── PENDING APPROVAL GATE ─────────────────────────────────────────────────
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

  // ── MAIN RENDER ───────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        minHeight: "100vh",
        fontFamily: "'DM Sans', sans-serif",
        color: "#fff",
      }}
    >
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes pulse-green{ 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.45;transform:scale(0.8)} }
        @keyframes live-glow{ 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.4)} 50%{box-shadow:0 0 0 5px rgba(16,185,129,0)} }
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
              onClick={handleLogout}
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
              <button
                onClick={() => setTourStep(0)}
                title="Show tour"
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
                onClick={handleLogout}
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
                      ? "Good morning"
                      : h < 17
                        ? "Good afternoon"
                        : "Good evening";
                  })()}
                  , {profile?.full_name?.split(" ")[0] || "there"} 👋
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
                  · Lite Panel
                </p>
              </div>
              <button
                onClick={() => setNotifOpen((v) => !v)}
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
                <Plus size={14} /> Add Lead
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
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "listings" && renderListings()}
          {activeTab === "leads" && renderLeads()}
          {activeTab === "performance" && renderPerformance()}
          {activeTab === "enquiries" && (
            <div>
              {/* Sub-tab switcher */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {[
                  { key: "enquiries", label: "Enquiries", badge: enquiries.filter((e) => e.status === "new").length },
                  { key: "bookings", label: "Bookings", badge: newBookingsCount },
                ].map(({ key, label, badge }) => (
                  <button
                    key={key}
                    onClick={() => { setInboxSubTab(key); if (key === "bookings") setNewBookingsCount(0); }}
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
          )}
          {activeTab === "merge" && renderMerge()}
          {activeTab === "settings" && renderSettings()}
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

      {/* ── Test Drive outcome confirmation ── */}
      {testDriveConfirm && (() => {
        const { lead: tdLead, nextStage: tdNext } = testDriveConfirm;
        const car = tdLead.car_listings;
        const carName = car ? `${car.brand} ${car.model}` : "the car";
        const dismiss = () => setTestDriveConfirm(null);
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
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>🚗</div>
              <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>How did the test drive go?</p>
              <p style={{ margin: "0 0 24px", fontSize: 13, color: "#6b7280" }}>{tdLead.buyer_name || "Buyer"} · {carName}</p>
              {/* options */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={proceed}
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}
                >
                  <span style={{ fontSize: 20 }}>👍</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: "#f1f5f9" }}>They're interested — move forward</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>Advance to {tdNext.replace(/_/g, " ")}</p>
                  </div>
                </button>
                <button
                  onClick={markLost}
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}
                >
                  <span style={{ fontSize: 20 }}>👎</span>
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
      {renderFollowUpModal()}
      {renderNotifPanel()}
      {renderCarDetailPopup()}
      {renderTour()}

      {/* Broadcast modal */}
      {broadcastCar &&
        (() => {
          const eligible = leads.filter(
            (l) =>
              l.stage !== "won" &&
              l.stage !== "lost" &&
              (l.phone || "").replace(/\D/g, "").length > 0,
          );
          const capped = eligible.slice(0, 10);
          const carName = [
            broadcastCar.year,
            broadcastCar.brand,
            broadcastCar.model,
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              onClick={() => {
                if (!broadcastProgress || broadcastDone) setBroadcastCar(null);
              }}
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
                  borderRadius: "16px 16px 0 0",
                  width: "100%",
                  maxWidth: 480,
                  padding: 24,
                  paddingBottom: 36,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-orange-400" />
                    <p className="text-white font-semibold text-sm">
                      Broadcast to Leads
                    </p>
                  </div>
                  {(!broadcastProgress || broadcastDone) && (
                    <button
                      onClick={() => setBroadcastCar(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <p className="text-gray-400 text-xs mb-4">{carName}</p>

                <div
                  className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg"
                  style={{
                    background: "rgba(249,115,22,0.08)",
                    border: "1px solid rgba(249,115,22,0.2)",
                  }}
                >
                  <AlertCircle className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-orange-300">
                    {eligible.length === 0
                      ? "No active leads with a phone number to broadcast to."
                      : eligible.length > 10
                        ? `This will open ${capped.length} WhatsApp tabs (capped from ${eligible.length} — only first 10 will be contacted).`
                        : `This will open ${capped.length} WhatsApp tab${capped.length !== 1 ? "s" : ""}.`}
                  </p>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      color: "#9ca3af",
                    }}
                  >
                    {eligible.length} eligible lead
                    {eligible.length !== 1 ? "s" : ""} (not won/lost)
                  </span>
                </div>

                <p style={{ fontSize: 10, color: "#4b5563", margin: "0 0 4px" }}>Edit message before sending — personalise it 👇</p>
                <textarea
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  disabled={!!broadcastProgress && !broadcastDone}
                  rows={7}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 10,
                    color: "#e5e7eb",
                    fontSize: 12,
                    lineHeight: 1.6,
                    padding: "10px 12px",
                    resize: "vertical",
                    outline: "none",
                    marginBottom: 4,
                    fontFamily: "inherit",
                  }}
                />
                <p style={{ fontSize: 10, color: "#374151", textAlign: "right", margin: "0 0 8px" }}>{broadcastMsg.length} chars</p>

                {broadcastDone ? (
                  <div className="flex items-center gap-2 justify-center py-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <p className="text-green-400 text-sm font-medium">
                      All {capped.length} tabs opened!
                    </p>
                  </div>
                ) : broadcastProgress ? (
                  <div style={{ textAlign: "center", paddingTop: 8, paddingBottom: 8 }}>
                    <p style={{ margin: "0 0 8px", color: "#fdba74", fontSize: 13, fontWeight: 500 }}>
                      Opening {broadcastProgress.current} of {broadcastProgress.total}…
                    </p>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ height: "100%", width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%`, background: "#f97316", transition: "width 0.3s ease", borderRadius: 99 }} />
                    </div>
                    <button
                      onClick={() => { broadcastCancelRef.current = true; setBroadcastProgress(null); setBroadcastDone(false); }}
                      style={{ fontSize: 11, padding: "4px 14px", borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      eligible.length > 0 && runBroadcast(eligible)
                    }
                    disabled={eligible.length === 0}
                    style={{
                      width: "100%",
                      padding: "11px 0",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      background:
                        eligible.length === 0
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(249,115,22,0.18)",
                      border:
                        eligible.length === 0
                          ? "1px solid rgba(255,255,255,0.08)"
                          : "1px solid rgba(249,115,22,0.4)",
                      color: eligible.length === 0 ? "#6b7280" : "#fb923c",
                      cursor: eligible.length === 0 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Send className="w-4 h-4" />
                    Open WA for each lead
                  </button>
                )}
              </div>
            </div>
          );
        })()}

      {/* AI Caption modal */}
      {aiCaptionCar && (
        <div
          onClick={() => setAiCaptionCar(null)}
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
              borderRadius: "16px 16px 0 0",
              width: "100%",
              maxWidth: 480,
              padding: 24,
              paddingBottom: 36,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-semibold text-sm">
                  AI Caption Writer
                </p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {[aiCaptionCar.year, aiCaptionCar.brand, aiCaptionCar.model]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              </div>
              <button
                onClick={() => setAiCaptionCar(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              {["wa", "tiktok"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setAiCaptionTab(tab);
                    setCaptionCopied(false);
                  }}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    border:
                      aiCaptionTab === tab
                        ? "1px solid rgba(168,85,247,0.5)"
                        : "1px solid rgba(255,255,255,0.08)",
                    background:
                      aiCaptionTab === tab
                        ? "rgba(168,85,247,0.15)"
                        : "rgba(255,255,255,0.04)",
                    color: aiCaptionTab === tab ? "#c084fc" : "#9ca3af",
                  }}
                >
                  {tab === "wa" ? "WhatsApp" : "TikTok"}
                </button>
              ))}
            </div>

            {aiCaptionLoading ? (
              <div className="space-y-2">
                {[70, 90, 55, 80].map((w, i) => (
                  <div
                    key={i}
                    style={{
                      height: 18,
                      width: `${w}%`,
                      background: "rgba(255,255,255,0.07)",
                      borderRadius: 4,
                      animation: "pulse 1.5s infinite",
                    }}
                  />
                ))}
              </div>
            ) : (
              <>
                {aiCaptions[aiCaptionCar.id]?.[aiCaptionTab]?.startsWith("Couldn't") && (
                  <div style={{ padding: "8px 12px", marginBottom: 8, borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 12 }}>
                    ⚠️ Caption generation failed. Check that AI tokens are configured, then tap Regenerate.
                  </div>
                )}
                <textarea
                  value={aiCaptions[aiCaptionCar.id]?.[aiCaptionTab]?.startsWith("Couldn't") ? "" : (aiCaptions[aiCaptionCar.id]?.[aiCaptionTab] ?? "")}
                  onChange={(e) =>
                    setAiCaptions((p) => ({
                      ...p,
                      [aiCaptionCar.id]: {
                        ...p[aiCaptionCar.id],
                        [aiCaptionTab]: e.target.value,
                      },
                    }))
                  }
                  rows={6}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 10,
                    color: "#e5e7eb",
                    fontSize: 13,
                    lineHeight: 1.6,
                    padding: "10px 12px",
                    resize: "vertical",
                    outline: "none",
                  }}
                />
              </>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  const text =
                    aiCaptions[aiCaptionCar.id]?.[aiCaptionTab] ?? "";
                  navigator.clipboard.writeText(text);
                  setCaptionCopied(true);
                  setTimeout(() => setCaptionCopied(false), 2000);
                }}
                disabled={aiCaptionLoading || !aiCaptions[aiCaptionCar.id]}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  background: captionCopied
                    ? "rgba(34,197,94,0.15)"
                    : "rgba(168,85,247,0.15)",
                  border: captionCopied
                    ? "1px solid rgba(34,197,94,0.4)"
                    : "1px solid rgba(168,85,247,0.4)",
                  color: captionCopied ? "#4ade80" : "#c084fc",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {captionCopied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {captionCopied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => {
                  setAiCaptions((p) => {
                    const next = { ...p };
                    delete next[aiCaptionCar.id];
                    return next;
                  });
                  generateAiCaptions(aiCaptionCar, true);
                }}
                disabled={aiCaptionLoading}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#9ca3af",
                  cursor: aiCaptionLoading ? "not-allowed" : "pointer",
                  opacity: aiCaptionLoading ? 0.4 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TikTok Studio modal */}
      {editListing && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
        >
          <div
            style={{
              background: "#0d1117",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: isMobile ? "16px 16px 0 0" : 16,
              width: "100%",
              maxWidth: 672,
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                flexShrink: 0,
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 600,
                    color: "#f1f5f9",
                    fontSize: 15,
                  }}
                >
                  Edit Listing
                </p>
                <p
                  style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}
                >
                  {editListing.brand} {editListing.model}{" "}
                  {editListing.variant || ""}
                </p>
              </div>
              <button
                onClick={() => setEditListing(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: 20 }}>
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
            </div>
          </div>
        </div>
      )}

      {/* ── Boost modal ── */}
      {boostCarId && (() => {
        const car = myListings.find(c => c.id === boostCarId);
        const name = car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : "this listing";
        return (
          <div onClick={() => setBoostCarId(null)} style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#0d1117", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 16, padding: 24, maxWidth: 320, width: "100%", fontFamily: "'DM Sans',sans-serif" }}>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
                <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#e5e7eb" }}>Boost this listing</p>
                <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>Pin <strong style={{ color: "#c4b5fd" }}>{name}</strong> to the top of XDrive search for 7 days and get up to 5× more views.</p>
              </div>
              <div style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#a78bfa" }}>⚡ Coming soon — Premium feature</p>
                <p style={{ margin: 0, fontSize: 11, color: "#4b5563" }}>Join the waitlist and we'll notify you when Boost launches.</p>
              </div>
              {boostWaitlisted ? (
                <p style={{ textAlign: "center", fontSize: 13, color: "#4ade80", fontWeight: 600, margin: "0 0 12px" }}>✓ You're on the waitlist!</p>
              ) : (
                <button
                  onClick={() => {
                    const msg = encodeURIComponent(`Hi! I want to join the Boost waitlist for my XDrive listing: ${name}`);
                    const waNum = "60123456789";
                    window.open(`https://wa.me/${waNum}?text=${msg}`, "_blank");
                    setBoostWaitlisted(true);
                  }}
                  style={{ width: "100%", padding: "10px", borderRadius: 9, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.35)", color: "#c4b5fd", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 10, fontFamily: "inherit" }}
                >Join Waitlist →</button>
              )}
              <button onClick={() => setBoostCarId(null)} style={{ width: "100%", padding: "8px", borderRadius: 9, background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: "#4b5563", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Maybe later</button>
            </div>
          </div>
        );
      })()}

      {tiktokListing && (
        <div
          style={
            isMobile
              ? {
                  position: "fixed",
                  inset: 0,
                  zIndex: 9999,
                  overflowY: "auto",
                  borderRadius: 0,
                }
              : {}
          }
        >
          <TikTokStudioV3
            listing={tiktokListing}
            onClose={() => setTiktokListing(null)}
          />
        </div>
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
                <p style={{ margin: 0, fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}>Loan Calculator</p>
                <button onClick={() => setLoanCalcLead(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}><X size={18} /></button>
              </div>
              {car && <p style={{ margin: "0 0 14px", fontSize: 11, color: "#4b5563" }}>{loanCalcLead.buyer_name || "Lead"} · {car.year} {car.brand} {car.model}</p>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[
                  { label: "Price (RM)", value: loanPrice, set: setLoanPrice, placeholder: "e.g. 85000" },
                  { label: "Down Payment (%)", value: loanDown, set: setLoanDown, placeholder: "e.g. 10" },
                  { label: "Interest Rate (%)", value: loanRate, set: setLoanRate, placeholder: "e.g. 3.5" },
                  { label: "Tenure (years)", value: loanYears, set: setLoanYears, placeholder: "e.g. 7" },
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
                    <p style={{ margin: "0 0 2px", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Est. Monthly</p>
                    <p style={{ margin: 0, fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#fbbf24", letterSpacing: 1 }}>RM {monthly.toLocaleString()}</p>
                    <p style={{ margin: 0, fontSize: 10, color: "#4b5563" }}>{loanYears}yr · {loanRate}% · {loanDown}% down</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                    {tenures.map(t => {
                      const m = Math.round(principal * (1 + r * t) / (t * 12));
                      return (
                        <div key={t} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                          <p style={{ margin: "0 0 2px", fontSize: 9, color: "#4b5563", textTransform: "uppercase" }}>{t} yrs</p>
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
                    Send via WhatsApp
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
                <p style={{ margin: 0, fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}>Deposit Receipt</p>
                <button onClick={() => setDepositModal(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}><X size={18} /></button>
              </div>
              <p style={{ margin: "0 0 14px", fontSize: 11, color: "#4b5563" }}>{lead.buyer_name || "Lead"} · {carName}</p>
              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: "0 0 4px", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Deposit Amount (RM)</p>
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
                  {depositCopied ? "Copied ✓" : "Copy Text"}
                </button>
                <button
                  onClick={() => {
                    const phone = (lead.phone || "").replace(/\D/g, "");
                    if (phone) window.open(`https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${encodeURIComponent(receipt)}`, "_blank", "noopener,noreferrer");
                    setDepositModal(null);
                  }}
                  style={{ padding: "10px 0", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.3)", color: "#4ade80", cursor: "pointer" }}
                >
                  Send via WA
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
                <p style={{ margin: 0, fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}>Link Car to Lead</p>
                <button onClick={() => setLinkCarLeadId(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}><X size={18} /></button>
              </div>
              {lead?.buyer_name && (
                <p style={{ margin: "0 0 14px", fontSize: 11, color: "#4b5563" }}>{lead.buyer_name}</p>
              )}
              {available.length === 0 ? (
                <p style={{ fontSize: 12, color: "#4b5563", textAlign: "center", padding: "24px 0" }}>No listings yet. Add a listing first.</p>
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
                          ? <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 600, flexShrink: 0 }}>✓ Linked</span>
                          : <button onClick={() => handleLinkCar(linkCarLeadId, car.id)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.22)", color: "#f87171", cursor: "pointer", flexShrink: 0, fontWeight: 600 }}>Link →</button>
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
    </div>
  );
}
