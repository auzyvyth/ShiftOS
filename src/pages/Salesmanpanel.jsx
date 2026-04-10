import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import { useRoleRedirect } from "../hooks/useRoleRedirect";
import TikTokGenerator from "../components/TikTokGenerator";
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

  // Leads
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
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
        navigate("/login");
        return;
      }

      setUserId(data.session.user.id); // Update the userId state with the authenticated user's ID
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.session.user.id) // Use the ID directly from the session
        .maybeSingle();

      if (!profileData) {
        navigate("/login");
        return;
      }
      setProfile(profileData); // Set the profile state
      if (redirectByRole(profileData.role)) return;

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
    supabase
      .from("appointments")
      .select("*, car_listings(brand, model, year, images)")
      .eq("salesman_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setAppointments(data || []));

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
      .then(({ data }) => {
        setLeads(data || []);
        setLeadsLoading(false);
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
          className="w-16 h-16 rounded-full object-cover border-2 border-red-600/30"
        />
      );
    const initial = (profile?.full_name || "S")[0].toUpperCase();
    return (
      <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center font-bold text-2xl">
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

  const updateLeadStage = async (leadId, stage) => {
    await supabase
      .from("leads")
      .update({ stage, updated_at: new Date().toISOString() })
      .eq("id", leadId);
    setLeads((p) => p.map((l) => (l.id === leadId ? { ...l, stage } : l)));
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
            style={{ color: isToday ? "#60a5fa" : "#f87171" }}
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
      className="min-h-screen bg-gray-950 text-white"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      {/* Top bar */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
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
            {/* Profile card — with commission + copy link */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
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
              <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-500">Total commission</span>
                <span
                  className="text-sm font-semibold"
                  style={{
                    color: commission && commission > 0 ? "#f87171" : "#6b7280",
                  }}
                >
                  {commission === null
                    ? "—"
                    : `RM ${Number(commission).toLocaleString()}`}
                </span>
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
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-white">{myClicks}</p>
                <p className="text-xs text-gray-500 mt-1">Link Clicks</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
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

            {/* Enquiries */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
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
                          <div className="flex gap-2 ml-9">
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
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming Appointments */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-red-400" />
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
          </div>
          {/* end left column */}

          {/* ══ RIGHT COLUMN: My Listings ══ */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Car className="w-4 h-4 text-red-400" />
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
                            <p className="text-sm font-bold text-white leading-tight">
                              {car.year} {car.brand} {car.model}
                              {car.variant ? (
                                <span className="font-normal text-gray-400">
                                  {" "}
                                  {car.variant}
                                </span>
                              ) : null}
                            </p>
                            <StatusBadge status={car.status} />
                          </div>
                          <p className="text-sm font-semibold text-red-400 mb-1">
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
                            background: "rgba(220,38,38,0.10)",
                            border: "1px solid rgba(220,38,38,0.30)",
                            color: "#f87171",
                          }}
                        >
                          <Sparkles className="w-3 h-3" />
                          TikTok Slide
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

        {/* Lead Pipeline */}
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <p className="text-sm font-medium text-white">My Leads</p>
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
                            <p
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#f3f4f6",
                                margin: "0 0 2px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {lead.buyer_name || "—"}
                            </p>
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

      {/* TikTok Studio modal */}
      {tiktokListing && (
        <TikTokGenerator
          listing={tiktokListing}
          onClose={() => setTiktokListing(null)}
        />
      )}
    </div>
  );
}
