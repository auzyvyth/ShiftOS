import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import { useRoleRedirect } from "../hooks/useRoleRedirect";
import TikTokStudioV3 from "../components/TikTokStudioV3";
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
  Plus,
  User,
  Phone,
  Tag,
  X,
  CheckCircle2,
  Send,
  LayoutGrid,
  Users,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

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
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize flex-shrink-0 ${styles[status] ?? "bg-gray-700 text-gray-400 border-gray-600"}`}
    >
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SalesmanPanel() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const redirectByRole = useRoleRedirect("salesman");

  const [profile, setProfile] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [subTab, setSubTab] = useState("overview");
  const [sidenavCollapsed, setSidenavCollapsed] = useState(false);

  // ── unique-link copy state
  const [copied, setCopied] = useState(false);

  // ── stats
  const [myClicks, setMyClicks] = useState(0);
  const [myEnquiries, setMyEnquiries] = useState(0);
  const [soldCount, setSoldCount] = useState(0);
  const [soldLoading, setSoldLoading] = useState(true);

  // ── commission strip  (null = still loading)
  const [commission, setCommission] = useState(null);

  // ── my listings
  const [myListings, setMyListings] = useState([]);
  const [listingCopied, setListingCopied] = useState({}); // { [carId]: 'link' | 'wa' | null }
  const [tiktokListing, setTiktokListing] = useState(null);

  // ── appointments
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

  // Leads
  const [leads, setLeads] = useState([]);
  const [staleLeads, setStaleLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadScores, setLeadScores] = useState({});
  const [scoreLoading, setScoreLoading] = useState(false);

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
  });
  const [addLeadSaving, setAddLeadSaving] = useState(false);

  // Monthly target
  const [thisMonthSales, setThisMonthSales] = useState(0);

  // Per-listing analytics
  const [carStatsMap, setCarStatsMap] = useState({});
  const [rawEvents, setRawEvents] = useState([]);

  // Manager notes
  const [managerNotes, setManagerNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // Commission breakdown
  const [commissionDetails, setCommissionDetails] = useState([]);

  // ── stale leads (48h no contact, exclude won/lost)
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

  // ── page title
  useEffect(() => {
    document.title = t("salesman.meta.title", {
      defaultValue: "ShiftOS · My Panel",
    });
  }, [t]);

  // ── auth + profile ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error || !data.session) {
        setLoading(false);
        navigate("/login");
        return;
      }

      setUserId(data.session.user.id);
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.session.user.id)
        .maybeSingle();

      if (profileError || !profileData) {
        setLoading(false);
        navigate("/login");
        return;
      }
      if (redirectByRole(profileData.role)) {
        setLoading(false);
        return;
      }

      setProfile(profileData);
      setLoading(false);

      if (profileData.slug) {
        const { data: evts } = await supabase
          .from("analytics_events")
          .select("event_type, created_at")
          .eq("salesman_slug", profileData.slug);
        if (evts) {
          setRawEvents(evts);
          setMyClicks(
            evts.filter(
              (e) =>
                e.event_type === "link_visit" || e.event_type === "car_view",
            ).length,
          );
          setMyEnquiries(
            evts.filter(
              (e) =>
                e.event_type === "whatsapp_click" ||
                e.event_type === "call_click",
            ).length,
          );
        }

        // Per-listing analytics — must run here where profileData is guaranteed
        supabase
          .from("analytics_events")
          .select("car_id, event_type")
          .eq("salesman_slug", profileData.slug)
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
    });
  }, [navigate]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── userId-dependent data ─────────────────────────────────────────────────
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
        { event: "UPDATE", schema: "public", table: "car_listings" },
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
        { event: "*", schema: "public", table: "car_listings" },
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
            phone: l.phone ? "present" : "missing",
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
            aiData?.reply ??
            aiData?.content ??
            aiData?.text ??
            aiData?.message ??
            "";
          const parsed = JSON.parse(
            typeof raw === "string" ? raw : JSON.stringify(raw),
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
  // ─────────────────────────────────────────────────────────────────────────

  const chartRefs = useRef({});

  // ── mobile sidenav collapse ───────────────────────────────────────────────
  useEffect(() => {
    const check = () => setSidenavCollapsed(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── sparkline charts ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.Chart && !document.getElementById("chartjs-cdn")) {
      const s = document.createElement("script");
      s.id = "chartjs-cdn";
      s.src = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
      s.onload = () => drawSparklines();
      document.head.appendChild(s);
    } else if (window.Chart) {
      drawSparklines();
    }

    function bucket7Days(rows, dateKey) {
      const counts = Array(7).fill(0);
      const now = Date.now();
      rows.forEach((r) => {
        const diff = Math.floor((now - new Date(r[dateKey]).getTime()) / 86400000);
        if (diff >= 0 && diff < 7) counts[6 - diff]++;
      });
      return counts;
    }

    function sparkline(id, data, color) {
      const canvas = document.getElementById(id);
      if (!canvas || !window.Chart) return;
      if (chartRefs.current[id]) chartRefs.current[id].destroy();
      chartRefs.current[id] = new window.Chart(canvas, {
        type: "line",
        data: {
          labels: data.map((_, i) => i),
          datasets: [{ data, borderColor: color, borderWidth: 1.5, pointRadius: 0, fill: true, backgroundColor: color + "22", tension: 0.4 }],
        },
        options: { animation: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } },
      });
    }

    function drawSparklines() {
      const enqData = bucket7Days(enquiries, "created_at");
      const commData = bucket7Days(commissionDetails, "sold_at");
      sparkline("spark-enquiries", enqData, "#3b82f6");
      sparkline("spark-commission", commData, "#22c55e");
    }

    return () => {
      Object.values(chartRefs.current).forEach((c) => c?.destroy());
      chartRefs.current = {};
    };
  }, [enquiries, commissionDetails]);

  // ── main charts (line + donut) ────────────────────────────────────────────
  useEffect(() => {
    if (!window.Chart) return;

    // Build 14-day labels + data
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (13 - i));
      return d;
    });
    const labels = days.map((d) =>
      d.toLocaleDateString("en-MY", { month: "short", day: "numeric" }),
    );
    const viewCounts = days.map((day) => {
      const next = new Date(day); next.setDate(next.getDate() + 1);
      return rawEvents.filter((e) => {
        const t = new Date(e.created_at).getTime();
        return (e.event_type === "car_view" || e.event_type === "link_visit") &&
          t >= day.getTime() && t < next.getTime();
      }).length;
    });
    const enqCounts = days.map((day) => {
      const next = new Date(day); next.setDate(next.getDate() + 1);
      return rawEvents.filter((e) => {
        const t = new Date(e.created_at).getTime();
        return (e.event_type === "whatsapp_click" || e.event_type === "call_click") &&
          t >= day.getTime() && t < next.getTime();
      }).length;
    });

    const tickStyle = { color: "rgba(255,255,255,0.25)", font: { size: 10 } };
    const gridStyle = { color: "rgba(255,255,255,0.05)" };

    // Line chart
    const lineCanvas = document.getElementById("chart-line");
    if (lineCanvas) {
      if (chartRefs.current["chart-line"]) chartRefs.current["chart-line"].destroy();
      chartRefs.current["chart-line"] = new window.Chart(lineCanvas, {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Views", data: viewCounts, borderColor: "#60a5fa", borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.4 },
            { label: "Enquiries", data: enqCounts, borderColor: "#fbbf24", borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.4, borderDash: [4, 3] },
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
      new: "#60a5fa", contacted: "#fbbf24", viewing_booked: "#c084fc",
      negotiating: "#fb923c", deposit_taken: "#4ade80", won: "#22c55e",
    };
    const stageKeys = Object.keys(STAGE_COLORS);
    const stageCounts = stageKeys.map((s) => leads.filter((l) => l.stage === s).length);

    const donutCanvas = document.getElementById("chart-donut");
    if (donutCanvas) {
      if (chartRefs.current["chart-donut"]) chartRefs.current["chart-donut"].destroy();
      chartRefs.current["chart-donut"] = new window.Chart(donutCanvas, {
        type: "doughnut",
        data: {
          labels: stageKeys,
          datasets: [{ data: stageCounts, backgroundColor: stageKeys.map((s) => STAGE_COLORS[s]), borderWidth: 0, hoverOffset: 2 }],
        },
        options: {
          animation: false,
          cutout: "68%",
          plugins: { legend: { display: false }, tooltip: { enabled: true } },
        },
      });
    }
  }, [rawEvents, leads]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "https://xdrive.my/login";
  };

  const uniqueLink = profile?.slug
    ? `${window.location.origin}/cars?ref=${profile.slug}`
    : null;

  const handleCopy = () => {
    if (!uniqueLink) return;
    navigator.clipboard.writeText(uniqueLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleListingCopy = (car, type) => {
    const link = `${window.location.origin}/cars/${car.slug}?ref=${profile?.slug || ""}`;
    let text = link;
    if (type === "wa") {
      const price = Number(car.selling_price || 0);
      text = [
        `🚗 ${car.year} ${car.brand} ${car.model}${car.variant ? " " + car.variant : ""}`,
        `💰 RM ${price.toLocaleString()}`,
        `📍 ${car.city || profile?.location || "Malaysia"}`,
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
        <div className="text-gray-500 text-sm tracking-widest uppercase">
          Loading...
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllNotifsRead = async () => {
    const unread = notifications.filter((n) => !n.is_read).map((n) => n.id);
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
      p.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
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
Car they asked about: ${carName}${price ? ` priced at ${price}` : ""}
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
        data?.reply ?? data?.content ?? data?.text ?? data?.message ?? "";
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
        `Hi ${name}! 👋 Nampak you ada interest dalam ${carName}${price ? ` (RM ${price})` : ""}. Best lah tu — kereta ni memang power! Boleh kita discuss lebih lanjut? Saya ready nak tolong you 😊`,
    },
    {
      label: "Book a test drive",
      build: (name, carName) =>
        `Hi ${name}! Test drive dulu baru decide — betul tak? 😄 ${carName} memang best bila dah rasa sendiri. Bila you free nak mai test? Saya boleh arrange untuk you anytime!`,
    },
    {
      label: "Price negotiation",
      build: (name, carName, price) =>
        `Hi ${name}! Faham faham, semua orang nak harga terbaik 😅 ${carName}${price ? ` ni listed RM ${price}` : ""} tapi kita boleh discuss. You ada budget dalam range mana? Saya cuba tolong cari jalan 🙏`,
    },
    {
      label: "Deposit to reserve",
      build: (name, carName) =>
        `Hi ${name}! Just nak inform — ${carName} ni ada few people tengah tengok jugak. Kalau you serious, boleh letak deposit dulu untuk reserve. Nanti takut kena kebas orang lain pulak 😬 Nak saya explain process dia?`,
    },
  ];

  const fireTemplate = (enquiry, tpl) => {
    const car = enquiry.car_listings;
    const name = enquiry.buyer_name || "kawan";
    const carName = car ? `${car.brand} ${car.model}` : "kereta ni";
    const price = car?.selling_price
      ? Number(car.selling_price).toLocaleString("en-MY")
      : null;
    const text = tpl.build(name, carName, price);
    navigator.clipboard.writeText(text);
    const phone = (enquiry.buyer_phone || "").replace(/\D/g, "");
    if (phone) {
      window.open(
        `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
    setTemplateToast(enquiry.id);
    setTimeout(() => setTemplateToast(null), 2000);
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

  const updateLeadStage = async (leadId, stage) => {
    await supabase
      .from("leads")
      .update({ stage, updated_at: new Date().toISOString() })
      .eq("id", leadId);
    setLeads((p) => p.map((l) => (l.id === leadId ? { ...l, stage } : l)));
  };

  const pingWA = async (lead) => {
    const car = lead.car_listings;
    const carName = car ? `${car.brand} ${car.model}` : "kereta tu";
    const name = lead.buyer_name || "kawan";
    const phone = (lead.phone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Hi ${name}! Macam mana, still interested dalam ${carName} tu? Jom kita discuss lagi — saya boleh tolong cari yang terbaik untuk you 😊`,
    );
    if (phone) {
      window.open(
        `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${msg}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
    const now = new Date().toISOString();
    await supabase.from("leads").update({ updated_at: now }).eq("id", lead.id);
    setStaleLeads((p) => p.filter((l) => l.id !== lead.id));
    setLeads((p) =>
      p.map((l) => (l.id === lead.id ? { ...l, updated_at: now } : l)),
    );
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
        stage: "new",
        lead_source: "salesman",
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

  const LEAD_STAGES = [
    "new",
    "contacted",
    "viewing_booked",
    "test_drive",
    "negotiating",
    "deposit_taken",
    "won",
    "lost",
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
  };

  const renderAppt = (appt, i, total, isToday) => {
    const apptCar = appt.car_listings;
    const apptCarName = apptCar
      ? `${apptCar.year} ${apptCar.brand} ${apptCar.model}`
      : null;
    const dt = formatApptDate(appt.appointment_date);
    const phone = appt.buyer_phone?.replace(/\D/g, "") || "";
    const waText = encodeURIComponent(
      `Hi ${appt.buyer_name || "there"}, this is ${profile?.full_name || "your salesperson"} from ${profile?.dealership || "our dealership"}. Confirming your viewing on ${dt.day} ${dt.month} at ${dt.time}${apptCarName ? ` for the ${apptCarName}` : ""}. See you then! 😊`,
    );
    const statusColor =
      {
        confirmed: "bg-green-500/15 text-green-400 border-green-500/30",
        cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
        rescheduled: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
        pending: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      }[appt.status] ?? "bg-gray-700/40 text-gray-400 border-gray-600";

    const isNew = Date.now() - new Date(appt.created_at) < 7200000;

    return (
      <div
        key={appt.id}
        className={`flex items-start gap-4 py-3 ${i < total - 1 ? "border-b border-gray-800" : ""}`}
        style={{
          background: isToday ? "rgba(59,130,246,0.03)" : "transparent",
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
                >
                  NEW
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
              📞 {appt.buyer_phone}
            </p>
          )}
          {appt.notes && (
            <p className="text-xs text-gray-600 italic mt-0.5 truncate">
              💬 "{appt.notes}"
            </p>
          )}
        </div>
        {phone && (
          <button
            onClick={() =>
              window.open(
                `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${waText}`,
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
            <MessageSquare className="w-3 h-3" />
            WA
          </button>
        )}
      </div>
    );
  };

  // ── render helpers ────────────────────────────────────────────────────────
  const CARD = { background: "rgba(255,255,255,0.032)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 14 };

  const renderDashboard = () => {
    const stale = [...staleLeads].sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
    const activityFeed = [
      ...appointments.map(a => ({ type: "booking", label: `Booking: ${a.buyer_name || "—"} for ${a.car_listings?.brand || "a car"}`, ts: a.created_at, dot: "#22c55e" })),
      ...enquiries.map(e => ({ type: "enquiry", label: `Enquiry from ${e.buyer_name || "someone"} — ${e.car_listings?.brand || ""}`, ts: e.created_at, dot: "#60a5fa" })),
      ...leads.filter(l => l.updated_at).map(l => ({ type: "lead", label: `Lead: ${l.buyer_name || "—"} (${l.stage || "new"})`, ts: l.updated_at, dot: "#fbbf24" })),
      ...commissionDetails.map(c => ({ type: "sale", label: `Sold: ${[c.year, c.brand, c.model].filter(Boolean).join(" ")}`, ts: c.sold_at, dot: "#4ade80" })),
    ].filter(i => i.ts).sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 8);

    return (
      <>
        {/* Sub-tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {[["overview", "Overview"], ["performance", "Performance"], ["month", "This month"]].map(([key, label]) => (
            <button key={key} onClick={() => setSubTab(key)} style={{ background: subTab === key ? "rgba(29,78,216,0.2)" : "transparent", border: subTab === key ? "0.5px solid rgba(29,78,216,0.35)" : "0.5px solid transparent", borderRadius: 7, color: subTab === key ? "#93c5fd" : "#64748b", fontSize: 13, fontWeight: subTab === key ? 600 : 400, padding: "6px 14px", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
          <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}><span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Enquiries</span><MessageSquare size={14} color="#3b82f6" /></div>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#f1f5f9", lineHeight: 1 }}>{myEnquiries}</p>
            <canvas id="spark-enquiries" height="36" style={{ width: "100%", marginTop: 10, display: "block" }} />
          </div>
          <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}><span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Active Listings</span><Car size={14} color="#a78bfa" /></div>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#f1f5f9", lineHeight: 1 }}>{myListings.length}</p>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#475569" }}>{myListings.filter(l => l.status === "available").length} available</p>
          </div>
          <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}><span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Commission</span><TrendingUp size={14} color="#22c55e" /></div>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#f1f5f9", lineHeight: 1 }}>RM {commission !== null ? Number(commission).toLocaleString("en-MY") : "–"}</p>
            <canvas id="spark-commission" height="36" style={{ width: "100%", marginTop: 10, display: "block" }} />
          </div>
          <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}><span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Active Leads</span><Users size={14} color="#f59e0b" /></div>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#f1f5f9", lineHeight: 1 }}>{leads.filter(l => l.stage !== "won" && l.stage !== "lost").length}</p>
            {staleLeads.length > 0 && <p style={{ margin: "6px 0 0", fontSize: 11, color: "#ef4444" }}>{staleLeads.length} stale</p>}
          </div>
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={CARD}>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>Views &amp; enquiries — last 14 days</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: "#60a5fa" }} /><span style={{ fontSize: 11, color: "#9ca3af" }}>Views</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 16, height: 2, background: "repeating-linear-gradient(to right,#fbbf24 0,#fbbf24 4px,transparent 4px,transparent 7px)" }} /><span style={{ fontSize: 11, color: "#9ca3af" }}>Enquiries</span></div>
            </div>
            <div style={{ position: "relative", height: 130 }}><canvas id="chart-line" style={{ width: "100%", height: "100%" }} /></div>
          </div>
          <div style={CARD}>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>Lead stage breakdown</p>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 110, height: 110, flexShrink: 0 }}><canvas id="chart-donut" style={{ width: "100%", height: "100%" }} /></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[["new","#60a5fa","New"],["contacted","#fbbf24","Contacted"],["viewing_booked","#c084fc","Viewing booked"],["negotiating","#fb923c","Negotiating"],["deposit_taken","#4ade80","Deposit taken"],["won","#22c55e","Won"]].map(([s,c,lbl]) => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{lbl} ({leads.filter(l => l.stage === s).length})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display: "grid", gridTemplateColumns: stale.length === 0 ? "1fr" : "1fr 1fr", gap: 12 }}>
          {stale.length > 0 && (
            <div style={CARD}>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>Follow-up nudges</p>
              {stale.slice(0, 3).map((lead) => {
                const daysIdle = Math.floor((Date.now() - new Date(lead.updated_at)) / 86400000);
                const carName = lead.car_listings ? `${lead.car_listings.brand || ""} ${lead.car_listings.model || ""}`.trim() : "";
                return (
                  <div key={lead.id} style={{ background: "rgba(251,146,60,0.06)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ flexShrink: 0, width: 8, height: 8, borderRadius: "50%", background: "#fb923c" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, color: "#fdba74", fontWeight: 500 }}>{lead.buyer_name || "—"}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#92400e" }}>{daysIdle}d idle{carName ? ` · ${carName}` : ""}</p>
                    </div>
                    <button onClick={() => pingWA(lead)} style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)", color: "#4ade80", fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", flexShrink: 0 }}>
                      Ping WA
                    </button>
                  </div>
                );
              })}
              {stale.length > 3 && <p style={{ margin: 0, fontSize: 11, color: "#374151" }}>{stale.length - 3} more stale lead{stale.length - 3 !== 1 ? "s" : ""}</p>}
            </div>
          )}
          <div style={CARD}>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>Activity feed</p>
            {activityFeed.length === 0 && <p style={{ fontSize: 12, color: "#374151", margin: "12px 0 0" }}>No recent activity yet.</p>}
            {activityFeed.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < activityFeed.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#9ca3af", flex: 1 }}>{item.label}</span>
                <span style={{ fontSize: 10, color: "#374151", flexShrink: 0 }}>{timeAgo(item.ts)}</span>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  };

  const renderListings = () => (
    <div>
      <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>My Listings ({myListings.length})</p>
      {myListings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#374151" }}>No listings assigned yet.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
          {myListings.map((car) => {
            const stats = carStatsMap[car.id] ?? {};
            const views = stats.views || 0;
            const enqs = stats.enquiries || 0;
            const cvr = views > 0 ? (enqs / views) * 100 : null;
            const cvrFill = cvr !== null ? Math.min(cvr * 10, 100) : 0;
            const isHot = cvr !== null && cvr > 6 && views > 3;
            const isStale = views > 10 && (cvr === 0 || cvr === null);
            const img = car.images?.[0];
            const name = [car.year, car.brand, car.model, car.variant].filter(Boolean).join(" ");
            const price = car.selling_price ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}` : "—";
            return (
              <div key={car.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
                {img ? (
                  <img src={img} alt={name} style={{ width: "100%", height: 150, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: 150, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Car size={32} color="#374151" />
                  </div>
                )}
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb", lineHeight: 1.3, flex: 1, marginRight: 8 }}>{name}</p>
                    <StatusBadge status={car.status} />
                  </div>
                  <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#60a5fa" }}>{price}</p>
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: "#4b5563" }}>
                    {[car.mileage ? `${Number(car.mileage).toLocaleString()} km` : null, car.transmission, car.colour].filter(Boolean).join(" · ")}
                  </p>
                  {/* CVR heatmap */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: "#4b5563" }}>{views} views · {enqs} enquiries</span>
                      {isHot && <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>🔥 Hot</span>}
                      {isStale && <span style={{ fontSize: 10, color: "#6b7280" }}>💤 Stale</span>}
                    </div>
                    <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${cvrFill}%`, background: isHot ? "#ef4444" : "#3b82f6", borderRadius: 99, transition: "width 0.3s" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => handleListingCopy(car, "link")} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, background: listingCopied[car.id] === "link" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: listingCopied[car.id] === "link" ? "#4ade80" : "#9ca3af", cursor: "pointer" }}>
                      {listingCopied[car.id] === "link" ? "✓ Copied" : "Copy Link"}
                    </button>
                    <button onClick={() => handleListingCopy(car, "wa")} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer" }}>WA Caption</button>
                    <button onClick={() => openBroadcast(car)} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c", cursor: "pointer" }}>Broadcast</button>
                    <button onClick={() => generateAiCaptions(car)} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", color: "#c084fc", cursor: "pointer" }}>AI Caption</button>
                    <button onClick={() => setTiktokListing(car)} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", cursor: "pointer" }}>TikTok</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderBookings = () => (
    <div>
      <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>Upcoming Bookings ({appointments.length})</p>
      {appointments.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#374151" }}>No upcoming bookings.</div>
      ) : (
        <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "0 16px" }}>
          {appointments.map((appt, i) => {
            const isToday = new Date(appt.appointment_date).toDateString() === new Date().toDateString();
            return renderAppt(appt, i, appointments.length, isToday);
          })}
        </div>
      )}
    </div>
  );

  const renderLeads = () => (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>Lead Pipeline ({leads.length})</p>
        <button onClick={() => setShowAddLead(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1d4ed8", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, padding: "7px 12px", cursor: "pointer" }}>
          <Plus size={13} /> Add Lead
        </button>
      </div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {LEAD_STAGES.filter(s => s !== "lost").map(stage => {
          const sc = STAGE_COLOR[stage] || {};
          const stageLeads = leads.filter(l => l.stage === stage);
          return (
            <div key={stage} style={{ minWidth: 200, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: sc.tx || "#9ca3af", textTransform: "capitalize" }}>{stage.replace("_", " ")}</span>
                <span style={{ fontSize: 10, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.tx, borderRadius: 99, padding: "1px 6px" }}>{stageLeads.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stageLeads.length === 0 && <div style={{ height: 60, borderRadius: 10, border: "1px dashed rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 11, color: "#374151" }}>Empty</span></div>}
                {stageLeads.map(lead => (
                  <div key={lead.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 12px" }}>
                    <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{lead.buyer_name || "—"}</p>
                    {lead.phone && <p style={{ margin: "0 0 6px", fontSize: 11, color: "#4b5563" }}>📞 {lead.phone}</p>}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {LEAD_STAGES.filter(s => s !== stage).slice(0, 2).map(nextStage => (
                        <button key={nextStage} onClick={() => updateLeadStage(lead.id, nextStage)} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}>
                          → {nextStage.replace("_", " ")}
                        </button>
                      ))}
                      {lead.phone && (
                        <button onClick={() => pingWA(lead)} style={{ fontSize: 10, padding: "3px 7px", borderRadius: 5, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#4ade80", cursor: "pointer" }}>WA</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderEnquiries = () => (
    <div>
      <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>Enquiries ({enquiries.length})</p>
      {enquiries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#374151" }}>No enquiries yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {enquiries.map(enq => {
            const car = enq.car_listings;
            const carName = car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : null;
            const phone = (enq.buyer_phone || "").replace(/\D/g, "");
            return (
              <div key={enq.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{enq.buyer_name || "—"}</p>
                    {carName && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#60a5fa" }}>{carName}</p>}
                  </div>
                  <span style={{ fontSize: 10, color: "#374151" }}>{timeAgo(enq.created_at)}</span>
                </div>
                {enq.buyer_message && <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>"{enq.buyer_message}"</p>}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {phone && (
                    <button onClick={() => window.open(`https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}`, "_blank")} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 7, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)", color: "#4ade80", cursor: "pointer" }}>
                      WhatsApp
                    </button>
                  )}
                  <button onClick={() => setOpenTemplateId(openTemplateId === enq.id ? null : enq.id)} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer" }}>
                    Templates
                  </button>
                  <button onClick={() => { setOpenAiReplyId(enq.id); generateAiReply(enq); }} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 7, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", color: "#c084fc", cursor: "pointer" }}>
                    AI Reply
                  </button>
                </div>
                {openTemplateId === enq.id && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {WA_TEMPLATES.map((tpl, ti) => (
                      <button key={ti} onClick={() => fireTemplate(enq, tpl)} style={{ textAlign: "left", fontSize: 11, padding: "6px 10px", borderRadius: 7, background: templateToast === enq.id ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: templateToast === enq.id ? "#4ade80" : "#9ca3af", cursor: "pointer" }}>
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                )}
                {openAiReplyId === enq.id && (
                  <div style={{ marginTop: 10 }}>
                    {aiLoading ? (
                      <div className="caption-skeleton" style={{ height: 60, width: "100%" }} />
                    ) : aiDrafts[enq.id] ? (
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

  const renderAnalytics = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ textAlign: "center" }}>
        <TrendingUp size={32} color="#374151" style={{ marginBottom: 12 }} />
        <p style={{ margin: 0, fontSize: 14, color: "#4b5563", fontWeight: 500 }}>Analytics coming soon</p>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#374151" }}>Detailed performance data will appear here.</p>
      </div>
    </div>
  );

  const renderTeam = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ textAlign: "center" }}>
        <Users size={32} color="#374151" style={{ marginBottom: 12 }} />
        <p style={{ margin: 0, fontSize: 14, color: "#4b5563", fontWeight: 500 }}>Team view coming soon</p>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#374151" }}>See your team's performance here.</p>
      </div>
    </div>
  );

  return (
    <div
      style={{ display: "flex", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: "#fff" }}
    >
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');
        .lead-score-wrap:hover .lead-score-tip { display: block !important; }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        @keyframes hotpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.5)} }
        .caption-skeleton { background: linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%); background-size:800px 100%; animation:shimmer 1.4s infinite linear; border-radius:8px; }
        .hot-dot { animation: hotpulse 1.5s ease-in-out infinite; }
      `}</style>

      {/* ─── Sidenav ─── */}
      <nav
        style={{
          width: sidenavCollapsed ? 56 : 200,
          flexShrink: 0,
          background: "#080a12",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          position: "sticky",
          top: 0,
          height: "100vh",
          transition: "width 0.2s ease",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        <div style={{ padding: sidenavCollapsed ? "14px 0" : 16, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: sidenavCollapsed ? "center" : "flex-start", gap: 8 }}>
          <div style={{ width: 28, height: 28, background: "#2563eb", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "'Bebas Neue', sans-serif", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            S
          </div>
          {!sidenavCollapsed && (
            <div>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "2px", color: "#fff", lineHeight: 1, margin: 0 }}>SHIFTOS</p>
              <p style={{ fontSize: 10, color: "#4b5563", marginTop: 2, marginBottom: 0 }}>· My Panel</p>
            </div>
          )}
        </div>

        {/* MAIN section */}
        {!sidenavCollapsed && <p style={{ fontSize: 10, color: "#374151", textTransform: "uppercase", letterSpacing: "0.1em", padding: "12px 16px 4px", fontWeight: 600, margin: 0 }}>Main</p>}
        {[
          { tab: "dashboard", label: "Dashboard", icon: <LayoutGrid style={{ width: 14, height: 14, flexShrink: 0 }} />, badge: null },
          { tab: "listings",  label: "Listings",  icon: <Car style={{ width: 14, height: 14, flexShrink: 0 }} />, badge: myListings.length || null },
          { tab: "bookings",  label: "Bookings",  icon: <Clock style={{ width: 14, height: 14, flexShrink: 0 }} />, badge: appointments.length || null },
        ].map(({ tab, label, icon, badge }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: sidenavCollapsed ? "center" : undefined,
              gap: sidenavCollapsed ? 0 : 10,
              padding: sidenavCollapsed ? "10px 0" : "8px 16px",
              margin: sidenavCollapsed ? "1px 4px" : "1px 8px",
              borderRadius: 8,
              cursor: "pointer",
              position: "relative",
              background: activeTab === tab ? "rgba(37,99,235,0.15)" : "transparent",
              border: activeTab === tab ? "0.5px solid rgba(37,99,235,0.25)" : "0.5px solid transparent",
              color: activeTab === tab ? "#93c5fd" : "#6b7280",
              fontSize: 13,
              fontWeight: 500,
              width: sidenavCollapsed ? "calc(100% - 8px)" : "calc(100% - 16px)",
              textAlign: sidenavCollapsed ? "center" : "left",
            }}
          >
            {icon}
{!sidenavCollapsed && <span style={{ flex: 1 }}>{label}</span>}
            {badge ? (
              sidenavCollapsed
                ? <span style={{ position: "absolute", top: 5, right: 5, width: 6, height: 6, background: "#3b82f6", borderRadius: "50%" }} />
                : <span style={{ fontSize: 10, background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.3)", color: "#93c5fd", borderRadius: 99, padding: "1px 6px" }}>{badge}</span>
            ) : null}
          </button>
        ))}

        {/* CRM section */}
        {!sidenavCollapsed && <p style={{ fontSize: 10, color: "#374151", textTransform: "uppercase", letterSpacing: "0.1em", padding: "12px 16px 4px", fontWeight: 600, margin: 0 }}>CRM</p>}
        {[
          { tab: "leads",     label: "Leads",     icon: <User style={{ width: 14, height: 14, flexShrink: 0 }} />, badge: null },
          { tab: "analytics", label: "Analytics", icon: <TrendingUp style={{ width: 14, height: 14, flexShrink: 0 }} />, badge: null },
          { tab: "enquiries", label: "Enquiries", icon: <MessageSquare style={{ width: 14, height: 14, flexShrink: 0 }} />, badge: enquiries.filter(e => e.status === "new").length || null },
        ].map(({ tab, label, icon, badge }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: sidenavCollapsed ? "center" : undefined,
              gap: sidenavCollapsed ? 0 : 10,
              padding: sidenavCollapsed ? "10px 0" : "8px 16px",
              margin: sidenavCollapsed ? "1px 4px" : "1px 8px",
              borderRadius: 8,
              cursor: "pointer",
              position: "relative",
              background: activeTab === tab ? "rgba(37,99,235,0.15)" : "transparent",
              border: activeTab === tab ? "0.5px solid rgba(37,99,235,0.25)" : "0.5px solid transparent",
              color: activeTab === tab ? "#93c5fd" : "#6b7280",
              fontSize: 13,
              fontWeight: 500,
              width: sidenavCollapsed ? "calc(100% - 8px)" : "calc(100% - 16px)",
              textAlign: sidenavCollapsed ? "center" : "left",
            }}
          >
            {icon}
{!sidenavCollapsed && <span style={{ flex: 1 }}>{label}</span>}
            {badge ? (
              sidenavCollapsed
                ? <span style={{ position: "absolute", top: 5, right: 5, width: 6, height: 6, background: "#3b82f6", borderRadius: "50%" }} />
                : <span style={{ fontSize: 10, background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.3)", color: "#93c5fd", borderRadius: 99, padding: "1px 6px" }}>{badge}</span>
            ) : null}
          </button>
        ))}

        {/* TEAM section */}
        {!sidenavCollapsed && <p style={{ fontSize: 10, color: "#374151", textTransform: "uppercase", letterSpacing: "0.1em", padding: "12px 16px 4px", fontWeight: 600, margin: 0 }}>Team</p>}
        {[
          { tab: "team", label: "Team", icon: <Users style={{ width: 14, height: 14, flexShrink: 0 }} /> },
        ].map(({ tab, label, icon }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: sidenavCollapsed ? "center" : undefined,
              gap: sidenavCollapsed ? 0 : 10,
              padding: sidenavCollapsed ? "10px 0" : "8px 16px",
              margin: sidenavCollapsed ? "1px 4px" : "1px 8px",
              borderRadius: 8,
              cursor: "pointer",
              position: "relative",
              background: activeTab === tab ? "rgba(37,99,235,0.15)" : "transparent",
              border: activeTab === tab ? "0.5px solid rgba(37,99,235,0.25)" : "0.5px solid transparent",
              color: activeTab === tab ? "#93c5fd" : "#6b7280",
              fontSize: 13,
              fontWeight: 500,
              width: sidenavCollapsed ? "calc(100% - 8px)" : "calc(100% - 16px)",
              textAlign: sidenavCollapsed ? "center" : "left",
            }}
          >
            {icon}
{!sidenavCollapsed && <span>{label}</span>}
          </button>
        ))}

        {/* Bottom profile */}
        <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.06)", padding: sidenavCollapsed ? "12px 0" : "12px 16px", display: "flex", alignItems: "center", justifyContent: sidenavCollapsed ? "center" : "flex-start", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#93c5fd", flexShrink: 0 }}>
            {(profile?.full_name || profile?.slug || "S")[0].toUpperCase()}
          </div>
          {!sidenavCollapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.full_name || profile?.slug || "Salesman"}</p>
              <p style={{ fontSize: 10, color: "#4b5563", margin: 0, textTransform: "capitalize" }}>{profile?.role || "salesman"}</p>
            </div>
          )}
        </div>
      </nav>

      {/* ─── Right content pane ─── */}
      <div style={{ flex: 1, minWidth: 0, background: "#05070e", display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* Sticky topbar */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(5,7,14,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#f1f5f9", letterSpacing: "-0.3px" }}>
              {(() => {
                const h = new Date().getHours();
                return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
              })()}, {profile?.full_name?.split(" ")[0] || "there"} 👋
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b", marginTop: 2 }}>
              {new Date().toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" })}
              {profile?.dealership ? ` · ${profile.dealership}` : ""}
            </p>
          </div>
          <button
            onClick={() => setShowAddLead(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#1d4ed8", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, padding: "8px 14px", cursor: "pointer" }}
          >
            <Plus size={14} /> Add Lead
          </button>
          <button
            onClick={() => setNotifOpen(true)}
            style={{ position: "relative", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#94a3b8", padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <Bell size={16} />
            {notifications.filter((n) => !n.read).length > 0 && (
              <span style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, background: "#ef4444", borderRadius: "50%", border: "1.5px solid #05070e" }} />
            )}
          </button>
          <button
            onClick={handleLogout}
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#64748b", padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <LogOut size={15} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ padding: 24, flex: 1 }}>
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "listings" && renderListings()}
          {activeTab === "bookings" && renderBookings()}
          {activeTab === "leads" && renderLeads()}
          {activeTab === "analytics" && renderAnalytics()}
          {activeTab === "enquiries" && renderEnquiries()}
          {activeTab === "team" && renderTeam()}
        </div>
      </div>

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
                {/* header */}
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
                        : `This will open ${capped.length} WhatsApp tab${capped.length !== 1 ? "s" : ""}.`}
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
                    {eligible.length !== 1 ? "s" : ""} (not won/lost)
                  </span>
                </div>

                {/* message textarea */}
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

                {/* progress / success / action */}
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
            {/* header */}
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

            {/* tabs */}
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

            {/* content */}
            {aiCaptionLoading ? (
              <div className="space-y-2">
                <div
                  className="caption-skeleton"
                  style={{ height: 18, width: "70%" }}
                />
                <div
                  className="caption-skeleton"
                  style={{ height: 18, width: "90%" }}
                />
                <div
                  className="caption-skeleton"
                  style={{ height: 18, width: "55%" }}
                />
                <div
                  className="caption-skeleton"
                  style={{ height: 18, width: "80%" }}
                />
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

            {/* actions */}
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
      {tiktokListing && (
        <TikTokStudioV3
          listing={tiktokListing}
          onClose={() => setTiktokListing(null)}
        />
      )}
    </div>
  );
}
