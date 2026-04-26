import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { supabase } from "../supabaseClient";

const ACC = "#dc2626";

export default function AdminPanel() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [dealerId, setDealerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("listings");

  // Listings state
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingFilter, setListingFilter] = useState("all");
  const [listingSearch, setListingSearch] = useState("");
  const [listingSort, setListingSort] = useState("created_at");
  const [selectedListings, setSelectedListings] = useState([]);
  const [bulkAction, setBulkAction] = useState("");

  // Analytics state
  const [analytics, setAnalytics] = useState({
    views: 0,
    whatsapp: 0,
    calls: 0,
    topCars: [],
    daily: [],
  });
  const [analyticsRange, setAnalyticsRange] = useState(7);

  // Media state
  const [mediaStats, setMediaStats] = useState({
    totalImages: 0,
    listingsWithPhotos: 0,
    listingsNoPhotos: 0,
    orphaned: 0,
  });

  // Settings state
  const [settings, setSettings] = useState({});
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Team state
  const [team, setTeam] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

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
      if (!p || !["admin", "superadmin"].includes(p.role)) {
        navigate("/login");
        return;
      }
      setProfile(p);
      // Admin belongs to a dealer via dealer_id
      const did = p.dealer_id || p.id;
      setDealerId(did);
      setSettings({
        site_name: p.site_name || "",
        whatsapp_number: p.whatsapp_number || "",
        about_text: p.about_text || "",
        brand_color: p.brand_color || "#dc2626",
      });
      setLoading(false);
      loadListings(did);
      loadAnalytics(did, 7);
      loadMediaStats(did);
      loadTeam(did);

      const loadNotifs = () =>
        supabase.from("salesman_notifications").select("*")
          .eq("salesman_id", p.id).order("created_at", { ascending: false }).limit(20)
          .then(({ data: d }) => setNotifications(d || []));
      loadNotifs();
      const notifCh = supabase.channel("admin_notifs_" + p.id)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "salesman_notifications", filter: `salesman_id=eq.${p.id}` }, loadNotifs)
        .subscribe();
      return () => supabase.removeChannel(notifCh);
    });
  }, [navigate]);

  async function loadListings(did) {
    setListingsLoading(true);
    const { data } = await supabase
      .from("car_listings")
      .select(
        "id, brand, model, variant, year, status, selling_price, condition, images, created_at, assigned_to, mileage, slug",
      )
      .eq("dealer_id", did)
      .order("created_at", { ascending: false });
    setListings(data || []);
    setListingsLoading(false);
  }

  async function loadAnalytics(did, days) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data: events } = await supabase
      .from("analytics_events")
      .select("event_type, car_id, car_name, created_at")
      .eq("dealer_id", did)
      .gte("created_at", since);
    if (!events) return;
    const views = events.filter((e) => e.event_type === "car_view").length;
    const whatsapp = events.filter(
      (e) => e.event_type === "whatsapp_click",
    ).length;
    const calls = events.filter((e) => e.event_type === "call_click").length;

    // Top cars by view
    const carViews = {};
    events
      .filter((e) => e.event_type === "car_view" && e.car_name)
      .forEach((e) => {
        carViews[e.car_name] = (carViews[e.car_name] || 0) + 1;
      });
    const topCars = Object.entries(carViews)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Daily views
    const dailyMap = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = 0;
    }
    events
      .filter((e) => e.event_type === "car_view")
      .forEach((e) => {
        const key = e.created_at?.slice(0, 10);
        if (key && dailyMap[key] !== undefined) dailyMap[key]++;
      });
    const daily = Object.entries(dailyMap).map(([date, count]) => ({
      date: date.slice(5),
      count,
    }));

    setAnalytics({ views, whatsapp, calls, topCars, daily });
  }

  async function loadMediaStats(did) {
    const { data: listingsData } = await supabase
      .from("car_listings")
      .select("id, images")
      .eq("dealer_id", did);
    if (!listingsData) return;
    const totalImages = listingsData.reduce(
      (sum, l) => sum + (l.images?.length || 0),
      0,
    );
    const withPhotos = listingsData.filter((l) => l.images?.length > 0).length;
    const noPhotos = listingsData.filter((l) => !l.images?.length).length;
    setMediaStats({
      totalImages,
      listingsWithPhotos: withPhotos,
      listingsNoPhotos: noPhotos,
    });
  }

  async function loadTeam(did) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active, created_at, job_title")
      .eq("dealer_id", did)
      .neq("role", "dealer");
    setTeam(data || []);
  }

  async function updateListingStatus(id, status) {
    await supabase.from("car_listings").update({ status }).eq("id", id);
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status } : l)),
    );
  }

  async function deleteListing(id) {
    if (!confirm("Delete this listing permanently?")) return;
    await supabase.from("car_listings").delete().eq("id", id);
    setListings((prev) => prev.filter((l) => l.id !== id));
  }

  async function bulkUpdateStatus(status) {
    if (!selectedListings.length) return;
    await supabase
      .from("car_listings")
      .update({ status })
      .in("id", selectedListings);
    setListings((prev) =>
      prev.map((l) => (selectedListings.includes(l.id) ? { ...l, status } : l)),
    );
    setSelectedListings([]);
  }

  async function saveSettings() {
    await supabase.from("profiles").update(settings).eq("id", profile.id);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }

  const filteredListings = listings
    .filter((l) => {
      const matchStatus = listingFilter === "all" || l.status === listingFilter;
      const matchSearch =
        !listingSearch ||
        `${l.brand} ${l.model} ${l.variant}`
          .toLowerCase()
          .includes(listingSearch.toLowerCase());
      return matchStatus && matchSearch;
    })
    .sort((a, b) => {
      if (listingSort === "created_at")
        return new Date(b.created_at) - new Date(a.created_at);
      if (listingSort === "price")
        return (b.selling_price || 0) - (a.selling_price || 0);
      if (listingSort === "name")
        return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
      return 0;
    });

  const statusColor = {
    available: "#4ade80",
    sold: "#f87171",
    reserved: "#facc15",
    draft: "#6b7280",
  };
  const statusBg = {
    available: "rgba(74,222,128,0.08)",
    sold: "rgba(248,113,113,0.08)",
    reserved: "rgba(250,204,21,0.08)",
    draft: "rgba(107,114,128,0.08)",
  };

  function fmtDate(str) {
    if (!str) return "—";
    return new Date(str).toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  function fmtPrice(n) {
    if (!n) return "—";
    return "RM " + Number(n).toLocaleString();
  }

  const inp = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#fff",
    fontFamily: "'DM Sans',sans-serif",
    fontSize: 13,
    padding: "9px 13px",
    borderRadius: 8,
    outline: "none",
    width: "100%",
  };
  const sel = { ...inp, cursor: "pointer" };

  const maxBarCount = Math.max(...analytics.daily.map((d) => d.count), 1);

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#08080f",
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #08080f; }
        .ap-root { min-height: 100vh; background: #08080f; font-family: 'DM Sans', sans-serif; color: #f0f2f5; }
        .ap-row:hover { background: rgba(255,255,255,0.02) !important; }
        .ap-check:checked { accent-color: #dc2626; }
        input:focus, select:focus, textarea:focus { border-color: rgba(220,38,38,0.5) !important; outline: none; }
        ::-webkit-scrollbar { width: 4px; height: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
      `}</style>

      <div className="ap-root">
        {/* Header */}
        <header
          style={{
            background: "rgba(8,8,20,0.98)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "0 24px",
            height: 52,
            display: "flex",
            alignItems: "center",
            gap: 16,
            position: "sticky",
            top: 0,
            zIndex: 20,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: ACC,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "'Bebas Neue',sans-serif",
              fontSize: 18,
              letterSpacing: 3,
              color: ACC,
            }}
          >
            ADMIN
          </span>
          <span style={{ fontSize: 13, color: "#4b5563" }}>
            {profile?.dealership || profile?.full_name}
          </span>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            {/* Notification bell */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setNotifOpen(p => !p)}
                style={{ position: "relative", padding: 6, borderRadius: 8, background: notifications.some(n => !n.is_read) ? "rgba(220,38,38,0.1)" : "transparent", border: notifications.some(n => !n.is_read) ? "1px solid rgba(220,38,38,0.25)" : "1px solid transparent", color: notifications.some(n => !n.is_read) ? "#f87171" : "#6b7280", cursor: "pointer", display: "flex" }}
              >
                <Bell style={{ width: 16, height: 16 }} />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span style={{ position: "absolute", top: -3, right: -3, width: 16, height: 16, background: ACC, color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #05070e" }}>
                    {notifications.filter(n => !n.is_read).length > 9 ? "9+" : notifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div onClick={() => setNotifOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                  <div style={{ position: "absolute", top: "110%", right: 0, zIndex: 50, width: 300, maxHeight: 380, overflowY: "auto", background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", fontFamily: "'DM Sans',sans-serif" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#f3f4f6" }}>Notifications</span>
                      {notifications.some(n => !n.is_read) && (
                        <button onClick={async () => { const ids = notifications.filter(n => !n.is_read).map(n => n.id); await supabase.from("salesman_notifications").update({ is_read: true }).in("id", ids); setNotifications(p => p.map(n => ({ ...n, is_read: true }))); }} style={{ fontSize: 11, color: "#60a5fa", background: "none", border: "none", cursor: "pointer" }}>Mark all read</button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#4b5563", padding: "20px", textAlign: "center" }}>No messages yet</p>
                    ) : notifications.map(n => (
                      <div key={n.id} onClick={async () => { if (!n.is_read) { await supabase.from("salesman_notifications").update({ is_read: true }).eq("id", n.id); setNotifications(p => p.map(x => x.id === n.id ? { ...x, is_read: true } : x)); } }} style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: n.is_read ? "transparent" : "rgba(220,38,38,0.04)", cursor: "pointer" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          {!n.is_read && <div style={{ width: 6, height: 6, background: ACC, borderRadius: "50%", flexShrink: 0, marginTop: 5 }} />}
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#f3f4f6", margin: "0 0 2px" }}>{n.title || "Message from Owner"}</p>
                            <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 3px" }}>{n.body}</p>
                            <p style={{ fontSize: 10, color: "#4b5563" }}>{n.created_at ? new Date(n.created_at).toLocaleDateString("en-MY") : ""}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {profile?.full_name}
            </span>
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                fontSize: 12,
                color: "#6b7280",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                padding: "5px 12px",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ← Dashboard
            </button>
            <button
              onClick={() =>
                supabase.auth.signOut().then(() => navigate("/login"))
              }
              style={{
                fontSize: 12,
                color: "#9ca3af",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Nav */}
        <nav
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "0 24px",
            display: "flex",
            gap: 0,
            overflowX: "auto",
            background: "rgba(255,255,255,0.01)",
          }}
        >
          {[
            { id: "listings", label: `Listings (${listings.length})` },
            { id: "analytics", label: "Analytics" },
            { id: "media", label: "Media" },
            { id: "team", label: `Team (${team.length})` },
            { id: "settings", label: "Settings" },
          ].map((n) => (
            <button
              key={n.id}
              onClick={() => setActiveNav(n.id)}
              style={{
                padding: "12px 16px",
                background: "none",
                border: "none",
                borderBottom:
                  activeNav === n.id
                    ? `2px solid ${ACC}`
                    : "2px solid transparent",
                color: activeNav === n.id ? "#fff" : "#6b7280",
                fontSize: 13,
                fontWeight: activeNav === n.id ? 600 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <main style={{ padding: 24, maxWidth: 1300, margin: "0 auto" }}>
          {/* ── LISTINGS ── */}
          {activeNav === "listings" && (
            <div>
              {/* Stats row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                {[
                  { label: "Total", value: listings.length, color: "#e5e7eb" },
                  {
                    label: "Available",
                    value: listings.filter((l) => l.status === "available")
                      .length,
                    color: "#4ade80",
                  },
                  {
                    label: "Sold",
                    value: listings.filter((l) => l.status === "sold").length,
                    color: "#f87171",
                  },
                  {
                    label: "Draft",
                    value: listings.filter((l) => l.status === "draft").length,
                    color: "#6b7280",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 10,
                      padding: "14px 18px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 10,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        marginBottom: 6,
                      }}
                    >
                      {s.label}
                    </p>
                    <p
                      style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: s.color,
                        fontFamily: "'Bebas Neue',sans-serif",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Filters + Bulk */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 14,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <input
                  value={listingSearch}
                  onChange={(e) => setListingSearch(e.target.value)}
                  placeholder="Search brand, model…"
                  style={{ ...inp, width: 220 }}
                />
                <select
                  value={listingFilter}
                  onChange={(e) => setListingFilter(e.target.value)}
                  style={{ ...sel, width: 130 }}
                >
                  <option value="all">All Status</option>
                  <option value="available">Available</option>
                  <option value="sold">Sold</option>
                  <option value="reserved">Reserved</option>
                  <option value="draft">Draft</option>
                </select>
                <select
                  value={listingSort}
                  onChange={(e) => setListingSort(e.target.value)}
                  style={{ ...sel, width: 140 }}
                >
                  <option value="created_at">Newest First</option>
                  <option value="price">Price High–Low</option>
                  <option value="name">Name A–Z</option>
                </select>
                {selectedListings.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginLeft: "auto",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>
                      {selectedListings.length} selected
                    </span>
                    <button
                      onClick={() => bulkUpdateStatus("available")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid rgba(74,222,128,0.3)",
                        background: "rgba(74,222,128,0.06)",
                        color: "#4ade80",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Mark Available
                    </button>
                    <button
                      onClick={() => bulkUpdateStatus("sold")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid rgba(248,113,113,0.3)",
                        background: "rgba(248,113,113,0.06)",
                        color: "#f87171",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Mark Sold
                    </button>
                    <button
                      onClick={() => bulkUpdateStatus("draft")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid rgba(107,114,128,0.3)",
                        background: "rgba(107,114,128,0.06)",
                        color: "#9ca3af",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Draft
                    </button>
                    <button
                      onClick={() => setSelectedListings([])}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "none",
                        color: "#6b7280",
                        fontSize: 11,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      ✕ Clear
                    </button>
                  </div>
                )}
                <span
                  style={{
                    fontSize: 12,
                    color: "#4b5563",
                    marginLeft: selectedListings.length > 0 ? 0 : "auto",
                  }}
                >
                  {filteredListings.length} listings
                </span>
              </div>

              {/* Table */}
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
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
                          background: "rgba(255,255,255,0.025)",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <th style={{ padding: "10px 14px", width: 36 }}>
                          <input
                            type="checkbox"
                            className="ap-check"
                            checked={
                              selectedListings.length ===
                                filteredListings.length &&
                              filteredListings.length > 0
                            }
                            onChange={(e) =>
                              setSelectedListings(
                                e.target.checked
                                  ? filteredListings.map((l) => l.id)
                                  : [],
                              )
                            }
                          />
                        </th>
                        {[
                          "Car",
                          "Price",
                          "Status",
                          "Condition",
                          "Mileage",
                          "Photos",
                          "Added",
                          "Actions",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "10px 12px",
                              fontSize: 10,
                              textTransform: "uppercase",
                              letterSpacing: "0.1em",
                              color: "#6b7280",
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
                      {listingsLoading ? (
                        <tr>
                          <td
                            colSpan={9}
                            style={{
                              textAlign: "center",
                              padding: 40,
                              color: "#4b5563",
                            }}
                          >
                            Loading listings…
                          </td>
                        </tr>
                      ) : filteredListings.length === 0 ? (
                        <tr>
                          <td
                            colSpan={9}
                            style={{
                              textAlign: "center",
                              padding: 40,
                              color: "#4b5563",
                            }}
                          >
                            No listings found.
                          </td>
                        </tr>
                      ) : (
                        filteredListings.map((l) => (
                          <tr
                            key={l.id}
                            className="ap-row"
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                            }}
                          >
                            <td style={{ padding: "10px 14px" }}>
                              <input
                                type="checkbox"
                                className="ap-check"
                                checked={selectedListings.includes(l.id)}
                                onChange={(e) =>
                                  setSelectedListings((prev) =>
                                    e.target.checked
                                      ? [...prev, l.id]
                                      : prev.filter((id) => id !== l.id),
                                  )
                                }
                              />
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                {l.images?.[0] ? (
                                  <img
                                    src={l.images[0]}
                                    alt=""
                                    style={{
                                      width: 40,
                                      height: 32,
                                      objectFit: "cover",
                                      borderRadius: 4,
                                      flexShrink: 0,
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: 40,
                                      height: 32,
                                      background: "rgba(255,255,255,0.05)",
                                      borderRadius: 4,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <span style={{ fontSize: 14 }}>🚗</span>
                                  </div>
                                )}
                                <div>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      color: "#f0f0f0",
                                    }}
                                  >
                                    {l.brand} {l.model} {l.variant || ""}
                                  </div>
                                  <div
                                    style={{ fontSize: 10, color: "#6b7280" }}
                                  >
                                    {l.year} · {l.slug || l.id.slice(0, 8)}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                fontWeight: 600,
                                color: "#e5e7eb",
                              }}
                            >
                              {fmtPrice(l.selling_price)}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <select
                                value={l.status || "available"}
                                onChange={(e) =>
                                  updateListingStatus(l.id, e.target.value)
                                }
                                style={{
                                  background:
                                    statusBg[l.status] || "transparent",
                                  border: `1px solid ${statusColor[l.status] || "#6b7280"}33`,
                                  color: statusColor[l.status] || "#9ca3af",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                  outline: "none",
                                }}
                              >
                                <option value="available">Available</option>
                                <option value="sold">Sold</option>
                                <option value="reserved">Reserved</option>
                                <option value="draft">Draft</option>
                              </select>
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                color: "#9ca3af",
                                textTransform: "capitalize",
                              }}
                            >
                              {l.condition || "—"}
                            </td>
                            <td
                              style={{ padding: "10px 12px", color: "#9ca3af" }}
                            >
                              {l.mileage
                                ? Number(l.mileage).toLocaleString() + " km"
                                : "—"}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span
                                style={{
                                  color:
                                    l.images?.length > 0
                                      ? "#4ade80"
                                      : "#f87171",
                                  fontWeight: 600,
                                }}
                              >
                                {l.images?.length || 0}
                              </span>
                              <span style={{ color: "#4b5563" }}> photos</span>
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                color: "#6b7280",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {fmtDate(l.created_at)}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ display: "flex", gap: 5 }}>
                                {l.slug && (
                                  <a
                                    href={`/car/${l.slug}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: 5,
                                      border:
                                        "1px solid rgba(255,255,255,0.08)",
                                      background: "transparent",
                                      color: "#9ca3af",
                                      fontSize: 10,
                                      fontWeight: 600,
                                      textDecoration: "none",
                                      display: "inline-flex",
                                      alignItems: "center",
                                    }}
                                  >
                                    ↗ View
                                  </a>
                                )}
                                <button
                                  onClick={() => deleteListing(l.id)}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 5,
                                    border: "1px solid rgba(239,68,68,0.2)",
                                    background: "rgba(239,68,68,0.05)",
                                    color: "#f87171",
                                    fontSize: 10,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── ANALYTICS ── */}
          {activeNav === "analytics" && (
            <div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 20,
                  alignItems: "center",
                }}
              >
                <p style={{ fontSize: 13, color: "#9ca3af", marginRight: 8 }}>
                  Period:
                </p>
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setAnalyticsRange(d);
                      loadAnalytics(dealerId, d);
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: `1px solid ${analyticsRange === d ? ACC : "rgba(255,255,255,0.08)"}`,
                      background:
                        analyticsRange === d
                          ? "rgba(220,38,38,0.1)"
                          : "rgba(255,255,255,0.02)",
                      color: analyticsRange === d ? ACC : "#6b7280",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {d}d
                  </button>
                ))}
              </div>

              {/* Stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 14,
                  marginBottom: 24,
                }}
              >
                {[
                  {
                    label: "Car Views",
                    value: analytics.views,
                    icon: "👁",
                    color: "#60a5fa",
                  },
                  {
                    label: "WhatsApp Clicks",
                    value: analytics.whatsapp,
                    icon: "💬",
                    color: "#4ade80",
                  },
                  {
                    label: "Call Clicks",
                    value: analytics.calls,
                    icon: "📞",
                    color: "#facc15",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 12,
                      padding: "20px 24px",
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>
                      {s.icon}
                    </div>
                    <p
                      style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: s.color,
                        fontFamily: "'Bebas Neue',sans-serif",
                        letterSpacing: "0.05em",
                        marginBottom: 4,
                      }}
                    >
                      {s.value.toLocaleString()}
                    </p>
                    <p
                      style={{
                        fontSize: 11,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                {/* Daily bar chart */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 16,
                    }}
                  >
                    Daily Views — Last {analyticsRange} Days
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 4,
                      height: 100,
                    }}
                  >
                    {analytics.daily.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            background: ACC,
                            borderRadius: "3px 3px 0 0",
                            height: `${Math.max((d.count / maxBarCount) * 88, d.count > 0 ? 4 : 0)}px`,
                            transition: "height 0.3s",
                            opacity: 0.8,
                          }}
                          title={`${d.date}: ${d.count} views`}
                        />
                        {analytics.daily.length <= 10 && (
                          <span
                            style={{
                              fontSize: 8,
                              color: "#4b5563",
                              transform: "rotate(-45deg)",
                              transformOrigin: "center",
                            }}
                          >
                            {d.date}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {analytics.daily.length > 10 && (
                    <p
                      style={{
                        fontSize: 10,
                        color: "#4b5563",
                        marginTop: 8,
                        textAlign: "center",
                      }}
                    >
                      {analytics.daily[0]?.date} →{" "}
                      {analytics.daily[analytics.daily.length - 1]?.date}
                    </p>
                  )}
                </div>

                {/* Top cars */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 16,
                    }}
                  >
                    Top Cars by Views
                  </p>
                  {analytics.topCars.length === 0 ? (
                    <p style={{ color: "#4b5563", fontSize: 13 }}>
                      No data yet.
                    </p>
                  ) : (
                    analytics.topCars.map((c, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 12,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: "#4b5563",
                            width: 16,
                            textAlign: "right",
                          }}
                        >
                          {i + 1}
                        </span>
                        <div style={{ flex: 1 }}>
                          <p
                            style={{
                              fontSize: 12,
                              color: "#e5e7eb",
                              fontWeight: 600,
                              marginBottom: 3,
                            }}
                          >
                            {c.name}
                          </p>
                          <div
                            style={{
                              height: 4,
                              borderRadius: 2,
                              background: "rgba(255,255,255,0.05)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${(c.count / analytics.topCars[0].count) * 100}%`,
                                background: ACC,
                                borderRadius: 2,
                              }}
                            />
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            color: "#9ca3af",
                            fontWeight: 600,
                            width: 40,
                            textAlign: "right",
                          }}
                        >
                          {c.count}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── MEDIA ── */}
          {activeNav === "media" && (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 14,
                  marginBottom: 24,
                }}
              >
                {[
                  {
                    label: "Total Images",
                    value: mediaStats.totalImages,
                    color: "#60a5fa",
                  },
                  {
                    label: "Listings with Photos",
                    value: mediaStats.listingsWithPhotos,
                    color: "#4ade80",
                  },
                  {
                    label: "Listings No Photos",
                    value: mediaStats.listingsNoPhotos,
                    color: "#f87171",
                    sub: "Needs attention",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 12,
                      padding: "20px 24px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 10,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        marginBottom: 8,
                      }}
                    >
                      {s.label}
                    </p>
                    <p
                      style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: s.color,
                        fontFamily: "'Bebas Neue',sans-serif",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {s.value}
                    </p>
                    {s.sub && (
                      <p
                        style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}
                      >
                        {s.sub}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Listings without photos */}
              {mediaStats.listingsNoPhotos > 0 && (
                <div
                  style={{
                    background: "rgba(248,113,113,0.04)",
                    border: "1px solid rgba(248,113,113,0.15)",
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      color: "#f87171",
                      fontWeight: 700,
                      marginBottom: 12,
                    }}
                  >
                    ⚠ Listings Without Photos
                  </p>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {listings
                      .filter((l) => !l.images?.length)
                      .slice(0, 8)
                      .map((l) => (
                        <div
                          key={l.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            background: "rgba(255,255,255,0.02)",
                            borderRadius: 8,
                          }}
                        >
                          <span style={{ fontSize: 13, color: "#e5e7eb" }}>
                            {l.brand} {l.model} {l.variant} {l.year}
                          </span>
                          <span style={{ fontSize: 11, color: "#4b5563" }}>
                            {new Date(l.created_at).toLocaleDateString(
                              "en-MY",
                              { day: "numeric", month: "short" },
                            )}
                          </span>
                        </div>
                      ))}
                    {mediaStats.listingsNoPhotos > 8 && (
                      <p
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          padding: "4px 12px",
                        }}
                      >
                        +{mediaStats.listingsNoPhotos - 8} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TEAM ── */}
          {activeNav === "team" && (
            <div>
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {["Name", "Role", "Email", "Status", "Joined"].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "10px 16px",
                              fontSize: 10,
                              textTransform: "uppercase",
                              letterSpacing: "0.1em",
                              color: "#6b7280",
                              fontWeight: 600,
                            }}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {team.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            textAlign: "center",
                            padding: 40,
                            color: "#4b5563",
                          }}
                        >
                          No team members yet.
                        </td>
                      </tr>
                    ) : (
                      team.map((m) => (
                        <tr
                          key={m.id}
                          className="ap-row"
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <td style={{ padding: "10px 16px" }}>
                            <div style={{ fontWeight: 600, color: "#f0f0f0" }}>
                              {m.full_name || "—"}
                            </div>
                            {m.job_title && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#6b7280",
                                  marginTop: 2,
                                }}
                              >
                                {m.job_title}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            <span
                              style={{
                                padding: "3px 10px",
                                borderRadius: 20,
                                fontSize: 11,
                                fontWeight: 600,
                                background: "rgba(220,38,38,0.1)",
                                color: "#f87171",
                                border: "1px solid rgba(220,38,38,0.2)",
                                textTransform: "capitalize",
                              }}
                            >
                              {m.role}
                            </span>
                          </td>
                          <td
                            style={{ padding: "10px 16px", color: "#9ca3af" }}
                          >
                            {m.email || "—"}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color:
                                  m.is_active !== false ? "#4ade80" : "#f87171",
                              }}
                            >
                              {m.is_active !== false
                                ? "● Active"
                                : "○ Inactive"}
                            </span>
                          </td>
                          <td
                            style={{ padding: "10px 16px", color: "#6b7280" }}
                          >
                            {new Date(m.created_at).toLocaleDateString(
                              "en-MY",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activeNav === "settings" && (
            <div style={{ maxWidth: 600 }}>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 18 }}
              >
                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12,
                    padding: 24,
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 18,
                    }}
                  >
                    Dealership Identity
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          display: "block",
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Site Name
                      </label>
                      <input
                        value={settings.site_name || ""}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            site_name: e.target.value,
                          }))
                        }
                        style={inp}
                        placeholder="Your dealership name"
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          display: "block",
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        WhatsApp Number
                      </label>
                      <input
                        value={settings.whatsapp_number || ""}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            whatsapp_number: e.target.value,
                          }))
                        }
                        style={inp}
                        placeholder="+601X-XXXXXXX"
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          display: "block",
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Brand Color
                      </label>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <input
                          type="color"
                          value={settings.brand_color || "#dc2626"}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              brand_color: e.target.value,
                            }))
                          }
                          style={{
                            width: 44,
                            height: 36,
                            border: "none",
                            borderRadius: 8,
                            cursor: "pointer",
                            background: "transparent",
                            padding: 2,
                          }}
                        />
                        <input
                          value={settings.brand_color || "#dc2626"}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              brand_color: e.target.value,
                            }))
                          }
                          style={{ ...inp, width: 120 }}
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
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        About Text
                      </label>
                      <textarea
                        value={settings.about_text || ""}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            about_text: e.target.value,
                          }))
                        }
                        rows={4}
                        style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}
                        placeholder="Tell buyers about your dealership…"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={saveSettings}
                  style={{
                    padding: "12px",
                    borderRadius: 10,
                    border: "none",
                    background: settingsSaved ? "#16a34a" : ACC,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "background 0.2s",
                  }}
                >
                  {settingsSaved ? "✓ Saved" : "Save Changes"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
