import React, { useEffect, useState } from "react";
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
          .select("event_type")
          .eq("salesman_slug", profileData.slug);
        if (evts) {
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
    supabase
      .from("car_listings")
      .select(
        "id, slug, year, brand, model, variant, selling_price, status, images, colour, mileage, transmission, fuel_type, body_type, specs, features, options, city, condition",
      )
      .eq("assigned_to", userId)
      .neq("status", "sold")
      .order("created_at", { ascending: false })
      .then(({ data }) => setMyListings(data || []));

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
    };
  }, [userId]);
  // ─────────────────────────────────────────────────────────────────────────

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

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(30,58,138,0.08) 0%, transparent 60%), #05070e",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');
        .lead-score-wrap:hover .lead-score-tip { display: block !important; }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .caption-skeleton { background: linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%); background-size:800px 100%; animation:shimmer 1.4s infinite linear; border-radius:8px; }
      `}</style>

      {/* Top bar */}
      <header
        className="px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10"
        style={{
          background: "rgba(5,7,14,0.96)",
          borderBottom: "1px solid rgba(255,255,255,0.048)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            S
          </div>
          <span
            className="font-bold tracking-wide text-white"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: "3px",
            }}
          >
            SHIFTOS
          </span>
          <span className="text-gray-600 text-xs ml-1">· My Panel</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Bell */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => {
                setNotifOpen((p) => !p);
              }}
              className="relative p-2 rounded-lg transition-all"
              style={{
                background:
                  unreadCount > 0 ? "rgba(59,130,246,0.1)" : "transparent",
                border:
                  unreadCount > 0
                    ? "1px solid rgba(59,130,246,0.25)"
                    : "1px solid transparent",
                color: unreadCount > 0 ? "#93c5fd" : "#6b7280",
              }}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-gray-900">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <>
                <div
                  onClick={() => setNotifOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "110%",
                    right: 0,
                    zIndex: 50,
                    width: 300,
                    maxHeight: 380,
                    overflowY: "auto",
                    background: "#111827",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#f3f4f6",
                      }}
                    >
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotifsRead}
                        style={{
                          fontSize: 11,
                          color: "#60a5fa",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p
                      style={{
                        fontSize: 13,
                        color: "#4b5563",
                        padding: "20px 16px",
                        textAlign: "center",
                      }}
                    >
                      No notifications yet
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
                            : "rgba(59,130,246,0.04)",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
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
                          <div style={{ flex: 1 }}>
                            <p
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#f3f4f6",
                                margin: "0 0 2px",
                              }}
                            >
                              {n.title}
                            </p>
                            {n.body && (
                              <p
                                style={{
                                  fontSize: 12,
                                  color: "#9ca3af",
                                  margin: "0 0 3px",
                                }}
                              >
                                {n.body}
                              </p>
                            )}
                            <p style={{ fontSize: 10, color: "#4b5563" }}>
                              {timeAgo(n.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* ── Main two-column layout ── */}
      <main className="px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ══ LEFT COLUMN ══ */}
          <div className="space-y-5">
            {/* Daily goal nudge */}
            {(() => {
              const target = profile?.monthly_target ?? 5;
              const needed = Math.max(target - thisMonthSales, 0);
              const now = new Date();
              const daysLeft =
                new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() -
                now.getDate();
              const onTrack = thisMonthSales >= target;
              const pace =
                daysLeft > 0 ? (needed / daysLeft).toFixed(1) : needed;
              const behind =
                needed > 0 &&
                daysLeft > 0 &&
                needed / daysLeft >
                  target /
                    new Date(
                      now.getFullYear(),
                      now.getMonth() + 1,
                      0,
                    ).getDate();
              const accentColor = onTrack ? "#4ade80" : "#fb923c";
              const line = onTrack
                ? "Target smashed! You're on fire this month 🎯"
                : behind
                  ? `${needed} more sale${needed !== 1 ? "s" : ""} needed, ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left — let's go`
                  : "On track — keep pushing";
              const pillText = onTrack
                ? `${thisMonthSales} / ${target} this month`
                : `Need ${needed} sale${needed !== 1 ? "s" : ""} in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;
              return (
                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderLeft: `3px solid ${accentColor}`,
                    borderRadius: 12,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      color: onTrack
                        ? "#4ade80"
                        : behind
                          ? "#fb923c"
                          : "#d1d5db",
                      fontWeight: 500,
                      lineHeight: 1.4,
                    }}
                  >
                    {line}
                  </p>
                  <span
                    style={{
                      fontSize: 10,
                      color: "#6b7280",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 99,
                      padding: "2px 10px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {pillText}
                  </span>
                </div>
              );
            })()}
            {/* Profile card — with commission + copy link */}
            <div
              style={{
                background: "rgba(255,255,255,0.032)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: 20,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <div className="flex items-center gap-4">
                <AvatarDisplay />
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-white leading-tight">
                    {profile?.full_name || "—"}
                  </p>
                  <p className="text-gray-400 text-sm capitalize">
                    {profile?.role || "Salesperson"}
                  </p>
                  {profile?.dealership && (
                    <p className="text-gray-600 text-xs mt-0.5">
                      {profile.dealership}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {profile?.is_active === false && (
                    <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded-full text-xs text-gray-400">
                      Inactive
                    </span>
                  )}
                  {uniqueLink && (
                    <button
                      onClick={handleCopy}
                      title="Copy your unique tracking link — share it anywhere to track clicks"
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all"
                      style={{
                        background: copied
                          ? "rgba(22,163,74,0.1)"
                          : "rgba(255,255,255,0.04)",
                        borderColor: copied
                          ? "rgba(22,163,74,0.3)"
                          : "rgba(255,255,255,0.1)",
                        color: copied ? "#4ade80" : "#9ca3af",
                      }}
                    >
                      {copied ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copied ? "Copied!" : "Copy Link"}
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">
                    Total commission
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{
                      color:
                        commission && commission > 0 ? "#4ade80" : "#6b7280",
                    }}
                  >
                    {commission === null
                      ? "—"
                      : `RM ${Number(commission).toLocaleString()}`}
                  </span>
                </div>
                {commissionDetails.length > 0 && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    {commissionDetails.map((c, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ fontSize: 11, color: "#6b7280" }}>
                          {c.year} {c.brand} {c.model}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#4ade80",
                          }}
                        >
                          +RM {Number(c.commission_amount).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Slug guard banner */}
            {!profile?.slug && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <p className="text-xs text-yellow-400">
                  Your account doesn't have a unique link yet. Contact your
                  manager to set one up.
                </p>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div
                style={{
                  background: "rgba(255,255,255,0.032)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16,
                  padding: 16,
                  textAlign: "center",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-white">{myClicks}</p>
                <p className="text-xs text-gray-500 mt-1">Link Clicks</p>
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,0.032)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16,
                  padding: 16,
                  textAlign: "center",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                <div className="w-8 h-8 bg-yellow-600/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <MessageSquare className="w-4 h-4 text-yellow-400" />
                </div>
                <p className="text-2xl font-bold text-white">{myEnquiries}</p>
                <p className="text-xs text-gray-500 mt-1">Enquiries</p>
              </div>
              <div
                className="rounded-xl p-4 text-center"
                style={{
                  background: "rgba(22,163,74,0.06)",
                  border: "1px solid rgba(22,163,74,0.2)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2"
                  style={{ background: "rgba(22,163,74,0.15)" }}
                >
                  <ShoppingBag className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-2xl font-bold text-green-400">{soldCount}</p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "rgba(74,222,128,0.6)" }}
                >
                  All Time Sales
                </p>
              </div>
              {/* Monthly target card */}
              <div
                className="rounded-xl p-4"
                style={{
                  background: "rgba(59,130,246,0.06)",
                  border: "1px solid rgba(59,130,246,0.2)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(59,130,246,0.15)" }}
                  >
                    <Target className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-xs text-blue-400 font-bold">
                    {thisMonthSales}/{profile?.monthly_target || 5}
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: "rgba(255,255,255,0.07)",
                    borderRadius: 4,
                    overflow: "hidden",
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, (thisMonthSales / (profile?.monthly_target || 5)) * 100)}%`,
                      background:
                        thisMonthSales >= (profile?.monthly_target || 5)
                          ? "#4ade80"
                          : "#3b82f6",
                      borderRadius: 4,
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500">This Month</p>
                {thisMonthSales >= (profile?.monthly_target || 5) && (
                  <p className="text-xs text-green-400 font-bold mt-1">
                    🎯 Target hit!
                  </p>
                )}
              </div>
            </div>

            {/* Response time stat */}
            {(() => {
              const diffs = [];
              enquiries.forEach((e) => {
                const created = e.created_at
                  ? new Date(e.created_at).getTime()
                  : null;
                if (!created) return;
                if (e.replied_at) {
                  const diff =
                    (new Date(e.replied_at).getTime() - created) / 60000;
                  if (diff >= 0) diffs.push(diff);
                } else {
                  const phone = (e.buyer_phone || "").replace(/\D/g, "");
                  if (!phone) return;
                  const match = appointments
                    .filter((a) => {
                      const ap = (a.buyer_phone || "").replace(/\D/g, "");
                      return (
                        ap && ap.slice(-8) === phone.slice(-8) && a.created_at
                      );
                    })
                    .sort(
                      (a, b) => new Date(a.created_at) - new Date(b.created_at),
                    )[0];
                  if (match) {
                    const diff =
                      (new Date(match.created_at).getTime() - created) / 60000;
                    if (diff >= 0 && diff < 10080) diffs.push(diff);
                  }
                }
              });
              const avg = diffs.length
                ? diffs.reduce((s, v) => s + v, 0) / diffs.length
                : null;
              const valueStr =
                avg === null
                  ? "--"
                  : avg < 15
                    ? "< 15m avg"
                    : avg > 60
                      ? "> 1h avg"
                      : `${Math.round(avg)}m avg`;
              const color =
                avg === null
                  ? "#6b7280"
                  : avg < 30
                    ? "#4ade80"
                    : avg < 120
                      ? "#fbbf24"
                      : "#f87171";
              const bg =
                avg === null
                  ? "rgba(255,255,255,0.032)"
                  : avg < 30
                    ? "rgba(34,197,94,0.06)"
                    : avg < 120
                      ? "rgba(251,191,36,0.06)"
                      : "rgba(248,113,113,0.06)";
              const border =
                avg === null
                  ? "rgba(255,255,255,0.07)"
                  : avg < 30
                    ? "rgba(34,197,94,0.2)"
                    : avg < 120
                      ? "rgba(251,191,36,0.2)"
                      : "rgba(248,113,113,0.2)";
              const iconBg =
                avg === null
                  ? "rgba(168,85,247,0.12)"
                  : avg < 30
                    ? "rgba(34,197,94,0.15)"
                    : avg < 120
                      ? "rgba(251,191,36,0.15)"
                      : "rgba(248,113,113,0.15)";
              return (
                <div
                  className="rounded-xl"
                  style={{
                    background: bg,
                    border: `1px solid ${border}`,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: iconBg }}
                  >
                    <Clock className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">
                      Response Time
                    </p>
                    <p
                      className="text-lg font-bold leading-none"
                      style={{ color }}
                    >
                      {valueStr}
                    </p>
                    <p style={{ fontSize: 10, color: "#4b5563", marginTop: 3 }}>
                      {"< 30m = higher close rate"}
                    </p>
                  </div>
                  {diffs.length > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "#6b7280",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 99,
                        padding: "2px 8px",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {diffs.length} sampled
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Enquiries */}
            <div
              style={{
                background: "rgba(255,255,255,0.032)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: 20,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-4 h-4 text-yellow-400" />
                <p className="text-sm font-medium text-white">Enquiries</p>
                {enquiries.filter((e) => e.status === "new").length > 0 && (
                  <span
                    className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(251,191,36,0.12)",
                      border: "1px solid rgba(251,191,36,0.25)",
                      color: "#fbbf24",
                    }}
                  >
                    {enquiries.filter((e) => e.status === "new").length} new
                  </span>
                )}
              </div>
              {enquiriesLoading ? (
                <div className="text-center py-6 text-gray-600 text-sm">
                  Loading...
                </div>
              ) : enquiries.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No enquiries yet.</p>
                  <p className="text-gray-600 text-xs mt-1">
                    Enquiries from your link will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {enquiries.slice(0, 8).map((e) => {
                    const car = e.car_listings;
                    const phone = (e.buyer_phone || "").replace(/\D/g, "");
                    const waMsg = encodeURIComponent(
                      `Hi${e.buyer_name ? " " + e.buyer_name : ""}, thanks for your interest${car ? " in the " + car.brand + " " + car.model : ""}! How can I help you?`,
                    );
                    const isNew =
                      Date.now() - new Date(e.created_at) < 86400000;
                    return (
                      <div
                        key={e.id}
                        style={{
                          padding: "12px",
                          background: isNew
                            ? "rgba(251,191,36,0.04)"
                            : "rgba(255,255,255,0.02)",
                          border: `1px solid ${isNew ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.06)"}`,
                          borderRadius: 10,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: "rgba(251,191,36,0.1)",
                                border: "1px solid rgba(251,191,36,0.2)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <User className="w-3.5 h-3.5 text-yellow-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">
                                {e.buyer_name || "Anonymous"}
                              </p>
                              {e.buyer_phone && (
                                <p className="text-xs text-gray-500">
                                  {e.buyer_phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isNew && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  background: "rgba(251,191,36,0.15)",
                                  border: "1px solid rgba(251,191,36,0.3)",
                                  color: "#fbbf24",
                                  borderRadius: 4,
                                  padding: "1px 5px",
                                }}
                              >
                                NEW
                              </span>
                            )}
                            <p className="text-xs text-gray-600">
                              {timeAgo(e.created_at)}
                            </p>
                          </div>
                        </div>
                        {car && (
                          <p className="text-xs text-gray-400 mb-1 ml-9">
                            {car.brand} {car.model} {car.year}
                          </p>
                        )}
                        {e.buyer_message && (
                          <p className="text-xs text-gray-500 italic mb-2 ml-9 truncate">
                            "{e.buyer_message}"
                          </p>
                        )}
                        {phone && (
                          <div className="flex gap-2 ml-9 flex-wrap">
                            <a
                              href={`https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${waMsg}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 11,
                                padding: "4px 10px",
                                borderRadius: 6,
                                background: "rgba(37,211,102,0.1)",
                                border: "1px solid rgba(37,211,102,0.25)",
                                color: "#4ade80",
                                textDecoration: "none",
                              }}
                            >
                              <MessageSquare className="w-3 h-3" />
                              Reply WA
                            </a>
                            <a
                              href={`tel:${phone}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 11,
                                padding: "4px 10px",
                                borderRadius: 6,
                                background: "rgba(96,165,250,0.08)",
                                border: "1px solid rgba(96,165,250,0.2)",
                                color: "#93c5fd",
                                textDecoration: "none",
                              }}
                            >
                              <Phone className="w-3 h-3" />
                              Call
                            </a>
                            <button
                              onClick={() => {
                                const next =
                                  openAiReplyId === e.id ? null : e.id;
                                setOpenAiReplyId(next);
                                if (next && !aiDrafts[e.id]) {
                                  generateAiReply(e);
                                }
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 11,
                                padding: "4px 10px",
                                borderRadius: 6,
                                background:
                                  openAiReplyId === e.id
                                    ? "rgba(99,102,241,0.18)"
                                    : "rgba(99,102,241,0.08)",
                                border: `1px solid ${openAiReplyId === e.id ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.2)"}`,
                                color: "#a5b4fc",
                                cursor: "pointer",
                                fontFamily: "'DM Sans',sans-serif",
                              }}
                            >
                              <Sparkles className="w-3 h-3" />
                              AI Reply
                            </button>
                            <button
                              onClick={() =>
                                setOpenTemplateId(
                                  openTemplateId === e.id ? null : e.id,
                                )
                              }
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 11,
                                padding: "4px 10px",
                                borderRadius: 6,
                                background:
                                  openTemplateId === e.id
                                    ? "rgba(167,139,250,0.15)"
                                    : "rgba(167,139,250,0.07)",
                                border: `1px solid ${openTemplateId === e.id ? "rgba(167,139,250,0.35)" : "rgba(167,139,250,0.2)"}`,
                                color: "#c084fc",
                                cursor: "pointer",
                                fontFamily: "'DM Sans',sans-serif",
                              }}
                            >
                              <Tag className="w-3 h-3" />
                              Templates
                            </button>
                          </div>
                        )}
                        {openAiReplyId === e.id && (
                          <div
                            style={{
                              marginTop: 10,
                              marginLeft: 36,
                              background: "rgba(255,255,255,0.032)",
                              border: "1px solid rgba(255,255,255,0.07)",
                              borderRadius: 12,
                              padding: 12,
                              fontFamily: "'DM Sans',sans-serif",
                            }}
                          >
                            <p
                              style={{
                                fontSize: 10,
                                color: "#6366f1",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                marginBottom: 8,
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <Sparkles style={{ width: 10, height: 10 }} />
                              AI Draft
                            </p>
                            {aiLoading && !aiDrafts[e.id] ? (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "16px 0",
                                  color: "#6b7280",
                                  fontSize: 12,
                                }}
                              >
                                <div
                                  style={{
                                    width: 14,
                                    height: 14,
                                    border: "2px solid rgba(255,255,255,0.08)",
                                    borderTop: "2px solid #6366f1",
                                    borderRadius: "50%",
                                    animation: "spin 0.7s linear infinite",
                                    flexShrink: 0,
                                  }}
                                />
                                Generating reply…
                              </div>
                            ) : (
                              <>
                                <textarea
                                  value={aiDrafts[e.id] || ""}
                                  onChange={(ev) =>
                                    setAiDrafts((p) => ({
                                      ...p,
                                      [e.id]: ev.target.value,
                                    }))
                                  }
                                  rows={5}
                                  style={{
                                    width: "100%",
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 12,
                                    color: "white",
                                    outline: "none",
                                    resize: "vertical",
                                    fontFamily: "'DM Sans',sans-serif",
                                    lineHeight: 1.6,
                                    boxSizing: "border-box",
                                  }}
                                />
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    marginTop: 8,
                                  }}
                                >
                                  <button
                                    onClick={() => {
                                      const draft = aiDrafts[e.id] || "";
                                      navigator.clipboard.writeText(draft);
                                      const ph = (e.buyer_phone || "").replace(
                                        /\D/g,
                                        "",
                                      );
                                      if (ph) {
                                        window.open(
                                          `https://wa.me/${ph.startsWith("6") ? ph : "6" + ph}?text=${encodeURIComponent(draft)}`,
                                          "_blank",
                                          "noopener,noreferrer",
                                        );
                                      }
                                    }}
                                    style={{
                                      flex: 1,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      padding: "7px 0",
                                      borderRadius: 8,
                                      background: "rgba(37,211,102,0.12)",
                                      border: "1px solid rgba(37,211,102,0.28)",
                                      color: "#4ade80",
                                      cursor: "pointer",
                                      fontFamily: "'DM Sans',sans-serif",
                                    }}
                                  >
                                    Copy &amp; Open WA
                                  </button>
                                  <button
                                    disabled={aiLoading}
                                    onClick={() => {
                                      setAiDrafts((p) => ({
                                        ...p,
                                        [e.id]: "",
                                      }));
                                      generateAiReply(e);
                                    }}
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      padding: "7px 12px",
                                      borderRadius: 8,
                                      background: "rgba(99,102,241,0.1)",
                                      border: "1px solid rgba(99,102,241,0.25)",
                                      color: "#a5b4fc",
                                      cursor: aiLoading
                                        ? "not-allowed"
                                        : "pointer",
                                      opacity: aiLoading ? 0.5 : 1,
                                      fontFamily: "'DM Sans',sans-serif",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    {aiLoading ? (
                                      <div
                                        style={{
                                          width: 10,
                                          height: 10,
                                          border:
                                            "2px solid rgba(255,255,255,0.1)",
                                          borderTop: "2px solid #a5b4fc",
                                          borderRadius: "50%",
                                          animation:
                                            "spin 0.7s linear infinite",
                                        }}
                                      />
                                    ) : null}
                                    Regenerate
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        {openTemplateId === e.id && (
                          <div
                            style={{
                              marginTop: 10,
                              marginLeft: 36,
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: 10,
                              padding: 10,
                              position: "relative",
                            }}
                          >
                            {templateToast === e.id && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: 8,
                                  left: "50%",
                                  transform: "translateX(-50%)",
                                  background: "rgba(34,197,94,0.18)",
                                  border: "1px solid rgba(34,197,94,0.35)",
                                  color: "#4ade80",
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: "3px 12px",
                                  borderRadius: 20,
                                  whiteSpace: "nowrap",
                                  zIndex: 2,
                                  pointerEvents: "none",
                                }}
                              >
                                ✓ Copied + Opening WA
                              </div>
                            )}
                            <p
                              style={{
                                fontSize: 10,
                                color: "#4b5563",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                marginBottom: 8,
                              }}
                            >
                              Quick Templates
                            </p>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                              }}
                            >
                              {WA_TEMPLATES.map((tpl) => (
                                <button
                                  key={tpl.label}
                                  onClick={() => fireTemplate(e, tpl)}
                                  style={{
                                    textAlign: "left",
                                    fontSize: 12,
                                    padding: "7px 10px",
                                    borderRadius: 7,
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    color: "#d1d5db",
                                    cursor: "pointer",
                                    fontFamily: "'DM Sans',sans-serif",
                                    transition: "background 0.15s",
                                  }}
                                  onMouseEnter={(ev) => {
                                    ev.currentTarget.style.background =
                                      "rgba(255,255,255,0.08)";
                                  }}
                                  onMouseLeave={(ev) => {
                                    ev.currentTarget.style.background =
                                      "rgba(255,255,255,0.04)";
                                  }}
                                >
                                  {tpl.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming Appointments */}
            <div
              style={{
                background: "rgba(255,255,255,0.032)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: 20,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-blue-400" />
                <p className="text-sm font-medium text-white">
                  Upcoming Appointments
                </p>
              </div>
              {appointments.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">
                    No upcoming viewings yet.
                  </p>
                  <p className="text-gray-600 text-xs mt-1">
                    Bookings from your listings will appear here.
                  </p>
                </div>
              ) : (
                (() => {
                  const todayStr = new Date().toDateString();
                  const todaysAppts = appointments.filter(
                    (a) =>
                      a.appointment_date &&
                      new Date(a.appointment_date).toDateString() === todayStr,
                  );
                  const otherAppts = appointments.filter(
                    (a) =>
                      !a.appointment_date ||
                      new Date(a.appointment_date).toDateString() !== todayStr,
                  );
                  return (
                    <div>
                      {/* TODAY */}
                      {todaysAppts.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 mb-3">
                            <div
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: "#3b82f6",
                                boxShadow: "0 0 6px rgba(59,130,246,0.8)",
                                animation: "hotpulse 1.5s ease-in-out infinite",
                                flexShrink: 0,
                              }}
                            />
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">
                              Today
                            </span>
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: "rgba(59,130,246,0.12)",
                                border: "1px solid rgba(59,130,246,0.25)",
                                color: "#93c5fd",
                              }}
                            >
                              {todaysAppts.length}
                            </span>
                          </div>
                          {todaysAppts.map((appt, i) =>
                            renderAppt(appt, i, todaysAppts.length, true),
                          )}
                          <div className="my-4 border-t border-gray-800" />
                        </>
                      )}
                      {/* ALL OTHER */}
                      {otherAppts.length > 0 && (
                        <>
                          {todaysAppts.length > 0 && (
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">
                              Upcoming
                            </p>
                          )}
                          {otherAppts.map((appt, i) =>
                            renderAppt(appt, i, otherAppts.length, false),
                          )}
                        </>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
            {/* Notes to Manager */}
            <div
              style={{
                background: "rgba(255,255,255,0.032)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: 20,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <p className="text-sm font-medium text-white">
                  Notes to Manager
                </p>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginBottom: 12,
                  maxHeight: 180,
                  overflowY: "auto",
                }}
              >
                {managerNotes.length === 0 && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "#374151",
                      textAlign: "center",
                      padding: "16px 0",
                    }}
                  >
                    No notes yet. Leave a note for your manager.
                  </p>
                )}
                {managerNotes.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      background: "rgba(167,139,250,0.05)",
                      border: "1px solid rgba(167,139,250,0.12)",
                      borderRadius: 8,
                      padding: "8px 12px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 12,
                        color: "#d1d5db",
                        margin: "0 0 3px",
                      }}
                    >
                      {n.content}
                    </p>
                    <p style={{ fontSize: 10, color: "#374151", margin: 0 }}>
                      {new Date(n.created_at).toLocaleDateString("en-MY")}
                    </p>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Type a note..."
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "#fff",
                    outline: "none",
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && newNote.trim() && !noteSaving) {
                      setNoteSaving(true);
                      const { data } = await supabase
                        .from("salesman_notes")
                        .insert({
                          salesman_id: userId,
                          dealer_id: profile?.dealer_id,
                          content: newNote.trim(),
                        })
                        .select()
                        .single();
                      if (data) setManagerNotes((p) => [data, ...p]);
                      setNewNote("");
                      setNoteSaving(false);
                    }
                  }}
                />
                <button
                  disabled={!newNote.trim() || noteSaving}
                  onClick={async () => {
                    if (!newNote.trim() || noteSaving) return;
                    setNoteSaving(true);
                    const { data } = await supabase
                      .from("salesman_notes")
                      .insert({
                        salesman_id: userId,
                        dealer_id: profile?.dealer_id,
                        content: newNote.trim(),
                      })
                      .select()
                      .single();
                    if (data) setManagerNotes((p) => [data, ...p]);
                    setNewNote("");
                    setNoteSaving(false);
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background:
                      noteSaving || !newNote.trim()
                        ? "rgba(167,139,250,0.1)"
                        : "rgba(167,139,250,0.2)",
                    border: "1px solid rgba(167,139,250,0.3)",
                    color: "#c084fc",
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  {noteSaving ? "..." : "Send"}
                </button>
              </div>
            </div>
          </div>
          {/* end left column */}

          {/* ══ RIGHT COLUMN: My Listings ══ */}
          <div
            style={{
              background: "rgba(255,255,255,0.032)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16,
              padding: 20,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Car className="w-4 h-4 text-blue-400" />
              <p className="text-sm font-medium text-white">My Listings</p>
              {myListings.length > 0 && (
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                  {myListings.length}
                </span>
              )}
            </div>

            {myListings.length === 0 ? (
              <div className="text-center py-16">
                <Car className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  No listings assigned yet.
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  Ask your manager to assign cars to you.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myListings.map((car) => {
                  const listCopied = listingCopied[car.id];
                  const price = Number(car.selling_price || 0);
                  const stats = carStatsMap[car.id] ?? {};
                  const views = stats.views || 0;
                  const enquiries = stats.enquiries || 0;
                  const cvr = views > 0 ? (enquiries / views) * 100 : null;
                  const cvrFill = cvr !== null ? Math.min(cvr * 10, 100) : 0;
                  const cvrColor =
                    cvr === null
                      ? "rgba(255,255,255,0.07)"
                      : cvr >= 6
                        ? "rgba(34,197,94,0.8)"
                        : cvr >= 3
                          ? "rgba(251,191,36,0.7)"
                          : cvr >= 1
                            ? "rgba(59,130,246,0.6)"
                            : "rgba(255,255,255,0.07)";
                  const isHot = cvr !== null && cvr > 6 && views > 3;
                  const isStale = views > 10 && (cvr === 0 || cvr === null);
                  return (
                    <div
                      key={car.id}
                      className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-3"
                    >
                      <div className="flex gap-3 mb-3">
                        {car.images?.[0] ? (
                          <img
                            src={car.images[0]}
                            alt=""
                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-gray-700"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gray-700/80 flex items-center justify-center flex-shrink-0">
                            <Car className="w-6 h-6 text-gray-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <p className="text-sm font-bold text-white leading-tight">
                                {car.year} {car.brand} {car.model}
                                {car.variant ? (
                                  <span className="font-normal text-gray-400">
                                    {" "}
                                    {car.variant}
                                  </span>
                                ) : null}
                              </p>
                              {isHot && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#4ade80",
                                    background: "rgba(34,197,94,0.12)",
                                    border: "1px solid rgba(34,197,94,0.3)",
                                    borderRadius: 99,
                                    padding: "1px 7px",
                                    flexShrink: 0,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: "50%",
                                      background: "#4ade80",
                                      animation:
                                        "pulse 1.4s ease-in-out infinite",
                                      flexShrink: 0,
                                    }}
                                  />
                                  Hot
                                </span>
                              )}
                              {isStale && !isHot && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#6b7280",
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 99,
                                    padding: "1px 7px",
                                    flexShrink: 0,
                                  }}
                                >
                                  Stale
                                </span>
                              )}
                            </div>
                            <StatusBadge status={car.status} />
                          </div>
                          <p className="text-sm font-semibold text-blue-400 mb-1">
                            RM {price.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {[
                              car.mileage
                                ? `${Number(car.mileage).toLocaleString()} km`
                                : null,
                              car.colour,
                              car.transmission,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                        <span
                          style={{
                            fontSize: 11,
                            color: "#93c5fd",
                            background: "rgba(59,130,246,0.08)",
                            border: "1px solid rgba(59,130,246,0.15)",
                            borderRadius: 6,
                            padding: "2px 8px",
                          }}
                        >
                          👁 {views} views
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: "#fbbf24",
                            background: "rgba(251,191,36,0.08)",
                            border: "1px solid rgba(251,191,36,0.15)",
                            borderRadius: 6,
                            padding: "2px 8px",
                          }}
                        >
                          💬 {enquiries} enquiries
                        </span>
                      </div>
                      {/* CVR heatmap bar */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: 4,
                            borderRadius: 2,
                            background: "rgba(255,255,255,0.07)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${cvrFill}%`,
                              background: cvrColor,
                              borderRadius: 2,
                              transition: "width 0.5s ease",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            color:
                              cvr === null
                                ? "#4b5563"
                                : cvr >= 6
                                  ? "#4ade80"
                                  : cvr >= 3
                                    ? "#fbbf24"
                                    : cvr >= 1
                                      ? "#93c5fd"
                                      : "#4b5563",
                            whiteSpace: "nowrap",
                            minWidth: 64,
                            textAlign: "right",
                          }}
                        >
                          {cvr === null
                            ? "No views yet"
                            : `${cvr.toFixed(1)}% CVR`}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleListingCopy(car, "link")}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-all"
                        >
                          {listCopied === "link" ? (
                            <>
                              <Check className="w-3 h-3 text-green-400" />
                              <span className="text-green-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy Link
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleListingCopy(car, "wa")}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-all"
                        >
                          {listCopied === "wa" ? (
                            <>
                              <Check className="w-3 h-3 text-green-400" />
                              <span className="text-green-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <MessageSquare className="w-3 h-3" />
                              WA Caption
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setTiktokListing(car)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                          style={{
                            background: "rgba(59,130,246,0.10)",
                            border: "1px solid rgba(59,130,246,0.30)",
                            color: "#93c5fd",
                          }}
                        >
                          <Sparkles className="w-3 h-3" />
                          TikTok Slide
                        </button>
                        <button
                          onClick={() => generateAiCaptions(car)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: "rgba(168,85,247,0.10)",
                            border: "1px solid rgba(168,85,247,0.30)",
                            color: "#c084fc",
                          }}
                        >
                          <Sparkles className="w-3 h-3" />
                          AI Caption
                        </button>
                        <button
                          onClick={() => openBroadcast(car)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: "rgba(249,115,22,0.10)",
                            border: "1px solid rgba(249,115,22,0.30)",
                            color: "#fb923c",
                          }}
                        >
                          <Send className="w-3 h-3" />
                          Broadcast
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* end right column */}
        </div>

        {/* Needs Follow-up */}
        {staleLeads.length > 0 && (
          <div
            className="mt-6"
            style={{
              background: "rgba(251,146,60,0.05)",
              border: "1px solid rgba(251,146,60,0.2)",
              borderRadius: 16,
              padding: 20,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-orange-400" />
              <p className="text-sm font-medium text-white">Needs Follow-up</p>
              <span
                className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(251,146,60,0.15)",
                  border: "1px solid rgba(251,146,60,0.3)",
                  color: "#fb923c",
                }}
              >
                {staleLeads.length}
              </span>
            </div>
            <div className="space-y-2">
              {staleLeads.map((lead) => {
                const car = lead.car_listings;
                const carName = car ? `${car.brand} ${car.model}` : null;
                const daysAgo = Math.floor(
                  (Date.now() - new Date(lead.updated_at)) / 86400000,
                );
                const sc = STAGE_COLOR[lead.stage] || STAGE_COLOR.new;
                return (
                  <div
                    key={lead.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#f3f4f6",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {lead.buyer_name || "—"}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            background: sc.bg,
                            border: `1px solid ${sc.border}`,
                            color: sc.tx,
                            borderRadius: 6,
                            padding: "1px 6px",
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                            flexShrink: 0,
                          }}
                        >
                          {lead.stage.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {carName && (
                          <span style={{ fontSize: 11, color: "#6b7280" }}>
                            {carName}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 11,
                            color: "#fb923c",
                            fontWeight: 500,
                          }}
                        >
                          {daysAgo}d no contact
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => pingWA(lead)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: "rgba(37,211,102,0.1)",
                        border: "1px solid rgba(37,211,102,0.28)",
                        color: "#4ade80",
                        cursor: "pointer",
                        flexShrink: 0,
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      <MessageSquare style={{ width: 12, height: 12 }} />
                      Ping on WA
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Lead Pipeline */}
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <p className="text-sm font-medium text-white">My Leads</p>
            {Object.keys(leadScores).length > 0 && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 20,
                  background: "rgba(99,102,241,0.1)",
                  border: "1px solid rgba(99,102,241,0.22)",
                  color: "#a5b4fc",
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Sparkles style={{ width: 8, height: 8 }} />
                AI scored
              </span>
            )}
            {scoreLoading && (
              <div
                style={{
                  width: 10,
                  height: 10,
                  border: "2px solid rgba(255,255,255,0.08)",
                  borderTop: "2px solid #a5b4fc",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                  flexShrink: 0,
                }}
              />
            )}
            <span className="ml-auto text-xs text-gray-500">
              {leads.length} total
            </span>
            <button
              onClick={() => setShowAddLead(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 8,
                background: "rgba(59,130,246,0.1)",
                border: "1px solid rgba(59,130,246,0.25)",
                color: "#93c5fd",
                cursor: "pointer",
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Lead
            </button>
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <div
              style={{
                display: "flex",
                gap: 10,
                minWidth: 700,
                paddingBottom: 8,
              }}
            >
              {[
                "new",
                "contacted",
                "viewing_booked",
                "negotiating",
                "deposit_taken",
                "won",
              ].map((stage) => {
                const stageLeads = leads.filter((l) => l.stage === stage);
                const sc = STAGE_COLOR[stage];
                return (
                  <div
                    key={stage}
                    style={{
                      flex: "0 0 160px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 10,
                      padding: 10,
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
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: sc.tx,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {stage.replace("_", " ")}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: sc.bg,
                          border: `1px solid ${sc.border}`,
                          color: sc.tx,
                          borderRadius: 10,
                          padding: "0 6px",
                        }}
                      >
                        {stageLeads.length}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {stageLeads.length === 0 && (
                        <p
                          style={{
                            fontSize: 11,
                            color: "#374151",
                            textAlign: "center",
                            padding: "12px 0",
                          }}
                        >
                          Empty
                        </p>
                      )}
                      {stageLeads.map((lead) => {
                        const car = lead.car_listings;
                        const ls = leadScores[lead.id];
                        const dotColor =
                          ls?.score === "hot"
                            ? "#22c55e"
                            : ls?.score === "warm"
                              ? "#fbbf24"
                              : ls?.score === "cold"
                                ? "#6b7280"
                                : null;
                        return (
                          <div
                            key={lead.id}
                            style={{
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.07)",
                              borderRadius: 8,
                              padding: "8px 10px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                marginBottom: 2,
                              }}
                            >
                              <p
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "#f3f4f6",
                                  margin: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  flex: 1,
                                  minWidth: 0,
                                }}
                              >
                                {lead.buyer_name || "—"}
                              </p>
                              {dotColor && (
                                <div
                                  style={{
                                    position: "relative",
                                    flexShrink: 0,
                                  }}
                                  className="lead-score-wrap"
                                >
                                  <div
                                    style={{
                                      width: 7,
                                      height: 7,
                                      borderRadius: "50%",
                                      background: dotColor,
                                      boxShadow: `0 0 5px ${dotColor}88`,
                                      cursor: "default",
                                    }}
                                  />
                                  <div
                                    className="lead-score-tip"
                                    style={{
                                      display: "none",
                                      position: "absolute",
                                      bottom: "calc(100% + 5px)",
                                      right: 0,
                                      background: "#1f2937",
                                      border: "1px solid rgba(255,255,255,0.1)",
                                      borderRadius: 6,
                                      padding: "4px 8px",
                                      fontSize: 10,
                                      color: "#d1d5db",
                                      whiteSpace: "nowrap",
                                      maxWidth: 160,
                                      whiteSpaceCollapse: "collapse",
                                      zIndex: 10,
                                      pointerEvents: "none",
                                      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontWeight: 700,
                                        color: dotColor,
                                        textTransform: "capitalize",
                                      }}
                                    >
                                      {ls.score}
                                    </span>
                                    {" — "}
                                    {ls.reason}
                                  </div>
                                </div>
                              )}
                            </div>
                            {car && (
                              <p
                                style={{
                                  fontSize: 10,
                                  color: "#6b7280",
                                  margin: "0 0 4px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {car.brand} {car.model}
                              </p>
                            )}
                            {lead.phone && (
                              <p style={{ fontSize: 10, color: "#4b5563" }}>
                                📞 {lead.phone}
                              </p>
                            )}
                            <div
                              style={{
                                display: "flex",
                                gap: 4,
                                marginTop: 6,
                                flexWrap: "wrap",
                              }}
                            >
                              {stage !== "won" &&
                                stage !== "lost" &&
                                (() => {
                                  const idx = LEAD_STAGES.indexOf(stage);
                                  const next = LEAD_STAGES[idx + 1];
                                  return next ? (
                                    <button
                                      onClick={() =>
                                        updateLeadStage(lead.id, next)
                                      }
                                      style={{
                                        fontSize: 9,
                                        padding: "2px 7px",
                                        borderRadius: 5,
                                        background: "rgba(59,130,246,0.1)",
                                        border:
                                          "1px solid rgba(59,130,246,0.2)",
                                        color: "#93c5fd",
                                        cursor: "pointer",
                                        fontFamily: "'DM Sans',sans-serif",
                                      }}
                                    >
                                      → {next.replace("_", " ")}
                                    </button>
                                  ) : null;
                                })()}
                              <button
                                onClick={() => updateLeadStage(lead.id, "lost")}
                                style={{
                                  fontSize: 9,
                                  padding: "2px 7px",
                                  borderRadius: 5,
                                  background: "rgba(107,114,128,0.08)",
                                  border: "1px solid rgba(107,114,128,0.2)",
                                  color: "#6b7280",
                                  cursor: "pointer",
                                  fontFamily: "'DM Sans',sans-serif",
                                }}
                              >
                                Lost
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Add Lead Modal */}
        {showAddLead && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.78)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              zIndex: 50,
            }}
          >
            <div
              style={{
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px 16px 0 0",
                width: "100%",
                maxWidth: 480,
                padding: 20,
                fontFamily: "'DM Sans',sans-serif",
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
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#f3f4f6",
                    margin: 0,
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
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <input
                  value={addLeadForm.buyer_name}
                  onChange={(e) =>
                    setAddLeadForm((p) => ({
                      ...p,
                      buyer_name: e.target.value,
                    }))
                  }
                  placeholder="Buyer name *"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#fff",
                    outline: "none",
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                />
                <input
                  value={addLeadForm.phone}
                  onChange={(e) =>
                    setAddLeadForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="Phone number"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#fff",
                    outline: "none",
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                />
                <select
                  value={addLeadForm.car_listing_id}
                  onChange={(e) =>
                    setAddLeadForm((p) => ({
                      ...p,
                      car_listing_id: e.target.value,
                    }))
                  }
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: addLeadForm.car_listing_id ? "#fff" : "#6b7280",
                    outline: "none",
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  <option value="">Select car (optional)</option>
                  {myListings.map((l) => (
                    <option
                      key={l.id}
                      value={l.id}
                      style={{ background: "#111827" }}
                    >
                      {l.brand} {l.model} {l.year}
                    </option>
                  ))}
                </select>
                <textarea
                  value={addLeadForm.notes}
                  onChange={(e) =>
                    setAddLeadForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder="Notes..."
                  rows={2}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#fff",
                    outline: "none",
                    resize: "none",
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button
                  onClick={() => setShowAddLead(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: 10,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#9ca3af",
                    cursor: "pointer",
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddLead}
                  disabled={addLeadSaving || !addLeadForm.buyer_name}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: 10,
                    background: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
                    border: "none",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: addLeadSaving || !addLeadForm.buyer_name ? 0.5 : 1,
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  {addLeadSaving ? "Saving..." : "Add Lead"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

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
