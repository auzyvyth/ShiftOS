import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { panel as C, panelType as T } from "../../theme/tokens";

// Premium Bookings, week view. The seller's side of the calendar buyers
// already book through (BookingCalendar.jsx, get_booking_slots): same hours
// (booking_availability), same appointments rows, laid out as a week.
//
// Desktop is a 7-column grid. A phone gets a day strip + one-day timeline,
// because seven columns at 375px cannot hold a name.
//
// Nothing here writes. Every action is handed back to the panel, which already
// owns the flows: tapping a block opens the existing booking detail sheet,
// "Confirm on WhatsApp" is openConfirmBookingModal (a drafted message the
// seller sends, never an automatic one — AI trust boundary), "Move" opens the
// detail sheet on its reschedule step.
//
// Status is the block's whole fill + border + a dot, never a coloured side bar
// (anti-slop rule). Colours were chosen FOR the dark panel, measured, not
// borrowed from the light dashboard: a dark block on a dark grid (1.09:1) and
// a 45%-opacity "done" block were unreadable. See PALETTE below; every name
// and car line clears 5:1 against its fill, most 8-12:1. Open hours are
// lighter than closed hours, so "where buyers can book" reads at a glance.
// Cancelled bookings are left off the grid; the List view still has them.

const HOUR_PX = 56;
// Dark-surface palette for this view. Solid hexes (not alpha) so the contrast
// is the same on every monitor; ratios measured against each fill.
const PALETTE = {
  open: "#111722",       // bookable hours: one step lighter than the card
  closed: "#090c12",     // outside hours: one step darker, hatched
  hourLine: "rgba(255,255,255,.07)",
  todayTint: "rgba(220,38,38,.06)",
  ok:   { fill: "#133524", border: "#2f8f5b", name: "#ecfdf5", sub: "#9fd8b5", dot: "#4ade80" }, // 12.8 / 8.3:1
  wait: { fill: "#3a2a0a", border: "#d4a02a", name: "#fef3c7", sub: "#e9c46a", dot: "#fbbf24" }, // 12.4 / 8.3:1
  done: { fill: "#1a202a", border: "#2c3644", name: "#a8b3c4", sub: "#8391a5", dot: "#8391a5" }, //  7.7 / 5.1:1
};
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// When a seller has set no hours, buyers get an open Mon-Sun 9am-6pm grid
// (BookingCalendar.jsx fallback), so that is what "outside hours" means here.
const FALLBACK_HOURS = { weekdays: [0, 1, 2, 3, 4, 5, 6], start_hour: 9, end_hour: 18, slot_minutes: 60 };

const STATUS = {
  pending:     { key: "wait", label: "Needs your OK" },
  confirmed:   { key: "ok",   label: "Confirmed" },
  rescheduled: { key: "ok",   label: "Moved" },
  completed:   { key: "done", label: "Done" },
  no_show:     { key: "done", label: "No-show" },
};

const startOfWeek = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
};
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmtHour = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
const fmtTime = (d) => {
  const h = d.getHours(), m = d.getMinutes();
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
};
const fmtRange = (a, b) => {
  const mo = (d) => d.toLocaleDateString("en-MY", { month: "short" });
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${mo(b)} ${b.getFullYear()}`
    : `${a.getDate()} ${mo(a)} – ${b.getDate()} ${mo(b)} ${b.getFullYear()}`;
};
const carName = (car) => (car ? [car.year, car.brand, car.model].filter(Boolean).join(" ") : "No car linked");
// "Mon – Sat", "Mon – Fri, Sun": consecutive open days collapse into a range.
const hoursText = (h) => {
  const open = [1, 2, 3, 4, 5, 6, 0].map((d) => h.weekdays.includes(d)); // Mon-first
  const runs = [];
  open.forEach((on, i) => {
    if (!on) return;
    const last = runs[runs.length - 1];
    if (last && last[1] === i - 1) last[1] = i; else runs.push([i, i]);
  });
  const days = runs.length === 1 && runs[0][0] === 0 && runs[0][1] === 6 ? "Every day"
    : runs.map(([a, z]) => (a === z ? DAY_NAMES[a] : `${DAY_NAMES[a]} – ${DAY_NAMES[z]}`)).join(", ");
  return `${days} · ${fmtHour(h.start_hour)} – ${fmtHour(h.end_hour)}`;
};

// Side-by-side lanes for bookings that overlap in time on one day.
function layDay(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start);
  const lanesEnd = [];
  sorted.forEach((it) => {
    let lane = lanesEnd.findIndex((end) => end <= it.start);
    if (lane === -1) { lane = lanesEnd.length; lanesEnd.push(0); }
    lanesEnd[lane] = it.end;
    it.lane = lane;
  });
  sorted.forEach((it) => {
    it.lanes = Math.max(1, ...sorted.filter((o) => o.start < it.end && o.end > it.start).map((o) => o.lane + 1));
  });
  return sorted;
}

export default function BookingWeekCalendar({ appointments, hours, nowTick, onOpen, onConfirm, onMove, onEditHours }) {
  const now = new Date(nowTick || Date.now());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now));
  const [dayIdx, setDayIdx] = useState(() => (now.getDay() + 6) % 7);
  const rule = hours || FALLBACK_HOURS;

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = addDays(weekStart, 7);

  // This week's bookings, per day, with start/end in fractional hours.
  const byDay = useMemo(() => {
    const out = days.map(() => []);
    (appointments || []).forEach((a) => {
      if (!a.appointment_date || a.status === "cancelled") return;
      const d = new Date(a.appointment_date);
      if (isNaN(d) || d < weekStart || d >= weekEnd) return;
      const start = d.getHours() + d.getMinutes() / 60;
      const dur = Math.max(15, Number(a.duration_minutes) || rule.slot_minutes || 60);
      out[(d.getDay() + 6) % 7].push({ apt: a, date: d, start, end: start + dur / 60 });
    });
    return out.map(layDay);
  }, [appointments, days, weekStart, weekEnd, rule.slot_minutes]);

  // Grid spans the seller's hours, stretched to fit any booking outside them.
  const all = byDay.flat();
  const startH = Math.max(0, Math.min(rule.start_hour, ...all.map((b) => Math.floor(b.start))) - 1);
  const endH = Math.min(24, Math.max(rule.end_hour, ...all.map((b) => Math.ceil(b.end))) + 1);
  const y = (h) => (h - startH) * HOUR_PX;
  const gridH = (endH - startH) * HOUR_PX;

  const pending = (appointments || [])
    .filter((a) => a.status === "pending" && a.appointment_date)
    .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
  const counts = all.reduce((c, b) => {
    const k = (STATUS[b.apt.status] || STATUS.confirmed).key;
    c[k] = (c[k] || 0) + 1;
    return c;
  }, {});

  const go = (n) => {
    setWeekStart((w) => addDays(w, 7 * n));
    setDayIdx(0);
  };
  const goToday = () => { setWeekStart(startOfWeek(new Date())); setDayIdx((new Date().getDay() + 6) % 7); };
  const isOpenDay = (d) => rule.weekdays.includes(d.getDay());

  const offBands = (d) => {
    if (!isOpenDay(d)) return [<div key="all" className="bwc-off" style={{ top: 0, height: gridH }} />];
    const bands = [];
    if (rule.start_hour > startH) bands.push(<div key="a" className="bwc-off" style={{ top: 0, height: y(rule.start_hour) }} />);
    if (rule.end_hour < endH) bands.push(<div key="z" className="bwc-off" style={{ top: y(rule.end_hour), height: gridH - y(rule.end_hour) }} />);
    return bands;
  };

  const block = (b, showTime) => {
    const st = STATUS[b.apt.status] || STATUS.confirmed;
    const h = Math.max(26, (b.end - b.start) * HOUR_PX - 4);
    const w = 100 / b.lanes;
    return (
      <button
        key={b.apt.id}
        type="button"
        className={`bwc-bk bwc-${st.key}`}
        style={{ top: y(b.start) + 2, height: h, left: `calc(${w * b.lane}% + 3px)`, width: `calc(${w}% - 6px)` }}
        onClick={() => onOpen(b.apt)}
        aria-label={`${b.apt.buyer_name || "Buyer"}, ${carName(b.apt.car_listings)}, ${fmtTime(b.date)}, ${st.label}`}
      >
        <b><i />{b.apt.buyer_name || "Buyer"}</b>
        {h > 34 && <span>{carName(b.apt.car_listings)}{showTime ? ` · ${fmtTime(b.date)}` : ""}</span>}
      </button>
    );
  };

  const timeCol = (
    <div className="bwc-times" style={{ height: gridH }}>
      {Array.from({ length: endH - startH }, (_, i) => (
        <div key={i} style={{ top: i * HOUR_PX }}>{i === 0 ? "" : fmtHour(startH + i)}</div>
      ))}
    </div>
  );
  const nowLine = (d) => (sameDay(d, now) && now.getHours() + now.getMinutes() / 60 >= startH
    && now.getHours() + now.getMinutes() / 60 <= endH)
    ? <div className="bwc-now" style={{ top: y(now.getHours() + now.getMinutes() / 60) }} /> : null;

  const empty = all.length === 0;
  const sel = days[dayIdx];

  return (
    <div className="bwc">
      <style>{CSS}</style>
      <div className="bwc-layout">
        <div className="bwc-card bwc-main">
          <div className="bwc-head">
            <div style={{ minWidth: 0 }}>
              <h2>Test drives &amp; viewings</h2>
              <p className="bwc-sub">{fmtRange(days[0], days[6])} · {all.length} booked</p>
            </div>
            <div className="bwc-ctrls">
              <button type="button" className="bwc-btn bwc-icon" onClick={() => go(-1)} aria-label="Previous week"><ChevronLeft size={16} /></button>
              <button type="button" className="bwc-btn" onClick={goToday}>Today</button>
              <button type="button" className="bwc-btn bwc-icon" onClick={() => go(1)} aria-label="Next week"><ChevronRight size={16} /></button>
            </div>
          </div>

          {/* Desktop: the week */}
          <div className="bwc-desk">
            <div className="bwc-days">
              <div />
              {days.map((d, i) => (
                <div key={i} className={`bwc-day${sameDay(d, now) ? " bwc-today" : ""}${isOpenDay(d) ? "" : " bwc-closed"}`}>
                  <div className="bwc-dn">{DAY_NAMES[i]}</div>
                  <div className="bwc-dd">{d.getDate()}</div>
                  <div className="bwc-dc">{byDay[i].length ? `${byDay[i].length} booked` : isOpenDay(d) ? "" : "Closed"}</div>
                </div>
              ))}
            </div>
            <div className="bwc-body" style={{ height: gridH }}>
              {timeCol}
              {days.map((d, i) => (
                <div key={i} className={sameDay(d, now) ? "bwc-col bwc-col-today" : "bwc-col"} style={{ height: gridH }}>
                  {offBands(d)}
                  {nowLine(d)}
                  {byDay[i].map((b) => block(b, false))}
                </div>
              ))}
            </div>
          </div>

          {/* Phone: day strip + the chosen day */}
          <div className="bwc-mob">
            <div className="bwc-strip">
              {days.map((d, i) => (
                <button key={i} type="button" className={`${i === dayIdx ? "bwc-on" : ""}${sameDay(d, now) ? " bwc-today" : ""}`} onClick={() => setDayIdx(i)}>
                  <span className="bwc-dn">{DAY_NAMES[i]}</span>
                  <span className="bwc-dd">{d.getDate()}</span>
                  <span className="bwc-dots">
                    {byDay[i].slice(0, 3).map((b) => <i key={b.apt.id} className={`bwc-dot-${(STATUS[b.apt.status] || STATUS.confirmed).key}`} />)}
                  </span>
                </button>
              ))}
            </div>
            {byDay[dayIdx].length === 0 && (
              <p className="bwc-dayempty">{isOpenDay(sel) ? "No bookings this day." : "Closed. Buyers can't book this day."}</p>
            )}
            <div className="bwc-body bwc-mbody" style={{ height: gridH }}>
              {timeCol}
              <div className="bwc-col" style={{ height: gridH }}>
                {offBands(sel)}
                {nowLine(sel)}
                {byDay[dayIdx].map((b) => block(b, true))}
              </div>
            </div>
          </div>

          {empty && <p className="bwc-empty">No bookings this week. Buyers book from the Book a Viewing button on your car pages, inside the hours below.</p>}

          <div className="bwc-legend">
            <span><i className="bwc-dot-ok" />Confirmed</span>
            <span><i className="bwc-dot-wait" />Needs your OK</span>
            <span><i className="bwc-dot-done" />Done</span>
            <span><i className="bwc-hatch" />Outside your hours, buyers can't pick it</span>
          </div>
        </div>

        <div className="bwc-rail">
          <div className="bwc-card bwc-pad bwc-r-ok">
            <p className="bwc-eb">Needs your OK · {pending.length}</p>
            {pending.length === 0 && <p className="bwc-muted">Nothing waiting. New booking requests show up here first.</p>}
            {pending.slice(0, 6).map((a) => {
              const d = new Date(a.appointment_date);
              const passed = d < now;
              return (
                <div key={a.id} className="bwc-req">
                  <div className="bwc-who">{a.buyer_name || "Buyer"}</div>
                  <div className="bwc-what">{carName(a.car_listings)}</div>
                  <div className={passed ? "bwc-when bwc-passed" : "bwc-when"}>
                    {d.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })}, {fmtTime(d)}{passed ? " · time has passed" : ""}
                  </div>
                  <div className="bwc-acts">
                    <button type="button" className="bwc-primary" onClick={() => onConfirm(a)}>
                      {a.buyer_phone ? "Confirm on WhatsApp" : "Confirm"}
                    </button>
                    <button type="button" className="bwc-btn" onClick={() => onMove(a)}>Move</button>
                  </div>
                </div>
              );
            })}
            {pending.length > 6 && <p className="bwc-muted">{pending.length - 6} more in the List view.</p>}
          </div>
          <div className="bwc-card bwc-pad">
            <p className="bwc-eb">This week</p>
            <div className="bwc-stats">
              <div><b>{counts.ok || 0}</b><span>confirmed</span></div>
              <div><b>{counts.wait || 0}</b><span>to confirm</span></div>
              <div><b>{counts.done || 0}</b><span>done</span></div>
            </div>
          </div>
          <div className="bwc-card bwc-pad">
            <p className="bwc-eb bwc-row">Your booking hours <button type="button" className="bwc-link" onClick={onEditHours}>Edit</button></p>
            <p className="bwc-what">{hours ? hoursText(rule) : "Not set yet. Buyers can pick any day, 9 AM – 6 PM."}</p>
            <p className="bwc-muted">{rule.slot_minutes || 60} min per booking</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .bwc { --hour: ${HOUR_PX}px; color: ${C.text}; }
  .bwc *, .bwc *::before, .bwc *::after { box-sizing: border-box; }
  .bwc button { font-family: inherit; }
  .bwc-layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 14px; align-items: start; }
  .bwc-card { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 14px; min-width: 0; }
  .bwc-pad { padding: 12px 14px; }
  .bwc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid ${C.border}; flex-wrap: wrap; }
  .bwc-head h2 { margin: 0; font-size: ${T.size.lg}px; font-weight: 700; }
  .bwc-sub { margin: 2px 0 0; font-size: ${T.size.sm}px; color: ${C.textMuted}; font-variant-numeric: tabular-nums; }
  .bwc-ctrls { display: flex; gap: 6px; }
  .bwc-btn { height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid ${C.borderStrong}; background: transparent; color: ${C.text}; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
  .bwc-icon { width: 32px; padding: 0; }
  .bwc-btn:hover { background: ${C.fill}; }

  .bwc-days { display: grid; grid-template-columns: 52px repeat(7, minmax(0, 1fr)); border-bottom: 1px solid ${C.border}; }
  .bwc-day { padding: 8px 2px; text-align: center; }
  .bwc-dn { font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: ${C.textMuted}; }
  .bwc-dd { display: inline-block; margin-top: 4px; width: 30px; height: 30px; line-height: 30px; border-radius: 50%; font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .bwc-today .bwc-dd { background: ${C.accent}; color: #fff; }
  .bwc-dc { font-size: 10px; color: ${C.textSec}; margin-top: 2px; min-height: 13px; }
  .bwc-closed .bwc-dd { color: ${C.textDim}; }
  .bwc-today.bwc-closed .bwc-dd { color: #fff; }
  .bwc-dayempty { margin: 0; padding: 10px 14px; font-size: 12px; color: ${C.textSec}; border-bottom: 1px solid ${C.border}; }
  .bwc-body { display: grid; grid-template-columns: 52px repeat(7, minmax(0, 1fr)); position: relative; }
  .bwc-mbody { grid-template-columns: 48px minmax(0, 1fr); }
  .bwc-times { position: relative; }
  .bwc-times div { position: absolute; right: 8px; transform: translateY(-6px); font-size: 10px; font-weight: 600; color: ${C.textSec}; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .bwc-col { position: relative; border-left: 1px solid ${PALETTE.hourLine}; background-color: ${PALETTE.open}; background-image: linear-gradient(${PALETTE.hourLine} 1px, transparent 1px); background-size: 100% var(--hour); }
  .bwc-col.bwc-col-today { background-image: linear-gradient(${PALETTE.hourLine} 1px, transparent 1px), linear-gradient(${PALETTE.todayTint}, ${PALETTE.todayTint}); background-size: 100% var(--hour), 100% 100%; }
  .bwc-off { position: absolute; left: 0; right: 0; background-color: ${PALETTE.closed}; background-image: repeating-linear-gradient(135deg, rgba(255,255,255,.045) 0 2px, transparent 2px 9px); pointer-events: none; }
  .bwc-now { position: absolute; left: -1px; right: 0; height: 2px; background: ${C.accent}; z-index: 3; pointer-events: none; }
  .bwc-now::before { content: ''; position: absolute; left: -4px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: ${C.accent}; }

  .bwc-bk { position: absolute; z-index: 2; border-radius: 8px; padding: 5px 7px; overflow: hidden; cursor: pointer; text-align: left; border: 1px solid; box-shadow: 0 1px 0 rgba(0,0,0,.35); transition: filter .12s; }
  .bwc-bk b { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bwc-bk span { display: block; font-size: 11px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
  .bwc-bk i { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .bwc-bk:hover { filter: brightness(1.18); }
  .bwc-bk:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
  .bwc-ok   { background: ${PALETTE.ok.fill};   border-color: ${PALETTE.ok.border};   color: ${PALETTE.ok.name}; }
  .bwc-ok span { color: ${PALETTE.ok.sub}; }     .bwc-ok i { background: ${PALETTE.ok.dot}; }
  .bwc-wait { background: ${PALETTE.wait.fill}; border-color: ${PALETTE.wait.border}; border-style: dashed; color: ${PALETTE.wait.name}; }
  .bwc-wait span { color: ${PALETTE.wait.sub}; } .bwc-wait i { background: ${PALETTE.wait.dot}; }
  .bwc-done { background: ${PALETTE.done.fill}; border-color: ${PALETTE.done.border}; color: ${PALETTE.done.name}; }
  .bwc-done span { color: ${PALETTE.done.sub}; } .bwc-done i { background: ${PALETTE.done.dot}; }

  .bwc-legend { display: flex; gap: 14px; flex-wrap: wrap; padding: 10px 14px; border-top: 1px solid ${C.border}; font-size: 11px; color: ${C.textSec}; }
  .bwc-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .bwc-legend i { width: 16px; height: 11px; border-radius: 3px; display: inline-block; border: 1px solid; }
  .bwc-legend .bwc-dot-ok { background: ${PALETTE.ok.fill}; border-color: ${PALETTE.ok.border}; }
  .bwc-legend .bwc-dot-wait { background: ${PALETTE.wait.fill}; border-color: ${PALETTE.wait.border}; border-style: dashed; }
  .bwc-legend .bwc-dot-done { background: ${PALETTE.done.fill}; border-color: ${PALETTE.done.border}; }
  .bwc-legend .bwc-hatch { background-color: ${PALETTE.closed}; border-color: rgba(255,255,255,.12); background-image: repeating-linear-gradient(135deg, rgba(255,255,255,.14) 0 2px, transparent 2px 5px); }
  .bwc-dots .bwc-dot-ok { background: ${PALETTE.ok.dot}; }
  .bwc-dots .bwc-dot-wait { background: ${PALETTE.wait.dot}; }
  .bwc-dots .bwc-dot-done { background: ${PALETTE.done.dot}; }
  .bwc-empty { margin: 0; padding: 12px 14px; font-size: 12px; color: ${C.textSec}; border-top: 1px solid ${C.border}; }

  .bwc-rail { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .bwc-eb { margin: 0 0 8px; font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: ${C.textMuted}; }
  .bwc-row { display: flex; align-items: center; justify-content: space-between; }
  .bwc-link { background: none; border: none; padding: 0; color: ${C.textSec}; font-size: 12px; font-weight: 600; letter-spacing: 0; text-transform: none; cursor: pointer; }
  .bwc-muted { margin: 6px 0 0; font-size: 12px; color: ${C.textMuted}; line-height: 1.5; }
  .bwc-req { padding: 10px 0; border-top: 1px solid ${C.line}; }
  .bwc-eb + .bwc-req { border-top: none; padding-top: 2px; }
  .bwc-who { font-size: 13px; font-weight: 600; }
  .bwc-what { margin: 2px 0 0; font-size: 12px; color: ${C.textSec}; line-height: 1.5; }
  .bwc-when { margin-top: 4px; font-size: 12px; font-weight: 600; color: ${PALETTE.wait.dot}; font-variant-numeric: tabular-nums; }
  .bwc-passed { color: ${C.textMuted}; }
  .bwc-acts { display: flex; gap: 6px; margin-top: 8px; }
  .bwc-primary { flex: 1; height: 32px; border: none; border-radius: 8px; background: ${C.accent}; color: #fff; font-size: 12px; font-weight: 700; cursor: pointer; }
  .bwc-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .bwc-stats b { display: block; font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .bwc-stats span { font-size: 11px; color: ${C.textMuted}; }

  .bwc-mob { display: none; }
  .bwc-strip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; padding: 10px; border-bottom: 1px solid ${C.border}; }
  .bwc-strip button { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 0; border: none; border-radius: 10px; background: transparent; color: ${C.text}; cursor: pointer; }
  .bwc-strip .bwc-dd { margin: 0; width: auto; height: auto; line-height: 1.2; font-size: 15px; background: none; }
  .bwc-strip .bwc-today .bwc-dd { color: ${C.dangerText}; }
  .bwc-strip button.bwc-on { background: ${C.accent}; }
  .bwc-strip button.bwc-on .bwc-dn, .bwc-strip button.bwc-on .bwc-dd { color: #fff; }
  .bwc-strip button.bwc-on .bwc-dots i { box-shadow: 0 0 0 1.5px #fff; }
  .bwc-dots { display: flex; gap: 3px; height: 6px; }
  .bwc-dots i { width: 5px; height: 5px; border-radius: 50%; }
  .bwc-mbody .bwc-bk { padding: 7px 10px; }
  .bwc-mbody .bwc-bk b { font-size: 13px; }

  @media (max-width: 760px) {
    .bwc-layout { grid-template-columns: minmax(0, 1fr); }
    .bwc-desk { display: none; }
    .bwc-mob { display: block; }
    .bwc-rail { display: contents; }
    .bwc-r-ok { order: -1; }
  }
`;
