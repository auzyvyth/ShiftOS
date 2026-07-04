import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

// Buyer-facing tap calendar. One RPC call (get_booking_slots) resolves whose
// calendar this is (ref slug > assigned rep > dealer house), returns their
// weekly rule + the already-taken slots. Days the seller is off — or fully
// booked, or in the past — are disabled, so a buyer can only tap a slot the
// seller can actually honor. When the seller has set no hours, it degrades to
// an open Mon–Sun / 9am–6pm hourly grid so booking never breaks.
//
// Emits the same { date:'YYYY-MM-DD', time:'HH:MM' } shape the old native
// inputs did, so the parent's submit handler is unchanged.

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtTime = (h, m) => {
  const ap = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
};

const DAYS_AHEAD = 21;

export default function BookingCalendar({ carId, refSlug, th, isXdrive, value, onChange }) {
  const [loading, setLoading] = useState(true);
  const [rule, setRule] = useState({ has: false, weekdays: [0, 1, 2, 3, 4, 5, 6], startHour: 9, endHour: 18, slotMinutes: 60 });
  const [bookedSet, setBookedSet] = useState(() => new Set());
  const [openDay, setOpenDay] = useState(value?.date || null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_booking_slots", {
        p_car_id: carId,
        p_ref_slug: refSlug || null,
        p_days: DAYS_AHEAD,
      });
      if (!alive) return;
      // On any failure fall back to an open grid — booking must never break.
      if (error || !data) {
        setRule({ has: false, weekdays: [0, 1, 2, 3, 4, 5, 6], startHour: 9, endHour: 18, slotMinutes: 60 });
        setBookedSet(new Set());
        setLoading(false);
        return;
      }
      setRule({
        has: !!data.has_availability,
        weekdays: Array.isArray(data.weekdays) ? data.weekdays : [0, 1, 2, 3, 4, 5, 6],
        startHour: data.start_hour ?? 9,
        endHour: data.end_hour ?? 18,
        slotMinutes: data.slot_minutes ?? 60,
      });
      const taken = new Set((data.booked || []).map((b) => new Date(b).getTime()));
      setBookedSet(taken);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [carId, refSlug]);

  // Slot list for a given day (future, not booked). Local time throughout —
  // buyer and seller are both MYT, and the stored instant round-trips cleanly.
  const slotsFor = useMemo(() => {
    return (date) => {
      const now = new Date();
      const sh = rule.startHour, eh = rule.endHour, step = rule.slotMinutes;
      const out = [];
      for (let mins = sh * 60; mins + step <= eh * 60 + (step === 60 ? 0 : 0) && mins < eh * 60; mins += step) {
        const h = Math.floor(mins / 60), m = mins % 60;
        const slot = new Date(date);
        slot.setHours(h, m, 0, 0);
        if (slot <= now) continue;
        if (bookedSet.has(slot.getTime())) continue;
        out.push({ h, m, label: fmtTime(h, m) });
      }
      return out;
    };
  }, [rule, bookedSet]);

  // Build the day cells: leading blanks to align today under its weekday, then
  // DAYS_AHEAD real days.
  const cells = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lead = today.getDay();
    const arr = Array.from({ length: lead }, () => null);
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dow = d.getDay();
      const inSchedule = rule.weekdays.includes(dow);
      const hasSlots = inSchedule && slotsFor(d).length > 0;
      arr.push({ date: d, key: ymd(d), disabled: !hasSlots });
    }
    return arr;
  }, [rule, slotsFor]);

  const accent = "#dc2626";
  const cellBase = {
    aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, border: "1px solid transparent",
  };

  const openSlots = openDay ? slotsFor(new Date(`${openDay}T00:00:00`)) : [];

  if (loading) {
    return <div style={{ padding: "24px 0", textAlign: "center", fontSize: 12, color: th.textMuted, fontFamily: "'DM Sans',sans-serif" }}>Loading available times…</div>;
  }

  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: th.textMuted, fontWeight: 700, margin: "0 0 8px", fontFamily: "'DM Sans',sans-serif" }}>
        {rule.has ? "Pick an available day" : "Pick a day"}
      </p>

      {/* weekday header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
        {DOW.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", color: th.textMuted, textTransform: "uppercase", fontFamily: "'DM Sans',sans-serif" }}>{d}</div>
        ))}
      </div>

      {/* day grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`b${i}`} />;
          const selected = openDay === cell.key;
          if (cell.disabled) {
            return (
              <div key={cell.key} style={{ ...cellBase, color: th.textMuted, opacity: 0.28, cursor: "not-allowed" }} aria-disabled>
                <span>{cell.date.getDate()}</span>
              </div>
            );
          }
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => { setOpenDay(cell.key); onChange({ date: cell.key, time: "" }); }}
              style={{
                ...cellBase, cursor: "pointer",
                background: selected ? accent : (isXdrive ? "#f3f4f6" : "rgba(255,255,255,0.05)"),
                border: selected ? `1px solid ${accent}` : `1px solid ${th.border}`,
                color: selected ? "#fff" : th.text,
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.7 }}>{MONTH[cell.date.getMonth()]}</span>
              <span>{cell.date.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* time chips for the chosen day */}
      {openDay && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: th.textMuted, fontWeight: 700, margin: "0 0 8px", fontFamily: "'DM Sans',sans-serif" }}>
            Pick a time
          </p>
          {openSlots.length === 0 ? (
            <p style={{ fontSize: 12, color: th.textMuted, margin: 0, fontFamily: "'DM Sans',sans-serif" }}>No times left on this day — pick another.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {openSlots.map((s) => {
                const t = `${String(s.h).padStart(2, "0")}:${String(s.m).padStart(2, "0")}`;
                const sel = value?.time === t && value?.date === openDay;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange({ date: openDay, time: t })}
                    style={{
                      padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
                      background: sel ? accent : (isXdrive ? "#f3f4f6" : "rgba(255,255,255,0.05)"),
                      border: sel ? `1px solid ${accent}` : `1px solid ${th.border}`,
                      color: sel ? "#fff" : th.text,
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
