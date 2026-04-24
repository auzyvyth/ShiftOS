import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "../supabaseClient";
import CarFormLite from "../components/CarFormLite";
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

export default function SalesmanLite() {
  const navigate = useNavigate();
  const isMobile = useWindowSize() < 768;

  const [profile, setProfile] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

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

      setProfile(profileData);
      setLoading(false);

      // fetch listings
      supabase
        .from("car_listings")
        .select(
          "id, slug, year, brand, model, variant, selling_price, status, images, colour, mileage, transmission",
        )
        .eq("dealer_id", uid)
        .neq("status", "sold")
        .order("created_at", { ascending: false })
        .then(({ data: lst }) => setMyListings(lst || []));

      // fetch analytics events (30d, scoped by salesman slug)
      const slug = profileData.slug;
      if (slug) {
        supabase
          .from("analytics_events")
          .select("event_type, car_id, car_name, created_at")
          .eq("salesman_slug", slug)
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .then(({ data: evts }) => setAnalyticsEvents(evts || []));
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
            .on("postgres_changes", {
              event: "*",
              schema: "public",
              table: "leads",
              filter: `salesman_id=eq.${uid}`,
            }, (payload) => {
              if (payload.eventType === "INSERT")
                setLeads((p) => [payload.new, ...p]);
              if (payload.eventType === "UPDATE")
                setLeads((p) =>
                  p.map((l) => (l.id === payload.new.id ? { ...l, ...payload.new } : l))
                );
              if (payload.eventType === "DELETE")
                setLeads((p) => p.filter((l) => l.id !== payload.old.id));
            })
            .on("postgres_changes", {
              event: "INSERT",
              schema: "public",
              table: "salesman_notifications",
              filter: `salesman_id=eq.${uid}`,
            }, (payload) => {
              toast(payload.new.title, { description: payload.new.body });
            })
            .on("postgres_changes", {
              event: "*",
              schema: "public",
              table: "whatsapp_enquiries",
              filter: `dealer_id=eq.${uid}`,
            }, (payload) => {
              if (payload.eventType === "INSERT") {
                setEnquiries((p) => [payload.new, ...p]);
                toast("New enquiry!", { description: payload.new.buyer_name || "Someone enquired" });
              }
              if (payload.eventType === "UPDATE")
                setEnquiries((p) => p.map((e) => e.id === payload.new.id ? { ...e, ...payload.new } : e));
            })
            .on("postgres_changes", {
              event: "*",
              schema: "public",
              table: "appointments",
              filter: `salesman_id=eq.${uid}`,
            }, (payload) => {
              if (payload.eventType === "INSERT") {
                setAppointments((p) => [payload.new, ...p]);
                toast("New booking!", { description: payload.new.buyer_name || "New appointment" });
              }
              if (payload.eventType === "UPDATE")
                setAppointments((p) => p.map((a) => a.id === payload.new.id ? { ...a, ...payload.new } : a));
            })
            .subscribe();
        });

      // fetch appointments
      supabase
        .from("appointments")
        .select("id, buyer_name, buyer_phone, appointment_date, status, notes, car_listing_id, car_listings(brand, model, year)")
        .eq("salesman_id", uid)
        .eq("dealer_id", uid)
        .order("appointment_date", { ascending: false })
        .then(({ data: apts }) => setAppointments(apts || []));

      // fetch enquiries
      supabase
        .from("whatsapp_enquiries")
        .select("id, buyer_name, buyer_phone, buyer_message, status, created_at, updated_at, listing_id, car_listings(brand, model, year)")
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
    await supabase.from("lead_activities").insert({
      lead_id: lead.id,
      activity_type: "whatsapp_sent",
      note: "Follow-up WA sent via stale nudge",
      created_by: userId,
      dealer_id: lead.dealer_id ?? null,
    });
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
      .eq("assigned_to", profile.id)
      .is("dealer_id", null);
    await supabase.rpc("use_dealer_invite", { invite_code: mergeCode.trim().toUpperCase() });

    setMergeStatus("success");
    setMergeMsg("Merged! Redirecting to full dashboard...");
    setTimeout(() => navigate("/salesman"), 2500);
  };

  const copyListingLink = (car) => {
    const url = `https://xdrive.my/cars/${car.slug}`;
    navigator.clipboard.writeText(url);
    setListingCopied((p) => ({ ...p, [car.id]: "link" }));
    setTimeout(() => setListingCopied((p) => ({ ...p, [car.id]: null })), 2000);
  };

  const openWACaption = (car) => {
    const url = `https://xdrive.my/cars/${car.slug}`;
    const price = car.selling_price
      ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}`
      : "";
    const msg = encodeURIComponent(
      `🚗 *${car.year || ""} ${car.brand} ${car.model}*\n${price ? `💰 ${price}\n` : ""}📋 ${car.mileage ? `${Number(car.mileage).toLocaleString()} km · ` : ""}${car.transmission || ""}\n\n🔗 ${url}`,
    );
    const waPhone = (profile?.whatsapp_number || "").replace(/\D/g, "");
    if (waPhone) {
      window.open(
        `https://wa.me/${waPhone.startsWith("6") ? waPhone : "6" + waPhone}?text=${msg}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else {
      navigator.clipboard.writeText(decodeURIComponent(msg));
      toast.success("WA caption copied!");
    }
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
      badge: appointments.filter((a) => a.status === "confirmed").length || null,
    },
    {
      tab: "merge",
      label: "Join Dealership",
      icon: <GitMerge style={{ width: 14, height: 14 }} />,
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
      badge: appointments.filter((a) => a.status === "confirmed").length || null,
    },
    { tab: "merge", label: "Merge", icon: <GitMerge size={18} /> },
  ];

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
      return d.getDate() === today.getDate() &&
             d.getMonth() === today.getMonth() &&
             d.getFullYear() === today.getFullYear();
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
      { label: "New Enquiries", value: enquiries.filter((e) => e.status === "new").length, color: "#c084fc" },
    ];

    const listingStats = myListings.map((car) => {
      const carEvts = analyticsEvents.filter((e) => e.car_id === car.id);
      const views = carEvts.filter((e) => e.event_type === "car_view").length;
      const waTaps = carEvts.filter((e) => e.event_type === "whatsapp_click").length;
      const enqCount = enquiries.filter((e) => e.listing_id === car.id).length;
      const cvr = views > 0 ? (waTaps / views) * 100 : null;
      return { car, views, waTaps, enqCount, cvr };
    });
    const totalViews = analyticsEvents.filter((e) => e.event_type === "car_view").length;
    const totalWATaps = analyticsEvents.filter((e) => e.event_type === "whatsapp_click").length;
    const bestCVRStat = listingStats.reduce((best, s) => {
      if (s.cvr !== null && (best === null || s.cvr > best.cvr)) return s;
      return best;
    }, null);
    const cvrColor = (cvr) => cvr >= 10 ? "#4ade80" : cvr >= 5 ? "#fbbf24" : "#f87171";
    const perfCarName = (car) => [car.year, car.brand, car.model].filter(Boolean).join(" ");

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
          <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            My Performance (30d)
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
            <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Views</p>
              <p style={{ margin: 0, fontSize: 26, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1px", color: "#93c5fd" }}>{totalViews}</p>
            </div>
            <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>WA Taps</p>
              <p style={{ margin: 0, fontSize: 26, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1px", color: "#4ade80" }}>{totalWATaps}</p>
            </div>
            <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" }}>Best CVR</p>
              {bestCVRStat ? (
                <>
                  <p style={{ margin: "0 0 2px", fontSize: 22, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1px", color: cvrColor(bestCVRStat.cvr) }}>
                    {bestCVRStat.cvr.toFixed(1)}%
                  </p>
                  <p style={{ margin: 0, fontSize: 9, color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {perfCarName(bestCVRStat.car)}
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 26, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1px", color: "#374151" }}>—</p>
              )}
            </div>
          </div>

          {listingStats.length > 0 && (
            <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 42px 42px 42px 52px", padding: "7px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <p style={{ margin: 0, fontSize: 10, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>Listing</p>
                <p style={{ margin: 0, fontSize: 10, color: "#374151", textAlign: "center" }}>Views</p>
                <p style={{ margin: 0, fontSize: 10, color: "#374151", textAlign: "center" }}>WA</p>
                <p style={{ margin: 0, fontSize: 10, color: "#374151", textAlign: "center" }}>Enq</p>
                <p style={{ margin: 0, fontSize: 10, color: "#374151", textAlign: "right" }}>CVR</p>
              </div>
              {listingStats.map(({ car, views, waTaps, enqCount, cvr }, idx) => (
                <div
                  key={car.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 42px 42px 42px 52px",
                    padding: "8px 12px",
                    alignItems: "center",
                    borderBottom: idx < listingStats.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 11, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 6 }}>
                    {perfCarName(car)}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#93c5fd", textAlign: "center" }}>{views}</p>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#4ade80", textAlign: "center" }}>{waTaps}</p>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#c084fc", textAlign: "center" }}>{enqCount}</p>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textAlign: "right", color: cvr !== null ? cvrColor(cvr) : "#374151" }}>
                    {cvr !== null ? `${cvr.toFixed(1)}%` : "—"}
                  </p>
                </div>
              ))}
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

  const renderListings = () => (
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
          style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}
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

      {myListings.length === 0 && !showAddForm && (
        <div
          style={{ padding: "40px 0", textAlign: "center", color: "#374151" }}
        >
          <Car size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: 13 }}>
            No listings yet — add your first car above.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {myListings.map((car) => {
          const img = Array.isArray(car.images) ? car.images[0] : null;
          const copied = listingCopied[car.id];
          return (
            <div
              key={car.id}
              style={{
                background: "#0d1117",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10,
                overflow: "hidden",
                display: "flex",
                gap: 0,
              }}
            >
              {img && (
                <div style={{ width: 90, flexShrink: 0, background: "#111" }}>
                  <img
                    src={img}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
              )}
              <div style={{ flex: 1, padding: "12px 14px", minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 6,
                    marginBottom: 4,
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
                    {[car.year, car.brand, car.model].filter(Boolean).join(" ")}
                  </p>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 7px",
                      borderRadius: 99,
                      background:
                        car.status === "available"
                          ? "rgba(34,197,94,0.12)"
                          : "rgba(251,191,36,0.12)",
                      border: `1px solid ${car.status === "available" ? "rgba(34,197,94,0.3)" : "rgba(251,191,36,0.3)"}`,
                      color: car.status === "available" ? "#4ade80" : "#fbbf24",
                      flexShrink: 0,
                      textTransform: "capitalize",
                    }}
                  >
                    {car.status}
                  </span>
                </div>
                {car.selling_price && (
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#60a5fa",
                    }}
                  >
                    RM {Number(car.selling_price).toLocaleString("en-MY")}
                  </p>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => copyListingLink(car)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      padding: "4px 9px",
                      borderRadius: 6,
                      background:
                        copied === "link"
                          ? "rgba(34,197,94,0.1)"
                          : "rgba(255,255,255,0.05)",
                      border: `1px solid ${copied === "link" ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}`,
                      color: copied === "link" ? "#4ade80" : "#6b7280",
                      cursor: "pointer",
                    }}
                  >
                    {copied === "link" ? (
                      <Check size={11} />
                    ) : (
                      <Copy size={11} />
                    )}
                    Copy Link
                  </button>
                  <button
                    onClick={() => openWACaption(car)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      padding: "4px 9px",
                      borderRadius: 6,
                      background: "rgba(37,211,102,0.08)",
                      border: "1px solid rgba(37,211,102,0.2)",
                      color: "#4ade80",
                      cursor: "pointer",
                    }}
                  >
                    <MessageSquare size={11} />
                    WA Caption
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── RENDER LEADS ──────────────────────────────────────────────────────────

  const renderLeads = () => {
    const activeStages = LEAD_STAGES.filter((s) => s !== "lost" && s !== "closed_lost" && s !== "closed_won");
    const lostLeads = leads.filter((l) => l.stage === "lost" || l.stage === "closed_lost" || l.stage === "closed_won");

    const renderLeadCard = (lead) => {
      const car = lead.car_listings;
      const carName = car
        ? [car.year, car.brand, car.model].filter(Boolean).join(" ")
        : null;
      const carPrice = car?.selling_price
        ? `RM ${Number(car.selling_price).toLocaleString("en-MY")}`
        : null;
      const stageIdx = LEAD_STAGES.indexOf(lead.stage);
      const nextStage = LEAD_STAGES
        .filter((s) => s !== "lost" && s !== "won" && s !== "closed_won" && s !== "closed_lost")
        .find((s) => LEAD_STAGES.indexOf(s) > stageIdx);

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
              }}
            >
              {lead.buyer_name || "—"}
            </p>
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
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#9ca3af",
                      }}
                    >
                      {lead.buyer_name || "—"}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 10,
                        color: "#374151",
                      }}
                    >
                      {timeAgo(lead.created_at)}
                    </p>
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
      <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>
        Enquiries ({enquiries.length})
      </p>
      {enquiries.length === 0 && (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#374151" }}>
          <MessageSquare size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: 13 }}>No enquiries yet.</p>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {enquiries.map((enq) => {
          const car = enq.car_listings;
          return (
            <div key={enq.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{enq.buyer_name || "—"}</p>
                <span style={{
                  fontSize: 10, padding: "2px 7px", borderRadius: 99, flexShrink: 0,
                  background: enq.status === "new" ? "rgba(96,165,250,0.12)" : "rgba(34,197,94,0.12)",
                  border: `1px solid ${enq.status === "new" ? "rgba(96,165,250,0.3)" : "rgba(34,197,94,0.3)"}`,
                  color: enq.status === "new" ? "#93c5fd" : "#4ade80",
                  textTransform: "capitalize",
                }}>
                  {enq.status}
                </span>
              </div>
              {car && <p style={{ margin: "0 0 2px", fontSize: 11, color: "#6b7280" }}>{[car.year, car.brand, car.model].filter(Boolean).join(" ")}</p>}
              {enq.buyer_phone && <p style={{ margin: "0 0 4px", fontSize: 11, color: "#4b5563" }}>📞 {enq.buyer_phone}</p>}
              {enq.buyer_message && (
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "#4b5563", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  "{enq.buyer_message}"
                </p>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                {enq.buyer_phone && (
                  <button
                    onClick={() => {
                      const phone = enq.buyer_phone.replace(/\D/g, "");
                      const enqCar = enq.car_listings;
                      const carName = enqCar ? `${enqCar.brand} ${enqCar.model}` : "kereta";
                      const msg = encodeURIComponent(`Hi ${enq.buyer_name || ""}! Thank you for your enquiry on the ${carName}. I'm here to help — when would be a good time to chat? 😊`);
                      window.open(`https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${msg}`, "_blank", "noopener,noreferrer");
                    }}
                    style={{ fontSize: 10, padding: "3px 9px", borderRadius: 6, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#4ade80", cursor: "pointer" }}
                  >
                    WA Reply
                  </button>
                )}
                {enq.status === "new" && (
                  <button
                    onClick={async () => {
                      await supabase.from("whatsapp_enquiries").update({ status: "responded" }).eq("id", enq.id);
                      setEnquiries((p) => p.map((e) => e.id === enq.id ? { ...e, status: "responded" } : e));
                    }}
                    style={{ fontSize: 10, padding: "3px 9px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer" }}
                  >
                    Mark Responded
                  </button>
                )}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 10, color: "#374151" }}>{timeAgo(enq.created_at)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── RENDER BOOKINGS ───────────────────────────────────────────────────────

  const renderBookings = () => (
    <div>
      <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>
        Bookings ({appointments.length})
      </p>
      {appointments.length === 0 && (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#374151" }}>
          <Phone size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: 13 }}>No bookings yet.</p>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {appointments.map((apt) => {
          const car = apt.car_listings;
          const aptDate = apt.appointment_date ? new Date(apt.appointment_date) : null;
          const dateStr = aptDate && !isNaN(aptDate)
            ? aptDate.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
            : "—";
          const timeStr = aptDate && !isNaN(aptDate)
            ? aptDate.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })
            : "";
          return (
            <div key={apt.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{apt.buyer_name || "—"}</p>
                <span style={{
                  fontSize: 10, padding: "2px 7px", borderRadius: 99, flexShrink: 0,
                  background: apt.status === "confirmed" ? "rgba(34,197,94,0.12)" : "rgba(251,191,36,0.12)",
                  border: `1px solid ${apt.status === "confirmed" ? "rgba(34,197,94,0.3)" : "rgba(251,191,36,0.3)"}`,
                  color: apt.status === "confirmed" ? "#4ade80" : "#fbbf24",
                  textTransform: "capitalize",
                }}>
                  {apt.status}
                </span>
              </div>
              <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#93c5fd" }}>📅 {dateStr}{timeStr && ` · ${timeStr}`}</p>
              {car && <p style={{ margin: "0 0 4px", fontSize: 11, color: "#6b7280" }}>{[car.year, car.brand, car.model].filter(Boolean).join(" ")}</p>}
              {apt.buyer_phone && <p style={{ margin: "0 0 6px", fontSize: 11, color: "#4b5563" }}>📞 {apt.buyer_phone}</p>}
              {apt.notes && <p style={{ margin: "0 0 6px", fontSize: 10, color: "#4b5563", fontStyle: "italic" }}>"{apt.notes}"</p>}
              {apt.buyer_phone && (
                <button
                  onClick={() => {
                    const phone = apt.buyer_phone.replace(/\D/g, "");
                    const msg = encodeURIComponent(`Hi ${apt.buyer_name || ""}! Just a reminder for your appointment on ${dateStr}${timeStr ? ` at ${timeStr}` : ""}. See you then! 😊`);
                    window.open(`https://wa.me/${phone.startsWith("6") ? phone : "6" + phone}?text=${msg}`, "_blank", "noopener,noreferrer");
                  }}
                  style={{ fontSize: 10, padding: "3px 9px", borderRadius: 6, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#4ade80", cursor: "pointer" }}
                >
                  WA Reminder
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

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
              onClick={() => setActiveTab(tab)}
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
    </div>
  );
}
