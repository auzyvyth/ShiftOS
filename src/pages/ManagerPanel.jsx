import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import CarForm from "../components/CarForm";
import {
  Users,
  Car,
  Calendar,
  TrendingUp,
  BarChart2,
  LogOut,
  Plus,
  Check,
  X,
  ChevronRight,
  Clock,
  Flame,
  ToggleLeft,
  ToggleRight,
  Search,
  Send,
  Bell,
  Target,
  Eye,
  Megaphone,
} from "lucide-react";

const ACCENT = "#f97316";

const S = {
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
  },
  input: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    color: "#f0f2f5",
    outline: "none",
    fontFamily: "'DM Sans',sans-serif",
    width: "100%",
    boxSizing: "border-box",
  },
  btn: {
    background: "rgba(249,115,22,0.12)",
    border: "1px solid rgba(249,115,22,0.3)",
    borderRadius: 8,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 600,
    color: ACCENT,
    cursor: "pointer",
    fontFamily: "'DM Sans',sans-serif",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  },
  btnPrimary: {
    background: "linear-gradient(135deg,#f97316,#ea580c)",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    cursor: "pointer",
    fontFamily: "'DM Sans',sans-serif",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },
  divider: { borderBottom: "1px solid rgba(255,255,255,0.05)" },
  label: {
    fontSize: 10,
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontWeight: 700,
  },
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
  new: "#93c5fd",
  contacted: "#fbbf24",
  viewing_booked: "#c084fc",
  test_drive: "#34d399",
  negotiating: "#fb923c",
  deposit_taken: "#4ade80",
  won: "#4ade80",
  lost: "#6b7280",
};

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ManagerPanel() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("team");

  // Data
  const [salesmen, setSalesmen] = useState([]);
  const [listings, setListings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [leads, setLeads] = useState([]);
  const [events, setEvents] = useState([]);

  // UI
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddListing, setShowAddListing] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastSaving, setBroadcastSaving] = useState(false);
  const [broadcastDone, setBroadcastDone] = useState(false);
  const [assignDropdown, setAssignDropdown] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [ownerMessages, setOwnerMessages] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  // ── Auth + fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate("/login");
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (!p || p.role !== "manager") {
        navigate("/login");
        return;
      }
      setProfile(p);
      setLoading(false);

      const did = p.dealer_id;

      supabase
        .from("profiles")
        .select("*")
        .eq("dealer_id", did)
        .eq("role", "salesman")
        .order("created_at", { ascending: false })
        .then(({ data: d }) => setSalesmen(d || []));

      supabase
        .from("car_listings")
        .select(
          "id,brand,model,variant,year,selling_price,original_price,status,images,assigned_to,created_at,mileage,colour,transmission,state,slug,condition,dealer_id",
        )
        .eq("dealer_id", did)
        .order("created_at", { ascending: false })
        .then(({ data: d }) => setListings(d || []));

      supabase
        .from("appointments")
        .select(
          "*, car_listings(brand,model,year), profiles!salesman_id(full_name)",
        )
        .eq("dealer_id", did)
        .order("created_at", { ascending: false })
        .then(({ data: d }) => setBookings(d || []));

      supabase
        .from("leads")
        .select("*, car_listings(brand,model,year,selling_price)")
        .eq("dealer_id", did)
        .eq("is_deleted", false)
        .order("updated_at", { ascending: false })
        .then(({ data: d }) => setLeads(d || []));

      supabase
        .from("analytics_events")
        .select("event_type, salesman_slug, car_id, created_at")
        .eq("dealer_id", did)
        .then(({ data: d }) => setEvents(d || []));

      supabase
        .from("salesman_notes")
        .select("*, profiles!salesman_id(full_name)")
        .eq("dealer_id", did)
        .order("created_at", { ascending: false })
        .limit(20)
        .then(({ data: d }) => setNotifications(d || []));

      const loadOwnerMsgs = () =>
        supabase
          .from("salesman_notifications")
          .select("*")
          .eq("salesman_id", p.id)
          .order("created_at", { ascending: false })
          .limit(20)
          .then(({ data: d }) => setOwnerMessages(d || []));
      loadOwnerMsgs();

      const notifCh = supabase
        .channel("manager_notifs_" + p.id)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "salesman_notifications", filter: `salesman_id=eq.${p.id}` }, loadOwnerMsgs)
        .subscribe();

      return () => supabase.removeChannel(notifCh);
    });
  }, [navigate]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const unreadNotes = notifications.filter((n) => !n.is_read).length + ownerMessages.filter((n) => !n.is_read).length;

  const salesmenById = useMemo(
    () => Object.fromEntries(salesmen.map((s) => [s.id, s])),
    [salesmen],
  );

  const salesmanStats = useMemo(() => {
    const map = {};
    salesmen.forEach((s) => {
      map[s.id] = {
        listings: 0,
        bookings: 0,
        leads: 0,
        clicks: 0,
        enquiries: 0,
      };
    });
    listings.forEach((l) => {
      if (l.assigned_to && map[l.assigned_to]) map[l.assigned_to].listings++;
    });
    bookings.forEach((b) => {
      if (b.salesman_id && map[b.salesman_id]) map[b.salesman_id].bookings++;
    });
    leads.forEach((l) => {
      if (l.salesman_id && map[l.salesman_id]) map[l.salesman_id].leads++;
    });
    events.forEach((e) => {
      const s = salesmen.find((sm) => sm.slug === e.salesman_slug);
      if (s && map[s.id]) {
        if (["link_visit", "car_view"].includes(e.event_type))
          map[s.id].clicks++;
        if (["whatsapp_click", "call_click"].includes(e.event_type))
          map[s.id].enquiries++;
      }
    });
    return map;
  }, [salesmen, listings, bookings, leads, events]);

  const todayStr = new Date().toDateString();
  const todaysBookings = bookings.filter(
    (b) =>
      b.appointment_date &&
      new Date(b.appointment_date).toDateString() === todayStr,
  );
  const otherBookings = bookings.filter(
    (b) =>
      !b.appointment_date ||
      new Date(b.appointment_date).toDateString() !== todayStr,
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleAssign = async (listingId, salesmanId) => {
    setAssignDropdown(null);
    await supabase
      .from("car_listings")
      .update({ assigned_to: salesmanId })
      .eq("id", listingId);
    setListings((p) =>
      p.map((l) =>
        l.id === listingId ? { ...l, assigned_to: salesmanId } : l,
      ),
    );
  };

  const handleUnassign = async (listingId) => {
    setAssignDropdown(null);
    await supabase
      .from("car_listings")
      .update({ assigned_to: null })
      .eq("id", listingId);
    setListings((p) =>
      p.map((l) => (l.id === listingId ? { ...l, assigned_to: null } : l)),
    );
  };

  const handleToggleSalesman = async (s) => {
    const val = s.is_active === false;
    await supabase.from("profiles").update({ is_active: val }).eq("id", s.id);
    setSalesmen((p) =>
      p.map((x) => (x.id === s.id ? { ...x, is_active: val } : x)),
    );
  };

  const handleUpdateLeadStage = async (leadId, stage) => {
    await supabase
      .from("leads")
      .update({ stage, updated_at: new Date().toISOString() })
      .eq("id", leadId);
    setLeads((p) => p.map((l) => (l.id === leadId ? { ...l, stage } : l)));
  };

  const handleReassignLead = async (leadId, salesmanId) => {
    await supabase
      .from("leads")
      .update({ salesman_id: salesmanId, assigned_to: salesmanId })
      .eq("id", leadId);
    setLeads((p) =>
      p.map((l) =>
        l.id === leadId
          ? { ...l, salesman_id: salesmanId, assigned_to: salesmanId }
          : l,
      ),
    );
  };

  const handleUpdateBooking = async (id, status) => {
    await supabase.from("appointments").update({ status }).eq("id", id);
    setBookings((p) => p.map((b) => (b.id === id ? { ...b, status } : b)));
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setBroadcastSaving(true);
    const inserts = salesmen.map((s) => ({
      salesman_id: s.id,
      type: "broadcast",
      title: "📢 Message from Manager",
      body: broadcastMsg.trim(),
    }));
    await supabase.from("salesman_notifications").insert(inserts);
    setBroadcastMsg("");
    setBroadcastSaving(false);
    setBroadcastDone(true);
    setTimeout(() => {
      setBroadcastDone(false);
      setShowBroadcast(false);
    }, 2000);
  };

  const handleMarkNoteRead = async (n) => {
    if (n.is_read) return;
    await supabase
      .from("salesman_notes")
      .update({ is_read: true })
      .eq("id", n.id);
    setNotifications((p) =>
      p.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
    );
  };

  // ── Booking row renderer ──────────────────────────────────────────────────
  const renderBookingRows = (rows) => (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {[
              "Buyer",
              "Phone",
              "Car",
              "Salesman",
              "Date",
              "Status",
              "Actions",
            ].map((h) => (
              <th
                key={h}
                style={{
                  padding: "8px 14px",
                  fontSize: 10,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  textAlign: "left",
                  whiteSpace: "nowrap",
                  fontWeight: 600,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={7}
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "#374151",
                  fontSize: 13,
                }}
              >
                No bookings.
              </td>
            </tr>
          )}
          {rows.map((b) => {
            const car = b.car_listings;
            const sm = b.profiles;
            const isNew = Date.now() - new Date(b.created_at) < 7200000;
            const statusColors = {
              confirmed: {
                bg: "rgba(74,222,128,0.1)",
                bd: "rgba(74,222,128,0.25)",
                tx: "#4ade80",
              },
              pending: {
                bg: "rgba(251,191,36,0.1)",
                bd: "rgba(251,191,36,0.25)",
                tx: "#fbbf24",
              },
              cancelled: {
                bg: "rgba(107,114,128,0.1)",
                bd: "rgba(107,114,128,0.2)",
                tx: "#9ca3af",
              },
              no_show: {
                bg: "rgba(248,113,113,0.1)",
                bd: "rgba(248,113,113,0.25)",
                tx: "#f87171",
              },
            }[b.status] || {
              bg: "rgba(251,191,36,0.1)",
              bd: "rgba(251,191,36,0.25)",
              tx: "#fbbf24",
            };
            return (
              <tr
                key={b.id}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(249,115,22,0.03)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <td
                  style={{
                    padding: "10px 14px",
                    color: "#f0f2f5",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {b.buyer_name || "—"}
                  {isNew && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 9,
                        fontWeight: 800,
                        background: "rgba(249,115,22,0.15)",
                        border: "1px solid rgba(249,115,22,0.3)",
                        color: ACCENT,
                        borderRadius: 4,
                        padding: "1px 5px",
                      }}
                    >
                      NEW
                    </span>
                  )}
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    color: "#9ca3af",
                    fontSize: 13,
                  }}
                >
                  {b.buyer_phone || "—"}
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    color: "#9ca3af",
                    fontSize: 13,
                  }}
                >
                  {car ? `${car.brand} ${car.model}` : "—"}
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    color: "#9ca3af",
                    fontSize: 12,
                  }}
                >
                  {sm?.full_name || "—"}
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    color: "#f0f2f5",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.appointment_date
                    ? new Date(b.appointment_date).toLocaleString("en-MY", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: statusColors.bg,
                      border: `1px solid ${statusColors.bd}`,
                      color: statusColors.tx,
                      textTransform: "capitalize",
                    }}
                  >
                    {b.status || "pending"}
                  </span>
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {b.status !== "confirmed" && (
                      <button
                        onClick={() => handleUpdateBooking(b.id, "confirmed")}
                        style={{
                          fontSize: 10,
                          padding: "3px 8px",
                          borderRadius: 5,
                          background: "rgba(74,222,128,0.08)",
                          border: "1px solid rgba(74,222,128,0.2)",
                          color: "#4ade80",
                          cursor: "pointer",
                          fontFamily: "'DM Sans',sans-serif",
                        }}
                      >
                        Confirm
                      </button>
                    )}
                    {b.status !== "cancelled" && (
                      <button
                        onClick={() => handleUpdateBooking(b.id, "cancelled")}
                        style={{
                          fontSize: 10,
                          padding: "3px 8px",
                          borderRadius: 5,
                          background: "rgba(107,114,128,0.08)",
                          border: "1px solid rgba(107,114,128,0.18)",
                          color: "#6b7280",
                          cursor: "pointer",
                          fontFamily: "'DM Sans',sans-serif",
                        }}
                      >
                        Cancel
                      </button>
                    )}
                    {b.buyer_phone && (
                      <a
                        href={`https://wa.me/${b.buyer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${b.buyer_name || "there"}, confirming your appointment. See you soon!`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 10,
                          padding: "3px 8px",
                          borderRadius: 5,
                          background: "rgba(37,211,102,0.08)",
                          border: "1px solid rgba(37,211,102,0.2)",
                          color: "#4ade80",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        WA
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // ── Loading gate ──────────────────────────────────────────────────────────
  if (loading)
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
        <p style={{ color: "#6b7280", fontFamily: "'DM Sans',sans-serif" }}>
          Loading...
        </p>
      </div>
    );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05070e",
        fontFamily: "'DM Sans',sans-serif",
        color: "#f0f2f5",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          background: "rgba(5,7,14,0.95)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 56,
          position: "sticky",
          top: 0,
          zIndex: 20,
          backdropFilter: "blur(20px)",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: "linear-gradient(135deg,#f97316,#ea580c)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "'Bebas Neue',sans-serif",
              fontSize: 14,
              color: "#fff",
            }}
          >
            S
          </span>
        </div>
        <span
          style={{
            fontFamily: "'Bebas Neue',sans-serif",
            fontSize: 18,
            letterSpacing: 3,
            color: ACCENT,
          }}
        >
          MANAGER
        </span>
        <span style={{ fontSize: 12, color: "#374151" }}>
          · {profile?.dealership}
        </span>

        <button
          onClick={() => setShowBroadcast(true)}
          style={{ ...S.btn, marginLeft: "auto" }}
        >
          <Megaphone style={{ width: 13, height: 13 }} />
          Broadcast
        </button>

        {/* Notifications */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setNotifOpen((p) => !p)}
            style={{
              position: "relative",
              background:
                unreadNotes > 0 ? "rgba(249,115,22,0.1)" : "transparent",
              border:
                unreadNotes > 0
                  ? "1px solid rgba(249,115,22,0.25)"
                  : "1px solid transparent",
              borderRadius: 8,
              padding: 7,
              cursor: "pointer",
              color: unreadNotes > 0 ? ACCENT : "#6b7280",
              display: "flex",
            }}
          >
            <Bell style={{ width: 16, height: 16 }} />
            {unreadNotes > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  background: ACCENT,
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
                {unreadNotes > 9 ? "9+" : unreadNotes}
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
                  top: "115%",
                  right: 0,
                  zIndex: 50,
                  width: 300,
                  maxHeight: 360,
                  overflowY: "auto",
                  background: "#0d1117",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: "#f3f4f6" }}
                  >
                    Team Messages
                  </span>
                </div>
                {ownerMessages.length === 0 && notifications.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#4b5563", padding: "20px", textAlign: "center" }}>
                    No messages yet
                  </p>
                ) : (
                  <>
                    {ownerMessages.length > 0 && (
                      <>
                        <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", padding: "8px 16px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>From Owner</p>
                        {ownerMessages.map((n) => (
                          <div
                            key={n.id}
                            onClick={async () => {
                              if (!n.is_read) {
                                await supabase.from("salesman_notifications").update({ is_read: true }).eq("id", n.id);
                                setOwnerMessages(p => p.map(x => x.id === n.id ? { ...x, is_read: true } : x));
                              }
                            }}
                            style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: n.is_read ? "transparent" : "rgba(249,115,22,0.05)", cursor: "pointer" }}
                          >
                            <div style={{ display: "flex", gap: 8 }}>
                              {!n.is_read && <div style={{ width: 6, height: 6, background: ACCENT, borderRadius: "50%", flexShrink: 0, marginTop: 5 }} />}
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 600, color: "#f3f4f6", margin: "0 0 2px" }}>{n.title || "Message from Owner"}</p>
                                <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 3px" }}>{n.body}</p>
                                <p style={{ fontSize: 10, color: "#4b5563" }}>{timeAgo(n.created_at)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {notifications.length > 0 && (
                      <>
                        <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", padding: "8px 16px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>Team Notes</p>
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleMarkNoteRead(n)}
                            style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: n.is_read ? "transparent" : "rgba(249,115,22,0.04)", cursor: "pointer" }}
                          >
                            <div style={{ display: "flex", gap: 8 }}>
                              {!n.is_read && <div style={{ width: 6, height: 6, background: ACCENT, borderRadius: "50%", flexShrink: 0, marginTop: 5 }} />}
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 600, color: "#f3f4f6", margin: "0 0 2px" }}>{n.profiles?.full_name || "Salesman"}</p>
                                <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 3px" }}>{n.content}</p>
                                <p style={{ fontSize: 10, color: "#4b5563" }}>{timeAgo(n.created_at)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <span style={{ fontSize: 13, color: "#6b7280" }}>
          {profile?.full_name}
        </span>
        <button
          onClick={() => supabase.auth.signOut().then(() => navigate("/login"))}
          style={{
            background: "none",
            border: "none",
            color: "#6b7280",
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <LogOut style={{ width: 14, height: 14 }} />
        </button>
      </header>

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "0 24px",
          display: "flex",
          gap: 0,
          overflowX: "auto",
        }}
      >
        {[
          { id: "team", label: "Team", Icon: Users, badge: salesmen.length },
          {
            id: "listings",
            label: "Listings",
            Icon: Car,
            badge: listings.length,
          },
          {
            id: "bookings",
            label: "Bookings",
            Icon: Calendar,
            badge: todaysBookings.length || null,
          },
          {
            id: "leads",
            label: "Leads",
            Icon: TrendingUp,
            badge: leads.filter((l) => l.stage === "new").length || null,
          },
          { id: "analytics", label: "Analytics", Icon: BarChart2, badge: null },
        ].map(({ id, label, Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveNav(id)}
            style={{
              padding: "12px 16px",
              background: "none",
              border: "none",
              borderBottom:
                activeNav === id
                  ? `2px solid ${ACCENT}`
                  : "2px solid transparent",
              color: activeNav === id ? ACCENT : "#6b7280",
              fontSize: 13,
              fontWeight: activeNav === id ? 600 : 400,
              cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <Icon style={{ width: 14, height: 14 }} />
            {label}
            {badge > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 10,
                  background:
                    activeNav === id
                      ? "rgba(249,115,22,0.15)"
                      : "rgba(255,255,255,0.05)",
                  color: activeNav === id ? ACCENT : "#4b5563",
                }}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
        {/* ── TEAM ─────────────────────────────────────────────────────────── */}
        {activeNav === "team" && (
          <div>
            {/* Summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {[
                { label: "Total Team", val: salesmen.length, color: ACCENT },
                {
                  label: "Active",
                  val: salesmen.filter((s) => s.is_active !== false).length,
                  color: "#4ade80",
                },
                {
                  label: "Total Listings",
                  val: listings.length,
                  color: "#93c5fd",
                },
                {
                  label: "Total Bookings",
                  val: bookings.length,
                  color: "#fbbf24",
                },
                {
                  label: "Open Leads",
                  val: leads.filter((l) => !["won", "lost"].includes(l.stage))
                    .length,
                  color: "#c084fc",
                },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ ...S.card, padding: "14px 16px" }}>
                  <p
                    style={{
                      fontSize: 10,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{
                      fontFamily: "'Bebas Neue',sans-serif",
                      fontSize: 32,
                      color,
                      margin: 0,
                      lineHeight: 1,
                    }}
                  >
                    {val}
                  </p>
                </div>
              ))}
            </div>

            {/* Salesman cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 12,
              }}
            >
              {salesmen.map((s) => {
                const stats = salesmanStats[s.id] || {};
                const isActive = s.is_active !== false;
                const now = new Date();
                const thisMonthSales = listings.filter((l) => {
                  if (l.assigned_to !== s.id || l.status !== "sold")
                    return false;
                  const d = new Date(l.created_at);
                  return (
                    d.getMonth() === now.getMonth() &&
                    d.getFullYear() === now.getFullYear()
                  );
                }).length;
                const target = s.monthly_target || 5;
                const pct = Math.min(100, (thisMonthSales / target) * 100);

                return (
                  <div
                    key={s.id}
                    style={{
                      ...S.card,
                      padding: 16,
                      opacity: isActive ? 1 : 0.5,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: `linear-gradient(135deg,${ACCENT},#ea580c)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        {(s.full_name || "S")[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#f0f2f5",
                            margin: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.full_name}
                        </p>
                        <p
                          style={{ fontSize: 11, color: "#6b7280", margin: 0 }}
                        >
                          /{s.slug || "—"}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: isActive
                            ? "rgba(74,222,128,0.1)"
                            : "rgba(107,114,128,0.1)",
                          border: `1px solid ${isActive ? "rgba(74,222,128,0.25)" : "rgba(107,114,128,0.2)"}`,
                          color: isActive ? "#4ade80" : "#6b7280",
                        }}
                      >
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4,1fr)",
                        gap: 6,
                        marginBottom: 10,
                      }}
                    >
                      {[
                        {
                          label: "Cars",
                          val: stats.listings || 0,
                          color: "#93c5fd",
                        },
                        {
                          label: "Bookings",
                          val: stats.bookings || 0,
                          color: "#fbbf24",
                        },
                        {
                          label: "Clicks",
                          val: stats.clicks || 0,
                          color: "#c084fc",
                        },
                        {
                          label: "Enquiries",
                          val: stats.enquiries || 0,
                          color: "#4ade80",
                        },
                      ].map(({ label, val, color }) => (
                        <div
                          key={label}
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: 6,
                            padding: "6px 4px",
                            textAlign: "center",
                          }}
                        >
                          <p
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color,
                              margin: 0,
                            }}
                          >
                            {val}
                          </p>
                          <p
                            style={{ fontSize: 9, color: "#4b5563", margin: 0 }}
                          >
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontSize: 10, color: "#6b7280" }}>
                          Monthly target
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: pct >= 100 ? "#4ade80" : ACCENT,
                          }}
                        >
                          {thisMonthSales}/{target}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 4,
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: pct >= 100 ? "#4ade80" : ACCENT,
                            borderRadius: 4,
                            transition: "width 0.4s",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => handleToggleSalesman(s)}
                        style={{ ...S.btn, fontSize: 11, padding: "5px 10px" }}
                      >
                        {isActive ? (
                          <>
                            <ToggleRight style={{ width: 12, height: 12 }} />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <ToggleLeft style={{ width: 12, height: 12 }} />
                            Activate
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setActiveNav("leads")}
                        style={{
                          ...S.btn,
                          fontSize: 11,
                          padding: "5px 10px",
                          background: "rgba(147,197,253,0.08)",
                          border: "1px solid rgba(147,197,253,0.2)",
                          color: "#93c5fd",
                        }}
                      >
                        <TrendingUp style={{ width: 12, height: 12 }} />
                        {stats.leads || 0} Leads
                      </button>
                    </div>
                  </div>
                );
              })}
              {salesmen.length === 0 && (
                <p style={{ color: "#374151", fontSize: 13, padding: 20 }}>
                  No salesmen found.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── LISTINGS ─────────────────────────────────────────────────────── */}
        {activeNav === "listings" && (
          <div>
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 16,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ position: "relative", flex: "1 1 200px" }}>
                <Search
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 13,
                    height: 13,
                    color: "#6b7280",
                    pointerEvents: "none",
                  }}
                />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search listings..."
                  style={{ ...S.input, paddingLeft: 32 }}
                />
              </div>
              <button
                onClick={() => setShowAddListing(true)}
                style={S.btnPrimary}
              >
                <Plus style={{ width: 14, height: 14 }} />
                Add Listing
              </button>
            </div>

            <div style={{ ...S.card, overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {[
                      "",
                      "Vehicle",
                      "Price",
                      "Mileage",
                      "Status",
                      "Assigned To",
                      "Age",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 14px",
                          fontSize: 10,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#6b7280",
                          fontWeight: 600,
                          textAlign: "left",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listings
                    .filter(
                      (l) =>
                        !searchQuery ||
                        `${l.brand} ${l.model} ${l.variant || ""}`
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()),
                    )
                    .map((l) => {
                      const assignee = l.assigned_to
                        ? salesmenById[l.assigned_to]
                        : null;
                      const age = Math.floor(
                        (Date.now() - new Date(l.created_at)) / 86400000,
                      );
                      const isHot =
                        l.original_price &&
                        l.selling_price &&
                        l.selling_price <= l.original_price * 0.97;
                      return (
                        <tr
                          key={l.id}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "rgba(249,115,22,0.03)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <td
                            style={{ padding: "10px 6px 10px 14px", width: 52 }}
                          >
                            {l.images?.[0] ? (
                              <img
                                src={l.images[0]}
                                alt=""
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 6,
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 6,
                                  background: "rgba(255,255,255,0.04)",
                                }}
                              />
                            )}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <p
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#f0f2f5",
                                margin: 0,
                              }}
                            >
                              {l.brand} {l.model}
                            </p>
                            <p
                              style={{
                                fontSize: 11,
                                color: "#6b7280",
                                margin: "2px 0 0",
                              }}
                            >
                              {l.year}
                              {l.variant ? ` · ${l.variant}` : ""}
                            </p>
                          </td>
                          <td
                            style={{
                              padding: "10px 14px",
                              fontSize: 13,
                              color: "#f0f2f5",
                              whiteSpace: "nowrap",
                            }}
                          >
                            RM {(l.selling_price || 0).toLocaleString()}
                            {isHot && (
                              <span
                                style={{
                                  marginLeft: 5,
                                  fontSize: 9,
                                  color: "#f87171",
                                  background: "rgba(220,38,38,0.1)",
                                  border: "1px solid rgba(220,38,38,0.2)",
                                  borderRadius: 4,
                                  padding: "1px 5px",
                                }}
                              >
                                HOT
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "10px 14px",
                              fontSize: 13,
                              color: "#9ca3af",
                            }}
                          >
                            {l.mileage
                              ? `${Number(l.mileage).toLocaleString()} km`
                              : "—"}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background:
                                  l.status === "sold"
                                    ? "rgba(107,114,128,0.12)"
                                    : l.status === "reserved"
                                      ? "rgba(251,191,36,0.12)"
                                      : "rgba(74,222,128,0.12)",
                                color:
                                  l.status === "sold"
                                    ? "#9ca3af"
                                    : l.status === "reserved"
                                      ? "#fbbf24"
                                      : "#4ade80",
                                textTransform: "capitalize",
                              }}
                            >
                              {l.status || "available"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ position: "relative" }}>
                              <button
                                onClick={() =>
                                  setAssignDropdown(
                                    assignDropdown === l.id ? null : l.id,
                                  )
                                }
                                style={{
                                  fontSize: 12,
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  background: "rgba(255,255,255,0.04)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  color: assignee ? "#f0f2f5" : "#4b5563",
                                  cursor: "pointer",
                                  fontFamily: "'DM Sans',sans-serif",
                                }}
                              >
                                {assignee ? assignee.full_name : "Unassigned"}
                              </button>
                              {assignDropdown === l.id && (
                                <>
                                  <div
                                    onClick={() => setAssignDropdown(null)}
                                    style={{
                                      position: "fixed",
                                      inset: 0,
                                      zIndex: 40,
                                    }}
                                  />
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "100%",
                                      left: 0,
                                      zIndex: 50,
                                      marginTop: 4,
                                      background: "#0d1117",
                                      border:
                                        "1px solid rgba(255,255,255,0.08)",
                                      borderRadius: 8,
                                      overflow: "hidden",
                                      minWidth: 150,
                                      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                                    }}
                                  >
                                    {l.assigned_to && (
                                      <button
                                        onClick={() => handleUnassign(l.id)}
                                        style={{
                                          width: "100%",
                                          padding: "8px 12px",
                                          background: "none",
                                          border: "none",
                                          color: "#9ca3af",
                                          fontSize: 12,
                                          cursor: "pointer",
                                          textAlign: "left",
                                          fontFamily: "'DM Sans',sans-serif",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 6,
                                        }}
                                      >
                                        <X style={{ width: 11, height: 11 }} />
                                        Unassign
                                      </button>
                                    )}
                                    {salesmen.map((s) => (
                                      <button
                                        key={s.id}
                                        onClick={() => handleAssign(l.id, s.id)}
                                        style={{
                                          width: "100%",
                                          padding: "8px 12px",
                                          background:
                                            l.assigned_to === s.id
                                              ? "rgba(249,115,22,0.08)"
                                              : "none",
                                          border: "none",
                                          color:
                                            l.assigned_to === s.id
                                              ? ACCENT
                                              : "#d1d5db",
                                          fontSize: 12,
                                          cursor: "pointer",
                                          textAlign: "left",
                                          fontFamily: "'DM Sans',sans-serif",
                                        }}
                                      >
                                        {s.full_name}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span
                              style={{
                                fontSize: 11,
                                color:
                                  age > 30
                                    ? "#f87171"
                                    : age > 14
                                      ? "#fbbf24"
                                      : "#4ade80",
                              }}
                            >
                              {age}d
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            {l.slug && (
                              <a
                                href={`/cars/${l.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: 11,
                                  padding: "4px 8px",
                                  borderRadius: 5,
                                  background: "rgba(255,255,255,0.04)",
                                  border: "1px solid rgba(255,255,255,0.07)",
                                  color: "#9ca3af",
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <Eye style={{ width: 10, height: 10 }} />
                                View
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {listings.length === 0 && (
                <p
                  style={{
                    padding: 32,
                    textAlign: "center",
                    color: "#374151",
                    fontSize: 13,
                  }}
                >
                  No listings yet.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── BOOKINGS ─────────────────────────────────────────────────────── */}
        {activeNav === "bookings" && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                gap: 12,
                marginBottom: 16,
              }}
            >
              {[
                { label: "Today", val: todaysBookings.length, color: ACCENT },
                {
                  label: "Pending",
                  val: bookings.filter((b) => b.status === "pending").length,
                  color: "#fbbf24",
                },
                {
                  label: "Confirmed",
                  val: bookings.filter((b) => b.status === "confirmed").length,
                  color: "#4ade80",
                },
                { label: "Total", val: bookings.length, color: "#93c5fd" },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ ...S.card, padding: "14px 16px" }}>
                  <p
                    style={{
                      fontSize: 10,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{
                      fontFamily: "'Bebas Neue',sans-serif",
                      fontSize: 30,
                      color,
                      margin: 0,
                      lineHeight: 1,
                    }}
                  >
                    {val}
                  </p>
                </div>
              ))}
            </div>

            {todaysBookings.length > 0 && (
              <div style={{ ...S.card, marginBottom: 12, overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "12px 16px",
                    ...S.divider,
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: ACCENT,
                      boxShadow: `0 0 6px ${ACCENT}`,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: ACCENT,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    Today's Bookings
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 7px",
                      borderRadius: 10,
                      background: "rgba(249,115,22,0.12)",
                      border: "1px solid rgba(249,115,22,0.25)",
                      color: ACCENT,
                    }}
                  >
                    {todaysBookings.length}
                  </span>
                </div>
                {renderBookingRows(todaysBookings)}
              </div>
            )}

            <div style={{ ...S.card, overflow: "hidden" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  ...S.divider,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#6b7280",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  All Bookings
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 7px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.05)",
                    color: "#4b5563",
                  }}
                >
                  {otherBookings.length}
                </span>
              </div>
              {renderBookingRows(otherBookings)}
            </div>
          </div>
        )}

        {/* ── LEADS ────────────────────────────────────────────────────────── */}
        {activeNav === "leads" && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
                gap: 12,
                marginBottom: 16,
              }}
            >
              {LEAD_STAGES.slice(0, -1).map((stage) => {
                const count = leads.filter((l) => l.stage === stage).length;
                return (
                  <div key={stage} style={{ ...S.card, padding: "12px 14px" }}>
                    <p
                      style={{
                        fontSize: 9,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        margin: "0 0 4px",
                      }}
                    >
                      {stage.replace("_", " ")}
                    </p>
                    <p
                      style={{
                        fontFamily: "'Bebas Neue',sans-serif",
                        fontSize: 28,
                        color: STAGE_COLOR[stage],
                        margin: 0,
                        lineHeight: 1,
                      }}
                    >
                      {count}
                    </p>
                  </div>
                );
              })}
            </div>

            <div style={{ overflowX: "auto" }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  minWidth: 900,
                  paddingBottom: 8,
                }}
              >
                {[
                  "new",
                  "contacted",
                  "viewing_booked",
                  "test_drive",
                  "negotiating",
                  "deposit_taken",
                ].map((stage) => {
                  const stageLeads = leads.filter((l) => l.stage === stage);
                  const color = STAGE_COLOR[stage];
                  return (
                    <div
                      key={stage}
                      style={{
                        flex: "0 0 180px",
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
                            fontSize: 9,
                            fontWeight: 700,
                            color,
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                          }}
                        >
                          {stage.replace("_", " ")}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "0 6px",
                            borderRadius: 10,
                            background: `${color}18`,
                            border: `1px solid ${color}30`,
                            color,
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
                              color: "#1f2937",
                              textAlign: "center",
                              padding: "10px 0",
                            }}
                          >
                            Empty
                          </p>
                        )}
                        {stageLeads.map((lead) => {
                          const car = lead.car_listings;
                          const assignee = lead.salesman_id
                            ? salesmenById[lead.salesman_id]
                            : null;
                          const stageIdx = LEAD_STAGES.indexOf(stage);
                          const nextStage = LEAD_STAGES[stageIdx + 1];
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
                                  color: "#f0f2f5",
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
                                    margin: "0 0 3px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {car.brand} {car.model}
                                </p>
                              )}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  marginBottom: 6,
                                }}
                              >
                                <div
                                  style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: "50%",
                                    background: ACCENT,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 7,
                                    fontWeight: 700,
                                    color: "#fff",
                                    flexShrink: 0,
                                  }}
                                >
                                  {(assignee?.full_name ||
                                    "?")[0].toUpperCase()}
                                </div>
                                <select
                                  value={lead.salesman_id || ""}
                                  onChange={(e) =>
                                    handleReassignLead(lead.id, e.target.value)
                                  }
                                  style={{
                                    fontSize: 10,
                                    color: "#9ca3af",
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: 4,
                                    padding: "1px 4px",
                                    outline: "none",
                                    fontFamily: "'DM Sans',sans-serif",
                                    cursor: "pointer",
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                >
                                  <option value="">Unassigned</option>
                                  {salesmen.map((s) => (
                                    <option
                                      key={s.id}
                                      value={s.id}
                                      style={{ background: "#111827" }}
                                    >
                                      {s.full_name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 3,
                                  flexWrap: "wrap",
                                }}
                              >
                                {nextStage && nextStage !== "lost" && (
                                  <button
                                    onClick={() =>
                                      handleUpdateLeadStage(lead.id, nextStage)
                                    }
                                    style={{
                                      fontSize: 9,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      background: "rgba(249,115,22,0.1)",
                                      border: "1px solid rgba(249,115,22,0.2)",
                                      color: ACCENT,
                                      cursor: "pointer",
                                      fontFamily: "'DM Sans',sans-serif",
                                    }}
                                  >
                                    → {nextStage.replace("_", " ")}
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    handleUpdateLeadStage(lead.id, "won")
                                  }
                                  style={{
                                    fontSize: 9,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: "rgba(74,222,128,0.08)",
                                    border: "1px solid rgba(74,222,128,0.2)",
                                    color: "#4ade80",
                                    cursor: "pointer",
                                    fontFamily: "'DM Sans',sans-serif",
                                  }}
                                >
                                  Won
                                </button>
                                <button
                                  onClick={() =>
                                    handleUpdateLeadStage(lead.id, "lost")
                                  }
                                  style={{
                                    fontSize: 9,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: "rgba(107,114,128,0.08)",
                                    border: "1px solid rgba(107,114,128,0.18)",
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
        )}

        {/* ── ANALYTICS ────────────────────────────────────────────────────── */}
        {activeNav === "analytics" && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {[
                {
                  label: "Total Clicks",
                  val: events.filter((e) =>
                    ["link_visit", "car_view"].includes(e.event_type),
                  ).length,
                  color: "#93c5fd",
                },
                {
                  label: "WhatsApp",
                  val: events.filter((e) => e.event_type === "whatsapp_click")
                    .length,
                  color: "#4ade80",
                },
                {
                  label: "Call Clicks",
                  val: events.filter((e) => e.event_type === "call_click")
                    .length,
                  color: "#fbbf24",
                },
                {
                  label: "Total Enquiries",
                  val: events.filter((e) =>
                    ["whatsapp_click", "call_click"].includes(e.event_type),
                  ).length,
                  color: "#c084fc",
                },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ ...S.card, padding: "14px 16px" }}>
                  <p
                    style={{
                      fontSize: 10,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{
                      fontFamily: "'Bebas Neue',sans-serif",
                      fontSize: 32,
                      color,
                      margin: 0,
                      lineHeight: 1,
                    }}
                  >
                    {val}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ ...S.card, overflow: "hidden" }}>
              <div
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#f0f2f5",
                    margin: 0,
                  }}
                >
                  Salesman Performance
                </p>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      {[
                        "Salesman",
                        "Listings",
                        "Bookings",
                        "Leads",
                        "Clicks",
                        "Enquiries",
                        "CVR",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "8px 14px",
                            fontSize: 10,
                            color: "#6b7280",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            textAlign: "left",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...salesmen]
                      .sort(
                        (a, b) =>
                          (salesmanStats[b.id]?.enquiries || 0) -
                          (salesmanStats[a.id]?.enquiries || 0),
                      )
                      .map((s, i) => {
                        const st = salesmanStats[s.id] || {};
                        const cvr =
                          st.clicks > 0
                            ? ((st.enquiries / st.clicks) * 100).toFixed(1) +
                              "%"
                            : "—";
                        const cvrNum = parseFloat(cvr);
                        return (
                          <tr
                            key={s.id}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "rgba(249,115,22,0.03)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "transparent")
                            }
                          >
                            <td style={{ padding: "10px 14px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: ACCENT,
                                    width: 16,
                                  }}
                                >
                                  #{i + 1}
                                </span>
                                <div
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: "50%",
                                    background: `linear-gradient(135deg,${ACCENT},#ea580c)`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: "#fff",
                                    flexShrink: 0,
                                  }}
                                >
                                  {(s.full_name || "S")[0].toUpperCase()}
                                </div>
                                <span
                                  style={{
                                    fontSize: 13,
                                    color: "#f0f2f5",
                                    fontWeight: 500,
                                  }}
                                >
                                  {s.full_name}
                                </span>
                              </div>
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                fontSize: 13,
                                color: "#93c5fd",
                                fontWeight: 600,
                              }}
                            >
                              {st.listings || 0}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                fontSize: 13,
                                color: "#fbbf24",
                                fontWeight: 600,
                              }}
                            >
                              {st.bookings || 0}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                fontSize: 13,
                                color: "#c084fc",
                                fontWeight: 600,
                              }}
                            >
                              {st.leads || 0}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                fontSize: 13,
                                color: "#9ca3af",
                              }}
                            >
                              {st.clicks || 0}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                fontSize: 13,
                                color: "#4ade80",
                                fontWeight: 600,
                              }}
                            >
                              {st.enquiries || 0}
                            </td>
                            <td
                              style={{
                                padding: "10px 14px",
                                fontSize: 13,
                                fontWeight: 600,
                                color:
                                  cvrNum > 5
                                    ? "#4ade80"
                                    : cvrNum > 0
                                      ? "#fbbf24"
                                      : "#374151",
                              }}
                            >
                              {cvr}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Broadcast modal ───────────────────────────────────────────────── */}
      {showBroadcast && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#0d1117",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 24,
              width: "100%",
              maxWidth: 420,
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
                  color: "#f0f2f5",
                  margin: 0,
                }}
              >
                Broadcast to Team
              </p>
              <button
                onClick={() => setShowBroadcast(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6b7280",
                  cursor: "pointer",
                }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
              Sends to all {salesmen.length} salesmen as a notification.
            </p>
            <textarea
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              rows={3}
              placeholder="e.g. Price drop on the Camry — push it today!"
              style={{ ...S.input, resize: "none", marginBottom: 12 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowBroadcast(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 8,
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
                onClick={handleBroadcast}
                disabled={
                  broadcastSaving || !broadcastMsg.trim() || broadcastDone
                }
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 8,
                  background: broadcastDone
                    ? "linear-gradient(135deg,#16a34a,#15803d)"
                    : "linear-gradient(135deg,#f97316,#ea580c)",
                  border: "none",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {broadcastDone ? (
                  <>
                    <Check style={{ width: 14, height: 14 }} />
                    Sent!
                  </>
                ) : broadcastSaving ? (
                  "Sending..."
                ) : (
                  <>
                    <Send style={{ width: 14, height: 14 }} />
                    Broadcast
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Listing modal ─────────────────────────────────────────────── */}
      {showAddListing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#0d1117",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              width: "100%",
              maxWidth: 700,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#f0f2f5",
                  margin: 0,
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                Add New Listing
              </p>
              <button
                onClick={() => setShowAddListing(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6b7280",
                  cursor: "pointer",
                }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div style={{ overflowY: "auto", padding: 20 }}>
              <CarForm
                onCreate={(newListing) => {
                  setListings((p) => [newListing, ...p]);
                  setShowAddListing(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
