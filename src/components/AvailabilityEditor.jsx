import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import { Clock, Check } from "lucide-react";

// Seller sets their viewing schedule ONCE. Feeds the buyer tap-calendar
// (get_booking_slots RPC). Owner = the logged-in profile (a linked/solo
// salesman sets their own; a dealer sets the house calendar for cars nobody
// has claimed). Theme-aware: dark salesman panels vs the light dealer dash.
//
// weekdays use 0=Sun..6=Sat to match JS Date.getDay(); displayed Mon-first.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
const fmtHour = (h) => {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};

export default function AvailabilityEditor({ ownerId, dealerId, dark = false }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(18);
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [isActive, setIsActive] = useState(true);

  const c = dark
    ? { card: "#0d1117", border: "rgba(255,255,255,0.08)", text: "#f1f5f9", muted: "#64748b", chipBg: "rgba(255,255,255,0.04)", chipBorder: "rgba(255,255,255,0.1)", inputBg: "rgba(255,255,255,0.05)" }
    : { card: "#fff", border: "#e5e7eb", text: "#111827", muted: "#6b7280", chipBg: "#f9fafb", chipBorder: "#e5e7eb", inputBg: "#fff" };

  useEffect(() => {
    if (!ownerId) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("booking_availability")
        .select("weekdays, start_hour, end_hour, slot_minutes, is_active")
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (!alive) return;
      if (!error && data) {
        setWeekdays(Array.isArray(data.weekdays) ? data.weekdays : [1, 2, 3, 4, 5]);
        setStartHour(data.start_hour ?? 9);
        setEndHour(data.end_hour ?? 18);
        setSlotMinutes(data.slot_minutes ?? 60);
        setIsActive(data.is_active ?? true);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [ownerId]);

  const toggleDay = (d) =>
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort((a, b) => a - b)));

  const save = async () => {
    if (weekdays.length === 0) { toast.error(t("availability.pickDay")); return; }
    if (endHour <= startHour) { toast.error(t("availability.endAfterStart")); return; }
    setSaving(true);
    const { error } = await supabase.from("booking_availability").upsert(
      {
        owner_id: ownerId,
        dealer_id: dealerId || null,
        weekdays,
        start_hour: startHour,
        end_hour: endHour,
        slot_minutes: slotMinutes,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id" },
    );
    setSaving(false);
    if (error) { toast.error(t("availability.saveError")); console.error("[AvailabilityEditor]", error.message); return; }
    toast.success(t("availability.saved"));
  };

  const startOpts = Array.from({ length: 17 }, (_, i) => i + 6); // 6..22
  const endOpts = Array.from({ length: 18 }, (_, i) => i + 7);   // 7..24

  const label = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: c.muted, margin: "0 0 8px" };
  const select = { background: c.inputBg, border: `1px solid ${c.chipBorder}`, borderRadius: 8, padding: "8px 10px", color: c.text, fontSize: 14, fontFamily: "inherit", cursor: "pointer", outline: "none" };

  if (loading) return <p style={{ fontSize: 12, color: c.muted, margin: 0 }}>{t("availability.loading")}</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Clock size={16} color="#dc2626" />
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: c.text }}>{t("availability.title")}</p>
      </div>
      <p style={{ margin: "-12px 0 0", fontSize: 12, color: c.muted, lineHeight: 1.5 }}>
        {t("availability.subtitle")}
      </p>

      {/* Working days */}
      <div>
        <p style={label}>{t("availability.workingDays")}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {DAY_ORDER.map((d) => {
            const on = weekdays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                style={{
                  minWidth: 52, padding: "8px 4px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
                  fontFamily: "inherit", transition: "all 0.15s",
                  background: on ? "#dc2626" : c.chipBg,
                  border: on ? "1px solid #dc2626" : `1px solid ${c.chipBorder}`,
                  color: on ? "#fff" : c.muted,
                }}
              >
                {DAY_LABEL[d]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hours */}
      <div>
        <p style={label}>{t("availability.openHours")}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} style={select}>
            {startOpts.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
          </select>
          <span style={{ fontSize: 13, color: c.muted }}>{t("availability.to")}</span>
          <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} style={select}>
            {endOpts.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
          </select>
        </div>
      </div>

      {/* Slot length */}
      <div>
        <p style={label}>{t("availability.slotLength")}</p>
        <div style={{ display: "flex", gap: 8 }}>
          {[30, 60].map((m) => {
            const on = slotMinutes === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setSlotMinutes(m)}
                style={{
                  padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                  background: on ? "#dc2626" : c.chipBg,
                  border: on ? "1px solid #dc2626" : `1px solid ${c.chipBorder}`,
                  color: on ? "#fff" : c.muted,
                }}
              >
                {m} {t("availability.minutes")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active toggle */}
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
        <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isActive ? "#dc2626" : "transparent", border: isActive ? "1px solid #dc2626" : `2px solid ${c.chipBorder}` }}
          onClick={() => setIsActive((v) => !v)}>
          {isActive && <Check size={12} color="#fff" strokeWidth={3} />}
        </div>
        <span style={{ fontSize: 13, color: c.text }}>{t("availability.acceptBookings")}</span>
      </label>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        style={{
          alignSelf: "flex-start", background: "#dc2626", color: "#fff", border: "none", borderRadius: 10,
          padding: "11px 26px", fontSize: 14, fontWeight: 700, fontFamily: "inherit",
          cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? t("availability.saving") : t("availability.save")}
      </button>
    </div>
  );
}
