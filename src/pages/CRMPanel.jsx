import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, MessageCircle, Save, PlusCircle, Plus, Bell, MapPin, Calendar, Phone, User } from "lucide-react";
import { supabase } from "../supabaseClient";
import { usePersistentState } from "../hooks/usePersistentState";
import LeadsPage from "./LeadsPage";
import OutreachHub from "../components/crm/OutreachHub";
import { liveChannel } from "../lib/liveChannel";
import PhoneInput from '../components/ui/PhoneInput';
import { isValidMyPhone, MY_PHONE_ERROR } from '../lib/phone';
import { localInputToIso } from "../utils/myDay";

// ─── Shared style tokens (mirror DashboardPage) ────────────────────────────────
const T = {
  card: {
    position: "relative",
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.032), rgba(255,255,255,0.008))",
    border: "1px solid rgba(255,255,255,0.055)",
    backdropFilter: "blur(12px)",
  },
  btnRed: {
    background: "linear-gradient(135deg,#dc2626,#b91c1c)",
    boxShadow: "0 2px 10px rgba(220,38,38,0.28)",
    border: "none",
  },
};

const iCls =
  "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/10 transition-all";
const taCls =
  "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/10 transition-all resize-none";

// Light-theme input styles for modals on the white dealer-dashboard surface (e.g. Add Booking)
const lInputCls =
  "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/10 transition-all";
const lTaCls = lInputCls + " resize-none";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-MY');
}

// ─── BookingsTab ──────────────────────────────────────────────────────────────
const DEFAULT_BOOKING_TEMPLATE = `Hi {{buyer_name}}, your {{booking_type}} for the {{car_name}} is confirmed for {{booking_date}} at {{booking_time}}. 🎉\n\nPlease arrive on time. See you at {{dealership}}!\n\nReply to reschedule.`;

function BookingsTab({ userId, listings, salesmen }) {
  const [bookings, setBookings, bkCached] = usePersistentState(userId ? `crm_bookings:${userId}` : null, []);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    buyer_name: "",
    buyer_phone: "",
    listing_id: "",
    booking_type: "test_drive",
    scheduled_at: "",
    duration_minutes: 60,
    salesman_id: "",
    deposit_amount: "",
    notes: "",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [bkTemplate, setBkTemplate] = useState(DEFAULT_BOOKING_TEMPLATE);
  const [reminderTarget, setReminderTarget] = useState(null);
  const [reminderMsg, setReminderMsg] = useState("");
  const [bkTmplSaving, setBkTmplSaving] = useState(false);
  const [dealerBkProfile, setDealerBkProfile] = useState(null);
  const [reminderPickerAptId, setReminderPickerAptId] = useState(null);
  const [reminderOffset, setReminderOffset] = useState("1h");
  const [cancelConfirmId, setCancelConfirmId] = useState(null);
  const [rescheduleAptId, setRescheduleAptId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");

  const statusMeta = {
    pending: {
      color: "#d97706",
      bg: "rgba(217,119,6,0.1)",
      border: "rgba(217,119,6,0.25)",
    },
    confirmed: {
      color: "#2563eb",
      bg: "rgba(37,99,235,0.1)",
      border: "rgba(37,99,235,0.25)",
    },
    completed: {
      color: "#059669",
      bg: "rgba(5,150,105,0.1)",
      border: "rgba(5,150,105,0.25)",
    },
    cancelled: {
      color: "#6b7280",
      bg: "rgba(107,114,128,0.1)",
      border: "rgba(107,114,128,0.25)",
    },
    no_show: {
      color: "#dc2626",
      bg: "rgba(220,38,38,0.1)",
      border: "rgba(220,38,38,0.25)",
    },
  };

  const fetchBookings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select(
        "*, car_listings(brand, model, year), profiles!salesman_id(full_name)",
      )
      .eq("dealer_id", userId)
      .order("created_at", { ascending: false });
    if (error)
      console.error("[BookingsTab] fetchBookings error:", error.message, error);
    setBookings(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    fetchBookings();
    const ch = liveChannel(supabase, "bookings_live_" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `dealer_id=eq.${userId}` },
        (payload) => {
          fetchBookings();
          if (payload.eventType === "INSERT") {
            toast("New booking!", { description: payload.new.buyer_name || "New appointment" });
            // Push Telegram notification if dealer has it configured
            supabase.from("profiles").select("telegram_bot_token,telegram_channel_id,dealership")
              .eq("id", userId).maybeSingle()
              .then(({ data: dp }) => {
                if (!dp?.telegram_bot_token || !dp?.telegram_channel_id) return;
                const n = payload.new;
                const d = n.appointment_date ? new Date(n.appointment_date) : null;
                const dateStr = d ? d.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" }) : "TBD";
                const timeStr = d ? d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" }) : "";
                const stateStr = n.buyer_state ? ` (${n.buyer_state})` : "";
                const msg = `🗓️ New Booking!\n\n*${n.buyer_name || "Customer"}*${stateStr} booked a viewing\n📅 ${dateStr}${timeStr ? ` · ${timeStr}` : ""}\n📞 ${n.buyer_phone || "—"}${n.notes ? `\n💬 "${n.notes}"` : ""}`;
                fetch(`https://api.telegram.org/bot${dp.telegram_bot_token}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ chat_id: dp.telegram_channel_id, text: msg, parse_mode: "Markdown" }),
                }).catch(() => {});
              });
          }
        },
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("full_name, dealership, booking_wa_template, telegram_bot_token, telegram_channel_id")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setDealerBkProfile(data);
          if (data.booking_wa_template) setBkTemplate(data.booking_wa_template);
        }
      });
  }, [userId]);

  const populateBkTemplate = (tmpl, booking, car) => {
    const d = booking.appointment_date
      ? new Date(booking.appointment_date)
      : null;
    return (tmpl || DEFAULT_BOOKING_TEMPLATE)
      .replace(/\{\{buyer_name\}\}/g, booking.buyer_name || "there")
      .replace(
        /\{\{car_name\}\}/g,
        car ? `${car.brand} ${car.model}` : "the vehicle",
      )
      .replace(
        /\{\{booking_type\}\}/g,
        (booking.booking_type || "appointment").replace("_", " "),
      )
      .replace(
        /\{\{booking_date\}\}/g,
        d
          ? d.toLocaleDateString("en-MY", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "—",
      )
      .replace(
        /\{\{booking_time\}\}/g,
        d
          ? d.toLocaleTimeString("en-MY", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
      )
      .replace(/\{\{dealership\}\}/g, dealerBkProfile?.dealership || "");
  };

  const openReminder = (booking) => {
    setReminderTarget(booking);
    setReminderMsg(
      populateBkTemplate(bkTemplate, booking, booking.car_listings),
    );
  };

  const saveBkTemplate = async () => {
    setBkTmplSaving(true);
    await supabase
      .from("profiles")
      .update({ booking_wa_template: reminderMsg })
      .eq("id", userId);
    setBkTemplate(reminderMsg);
    setBkTmplSaving(false);
    toast.success("Default booking template saved ✓");
  };

  const handleAdd = async () => {
    if (addForm.buyer_phone && !isValidMyPhone(addForm.buyer_phone)) { toast.error(MY_PHONE_ERROR); return; }
    if (!localInputToIso(addForm.scheduled_at)) { toast.error("Pick the date and time of the booking"); return; }
    setAddSaving(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        dealer_id: userId,
        salesman_id: addForm.salesman_id || null,
        car_listing_id: addForm.listing_id || null,
        appointment_date: localInputToIso(addForm.scheduled_at),
        buyer_name: addForm.buyer_name,
        buyer_phone: addForm.buyer_phone,
        notes: addForm.notes,
        status: "pending",
      });
      if (error) throw error;
      setShowAdd(false);
      setAddForm({
        buyer_name: "",
        buyer_phone: "",
        listing_id: "",
        booking_type: "test_drive",
        scheduled_at: "",
        duration_minutes: 60,
        salesman_id: "",
        deposit_amount: "",
        notes: "",
      });
      fetchBookings();
    } catch (err) {
      console.error("[BookingsTab] handleAdd error:", err.message, err);
      toast.error(`Failed to save appointment: ${err.message}`);
    } finally {
      setAddSaving(false);
    }
  };

  const updateStatus = async (id, status) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) { toast.error("Could not update the booking. Try again."); return; }
    setBookings((p) => p.map((b) => (b.id === id ? { ...b, status } : b)));
  };

  const StatusBadge = ({ status }) => {
    const m = statusMeta[status] || statusMeta.pending;
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: m.color,
          background: m.bg,
          border: `1px solid ${m.border}`,
          borderRadius: 6,
          padding: "2px 8px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          whiteSpace: "nowrap",
        }}
      >
        {status?.replace("_", " ") || "pending"}
      </span>
    );
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const todayStr = new Date().toDateString();
  // Pending = a buyer requested this viewing but nobody has approved it yet.
  // Surfaced in its own top section so a genuine buyer never sits unconfirmed.
  const pendingBookings = bookings.filter((b) => b.status === "pending");
  const todaysBookings = bookings.filter(
    (b) =>
      b.status !== "pending" &&
      b.appointment_date &&
      new Date(b.appointment_date).toDateString() === todayStr,
  );
  const otherBookings = bookings.filter(
    (b) =>
      b.status !== "pending" &&
      (!b.appointment_date ||
        new Date(b.appointment_date).toDateString() !== todayStr),
  );

  const scheduleReminder = async (b) => {
    if (!b.appointment_date) return;
    const aptDate = new Date(b.appointment_date);
    const offsets = { "1h": -60, "2h": -120, "1d": -1440, "2d": -2880 };
    const remindAt = new Date(aptDate.getTime() + (offsets[reminderOffset] ?? -60) * 60000);
    await supabase.from("appointments").update({ remind_at: remindAt.toISOString(), remind_sent: false }).eq("id", b.id);
    setBookings(p => p.map(a => a.id === b.id ? { ...a, remind_at: remindAt.toISOString(), remind_sent: false } : a));
    setReminderPickerAptId(null);
    toast.success("Telegram reminder scheduled ✓");
  };

  const clearReminder = async (b) => {
    await supabase.from("appointments").update({ remind_at: null, remind_sent: false }).eq("id", b.id);
    setBookings(p => p.map(a => a.id === b.id ? { ...a, remind_at: null } : a));
  };

  const doReschedule = async (b) => {
    if (!rescheduleDate) return;
    const newDate = new Date(rescheduleDate);
    await supabase.from("appointments").update({ appointment_date: newDate.toISOString(), status: "confirmed", remind_at: null }).eq("id", b.id);
    setBookings(p => p.map(a => a.id === b.id ? { ...a, appointment_date: newDate.toISOString(), status: "confirmed" } : a));
    setRescheduleAptId(null);
    setRescheduleDate("");
    toast.success("Rescheduled ✓");
  };

  const renderBookingRow = (b) => {
    const car = b.car_listings;
    const sm = b.profiles;
    const now = Date.now();
    const aptMs = b.appointment_date ? new Date(b.appointment_date).getTime() : null;
    const isToday = aptMs && new Date(b.appointment_date).toDateString() === todayStr;
    const isNew = now - new Date(b.created_at).getTime() < 7200000;
    const isPast = aptMs && aptMs < now && !isToday;
    const dateColor = isToday ? "#2563eb" : isPast ? "#dc2626" : "#6b7280";
    const dateBg   = isToday ? "rgba(37,99,235,0.08)" : isPast ? "rgba(220,38,38,0.06)" : "transparent";
    const sm_meta  = statusMeta[b.status] || statusMeta.pending;
    const isReminderPicking = reminderPickerAptId === b.id;
    const isRescheduling    = rescheduleAptId === b.id;
    const isCancelConfirm   = cancelConfirmId === b.id;
    const notDone = b.status !== "cancelled" && b.status !== "completed" && b.status !== "no_show";

    const dateDisplay = b.appointment_date
      ? new Date(b.appointment_date).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })
      : "—";

    return (
      <div key={b.id} style={{ background: "#fff", border: `1px solid ${isToday ? "#bfdbfe" : "#e5e7eb"}`, borderRadius: 10, padding: "12px 14px", boxShadow: isToday ? "0 0 0 1px rgba(37,99,235,0.12)" : "0 1px 2px rgba(16,24,40,0.04)" }}>
        {/* Header: name + badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {b.buyer_name || "Unknown Buyer"}
            <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af", marginLeft: 6 }}>
              {relativeTime(b.created_at)}
            </span>
          </p>
          {isNew && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: "#dc2626", flexShrink: 0, fontWeight: 800 }}>NEW</span>}
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, flexShrink: 0, background: sm_meta.bg, border: `1px solid ${sm_meta.border}`, color: sm_meta.color, textTransform: "capitalize" }}>
            {b.status}
          </span>
        </div>

        {/* Date — most prominent */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 7, background: dateBg, marginBottom: 6 }}>
          <Calendar size={12} color={dateColor} />
          <span style={{ fontSize: 13, fontWeight: 700, color: dateColor }}>
            {dateDisplay}
            {isToday && <span style={{ fontSize: 9, marginLeft: 6, padding: "1px 5px", borderRadius: 99, background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.3)", color: "#2563eb" }}>TODAY</span>}
          </span>
        </div>

        {/* Details row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", marginBottom: 6 }}>
          {car && <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#111827" }}>{[car.year, car.brand, car.model].filter(Boolean).join(" ")}</p>}
          {b.buyer_phone && <p style={{ margin: 0, fontSize: 11, color: "#6b7280", display:'flex', alignItems:'center', gap:4 }}><Phone size={10} /> {b.buyer_phone}</p>}
          {sm?.full_name && <p style={{ margin: 0, fontSize: 11, color: "#6b7280", display:'flex', alignItems:'center', gap:4 }}><User size={10} /> {sm.full_name}</p>}
          {b.buyer_state && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626", fontWeight: 600 }}>
              <MapPin size={9} />
              {b.buyer_state}
            </span>
          )}
        </div>

        {b.notes && <p style={{ margin: "0 0 6px", fontSize: 10, color: "#6b7280", fontStyle: "italic" }}>"{b.notes}"</p>}

        {/* Telegram reminder indicator */}
        {b.remind_at && !b.remind_sent ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.18)", marginBottom: 8 }}>
            <Bell size={11} color="#059669" />
            <span style={{ fontSize: 10, color: "#059669", flex: 1 }}>
              Reminder: {new Date(b.remind_at).toLocaleString("en-MY", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            <button onClick={() => clearReminder(b)} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 10, cursor: "pointer", padding: 0 }}>✕</button>
          </div>
        ) : b.remind_sent ? (
          <p style={{ fontSize: 10, color: "#6b7280", margin: "0 0 8px" }}>✓ Telegram reminder sent</p>
        ) : null}

        {/* Reminder picker */}
        {isReminderPicking && (
          <div style={{ marginBottom: 10, padding: "10px 12px", background: "rgba(5,150,105,0.05)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 8 }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, color: "#059669", fontWeight: 600 }}>Schedule Telegram reminder</p>
            <select value={reminderOffset} onChange={e => setReminderOffset(e.target.value)}
              style={{ width: "100%", background: "#fff", border: "1px solid #d1d5db", borderRadius: 7, color: "#111827", fontSize: 12, padding: "7px 10px", marginBottom: 8, outline: "none", boxSizing: "border-box" }}>
              <option value="1h">1 hour before</option>
              <option value="2h">2 hours before</option>
              <option value="1d">1 day before (9 AM)</option>
              <option value="2d">2 days before (9 AM)</option>
            </select>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setReminderPickerAptId(null)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#6b7280", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => scheduleReminder(b)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.3)", color: "#059669", cursor: "pointer", fontWeight: 600 }}>Set Reminder</button>
            </div>
          </div>
        )}

        {/* Reschedule picker */}
        {isRescheduling && (
          <div style={{ marginBottom: 10, padding: "10px 12px", background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 8 }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, color: "#7c3aed", fontWeight: 600 }}>Choose new date & time</p>
            <input type="datetime-local" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
              style={{ width: "100%", background: "#fff", border: "1px solid #d1d5db", borderRadius: 7, color: "#111827", fontSize: 12, padding: "7px 10px", outline: "none", boxSizing: "border-box", marginBottom: 8, fontFamily: "system-ui,sans-serif" }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setRescheduleAptId(null); setRescheduleDate(""); }} style={{ flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#6b7280", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => doReschedule(b)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", color: "#7c3aed", cursor: "pointer", fontWeight: 600 }}>Confirm</button>
            </div>
          </div>
        )}

        {/* Cancel confirm */}
        {isCancelConfirm && (
          <div style={{ display: "flex", gap: 6, marginBottom: 8, padding: "8px 10px", background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#dc2626", flex: 1 }}>Cancel this appointment?</p>
            <button onClick={() => setCancelConfirmId(null)} style={{ fontSize: 10, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>No</button>
            <button onClick={() => { updateStatus(b.id, "cancelled"); setCancelConfirmId(null); }} style={{ fontSize: 10, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Yes, Cancel</button>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
          {b.status === "pending" && (
            <button onClick={() => updateStatus(b.id, "confirmed")} style={{ fontSize: 10, color: "#2563eb", background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>Confirm</button>
          )}
          {(b.status === "pending" || b.status === "confirmed") && (
            <button onClick={() => updateStatus(b.id, "completed")} style={{ fontSize: 10, color: "#059669", background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>Done</button>
          )}
          {/* A past viewing needs an honest outcome. Without No-show the only way
              to clear it was "Done", so 49 past bookings were left open instead. */}
          {isPast && (b.status === "pending" || b.status === "confirmed") && (
            <button onClick={() => updateStatus(b.id, "no_show")} style={{ fontSize: 10, color: "#b45309", background: "rgba(180,83,9,0.08)", border: "1px solid rgba(180,83,9,0.2)", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>No-show</button>
          )}
          {notDone && (
            <button onClick={() => { setRescheduleAptId(b.id === rescheduleAptId ? null : b.id); setRescheduleDate(""); }} style={{ fontSize: 10, color: "#7c3aed", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>Reschedule</button>
          )}
          {notDone && !isCancelConfirm && (
            <button onClick={() => setCancelConfirmId(b.id)} style={{ fontSize: 10, color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>Cancel</button>
          )}
          {b.buyer_phone && notDone && (
            <button onClick={() => openReminder(b)} style={{ fontSize: 10, color: "#059669", background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>WhatsApp</button>
          )}
          {notDone && dealerBkProfile?.telegram_bot_token && (
            <button onClick={() => setReminderPickerAptId(b.id === reminderPickerAptId ? null : b.id)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: b.remind_at ? "#059669" : "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>
              <Bell size={10} />{b.remind_at ? "Reminder set" : "Remind"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid #e5e7eb",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#111827",
              margin: 0,
            }}
          >
            Bookings & Appointments
          </h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {["list", "week"].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "none",
                    background:
                      view === v ? "rgba(37,99,235,0.12)" : "transparent",
                    color: view === v ? "#2563eb" : "#6b7280",
                    transition: "all 0.15s",
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 text-sm font-semibold text-white px-3 py-1.5 rounded-lg"
              style={T.btnRed}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add Booking
            </button>
          </div>
        </div>

        {loading && !bkCached ? (
          <p className="text-gray-500 text-sm p-6">Loading...</p>
        ) : bookings.length === 0 ? (
          <p style={{ padding: "32px", textAlign: "center", color: "#4b5563", fontSize: 13 }}>No bookings yet.</p>
        ) : view === "list" ? (
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingBookings.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 8px" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#d97706", boxShadow: "0 0 6px rgba(217,119,6,0.6)", animation: "hotpulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", letterSpacing: "0.12em", textTransform: "uppercase" }}>Needs approval · {pendingBookings.length}</span>
                </div>
                {pendingBookings.map(b => renderBookingRow(b))}
                {(todaysBookings.length > 0 || otherBookings.length > 0) && <div style={{ height: 1, background: "#f3f4f6", margin: "4px 0" }} />}
              </>
            )}
            {todaysBookings.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 8px" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#2563eb", boxShadow: "0 0 6px rgba(37,99,235,0.6)", animation: "hotpulse 1.5s ease-in-out infinite", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", letterSpacing: "0.12em", textTransform: "uppercase" }}>Today · {todaysBookings.length}</span>
                </div>
                {todaysBookings.map(b => renderBookingRow(b))}
                {otherBookings.length > 0 && <div style={{ height: 1, background: "#f3f4f6", margin: "4px 0" }} />}
              </>
            )}
            {otherBookings.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 8px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.12em", textTransform: "uppercase" }}>Upcoming & Past · {otherBookings.length}</span>
                </div>
                {otherBookings.map(b => renderBookingRow(b))}
              </>
            )}
          </div>
        ) : (
          <div className="table-wrap" style={{ padding: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(120px, 1fr))",
                gap: 8,
              }}
            >
              {weekDays.map((day) => {
                const dayStr = day.toDateString();
                const dayBookings = bookings.filter(
                  (b) =>
                    b.appointment_date &&
                    new Date(b.appointment_date).toDateString() === dayStr,
                );
                return (
                  <div
                    key={dayStr}
                    style={{
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 10,
                      minHeight: 100,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 10,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        margin: "0 0 4px",
                      }}
                    >
                      {day.toLocaleDateString("en-MY", { weekday: "short" })}
                    </p>
                    <p
                      style={{
                        fontSize: 13,
                        color: "#111827",
                        fontWeight: 600,
                        margin: "0 0 8px",
                      }}
                    >
                      {day.getDate()}
                    </p>
                    {dayBookings.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          background:
                            statusMeta[b.status]?.bg || "rgba(59,130,246,0.1)",
                          border: `1px solid ${statusMeta[b.status]?.border || "rgba(59,130,246,0.2)"}`,
                          borderRadius: 5,
                          padding: "4px 7px",
                          marginBottom: 4,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 10,
                            color: statusMeta[b.status]?.color || "#93c5fd",
                            fontWeight: 600,
                            margin: 0,
                          }}
                        >
                          {new Date(b.appointment_date).toLocaleTimeString(
                            "en-MY",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: "#111827",
                            margin: "1px 0 0",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {b.buyer_name || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Booking Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <div className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold" style={{ color: '#111827' }}>Add Booking</h3>
              <button
                onClick={() => setShowAdd(false)}
                className="text-gray-400 hover:text-gray-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                    Buyer Name
                  </label>
                  <input
                    value={addForm.buyer_name}
                    onChange={(e) =>
                      setAddForm((p) => ({ ...p, buyer_name: e.target.value }))
                    }
                    placeholder="Ahmad"
                    className={lInputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                    Buyer Phone
                  </label>
                  <PhoneInput value={addForm.buyer_phone} onChange={(v) => setAddForm((p) => ({ ...p, buyer_phone: v }))} className={lInputCls} prefixClassName="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-200 bg-gray-50 flex-shrink-0" inputClassName="flex-1 min-w-0 bg-transparent border-none outline-none text-gray-900 text-sm px-3 py-2.5" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                  Car Listing
                </label>
                <select
                  value={addForm.listing_id}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, listing_id: e.target.value }))
                  }
                  className={lInputCls}
                >
                  <option value="">Select listing...</option>
                  {listings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.brand} {l.model} {l.year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                    Booking Type
                  </label>
                  <select
                    value={addForm.booking_type}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        booking_type: e.target.value,
                      }))
                    }
                    className={lInputCls}
                  >
                    {["test_drive", "viewing", "handover", "follow_up"].map(
                      (t) => (
                        <option key={t} value={t}>
                          {t.replace("_", " ")}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    value={addForm.duration_minutes}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        duration_minutes: e.target.value,
                      }))
                    }
                    placeholder="60"
                    className={lInputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                  Scheduled At
                </label>
                <input
                  type="datetime-local"
                  value={addForm.scheduled_at}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, scheduled_at: e.target.value }))
                  }
                  className={lInputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                    Salesman
                  </label>
                  <select
                    value={addForm.salesman_id}
                    onChange={(e) =>
                      setAddForm((p) => ({ ...p, salesman_id: e.target.value }))
                    }
                    className={lInputCls}
                  >
                    <option value="">Unassigned</option>
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                    Deposit (RM)
                  </label>
                  <input
                    type="number"
                    value={addForm.deposit_amount}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        deposit_amount: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className={lInputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1">
                  Notes
                </label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  rows={2}
                  className={lTaCls}
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-800 transition-all"
                style={{ border: "1px solid #e5e7eb" }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={addSaving}
                className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                style={T.btnRed}
              >
                {addSaving ? "Saving..." : "Book"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Reminder Modal */}
      {reminderTarget && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
          onClick={() => setReminderTarget(null)}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden"
            style={{
              background: "#0f1623",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h3 className="font-semibold text-white text-sm">
                  Send Reminder
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {reminderTarget.buyer_name} · {reminderTarget.buyer_phone}
                </p>
              </div>
              <button
                onClick={() => setReminderTarget(null)}
                className="text-gray-500 hover:text-white p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                value={reminderMsg}
                onChange={(e) => setReminderMsg(e.target.value)}
                rows={7}
                className={taCls}
                placeholder="WhatsApp message…"
              />
              <div className="flex gap-2">
                <a
                  href={`https://wa.me/${reminderTarget.buyer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(reminderMsg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setReminderTarget(null)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                  style={{
                    background: "rgba(37,211,102,0.12)",
                    border: "1px solid rgba(37,211,102,0.3)",
                    color: "#4ade80",
                    textDecoration: "none",
                  }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Send via WhatsApp ↗
                </a>
                <button
                  onClick={saveBkTemplate}
                  disabled={bkTmplSaving}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs text-gray-500 hover:text-white transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <Save className="w-3.5 h-3.5" />
                  {bkTmplSaving ? "Saving…" : "Save default"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CRM tab bar styles ────────────────────────────────────────────────────────
const CRM_CSS = `
  .crm-tabs {
    display: flex;
    gap: 2px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 16px;
    flex-shrink: 0;
  }
  .crm-tabs::-webkit-scrollbar { display: none; }
  .crm-tab {
    flex-shrink: 0;
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 500;
    color: #6b7280;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    font-family: system-ui, sans-serif;
    white-space: nowrap;
    margin-bottom: -1px;
  }
  .crm-tab:hover { color: #111827; }
  .crm-tab.active {
    color: #111827;
    border-bottom-color: #dc2626;
    font-weight: 600;
  }
`;

// ─── CRMPanel (exported) ──────────────────────────────────────────────────────
const CRM_TABS = ['leads', 'bookings', 'outreach'];

// initialTab / openLeadId come from the URL (/dashboard/crm?sub=bookings,
// ?lead=<id>) so an Overview alert opens the exact sub-tab or lead.
export default function CRMPanel({ userId, listings = [], salesmen = [], initialTab = null, openLeadId = null, onTabChange, onOpenDoc }) {
  const startTab = openLeadId ? 'leads' : (CRM_TABS.includes(initialTab) ? initialTab : 'leads');
  const [crmTab, setCrmTabState] = useState(startTab);
  useEffect(() => { setCrmTabState(startTab); }, [startTab]);
  const setCrmTab = (t) => { setCrmTabState(t); onTabChange?.(t); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <style>{CRM_CSS}</style>
      <div className="crm-tabs" style={{ padding: '0 4px' }}>
        <button className={`crm-tab${crmTab === 'leads' ? ' active' : ''}`} onClick={() => setCrmTab('leads')}>
          Leads / Pipeline
        </button>
        <button className={`crm-tab${crmTab === 'bookings' ? ' active' : ''}`} onClick={() => setCrmTab('bookings')}>
          Appointments
        </button>
        <button className={`crm-tab${crmTab === 'outreach' ? ' active' : ''}`} onClick={() => setCrmTab('outreach')}>
          Outreach
        </button>
      </div>
      {crmTab === 'leads'    && <LeadsPage dealerId={userId} openLeadId={openLeadId} onOpenDoc={onOpenDoc} />}
      {crmTab === 'bookings' && <BookingsTab userId={userId} listings={listings} salesmen={salesmen} />}
      {crmTab === 'outreach' && <OutreachHub dealerId={userId} />}
    </div>
  );
}
