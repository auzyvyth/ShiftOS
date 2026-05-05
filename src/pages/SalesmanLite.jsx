import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "../supabaseClient";
import CarFormLite from "../components/CarFormLite";
import CarForm from "../components/CarForm";
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

  function switchTab(tab) {
    if (tab === "bookings") setNewBookingsCount(0);
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
  });
  const [addLeadSaving, setAddLeadSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [lostPromptId, setLostPromptId] = useState(null);
  const [waModalLead, setWaModalLead] = useState(null);
  const [waModalMsg, setWaModalMessage] = useState("");

  // settings
  const [settingsForm, setSettingsForm] = useState({
    full_name: "",
    whatsapp_number: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);
  const [editingReminder, setEditingReminder] = useState(null);
  const [reminderMsg, setReminderMsg] = useState("");

  // notifications
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

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

  // merge
  const [mergeCode, setMergeCode] = useState("");
  const [mergeStatus, setMergeStatus] = useState("idle");
  const [mergeMsg, setMergeMsg] = useState("");

  const channelRef = useRef(null);
  const [appointments, setAppointments] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [analyticsEvents, setAnalyticsEvents] = useState([]);

  // stale leads (48h)
  useEffect(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    setStaleLeads(
      leads.filter(
        (l) =>
          l.stage !== "won" &&
          l.stage !== "lost" &&
          l.updated_at &&
          new Date(l.updated_at).getTime() < cutoff,
      ),
    );
  }, [leads]);

  useEffect(() => {
    if (profile) {
      setSettingsForm({
        full_name: profile.full_name || "",
        whatsapp_number: profile.whatsapp_number || "",
      });
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  // auth + profile
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error || !data.session) {
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

      if (!profileData.onboarding_tour_done) setTourStep(0);

      // fetch listings with full columns for car detail popup
      Promise.all([
        supabase
          .from("car_listings")
          .select(
            "id, slug, year, brand, model, variant, selling_price, original_price, status, images, colour, mileage, transmission, fuel_type, body_type, features, options, city, state, condition, engine_cc, created_at",
          )
          .eq("assigned_to", uid),
        supabase
          .from("car_listings")
          .select(
            "id, slug, year, brand, model, variant, selling_price, original_price, status, images, colour, mileage, transmission, fuel_type, body_type, features, options, city, state, condition, engine_cc, created_at",
          )
          .eq("dealer_id", uid),
      ]).then(([r1, r2]) => {
        const seen = new Set();
        const merged = [...(r1.data || []), ...(r2.data || [])]
          .filter((c) => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setMyListings(merged);
      });

      // fetch analytics events (30d, scoped by salesman slug)
      const slug = profileData.slug;
      if (slug) {
        supabase
          .from("analytics_events")
          .select("event_type, car_id, car_name, created_at")
          .eq("salesman_slug", slug)
          .gte(
            "created_at",
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          )
          .then(({ data: evts }) => setAnalyticsEvents(evts || []));

        // build per-listing stats map for CVR heatmap
        supabase
          .from("analytics_events")
          .select("car_id, event_type")
          .eq("salesman_slug", slug)
          .then(({ data: evtData }) => {
            const map = {};
            (evtData || []).forEach((e) => {
              if (!e.car_id) return;
              if (!map[e.car_id]) map[e.car_id] = { views: 0, enquiries: 0 };
              if (["car_view", "link_visit"].includes(e.event_type))
                map[e.car_id].views++;
              if (["whatsapp_click", "call_click"].includes(e.event_type))
                map[e.car_id].enquiries++;
            });
            setCarStatsMap(map);
          });
      }

      // fetch leads
      supabase
        .from("leads")
        .select("*, car_listings(brand, model, year, selling_price)")
        .eq("salesman_id", uid)
        .eq("is_deleted", false)
        .order("updated_at", { ascending: false })
        .then(({ data: lds }) => {
          setLeads(lds || []);
          setLeadsLoading(false);

          channelRef.current = supabase
            .channel("salesman-lite-rt-" + uid)
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
                  setLeads((p) => [payload.new, ...p]);
                if (payload.eventType === "UPDATE")
                  setLeads((p) =>
                    p.map((l) =>
                      l.id === payload.new.id ? { ...l, ...payload.new } : l,
                    ),
                  );
                if (payload.eventType === "DELETE")
                  setLeads((p) => p.filter((l) => l.id !== payload.old.id));
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
              async (payload) => {
                if (payload.eventType === "INSERT") {
                  setEnquiries((p) => [payload.new, ...p]);
                  toast("New enquiry!", {
                    description: payload.new.buyer_name || "Someone enquired",
                  });
                  // auto-add to lead pipeline
                  const { data: newLead } = await supabase
                    .from("leads")
                    .insert({
                      salesman_id: uid,
                      dealer_id: null,
                      buyer_name: payload.new.buyer_name || null,
                      phone: payload.new.buyer_phone || null,
                      notes: payload.new.buyer_message || null,
                      car_listing_id: payload.new.listing_id || null,
                      stage: "new",
                      lead_source: "enquiry",
                      is_deleted: false,
                    })
                    .select()
                    .single();
                  if (newLead) setLeads((p) => [newLead, ...p]);
                  await supabase
                    .from("whatsapp_enquiries")
                    .update({ status: "converted" })
                    .eq("id", payload.new.id);
                  setEnquiries((p) =>
                    p.map((e) =>
                      e.id === payload.new.id ? { ...e, status: "converted" } : e,
                    ),
                  );
                }
                if (payload.eventType === "UPDATE")
                  setEnquiries((p) =>
                    p.map((e) =>
                      e.id === payload.new.id ? { ...e, ...payload.new } : e,
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
                  setAppointments((p) => [payload.new, ...p]);
                  setNewBookingsCount((c) => c + 1);
                  toast("New booking!", {
                    description: payload.new.buyer_name || "New appointment",
                  });
                }
                if (payload.eventType === "UPDATE")
                  setAppointments((p) =>
                    p.map((a) =>
                      a.id === payload.new.id ? { ...a, ...payload.new } : a,
                    ),
                  );
              },
            )
            .subscribe();
        });

      // fetch appointments
      supabase
        .from("appointments")
        .select(
          "id, buyer_name, buyer_phone, appointment_date, status, notes, car_listing_id, created_at, car_listings(brand, model, year)",
        )
        .eq("salesman_id", uid)
        .eq("dealer_id", uid)
        .order("appointment_date", { ascending: false })
        .then(({ data: apts }) => setAppointments(apts || []));

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
        .then(({ data: enqs }) => setEnquiries(enqs || []));
    });
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const updateLeadStage = async (leadId, stage) => {
    const oldStage = leads.find((l) => l.id === leadId)?.stage ?? null;
    const dealerId = leads.find((l) => l.id === leadId)?.dealer_id ?? null;
    await supabase
      .from("leads")
      .update({ stage, updated_at: new Date().toISOString() })
      .eq("id", leadId);
    await supabase.from("lead_activities").insert({
      lead_id: leadId,
      activity_type: "stage_changed",
      from_stage: oldStage,
      to_stage: stage,
      created_by: userId,
      dealer_id: dealerId,
    });
    setLeads((p) => p.map((l) => (l.id === leadId ? { ...l, stage } : l)));
  };

  const pingWA = (lead) => {
    const car = lead.car_listings;
    const carName = car ? `${car.brand} ${car.model}` : "kereta tu";
    const name = lead.buyer_name || "kawan";
    const defaultMsg = `Hi ${name}! Macam mana, still interested dalam ${carName} tu? Jom kita discuss lagi — saya boleh tolong cari yang terbaik untuk you 😊`;
    setWaModalLead(lead);
    setWaModalMessage(defaultMsg);
  };

  const handleDeleteLead = async (leadId) => {
    await supabase.from("leads").update({ is_deleted: true }).eq("id", leadId);
    setLeads((p) => p.filter((l) => l.id !== leadId));
    setDeleteConfirmId(null);
  };

  const handleLostReason = async (leadId, reason) => {
    const lead = leads.find((l) => l.id === leadId);
    const oldStage = lead?.stage ?? null;
    const dealerId = lead?.dealer_id ?? null;
    const now = new Date().toISOString();
    await supabase
      .from("leads")
      .update({ stage: "lost", lost_reason: reason, updated_at: now })
      .eq("id", leadId);
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
      p.map((l) =>
        l.id === leadId
          ? { ...l, stage: "lost", lost_reason: reason, updated_at: now }
          : l,
      ),
    );
    setLostPromptId(null);
  };

  // ── notifications ──────────────────────────────────────────────────────────

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markNotifRead = async (notif) => {
    if (notif.is_read) return;
    await supabase
      .from("salesman_notifications")
      .update({ is_read: true })
      .eq("id", notif.id);
    setNotifications((p) =>
      p.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
    );
  };

  const markAllNotifsRead = async () => {
    const ids = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    await supabase
      .from("salesman_notifications")
      .update({ is_read: true })
      .in("id", ids);
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

  const fireTemplate = (enq, key) => {
    const msg = buildTemplate(enq, key);
    navigator.clipboard.writeText(msg).catch(() => {});
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
  };

  // ── appointment status ─────────────────────────────────────────────────────

  const updateApptStatus = async (apptId, status) => {
    await supabase.from("appointments").update({ status }).eq("id", apptId);
    setAppointments((p) =>
      p.map((a) => (a.id === apptId ? { ...a, status } : a)),
    );
  };

  const handleAddLead = async () => {
    setAddLeadSaving(true);
    const { data } = await supabase
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
        lost_reason: null,
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
    });
  };

  const handleMerge = async () => {
    if (!mergeCode.trim()) return;
    setMergeStatus("pending");
    setMergeMsg("");

    const { data } = await supabase
      .from("dealer_invites")
      .select("dealer_id, expires_at, used")
      .eq("code", mergeCode.trim().toUpperCase())
      .maybeSingle();

    if (!data || data.used || new Date(data.expires_at) < new Date()) {
      setMergeStatus("error");
      setMergeMsg("Invalid or expired invite code.");
      return;
    }

    await supabase
      .from("profiles")
      .update({ dealer_id: data.dealer_id })
      .eq("id", profile.id);
    await supabase
      .from("leads")
      .update({ dealer_id: data.dealer_id })
      .eq("salesman_id", profile.id)
      .is("dealer_id", null);
    await supabase
      .from("car_listings")
      .update({ dealer_id: data.dealer_id })
      .eq("assigned_to", profile.id);
    await supabase.rpc("use_dealer_invite", {
      invite_code: mergeCode.trim().toUpperCase(),
    });

    setMergeStatus("success");
    setMergeMsg("Merged! Redirecting to full dashboard...");
    setTimeout(() => navigate("/salesman"), 2500);
  };

  const handleListingCopy = (car, type) => {
    const link = `${window.location.origin}/cars/${car.slug}?ref=${profile?.slug || ""}`;
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

  const generateAiCaptions = async (car) => {
    setAiCaptionCar(car);
    setAiCaptionTab("wa");
    setCaptionCopied(false);
    if (aiCaptions[car.id]) return;
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
    } catch {
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
    const link = car.slug ? `https://xdrive.my/cars/${car.slug}` : null;
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
    const capped = eligibleLeads.slice(0, 10);
    setBroadcastProgress({ current: 0, total: capped.length });
    capped.forEach((lead, i) => {
      setTimeout(() => {
        const phone = (lead.phone || "").replace(/\D/g, "");
        if (phone) {
          window.open(
            `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${encodeURIComponent(broadcastMsg)}`,
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
      label: "Enquiries",
      icon: <MessageSquare style={{ width: 14, height: 14 }} />,
      badge: enquiries.filter((e) => e.status === "new").length || null,
    },
    {
      tab: "bookings",
      label: "Bookings",
      icon: <Phone style={{ width: 14, height: 14 }} />,
      badge: newBookingsCount || null,
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
      label: "Enquiries",
      icon: <MessageSquare size={18} />,
      badge: enquiries.filter((e) => e.status === "new").length || null,
    },
    {
      tab: "bookings",
      label: "Bookings",
      icon: <Phone size={18} />,
      badge: newBookingsCount || null,
    },
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
          style={{
            position: "fixed",
            top: isMobile ? 60 : 58,
            right: isMobile ? 8 : 24,
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

  // ── RENDER DASHBOARD ──────────────────────────────────────────────────────

  const renderDashboard = () => {
    const activeLeads = leads.filter(
      (l) => l.stage !== "lost" && l.stage !== "closed_lost",
    );
    const todayAppts = appointments.filter((a) => {
      if (!a.appointment_date) return false;
      const d = new Date(a.appointment_date);
      if (isNaN(d)) return false;
      const today = new Date();
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    }).length;
    const kpis = [
      { label: "Active Leads", value: activeLeads.length, color: "#93c5fd" },
      { label: "My Listings", value: myListings.length, color: "#4ade80" },
      {
        label: "Stale Leads",
        value: staleLeads.length,
        color: "#fb923c",
        warn: staleLeads.length > 0,
      },
      { label: "Appts Today", value: todayAppts, color: "#c084fc" },
      {
        label: "New Enquiries",
        value: enquiries.filter((e) => e.status === "new").length,
        color: "#c084fc",
      },
    ];

    const listingStats = myListings.map((car) => {
      const carEvts = analyticsEvents.filter((e) => e.car_id === car.id);
      const views = carEvts.filter((e) => ["car_view", "link_visit"].includes(e.event_type)).length;
      const waTaps = carEvts.filter((e) => ["whatsapp_click", "call_click"].includes(e.event_type)).length;
      const enqCount = enquiries.filter((e) => e.listing_id === car.id).length;
      const cvr = views > 0 ? (waTaps / views) * 100 : null;
      return { car, views, waTaps, enqCount, cvr };
    });
    const totalViews = analyticsEvents.filter(
      (e) => ["car_view", "link_visit"].includes(e.event_type),
    ).length;
    const totalWATaps = analyticsEvents.filter(
      (e) => ["whatsapp_click", "call_click"].includes(e.event_type),
    ).length;
    const bestCVRStat = listingStats.reduce((best, s) => {
      if (s.cvr !== null && (best === null || s.cvr > best.cvr)) return s;
      return best;
    }, null);
    const cvrColor = (cvr) =>
      cvr >= 10 ? "#4ade80" : cvr >= 5 ? "#fbbf24" : "#f87171";
    const perfCarName = (car) =>
      [car.year, car.brand, car.model].filter(Boolean).join(" ");

    return (
      <div>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 16,
            fontWeight: 600,
            color: "#f1f5f9",
          }}
        >
          Overview
        </p>

        {/* KPI cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {kpis.map(({ label, value, color, warn }) => (
            <div
              key={label}
              style={{
                background: "#0d1117",
                border: `1px solid ${warn ? "rgba(251,146,60,0.3)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 11,
                  color: "#4b5563",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {label}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 28,
                  fontFamily: "'Bebas Neue', sans-serif",
                  letterSpacing: "1px",
                  color,
                }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* My Performance */}
        <div style={{ marginBottom: 24 }}>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 11,
              fontWeight: 600,
              color: "#374151",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            My Performance (30d)
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                background: "#0d1117",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 11,
                  color: "#4b5563",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Total Views
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontFamily: "'Bebas Neue', sans-serif",
                  letterSpacing: "1px",
                  color: "#93c5fd",
                }}
              >
                {totalViews}
              </p>
            </div>
            <div
              style={{
                background: "#0d1117",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 11,
                  color: "#4b5563",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                WA Taps
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontFamily: "'Bebas Neue', sans-serif",
                  letterSpacing: "1px",
                  color: "#4ade80",
                }}
              >
                {totalWATaps}
              </p>
            </div>
            <div
              style={{
                background: "#0d1117",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 11,
                  color: "#4b5563",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Best CVR
              </p>
              {bestCVRStat ? (
                <>
                  <p
                    style={{
                      margin: "0 0 2px",
                      fontSize: 22,
                      fontFamily: "'Bebas Neue', sans-serif",
                      letterSpacing: "1px",
                      color: cvrColor(bestCVRStat.cvr),
                    }}
                  >
                    {bestCVRStat.cvr.toFixed(1)}%
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 9,
                      color: "#4b5563",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {perfCarName(bestCVRStat.car)}
                  </p>
                </>
              ) : (
                <p
                  style={{
                    margin: 0,
                    fontSize: 26,
                    fontFamily: "'Bebas Neue', sans-serif",
                    letterSpacing: "1px",
                    color: "#374151",
                  }}
                >
                  —
                </p>
              )}
            </div>
          </div>

          {listingStats.length > 0 && (
            <div
              style={{
                background: "#0d1117",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 42px 42px 42px 52px",
                  padding: "7px 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    color: "#374151",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Listing
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    color: "#374151",
                    textAlign: "center",
                  }}
                >
                  Views
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    color: "#374151",
                    textAlign: "center",
                  }}
                >
                  WA
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    color: "#374151",
                    textAlign: "center",
                  }}
                >
                  Enq
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    color: "#374151",
                    textAlign: "right",
                  }}
                >
                  CVR
                </p>
              </div>
              {listingStats.map(
                ({ car, views, waTaps, enqCount, cvr }, idx) => (
                  <div
                    key={car.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 42px 42px 42px 52px",
                      padding: "8px 12px",
                      alignItems: "center",
                      borderBottom:
                        idx < listingStats.length - 1
                          ? "1px solid rgba(255,255,255,0.04)"
                          : "none",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 11,
                        color: "#e5e7eb",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        paddingRight: 6,
                      }}
                    >
                      {perfCarName(car)}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#93c5fd",
                        textAlign: "center",
                      }}
                    >
                      {views}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#4ade80",
                        textAlign: "center",
                      }}
                    >
                      {waTaps}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#c084fc",
                        textAlign: "center",
                      }}
                    >
                      {enqCount}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 700,
                        textAlign: "right",
                        color: cvr !== null ? cvrColor(cvr) : "#374151",
                      }}
                    >
                      {cvr !== null ? `${cvr.toFixed(1)}%` : "—"}
                    </p>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        {/* Stale nudges */}
        {staleLeads.length > 0 && (
          <div
            style={{
              background: "#0d1117",
              border: "1px solid rgba(251,146,60,0.2)",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <AlertCircle
                size={14}
                style={{ color: "#fb923c", flexShrink: 0 }}
              />
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fb923c",
                }}
              >
                Follow-up Nudges ({staleLeads.length})
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {staleLeads.map((lead) => (
                <div
                  key={lead.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#e5e7eb",
                      }}
                    >
                      {lead.buyer_name || "—"}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: "#4b5563" }}>
                      No contact · {timeAgo(lead.updated_at)}
                    </p>
                  </div>
                  {lead.phone && (
                    <button
                      onClick={() => pingWA(lead)}
                      style={{
                        fontSize: 10,
                        padding: "4px 10px",
                        borderRadius: 6,
                        background: "rgba(37,211,102,0.1)",
                        border: "1px solid rgba(37,211,102,0.2)",
                        color: "#4ade80",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      WA
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity feed */}
        {(() => {
          const feed = [
            ...appointments.slice(0, 5).map((a) => ({
              type: "booking",
              label: `${a.buyer_name || "Someone"} booked a viewing`,
              sub: a.car_listings
                ? `${a.car_listings.brand} ${a.car_listings.model}`
                : "",
              ts: a.created_at,
              dot: "#60a5fa",
            })),
            ...enquiries.slice(0, 5).map((e) => ({
              type: "enquiry",
              label: `${e.buyer_name || "Someone"} enquired`,
              sub: e.car_listings
                ? `${e.car_listings.brand} ${e.car_listings.model}`
                : "",
              ts: e.created_at,
              dot: "#4ade80",
            })),
            ...leads
              .filter((l) => l.stage === "won")
              .slice(0, 3)
              .map((l) => ({
                type: "won",
                label: `${l.buyer_name || "Lead"} marked won`,
                sub: l.car_listings
                  ? `${l.car_listings.brand} ${l.car_listings.model}`
                  : "",
                ts: l.updated_at,
                dot: "#fbbf24",
              })),
          ]
            .filter((f) => f.ts)
            .sort((a, b) => new Date(b.ts) - new Date(a.ts))
            .slice(0, 8);

          if (!feed.length) return null;
          return (
            <div style={{ marginTop: 20 }}>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#374151",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Recent Activity
              </p>
              <div
                style={{
                  background: "#0d1117",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                {feed.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      borderBottom:
                        i < feed.length - 1
                          ? "1px solid rgba(255,255,255,0.04)"
                          : "none",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: f.dot,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: "#e5e7eb",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {f.label}
                      </p>
                      {f.sub && (
                        <p
                          style={{ margin: 0, fontSize: 10, color: "#4b5563" }}
                        >
                          {f.sub}
                        </p>
                      )}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 10,
                        color: "#374151",
                        flexShrink: 0,
                      }}
                    >
                      {timeAgo(f.ts)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* No-dealer banner */}
        <div
          style={{
            marginTop: 20,
            background: "rgba(37,99,235,0.07)",
            border: "1px solid rgba(37,99,235,0.2)",
            borderRadius: 10,
            padding: "14px 16px",
          }}
        >
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 13,
              fontWeight: 600,
              color: "#93c5fd",
            }}
          >
            Upgrade to full panel
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#4b5563" }}>
            Ask your dealer for an invite code to unlock all features.
          </p>
          <button
            onClick={() => setActiveTab("merge")}
            style={{
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 7,
              background: "#2563eb",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Enter Invite Code →
          </button>
        </div>
      </div>
    );
  };

  // ── RENDER LISTINGS ───────────────────────────────────────────────────────

  const renderListings = () => {
    const enriched = myListings.map((car) => {
      const stats = carStatsMap[car.id] ?? {};
      const views = stats.views || 0;
      const enqs = stats.enquiries || 0;
      const cvr = views > 0 ? (enqs / views) * 100 : null;
      const isHot = cvr !== null && cvr > 6 && views > 3;
      const isStale = views > 10 && (cvr === null || cvr === 0);
      return { car, views, enqs, cvr, isHot, isStale };
    });

    const hotCount = enriched.filter((e) => e.isHot).length;
    const staleCount = enriched.filter((e) => e.isStale).length;
    const activeCount = myListings.filter(
      (c) => c.status === "available",
    ).length;

    const filtered = enriched.filter((e) => e.car.status === filterStatus);

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "price_desc")
        return (b.car.selling_price || 0) - (a.car.selling_price || 0);
      if (sortBy === "price_asc")
        return (a.car.selling_price || 0) - (b.car.selling_price || 0);
      return 0;
    });

    const SEL_STYLE = (active) => ({
      fontSize: 11,
      padding: "5px 11px",
      borderRadius: 7,
      cursor: "pointer",
      background: active ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.05)",
      border: active
        ? "1px solid rgba(59,130,246,0.4)"
        : "1px solid rgba(255,255,255,0.08)",
      color: active ? "#93c5fd" : "#6b7280",
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
              background: "#1d4ed8",
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
            <CarFormLite
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
                { key: "available", label: "Active",   count: myListings.filter((c) => c.status === "available").length },
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
                      <StatusBadge status={car.status} />
                    </div>

                    {/* Price */}
                    <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: isSold ? "#4b5563" : "#60a5fa" }}>
                      {price}
                    </p>

                    {/* Meta */}
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: "#4b5563" }}>
                      {[
                        car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null,
                        car.transmission,
                        car.colour,
                      ].filter(Boolean).join(" · ")}
                    </p>

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
                          <div style={{ height: "100%", width: `${cvrFill}%`, background: isHot ? "#ef4444" : "#3b82f6", borderRadius: 99, transition: "width 0.3s" }} />
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

                    {/* Action buttons — sold shows view-only; reserved hides broadcast */}
                    {isSold ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={openDetail}
                          style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}
                        >
                          View Details
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: isMobile ? "grid" : "flex", gridTemplateColumns: isMobile ? "1fr 1fr" : undefined, gap: 6, flexWrap: isMobile ? undefined : "wrap" }}>
                        <button
                          onClick={() => handleListingCopy(car, "link")}
                          style={{
                            fontSize: 10, padding: "4px 8px", borderRadius: 6, textAlign: "center", cursor: "pointer",
                            background: listingCopied[car.id] === "link" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: listingCopied[car.id] === "link" ? "#4ade80" : "#9ca3af",
                          }}
                        >
                          {listingCopied[car.id] === "link" ? "✓ Copied" : "Copy Link"}
                        </button>
                        <button
                          onClick={() => handleListingCopy(car, "wa")}
                          style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer", textAlign: "center" }}
                        >
                          WA Caption
                        </button>
                        {!isReserved && (
                          <button
                            onClick={() => openBroadcast(car)}
                            style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c", cursor: "pointer", textAlign: "center" }}
                          >
                            Broadcast
                          </button>
                        )}
                        <button
                          onClick={() => generateAiCaptions(car)}
                          style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", color: "#c084fc", cursor: "pointer", textAlign: "center" }}
                        >
                          AI Caption
                        </button>
                        <button
                          onClick={() => setTiktokListing(car)}
                          style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", cursor: "pointer", textAlign: "center" }}
                        >
                          TikTok
                        </button>
                        <button
                          onClick={() => setEditListing(car)}
                          style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.25)", color: "#64b4ff", cursor: "pointer", textAlign: "center", display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}
                        >
                          <Pencil size={10} /> Edit
                        </button>
                      </div>
                    )}
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
              height: isMobile ? "100dvh" : undefined,
              maxHeight: isMobile ? "100dvh" : "calc(100vh - 48px)",
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
                                ? "1px solid rgba(59,130,246,0.6)"
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
                          color: "#93c5fd",
                          background: "rgba(59,130,246,0.12)",
                          border: "1px solid rgba(59,130,246,0.25)",
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
                    <MessageSquare size={13} style={{ flexShrink: 0 }} /> WA
                    Caption
                  </>,
                  "#4ade80",
                  "rgba(37,211,102,0.06)",
                  "rgba(37,211,102,0.2)",
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
                    {car.status || "active"}
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
    const activeStages = LEAD_STAGES.filter(
      (s) => s !== "lost" && s !== "closed_lost" && s !== "closed_won",
    );
    const lostLeads = leads.filter(
      (l) =>
        l.stage === "lost" ||
        l.stage === "closed_lost" ||
        l.stage === "closed_won",
    );

    const renderLeadCard = (lead) => {
      const car = lead.car_listings;
      const carName = car
        ? [car.year, car.brand, car.model].filter(Boolean).join(" ")
        : null;
      const carPrice = car?.selling_price
        ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}`
        : null;
      const stageIdx = LEAD_STAGES.indexOf(lead.stage);
      const nextStage = LEAD_STAGES.filter(
        (s) =>
          s !== "lost" &&
          s !== "won" &&
          s !== "closed_won" &&
          s !== "closed_lost",
      ).find((s) => LEAD_STAGES.indexOf(s) > stageIdx);
      const heat = getHeatScore(lead);
      const isConfirmingDelete = deleteConfirmId === lead.id;
      const isPromptingLost = lostPromptId === lead.id;

      return (
        <div
          key={lead.id}
          style={{
            background: "#0d1117",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 6,
              marginBottom: 2,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: "#e5e7eb",
                lineHeight: 1.3,
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
              <span
                title={`${heat.label} · score ${heat.score.toFixed(1)}`}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: heat.color,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 99,
                  padding: "1px 6px",
                  lineHeight: 1.4,
                  whiteSpace: "nowrap",
                }}
              >
                {heat.emoji} {heat.score.toFixed(1)}
              </span>
              <button
                onClick={() => {
                  setLostPromptId(null);
                  setDeleteConfirmId(lead.id);
                }}
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
          <p style={{ margin: "0 0 4px", fontSize: 10, color: "#374151" }}>
            Added {timeAgo(lead.created_at)}
          </p>
          {carName && (
            <p style={{ margin: "0 0 1px", fontSize: 11, color: "#6b7280" }}>
              {carName}
            </p>
          )}
          {carPrice && (
            <p
              style={{
                margin: "0 0 4px",
                fontSize: 11,
                fontWeight: 600,
                color: "#60a5fa",
              }}
            >
              {carPrice}
            </p>
          )}
          {lead.phone && (
            <p style={{ margin: "0 0 4px", fontSize: 11, color: "#4b5563" }}>
              📞 {lead.phone}
            </p>
          )}
          {lead.notes && (
            <p
              style={{
                margin: "0 0 6px",
                fontSize: 10,
                color: "#4b5563",
                fontStyle: "italic",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              "{lead.notes}"
            </p>
          )}
          {isConfirmingDelete ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
                padding: "4px 0",
              }}
            >
              <span style={{ fontSize: 11, color: "#f87171", fontWeight: 600 }}>
                Delete?
              </span>
              <button
                onClick={() => handleDeleteLead(lead.id)}
                style={{
                  fontSize: 10,
                  padding: "3px 9px",
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
                  padding: "3px 9px",
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
          ) : isPromptingLost ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexWrap: "wrap",
                padding: "4px 0",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: "#9ca3af",
                  fontWeight: 600,
                  marginRight: 2,
                }}
              >
                Why lost?
              </span>
              {LOST_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => handleLostReason(lead.id, r)}
                  style={{
                    fontSize: 10,
                    padding: "3px 8px",
                    borderRadius: 99,
                    background: "rgba(148,163,184,0.08)",
                    border: "1px solid rgba(148,163,184,0.2)",
                    color: "#cbd5e1",
                    cursor: "pointer",
                  }}
                >
                  {r}
                </button>
              ))}
              <button
                onClick={() => setLostPromptId(null)}
                style={{
                  fontSize: 10,
                  padding: "3px 7px",
                  borderRadius: 5,
                  background: "transparent",
                  border: "none",
                  color: "#4b5563",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {nextStage && lead.stage !== "won" && (
                <button
                  onClick={() => updateLeadStage(lead.id, nextStage)}
                  style={{
                    fontSize: 10,
                    padding: "3px 7px",
                    borderRadius: 5,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#6b7280",
                    cursor: "pointer",
                  }}
                >
                  → {nextStage.replace(/_/g, " ")}
                </button>
              )}
              {lead.stage !== "won" && lead.stage !== "deposit_taken" && (
                <button
                  onClick={() => updateLeadStage(lead.id, "won")}
                  style={{
                    fontSize: 10,
                    padding: "3px 7px",
                    borderRadius: 5,
                    background: "rgba(34,197,94,0.08)",
                    border: "1px solid rgba(34,197,94,0.2)",
                    color: "#4ade80",
                    cursor: "pointer",
                  }}
                >
                  → Won
                </button>
              )}
              {lead.stage !== "won" && (
                <button
                  onClick={() => {
                    setDeleteConfirmId(null);
                    setLostPromptId(lead.id);
                  }}
                  style={{
                    fontSize: 10,
                    padding: "3px 7px",
                    borderRadius: 5,
                    background: "rgba(148,163,184,0.06)",
                    border: "1px solid rgba(148,163,184,0.18)",
                    color: "#9ca3af",
                    cursor: "pointer",
                  }}
                >
                  → Lost
                </button>
              )}
              {lead.phone && (
                <button
                  onClick={() => {
                    const car = lead.car_listings;
                    const carName = car
                      ? `${car.brand} ${car.model}`
                      : "kereta tu";
                    const msg = `Hi ${lead.buyer_name || "kawan"}! Macam mana, still interested dalam ${carName} tu? Jom kita discuss lagi 😊`;
                    setWaModalMessage(msg);
                    setWaModalLead(lead);
                  }}
                  style={{
                    fontSize: 10,
                    padding: "3px 7px",
                    borderRadius: 5,
                    background: "rgba(37,211,102,0.1)",
                    border: "1px solid rgba(37,211,102,0.2)",
                    color: "#4ade80",
                    cursor: "pointer",
                  }}
                >
                  WA
                </button>
              )}
            </div>
          )}
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
            Lead Pipeline ({leads.filter((l) => l.stage !== "lost").length})
          </p>
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
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            <Plus size={13} /> Add Lead
          </button>
        </div>

        {isMobile && leads.length > 0 && (
          <p style={{ margin: "0 0 8px", fontSize: 11, color: "#374151" }}>
            swipe to see more →
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            paddingBottom: 8,
            scrollSnapType: isMobile ? "x mandatory" : undefined,
          }}
        >
          {activeStages.map((stage) => {
            const sc = STAGE_COLOR[stage] || {};
            const stageLeads = leads
              .filter((l) => l.stage === stage)
              .sort((a, b) => getHeatScore(b).score - getHeatScore(a).score);
            return (
              <div
                key={stage}
                style={{
                  minWidth: isMobile ? 170 : 200,
                  flexShrink: 0,
                  scrollSnapAlign: isMobile ? "start" : undefined,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: sc.tx || "#9ca3af",
                      textTransform: "capitalize",
                    }}
                  >
                    {stage.replace(/_/g, " ")}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      background: sc.bg,
                      border: `1px solid ${sc.border}`,
                      color: sc.tx,
                      borderRadius: 99,
                      padding: "1px 6px",
                    }}
                  >
                    {stageLeads.length}
                  </span>
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {stageLeads.length === 0 && (
                    <div
                      style={{
                        height: 60,
                        borderRadius: 10,
                        border: "1px dashed rgba(255,255,255,0.07)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#374151" }}>
                        Empty
                      </span>
                    </div>
                  )}
                  {stageLeads.map((lead) => renderLeadCard(lead))}
                </div>
              </div>
            );
          })}
        </div>

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
                        {lead.lost_reason && (
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
                            {lead.lost_reason}
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
                            padding: "3px 9px",
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
                            padding: "3px 9px",
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
      </div>
    );
  };

  // ── RENDER ENQUIRIES ─────────────────────────────────────────────────────

  const renderEnquiries = () => (
    <div>
      <p
        style={{
          margin: "0 0 16px",
          fontSize: 16,
          fontWeight: 600,
          color: "#f1f5f9",
        }}
      >
        Enquiries ({enquiries.length})
      </p>
      {enquiries.length === 0 && (
        <div
          style={{ padding: "40px 0", textAlign: "center", color: "#374151" }}
        >
          <MessageSquare size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: 13 }}>No enquiries yet.</p>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {enquiries.map((enq) => {
          const car = enq.car_listings;
          return (
            <div
              key={enq.id}
              style={{
                background: "#0d1117",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#e5e7eb",
                  }}
                >
                  {enq.buyer_name || "—"}
                </p>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 7px",
                    borderRadius: 99,
                    flexShrink: 0,
                    background:
                      enq.status === "new"
                        ? "rgba(96,165,250,0.12)"
                        : "rgba(34,197,94,0.12)",
                    border: `1px solid ${enq.status === "new" ? "rgba(96,165,250,0.3)" : "rgba(34,197,94,0.3)"}`,
                    color: enq.status === "new" ? "#93c5fd" : "#4ade80",
                    textTransform: "capitalize",
                  }}
                >
                  {enq.status}
                </span>
              </div>
              {car && (
                <p
                  style={{ margin: "0 0 2px", fontSize: 11, color: "#6b7280" }}
                >
                  {[car.year, car.brand, car.model].filter(Boolean).join(" ")}
                </p>
              )}
              {enq.buyer_phone && (
                <p
                  style={{ margin: "0 0 4px", fontSize: 11, color: "#4b5563" }}
                >
                  📞 {enq.buyer_phone}
                </p>
              )}
              {enq.buyer_message && (
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 11,
                    color: "#4b5563",
                    fontStyle: "italic",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  "{enq.buyer_message}"
                </p>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {enq.buyer_phone && (
                  <button
                    onClick={() => {
                      const phone = enq.buyer_phone.replace(/\D/g, "");
                      const enqCar = enq.car_listings;
                      const carName = enqCar
                        ? `${enqCar.brand} ${enqCar.model}`
                        : "kereta";
                      const msg = encodeURIComponent(
                        `Hi ${enq.buyer_name || ""}! Thank you for your enquiry on the ${carName}. I'm here to help — when would be a good time to chat? 😊`,
                      );
                      window.open(
                        `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${msg}`,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }}
                    style={{
                      fontSize: 10,
                      padding: "3px 9px",
                      borderRadius: 6,
                      background: "rgba(37,211,102,0.1)",
                      border: "1px solid rgba(37,211,102,0.2)",
                      color: "#4ade80",
                      cursor: "pointer",
                    }}
                  >
                    WA Reply
                  </button>
                )}
                {enq.buyer_phone && (
                  <button
                    onClick={() =>
                      setOpenTemplateId(
                        openTemplateId === enq.id ? null : enq.id,
                      )
                    }
                    style={{
                      fontSize: 10,
                      padding: "3px 9px",
                      borderRadius: 6,
                      background:
                        openTemplateId === enq.id
                          ? "rgba(167,139,250,0.15)"
                          : "rgba(255,255,255,0.05)",
                      border: `1px solid ${openTemplateId === enq.id ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)"}`,
                      color: openTemplateId === enq.id ? "#c084fc" : "#6b7280",
                      cursor: "pointer",
                    }}
                  >
                    Templates
                  </button>
                )}
                {enq.status === "new" && (
                  <button
                    onClick={async () => {
                      await supabase
                        .from("whatsapp_enquiries")
                        .update({ status: "responded" })
                        .eq("id", enq.id);
                      setEnquiries((p) =>
                        p.map((e) =>
                          e.id === enq.id ? { ...e, status: "responded" } : e,
                        ),
                      );
                    }}
                    style={{
                      fontSize: 10,
                      padding: "3px 9px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#6b7280",
                      cursor: "pointer",
                    }}
                  >
                    Mark Responded
                  </button>
                )}
                {enq.status === "converted" ? (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "3px 9px",
                      borderRadius: 6,
                      background: "rgba(34,197,94,0.1)",
                      border: "1px solid rgba(34,197,94,0.2)",
                      color: "#4ade80",
                    }}
                  >
                    In Pipeline ✓
                  </span>
                ) : (
                  <button
                    onClick={async () => {
                      const { data: newLead } = await supabase
                        .from("leads")
                        .insert({
                          salesman_id: userId,
                          dealer_id: null,
                          buyer_name: enq.buyer_name,
                          phone: enq.buyer_phone,
                          notes: enq.buyer_message,
                          car_listing_id: enq.listing_id || null,
                          stage: "new",
                          lead_source: "enquiry",
                          is_deleted: false,
                        })
                        .select()
                        .single();
                      if (newLead) setLeads((p) => [newLead, ...p]);
                      await supabase
                        .from("whatsapp_enquiries")
                        .update({ status: "converted" })
                        .eq("id", enq.id);
                      setEnquiries((p) =>
                        p.map((e) =>
                          e.id === enq.id ? { ...e, status: "converted" } : e,
                        ),
                      );
                      toast.success("Added to lead pipeline!");
                    }}
                    style={{
                      fontSize: 10,
                      padding: "3px 9px",
                      borderRadius: 6,
                      background: "rgba(96,165,250,0.1)",
                      border: "1px solid rgba(96,165,250,0.2)",
                      color: "#93c5fd",
                      cursor: "pointer",
                    }}
                  >
                    → Add to Pipeline
                  </button>
                )}
              </div>
              {openTemplateId === enq.id && (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {[
                    { key: "chat", label: "Let's Chat", color: "#4ade80" },
                    {
                      key: "test_drive",
                      label: "Book Test Drive",
                      color: "#60a5fa",
                    },
                    {
                      key: "budget",
                      label: "What's Budget?",
                      color: "#fbbf24",
                    },
                    {
                      key: "deposit",
                      label: "Deposit to Hold",
                      color: "#f87171",
                    },
                  ].map(({ key, label, color }) => {
                    const toastKey = enq.id + "_" + key;
                    return (
                      <button
                        key={key}
                        onClick={() => fireTemplate(enq, key)}
                        style={{
                          textAlign: "left",
                          fontSize: 11,
                          padding: "7px 10px",
                          borderRadius: 7,
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.07)",
                          color: templateToast === toastKey ? color : "#9ca3af",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: color,
                            flexShrink: 0,
                          }}
                        />
                        {templateToast === toastKey ? "✓ Sent!" : label}
                      </button>
                    );
                  })}
                </div>
              )}
              <p style={{ margin: "6px 0 0", fontSize: 10, color: "#374151" }}>
                {timeAgo(enq.created_at)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── RENDER BOOKINGS ───────────────────────────────────────────────────────

  const renderBookings = () => {
    const isToday = (iso) => {
      if (!iso) return false;
      const d = new Date(iso);
      const t = new Date();
      return (
        d.getDate() === t.getDate() &&
        d.getMonth() === t.getMonth() &&
        d.getFullYear() === t.getFullYear()
      );
    };
    const isNew = (iso) =>
      iso && Date.now() - new Date(iso).getTime() < 2 * 60 * 60 * 1000;

    const todayApts = appointments.filter((a) => isToday(a.appointment_date));
    const upcomingApts = appointments.filter(
      (a) => !isToday(a.appointment_date),
    );

    const statusColors = {
      confirmed: {
        bg: "rgba(34,197,94,0.12)",
        border: "rgba(34,197,94,0.3)",
        tx: "#4ade80",
      },
      pending: {
        bg: "rgba(251,191,36,0.12)",
        border: "rgba(251,191,36,0.3)",
        tx: "#fbbf24",
      },
      cancelled: {
        bg: "rgba(239,68,68,0.12)",
        border: "rgba(239,68,68,0.3)",
        tx: "#f87171",
      },
      rescheduled: {
        bg: "rgba(167,139,250,0.12)",
        border: "rgba(167,139,250,0.3)",
        tx: "#c084fc",
      },
    };

    const renderApptCard = (apt) => {
      const car = apt.car_listings;
      const aptDate = apt.appointment_date
        ? new Date(apt.appointment_date)
        : null;
      const dateStr =
        aptDate && !isNaN(aptDate)
          ? aptDate.toLocaleDateString("en-MY", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "—";
      const timeStr =
        aptDate && !isNaN(aptDate)
          ? aptDate.toLocaleTimeString("en-MY", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
      const defaultReminder = `Hi ${apt.buyer_name || ""}! Just a reminder for your appointment on ${dateStr}${timeStr ? ` at ${timeStr}` : ""}. See you then! 😊`;
      const sc = statusColors[apt.status] || statusColors.pending;

      return (
        <div
          key={apt.id}
          style={{
            background: "#0d1117",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10,
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 2,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flex: 1,
                minWidth: 0,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#e5e7eb",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {apt.buyer_name || "—"}
              </p>
              {isNew(apt.created_at) && (
                <span
                  style={{
                    fontSize: 9,
                    padding: "1px 5px",
                    borderRadius: 99,
                    background: "rgba(96,165,250,0.15)",
                    border: "1px solid rgba(96,165,250,0.3)",
                    color: "#93c5fd",
                    flexShrink: 0,
                    letterSpacing: "0.05em",
                  }}
                >
                  NEW
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: 10,
                padding: "2px 7px",
                borderRadius: 99,
                flexShrink: 0,
                background: sc.bg,
                border: `1px solid ${sc.border}`,
                color: sc.tx,
                textTransform: "capitalize",
              }}
            >
              {apt.status}
            </span>
          </div>
          {apt.created_at && (
            <p style={{ margin: "0 0 4px", fontSize: 10, color: "#374151" }}>
              Booked {timeAgo(apt.created_at)} ·{" "}
              {new Date(apt.created_at).toLocaleDateString("en-MY", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
          <p
            style={{
              margin: "0 0 2px",
              fontSize: 12,
              fontWeight: 600,
              color: "#93c5fd",
            }}
          >
            📅 {dateStr}
            {timeStr && ` · ${timeStr}`}
          </p>
          {car && (
            <p style={{ margin: "0 0 4px", fontSize: 11, color: "#6b7280" }}>
              {[car.year, car.brand, car.model].filter(Boolean).join(" ")}
            </p>
          )}
          {apt.buyer_phone && (
            <p style={{ margin: "0 0 6px", fontSize: 11, color: "#4b5563" }}>
              📞 {apt.buyer_phone}
            </p>
          )}
          {apt.notes && (
            <p
              style={{
                margin: "0 0 6px",
                fontSize: 10,
                color: "#4b5563",
                fontStyle: "italic",
              }}
            >
              "{apt.notes}"
            </p>
          )}
          {/* status actions */}
          <div
            style={{
              display: "flex",
              gap: 5,
              flexWrap: "wrap",
              marginBottom: apt.buyer_phone ? 6 : 0,
            }}
          >
            {apt.status !== "confirmed" && (
              <button
                onClick={() => updateApptStatus(apt.id, "confirmed")}
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 5,
                  background: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.2)",
                  color: "#4ade80",
                  cursor: "pointer",
                }}
              >
                Confirm
              </button>
            )}
            {apt.status !== "cancelled" && (
              <button
                onClick={() => updateApptStatus(apt.id, "cancelled")}
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 5,
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  color: "#f87171",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            )}
            {apt.status !== "rescheduled" && (
              <button
                onClick={() => updateApptStatus(apt.id, "rescheduled")}
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 5,
                  background: "rgba(167,139,250,0.08)",
                  border: "1px solid rgba(167,139,250,0.2)",
                  color: "#c084fc",
                  cursor: "pointer",
                }}
              >
                Reschedule
              </button>
            )}
          </div>
          {/* WA reminder */}
          {apt.buyer_phone &&
            (editingReminder === apt.id ? (
              <div style={{ marginTop: 4 }}>
                <textarea
                  value={reminderMsg}
                  onChange={(e) => setReminderMsg(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 7,
                    color: "#e5e7eb",
                    fontSize: 11,
                    padding: "8px 10px",
                    outline: "none",
                    boxSizing: "border-box",
                    fontFamily: "'DM Sans', sans-serif",
                    resize: "vertical",
                    lineHeight: 1.5,
                    marginBottom: 6,
                  }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => {
                      const phone = apt.buyer_phone.replace(/\D/g, "");
                      window.open(
                        `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${encodeURIComponent(reminderMsg)}`,
                        "_blank",
                        "noopener,noreferrer",
                      );
                      setEditingReminder(null);
                    }}
                    style={{
                      fontSize: 10,
                      padding: "3px 9px",
                      borderRadius: 6,
                      background: "rgba(37,211,102,0.1)",
                      border: "1px solid rgba(37,211,102,0.2)",
                      color: "#4ade80",
                      cursor: "pointer",
                    }}
                  >
                    Send
                  </button>
                  <button
                    onClick={() => setEditingReminder(null)}
                    style={{
                      fontSize: 10,
                      padding: "3px 9px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#6b7280",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingReminder(apt.id);
                  setReminderMsg(defaultReminder);
                }}
                style={{
                  fontSize: 10,
                  padding: "3px 9px",
                  borderRadius: 6,
                  background: "rgba(37,211,102,0.1)",
                  border: "1px solid rgba(37,211,102,0.2)",
                  color: "#4ade80",
                  cursor: "pointer",
                }}
              >
                WA Reminder
              </button>
            ))}
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
            Bookings ({appointments.length})
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            {["confirmed", "pending"].map((s) => {
              const count = appointments.filter((a) => a.status === s).length;
              if (!count) return null;
              const sc = statusColors[s];
              return (
                <span
                  key={s}
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: sc.bg,
                    border: `1px solid ${sc.border}`,
                    color: sc.tx,
                    textTransform: "capitalize",
                  }}
                >
                  {count} {s}
                </span>
              );
            })}
          </div>
        </div>
        {appointments.length === 0 && (
          <div
            style={{ padding: "40px 0", textAlign: "center", color: "#374151" }}
          >
            <Phone size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: 13 }}>No bookings yet.</p>
          </div>
        )}
        {todayApts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 11,
                fontWeight: 600,
                color: "#fbbf24",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Calendar size={11} /> Today ({todayApts.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {todayApts.map(renderApptCard)}
            </div>
          </div>
        )}
        {upcomingApts.length > 0 && (
          <div>
            {todayApts.length > 0 && (
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#374151",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Upcoming
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upcomingApts.map(renderApptCard)}
            </div>
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
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
      setAvatarUrl(bustedUrl);
      setProfile((p) => ({ ...p, avatar_url: bustedUrl }));
      setAvatarUploading(false);
      toast.success("Profile photo updated");
    };

    const handleSave = async () => {
      setSettingsSaving(true);
      const phone = "+60" + localPhone.replace(/\D/g, "");
      await supabase
        .from("profiles")
        .update({
          full_name: settingsForm.full_name,
          whatsapp_number: phone,
        })
        .eq("id", userId);
      setProfile((p) => ({
        ...p,
        full_name: settingsForm.full_name,
        whatsapp_number: phone,
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
              : <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, color: "#fff", border: "2px solid rgba(255,255,255,0.1)" }}>
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
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 6 }}>Username / Slug</label>
            <input
              value={profile?.slug || ""}
              readOnly
              style={{ ...inputStyle, color: "#4b5563", cursor: "not-allowed", background: "rgba(255,255,255,0.02)" }}
            />
            <p style={{ margin: "5px 0 0", fontSize: 10, color: "#374151" }}>Contact support to change your username.</p>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}} div:hover .avatar-cam-icon{opacity:1!important}`}</style>
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
            background: mergeStatus === "success" ? "#16a34a" : "#2563eb",
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
                opacity: !addLeadForm.buyer_name || addLeadSaving ? 0.6 : 1,
              }}
            >
              {addLeadSaving ? "Saving..." : "Add Lead"}
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
              const phone = (waModalLead.phone || "").replace(/\D/g, "");
              if (phone) {
                window.open(
                  `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${encodeURIComponent(waModalMsg)}`,
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
                dealer_id: waModalLead.dealer_id ?? null,
              });
              setStaleLeads((p) => p.filter((l) => l.id !== waModalLead.id));
              setLeads((p) =>
                p.map((l) =>
                  l.id === waModalLead.id ? { ...l, updated_at: now } : l,
                ),
              );
              setWaModalLead(null);
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

  const dismissTour = () => {
    setTourStep(null);
    setTourTarget(null);
    supabase.from("profiles").update({ onboarding_tour_done: true }).eq("id", userId);
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
          style={{
            ...bubbleStyle,
            background: "#111827",
            border: "1px solid rgba(59,130,246,0.3)",
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
              <div key={i} style={{ height: 2, flex: i === tourStep ? 2 : 1, borderRadius: 99, background: i <= tourStep ? "#3b82f6" : "rgba(255,255,255,0.08)", transition: "flex 0.25s" }} />
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
              style={{ padding: "7px 16px", borderRadius: 7, background: "#2563eb", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
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
            borderTopColor: "#2563eb",
            animation: "spin 0.8s linear infinite",
          }}
        />
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
                  color: isActive ? "#93c5fd" : "#4b5563",
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
                  activeTab === tab ? "rgba(37,99,235,0.15)" : "transparent",
                border:
                  activeTab === tab
                    ? "0.5px solid rgba(37,99,235,0.25)"
                    : "0.5px solid transparent",
                color: activeTab === tab ? "#93c5fd" : "#6b7280",
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
          {activeTab === "enquiries" && renderEnquiries()}
          {activeTab === "bookings" && renderBookings()}
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
                    marginBottom: 12,
                    fontFamily: "inherit",
                  }}
                />

                {broadcastDone ? (
                  <div className="flex items-center gap-2 justify-center py-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <p className="text-green-400 text-sm font-medium">
                      All {capped.length} tabs opened!
                    </p>
                  </div>
                ) : broadcastProgress ? (
                  <div className="text-center py-2">
                    <p className="text-orange-300 text-sm font-medium">
                      Opening {broadcastProgress.current} of{" "}
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
              <textarea
                value={aiCaptions[aiCaptionCar.id]?.[aiCaptionTab] ?? ""}
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
                  generateAiCaptions(aiCaptionCar);
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
    </div>
  );
}
