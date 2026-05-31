import React, { useEffect, useRef, useState } from "react";
import SuspendedBanner from "../components/SuspendedBanner";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import { useRoleRedirect } from "../hooks/useRoleRedirect";
import { getDealerIdFromProfile } from "../hooks/useProfile";
import TikTokStudioV3 from "../components/TikTokStudioV3";
import { toast } from "sonner";
import {
 LogOut,
 Link,
 Copy,
 Check,
 Eye,
 MessageSquare,
 ShoppingBag,
 Clock,
 AlertCircle,
 AlertCircle as AlertCircleIcon,
 Car,
 Sparkles,
 Bell,
 Target,
 TrendingUp,
 ChevronRight,
 ChevronLeft,
 Plus,
 User,
 Phone,
 Tag,
 X,
 CheckCircle2,
 Send,
 LayoutGrid,
 Users,
 ZoomIn,
 Gauge,
 Settings,
 Droplets,
 Palette,
 MapPin,
 Banknote,
 CreditCard,
 Pencil,
 Trash2,
 Search,
 PhoneCall,
 PhoneOff,
 History,
 RefreshCw,
 CheckCircle,
 Voicemail,
 Calendar,
 BarChart2,
 MessageCircle,
} from "lucide-react";

import { callClaude } from "../lib/callClaude";
import UpgradeBanner from "../components/ai/UpgradeBanner";
import AiLoadingState from "../components/ai/AiLoadingState";
import AiQuotaBadge from "../components/ai/AiQuotaBadge";

// helpers 

function formatApptDate(iso) {
 const d = new Date(iso);
 return {
 day: d.toLocaleDateString("en-MY", { day: "2-digit" }),
 month: d.toLocaleDateString("en-MY", { month: "short" }),
 time: d.toLocaleTimeString("en-MY", {
 hour: "2-digit",
 minute: "2-digit",
 hour12: true,
 }),
 };
}

function StatusBadge({ status }) {
 const styles = {
   available: "bg-green-500/15 text-green-400 border-green-500/30",
   reserved: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
   pending: "bg-blue-500/15 text-blue-400 border-blue-500/30",
   pending_approval: "bg-amber-500/15 text-amber-400 border-amber-500/30",
   rejected: "bg-red-500/15 text-red-400 border-red-500/30",
 };
 const labels = {
   pending_approval: "Pending Approval",
   rejected: "Rejected",
 };

 return (
 <span
 className={`px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0 ${styles[status] ?? "bg-gray-700 text-gray-400 border-gray-600"}`}
 >
   {labels[status] ?? status}
 </span>
 );
}

// 

function useWindowSize() {
 const [w, setW] = useState(window.innerWidth);
 useEffect(() => {
 const h = () => setW(window.innerWidth);
 window.addEventListener("resize", h);
 return () => window.removeEventListener("resize", h);
 }, []);
 return w;
}

export default function SalesmanPanel() {
 const navigate = useNavigate();
 const { t } = useTranslation();
 const redirectByRole = useRoleRedirect("salesman");

 const [profile, setProfile] = useState(null);
 const [userId, setUserId] = useState(null);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState("dashboard");
 const [subTab, setSubTab] = useState("overview");
 const [chartJsLoaded, setChartJsLoaded] = useState(!!window.Chart);
 const isMobile = useWindowSize() < 768;

 // unique-link copy state
 const [copied, setCopied] = useState(false);

 // stats
 const [myClicks, setMyClicks] = useState(0);
 const [myEnquiries, setMyEnquiries] = useState(0);
 const [soldCount, setSoldCount] = useState(0);
 const [soldLoading, setSoldLoading] = useState(true);

 // commission strip (null = still loading)
 const [commission, setCommission] = useState(null);

 // my listings
 const [myListings, setMyListings] = useState([]);
 const [listingCopied, setListingCopied] = useState({}); // { [carId]: 'link' | 'wa' | null }
 const [tiktokListing, setTiktokListing] = useState(null);

 // appointments
 const [appointments, setAppointments] = useState([]);

 // Notifications
 const [notifications, setNotifications] = useState([]);
 const [notifOpen, setNotifOpen] = useState(false);

 // Enquiries
 const [enquiries, setEnquiries] = useState([]);
 const [enquiriesLoading, setEnquiriesLoading] = useState(true);
 const [openTemplateId, setOpenTemplateId] = useState(null);
 const [templateToast, setTemplateToast] = useState(null);
 const [openAiReplyId, setOpenAiReplyId] = useState(null);
 const [aiDrafts, setAiDrafts] = useState({});
 const [aiLoading, setAiLoading] = useState(false);
 const [editingReminder, setEditingReminder] = useState(null);
 const [reminderMsg, setReminderMsg] = useState("");
 const [inboxSubTab, setInboxSubTab] = useState("enquiries");
 const [reschedulingAptId, setReschedulingAptId] = useState(null);
 const [rescheduleDate, setRescheduleDate] = useState("");
 const [cancelConfirmId, setCancelConfirmId] = useState(null);
 const [reminderPickerAptId, setReminderPickerAptId] = useState(null);
 const [selectedRemindAt, setSelectedRemindAt] = useState(null);
 const [reminderSaving, setReminderSaving] = useState(false);
 const [pastOpen, setPastOpen] = useState(false);
 const [telegramSetupModal, setTelegramSetupModal] = useState(false);

 // Leads
 const [leads, setLeads] = useState([]);
 const [staleLeads, setStaleLeads] = useState([]);
 const [leadsLoading, setLeadsLoading] = useState(true);
 const [leadScores, setLeadScores] = useState({});
 const [scoreLoading, setScoreLoading] = useState(false);

 // AI features state
 const [aiFollowups, setAiFollowups] = useState([]);
 const [followupsLoading, setFollowupsLoading] = useState(false);
 const [aiWaReplies, setAiWaReplies] = useState({});
 const [waReplyLoading, setWaReplyLoading] = useState({});
 const [waReplyCopied, setWaReplyCopied] = useState({});
 const [captionPlatform, setCaptionPlatform] = useState("whatsapp");
 const [captionQuotaOk, setCaptionQuotaOk] = useState(true);

 // Broadcast modal
 const [broadcastCar, setBroadcastCar] = useState(null);
 const [broadcastMsg, setBroadcastMsg] = useState("");
 const [broadcastProgress, setBroadcastProgress] = useState(null); // null | { current, total }
 const [broadcastDone, setBroadcastDone] = useState(false);

 // AI Caption modal
 const [aiCaptionCar, setAiCaptionCar] = useState(null);
 const [aiCaptions, setAiCaptions] = useState({}); // { [carId]: { wa, tiktok } }
 const [aiCaptionLoading, setAiCaptionLoading] = useState(false);
 const [aiCaptionTab, setAiCaptionTab] = useState("wa");
 const [captionCopied, setCaptionCopied] = useState(false);
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

 // CRM pipeline state
 const [drawerLeadId, setDrawerLeadId] = useState(null);
 const [deletingLeadId, setDeletingLeadId] = useState(null);
 const [lostSavingId, setLostSavingId] = useState(null);
 const [stageSavingId, setStageSavingId] = useState(null);
 const [editingNoteId, setEditingNoteId] = useState(null);
 const [editNoteVal, setEditNoteVal] = useState("");
 const [notesSavingId, setNotesSavingId] = useState(null);
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
 const [linkCarLeadId, setLinkCarLeadId] = useState(null);
 const [batchWALeads, setBatchWALeads] = useState(null);
 const [batchWAIdx, setBatchWAIdx] = useState(0);
 const [mobileLeadStage, setMobileLeadStage] = useState("new");
 const [lostPromptId, setLostPromptId] = useState(null);
 const [deleteConfirmId, setDeleteConfirmId] = useState(null);
 const [waModalLead, setWaModalLead] = useState(null);
 const [waModalMsg, setWaModalMessage] = useState("");
 const [playbookLeadId, setPlaybookLeadId] = useState(null);
 const [copiedScriptLine, setCopiedScriptLine] = useState(null);

 // Monthly target
 const [thisMonthSales, setThisMonthSales] = useState(0);

 // Per-listing analytics
 const [carStatsMap, setCarStatsMap] = useState({});
 // rawEvents removed — aggregated server-side via get_car_analytics RPC
 const [dealerSubdomain, setDealerSubdomain] = useState(null);

 // Manager notes
 const [managerNotes, setManagerNotes] = useState([]);
 const [newNote, setNewNote] = useState("");
 const [noteSaving, setNoteSaving] = useState(false);

 // Commission breakdown
 const [commissionDetails, setCommissionDetails] = useState([]);

 // Listings sort/filter
 const [sortBy, setSortBy] = useState("newest");
 const [filterStatus, setFilterStatus] = useState("all");
 const [cvrHover, setCvrHover] = useState(null); // carId while hovering bar

 // Lost leads accordion
 const [lostOpen, setLostOpen] = useState(false);

 // Car detail popup
 const [selectedCar, setSelectedCar] = useState(null);
 const [carDetailImgIdx, setCarDetailImgIdx] = useState(0);
 const [carDetailTab, setCarDetailTab] = useState("specs");
 const [carDetailLbOpen, setCarDetailLbOpen] = useState(false);

 // loans
 const [loanCalc, setLoanCalc] = useState({ carPrice: "", downPayment: "", tenure: 7, income: "" });
 const [loanForm, setLoanForm] = useState({
 buyer_name: "", buyer_phone: "", buyer_ic: "", buyer_employment_type: "Salaried",
 stock_unit_id: "", car_model: "", car_price: "",
 bank_name: "", loan_amount: "", down_payment: "",
 interest_rate: "", loan_tenure: 7, monthly_payment: "",
 buyer_income: "", notes: "",
 });
 const [loanApplications, setLoanApplications] = useState([]);
 const [loanLeads, setLoanLeads] = useState([]);
 const [loanStockUnits, setLoanStockUnits] = useState([]);
 const [loanSaving, setLoanSaving] = useState(false);
 const [loanEditId, setLoanEditId] = useState(null);
 const [loanEditStatus, setLoanEditStatus] = useState("");
 const [loanEditCommission, setLoanEditCommission] = useState("");

 // profile settings tab
 const [profileSettings, setProfileSettings] = useState({
 full_name: '', job_title: '', whatsapp_number: '',
 city: '', state: '', about_text: '',
 bio: '', response_time: '', specializations: [],
 });
 const [settingsSaving, setSettingsSaving] = useState(false);
 const [settingsSaved, setSettingsSaved] = useState(false);
 const [settingsError, setSettingsError] = useState(null);
 const [tagInput, setTagInput] = useState('');

 const isPremium = profile?.plan === 'salesman_full';

 // stale leads (48h no contact, exclude won/lost/closed)
 useEffect(() => {
 const now = new Date();
 const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
 setStaleLeads(
 leads.filter((l) => {
 if (["won", "lost", "closed_won", "closed_lost"].includes(l.stage)) return false;
 // stale = overdue follow-up AND no activity in 48h (both must be true)
 const overdueFollowUp = l.follow_up_at && new Date(l.follow_up_at) <= now;
 const noRecentActivity = l.updated_at && new Date(l.updated_at) < cutoff;
 return overdueFollowUp && noRecentActivity;
 })
 );
 }, [leads]);

 // sync profile → settings form
 useEffect(() => {
 if (!profile) return;
 setProfileSettings({
 full_name: profile.full_name || '',
 job_title: profile.job_title || '',
 whatsapp_number: profile.whatsapp_number || '',
 city: profile.city || '',
 state: profile.state || '',
 about_text: profile.about_text || '',
 bio: profile.bio || '',
 response_time: profile.response_time || '',
 specializations: profile.specializations || [],
 });
 }, [profile?.id]);

 // page title
 useEffect(() => {
 document.title = t("salesman.meta.title", {
 defaultValue: "ShiftOS · My Panel",
 });
 }, [t]);

 // auth + profile
 useEffect(() => {
 const _params = new URLSearchParams(window.location.search);
 const _at = _params.get('_at');
 const _rt = _params.get('_rt');
 const authReady = _at && _rt
   ? supabase.auth.setSession({ access_token: _at, refresh_token: _rt })
       .then(() => { window.history.replaceState({}, '', window.location.pathname); })
   : Promise.resolve();
 authReady.then(() => supabase.auth.getUser()).then(async ({ data: { user }, error }) => {
 if (error ||!user) {
 setLoading(false);
 navigate("/login");
 return;
 }

 setUserId(user.id);
 const { data: profileData, error: profileError } = await supabase
 .from("profiles")
 .select("*")
 .eq("id", user.id)
 .maybeSingle();

 if (profileError ||!profileData) {
 setLoading(false);
 navigate("/login");
 return;
 }
 if (redirectByRole(profileData.role)) {
 setLoading(false);
 return;
 }

 if (profileData.plan === 'salesman_lite' && !profileData.dealer_id) {
 navigate('/salesman-lite', { replace: true });
 return;
 }

 setProfile(profileData);
 setLoading(false);
 if (profileData.dealer_id) {
  supabase
   .from("profiles")
   .select("subdomain")
   .eq("id", profileData.dealer_id)
   .maybeSingle()
   .then(({ data }) => setDealerSubdomain(data?.subdomain || null));
 }

 // Fetch assigned car IDs first, then scope analytics to those cars
 // (dealer-linked salesmen share dealer_id with others; salesman_slug is null on direct visits)
 const { data: assignedCars } = await supabase
   .from("car_listings")
   .select("id")
   .eq("assigned_to", userId);
 const assignedCarIds = (assignedCars || []).map((c) => c.id);

 if (assignedCarIds.length > 0) {
 // Analytics: server-side aggregation via RPC — one row per car
 const { data: analyticsRows, error: analyticsErr } = await supabase
 .rpc("get_car_analytics", { p_car_ids: assignedCarIds });
 if (analyticsErr) console.error("fetchAnalytics:", analyticsErr);
 const map = {};
 (analyticsRows || []).forEach(row => {
 map[row.car_id] = {
 views:     Number(row.views)     || 0,
 enquiries: Number(row.enquiries) || 0,
 daily:     [row.d0, row.d1, row.d2, row.d3, row.d4, row.d5, row.d6],
 };
 });
 setCarStatsMap(map);
 setMyClicks(Object.values(map).reduce((s, v) => s + (v.views     || 0), 0));
 setMyEnquiries(Object.values(map).reduce((s, v) => s + (v.enquiries || 0), 0));
 }
 });
 }, [navigate]);
 // 

 // userId-dependent data 
 useEffect(() => {
 if (!userId) return;

 // Personal sold count with realtime subscription
 const fetchSold = async () => {
 setSoldLoading(true);
 const { count } = await supabase
 .from("car_listings")
 .select("id", { count: "exact", head: true })
 .eq("status", "sold")
 .eq("assigned_to", userId);
 setSoldCount(count || 0);
 setSoldLoading(false);
 };
 fetchSold();
 const ch = supabase
 .channel("salesman_sold")
 .on(
 "postgres_changes",
 { event: "UPDATE", schema: "public", table: "car_listings", filter: `assigned_to=eq.${userId}` },
 fetchSold,
 )
 .subscribe();

 // Active listings assigned to me — full detail for rich cards
 const fetchMyListings = () =>
 supabase
 .from("car_listings")
 .select(
 "id, slug, year, brand, model, variant, selling_price, status, images, colour, mileage, transmission, fuel_type, body_type, specs, features, options, city, condition",
 )
 .eq("assigned_to", userId)
 .neq("status", "sold")
 .order("created_at", { ascending: false })
 .then(({ data }) => setMyListings(data || []));
 fetchMyListings();
 const listingsCh = supabase
 .channel("my_listings_" + userId)
 .on(
 "postgres_changes",
 { event: "*", schema: "public", table: "car_listings", filter: `assigned_to=eq.${userId}` },
 fetchMyListings,
 )
 .subscribe();

 // All-time commission — no sold_at column yet, date filter removed
 supabase
 .from("car_listings")
 .select("commission_amount")
 .eq("assigned_to", userId)
 .eq("status", "sold")
 .then(({ data }) => {
 const total = (data || []).reduce(
 (sum, r) => sum + (Number(r.commission_amount) || 0),
 0,
 );
 setCommission(total);
 });

 // Upcoming appointments
 const fetchAppts = () =>
 supabase
 .from("appointments")
 .select("*, car_listings(brand, model, year, images)")
 .eq("salesman_id", userId)
 .order("created_at", { ascending: false })
 .then(({ data }) => setAppointments(data || []));
 fetchAppts();

 const apptCh = supabase
 .channel("appts_" + userId)
 .on(
 "postgres_changes",
 {
 event: "*",
 schema: "public",
 table: "appointments",
 filter: `salesman_id=eq.${userId}`,
 },
 () => fetchAppts(),
 )
 .subscribe();

 // Commission breakdown (last 5 sold)
 supabase
 .from("car_listings")
 .select("brand, model, year, commission_amount, sold_at")
 .eq("assigned_to", userId)
 .eq("status", "sold")
 .not("commission_amount", "is", null)
 .order("sold_at", { ascending: false })
 .limit(5)
 .then(({ data }) => setCommissionDetails(data || []));

 // Manager notes
 supabase
 .from("salesman_notes")
 .select("*")
 .eq("salesman_id", userId)
 .order("created_at", { ascending: false })
 .limit(10)
 .then(({ data }) => setManagerNotes(data || []));

 // Enquiries via ref slug
 if (profile?.slug) {
 supabase
 .from("whatsapp_enquiries")
 .select("*, car_listings(brand, model, year, images)")
 .eq("ref_slug", profile.slug)
 .order("created_at", { ascending: false })
 .limit(20)
 .then(({ data }) => {
 setEnquiries(data || []);
 setEnquiriesLoading(false);
 });
 } else {
 setEnquiriesLoading(false);
 }

 // Leads assigned to this salesman
 supabase
 .from("leads")
 .select("*, car_listings(brand, model, year, selling_price)")
 .eq("salesman_id", userId)
 .eq("dealer_id", profile?.dealer_id)
 .eq("is_deleted", false)
 .order("updated_at", { ascending: false })
 .then(async ({ data }) => {
 const rows = data || [];
 setLeads(rows);
 setLeadsLoading(false);
 if (rows.length === 0) return;
 // AI lead scoring — fire and forget; errors are silent
 setScoreLoading(true);
 try {
 const payload = rows.map((l) => ({
 id: l.id,
 buyer_name: l.buyer_name,
 stage: l.stage,
 notes: l.notes,
 updated_at: l.updated_at,
 phone: l.phone? "present" : "missing",
 }));
 const prompt = `You are a sales AI assistant. Score each lead as "hot", "warm", or "cold" based on their stage, recency of contact (updated_at), notes, and whether they have a phone number.

Leads JSON:
${JSON.stringify(payload)}

Return ONLY a valid JSON array (no markdown, no explanation) with this shape:
[{ "id": "...", "score": "hot"|"warm"|"cold", "reason": "one short sentence" }]

Rules:
- hot: deposit_taken, won, or recently contacted with phone present
- cold: lost, or no contact for 7+ days and stage is still "new"
- warm: everything else`;
 const { data: aiData } = await supabase.functions.invoke("ai-proxy", {
 body: { prompt },
 });
 const raw =
 aiData?.reply??
 aiData?.content??
 aiData?.text??
 aiData?.message??
 "";
 const parsed = JSON.parse(
 typeof raw === "string"? raw : JSON.stringify(raw),
 );
 if (Array.isArray(parsed)) {
 const map = {};
 parsed.forEach((r) => {
 if (r.id) map[r.id] = { score: r.score, reason: r.reason };
 });
 setLeadScores(map);
 }
 } catch {
 // silent — no scores shown on failure
 } finally {
 setScoreLoading(false);
 }
 });

 // Notifications
 const loadNotifs = () =>
 supabase
 .from("salesman_notifications")
 .select("*")
 .eq("salesman_id", userId)
 .order("created_at", { ascending: false })
 .limit(20)
 .then(({ data }) => setNotifications(data || []));
 loadNotifs();

 const notifCh = supabase
 .channel("salesman_notifs_" + userId)
 .on(
 "postgres_changes",
 {
 event: "INSERT",
 schema: "public",
 table: "salesman_notifications",
 filter: `salesman_id=eq.${userId}`,
 },
 loadNotifs,
 )
 .subscribe();

 // This month's sales
 const now = new Date();
 const monthStart = new Date(
 now.getFullYear(),
 now.getMonth(),
 1,
 ).toISOString();
 supabase
 .from("car_listings")
 .select("id", { count: "exact", head: true })
 .eq("assigned_to", userId)
 .eq("status", "sold")
 .gte("sold_at", monthStart)
 .then(({ count }) => setThisMonthSales(count || 0));

 return () => {
 supabase.removeChannel(ch);
 supabase.removeChannel(notifCh);
 supabase.removeChannel(apptCh);
 supabase.removeChannel(listingsCh);
 };
 }, [userId]);

 // loan data 
 useEffect(() => {
 if (!profile?.id) return;
 const dealerId = getDealerIdFromProfile(profile);
 supabase
 .from("leads")
 .select("id, buyer_name, phone")
 .eq("dealer_id", dealerId)
 .eq("salesman_id", profile.id)
 .eq("is_deleted", false)
 .order("created_at", { ascending: false })
 .then(({ data }) => setLoanLeads(data || []));
 supabase
 .from("stock_units")
 .select("id, brand, model, year, registration_number")
 .eq("dealer_id", dealerId)
 .then(({ data }) => setLoanStockUnits(data || []));
 supabase
 .from("loan_applications")
 .select("*")
 .eq("salesman_id", profile.id)
 .order("created_at", { ascending: false })
 .then(({ data }) => setLoanApplications(data || []));
 }, [profile?.id]);
 // 

 const chartRefs = useRef({});
 const pendingStageRef = useRef({});

 // sparkline charts 
 useEffect(() => {
 if (!window.Chart &&!document.getElementById("chartjs-cdn")) {
 const s = document.createElement("script");
 s.id = "chartjs-cdn";
 s.src = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
 s.onload = () => { setChartJsLoaded(true); drawSparklines(); };
 document.head.appendChild(s);
 } else if (window.Chart) {
 drawSparklines();
 }

 function bucket7Days(rows, dateKey) {
 const counts = Array(7).fill(0);
 const now = Date.now();
 rows.forEach((r) => {
 const diff = Math.floor(
 (now - new Date(r[dateKey]).getTime()) / 86400000,
 );
 if (diff >= 0 && diff < 7) counts[6 - diff]++;
 });
 return counts;
 }

 function sparkline(id, data, color) {
 const canvas = document.getElementById(id);
 if (!canvas ||!window.Chart) return;
 if (chartRefs.current[id]) chartRefs.current[id].destroy();
 chartRefs.current[id] = new window.Chart(canvas, {
 type: "line",
 data: {
 labels: data.map((_, i) => i),
 datasets: [
 {
 data,
 borderColor: color,
 borderWidth: 1.5,
 pointRadius: 0,
 fill: true,
 backgroundColor: color + "22",
 tension: 0.4,
 },
 ],
 },
 options: {
 animation: false,
 plugins: { legend: { display: false }, tooltip: { enabled: false } },
 scales: { x: { display: false }, y: { display: false } },
 },
 });
 }

 function drawSparklines() {
 const enqData = bucket7Days(enquiries, "created_at");
 const commData = bucket7Days(commissionDetails, "sold_at");
 sparkline("spark-enquiries", enqData, "#3b82f6");
 sparkline("spark-commission", commData, "#22c55e");
 }

 return () => {
 ["spark-enquiries", "spark-commission"].forEach((id) => {
 chartRefs.current[id]?.destroy();
 delete chartRefs.current[id];
 });
 };
 }, [enquiries, commissionDetails]);

 // main charts (line + donut)
 useEffect(() => {
 if (!window.Chart) return;

 // Build 7-day labels + data from carStatsMap (RPC-aggregated)
 const days = Array.from({ length: 7 }, (_, i) => {
 const d = new Date();
 d.setHours(0, 0, 0, 0);
 d.setDate(d.getDate() - (6 - i));
 return d;
 });
 const labels = days.map((d) =>
 d.toLocaleDateString("en-MY", { month: "short", day: "numeric" }),
 );
 const allStats = Object.values(carStatsMap);
 const viewCounts = Array.from({ length: 7 }, (_, i) =>
 allStats.reduce((s, v) => s + ((v.daily && v.daily[i]) || 0), 0)
 );
 const enqCounts = Array(7).fill(0);

 const tickStyle = { color: "rgba(255,255,255,0.25)", font: { size: 10 } };
 const gridStyle = { color: "rgba(255,255,255,0.05)" };

 // Line chart
 const lineCanvas = document.getElementById("chart-line");
 if (lineCanvas) {
 if (chartRefs.current["chart-line"])
 chartRefs.current["chart-line"].destroy();
 chartRefs.current["chart-line"] = new window.Chart(lineCanvas, {
 type: "line",
 data: {
 labels,
 datasets: [
 {
 label: "Views",
 data: viewCounts,
 borderColor: "#60a5fa",
 borderWidth: 1.5,
 pointRadius: 0,
 fill: false,
 tension: 0.4,
 },
 {
 label: "Enquiries",
 data: enqCounts,
 borderColor: "#fbbf24",
 borderWidth: 1.5,
 pointRadius: 0,
 fill: false,
 tension: 0.4,
 borderDash: [4, 3],
 },
 ],
 },
 options: {
 animation: false,
 plugins: { legend: { display: false }, tooltip: { enabled: true } },
 scales: {
 x: { ticks: { ...tickStyle, maxTicksLimit: 7 }, grid: gridStyle },
 y: { ticks: tickStyle, grid: gridStyle },
 },
 },
 });
 }

 // Donut chart
 const STAGE_COLORS = {
 new: "#60a5fa",
 contacted: "#fbbf24",
 viewing_booked: "#c084fc",
 negotiating: "#fb923c",
 deposit_taken: "#4ade80",
 won: "#22c55e",
 };
 const stageKeys = Object.keys(STAGE_COLORS);
 const stageCounts = stageKeys.map(
 (s) => leads.filter((l) => l.stage === s).length,
 );

 const donutCanvas = document.getElementById("chart-donut");
 if (donutCanvas) {
 if (chartRefs.current["chart-donut"])
 chartRefs.current["chart-donut"].destroy();
 chartRefs.current["chart-donut"] = new window.Chart(donutCanvas, {
 type: "doughnut",
 data: {
 labels: stageKeys,
 datasets: [
 {
 data: stageCounts,
 backgroundColor: stageKeys.map((s) =>STAGE_COLORS[s]),
 borderWidth: 0,
 hoverOffset: 2,
 },
 ],
 },
 options: {
 animation: false,
 cutout: "68%",
 plugins: { legend: { display: false }, tooltip: { enabled: true } },
 },
 });
 }
 }, [carStatsMap, leads, activeTab, subTab, chartJsLoaded]);

 const handleLogout = async () => {
 await supabase.auth.signOut();
 window.location.href = "https://xdrive.my/login";
 };

 const _siteBase = dealerSubdomain
  ? `https://${dealerSubdomain}.xdrive.my`
  : "https://xdrive.my";
 const uniqueLink = profile?.slug
  ? `${_siteBase}/cars?ref=${profile.slug}`
  : null;

 const handleCopy = () => {
 if (!uniqueLink) return;
 navigator.clipboard.writeText(uniqueLink);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 };

 const updateApptStatus = async (apptId, newStatus) => {
 setAppointments((prev) =>
 prev.map((a) => (a.id === apptId? { ...a, status: newStatus } : a)),
 );
 await supabase.from("appointments").update({ status: newStatus }).eq("id", apptId);
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
 const { data: existing } = await supabase.from("leads").select("id, stage").eq("salesman_id", userId).eq("dealer_id", profile?.dealer_id || "none").eq("phone", phone).maybeSingle();
 if (existing) {
 const STAGES = ["new","contacted","viewing_booked","test_drive","negotiating","deposit_taken","won","lost"];
 const curIdx = STAGES.indexOf(existing.stage);
 if (curIdx < STAGES.indexOf("viewing_booked")) {
 await supabase.from("leads").update({ stage: "viewing_booked" }).eq("id", existing.id);
 setLeads((p) => p.map((l) => l.id === existing.id ? { ...l, stage: "viewing_booked" } : l));
 toast.success("Lead moved to Viewing Booked!");
 }
 } else {
 const { data: newLead } = await supabase.from("leads").insert({
 salesman_id: userId, dealer_id: profile?.dealer_id || null,
 buyer_name: apt.buyer_name || "Unknown", phone: apt.buyer_phone || "",
 car_listing_id: apt.car_listing_id || null,
 stage: "viewing_booked", lead_source: "manual", is_deleted: false,
 }).select().single();
 if (newLead) { setLeads((p) => [newLead, ...p]); toast.success("Lead created at Viewing Booked!"); }
 }
 };

 const handleListingCopy = (car, type) => {
 const _base = dealerSubdomain ? `https://${dealerSubdomain}.xdrive.my` : "https://xdrive.my";
 const link = `${_base}/cars/${car.slug}?ref=${profile?.slug || ""}`;
 let text = link;
 if (type === "wa") {
 const price = Number(car.selling_price || 0);
 text = [
 ` ${car.year} ${car.brand} ${car.model}${car.variant? " " + car.variant : ""}`,
 `RM ${price.toLocaleString()}`,
 ` ${car.city || profile?.location || "Malaysia"}`,
 ` ${car.mileage? Number(car.mileage).toLocaleString() + " km" : "—"} · ${car.colour || "—"} · ${car.transmission || "—"}`,
 ``,
 `Condition: ${car.condition || "Good"}`,
 ``,
 `Berminat? Whatsapp saya sekarang `,
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

 const AvatarDisplay = () => {
 if (profile?.avatar_url)
 return (
 <img
 src={profile.avatar_url}
 alt="avatar"
 className="w-16 h-16 rounded-full object-cover border-2 border-blue-500/30"
 />
 );
 const initial = (profile?.full_name || "S")[0].toUpperCase();
 return (
 <div
 className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl border-2 border-blue-500/30"
 style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
 >
 {initial}
 </div>
 );
 };

 if (loading) {
 return (
 <div className="min-h-screen bg-gray-950 flex items-center justify-center">
 <div className="text-gray-500 text-sm tracking-widest uppercase">Loading...
 </div>
 </div>
 );
 }

 const unreadCount = notifications.filter((n) =>!n.is_read).length;

 const markAllNotifsRead = async () => {
 const unread = notifications.filter((n) =>!n.is_read).map((n) => n.id);
 if (!unread.length) return;
 await supabase
 .from("salesman_notifications")
 .update({ is_read: true })
 .in("id", unread);
 setNotifications((p) => p.map((n) => ({ ...n, is_read: true })));
 };

 const markNotifRead = async (n) => {
 if (n.is_read) return;
 await supabase
 .from("salesman_notifications")
 .update({ is_read: true })
 .eq("id", n.id);
 setNotifications((p) =>
 p.map((x) => (x.id === n.id? { ...x, is_read: true } : x)),
 );
 };

 const timeAgo = (iso) => {
 const s = Math.floor((Date.now() - new Date(iso)) / 1000);
 if (s < 60) return `${s}s ago`;
 if (s < 3600) return `${Math.floor(s / 60)}m ago`;
 if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
 return `${Math.floor(s / 86400)}d ago`;
 };

 const generateAiReply = async (enquiry) => {
 const car = enquiry.car_listings;
 const carName = car
? [car.year, car.brand, car.model].filter(Boolean).join(" ")
 : "the car";
 const price = car?.selling_price
? `RM ${Number(car.selling_price).toLocaleString("en-MY")}`
 : null;
 const prompt = `You are a friendly car salesperson in Malaysia. Write a WhatsApp reply in natural Manglish (casual English mixed with some Malay words like lah, boleh, kan, mana tau, etc).

Customer name: ${enquiry.buyer_name || "Customer"}
Car they asked about: ${carName}${price? ` priced at ${price}` : ""}
Their message: "${enquiry.buyer_message || "General enquiry about the car"}"
Your name: ${profile?.full_name || "the sales team"}

Write a warm, personalised reply that greets them by name, acknowledges the specific car, responds to their message, and suggests a clear next step (viewing / test drive / WhatsApp chat). Keep it 3–5 sentences, conversational, not stiff. Reply with the message text only — no labels, no quotes.`;

 setAiLoading(true);
 try {
 const { data, error } = await supabase.functions.invoke("ai-proxy", {
 body: { prompt },
 });
 if (error) throw error;
 const reply =
 data?.reply?? data?.content?? data?.text?? data?.message?? "";
 setAiDrafts((p) => ({ ...p, [enquiry.id]: reply }));
 } catch {
 setAiDrafts((p) => ({
 ...p,
 [enquiry.id]: "Couldn't generate reply. Please try again.",
 }));
 } finally {
 setAiLoading(false);
 }
 };

 const WA_TEMPLATES = [
 {
 label: "Interested? Let's chat",
 build: (name, carName, price) =>
 `Hi ${name}! Nampak you ada interest dalam ${carName}${price? ` (RM ${price})` : ""}. Best lah tu — kereta ni memang power! Boleh kita discuss lebih lanjut? Saya ready nak tolong you `,
 },
 {
 label: "Book a test drive",
 build: (name, carName) =>
 `Hi ${name}! Test drive dulu baru decide — betul tak? ${carName} memang best bila dah rasa sendiri. Bila you free nak mai test? Saya boleh arrange untuk you anytime!`,
 },
 {
 label: "Price negotiation",
 build: (name, carName, price) =>
 `Hi ${name}! Faham faham, semua orang nak harga terbaik ${carName}${price? ` ni listed RM ${price}` : ""} tapi kita boleh discuss. You ada budget dalam range mana? Saya cuba tolong cari jalan `,
 },
 {
 label: "Deposit to reserve",
 build: (name, carName) =>
 `Hi ${name}! Just nak inform — ${carName} ni ada few people tengah tengok jugak. Kalau you serious, boleh letak deposit dulu untuk reserve. Nanti takut kena kebas orang lain pulak Nak saya explain process dia?`,
 },
 ];

 const fireTemplate = (enquiry, tpl) => {
 const car = enquiry.car_listings;
 const name = enquiry.buyer_name || "kawan";
 const carName = car? `${car.brand} ${car.model}` : "kereta ni";
 const price = car?.selling_price
? Number(car.selling_price).toLocaleString("en-MY")
 : null;
 const text = tpl.build(name, carName, price);
 navigator.clipboard.writeText(text);
 const phone = (enquiry.buyer_phone || "").replace(/\D/g, "");
 if (phone) {
 window.open(
 `https://wa.me/${phone.startsWith("6")? phone : "6" + phone}?text=${encodeURIComponent(text)}`,
 "_blank",
 "noopener,noreferrer",
 );
 }
 setTemplateToast(enquiry.id);
 setTimeout(() => setTemplateToast(null), 2000);
 };

 const AI_CAPTION_PLATFORMS = ["whatsapp", "tiktok", "instagram", "facebook", "general"];

 const checkQuota = async (feature) => {
 try {
 const { data } = await supabase.rpc("salesman_ai_quota_ok", { p_feature: feature });
 return data!== false;
 } catch { return true; }
 };

 const logAiUsage = async (feature) => {
 const today = new Date().toISOString().slice(0, 10);
 const col = `${feature}_count`;
 await supabase.from("ai_salesman_usage").upsert(
 { salesman_id: userId, usage_date: today, [col]: 1 },
 { onConflict: "salesman_id,usage_date", ignoreDuplicates: false }
 ).then(null, () => {});
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
 const link = car.slug ? `${_siteBase}/cars/${car.slug}` : null;
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

 const updateLeadStage = async (leadId, stage) => {
 setStageSavingId(leadId);
 const oldStage = leads.find((l) => l.id === leadId)?.stage?? null;
 const dealerId = getDealerIdFromProfile(profile);
 const { error: stageErr } = await supabase
 .from("leads")
 .update({ stage, updated_at: new Date().toISOString() })
 .eq("id", leadId);
 setStageSavingId(null);
 if (stageErr) { console.error("updateLeadStage:", stageErr); toast.error("Failed to update lead stage"); return; }
 await supabase.from("lead_activities").insert({
 lead_id: leadId,
 activity_type: "stage_changed",
 from_stage: oldStage,
 to_stage: stage,
 created_by: userId,
 dealer_id: dealerId,
 });
 setLeads((p) => p.map((l) => (l.id === leadId? { ...l, stage } : l)));
 };

 const advanceLeadStage = (lead, newStage, force = false) => {
 if (!newStage) return;
 if (!force && lead.stage === "test_drive") { setTestDriveConfirm({ lead, nextStage: newStage }); return; }
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
 const name = lead.buyer_name || "kawan";
 const defaultMsg = `Hi ${name}! Macam mana, still interested dalam ${carName} tu? Jom kita discuss lagi — saya boleh tolong cari yang terbaik untuk you `;
 setWaModalLead(lead);
 setWaModalMessage(defaultMsg);
 };

 const saveLeadNote = async (leadId) => {
 setNotesSavingId(leadId);
 const { error } = await supabase.from("leads").update({ notes: editNoteVal, updated_at: new Date().toISOString() }).eq("id", leadId);
 setNotesSavingId(null);
 if (error) { console.error("saveLeadNote:", error); toast.error("Failed to save note"); return; }
 setLeads((p) => p.map((l) => l.id === leadId? { ...l, notes: editNoteVal } : l));
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
 note: `${callOutcome}${callNote? ` — ${callNote}` : ""}`,
 created_by: userId,
 dealer_id: getDealerIdFromProfile(profile),
 });
 if (error) { console.error("logCall:", error); toast.error("Failed to log call"); setCallSaving(false); return; }
 await supabase.from("leads").update({ updated_at: new Date().toISOString(), last_call_outcome: callOutcome }).eq("id", logCallLeadId);
 setLeads((p) => p.map((l) => l.id === logCallLeadId? { ...l, updated_at: new Date().toISOString(), last_call_outcome: callOutcome } : l));
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
 if (delErr) { console.error("handleDeleteLead:", delErr); toast.error("Failed to delete lead"); return; }
 setLeads((p) => p.filter((l) => l.id!== leadId));
 setDeleteConfirmId(null);
 };

 const handleLinkCar = async (leadId, carId) => {
 const { error: linkErr } = await supabase
 .from("leads")
 .update({ car_listing_id: carId, updated_at: new Date().toISOString() })
 .eq("id", leadId);
 if (linkErr) { console.error("handleLinkCar:", linkErr); toast.error("Failed to link car"); return; }
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
 const oldStage = lead?.stage?? null;
 const dealerId = getDealerIdFromProfile(profile);
 const now = new Date().toISOString();
 setLostSavingId(leadId);
 const { error: lostErr } = await supabase
 .from("leads")
 .update({ stage: "lost", loss_reason: reason, updated_at: now })
 .eq("id", leadId);
 setLostSavingId(null);
 if (lostErr) { console.error("handleLostReason:", lostErr); toast.error("Failed to mark lead as lost"); return; }
 await supabase.from("lead_activities").insert({
 lead_id: leadId,
 activity_type: "stage_changed",
 from_stage: oldStage,
 to_stage: "lost",
 note: `Lost reason: ${reason}`,
 created_by: userId,
 dealer_id: dealerId,
 });
 setLeads((p) =>
 p.map((l) => l.id === leadId? { ...l, stage: "lost", loss_reason: reason, updated_at: now } : l)
 );
 setLostPromptId(null);
 };

 const handleAddLead = async () => {
 setAddLeadSaving(true);
 const { data } = await supabase
 .from("leads")
 .insert({
 dealer_id: profile?.dealer_id,
 salesman_id: userId,
 assigned_to: userId,
 buyer_name: addLeadForm.buyer_name,
 phone: addLeadForm.phone,
 notes: addLeadForm.notes,
 car_listing_id: addLeadForm.car_listing_id || null,
 buyer_state: addLeadForm.buyer_state || null,
 stage: "new",
 lead_source: "manual",
 })
 .select()
 .single();
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
 const STAGE_WEIGHT = { new: 1, contacted: 2, viewing_booked: 3, test_drive: 4, negotiating: 5, deposit_taken: 6 };
 const LOST_REASONS = ["Price", "Timing", "Competitor", "Ghost"];
 const getHeatScore = (lead) => {
 const stageWeight = STAGE_WEIGHT[lead.stage] || 0;
 const daysStale = lead.updated_at
? Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000) : 0;
 const score = stageWeight - Math.min(daysStale * 0.5, 3);
 if (score >= 4) return { score, label: "hot", color: "#f87171" };
 if (score >= 2) return { score, label: "warm", color: "#fbbf24" };
 return { score, label: "cold", color: "#93c5fd" };
 };
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

 const renderAppt = (appt, i, total, isToday) => {
 const apptCar = appt.car_listings;
 const apptCarName = apptCar
? `${apptCar.year} ${apptCar.brand} ${apptCar.model}`
 : null;
 const dt = formatApptDate(appt.appointment_date);
 const phone = appt.buyer_phone?.replace(/\D/g, "") || "";
 const waText = encodeURIComponent(
 `Hi ${appt.buyer_name || "there"}, this is ${profile?.full_name || "your salesperson"} from ${profile?.dealership || "our dealership"}. Confirming your viewing on ${dt.day} ${dt.month} at ${dt.time}${apptCarName? ` for the ${apptCarName}` : ""}. See you then! `,
 );
 const statusColor =
 {
 confirmed: "bg-green-500/15 text-green-400 border-green-500/30",
 cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
 rescheduled: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
 pending: "bg-blue-500/15 text-blue-400 border-blue-500/30",
 }[appt.status]?? "bg-gray-700/40 text-gray-400 border-gray-600";

 const isNew = Date.now() - new Date(appt.created_at) < 7200000;

 return (
 <div
 key={appt.id}
 className={`flex items-start gap-4 py-3 ${i < total - 1? "border-b border-gray-800" : ""}`}
 style={{
 background: isToday? "rgba(59,130,246,0.03)" : "transparent",
 borderRadius: 8,
 padding: "12px 8px",
 }}
 >
 <div className="w-14 flex-shrink-0 text-center">
 <p
 className="text-2xl font-bold leading-none"
 style={{ color: "#60a5fa" }}
 >
 {dt.day}
 </p>
 <p className="text-xs text-gray-500 mt-0.5">{dt.month}</p>
 <p className="text-xs text-gray-500">{dt.time}</p>
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between gap-2 mb-1">
 <div className="flex items-center gap-2 min-w-0">
 <p className="text-sm font-medium text-white truncate">
 {appt.buyer_name || "—"}
 </p>
 {isNew && (
 <span
 style={{
 fontSize: 9,
 fontWeight: 800,
 background: "rgba(59,130,246,0.15)",
 border: "1px solid rgba(59,130,246,0.3)",
 color: "#93c5fd",
 borderRadius: 4,
 padding: "1px 5px",
 letterSpacing: "0.08em",
 flexShrink: 0,
 }}
 >NEW
 </span>
 )}
 </div>
 <span
 className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border capitalize flex-shrink-0 ${statusColor}`}
 >
 {appt.status || "pending"}
 </span>
 </div>
 {apptCarName && (
 <p className="text-xs text-gray-400 truncate">{apptCarName}</p>
 )}
 {appt.buyer_phone && (
 <p className="text-xs text-gray-500 mt-0.5">
 <Phone size={11} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }} /> {appt.buyer_phone}
 </p>
 )}
 {appt.notes && (
 <p className="text-xs text-gray-600 italic mt-0.5 truncate">
 <MessageSquare size={11} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }} /> "{appt.notes}"
 </p>
 )}
 </div>
 {phone && (
 <button
 onClick={() =>
 window.open(
 `https://wa.me/${phone.startsWith("6")? phone : "6" + phone}?text=${waText}`,
 "_blank",
 )
 }
 className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all"
 style={{
 background: "rgba(37,211,102,0.1)",
 border: "1px solid rgba(37,211,102,0.25)",
 color: "#4ade80",
 }}
 >
 <MessageSquare className="w-3 h-3" />WA
 </button>
 )}
 </div>
 );
 };

 // render helpers 
 const CARD = {
 background: "rgba(255,255,255,0.032)",
 border: "0.5px solid rgba(255,255,255,0.07)",
 borderRadius: 12,
 padding: 14,
 };

 const renderDashboard = () => {
 const stale = [...staleLeads].sort(
 (a, b) => new Date(a.updated_at) - new Date(b.updated_at),
 );
 const activityFeed = [
 ...appointments.map((a) => ({
 type: "booking",
 label: `Booking: ${a.buyer_name || "—"} for ${a.car_listings?.brand || "a car"}`,
 ts: a.created_at,
 dot: "#22c55e",
 })),
 ...enquiries.map((e) => ({
 type: "enquiry",
 label: `Enquiry from ${e.buyer_name || "someone"} — ${e.car_listings?.brand || ""}`,
 ts: e.created_at,
 dot: "#60a5fa",
 })),
 ...leads
 .filter((l) => l.updated_at)
 .map((l) => ({
 type: "lead",
 label: `Lead: ${l.buyer_name || "—"} (${l.stage || "new"})`,
 ts: l.updated_at,
 dot: "#fbbf24",
 })),
 ...commissionDetails.map((c) => ({
 type: "sale",
 label: `Sold: ${[c.year, c.brand, c.model].filter(Boolean).join(" ")}`,
 ts: c.sold_at,
 dot: "#4ade80",
 })),
 ]
 .filter((i) => i.ts)
 .sort((a, b) => new Date(b.ts) - new Date(a.ts))
 .slice(0, 8);

 const monthlyTarget = profile?.monthly_target || 5;
 const targetPct = Math.min(100, (thisMonthSales / monthlyTarget) * 100);
 const targetHit = thisMonthSales >= monthlyTarget;

 const now = new Date();
 const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
 const leadsThisMonth = leads.filter(
 (l) => l.created_at && new Date(l.created_at) >= monthStart,
 ).length;
 const apptThisMonth = appointments.filter(
 (a) => a.appointment_date && new Date(a.appointment_date) >= monthStart,
 ).length;
 const enqThisMonth = enquiries.filter(
 (e) => e.created_at && new Date(e.created_at) >= monthStart,
 ).length;

 const SUBTABS_UI = (
 <div
 style={{
 display: "flex",
 gap: 4,
 marginBottom: 20,
 background: "rgba(255,255,255,0.04)",
 borderRadius: 10,
 padding: 4,
 width: "fit-content",
 }}
 >
 {[
 ["overview", "Overview"],
 ].map(([key, label]) => (
 <button
 key={key}
 onClick={() => setSubTab(key)}
 style={{
 background:
 subTab === key? "rgba(29,78,216,0.2)" : "transparent",
 border:
 subTab === key
? "0.5px solid rgba(29,78,216,0.35)"
 : "0.5px solid transparent",
 borderRadius: 7,
 color: subTab === key? "#93c5fd" : "#64748b",
 fontSize: 13,
 fontWeight: subTab === key? 600 : 400,
 padding: "6px 14px",
 cursor: "pointer",
 }}
 >
 {label}
 </button>
 ))}
 </div>
 );

 // Overview
 if (subTab === "overview")
 return (
 <>

 {/* AI: What to do today */}
 <div
 style={{
 background: "rgba(220,38,38,0.04)",
 border: "1px solid rgba(220,38,38,0.15)",
 borderRadius: 12,
 padding: "14px 16px",
 marginBottom: 20,
 }}
 >
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
 <span style={{ fontSize: 14 }}></span>
 <span style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5" }}>What to do today</span>
 </div>
 {isPremium && (
 <button
 onClick={fetchFollowupSuggestions}
 disabled={followupsLoading}
 style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", color: "#fca5a5", cursor: "pointer" }}
 >
 {followupsLoading? "Loading..." : aiFollowups.length? "Refresh" : "Generate"}
 </button>
 )}
 </div>
 {!isPremium? (
 <UpgradeBanner feature="AI Follow-up Suggestions" />
 ) : followupsLoading? (
 <AiLoadingState text="AI sedang analisa leads anda..." />
 ) : aiFollowups.length === 0? (
 <p style={{ margin: 0, fontSize: 12, color: "#4b5563" }}>Klik Generate untuk cadangan susulan AI anda.</p>
 ) : (
 <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
 {aiFollowups.map((item, i) => (
 <div key={i} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, opacity: item.is_acted_on? 0.4 : 1 }}>
 <span style={{ fontSize: 18, flexShrink: 0 }}>{item.type === "call"? "" : item.type === "whatsapp"? "" : item.type === "visit"? "" : item.type === "offer"? "" : ""}</span>
 <div style={{ flex: 1, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.lead.buyer_name || "—"}</p>
 <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>{item.suggestion}</p>
 </div>
 <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
 {item.lead.phone && (
 <button onClick={() => { const ph = item.lead.phone.replace(/\D/g,""); window.open(`https://wa.me/${ph.startsWith("6")? ph : "6"+ph}`, "_blank"); }} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#4ade80", cursor: "pointer" }}>WA</button>
 )}
 <button onClick={() => setAiFollowups((p) => p.map((x, j) => j === i? { ...x, is_acted_on: true } : x))} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>Done</button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* KPI cards */}
 <div
 style={{
 display: "grid",
 gridTemplateColumns: isMobile? "repeat(2,1fr)" : "repeat(4,1fr)",
 gap: isMobile? 8 : 14,
 marginBottom: 14,
 }}
 >
 <div
 style={{
 background: "#0d1117",
 border: "1px solid rgba(255,255,255,0.07)",
 borderRadius: 12,
 padding: isMobile? 12 : "16px 18px",
 }}
 >
 <div
 style={{
 display: "flex",
 alignItems: "center",
 justifyContent: "space-between",
 marginBottom: 10,
 }}
 >
 <span
 style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}
 >Enquiries
 </span>
 <MessageSquare size={14} color="#3b82f6" />
 </div>
 <p
 style={{
 margin: 0,
 fontSize: isMobile? 18 : 26,
 fontWeight: 700,
 color: "#f1f5f9",
 lineHeight: 1,
 }}
 >
 {myEnquiries}
 </p>
 <canvas
 id="spark-enquiries"
 height={isMobile? 28 : 36}
 style={{ width: "100%", marginTop: 10, display: "block" }}
 />
 </div>
 <div
 style={{
 background: "#0d1117",
 border: "1px solid rgba(255,255,255,0.07)",
 borderRadius: 12,
 padding: isMobile? 12 : "16px 18px",
 }}
 >
 <div
 style={{
 display: "flex",
 alignItems: "center",
 justifyContent: "space-between",
 marginBottom: 10,
 }}
 >
 <span
 style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}
 >Active Listings
 </span>
 <Car size={14} color="#a78bfa" />
 </div>
 <p
 style={{
 margin: 0,
 fontSize: isMobile? 18 : 26,
 fontWeight: 700,
 color: "#f1f5f9",
 lineHeight: 1,
 }}
 >
 {myListings.length}
 </p>
 <p style={{ margin: "6px 0 0", fontSize: 11, color: "#475569" }}>
 {myListings.filter((l) => l.status === "available").length}{" "}
 available
 </p>
 </div>
 <div
 style={{
 background: "#0d1117",
 border: "1px solid rgba(255,255,255,0.07)",
 borderRadius: 12,
 padding: isMobile? 12 : "16px 18px",
 }}
 >
 <div
 style={{
 display: "flex",
 alignItems: "center",
 justifyContent: "space-between",
 marginBottom: 10,
 }}
 >
 <span
 style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}
 >Commission
 </span>
 <TrendingUp size={14} color="#22c55e" />
 </div>
 <p
 style={{
 margin: 0,
 fontSize: isMobile? 18 : 26,
 fontWeight: 700,
 color: "#f1f5f9",
 lineHeight: 1,
 }}
 >RM{" "}
 {commission!== null
? Number(commission).toLocaleString("en-MY")
 : "–"}
 </p>
 <canvas
 id="spark-commission"
 height={isMobile? 28 : 36}
 style={{ width: "100%", marginTop: 10, display: "block" }}
 />
 </div>
 <div
 style={{
 background: "#0d1117",
 border: "1px solid rgba(255,255,255,0.07)",
 borderRadius: 12,
 padding: isMobile? 12 : "16px 18px",
 }}
 >
 <div
 style={{
 display: "flex",
 alignItems: "center",
 justifyContent: "space-between",
 marginBottom: 10,
 }}
 >
 <span
 style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}
 >Active Leads
 </span>
 <Users size={14} color="#f59e0b" />
 </div>
 <p
 style={{
 margin: 0,
 fontSize: isMobile? 18 : 26,
 fontWeight: 700,
 color: "#f1f5f9",
 lineHeight: 1,
 }}
 >
 {
 leads.filter((l) => l.stage!== "won" && l.stage!== "lost")
 .length
 }
 </p>
 {staleLeads.length > 0 && (
 <p
 style={{ margin: "6px 0 0", fontSize: 11, color: "#ef4444" }}
 >
 {staleLeads.length} stale
 </p>
 )}
 </div>
 </div>

 {/* Monthly target card */}
 <div
 style={{
 background: "#0d1117",
 border: targetHit
? "1px solid rgba(34,197,94,0.25)"
 : "1px solid rgba(255,255,255,0.07)",
 borderRadius: 12,
 padding: isMobile? "12px 14px" : "14px 18px",
 marginBottom: 28,
 }}
 >
 <div
 style={{
 display: "flex",
 alignItems: "center",
 justifyContent: "space-between",
 marginBottom: 8,
 }}
 >
 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
 <Target size={14} color={targetHit? "#22c55e" : "#3b82f6"} />
 <span
 style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}
 >Monthly target
 </span>
 </div>
 <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
 {targetHit && (
 <span
 style={{
 fontSize: 10,
 fontWeight: 700,
 background: "rgba(34,197,94,0.12)",
 border: "1px solid rgba(34,197,94,0.3)",
 color: "#4ade80",
 borderRadius: 99,
 padding: "2px 8px",
 }}
 >Target hit!
 </span>
 )}
 <span
 style={{
 fontSize: 13,
 fontWeight: 700,
 color: targetHit? "#4ade80" : "#f1f5f9",
 }}
 >
 {thisMonthSales} / {monthlyTarget}
 </span>
 </div>
 </div>
 <div
 style={{
 height: 6,
 background: "rgba(255,255,255,0.06)",
 borderRadius: 99,
 overflow: "hidden",
 }}
 >
 <div
 style={{
 height: "100%",
 width: `${targetPct}%`,
 background: targetHit? "#22c55e" : "#3b82f6",
 borderRadius: 99,
 transition: "width 0.4s",
 }}
 />
 </div>
 <p style={{ margin: "6px 0 0", fontSize: 11, color: "#475569" }}>
 {targetHit
? `${thisMonthSales - monthlyTarget} cars over target`
 : `${monthlyTarget - thisMonthSales} more to go`}
 </p>
 </div>

 {/* Charts row */}
 <div
 style={{
 display: "grid",
 gridTemplateColumns: isMobile? "1fr" : "1fr 1fr",
 gap: 12,
 marginBottom: 12,
 }}
 >
 <div style={CARD}>
 <p
 style={{
 margin: "0 0 12px",
 fontSize: 12,
 color: "#9ca3af",
 fontWeight: 500,
 }}
 >Views &amp; enquiries — last 14 days
 </p>
 <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
 <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
 <div
 style={{
 width: 8,
 height: 8,
 borderRadius: 2,
 background: "#60a5fa",
 }}
 />
 <span style={{ fontSize: 11, color: "#9ca3af" }}>Views</span>
 </div>
 <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
 <div
 style={{
 width: 16,
 height: 2,
 background:
 "repeating-linear-gradient(to right,#fbbf24 0,#fbbf24 4px,transparent 4px,transparent 7px)",
 }}
 />
 <span style={{ fontSize: 11, color: "#9ca3af" }}>Enquiries
 </span>
 </div>
 </div>
 <div
 style={{ position: "relative", height: isMobile? 150 : 130 }}
 >
 <canvas
 id="chart-line"
 style={{ width: "100%", height: "100%" }}
 />
 </div>
 </div>
 <div style={CARD}>
 <p
 style={{
 margin: "0 0 12px",
 fontSize: 12,
 color: "#9ca3af",
 fontWeight: 500,
 }}
 >Lead stage breakdown
 </p>
 <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
 <div
 style={{
 width: isMobile? 90 : 110,
 height: isMobile? 90 : 110,
 flexShrink: 0,
 }}
 >
 <canvas
 id="chart-donut"
 style={{ width: "100%", height: "100%" }}
 />
 </div>
 <div
 style={{ display: "flex", flexDirection: "column", gap: 8 }}
 >
 {[
 ["new", "#60a5fa", "New"],
 ["contacted", "#fbbf24", "Contacted"],
 ["viewing_booked", "#c084fc", "Viewing booked"],
 ["negotiating", "#fb923c", "Negotiating"],
 ["deposit_taken", "#4ade80", "Deposit taken"],
 ["won", "#22c55e", "Won"],
 ].map(([s, c, lbl]) => (
 <div
 key={s}
 style={{ display: "flex", alignItems: "center", gap: 6 }}
 >
 <div
 style={{
 width: 8,
 height: 8,
 borderRadius: 2,
 background: c,
 flexShrink: 0,
 }}
 />
 <span style={{ fontSize: 11, color: "#9ca3af" }}>
 {lbl} ({leads.filter((l) => l.stage === s).length})
 </span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>

 {/* Bottom row */}
 <div
 style={{
 display: "grid",
 gridTemplateColumns: isMobile
? "1fr"
 : stale.length === 0
? "1fr"
 : "1fr 1fr",
 gap: 12,
 }}
 >
 {stale.length > 0 && (
 <div style={CARD}>
 <p
 style={{
 margin: "0 0 12px",
 fontSize: 12,
 color: "#9ca3af",
 fontWeight: 500,
 }}
 >Follow-up nudges
 </p>
 {stale.slice(0, 3).map((lead) => {
 const daysIdle = Math.floor(
 (Date.now() - new Date(lead.updated_at)) / 86400000,
 );
 const carName = lead.car_listings
? `${lead.car_listings.brand || ""} ${lead.car_listings.model || ""}`.trim()
 : "";
 return (
 <div
 key={lead.id}
 style={{
 background: "rgba(251,146,60,0.06)",
 border: "1px solid rgba(251,146,60,0.2)",
 borderRadius: 10,
 padding: "10px 12px",
 display: "flex",
 alignItems: "center",
 gap: 10,
 marginBottom: 8,
 }}
 >
 <div
 style={{
 flexShrink: 0,
 width: 8,
 height: 8,
 borderRadius: "50%",
 background: "#fb923c",
 }}
 />
 <div style={{ flex: 1, minWidth: 0 }}>
 <p
 style={{
 margin: 0,
 fontSize: 12,
 color: "#fdba74",
 fontWeight: 500,
 }}
 >
 {lead.buyer_name || "—"}
 </p>
 <p
 style={{
 margin: "2px 0 0",
 fontSize: 11,
 color: "#92400e",
 }}
 >
 {daysIdle}d idle{carName? ` · ${carName}` : ""}
 </p>
 </div>
 <button
 onClick={() => pingWA(lead)}
 style={{
 background: "rgba(37,211,102,0.1)",
 border: "1px solid rgba(37,211,102,0.25)",
 color: "#4ade80",
 fontSize: 11,
 padding: "4px 10px",
 borderRadius: 6,
 cursor: "pointer",
 flexShrink: 0,
 }}
 >Ping WA
 </button>
 </div>
 );
 })}
 {stale.length > 3 && (
 <p style={{ margin: 0, fontSize: 11, color: "#374151" }}>
 {stale.length - 3} more stale lead
 {stale.length - 3!== 1? "s" : ""}
 </p>
 )}
 </div>
 )}
 <div style={CARD}>
 <p
 style={{
 margin: "0 0 4px",
 fontSize: 12,
 color: "#9ca3af",
 fontWeight: 500,
 }}
 >Activity feed
 </p>
 {activityFeed.length === 0 && (
 <p
 style={{ fontSize: 12, color: "#374151", margin: "12px 0 0" }}
 >No recent activity yet.
 </p>
 )}
 {activityFeed.map((item, i) => (
 <div
 key={i}
 style={{
 display: "flex",
 alignItems: "center",
 gap: 10,
 padding: "8px 0",
 borderBottom:
 i < activityFeed.length - 1
? "1px solid rgba(255,255,255,0.05)"
 : "none",
 }}
 >
 <div
 style={{
 width: 8,
 height: 8,
 borderRadius: "50%",
 background: item.dot,
 flexShrink: 0,
 }}
 />
 <span style={{ fontSize: 12, color: "#9ca3af", flex: 1 }}>
 {item.label}
 </span>
 <span
 style={{ fontSize: 10, color: "#374151", flexShrink: 0 }}
 >
 {timeAgo(item.ts)}
 </span>
 </div>
 ))}
 </div>
 </div>
 </>
 );

 return null;
 };


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
 Array.isArray(car.images) && car.images.length > 0? car.images : [];
 const sp = car.selling_price || 0;
 const op = car.original_price || null;
 const saving = op && op > sp? op - sp : 0;
 const monthly =
 sp > 0? Math.round((sp * 0.9 * (1 + (3.5 / 100) * 7)) / (7 * 12)) : null;
 const stats = carStatsMap[car.id]?? {};
 const views = stats.views || 0;
 const enqs = stats.enquiries || 0;
 const cvr = views > 0? ((enqs / views) * 100).toFixed(1) : null;
 const features = parseTags(car.features);
 const options = parseTags(car.options);
 const tabs = ["specs", "features", "options"].filter(
 (t) => t!== "specs" || true,
 );

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
 {side === "left"? (
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
 {/* Backdrop */}
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
 {/* Panel */}
 <div
 onClick={(e) => e.stopPropagation()}
 style={{
 position: "relative",
 margin: isMobile? 0 : "24px auto",
 maxWidth: isMobile? "100vw" : 1000,
 width: isMobile? "100vw" : "calc(100vw - 48px)",
 height: isMobile? "100dvh" : undefined,
 maxHeight: isMobile? "100dvh" : "calc(100vh - 48px)",
 background: "rgba(11,11,15,0.99)",
 border: "1px solid rgba(255,255,255,0.08)",
 borderRadius: isMobile? 0 : 8,
 overflow: "hidden",
 display: "flex",
 flexDirection: "column",
 fontFamily: "'DM Sans', sans-serif",
 }}
 >
 {/* Close */}
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

 {/* Body */}
 <div
 style={{
 display: "flex",
 flex: 1,
 minHeight: 0,
 overflowY: "auto",
 flexDirection: isMobile? "column" : "row",
 }}
 >
 {/* LEFT — gallery + details */}
 <div
 style={{
 flex: 1,
 minWidth: 0,
 padding: isMobile? 16 : 24,
 borderRight: isMobile
? "none"
 : "1px solid rgba(255,255,255,0.08)",
 overflowY: isMobile? "visible" : "auto",
 }}
 >
 {/* Gallery */}
 {images.length > 0? (
 <div style={{ display: "flex", gap: 8 }}>
 {/* Thumb strip */}
 <div
 style={{
 width: 60,
 display: "flex",
 flexDirection: "column",
 gap: 5,
 maxHeight: isMobile? 180 : 300,
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
? "1px solid rgba(59,130,246,0.6)"
 : "1px solid rgba(255,255,255,0.08)",
 overflow: "hidden",
 opacity: i === carDetailImgIdx? 1 : 0.45,
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
 {/* Main image */}
 <div
 style={{
 flex: 1,
 position: "relative",
 background: "#0d0d0d",
 borderRadius: 6,
 overflow: "hidden",
 height: isMobile? 180 : 300,
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
 height: isMobile? 160 : 260,
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
 {car.variant? ` ${car.variant}` : ""}
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
 {sp? `RM ${sp.toLocaleString("en-MY")}` : "—"}
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
 >RM {op.toLocaleString("en-MY")}
 </span>
 <span
 style={{
 fontSize: 10,
 color: "#93c5fd",
 background: "rgba(59,130,246,0.12)",
 border: "1px solid rgba(59,130,246,0.25)",
 borderRadius: 4,
 padding: "1px 6px",
 }}
 >SAVE RM {saving.toLocaleString("en-MY")}
 </span>
 </div>
 )}
 {monthly > 0 && (
 <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Est. RM {monthly.toLocaleString()}/mo · 90% loan · 7yr ·
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
 {tabs.map((tab) => (
 <button
 key={tab}
 onClick={() => setCarDetailTab(tab)}
 style={{
 padding: "8px 16px",
 fontSize: 12,
 color: carDetailTab === tab? "#f3f4f6" : "#6b7280",
 borderBottom:
 carDetailTab === tab
? "2px solid #ef4444"
 : "2px solid transparent",
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

 {/* Tab: Specs */}
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

 {/* Tab: Features */}
 {carDetailTab === "features" && (
 <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
 {features.length === 0? (
 <p style={{ fontSize: 13, color: "#6b7280" }}>No features listed.
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

 {/* Tab: Options */}
 {carDetailTab === "options" && (
 <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
 {options.length === 0? (
 <p style={{ fontSize: 13, color: "#6b7280" }}>No options listed.
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
 </div>

 {/* RIGHT — actions + CVR */}
 <div
 style={{
 flex: isMobile? "none" : "0 0 200px",
 width: isMobile? "100%" : undefined,
 padding: isMobile? "12px 16px 32px" : 20,
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
 >Actions
 </p>

 {actionBtn(
 <>
 <Copy size={13} style={{ flexShrink: 0 }} />Copy Link
 </>,
 listingCopied[car.id] === "link"? "#4ade80" : "#9ca3af",
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
 <MessageSquare size={13} style={{ flexShrink: 0 }} />WA
 Caption
 </>,
 "#4ade80",
 "rgba(37,211,102,0.06)",
 "rgba(37,211,102,0.2)",
 () => handleListingCopy(car, "wa"),
 )}
 {actionBtn(
 <>
 <Sparkles size={13} style={{ flexShrink: 0 }} />AI Caption
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
 <Bell size={13} style={{ flexShrink: 0 }} />Broadcast
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
 <Eye size={13} style={{ flexShrink: 0 }} />TikTok Studio
 </>,
 "#f87171",
 "rgba(239,68,68,0.08)",
 "rgba(239,68,68,0.25)",
 () => {
 setTiktokListing(car);
 close();
 },
 )}

 {/* CVR stats */}
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
 >Performance
 </p>
 {[
 { label: "Views", val: views, color: "#60a5fa" },
 { label: "Enquiries", val: enqs, color: "#fbbf24" },
 {
 label: "CVR",
 val: cvr!== null? `${cvr}%` : "—",
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
 >Status
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

 const renderListings = () => {
 // compute per-listing stats once
 const enriched = myListings.map((car) => {
 const stats = carStatsMap[car.id]?? {};
 const views = stats.views || 0;
 const enqs = stats.enquiries || 0;
 const cvr = views > 0? (enqs / views) * 100 : null;
 const isHot = cvr!== null && cvr > 6 && views > 3;
 const isStale = views > 10 && (cvr === null || cvr === 0);
 return { car, views, enqs, cvr, isHot, isStale };
 });

 const hotCount = enriched.filter((e) => e.isHot).length;
 const staleCount = enriched.filter((e) => e.isStale).length;
 const activeCount = myListings.filter(
 (c) => c.status === "available",
 ).length;

 // filter
 const filtered =
 filterStatus === "all"
? enriched
 : enriched.filter((e) => e.car.status === filterStatus);

 // sort
 const sorted = [...filtered].sort((a, b) => {
 if (sortBy === "price_desc")
 return (b.car.selling_price || 0) - (a.car.selling_price || 0);
 if (sortBy === "price_asc")
 return (a.car.selling_price || 0) - (b.car.selling_price || 0);
 // newest: default — preserve original order (already sorted by created_at from query)
 return 0;
 });

 const SEL_STYLE = (active) => ({
 fontSize: 11,
 padding: "5px 11px",
 borderRadius: 7,
 cursor: "pointer",
 background: active? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.05)",
 border: active
? "1px solid rgba(59,130,246,0.4)"
 : "1px solid rgba(255,255,255,0.08)",
 color: active? "#93c5fd" : "#6b7280",
 fontWeight: active? 600 : 400,
 });

 return (
 <div>
 <p
 style={{
 margin: "0 0 12px",
 fontSize: 16,
 fontWeight: 600,
 color: "#f1f5f9",
 }}
 >My Listings ({myListings.length})
 </p>

 {myListings.length > 0 && (
 <>
 {/* Summary strip */}
 <div
 style={{
 display: "flex",
 alignItems: "center",
 gap: 8,
 flexWrap: "wrap",
 marginBottom: 14,
 padding: "10px 14px",
 background: "#0d1117",
 border: "1px solid rgba(255,255,255,0.07)",
 borderRadius: 10,
 }}
 >
 <span style={{ fontSize: 12, color: "#94a3b8" }}>
 <span style={{ color: "#f1f5f9", fontWeight: 600 }}>
 {activeCount}
 </span>{" "}
 active
 </span>
 <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 14 }}>
 ·
 </span>
 <span style={{ fontSize: 12, color: "#94a3b8" }}>
 <span style={{ color: "#ef4444", fontWeight: 600 }}>
 {hotCount}
 </span>{" "}
 hot
 </span>
 <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 14 }}>
 ·
 </span>
 <span style={{ fontSize: 12, color: "#94a3b8" }}>
 <span style={{ color: "#6b7280", fontWeight: 600 }}>
 {staleCount}
 </span>{" "}
 stale
 </span>
 </div>

 {/* Sort / filter strip */}
 <div
 style={{
 display: "flex",
 alignItems: "center",
 gap: 8,
 flexWrap: "wrap",
 marginBottom: 14,
 }}
 >
 <span style={{ fontSize: 11, color: "#4b5563", marginRight: 2 }}>Sort:
 </span>
 <button
 style={SEL_STYLE(sortBy === "newest")}
 onClick={() => setSortBy("newest")}
 >Newest
 </button>
 <button
 style={SEL_STYLE(sortBy === "price_desc")}
 onClick={() => setSortBy("price_desc")}
 >Price ↓
 </button>
 <button
 style={SEL_STYLE(sortBy === "price_asc")}
 onClick={() => setSortBy("price_asc")}
 >Price ↑
 </button>
 <span style={{ flex: 1 }} />
 <span style={{ fontSize: 11, color: "#4b5563", marginRight: 2 }}>Status:
 </span>
 {["all", "available", "reserved", "pending"].map((s) => (
 <button
 key={s}
 style={SEL_STYLE(filterStatus === s)}
 onClick={() => setFilterStatus(s)}
 >
 {s === "all"? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
 </button>
 ))}
 </div>
 </>
 )}

 {myListings.length === 0? (
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
 >No listings assigned yet
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
 >Ask your manager to assign a car to you to get started.
 </p>
 </div>
 ) : sorted.length === 0? (
 <div
 style={{
 textAlign: "center",
 padding: "32px 0",
 color: "#374151",
 fontSize: 13,
 }}
 >No listings match this filter.
 </div>
 ) : (
 <div
 style={{
 display: "grid",
 gridTemplateColumns: isMobile
? "1fr"
 : "repeat(auto-fill,minmax(260px,1fr))",
 gap: 14,
 }}
 >
 {sorted.map(({ car, views, enqs, cvr, isHot, isStale }) => {
 const cvrFill = cvr!== null? Math.min(cvr * 10, 100) : 0;
 const img = car.images?.[0];
 const name = [car.year, car.brand, car.model, car.variant]
 .filter(Boolean)
 .join(" ");
 const price = car.selling_price
? `RM ${Number(car.selling_price).toLocaleString("en-MY")}`
 : "—";
 const cvrLabel = cvr!== null? cvr.toFixed(1) : "0";
 const isHovering = cvrHover === car.id;
 return (
 <div
 key={car.id}
 style={{
 background: "#0d1117",
 border: "1px solid rgba(255,255,255,0.07)",
 borderRadius: 12,
 overflow: "hidden",
 }}
 >
 {img? (
 <img
 src={img}
 alt={name}
 onClick={() => {
 setSelectedCar(car);
 setCarDetailImgIdx(0);
 setCarDetailTab("specs");
 }}
 style={{
 width: "100%",
 height: 150,
 objectFit: "cover",
 cursor: "pointer",
 }}
 />
 ) : (
 <div
 onClick={() => {
 setSelectedCar(car);
 setCarDetailImgIdx(0);
 setCarDetailTab("specs");
 }}
 style={{
 width: "100%",
 height: 150,
 background: "rgba(255,255,255,0.04)",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 cursor: "pointer",
 }}
 >
 <Car size={32} color="#374151" />
 </div>
 )}
 <div style={{ padding: "12px 14px" }}>
 <div
 style={{
 display: "flex",
 alignItems: "flex-start",
 justifyContent: "space-between",
 marginBottom: 4,
 }}
 >
 <p
 onClick={() => {
 setSelectedCar(car);
 setCarDetailImgIdx(0);
 setCarDetailTab("specs");
 }}
 style={{
 margin: 0,
 fontSize: 13,
 fontWeight: 600,
 color: "#e5e7eb",
 lineHeight: 1.3,
 flex: 1,
 marginRight: 8,
 cursor: "pointer",
 }}
 >
 {name}
 </p>
 <StatusBadge status={car.status} />
 </div>
 {car.status === "rejected" && car.rejection_reason && (
   <div style={{ margin: "4px 0 6px", padding: "6px 10px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
     <p style={{ margin: 0, fontSize: 11, color: "#f87171" }}>Rejected: {car.rejection_reason}</p>
   </div>
 )}
 {car.status === "pending_approval" && (
   <p style={{ margin: "4px 0 6px", fontSize: 11, color: "#fbbf24" }}>Awaiting approval from your manager.</p>
 )}
 <p
 style={{
 margin: "0 0 8px",
 fontSize: 14,
 fontWeight: 700,
 color: "#60a5fa",
 }}
 >
 {price}
 </p>
 <p
 style={{
 margin: "0 0 8px",
 fontSize: 11,
 color: "#4b5563",
 }}
 >
 {[
 car.mileage
? `${Number(car.mileage).toLocaleString()} km`
 : null,
 car.transmission,
 car.colour,
 ]
 .filter(Boolean)
 .join(" · ")}
 </p>
 {/* CVR heatmap with tooltip */}
 <div
 style={{ marginBottom: 10, position: "relative" }}
 onMouseEnter={() => setCvrHover(car.id)}
 onMouseLeave={() => setCvrHover(null)}
 >
 <div
 style={{
 display: "flex",
 justifyContent: "space-between",
 marginBottom: 4,
 }}
 >
 <span style={{ fontSize: 10, color: "#4b5563" }}>
 {views} views · {enqs} enquiries
 </span>
 {isHot && (
 <span
 style={{
 fontSize: 10,
 color: "#ef4444",
 fontWeight: 600,
 }}
 >Hot
 </span>
 )}
 {isStale &&!isHot && (
 <span style={{ fontSize: 10, color: "#6b7280" }}>Stale
 </span>
 )}
 </div>
 <div
 style={{
 height: 4,
 borderRadius: 99,
 background: "rgba(255,255,255,0.06)",
 overflow: "visible",
 cursor: "default",
 }}
 >
 <div
 style={{
 height: "100%",
 width: `${cvrFill}%`,
 background: isHot? "#ef4444" : "#3b82f6",
 borderRadius: 99,
 transition: "width 0.3s",
 }}
 />
 </div>
 {isHovering && (
 <div
 style={{
 position: "absolute",
 bottom: "calc(100% + 6px)",
 left: 0,
 background: "#1e293b",
 border: "1px solid rgba(255,255,255,0.12)",
 borderRadius: 7,
 padding: "5px 10px",
 fontSize: 11,
 color: "#e2e8f0",
 whiteSpace: "nowrap",
 zIndex: 10,
 pointerEvents: "none",
 boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
 }}
 >
 {views} views · {enqs} enquiries ·{" "}
 <span
 style={{
 color: isHot? "#ef4444" : "#60a5fa",
 fontWeight: 600,
 }}
 >
 {cvrLabel}% CVR
 </span>
 </div>
 )}
 </div>
 <div
 style={{
 display: isMobile? "grid" : "flex",
 gridTemplateColumns: isMobile? "1fr 1fr" : undefined,
 gap: 6,
 flexWrap: isMobile? undefined : "wrap",
 }}
 >
 <button
 onClick={() => handleListingCopy(car, "link")}
 style={{
 fontSize: 10,
 padding: "4px 8px",
 borderRadius: 6,
 background:
 listingCopied[car.id] === "link"
? "rgba(34,197,94,0.15)"
 : "rgba(255,255,255,0.06)",
 border: "1px solid rgba(255,255,255,0.1)",
 color:
 listingCopied[car.id] === "link"
? "#4ade80"
 : "#9ca3af",
 cursor: "pointer",
 textAlign: "center",
 }}
 >
 {listingCopied[car.id] === "link"
? "Copied"
 : "Copy Link"}
 </button>
 <button
 onClick={() => handleListingCopy(car, "wa")}
 style={{
 fontSize: 10,
 padding: "4px 8px",
 borderRadius: 6,
 background: "rgba(255,255,255,0.06)",
 border: "1px solid rgba(255,255,255,0.1)",
 color: "#9ca3af",
 cursor: "pointer",
 textAlign: "center",
 }}
 >WA Caption
 </button>
 <button
 onClick={() => openBroadcast(car)}
 style={{
 fontSize: 10,
 padding: "4px 8px",
 borderRadius: 6,
 background: "rgba(249,115,22,0.1)",
 border: "1px solid rgba(249,115,22,0.25)",
 color: "#fb923c",
 cursor: "pointer",
 textAlign: "center",
 }}
 >Broadcast
 </button>
 <button
 onClick={() => generateAiCaptions(car)}
 style={{
 fontSize: 10,
 padding: "4px 8px",
 borderRadius: 6,
 background: "rgba(168,85,247,0.1)",
 border: "1px solid rgba(168,85,247,0.25)",
 color: "#c084fc",
 cursor: "pointer",
 textAlign: "center",
 }}
 >AI Caption
 </button>
 <button
 onClick={() => setTiktokListing(car)}
 style={{
 fontSize: 10,
 padding: "4px 8px",
 borderRadius: 6,
 background: "rgba(239,68,68,0.1)",
 border: "1px solid rgba(239,68,68,0.25)",
 color: "#f87171",
 cursor: "pointer",
 textAlign: "center",
 }}
 >TikTok
 </button>
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


 const renderLogCallModal = () => logCallLeadId && (() => {
 const lead = leads.find((l) => l.id === logCallLeadId);
 const OUTCOMES = [
 { key: "answered", label: "Answered", color: "#4ade80" },
 { key: "no_answer", label: "No Answer", color: "#f87171" },
 { key: "callback_requested", label: "Callback Requested", color: "#fbbf24" },
 { key: "voicemail", label: "Left Voicemail", color: "#94a3b8" },
 ];
 return (
 <div onClick={() => setLogCallLeadId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
 <div onClick={(e) => e.stopPropagation()} style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px 16px 0 0", padding: "20px 20px 32px", width: "100%", maxWidth: 480 }}>
 <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Log Call</p>
 <p style={{ margin: "0 0 16px", fontSize: 12, color: "#4b5563" }}>{lead?.buyer_name || "—"} · {lead?.phone || "—"}</p>
 <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Outcome</p>
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
 {OUTCOMES.map((o) => (
 <button key={o.key} onClick={() => setCallOutcome(o.key)} style={{ padding: "10px 12px", borderRadius: 9, fontSize: 12, fontWeight: 600, textAlign: "left", cursor: "pointer", background: callOutcome === o.key? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", border: callOutcome === o.key? `1px solid ${o.color}40` : "1px solid rgba(255,255,255,0.07)", color: callOutcome === o.key? o.color : "#6b7280" }}>
 {o.label}
 </button>
 ))}
 </div>
 <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Note (optional)</p>
 <input value={callNote} onChange={(e) => setCallNote(e.target.value)} placeholder="e.g. Will visit showroom Saturday" style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, color: "#e5e7eb", fontSize: 13, padding: "10px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14 }} />
 <div style={{ display: "flex", gap: 8 }}>
 <button onClick={() => setLogCallLeadId(null)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
 <button onClick={logCall} disabled={callSaving} style={{ flex: 2, padding: "11px 0", borderRadius: 10, background: "#dc2626", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: callSaving? "not-allowed" : "pointer", opacity: callSaving? 0.6 : 1 }}>
 {callSaving? "Saving…" : "Log Call"}
 </button>
 </div>
 </div>
 </div>
 );
 })();

 const renderBatchWAModal = () => {
 if (!batchWALeads || batchWALeads.length === 0) return null;
 const current = batchWALeads[batchWAIdx];
 if (!current) return null;
 const car = current.car_listings;
 const waPhone = (current.phone || '').replace(/\D/g, '');
 const waNum = waPhone.startsWith('6')? waPhone : '6' + waPhone;
 const carName = car? `${car.brand} ${car.model}` : 'kereta tu';
 const isStale = current.updated_at && Date.now() - new Date(current.updated_at).getTime() > 48 * 3600 * 1000;
 const msg = isStale
? `Hi ${current.buyer_name || 'kawan'}! Ada orang lain tengah tanya pasal ${carName} ni — kalau you still interested, jom lock dulu sebelum terlambat `
 : `Hi ${current.buyer_name || 'kawan'}! Macam mana, still interested dalam ${carName} tu? Jom kita discuss lagi `;
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
 <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
 {batchWALeads.map((_, i) => (
 <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i < batchWAIdx? "#4ade80" : i === batchWAIdx? "#fbbf24" : "rgba(255,255,255,0.08)" }} />
 ))}
 </div>
 <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
 <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{current.buyer_name || "—"}</p>
 <p style={{ margin: 0, fontSize: 11, color: "#4b5563" }}>
 {car? `${car.brand} ${car.model}` : "No car linked"} · Last contact {timeAgo(current.updated_at)}
 </p>
 </div>
 <p style={{ margin: "0 0 14px", fontSize: 12, color: "#6b7280", lineHeight: 1.6, padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
 {msg}
 </p>
 <div style={{ display: "flex", gap: 8 }}>
 <button
 onClick={() => { window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, "_blank"); advance(); }}
 style={{ flex: 2, padding: "11px", borderRadius: 9, background: "#25D366", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
 >WA {current.buyer_name?.split(' ')[0] || 'Lead'} →
 </button>
 <button
 onClick={advance}
 style={{ flex: 1, padding: "11px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
 >Skip
 </button>
 </div>
 <button onClick={() => setBatchWALeads(null)} style={{ width: "100%", marginTop: 10, padding: "8px", background: "none", border: "none", color: "#374151", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Stop — done for now
 </button>
 </div>
 </div>
 );
 };

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
 <button key={label} onClick={() => setFollowUpDate(val)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 20, cursor: "pointer", background: followUpDate === val? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.04)", border: followUpDate === val? "1px solid rgba(251,191,36,0.4)" : "1px solid rgba(255,255,255,0.08)", color: followUpDate === val? "#fbbf24" : "#6b7280", fontWeight: followUpDate === val? 600 : 400 }}>
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
 <button onClick={() => followUpDate && saveFollowUp(followUpModalLead.id, followUpDate)} disabled={!followUpDate || followUpSaving} style={{ flex: 2, padding: "11px 0", borderRadius: 10, background: "#dc2626", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: (!followUpDate || followUpSaving)? "not-allowed" : "pointer", opacity: (!followUpDate || followUpSaving)? 0.5 : 1 }}>
 {followUpSaving? "Saving…" : "Set Reminder"}
 </button>
 </div>
 </div>
 </div>
 );

 const renderWAModal = () =>
 waModalLead && (
 <div
 onClick={() => setWaModalLead(null)}
 style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}
 >
 <div
 onClick={(e) => e.stopPropagation()}
 style={{ background: "#111827", borderRadius: 12, width: "90%", maxWidth: 440, padding: 24 }}
 >
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
 <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#f1f5f9" }}>Send WA Message</p>
 <button onClick={() => setWaModalLead(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 2 }}>
 <X size={18} />
 </button>
 </div>
 <textarea
 value={waModalMsg}
 onChange={(e) => setWaModalMessage(e.target.value)}
 rows={5}
 style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e5e7eb", fontSize: 13, padding: "10px 12px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif", resize: "vertical", lineHeight: 1.5 }}
 />
 <button
 onClick={async () => {
 const now = new Date().toISOString();
 const { error: waTouchErr } = await supabase.from("leads").update({ updated_at: now }).eq("id", waModalLead.id);
 if (waTouchErr) { console.error("waModal leads update:", waTouchErr); toast.error("Failed to log message"); return; }
 await supabase.from("lead_activities").insert({
 lead_id: waModalLead.id, activity_type: "whatsapp_sent",
 note: "WA message sent", created_by: userId,
 dealer_id: getDealerIdFromProfile(profile),
 });
 setStaleLeads((p) => p.filter((l) => l.id!== waModalLead.id));
 setLeads((p) => p.map((l) => l.id === waModalLead.id? { ...l, updated_at: now } : l));
 const savedLeadId = waModalLead.id;
 setWaModalLead(null);
 toast("WA sent!", {
 description: "Did you also call them?",
 action: { label: "Log Call", onClick: () => { setLogCallLeadId(savedLeadId); setCallOutcome("answered"); setCallNote(""); } },
 duration: 5000,
 });
 const phone = (waModalLead.phone || "").replace(/\D/g, "");
 if (phone) window.open(`https://wa.me/${phone.startsWith("6")? phone : "6" + phone}?text=${encodeURIComponent(waModalMsg)}`, "_blank", "noopener,noreferrer");
 }}
 disabled={!waModalMsg.trim() ||!waModalLead.phone}
 style={{ marginTop: 12, width: "100%", padding: "10px", borderRadius: 8, background: "#16a34a", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor:!waModalMsg.trim() ||!waModalLead.phone? "not-allowed" : "pointer", opacity:!waModalMsg.trim() ||!waModalLead.phone? 0.6 : 1 }}
 >Send
 </button>
 {!waModalLead.phone && (
 <p style={{ margin: "8px 0 0", fontSize: 11, color: "#f87171", textAlign: "center" }}>No phone number on this lead.</p>
 )}
 </div>
 </div>
 );

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

 const heatMap = new Map(searchedLeads.map((l) => [l.id, getHeatScore(l)]));

 const activeStages = LEAD_STAGES.filter(
 (s) => s!== "lost" && s!== "closed_lost" && s!== "closed_won",
 );
 const lostLeads = searchedLeads.filter(
 (l) => l.stage === "lost" || l.stage === "closed_lost",
 );

 const AI_SCORE_PILL = (leadId) => {
 if (scoreLoading) {
 return (
 <span
 style={{
 display: "inline-block",
 width: 52,
 height: 16,
 borderRadius: 99,
 background: "rgba(255,255,255,0.07)",
 animation: "pulse 1.5s ease-in-out infinite",
 }}
 />
 );
 }
 const s = leadScores[leadId];
 if (!s) return null;
 const cfg =
 {
 hot: {
 bg: "rgba(239,68,68,0.15)",
 border: "rgba(239,68,68,0.35)",
 color: "#f87171",
 label: "Hot",
 },
 warm: {
 bg: "rgba(251,191,36,0.15)",
 border: "rgba(251,191,36,0.35)",
 color: "#fbbf24",
 label: "Warm",
 },
 cold: {
 bg: "rgba(107,114,128,0.15)",
 border: "rgba(107,114,128,0.3)",
 color: "#9ca3af",
 label: "Cold",
 },
 }[s.score] || null;
 if (!cfg) return null;
 return (
 <span
 title={s.reason || ""}
 style={{
 fontSize: 9,
 fontWeight: 700,
 letterSpacing: "0.04em",
 padding: "2px 7px",
 borderRadius: 99,
 background: cfg.bg,
 border: `1px solid ${cfg.border}`,
 color: cfg.color,
 cursor: "default",
 flexShrink: 0,
 }}
 >
 {cfg.label}
 </span>
 );
 };

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
 {/* HEADER */}
 <div style={{ padding: "12px 14px 0" }}>
 <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
 {/* Avatar */}
 <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(96,165,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 600, color: "#93c5fd" }}>
 {initials}
 </div>
 <div style={{ flex: 1, minWidth: 0 }}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
 <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
 <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 {lead.buyer_name || "—"}
 </p>
 {(lead.ai_score || leadScores[lead.id]?.score) && (() => {
 const score = lead.ai_score || leadScores[lead.id]?.score;
 const c = score === "hot"? {bg:"#dc2626",tx:"#fff"} : score === "warm"? {bg:"#f59e0b",tx:"#000"} : {bg:"#52525b",tx:"#fff"};
 return <span style={{fontSize:9,fontWeight:800,background:c.bg,color:c.tx,borderRadius:4,padding:"1px 6px",flexShrink:0}}>{score.toUpperCase()}</span>;
 })()}
 </div>
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
 </div>

 {/* ACTIONS */}
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
 style={{ flexShrink: 0, fontSize: 11, padding: "6px 10px", borderRadius: 7, background: "rgba(96,165,250,0.10)", border: "1px solid rgba(96,165,250,0.25)", color: "#93c5fd", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
 >
 
 </a>
 )}
 {lead.phone? (
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
 <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>Lead Pipeline ({leads.filter((l) => l.stage!== "lost" && l.stage!== "closed_lost" && l.stage!== "closed_won").length})
 </p>
 <div style={{ display: "flex", gap: 8 }}>
 {staleLeads.length > 0 && (
 <button
 onClick={() => { const sl = staleLeads.filter(l => l.phone); if (sl.length > 0) { setBatchWALeads(sl); setBatchWAIdx(0); } }}
 style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.3)", borderRadius: 8, color: "#fb923c", fontSize: 11, fontWeight: 600, padding: "6px 10px", cursor: "pointer" }}
 >
 {staleLeads.length} stale
 </button>
 )}
 <button
 onClick={() => setShowAddLead(true)}
 style={{ display: "flex", alignItems: "center", gap: 6, background: "#dc2626", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, padding: "7px 12px", cursor: "pointer" }}
 >
 <Plus size={13} />Add Lead
 </button>
 </div>
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
 flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 99, fontSize: 11,
 fontWeight: isActive? 600 : 400, cursor: "pointer",
 background: isActive? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.04)",
 border: isActive? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(255,255,255,0.08)",
 color: isActive? "#f87171" : "#4b5563", textTransform: "capitalize", whiteSpace: "nowrap",
 }}
 >
 {stage.replace(/_/g, " ")}
 <span style={{ fontSize: 10, fontWeight: 700, color: isActive? (sc.tx || "#f87171") : "#374151", background: isActive? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.06)", borderRadius: 99, padding: "0px 6px", lineHeight: 1.6 }}>
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
 <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
 {activeStages.map((stage) => {
 const sc = STAGE_COLOR[stage] || {};
 const stageLeads = searchedLeads
 .filter((l) => l.stage === stage)
 .sort((a, b) => (heatMap.get(b.id)?.score?? 0) - (heatMap.get(a.id)?.score?? 0));
 return (
 <div key={stage} style={{ minWidth: stageLeads.length === 0? 80 : 200, flexShrink: 0 }}>
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
 style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "6px 0" }}
 >
 <span style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", letterSpacing: "0.08em", textTransform: "uppercase" }}>Lost ({lostLeads.length})
 </span>
 <span style={{ fontSize: 12, color: "#374151" }}>{lostOpen? "" : ""}</span>
 </button>
 {lostOpen && (
 <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
 {lostLeads.map((lead) => (
 <div
 key={lead.id}
 style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px", opacity: 0.65 }}
 >
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
 <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#9ca3af", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
 {lead.buyer_name || "—"}
 </p>
 <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
 {lead.loss_reason && (
 <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)", color: "#cbd5e1", whiteSpace: "nowrap" }}>
 {lead.loss_reason}
 </span>
 )}
 <button
 onClick={() => setDeleteConfirmId(lead.id)}
 title="Delete lead"
 style={{ background: "transparent", border: "none", color: "#4b5563", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}
 >
 <Trash2 size={12} />
 </button>
 </div>
 </div>
 <p style={{ margin: "2px 0 0", fontSize: 10, color: "#374151" }}>{timeAgo(lead.created_at)}</p>
 {deleteConfirmId === lead.id && (
 <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
 <span style={{ fontSize: 11, color: "#f87171", fontWeight: 600 }}>Delete?</span>
 <button onClick={() => handleDeleteLead(lead.id)} style={{ fontSize: 10, padding: "6px 11px", borderRadius: 5, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", cursor: "pointer", fontWeight: 600 }}>Yes</button>
 <button onClick={() => setDeleteConfirmId(null)} style={{ fontSize: 10, padding: "6px 11px", borderRadius: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>No</button>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* LEAD DETAIL DRAWER */}
 {drawerLeadId && (() => {
 const pl = leads.find(l => l.id === drawerLeadId);
 if (!pl) return null;
 const plCar = pl.car_listings;
 const plCarName = plCar? [plCar.year, plCar.brand, plCar.model].filter(Boolean).join(" ") : null;
 const plCarPrice = plCar?.selling_price? `RM ${Number(plCar.selling_price).toLocaleString("en-MY")}` : null;
 const plHeat = getHeatScore(pl);
 const plHeatStyle = plHeat.label === "hot"? { bg: "rgba(248,113,113,0.12)", color: "#f87171" } : plHeat.label === "warm"? { bg: "rgba(251,191,36,0.12)", color: "#fbbf24" } : { bg: "rgba(255,255,255,0.05)", color: "#6b7280" };
 const plInitials = (pl.buyer_name || "?").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
 const plIsPromptingLost = lostPromptId === pl.id;
 const plIsConfirmingDelete = deleteConfirmId === pl.id;
 const pbCar = pl.car_listings;
 const pbCarName = pbCar? `${pbCar.year || ""} ${pbCar.brand} ${pbCar.model}`.trim() : "this car";
 const pbStage = pl.stage;
 const scripts = {
 price: { label: "Price too high", color: "#f87171", lines: [`"Let's look at what you're actually paying monthly — at 90% loan over 7 years, that's roughly RM ${pbCar?.selling_price? Math.round(pbCar.selling_price * 0.9 * 1.245 / 84).toLocaleString() : "X"}/mo."`, `"What's your target price? Let me see what I can work out — I want to make this happen for you."`, `"This is already market price. The value is there."`] },
 mileage: { label: "High mileage concern", color: "#fb923c", lines: [`"Mileage matters less than service history. A well-maintained ${pbCarName} beats a low-km car that's been neglected."`, `"These engines are built to go 300k+ km with regular service. The price already reflects the mileage."`, `"I can help you run a CARFAX/JPJ check so you can see exactly what this car's been through."`] },
 timing: { label: "Not ready yet", color: "#fbbf24", lines: [`"Totally understand — what would need to change for you to feel ready? Is it financing, or something else?"`, `"I can hold this for you with a small refundable deposit while you sort things out. No pressure."`, `"Just so you know — cars at this price point move fast. I'd hate for you to miss it."`] },
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
 <button onClick={() => { setLogCallLeadId(pl.id); setCallOutcome("answered"); setCallNote(""); }} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
 <PhoneCall size={12} />Log call
 </button>
 <button onClick={() => { setFollowUpModalLead(pl); setFollowUpDate(pl.follow_up_at? pl.follow_up_at.slice(0,10) : ""); }} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, background: pl.follow_up_at? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)", border: pl.follow_up_at? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(255,255,255,0.08)", color: pl.follow_up_at? "#fbbf24" : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
 <Clock size={12} />Set reminder
 </button>
 {isPremium && (
 <button onClick={() => rescoreLead(pl)} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 7, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", color: "#fca5a5", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
 {leadScores[pl.id]?.loading? "Scoring..." : "Re-score"}
 </button>
 )}
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
 const icon = act.activity_type === "whatsapp_sent"? "" : act.activity_type === "called"? "" : act.activity_type === "stage_changed"? "" : "";
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

 {/* AI WA Reply in drawer */}
 {isPremium && pl.buyer_name && pl.phone && (
 <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}>
 <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>AI WA Reply</p>
 {!aiWaReplies[pl.id]? (
 <button onClick={() => generateAiWaReply(pl)} disabled={waReplyLoading[pl.id]} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 7, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", color: "#fca5a5", cursor: "pointer" }}>
 {waReplyLoading[pl.id]? "Generating..." : "Generate AI Reply"}
 </button>
 ) : (
 <div>
 <textarea readOnly value={aiWaReplies[pl.id]} rows={4} style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#e5e7eb", fontSize: 12, padding: "8px 10px", resize: "none", boxSizing: "border-box" }} />
 <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
 <button onClick={() => { navigator.clipboard.writeText(aiWaReplies[pl.id]); setWaReplyCopied(p=>({...p,[pl.id]:true})); setTimeout(()=>setWaReplyCopied(p=>({...p,[pl.id]:false})),1500); }} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer" }}>{waReplyCopied[pl.id]?"Copied!":"Copy"}</button>
 {pl.phone && <button onClick={()=>{const ph=pl.phone.replace(/\D/g,"");window.open(`https://wa.me/${ph.startsWith("6")?ph:"6"+ph}?text=${encodeURIComponent(aiWaReplies[pl.id])}`,"_blank");}} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 5, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#4ade80", cursor: "pointer" }}>Send via WA</button>}
 <button onClick={()=>setAiWaReplies(p=>{const n={...p};delete n[pl.id];return n;})} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#6b7280", cursor: "pointer" }}>Regenerate</button>
 </div>
 </div>
 )}
 </div>
 )}

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

 const renderEnquiriesSection = () => {
 const newCount = enquiries.filter(e => e.status === "new").length;
 return (
 <div>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
 <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>Enquiries ({enquiries.length})</p>
 {newCount > 0 && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", color: "#93c5fd" }}>{newCount} new</span>}
 </div>
 {enquiries.length === 0 ? (
 <div style={{ padding: "40px 0", textAlign: "center", color: "#374151" }}>
 <MessageSquare size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
 <p style={{ margin: 0, fontSize: 13 }}>No enquiries yet.</p>
 </div>
 ) : (
 <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
 {enquiries.map((enq) => {
 const car = enq.car_listings;
 return (
 <div key={enq.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px" }}>
 <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
 <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{enq.buyer_name || "—"}</p>
 <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, flexShrink: 0, background: enq.status === "new" ? "rgba(96,165,250,0.12)" : enq.status === "converted" ? "rgba(34,197,94,0.12)" : "rgba(74,222,128,0.08)", border: `1px solid ${enq.status === "new" ? "rgba(96,165,250,0.3)" : enq.status === "converted" ? "rgba(34,197,94,0.3)" : "rgba(74,222,128,0.2)"}`, color: enq.status === "new" ? "#93c5fd" : "#4ade80", textTransform: "capitalize" }}>{enq.status || "new"}</span>
 </div>
 {car && <p style={{ margin: "0 0 2px", fontSize: 11, color: "#6b7280" }}>{[car.year, car.brand, car.model].filter(Boolean).join(" ")}</p>}
 {enq.buyer_phone && <p style={{ margin: "0 0 4px", fontSize: 11, color: "#4b5563" }}>📞 {enq.buyer_phone}</p>}
 {enq.buyer_message && <p style={{ margin: "0 0 8px", fontSize: 11, color: "#4b5563", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{enq.buyer_message}"</p>}
 <p style={{ margin: "0 0 8px", fontSize: 10, color: "#374151" }}>{timeAgo(enq.created_at)}</p>
 <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
 {enq.buyer_phone && (
 <button onClick={() => { const ph = (enq.buyer_phone).replace(/\D/g, ""); const msg = encodeURIComponent(`Hi ${enq.buyer_name || ""}! Thank you for your enquiry on the ${car ? `${car.brand} ${car.model}` : "kereta"}. I'm here to help — when would be a good time to chat?`); window.open(`https://wa.me/${ph.startsWith("6") ? ph : "6" + ph}?text=${msg}`, "_blank", "noopener,noreferrer"); }} style={{ fontSize: 11, fontWeight: 600, padding: "6px 10px", borderRadius: 7, background: "rgba(37,211,102,0.10)", border: "1px solid rgba(37,211,102,0.25)", color: "#4ade80", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><MessageCircle size={12} /> WA Reply</button>
 )}
 <button onClick={() => setOpenTemplateId(openTemplateId === enq.id ? null : enq.id)} style={{ fontSize: 11, padding: "6px 10px", borderRadius: 7, background: openTemplateId === enq.id ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${openTemplateId === enq.id ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)"}`, color: openTemplateId === enq.id ? "#c084fc" : "#6b7280", cursor: "pointer" }}>Templates</button>
 <button onClick={() => { setOpenAiReplyId(enq.id); generateAiReply(enq); }} style={{ fontSize: 11, padding: "6px 10px", borderRadius: 7, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", color: "#c084fc", cursor: "pointer" }}>AI Reply</button>
 {enq.status === "new" && (
 <button onClick={async () => { await supabase.from("whatsapp_enquiries").update({ status: "responded" }).eq("id", enq.id); setEnquiries(p => p.map(e => e.id === enq.id ? { ...e, status: "responded" } : e)); }} style={{ fontSize: 11, padding: "6px 10px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>Mark Responded</button>
 )}
 {enq.status !== "converted" ? (
 <button onClick={async () => { await supabase.from("leads").insert({ salesman_id: userId, dealer_id: profile?.dealer_id, buyer_name: enq.buyer_name, phone: enq.buyer_phone, notes: enq.buyer_message, car_listing_id: enq.listing_id || null, stage: "new", lead_source: "enquiry", is_deleted: false }); await supabase.from("whatsapp_enquiries").update({ status: "converted" }).eq("id", enq.id); setEnquiries(p => p.map(e => e.id === enq.id ? { ...e, status: "converted" } : e)); toast.success("Added to lead pipeline!"); }} style={{ fontSize: 11, padding: "6px 10px", borderRadius: 7, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", color: "#93c5fd", cursor: "pointer" }}>→ Pipeline</button>
 ) : (
 <span style={{ fontSize: 11, padding: "6px 10px", borderRadius: 7, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80" }}>In Pipeline</span>
 )}
 </div>
 {openTemplateId === enq.id && (
 <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
 {WA_TEMPLATES.map((tpl, ti) => (
 <button key={ti} onClick={() => fireTemplate(enq, tpl)} style={{ textAlign: "left", fontSize: 11, padding: "7px 10px", borderRadius: 7, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: templateToast === enq.id ? "#4ade80" : "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
 <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", flexShrink: 0 }} />
 {templateToast === enq.id ? "Sent!" : tpl.label}
 </button>
 ))}
 </div>
 )}
 {openAiReplyId === enq.id && (
 <div style={{ marginTop: 10 }}>
 {aiLoading ? <div className="caption-skeleton" style={{ height: 60, width: "100%" }} /> : aiDrafts[enq.id] ? (
 <div>
 <p style={{ margin: "0 0 6px", fontSize: 12, color: "#9ca3af", whiteSpace: "pre-wrap" }}>{aiDrafts[enq.id]}</p>
 <button onClick={() => navigator.clipboard.writeText(aiDrafts[enq.id])} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", color: "#c084fc", cursor: "pointer" }}>Copy</button>
 </div>
 ) : null}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
 };

 const renderBookingsSection = () => {
 const statusColors = {
 pending:     { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",  tx: "#fbbf24" },
 confirmed:   { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)",   tx: "#4ade80" },
 rescheduled: { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)", tx: "#c084fc" },
 cancelled:   { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)",   tx: "#f87171" },
 completed:   { bg: "rgba(107,114,128,0.12)", border: "rgba(107,114,128,0.3)", tx: "#9ca3af" },
 };
 const aptIsToday = (iso) => {
 if (!iso) return false;
 const d = new Date(iso), t = new Date();
 return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
 };
 const aptIsNew = (iso) => iso && Date.now() - new Date(iso).getTime() < 2 * 60 * 60 * 1000;
 const fmtAptDate = (iso) => {
 if (!iso) return { dateStr: "—", timeStr: "" };
 const d = new Date(iso);
 if (isNaN(d)) return { dateStr: "—", timeStr: "" };
 return {
 dateStr: d.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" }),
 timeStr: d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }),
 };
 };
 const buildReminderMsg = (apt) => {
 const { dateStr, timeStr } = fmtAptDate(apt.appointment_date);
 return `Hi ${apt.buyer_name || ""}! Just a reminder for your appointment on ${dateStr}${timeStr ? ` at ${timeStr}` : ""}. See you then!`;
 };
 const saveReminder = async (apt, remindAt) => {
 setReminderSaving(true);
 const { error } = await supabase.from("appointments").update({ remind_at: remindAt.toISOString(), remind_sent: false }).eq("id", apt.id);
 setReminderSaving(false);
 if (error) { toast.error("Failed to set reminder"); return; }
 setAppointments(p => p.map(a => a.id === apt.id ? { ...a, remind_at: remindAt.toISOString(), remind_sent: false } : a));
 setReminderPickerAptId(null); setSelectedRemindAt(null);
 toast.success("Reminder set — fires " + remindAt.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }));
 };
 const clearReminder = async (apt) => {
 await supabase.from("appointments").update({ remind_at: null, remind_sent: false }).eq("id", apt.id);
 setAppointments(p => p.map(a => a.id === apt.id ? { ...a, remind_at: null } : a));
 };
 const calcRemindAt = (apt, key) => {
 const base = new Date(apt.appointment_date);
 if (key === "day_before") { const d = new Date(base); d.setDate(d.getDate()-1); d.setHours(9,0,0,0); return d; }
 if (key === "two_days") { const d = new Date(base); d.setDate(d.getDate()-2); d.setHours(9,0,0,0); return d; }
 const mins = { "1h": -60, "2h": -120 };
 return new Date(base.getTime() + (mins[key] ?? -60) * 60000);
 };
 const byDate = (a, b) => new Date(a.appointment_date) - new Date(b.appointment_date);
 const byBooked = (a, b) => new Date(b.created_at) - new Date(a.created_at);
 const todayApts = appointments.filter(a => aptIsToday(a.appointment_date) && a.status !== "cancelled").sort(byDate);
 const upcomingApts = appointments.filter(a => { if (!a.appointment_date) return false; const d = new Date(a.appointment_date); return !isNaN(d) && !aptIsToday(a.appointment_date) && d > new Date(); }).sort(byBooked);
 const pastApts = appointments.filter(a => { if (!a.appointment_date) return false; const d = new Date(a.appointment_date); return !isNaN(d) && !aptIsToday(a.appointment_date) && d < new Date(); }).sort((a,b) => new Date(b.appointment_date)-new Date(a.appointment_date));

 const renderApptCard = (apt) => {
 const car = apt.car_listings;
 const { dateStr, timeStr } = fmtAptDate(apt.appointment_date);
 const sc = statusColors[apt.status] || statusColors.pending;
 const isRescheduling = reschedulingAptId === apt.id;
 const isReminderPicking = reminderPickerAptId === apt.id;
 const isCancelConfirm = cancelConfirmId === apt.id;
 const notCancelled = apt.status !== "cancelled" && apt.status !== "completed";
 const hasDeposit = apt.deposit_amount > 0;
 const bookingTypeLabel = apt.booking_type ? apt.booking_type.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()) : null;
 return (
 <div key={apt.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px" }}>
 {(bookingTypeLabel || hasDeposit) && (
 <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
 {bookingTypeLabel && <span style={{ fontSize: 10, fontWeight: 600, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", color: "#a5b4fc", borderRadius: 99, padding: "2px 8px" }}>{bookingTypeLabel}</span>}
 {hasDeposit && <span style={{ fontSize: 10, fontWeight: 600, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80", borderRadius: 99, padding: "2px 8px" }}>Deposit: RM {Number(apt.deposit_amount).toLocaleString("en-MY")}</span>}
 </div>
 )}
 <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
 <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{apt.buyer_name || "—"}</p>
 {aptIsNew(apt.created_at) && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171", flexShrink: 0 }}>NEW</span>}
 <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, flexShrink: 0, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.tx, textTransform: "capitalize" }}>{apt.status}</span>
 </div>
 <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>📅 {dateStr}{timeStr && ` · ${timeStr}`}</p>
 {car && <p style={{ margin: "0 0 2px", fontSize: 11, color: "#6b7280" }}>{[car.year, car.brand, car.model].filter(Boolean).join(" ")}</p>}
 {apt.buyer_phone && <p style={{ margin: "0 0 2px", fontSize: 11, color: "#4b5563" }}>📞 {apt.buyer_phone}</p>}
 {apt.notes && <p style={{ margin: "0 0 4px", fontSize: 10, color: "#4b5563", fontStyle: "italic" }}>"{apt.notes}"</p>}
 {apt.created_at && <p style={{ margin: "0 0 8px", fontSize: 10, color: "#374151" }}>Booked {timeAgo(apt.created_at)}</p>}
 {apt.remind_at && !apt.remind_sent ? (
 <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)", marginBottom: 8 }}>
 <Bell size={11} color="#4ade80" />
 <span style={{ fontSize: 10, color: "#4ade80", flex: 1 }}>Reminder: {new Date(apt.remind_at).toLocaleDateString("en-MY",{weekday:"short",day:"numeric",month:"short"})} {new Date(apt.remind_at).toLocaleTimeString("en-MY",{hour:"2-digit",minute:"2-digit"})}</span>
 <button onClick={() => clearReminder(apt)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 10, cursor: "pointer", padding: 0 }}>✕</button>
 </div>
 ) : apt.remind_sent ? (
 <p style={{ fontSize: 10, color: "#4b5563", margin: "0 0 8px" }}>✓ Reminder sent</p>
 ) : null}
 {isRescheduling && (
 <div style={{ marginBottom: 10, padding: "10px 12px", background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8 }}>
 <p style={{ margin: "0 0 6px", fontSize: 11, color: "#c084fc", fontWeight: 600 }}>Choose new date & time</p>
 <input type="datetime-local" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 7, color: "#e5e7eb", fontSize: 13, padding: "8px 10px", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans',sans-serif", marginBottom: 8 }} />
 <div style={{ display: "flex", gap: 6 }}>
 <button onClick={() => { setReschedulingAptId(null); setRescheduleDate(""); }} style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>Cancel</button>
 <button onClick={async () => { if (!rescheduleDate) return; const newDate = new Date(rescheduleDate); await supabase.from("appointments").update({ appointment_date: newDate.toISOString(), status: "rescheduled" }).eq("id", apt.id); setAppointments(p => p.map(a => a.id === apt.id ? { ...a, appointment_date: newDate.toISOString(), status: "rescheduled" } : a)); setReschedulingAptId(null); setRescheduleDate(""); toast.success("Appointment rescheduled!"); }} style={{ flex: 2, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.35)", color: "#c084fc", cursor: "pointer" }}>Save New Time</button>
 </div>
 </div>
 )}
 {isReminderPicking && (
 <div style={{ marginBottom: 10, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}>
 <p style={{ margin: "0 0 8px", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>Set WA Reminder</p>
 <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
 {[{key:"1h",label:"1h before"},{key:"2h",label:"2h before"},{key:"day_before",label:"Day before 9am"},{key:"two_days",label:"2 days before"}].map(({key,label}) => {
 const t = calcRemindAt(apt, key);
 const active = selectedRemindAt && t.getTime() === selectedRemindAt.getTime();
 return <button key={key} onClick={() => setSelectedRemindAt(t)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 99, cursor: "pointer", background: active ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.05)", border: active ? "1px solid rgba(96,165,250,0.4)" : "1px solid rgba(255,255,255,0.08)", color: active ? "#93c5fd" : "#6b7280" }}>{label}</button>;
 })}
 </div>
 <input type="datetime-local" value={selectedRemindAt ? selectedRemindAt.toISOString().slice(0,16) : ""} onChange={e => e.target.value && setSelectedRemindAt(new Date(e.target.value))} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#e5e7eb", fontSize: 12, padding: "7px 10px", outline: "none", marginBottom: 8, fontFamily: "inherit", boxSizing: "border-box" }} />
 <div style={{ display: "flex", gap: 6 }}>
 <button onClick={() => { setReminderPickerAptId(null); setSelectedRemindAt(null); }} style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>Cancel</button>
 <button onClick={() => selectedRemindAt && saveReminder(apt, selectedRemindAt)} disabled={!selectedRemindAt || reminderSaving} style={{ flex: 2, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, background: selectedRemindAt ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)", border: selectedRemindAt ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)", color: selectedRemindAt ? "#4ade80" : "#374151", cursor: selectedRemindAt ? "pointer" : "not-allowed", opacity: reminderSaving ? 0.6 : 1 }}>{reminderSaving ? "Saving…" : "Set Reminder"}</button>
 </div>
 </div>
 )}
 {isCancelConfirm && (
 <div style={{ marginBottom: 10, padding: "10px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8 }}>
 <p style={{ margin: "0 0 8px", fontSize: 12, color: "#f87171" }}>Cancel this appointment?</p>
 <div style={{ display: "flex", gap: 6 }}>
 <button onClick={() => setCancelConfirmId(null)} style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>Keep it</button>
 <button onClick={async () => { await updateApptStatus(apt.id, "cancelled"); setCancelConfirmId(null); }} style={{ flex: 2, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", cursor: "pointer" }}>Yes, cancel appt</button>
 </div>
 </div>
 )}
 {notCancelled && !isRescheduling && !isCancelConfirm && (
 <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
 {apt.buyer_phone && (
 <button onClick={() => { const ph = apt.buyer_phone.replace(/\D/g,""); const msg = buildReminderMsg(apt); window.open(`https://wa.me/${ph.startsWith("6")?ph:"6"+ph}?text=${encodeURIComponent(msg)}`,"_blank","noopener,noreferrer"); if (apt.status === "pending") { updateApptStatus(apt.id,"confirmed"); autoUpsertLeadFromAppt(apt); scheduleAptReminder(apt); } }} style={{ flex: 2, fontSize: 11, fontWeight: 600, padding: "7px 0", borderRadius: 7, background: "rgba(37,211,102,0.10)", border: "1px solid rgba(37,211,102,0.25)", color: "#4ade80", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
 <MessageCircle size={12} /> WA Reminder
 </button>
 )}
 {apt.status !== "confirmed" && (
 <button onClick={async () => { await updateApptStatus(apt.id,"confirmed"); await autoUpsertLeadFromAppt(apt); await scheduleAptReminder(apt); }} style={{ flex: 1, fontSize: 11, fontWeight: 600, padding: "7px 0", borderRadius: 7, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80", cursor: "pointer" }}>✓ Confirm</button>
 )}
 <button onClick={() => { const existing = apt.appointment_date ? new Date(apt.appointment_date) : new Date(); const pad = n => String(n).padStart(2,"0"); const local = `${existing.getFullYear()}-${pad(existing.getMonth()+1)}-${pad(existing.getDate())}T${pad(existing.getHours())}:${pad(existing.getMinutes())}`; setRescheduleDate(local); setReschedulingAptId(apt.id); setCancelConfirmId(null); setReminderPickerAptId(null); }} style={{ flex: 1, fontSize: 11, padding: "7px 0", borderRadius: 7, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", color: "#c084fc", cursor: "pointer" }}>↺ Move</button>
 <button onClick={() => { setCancelConfirmId(apt.id); setReschedulingAptId(null); setReminderPickerAptId(null); }} style={{ flex: 1, fontSize: 11, padding: "7px 0", borderRadius: 7, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171", cursor: "pointer" }}>✕ Cancel</button>
 <button onClick={() => { setReminderPickerAptId(isReminderPicking ? null : apt.id); setSelectedRemindAt(null); setCancelConfirmId(null); }} style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: apt.remind_at ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)", border: apt.remind_at ? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(255,255,255,0.08)", color: apt.remind_at ? "#fbbf24" : "#4b5563" }}>
 <Bell size={13} />
 </button>
 </div>
 )}
 </div>
 );
 };

 return (
 <div>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
 <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>Bookings ({appointments.length})</p>
 </div>
 {appointments.length === 0 ? (
 <div style={{ padding: "40px 0", textAlign: "center", color: "#374151" }}>
 <Calendar size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
 <p style={{ margin: 0, fontSize: 13 }}>No bookings yet.</p>
 <p style={{ margin: "6px 0 14px", fontSize: 12, color: "#374151" }}>Bookings appear when customers book a test drive from your listing.</p>
 <button onClick={() => setActiveTab("listings")} style={{ fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 8, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.22)", color: "#f87171", cursor: "pointer" }}>Share a Listing →</button>
 </div>
 ) : (
 <div>
 {todayApts.length > 0 && (
 <div style={{ marginBottom: 20 }}>
 <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5 }}>
 <Calendar size={11} color="#fbbf24" /> Today ({todayApts.length})
 </p>
 <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{todayApts.map(renderApptCard)}</div>
 </div>
 )}
 {upcomingApts.length > 0 && (
 <div style={{ marginBottom: 20 }}>
 <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 5 }}>
 <Calendar size={11} color="#60a5fa" /> Upcoming ({upcomingApts.length})
 </p>
 <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{upcomingApts.map(renderApptCard)}</div>
 </div>
 )}
 {pastApts.length > 0 && (
 <div style={{ marginTop: 8 }}>
 <button onClick={() => setPastOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "6px 0", width: "100%" }}>
 <span style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", letterSpacing: "0.08em", textTransform: "uppercase" }}>Past ({pastApts.length})</span>
 <span style={{ fontSize: 12, color: "#374151" }}>{pastOpen ? "▲" : "▼"}</span>
 </button>
 {pastOpen && (
 <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
 {pastApts.map(apt => {
 const car = apt.car_listings;
 const { dateStr, timeStr } = fmtAptDate(apt.appointment_date);
 const sc = statusColors[apt.status] || statusColors.pending;
 return (
 <div key={apt.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 14px", opacity: 0.65 }}>
 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
 <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{apt.buyer_name || "—"}</p>
 <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, flexShrink: 0, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.tx, textTransform: "capitalize" }}>{apt.status}</span>
 </div>
 <p style={{ margin: "0 0 2px", fontSize: 12, color: "#6b7280" }}>📅 {dateStr}{timeStr && ` · ${timeStr}`}</p>
 {car && <p style={{ margin: 0, fontSize: 11, color: "#4b5563" }}>{[car.year, car.brand, car.model].filter(Boolean).join(" ")}{apt.buyer_phone ? `  ·  📞 ${apt.buyer_phone}` : ""}</p>}
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}
 </div>
 )}
 </div>
 );
 };

 const renderEnquiries = () => {
 const newEnqCount = enquiries.filter(e => e.status === "new").length;
 const pendingAptCount = appointments.filter(a => a.status === "pending").length;
 return (
 <div>
 {/* Sub-tab switcher */}
 <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
 {[{ key: "enquiries", label: "Enquiries", badge: newEnqCount }, { key: "bookings", label: "Bookings", badge: pendingAptCount }].map(({ key, label, badge }) => (
 <button key={key} onClick={() => setInboxSubTab(key)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer", background: inboxSubTab === key ? "rgba(220,38,38,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${inboxSubTab === key ? "rgba(220,38,38,0.35)" : "rgba(255,255,255,0.08)"}`, color: inboxSubTab === key ? "#f87171" : "#6b7280", display: "flex", alignItems: "center", gap: 6 }}>
 {label}
 {badge > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: "#dc2626", color: "#fff", borderRadius: 99, padding: "0 5px", minWidth: 16, textAlign: "center" }}>{badge}</span>}
 </button>
 ))}
 </div>
 {inboxSubTab === "enquiries" ? renderEnquiriesSection() : renderBookingsSection()}
 </div>
 );
 };


 const renderAnalytics = () => {
  const Spark = ({ data, color }) => {
   if (!data || data.every(v => v === 0)) return <div style={{ height: 40 }} />;
   const max = Math.max(...data, 1);
   const w = 100, h = 40;
   const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 4 - ((v / max) * (h - 10)),
   ]);
   const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
   const area = `${line} L${w},${h} L0,${h} Z`;
   const uid = color.replace(/[^0-9a-f]/gi, "").slice(0, 6);
   return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 40, display: "block", marginTop: 10, overflow: "visible" }}>
     <defs>
      <linearGradient id={`ag${uid}`} x1="0" y1="0" x2="0" y2="1">
       <stop offset="0%" stopColor={color} stopOpacity="0.28" />
       <stop offset="100%" stopColor={color} stopOpacity="0.02" />
      </linearGradient>
     </defs>
     <path d={area} fill={`url(#ag${uid})`} />
     <path d={line} stroke={color} strokeWidth="2" fill="none" style={{ filter: `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 2px ${color})` }} />
     <circle cx={pts[pts.length - 1][0].toFixed(1)} cy={pts[pts.length - 1][1].toFixed(1)} r="2.5" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
   );
  };

  const bucket7 = (evts, type) => {
   const b = Array(7).fill(0);
   const now = Date.now();
   evts.forEach(e => {
    if (type && e.event_type !== type) return;
    const d = Math.floor((now - new Date(e.created_at).getTime()) / 86400000);
    if (d >= 0 && d < 7) b[6 - d]++;
   });
   return b;
  };

  const bucketArr7 = (arr) => {
   const b = Array(7).fill(0);
   const now = Date.now();
   (arr || []).forEach(e => {
    const d = Math.floor((now - new Date(e.created_at).getTime()) / 86400000);
    if (d >= 0 && d < 7) b[6 - d]++;
   });
   return b;
  };

  const allStats = Object.values(carStatsMap);
  const viewsD = Array.from({ length: 7 }, (_, i) =>
   allStats.reduce((s, v) => s + ((v.daily && v.daily[i]) || 0), 0)
  );
  const waD = Array(7).fill(0);
  const enqD = bucketArr7(enquiries);
  const totalViews = myClicks;
  const totalWA = myEnquiries;
  const cvr = totalViews > 0 ? ((totalWA / totalViews) * 100).toFixed(1) : "0";
  const cvrNum = Number(cvr);
  const cvrColor = cvrNum >= 10 ? "#4ade80" : cvrNum >= 5 ? "#fbbf24" : "#f87171";
  const cvrD = viewsD.map((v, i) => v > 0 ? (waD[i] / v) * 100 : 0);

  const now2 = new Date();
  const monthStart = new Date(now2.getFullYear(), now2.getMonth(), 1);
  const leadsThisMonth = leads.filter(l => l.created_at && new Date(l.created_at) >= monthStart).length;
  const apptThisMonth = appointments.filter(a => a.appointment_date && new Date(a.appointment_date) >= monthStart).length;
  const enqThisMonth = enquiries.filter(e => e.created_at && new Date(e.created_at) >= monthStart).length;
  const monthlyTarget = profile?.monthly_target || 5;
  const targetPct = Math.min(100, (thisMonthSales / monthlyTarget) * 100);
  const targetHit = thisMonthSales >= monthlyTarget;

  const cvrRows = myListings
   .map(car => {
    const s = carStatsMap[car.id] ?? {};
    const views = s.views || 0;
    const enqs = s.enquiries || 0;
    const c = views > 0 ? ((enqs / views) * 100).toFixed(1) : null;
    return { car, views, enqs, cvr: c };
   })
   .sort((a, b) => b.views - a.views);
  const top3 = cvrRows.slice(0, 3);
  const maxViews = top3.length > 0 ? top3[0].views : 1;

  const KPI = ({ label, value, data, color, sub }) => (
   <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px 12px", position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: `radial-gradient(ellipse at top left, ${color}18 0%, transparent 70%)`, pointerEvents: "none" }} />
    <p style={{ margin: 0, fontSize: 9, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>{label}</p>
    <p style={{ margin: "5px 0 0", fontSize: 34, fontFamily: "'Bebas Neue',sans-serif", color, lineHeight: 1 }}>{value}</p>
    {sub && <p style={{ margin: "2px 0 0", fontSize: 10, color: "#374151" }}>{sub}</p>}
    <Spark data={data} color={color} />
   </div>
  );

  return (
   <div>
    <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Performance Overview</p>

    {/* Sparkline KPI grid */}
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
     <KPI label="Listing Views" value={totalViews} data={viewsD} color="#93c5fd" sub="All time" />
     <KPI label="WA Taps" value={totalWA} data={waD} color="#4ade80" sub="All time" />
     <KPI label="CVR" value={`${cvr}%`} data={cvrD} color={cvrColor} sub="WA / Views" />
     <KPI label="Enquiries" value={enquiries.length} data={enqD} color="#c084fc" sub="All messages" />
     <KPI label="This Month" value={thisMonthSales} data={Array(7).fill(0)} color="#fbbf24" sub="Cars sold" />
     <KPI label="Commission" value={commission !== null ? `RM ${Number(commission).toLocaleString()}` : "—"} data={Array(7).fill(0)} color="#4ade80" sub="All time" />
    </div>

    {/* This Month KPI strip */}
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 8 : 12, marginBottom: 16 }}>
     {[
      { label: "Leads added", val: leadsThisMonth, color: "#60a5fa", Icon: Users },
      { label: "Appointments", val: apptThisMonth, color: "#c084fc", Icon: Clock },
      { label: "Enquiries", val: enqThisMonth, color: "#3b82f6", Icon: MessageSquare },
      { label: "Cars sold", val: thisMonthSales, color: "#22c55e", Icon: Car },
     ].map(({ label, val, color, Icon }) => (
      <div key={label} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "12px 14px" }}>
       <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{label}</span>
        <Icon size={13} color={color} />
       </div>
       <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color, lineHeight: 1, fontFamily: "'Bebas Neue',sans-serif" }}>{val}</p>
      </div>
     ))}
    </div>

    {/* Monthly target progress */}
    <div style={{ background: "#0d1117", border: targetHit ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
     <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
       <TrendingUp size={13} color={targetHit ? "#22c55e" : "#3b82f6"} />
       <span style={{ fontSize: 12, color: "#64748b" }}>Monthly target</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
       {targetHit && <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", borderRadius: 99, padding: "2px 8px" }}>Target hit!</span>}
       <span style={{ fontSize: 13, fontWeight: 700, color: targetHit ? "#4ade80" : "#f1f5f9" }}>{thisMonthSales} / {monthlyTarget} cars</span>
      </div>
     </div>
     <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${targetPct}%`, background: targetHit ? "#22c55e" : "#3b82f6", borderRadius: 99, transition: "width 0.4s" }} />
     </div>
    </div>

    {/* Top Listings by Views */}
    {top3.length > 0 && (
     <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
      <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>Top listings by views</p>
      {top3.map(({ car, views }, i) => {
       const barW = maxViews > 0 ? (views / maxViews) * 100 : 0;
       const barColors = ["#3b82f6", "#6366f1", "#8b5cf6"];
       return (
        <div key={car.id} style={{ marginBottom: i < top3.length - 1 ? 14 : 0 }}>
         <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 12, color: "#d1d5db" }}>{["#1", "#2", "#3"][i]} {[car.year, car.brand, car.model].filter(Boolean).join(" ")}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa" }}>{views} views</span>
         </div>
         <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${barW}%`, background: barColors[i], borderRadius: 99 }} />
         </div>
        </div>
       );
      })}
     </div>
    )}

    {/* Listing Performance CVR table */}
    {myListings.length > 0 && (
     <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
       <BarChart2 size={13} color="#4b5563" />
       <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Listing Performance</p>
       <span style={{ fontSize: 9, marginLeft: "auto", color: "#374151" }}>All time</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 50px 60px 60px", padding: "6px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
       {["Car", "Views", "Enquiries", "CVR"].map(h => (
        <p key={h} style={{ margin: 0, fontSize: 9, color: "#374151", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: h !== "Car" ? "center" : "left" }}>{h}</p>
       ))}
      </div>
      {cvrRows.map(({ car, views, enqs, cvr: c }) => {
       const cNum = c !== null ? Number(c) : null;
       const cc = cNum !== null ? (cNum >= 10 ? "#4ade80" : cNum >= 5 ? "#fbbf24" : "#f87171") : "#374151";
       return (
        <div key={car.id} style={{ display: "grid", gridTemplateColumns: "1fr 50px 60px 60px", padding: "9px 16px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
         <p style={{ margin: 0, fontSize: 11, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[car.year, car.brand, car.model].filter(Boolean).join(" ")}</p>
         <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#93c5fd", textAlign: "center" }}>{views}</p>
         <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#fbbf24", textAlign: "center" }}>{enqs}</p>
         <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: cc, textAlign: "center" }}>{c !== null ? `${c}%` : "—"}</p>
        </div>
       );
      })}
     </div>
    )}

    {/* Commission breakdown (with dates) */}
    {commissionDetails.length > 0 && (
     <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
       <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Commission Breakdown</p>
      </div>
      {commissionDetails.map((c, i) => (
       <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, padding: "10px 16px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
        <span style={{ fontSize: 12, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[c.year, c.brand, c.model].filter(Boolean).join(" ") || "—"}</span>
        <span style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
         {c.sold_at ? new Date(c.sold_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) : "—"}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#4ade80", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
         RM {Number(c.commission_amount || 0).toLocaleString("en-MY")}
        </span>
       </div>
      ))}
     </div>
    )}
   </div>
  );
 };

 // Loans 
 const BANKS = [
 { name: "Public Bank", rate: 3.20, islamic: false },
 { name: "CIMB Bank", rate: 3.25, islamic: false },
 { name: "Maybank", rate: 3.30, islamic: false },
 { name: "RHB Bank", rate: 3.50, islamic: false },
 { name: "Hong Leong Bank", rate: 3.50, islamic: false },
 { name: "Affin Bank", rate: 3.50, islamic: false },
 { name: "Bank Muamalat", rate: 3.60, islamic: true },
 { name: "Bank Islam", rate: 3.60, islamic: true },
 ];

 const fmtRM = (n) =>
 "RM " + Number(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

 const calcBank = (bank) => {
 const price = parseFloat(loanCalc.carPrice) || 0;
 const dp = parseFloat(loanCalc.downPayment) || 0;
 const tenure = parseInt(loanCalc.tenure) || 1;
 const loan = Math.max(0, price - dp);
 const interest = loan * (bank.rate / 100) * tenure;
 const monthly = loan > 0? (loan + interest) / (tenure * 12) : 0;
 return { loan, interest, total: loan + interest, monthly };
 };

 const loanInputSx = {
 background: "rgba(255,255,255,0.04)",
 border: "1px solid rgba(255,255,255,0.08)",
 borderRadius: 6,
 color: "#fff",
 padding: "8px 10px",
 fontSize: 13,
 outline: "none",
 width: "100%",
 };

 const cardSx = {
 background: "rgba(255,255,255,0.03)",
 border: "1px solid rgba(255,255,255,0.06)",
 borderRadius: 8,
 padding: 20,
 marginBottom: 20,
 };

 const statusColors = {
 Submitted: { bg: "rgba(59,130,246,.15)", border: "rgba(59,130,246,.3)", color: "#93c5fd" },
 Pending: { bg: "rgba(251,191,36,.15)", border: "rgba(251,191,36,.3)", color: "#fbbf24" },
 Approved: { bg: "rgba(34,197,94,.15)", border: "rgba(34,197,94,.3)", color: "#4ade80" },
 Declined: { bg: "rgba(239,68,68,.15)", border: "rgba(239,68,68,.3)", color: "#f87171" },
 };

 const submitLoan = async () => {
 if (!loanForm.bank_name ||!loanForm.loan_amount ||!loanForm.loan_tenure) return;
 setLoanSaving(true);
 const dealerId = getDealerIdFromProfile(profile);
 const banksPayload = loanForm.bank_name? [{
 name: loanForm.bank_name,
 rate: parseFloat(loanForm.interest_rate) || 0,
 monthly_payment: parseFloat(loanForm.monthly_payment) || 0,
 loan_amount: parseFloat(loanForm.loan_amount) || 0,
 }] : [];
 const { data, error } = await supabase.from("loan_applications").insert({
 dealer_id: dealerId,
 salesman_id: profile?.id,
 buyer_name: loanForm.buyer_name || null,
 buyer_phone: loanForm.buyer_phone || null,
 buyer_ic: loanForm.buyer_ic || null,
 buyer_employment_type: loanForm.buyer_employment_type || null,
 car_model: loanForm.car_model || null,
 car_price: loanForm.car_price? parseFloat(loanForm.car_price) : null,
 loan_amount: parseFloat(loanForm.loan_amount),
 down_payment: loanForm.down_payment? parseFloat(loanForm.down_payment) : null,
 loan_tenure: parseInt(loanForm.loan_tenure),
 banks: banksPayload,
 notes: loanForm.notes || null,
 status: "Submitted",
 }).select("*").single();
 setLoanSaving(false);
 if (!error && data) {
 setLoanApplications((prev) => [data, ...prev]);
 setLoanForm({
 buyer_name: "", buyer_phone: "", buyer_ic: "", buyer_employment_type: "Salaried",
 stock_unit_id: "", car_model: "", car_price: "",
 bank_name: "", loan_amount: "", down_payment: "",
 interest_rate: "", loan_tenure: 7, monthly_payment: "",
 buyer_income: "", notes: "",
 });
 }
 };

 const saveStatus = async (id) => {
 const updates = { status: loanEditStatus };
 await supabase.from("loan_applications").update(updates).eq("id", id);
 setLoanApplications((prev) =>
 prev.map((a) => a.id === id? { ...a, ...updates } : a)
 );
 setLoanEditId(null);
 setLoanEditStatus("");
 setLoanEditCommission("");
 };

 const deleteLoan = async (id) => {
 if (!window.confirm("Delete this loan application?")) return;
 await supabase.from("loan_applications").delete().eq("id", id);
 setLoanApplications((prev) => prev.filter((a) => a.id!== id));
 };

 const selectBank = (bank) => {
 const { loan, interest, monthly } = calcBank(bank);
 setLoanForm((f) => ({
 ...f,
 bank_name: bank.name,
 loan_amount: String(Math.round(loan)),
 down_payment: loanCalc.downPayment || f.down_payment,
 car_price: loanCalc.carPrice || f.car_price,
 interest_rate: String(bank.rate),
 loan_tenure: loanCalc.tenure,
 monthly_payment: monthly.toFixed(2),
 buyer_income: loanCalc.income || f.buyer_income,
 }));
 setTimeout(() => {
 document.getElementById("loan-form-section")?.scrollIntoView({ behavior: "smooth" });
 }, 100);
 };

 // recalc monthly when form fields change
 const recalcLoanForm = (next) => {
 const loan = parseFloat(next.loan_amount) || 0;
 const rate = parseFloat(next.interest_rate) || 0;
 const tenure = parseInt(next.loan_tenure) || 1;
 const interest = loan * (rate / 100) * tenure;
 const monthly = loan > 0? ((loan + interest) / (tenure * 12)).toFixed(2) : "";
 setLoanForm({ ...next, monthly_payment: monthly });
 };

 const calcRows = BANKS.map((b) => ({ ...b, ...calcBank(b) }));
 const lowestMonthly = Math.min(...calcRows.map((r) => r.monthly).filter(Boolean));
 const dpPct = loanCalc.carPrice
? ((parseFloat(loanCalc.downPayment) || 0) / parseFloat(loanCalc.carPrice) * 100).toFixed(1)
 : null;

 const renderLoans = () => (
 <div style={{ maxWidth: 900 }}>
 <div style={{ marginBottom: 20 }}>
 <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>
 <Banknote size={18} style={{ marginRight: 8, verticalAlign: "middle", color: "#dc2626" }} />Loan Management
 </h2>
 <p style={{ margin: "4px 0 0", fontSize: 12, color: "#4b5563" }}>Compare banks, submit applications, track approvals.
 </p>
 </div>

 {/* Section 1: Calculator */}
 <div style={cardSx}>
 <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>Loan Comparison Calculator
 </p>
 <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Car Price (RM)</label>
 <input type="number" placeholder="e.g. 85000" style={loanInputSx}
 value={loanCalc.carPrice}
 onChange={(e) => setLoanCalc((c) => ({ ...c, carPrice: e.target.value }))} />
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Down Payment (RM){dpPct? <span style={{ color: "#4b5563" }}> · {dpPct}%</span> : null}
 </label>
 <input type="number" placeholder="e.g. 10000" style={loanInputSx}
 value={loanCalc.downPayment}
 onChange={(e) => setLoanCalc((c) => ({ ...c, downPayment: e.target.value }))} />
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Loan Tenure</label>
 <select style={loanInputSx} value={loanCalc.tenure}
 onChange={(e) => setLoanCalc((c) => ({ ...c, tenure: parseInt(e.target.value) }))}>
 {[1,2,3,4,5,6,7].map((y) => (
 <option key={y} value={y}>{y} year{y > 1? "s" : ""}</option>
 ))}
 </select>
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Buyer Monthly Income (RM) <span style={{ color: "#374151" }}>optional</span></label>
 <input type="number" placeholder="e.g. 5000" style={loanInputSx}
 value={loanCalc.income}
 onChange={(e) => setLoanCalc((c) => ({ ...c, income: e.target.value }))} />
 </div>
 </div>

 {/* Comparison table */}
 <div style={{ overflowX: "auto" }}>
 <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
 <thead>
 <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
 {["Bank", "Rate", "Monthly Payment", "Total Interest", "Total Payable", ""].map((h) => (
 <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#6b7280", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {calcRows.map((row) => {
 const isBest = row.monthly > 0 && row.monthly === lowestMonthly;
 return (
 <tr key={row.name}
 style={{
 borderBottom: "1px solid rgba(255,255,255,0.04)",
 borderLeft: isBest? "3px solid #22c55e" : "3px solid transparent",
 background: isBest? "rgba(34,197,94,.04)" : "transparent",
 transition: "background .15s",
 }}
 onMouseEnter={(e) => { e.currentTarget.style.background = isBest? "rgba(34,197,94,.08)" : "rgba(255,255,255,.02)"; }}
 onMouseLeave={(e) => { e.currentTarget.style.background = isBest? "rgba(34,197,94,.04)" : "transparent"; }}
 >
 <td style={{ padding: "10px 10px", color: "#e5e7eb", fontWeight: 500 }}>
 {row.name}
 {row.islamic && <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", background: "rgba(251,191,36,.1)", border: "1px solid rgba(251,191,36,.25)", color: "#fbbf24", borderRadius: 99 }}>Islamic</span>}
 {isBest && <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)", color: "#4ade80", borderRadius: 99 }}>Best</span>}
 </td>
 <td style={{ padding: "10px 10px", color: "#9ca3af" }}>{row.rate.toFixed(2)}%</td>
 <td style={{ padding: "10px 10px", color: "#fff", fontWeight: 600, fontFamily: "'Bebas Neue', sans-serif", fontSize: 15 }}>
 {row.monthly > 0? fmtRM(row.monthly) : "—"}
 </td>
 <td style={{ padding: "10px 10px", color: "#9ca3af" }}>{row.interest > 0? fmtRM(row.interest) : "—"}</td>
 <td style={{ padding: "10px 10px", color: "#9ca3af" }}>{row.total > 0? fmtRM(row.total) : "—"}</td>
 <td style={{ padding: "10px 10px" }}>
 <button
 onClick={() => selectBank(row)}
 style={{ background: "rgba(220,38,38,.15)", border: "1px solid rgba(220,38,38,.3)", color: "#f87171", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}
 >Select
 </button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>

 {/* Section 2: Submission Form */}
 <div id="loan-form-section" style={cardSx}>
 <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>Submit Loan Application
 </p>

 {/* Buyer info */}
 <p style={{ margin: "0 0 8px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>Buyer Details</p>
 <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Full Name</label>
 <input type="text" placeholder="e.g. Ahmad bin Ali" style={loanInputSx}
 value={loanForm.buyer_name}
 onChange={(e) => setLoanForm((f) => ({ ...f, buyer_name: e.target.value }))} />
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Phone</label>
 <div style={{ display:"flex", alignItems:"center", ...loanInputSx, padding:0, overflow:"hidden" }}>
 <span style={{ padding:"8px 10px", color:"#6b7280", background:"rgba(255,255,255,0.03)", borderRight:"1px solid rgba(255,255,255,0.08)", fontSize:13, whiteSpace:"nowrap", flexShrink:0 }}>+60</span>
 <input type="tel" placeholder="123456789"
 value={(loanForm.buyer_phone||'').replace(/^\+?60/,'')}
 onChange={(e) => setLoanForm((f) => ({ ...f, buyer_phone: '+60'+e.target.value.replace(/\D/g,'') }))}
 style={{ flex:1, background:"transparent", border:"none", outline:"none", color:"#fff", fontSize:13, padding:"8px 10px", fontFamily:"inherit" }} />
 </div>
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>IC Number</label>
 <input type="text" placeholder="e.g. 901231-10-1234" style={loanInputSx}
 value={loanForm.buyer_ic}
 onChange={(e) => setLoanForm((f) => ({ ...f, buyer_ic: e.target.value }))} />
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Employment Type</label>
 <select style={loanInputSx} value={loanForm.buyer_employment_type}
 onChange={(e) => setLoanForm((f) => ({ ...f, buyer_employment_type: e.target.value }))}>
 {["Salaried","Self-Employed","Government","Part-Time","Retired"].map((t) => (
 <option key={t} value={t}>{t}</option>
 ))}
 </select>
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Monthly Income (RM)</label>
 <input type="number" placeholder="e.g. 5000" style={loanInputSx}
 value={loanForm.buyer_income}
 onChange={(e) => setLoanForm((f) => ({ ...f, buyer_income: e.target.value }))} />
 </div>
 </div>

 {/* Car info */}
 <p style={{ margin: "0 0 8px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>Car Details</p>
 <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Car (from Stock)</label>
 <select style={loanInputSx} value={loanForm.stock_unit_id}
 onChange={(e) => {
 const u = loanStockUnits.find((x) => x.id === e.target.value);
 setLoanForm((f) => ({
 ...f,
 stock_unit_id: e.target.value,
 car_model: u? `${u.brand} ${u.model} ${u.year}` : f.car_model,
 car_price: u?.asking_price? String(u.asking_price) : f.car_price,
 }));
 }}>
 <option value="">— Select from stock —</option>
 {loanStockUnits.map((u) => (
 <option key={u.id} value={u.id}>{u.brand} {u.model} {u.year}{u.registration_number? ` · ${u.registration_number}` : ""}</option>
 ))}
 </select>
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Car Model (or type manually)</label>
 <input type="text" placeholder="e.g. Toyota Vios 2020" style={loanInputSx}
 value={loanForm.car_model}
 onChange={(e) => setLoanForm((f) => ({ ...f, car_model: e.target.value }))} />
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Car Price (RM)</label>
 <input type="number" placeholder="e.g. 85000" style={loanInputSx}
 value={loanForm.car_price}
 onChange={(e) => setLoanForm((f) => ({ ...f, car_price: e.target.value }))} />
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Down Payment (RM)</label>
 <input type="number" placeholder="e.g. 10000" style={loanInputSx}
 value={loanForm.down_payment}
 onChange={(e) => setLoanForm((f) => ({ ...f, down_payment: e.target.value }))} />
 </div>
 </div>

 {/* Loan info */}
 <p style={{ margin: "0 0 8px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>Loan Details</p>
 <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Selected Bank</label>
 <select style={loanInputSx} value={loanForm.bank_name}
 onChange={(e) => {
 const b = BANKS.find((x) => x.name === e.target.value);
 recalcLoanForm({ ...loanForm, bank_name: e.target.value, interest_rate: b? String(b.rate) : loanForm.interest_rate });
 }}>
 <option value="">— Select Bank —</option>
 {BANKS.map((b) => (
 <option key={b.name} value={b.name}>{b.name} ({b.rate}%{b.islamic? " · Islamic" : ""})</option>
 ))}
 </select>
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Loan Amount (RM)</label>
 <input type="number" placeholder="e.g. 75000" style={loanInputSx}
 value={loanForm.loan_amount}
 onChange={(e) => recalcLoanForm({ ...loanForm, loan_amount: e.target.value })} />
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Interest Rate (%)</label>
 <input type="number" step="0.01" placeholder="e.g. 3.25" style={loanInputSx}
 value={loanForm.interest_rate}
 onChange={(e) => recalcLoanForm({ ...loanForm, interest_rate: e.target.value })} />
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Tenure (years)</label>
 <select style={loanInputSx} value={loanForm.loan_tenure}
 onChange={(e) => recalcLoanForm({ ...loanForm, loan_tenure: e.target.value })}>
 {[1,2,3,4,5,6,7].map((y) => (
 <option key={y} value={y}>{y}</option>
 ))}
 </select>
 </div>
 <div>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Monthly Payment (RM)</label>
 <input type="text" readOnly style={{ ...loanInputSx, background: "rgba(255,255,255,.02)", color: "#4ade80", fontFamily: "'Bebas Neue',sans-serif", fontSize: 15 }}
 value={loanForm.monthly_payment? fmtRM(loanForm.monthly_payment) : ""} />
 </div>
 <div style={{ gridColumn: "1 / -1" }}>
 <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Notes</label>
 <textarea placeholder="e.g. Buyer prefers Islamic financing" rows={2}
 style={{ ...loanInputSx, resize: "vertical" }}
 value={loanForm.notes}
 onChange={(e) => setLoanForm((f) => ({ ...f, notes: e.target.value }))} />
 </div>
 </div>
 <button
 onClick={submitLoan}
 disabled={loanSaving ||!loanForm.bank_name ||!loanForm.loan_amount}
 style={{
 marginTop: 16, background: loanSaving? "#374151" : "#dc2626",
 border: "none", borderRadius: 7, color: "#fff", padding: "10px 24px",
 fontSize: 13, fontWeight: 600, cursor: loanSaving? "not-allowed" : "pointer",
 display: "flex", alignItems: "center", gap: 8,
 }}
 >
 <Send size={14} />
 {loanSaving? "Submitting…" : "Submit Application"}
 </button>
 </div>

 {/* Section 3: My Applications */}
 <div style={cardSx}>
 <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>My Loan Applications ({loanApplications.length})
 </p>
 {loanApplications.length === 0? (
 <p style={{ color: "#374151", fontSize: 13, textAlign: "center", padding: "32px 0" }}>No applications yet.</p>
 ) : (
 <div style={{ overflowX: "auto" }}>
 <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
 <thead>
 <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
 {["Buyer", "Car", "Bank", "Loan Amt", "Monthly", "Status", "Date", ""].map((h) => (
 <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#6b7280", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {loanApplications.map((app) => {
 const sc = statusColors[app.status] || statusColors.Submitted;
 const isEditing = loanEditId === app.id;
 const bankEntry = Array.isArray(app.banks) && app.banks[0];
 const monthlyDisplay = bankEntry?.monthly_payment || 0;
 return (
 <tr key={app.id}
 style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
 onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.02)"; }}
 onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
 >
 <td style={{ padding: "10px 10px", color: "#e5e7eb", fontWeight: 500 }}>
 {app.buyer_name || "—"}<br />
 <span style={{ color: "#4b5563", fontSize: 11 }}>{app.buyer_phone || ""}</span>
 </td>
 <td style={{ padding: "10px 10px", color: "#9ca3af" }}>{app.car_model || "—"}</td>
 <td style={{ padding: "10px 10px", color: "#9ca3af", whiteSpace: "nowrap" }}>
 {bankEntry?.name || "—"}
 {bankEntry?.rate? <span style={{ color: "#4b5563" }}> {bankEntry.rate}%</span> : null}
 </td>
 <td style={{ padding: "10px 10px", color: "#fff", fontFamily: "'Bebas Neue',sans-serif", fontSize: 14 }}>{app.loan_amount? fmtRM(app.loan_amount) : "—"}</td>
 <td style={{ padding: "10px 10px", color: "#4ade80", fontFamily: "'Bebas Neue',sans-serif", fontSize: 14 }}>{monthlyDisplay? fmtRM(monthlyDisplay) : "—"}</td>
 <td style={{ padding: "10px 10px" }}>
 {isEditing? (
 <select style={{ ...loanInputSx, width: 110, fontSize: 11 }}
 value={loanEditStatus}
 onChange={(e) => setLoanEditStatus(e.target.value)}>
 {["Submitted","Pending","Approved","Declined"].map((s) => (
 <option key={s} value={s}>{s}</option>
 ))}
 </select>
 ) : (
 <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color }}>
 {app.status}
 </span>
 )}
 </td>
 <td style={{ padding: "10px 10px", color: "#4b5563", whiteSpace: "nowrap" }}>
 {new Date(app.created_at).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "2-digit" })}
 </td>
 <td style={{ padding: "10px 10px" }}>
 <div style={{ display: "flex", gap: 6 }}>
 {isEditing? (
 <>
 <button onClick={() => saveStatus(app.id)}
 style={{ background: "rgba(34,197,94,.15)", border: "1px solid rgba(34,197,94,.3)", color: "#4ade80", borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>Save
 </button>
 <button onClick={() => { setLoanEditId(null); setLoanEditStatus(""); setLoanEditCommission(""); }}
 style={{ background: "transparent", border: "1px solid rgba(255,255,255,.1)", color: "#6b7280", borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>Cancel
 </button>
 </>
 ) : (
 <>
 <button onClick={() => { setLoanEditId(app.id); setLoanEditStatus(app.status); setLoanEditCommission(""); }}
 style={{ background: "transparent", border: "1px solid rgba(255,255,255,.1)", color: "#9ca3af", borderRadius: 5, padding: "4px 7px", cursor: "pointer" }}>
 <Pencil size={11} />
 </button>
 <button onClick={() => deleteLoan(app.id)}
 style={{ background: "transparent", border: "1px solid rgba(239,68,68,.2)", color: "#f87171", borderRadius: 5, padding: "4px 7px", cursor: "pointer" }}>
 <Trash2 size={11} />
 </button>
 </>
 )}
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </div>
 );

 const renderSettings = () => {
 const inputStyle = {
 width: '100%', background: '#0d1117',
 border: '1px solid rgba(255,255,255,0.1)',
 borderRadius: 8, padding: '9px 12px',
 fontSize: 13, color: '#e5e7eb', outline: 'none',
 fontFamily: 'inherit', boxSizing: 'border-box',
 };
 const labelStyle = {
 display: 'block', fontSize: 11, fontWeight: 600,
 color: '#9ca3af', textTransform: 'uppercase',
 letterSpacing: '0.08em', marginBottom: 6,
 };
 const cardStyle = {
 background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)',
 borderRadius: 12, padding: '20px 24px', marginBottom: 16,
 };
 const sectionLabel = {
 fontSize: 11, fontWeight: 700, color: '#374151',
 textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18, margin: '0 0 18px',
 };

 const handleSave = async () => {
 if (!profile?.id) return;
 setSettingsSaving(true);
 setSettingsError(null);
 const { error } = await supabase.from('profiles').update({
 full_name: profileSettings.full_name,
 job_title: profileSettings.job_title,
 whatsapp_number: profileSettings.whatsapp_number,
 city: profileSettings.city,
 state: profileSettings.state,
 about_text: profileSettings.about_text,
 bio: profileSettings.bio || null,
 response_time: profileSettings.response_time || null,
 specializations: profileSettings.specializations.length > 0? profileSettings.specializations : null,
 }).eq('id', profile.id);
 setSettingsSaving(false);
 if (error) {
 setSettingsError('Failed to save. Please try again.');
 } else {
 setProfile(prev => ({ ...prev, ...profileSettings }));
 setSettingsSaved(true);
 setTimeout(() => setSettingsSaved(false), 3000);
 }
 };

 const removeTag = (i) =>
 setProfileSettings(p => ({ ...p, specializations: p.specializations.filter((_, j) => j!== i) }));

 const handleTagKeyDown = (e) => {
 if (e.key === 'Enter' && tagInput.trim()) {
 e.preventDefault();
 const val = tagInput.trim();
 if (!profileSettings.specializations.includes(val)) {
 setProfileSettings(p => ({ ...p, specializations: [...p.specializations, val] }));
 }
 setTagInput('');
 }
 };

 return (
 <div style={{ maxWidth: 560 }}>
 <div style={{ marginBottom: 24 }}>
 <p style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>Profile Settings</p>
 <p style={{ fontSize: 12, color: '#4b5563', margin: 0 }}>Changes appear on your public XDrive profile page.</p>
 </div>

 <div style={cardStyle}>
 <p style={sectionLabel}>Identity</p>
 <div style={{ display: 'grid', gap: 14 }}>
 <div>
 <label style={labelStyle}>Full Name</label>
 <input type="text" value={profileSettings.full_name}
 onChange={e => setProfileSettings(p => ({ ...p, full_name: e.target.value }))}
 placeholder="Your full name" style={inputStyle} />
 </div>
 <div>
 <label style={labelStyle}>Job Title</label>
 <input type="text" value={profileSettings.job_title}
 onChange={e => setProfileSettings(p => ({ ...p, job_title: e.target.value }))}
 placeholder="e.g. Senior Sales Consultant" style={inputStyle} />
 </div>
 </div>
 </div>

 <div style={cardStyle}>
 <p style={sectionLabel}>Contact & Location</p>
 <div style={{ display: 'grid', gap: 14 }}>
 <div>
 <label style={labelStyle}>WhatsApp Number</label>
 <input type="text" value={profileSettings.whatsapp_number}
 onChange={e => setProfileSettings(p => ({ ...p, whatsapp_number: e.target.value }))}
 placeholder="e.g. 60123456789" style={inputStyle} />
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
 <div>
 <label style={labelStyle}>City</label>
 <input type="text" value={profileSettings.city}
 onChange={e => setProfileSettings(p => ({ ...p, city: e.target.value }))}
 placeholder="e.g. Petaling Jaya" style={inputStyle} />
 </div>
 <div>
 <label style={labelStyle}>State</label>
 <input type="text" value={profileSettings.state}
 onChange={e => setProfileSettings(p => ({ ...p, state: e.target.value }))}
 placeholder="e.g. Selangor" style={inputStyle} />
 </div>
 </div>
 </div>
 </div>

 <div style={cardStyle}>
 <p style={sectionLabel}>Public Profile</p>
 <div style={{ display: 'grid', gap: 14 }}>
 <div>
 <label style={labelStyle}>About</label>
 <textarea value={profileSettings.about_text}
 onChange={e => setProfileSettings(p => ({ ...p, about_text: e.target.value }))}
 placeholder="A short description shown on your public page"
 rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
 </div>
 <div>
 <label style={labelStyle}>Bio</label>
 <textarea value={profileSettings.bio}
 onChange={e => setProfileSettings(p => ({ ...p, bio: e.target.value }))}
 placeholder="e.g. Specializing in Perodua & Honda, 5 years experience in Klang Valley"
 rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
 <p style={{ margin: '5px 0 0', fontSize: 11, color: '#374151' }}>Shown below your name on your public page, with a "Read more" toggle.
 </p>
 </div>
 <div>
 <label style={labelStyle}>Response Time</label>
 <input type="text" value={profileSettings.response_time}
 onChange={e => setProfileSettings(p => ({ ...p, response_time: e.target.value }))}
 placeholder="e.g. Usually replies within 1 hour" style={inputStyle} />
 </div>
 <div>
 <label style={labelStyle}>Specializations</label>
 {profileSettings.specializations.length > 0 && (
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
 {profileSettings.specializations.map((tag, i) => (
 <span key={i} style={{
 display: 'inline-flex', alignItems: 'center', gap: 5,
 background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)',
 color: '#fca5a5', borderRadius: 99, padding: '3px 10px',
 fontSize: 11, fontWeight: 600,
 }}>
 {tag}
 <button onClick={() => removeTag(i)} style={{
 background: 'none', border: 'none', color: 'inherit',
 cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.7,
 }}>
 <X size={10} />
 </button>
 </span>
 ))}
 </div>
 )}
 <input type="text" value={tagInput}
 onChange={e => setTagInput(e.target.value)}
 onKeyDown={handleTagKeyDown}
 placeholder="Type a specialization and press Enter"
 style={inputStyle} />
 <p style={{ margin: '5px 0 0', fontSize: 11, color: '#374151' }}>Press Enter to add each tag. Shown as pills on your public profile.
 </p>
 </div>
 </div>
 </div>

 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 <button onClick={handleSave} disabled={settingsSaving} style={{
 background: '#2563eb', border: 'none', borderRadius: 8,
 padding: '10px 22px', fontSize: 13, fontWeight: 600, color: '#fff',
 cursor: settingsSaving? 'not-allowed' : 'pointer',
 opacity: settingsSaving? 0.6 : 1,
 }}>
 {settingsSaving? 'Saving…' : 'Save Changes'}
 </button>
 {settingsSaved && (
 <span style={{ fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
 <CheckCircle2 size={14} />Saved
 </span>
 )}
 {settingsError && (
 <span style={{ fontSize: 12, color: '#f87171' }}>{settingsError}</span>
 )}
 </div>
 </div>
 );
 };

 const renderTeam = () => (
 <div
 style={{
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 height: 300,
 }}
 >
 <div style={{ textAlign: "center" }}>
 <Users size={32} color="#374151" style={{ marginBottom: 12 }} />
 <p
 style={{ margin: 0, fontSize: 14, color: "#4b5563", fontWeight: 500 }}
 >Team view coming soon
 </p>
 <p style={{ margin: "6px 0 0", fontSize: 12, color: "#374151" }}>See your team's performance here.
 </p>
 </div>
 </div>
 );

 return (
 <>
 <SuspendedBanner />
 <div
 style={{
 display: "flex",
 flexDirection: isMobile? "column" : "row",
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
 .lead-score-wrap:hover .lead-score-tip { display: block!important; }
 @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
 @keyframes hotpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.5)} }
 .caption-skeleton { background: linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%); background-size:800px 100%; animation:shimmer 1.4s infinite linear; border-radius:8px; }
 .hot-dot { animation: hotpulse 1.5s ease-in-out infinite; }
 `}</style>

 {/* Sidenav (desktop) / Bottom nav (mobile) */}
 {isMobile? (
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
 flexDirection: "row",
 }}
 >
 {[
 {
 tab: "dashboard",
 label: "Dashboard",
 icon: <LayoutGrid size={18} />,
 badge: null,
 },
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
 badge: null,
 },
 {
 tab: "analytics",
 label: "Analytics",
 icon: <TrendingUp size={18} />,
 badge: null,
 },
 {
 tab: "enquiries",
 label: "Enquiries",
 icon: <MessageSquare size={18} />,
 badge: (enquiries.filter((e) => e.status === "new").length + appointments.filter(a => a.status === "pending").length) || null,
 },
 {
 tab: "loans",
 label: "Loans",
 icon: <Banknote size={18} />,
 badge: null,
 },
 {
 tab: "team",
 label: "Team",
 icon: <Users size={18} />,
 badge: null,
 },
 {
 tab: "settings",
 label: "Settings",
 icon: <Settings size={18} />,
 badge: null,
 },
 ].map(({ tab, label, icon, badge }) => {
 const isActive = activeTab === tab;
 return (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
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
 color: isActive? "#93c5fd" : "#4b5563",
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
 background: "#3b82f6",
 }}
 />
 )}
 <div style={{ position: "relative" }}>
 {icon}
 {badge? (
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
 style={{ fontSize: 9, color: "#93c5fd", lineHeight: 1 }}
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
 overflow: "hidden",
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
 · My Panel
 </p>
 </div>
 </div>

 {/* MAIN section */}
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
 {[
 {
 tab: "dashboard",
 label: "Dashboard",
 icon: (
 <LayoutGrid style={{ width: 14, height: 14, flexShrink: 0 }} />
 ),
 badge: null,
 },
 {
 tab: "listings",
 label: "Listings",
 icon: <Car style={{ width: 14, height: 14, flexShrink: 0 }} />,
 badge: myListings.length || null,
 },
 ].map(({ tab, label, icon, badge }) => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 style={{
 display: "flex",
 alignItems: "center",
 gap: 10,
 padding: "8px 16px",
 margin: "1px 8px",
 borderRadius: 8,
 cursor: "pointer",
 position: "relative",
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

 {/* CRM section */}
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
 >CRM
 </p>
 {[
 {
 tab: "leads",
 label: "Leads",
 icon: <User style={{ width: 14, height: 14, flexShrink: 0 }} />,
 badge: null,
 },
 {
 tab: "analytics",
 label: "Analytics",
 icon: (
 <TrendingUp style={{ width: 14, height: 14, flexShrink: 0 }} />
 ),
 badge: null,
 },
 {
 tab: "enquiries",
 label: "Enquiries",
 icon: (
 <MessageSquare
 style={{ width: 14, height: 14, flexShrink: 0 }}
 />
 ),
 badge: (enquiries.filter((e) => e.status === "new").length + appointments.filter(a => a.status === "pending").length) || null,
 },
 {
 tab: "loans",
 label: "Loans",
 icon: <Banknote style={{ width: 14, height: 14, flexShrink: 0 }} />,
 badge: null,
 },
 ].map(({ tab, label, icon, badge }) => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 style={{
 display: "flex",
 alignItems: "center",
 gap: 10,
 padding: "8px 16px",
 margin: "1px 8px",
 borderRadius: 8,
 cursor: "pointer",
 position: "relative",
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

 {/* TEAM section */}
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
 >Team
 </p>
 {[
 {
 tab: "team",
 label: "Team",
 icon: <Users style={{ width: 14, height: 14, flexShrink: 0 }} />,
 },
 ].map(({ tab, label, icon }) => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 style={{
 display: "flex",
 alignItems: "center",
 gap: 10,
 padding: "8px 16px",
 margin: "1px 8px",
 borderRadius: 8,
 cursor: "pointer",
 position: "relative",
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
 <span>{label}</span>
 </button>
 ))}

 {/* SETTINGS section */}
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
 >Account
 </p>
 {[
 {
 tab: "settings",
 label: "Settings",
 icon: <Settings style={{ width: 14, height: 14, flexShrink: 0 }} />,
 },
 ].map(({ tab, label, icon }) => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 style={{
 display: "flex",
 alignItems: "center",
 gap: 10,
 padding: "8px 16px",
 margin: "1px 8px",
 borderRadius: 8,
 cursor: "pointer",
 position: "relative",
 background: activeTab === tab? "rgba(37,99,235,0.15)" : "transparent",
 border: activeTab === tab? "0.5px solid rgba(37,99,235,0.25)" : "0.5px solid transparent",
 color: activeTab === tab? "#93c5fd" : "#6b7280",
 fontSize: 13,
 fontWeight: 500,
 width: "calc(100% - 16px)",
 textAlign: "left",
 }}
 >
 {icon}
 <span>{label}</span>
 </button>
 ))}

 {/* Bottom profile */}
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
 <p
 style={{
 fontSize: 10,
 color: "#4b5563",
 margin: 0,
 textTransform: "capitalize",
 }}
 >
 {profile?.role || "salesman"}
 </p>
 </div>
 </div>
 </nav>
 )}

 {/* Right content pane */}
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
 {/* Sticky topbar */}
 <div
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
 }}
 >
 {isMobile? (
 <>
 <div
 style={{
 flex: 1,
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
 </div>
 <button
 onClick={() => setNotifOpen((v) =>!v)}
 style={{
 position: "relative",
 background:
 unreadCount > 0
? "rgba(59,130,246,0.1)"
 : "rgba(255,255,255,0.06)",
 border:
 unreadCount > 0
? "1px solid rgba(59,130,246,0.3)"
 : "1px solid rgba(255,255,255,0.08)",
 borderRadius: 8,
 color: unreadCount > 0? "#93c5fd" : "#94a3b8",
 padding: "8px 10px",
 cursor: "pointer",
 display: "flex",
 alignItems: "center",
 }}
 >
 <Bell size={16} />
 {unreadCount > 0 && (
 <span
 style={{
 position: "absolute",
 top: -4,
 right: -4,
 background: "#ef4444",
 color: "#fff",
 fontSize: 9,
 fontWeight: 800,
 borderRadius: "50%",
 width: 15,
 height: 15,
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 border: "2px solid #05070e",
 }}
 >
 {unreadCount > 9? "9+" : unreadCount}
 </span>
 )}
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
 })}
 {profile?.dealership? ` · ${profile.dealership}` : ""}
 </p>
 </div>
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
 <button
 onClick={() => setNotifOpen((v) =>!v)}
 style={{
 position: "relative",
 background:
 unreadCount > 0
? "rgba(59,130,246,0.1)"
 : "rgba(255,255,255,0.06)",
 border:
 unreadCount > 0
? "1px solid rgba(59,130,246,0.3)"
 : "1px solid rgba(255,255,255,0.08)",
 borderRadius: 8,
 color: unreadCount > 0? "#93c5fd" : "#94a3b8",
 padding: "8px 10px",
 cursor: "pointer",
 display: "flex",
 alignItems: "center",
 }}
 >
 <Bell size={16} />
 {unreadCount > 0 && (
 <span
 style={{
 position: "absolute",
 top: -4,
 right: -4,
 background: "#ef4444",
 color: "#fff",
 fontSize: 9,
 fontWeight: 800,
 borderRadius: "50%",
 width: 15,
 height: 15,
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 border: "2px solid #05070e",
 }}
 >
 {unreadCount > 9? "9+" : unreadCount}
 </span>
 )}
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
 )}
 </div>

 {/* Mobile greeting banner */}
 {isMobile && (
 <div
 style={{
 padding: "12px 16px",
 background: "rgba(255,255,255,0.02)",
 borderBottom: "1px solid rgba(255,255,255,0.05)",
 }}
 >
 <p
 style={{
 margin: 0,
 fontSize: 14,
 fontWeight: 500,
 color: "#f1f5f9",
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
 <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
 {new Date().toLocaleDateString("en-MY", {
 weekday: "long",
 day: "numeric",
 month: "long",
 })}
 {profile?.dealership? ` · ${profile.dealership}` : ""}
 </p>
 </div>
 )}

 {/* Scrollable content */}
 <div
 style={{
 padding: isMobile? "16px 12px" : 24,
 flex: 1,
 paddingBottom: isMobile? 80 : 24,
 }}
 >
 {activeTab === "dashboard" && renderDashboard()}
 {activeTab === "listings" && renderListings()}
 {activeTab === "leads" && renderLeads()}
 {activeTab === "analytics" && renderAnalytics()}
 {activeTab === "enquiries" && renderEnquiries()}
 {activeTab === "loans" && renderLoans()}
 {activeTab === "team" && renderTeam()}
 {activeTab === "settings" && renderSettings()}
 </div>
 </div>

 {renderCarDetailPopup()}

 {/* FAB — mobile only */}
 {isMobile && (
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

 {/* Add Lead modal */}
 {showAddLead && (
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
 <div
 style={{ display: "flex", flexDirection: "column", gap: 14 }}
 >
 <div>
 <label
 style={{
 fontSize: 11,
 color: "#6b7280",
 display: "block",
 marginBottom: 6,
 }}
 >Name
 </label>
 <input
 value={addLeadForm.buyer_name}
 onChange={(e) =>
 setAddLeadForm((p) => ({
 ...p,
 buyer_name: e.target.value,
 }))
 }
 placeholder="Buyer name"
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
 }}
 />
 </div>
 <div>
 <label
 style={{
 fontSize: 11,
 color: "#6b7280",
 display: "block",
 marginBottom: 6,
 }}
 >Phone
 </label>
 <div style={{ display:"flex", alignItems:"center", width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, overflow:"hidden" }}>
 <span style={{ padding:"9px 12px", color:"#6b7280", background:"rgba(255,255,255,0.03)", borderRight:"1px solid rgba(255,255,255,0.08)", fontSize:13, whiteSpace:"nowrap", flexShrink:0 }}>+60</span>
 <input
 type="tel"
 value={(addLeadForm.phone||'').replace(/^\+?60/,'')}
 onChange={(e) => setAddLeadForm((p) => ({ ...p, phone: '+60'+e.target.value.replace(/\D/g,'') }))}
 placeholder="123456789"
 style={{
 flex: 1,
 background: "transparent",
 border: "none",
 color: "#e5e7eb",
 fontSize: 13,
 padding: "9px 12px",
 outline: "none",
 boxSizing: "border-box",
 }}
 />
 </div>
 </div>
 <div>
 <label
 style={{
 fontSize: 11,
 color: "#6b7280",
 display: "block",
 marginBottom: 6,
 }}
 >Car (optional)
 </label>
 <select
 value={addLeadForm.car_listing_id}
 onChange={(e) =>
 setAddLeadForm((p) => ({
 ...p,
 car_listing_id: e.target.value,
 }))
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
 }}
 >
 <option value="">— no car selected —</option>
 {myListings.map((c) => (
 <option key={c.id} value={c.id}>
 {c.year} {c.brand} {c.model}
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
 >Notes
 </label>
 <textarea
 value={addLeadForm.notes}
 onChange={(e) =>
 setAddLeadForm((p) => ({ ...p, notes: e.target.value }))
 }
 placeholder="Any notes..."
 rows={3}
 style={{
 width: "100%",
 background: "rgba(255,255,255,0.04)",
 border: "1px solid rgba(255,255,255,0.1)",
 borderRadius: 8,
 color: "#e5e7eb",
 fontSize: 13,
 padding: "9px 12px",
 outline: "none",
 resize: "vertical",
 fontFamily: "inherit",
 boxSizing: "border-box",
 }}
 />
 </div>
 <button
 onClick={handleAddLead}
 disabled={addLeadSaving ||!addLeadForm.buyer_name}
 style={{
 width: "100%",
 padding: "11px 0",
 borderRadius: 10,
 fontSize: 13,
 fontWeight: 600,
 background:
 addLeadSaving ||!addLeadForm.buyer_name
? "rgba(255,255,255,0.05)"
 : "#1d4ed8",
 border: "none",
 color:
 addLeadSaving ||!addLeadForm.buyer_name
? "#6b7280"
 : "#fff",
 cursor:
 addLeadSaving ||!addLeadForm.buyer_name
? "not-allowed"
 : "pointer",
 }}
 >
 {addLeadSaving? "Saving..." : "Add Lead"}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Notification panel */}
 {notifOpen && (
 <>
 <div
 onClick={() => setNotifOpen(false)}
 style={{ position: "fixed", inset: 0, zIndex: 45 }}
 />
 <div
 style={{
 position: "fixed",
 top: isMobile? 52 : 60,
 right: isMobile? 8 : 16,
 zIndex: 46,
 width: isMobile? "calc(100vw - 16px)" : 320,
 maxHeight: 420,
 display: "flex",
 flexDirection: "column",
 background: "#0d1117",
 border: "1px solid rgba(255,255,255,0.08)",
 borderRadius: 12,
 boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
 overflow: "hidden",
 }}
 >
 <div
 style={{
 display: "flex",
 alignItems: "center",
 justifyContent: "space-between",
 padding: "12px 16px",
 borderBottom: "1px solid rgba(255,255,255,0.06)",
 flexShrink: 0,
 }}
 >
 <span style={{ fontSize: 13, fontWeight: 600, color: "#f3f4f6" }}>Notifications
 </span>
 <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
 {unreadCount > 0 && (
 <button
 onClick={markAllNotifsRead}
 style={{
 fontSize: 11,
 color: "#6b7280",
 background: "none",
 border: "none",
 cursor: "pointer",
 padding: 0,
 fontFamily: "inherit",
 }}
 >Mark all read
 </button>
 )}
 <button
 onClick={() => setNotifOpen(false)}
 style={{
 background: "none",
 border: "none",
 color: "#6b7280",
 cursor: "pointer",
 display: "flex",
 padding: 0,
 }}
 >
 <X size={16} />
 </button>
 </div>
 </div>
 <div style={{ overflowY: "auto", flex: 1 }}>
 {notifications.length === 0? (
 <p
 style={{
 fontSize: 13,
 color: "#4b5563",
 padding: "24px 16px",
 textAlign: "center",
 margin: 0,
 }}
 >No notifications yet.
 </p>
 ) : (
 notifications.map((n) => (
 <div
 key={n.id}
 onClick={() => markNotifRead(n)}
 style={{
 padding: "12px 16px",
 borderBottom: "1px solid rgba(255,255,255,0.04)",
 background: n.is_read
? "transparent"
 : "rgba(59,130,246,0.05)",
 cursor: "pointer",
 display: "flex",
 gap: 10,
 alignItems: "flex-start",
 }}
 >
 {!n.is_read && (
 <div
 style={{
 width: 6,
 height: 6,
 background: "#3b82f6",
 borderRadius: "50%",
 flexShrink: 0,
 marginTop: 5,
 }}
 />
 )}
 <div style={{ flex: 1, minWidth: 0 }}>
 <p
 style={{
 margin: "0 0 2px",
 fontSize: 13,
 fontWeight: 600,
 color: "#f3f4f6",
 }}
 >
 {n.title || "Notification"}
 </p>
 <p
 style={{
 margin: "0 0 4px",
 fontSize: 12,
 color: "#9ca3af",
 lineHeight: 1.5,
 }}
 >
 {n.body}
 </p>
 <p style={{ margin: 0, fontSize: 10, color: "#4b5563" }}>
 {timeAgo(n.created_at)}
 </p>
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 </>
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
 {/* header */}
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

 {/* lead count + cap warning */}
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

 {/* lead count badge */}
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

 {/* message textarea */}
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

 {/* progress / success / action */}
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
 {/* header */}
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
 <button
 onClick={() => setAiCaptionCar(null)}
 className="text-gray-400 hover:text-white"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {!isPremium? (
 <UpgradeBanner feature="AI Caption Writer" />
 ) : (
 <>
 {/* platform tabs */}
 <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
 {[
 ["whatsapp", "WhatsApp"],
 ["tiktok", "TikTok"],
 ["instagram", "Instagram"],
 ["facebook", "Facebook"],
 ["general", "General"],
 ].map(([platform, label]) => (
 <button
 key={platform}
 onClick={() => {
 setCaptionPlatform(platform);
 setCaptionCopied(false);
 }}
 style={{
 padding: "5px 12px",
 borderRadius: 8,
 fontSize: 11,
 fontWeight: 600,
 border:
 captionPlatform === platform
? "1px solid rgba(168,85,247,0.5)"
 : "1px solid rgba(255,255,255,0.08)",
 background:
 captionPlatform === platform
? "rgba(168,85,247,0.15)"
 : "rgba(255,255,255,0.04)",
 color: captionPlatform === platform? "#c084fc" : "#9ca3af",
 cursor: "pointer",
 }}
 >
 {label}
 </button>
 ))}
 </div>

 {/* quota badge */}
 <div style={{ marginBottom: 10 }}>
 <AiQuotaBadge userId={userId} feature="caption" limit={50} />
 {!captionQuotaOk && <p style={{ fontSize: 11, color: "#f87171", margin: "4px 0 0" }}>Daily limit reached, resets tomorrow.</p>}
 </div>

 {/* content */}
 {aiCaptionLoading? (
 <AiLoadingState text="Generating caption..." />
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

 {/* actions */}
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
 disabled={aiCaptionLoading ||!captionQuotaOk ||!isPremium}
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
 <Sparkles className="w-3.5 h-3.5" />
 {aiCaptions[`${aiCaptionCar.id}_${captionPlatform}`]? "Regenerate" : "Generate"}
 </button>
 </div>
 </>
 )}
 </div>
 </div>
 )}

 {/* TikTok Studio modal */}
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

 {renderWAModal()}
 {renderLogCallModal()}
 {renderFollowUpModal()}
 {renderBatchWAModal()}
 </div>
 </>
 );
}
