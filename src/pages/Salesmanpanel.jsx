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
  const isMobile = useWindowSize() < 768;

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
        const diff = Math.floor(
          (now - new Date(r[dateKey]).getTime()) / 86400000,
        );
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
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      return rawEvents.filter((e) => {
        const t = new Date(e.created_at).getTime();
        return (
          (e.event_type === "car_view" || e.event_type === "link_visit") &&
          t >= day.getTime() &&
          t < next.getTime()
        );
      }).length;
    });
    const enqCounts = days.map((day) => {
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      return rawEvents.filter((e) => {
        const t = new Date(e.created_at).getTime();
        return (
          (e.event_type === "whatsapp_click" ||
            e.event_type === "call_click") &&
          t >= day.getTime() &&
          t < next.getTime()
        );
      }).length;
    });

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
              backgroundColor: stageKeys.map((s) => STAGE_COLORS[s]),
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
  }, [rawEvents, leads, activeTab, subTab]);

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

  const updateApptStatus = async (apptId, newStatus) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === apptId ? { ...a, status: newStatus } : a)),
    );
    await supabase
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", apptId);
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
          ["performance", "Performance"],
          ["month", "This month"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            style={{
              background:
                subTab === key ? "rgba(29,78,216,0.2)" : "transparent",
              border:
                subTab === key
                  ? "0.5px solid rgba(29,78,216,0.35)"
                  : "0.5px solid transparent",
              borderRadius: 7,
              color: subTab === key ? "#93c5fd" : "#64748b",
              fontSize: 13,
              fontWeight: subTab === key ? 600 : 400,
              padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    );

    // ── Overview ───────────────────────────────────────────────────────────────
    if (subTab === "overview")
      return (
        <>
          {SUBTABS_UI}

          {/* KPI cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",
              gap: isMobile ? 8 : 14,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                background: "#0d1117",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: isMobile ? 12 : "16px 18px",
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
                >
                  Enquiries
                </span>
                <MessageSquare size={14} color="#3b82f6" />
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: isMobile ? 18 : 26,
                  fontWeight: 700,
                  color: "#f1f5f9",
                  lineHeight: 1,
                }}
              >
                {myEnquiries}
              </p>
              <canvas
                id="spark-enquiries"
                height={isMobile ? 28 : 36}
                style={{ width: "100%", marginTop: 10, display: "block" }}
              />
            </div>
            <div
              style={{
                background: "#0d1117",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: isMobile ? 12 : "16px 18px",
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
                >
                  Active Listings
                </span>
                <Car size={14} color="#a78bfa" />
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: isMobile ? 18 : 26,
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
                padding: isMobile ? 12 : "16px 18px",
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
                >
                  Commission
                </span>
                <TrendingUp size={14} color="#22c55e" />
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: isMobile ? 18 : 26,
                  fontWeight: 700,
                  color: "#f1f5f9",
                  lineHeight: 1,
                }}
              >
                RM{" "}
                {commission !== null
                  ? Number(commission).toLocaleString("en-MY")
                  : "–"}
              </p>
              <canvas
                id="spark-commission"
                height={isMobile ? 28 : 36}
                style={{ width: "100%", marginTop: 10, display: "block" }}
              />
            </div>
            <div
              style={{
                background: "#0d1117",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: isMobile ? 12 : "16px 18px",
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
                >
                  Active Leads
                </span>
                <Users size={14} color="#f59e0b" />
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: isMobile ? 18 : 26,
                  fontWeight: 700,
                  color: "#f1f5f9",
                  lineHeight: 1,
                }}
              >
                {
                  leads.filter((l) => l.stage !== "won" && l.stage !== "lost")
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
              padding: isMobile ? "12px 14px" : "14px 18px",
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
                <Target size={14} color={targetHit ? "#22c55e" : "#3b82f6"} />
                <span
                  style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}
                >
                  Monthly target
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
                  >
                    🎯 Target hit!
                  </span>
                )}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: targetHit ? "#4ade80" : "#f1f5f9",
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
                  background: targetHit ? "#22c55e" : "#3b82f6",
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
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
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
              >
                Views &amp; enquiries — last 14 days
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
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    Enquiries
                  </span>
                </div>
              </div>
              <div
                style={{ position: "relative", height: isMobile ? 150 : 130 }}
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
              >
                Lead stage breakdown
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: isMobile ? 90 : 110,
                    height: isMobile ? 90 : 110,
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
                >
                  Follow-up nudges
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
                          {daysIdle}d idle{carName ? ` · ${carName}` : ""}
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
                      >
                        Ping WA
                      </button>
                    </div>
                  );
                })}
                {stale.length > 3 && (
                  <p style={{ margin: 0, fontSize: 11, color: "#374151" }}>
                    {stale.length - 3} more stale lead
                    {stale.length - 3 !== 1 ? "s" : ""}
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
              >
                Activity feed
              </p>
              {activityFeed.length === 0 && (
                <p
                  style={{ fontSize: 12, color: "#374151", margin: "12px 0 0" }}
                >
                  No recent activity yet.
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

    // ── Performance ────────────────────────────────────────────────────────────
    if (subTab === "performance") {
      const cvrRows = myListings
        .map((car) => {
          const s = carStatsMap[car.id] ?? {};
          const views = s.views || 0;
          const enqs = s.enquiries || 0;
          const cvr = views > 0 ? ((enqs / views) * 100).toFixed(1) : null;
          return { car, views, enqs, cvr };
        })
        .sort((a, b) => b.views - a.views);

      const top3 = cvrRows.slice(0, 3);
      const maxViews = top3.length > 0 ? top3[0].views : 1;

      return (
        <>
          {SUBTABS_UI}

          {/* Per-listing CVR table */}
          <div style={{ ...CARD, marginBottom: 16 }}>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "#f1f5f9",
              }}
            >
              Listing performance
            </p>
            {cvrRows.length === 0 ? (
              <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>
                No listings assigned yet.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {["Car", "Views", "Enquiries", "CVR"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "6px 10px",
                            textAlign: "left",
                            fontSize: 10,
                            color: "#4b5563",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cvrRows.map(({ car, views, enqs, cvr }) => {
                      const cvrNum = parseFloat(cvr);
                      return (
                        <tr
                          key={car.id}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <td
                            style={{
                              padding: "9px 10px",
                              color: "#e5e7eb",
                              fontWeight: 500,
                              maxWidth: 180,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {[car.year, car.brand, car.model]
                              .filter(Boolean)
                              .join(" ")}
                          </td>
                          <td
                            style={{
                              padding: "9px 10px",
                              color: "#60a5fa",
                              fontWeight: 600,
                            }}
                          >
                            {views}
                          </td>
                          <td
                            style={{
                              padding: "9px 10px",
                              color: "#fbbf24",
                              fontWeight: 600,
                            }}
                          >
                            {enqs}
                          </td>
                          <td
                            style={{
                              padding: "9px 10px",
                              fontWeight: 700,
                              color:
                                cvr === null
                                  ? "#374151"
                                  : cvrNum > 6
                                    ? "#4ade80"
                                    : cvrNum > 2
                                      ? "#fbbf24"
                                      : "#9ca3af",
                            }}
                          >
                            {cvr !== null ? `${cvr}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top 3 by views — inline bar chart */}
          <div style={{ ...CARD, marginBottom: 16 }}>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "#f1f5f9",
              }}
            >
              Top listings by views
            </p>
            {top3.length === 0 ? (
              <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>
                No view data yet.
              </p>
            ) : (
              top3.map(({ car, views }, i) => {
                const barW = maxViews > 0 ? (views / maxViews) * 100 : 0;
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <div
                    key={car.id}
                    style={{ marginBottom: i < top3.length - 1 ? 14 : 0 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 5,
                      }}
                    >
                      <span style={{ fontSize: 12, color: "#d1d5db" }}>
                        {medals[i]}{" "}
                        {[car.year, car.brand, car.model]
                          .filter(Boolean)
                          .join(" ")}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#60a5fa",
                        }}
                      >
                        {views} views
                      </span>
                    </div>
                    <div
                      style={{
                        height: 5,
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: 99,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${barW}%`,
                          background:
                            i === 0
                              ? "#3b82f6"
                              : i === 1
                                ? "#6366f1"
                                : "#8b5cf6",
                          borderRadius: 99,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Commission breakdown */}
          <div style={CARD}>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 13,
                fontWeight: 600,
                color: "#f1f5f9",
              }}
            >
              Commission breakdown
            </p>
            {commissionDetails.length === 0 ? (
              <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>
                No sold cars yet.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {["Car", "Sold date", "Commission"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "6px 10px",
                            textAlign: "left",
                            fontSize: 10,
                            color: "#4b5563",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {commissionDetails.map((c, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        <td
                          style={{
                            padding: "9px 10px",
                            color: "#e5e7eb",
                            fontWeight: 500,
                          }}
                        >
                          {[c.year, c.brand, c.model]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </td>
                        <td style={{ padding: "9px 10px", color: "#9ca3af" }}>
                          {c.sold_at
                            ? new Date(c.sold_at).toLocaleDateString("en-MY", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td
                          style={{
                            padding: "9px 10px",
                            fontFamily: "'Bebas Neue', sans-serif",
                            fontSize: 15,
                            color: "#4ade80",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                          }}
                        >
                          RM{" "}
                          {Number(c.commission_amount || 0).toLocaleString(
                            "en-MY",
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      );
    }

    // ── This month ─────────────────────────────────────────────────────────────
    return (
      <>
        {SUBTABS_UI}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",
            gap: isMobile ? 8 : 14,
            marginBottom: 20,
          }}
        >
          {[
            {
              label: "Leads added",
              val: leadsThisMonth,
              color: "#60a5fa",
              Icon: () => <Users size={14} color="#60a5fa" />,
            },
            {
              label: "Appointments",
              val: apptThisMonth,
              color: "#c084fc",
              Icon: () => <Clock size={14} color="#c084fc" />,
            },
            {
              label: "Enquiries",
              val: enqThisMonth,
              color: "#3b82f6",
              Icon: () => <MessageSquare size={14} color="#3b82f6" />,
            },
            {
              label: "Cars sold",
              val: thisMonthSales,
              color: "#22c55e",
              Icon: () => <Car size={14} color="#22c55e" />,
            },
          ].map(({ label, val, color, Icon }) => (
            <div
              key={label}
              style={{
                background: "#0d1117",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: isMobile ? 12 : "16px 18px",
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
                >
                  {label}
                </span>
                <Icon />
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: isMobile ? 22 : 30,
                  fontWeight: 700,
                  color,
                  lineHeight: 1,
                  fontFamily: "'Bebas Neue', sans-serif",
                  letterSpacing: "0.02em",
                }}
              >
                {val}
              </p>
            </div>
          ))}
        </div>

        {/* Monthly target recap */}
        <div
          style={{
            background: "#0d1117",
            border: targetHit
              ? "1px solid rgba(34,197,94,0.25)"
              : "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
            padding: isMobile ? "12px 14px" : "14px 18px",
            marginBottom: 16,
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
              <Target size={14} color={targetHit ? "#22c55e" : "#3b82f6"} />
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                Monthly target
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
                >
                  🎯 Target hit!
                </span>
              )}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: targetHit ? "#4ade80" : "#f1f5f9",
                }}
              >
                {thisMonthSales} / {monthlyTarget} cars
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
                background: targetHit ? "#22c55e" : "#3b82f6",
                borderRadius: 99,
                transition: "width 0.4s",
              }}
            />
          </div>
        </div>

        {/* Leads added this month list */}
        <div style={CARD}>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: 13,
              fontWeight: 600,
              color: "#f1f5f9",
            }}
          >
            Leads added this month
          </p>
          {leads.filter(
            (l) => l.created_at && new Date(l.created_at) >= monthStart,
          ).length === 0 ? (
            <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>
              No leads added this month yet.
            </p>
          ) : (
            leads
              .filter(
                (l) => l.created_at && new Date(l.created_at) >= monthStart,
              )
              .slice(0, 8)
              .map((lead) => (
                <div
                  key={lead.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(37,99,235,0.15)",
                      border: "1px solid rgba(37,99,235,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#93c5fd",
                      flexShrink: 0,
                    }}
                  >
                    {(lead.buyer_name || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: "#e5e7eb",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {lead.buyer_name || "—"}
                    </p>
                    {lead.phone && (
                      <p
                        style={{
                          margin: "1px 0 0",
                          fontSize: 11,
                          color: "#4b5563",
                        }}
                      >
                        {lead.phone}
                      </p>
                    )}
                  </div>
                  <span
                    style={{ fontSize: 10, color: "#374151", flexShrink: 0 }}
                  >
                    {timeAgo(lead.created_at)}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: 99,
                      background: "rgba(255,255,255,0.05)",
                      color: "#6b7280",
                      textTransform: "capitalize",
                      flexShrink: 0,
                    }}
                  >
                    {(lead.stage || "new").replace("_", " ")}
                  </span>
                </div>
              ))
          )}
        </div>
      </>
    );
  };

  const renderCarDetailPopup = () => {
    const car = selectedCar;
    if (!car) return null;
    const parseTags = (str) => {
      if (!str) return [];
      return str.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    };
    const images = Array.isArray(car.images) && car.images.length > 0 ? car.images : [];
    const sp = car.selling_price || 0;
    const op = car.original_price || null;
    const saving = op && op > sp ? op - sp : 0;
    const monthly = sp > 0 ? Math.round((sp * 0.9 * (1 + 3.5 / 100 * 7)) / (7 * 12)) : null;
    const stats = carStatsMap[car.id] ?? {};
    const views = stats.views || 0;
    const enqs = stats.enquiries || 0;
    const cvr = views > 0 ? ((enqs / views) * 100).toFixed(1) : null;
    const features = parseTags(car.features);
    const options  = parseTags(car.options);
    const tabs     = ["specs", "features", "options"].filter(t => t !== "specs" || true);

    const close = () => { setSelectedCar(null); setCarDetailImgIdx(0); setCarDetailTab("specs"); setCarDetailLbOpen(false); };

    const navBtn = (side, onClick) => (
      <button onClick={e => { e.stopPropagation(); onClick(); }} style={{ position: "absolute", [side]: 8, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, borderRadius: 6, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {side === "left" ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>
    );

    const actionBtn = (label, color, bg, border, onClick) => (
      <button onClick={onClick} style={{ width: "100%", background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: "10px 12px", fontSize: 12, fontWeight: 500, color, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Sans', sans-serif" }}>
        {label}
      </button>
    );

    return (
      <>
        {/* Backdrop */}
        <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", overflowY: "auto" }}>
          {/* Panel */}
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: "relative", margin: isMobile ? 0 : "24px auto", maxWidth: isMobile ? "100vw" : 1000, width: isMobile ? "100vw" : "calc(100vw - 48px)", height: isMobile ? "100dvh" : undefined, maxHeight: isMobile ? "100dvh" : "calc(100vh - 48px)", background: "rgba(11,11,15,0.99)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: isMobile ? 0 : 8, overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "'DM Sans', sans-serif" }}
          >
            {/* Close */}
            <button onClick={close} style={{ position: "absolute", top: 14, right: 14, zIndex: 10, width: 36, height: 36, borderRadius: 6, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={16} />
            </button>

            {/* Body */}
            <div style={{ display: "flex", flex: 1, minHeight: 0, overflowY: "auto", flexDirection: isMobile ? "column" : "row" }}>

              {/* LEFT — gallery + details */}
              <div style={{ flex: 1, minWidth: 0, padding: isMobile ? 16 : 24, borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.08)", overflowY: isMobile ? "visible" : "auto" }}>

                {/* Gallery */}
                {images.length > 0 ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    {/* Thumb strip */}
                    <div style={{ width: 60, display: "flex", flexDirection: "column", gap: 5, maxHeight: isMobile ? 180 : 300, overflowY: "auto" }}>
                      {images.map((img, i) => (
                        <div key={i} onClick={() => setCarDetailImgIdx(i)} style={{ width: 60, height: 44, borderRadius: 4, cursor: "pointer", flexShrink: 0, background: "#0d0d0d", border: i === carDetailImgIdx ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(255,255,255,0.08)", overflow: "hidden", opacity: i === carDetailImgIdx ? 1 : 0.45 }}>
                          <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                        </div>
                      ))}
                    </div>
                    {/* Main image */}
                    <div style={{ flex: 1, position: "relative", background: "#0d0d0d", borderRadius: 6, overflow: "hidden", height: isMobile ? 180 : 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img src={images[carDetailImgIdx]} alt="" onClick={() => setCarDetailLbOpen(true)} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "zoom-in", display: "block" }} />
                      {images.length > 1 && (
                        <>
                          {navBtn("left",  () => setCarDetailImgIdx(i => (i - 1 + images.length) % images.length))}
                          {navBtn("right", () => setCarDetailImgIdx(i => (i + 1) % images.length))}
                        </>
                      )}
                      <button onClick={() => setCarDetailLbOpen(true)} style={{ position: "absolute", bottom: 8, right: 8, width: 28, height: 28, borderRadius: 6, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)", color: "#9ca3af", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ZoomIn size={13} />
                      </button>
                      {images.length > 1 && (
                        <span style={{ position: "absolute", bottom: 8, left: 8, fontSize: 10, color: "#9ca3af", background: "rgba(0,0,0,0.55)", borderRadius: 4, padding: "2px 7px" }}>{carDetailImgIdx + 1} / {images.length}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ height: isMobile ? 160 : 260, background: "rgba(255,255,255,0.03)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Car size={40} color="#374151" />
                  </div>
                )}

                {/* Car header */}
                <div style={{ marginTop: 18 }}>
                  <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>{car.brand}</p>
                  <p style={{ fontSize: 22, fontWeight: 300, color: "#f3f4f6", margin: "4px 0 0", lineHeight: 1.2 }}>{car.model}{car.variant ? ` ${car.variant}` : ""}</p>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: "6px 0 0" }}>
                    {[car.year, car.body_type, car.transmission, car.fuel_type].filter(Boolean).join(" · ")}
                  </p>
                  {(car.city || car.state) && (
                    <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                      <MapPin size={11} /> {[car.city, car.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>

                {/* Price */}
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#f3f4f6", margin: 0, lineHeight: 1 }}>
                    {sp ? `RM ${sp.toLocaleString("en-MY")}` : "—"}
                  </p>
                  {saving > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 12, color: "#374151", textDecoration: "line-through" }}>RM {op.toLocaleString("en-MY")}</span>
                      <span style={{ fontSize: 10, color: "#93c5fd", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 4, padding: "1px 6px" }}>SAVE RM {saving.toLocaleString("en-MY")}</span>
                    </div>
                  )}
                  {monthly > 0 && <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Est. RM {monthly.toLocaleString()}/mo · 90% loan · 7yr · 3.5% p.a.</p>}
                </div>

                {/* Specs strip */}
                <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", margin: "16px 0", padding: "12px 0", gap: 0, overflowX: "auto" }}>
                  {[
                    { Icon: Gauge,       label: "Mileage",      value: car.mileage ? `${Number(car.mileage).toLocaleString()} km` : "—" },
                    { Icon: Settings,    label: "Engine",       value: car.engine_cc ? `${Number(car.engine_cc).toLocaleString()} cc` : "—" },
                    { Icon: ChevronRight,label: "Transmission", value: car.transmission || "—" },
                    { Icon: Droplets,    label: "Fuel",         value: car.fuel_type || "—" },
                    { Icon: Palette,     label: "Colour",       value: car.colour || "—" },
                  ].map(({ Icon, label, value }, i, arr) => (
                    <div key={label} style={{ flex: "1 0 70px", textAlign: "center", padding: "0 10px", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <Icon size={13} color="#6b7280" style={{ marginBottom: 4 }} />
                      <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "#6b7280", marginBottom: 3 }}>{label}</p>
                      <p style={{ fontSize: 12, color: "#f3f4f6", margin: 0 }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
                  {tabs.map(tab => (
                    <button key={tab} onClick={() => setCarDetailTab(tab)} style={{ padding: "8px 16px", fontSize: 12, color: carDetailTab === tab ? "#f3f4f6" : "#6b7280", borderBottom: carDetailTab === tab ? "2px solid #ef4444" : "2px solid transparent", background: "none", border: "none", borderBottom: carDetailTab === tab ? "2px solid #ef4444" : "2px solid transparent", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Tab: Specs */}
                {carDetailTab === "specs" && (
                  <div>
                    {[
                      { k: "Year",        v: car.year || "—" },
                      { k: "Condition",   v: car.condition || "—" },
                      { k: "Body Type",   v: car.body_type || "—" },
                      { k: "Colour",      v: car.colour || "—" },
                      { k: "Mileage",     v: car.mileage ? `${Number(car.mileage).toLocaleString()} km` : "—" },
                      { k: "Transmission",v: car.transmission || "—" },
                      { k: "Fuel Type",   v: car.fuel_type || "—" },
                      { k: "Location",    v: [car.city, car.state].filter(Boolean).join(", ") || "—" },
                    ].map(({ k, v }) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>{k}</span>
                        <span style={{ fontSize: 13, color: "#9ca3af" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab: Features */}
                {carDetailTab === "features" && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {features.length === 0
                      ? <p style={{ fontSize: 13, color: "#6b7280" }}>No features listed.</p>
                      : features.map((f, i) => <span key={i} style={{ fontSize: 12, color: "#9ca3af", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "4px 10px" }}>{f}</span>)
                    }
                  </div>
                )}

                {/* Tab: Options */}
                {carDetailTab === "options" && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {options.length === 0
                      ? <p style={{ fontSize: 13, color: "#6b7280" }}>No options listed.</p>
                      : options.map((o, i) => <span key={i} style={{ fontSize: 12, color: "#9ca3af", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "4px 10px" }}>{o}</span>)
                    }
                  </div>
                )}
              </div>

              {/* RIGHT — actions + CVR */}
              <div style={{ flex: isMobile ? "none" : "0 0 200px", width: isMobile ? "100%" : undefined, padding: isMobile ? "12px 16px 32px" : 20, display: "flex", flexDirection: "column", gap: 8, borderTop: isMobile ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                <p style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 4px" }}>Actions</p>

                {actionBtn(
                  <><Copy size={13} style={{ flexShrink: 0 }} /> Copy Link</>,
                  listingCopied[car.id] === "link" ? "#4ade80" : "#9ca3af",
                  listingCopied[car.id] === "link" ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
                  listingCopied[car.id] === "link" ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)",
                  () => handleListingCopy(car, "link")
                )}
                {actionBtn(
                  <><MessageSquare size={13} style={{ flexShrink: 0 }} /> WA Caption</>,
                  "#4ade80", "rgba(37,211,102,0.06)", "rgba(37,211,102,0.2)",
                  () => handleListingCopy(car, "wa")
                )}
                {actionBtn(
                  <><Sparkles size={13} style={{ flexShrink: 0 }} /> AI Caption</>,
                  "#c084fc", "rgba(168,85,247,0.08)", "rgba(168,85,247,0.25)",
                  () => { generateAiCaptions(car); close(); }
                )}
                {actionBtn(
                  <><Bell size={13} style={{ flexShrink: 0 }} /> Broadcast</>,
                  "#fb923c", "rgba(249,115,22,0.08)", "rgba(249,115,22,0.25)",
                  () => { openBroadcast(car); close(); }
                )}
                {actionBtn(
                  <><Eye size={13} style={{ flexShrink: 0 }} /> TikTok Studio</>,
                  "#f87171", "rgba(239,68,68,0.08)", "rgba(239,68,68,0.25)",
                  () => { setTiktokListing(car); close(); }
                )}

                {/* CVR stats */}
                <div style={{ marginTop: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: 12 }}>
                  <p style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px" }}>Performance</p>
                  {[
                    { label: "Views", val: views, color: "#60a5fa" },
                    { label: "Enquiries", val: enqs, color: "#fbbf24" },
                    { label: "CVR", val: cvr !== null ? `${cvr}%` : "—", color: "#4ade80" },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "#6b7280" }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color }}>{val}</span>
                    </div>
                  ))}
                </div>

                {/* Status */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: 12 }}>
                  <p style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 6px" }}>Status</p>
                  <span style={{ fontSize: 12, fontWeight: 600, textTransform: "capitalize", color: car.status === "active" ? "#4ade80" : car.status === "sold" ? "#9ca3af" : "#fbbf24" }}>{car.status || "active"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lightbox */}
        {carDetailLbOpen && images.length > 0 && (
          <div onClick={() => setCarDetailLbOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.96)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <button onClick={() => setCarDetailLbOpen(false)} style={{ position: "absolute", top: 16, right: 16, width: 40, height: 40, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#e5e5e5", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
              <X size={18} />
            </button>
            {images.length > 1 && <span style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", fontSize: 12, color: "#9ca3af", background: "rgba(0,0,0,0.5)", borderRadius: 20, padding: "4px 12px" }}>{carDetailImgIdx + 1} / {images.length}</span>}
            {images.length > 1 && (
              <button onClick={e => { e.stopPropagation(); setCarDetailImgIdx(i => (i - 1 + images.length) % images.length); }} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#e5e5e5", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronLeft size={22} />
              </button>
            )}
            <img src={images[carDetailImgIdx]} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: "calc(100vw - 120px)", maxHeight: "90vh", objectFit: "contain", borderRadius: 4, display: "block" }} />
            {images.length > 1 && (
              <button onClick={e => { e.stopPropagation(); setCarDetailImgIdx(i => (i + 1) % images.length); }} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#e5e5e5", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
      background: active ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.05)",
      border: active
        ? "1px solid rgba(59,130,246,0.4)"
        : "1px solid rgba(255,255,255,0.08)",
      color: active ? "#93c5fd" : "#6b7280",
      fontWeight: active ? 600 : 400,
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
        >
          My Listings ({myListings.length})
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
                  🔥 {hotCount}
                </span>{" "}
                hot
              </span>
              <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 14 }}>
                ·
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                <span style={{ color: "#6b7280", fontWeight: 600 }}>
                  💤 {staleCount}
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
              <span style={{ fontSize: 11, color: "#4b5563", marginRight: 2 }}>
                Sort:
              </span>
              <button
                style={SEL_STYLE(sortBy === "newest")}
                onClick={() => setSortBy("newest")}
              >
                Newest
              </button>
              <button
                style={SEL_STYLE(sortBy === "price_desc")}
                onClick={() => setSortBy("price_desc")}
              >
                Price ↓
              </button>
              <button
                style={SEL_STYLE(sortBy === "price_asc")}
                onClick={() => setSortBy("price_asc")}
              >
                Price ↑
              </button>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: "#4b5563", marginRight: 2 }}>
                Status:
              </span>
              {["all", "available", "reserved", "pending"].map((s) => (
                <button
                  key={s}
                  style={SEL_STYLE(filterStatus === s)}
                  onClick={() => setFilterStatus(s)}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </>
        )}

        {myListings.length === 0 ? (
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
              No listings assigned yet
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
              Ask your manager to assign a car to you to get started.
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
            No listings match this filter.
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
              const cvrFill = cvr !== null ? Math.min(cvr * 10, 100) : 0;
              const img = car.images?.[0];
              const name = [car.year, car.brand, car.model, car.variant]
                .filter(Boolean)
                .join(" ");
              const price = car.selling_price
                ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}`
                : "—";
              const cvrLabel = cvr !== null ? cvr.toFixed(1) : "0";
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
                  {img ? (
                    <img
                      src={img}
                      alt={name}
                      onClick={() => { setSelectedCar(car); setCarDetailImgIdx(0); setCarDetailTab("specs"); }}
                      style={{ width: "100%", height: 150, objectFit: "cover", cursor: "pointer" }}
                    />
                  ) : (
                    <div
                      onClick={() => { setSelectedCar(car); setCarDetailImgIdx(0); setCarDetailTab("specs"); }}
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
                        onClick={() => { setSelectedCar(car); setCarDetailImgIdx(0); setCarDetailTab("specs"); }}
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
                          >
                            🔥 Hot
                          </span>
                        )}
                        {isStale && !isHot && (
                          <span style={{ fontSize: 10, color: "#6b7280" }}>
                            💤 Stale
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
                            background: isHot ? "#ef4444" : "#3b82f6",
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
                              color: isHot ? "#ef4444" : "#60a5fa",
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
                        display: isMobile ? "grid" : "flex",
                        gridTemplateColumns: isMobile ? "1fr 1fr" : undefined,
                        gap: 6,
                        flexWrap: isMobile ? undefined : "wrap",
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
                          ? "✓ Copied"
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
                      >
                        WA Caption
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
                      >
                        Broadcast
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
                      >
                        AI Caption
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
                      >
                        TikTok
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

  const renderBookings = () => {
    const todayStr = new Date().toDateString();
    const todayAppts = appointments.filter(
      (a) => new Date(a.appointment_date).toDateString() === todayStr,
    );
    const upcomingAppts = appointments.filter(
      (a) =>
        new Date(a.appointment_date) > new Date() &&
        new Date(a.appointment_date).toDateString() !== todayStr,
    );
    const confirmedCount = appointments.filter(
      (a) => a.status === "confirmed",
    ).length;
    const pendingCount = appointments.filter(
      (a) => a.status === "pending",
    ).length;

    const SECTION_LABEL = (text) => (
      <p
        style={{
          margin: "0 0 8px",
          fontSize: 10,
          fontWeight: 700,
          color: "#374151",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {text}
      </p>
    );

    const BTN = (label, color, bg, border, onClick) => (
      <button
        onClick={onClick}
        style={{
          fontSize: 10,
          padding: "3px 9px",
          borderRadius: 5,
          background: bg,
          border: `1px solid ${border}`,
          color,
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        {label}
      </button>
    );

    const renderApptCard = (appt, i, groupTotal) => {
      const isToday =
        new Date(appt.appointment_date).toDateString() === todayStr;
      const hasDeposit = appt.deposit_amount > 0;
      const bookingTypeLabel = appt.booking_type
        ? appt.booking_type
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : null;
      return (
        <div
          key={appt.id}
          style={{
            background: "#0d1117",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
            marginBottom: 8,
            overflow: "hidden",
          }}
        >
          {/* badges row above the renderAppt content */}
          {(bookingTypeLabel || hasDeposit) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px 0",
              }}
            >
              {bookingTypeLabel && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.25)",
                    color: "#a5b4fc",
                    borderRadius: 99,
                    padding: "2px 8px",
                  }}
                >
                  {bookingTypeLabel}
                </span>
              )}
              {hasDeposit && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: "rgba(34,197,94,0.12)",
                    border: "1px solid rgba(34,197,94,0.25)",
                    color: "#4ade80",
                    borderRadius: 99,
                    padding: "2px 8px",
                  }}
                >
                  Deposit: RM{" "}
                  {Number(appt.deposit_amount).toLocaleString("en-MY")}
                </span>
              )}
            </div>
          )}
          {/* existing appointment row (unchanged) */}
          <div style={{ padding: "0 6px" }}>
            {renderAppt(appt, 0, 1, isToday)}
          </div>
          {/* status action buttons */}
          {(appt.status === "pending" || appt.status === "confirmed") && (
            <div
              style={{
                display: "flex",
                gap: 6,
                padding: "0 14px 12px",
                flexWrap: "wrap",
              }}
            >
              {appt.status === "pending" && (
                <>
                  {BTN(
                    "Confirm",
                    "#4ade80",
                    "rgba(34,197,94,0.1)",
                    "rgba(34,197,94,0.3)",
                    () => updateApptStatus(appt.id, "confirmed"),
                  )}
                  {BTN(
                    "Cancel",
                    "#f87171",
                    "rgba(239,68,68,0.08)",
                    "rgba(239,68,68,0.25)",
                    () => updateApptStatus(appt.id, "cancelled"),
                  )}
                </>
              )}
              {appt.status === "confirmed" && (
                <>
                  {BTN(
                    "Mark Done",
                    "#4ade80",
                    "rgba(34,197,94,0.1)",
                    "rgba(34,197,94,0.3)",
                    () => updateApptStatus(appt.id, "done"),
                  )}
                  {BTN(
                    "Reschedule",
                    "#fbbf24",
                    "rgba(251,191,36,0.08)",
                    "rgba(251,191,36,0.25)",
                    () => updateApptStatus(appt.id, "rescheduled"),
                  )}
                </>
              )}
            </div>
          )}
        </div>
      );
    };

    return (
      <div>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 16,
            fontWeight: 600,
            color: "#f1f5f9",
          }}
        >
          Bookings
        </p>

        {appointments.length === 0 ? (
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
              <Clock size={24} color="#374151" />
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 600,
                color: "#4b5563",
              }}
            >
              No upcoming bookings
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "#374151",
                textAlign: "center",
                maxWidth: 280,
                lineHeight: 1.6,
              }}
            >
              When customers book a test drive, they'll appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 16,
                padding: "10px 14px",
                background: "#0d1117",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10,
              }}
            >
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                <span style={{ color: "#4ade80", fontWeight: 600 }}>
                  {confirmedCount}
                </span>{" "}
                confirmed
              </span>
              <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 14 }}>
                ·
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                <span style={{ color: "#60a5fa", fontWeight: 600 }}>
                  {pendingCount}
                </span>{" "}
                pending
              </span>
              <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 14 }}>
                ·
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                <span style={{ color: "#f1f5f9", fontWeight: 600 }}>
                  {todayAppts.length}
                </span>{" "}
                today
              </span>
            </div>

            {/* Today section */}
            {todayAppts.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {SECTION_LABEL("Today")}
                {todayAppts.map((appt, i) =>
                  renderApptCard(appt, i, todayAppts.length),
                )}
              </div>
            )}

            {/* Upcoming section */}
            {upcomingAppts.length > 0 && (
              <div>
                {SECTION_LABEL("Upcoming")}
                {upcomingAppts.map((appt, i) =>
                  renderApptCard(appt, i, upcomingAppts.length),
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderLeads = () => {
    const activeStages = LEAD_STAGES.filter((s) => s !== "lost");
    const lostLeads = leads.filter((l) => l.stage === "lost");

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
            label: "🔥 Hot",
          },
          warm: {
            bg: "rgba(251,191,36,0.15)",
            border: "rgba(251,191,36,0.35)",
            color: "#fbbf24",
            label: "⚡ Warm",
          },
          cold: {
            bg: "rgba(107,114,128,0.15)",
            border: "rgba(107,114,128,0.3)",
            color: "#9ca3af",
            label: "❄️ Cold",
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
      const carName = car
        ? [car.year, car.brand, car.model].filter(Boolean).join(" ")
        : null;
      const carPrice = car?.selling_price
        ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}`
        : null;

      const stageIdx = LEAD_STAGES.indexOf(lead.stage);
      const nextStage = LEAD_STAGES.filter(
        (s) => s !== "lost" && s !== "won",
      ).find((s, i) => LEAD_STAGES.indexOf(s) > stageIdx);

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
          {/* top row: name + AI score */}
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
              }}
            >
              {lead.buyer_name || "—"}
            </p>
            {AI_SCORE_PILL(lead.id)}
          </div>

          {/* lead age */}
          <p style={{ margin: "0 0 4px", fontSize: 10, color: "#374151" }}>
            Added {timeAgo(lead.created_at)}
          </p>

          {/* car name + price */}
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

          {/* phone */}
          {lead.phone && (
            <p style={{ margin: "0 0 4px", fontSize: 11, color: "#4b5563" }}>
              📞 {lead.phone}
            </p>
          )}

          {/* notes preview */}
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

          {/* action buttons */}
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
            {lead.phone && (
              <button
                onClick={() => pingWA(lead)}
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

        {/* Kanban board — lost excluded */}
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
            const stageLeads = leads.filter((l) => l.stage === stage);
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

        {/* Lost leads accordion */}
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
                {lostLeads.map((lead) => {
                  const car = lead.car_listings;
                  const carName = car
                    ? [car.year, car.brand, car.model].filter(Boolean).join(" ")
                    : null;
                  return (
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
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#6b7280",
                          }}
                        >
                          {lead.buyer_name || "—"}
                        </p>
                        <span style={{ fontSize: 10, color: "#374151" }}>
                          {timeAgo(lead.created_at)}
                        </span>
                      </div>
                      {carName && (
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: 11,
                            color: "#4b5563",
                          }}
                        >
                          {carName}
                        </p>
                      )}
                      {lead.notes && (
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: 10,
                            color: "#374151",
                            fontStyle: "italic",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          "{lead.notes}"
                        </p>
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
      {enquiries.length === 0 ? (
        <div
          style={{ textAlign: "center", padding: "48px 0", color: "#374151" }}
        >
          No enquiries yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {enquiries.map((enq) => {
            const car = enq.car_listings;
            const carName = car
              ? [car.year, car.brand, car.model].filter(Boolean).join(" ")
              : null;
            const phone = (enq.buyer_phone || "").replace(/\D/g, "");
            return (
              <div
                key={enq.id}
                style={{
                  background: "#0d1117",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12,
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <div>
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
                    {carName && (
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: 11,
                          color: "#60a5fa",
                        }}
                      >
                        {carName}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: "#374151" }}>
                    {timeAgo(enq.created_at)}
                  </span>
                </div>
                {enq.buyer_message && (
                  <p
                    style={{
                      margin: "0 0 10px",
                      fontSize: 12,
                      color: "#6b7280",
                      fontStyle: "italic",
                    }}
                  >
                    "{enq.buyer_message}"
                  </p>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {phone && (
                    <button
                      onClick={() =>
                        window.open(
                          `https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}`,
                          "_blank",
                        )
                      }
                      style={{
                        fontSize: 11,
                        padding: "5px 10px",
                        borderRadius: 7,
                        background: "rgba(37,211,102,0.1)",
                        border: "1px solid rgba(37,211,102,0.25)",
                        color: "#4ade80",
                        cursor: "pointer",
                      }}
                    >
                      WhatsApp
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setOpenTemplateId(
                        openTemplateId === enq.id ? null : enq.id,
                      )
                    }
                    style={{
                      fontSize: 11,
                      padding: "5px 10px",
                      borderRadius: 7,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#9ca3af",
                      cursor: "pointer",
                    }}
                  >
                    Templates
                  </button>
                  <button
                    onClick={() => {
                      setOpenAiReplyId(enq.id);
                      generateAiReply(enq);
                    }}
                    style={{
                      fontSize: 11,
                      padding: "5px 10px",
                      borderRadius: 7,
                      background: "rgba(168,85,247,0.1)",
                      border: "1px solid rgba(168,85,247,0.25)",
                      color: "#c084fc",
                      cursor: "pointer",
                    }}
                  >
                    AI Reply
                  </button>
                </div>
                {openTemplateId === enq.id && (
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {WA_TEMPLATES.map((tpl, ti) => (
                      <button
                        key={ti}
                        onClick={() => fireTemplate(enq, tpl)}
                        style={{
                          textAlign: "left",
                          fontSize: 11,
                          padding: "6px 10px",
                          borderRadius: 7,
                          background:
                            templateToast === enq.id
                              ? "rgba(34,197,94,0.1)"
                              : "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color:
                            templateToast === enq.id ? "#4ade80" : "#9ca3af",
                          cursor: "pointer",
                        }}
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                )}
                {openAiReplyId === enq.id && (
                  <div style={{ marginTop: 10 }}>
                    {aiLoading ? (
                      <div
                        className="caption-skeleton"
                        style={{ height: 60, width: "100%" }}
                      />
                    ) : aiDrafts[enq.id] ? (
                      <div>
                        <p
                          style={{
                            margin: "0 0 6px",
                            fontSize: 12,
                            color: "#9ca3af",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {aiDrafts[enq.id]}
                        </p>
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(aiDrafts[enq.id])
                          }
                          style={{
                            fontSize: 11,
                            padding: "4px 10px",
                            borderRadius: 6,
                            background: "rgba(168,85,247,0.1)",
                            border: "1px solid rgba(168,85,247,0.25)",
                            color: "#c084fc",
                            cursor: "pointer",
                          }}
                        >
                          Copy
                        </button>
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 300,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <TrendingUp size={32} color="#374151" style={{ marginBottom: 12 }} />
        <p
          style={{ margin: 0, fontSize: 14, color: "#4b5563", fontWeight: 500 }}
        >
          Analytics coming soon
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#374151" }}>
          Detailed performance data will appear here.
        </p>
      </div>
    </div>
  );

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
        >
          Team view coming soon
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#374151" }}>
          See your team's performance here.
        </p>
      </div>
    </div>
  );

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
        .lead-score-wrap:hover .lead-score-tip { display: block !important; }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        @keyframes hotpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.5)} }
        .caption-skeleton { background: linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%); background-size:800px 100%; animation:shimmer 1.4s infinite linear; border-radius:8px; }
        .hot-dot { animation: hotpulse 1.5s ease-in-out infinite; }
      `}</style>

      {/* ─── Sidenav (desktop) / Bottom nav (mobile) ─── */}
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
              tab: "bookings",
              label: "Bookings",
              icon: <Clock size={18} />,
              badge: appointments.length || null,
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
              badge: enquiries.filter((e) => e.status === "new").length || null,
            },
            {
              tab: "team",
              label: "Team",
              icon: <Users size={18} />,
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
          >
            Main
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
            {
              tab: "bookings",
              label: "Bookings",
              icon: <Clock style={{ width: 14, height: 14, flexShrink: 0 }} />,
              badge: appointments.length || null,
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
          >
            CRM
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
              badge: enquiries.filter((e) => e.status === "new").length || null,
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
          >
            Team
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

      {/* ─── Right content pane ─── */}
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
              </div>
              <button
                onClick={() => setNotifOpen((v) => !v)}
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
                  color: unreadCount > 0 ? "#93c5fd" : "#94a3b8",
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
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
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
                  })}
                  {profile?.dealership ? ` · ${profile.dealership}` : ""}
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
                <Plus size={14} /> Add Lead
              </button>
              <button
                onClick={() => setNotifOpen((v) => !v)}
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
                  color: unreadCount > 0 ? "#93c5fd" : "#94a3b8",
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
                    {unreadCount > 9 ? "9+" : unreadCount}
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
              , {profile?.full_name?.split(" ")[0] || "there"} 👋
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
              {new Date().toLocaleDateString("en-MY", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {profile?.dealership ? ` · ${profile.dealership}` : ""}
            </p>
          </div>
        )}

        {/* Scrollable content */}
        <div
          style={{
            padding: isMobile ? "16px 12px" : 24,
            flex: 1,
            paddingBottom: isMobile ? 80 : 24,
          }}
        >
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "listings" && renderListings()}
          {activeTab === "bookings" && renderBookings()}
          {activeTab === "leads" && renderLeads()}
          {activeTab === "analytics" && renderAnalytics()}
          {activeTab === "enquiries" && renderEnquiries()}
          {activeTab === "team" && renderTeam()}
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
                  >
                    Name
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
                  >
                    Phone
                  </label>
                  <input
                    value={addLeadForm.phone}
                    onChange={(e) =>
                      setAddLeadForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    placeholder="e.g. 0123456789"
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
                  >
                    Car (optional)
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
                  >
                    Notes
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
                  disabled={addLeadSaving || !addLeadForm.buyer_name}
                  style={{
                    width: "100%",
                    padding: "11px 0",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    background:
                      addLeadSaving || !addLeadForm.buyer_name
                        ? "rgba(255,255,255,0.05)"
                        : "#1d4ed8",
                    border: "none",
                    color:
                      addLeadSaving || !addLeadForm.buyer_name
                        ? "#6b7280"
                        : "#fff",
                    cursor:
                      addLeadSaving || !addLeadForm.buyer_name
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {addLeadSaving ? "Saving..." : "Add Lead"}
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
              top: isMobile ? 52 : 60,
              right: isMobile ? 8 : 16,
              zIndex: 46,
              width: isMobile ? "calc(100vw - 16px)" : 320,
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
              <span style={{ fontSize: 13, fontWeight: 600, color: "#f3f4f6" }}>
                Notifications
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
                  >
                    Mark all read
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
              {notifications.length === 0 ? (
                <p
                  style={{
                    fontSize: 13,
                    color: "#4b5563",
                    padding: "24px 16px",
                    textAlign: "center",
                    margin: 0,
                  }}
                >
                  No notifications yet.
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
