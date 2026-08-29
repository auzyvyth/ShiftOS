import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { AreaChart, Area, ResponsiveContainer, Tooltip as RTooltip, XAxis } from "recharts";
import { Helmet } from "react-helmet";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "../supabaseClient";
import { getDealerIdFromProfile } from "../hooks/useProfile";
import useHandover from "../hooks/useHandover";
import { useHideOnScroll } from "../hooks/useHideOnScroll";
import { placeTourCard } from "../utils/tourPlacement";
import { normalizePhone } from "../lib/phone";
import SuspendedBanner from "../components/SuspendedBanner";
import { readHandoffTokens, clearHandoffTokens } from "../lib/authHandoff";
import { freshChannel } from "../lib/realtime";
import { compressImageFile } from "../utils/compressImage";
import CarFormFast from "../components/CarFormFast";
import CarForm from "../components/CarForm";
import DealerPendingApproval from "../components/DealerPendingApproval";
import AvailabilityEditor from "../components/AvailabilityEditor";
// Lazy — each of these is a self-contained tab/section that shouldn't ship in
// the initial SalesmanPremium chunk. See src/pages/salesmanPremium/ for the
// tab-by-tab split (Dashboard/Listings/Analytics so far).
const PostSaleBoard = React.lazy(() => import("../components/postsale/PostSaleBoard"));
const DashboardTab = React.lazy(() => import("./salesmanPremium/DashboardTab"));
const ListingsTab = React.lazy(() => import("./salesmanPremium/ListingsTab"));
// Same module as ListingsTab (named export, not default) — sharing the import()
// specifier means bundlers put both in the one chunk, so this doesn't cost a
// second network request beyond what opening the Listings tab already pays.
const CarDetailPopup = React.lazy(() =>
 import("./salesmanPremium/ListingsTab").then((m) => ({ default: m.CarDetailPopup })),
);
const AnalyticsTab = React.lazy(() => import("./salesmanPremium/AnalyticsTab"));
import {
 LogOut,
 Copy,
 Check,
 Car,
 Plus,
 User,
 Phone,
 X,
 Menu,
 LayoutGrid,
 Users,
 MessageSquare,
 Megaphone,
 AlertCircle,
 CheckCircle2,
 Trash2,
 Send,
 Pencil,
 Settings,
 Bell,
 TrendingUp,
 Banknote,
 Calendar,
 ChevronDown,
 ChevronUp,
 ArrowUpDown,
 ZoomIn,
 ChevronLeft,
 ChevronRight,
 MapPin,
 Droplets,
 Palette,
 Gauge,
 Sparkles,
 Eye,
 Flame,
 Snowflake,
 BarChart2,
 PhoneOff,
 RefreshCw,
 Voicemail,
 CheckCircle,
 Pin,
 PhoneCall,
 History,
 Search,
 DollarSign,
 ShieldCheck,
 ThumbsUp,
 ThumbsDown,
 Clock,
 Package,
 ExternalLink,
 Store,
 Camera,
 Zap,
 MessageCircle,
 ClipboardList,
  Mail,
} from "lucide-react";
import { callClaude } from "../lib/callClaude";
const OutreachHub = React.lazy(() => import("../components/crm/OutreachHub"));
import ThisWeek from "../components/crm/ThisWeek";
import ServicePackages from "../components/crm/ServicePackages";
import { useServicePackages } from "../hooks/useServicePackages";
import { useNudges } from "../hooks/useNudges";
const SellerInbox = React.lazy(() => import("../components/chat/SellerInbox"));
const ChatSheet = React.lazy(() => import("../components/chat/ChatSheet"));
import { useChatThreads } from "../hooks/useChat";
import UpgradeBanner from "../components/ai/UpgradeBanner";
import AiLoadingState from "../components/ai/AiLoadingState";
import AiQuotaBadge from "../components/ai/AiQuotaBadge";
import PushToggle from "../components/PushToggle";
const ServicesAddonsTab = React.lazy(() => import("../components/salesman/ServicesAddonsTab"));
const LoanDesk = React.lazy(() => import("../components/loans/LoanDesk"));
// Every query that loads a lead uses this. The lead drawer renders the linked
// car in full, so the join has to carry the display fields up front (overlay
// rule 4) — and there are five call sites, which is exactly how many places a
// missing field would have had to be added by hand.
const LEAD_SELECT = "*, car_listings(id, slug, brand, model, year, variant, selling_price, images, mileage, transmission, colour, status)";
import ChannelBreakdown from "../components/ChannelBreakdown";
import ShareMenu from "../components/ShareMenu";
import { panel as C, panelType as T, panelRadius as R, panelStageHue, withAlpha } from "../theme/tokens";
import { HIGH_VALUE_THRESHOLD } from "../utils/financing";
// Style tokens, formatters, and small shared components (SOFT/CARD/STAGE_COLOR/
// SubTabs/PrevMonthModal/etc.) live here so DashboardTab/ListingsTab/AnalyticsTab
// (and the shell below) import the same definitions instead of duplicating them.
import {
 priceStyle, SOFT, CARD, CARD_HEADER, ROW_LINE, EYEBROW, STAT, PrevMonthModal,
 timeAgo, preciseAgo, preciseUntil, timeLabels, STAGE_NEUTRAL, STATUS_LABEL,
 LEAD_STAGES, STAGE_COLOR, STAGE_WEIGHT, getHeatScore, LOST_REASONS, SubTabs,
} from "./salesmanPremium/shared";

// Shared fallback for every lazy-loaded tab/section below — keeps the loading
// state visually consistent instead of each Suspense boundary inventing its own.
const TabLoadingFallback = () => (
 <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 13 }}>Loading…</div>
);

function useWindowSize() {
 const [w, setW] = useState(window.innerWidth);
 useEffect(() => {
 const h = () => setW(window.innerWidth);
 window.addEventListener("resize", h);
 return () => window.removeEventListener("resize", h);
 }, []);
 return w;
}

// Top-level Premium tabs, each backed by its own /salesman-premium/:tab route.
// Anything not in this list falls back to the dashboard.
const VALID_PREMIUM_TABS = ["dashboard", "listings", "leads", "enquiries", "bookings", "leadhistory", "analytics", "loans", "outreach", "chat", "sold", "customers", "handover", "merge", "settings"];

// Tabs that no longer own a slot in the nav. Their routes still resolve, so old
// links, in-app deep links (switchTab) and the tour all keep working — they just
// land on the tab that now hosts them, pre-selecting the right sub-view or
// scrolling to the right section.
const TAB_ALIASES = {
 bookings: { tab: "enquiries", sub: "bookings" },
 leadhistory: { tab: "enquiries", sub: "enquiries" },
 // Handover and Customers are one job — what happens after a deal is won —
 // split across two destinations nobody found. They are now two halves of the
 // Sold tab. Both old routes still resolve so existing deep links (?deal=, ?c=)
 // and anything that links to them keep working.
 handover: { tab: "sold", sub: "handover" },
 customers: { tab: "sold", sub: "customers" },
 merge: { tab: "settings", anchor: "sp-merge" },
};

// Which tab each tour step rings, index-matched to TOUR_STEPS (step 0 is the
// welcome card and rings nothing). One step per sidebar link — exactly the
// 10 tabs in TABS_DESKTOP, nothing past the nav. The tour never navigates
// anymore (see the tourStep effect): it opens the nav (the drawer on
// mobile, always-visible on desktop) once and rings each link where it
// already sits, so there's no separate TOUR_HIGHLIGHT/TOUR_IN_CONTENT
// distinction to maintain the way there was when steps pointed at things
// buried inside page content (sub-tab pills, the invite box).
const TOUR_TABS = [
 null, "dashboard", "listings", "leads", "enquiries", "sold",
 "analytics", "loans", "outreach", "chat", "settings",
];



export default function SalesmanPremium() {
 const navigate = useNavigate();
 const isMobile = useWindowSize() < 768;

 const [profile, setProfile] = useState(null);
 const [userId, setUserId] = useState(null);
 const [loading, setLoading] = useState(true);
 const [pendingPay, setPendingPay] = useState(false);
 const [trialExpired, setTrialExpired] = useState(false);
 const isPremium = profile?.plan === 'salesman_full';
 // Unread buyer-chat count for the nav badge. Its own hook instance, separate
 // from the one inside SellerInbox (each gets a distinct realtime channel).
 const { threads: chatThreads, totalUnread: chatUnread } = useChatThreads({ salesmanId: userId });
 // chat_threads.lead_id is written by the DB trigger when a buyer's first
 // message creates the lead, so this map answers "does this lead have a live
 // conversation, and is anything unread" for the whole pipeline with NO extra
 // query — these rows are already loaded for the nav badge above.
 const threadByLead = new Map();
 // One lead can have MORE than one thread — a buyer who chats about a second
 // car gets a second thread that dedups onto the same lead. These rows arrive
 // ordered by last_message_at desc, so the first one seen is the live one.
 chatThreads.forEach((th) => { if (th.lead_id && !threadByLead.has(th.lead_id)) threadByLead.set(th.lead_id, th); });
 const [chatSheet, setChatSheet] = useState(null);
 // Due follow-up reminders feed the "This week" list on the dashboard. They
 // used to load only inside OutreachHub, so a reminder you had set was
 // invisible unless you happened to open that tab.
 const { due: dueNudges, closeNudge } = useNudges(userId, getDealerIdFromProfile(profile));
 // Premium is solo-only — the redirect guard above sends any salesman with
 // dealer_id set to /salesman before this ever renders, so there is no dealer
 // to grant the ROLE_EXTRAS permission Outreach normally requires. Include it
 // outright rather than gating it on a permission designed for dealer-managed
 // team members.
 const showOutreach = true;
 // Each Premium tab is its own route (/salesman-premium/:tab) so tab switches
 // push browser history — the phone Back button / swipe-back returns to the
 // previous tab instead of exiting the whole app and landing on sign-in.
 const { tab: routeTab } = useParams();
 const resolvedTab = VALID_PREMIUM_TABS.includes(routeTab) ? routeTab : "dashboard";
 const activeTab = TAB_ALIASES[resolvedTab]?.tab || resolvedTab;
 const setActiveTab = (tab, opts) => navigate(`/salesman-premium/${tab}`, opts);
 // Bookings is a sub-view of Enquiries now; Lead History is the other half.
 const [inboxSubTab, setInboxSubTab] = useState("bookings");
 // Listings hosts both halves of "things I sell": the cars, and the paid
 // add-on catalogue those cars get sold with. Same table the deal-add-on
 // picker in the lead drawer reads (dealer_products).
 const [listingsSubTab, setListingsSubTab] = useState("cars");
 // Sold hosts both halves of "after the deal is won": the handover checklist
 // and the buyers those handovers produced.
 const [soldSubTab, setSoldSubTab] = useState("handover");

 // Set from render below (tourStep lives further down). Read by effects that
 // must not fight the tour for control of the scroll position.
 const tourOpenRef = useRef(false);

 // opts is passed straight to navigate(): the tour uses { replace: true } so a
 // 14-step run does not leave 13 history entries for the back gesture to walk.
 function switchTab(tab, opts) {
 setActiveTab(tab, opts);
 }

 // Land an aliased route on the right sub-view / section of its host tab.
 useEffect(() => {
 const alias = TAB_ALIASES[resolvedTab];
 if (!alias) return;
 if (alias.sub) (alias.tab === "sold" ? setSoldSubTab : setInboxSubTab)(alias.sub);
 // The tour drives this same route (step 13 = /salesman-premium/merge) and does
 // its own, exact scroll. Two smooth scrolls to two different offsets cancel
 // each other mid-flight, which is why that step used to end up with the invite
 // box jammed against the bottom nav. The tour wins; this only runs for a real
 // link or a manual visit.
 if (alias.anchor && !tourOpenRef.current) {
 const t = setTimeout(() => {
 document.getElementById(alias.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
 }, 80);
 return () => clearTimeout(t);
 }
 }, [resolvedTab]);

 // listings
 const [myListings, setMyListings] = useState([]);
 const [listingCopied, setListingCopied] = useState({});
 const [showAddForm, setShowAddForm] = useState(false);
 const [showFastForm, setShowFastForm] = useState(false);

 // leads
 const [leads, setLeads] = useState([]);
 const [staleLeads, setStaleLeads] = useState([]);
 // "reward the comeback" greeting + Monthly Goal card (ported from Lite)
 const [isReturning, setIsReturning] = useState(false);
 const [goal, setGoal] = useState({ target: 0, focusCarId: null });
 const [goalEditing, setGoalEditing] = useState(false);
 const [goalDraft, setGoalDraft] = useState(0);
 const [showPrevMonth, setShowPrevMonth] = useState(false);
 const saveGoal = (patch) => {
 const next = { ...goal, ...patch };
 setGoal(next);
 if (!userId) return;
 localStorage.setItem(`sp_goal_${userId}`, JSON.stringify(next));
 supabase.from("profiles").update({ lite_goal: next }).eq("id", userId).then(({ error }) => {
 if (error) console.error("saveGoal:", error);
 });
 };
 // Row glow — when a jump lands the user on the Leads tab from somewhere else
 // (a follow-up nudge, the stale-leads KPI), pulse the exact cards that
 // prompted the jump so the eye lands on them instead of "somewhere in this
 // list". Purely visual; clears itself after 1s.
 const [glowLeadIds, setGlowLeadIds] = useState(() => new Set());
 const glowTimeoutRef = useRef(null);
 const triggerGlow = (ids) => {
 if (!ids || ids.length === 0) return;
 if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current);
 setGlowLeadIds(new Set(ids));
 glowTimeoutRef.current = setTimeout(() => setGlowLeadIds(new Set()), 1000);
 };
 useEffect(() => () => { if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current); }, []);
 const jumpToLead = (lead) => { switchTab("leads"); triggerGlow([lead.id]); };
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
 const [lostPromptId, setLostPromptId] = useState(null);
 const [waModalLead, setWaModalLead] = useState(null);
 const [waModalMsg, setWaModalMessage] = useState("");
 const [drawerLeadId, setDrawerLeadId] = useState(null);
 // Deal add-ons — attach a product from the salesman's own catalogue
 // (Listings > Add-ons, dealer_products) to this lead as a paid upsell,
 // tracked in deal_products. Distinct from included_services on a car
 // listing, which is a free perk bundled into the sale — this is the paid
 // counterpart, and what RevOps reads as back-end gross.
 const [dealAddons, setDealAddons] = useState([]);
 // Lead ids with at least one deal_products row — powers the small "Add-on"
 // badge on the pipeline card. Fetched once alongside leads rather than
 // per-card, which would be N+1.
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
 if (catRes.error) console.error("addonCatalogue:", catRes.error);
 if (dealRes.error) console.error("dealAddons:", dealRes.error);
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
 if (error) { console.error("handleAttachAddon:", error); toast.error("Couldn't attach that add-on"); return; }
 if (data) setDealAddons((p) => [...p, data]);
 setAddonForm({ product_id: "", sold_price: "" });
 setShowAttachAddon(false);
 toast.success("Add-on attached");
 setLeadIdsWithAddons((p) => new Set(p).add(drawerLeadId));
 };
 const handleRemoveAddon = async (id) => {
 const { error } = await supabase.from("deal_products").delete().eq("id", id);
 if (error) { console.error("handleRemoveAddon:", error); toast.error("Couldn't remove that add-on"); return; }
 setDealAddons((p) => {
 const next = p.filter((a) => a.id!== id);
 // Last add-on on this lead just went — drop the pipeline badge too.
 if (next.length === 0 && drawerLeadId) {
 setLeadIdsWithAddons((sIds) => { const n = new Set(sIds); n.delete(drawerLeadId); return n; });
 }
 return next;
 });
 };
 const [deletingLeadId, setDeletingLeadId] = useState(null);
 const [lostSavingId, setLostSavingId] = useState(null);
 const [stageSavingId, setStageSavingId] = useState(null);
 const [editingNoteId, setEditingNoteId] = useState(null);
 const [editNoteVal, setEditNoteVal] = useState("");
 const [notesSavingId, setNotesSavingId] = useState(null);
 const [editPhoneLeadId, setEditPhoneLeadId] = useState(null);
 const [editPhoneVal, setEditPhoneVal] = useState("");
 const [phoneSavingId, setPhoneSavingId] = useState(null);
 const [leadActivities, setLeadActivities] = useState({});
 const [expandedActivityLeadId, setExpandedActivityLeadId] = useState(null);
 const [activitiesLoadingId, setActivitiesLoadingId] = useState(null);
 const [leadSearch, setLeadSearch] = useState("");
 const [logCallLeadId, setLogCallLeadId] = useState(null);
 const [callOutcome, setCallOutcome] = useState("answered");
 const [callNote, setCallNote] = useState("");
 const [callSaving, setCallSaving] = useState(false);
 const [followUpModalLead, setFollowUpModalLead] = useState(null);
 const [followUpDate, setFollowUpDate] = useState("");
 const [followUpSaving, setFollowUpSaving] = useState(false);
 const [testDriveConfirm, setTestDriveConfirm] = useState(null);
 const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
 const [linkCarLeadId, setLinkCarLeadId] = useState(null);
 const [linkCarQuery, setLinkCarQuery] = useState("");
 const [batchWALeads, setBatchWALeads] = useState(null);
 const [batchWAIdx, setBatchWAIdx] = useState(0);
 const [mobileLeadStage, setMobileLeadStage] = useState("new");
 const [playbookLeadId, setPlaybookLeadId] = useState(null);
 const [copiedScriptLine, setCopiedScriptLine] = useState(null);
 // browser notification banner (Follow-up Needed card) — ported from Lite
 const [browserNotifPerm, setBrowserNotifPerm] = useState(() =>
 typeof Notification !== 'undefined'? Notification.permission : 'unsupported'
 );
 const [notifBannerDismissed, setNotifBannerDismissed] = useState(() =>
 localStorage.getItem('sp_notif_banner_dismissed') === '1'
 );

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
 // Public-profile extras — a Premium-only addition over Lite (which has no
 // editor for these at all yet; only the linked-salesman panel does).
 bio: "",
 response_time: "",
 specializations: [],
 // Selling terms buyers see on every listing this agent owns.
 deposit_policy: "",
 deposit_terms: "",
 processing_fee: "",
 });
 const [settingsSaving, setSettingsSaving] = useState(false);
 const [tgTesting, setTgTesting] = useState(false);
 const [tagInput, setTagInput] = useState("");
 // IC verify — voluntary from Settings, matching Lite. Lite also hard-blocks
 // new listings until verified (icEnforced, 7 days after signup); that
 // enforcement is a separate business-rule change and deliberately not
 // ported here, only the verify UI itself.
 const [icGateOpen, setIcGateOpen] = useState(false);
 const [icGateVal, setIcGateVal] = useState("");
 const [icGateSaving, setIcGateSaving] = useState(false);
 async function saveIcAndCloseGate() {
 const digits = (icGateVal || "").replace(/\D/g, "");
 if (digits.length !== 12) { toast.error("Enter a valid 12-digit IC number"); return; }
 setIcGateSaving(true);
 try {
 // Hash + store server-side (set_my_ic): the IC is never persisted in
 // plaintext, only a per-user-salted SHA-256 hash.
 const { error } = await supabase.rpc("set_my_ic", { p_ic: digits });
 if (error) throw error;
 setProfile((p) => ({ ...p, ic_hash: "set", ic_verified_at: new Date().toISOString() }));
 setIcGateOpen(false);
 toast.success("IC verified");
 } catch (e) {
 toast.error(e.message === "invalid_ic" ? "Enter a valid 12-digit IC number" : (e.message || "Could not save"));
 } finally {
 setIcGateSaving(false);
 }
 }
 const [avatarUrl, setAvatarUrl] = useState("");
 const [avatarUploading, setAvatarUploading] = useState(false);
 const avatarInputRef = useRef(null);
 const [coverUrl, setCoverUrl] = useState("");
 const [coverUploading, setCoverUploading] = useState(false);
 const coverInputRef = useRef(null);
 const [editingReminder, setEditingReminder] = useState(null);
 const [reminderMsg, setReminderMsg] = useState("");

 // ── booking lifecycle (ported from Lite) ───────────────────────────────────
 // Premium previously had only a raw status flip (confirm/cancel/"reschedule"
 // with no date picker). These back the full flow: confirm + WhatsApp, move to
 // pipeline, reschedule to a real slot, Telegram reminder scheduling, cancel
 // confirmation, and a per-booking detail sheet.
 const [confirmBookingApt, setConfirmBookingApt] = useState(null);
 const [confirmBookingMsg, setConfirmBookingMsg] = useState("");
 const [reschedulingAptId, setReschedulingAptId] = useState(null);
 const [rescheduleDate, setRescheduleDate] = useState("");
 const [reminderPickerAptId, setReminderPickerAptId] = useState(null);
 const [selectedRemindAt, setSelectedRemindAt] = useState(null);
 const [reminderSaving, setReminderSaving] = useState(false);
 const [cancelConfirmId, setCancelConfirmId] = useState(null);
 const [bookingDetailId, setBookingDetailId] = useState(null);
 const [pastOpen, setPastOpen] = useState(false);
 // Seller-initiated booking: moving a lead into the booking stage asks for a
 // slot up front and creates a CONFIRMED appointment (the seller set it up, so
 // it skips "Awaiting Confirmation").
 const [sellerBookingLead, setSellerBookingLead] = useState(null);
 const [sellerBookingDate, setSellerBookingDate] = useState("");
 const [sellerBookingSaving, setSellerBookingSaving] = useState(false);
 // Won flow — a confirm step instead of the silent undo-timer, so the sale
 // price/car flip is deliberate. See handleMarkWon.
 const [wonPrompt, setWonPrompt] = useState(null);
 const [wonSaving, setWonSaving] = useState(false);
 const [commissionData, setCommissionData] = useState({ total: 0, revenue: 0, count: 0 });
 // Re-render tick so "is this booking still in the future" stays honest on a
 // long-open tab (drives the confirm button's availability).
 const [nowTick, setNowTick] = useState(() => Date.now());
 useEffect(() => {
 const id = setInterval(() => setNowTick(Date.now()), 60000);
 return () => clearInterval(id);
 }, []);

 // notifications
 const [notifications, setNotifications] = useState([]);
 const [notifOpen, setNotifOpen] = useState(false);

 // enquiry templates
 const [openTemplateId, setOpenTemplateId] = useState(null);
 const [templateToast, setTemplateToast] = useState(null);
 const [expandedEnqId, setExpandedEnqId] = useState(null);

 // listings sort/filter
 const [sortBy, setSortBy] = useState("newest");
 const [filterStatus, setFilterStatus] = useState("available");
 // listing card: status-change dropdown, overflow (···) menu, delete confirm
 const [statusMenuCarId, setStatusMenuCarId] = useState(null);
 const [actionMenuCarId, setActionMenuCarId] = useState(null);
 const [confirmDeleteId, setConfirmDeleteId] = useState(null);

 // per-listing analytics (carStatsMap)
 const [carStatsMap, setCarStatsMap] = useState({});
 // per-car share-channel breakdown (which platform each view/enquiry came from)
 const [channelMap, setChannelMap] = useState({});
 // mini-page (xdrive.my/s/slug) visits + card clicks, broken down by platform
 const [minipageStats, setMinipageStats] = useState({ visits: 0, cardClicks: 0, byChannel: [], daily: [] });
 const [cvrHover, setCvrHover] = useState(null);

 // car detail popup
 const [selectedCar, setSelectedCar] = useState(null);
 const [carDetailImgIdx, setCarDetailImgIdx] = useState(0);
 const [carDetailTab, setCarDetailTab] = useState("specs");
 const [carDetailLbOpen, setCarDetailLbOpen] = useState(false);
 const [editListing, setEditListing] = useState(null);

 // tour
 const [tourStep, setTourStep] = useState(null);
 // The card's real height, measured after render. It used to be a hardcoded
 // 220px guess used to pick above-vs-below, so a long step ran off screen and
 // the desktop clamp could cut off the Next button.
 const tourCardRef = useRef(null);
 const [tourCardH, setTourCardH] = useState(240);
 // Same number, readable from the scroll loop below without re-running the
 // effect: the band the target must land in is measured off the card's height.
 const tourCardHRef = useRef(240);
 // Tab the user was on when the tour started, so finishing puts them back.
 const tourReturnTab = useRef("dashboard");
 const [tourTarget, setTourTarget] = useState(null);
 // The auto-start below must fire ONCE per mount. Without this guard anything
 // that re-runs the bootstrap effect drags the tour back to step 0.
 const tourAutoStarted = useRef(false);
 tourOpenRef.current = tourStep !== null;

 // Mobile nav — a slide-out drawer (replaces the old fixed bottom bar, which
 // had grown to 10 flex:1 buttons in a 60px strip). See anyOverlayOpen below
 // for the scroll-lock and the tour-target effect for the auto-open-during-
 // tour behaviour (a nav-anchored tour step has to make the real button
 // visible, not ring something hidden inside a closed drawer).
 const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

 // Body scroll lock for every full-screen overlay in this file (overlay rule
 // 2 — none of them locked scroll before, so the page kept scrolling behind
 // an open sheet). One combined effect instead of one per modal.
 const anyOverlayOpen = !!(
 showAddLead || waModalLead || bookingDetailId || notifOpen ||
 testDriveConfirm || broadcastCar || aiCaptionCar ||
 confirmBookingApt || sellerBookingLead || mobileNavOpen ||
 drawerLeadId || linkCarLeadId || logoutConfirmOpen
 );
 useEffect(() => {
 document.body.style.overflow = anyOverlayOpen? "hidden" : "";
 return () => { document.body.style.overflow = ""; };
 }, [anyOverlayOpen]);

 // UX-1 — the topbar gets out of the way while reading a long list. Locked
 // open whenever an overlay or the tour is up: the mobile nav trigger lives
 // in that bar, and scrolling behind a locked overlay must not move it.
 const [scrollEl, setScrollEl] = useState(null);
 const headerVisible = useHideOnScroll({ target: scrollEl, locked: anyOverlayOpen || tourStep !== null });

 // merge
 const [mergeCode, setMergeCode] = useState("");
 const [mergeStatus, setMergeStatus] = useState("idle");
 const [mergeMsg, setMergeMsg] = useState("");

 // premium — commission + sales
 const [soldCount, setSoldCount] = useState(0);
 const [commission, setCommission] = useState(null);
 const [thisMonthSales, setThisMonthSales] = useState(0);
 const [commissionDetails, setCommissionDetails] = useState([]);

 // premium — AI lead scoring
 const [leadScores, setLeadScores] = useState({});
 const [scoreLoading, setScoreLoading] = useState(false);

 // AI follow-up suggestions
 const [aiFollowups, setAiFollowups] = useState([]);
 const [followupsLoading, setFollowupsLoading] = useState(false);
 // AI WA reply per lead
 const [aiWaReplies, setAiWaReplies] = useState({});
 const [waReplyLoading, setWaReplyLoading] = useState({});
 const [waReplyCopied, setWaReplyCopied] = useState({});
 // AI caption platform
 const [captionPlatform, setCaptionPlatform] = useState("whatsapp");
 const [captionQuotaOk, setCaptionQuotaOk] = useState(true);

 // premium — loans
 const [loanApplications, setLoanApplications] = useState([]);
 const [customers, setCustomers] = useState([]);
 const [customersLoading, setCustomersLoading] = useState(true);
 const [customerSearch, setCustomerSearch] = useState("");
 const [expiryFilter, setExpiryFilter] = useState(null); // 'ins' | 'rt'
 // Prepaid service packages + their visits. Owned by useServicePackages so the
 // dealer Customers tab and this one share one implementation — they used to
 // carry two near-identical copies of add-package / log-visit.
 const {
 packages: packagesMap, visits: pkgVisits, products: pkgProducts,
 addPackage, logVisit, undoVisit,
 } = useServicePackages(getDealerIdFromProfile(profile), customers.map((c) => c.id));
 // Flat list for the "This week" call list — a package expiring with visits
 // unused is a customer who already paid and has not come back.
 const servicePackages = Object.values(packagesMap).flat();
 // Post-sale state shared by three tabs — Pipeline (the won card's progress
 // chip), Handover (the board) and Customers (per-buyer progress). ONE instance
 // for the page: each surface used to answer "what happened after the win?" on
 // its own, which is why a deal won in the pipeline stayed invisible everywhere
 // else until a full page reload. See hooks/useHandover.
 const handover = useHandover(getDealerIdFromProfile(profile), userId);
 // The next thing blocking the longest-open handover — what the Dashboard's
 // Sold shortcut says is waiting. Label only; the board owns the detail.
 const soldNextStep = (() => {
 const open = handover.deals.filter((d) => handover.progressByLead[d.id] !== 100);
 const last = open[open.length - 1];
 return last ? handover.nextStepByLead[last.id]?.label || null : null;
 })();
 // Deep links between the three tabs: ?deal= opens one handover, ?c= one customer.
 const [searchParams] = useSearchParams();
 const handoverDealParam = searchParams.get("deal");
 const customerParam = searchParams.get("c");
 const openHandoverFor = (leadId, from = "dashboard") => navigate(`/salesman-premium/handover?deal=${leadId}&from=${from}`);
 const openCustomerForLead = (lead, from = "dashboard") => {
 const cust = customers.find((c) => c.lead_id === lead.id);
 const qs = `?from=${from}${cust ? `&c=${cust.id}` : ""}`;
 navigate(`/salesman-premium/customers${qs}`);
 };
 // Sold now owns a nav slot, so it is no longer a dead end. The back control
 // only appears when the user was sent here from somewhere specific (a Pipeline
 // card's handover chip, a Dashboard tile) and has a place to go back to.
 const TAB_BACK_LABELS = { dashboard: "Dashboard", leads: "Pipeline" };
 const fromParam = searchParams.get("from");
 const backTab = TAB_BACK_LABELS[fromParam] ? fromParam : null;
 const renderTabBack = () => backTab && (
 <button
 onClick={() => navigate(`/salesman-premium/${backTab}`)}
 style={{ display: "inline-flex", alignItems: "center", gap: 5, margin: "0 0 12px", padding: "6px 11px 6px 8px", borderRadius: R.pill, background: C.fill, border: `1px solid ${C.border}`, color: C.textSec, fontSize: T.size.sm, fontWeight: T.weight.semibold, cursor: "pointer", fontFamily: "inherit" }}
 >
 <ChevronLeft size={14} />
 {TAB_BACK_LABELS[backTab]}
 </button>
 );
 // Customers were fetched exactly once, during page bootstrap — a buyer created
 // by the win trigger could not appear without a reload. This is the refetch.
 const refreshCustomers = useCallback(async () => {
 const custDealerId = getDealerIdFromProfile(profile);
 if (!custDealerId) return;
 const { data, error: custErr } = await supabase
 .from("customers").select("*").eq("dealer_id", custDealerId)
 .order("created_at", { ascending: false });
 if (custErr) { console.error("refreshCustomers:", custErr); return; }
 setCustomers(data || []);
 setCustomersLoading(false);
 }, [profile]);

 // Arriving from the handover board's "View customer record" — bring that row
 // into view once the Customers tab has rendered it.
 useEffect(() => {
 if (!customerParam || activeTab !== "sold" || soldSubTab !== "customers" || customersLoading) return;
 const el = document.getElementById(`customer-${customerParam}`);
 if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
 }, [customerParam, activeTab, soldSubTab, customersLoading, customers.length]);

 const channelRef = useRef(null);
 const pendingStageRef = useRef({});
 const [appointments, setAppointments] = useState([]);
 const [enquiries, setEnquiries] = useState([]);
 // analyticsEvents removed — aggregated server-side via get_salesman_analytics RPC

 // ── local cache helpers (ported from SalesmanLite.jsx) ────────────────────
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
 caches.open("sp-images-v1").then(async (cache) => {
 // batch 4 at a time to avoid saturating bandwidth on first load
 for (let i = 0; i < urls.length; i += 4) {
 await Promise.all(urls.slice(i, i + 4).map((url) =>
 cache.match(url).then((hit) => { if (!hit) return cache.add(url).catch(() => {}); })
 ));
 }
 }).catch(() => {});
 };

 // stale leads (48h + overdue follow-ups)
 useEffect(() => {
 const now = new Date();
 const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
 setStaleLeads(
 leads.filter((l) => {
 if (["won", "lost", "closed_won", "closed_lost"].includes(l.stage)) return false;
 const overdueFollowUp = l.follow_up_at && new Date(l.follow_up_at) <= now;
 const noRecentActivity = l.updated_at && new Date(l.updated_at) < cutoff;
 return overdueFollowUp && noRecentActivity;
 })
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
 bio: profile.bio || "",
 response_time: profile.response_time || "",
 specializations: profile.specializations || [],
 deposit_policy: profile.deposit_policy || "",
 deposit_terms: profile.deposit_terms || "",
 processing_fee: profile.processing_fee != null ? String(profile.processing_fee) : "",
 });
 setAvatarUrl(profile.avatar_url || "");
 setCoverUrl(profile.cover_url || "");
 }
 }, [profile]);

 // auth + profile
 useEffect(() => {
 // Guards the long async bootstrap below: if the page unmounts mid-chain we
 // must not go on to subscribe a realtime channel that the (already-run)
 // cleanup can no longer remove.
 let cancelled = false;
 const { at: _at, rt: _rt } = readHandoffTokens();
 const authReady = _at && _rt
   ? supabase.auth.setSession({ access_token: _at, refresh_token: _rt })
       .then(() => { clearHandoffTokens(); })
   : Promise.resolve();
 authReady.then(() => supabase.auth.getSession()).then(async ({ data, error }) => {
 if (error ||!data.session) {
 setLoading(false);
 navigate("/login");
 return;
 }

 const uid = data.session.user.id;
 setUserId(uid);

 const { data: profileData } = await supabase
 .from("profiles")
 .select("*")
 .eq("id", uid)
 .maybeSingle();

 if (!profileData) {
 setLoading(false);
 navigate("/login");
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

 if (role!== "salesman") {
 navigate(ROLE_ROUTES[role]?? "/dashboard", { replace: true });
 return;
 }

 // Premium is for SOLO full salesmen only. Linked salesmen (dealer_id set) go
 // to the dealer SalesmanPanel; solo non-full plans go to Lite.
 if (profileData.dealer_id) {
 navigate("/salesman", { replace: true });
 return;
 }
 if (profileData.plan !== 'salesman_full') {
 navigate("/salesman-lite", { replace: true });
 return;
 }

 // Final guard: a half-onboarded salesman (no name/IC/phone yet) must finish
 // the wizard before the dashboard, no matter how they arrived here.
 if (profileData.onboarding_complete === false) {
 navigate("/salesman-onboarding/premium", { replace: true });
 return;
 }

 // Payment gate: a premium salesman awaiting payment confirmation sees the
 // pending-approval screen (same manual DuitNow QR flow as dealers) until an
 // admin marks payment_status != 'pending'. Grandfathered rows (null) pass.
 if (profileData.payment_status === "pending") {
 setProfile(profileData);
 setPendingPay(true);
 setLoading(false);
 return;
 }

 // First-month-free promo: a fresh solo Premium signup gets 30 days of full
 // access (subscription_status='trial', trial_ends_at set by the DB trigger
 // on insert — see prevent_profile_privilege_escalation). Once that runs
 // out, same expired-trial QR screen dealers already hit.
 if (
 profileData.subscription_status === "trial" &&
 profileData.trial_ends_at &&
 new Date(profileData.trial_ends_at) < new Date()
 ) {
 setProfile(profileData);
 setTrialExpired(true);
 setLoading(false);
 return;
 }

 setProfile(profileData);
 setLoading(false);

 // seed from cache immediately so UI is instant, real fetches below replace it
 const cachedListings = readCache(`sp_listings_${uid}`);
 if (cachedListings) setMyListings(cachedListings);
 const cachedLeads = readCache(`sp_leads_${uid}`);
 if (cachedLeads) { setLeads(cachedLeads); setLeadsLoading(false); }
 const cachedEnquiries = readCache(`sp_enquiries_${uid}`);
 if (cachedEnquiries) setEnquiries(cachedEnquiries);
 const cachedAppts = readCache(`sp_appts_${uid}`);
 if (cachedAppts) setAppointments(cachedAppts);

 // profiles.onboarding_tour_done is the real, per-account guard (mirrors
 // SalesmanLite.jsx:1390) — sp_tour_seen_${uid} is only a same-session
 // backup. The old check here was a bare "sp_tour_done" localStorage key
 // with no user id in it: the first time the tour was dismissed on ANY
 // account on a given browser/device, it silently never fired again for
 // every other account signing in on that same browser — including a
 // genuinely new signup tested on the same machine.
 if (
 !tourAutoStarted.current &&
 !profileData.onboarding_tour_done &&
 !localStorage.getItem(`sp_tour_seen_${uid}`)
 ) {
 tourAutoStarted.current = true;
 startTour();
 }

 // "Reward the comeback" — a 3+ day gap since the last visit greets the
 // salesman back instead of leading with a stale-leads scold. Client-side
 // only (localStorage), ported from Salesman Lite.
 try {
 const lastVisitKey = `sp_last_visit_${uid}`;
 const lastVisit = Number(localStorage.getItem(lastVisitKey) || 0);
 if (lastVisit && Date.now() - lastVisit >= 3 * 24 * 60 * 60 * 1000) setIsReturning(true);
 localStorage.setItem(lastVisitKey, String(Date.now()));
 } catch {}

 // Monthly commission goal — reuses profiles.lite_goal (a solo salesman is
 // only ever on one plan at a time, so the column is safe to share).
 if (profileData.lite_goal) {
 setGoal((prev) => ({ ...prev, ...profileData.lite_goal }));
 } else {
 try {
 const cached = JSON.parse(localStorage.getItem(`sp_goal_${uid}`));
 if (cached) {
 setGoal((prev) => ({ ...prev, ...cached }));
 supabase.from("profiles").update({ lite_goal: cached }).eq("id", uid).then(() => {});
 }
 } catch {}
 }


 // Realtime. Deliberately set up HERE — before the data fetches — and not
 // buried at the end of the leads `.then`, where it used to sit behind an
 // `await` on the AI lead-scoring call. That put a multi-second window between
 // mount and subscribe in which the page could unmount (a back/forward, a
 // redirect) while this chain was still running: the cleanup below ran with
 // `channelRef.current` still null, removed nothing, and the orphaned chain
 // then subscribed a channel nobody owned. The next mount called
 // `supabase.channel()` on that same topic, got the already-joined channel
 // back (supabase-js keeps one channel per topic), and `.on("postgres_changes")`
 // threw "cannot add postgres_changes callbacks ... after subscribe()" as an
 // unhandledrejection. `freshChannel` drops any stale holder of the topic, and
 // `cancelled` stops a dead mount from subscribing at all.
 // Topic is salesman-PREMIUM-rt: it used to be "salesman-lite-rt-", the exact
 // string SalesmanLite.jsx uses, so the two pages fought over one topic.
 if (!cancelled) {
 const ch = freshChannel("salesman-premium-rt-" + uid)
 .on(
 "postgres_changes",
 {
 event: "*",
 schema: "public",
 table: "leads",
 filter: `salesman_id=eq.${uid}`,
 },
 (payload) => {
 if (payload.eventType === "INSERT")
 setLeads((p) => (p.some((l) => l.id === payload.new.id)? p : [payload.new, ...p]));
 if (payload.eventType === "UPDATE")
 setLeads((p) =>
 p.map((l) =>
 l.id === payload.new.id? { ...l, ...payload.new } : l,
 ),
 );
 if (payload.eventType === "DELETE")
 setLeads((p) => p.filter((l) => l.id!== payload.old.id));
 },
 )
 .on(
 "postgres_changes",
 {
 event: "INSERT",
 schema: "public",
 table: "salesman_notifications",
 filter: `salesman_id=eq.${uid}`,
 },
 (payload) => {
 toast(payload.new.title, { description: payload.new.body });
 setNotifications((p) => [payload.new, ...p]);
 },
 )
 .on(
 "postgres_changes",
 {
 event: "*",
 schema: "public",
 table: "whatsapp_enquiries",
 filter: `dealer_id=eq.${uid}`,
 },
 (payload) => {
 if (payload.eventType === "INSERT") {
 setEnquiries((p) => (p.some((e) => e.id === payload.new.id)? p : [payload.new, ...p]));
 toast("New enquiry!", {
 description: payload.new.buyer_name || "Someone enquired",
 });
 }
 if (payload.eventType === "UPDATE")
 setEnquiries((p) =>
 p.map((e) =>
 e.id === payload.new.id? { ...e, ...payload.new } : e,
 ),
 );
 },
 )
 .on(
 "postgres_changes",
 {
 event: "*",
 schema: "public",
 table: "appointments",
 filter: `salesman_id=eq.${uid}`,
 },
 (payload) => {
 if (payload.eventType === "INSERT") {
 setAppointments((p) => (p.some((a) => a.id === payload.new.id)? p : [payload.new, ...p]));
 toast("New booking!", {
 description: payload.new.buyer_name || "New appointment",
 });
 }
 if (payload.eventType === "UPDATE")
 setAppointments((p) =>
 p.map((a) =>
 a.id === payload.new.id? { ...a, ...payload.new } : a,
 ),
 );
 },
 );
 // Unmounted while the chain above was running -> never join, just drop it.
 if (cancelled) {
 supabase.removeChannel(ch);
 } else {
 channelRef.current = ch;
 ch.subscribe();
 }
 }

 // premium — commission + sold count
 supabase.from("car_listings").select("commission_amount, brand, model, year, sold_at")
 .eq("assigned_to", uid).eq("status", "sold")
 .then(({ data, error }) => {
 if (error) { console.error("fetchCommission:", error); toast.error("Could not load your commission"); }
 const rows = data || [];
 setSoldCount(rows.length);
 setCommission(rows.reduce((sum, r) => sum + (Number(r.commission_amount) || 0), 0));
 setCommissionDetails(
 rows.filter(r => r.commission_amount).sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at)).slice(0, 5)
 );
 const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
 setThisMonthSales(rows.filter(r => r.sold_at && r.sold_at >= monthStart).length);
 });

 // premium — loan applications
 supabase.from("loan_applications").select("*").eq("salesman_id", uid)
 .order("created_at", { ascending: false })
 .then(({ data, error }) => {
 if (error) { console.error("fetchLoanApplications:", error); toast.error("Could not load loan applications"); }
 setLoanApplications(data || []);
 });

 // premium — customers (post-sale buyer records) + their service packages.
 // A solo salesman's dealer_id resolves to their own id (getDealerIdFromProfile).
 const custDealerId = getDealerIdFromProfile(profileData);
 supabase.from("customers").select("*").eq("dealer_id", custDealerId)
 .order("created_at", { ascending: false })
 .then(async ({ data, error }) => {
 if (error) { console.error("fetchCustomers:", error); toast.error("Could not load your customers"); }
 const list = data || [];
 setCustomers(list);
 setCustomersLoading(false);
 });

 // fetch listings with full columns for car detail popup
 Promise.all([
 supabase
 .from("car_listings")
 .select(
 "id, slug, year, brand, model, variant, selling_price, original_price, status, images, colour, mileage, transmission, fuel_type, body_type, features, options, city, state, condition, engine_cc, created_at, sold_at, commission_amount",
 )
 .eq("assigned_to", uid),
 supabase
 .from("car_listings")
 .select(
 "id, slug, year, brand, model, variant, selling_price, original_price, status, images, colour, mileage, transmission, fuel_type, body_type, features, options, city, state, condition, engine_cc, created_at, sold_at, commission_amount",
 )
 .eq("dealer_id", uid),
 ]).then(([r1, r2]) => {
 if (r1.error || r2.error) { console.error("fetchListings:", r1.error || r2.error); toast.error("Could not load your listings"); }
 const seen = new Set();
 const merged = [...(r1.data || []), ...(r2.data || [])]
 .filter((c) => {
 if (seen.has(c.id)) return false;
 seen.add(c.id);
 return true;
 })
 .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
 setMyListings(merged);
 writeCache(`sp_listings_${uid}`, merged);
 precacheImages(merged);
 });

 // Analytics: server-side aggregation via RPC — one row per car, no raw events in browser
 supabase.rpc("get_salesman_analytics", { p_dealer_id: uid })
 .then(({ data, error }) => {
 if (error) console.error("fetchAnalytics:", error);
 const map = {};
 (data || []).forEach(row => {
 map[row.car_id] = {
 views:     Number(row.views)     || 0,
 enquiries: Number(row.enquiries) || 0,
 daily:     [row.d0, row.d1, row.d2, row.d3, row.d4, row.d5, row.d6],
 // WhatsApp/call taps per day, oldest first — the RPC has always returned
 // these (w0..w6) but nothing read them, so the dashboard could only ever
 // plot views. They feed the combined 7-day chart on the dashboard.
 waDaily:   [row.w0, row.w1, row.w2, row.w3, row.w4, row.w5, row.w6],
 };
 });
 setCarStatsMap(map);

 // Share-channel breakdown (which platform each view/enquiry came from),
 // scoped to this salesman's own slug. Untagged/organic → 'direct'.
 // p_car_ids: null => all-time across every car ever tagged to this slug,
 // deduped by session, so the count never drops when a car ages out of the
 // rolling analytics window above.
 if (profileData.slug) {
 supabase
 .rpc("get_salesman_channel_breakdown", { p_car_ids: null, p_slug: profileData.slug })
 .then(({ data: chRows, error: chErr }) => {
 if (chErr) { console.error("fetchChannelBreakdown:", chErr); return; }
 const chMap = {};
 (chRows || []).forEach(r => {
 (chMap[r.car_id] = chMap[r.car_id] || []).push({
 channel: r.channel || "direct",
 views: Number(r.views) || 0,
 enquiries: Number(r.enquiries) || 0,
 });
 });
 setChannelMap(chMap);
 });

 // Mini-page (xdrive.my/s/slug) visits + card clicks, broken down by the
 // platform each visitor arrived through.
 supabase
 .rpc("get_salesman_minipage_stats", { p_slug: profileData.slug })
 .then(({ data: mpRows, error: mpErr }) => {
 if (mpErr) { console.error("fetchMinipageStats:", mpErr); return; }
 const rows = mpRows || [];
 setMinipageStats((prev) => ({
 ...prev,
 visits: rows.reduce((s, r) => s + (Number(r.visits) || 0), 0),
 cardClicks: rows.reduce((s, r) => s + (Number(r.card_clicks) || 0), 0),
 byChannel: rows,
 }));
 });

 // Mini-page visits per day for the last 7 days. Separate RPC from the
 // per-channel totals above because that one has no time axis — this is
 // the third wave on the dashboard's combined traffic chart.
 supabase
 .rpc("get_salesman_minipage_daily", { p_slug: profileData.slug })
 .then(({ data: mpDaily, error: mpdErr }) => {
 if (mpdErr) { console.error("fetchMinipageDaily:", mpdErr); return; }
 const r = (mpDaily || [])[0];
 if (!r) return;
 setMinipageStats((prev) => ({
 ...prev,
 daily: [r.d0, r.d1, r.d2, r.d3, r.d4, r.d5, r.d6].map((v) => Number(v) || 0),
 }));
 });
 }
 });

 // fetch leads
 supabase
 .from("leads")
 .select(LEAD_SELECT)
 .eq("salesman_id", uid)
 .eq("is_deleted", false)
 .order("updated_at", { ascending: false })
 .then(async ({ data: lds, error: ldsErr }) => {
 if (ldsErr) { console.error("fetchLeads:", ldsErr); toast.error("Could not load your leads"); }
 const rows = lds || [];
 setLeads(rows);
 setLeadsLoading(false);
 writeCache(`sp_leads_${uid}`, rows);

 // Which of these leads already carry a paid add-on — feeds the
 // pipeline card badge. Scoped to the leads we just fetched rather
 // than re-deriving a dealer id here, so it can never disagree with
 // what is on screen.
 if (rows.length > 0) {
 supabase
 .from("deal_products")
 .select("lead_id")
 .in("lead_id", rows.map((r) => r.id))
 .then(({ data: addonRows, error: addonErr }) => {
 if (addonErr) { console.error("fetchLeadAddonFlags:", addonErr); return; }
 setLeadIdsWithAddons(new Set((addonRows || []).map((r) => r.lead_id).filter(Boolean)));
 });
 }

 // AI lead scoring — fire-and-forget
 if (rows.length > 0) {
 setScoreLoading(true);
 try {
 const payload = rows.map((l) => ({
 id: l.id, buyer_name: l.buyer_name, stage: l.stage,
 notes: l.notes, updated_at: l.updated_at,
 phone: l.phone? "present" : "missing",
 }));
 const prompt = `You are a sales AI. Score each lead as "hot", "warm", or "cold" based on stage, recency, notes, and phone presence.\nLeads: ${JSON.stringify(payload)}\nReturn ONLY a JSON array: [{"id":"...","score":"hot"|"warm"|"cold","reason":"one short sentence"}]`;
 const { data: aiData } = await supabase.functions.invoke("ai-proxy", { body: { prompt } });
 const raw = aiData?.reply?? aiData?.content?? aiData?.text?? aiData?.message?? "";
 const parsed = JSON.parse(typeof raw === "string"? raw : JSON.stringify(raw));
 if (Array.isArray(parsed)) {
 const map = {};
 parsed.forEach((r) => { if (r.id) map[r.id] = { score: r.score, reason: r.reason }; });
 setLeadScores(map);
 }
 } catch { /* silent */ }
 finally { setScoreLoading(false); }
 }

 });

 // fetch appointments
 // NOTE: filtered on salesman_id ONLY (matching Lite). The old
 // `.eq("dealer_id", uid)` here silently hid every booking whose dealer_id
 // wasn't the salesman's own id — only 17 of 71 live rows satisfy that — so
 // organic bookings simply never appeared. RLS already scopes this table.
 // Columns must stay complete: remind_at/remind_sent drive the Telegram
 // reminder state and lead_id ties a booking to its pipeline lead.
 supabase
 .from("appointments")
 .select(
 "id, lead_id, buyer_name, buyer_phone, appointment_date, status, notes, car_listing_id, created_at, remind_at, remind_sent, car_listings(id, brand, model, year, variant, selling_price, images, vin_number, plate_number, mileage, transmission, slug)",
 )
 .eq("salesman_id", uid)
 .order("appointment_date", { ascending: false })
 .then(({ data: apts, error: aptsErr }) => {
 if (aptsErr) { console.error("fetchAppointments:", aptsErr); toast.error("Could not load bookings"); return; }
 setAppointments(apts || []);
 writeCache(`sp_appts_${uid}`, apts || []);
 });

 // fetch notifications
 supabase
 .from("salesman_notifications")
 .select("id, title, body, is_read, created_at")
 .eq("salesman_id", uid)
 .order("created_at", { ascending: false })
 .limit(30)
 .then(({ data: notifs }) => setNotifications(notifs || []));

 // fetch enquiries
 supabase
 .from("whatsapp_enquiries")
 .select(
 "id, buyer_name, buyer_phone, buyer_message, status, created_at, updated_at, listing_id, car_listings(brand, model, year)",
 )
 .eq("dealer_id", uid)
 .order("created_at", { ascending: false })
 .then(({ data: enqs }) => {
 setEnquiries(enqs || []);
 writeCache(`sp_enquiries_${uid}`, enqs || []);
 });
 });
 return () => {
 cancelled = true;
 if (channelRef.current) {
 supabase.removeChannel(channelRef.current);
 channelRef.current = null;
 }
 };
 // Mount-time bootstrap only. Deliberately [] and NOT [navigate]: react-router
 // v7 rebuilds the `navigate` callback whenever the pathname changes (it closes
 // over the current location for relative paths), and every Premium tab is its
 // own route — so a [navigate] dep re-ran this entire block on EVERY tab switch.
 // That refetched profile/listings/analytics/leads/enquiries and re-subscribed
 // the realtime channel each time, and reset the tour to step 0 the moment it
 // navigated to the next step's tab, so Next looped back to the welcome card.
 // Every navigate() call in here is an absolute path, so the mount-time closure
 // stays correct.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // The tour never navigates — every real step (1..10) rings one of the 10
 // sidebar links exactly where it already sits: the drawer on mobile (opened
 // once and held open for the whole run, not toggled per step — the setter
 // below is a same-value set on every step after the first, so React bails
 // out with no re-render/re-animation), the always-visible sidebar on
 // desktop. Nothing here scrolls or switches tabs, so the earlier
 // scroll-room padding and in-content scroll-compensation logic (needed
 // when steps pointed at things buried in page content) is gone — every
 // target is a fixed nav row that doesn't move under its own step.
 useEffect(() => {
 if (tourStep === null) { setTourTarget(null); setMobileNavOpen(false); return; }
 const tab = TOUR_TABS[tourStep];
 if (!tab) { setTourTarget(null); setMobileNavOpen(false); return; }
 if (isMobile) setMobileNavOpen(true);
 const measure = () => {
 const el = document.querySelector(`[data-tour-id="${tab}"]`);
 setTourTarget(el ? el.getBoundingClientRect() : null);
 };
 measure();
 window.addEventListener("resize", measure);
 return () => window.removeEventListener("resize", measure);
 }, [tourStep, isMobile]);

 const handleLogout = async () => {
 await supabase.auth.signOut();
 window.location.href = "https://xdrive.my/login";
 };

 const updateLeadStage = async (leadId, stage) => {
 setStageSavingId(leadId);
 const oldStage = leads.find((l) => l.id === leadId)?.stage?? null;
 // Carry the lead's OWN dealer_id onto the activity row. This used to be
 // hardcoded null, which detached every Premium stage change from its
 // dealership scope (activity feeds and any dealer-side read missed them).
 const dealerId = leads.find((l) => l.id === leadId)?.dealer_id?? null;
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
 setLeads((p) => p.map((l) => (l.id === leadId? { ...l, stage } : l)));
 };

 const advanceLeadStage = (lead, newStage, force = false) => {
 if (!newStage) return;
 if (!force && lead.stage === "test_drive") { setTestDriveConfirm({ lead, nextStage: newStage }); return; }
 // Intercept won → confirm modal instead of the undo-timer flow. A win flips
 // the linked car to sold and moves money, so it should never happen behind a
 // 4.5s toast the salesman might not read.
 if (newStage === "won") {
 if (pendingStageRef.current[lead.id]) {
 clearTimeout(pendingStageRef.current[lead.id].timer);
 delete pendingStageRef.current[lead.id];
 }
 setWonPrompt({ lead });
 return;
 }
 // Intercept a seller-initiated move into the booking stage → ask for the
 // date/time up front, then create a CONFIRMED appointment (the seller set it
 // up, so it skips "Awaiting Confirmation"). Organic bookings from the car
 // page take the /api/booking path (status 'pending') and never reach here.
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
 if (pendingStageRef.current[leadId]) {
 clearTimeout(pendingStageRef.current[leadId].timer);
 }
 setLeads((p) => p.map((l) => (l.id === leadId? { ...l, stage: newStage } : l)));
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
 setLeads((p) => p.map((l) => (l.id === leadId? { ...l, stage: oldStage } : l)));
 },
 },
 duration: 4500,
 });
 };

 const pingWA = (lead) => {
 const car = lead.car_listings;
 const carName = car? `${car.brand} ${car.model}` : "kereta tu";
 const isStale = lead.updated_at && Date.now() - new Date(lead.updated_at).getTime() > 48 * 3600 * 1000;
 const msg = isStale
? `Hi ${lead.buyer_name || "kawan"}! Ada orang lain tengah tanya pasal ${carName} ni — kalau you still interested, jom lock dulu sebelum terlambat `
 : `Hi ${lead.buyer_name || "kawan"}! Macam mana, still interested dalam ${carName} tu? Jom kita discuss lagi `;
 setWaModalLead(lead);
 setWaModalMessage(msg);
 };

 // Browser notification: fire when the user returns to the tab with stale
 // leads waiting. Throttled to one per 24h per browser. Ported from Lite.
 useEffect(() => {
 if (browserNotifPerm!== 'granted') return;
 const handler = async () => {
 if (document.hidden || staleLeads.length === 0) return;
 const THROTTLE_MS = 24 * 60 * 60 * 1000;
 const last = Number(localStorage.getItem('sp_last_followup_notif') || 0);
 if (Date.now() - last < THROTTLE_MS) return;
 localStorage.setItem('sp_last_followup_notif', String(Date.now()));
 const names = staleLeads.slice(0, 3).map(l => l.buyer_name || 'Unknown').join(', ');
 const title = `${staleLeads.length} lead${staleLeads.length!== 1? 's' : ''} need follow-up`;
 const options = { body: names, tag: 'sp-followup' };
 try {
 // Pages controlled by a service worker (PWA) can't use `new Notification` —
 // it throws "Illegal constructor"; must go through the SW registration.
 const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
 if (reg && reg.showNotification) reg.showNotification(title, options);
 else new Notification(title, options);
 } catch { /* not critical */ }
 };
 document.addEventListener('visibilitychange', handler);
 return () => document.removeEventListener('visibilitychange', handler);
 }, [browserNotifPerm, staleLeads]);

 const requestBrowserNotif = async () => {
 if (typeof Notification === 'undefined') return;
 const perm = await Notification.requestPermission();
 setBrowserNotifPerm(perm);
 setNotifBannerDismissed(true);
 localStorage.setItem('sp_notif_banner_dismissed', '1');
 };

 const dismissNotifBanner = () => {
 setNotifBannerDismissed(true);
 localStorage.setItem('sp_notif_banner_dismissed', '1');
 };

 const saveLeadNote = async (leadId) => {
 setNotesSavingId(leadId);
 const { error } = await supabase.from("leads").update({ notes: editNoteVal, updated_at: new Date().toISOString() }).eq("id", leadId);
 setNotesSavingId(null);
 if (error) { console.error("saveLeadNote:", error); toast.error("Failed to save note"); return; }
 setLeads((p) => p.map((l) => l.id === leadId? { ...l, notes: editNoteVal } : l));
 setEditingNoteId(null);
 };

 // A chat lead from a guest buyer starts with NO phone — the buyer never gave
 // one. This is where the number gets on the record the moment they share it in
 // the conversation, so the lead stops being reachable only inside the app.
 // Not a contact event, so it stamps updated_at only: last_contacted_at is what
 // the "This week" call list runs on and saving a number is not a call.
 const saveLeadPhone = async (leadId) => {
 const digits = editPhoneVal.replace(/\D/g, "");
 if (digits.length < 9) { toast.error("That does not look like a full phone number"); return; }
 setPhoneSavingId(leadId);
 // trg_leads_normalize_phone rewrites this to the 60xxxxxxxxx form on write,
 // so read the row back rather than trusting what was typed — every de-dup
 // and wa.me link downstream compares against the stored form.
 const { data, error } = await supabase
 .from("leads")
 .update({ phone: editPhoneVal.trim(), updated_at: new Date().toISOString() })
 .eq("id", leadId)
 .select("phone")
 .maybeSingle();
 setPhoneSavingId(null);
 if (error) { console.error("saveLeadPhone:", error); toast.error("Failed to save phone number"); return; }
 const stored = data?.phone || editPhoneVal.trim();
 setLeads((p) => p.map((l) => (l.id === leadId? { ...l, phone: stored } : l)));
 setEditPhoneLeadId(null);
 toast.success("Phone number saved");
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
 note: `${callOutcome}${callNote? ` — ${callNote}` : ""}`,
 created_by: userId,
 dealer_id: lead?.dealer_id?? null,
 });
 if (error) { console.error("logCall:", error); toast.error("Failed to log call"); setCallSaving(false); return; }
 // Stamp last_contacted_at, not just updated_at. Logging a call IS contact,
 // and every "gone quiet" surface (This week, OutreachHub) measures from this
 // column — without it a lead you just phoned keeps being served back to you
 // as untouched, and the call list stops being believable.
 const callTs = new Date().toISOString();
 await supabase.from("leads").update({ updated_at: callTs, last_contacted_at: callTs, last_call_outcome: callOutcome }).eq("id", logCallLeadId);
 setLeads((p) => p.map((l) => l.id === logCallLeadId? { ...l, updated_at: callTs, last_contacted_at: callTs, last_call_outcome: callOutcome } : l));
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
 if (error) { console.error("saveFollowUp:", error); toast.error("Failed to save reminder"); return; }
 setLeads((p) => p.map((l) => l.id === leadId? { ...l, follow_up_at: date || null } : l));
 setFollowUpModalLead(null);
 toast.success(date? "Follow-up reminder set" : "Reminder cleared");
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
 setLeads((p) => p.filter((l) => l.id!== leadId));
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
? { id: car.id, slug: car.slug, brand: car.brand, model: car.model, year: car.year,
 variant: car.variant, selling_price: car.selling_price, images: car.images,
 mileage: car.mileage, transmission: car.transmission, colour: car.colour, status: car.status }
 : l.car_listings }
 : l
 ));
 setLinkCarLeadId(null);
 setLinkCarQuery("");
 toast.success("Car linked to lead");
 };

 const handleLostReason = async (leadId, reason) => {
 const lead = leads.find((l) => l.id === leadId);
 const oldStage = lead?.stage?? null;
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
 dealer_id: leads.find((l) => l.id === leadId)?.dealer_id?? null,
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

 // notifications 

 const unreadCount = notifications.filter((n) =>!n.is_read).length;

 const markNotifRead = async (notif) => {
 if (notif.is_read) return;
 await supabase
 .from("salesman_notifications")
 .update({ is_read: true })
 .eq("id", notif.id);
 setNotifications((p) =>
 p.map((n) => (n.id === notif.id? { ...n, is_read: true } : n)),
 );
 };

 const markAllNotifsRead = async () => {
 const ids = notifications.filter((n) =>!n.is_read).map((n) => n.id);
 if (!ids.length) return;
 await supabase
 .from("salesman_notifications")
 .update({ is_read: true })
 .in("id", ids);
 setNotifications((p) => p.map((n) => ({ ...n, is_read: true })));
 };

 // enquiry templates 

 const buildTemplate = (enq, key) => {
 const car = enq.car_listings;
 const carName = car? `${car.brand} ${car.model}` : "kereta tu";
 const name = enq.buyer_name || "kawan";
 const templates = {
 chat: `Hi ${name}! Saya tengok you ada enquiry pasal ${carName}. Boleh kita chat sekejap? Saya ada details lagi yang boleh share `,
 test_drive: `Hi ${name}! Best tak kalau you cuba drive sendiri ${carName} tu dulu? Test drive free je — bila you free? `,
 budget: `Hi ${name}! Thanks for your interest in ${carName}. Boleh tahu budget range you macam mana? Saya try cari yang paling sesuai untuk you `,
 deposit: `Hi ${name}! Just to update, ada beberapa orang interested dalam ${carName} ni. Kalau nak reserve, boleh deposit kecik dulu — kereta terus hold untuk you `,
 };
 return templates[key] || "";
 };

 const fireTemplate = (enq, key) => {
 const msg = buildTemplate(enq, key);
 navigator.clipboard.writeText(msg).catch(() => {});
 const phone = (enq.buyer_phone || "").replace(/\D/g, "");
 if (phone) {
 window.open(
 `https://wa.me/${phone.startsWith("6")? phone : "6" + phone}?text=${encodeURIComponent(msg)}`,
 "_blank",
 "noopener,noreferrer",
 );
 }
 setTemplateToast(enq.id + "_" + key);
 setTimeout(() => setTemplateToast(null), 2000);
 setOpenTemplateId(null);
 };

 // appointment status

 const updateApptStatus = async (apptId, status) => {
 const { error } = await supabase.from("appointments").update({ status }).eq("id", apptId);
 if (error) { console.error("updateApptStatus:", error); toast.error("Could not update booking"); return; }
 setAppointments((p) =>
 p.map((a) => (a.id === apptId? { ...a, status } : a)),
 );
 };

 // ── booking lifecycle (ported from SalesmanLite) ───────────────────────────

 const scheduleAptReminder = async (apt) => {
 if (!apt.appointment_date) return;
 const remindAt = new Date(new Date(apt.appointment_date).getTime() - 60 * 60 * 1000).toISOString();
 const { error } = await supabase.from("appointments").update({ remind_at: remindAt, remind_sent: false }).eq("id", apt.id);
 if (error) { console.error("scheduleAptReminder:", error); return; }
 setAppointments((p) => p.map((a) => a.id === apt.id? { ...a, remind_at: remindAt, remind_sent: false } : a));
 };

 // Turn a booking into a pipeline lead. Prefers the lead the booking is already
 // tied to; a bare phone match can return the wrong buyer (a reused number) or a
 // stale "won" sibling, so an ambiguous match falls through to a fresh lead.
 const autoUpsertLeadFromAppt = async (apt) => {
 const phone = normalizePhone(apt.buyer_phone);
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
 const nameKey = (apt.buyer_name || "").trim().toLowerCase();
 existing =
 (nameKey && existingRows?.find((r) => (r.buyer_name || "").trim().toLowerCase() === nameKey)) ||
 (existingRows?.length === 1? existingRows[0] : null) ||
 null;
 if (existing && !apt.lead_id) {
 await supabase.from("appointments").update({ lead_id: existing.id }).eq("id", apt.id);
 setAppointments((p) => p.map((a) => a.id === apt.id? { ...a, lead_id: existing.id } : a));
 }
 }
 const viewIdx = LEAD_STAGES.indexOf("viewing_booked");
 if (existing) {
 const curIdx = LEAD_STAGES.indexOf(existing.stage);
 // Advance a lead sitting behind the booking stage. ALSO revive a lost lead
 // — the buyer just booked a fresh viewing. A won lead is left alone.
 const revive = existing.stage === "lost" || existing.stage === "closed_lost";
 if (curIdx < viewIdx || revive) {
 const { error: updErr } = await supabase.from("leads")
 .update({ stage: "viewing_booked", updated_at: new Date().toISOString() })
 .eq("id", existing.id);
 if (updErr) { console.error("autoUpsertLeadFromAppt advance:", updErr); toast.error("Could not move the lead"); return; }
 setLeads((p) => p.some((l) => l.id === existing.id)
 ? p.map((l) => l.id === existing.id? { ...l, stage: "viewing_booked" } : l)
 : p);
 // A revived/terminal lead may be filtered out of local state — refetch.
 if (!leads.some((l) => l.id === existing.id)) {
 const { data: full } = await supabase.from("leads")
 .select(LEAD_SELECT)
 .eq("id", existing.id).single();
 if (full) setLeads((p) => p.some((l) => l.id === full.id)? p.map((l) => l.id === full.id? full : l) : [full, ...p]);
 }
 toast.success("Moved to Viewing Booked");
 }
 } else {
 const { data: newLead, error: insErr } = await supabase.from("leads").insert({
 salesman_id: userId, dealer_id: profile?.dealer_id?? null,
 buyer_name: apt.buyer_name || "Unknown", phone,
 car_listing_id: apt.car_listing_id || null,
 stage: "viewing_booked", lead_source: "manual", is_deleted: false,
 }).select(LEAD_SELECT).single();
 if (insErr) { console.error("autoUpsertLeadFromAppt insert:", insErr); toast.error("Could not create the lead"); return; }
 if (newLead) {
 setLeads((p) => p.some((l) => l.id === newLead.id)? p.map((l) => l.id === newLead.id? newLead : l) : [newLead, ...p]);
 toast.success("Added to pipeline at Viewing Booked");
 if (!apt.lead_id) {
 await supabase.from("appointments").update({ lead_id: newLead.id }).eq("id", apt.id);
 setAppointments((p) => p.map((a) => a.id === apt.id? { ...a, lead_id: newLead.id } : a));
 }
 }
 }
 };

 const buildConfirmBookingMsg = (apt) => {
 const car = apt.car_listings;
 const carName = car? [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ") : "the car";
 const aptDate = apt.appointment_date? new Date(apt.appointment_date) : null;
 const dateStr = aptDate? aptDate.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" }) : "";
 const timeStr = aptDate? aptDate.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }) : "";
 const when = dateStr? ` on ${dateStr}${timeStr? ` at ${timeStr}` : ""}` : "";
 return `Hi ${apt.buyer_name || ""}! Your viewing for the ${carName} is confirmed${when}. See you then! Let me know if anything changes.`;
 };

 const openConfirmBookingModal = (apt) => {
 setConfirmBookingMsg(buildConfirmBookingMsg(apt));
 setConfirmBookingApt(apt);
 setReschedulingAptId(null);
 setCancelConfirmId(null);
 setReminderPickerAptId(null);
 };

 // Persist the confirm + lead advance FIRST, then hand off to WhatsApp.
 // WhatsApp-first backgrounds the page on mobile before the writes fire, which
 // left confirmed bookings out of the Booked pipeline stage.
 const sendConfirmBooking = async () => {
 const apt = confirmBookingApt;
 if (!apt ||!apt.buyer_phone) return;
 const phone = apt.buyer_phone.replace(/\D/g, "");
 const waPhone = phone.startsWith("6")? phone : "6" + phone;
 const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(confirmBookingMsg)}`;
 setConfirmBookingApt(null);
 setConfirmBookingMsg("");
 await updateApptStatus(apt.id, "confirmed");
 await autoUpsertLeadFromAppt(apt);
 scheduleAptReminder(apt);
 toast.success("Booking confirmed");
 window.location.href = waUrl;
 };

 // Confirm + advance without messaging, for when the buyer was already reached
 // another way.
 const moveConfirmBookingToPipeline = async () => {
 const apt = confirmBookingApt;
 if (!apt) return;
 setConfirmBookingApt(null);
 setConfirmBookingMsg("");
 await updateApptStatus(apt.id, "confirmed");
 await autoUpsertLeadFromAppt(apt);
 scheduleAptReminder(apt);
 toast.success("Booking confirmed");
 };

 // Default seller-booking slot: tomorrow 11:00, formatted for datetime-local.
 const defaultBookingSlot = () => {
 const d = new Date();
 d.setDate(d.getDate() + 1);
 d.setHours(11, 0, 0, 0);
 const pad = (n) => String(n).padStart(2, "0");
 return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
 };

 const confirmSellerBooking = async () => {
 const lead = sellerBookingLead;
 if (!lead ||!sellerBookingDate) return;
 const dt = new Date(sellerBookingDate);
 if (isNaN(dt.getTime())) { toast.error("Pick a valid date and time"); return; }
 setSellerBookingSaving(true);
 await updateLeadStage(lead.id, "viewing_booked");
 const remindAt = new Date(dt.getTime() - 60 * 60 * 1000).toISOString();
 const { data: apptRow, error: apptErr } = await supabase
 .from("appointments")
 .insert({
 salesman_id: userId,
 dealer_id: lead.dealer_id?? null,
 lead_id: lead.id,
 car_listing_id: lead.car_listing_id?? null,
 buyer_name: lead.buyer_name?? null,
 buyer_phone: lead.phone?? null,
 appointment_date: dt.toISOString(),
 booking_type: "viewing",
 status: "confirmed",
 remind_at: remindAt,
 remind_sent: false,
 })
 .select("id, lead_id, buyer_name, buyer_phone, appointment_date, status, notes, car_listing_id, created_at, remind_at, remind_sent, car_listings(id, brand, model, year, variant, selling_price, images, vin_number, plate_number, mileage, transmission, slug)")
 .single();
 setSellerBookingSaving(false);
 if (apptErr) { console.error("confirmSellerBooking:", apptErr); toast.error("Could not create the booking"); return; }
 if (apptRow) setAppointments((p) => p.find((a) => a.id === apptRow.id)? p : [apptRow, ...p]);
 setSellerBookingLead(null);
 setSellerBookingDate("");
 toast.success(`Booking confirmed for ${dt.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })} ${dt.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}`);
 };

 const autoCreateLeadFromEnq = async (enq) => {
 const phone = normalizePhone(enq.buyer_phone);
 if (!phone) return;
 const { data: existingRows } = await supabase
 .from("leads").select("id").eq("salesman_id", userId).eq("phone", phone).limit(1);
 if (!existingRows ||!existingRows.length) {
 const { data: newLead } = await supabase.from("leads").insert({
 salesman_id: userId, dealer_id: profile?.dealer_id?? null,
 buyer_name: enq.buyer_name || "Unknown", phone,
 notes: enq.buyer_message || null, car_listing_id: enq.listing_id || null,
 stage: "new", lead_source: "enquiry", is_deleted: false,
 }).select(LEAD_SELECT).single();
 if (newLead) { setLeads((p) => [newLead, ...p]); toast.success("Added to pipeline"); }
 }
 };

 // ── won flow ───────────────────────────────────────────────────────────────

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
 setCommissionData({
 total: rows.reduce((s, l) => s + (Number(l.commission_amount) || 0), 0),
 revenue: rows.reduce((s, l) => s + (Number(l.selling_price) || 0), 0),
 count: rows.length,
 });
 };

 // Marking a lead won is the single source of truth for a closed deal — the DB
 // trigger auto_create_customer_on_won fans it out (car → sold, customer row,
 // handover checklist). The car flip is ALSO written here so the UI reflects it
 // without waiting for a refetch; the trigger remains the real persistence.
 const handleMarkWon = async () => {
 if (!wonPrompt) return;
 const { lead } = wonPrompt;
 const leadId = lead.id;
 const dealerId = lead.dealer_id?? null;
 const now = new Date().toISOString();
 setWonSaving(true);

 const { error: leadErr } = await supabase
 .from("leads")
 .update({ stage: "won", updated_at: now })
 .eq("id", leadId);
 if (leadErr) {
 console.error("handleMarkWon lead:", leadErr);
 toast.error("Could not mark this deal as won");
 setWonSaving(false);
 return;
 }

 const { error: actErr } = await supabase.from("lead_activities").insert({
 lead_id: leadId,
 activity_type: "stage_changed",
 from_stage: lead.stage,
 to_stage: "won",
 created_by: userId,
 dealer_id: dealerId,
 });
 if (actErr) console.error("handleMarkWon activity:", actErr);

 if (lead.car_listing_id) {
 const { error: carErr } = await supabase
 .from("car_listings")
 .update({ status: "sold", sold_at: now })
 .eq("id", lead.car_listing_id);
 if (carErr) {
 console.error("handleMarkWon car listing:", carErr);
 toast.error("Deal won, but the car could not be marked sold");
 } else {
 // Mark sold in place rather than filtering the row out — sold counts read
 // myListings for status 'sold' + sold_at this month.
 setMyListings((p) => p.map((c) => c.id === lead.car_listing_id? { ...c, status: "sold", sold_at: now } : c));
 await refreshCommissionData();
 }
 }

 setLeads((p) => p.map((l) => l.id === leadId? { ...l, stage: "won", updated_at: now } : l));
 setWonSaving(false);
 setWonPrompt(null);

 // The DB trigger auto_create_customer_on_won has already fanned this out by
 // the time the update returns — customer row + 8-step checklist both exist.
 // Pull the shared state forward so Handover and Customers show it now rather
 // than on the next full page load.
 handover.addWonDeal({
 id: leadId,
 dealer_id: dealerId,
 buyer_name: lead.buyer_name,
 phone: lead.phone,
 car_listing_id: lead.car_listing_id || null,
 salesman_id: lead.salesman_id || userId,
 assigned_to: lead.assigned_to || null,
 updated_at: now,
 car_listings: lead.car_listings || null,
 });
 handover.refresh();
 refreshCustomers();

 const car = lead.car_listings;
 const carLabel = car? [car.year, car.brand, car.model].filter(Boolean).join(" ") : null;
 const buyerLabel = lead.buyer_name || "The buyer";
 toast.success(carLabel? `Deal won — ${carLabel} marked sold` : "Deal won", {
 description: `${buyerLabel} is now in Handover and on your Customers list.`,
 action: { label: "Open handover", onClick: () => openHandoverFor(leadId, "leads") },
 duration: 8000,
 });
 };

 const handleAddLead = async () => {
 setAddLeadSaving(true);
 // Phone is normalized to the canonical 60… form the DB stores. A raw
 // number here never matches when the same buyer later books a viewing,
 // which silently created a second lead for the same person.
 const { data, error: addErr } = await supabase
 .from("leads")
 .insert({
 dealer_id: profile?.dealer_id?? null,
 salesman_id: userId,
 assigned_to: userId,
 buyer_name: addLeadForm.buyer_name,
 phone: normalizePhone(addLeadForm.phone) || addLeadForm.phone,
 notes: addLeadForm.notes,
 car_listing_id: addLeadForm.car_listing_id || null,
 stage: "new",
 lead_source: "manual",
 is_deleted: false,
 loss_reason: null,
 buyer_state: addLeadForm.buyer_state || null,
 })
 .select(LEAD_SELECT)
 .single();
 if (addErr) { console.error("handleAddLead:", addErr); toast.error("Could not add the lead"); }
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

 // redeem_invite is a SECURITY DEFINER RPC that looks up the SINGLE row by
 // exact code (unused + unexpired) and returns only dealer_id — a pre-check for
 // clean UX. It replaces a direct select on dealer_invites, whose public policy
 // used to leak every pending invite (code/email/name) platform-wide (F3).
 const { data: redeemData } = await supabase.rpc("redeem_invite", {
 p_code: mergeCode.trim().toUpperCase(),
 });
 const invite = Array.isArray(redeemData) ? redeemData[0] : redeemData;

 if (!invite || !invite.dealer_id) {
 setMergeStatus("error");
 setMergeMsg("Invalid or expired invite code.");
 return;
 }

 // use_dealer_invite does the whole merge server-side in one atomic
 // SECURITY DEFINER call: links profiles.dealer_id (+ plan), re-tenants the
 // salesman's own leads + listings, and marks the invite used. The tenant move
 // is otherwise blocked by the escalation trigger, so this must not be a
 // client-side profiles/leads/car_listings write.
 const { error: mergeErr } = await supabase.rpc("use_dealer_invite", {
 invite_code: mergeCode.trim().toUpperCase(),
 });
 if (mergeErr) {
 setMergeStatus("error");
 setMergeMsg("Invalid or expired invite code.");
 return;
 }

 setMergeStatus("success");
 setMergeMsg("Merged! Redirecting to full dashboard...");
 setTimeout(() => navigate("/salesman"), 2500);
 };

 // Hashtag line for the WA caption — condition first (#used/#recon/#brandnew,
 // whichever this car actually is), then spec tags worth searching by.
 // Strict off the real field values, never a guessed default.
 const carHashtags = (car) => {
 const tags = [];
 const cond = (car.condition || "").toLowerCase();
 if (cond === "used") tags.push("used");
 else if (cond === "recon") tags.push("recon");
 else if (cond === "new") tags.push("brandnew");
 if (car.brand) tags.push(car.brand.replace(/\s+/g, ""));
 if (car.model) tags.push(car.model.replace(/\s+/g, ""));
 if (car.transmission) tags.push(car.transmission.toLowerCase().replace(/\s+/g, ""));
 if (car.fuel_type) tags.push(car.fuel_type.toLowerCase().replace(/\s+/g, ""));
 if (car.body_type) tags.push(car.body_type.toLowerCase().replace(/\s+/g, ""));
 if (car.loan_eligible) tags.push("loanavailable");
 if (car.warranty_months) tags.push("warranty");
 if (car.city) tags.push(car.city.replace(/\s+/g, ""));
 return [...new Set(tags)].filter(Boolean).map(t => `#${t}`).join(" ");
 };
 const CONDITION_LABEL = { used: "Used", recon: "Recon", new: "New" };

 const handleListingCopy = (car, type) => {
 const link = `https://xdrive.my/showroom/${car.slug}?ref=${profile?.slug || ""}`;
 let text = link;
 if (type === "wa") {
 const price = Number(car.selling_price || 0);
 const hashtags = carHashtags(car);
 text = [
 ` ${car.year} ${car.brand} ${car.model}${car.variant? " " + car.variant : ""}`,
 `RM ${price.toLocaleString()}`,
 ` ${car.city || car.location || "Malaysia"}`,
 ` ${car.mileage? Number(car.mileage).toLocaleString() + " km" : "—"} · ${car.colour || "—"} · ${car.transmission || "—"}`,
 ``,
 `Condition: ${CONDITION_LABEL[(car.condition || "").toLowerCase()] || car.condition || "Good"}`,
 ``,
 `Berminat? Whatsapp saya sekarang `,
 link,
 ...(hashtags? ["", hashtags] : []),
 ].join("\n");
 }
 navigator.clipboard.writeText(text);
 setListingCopied((prev) => ({ ...prev, [car.id]: type }));
 setTimeout(
 () => setListingCopied((prev) => ({ ...prev, [car.id]: null })),
 1500,
 );
 };

 // Listing completeness score — ported from Salesman Lite so both panels
 // agree on what "finish this listing" means.
 const listingScore = (car) => {
 const checks = [
 { pts: 25, ok: Array.isArray(car.images) && car.images.length >= 3, hint: `${Math.max(0, 3 - (car.images?.length || 0))} more photo${Math.max(0, 3 - (car.images?.length || 0)) !== 1 ? "s" : ""}` },
 { pts: 15, ok: Array.isArray(car.images) && car.images.length >= 1, hint: "add a photo" },
 { pts: 15, ok: !!car.selling_price, hint: "set a price" },
 { pts: 10, ok: !!car.mileage, hint: "add mileage" },
 { pts: 10, ok: !!car.colour, hint: "add colour" },
 { pts: 10, ok: !!car.variant, hint: "add variant" },
 { pts: 10, ok: !!car.state, hint: "add location" },
 { pts: 5, ok: !!car.condition, hint: "add condition" },
 ];
 const earned = checks.reduce((s, c) => s + (c.ok ? c.pts : 0), 0);
 const total = checks.reduce((s, c) => s + c.pts, 0);
 const missing = checks.filter(c => !c.ok).map(c => c.hint);
 return { pct: Math.round((earned / total) * 100), missing };
 };

 const updateListingStatus = async (car, newStatus) => {
 setStatusMenuCarId(null);
 const prevStatus = car.status;
 const prevSoldAt = car.sold_at ?? null;
 // Optimistically stamp sold_at so commission/goal figures pick the deal up
 // immediately — the DB trigger backfills the authoritative value.
 const optimisticSoldAt = newStatus === "sold" ? (prevSoldAt || new Date().toISOString()) : prevSoldAt;
 setMyListings((p) => p.map((c) => c.id === car.id ? { ...c, status: newStatus, sold_at: optimisticSoldAt } : c));
 // RPC avoids a PostgREST bug with GENERATED ALWAYS columns (gross_profit).
 const { error: statusErr } = await supabase.rpc("update_listing_status", {
 p_listing_id: car.id,
 p_status: newStatus,
 p_dealer_id: userId,
 });
 if (statusErr) {
 console.error("updateListingStatus:", statusErr);
 setMyListings((p) => p.map((c) => c.id === car.id ? { ...c, status: prevStatus, sold_at: prevSoldAt } : c));
 toast.error("Failed to update status");
 return;
 }
 refreshCommissionData();
 };

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
 setConfirmDeleteId(null);
 toast.success("Listing deleted");
 };

 const AI_CAPTION_PLATFORMS = ["whatsapp", "tiktok", "instagram", "facebook", "general"];

 const checkQuota = async (feature) => {
 try {
 const { data } = await supabase.rpc("salesman_ai_quota_ok", { p_feature: feature });
 return data!== false;
 } catch { return true; }
 };

 const logAiUsage = async (feature) => {
 // Single atomic increment server-side (keyed on auth.uid() + CURRENT_DATE).
 // The previous direct upsert targeted a non-existent `usage_date` column and
 // called a missing RPC, so usage never recorded → quota was never enforced.
 await supabase.rpc("increment_ai_usage", { p_feature: feature }).then(null, () => {});
 };

 const generateAiCaptions = async (car, platform = captionPlatform) => {
 if (!isPremium) return;
 setAiCaptionCar(car);
 setCaptionPlatform(platform);
 setCaptionCopied(false);
 const cacheKey = `${car.id}_${platform}`;
 if (aiCaptions[cacheKey]) return;
 const quotaOk = await checkQuota("caption");
 if (!quotaOk) { setCaptionQuotaOk(false); return; }
 setCaptionQuotaOk(true);
 setAiCaptionLoading(true);
 const name = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
 const price = car.selling_price? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : "harga on request";
 const mileage = car.mileage? `${Number(car.mileage).toLocaleString()} km` : "mileage not listed";
 const features = [car.transmission, car.colour, car.fuel_type, car.body_type].filter(Boolean).join(", ") || "standard features";
 const prompt = `You are a Malaysian used car salesman writing a social media caption in Bahasa Malaysia with some English. Tone: casual, excited, trustworthy. Car: ${name}. Price: ${price}. Mileage: ${mileage}. Key features: ${features}. Platform: ${platform}. Write one punchy caption with relevant emojis and a WhatsApp CTA. Max 150 words.`;
 try {
 const text = await callClaude(prompt, "You write viral Malaysian car sales captions. Reply with the caption text only, no labels.");
 setAiCaptions((p) => ({ ...p, [cacheKey]: text }));
 await supabase.from("ai_caption_logs").insert({ salesman_id: userId, car_id: car.id, platform, caption: text }).then(null, () => {});
 await logAiUsage("caption");
 } catch {
 setAiCaptions((p) => ({ ...p, [cacheKey]: "Couldn't generate caption. Please try again." }));
 } finally {
 setAiCaptionLoading(false);
 }
 };

 const generateAiWaReply = async (lead) => {
 if (!isPremium) return;
 const quotaOk = await checkQuota("wa_reply");
 if (!quotaOk) return;
 setWaReplyLoading((p) => ({ ...p, [lead.id]: true }));
 const car = lead.car_listings;
 const carName = car? `${car.brand} ${car.model}` : "the car";
 const prompt = `You are a Malaysian used car salesman. A buyer named ${lead.buyer_name || "kawan"} enquired about ${carName}. Their stage is ${lead.stage || "new"}. Last note: ${lead.notes || "no notes"}. AI score: ${leadScores[lead.id]?.score || "unknown"}. Write a short, friendly WhatsApp reply in casual Bahasa Malaysia + English mix. Max 3 sentences. Include the car name. End with a soft next step.`;
 try {
 const text = await callClaude(prompt, "You are a friendly Malaysian car salesman. Reply with the WhatsApp message text only.");
 setAiWaReplies((p) => ({ ...p, [lead.id]: text }));
 await supabase.from("ai_wa_reply_logs").insert({ salesman_id: userId, lead_id: lead.id, reply: text }).then(null, () => {});
 await logAiUsage("wa_reply");
 } catch {
 setAiWaReplies((p) => ({ ...p, [lead.id]: "Couldn't generate reply. Try again." }));
 } finally {
 setWaReplyLoading((p) => ({ ...p, [lead.id]: false }));
 }
 };

 const rescoreLead = async (lead) => {
 if (!isPremium) return;
 const quotaOk = await checkQuota("rescore");
 if (!quotaOk) return;
 setLeadScores((p) => ({ ...p, [lead.id]: { ...p[lead.id], loading: true } }));
 const daysOld = lead.created_at? Math.floor((Date.now() - new Date(lead.created_at)) / 86400000) : 0;
 const lastActivity = lead.updated_at? Math.floor((Date.now() - new Date(lead.updated_at)) / 86400000) : daysOld;
 const prompt = `Score this car sales lead. Respond ONLY with JSON:\n{"score":"hot"|"warm"|"cold","reason":"string max 15 words"}\nLead data:\n- Stage: ${lead.stage}\n- Days since created: ${daysOld}\n- Follow-up set: ${lead.follow_up_at? "yes" : "no"}\n- Last activity: ${lastActivity} days ago\n- Enquiry message: ${lead.notes || "none"}\n- Employment: ${lead.employment_type || "unknown"}\n- Income bracket: ${lead.income_bracket || "unknown"}\nHot = likely to buy within 2 weeks. Warm = interested but needs nurturing. Cold = low engagement or stale.`;
 try {
 const raw = await callClaude(prompt, "You are a lead scoring AI. Respond with JSON only, no markdown.");
 const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
 const now = new Date().toISOString();
 await supabase.from("leads").update({ ai_score: parsed.score, ai_score_reason: parsed.reason, ai_scored_at: now }).eq("id", lead.id);
 setLeads((p) => p.map((l) => l.id === lead.id? { ...l, ai_score: parsed.score, ai_score_reason: parsed.reason } : l));
 setLeadScores((p) => ({ ...p, [lead.id]: { score: parsed.score, reason: parsed.reason } }));
 await logAiUsage("rescore");
 } catch {
 setLeadScores((p) => { const n = { ...p }; if (n[lead.id]) delete n[lead.id].loading; return n; });
 }
 };

 const fetchFollowupSuggestions = async () => {
 if (!isPremium) return;
 setFollowupsLoading(true);
 try {
 const today = new Date().toISOString().slice(0, 10);
 const topLeads = leads
 .filter((l) =>!["closed_won", "closed_lost"].includes(l.stage))
 .filter((l) =>!l.follow_up_at || l.follow_up_at <= today)
 .sort((a, b) => {
 const scoreOrder = { hot: 3, warm: 2, cold: 1 };
 const aScore = scoreOrder[a.ai_score] || 0;
 const bScore = scoreOrder[b.ai_score] || 0;
 if (bScore!== aScore) return bScore - aScore;
 return new Date(a.created_at) - new Date(b.created_at);
 })
 .slice(0, 3);
 const results = await Promise.all(
 topLeads.map(async (lead) => {
 const daysSince = lead.updated_at? Math.floor((Date.now() - new Date(lead.updated_at)) / 86400000) : 0;
 const prompt = `Suggest one follow-up action for this car sales lead.\nRespond ONLY with JSON:\n{"type":"call"|"whatsapp"|"visit"|"offer"|"close","suggestion":"string max 20 words in BM/English mix"}\nLead: ${lead.buyer_name || "Lead"}, stage: ${lead.stage}, score: ${lead.ai_score || "unknown"}, days since last contact: ${daysSince}, last outcome: ${lead.last_call_outcome || "none"}`;
 try {
 const raw = await callClaude(prompt, "You are a sales coach. Respond with JSON only.");
 const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
 return { lead, ...parsed, is_acted_on: false };
 } catch { return { lead, type: "whatsapp", suggestion: "Hantar mesej WhatsApp semak status", is_acted_on: false }; }
 })
 );
 setAiFollowups(results);
 const rows = results.map((r) => ({ salesman_id: userId, lead_id: r.lead.id, suggestion_type: r.type, suggestion_text: r.suggestion }));
 if (rows.length) await supabase.from("ai_followup_suggestions").insert(rows).then(null, () => {});
 await logAiUsage("followup");
 } finally {
 setFollowupsLoading(false);
 }
 };

 const openBroadcast = (car) => {
 const name = [car.year, car.brand, car.model, car.variant]
 .filter(Boolean)
 .join(" ");
 const price = car.selling_price
? `RM ${Number(car.selling_price).toLocaleString("en-MY")}`
 : null;
 const link = car.slug? `https://xdrive.my/showroom/${car.slug}` : null;
 const msg = [
 `Hi! Tengok ni — ${name} dah ada dalam lineup kita!`,
 price? `Harga: ${price}` : null,
 `Kereta ni memang worth it — jangan sampai kena kebas orang lain `,
 link? `Details: ${link}` : null,
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
 const capped = eligibleLeads.slice(0, 10);
 setBroadcastProgress({ current: 0, total: capped.length });
 capped.forEach((lead, i) => {
 setTimeout(() => {
 const phone = (lead.phone || "").replace(/\D/g, "");
 if (phone) {
 window.open(
 `https://wa.me/${phone.startsWith("6")? phone : "6" + phone}?text=${encodeURIComponent(broadcastMsg)}`,
 "_blank",
 "noopener,noreferrer",
 );
 }
 setBroadcastProgress({ current: i + 1, total: capped.length });
 if (i === capped.length - 1) setBroadcastDone(true);
 }, i * 600);
 });
 };

 // TABS 

 // Bookings folded into Enquiries, so the Enquiries badge has to speak for
 // both — otherwise a pending viewing request is invisible from the nav.
 const pendingBookingsCount = appointments.filter((a) => a.status === "pending").length;
 const newEnquiriesCount = enquiries.filter((e) => e.status === "new").length;
 const inboxBadge = pendingBookingsCount + newEnquiriesCount;

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
 badge: leads.filter((l) => l.stage!== "lost").length || null,
 },
 {
 tab: "enquiries",
 label: "Inbox",
 icon: <MessageSquare style={{ width: 14, height: 14 }} />,
 badge: inboxBadge || null,
 },
 {
 // The end of the funnel: leads -> won -> paperwork + owner. Sold used to have
 // no nav slot at all, reachable only from two tiles on the Dashboard.
 tab: "sold",
 label: "Sold",
 icon: <ClipboardList style={{ width: 14, height: 14 }} />,
 badge: handover.activeCount || null,
 },
 {
 tab: "analytics",
 label: "Analytics",
 icon: <TrendingUp style={{ width: 14, height: 14 }} />,
 },
 {
 tab: "loans",
 label: "Loans",
 icon: <Banknote style={{ width: 14, height: 14 }} />,
 },
 ...(showOutreach ? [{
 tab: "outreach",
 label: "Outreach",
 icon: <Megaphone style={{ width: 14, height: 14 }} />,
 }] : []),
 {
 tab: "chat",
 label: "Chat",
 icon: <MessageSquare style={{ width: 14, height: 14 }} />,
 badge: chatUnread || null,
 },
 {
 tab: "settings",
 label: "Settings",
 icon: <Settings style={{ width: 14, height: 14 }} />,
 },
 ];

 // NOTIFICATION PANEL

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
 style={{
 position: "fixed",
 top: isMobile? 60 : 58,
 right: isMobile? 8 : 24,
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
 >Notifications{" "}
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
 >Mark all read
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
 >No notifications yet.
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
 color: n.is_read? "#9ca3af" : "#f1f5f9",
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

 // MOBILE NAV DRAWER — replaces the old fixed bottom bar (had grown to 10
 // flex:1 buttons in a 60px strip, each icon-only unless active — too
 // cramped to use). Reuses TABS_DESKTOP (same tab set the desktop sidebar
 // already renders) rather than a third parallel list. Overlay rules:
 // portalled to document.body (rule 1), body-scroll-lock via anyOverlayOpen
 // above (rule 2). Opened by the tour for every real step (see the tourStep
 // effect) and held open for the whole walkthrough — z-index MUST stay
 // below the tour's ring (1001) and card (1002) rendered in renderTour(),
 // or the drawer covers the tour instead of the tour showing the drawer.
 const renderMobileNav = () =>
 mobileNavOpen && createPortal(
 <div
 // While the tour is driving it (tourStep !== null), it owns open/close —
 // an accidental tap on the backdrop shouldn't close the drawer out from
 // under the ring the tour is currently pointing into it.
 onClick={() => { if (tourStep === null) setMobileNavOpen(false); }}
 style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.55)" }}
 >
 <nav
 onClick={(e) => e.stopPropagation()}
 style={{
 position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 1000,
 width: "min(78vw, 280px)",
 background: "#080a12",
 borderRight: "1px solid rgba(255,255,255,0.07)",
 display: "flex",
 flexDirection: "column",
 overflowY: "auto",
 boxShadow: "4px 0 24px rgba(0,0,0,0.4)",
 }}
 >
 <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
 <div style={{ width: 28, height: 28, background: "#2563eb", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "'Bebas Neue', sans-serif", fontWeight: 700, color: "#fff", flexShrink: 0 }}>S</div>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "2px", color: "#fff", lineHeight: 1, margin: 0 }}>SHIFTOS</p>
 <p style={{ fontSize: 10, color: "#4b5563", marginTop: 2, marginBottom: 0 }}>· {isPremium ? "Premium Panel" : "Lite Panel"}</p>
 </div>
 <button onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"
 style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}>
 <X size={18} />
 </button>
 </div>
 <p style={{ fontSize: 10, color: "#374151", textTransform: "uppercase", letterSpacing: "0.1em", padding: "12px 16px 4px", fontWeight: 600, margin: 0 }}>Main</p>
 {TABS_DESKTOP.map(({ tab, label, icon, badge }) => (
 <button
 key={tab}
 data-tour-id={tab}
 onClick={() => { switchTab(tab); setMobileNavOpen(false); }}
 style={{
 display: "flex", alignItems: "center", gap: 10,
 padding: "10px 16px", margin: "1px 8px", borderRadius: 8, cursor: "pointer",
 background: activeTab === tab ? "rgba(37,99,235,0.15)" : "transparent",
 border: activeTab === tab ? "0.5px solid rgba(37,99,235,0.25)" : "0.5px solid transparent",
 color: activeTab === tab ? "#93c5fd" : "#9ca3af",
 fontSize: 14, fontWeight: 500, width: "calc(100% - 16px)", textAlign: "left",
 }}
 >
 {icon}
 <span style={{ flex: 1 }}>{label}</span>
 {badge ? (
 <span style={{ fontSize: 10, background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.3)", color: "#93c5fd", borderRadius: 99, padding: "1px 6px" }}>{badge}</span>
 ) : null}
 </button>
 ))}
 <button
 onClick={() => { setMobileNavOpen(false); setLogoutConfirmOpen(true); }}
 style={{
 display: "flex", alignItems: "center", gap: 10, marginTop: "auto",
 padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)",
 background: "none", border: "none", borderTopWidth: 1, cursor: "pointer",
 color: "#6b7280", fontSize: 13, fontWeight: 500, textAlign: "left",
 }}
 >
 <LogOut size={15} /> Log out
 </button>
 </nav>
 </div>,
 document.body,
 );

 // RENDER DASHBOARD

 // Acting on a "This week" row has to persist. If it only hid the row in
 // local state the same person would be back tomorrow, and a call list you
 // cannot trust is worse than no call list at all.
 const handleThisWeekContacted = async (item) => {
 if (item.nudgeId) { closeNudge(item.nudgeId, "sent"); return; }
 if (!item.leadId) return;   // past-buyer rows have no lead to stamp
 const ts = new Date().toISOString();
 setLeads((p) => p.map((l) => (l.id === item.leadId ? { ...l, last_contacted_at: ts } : l)));
 const { error } = await supabase
 .from("leads")
 .update({ last_contacted_at: ts, updated_at: ts })
 .eq("id", item.leadId);
 if (error) {
 console.error("handleThisWeekContacted:", error);
 toast.error("Could not save that as contacted");
 setLeads((p) => p.map((l) => (l.id === item.leadId ? { ...l, last_contacted_at: null } : l)));
 }
 };

 // RENDER LEADS
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
 { key: "enquiry", label: "WhatsApp", color: "#4ade80" },
 { key: "booking", label: "Booking", color: "#60a5fa" },
 { key: "xdrive", label: "XDrive", color: "#f87171" },
 { key: "manual", label: "Manual", color: "#6b7280" },
 ].filter(s => srcMap[s.key] > 0);

 // pre-compute heat scores once
 const heatMap = new Map(searchedLeads.map((l) => [l.id, getHeatScore(l)]));

 const activeStages = LEAD_STAGES.filter(
 (s) => s!== "lost" && s!== "closed_lost" && s!== "closed_won",
 );
 const lostLeads = searchedLeads.filter(
 (l) => l.stage === "lost" || l.stage === "closed_lost",
 );

 const renderLeadCard = (lead) => {
 const car = lead.car_listings;
 const carName = car? [car.year, car.brand, car.model].filter(Boolean).join(" ") : null;
 const carPrice = car?.selling_price? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : null;
 const progressStages = ["new","contacted","viewing_booked","test_drive","negotiating","deposit_taken","won"];
 const normalizedStage = lead.stage === "closed_won"? "won" : lead.stage;
 const currentProgressIdx = progressStages.indexOf(normalizedStage);
 const stageIdx = LEAD_STAGES.indexOf(lead.stage);
 const nextStage = LEAD_STAGES.filter(
 (s) => s!== "lost" && s!== "closed_won" && s!== "closed_lost",
 ).find((s) =>LEAD_STAGES.indexOf(s) > stageIdx);
 const heat = getHeatScore(lead);
 const leadThread = threadByLead.get(lead.id) || null;
 // A won lead is not the end of the card's life — the deal is now a handover in
 // progress, and this is where the pipeline says so instead of going silent.
 const isWonLead = lead.stage === "won" || lead.stage === "closed_won";
 const handoverStatus = isWonLead ? handover.statusForLead(lead.id) : null;
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
 className={glowLeadIds.has(lead.id) ? "sp-lead-glow" : undefined}
 style={{
 background: "#0d1117",
 border: "1px solid rgba(255,255,255,0.07)",
 borderRadius: 10,
 overflow: "hidden",
 }}
 >
 {/* HEADER */}
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
 <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
 {leadIdsWithAddons.has(lead.id) && (
 <span title="This deal has a paid add-on attached" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 700, borderRadius: 99, padding: "2px 7px", background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.35)", color: "#93c5fd", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em" }}>
 <Package size={9} /> Add-on
 </span>
 )}
 {/* A loan application on this lead. leads.loan_* is kept in step with
     loan_applications by the DB trigger trg_sync_lead_loan, so this lights
     up whichever surface submitted the loan. */}
 {lead.loan_status && lead.loan_status !== "none" && (() => {
 const ls = {
 approved: { bg: "rgba(34,197,94,0.15)", bd: "rgba(34,197,94,0.35)", fg: "#4ade80", label: "Loan ok" },
 rejected: { bg: "rgba(239,68,68,0.15)", bd: "rgba(239,68,68,0.35)", fg: "#f87171", label: "Loan no" },
 cancelled: { bg: "rgba(255,255,255,0.06)", bd: "rgba(255,255,255,0.12)", fg: "#94a3b8", label: "Loan off" },
 }[lead.loan_status] || { bg: "rgba(251,191,36,0.15)", bd: "rgba(251,191,36,0.35)", fg: "#fbbf24", label: "Loan in" };
 return (
 <span title={[lead.loan_bank, lead.loan_amount ? `RM ${Number(lead.loan_amount).toLocaleString("en-MY")}` : null].filter(Boolean).join(" · ") || "Loan application on this deal"}
 style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 700, borderRadius: 99, padding: "2px 7px", background: ls.bg, border: `1px solid ${ls.bd}`, color: ls.fg, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em" }}>
 <Banknote size={9} /> {ls.label}
 </span>
 );
 })()}
 <span style={{ fontSize: 10, borderRadius: 99, padding: "2px 8px", background: heatStyle.bg, color: heatStyle.color, whiteSpace: "nowrap", fontWeight: 600 }}>
 {heat.label}
 </span>
 {(lead.ai_score || leadScores[lead.id]?.score) && (() => {
 const score = lead.ai_score || leadScores[lead.id]?.score;
 const c = score === "hot"? {bg:"#dc2626",tx:"#fff"} : score === "warm"? {bg:"#f59e0b",tx:"#000"} : {bg:"#52525b",tx:"#fff"};
 return <span style={{fontSize:9,fontWeight:800,background:c.bg,color:c.tx,borderRadius:4,padding:"1px 6px",flexShrink:0}}>{score.toUpperCase()}</span>;
 })()}
 </div>
 </div>
 {(carName || carPrice) && (
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2, gap: 8 }}>
 {carName && <p style={{ margin: 0, fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{carName}</p>}
 {carPrice && <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#60a5fa", flexShrink: 0 }}>{carPrice}</p>}
 </div>
 )}
 {lead.updated_at && (
 <p style={{ margin: "2px 0 0", fontSize: 10, color: Date.now() - new Date(lead.updated_at).getTime() > 48 * 3600 * 1000? "#fb923c" : "#374151" }}>Last contact: {timeAgo(lead.updated_at)}
 </p>
 )}
 {lead.last_call_outcome && (() => {
 const OUTCOME = { answered: { icon: CheckCircle, label: "Answered", color: "#4ade80" }, no_answer: { icon: PhoneOff, label: "No Answer", color: "#f87171" }, callback_requested: { icon: RefreshCw, label: "Callback", color: "#fbbf24" }, voicemail: { icon: Voicemail, label: "Voicemail", color: "#94a3b8" } };
 const o = OUTCOME[lead.last_call_outcome];
 if (!o) return null;
 return (
 <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 3, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: `${o.color}15`, border: `1px solid ${o.color}40`, color: o.color }}>
 <o.icon size={10} /> {o.label}
 </span>
 );
 })()}
 </div>
 </div>

 {/* Progress bar — 7 segments */}
 <div style={{ marginBottom: followUpOverdue? 8 : 12 }}>
 <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
 {progressStages.map((s, i) => (
 <div key={s} style={{ flex: 1, height: 3, borderRadius: 99, background: i < currentProgressIdx? "#9ca3af" : i === currentProgressIdx? "#f1f5f9" : "rgba(255,255,255,0.08)" }} />
 ))}
 </div>
 <p style={{ margin: 0, fontSize: 10, color: "#4b5563" }}>Stage: <span style={{ color: "#9ca3af", fontWeight: 600 }}>{(normalizedStage || "new").replace(/_/g, " ")}</span>
 {currentProgressIdx >= 0 && <span style={{ color: "#374151" }}> · {currentProgressIdx + 1}/{progressStages.length}</span>}
 </p>
 </div>

 {/* Follow-up warning */}
 {followUpOverdue && (
 <div style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.22)", borderRadius: 7, color: "#fb923c", fontSize: 11, padding: "6px 10px", marginBottom: 12 }}>Follow-up: {timeAgo(lead.follow_up_at)}
 </div>
 )}

 {/* Won -> what happens next. Tapping opens this buyer's handover checklist. */}
 {isWonLead && (() => {
 const done = handoverStatus?.done;
 const pct = handoverStatus?.progress;
 const tint = done ? "34,197,94" : "148,163,184";
 const fg = done ? "#4ade80" : "#cbd5e1";
 const detail = done
 ? "Handover complete"
 : pct === undefined || pct === null || pct < 0
 ? "Handover checklist started"
 : `Handover ${pct}%${handoverStatus?.next ? ` · Next: ${handoverStatus.next.label}` : ""}`;
 return (
 <button
 onClick={() => openHandoverFor(lead.id, "leads")}
 style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, textAlign: "left", background: `rgba(${tint},0.08)`, border: `1px solid rgba(${tint},0.2)`, borderRadius: 7, padding: "7px 10px", marginBottom: 12, cursor: "pointer", fontFamily: "inherit" }}
 >
 <ClipboardList size={13} color={fg} style={{ flexShrink: 0 }} />
 <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 Buyer moved to handover · <span style={{ color: "#9ca3af" }}>{detail}</span>
 </span>
 <ChevronRight size={13} color="#6b7280" style={{ flexShrink: 0 }} />
 </button>
 );
 })()}
 </div>

 {/* ACTIONS — exactly 3 buttons */}
 <div style={{ display: "flex", gap: 6, padding: "0 14px 12px" }}>
 {lead.stage!== "won" && lead.stage!== "closed_won" && (
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
 title="Call"
 aria-label="Call lead"
 style={{ flexShrink: 0, fontSize: 11, padding: "6px 14px", borderRadius: 7, background: "rgba(96,165,250,0.10)", border: "1px solid rgba(96,165,250,0.25)", color: "#93c5fd", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
 >
 <Phone size={13} />
 </a>
 )}
 {/* A buyer who chatted in the app is reachable HERE, and a guest buyer is
     reachable nowhere else — they never gave a phone. The in-app chat takes
     the WhatsApp slot rather than sitting beside it: this row is capped at
     three buttons, and WhatsApp stays one tap away in the detail panel. */}
 {leadThread? (
 <button
 onClick={() => setChatSheet({ threadId: leadThread.id, buyerName: lead.buyer_name || "Buyer", carLabel: carName })}
 title="Open the in-app chat with this buyer"
 style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 11, padding: "6px 12px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#e5e7eb", cursor: "pointer", fontFamily: "inherit" }}
 >
 <MessageSquare size={12} />Chat
 {leadThread.seller_unread > 0 && (
 <span style={{ minWidth: 15, height: 15, borderRadius: 99, background: "#dc2626", color: "#fff", fontSize: 9, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
 {leadThread.seller_unread}
 </span>
 )}
 </button>
 ) : lead.phone? (
 <button
 onClick={() => {
 const waCarName = car? `${car.brand} ${car.model}` : "kereta tu";
 const isStale = lead.updated_at && Date.now() - new Date(lead.updated_at).getTime() > 48 * 3600 * 1000;
 const msg = isStale
? `Hi ${lead.buyer_name || "kawan"}! Ada orang lain tengah tanya pasal ${waCarName} ni — kalau you still interested, jom lock dulu sebelum terlambat `
 : `Hi ${lead.buyer_name || "kawan"}! Macam mana, still interested dalam ${waCarName} tu? Jom kita discuss lagi `;
 setWaModalMessage(msg);
 setWaModalLead(lead);
 }}
 style={{ flex: 1, fontSize: 11, padding: "6px 12px", borderRadius: 7, background: "rgba(37,211,102,0.10)", border: "1px solid rgba(37,211,102,0.25)", color: "#4ade80", cursor: "pointer", textAlign: "center" }}
 >WA
 </button>
 ) :!lead.car_listing_id? (
 <button
 onClick={() => setLinkCarLeadId(lead.id)}
 style={{ flex: 1, fontSize: 11, padding: "6px 12px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer", textAlign: "center" }}
 >Link Car
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
 >Lead Pipeline ({leads.filter((l) => l.stage!== "lost" && l.stage!== "closed_lost" && l.stage!== "closed_won").length})
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
 <Plus size={13} />Add Lead
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
 <input
 value={leadSearch}
 onChange={(e) => setLeadSearch(e.target.value)}
 placeholder="Search by name or phone..."
 style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#e5e7eb", fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
 />
 {leadSearch && (
 <button onClick={() => setLeadSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#4b5563", cursor: "pointer", padding: 2 }}>
 <X size={13} />
 </button>
 )}
 </div>

 {isMobile? (
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
 fontWeight: isActive? 600 : 400,
 cursor: "pointer",
 background: isActive? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.04)",
 border: isActive? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(255,255,255,0.08)",
 color: isActive? "#f87171" : "#4b5563",
 textTransform: "capitalize",
 whiteSpace: "nowrap",
 }}
 >
 {stage.replace(/_/g, " ")}
 <span style={{
 fontSize: 10,
 fontWeight: 700,
 color: isActive? (sc.tx || "#f87171") : "#374151",
 background: isActive? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.06)",
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
 .sort((a, b) => (heatMap.get(b.id)?.score?? 0) - (heatMap.get(a.id)?.score?? 0));
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
 .sort((a, b) => (heatMap.get(b.id)?.score?? 0) - (heatMap.get(a.id)?.score?? 0));
 return (
 <div
 key={stage}
 style={{ minWidth: stageLeads.length === 0? 80 : 200, flexShrink: 0 }}
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
 onClick={() => setLostOpen((o) =>!o)}
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
 >Lost ({lostLeads.length})
 </span>
 <span style={{ fontSize: 12, color: "#374151" }}>
 {lostOpen? "" : ""}
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
 >Delete?
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
 >Yes
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
 >No
 </button>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* LINK A CAR TO A LEAD — the "Link Car" button set linkCarLeadId and
     nothing rendered for it, so the button did nothing at all and leads were
     stuck without a car (which in turn left the loan desk with nothing to
     finance). Portalled per overlay rule 1: it opens from inside the lead
     drawer, which is itself a fixed panel. */}
 {linkCarLeadId && createPortal(
 (() => {
 const target = leads.find((l) => l.id === linkCarLeadId);
 const closeLink = () => { setLinkCarLeadId(null); setLinkCarQuery(""); };
 const q = linkCarQuery.trim().toLowerCase();
 // Available first: a sold car is almost never the answer, but it stays
 // reachable because a mislinked lead has to be fixable.
 const options = [...myListings]
 .filter((c) => !q || [c.year, c.brand, c.model, c.variant].filter(Boolean).join(" ").toLowerCase().includes(q))
 .sort((a, b) => (a.status === "sold" ? 1 : 0) - (b.status === "sold" ? 1 : 0));
 return (
 <div onClick={closeLink} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20 }}>
 <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: isMobile ? "88vh" : "78vh", display: "flex", flexDirection: "column", background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: isMobile ? "16px 16px 0 0" : 14, fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>
 <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Link a car</p>
 <p style={{ margin: "1px 0 0", fontSize: 11.5, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 to {target?.buyer_name || "this lead"}
 </p>
 </div>
 <button onClick={closeLink} style={{ background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", color: "#9ca3af", borderRadius: 8, padding: 6, display: "flex", flexShrink: 0 }}>
 <X size={16} />
 </button>
 </div>

 <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
 <Search size={13} color="#4b5563" style={{ flexShrink: 0 }} />
 <input autoFocus value={linkCarQuery} onChange={(e) => setLinkCarQuery(e.target.value)} placeholder="Search your inventory…"
 style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "#e5e7eb", fontSize: 13, fontFamily: "inherit" }} />
 </div>

 <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
 {options.length === 0 ? (
 <p style={{ margin: 0, padding: "28px 16px", fontSize: 12.5, color: "#4b5563", textAlign: "center" }}>
 {myListings.length === 0 ? "You have no cars yet. Add one from Listings first." : "No car matches that search."}
 </p>
 ) : options.map((c) => {
 const img = Array.isArray(c.images) ? c.images.find(Boolean) : null;
 const isLinked = target?.car_listing_id === c.id;
 return (
 <button key={c.id} onClick={() => handleLinkCar(linkCarLeadId, c.id)} disabled={isLinked} style={{
 display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
 padding: "10px 14px", background: isLinked ? "rgba(96,165,250,0.08)" : "transparent",
 border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)",
 cursor: isLinked ? "default" : "pointer", fontFamily: "inherit",
 }}>
 {img ? (
 <img src={img} alt="" style={{ width: 54, height: 40, objectFit: "cover", borderRadius: 6, flexShrink: 0, background: "rgba(255,255,255,0.04)" }} />
 ) : (
 <div style={{ width: 54, height: 40, borderRadius: 6, flexShrink: 0, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
 <Car size={14} color="#374151" />
 </div>
 )}
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: 13, color: "#e5e7eb", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 {[c.year, c.brand, c.model, c.variant].filter(Boolean).join(" ")}
 </p>
 <p style={{ margin: "1px 0 0", fontSize: 11.5, color: "#6b7280" }}>
 {c.selling_price ? `RM ${Number(c.selling_price).toLocaleString("en-MY")}` : "No price"}
 {c.mileage ? ` · ${Number(c.mileage).toLocaleString("en-MY")} km` : ""}
 </p>
 </div>
 {isLinked ? (
 <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "rgba(96,165,250,0.15)", color: "#93c5fd" }}>
 <Check size={10} /> Linked
 </span>
 ) : c.status === "sold" ? (
 <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "#6b7280" }}>Sold</span>
 ) : null}
 </button>
 );
 })}
 </div>
 </div>
 </div>
 );
 })(),
 document.body,
 )}

 {/* LEAD DETAIL SIDEBAR */}
 {drawerLeadId && (() => {
 const pl = leads.find(l => l.id === drawerLeadId);
 if (!pl) return null;
 const plCar = pl.car_listings;
 const plCarName = plCar? [plCar.year, plCar.brand, plCar.model].filter(Boolean).join(" ") : null;
 const plCarPrice = plCar?.selling_price? `RM ${Number(plCar.selling_price).toLocaleString("en-MY")}` : null;
 const plCarImg = Array.isArray(plCar?.images)? plCar.images.find(Boolean) || null : null;
 const plHeat = getHeatScore(pl);
 const plHeatStyle = plHeat.label === "hot"? { bg: "rgba(248,113,113,0.12)", color: "#f87171" } : plHeat.label === "warm"? { bg: "rgba(251,191,36,0.12)", color: "#fbbf24" } : { bg: "rgba(255,255,255,0.05)", color: "#6b7280" };
 const plInitials = (pl.buyer_name || "?").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
 const plThread = threadByLead.get(pl.id) || null;
 const plIsPromptingLost = lostPromptId === pl.id;
 const plIsConfirmingDelete = deleteConfirmId === pl.id;
 const pbCar = pl.car_listings;
 const pbCarName = pbCar? `${pbCar.year || ""} ${pbCar.brand} ${pbCar.model}`.trim() : "this car";
 const pbStage = pl.stage;
 const scripts = {
 price: { label: "Price too high", color: "#f87171", lines: [`"Let's look at what you're actually paying monthly — at 90% loan over 7 years, that's roughly RM ${pbCar?.selling_price? Math.round(pbCar.selling_price * 0.9 * 1.245 / 84).toLocaleString() : "X"}/mo. That's less than a phone plan upgrade."`, `"What's your target price? Let me see what I can work out — I want to make this happen for you."`, `"This is already ${pbCar?.original_price && pbCar.original_price > pbCar.selling_price? `RM ${(pbCar.original_price - pbCar.selling_price).toLocaleString()} below asking` : "market price"}. The value is there."`] },
 mileage: { label: "High mileage concern", color: "#fb923c", lines: [`"Mileage matters less than service history. A well-maintained ${pbCarName} at ${pbCar?.mileage? Number(pbCar.mileage).toLocaleString() + "km" : "this mileage"} beats a low-km car that's been neglected."`, `"These engines are built to go 300k+ km with regular service. The price already reflects the mileage."`, `"I can help you run a CARFAX/JPJ check so you can see exactly what this car's been through."`] },
 timing: { label: "Not ready yet", color: "#fbbf24", lines: [`"Totally understand — what would need to change for you to feel ready? Is it financing, or something else?"`, `"I can hold this for you with a small refundable deposit while you sort things out. No pressure."`, `"Just so you know — cars at this price point move fast. I'd hate for you to miss it and find something worse for more money."`] },
 trust: { label: "Not sure / need to think", color: "#f87171", lines: [`"What specific questions can I answer right now? Let's remove all the uncertainty together."`, `"I'm not here to rush you — but I want to make sure you have everything you need to decide confidently."`, `"Can I send you a full brief on this car — specs, loan estimate, everything — so you have it all in one place?"`] },
 };
 const close = () => { setDrawerLeadId(null); setEditingNoteId(null); setPlaybookLeadId(null); setExpandedActivityLeadId(null); setLostPromptId(null); setDeleteConfirmId(null); };
 return (
 <>
 {/* backdrop */}
 <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} />
 {/* panel */}
 <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50, width: 400, maxWidth: "100vw", background: "#0d1117", borderLeft: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>

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

 {/* scrollable body */}
 <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, WebkitOverflowScrolling: "touch" }}>

 {/* THE CAR — the first thing a salesman needs and the thing this panel
     used to reduce to a single grey line under the buyer's name. */}
 <div>
 <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
 <p style={{ margin: 0, fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>Car</p>
 <button onClick={() => setLinkCarLeadId(pl.id)} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 9px", borderRadius: 6, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.28)", color: "#93c5fd", cursor: "pointer", fontFamily: "inherit" }}>
 {plCar ? "Change" : <><Plus size={11} /> Link a car</>}
 </button>
 </div>
 {plCar ? (
 <div style={{ display: "flex", gap: 11, padding: 10, borderRadius: 9, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
 {plCarImg ? (
 <img src={plCarImg} alt="" style={{ width: 78, height: 58, objectFit: "cover", borderRadius: 7, flexShrink: 0, background: "rgba(255,255,255,0.04)" }} />
 ) : (
 <div style={{ width: 78, height: 58, borderRadius: 7, flexShrink: 0, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
 <Car size={18} color="#374151" />
 </div>
 )}
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 {plCarName}{plCar.variant ? ` ${plCar.variant}` : ""}
 </p>
 {plCarPrice && <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 700, color: "#60a5fa" }}>{plCarPrice}</p>}
 <p style={{ margin: "3px 0 0", fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 {[plCar.mileage ? `${Number(plCar.mileage).toLocaleString("en-MY")} km` : null, plCar.transmission, plCar.colour].filter(Boolean).join(" · ") || "No specs on file"}
 </p>
 </div>
 </div>
 ) : (
 <p style={{ margin: 0, padding: "12px 10px", borderRadius: 9, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", fontSize: 12, color: "#4b5563", textAlign: "center" }}>
 No car linked yet — a loan started from this lead will have nothing to finance.
 </p>
 )}
 </div>

 {/* CONTACT + STATUS — everything the card shows, which this panel did not. */}
 <div>
 <p style={{ margin: "0 0 6px", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>Contact</p>
 <div style={{ display: "flex", flexDirection: "column", gap: 1, borderRadius: 9, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
 {/* The in-app conversation, when there is one. For a guest buyer this is
     the ONLY way to reach them, so it sits above the phone row. */}
 {plThread && (
 <button
 onClick={() => setChatSheet({ threadId: plThread.id, buyerName: pl.buyer_name || "Buyer", carLabel: plCarName })}
 style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", background: "rgba(255,255,255,0.02)", border: "none", width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}
 >
 <MessageSquare size={12} color="#6b7280" style={{ flexShrink: 0 }} />
 <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#e5e7eb" }}>In-app chat</span>
 {plThread.seller_unread > 0 && (
 <span style={{ flexShrink: 0, minWidth: 17, height: 17, borderRadius: 99, background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
 {plThread.seller_unread}
 </span>
 )}
 <ChevronRight size={13} color="#4b5563" style={{ flexShrink: 0 }} />
 </button>
 )}

 {/* Phone. Always present, because the row that matters most is the EMPTY
     one: a chat lead arrives with no number, and until this existed the
     only way to add one was to delete the lead and retype it by hand. */}
 <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", background: "rgba(255,255,255,0.02)" }}>
 <Phone size={12} color="#6b7280" style={{ flexShrink: 0 }} />
 {editPhoneLeadId === pl.id? (
 <>
 <input
 autoFocus
 type="tel"
 inputMode="tel"
 value={editPhoneVal}
 onChange={(e) => setEditPhoneVal(e.target.value)}
 onKeyDown={(e) => { if (e.key === "Enter") saveLeadPhone(pl.id); if (e.key === "Escape") setEditPhoneLeadId(null); }}
 placeholder="012 345 6789"
 aria-label="Buyer phone number"
 style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 6, color: "#e5e7eb", fontSize: 12.5, padding: "5px 9px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
 />
 <button onClick={() => saveLeadPhone(pl.id)} disabled={phoneSavingId === pl.id}
 style={{ flexShrink: 0, fontSize: 11, padding: "5px 11px", borderRadius: 6, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.22)", color: "#f87171", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", opacity: phoneSavingId === pl.id? 0.5 : 1 }}>
 {phoneSavingId === pl.id? "\u2026" : "Save"}
 </button>
 <button onClick={() => setEditPhoneLeadId(null)}
 style={{ flexShrink: 0, background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 2, display: "flex" }} aria-label="Cancel">
 <X size={13} />
 </button>
 </>
 ) : pl.phone? (
 <>
 <a href={`tel:${pl.phone}`} style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#e5e7eb", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.phone}</a>
 <button onClick={() => { setEditPhoneLeadId(pl.id); setEditPhoneVal(pl.phone || ""); }}
 style={{ flexShrink: 0, background: "none", border: "none", color: "#4b5563", cursor: "pointer", padding: 2, display: "flex" }} aria-label="Edit phone number">
 <Pencil size={11} />
 </button>
 {String(pl.phone).replace(/\D/g, "").length >= 9 && (
 <a href={`https://wa.me/${(() => { const dg = String(pl.phone).replace(/\D/g, ""); return dg.startsWith("6") ? dg : "6" + dg; })()}`} target="_blank" rel="noopener noreferrer"
 style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80", textDecoration: "none" }}>
 <MessageCircle size={10} /> WhatsApp
 </a>
 )}
 </>
 ) : (
 <button onClick={() => { setEditPhoneLeadId(pl.id); setEditPhoneVal(""); }}
 style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, color: "#6b7280", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
 <Plus size={11} />{plThread? "Add their number when they share it" : "Add phone number"}
 </button>
 )}
 </div>
 {pl.buyer_email && (
 <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", background: "rgba(255,255,255,0.02)" }}>
 <Mail size={12} color="#6b7280" style={{ flexShrink: 0 }} />
 <a href={`mailto:${pl.buyer_email}`} style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#e5e7eb", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.buyer_email}</a>
 </div>
 )}
 {pl.follow_up_at && (
 <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", background: "rgba(255,255,255,0.02)" }}>
 <Calendar size={12} color="#6b7280" style={{ flexShrink: 0 }} />
 <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: new Date(pl.follow_up_at).getTime() <= Date.now() ? "#fb923c" : "#e5e7eb" }}>
 Follow up {timeAgo(pl.follow_up_at)}
 </span>
 </div>
 )}
 <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: "rgba(255,255,255,0.02)", flexWrap: "wrap" }}>
 {pl.lead_source && (
 <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", color: "#9ca3af", textTransform: "capitalize" }}>
 {String(pl.lead_source).replace(/_/g, " ")}
 </span>
 )}
 {/* Same loan badge as the pipeline card - kept in step by trg_sync_lead_loan. */}
 {pl.loan_status && pl.loan_status !== "none" && (() => {
 const ls = {
 approved: { bg: "rgba(34,197,94,0.15)", bd: "rgba(34,197,94,0.35)", fg: "#4ade80", label: "Loan approved" },
 rejected: { bg: "rgba(239,68,68,0.15)", bd: "rgba(239,68,68,0.35)", fg: "#f87171", label: "Loan declined" },
 cancelled: { bg: "rgba(255,255,255,0.06)", bd: "rgba(255,255,255,0.12)", fg: "#94a3b8", label: "Loan cancelled" },
 }[pl.loan_status] || { bg: "rgba(251,191,36,0.15)", bd: "rgba(251,191,36,0.35)", fg: "#fbbf24", label: "Loan submitted" };
 return (
 <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: ls.bg, border: `1px solid ${ls.bd}`, color: ls.fg }}>
 <Banknote size={10} /> {ls.label}
 {pl.loan_bank ? ` · ${pl.loan_bank}` : ""}
 </span>
 );
 })()}
 {pl.updated_at && (
 <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#4b5563" }}>Last contact {timeAgo(pl.updated_at)}</span>
 )}
 </div>
 </div>
 </div>

 {/* Notes */}
 <div>
 <p style={{ margin: "0 0 6px", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>Notes</p>
 {editingNoteId === pl.id? (
 <div>
 <textarea autoFocus value={editNoteVal} onChange={e => setEditNoteVal(e.target.value)} rows={3} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, color: "#e5e7eb", fontSize: 13, padding: "8px 11px", resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
 <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
 <button onClick={() => saveLeadNote(pl.id)} disabled={notesSavingId === pl.id} style={{ fontSize: 12, padding: "7px 14px", borderRadius: 7, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.22)", color: "#f87171", cursor: "pointer", fontWeight: 600, opacity: notesSavingId === pl.id? 0.5 : 1 }}>{notesSavingId === pl.id? "…" : "Save"}</button>
 <button onClick={() => setEditingNoteId(null)} style={{ fontSize: 12, padding: "7px 14px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>Cancel</button>
 </div>
 </div>
 ) : pl.notes? (
 <p onClick={() => { setEditingNoteId(pl.id); setEditNoteVal(pl.notes || ""); }} style={{ margin: 0, fontSize: 13, color: "#9ca3af", fontStyle: "italic", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
 <Pencil size={12} /> "{pl.notes}"
 </p>
 ) : (
 <button onClick={() => { setEditingNoteId(pl.id); setEditNoteVal(""); }} style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit", width: "100%" }}>
 <Pencil size={12} />Add note…
 </button>
 )}
 </div>

 {/* Tool row 1 */}
 <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
 <button onClick={() => switchTab("loans")} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
 <DollarSign size={12} />Loan calc
 </button>
 <button onClick={() => { setLogCallLeadId(pl.id); setCallOutcome("answered"); setCallNote(""); }} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
 <PhoneCall size={12} />Log call
 </button>
 <button onClick={() => { setFollowUpModalLead(pl); setFollowUpDate(pl.follow_up_at? pl.follow_up_at.slice(0,10) : ""); }} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, background: pl.follow_up_at? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)", border: pl.follow_up_at? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(255,255,255,0.08)", color: pl.follow_up_at? "#fbbf24" : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
 <Clock size={12} />Set reminder
 </button>
 </div>

 {/* Tool row 2 */}
 <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
 <button onClick={() => { setExpandedActivityLeadId(null); setPlaybookLeadId(playbookLeadId === pl.id? null : pl.id); }} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", background: playbookLeadId === pl.id? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${playbookLeadId === pl.id? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.08)"}`, color: playbookLeadId === pl.id? "#c084fc" : "#9ca3af" }}>Scripts
 </button>
 <button onClick={() => { setPlaybookLeadId(null); if (expandedActivityLeadId === pl.id) setExpandedActivityLeadId(null); else fetchLeadActivities(pl.id); }} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", background: expandedActivityLeadId === pl.id? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${expandedActivityLeadId === pl.id? "rgba(96,165,250,0.3)" : "rgba(255,255,255,0.08)"}`, color: expandedActivityLeadId === pl.id? "#93c5fd" : "#9ca3af" }}>
 <History size={12} />History
 </button>
 <button onClick={() => setLinkCarLeadId(pl.id)} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
 {pl.car_listing_id? "Change Car" : "Link Car"}
 </button>
 {isPremium && (
 <button onClick={() => rescoreLead(pl)} style={{fontSize:12,padding:"7px 12px",borderRadius:7,background:"rgba(220,38,38,0.1)",border:"1px solid rgba(220,38,38,0.2)",color:"#fca5a5",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit"}}>
 {leadScores[pl.id]?.loading? "Scoring..." : "Re-score"}
 </button>
 )}
 </div>

 {/* Activity timeline */}
 {expandedActivityLeadId === pl.id && (
 <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "12px 14px" }}>
 <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em" }}>Activity History</p>
 {activitiesLoadingId === pl.id? (
 <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>Loading…</p>
 ) : (leadActivities[pl.id] || []).length === 0? (
 <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>No activity yet.</p>
 ) : (
 <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
 {(leadActivities[pl.id] || []).map((act, i) => {
 const icon = act.activity_type === "whatsapp_sent"? "" : act.activity_type === "call_logged"? "" : act.activity_type === "called"? "" : act.activity_type === "stage_changed"? "" : "";
 return (
 <div key={act.id || i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
 <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>{act.activity_type === "stage_changed"? `${act.from_stage || "?"} → ${act.to_stage || "?"}` : act.note || act.activity_type}</p>
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
 <button onClick={() => { navigator.clipboard.writeText(line.replace(/^"|"$/g,"")); setCopiedScriptLine(lineKey); setTimeout(() => setCopiedScriptLine(null), 1500); }} style={{ background: "none", border: "none", color: isCopied? "#4ade80" : "#4b5563", cursor: "pointer", padding: 0, flexShrink: 0 }}>
 {isCopied? <Check size={12} /> : <Copy size={12} />}
 </button>
 </div>
 );
 })}
 </div>
 ))}
 </div>
 )}

 {/* AI WA Reply */}
 {isPremium && pl.buyer_name && pl.phone && (
 <div style={{marginTop:12,borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:12}}>
 <p style={{margin:"0 0 6px",fontSize:11,fontWeight:600,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em"}}>AI WA Reply</p>
 {!aiWaReplies[pl.id]? (
 <button onClick={() => generateAiWaReply(pl)} disabled={waReplyLoading[pl.id]} style={{fontSize:11,padding:"6px 12px",borderRadius:7,background:"rgba(220,38,38,0.1)",border:"1px solid rgba(220,38,38,0.2)",color:"#fca5a5",cursor:"pointer"}}>
 {waReplyLoading[pl.id]? "Generating..." : "Generate AI Reply"}
 </button>
 ) : (
 <div>
 <textarea readOnly value={aiWaReplies[pl.id]} rows={4} style={{width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"#e5e7eb",fontSize:12,padding:"8px 10px",resize:"none",boxSizing:"border-box"}}/>
 <div style={{display:"flex",gap:6,marginTop:6}}>
 <button onClick={() => {navigator.clipboard.writeText(aiWaReplies[pl.id]);setWaReplyCopied(p=>({...p,[pl.id]:true}));setTimeout(()=>setWaReplyCopied(p=>({...p,[pl.id]:false})),1500);}} style={{fontSize:10,padding:"4px 10px",borderRadius:5,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#9ca3af",cursor:"pointer"}}>{waReplyCopied[pl.id]?"Copied!":"Copy"}</button>
 {pl.phone && <button onClick={()=>{const ph=pl.phone.replace(/\D/g,"");window.open(`https://wa.me/${ph.startsWith("6")?ph:"6"+ph}?text=${encodeURIComponent(aiWaReplies[pl.id])}`,"_blank");}} style={{fontSize:10,padding:"4px 10px",borderRadius:5,background:"rgba(37,211,102,0.1)",border:"1px solid rgba(37,211,102,0.2)",color:"#4ade80",cursor:"pointer"}}>Send via WA</button>}
 <button onClick={()=>setAiWaReplies(p=>{const n={...p};delete n[pl.id];return n;})} style={{fontSize:10,padding:"4px 10px",borderRadius:5,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",color:"#6b7280",cursor:"pointer"}}>Regenerate</button>
 </div>
 </div>
 )}
 </div>
 )}

 {/* Divider */}
 <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

 {/* Deal add-ons — paid upsells from this salesman's own catalogue
     (Listings > Add-ons), attached to this specific deal. This is the
     back-end gross on the sale, as opposed to a car's free
     included_services. */}
 <div>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
 <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Add-ons</p>
 {dealAddons.length > 0 && (
 <span style={{ fontSize: 12, fontWeight: 700, color: "#93c5fd" }}>
 RM {dealAddons.reduce((sum, a) => sum + (Number(a.sold_price) || 0), 0).toLocaleString("en-MY")}
 </span>
 )}
 </div>
 {addonsLoading? (
 <p style={{ fontSize: 12, color: "#4b5563", margin: 0 }}>Loading…</p>
 ) : (
 <>
 {dealAddons.map((a) => (
 <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", marginBottom: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8 }}>
 <span style={{ fontSize: 12, color: "#e5e7eb", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.dealer_products?.name || "—"}</span>
 <span style={{ fontSize: 12, fontWeight: 600, color: "#93c5fd", flexShrink: 0 }}>RM {Number(a.sold_price || 0).toLocaleString("en-MY")}</span>
 <button onClick={() => handleRemoveAddon(a.id)} title="Remove this add-on" style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", display: "flex", padding: 2, flexShrink: 0 }}>
 <X size={13} />
 </button>
 </div>
 ))}
 {!showAttachAddon? (
 <button onClick={() => { setShowAttachAddon(true); setAddonForm({ product_id: "", sold_price: "" }); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, width: "100%", fontSize: 12, fontWeight: 600, padding: "8px 12px", borderRadius: 8, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)", color: "#93c5fd", cursor: "pointer", fontFamily: "inherit" }}>
 <Plus size={12} /> Attach an add-on
 </button>
 ) : (
 <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: 12 }}>
 {addonCatalogue.length === 0? (
 <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px", lineHeight: 1.5 }}>No products in your catalogue yet. Add them under Listings → Add-ons, then attach them to a deal here.</p>
 ) : (
 <>
 <select
 value={addonForm.product_id}
 onChange={(e) => { const sel = addonCatalogue.find((pr) => pr.id === e.target.value); setAddonForm((f) => ({ ...f, product_id: e.target.value, sold_price: sel? String(sel.selling_price) : f.sold_price })); }}
 style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px", color: "#e5e7eb", fontSize: 12, fontFamily: "inherit", marginBottom: 6, boxSizing: "border-box" }}
 >
 <option value="">Select a product…</option>
 {addonCatalogue.map((pr) => (
 <option key={pr.id} value={pr.id}>{pr.name} — RM {Number(pr.selling_price || 0).toLocaleString("en-MY")}</option>
 ))}
 </select>
 <input
 type="number"
 min="0"
 value={addonForm.sold_price}
 onChange={(e) => setAddonForm((f) => ({ ...f, sold_price: e.target.value }))}
 placeholder="Price actually sold at (RM)"
 style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px", color: "#e5e7eb", fontSize: 12, fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box" }}
 />
 </>
 )}
 <div style={{ display: "flex", gap: 6 }}>
 <button onClick={() => setShowAttachAddon(false)} style={{ flex: 1, padding: "7px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
 {addonCatalogue.length > 0 && (
 <button onClick={handleAttachAddon} disabled={attachingAddon ||!addonForm.product_id ||!addonForm.sold_price} style={{ flex: 1, padding: "7px", borderRadius: 8, background: "#2563eb", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (!addonForm.product_id ||!addonForm.sold_price || attachingAddon)? 0.5 : 1, fontFamily: "inherit" }}>
 {attachingAddon? "Attaching…" : "Attach"}
 </button>
 )}
 </div>
 </div>
 )}
 </>
 )}
 </div>

 {/* Divider */}
 <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

 {/* Lost / Delete zone */}
 {plIsPromptingLost? (
 <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
 <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginRight: 2 }}>Why lost?</span>
 {LOST_REASONS.map(r => (
 <button key={r} onClick={() => handleLostReason(pl.id, r)} disabled={lostSavingId === pl.id} style={{ fontSize: 11, padding: "6px 10px", borderRadius: 99, background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)", color: "#cbd5e1", cursor: "pointer", opacity: lostSavingId === pl.id? 0.5 : 1, fontFamily: "inherit" }}>
 {lostSavingId === pl.id? "…" : r}
 </button>
 ))}
 <button onClick={() => setLostPromptId(null)} style={{ fontSize: 11, padding: "6px 10px", background: "transparent", border: "none", color: "#4b5563", cursor: "pointer" }}></button>
 </div>
 ) : plIsConfirmingDelete? (
 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
 <span style={{ fontSize: 13, color: "#f87171", fontWeight: 600 }}>Delete this lead?</span>
 <button onClick={() => handleDeleteLead(pl.id)} disabled={deletingLeadId === pl.id} style={{ fontSize: 12, padding: "7px 14px", borderRadius: 7, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", cursor: "pointer", fontWeight: 600, opacity: deletingLeadId === pl.id? 0.5 : 1, fontFamily: "inherit" }}>{deletingLeadId === pl.id? "…" : "Yes, delete"}</button>
 <button onClick={() => setDeleteConfirmId(null)} style={{ fontSize: 12, padding: "7px 14px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>No</button>
 </div>
 ) : (
 <div style={{ display: "flex", gap: 8 }}>
 {pl.stage!== "won" && pl.stage!== "closed_won" && (
 <button onClick={() => { setDeleteConfirmId(null); setLostPromptId(pl.id); }} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>Mark as lost
 </button>
 )}
 <button onClick={() => { setLostPromptId(null); setDeleteConfirmId(pl.id); }} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#4b5563", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
 <Trash2 size={13} />Delete
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

 // RENDER ENQUIRIES 

 const renderEnquiries = () => {
 // Lead History log — LEAD-CENTRIC: every lead is its own entry so a new lead
 // never disappears behind an enquiry sharing its phone. Only PURE enquiries
 // (no lead yet on that phone) are appended, so a brand-new, not-yet-converted
 // enquiry still surfaces with its quick actions. Ported from Lite.
 const leadByPhone = new Map();
 leads.forEach((l) => {
 const p = normalizePhone(l.phone);
 if (p &&!leadByPhone.has(p)) leadByPhone.set(p, l);
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
 return!p ||!leadPhones.has(p);
 });
 const historyItems = [...pureEnquiries, ...leadItems];

 return (
 <div>
 <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>
 Lead History ({historyItems.length})
 </p>
 {historyItems.length === 0 && (
 <div style={{ padding: "40px 0", textAlign: "center", color: "#374151" }}>
 <MessageSquare size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
 <p style={{ margin: 0, fontSize: 13 }}>No lead history yet.</p>
 <p style={{ margin: "6px 0 14px", fontSize: 12, color: "#374151" }}>Enquiries and leads appear here as your listings get shared.</p>
 <button onClick={() => switchTab("listings")} style={{ fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 8, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.22)", color: "#f87171", cursor: "pointer" }}>
 Go to Listings →
 </button>
 </div>
 )}
 <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
 {[...historyItems].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((enq) => {
 const car = enq.car_listings;
 const isNew = enq.status === "new";
 const matchedLead = enq._lead || leadByPhone.get(normalizePhone(enq.buyer_phone));
 const liveStage = matchedLead?.stage;
 const stageC = liveStage? (STAGE_COLOR[liveStage] || STAGE_NEUTRAL) : null;
 const isExpanded = expandedEnqId === enq.id;
 return (
 <div
 key={enq.id}
 onClick={() => setExpandedEnqId(isExpanded? null : enq.id)}
 style={{
 background: "#0d1117",
 border: "1px solid rgba(255,255,255,0.07)",
 borderRadius: 10,
 padding: isNew? "12px 14px" : "8px 14px",
 opacity: isNew? 1 : 0.85,
 cursor: "pointer",
 }}
 >
 {/* Header */}
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
 <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>
 {enq.buyer_name || "—"}
 </p>
 {isNew? (
 <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, flexShrink: 0, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", color: "#93c5fd" }}>
 New
 </span>
 ) : liveStage? (
 <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, flexShrink: 0, background: stageC.bg, border: `1px solid ${stageC.border}`, color: stageC.tx, textTransform: "capitalize" }}>
 {liveStage.replace(/_/g, " ")}
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
 <p style={{ margin: isNew? "0 0 8px" : 0, fontSize: 11, color: "#4b5563" }}>
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
 const carName = enqCar? `${enqCar.brand} ${enqCar.model}` : "kereta";
 const msg = encodeURIComponent(`Hi ${enq.buyer_name || ""}! Thank you for your enquiry on the ${carName}. I'm here to help — when would be a good time to chat? 😊`);
 // Persist first, WhatsApp hand-off last — navigating the current
 // tab to WhatsApp can suspend the page before pending writes finish.
 await supabase.from("whatsapp_enquiries").update({ status: "responded" }).eq("id", enq.id);
 setEnquiries((p) => p.map((e) => e.id === enq.id? { ...e, status: "responded" } : e));
 await autoCreateLeadFromEnq(enq);
 window.location.href = `https://wa.me/${phone.startsWith("6")? phone : "6" + phone}?text=${msg}`;
 }}
 style={{ fontSize: 10, padding: "6px 11px", borderRadius: 6, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#4ade80", cursor: "pointer" }}
 >
 WA Reply
 </button>
 )}
 {enq.buyer_phone && (
 <button
 onClick={() => setOpenTemplateId(openTemplateId === enq.id? null : enq.id)}
 style={{ fontSize: 10, padding: "6px 11px", borderRadius: 6, background: openTemplateId === enq.id? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${openTemplateId === enq.id? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.08)"}`, color: openTemplateId === enq.id? "#f87171" : "#6b7280", cursor: "pointer" }}
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
 style={{ textAlign: "left", fontSize: 11, padding: "7px 10px", borderRadius: 7, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: templateToast === toastKey? color : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
 >
 <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
 {templateToast === toastKey? "✓ Sent!" : label}
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

 // RENDER BOOKINGS 

 const renderBookings = () => {
 const aptIsToday = (iso) => {
 if (!iso) return false;
 const d = new Date(iso), t = new Date();
 return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
 };
 const aptIsNew = (iso) => iso && Date.now() - new Date(iso).getTime() < 2 * 60 * 60 * 1000;

 const statusColors = {
 pending: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)", tx: "#fbbf24" },
 confirmed: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)", tx: "#4ade80" },
 rescheduled: { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)", tx: "#c084fc" },
 cancelled: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", tx: "#f87171" },
 completed: { bg: "rgba(107,114,128,0.12)", border: "rgba(107,114,128,0.3)", tx: "#9ca3af" },
 no_show: { bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.3)", tx: "#fb923c" },
 };

 const setAptStatus = async (apt, status) => {
 const { error } = await supabase.from("appointments").update({ status }).eq("id", apt.id);
 if (error) { toast.error("Failed to update booking"); return; }
 setAppointments((p) => p.map((a) => a.id === apt.id? { ...a, status } : a));
 };

 const buildReminderMessage = (apt) => {
 const aptDate = new Date(apt.appointment_date);
 const dateStr = aptDate.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" });
 const timeStr = aptDate.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
 return `Hi ${apt.buyer_name || ""}! Just a reminder for your appointment on ${dateStr}${timeStr? ` at ${timeStr}` : ""}. See you then! 😊`;
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

 // Pending bookings are requests, not commitments yet — a window-shopper tap
 // shouldn't sit on the calendar next to real confirmed viewings. They get
 // their own always-visible section (any date); only once confirmed do they
 // join Today/Upcoming/Past.
 const pendingApts = appointments.filter((a) => a.status === "pending").sort(newestBooked);
 const confirmedApts = appointments.filter((a) => a.status!== "pending" && a.status!== "cancelled");
 const todayApts = confirmedApts.filter((a) => aptIsToday(a.appointment_date)).sort(asc);
 const upcomingApts = confirmedApts.filter((a) => {
 if (!a.appointment_date) return false;
 const d = new Date(a.appointment_date);
 return!isNaN(d) &&!aptIsToday(a.appointment_date) && d > new Date(nowTick);
 }).sort(newestBooked);
 const pastApts = confirmedApts.filter((a) => {
 if (!a.appointment_date) return false;
 const d = new Date(a.appointment_date);
 return!isNaN(d) &&!aptIsToday(a.appointment_date) && d < new Date(nowTick);
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
 return new Date(aptDate.getTime() + (mins[offsetKey]?? -60) * 60000);
 };

 const saveReminder = async (apt, remindAt) => {
 setReminderSaving(true);
 const { error } = await supabase.from("appointments").update({ remind_at: remindAt.toISOString(), remind_sent: false }).eq("id", apt.id);
 setReminderSaving(false);
 if (error) { toast.error("Couldn't set the reminder. Try again."); return; }
 setAppointments((p) => p.map((a) => a.id === apt.id? { ...a, remind_at: remindAt.toISOString(), remind_sent: false } : a));
 setReminderPickerAptId(null);
 setSelectedRemindAt(null);
 toast.success(`Reminder set — fires ${remindAt.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}`);
 };

 const clearReminder = async (apt) => {
 await supabase.from("appointments").update({ remind_at: null, remind_sent: false }).eq("id", apt.id);
 setAppointments((p) => p.map((a) => a.id === apt.id? { ...a, remind_at: null } : a));
 };

 const renderApptCard = (apt) => {
 const car = apt.car_listings;
 const { dateStr, timeStr } = fmtAptDate(apt.appointment_date);
 const sc = statusColors[apt.status] || statusColors.pending;
 const isRescheduled = apt.status === "rescheduled";
 const isFuture = apt.appointment_date && new Date(apt.appointment_date) > new Date(nowTick);
 const carTitle = car? [car.year, car.brand, car.model].filter(Boolean).join(" ") : "No car linked";
 const carPrice = car?.selling_price? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : null;
 const initials = (apt.buyer_name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
 const phone = (apt.buyer_phone || "").replace(/\D/g, "");
 const canConfirm = apt.status!== "confirmed" && apt.status!== "cancelled" && apt.status!== "completed";

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
 {STATUS_LABEL[apt.status] || apt.status}
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
 <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: isRescheduled? "#c084fc" : "#bfdbfe", padding: "4px 10px", borderRadius: 7, background: isRescheduled? "rgba(167,139,250,0.12)" : "rgba(96,165,250,0.12)", border: `1px solid ${isRescheduled? "rgba(167,139,250,0.35)" : "rgba(96,165,250,0.28)"}` }}>
 <Calendar size={13} /> {dateStr}{timeStr? ` · ${timeStr}` : ""}
 </span>
 {isFuture && <span style={{ fontSize: 11, fontWeight: 600, color: "#4ade80" }}>{preciseUntil(apt.appointment_date, nowTick, timeLabels)}</span>}
 {apt.remind_at &&!apt.remind_sent && <Bell size={12} color="#fbbf24" />}
 </div>
 </div>

 {/* Action row — primary CTA + call + ··· details */}
 <div style={{ display: "flex", gap: 6, padding: "0 14px 12px" }}>
 {canConfirm && apt.buyer_phone && (
 <button onClick={() => openConfirmBookingModal(apt)} title="Confirm this booking and message the buyer on WhatsApp"
 style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 7, background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.38)", color: "#4ade80", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
 <Check size={13} /> Confirm Booking
 </button>
 )}
 {canConfirm &&!apt.buyer_phone && (
 <button onClick={async () => { await updateApptStatus(apt.id, "confirmed"); await autoUpsertLeadFromAppt(apt); await scheduleAptReminder(apt); }} title="Mark appointment as confirmed"
 style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 7, background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.38)", color: "#4ade80", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
 <Check size={13} /> Confirm Booking
 </button>
 )}
 {apt.status === "confirmed" && apt.buyer_phone && (
 <button onClick={() => {
 const p = apt.buyer_phone.replace(/\D/g, "");
 const msg = buildReminderMessage(apt);
 window.location.href = `https://wa.me/${p.startsWith("6")? p : "6" + p}?text=${encodeURIComponent(msg)}`;
 }} title="Send WhatsApp reminder message to buyer"
 style={{ flex: 1, fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 7, background: "rgba(37,211,102,0.10)", border: "1px solid rgba(37,211,102,0.28)", color: "#4ade80", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
 <MessageCircle size={13} /> Message
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
 const notCancelled = apt.status!== "cancelled" && apt.status!== "completed";
 const anyExpander = isRescheduling || isReminderPicking || isCancelConfirm;
 const carImg = Array.isArray(car?.images)? car.images[0] : null;
 const carTitle = car? [car.year, car.brand, car.model].filter(Boolean).join(" ") : "No car linked";
 const carVariant = car?.variant || "";
 const carVin = car?.vin_number || car?.plate_number || "";
 const carPrice = car?.selling_price? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : null;
 const isFuture = apt.appointment_date && new Date(apt.appointment_date) > new Date(nowTick);
 const close = () => { setBookingDetailId(null); setReschedulingAptId(null); setReminderPickerAptId(null); setCancelConfirmId(null); setRescheduleDate(""); setSelectedRemindAt(null); };

 return createPortal(
 <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
 <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", background: "#1b2431", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px 16px 0 0", padding: 20, fontFamily: "system-ui, sans-serif" }}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
 <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 99, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.tx, textTransform: "capitalize" }}>
 {STATUS_LABEL[apt.status] || apt.status}
 </span>
 <button onClick={close} aria-label="Close" style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
 <X size={16} />
 </button>
 </div>

 {/* Car */}
 <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14 }}>
 {carImg? (
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
 {carVin && <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>{car?.vin_number? "VIN " : "Plate "}{carVin}</p>}
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
 {apt.remind_at &&!apt.remind_sent? (
 <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 7, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)", marginBottom: 12 }}>
 <Bell size={12} color="#4ade80" />
 <span style={{ fontSize: 11, color: "#4ade80", flex: 1 }}>
 Reminder: {new Date(apt.remind_at).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })} {new Date(apt.remind_at).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
 </span>
 <button onClick={() => clearReminder(apt)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 11, cursor: "pointer", padding: 0 }}>✕</button>
 </div>
 ) : apt.remind_sent? (
 <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 12px", display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={11} /> Reminder sent</p>
 ) : null}

 {/* Secondary actions */}
 {notCancelled &&!anyExpander && (
 <div style={{ display: "flex", gap: 6 }}>
 <button style={secBtn} onClick={() => {
 const existing = apt.appointment_date? new Date(apt.appointment_date) : new Date();
 const pad = (n) => String(n).padStart(2, "0");
 setRescheduleDate(`${existing.getFullYear()}-${pad(existing.getMonth() + 1)}-${pad(existing.getDate())}T${pad(existing.getHours())}:${pad(existing.getMinutes())}`);
 setReschedulingAptId(apt.id); setCancelConfirmId(null); setReminderPickerAptId(null);
 }}><RefreshCw size={13} /> Move</button>
 <button style={secBtn} onClick={() => {
 if (!profile?.telegram_chat_id) { toast.error("Connect Telegram in Settings first"); return; }
 setReminderPickerAptId(apt.id); setSelectedRemindAt(null); setCancelConfirmId(null); setReschedulingAptId(null);
 }}><Bell size={13} color={apt.remind_at? "#fbbf24" : undefined} /> Set reminder</button>
 <button style={{ ...secBtn, color: "#f87171" }} onClick={() => { setCancelConfirmId(apt.id); setReschedulingAptId(null); setReminderPickerAptId(null); }}><X size={13} /> Cancel</button>
 </div>
 )}

 {/* Expand: reschedule date picker */}
 {isRescheduling && (
 <div style={{ marginTop: 4, padding: "10px 12px", background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8 }}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
 <p style={{ margin: 0, fontSize: 11, color: "#c084fc", fontWeight: 600 }}>Choose new date & time</p>
 <button onClick={() => { setReschedulingAptId(null); setRescheduleDate(""); }} title="Cancel" style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 0, flexShrink: 0 }}>
 <X size={14} />
 </button>
 </div>
 <input type="datetime-local" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)}
 style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 7, color: "#e5e7eb", fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box", fontFamily: "system-ui, sans-serif", marginBottom: 8 }}
 />
 <div style={{ display: "flex", gap: 6 }}>
 <button onClick={() => { setReschedulingAptId(null); setRescheduleDate(""); }}
 style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>
 Cancel
 </button>
 <button onClick={async () => {
 if (!rescheduleDate) return;
 const newDate = new Date(rescheduleDate);
 const remindAt = new Date(newDate.getTime() - 60 * 60 * 1000).toISOString();
 await supabase.from("appointments").update({ appointment_date: newDate.toISOString(), status: "rescheduled", remind_at: remindAt, remind_sent: false }).eq("id", apt.id);
 setAppointments((p) => p.map((a) => a.id === apt.id? { ...a, appointment_date: newDate.toISOString(), status: "rescheduled", remind_at: remindAt, remind_sent: false } : a));
 setReschedulingAptId(null);
 setRescheduleDate("");
 toast.success("Appointment rescheduled!");
 }}
 style={{ flex: 2, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.35)", color: "#c084fc", cursor: "pointer" }}>
 Save New Time
 </button>
 </div>
 </div>
 )}

 {/* Expand: reminder time picker */}
 {isReminderPicking && (
 <div style={{ marginTop: 4, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
 <p style={{ margin: 0, fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>Schedule reminder</p>
 <button onClick={() => { setReminderPickerAptId(null); setSelectedRemindAt(null); }} title="Cancel" style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 0, flexShrink: 0 }}>
 <X size={14} />
 </button>
 </div>
 <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
 {[
 { key: "1h", label: "1h before" },
 { key: "2h", label: "2h before" },
 { key: "day_before", label: "Day before 9am" },
 { key: "two_days", label: "2 days before" },
 ].map(({ key, label }) => {
 const rt = calcRemindAt(apt, key);
 const active = selectedRemindAt && rt.getTime() === selectedRemindAt.getTime();
 return (
 <button key={key} onClick={() => setSelectedRemindAt(rt)}
 style={{ fontSize: 11, padding: "4px 10px", borderRadius: 99, cursor: "pointer",
 background: active? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.05)",
 border: active? "1px solid rgba(96,165,250,0.4)" : "1px solid rgba(255,255,255,0.08)",
 color: active? "#93c5fd" : "#6b7280" }}>
 {label}
 </button>
 );
 })}
 </div>
 <input type="datetime-local"
 value={selectedRemindAt? selectedRemindAt.toISOString().slice(0, 16) : ""}
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
 background: selectedRemindAt? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
 border: selectedRemindAt? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)",
 color: selectedRemindAt? "#4ade80" : "#374151",
 cursor: selectedRemindAt? "pointer" : "not-allowed",
 opacity: reminderSaving? 0.6 : 1 }}>
 {reminderSaving? "Saving…" : "Set reminder"}
 </button>
 </div>
 </div>
 )}

 {/* Expand: cancel confirmation */}
 {isCancelConfirm && (
 <div style={{ marginTop: 4, padding: "10px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8 }}>
 <p style={{ margin: "0 0 8px", fontSize: 12, color: "#f87171" }}>Cancel this appointment?</p>
 <div style={{ display: "flex", gap: 6 }}>
 <button onClick={() => setCancelConfirmId(null)}
 style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>
 Keep it
 </button>
 <button onClick={async () => { await updateApptStatus(apt.id, "cancelled"); setCancelConfirmId(null); setBookingDetailId(null); }}
 style={{ flex: 2, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", cursor: "pointer" }}>
 Yes, cancel appt
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
 Bookings ({confirmedApts.length})
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
 {/* Awaiting Confirmation — requests, not yet real bookings */}
 {pendingApts.length > 0 && (
 <div style={{ marginBottom: 20 }}>
 <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5 }}>
 <Clock size={11} color="#fbbf24" /> Awaiting Confirmation ({pendingApts.length})
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
 <Calendar size={11} color="#fbbf24" /> Today ({todayApts.length})
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
 <Check size={11} color="#4ade80" /> Confirmed Upcoming ({upcomingApts.length})
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
 onClick={() => setPastOpen((o) =>!o)}
 style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "6px 0", width: "100%" }}
 >
 <span style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", letterSpacing: "0.08em", textTransform: "uppercase" }}>
 Past ({pastApts.length})
 </span>
 <span style={{ fontSize: 12, color: "#374151" }}>{pastOpen? "▲" : "▼"}</span>
 </button>
 {pastOpen && (
 <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
 {pastApts.map((apt) => {
 const car = apt.car_listings;
 const { dateStr, timeStr } = fmtAptDate(apt.appointment_date);
 const sc = statusColors[apt.status] || statusColors.pending;
 const carLabel = car? [car.year, car.brand, car.model].filter(Boolean).join(" ") : null;
 // A past booking left in an open status has no automatic terminal
 // state — offer the two real outcomes explicitly.
 const needsOutcome = !["cancelled", "completed", "no_show"].includes(apt.status);
 return (
 <div key={apt.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 14px", opacity: 0.65 }}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
 <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 {apt.buyer_name || "—"}
 </p>
 <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, flexShrink: 0, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.tx, textTransform: "capitalize" }}>
 {STATUS_LABEL[apt.status] || apt.status}
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
 Mark Completed
 </button>
 <button
 onClick={() => setAptStatus(apt, "no_show")}
 style={{ fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.25)", color: "#fb923c", cursor: "pointer", fontFamily: "inherit" }}
 >
 No-show
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

 // RENDER SETTINGS 

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

 const localPhone = (settingsForm.whatsapp_number || "").replace(/^\+?60/, "");

 const handleAvatarUpload = async (e) => {
 const file = e.target.files?.[0];
 if (!file) return;
 if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
 setAvatarUploading(true);
 const compressed = await compressImageFile(file, { maxDim: 800 });
 const path = `${userId}/avatar.jpg`;
 const { error: upErr } = await supabase.storage.from("avatars").upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
 if (upErr) { toast.error("Upload failed: " + upErr.message); setAvatarUploading(false); return; }
 const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
 // Persist the busted URL, not the bare one — avatar.jpg is a fixed storage
 // path, so without a changing query string every future reader keeps
 // re-requesting (and getting served) the same cached image after a re-upload.
 const bustedUrl = `${publicUrl}?t=${Date.now()}`;
 const { error: avatarProfileErr } = await supabase.from("profiles").update({ avatar_url: bustedUrl }).eq("id", userId);
 setAvatarUploading(false);
 if (avatarProfileErr) {
 console.error("handleAvatarUpload profile update:", avatarProfileErr);
 toast.error("Photo uploaded but couldn't be saved to your profile — try again.");
 return;
 }
 setAvatarUrl(bustedUrl);
 setProfile((p) => ({ ...p, avatar_url: bustedUrl }));
 toast.success("Profile photo updated");
 };

 const handleCoverUpload = async (e) => {
 const file = e.target.files?.[0];
 if (!file) return;
 if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
 setCoverUploading(true);
 const compressed = await compressImageFile(file, { maxDim: 1600 });
 const path = `${userId}/cover.jpg`;
 const { error: upErr } = await supabase.storage.from("avatars").upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
 if (upErr) { toast.error("Upload failed: " + upErr.message); setCoverUploading(false); return; }
 const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
 // Persist the busted URL (see handleAvatarUpload) so re-uploads aren't
 // served stale from a browser/CDN cache keyed on the fixed storage path.
 const bustedUrl = `${publicUrl}?t=${Date.now()}`;
 const { error: coverProfileErr } = await supabase.from("profiles").update({ cover_url: bustedUrl }).eq("id", userId);
 setCoverUploading(false);
 if (coverProfileErr) {
 console.error("handleCoverUpload profile update:", coverProfileErr);
 toast.error("Photo uploaded but couldn't be saved to your profile — try again.");
 return;
 }
 setCoverUrl(bustedUrl);
 setProfile((p) => ({ ...p, cover_url: bustedUrl }));
 toast.success("Cover photo updated");
 };

 const handleSave = async () => {
 setSettingsSaving(true);
 const phone = "+60" + localPhone.replace(/\D/g, "");
 const rest = {
 city: settingsForm.city || null,
 state: settingsForm.state || null,
 location: settingsForm.location || null,
 instagram: settingsForm.instagram || null,
 tiktok: settingsForm.tiktok || null,
 facebook: settingsForm.facebook || null,
 website: settingsForm.website || null,
 bio: settingsForm.bio || null,
 response_time: settingsForm.response_time || null,
 specializations: settingsForm.specializations,
 deposit_policy: settingsForm.deposit_policy || null,
 deposit_terms: settingsForm.deposit_terms.trim() || null,
 processing_fee: String(settingsForm.processing_fee).trim() === "" ? null : (Number(settingsForm.processing_fee) || 0),
 };
 await supabase.from("profiles").update({ full_name: settingsForm.full_name, whatsapp_number: phone, ...rest }).eq("id", userId);
 setProfile((p) => ({ ...p, full_name: settingsForm.full_name, whatsapp_number: phone, ...rest }));
 setSettingsForm((p) => ({ ...p, whatsapp_number: phone }));
 setSettingsSaving(false);
 toast.success("Profile updated");
 };

 const removeTag = (i) =>
 setSettingsForm((p) => ({ ...p, specializations: p.specializations.filter((_, j) => j !== i) }));

 const handleTagKeyDown = (e) => {
 if (e.key === "Enter" && tagInput.trim()) {
 e.preventDefault();
 const val = tagInput.trim();
 if (!settingsForm.specializations.includes(val)) {
 setSettingsForm((p) => ({ ...p, specializations: [...p.specializations, val] }));
 }
 setTagInput("");
 }
 };

 // Send a test message to the salesman's own Telegram chat. Solo Premium
 // accounts have no bot token of their own, so send-telegram falls back to
 // the platform bot — the chat id typed here is the only thing to get right.
 // Saves it first so a test that works is a test of what gets persisted.
 const testTelegramConnection = async () => {
 const chatId = (settingsForm.telegram_chat_id || "").trim();
 if (!chatId) { toast.error("Enter a chat ID first"); return; }
 setTgTesting(true);
 try {
 const { error: chatIdErr } = await supabase.from("profiles").update({ telegram_chat_id: chatId }).eq("id", userId);
 if (chatIdErr) { toast.error("Could not save chat ID"); return; }
 const { data: { session } } = await supabase.auth.getSession();
 const { data } = await supabase.functions.invoke("send-telegram", {
 body: {
 dealer_id: getDealerIdFromProfile(profile),
 channel_id: chatId,
 message: `Telegram connected! You'll get appointment + booking reminders here. — ${profile?.full_name || "ShiftOS"}`,
 },
 headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
 });
 if (data?.ok) {
 setProfile((p) => ({ ...p, telegram_chat_id: chatId }));
 toast.success("Test message sent — check Telegram");
 } else if (data?.error === "not_started") {
 toast.error(`Message @${data.bot_username || "the bot"} first, then try again`);
 } else if (data?.error === "no_token") {
 toast.error("Telegram isn't set up on this account yet");
 } else {
 toast.error(data?.description || "Test failed");
 }
 } catch (err) {
 console.error("testTelegramConnection:", err);
 toast.error("Network error");
 } finally {
 setTgTesting(false);
 }
 };

 const initials = (profile?.full_name || profile?.slug || "S")[0].toUpperCase();

 return (
 <div style={{ maxWidth: 480 }}>
 <p style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>Profile Settings</p>

 {/* Push alerts on this device. Own id, not a dealer id — push_subscriptions
     RLS is auth.uid() = user_id. */}
 <div style={{ marginBottom: 24 }}>
 <PushToggle userId={profile?.id} theme="dark"
 style={{ padding: 16, background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }} />
 </div>

 <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, padding: "16px", background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
 <div style={{ position: "relative", flexShrink: 0 }}>
 {avatarUrl
? <img src={avatarUrl} alt="Profile" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.1)" }} />
 : <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, color: "#fff", border: "2px solid rgba(255,255,255,0.1)" }}>{initials}</div>
 }
 <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
 style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: "50%", background: "#2563eb", border: "2px solid #05070e", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
 {avatarUploading
? <div style={{ width: 10, height: 10, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
 : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
 }
 </button>
 <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
 </div>
 <div>
 <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{profile?.full_name || profile?.slug || "Your Name"}</p>
 <p style={{ margin: "3px 0 8px", fontSize: 11, color: "#4b5563" }}>Shown on your listings & profile page</p>
 <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer" }}>
 {avatarUploading? "Uploading…" : "Change photo"}
 </button>
 </div>
 </div>

 <div style={{ marginBottom: 24, padding: "16px", background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
 <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>Cover Photo</p>
 <p style={{ margin: "0 0 10px", fontSize: 11, color: "#4b5563" }}>Shown as the banner at the top of your public page</p>
 <div
 onClick={() => !coverUploading && coverInputRef.current?.click()}
 style={{ position: "relative", width: "100%", height: 90, borderRadius: 8, overflow: "hidden", cursor: coverUploading ? "default" : "pointer", background: coverUrl ? `center / cover no-repeat url(${coverUrl})` : "linear-gradient(135deg, #2a3142 0%, #1b202b 55%, #10131b 100%)", border: "1px solid rgba(255,255,255,0.08)" }}
 >
 <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: coverUploading ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.25)" }}>
 {coverUploading
? <div style={{ width: 22, height: 22, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
 : <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{coverUrl ? "Change cover photo" : "Add a cover photo"}</span>
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
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Full Name</label>
 <input value={settingsForm.full_name} onChange={(e) => setSettingsForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="Your full name" style={inputStyle} />
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>WhatsApp Number</label>
 <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, overflow: "hidden" }}>
 <span style={{ padding: "10px 12px", fontSize: 13, color: "#6b7280", background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap", flexShrink: 0 }}>+60</span>
 <input type="tel" value={localPhone} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setSettingsForm((p) => ({ ...p, whatsapp_number: "+60" + d })); }} placeholder="123456789"
 style={{ ...inputStyle, background: "transparent", border: "none", borderRadius: 0, flex: 1, width: "auto" }} />
 </div>
 <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>Malaysia country code pre-applied. Enter digits only.</p>
 </div>
 <div>
 <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
 <label style={{ fontSize: 11, color: "#6b7280", display: "inline-flex", alignItems: "center", gap: 5 }}><Send size={11} /> Telegram</label>
 {profile?.telegram_chat_id
 ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "#4ade80" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />Connected</span>
 : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "#4b5563" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4b5563", display: "inline-block" }} />Not set</span>
 }
 </div>
 <input value={settingsForm.telegram_chat_id} onChange={(e) => setSettingsForm((p) => ({ ...p, telegram_chat_id: e.target.value }))} placeholder="Your Telegram chat ID" style={inputStyle} />
 <button type="button" onClick={testTelegramConnection} disabled={tgTesting || !settingsForm.telegram_chat_id.trim()}
 style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 8, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)", color: "#93c5fd", fontFamily: "inherit", cursor: (tgTesting || !settingsForm.telegram_chat_id.trim()) ? "not-allowed" : "pointer", opacity: (tgTesting || !settingsForm.telegram_chat_id.trim()) ? 0.55 : 1 }}>
 <Send size={13} /> {tgTesting ? "Testing…" : "Send test message"}
 </button>
 <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151", lineHeight: 1.6 }}>Message <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" style={{ color: "#93c5fd", textDecoration: "none" }}>@userinfobot</a> on Telegram, send /start, and paste the Id number here.</p>
 </div>
 <div style={{ display: "flex", gap: 10 }}>
 <div style={{ flex: 1 }}>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>City</label>
 <input value={settingsForm.city} onChange={(e) => setSettingsForm((p) => ({ ...p, city: e.target.value }))} placeholder="e.g. Petaling Jaya" style={inputStyle} />
 </div>
 <div style={{ flex: 1 }}>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>State</label>
 <select value={settingsForm.state} onChange={(e) => setSettingsForm((p) => ({ ...p, state: e.target.value }))} style={{ ...inputStyle, appearance: "none" }}>
 <option value="">Select state</option>
 {["Johor","Kedah","Kelantan","Kuala Lumpur","Labuan","Melaka","Negeri Sembilan","Pahang","Penang","Perak","Perlis","Putrajaya","Sabah","Sarawak","Selangor","Terengganu"].map(s => (
 <option key={s} value={s}>{s}</option>
 ))}
 </select>
 </div>
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Full Address (for map)</label>
 <input value={settingsForm.location} onChange={(e) => setSettingsForm((p) => ({ ...p, location: e.target.value }))} placeholder="e.g. 12, Jalan Ampang, 50450 Kuala Lumpur" style={inputStyle} />
 <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>Shown as a map on your public page so buyers can find you.</p>
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>IC Number <span style={{ color: "#4b5563" }}>(private, verify only)</span></label>
 {profile?.ic_hash ? (
 <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 13px", borderRadius: 8, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
 <ShieldCheck size={15} style={{ color: "#22c55e", flexShrink: 0 }} />
 <span style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 600 }}>Verified</span>
 </div>
 ) : (
 <button onClick={() => { setIcGateVal(""); setIcGateOpen(true); }}
 style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 13px", borderRadius: 8, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
 <ShieldCheck size={15} style={{ flexShrink: 0 }} /> Verify your MyKad IC
 </button>
 )}
 <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>Stored hashed, never shown in plaintext. Buyers see a verified badge only.</p>
 </div>
 {/* Public-profile extras — Premium's own bio/specializations block, not
 offered to Lite yet. Shown on the public agent page with a Read-more
 toggle and pill tags, same as the linked-salesman panel. */}
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Bio</label>
 <textarea value={settingsForm.bio} onChange={(e) => setSettingsForm((p) => ({ ...p, bio: e.target.value }))}
 placeholder="e.g. Specializing in Perodua & Honda, 5 years experience in Klang Valley" rows={4}
 style={{ ...inputStyle, resize: "vertical" }} />
 <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>Shown below your name on your public page, with a "Read more" toggle.</p>
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Response Time</label>
 <input value={settingsForm.response_time} onChange={(e) => setSettingsForm((p) => ({ ...p, response_time: e.target.value }))} placeholder="e.g. Usually replies within 1 hour" style={inputStyle} />
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Specializations</label>
 {settingsForm.specializations.length > 0 && (
 <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
 {settingsForm.specializations.map((tag, i) => (
 <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", color: "#fca5a5", borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
 {tag}
 <button onClick={() => removeTag(i)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", opacity: 0.7 }}>
 <X size={10} />
 </button>
 </span>
 ))}
 </div>
 )}
 <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} placeholder="Type a specialization and press Enter" style={inputStyle} />
 <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>Press Enter to add each tag. Shown as pills on your public profile.</p>
 </div>
 {/* Social links */}
 {[
 { key: "instagram", label: "Instagram", placeholder: "@yourusername", prefix: "instagram.com/" },
 { key: "tiktok", label: "TikTok", placeholder: "@yourusername", prefix: "tiktok.com/@" },
 { key: "facebook", label: "Facebook", placeholder: "username or page name", prefix: "facebook.com/" },
 { key: "website", label: "Website", placeholder: "https://yoursite.com", prefix: null },
 ].map(({ key, label, placeholder, prefix }) => (
 <div key={key}>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>{label}</label>
 <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, overflow: "hidden" }}>
 {prefix && <span style={{ padding: "10px 10px", fontSize: 11, color: "#4b5563", background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap", flexShrink: 0 }}>{prefix}</span>}
 <input value={settingsForm[key]} onChange={(e) => setSettingsForm((p) => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
 style={{ ...inputStyle, background: "transparent", border: "none", borderRadius: 0, flex: 1, width: "auto" }} />
 </div>
 </div>
 ))}
 {/* Selling terms — you own these listings, so the buyer's questions (is my
 deposit safe, what else do I pay) land on you, not on a dealer. */}
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Deposit Policy</label>
 <select value={settingsForm.deposit_policy} onChange={(e) => setSettingsForm((p) => ({ ...p, deposit_policy: e.target.value }))} style={{ ...inputStyle, appearance: "none" }}>
 <option value="">Not stated — buyers are told to ask</option>
 <option value="refundable">Refundable if the buyer pulls out</option>
 <option value="refundable_on_loan_rejection">Refundable only if the loan is rejected</option>
 <option value="non_refundable">Non-refundable once paid</option>
 </select>
 <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>Shown at the deposit ask on every car you list.</p>
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Deposit Details (optional)</label>
 <input value={settingsForm.deposit_terms} onChange={(e) => setSettingsForm((p) => ({ ...p, deposit_terms: e.target.value }))} placeholder="e.g. Car reserved for 7 days." style={inputStyle} />
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Handling / Runner Fee</label>
 <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, overflow: "hidden" }}>
 <span style={{ padding: "10px 12px", fontSize: 13, color: "#6b7280", background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>RM</span>
 <input value={settingsForm.processing_fee} onChange={(e) => setSettingsForm((p) => ({ ...p, processing_fee: e.target.value.replace(/[^0-9.]/g, "") }))} placeholder="e.g. 300" inputMode="decimal"
 style={{ ...inputStyle, background: "transparent", border: "none", borderRadius: 0, flex: 1, width: "auto" }} />
 </div>
 <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>Your own fee on top of the official JPJ and Puspakom charges. Enter 0 if you charge none.</p>
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Username / Slug</label>
 <input value={profile?.slug || ""} readOnly style={{ ...inputStyle, color: "#4b5563", cursor: "not-allowed", background: "rgba(255,255,255,0.02)" }} />
 <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>Contact support to change your username.</p>
 </div>
 <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
 <button
 onClick={handleSave}
 disabled={settingsSaving}
 style={{
 padding: "10px 16px",
 borderRadius: 8,
 background: "#2563eb",
 border: "none",
 color: "#fff",
 fontSize: 13,
 fontWeight: 600,
 cursor: settingsSaving? "not-allowed" : "pointer",
 opacity: settingsSaving? 0.6 : 1,
 }}
 >
 {settingsSaving? "Saving..." : "Save Changes"}
 </button>
 </div>
 {/* Joining a dealership is a one-time action, not something that needs a
     permanent nav slot — it lives here, and /salesman-premium/merge still
     resolves to this section (see TAB_ALIASES). */}
 <div id="sp-merge" style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
 {renderMerge()}
 </div>
 {/* Replay the tour. It only auto-runs once (profiles.onboarding_tour_done),
     so without this there was no way back to it — and no way for anyone who
     skipped it on day one to find out what the other tabs do. */}
 <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
 <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>Product tour</p>
 <p style={{ margin: "0 0 10px", fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
 Walks you through every tab — Dashboard, Listings, Leads, Bookings, Lead History,
 Analytics, Loans, Outreach, Chat, Customers, Handover and Settings — opening each one
 as it goes, and putting you back where you started at the end.
 </p>
 <button
 onClick={startTour}
 style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e5e7eb", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
 >
 <Sparkles size={14} /> Replay the tour
 </button>
 </div>
 </div>
 );
 };

 // RENDER MERGE 

 const renderMerge = () => (
 <div style={{ maxWidth: 480 }}>
 <p
 style={{
 margin: "0 0 6px",
 fontSize: 16,
 fontWeight: 600,
 color: "#f1f5f9",
 }}
 >Join a Dealership
 </p>
 <p
 style={{
 margin: "0 0 24px",
 fontSize: 13,
 color: "#4b5563",
 lineHeight: 1.6,
 }}
 >Got an invite code from your dealer? Enter it below to merge your
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
 fontFamily: "system-ui, sans-serif",
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
 background: mergeStatus === "success"? "#16a34a" : "#2563eb",
 border: "none",
 color: "#fff",
 fontSize: 13,
 fontWeight: 600,
 cursor: "pointer",
 opacity:!mergeCode.trim() || mergeStatus === "pending"? 0.6 : 1,
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
 >Don't have a code? Ask your dealer to generate one from their ShiftOS
 Settings panel.
 </p>
 </div>
 );

 // ADD LEAD MODAL 

 const renderAddLeadModal = () =>
 showAddLead && createPortal(
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
 borderRadius: isMobile? "16px 16px 0 0" : 12,
 width: isMobile? "100%" : 480,
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
 >Add Lead
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
 fontFamily: "system-ui, sans-serif",
 }}
 />
 </div>
 ))}
 </div>
 <button
 onClick={handleAddLead}
 disabled={!addLeadForm.buyer_name || addLeadSaving}
 style={{
 marginTop: 20,
 width: "100%",
 padding: "10px",
 borderRadius: 8,
 background: "#2563eb",
 border: "none",
 color: "#fff",
 fontSize: 13,
 fontWeight: 600,
 cursor: "pointer",
 opacity:!addLeadForm.buyer_name || addLeadSaving? 0.6 : 1,
 }}
 >
 {addLeadSaving? "Saving..." : "Add Lead"}
 </button>
 </div>
 </div>
 </div>,
 document.body,
 );

 // WA MESSAGE MODAL

 const renderWAModal = () =>
 waModalLead && createPortal(
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
 >Send WA Message
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
 const phone = (waModalLead.phone || "").replace(/\D/g, "");
 if (phone) {
 window.open(
 `https://wa.me/${phone.startsWith("6")? phone : "6" + phone}?text=${encodeURIComponent(waModalMsg)}`,
 "_blank",
 "noopener,noreferrer",
 );
 }
 const now = new Date().toISOString();
 await supabase
 .from("leads")
 .update({ updated_at: now })
 .eq("id", waModalLead.id);
 await supabase.from("lead_activities").insert({
 lead_id: waModalLead.id,
 activity_type: "whatsapp_sent",
 note: "WA message sent",
 created_by: userId,
 dealer_id: waModalLead.dealer_id?? null,
 });
 setStaleLeads((p) => p.filter((l) => l.id!== waModalLead.id));
 setLeads((p) =>
 p.map((l) =>
 l.id === waModalLead.id? { ...l, updated_at: now } : l,
 ),
 );
 setWaModalLead(null);
 }}
 disabled={!waModalMsg.trim() ||!waModalLead.phone}
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
!waModalMsg.trim() ||!waModalLead.phone
? "not-allowed"
 : "pointer",
 opacity:!waModalMsg.trim() ||!waModalLead.phone? 0.6 : 1,
 }}
 >Send
 </button>
 {!waModalLead.phone && (
 <p
 style={{
 margin: "8px 0 0",
 fontSize: 11,
 color: "#f87171",
 textAlign: "center",
 }}
 >No phone number on this lead.
 </p>
 )}
 </div>
 </div>,
 document.body,
 );

 // CUSTOMERS (post-sale buyer records + prepaid service packages)

 const renderCustomers = () => {
 const today = new Date();
 const daysUntil = (date) => date? (new Date(date) - today) / 86400000 : null;
 const isDue = (date) => { const d = daysUntil(date); return d !== null && d <= 30; };
 const isExpired = (date) => { const d = daysUntil(date); return d !== null && d < 0; };
 const dotColor = (date) => { const d = daysUntil(date); return d === null? C.textDim : d < 0? C.dangerText : d <= 30? C.warnText : C.successText; };
 const expiryLabel = (date) => {
 if (!date) return "—";
 const d = daysUntil(date);
 const s = new Date(date).toLocaleDateString("en-MY", { day: "2-digit", month: "short" });
 return d < 0? `${s} · overdue` : d <= 30? `${s} · ${Math.round(d)}d` : s;
 };

 // Equity mining (RAPTOR-3). Two signals, both read straight off the customer
 // row. Deliberately NO estimated equity or trade-in figure: `customers` has a
 // selling price but no loan tenure or rate anywhere, so any "you have RM X in
 // equity" number would be invented. This surfaces WHO to call, not what to offer.
 //   ownership age — the classic trade cycle; the signal that matures as the
 //                   platform ages (nobody has owned 3 years yet)
 //   vehicle age   — works today: a 2019 car sold last month still leaves its
 //                   owner running a car that is seven model-years old
 const OWNED_READY_Y = 3;
 const VEHICLE_READY_Y = 5;
 const yearsSince = (date) => date ? (today - new Date(date)) / 31557600000 : null;
 const fmtDuration = (y) => { const m = Math.max(0, Math.round(y * 12)); return m < 12 ? `${m}m` : `${Math.floor(m / 12)}y${m % 12 ? ` ${m % 12}m` : ""}`; };
 const tradeUpFor = (c) => {
 const owned = yearsSince(c.purchase_date);
 const age = c.car_year ? today.getFullYear() - Number(c.car_year) : null;
 const reasons = [];
 if (owned !== null && owned >= OWNED_READY_Y) reasons.push(`Owned ${fmtDuration(owned)}`);
 if (age !== null && age >= VEHICLE_READY_Y) reasons.push(`${c.car_year} car · ${age} yrs`);
 if (!reasons.length) return null;
 return { reasons, score: (owned || 0) * 2 + (age || 0) };
 };
 const repName = (profile?.full_name || "").split(" ")[0];

 const rtDue = customers.filter(c => isDue(c.road_tax_expiry)).length;
 const insDue = customers.filter(c => isDue(c.insurance_expiry)).length;
 const tradeUpDue = customers.filter(c => tradeUpFor(c)).length;
 const anyExpired = customers.some(c => isExpired(c.road_tax_expiry) || isExpired(c.insurance_expiry));

 const filtered = customers.filter(c => {
 if (customerSearch && !`${c.name || ""} ${c.phone || ""}`.toLowerCase().includes(customerSearch.toLowerCase())) return false;
 if (expiryFilter === "ins" && !isDue(c.insurance_expiry)) return false;
 if (expiryFilter === "rt" && !isDue(c.road_tax_expiry)) return false;
 if (expiryFilter === "trade" && !tradeUpFor(c)) return false;
 return true;
 });
 // Strongest signal first, so the call list is already in order.
 if (expiryFilter === "trade") filtered.sort((x, y) => tradeUpFor(y).score - tradeUpFor(x).score);

 // The back control renders in the loading state too — a slow fetch should not
 // be a dead end on desktop, where there is no swipe.
 if (customersLoading) return (
 <p style={{ color: C.textMuted, fontSize: 13 }}>Loading customers…</p>
 );

 return (
 <div>
 <p style={{ margin: "0 0 14px", fontSize: 12, color: C.textMuted }}>Everyone who has bought from you — {customers.length} on record. Road tax and insurance expiry are tracked per car.</p>

 <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
 {[{ id: null, label: `All · ${customers.length}` }, { id: "ins", label: `Insurance due · ${insDue}` }, { id: "rt", label: `Road tax due · ${rtDue}` }, { id: "trade", label: `Trade-up ready · ${tradeUpDue}` }].map(f => (
 <button key={f.id || "all"} onClick={() => setExpiryFilter(f.id)}
 style={{ borderRadius: R.pill, padding: "5px 12px", fontSize: T.size.sm, fontWeight: T.weight.bold, cursor: "pointer", fontFamily: "inherit",
 background: expiryFilter === f.id? withAlpha(C.accent, 0.12) : "transparent", border: `1px solid ${expiryFilter === f.id? withAlpha(C.accent, 0.25) : C.border}`, color: expiryFilter === f.id? C.dangerText : C.textSec }}>
 {f.label}
 </button>
 ))}
 </div>

 {anyExpired && (
 <p style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: T.size.sm, color: C.textSec, margin: "0 0 14px", lineHeight: 1.5 }}>
 <AlertCircle size={14} color={C.warnText} style={{ flexShrink: 0, marginTop: 2 }} />
 <span>Some policies have <span style={{ color: C.warnText, fontWeight: 700 }}>expired</span> — worth a call before renewal.</span>
 </p>
 )}

 {expiryFilter === "trade" && (
 <p style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: T.size.sm, color: C.textSec, margin: "0 0 14px", lineHeight: 1.5 }}>
 <TrendingUp size={14} color={C.infoText} style={{ flexShrink: 0, marginTop: 2 }} />
 <span>Buyers who have owned {OWNED_READY_Y}+ years, or are running a car {VEHICLE_READY_Y}+ model-years old. It is a list of who to call — XDrive holds no valuation or loan balance, so check the car before you quote any number.</span>
 </p>
 )}

 <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search by name or phone…"
 style={{ width: "100%", background: C.fillStrong, border: `1px solid ${C.border}`, borderRadius: R.md, padding: "9px 12px", color: C.text, fontSize: T.size.base, outline: "none", fontFamily: "inherit", marginBottom: 14, boxSizing: "border-box" }} />

 {filtered.length === 0? (
 <p style={{ textAlign: "center", color: C.textDim, fontSize: 13, padding: "30px 0" }}>{customers.length === 0 ? "No customers yet — they appear here automatically once a deal is won." : "No customers match this filter."}</p>
 ) : (
 <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
 {filtered.map(c => {
 const pkgs = packagesMap[c.id] || [];
 const initials = (c.name || "?").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
 const cHandover = c.lead_id ? handover.statusForLead(c.lead_id) : null;
 const isLinked = customerParam === c.id;
 return (
 <div key={c.id} id={`customer-${c.id}`} style={{ ...CARD, padding: 15, ...(isLinked ? { borderColor: withAlpha(C.accent, 0.45) } : null) }}>
 <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
 <div style={{ width: 38, height: 38, borderRadius: R.pill, flexShrink: 0, background: C.fillStrong, display: "flex", alignItems: "center", justifyContent: "center" }}>
 <span style={{ fontSize: T.size.base, fontWeight: T.weight.bold, color: C.textSec }}>{initials}</span>
 </div>
 <div style={{ flex: 1, minWidth: 0 }}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
 <p style={{ margin: 0, fontSize: T.size.lg, fontWeight: T.weight.bold, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || "Unknown buyer"}</p>
 {c.phone && (
 <a href={`tel:${c.phone.replace(/\D/g, "")}`} style={{ color: C.textMuted, flexShrink: 0, display: "flex" }}>
 <Phone size={13} />
 </a>
 )}
 </div>
 <p style={{ margin: "2px 0 0", fontSize: T.size.sm, color: C.textMuted }}>{[c.car_year, c.car_brand, c.car_model].filter(Boolean).join(" ")}{c.car_plate? ` · ${c.car_plate}` : ""}{c.payment_type? ` · ${c.payment_type}` : ""}{c.purchase_date? ` · bought ${new Date(c.purchase_date).toLocaleDateString("en-MY", { month: "short", year: "numeric" })}` : ""}</p>

 <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
 <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
 <span style={{ width: 7, height: 7, borderRadius: R.pill, background: dotColor(c.road_tax_expiry), flexShrink: 0 }} />
 <p style={{ margin: 0, fontSize: T.size.sm, color: C.textSec }}>Road tax {expiryLabel(c.road_tax_expiry)}</p>
 </div>
 <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
 <span style={{ width: 7, height: 7, borderRadius: R.pill, background: dotColor(c.insurance_expiry), flexShrink: 0 }} />
 <p style={{ margin: 0, fontSize: T.size.sm, color: C.textSec }}>Insurance {expiryLabel(c.insurance_expiry)}</p>
 </div>
 </div>

 {(() => {
 const tu = tradeUpFor(c);
 if (!tu) return null;
 // Some rows carry junk phone values ("601", "1212112"). A wa.me link built
 // from those just opens a dead chat, so only offer it on a plausible number.
 const digits = (c.phone || "").replace(/\D/g, "");
 const ph = digits.length >= 9 ? digits : "";
 // Opening line only — it names no price, instalment, trade-in value or
 // approval, because nothing here knows any of those.
 const waMsg = `Hi ${c.name || "there"}, ${repName ? `${repName} here` : "reaching out"} from XDrive. You have had the ${[c.car_year, c.car_brand, c.car_model].filter(Boolean).join(" ")} a while now — if you are thinking about changing cars, I can take a look at it and tell you what your options are. No obligation.`;
 return (
 <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", padding: "7px 10px", borderRadius: R.md, background: withAlpha(C.info, 0.07), border: `1px solid ${withAlpha(C.info, 0.18)}` }}>
 <TrendingUp size={13} color={C.infoText} style={{ flexShrink: 0 }} />
 <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: T.size.sm, color: C.textSec }}>Trade-up ready · <span style={{ color: C.infoText, fontWeight: T.weight.semibold }}>{tu.reasons.join(" · ")}</span></p>
 {ph && (
 <button onClick={() => window.open(`https://wa.me/${ph.startsWith("6") ? ph : "6" + ph}?text=${encodeURIComponent(waMsg)}`, "_blank")}
 style={{ ...SOFT(C.infoText), fontSize: T.size.xs, fontWeight: T.weight.bold, padding: "4px 9px", borderRadius: R.sm, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Message</button>
 )}
 </div>
 );
 })()}

 {/* Where this buyer is in the paperwork. Same shared state the Handover
 tab and the pipeline card read, so all three always agree. */}
 {cHandover && (
 <button
 onClick={() => openHandoverFor(c.lead_id, "customers")}
 style={{ marginTop: 10, width: "100%", display: "flex", alignItems: "center", gap: 9, textAlign: "left", padding: "7px 10px", borderRadius: R.md,
 background: cHandover.done ? withAlpha(C.success, 0.07) : C.fill,
 border: `1px solid ${cHandover.done ? withAlpha(C.success, 0.18) : C.border}`, cursor: "pointer", fontFamily: "inherit" }}
 >
 <ClipboardList size={13} color={cHandover.done ? C.successText : C.textMuted} style={{ flexShrink: 0 }} />
 <span style={{ flex: 1, minWidth: 0, fontSize: T.size.sm, color: C.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 {cHandover.done
 ? <>Handover <span style={{ color: C.successText, fontWeight: T.weight.semibold }}>complete</span></>
 : <>Handover <span style={{ color: C.text, fontWeight: T.weight.semibold }}>{cHandover.progress < 0 ? "starting" : `${cHandover.progress}%`}</span>{cHandover.next ? ` · Next: ${cHandover.next.label}` : ""}</>}
 </span>
 <ChevronRight size={13} color={C.textDim} style={{ flexShrink: 0 }} />
 </button>
 )}

 {/* Shared with the dealer Customers tab — see components/crm/ServicePackages */}
 <ServicePackages
 customer={c} packages={pkgs} visits={pkgVisits} products={pkgProducts}
 onAdd={addPackage} onLogVisit={logVisit} onUndoVisit={undoVisit} theme="dark"
 />
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

 // HANDOVER (post-sale paperwork checklist, shared postsale/PostSaleBoard)
 const renderHandover = () => (
 <div>
 <p style={{ margin: "0 0 20px", fontSize: 12, color: C.textMuted }}>Paperwork and delivery for your won deals — loan settlement through to keys.</p>
 <Suspense fallback={<TabLoadingFallback />}>
 <PostSaleBoard
 dealerId={getDealerIdFromProfile(profile)}
 salesmanId={userId}
 dark
 controller={handover}
 openDealId={handoverDealParam}
 onViewCustomer={(lead) => openCustomerForLead(lead, "handover")}
 />
 </Suspense>
 </div>
 );

 // Sold — one destination for everything that happens after a deal is won.
 // Handover (the paperwork) and Customers (the people it produced) were two
 // separate tabs reachable only from a pair of unlabelled Dashboard tiles, so
 // salesmen never found either. Same two-pill pattern as Inbox and Listings.
 const renderSold = () => (
 <div style={{ maxWidth: 640 }}>
 {renderTabBack()}
 <p style={{ margin: "0 0 4px", fontSize: 19, fontWeight: 700, color: C.text }}>Sold</p>
 <p style={{ margin: "0 0 14px", fontSize: 12, color: C.textMuted }}>After the deal is won: the handover checklist, then the buyer.</p>
 <SubTabs
 value={soldSubTab}
 onChange={setSoldSubTab}
 items={[
 { key: "handover", label: "Handover", badge: handover.activeCount, tourId: "sold-handover" },
 { key: "customers", label: "Customers", tourId: "sold-customers" },
 ]}
 />
 {soldSubTab === "handover" ? renderHandover() : renderCustomers()}
 </div>
 );

 // LOANS — the whole desk lives in components/loans/LoanDesk.jsx. It used to be
 // three stacked panels here (a calculator, a SECOND form that re-asked the same
 // car price and down payment, and the list) plus ~80 lines of helpers.
 const renderLoans = () => (
 <Suspense fallback={<TabLoadingFallback />}>
 <LoanDesk
 userId={userId}
 dealerId={profile?.dealer_id || null}
 leads={leads}
 applications={loanApplications}
 setApplications={setLoanApplications}
 onLeadSync={(leadId, patch) => setLeads((p) => p.map((l) => (l.id === leadId ? { ...l, ...patch } : l)))}
 />
 </Suspense>
 );


 // TOUR

 // One step per TOUR_TABS entry — the 10 sidebar links, in nav order, plus
 // the welcome card. Titles match the nav labels exactly (TABS_DESKTOP)
 // since the ring and the bubble now always describe the same thing.
 const TOUR_STEPS = [
 { icon: Sparkles, title: "Welcome to ShiftOS Premium", body: "A quick walk down the menu — everything your plan unlocks, one link at a time." },
 { icon: BarChart2, title: "Dashboard", body: "Your command centre — KPIs, stale follow-up nudges, listing performance, and recent activity all in one view." },
 { icon: Car, title: "My Listings", body: "Add your cars here. Each card shows views, WA taps, and a CVR bar. Hot = buyers are clicking. Cold = needs a refresh or price drop. The Add-ons pill next to Cars is your paid extras catalogue." },
 { icon: Users, title: "Leads", body: "Track every buyer: New → Contacted → Test Drive → Won. Heat scores show who needs attention. Ping stale leads straight to WhatsApp." },
 { icon: MessageSquare, title: "Inbox", body: "Viewing appointments and buyer messages both land here. Bookings — confirm, reschedule, cancel or send a WA reminder. Lead History — everyone who messaged through your listing cards; reply with templates or convert them into pipeline leads in one tap." },
 { icon: ClipboardList, title: "Sold", body: "Everything after a won deal lives here. Handover is the 8-step Malaysian paperwork checklist — loan settlement, insurance, Puspakom, JPJ pindah milik, road tax, geran, keys. Customers is everyone who's bought from you, with road tax and insurance expiry tracked so the app tells you who's due for a renewal call or ready to trade up." },
 { icon: TrendingUp, title: "Analytics", body: "Views, WhatsApp taps and conversion rate per listing, plus your total commission and cars sold — all in one view." },
 { icon: Banknote, title: "Loans", body: "Compare bank rates for a buyer, submit their loan application, and track approval status — a Premium-only feature." },
 { icon: Megaphone, title: "Outreach", body: "See which leads have gone cold, then work through them with a guided WhatsApp campaign — one tap per contact. Premium-only." },
 { icon: MessageCircle, title: "Chat", body: "Buyers who message you from a listing land here instead of WhatsApp. You see their name, the car, and read receipts — and phone numbers stay masked until you tap them." },
 { icon: Settings, title: "Settings", body: "Your public profile, WhatsApp templates and account settings live here. Have an invite code from a dealer? Enter it at the bottom of this page to unlock the full panel — shared stock, team leads, commission tracking and more." },
 ];

 const dismissTour = () => {
 // Per-account DB flag (mirrors SalesmanLite.jsx:8373-8375) is the real
 // guard read on next mount; the per-user localStorage key is only a
 // same-session backup so a re-render before the write lands doesn't
 // re-trigger the tour.
 if (userId) {
 localStorage.setItem(`sp_tour_seen_${userId}`, "1");
 setProfile((p) => (p ? { ...p, onboarding_tour_done: true } : p));
 supabase.from("profiles").update({ onboarding_tour_done: true }).eq("id", userId).then(() => {});
 }
 setTourStep(null);
 setTourTarget(null);
 // The tour walked the user across 13 tabs; finishing or skipping should not
 // strand them on Settings, scrolled to the invite box.
 switchTab(tourReturnTab.current || "dashboard", { replace: true });
 window.scrollTo({ top: 0, behavior: "smooth" });
 };

 const startTour = () => {
 tourReturnTab.current = activeTab;
 setTourStep(0);
 };

 // Measure the rendered card so placement uses its real height. Guarded on a
 // 2px delta: this runs after every render, and writing state unconditionally
 // from a layout effect that state feeds back into would loop.
 useLayoutEffect(() => {
 const el = tourCardRef.current;
 if (tourStep === null || !el) return;
 const h = Math.round(el.getBoundingClientRect().height);
 if (!h) return;
 tourCardHRef.current = h;
 if (Math.abs(h - tourCardH) > 2) setTourCardH(h);
 }, [tourStep, tourCardH, isMobile]);

 const renderTour = () => {
 if (tourStep === null) return null;
 const step = TOUR_STEPS[tourStep];
 const isLast = tourStep === TOUR_STEPS.length - 1;
 const isWelcome = tourStep === 0;

 // Placement: the card is put on whichever side of the target has room, and
 // never on top of the target itself. See utils/tourPlacement.
 const BUBBLE_W = isMobile ? Math.min(320, window.innerWidth - 32) : 300;
 // The arrow used to be #1e2d3d while the card was #111827, so it read as a
 // stray notch rather than part of the bubble. One constant, both.
 const BUBBLE_BG = "#111827";
 // dock: on a phone there is no free column beside the target, so a floating
 // card always ends up on top of something. Docked, it lives in one fixed
 // strip at the bottom of the screen for every step and the page scrolls
 // the target into the space above it. navH: 0 — Premium's mobile nav is
 // now the renderMobileNav() drawer, not a fixed bottom bar, so there's no
 // nav height to leave clear (unlike Lite/Salesmanpanel's default).
 const place = { dock: isMobile, navH: 0 };
 const { style: bubbleStyle, arrow } = isWelcome
 ? placeTourCard(null, { w: BUBBLE_W, h: tourCardH }, window.innerWidth, window.innerHeight, place)
 : placeTourCard(tourTarget, { w: BUBBLE_W, h: tourCardH }, window.innerWidth, window.innerHeight, place);

 const arrowEl = arrow && (
 <div style={{
 position: "absolute",
 ...(arrow.side === "right"
 ? { left: -8, top: arrow.offset, borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderRight: `8px solid ${BUBBLE_BG}` }
 : arrow.side === "left"
 ? { right: -8, top: arrow.offset, borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderLeft: `8px solid ${BUBBLE_BG}` }
 : arrow.side === "bottom"
 ? { top: -8, left: arrow.offset, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: `8px solid ${BUBBLE_BG}` }
 : { bottom: -8, left: arrow.offset, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: `8px solid ${BUBBLE_BG}` }),
 width: 0,
 height: 0,
 }} />
 );

 // Portalled to <body>: it is a fixed overlay, and any ancestor with a
 // transform would otherwise clip it (overlay rule 1).
 return createPortal(
 <>
 {/* Highlight ring around the target — no backdrop */}
 {tourTarget &&!isWelcome && (
 <div
 style={{
 position: "fixed",
 left: tourTarget.left - 3,
 top: tourTarget.top - 3,
 width: tourTarget.width + 6,
 height: tourTarget.height + 6,
 borderRadius: isMobile? 8 : 10,
 border: "2px solid #3b82f6",
 boxShadow: "0 0 0 4px rgba(59,130,246,0.18), 0 0 16px rgba(59,130,246,0.25)",
 pointerEvents: "none",
 zIndex: 1001,
 transition: "all 0.25s ease",
 }}
 />
 )}

 {/* Bubble */}
 <div
 ref={tourCardRef}
 style={{
 ...bubbleStyle,
 background: BUBBLE_BG,
 border: "1px solid rgba(59,130,246,0.3)",
 borderRadius: 14,
 padding: "18px 18px 14px",
 boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
 animation: "tourPop 0.18s ease",
 zIndex: 1002,
 boxSizing: "border-box",
 }}
 >
 <style>{`@keyframes tourPop{from{opacity:0;transform:${isWelcome? "translate(-50%,-48%)" : "scale(0.95)"}}to{opacity:1;transform:${isWelcome? "translate(-50%,-50%)" : "scale(1)"}}}`}</style>
 {arrowEl}

 {/* Content scrolls INSIDE the card when a step is taller than the
 viewport, so the buttons are always reachable. The scroll cannot go
 on the card itself — the arrow is an absolutely positioned child
 outside the padding box and overflow would clip it. */}
 <div style={{ maxHeight: isMobile ? "calc(100vh - 200px)" : "calc(100vh - 64px)", overflowY: "auto" }}>

 {/* Header */}
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
 <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
 <step.icon size={20} />
 <div>
 <p style={{ margin: 0, fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.07em" }}>
 {tourStep + 1} / {TOUR_STEPS.length}
 </p>
 <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{step.title}</p>
 </div>
 </div>
 <button onClick={dismissTour} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 2 }}></button>
 </div>

 <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6 }}>
 {step.body}
 </p>

 {/* Progress bar */}
 <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
 {TOUR_STEPS.map((_, i) => (
 <div key={i} style={{ height: 2, flex: i === tourStep? 2 : 1, borderRadius: 99, background: i <= tourStep? "#3b82f6" : "rgba(255,255,255,0.08)", transition: "flex 0.25s" }} />
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
 <button onClick={dismissTour} style={{ background: "none", border: "none", color: "#4b5563", fontSize: 11, cursor: "pointer", padding: "7px 6px" }}>Skip
 </button>
 <button
 onClick={() => isLast? dismissTour() : setTourStep((s) => s + 1)}
 style={{ padding: "7px 16px", borderRadius: 7, background: "#2563eb", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
 >
 {isLast? "Got it " : "Next →"}
 </button>
 </div>
 </div>
 </div>
 </>,
 document.body,
 );
 };

 // LOADING 

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
 borderTopColor: "#2563eb",
 animation: "spin 0.8s linear infinite",
 }}
 />
 <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
 </div>
 );
 }

 // Payment gate — premium salesman awaiting payment confirmation (manual QR flow).
 if (pendingPay) {
 return (
 <DealerPendingApproval
 planKey="salesman_full"
 dealershipName={profile?.full_name}
 email={profile?.email}
 profileId={profile?.id}
 redirectTo="/salesman-premium"
 />
 );
 }

 // First-month-free trial ended — same screen, "expired" dress.
 if (trialExpired) {
 return (
 <DealerPendingApproval
 variant="expired"
 trialDays={30}
 planKey="salesman_full"
 dealershipName={profile?.full_name}
 email={profile?.email}
 profileId={profile?.id}
 redirectTo="/salesman-premium"
 />
 );
 }

 // MAIN RENDER

 return (
 <div
 style={{
 display: "flex",
 flexDirection: isMobile? "column" : "row",
 minHeight: "100vh",
 fontFamily: "system-ui, sans-serif",
 color: "#fff",
 }}
 >
 {/* Suspension was invisible to standalone sellers: the dealer dashboard
 and the salesman panel both showed this, Lite and Premium showed nothing,
 so a suspended seller lost the marketplace with a working dashboard and
 no explanation (A5). */}
 <SuspendedBanner />
 <Helmet>
 <meta name="robots" content="noindex, nofollow" />
 </Helmet>
 <style>{`
 @keyframes sp-lead-glow {
 0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.55); border-color: rgba(59,130,246,0.7); }
 70% { box-shadow: 0 0 0 12px rgba(59,130,246,0); border-color: rgba(59,130,246,0.7); }
 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); border-color: rgba(255,255,255,0.07); }
 }
 .sp-lead-glow { animation: sp-lead-glow 1s ease-out; }
 @media (prefers-reduced-motion: reduce) {
 .sp-lead-glow { animation: none; border-color: rgba(59,130,246,0.7); }
 .sp-topbar { transition: none !important; }
 }
 `}</style>

 {/* Nav — desktop sidebar only; mobile uses the renderMobileNav() drawer
     (portalled to document.body, called near renderNotifPanel()) instead of
     the old fixed bottom bar. */}
 {!isMobile && (
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
 background: "#2563eb",
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
 >S
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
 >SHIFTOS
 </p>
 <p
 style={{
 fontSize: 10,
 color: "#4b5563",
 marginTop: 2,
 marginBottom: 0,
 }}
 >
 · {isPremium? "Premium Panel" : "Lite Panel"}
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
 >Main
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
 activeTab === tab? "rgba(37,99,235,0.15)" : "transparent",
 border:
 activeTab === tab
? "0.5px solid rgba(37,99,235,0.25)"
 : "0.5px solid transparent",
 color: activeTab === tab? "#93c5fd" : "#6b7280",
 fontSize: 13,
 fontWeight: 500,
 width: "calc(100% - 16px)",
 textAlign: "left",
 }}
 >
 {icon}
 <span style={{ flex: 1 }}>{label}</span>
 {badge? (
 <span
 style={{
 fontSize: 10,
 background: "rgba(37,99,235,0.2)",
 border: "1px solid rgba(37,99,235,0.3)",
 color: "#93c5fd",
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
 background: "rgba(37,99,235,0.2)",
 border: "1px solid rgba(37,99,235,0.3)",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 fontSize: 12,
 fontWeight: 700,
 color: "#93c5fd",
 flexShrink: 0,
 }}
 >
 {(profile?.full_name || profile?.slug || "S")[0].toUpperCase()}
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

 {/* Content. NOTE: no overflow here, deliberately. This column is flex:1
     inside a container sized by minHeight:100vh, so it always stretches to
     exactly its own content height and can never overflow — an overflowY:auto
     on it scrolled nothing, but it still counted as the topbar's SCROLLPORT,
     so the sticky topbar stuck to a box that was itself scrolling away with
     the page. It looked like the hide-on-scroll was broken; the bar was never
     sticking at all. The page scrolls on the body (which is what the sidebar's
     sticky + height:100vh already assumes), so the topbar's scrollport must be
     the viewport too. */}
 <div
 ref={setScrollEl}
 style={{
 flex: 1,
 minWidth: 0,
 background: "#05070e",
 display: "flex",
 flexDirection: "column",
 }}
 >
 {/* Topbar — hides on scroll down, returns on scroll up (UX-1). Pinned
     visible whenever an overlay or the tour is open, because the mobile
     nav trigger lives in here. translateY rather than display: removing a
     sticky bar from layout makes the page jump. */}
 <div
 className="sp-topbar"
 style={{
 position: "sticky",
 top: 0,
 zIndex: 10,
 background: "rgba(5,7,14,0.92)",
 backdropFilter: "blur(12px)",
 borderBottom: "1px solid rgba(255,255,255,0.06)",
 padding: isMobile? "12px 16px" : "14px 24px",
 display: "flex",
 alignItems: "center",
 gap: 12,
 transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
 transition: "transform 0.22s ease",
 willChange: "transform",
 }}
 >
 {isMobile && (
 <button
 onClick={() => setMobileNavOpen(true)}
 aria-label="Open navigation"
 style={{
 background: "rgba(255,255,255,0.04)",
 border: "1px solid rgba(255,255,255,0.08)",
 borderRadius: 8,
 color: "#93c5fd",
 padding: "8px 10px",
 cursor: "pointer",
 display: "flex",
 alignItems: "center",
 flexShrink: 0,
 }}
 >
 <Menu size={17} />
 </button>
 )}
 {isMobile? (
 <>
 <div
 style={{
 width: 28,
 height: 28,
 background: "#2563eb",
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
 >S
 </div>
 <p
 style={{
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: 15,
 letterSpacing: "2px",
 color: "#fff",
 margin: 0,
 }}
 >SHIFTOS
 </p>
 <div style={{ flex: 1 }} />
 <button
 onClick={() => setNotifOpen((v) =>!v)}
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
 onClick={() => setLogoutConfirmOpen(true)}
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
 · {isPremium? "Premium Panel" : "Lite Panel"}
 </p>
 </div>
 <button
 onClick={() => setNotifOpen((v) =>!v)}
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
 background: "#1d4ed8",
 border: "none",
 borderRadius: 8,
 color: "#fff",
 fontSize: 13,
 fontWeight: 600,
 padding: "8px 14px",
 cursor: "pointer",
 }}
 >
 <Plus size={14} />Add Lead
 </button>
 </>
 )}
 </div>

 {/* Page content */}
 <div
 style={{
 padding: isMobile? "16px 12px" : 24,
 flex: 1,
 // No longer clearing a fixed bottom nav bar (removed — nav is the
 // renderMobileNav() drawer now), so mobile no longer needs the extra
 // 80px reserve; same bottom padding as desktop.
 paddingBottom: 24,
 }}
 >
 {activeTab === "dashboard" && (
 <Suspense fallback={<TabLoadingFallback />}>
 <DashboardTab
 leads={leads} appointments={appointments} myListings={myListings} carStatsMap={carStatsMap}
 enquiries={enquiries} staleLeads={staleLeads} isReturning={isReturning}
 goal={goal} goalEditing={goalEditing} goalDraft={goalDraft} showPrevMonth={showPrevMonth}
 customers={customers} dueNudges={dueNudges} profile={profile}
 minipageStats={minipageStats} aiFollowups={aiFollowups} followupsLoading={followupsLoading}
 servicePackages={servicePackages}
 handoverActive={handover.activeCount} handoverNext={soldNextStep}
 browserNotifPerm={browserNotifPerm} notifBannerDismissed={notifBannerDismissed}
 isPremium={isPremium} isMobile={isMobile}
 setActiveTab={setActiveTab} setMobileLeadStage={setMobileLeadStage} setGoalDraft={setGoalDraft}
 setGoalEditing={setGoalEditing} setShowPrevMonth={setShowPrevMonth} setShowAddForm={setShowAddForm}
 setAiFollowups={setAiFollowups} setInboxSubTab={setInboxSubTab}
 saveGoal={saveGoal} triggerGlow={triggerGlow} switchTab={switchTab} pingWA={pingWA}
 handleThisWeekContacted={handleThisWeekContacted} fetchFollowupSuggestions={fetchFollowupSuggestions}
 requestBrowserNotif={requestBrowserNotif} dismissNotifBanner={dismissNotifBanner}
 dismissTour={dismissTour} handleListingCopy={handleListingCopy}
 />
 </Suspense>
 )}
 {activeTab === "listings" && (
  <div>
   <SubTabs
    value={listingsSubTab}
    onChange={setListingsSubTab}
    items={[
     { key: "cars", label: "Cars", badge: myListings.length },
     { key: "addons", label: "Add-ons" },
    ]}
   />
   {listingsSubTab === "addons" ? (
    <Suspense fallback={<TabLoadingFallback />}>
     <ServicesAddonsTab dealerId={getDealerIdFromProfile(profile)} />
    </Suspense>
   ) : (
    <Suspense fallback={<TabLoadingFallback />}>
     <ListingsTab
      myListings={myListings} carStatsMap={carStatsMap} filterStatus={filterStatus} sortBy={sortBy}
      listingCopied={listingCopied} showAddForm={showAddForm} showFastForm={showFastForm}
      statusMenuCarId={statusMenuCarId} actionMenuCarId={actionMenuCarId} confirmDeleteId={confirmDeleteId}
      cvrHover={cvrHover} profile={profile} isMobile={isMobile}
      setMyListings={setMyListings} setFilterStatus={setFilterStatus} setSortBy={setSortBy}
      setShowAddForm={setShowAddForm} setShowFastForm={setShowFastForm}
      setStatusMenuCarId={setStatusMenuCarId} setActionMenuCarId={setActionMenuCarId}
      setConfirmDeleteId={setConfirmDeleteId} setCvrHover={setCvrHover} setEditListing={setEditListing}
      setSelectedCar={setSelectedCar} setCarDetailImgIdx={setCarDetailImgIdx} setCarDetailTab={setCarDetailTab}
      listingScore={listingScore} updateListingStatus={updateListingStatus}
      handleDeleteListing={handleDeleteListing} handleListingCopy={handleListingCopy}
      openBroadcast={openBroadcast} generateAiCaptions={generateAiCaptions}
      refreshCommissionData={refreshCommissionData}
     />
    </Suspense>
   )}
  </div>
 )}
 {activeTab === "leads" && renderLeads()}
 {activeTab === "enquiries" && (
  <div>
   {/* Bookings and Lead History are two views of the same inbox, so they share
       one tab. This replaced a read-only duplicate of the appointments list
       that used to sit under the enquiries feed — renderBookings() is the
       real, interactive board. */}
   <SubTabs
    value={inboxSubTab}
    onChange={setInboxSubTab}
    items={[
     { key: "bookings", label: "Bookings", badge: pendingBookingsCount, tourId: "bookings" },
     { key: "enquiries", label: "Lead History", badge: newEnquiriesCount, tourId: "leadhistory" },
    ]}
   />
   {inboxSubTab === "enquiries" ? renderEnquiries() : renderBookings()}
  </div>
 )}
 {activeTab === "analytics" && (
 <Suspense fallback={<TabLoadingFallback />}>
 <AnalyticsTab
 carStatsMap={carStatsMap} enquiries={enquiries} thisMonthSales={thisMonthSales}
 commission={commission} soldCount={soldCount} myListings={myListings}
 channelMap={channelMap} commissionDetails={commissionDetails} isMobile={isMobile}
 />
 </Suspense>
 )}
 {activeTab === "loans" && renderLoans()}
 {activeTab === "outreach" && showOutreach && (
 <Suspense fallback={<TabLoadingFallback />}>
 <OutreachHub dealerId={getDealerIdFromProfile(profile)} salesmanId={userId} theme="dark" />
 </Suspense>
 )}
 {activeTab === "chat" && (
 <Suspense fallback={<TabLoadingFallback />}>
 {/* Premium's panel is dark — SellerInbox defaults to the light dealer
 palette, so without theme="dark" the whole chat tab rendered white
 on a #080a12 page. Same component, same props Lite passes, minus
 the upgrade strip (Premium has the AI bar for real). */}
 <SellerInbox salesmanId={userId} theme="dark" aiAssist={isPremium} aiUpgrade={!isPremium} />
 </Suspense>
 )}
 {activeTab === "sold" && renderSold()}
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
 background: "#2563eb",
 border: "none",
 color: "#fff",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 cursor: "pointer",
 boxShadow: "0 4px 12px rgba(37,99,235,0.4)",
 }}
 >
 <Plus size={20} />
 </button>
 )}

 {renderAddLeadModal()}
 {renderWAModal()}
 {renderNotifPanel()}
 {renderMobileNav()}
 {selectedCar && (
 <Suspense fallback={null}>
 <CarDetailPopup
 selectedCar={selectedCar} carStatsMap={carStatsMap} listingCopied={listingCopied}
 carDetailImgIdx={carDetailImgIdx} carDetailTab={carDetailTab} carDetailLbOpen={carDetailLbOpen}
 isMobile={isMobile}
 setCarDetailImgIdx={setCarDetailImgIdx} setCarDetailTab={setCarDetailTab}
 setCarDetailLbOpen={setCarDetailLbOpen} setSelectedCar={setSelectedCar}
 handleListingCopy={handleListingCopy} openBroadcast={openBroadcast}
 generateAiCaptions={generateAiCaptions}
 />
 </Suspense>
 )}
 {renderTour()}

 {/* ── Log out confirm ── all three logout buttons (mobile nav drawer,
 desktop sidebar, mobile topbar) open this instead of calling
 handleLogout directly. */}
 {logoutConfirmOpen && (
 <div
 onClick={() => setLogoutConfirmOpen(false)}
 style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
 >
 <div onClick={(e) => e.stopPropagation()} style={{ background: "#111827", borderRadius: 14, width: "100%", maxWidth: 340, padding: 22, border: "1px solid rgba(255,255,255,0.08)" }}>
 <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>Log out?</p>
 <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>
 You'll need to sign in again to get back to your dashboard.
 </p>
 <div style={{ display: "flex", gap: 8 }}>
 <button
 onClick={() => setLogoutConfirmOpen(false)}
 style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: "11px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#cbd5e1", cursor: "pointer", fontFamily: "inherit" }}
 >
 Cancel
 </button>
 <button
 onClick={() => { setLogoutConfirmOpen(false); handleLogout(); }}
 style={{ flex: 1, fontSize: 13, fontWeight: 700, padding: "11px", borderRadius: 8, background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.35)", color: "#f87171", cursor: "pointer", fontFamily: "inherit" }}
 >
 Log out
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ── Test drive outcome ── advanceLeadStage sets testDriveConfirm and
 returns, so WITHOUT this modal a lead sitting at test_drive could never
 be advanced at all: the setter fired and nothing ever rendered it. */}
 {testDriveConfirm && (() => {
 const { lead: tdLead, nextStage: tdNext } = testDriveConfirm;
 const car = tdLead.car_listings;
 const carName = car? [car.year, car.brand, car.model].filter(Boolean).join(" ") : null;
 const dismiss = () => setTestDriveConfirm(null);
 return (
 <div onClick={dismiss} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
 <div onClick={(e) => e.stopPropagation()} style={{ background: "#0d1117", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "24px 24px 36px", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none" }}>
 <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
 <Car size={22} style={{ color: "#93c5fd" }} />
 </div>
 <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>How did the test drive go?</p>
 <p style={{ margin: "0 0 24px", fontSize: 13, color: "#6b7280" }}>
 {tdLead.buyer_name || "Buyer"} · {carName || "no car linked"}
 </p>
 <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
 <button
 onClick={() => { dismiss(); advanceLeadStage(tdLead, tdNext, true); }}
 style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}
 >
 <ThumbsUp size={20} style={{ flexShrink: 0, color: "#f87171" }} />
 <div>
 <p style={{ margin: 0, fontWeight: 700, color: "#f1f5f9" }}>They're interested — move forward</p>
 <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>Advance to {(tdNext || "").replace(/_/g, " ")}</p>
 </div>
 </button>
 <button
 onClick={() => { dismiss(); setLostPromptId(tdLead.id); }}
 style={{ width: "100%", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}
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

 {/* ── Confirm booking ── prefilled, editable WhatsApp message. Both
 buttons persist the confirm + lead advance before any WA handoff. */}
 {confirmBookingApt && (
 <div
 onClick={() => { setConfirmBookingApt(null); setConfirmBookingMsg(""); }}
 style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
 >
 <div onClick={(e) => e.stopPropagation()} style={{ background: "#111827", borderRadius: 14, width: "100%", maxWidth: 440, padding: 22, maxHeight: "90vh", overflowY: "auto" }}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
 <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Confirm booking</p>
 <button onClick={() => { setConfirmBookingApt(null); setConfirmBookingMsg(""); }} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 2 }}><X size={18} /></button>
 </div>
 <p style={{ margin: "0 0 14px", fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
 Confirms the viewing, adds {confirmBookingApt.buyer_name || "this buyer"} to your pipeline at Viewing Booked, and sets a Telegram reminder 1 hour before.
 </p>
 <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", marginBottom: 7 }}>Message to buyer</label>
 <textarea
 value={confirmBookingMsg}
 onChange={(e) => setConfirmBookingMsg(e.target.value)}
 rows={5}
 style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#e5e7eb", fontSize: 13, lineHeight: 1.6, padding: "10px 12px", outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }}
 />
 <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
 <button
 onClick={moveConfirmBookingToPipeline}
 style={{ flex: 1, fontSize: 12, fontWeight: 600, padding: "11px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#cbd5e1", cursor: "pointer", fontFamily: "inherit" }}
 >
 Confirm only
 </button>
 <button
 onClick={sendConfirmBooking}
 disabled={!confirmBookingApt.buyer_phone}
 style={{ flex: 2, fontSize: 12, fontWeight: 700, padding: "11px", borderRadius: 8, background: "#22c55e", border: "none", color: "#04210f", cursor: confirmBookingApt.buyer_phone? "pointer" : "not-allowed", opacity: confirmBookingApt.buyer_phone? 1 : 0.45, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
 >
 <Send size={13} /> Confirm + send WhatsApp
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ── Seller-initiated booking ── fired when a lead is moved into the
 booking stage from the pipeline. Creates a CONFIRMED appointment. */}
 {sellerBookingLead && (
 <div
 onClick={() => { if (!sellerBookingSaving) { setSellerBookingLead(null); setSellerBookingDate(""); } }}
 style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
 >
 <div onClick={(e) => e.stopPropagation()} style={{ background: "#111827", borderRadius: 14, width: "100%", maxWidth: 400, padding: 22 }}>
 <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
 <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(96,165,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
 <Calendar size={17} style={{ color: "#93c5fd" }} />
 </div>
 <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Book a viewing</p>
 </div>
 <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
 Pick the slot you agreed with {sellerBookingLead.buyer_name || "this buyer"}. It goes straight into Confirmed Upcoming with a reminder 1 hour before.
 </p>
 <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", marginBottom: 7 }}>Date &amp; time</label>
 <input
 type="datetime-local"
 value={sellerBookingDate}
 onChange={(e) => setSellerBookingDate(e.target.value)}
 style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#e5e7eb", fontSize: 14, padding: "11px 13px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
 />
 <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
 <button
 onClick={() => { setSellerBookingLead(null); setSellerBookingDate(""); }}
 disabled={sellerBookingSaving}
 style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: "11px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}
 >
 Cancel
 </button>
 <button
 onClick={confirmSellerBooking}
 disabled={sellerBookingSaving ||!sellerBookingDate}
 style={{ flex: 2, fontSize: 13, fontWeight: 700, padding: "11px", borderRadius: 8, background: "#2563eb", border: "none", color: "#fff", cursor: (sellerBookingSaving ||!sellerBookingDate)? "not-allowed" : "pointer", opacity: (sellerBookingSaving ||!sellerBookingDate)? 0.5 : 1, fontFamily: "inherit" }}
 >
 {sellerBookingSaving? "Booking…" : "Confirm booking"}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ── Mark won ── a win flips the car to sold and moves money, so it is a
 deliberate confirm rather than the undo-timer used for other stages. */}
 {wonPrompt && (
 <div
 onClick={() => { if (!wonSaving) setWonPrompt(null); }}
 style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
 >
 <div onClick={(e) => e.stopPropagation()} style={{ background: "#111827", borderRadius: 14, width: "100%", maxWidth: 420, padding: 24 }}>
 <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
 <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
 <CheckCircle2 size={18} style={{ color: "#4ade80" }} />
 </div>
 <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>Mark this deal won?</p>
 </div>
 <p style={{ margin: "0 0 6px", fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
 <strong style={{ color: "#f1f5f9" }}>{wonPrompt.lead.buyer_name || "This buyer"}</strong>
 {wonPrompt.lead.car_listings
 ? <> — {[wonPrompt.lead.car_listings.year, wonPrompt.lead.car_listings.brand, wonPrompt.lead.car_listings.model].filter(Boolean).join(" ")}</>
 : null}
 </p>
 <p style={{ margin: "0 0 18px", fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
 {wonPrompt.lead.car_listing_id
 ? "The car is marked sold and removed from the marketplace, your sold count and commission update, the buyer is added to Customers, and the 8-step handover checklist starts."
 : "No car is linked to this lead, so nothing will be marked sold — only the lead closes."}
 </p>
 <div style={{ display: "flex", gap: 8 }}>
 <button
 onClick={() => setWonPrompt(null)}
 disabled={wonSaving}
 style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: "11px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}
 >
 Not yet
 </button>
 <button
 onClick={handleMarkWon}
 disabled={wonSaving}
 style={{ flex: 2, fontSize: 13, fontWeight: 700, padding: "11px", borderRadius: 8, background: "#22c55e", border: "none", color: "#04210f", cursor: wonSaving? "not-allowed" : "pointer", opacity: wonSaving? 0.6 : 1, fontFamily: "inherit" }}
 >
 {wonSaving? "Saving…" : "Yes, mark won"}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* IC verify — voluntary, opened from Settings. Stored HASHED (set_my_ic),
 never plaintext. Unlike Lite this is never force-opened; always dismissable. */}
 {icGateOpen && (
 <div
 onClick={() => !icGateSaving && setIcGateOpen(false)}
 style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}
 >
 <div onClick={(e) => e.stopPropagation()} style={{ background: "#111827", borderRadius: 12, width: "90%", maxWidth: 420, padding: 24 }}>
 <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
 <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(220,38,38,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
 <ShieldCheck size={18} style={{ color: "#f87171" }} />
 </div>
 <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Verify your IC</p>
 </div>
 <p style={{ margin: "0 0 16px", fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>
 Buyers need to know they're dealing with a real, accountable seller. Enter your MyKad IC once — it's shown as a verified badge on your public page, never as digits.
 </p>
 <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", marginBottom: 7 }}>IC Number (MyKad)</label>
 <input
 autoFocus
 value={icGateVal}
 onChange={(e) => setIcGateVal(e.target.value.replace(/[^\d-]/g, ""))}
 placeholder="901231-10-1234"
 maxLength={14}
 onKeyDown={(e) => { if (e.key === "Enter") saveIcAndCloseGate(); }}
 style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#e5e7eb", fontSize: 15, padding: "11px 13px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
 />
 <p style={{ margin: "7px 0 0", fontSize: 11, color: "#6b7280" }}>12 digits · stored hashed (never in plaintext), verification only.</p>
 <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
 <button
 onClick={saveIcAndCloseGate}
 disabled={icGateSaving || icGateVal.replace(/\D/g, "").length !== 12}
 style={{ flex: 1, fontSize: 13, fontWeight: 700, padding: "11px", borderRadius: 8, background: "#dc2626", border: "none", color: "#fff", cursor: "pointer", opacity: icGateSaving || icGateVal.replace(/\D/g, "").length !== 12 ? 0.5 : 1 }}
 >
 {icGateSaving ? "Verifying…" : "Verify & continue"}
 </button>
 <button
 onClick={() => !icGateSaving && setIcGateOpen(false)}
 style={{ fontSize: 13, fontWeight: 600, padding: "11px 16px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer" }}
 >
 Later
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Broadcast modal */}
 {broadcastCar &&
 (() => {
 const eligible = leads.filter(
 (l) =>
 l.stage!== "won" &&
 l.stage!== "lost" &&
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
 <p className="text-white font-semibold text-sm">Broadcast to Leads
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
 : `This will open ${capped.length} WhatsApp tab${capped.length!== 1? "s" : ""}.`}
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
 {eligible.length!== 1? "s" : ""} (not won/lost)
 </span>
 </div>

 <textarea
 value={broadcastMsg}
 onChange={(e) => setBroadcastMsg(e.target.value)}
 disabled={!!broadcastProgress &&!broadcastDone}
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
 marginBottom: 12,
 fontFamily: "inherit",
 }}
 />

 {broadcastDone? (
 <div className="flex items-center gap-2 justify-center py-2">
 <CheckCircle2 className="w-4 h-4 text-green-400" />
 <p className="text-green-400 text-sm font-medium">All {capped.length} tabs opened!
 </p>
 </div>
 ) : broadcastProgress? (
 <div className="text-center py-2">
 <p className="text-orange-300 text-sm font-medium">Opening {broadcastProgress.current} of{" "}
 {broadcastProgress.total}…
 </p>
 <div
 className="mt-2 rounded-full overflow-hidden"
 style={{
 height: 4,
 background: "rgba(255,255,255,0.08)",
 }}
 >
 <div
 style={{
 height: "100%",
 width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%`,
 background: "#f97316",
 transition: "width 0.3s ease",
 borderRadius: 9999,
 }}
 />
 </div>
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
 color: eligible.length === 0? "#6b7280" : "#fb923c",
 cursor: eligible.length === 0? "not-allowed" : "pointer",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 gap: 8,
 }}
 >
 <Send className="w-4 h-4" />Open WA for each lead
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
 {/* Header */}
 <div className="flex items-center justify-between mb-4">
 <div>
 <p className="text-white font-semibold text-sm">AI Caption Writer
 </p>
 <p className="text-gray-400 text-xs mt-0.5">
 {[aiCaptionCar.year, aiCaptionCar.brand, aiCaptionCar.model]
 .filter(Boolean)
 .join(" ")}
 </p>
 </div>
 <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
 {isPremium && (
 <AiQuotaBadge userId={userId} feature="caption" />
 )}
 <button
 onClick={() => setAiCaptionCar(null)}
 className="text-gray-400 hover:text-white"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 </div>

 {!isPremium? (
 <UpgradeBanner feature="AI Caption Writer" />
 ) : (
 <>
 {/* Platform tabs */}
 <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
 {AI_CAPTION_PLATFORMS.map((platform) => {
 const labels = { whatsapp: "WhatsApp", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", general: "General" };
 const isActive = captionPlatform === platform;
 return (
 <button
 key={platform}
 onClick={() => {
 setCaptionPlatform(platform);
 setCaptionCopied(false);
 generateAiCaptions(aiCaptionCar, platform);
 }}
 style={{
 padding: "5px 12px",
 borderRadius: 8,
 fontSize: 11,
 fontWeight: 600,
 border: isActive
? "1px solid rgba(168,85,247,0.5)"
 : "1px solid rgba(255,255,255,0.08)",
 background: isActive
? "rgba(168,85,247,0.15)"
 : "rgba(255,255,255,0.04)",
 color: isActive? "#c084fc" : "#9ca3af",
 cursor: "pointer",
 }}
 >
 {labels[platform]}
 </button>
 );
 })}
 </div>

 {!captionQuotaOk? (
 <p style={{ fontSize: 12, color: "#f87171", margin: "0 0 12px" }}>Daily caption quota reached. Try again tomorrow.
 </p>
 ) : aiCaptionLoading? (
 <AiLoadingState text="AI sedang tulis caption..." />
 ) : (
 <textarea
 value={aiCaptions[`${aiCaptionCar.id}_${captionPlatform}`]?? ""}
 onChange={(e) =>
 setAiCaptions((p) => ({
 ...p,
 [`${aiCaptionCar.id}_${captionPlatform}`]: e.target.value,
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
 boxSizing: "border-box",
 }}
 />
 )}

 <div className="flex gap-2 mt-3">
 <button
 onClick={() => {
 const text = aiCaptions[`${aiCaptionCar.id}_${captionPlatform}`]?? "";
 navigator.clipboard.writeText(text);
 setCaptionCopied(true);
 setTimeout(() => setCaptionCopied(false), 2000);
 }}
 disabled={aiCaptionLoading ||!aiCaptions[`${aiCaptionCar.id}_${captionPlatform}`]}
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
 color: captionCopied? "#4ade80" : "#c084fc",
 cursor: "pointer",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 gap: 6,
 }}
 >
 {captionCopied? (
 <Check className="w-3.5 h-3.5" />
 ) : (
 <Copy className="w-3.5 h-3.5" />
 )}
 {captionCopied? "Copied!" : "Copy"}
 </button>
 <button
 onClick={() => {
 const cacheKey = `${aiCaptionCar.id}_${captionPlatform}`;
 setAiCaptions((p) => {
 const next = { ...p };
 delete next[cacheKey];
 return next;
 });
 generateAiCaptions(aiCaptionCar, captionPlatform);
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
 cursor: "pointer",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 gap: 6,
 }}
 >
 <Sparkles className="w-3.5 h-3.5" />Regenerate
 </button>
 </div>
 </>
 )}
 </div>
 </div>
 )}

 {editListing && (
 <div
 className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
 style={{ background: "rgba(0,0,0,0.82)" }}
 >
 <div
 style={{
 background: "#0d1117",
 border: "1px solid rgba(255,255,255,0.1)",
 borderRadius: isMobile? "16px 16px 0 0" : 16,
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
 >Edit Listing
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
 p.map((l) => (l.id === updated.id? updated : l)),
 );
 setEditListing(null);
 }}
 onCreate={() => {}}
 />
 </div>
 </div>
 </div>
 )}

 {/* One in-app conversation, over whatever tab you are on. Rendered at page
     level (not inside renderLeads) so the pipeline card, the lead panel and
     anything added later all open the same sheet. Same AI split as the inbox:
     Premium drafts, Lite sees the locked strip. */}
 {chatSheet && (
 <Suspense fallback={null}>
 <ChatSheet
 threadId={chatSheet.threadId}
 buyerName={chatSheet.buyerName}
 carLabel={chatSheet.carLabel}
 theme="dark"
 aiAssist={isPremium}
 aiUpgrade={!isPremium}
 onClose={() => setChatSheet(null)}
 />
 </Suspense>
 )}

 </div>
 );
}
